import { FastifyBaseLogger } from "fastify";
import { PrismaClient } from "@prisma/client";
import { SettlementProvider } from "./types.js";
import { settleLeg } from "./rules.js";

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
}) => {
  const { prisma, provider, logger } = opts;
  const actor = opts.actor ?? "system:settlement";

  const legs = await prisma.betLeg.findMany({
    where: {
      settlement: "pending",
      providerEventId: { not: null },
      bet: {
        deletedAt: null,
      },
    },
    include: { bet: true },
    orderBy: { eventTime: "asc" },
    take: 300,
  });

  const byEvent = new Map<string, typeof legs>();
  for (const leg of legs) {
    const key = `${leg.provider || provider.name}:${leg.providerEventId}`;
    const arr = byEvent.get(key) ?? [];
    arr.push(leg);
    byEvent.set(key, arr);
  }

  let updatedLegs = 0;
  let settledBets = 0;
  let reviewBets = 0;

  for (const [, eventLegs] of byEvent) {
    const providerEventId = eventLegs[0].providerEventId;
    if (!providerEventId) continue;

    let fixture;
    try {
      fixture = await provider.getFixtureByEventId(providerEventId);
    } catch (error) {
      logger.warn({ provider: provider.name, providerEventId, err: error }, "settlement_provider_error");
      continue;
    }

    if (!fixture || fixture.status !== "finished") {
      continue;
    }

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

  const candidateBets = await prisma.bet.findMany({
    where: {
      deletedAt: null,
      status: { not: "settled" },
      legs: { some: {} },
    },
    include: {
      legs: true,
    },
  });

  for (const bet of candidateBets) {
    const rollup = calculateParlayResult(
      bet.legs.map((leg) => ({ settlement: leg.settlement, odds: leg.odds })),
      bet.stake
    );

    if (!rollup.done) continue;

    const status = "settled";
    await prisma.bet.update({
      where: { id: bet.id },
      data: {
        status,
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
  };
};