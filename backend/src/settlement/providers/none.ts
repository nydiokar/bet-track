import { SettlementProvider } from "../types.js";

export const noneProvider: SettlementProvider = {
  name: "none",
  async getFixtureByEventId() {
    return null;
  },
};