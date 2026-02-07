import { SettlementProvider } from "../types.js";

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

export const createApiFootballProvider = (opts: {
  apiKey: string;
  baseUrl: string;
}): SettlementProvider => ({
  name: "api_football",
  async getFixtureByEventId(eventId: string) {
    const url = new URL("/fixtures", opts.baseUrl);
    url.searchParams.set("id", eventId);

    const response = await fetch(url, {
      headers: {
        "x-apisports-key": opts.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`api_football_error_${response.status}`);
    }

    const payload = (await response.json()) as ApiFootballResponse;
    const fixture = payload.response?.[0];
    if (!fixture?.fixture?.id) {
      return null;
    }

    const status = statusFromShort(fixture.fixture.status?.short);
    const startedAt = fixture.fixture.date ? new Date(fixture.fixture.date) : null;

    return {
      providerEventId: String(fixture.fixture.id),
      status,
      homeTeam: fixture.teams?.home?.name ?? "",
      awayTeam: fixture.teams?.away?.name ?? "",
      scoreHome: fixture.goals?.home ?? null,
      scoreAway: fixture.goals?.away ?? null,
      startedAt,
      finishedAt: status === "finished" ? new Date() : null,
    };
  },
});