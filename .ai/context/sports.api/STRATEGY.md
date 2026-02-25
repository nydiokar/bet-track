# Sports API Integration Strategy

**Last Updated:** 2026-02-25  **Status:** Implemented, pending live test

---

## The Problem

Bets are created by passing a betting slip image to Claude (LLM vision), which extracts team names, odds, stake, match time etc. The slip does not contain a sports data API fixture ID — it just has human-readable team names. Auto-settlement requires a `providerEventId` (API Football's numeric fixture ID) on each `BetLeg`, so the fixture resolver's job is to bridge the gap: match team names + date → fixture ID.

---

## Constraints

### API Football Free Plan
- **10 RPM** (requests per minute)
- **100 calls/day per endpoint** — `/fixtures` counts as one
- Hard budget. Everything is designed around it.

### `/fixtures` endpoint capabilities
- `GET /fixtures?id=12345` — single fixture
- `GET /fixtures?ids=1-2-3-...-20` — batch up to 20 in one call
- `GET /fixtures?date=YYYY-MM-DD` — all fixtures on a given day
- No team name search — must go via date or ID

---

## Budget Math

| Job | Frequency | Calls/day |
|-----|-----------|-----------|
| Resolver (date lookup) | Every 60 min | ~1–5/day (one per unique date in DB) |
| Settlement polling | Every 40 min | ~36/day (one per 20-event batch) |
| **Total** | | **~40 calls/day** — well within 100 |

---

## Two-Job Design

### Job 1: Fixture Resolver (`resolver.ts`)

**Purpose:** Populate `BetLeg.providerEventId` for legs that don't have one.

**Flow:**
1. Query DB — `BetLeg` where `providerEventId IS NULL AND settlement = "pending"`
2. Group legs by calendar date (UTC) of `eventTime`
3. One `GET /fixtures?date=YYYY-MM-DD` per unique date → covers all events that day
4. Fuzzy-match each leg's `teams` string against fixture home/away names
5. On match → write `providerEventId` + `provider` to the leg; no match → skip, retry next run

**Fuzzy matching:** normalise both sides (lowercase, strip FC/CF/SC/AC/United/City/Town, collapse whitespace), bidirectional substring match on home + away.

**Runs:** Once at server startup, then every `FIXTURE_RESOLVE_MINUTES`. Manual: `POST /api/settlement/resolve`.

---

### Job 2: Settlement Poller (`runner.ts`)

**Purpose:** Settle pending legs once their fixture is finished.

**Flow:**
1. Query DB — `BetLeg` where `settlement = "pending"` AND `providerEventId IS NOT NULL` AND `eventTime <= now - MATCH_WINDOW` AND parent bet not deleted
2. Group by `providerEventId`, batch into groups of 20
3. `GET /fixtures?ids=id1-id2-...` per batch — 6500ms delay between batches (≤9 RPM)
4. For each finished fixture → run `settleLeg()` rules, write outcome + scores
5. Roll up parlay at bet level once all legs resolved

**Runs:** Every `SETTLEMENT_POLL_MINUTES`. Manual: `POST /api/settlement/run`.

---

## Key Decisions

| Decision | Why |
|----------|-----|
| Resolve IDs as a separate async job | Decoupled from bet creation — no latency impact, retryable |
| Date-based lookup for resolution | One call covers all legs on the same day regardless of count |
| Batch `ids=` for settlement | 20x fewer calls vs per-event; 36 cycles/day handles 720 distinct events |
| `eventTime` filter in settlement | Skip fixtures that haven't started — no wasted calls |
| `setInterval`, no queue lib | 2-user personal tracker; no durability needed |
| Fuzzy match (not exact) | Team name formatting varies; bidirectional substring is robust enough |

---

## Open Questions

- **Persistently unmatched legs** — if a leg never matches (obscure league, name too different), it stays `providerEventId = null` forever. No flag currently. May need manual override or `resolver_failed` marker.
- **Live scores** — poller already receives `status: "live"` + current scores on every batch call. Not surfaced in UI yet. Zero extra API cost to show them.
- **Other sports** — `SettlementProvider` interface is pluggable; API Football is football only. Other sports need a different provider.

---

## Files

| File | Change |
|------|--------|
| `backend/src/settlement/resolver.ts` | **New** — fixture ID resolution job |
| `backend/src/settlement/runner.ts` | `eventTime` filter, batch `getFixturesByIds`, RPM delay |
| `backend/src/settlement/providers/apiFootball.ts` | Added `getFixturesByIds()` + `getFixturesByDate()`, shared `fetchFixtures()` helper |
| `backend/src/settlement/types.ts` | Extended `SettlementProvider` with 2 new methods |
| `backend/src/settlement/providers/none.ts` | No-op implementations of new methods |
| `backend/src/lib/env.ts` | Added `SETTLEMENT_MATCH_WINDOW_MINUTES`, `FIXTURE_RESOLVE_MINUTES` |
| `backend/src/server.ts` | Resolver job wired, `POST /api/settlement/resolve` added |
| `backend/.env.example` | 2 new vars added |

---

## Config (Free Plan)

```env
SETTLEMENT_PROVIDER=api_football
API_FOOTBALL_KEY=your_key
SETTLEMENT_POLL_MINUTES=40
SETTLEMENT_MATCH_WINDOW_MINUTES=90
FIXTURE_RESOLVE_MINUTES=60
```
