import { describe, expect, it } from "vitest";
import { autoStatus } from "./domain.js";

describe("autoStatus", () => {
  it("returns upcoming for future match", () => {
    const inTwoHours = new Date(Date.now() + 2 * 60 * 60 * 1000);
    expect(autoStatus(inTwoHours)).toBe("upcoming");
  });

  it("returns live during first 3 hours after start", () => {
    const startedOneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    expect(autoStatus(startedOneHourAgo)).toBe("live");
  });

  it("returns finished after live window", () => {
    const startedFiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
    expect(autoStatus(startedFiveHoursAgo)).toBe("finished");
  });

  it("keeps settled as settled", () => {
    const startedFiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
    expect(autoStatus(startedFiveHoursAgo, "settled")).toBe("settled");
  });
});