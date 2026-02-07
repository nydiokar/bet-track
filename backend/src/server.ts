import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { env, envPath } from "./lib/env.js";
import { prisma } from "./lib/prisma.js";
import { autoStatus, newId } from "./lib/domain.js";
import { authBodySchema, createBetSchema, legSchema, listQuerySchema, patchBetSchema } from "./lib/schemas.js";
import { extractBetFromImage } from "./services/extraction.js";
import { createSettlementProvider } from "./settlement/providerFactory.js";
import { runSettlementCycle } from "./settlement/runner.js";
import { parseBetTypeToMarket } from "./settlement/marketParser.js";

const app = Fastify({
  trustProxy: true,
  logger: {
    level: env.LOG_LEVEL,
    redact: {
      paths: ["req.headers.authorization", "req.headers.cookie", "req.body.password", "req.body.token"],
      remove: true,
    },
    ...(env.NODE_ENV === "development" ? { transport: { target: "pino-pretty" } } : {}),
  },
  disableRequestLogging: true,
});

const settlementProvider = createSettlementProvider();
let settlementInterval: NodeJS.Timeout | null = null;

await app.register(cors, { origin: env.CORS_ORIGIN });
await app.register(helmet);
await app.register(rateLimit, { max: 250, timeWindow: "15 minutes" });
await app.register(jwt, { secret: env.JWT_SECRET });
await app.register(multipart, { limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024, files: 1 } });

app.setErrorHandler((error, req, reply) => {
  const err = error as { statusCode?: number; message?: string };
  app.log.error({ err, reqId: req.id, method: req.method, url: req.url }, "request_failed");
  reply.status(err.statusCode ?? 500).send({ success: false, error: err.message || "Internal server error" });
});

app.addHook("onResponse", async (request, reply) => {
  const responseTime = reply.elapsedTime;
  if (reply.statusCode >= 400 || responseTime > 1200) {
    request.log.info(
      {
        reqId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTimeMs: Number(responseTime.toFixed(1)),
      },
      "request_summary"
    );
  }
});

const mapBet = (bet: Prisma.BetGetPayload<{ include: { legs: true } }> | null) => {
  if (!bet) return null;
  return {
    id: bet.id,
    kind: bet.kind,
    teams: bet.teams,
    bet_type: bet.betType,
    odds: bet.odds,
    stake: bet.stake,
    currency: bet.currency,
    match_time: bet.matchTime.toISOString(),
    created_at: bet.createdAt.toISOString(),
    uploaded_by: bet.uploadedBy,
    status: bet.status,
    confidence: bet.confidence,
    result: bet.result,
    actual_return: bet.actualReturn,
    settlement_state: bet.settlementState,
    settled_at: bet.settledAt?.toISOString() ?? null,
    provider: bet.provider,
    provider_ref: bet.providerRef,
    notes: bet.notes,
    legs: bet.legs
      .sort((a, b) => a.legOrder - b.legOrder)
      .map((leg) => ({
        id: leg.id,
        leg_order: leg.legOrder,
        teams: leg.teams,
        market_type: leg.marketType,
        selection: leg.selection,
        line: leg.line,
        odds: leg.odds,
        event_time: leg.eventTime.toISOString(),
        provider: leg.provider,
        provider_event_id: leg.providerEventId,
        settlement: leg.settlement,
        score_home: leg.scoreHome,
        score_away: leg.scoreAway,
      })),
  };
};

const makeDefaultLeg = (payload: Prisma.BetCreateInput) => {
  const parsed = parseBetTypeToMarket(payload.betType);
  return {
    id: newId(),
    legOrder: 1,
    teams: payload.teams,
    marketType: parsed.marketType,
    selection: parsed.selection,
    line: parsed.line,
    odds: payload.odds,
    eventTime: payload.matchTime,
    provider: payload.provider ?? null,
    providerEventId: payload.providerRef ?? null,
  };
};

