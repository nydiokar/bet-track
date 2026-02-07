export type ProviderFixture = {
  providerEventId: string;
  status: "scheduled" | "live" | "finished";
  homeTeam: string;
  awayTeam: string;
  scoreHome: number | null;
  scoreAway: number | null;
  startedAt: Date | null;
  finishedAt: Date | null;
};

export type SettlementProvider = {
  name: string;
  getFixtureByEventId(eventId: string): Promise<ProviderFixture | null>;
};