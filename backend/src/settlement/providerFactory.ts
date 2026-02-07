import { env } from "../lib/env.js";
import { SettlementProvider } from "./types.js";
import { noneProvider } from "./providers/none.js";
import { createApiFootballProvider } from "./providers/apiFootball.js";

export const createSettlementProvider = (): SettlementProvider => {
  if (env.SETTLEMENT_PROVIDER === "api_football") {
    return createApiFootballProvider({
      apiKey: env.API_FOOTBALL_KEY!,
      baseUrl: env.API_FOOTBALL_BASE_URL,
    });
  }
  return noneProvider;
};