const toCreateInput = (payload: ReturnType<typeof createBetSchema.parse>, actor: string): Prisma.BetCreateInput => {
  const matchTime = new Date(payload.match_time);

  const base: Prisma.BetCreateInput = {
    id: newId(),
    kind: payload.kind,
    teams: payload.teams,
    betType: payload.bet_type,
    odds: payload.odds,
    stake: payload.stake,
    currency: payload.currency,
    matchTime,
    uploadedBy: payload.uploaded_by ?? actor,
    status: payload.status ?? autoStatus(matchTime),
    confidence: payload.confidence ?? null,
    result: payload.result ?? null,
    actualReturn: payload.actual_return ?? null,
    settlementState: "pending",
    provider: payload.provider ?? null,
    providerRef: payload.provider_ref ?? null,
    notes: payload.notes ?? null,
  };

  const legs = payload.legs?.map((leg, idx) => ({
    id: newId(),
    legOrder: idx + 1,
    teams: leg.teams,
    marketType: leg.market_type,
    selection: leg.selection,
    line: leg.line ?? null,
    odds: leg.odds,
    eventTime: new Date(leg.event_time),
    provider: leg.provider ?? payload.provider ?? null,
    providerEventId: leg.provider_event_id ?? null,
  }));

  return {
    ...base,
    legs: {
      create: legs && legs.length > 0 ? legs : [makeDefaultLeg(base)],
    },
  };
};

const authGuard = async (request: any, reply: any) => {
  try {
    await request.jwtVerify();
    request.actor = request.user.actor;
  } catch {
    return reply.status(401).send({ success: false, error: "Invalid or expired token" });
  }
};

const refreshAutoStatus = async (bet: Prisma.BetGetPayload<{ include: { legs: true } }>) => {
  const next = autoStatus(bet.matchTime, bet.status);
  if (bet.status !== "settled" && bet.status !== next) {
    const updated = await prisma.bet.update({
      where: { id: bet.id },
      data: { status: next },
      include: { legs: true },
    });
    return updated;
  }
  return bet;
};

app.get("/health", async () => ({ success: true, status: "ok", timestamp: new Date().toISOString() }));

app.post("/api/auth", {
  config: {
    rateLimit: {
      max: 5,
      timeWindow: "15 minutes"
    }
  }
}, async (request, reply) => {
  const parsed = authBodySchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ success: false, error: "Password is required" });

  const normalizedPassword = parsed.data.password.normalize("NFKC").trim();
  const valid = await bcrypt.compare(normalizedPassword, env.PASSWORD_HASH);

  if (!valid) {
    request.log.warn({ reqId: request.id, ip: request.ip, passwordLength: parsed.data.password.length }, "auth_failed");
    return reply.status(401).send({ success: false, error: "Invalid password" });
  }

  const token = await reply.jwtSign({ actor: "shared_user" }, { expiresIn: env.JWT_EXPIRY_SECONDS });
  request.log.info({ reqId: request.id, ip: request.ip }, "auth_success");
  return { success: true, token, expires_in: env.JWT_EXPIRY_SECONDS };
});

app.post("/api/upload", { preHandler: [authGuard] }, async (request, reply) => {
  const start = Date.now();
  const part = await request.file();
  if (!part) return reply.status(400).send({ success: false, error: "Image file is required" });

  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowed.has(part.mimetype)) {
    return reply.status(400).send({ success: false, error: "Invalid image format" });
  }

  const bytes = await part.toBuffer();
  request.log.info({ reqId: request.id, actor: request.actor, mimeType: part.mimetype, bytes: bytes.length }, "upload_received");

  try {
    const { bet, raw } = await extractBetFromImage(part.mimetype, bytes);
    const created = await prisma.bet.create({
      data: toCreateInput(bet, request.actor),
      include: { legs: true },
    });

    await prisma.auditLog.create({
      data: {
        betId: created.id,
        action: "created",
        changedBy: request.actor,
        changes: JSON.stringify({ raw_extraction: raw }),
      },
    });

    request.log.info(
      { reqId: request.id, actor: request.actor, betId: created.id, confidence: created.confidence, durationMs: Date.now() - start },
      "upload_processed"
    );

    return { success: true, bet: mapBet(created), raw_extraction: raw, confidence: created.confidence };
  } catch (error: any) {
    request.log.warn({ reqId: request.id, actor: request.actor, durationMs: Date.now() - start, reason: error.message }, "upload_failed");
    return reply.status(error.statusCode ?? 422).send({
      success: false,
      error: error.statusCode === 503 ? "Image extraction is currently unavailable" : "Could not extract betting data from image",
      details: error.message,
      suggestion: "Ensure the bet slip is clearly visible",
    });
  }
});

