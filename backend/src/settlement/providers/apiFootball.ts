import { ProviderFixture, SettlementProvider } from "../types.js";

type ApiFootballResponse = {
  response?: Array<{
    fixture?: {
      id?: number;
      date?: string;
      status?: { short?: string };
      timestamp?: number;
    };
    teams?: {
      home?: { name?: string };
      away?: { name?: string };
    };
    goals?: {
      home?: number | null;
      away?: number | null;
    };
  }>;
};

const statusFromShort = (short?: string): "scheduled" | "live" | "finished" => {
  const code = (short ?? "").toUpperCase();
  if (["FT", "AET", "PEN", "CANC", "ABD", "AWD", "WO"].includes(code)) return "finished";
  if (["1H", "2H", "HT", "ET", "BT", "P", "LIVE"].includes(code)) return "live";
  return "scheduled";
};

const mapFixture = (item: NonNullable<ApiFootballResponse["response"]>[number]): ProviderFixture | null => {
  if (!item.fixture?.id) return null;
  const status = statusFromShort(item.fixture.status?.short);
  return {
    providerEventId: String(item.fixture.id),
    status,
    homeTeam: item.teams?.home?.name ?? "",
    awayTeam: item.teams?.away?.name ?? "",
    scoreHome: item.goals?.home ?? null,
    scoreAway: item.goals?.away ?? null,
    startedAt: item.fixture.date ? new Date(item.fixture.date) : null,
    finishedAt: status === "finished" ? new Date() : null,
  };
};

export const createApiFootballProvider = (opts: {
  apiKey: string;
  baseUrl: string;
}): SettlementProvider => {
  const headers = { "x-apisports-key": opts.apiKey };

  const fetchFixtures = async (params: Record<string, string>): Promise<ProviderFixture[]> => {
    const url = new URL("/fixtures", opts.baseUrl);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`api_football_error_${response.status}`);

    const payload = (await response.json()) as ApiFootballResponse;
    return (payload.response ?? []).map(mapFixture).filter((f): f is ProviderFixture => f !== null);
  };

  return {
    name: "api_football",

    async getFixtureByEventId(eventId: string) {
      const fixtures = await fetchFixtures({ id: eventId });
      return fixtures[0] ?? null;
    },

    async getFixturesByIds(eventIds: string[]) {
      if (eventIds.length === 0) return [];
      // API Football accepts up to 20 ids joined by hyphens
      return fetchFixtures({ ids: eventIds.join("-") });
    },

    async getFixturesByDate(date: string) {
      // date format: YYYY-MM-DD
      return fetchFixtures({ date });
    },
  };
};
