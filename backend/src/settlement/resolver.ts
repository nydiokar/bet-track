import { FastifyBaseLogger } from "fastify";
import { PrismaClient } from "@prisma/client";
import { SettlementProvider, ProviderFixture } from "./types.js";

const normalise = (name: string): string =>
  name
    .toLowerCase()
    .replace(/\b(fc|cf|sc|ac|afc|bfc|1\.|united|city|town|club|de|van|the)\b/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const teamsMatch = (legTeams: string, fixture: ProviderFixture): boolean => {
  const parts = legTeams.split(/\s+(?:vs\.?|-)\s+/i);
  if (parts.length !== 2) return false;

  const [legHome, legAway] = parts.map(normalise);
  const fixHome = normalise(fixture.homeTeam);
  const fixAway = normalise(fixture.awayTeam);

  const forwardMatch =
    (fixHome.includes(legHome) || legHome.includes(fixHome)) &&
    (fixAway.includes(legAway) || legAway.includes(fixAway));

  const reverseMatch =
    (fixAway.includes(legHome) || legHome.includes(fixAway)) &&
    (fixHome.includes(legAway) || legAway.includes(fixHome));

  return forwardMatch || reverseMatch;
};

const toDateString = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * Returns fixtures for a given date, using the DB cache if available.
 * Cache is permanent — fixture lists for a day don't change meaningfully.
 */
const getFixturesForDate = async (opts: {
  prisma: PrismaClient;
  provider: SettlementProvider;
  logger: FastifyBaseLogger;
  date: string;
}): Promise<ProviderFixture[]> => {
  const { prisma, provider, logger, date } = opts;

  const cached = await prisma.fixtureCache.findUnique({
    where: { provider_date: { provider: provider.name, date } },
  });

  if (cached) {
    logger.debug({ provider: provider.name, date }, "resolver_cache_hit");
    return JSON.parse(cached.fixtures) as ProviderFixture[];
  }

  const fixtures = await provider.getFixturesByDate(date);

  await prisma.fixtureCache.create({
    data: {
      provider: provider.name,
      date,
      fixtures: JSON.stringify(fixtures),
    },
  });

  logger.info({ provider: provider.name, date, count: fixtures.length }, "resolver_cache_stored");
  return fixtures;
};

export const runFixtureResolver = async (opts: {
  prisma: PrismaClient;
  provider: SettlementProvider;
  logger: FastifyBaseLogger;
}): Promise<{ datesChecked: number; legsResolved: number; legsUnmatched: number }> => {
  const { prisma, provider, logger } = opts;

  const unresolvedLegs = await prisma.betLeg.findMany({
    where: {
      providerEventId: null,
      settlement: "pending",
      bet: { deletedAt: null },
    },
    select: {
      id: true,
      teams: true,
      eventTime: true,
      provider: true,
    },
  });

  if (unresolvedLegs.length === 0) {
    return { datesChecked: 0, legsResolved: 0, legsUnmatched: 0 };
  }

  const byDate = new Map<string, typeof unresolvedLegs>();
  for (const leg of unresolvedLegs) {
    const dateStr = toDateString(leg.eventTime);
    const arr = byDate.get(dateStr) ?? [];
    arr.push(leg);
    byDate.set(dateStr, arr);
  }

  let legsResolved = 0;
  let legsUnmatched = 0;

  for (const [dateStr, legs] of byDate) {
    let fixtures: ProviderFixture[];
    try {
      fixtures = await getFixturesForDate({ prisma, provider, logger, date: dateStr });
    } catch (err) {
      logger.warn({ provider: provider.name, date: dateStr, err }, "resolver_fetch_error");
      continue;
    }

    logger.debug(
      { date: dateStr, fixturesReturned: fixtures.length, legsToMatch: legs.length },
      "resolver_date_fetched"
    );

    for (const leg of legs) {
      const match = fixtures.find((f) => teamsMatch(leg.teams, f));

      if (!match) {
        logger.debug({ legId: leg.id, legTeams: leg.teams, date: dateStr }, "resolver_no_match");
        legsUnmatched += 1;
        continue;
      }

      await prisma.betLeg.update({
        where: { id: leg.id },
        data: {
          providerEventId: match.providerEventId,
          provider: leg.provider ?? provider.name,
        },
      });

      logger.info(
        { legId: leg.id, legTeams: leg.teams, providerEventId: match.providerEventId, date: dateStr },
        "resolver_matched"
      );
      legsResolved += 1;
    }
  }

  return { datesChecked: byDate.size, legsResolved, legsUnmatched };
};