app.post("/api/bets", { preHandler: [authGuard] }, async (request, reply) => {
  const parsed = createBetSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, error: "Invalid bet payload", details: parsed.error.flatten() });
  }

  if (parsed.data.legs) {
    for (const leg of parsed.data.legs) {
      const valid = legSchema.safeParse(leg);
      if (!valid.success) {
        return reply.status(400).send({ success: false, error: "Invalid leg payload", details: valid.error.flatten() });
      }
    }
  }

  const created = await prisma.bet.create({
    data: toCreateInput(parsed.data, request.actor),
    include: { legs: true },
  });

  await prisma.auditLog.create({
    data: { betId: created.id, action: "created", changedBy: request.actor, changes: JSON.stringify({ created: parsed.data }) },
  });

  request.log.info({ reqId: request.id, actor: request.actor, betId: created.id, kind: created.kind }, "bet_created");
  return reply.status(201).send({ success: true, bet: mapBet(created) });
});

app.get("/api/bets", { preHandler: [authGuard] }, async (request, reply) => {
  const parsed = listQuerySchema.safeParse(request.query ?? {});
  if (!parsed.success) return reply.status(400).send({ success: false, error: "Invalid query", details: parsed.error.flatten() });

  const query = parsed.data;
  const where: Prisma.BetWhereInput = { deletedAt: null };

  if (query.status) where.status = query.status;
  if (query.search) where.teams = { contains: query.search };
  if (query.from || query.to) {
    where.matchTime = {};
    if (query.from) where.matchTime.gte = new Date(query.from);
    if (query.to) where.matchTime.lte = new Date(query.to);
  }

  const sortMap: Record<string, "matchTime" | "createdAt" | "stake" | "odds"> = {
    match_time: "matchTime",
    created_at: "createdAt",
    stake: "stake",
    odds: "odds",
  };

  const [rows, total] = await Promise.all([
    prisma.bet.findMany({
      where,
      skip: query.offset,
      take: query.limit,
      orderBy: { [sortMap[query.sort]]: query.order },
      include: { legs: true },
    }),
    prisma.bet.count({ where }),
  ]);

  const withFreshStatus = [];
  for (const row of rows) {
    withFreshStatus.push(await refreshAutoStatus(row));
  }

  return {
    success: true,
    bets: withFreshStatus.map(mapBet),
    total,
    page: Math.floor(query.offset / query.limit) + 1,
    pages: Math.max(1, Math.ceil(total / query.limit)),
  };
});

app.get("/api/bets/:id", { preHandler: [authGuard] }, async (request: any, reply) => {
  const bet = await prisma.bet.findFirst({
    where: { id: request.params.id, deletedAt: null },
    include: { legs: true },
  });
  if (!bet) return reply.status(404).send({ success: false, error: "Bet not found" });
  const refreshed = await refreshAutoStatus(bet);
  return { success: true, bet: mapBet(refreshed) };
});

