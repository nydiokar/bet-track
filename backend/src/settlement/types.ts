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
  /** Fetch a single fixture by its provider event ID */
  getFixtureByEventId(eventId: string): Promise<ProviderFixture | null>;
  /** Fetch up to 20 fixtures in one call using the ids= batch param */
  getFixturesByIds(eventIds: string[]): Promise<ProviderFixture[]>;
  /** Fetch all fixtures for a given calendar date (YYYY-MM-DD) */
  getFixturesByDate(date: string): Promise<ProviderFixture[]>;
};
