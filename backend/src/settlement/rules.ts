import { BetLeg } from "@prisma/client";
import { ProviderFixture } from "./types.js";

export type LegOutcome = "pending" | "won" | "lost" | "push" | "void" | "needs_review";

const compareTeams = (a: string, b: string) =>
  a.trim().toLowerCase().replace(/\s+/g, " ") === b.trim().toLowerCase().replace(/\s+/g, " ");

export const settleLeg = (leg: BetLeg, fixture: ProviderFixture): LegOutcome => {
  if (fixture.status !== "finished") return "pending";

  const home = fixture.scoreHome;
  const away = fixture.scoreAway;
  if (home == null || away == null) return "needs_review";

  const market = leg.marketType.toLowerCase();
  const pick = leg.selection.toLowerCase();

  if (market === "1x2" || market === "match_winner") {
    if (pick === "draw") return home === away ? "won" : "lost";
    if (pick === "home") return home > away ? "won" : "lost";
    if (pick === "away") return away > home ? "won" : "lost";
    if (compareTeams(pick, fixture.homeTeam)) return home > away ? "won" : "lost";
    if (compareTeams(pick, fixture.awayTeam)) return away > home ? "won" : "lost";
    return "needs_review";
  }

  if (market === "over_under") {
    if (leg.line == null) return "needs_review";
    const total = home + away;
    if (pick === "over") return total > leg.line ? "won" : "lost";
    if (pick === "under") return total < leg.line ? "won" : "lost";
    return "needs_review";
  }

  if (market === "btts") {
    const bothScored = home > 0 && away > 0;
    if (pick === "yes") return bothScored ? "won" : "lost";
    if (pick === "no") return bothScored ? "lost" : "won";
    return "needs_review";
  }

  return "needs_review";
};