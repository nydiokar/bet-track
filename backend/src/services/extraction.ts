import Anthropic from "@anthropic-ai/sdk";
import { env } from "../lib/env.js";
import { createBetSchema } from "../lib/schemas.js";

const prompt = `You are a betting slip data extractor.

Detect whether the ticket is a SINGLE or a PARLAY (combo/acca/multi).

Return only valid JSON.

For SINGLE:
{
  "kind": "single",
  "teams": "Team A vs Team B",
  "bet_type": "Draw",
  "odds": 3.5,
  "stake": 50,
  "currency": "EUR",
  "match_time": "2026-02-08T20:00:00Z",
  "confidence": "high"
}

For PARLAY:
{
  "kind": "parlay",
  "teams": "Parlay Ticket",
  "bet_type": "3-leg parlay",
  "odds": 6.2,
  "stake": 25,
  "currency": "EUR",
  "match_time": "2026-02-08T20:00:00Z",
  "confidence": "medium",
  "legs": [
    {
      "teams": "Arsenal vs Liverpool",
      "market_type": "1x2",
      "selection": "home",
      "line": null,
      "odds": 2.1,
      "event_time": "2026-02-08T18:00:00Z"
    },
    {
      "teams": "Inter vs Milan",
      "market_type": "over_under",
      "selection": "over",
      "line": 2.5,
      "odds": 1.8,
      "event_time": "2026-02-08T20:00:00Z"
    }
  ]
}

Rules:
- ALWAYS set kind to "single" or "parlay".
- For parlays, include all visible legs in "legs".
- market_type should be one of: "1x2", "over_under", "btts", "custom".
- selection examples: "home", "away", "draw", "over", "under", "yes", "no", or literal selection for custom.
- line is required for over_under when visible, else null.
- Use ISO timestamps with Z suffix.

If extraction fails, return:
{ "error": "reason", "confidence": "low" }`;

const client = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;
const supportedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const parseJson = (text: string): Record<string, unknown> => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object in AI response");
  return JSON.parse(text.slice(start, end + 1));
};

export const extractBetFromImage = async (mimeType: string, data: Buffer) => {
  if (!client) {
    const error = new Error("ANTHROPIC_API_KEY is not configured");
    (error as Error & { statusCode?: number }).statusCode = 503;
    throw error;
  }
  if (!supportedMimeTypes.has(mimeType)) {
    const error = new Error("Unsupported image format. Use JPEG, PNG, or WEBP.");
    (error as Error & { statusCode?: number }).statusCode = 400;
    throw error;
  }

  const response = await client.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType as "image/jpeg" | "image/png" | "image/webp",
              data: data.toString("base64"),
            },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  const text = response.content.find((p) => p.type === "text")?.text ?? "";
  const raw = parseJson(text);
  if (typeof raw.error === "string") throw new Error(raw.error);

  const bet = createBetSchema.parse(raw);
  return { bet, raw };
};
