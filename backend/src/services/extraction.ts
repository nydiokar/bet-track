import Anthropic from "@anthropic-ai/sdk";
import { env } from "../lib/env.js";
import { createBetSchema } from "../lib/schemas.js";
import { validateExtraction } from "./validation.js";

const prompt = `You are a professional betting slip data extractor specializing in European bookmakers (including Bulgarian apps: Palms Bet, Winbet, BetKing, etc.).

CRITICAL: Your job is to extract ALL data from the betting slip image with high precision. The user will save this to a database.

---

## STEP 1: IDENTIFY BET TYPE

Look for indicators:
- SINGLE: One event, one selection, one final odds value
- PARLAY (combo/accumulator/multi): Multiple legs combined into one bet, with individual odds per leg AND a combined total odds

Bulgarian indicators:
- "Множествен" or "Акумулатор" = PARLAY
- Single event visible = SINGLE

---

## STEP 2: EXTRACT STAKE & CURRENCY

KEY DISTINCTIONS:
- "Залог" (Bulgarian) / "Stake" / "Wager" = Amount betted (THIS IS WHAT WE SAVE)
- "Печалба" (Bulgarian) / "Winnings" / "Potential Return" = What you could win (NOT the stake!)
- "Общ Коефициент" (Bulgarian) / "Total Odds" / "Combined Odds" = Multiply all leg odds (parlay only)
- Currency: Look for €, £, BGN, USD, etc.

---

## STEP 3: EXTRACT DATES & TIMES

- Format as ISO 8601 with Z suffix: "2026-02-05T21:30:00Z"
- If only date given (e.g., "05/02"), use match kickoff time if visible, else assume 20:00
- If only time given (e.g., "21:30"), combine with date from slip header

---

## STEP 4: BULGARIAN MARKET TRANSLATIONS

Map these to market_type and selection:

**1X2 (Most common in images)**
- "Победител (вкл. продължение)" = 1x2 (includes extra time)
- "Победител (без продължение)" = 1x2 (no extra time)
- "Равенство" / "Draw" in selection = selection: "draw"
- "Гост" / "Away" = selection: "away"
- "Домакин" / "Home" = selection: "home"

**OVER/UNDER**
- "Над/Под" = over_under market
- Selection: "over" or "under" followed by line (e.g., "over 2.5")

**BOTH TEAMS TO SCORE (BTTS)**
- "И двата отбора да вкарат" = btts
- Selection: "yes" or "no"

**OTHER**
- Anything not above = "custom" market type

---

## STEP 5: EXTRACT CORRECTLY

### FOR SINGLE BETS:
\`\`\`json
{
  "kind": "single",
  "teams": "Partizan Belgrade vs Panathinaikos",
  "bet_type": "Draw (1x2)",
  "odds": 2.90,
  "stake": 200.00,
  "currency": "EUR",
  "match_time": "2026-02-05T21:30:00Z",
  "provider": "Palms Bet",
  "confidence": "high"
}
\`\`\`

### FOR PARLAYS:
\`\`\`json
{
  "kind": "parlay",
  "teams": "3-leg Parlay",
  "bet_type": "3-selection accumulator",
  "odds": 13.77,
  "stake": 200.00,
  "currency": "EUR",
  "match_time": "2026-02-05T21:30:00Z",
  "provider": "Palms Bet",
  "confidence": "high",
  "legs": [
    {
      "teams": "Partizan Belgrade vs Panathinaikos",
      "market_type": "1x2",
      "selection": "draw",
      "line": null,
      "odds": 2.90,
      "event_time": "2026-02-05T21:30:00Z"
    },
    {
      "teams": "Holcim Kil vs Stuttgart",
      "market_type": "1x2",
      "selection": "over",
      "line": null,
      "odds": 4.75,
      "event_time": "2026-02-04T21:45:00Z"
    },
    {
      "teams": "Team C vs Team D",
      "market_type": "over_under",
      "selection": "over",
      "line": 2.5,
      "odds": 1.62,
      "event_time": "2026-02-06T19:00:00Z"
    }
  ]
}
\`\`\`

---

## IMPORTANT RULES

1. **kind**: Always "single" or "parlay" (never null)
2. **odds**: For SINGLE = final odds. For PARLAY = "Общ Коефициент" (total combined odds)
3. **legs**: For PARLAY = ALL visible legs with individual odds per leg
4. **stake**: The amount actually wagered (Залог), NOT winnings
5. **confidence**:
   - "high" = Clear, unambiguous text; all data visible
   - "medium" = Some fields inferred; minor ambiguity
   - "low" = Multiple missing fields or unclear data
6. **provider**: Extract if visible (e.g., "Palms Bet", "Winbet", "BetKing")
7. **match_time**: Use earliest event time for single/parlay header

---

## EDGE CASES

**Parlay with "Множествен" section + multiple match blocks:**
- Extract each match as a leg
- Each leg gets its own odds, teams, time
- Final combined odds = "Общ Коефициент" or multiply individual odds

**Missing fields:**
- If bet_time missing: use 20:00 UTC as default
- If provider missing: set to null
- If odds unclear: set confidence to "medium" or "low"

**Cyrillic/Non-English Text:**
- Translate team names directly (don't transliterate unless unclear)
- Translate market names using mappings above
- Keep original spelling for proper nouns (team names)

---

## RESPONSE FORMAT

Return ONLY valid JSON. No markdown, no explanation.

If extraction succeeds: return the bet object (single or parlay)
If extraction fails: return \`{ "error": "specific reason", "confidence": "low" }\`

Do NOT include extraneous fields.`;

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

  // Run automatic validation to detect quality issues
  const validation = validateExtraction(raw);

  const bet = createBetSchema.parse(raw);
  return {
    bet,
    raw,
    validation, // Include validation results in response
  };
};
