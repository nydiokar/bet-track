import { FastifyBaseLogger } from "fastify";
import { PrismaClient } from "@prisma/client";
import { SettlementProvider } from "./types.js";
import { settleLeg } from "./rules.js";

const BATCH_SIZE = 20; // API Football ids= param supports up to 20
const BATCH_DELAY_MS = 6500; // ~9 batches/min safely under 10 RPM

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const calculateParlayResult = (legs: { settlement: string; odds: number }[], stake: number) => {
  if (legs.some((l) => l.settlement === "pending")) {
    return { done: false as const };
  }

  if (legs.some((l) => l.settlement === "needs_review")) {
    return { done: true as const, result: "void", actualReturn: stake, settlementState: "needs_review" };
  }

  if (legs.some((l) => l.settlement === "lost")) {
    return { done: true as const, result: "lost", actualReturn: 0, settlementState: "settled" };
  }

  const wonOddsProduct = legs
    .filter((l) => l.settlement === "won")
    .reduce((acc, leg) => acc * leg.odds, 1);

  const hasWonLeg = legs.some((l) => l.settlement === "won");
  if (!hasWonLeg) {
    return { done: true as const, result: "push", actualReturn: stake, settlementState: "settled" };
  }

  return {
    done: true as const,
    result: "won",
    actualReturn: Number((stake * wonOddsProduct).toFixed(2)),
    settlementState: "settled",
  };
};

export const runSettlementCycle = async (opts: {
  prisma: PrismaClient;
  provider: SettlementProvider;
  logger: FastifyBaseLogger;
  actor?: string;
  /** Only poll legs whose eventTime is at least this many minutes in the past (default 90) */
  matchWindowMinutes?: number;
}) => {
  const { prisma, provider, logger } = opts;
  const actor = opts.actor ?? "system:settlement";
  const matchWindowMinutes = opts.matchWindowMinutes ?? 90;

  // Only fetch legs where:
  // - settlement is still pending
  // - providerEventId is known (resolver handles the rest)
  // - eventTime is at least matchWindowMinutes ago (game should be finished)
  // - parent bet is not deleted
  const cutoff = new Date(Date.now() - matchWindowMinutes * 60 * 1000);

  const legs = await prisma.betLeg.findMany({
    where: {
      settlement: "pending",
      providerEventId: { not: null },
      eventTime: { lte: cutoff },
      bet: { deletedAt: null },
    },
    include: { bet: true },
    orderBy: { eventTime: "asc" },
    take: 300,
  });

  // Group legs by unique providerEventId — one API call per distinct event
  const byEvent = new Map<string, typeof legs>();
  for (const leg of legs) {
    const key = `${leg.provider ?? provider.name}:${leg.providerEventId}`;
    const arr = byEvent.get(key) ?? [];
    arr.push(leg);
    byEvent.set(key, arr);
  }

  const eventIds = [...byEvent.keys()].map((k) => k.split(":")[1]);

  let updatedLegs = 0;
  let settledBets = 0;
  let reviewBets = 0;
  let apiCalls = 0;

  // Process in batches of BATCH_SIZE, with a small delay between batches
  for (let i = 0; i < eventIds.length; i += BATCH_SIZE) {
    const batch = eventIds.slice(i, i + BATCH_SIZE);

    if (i > 0) await sleep(BATCH_DELAY_MS);

    let fixtures;
    try {
      fixtures = await provider.getFixturesByIds(batch);
      apiCalls += 1;
    } catch (err) {
      logger.warn({ provider: provider.name, batch, err }, "settlement_provider_batch_error");
      continue;
    }

    const fixtureMap = new Map(fixtures.map((f) => [f.providerEventId, f]));

    for (const eventId of batch) {
      const fixture = fixtureMap.get(eventId);
      if (!fixture || fixture.status !== "finished") continue;

      // Find all legs for this event across any provider key
      const eventLegs = [...byEvent.values()].find(
        (arr) => arr[0]?.providerEventId === eventId
      );
      if (!eventLegs) continue;

      for (const leg of eventLegs) {
        const outcome = settleLeg(leg, fixture);
        if (outcome === "pending") continue;

        await prisma.betLeg.update({
          where: { id: leg.id },
          data: {
            settlement: outcome,
            scoreHome: fixture.scoreHome,
            scoreAway: fixture.scoreAway,
            checkedAt: new Date(),
            settledAt: outcome === "needs_review" ? null : new Date(),
          },
        });
        updatedLegs += 1;
      }
    }
  }

  // Roll up bet-level settlement once all legs are done
  const candidateBets = await prisma.bet.findMany({
    where: {
      deletedAt: null,
      status: { not: "settled" },
      legs: { some: {} },
    },
    include: { legs: true },
  });

  for (const bet of candidateBets) {
    const rollup = calculateParlayResult(
      bet.legs.map((leg) => ({ settlement: leg.settlement, odds: leg.odds })),
      bet.stake
    );

    if (!rollup.done) continue;

    await prisma.bet.update({
      where: { id: bet.id },
      data: {
        status: "settled",
        result: rollup.result,
        actualReturn: rollup.actualReturn,
        settledAt: new Date(),
        settlementState: rollup.settlementState,
      },
    });

    await prisma.auditLog.create({
      data: {
        betId: bet.id,
        action: "auto_settled",
        changedBy: actor,
        changes: JSON.stringify({
          result: rollup.result,
          actual_return: rollup.actualReturn,
          settlement_state: rollup.settlementState,
        }),
      },
    });

    if (rollup.settlementState === "needs_review") reviewBets += 1;
    settledBets += 1;
  }

  return {
    provider: provider.name,
    scannedLegs: legs.length,
    updatedLegs,
    settledBets,
    reviewBets,
    apiCalls,
  };
};