app.patch("/api/bets/:id", { preHandler: [authGuard] }, async (request: any, reply) => {
  const parsed = patchBetSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ success: false, error: "Invalid update payload", details: parsed.error.flatten() });
  }

  const existing = await prisma.bet.findFirst({ where: { id: request.params.id, deletedAt: null } });
  if (!existing) return reply.status(404).send({ success: false, error: "Bet not found" });

  const updates = parsed.data;
  const data: Prisma.BetUpdateInput = {};
  if (updates.kind !== undefined) data.kind = updates.kind;
  if (updates.teams !== undefined) data.teams = updates.teams;
  if (updates.bet_type !== undefined) data.betType = updates.bet_type;
  if (updates.odds !== undefined) data.odds = updates.odds;
  if (updates.stake !== undefined) data.stake = updates.stake;
  if (updates.currency !== undefined) data.currency = updates.currency;
  if (updates.match_time !== undefined) data.matchTime = new Date(updates.match_time);
  if (updates.status !== undefined) data.status = updates.status;
  if (Object.prototype.hasOwnProperty.call(updates, "result")) data.result = updates.result;
  if (Object.prototype.hasOwnProperty.call(updates, "actual_return")) data.actualReturn = updates.actual_return;
  if (Object.prototype.hasOwnProperty.call(updates, "notes")) data.notes = updates.notes;

  const updated = await prisma.bet.update({ where: { id: existing.id }, data, include: { legs: true } });

  await prisma.auditLog.create({
    data: { betId: existing.id, action: "updated", changedBy: request.actor, changes: JSON.stringify(updates) },
  });

  request.log.info({ reqId: request.id, actor: request.actor, betId: existing.id, changedFields: Object.keys(updates) }, "bet_updated");

  return { success: true, bet: mapBet(updated), changes: updates };
});

app.delete("/api/bets/:id", { preHandler: [authGuard] }, async (request: any, reply) => {
  const existing = await prisma.bet.findFirst({ where: { id: request.params.id, deletedAt: null } });
  if (!existing) return reply.status(404).send({ success: false, error: "Bet not found" });

  await prisma.bet.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
  await prisma.auditLog.create({
    data: { betId: existing.id, action: "deleted", changedBy: request.actor, changes: JSON.stringify({ deleted: true }) },
  });
  request.log.info({ reqId: request.id, actor: request.actor, betId: existing.id }, "bet_deleted");

  return { success: true, message: "Bet deleted successfully" };
});

app.post("/api/settlement/run", { preHandler: [authGuard] }, async (request: any) => {
  const summary = await runSettlementCycle({
    prisma,
    provider: settlementProvider,
    logger: app.log,
    actor: request.actor,
  });
  app.log.info({ reqId: request.id, actor: request.actor, summary }, "settlement_cycle_manual");
  return { success: true, summary };
});

const start = async () => {
  await prisma.user.upsert({ where: { username: "user1" }, update: {}, create: { username: "user1" } });
  await prisma.user.upsert({ where: { username: "user2" }, update: {}, create: { username: "user2" } });

  app.log.info({ envPath, hasPasswordHash: Boolean(env.PASSWORD_HASH), settlementProvider: settlementProvider.name }, "auth_config_loaded");

  if (env.SETTLEMENT_POLL_MINUTES > 0 && settlementProvider.name !== "none") {
    const intervalMs = env.SETTLEMENT_POLL_MINUTES * 60 * 1000;
    settlementInterval = setInterval(() => {
      void runSettlementCycle({ prisma, provider: settlementProvider, logger: app.log }).then((summary) => {
        app.log.info({ summary }, "settlement_cycle_auto");
      }).catch((error) => {
        app.log.error({ err: error }, "settlement_cycle_error");
      });
    }, intervalMs);
    app.log.info({ intervalMinutes: env.SETTLEMENT_POLL_MINUTES, provider: settlementProvider.name }, "settlement_scheduler_started");
  }

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
};

const shutdown = async () => {
  if (settlementInterval) {
    clearInterval(settlementInterval);
    settlementInterval = null;
  }
  await app.close();
  await prisma.$disconnect();
};

process.on("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});

start().catch(async (error) => {
  app.log.error(error);
  await shutdown();
  process.exit(1);
});
