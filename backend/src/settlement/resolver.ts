import { FastifyBaseLogger } from "fastify";
import { PrismaClient } from "@prisma/client";
import { SettlementProvider, ProviderFixture } from "./types.js";

/**
 * Normalises a team name for fuzzy matching:
 * lowercase, remove common suffixes/prefixes, collapse whitespace.
 */
const normalise = (name: string): string =>
  name
    .toLowerCase()
    .replace(/\b(fc|cf|sc|ac|afc|bfc|1\.|united|city|town|club|de|van|the)\b/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Returns true if candidate fixture teams match both sides of a leg's teams string.
 * leg.teams is expected to be "Team A vs Team B" or "Team A - Team B".
 */
const teamsMatch = (legTeams: string, fixture: ProviderFixture): boolean => {
  const parts = legTeams.split(/\s+(?:vs\.?|-)\s+/i);
  if (parts.length !== 2) return false;

  const [legHome, legAway] = parts.map(normalise);
  const fixHome = normalise(fixture.homeTeam);
  const fixAway = normalise(fixture.awayTeam);

  // Both sides must match (either direction to handle some API inconsistencies)
  const forwardMatch =
    (fixHome.includes(legHome) || legHome.includes(fixHome)) &&
    (fixAway.includes(legAway) || legAway.includes(fixAway));

  const reverseMatch =
    (fixAway.includes(legHome) || legHome.includes(fixAway)) &&
    (fixHome.includes(legAway) || legAway.includes(fixHome));

  return forwardMatch || reverseMatch;
};

const toDateString = (d: Date): string => d.toISOString().slice(0, 10);

export const runFixtureResolver = async (opts: {
  prisma: PrismaClient;
  provider: SettlementProvider;
  logger: FastifyBaseLogger;
}): Promise<{ datesChecked: number; legsResolved: number; legsUnmatched: number }> => {
  const { prisma, provider, logger } = opts;

  // Find all legs that still need a providerEventId and haven't been settled yet
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

  // Group legs by calendar date (UTC) — one API call covers an entire day
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
      fixtures = await provider.getFixturesByDate(dateStr);
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
