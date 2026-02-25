/**
 * Extraction fixture tests
 *
 * HOW TO ADD A FIXTURE:
 *   1. Create a folder under test/fixtures/<name>/
 *   2. Drop your screenshot in as image.jpg (or .png / .webp)
 *   3. Create expected.json with the fields you want to verify
 *      (only the fields you include are checked — omit anything you don't care about)
 *
 * EXAMPLE expected.json:
 *   {
 *     "kind": "single",
 *     "teams": "Partizan Belgrade vs Panathinaikos",
 *     "odds": 2.9,
 *     "stake": 200,
 *     "currency": "EUR"
 *   }
 *
 * RUN:
 *   pnpm test                          (skips if ANTHROPIC_API_KEY not set)
 *   ANTHROPIC_API_KEY=sk-... pnpm test (hits real API)
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { describe, it, expect } from "vitest";
import { extractBetFromImage } from "./extraction.js";

const FIXTURES_DIR = join(import.meta.dirname, "../../test/fixtures");
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY);

if (!existsSync(FIXTURES_DIR)) {
  describe("extraction fixtures", () => {
    it("no fixtures directory yet — create test/fixtures/<name>/{image.jpg,expected.json}", () => {
      expect(true).toBe(true);
    });
  });
} else {
  const fixtures = readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  describe.skipIf(!hasApiKey)("extraction fixtures (requires ANTHROPIC_API_KEY)", () => {
    if (fixtures.length === 0) {
      it("no fixtures yet", () => expect(true).toBe(true));
      return;
    }

    for (const name of fixtures) {
      it(name, async () => {
        const dir = join(FIXTURES_DIR, name);

        const imageFile = readdirSync(dir).find((f) => IMAGE_EXTS.has(extname(f).toLowerCase()));
        const expectedFile = join(dir, "expected.json");

        if (!imageFile) throw new Error(`${name}: no image file found`);
        if (!existsSync(expectedFile)) throw new Error(`${name}: missing expected.json`);

        const ext = extname(imageFile).toLowerCase();
        const data = readFileSync(join(dir, imageFile));
        const expected: Record<string, unknown> = JSON.parse(readFileSync(expectedFile, "utf8"));

        const { bet } = await extractBetFromImage(MIME[ext], data);

        const mismatches: string[] = [];
        for (const [key, expectedVal] of Object.entries(expected)) {
          const actual = (bet as Record<string, unknown>)[key];
          if (!roughlyEqual(actual, expectedVal)) {
            mismatches.push(`  ${key}: expected ${JSON.stringify(expectedVal)}, got ${JSON.stringify(actual)}`);
          }
        }

        if (mismatches.length > 0) {
          throw new Error(`Extraction mismatches for "${name}":\n${mismatches.join("\n")}`);
        }
      }, 30_000);
    }
  });
}

/** Numeric tolerance ±5%, string case-insensitive, everything else strict. */
function roughlyEqual(actual: unknown, expected: unknown): boolean {
  if (typeof expected === "number" && typeof actual === "number") {
    return Math.abs(actual - expected) <= 0.05 * Math.abs(expected) + 0.01;
  }
  if (typeof expected === "string" && typeof actual === "string") {
    return actual.toLowerCase() === expected.toLowerCase();
  }
  return JSON.stringify(actual) === JSON.stringify(expected);
}
