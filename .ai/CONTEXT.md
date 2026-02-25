# Bet Tracker — Context

**Last updated:** 2026-02-25  **Status:** Sports API integration implemented — fixture resolver + smart settlement polling complete, ready to wire up with real API key

---

## Active Work

| Status | Task | Notes |
|:------:|:-----|:------|
| ⏳ | **Test with live API_FOOTBALL_KEY** | Enable in `.env`, verify resolver matches team names, verify settlement batch calls work |
| ⏳ | **Live score / in-progress state UI** | Provider already returns `status: "live"` + scores on each poll — decision: surface in frontend or not |

---

## Current Focus

### Sports API Auto-Settlement — ready to test (Feb 25)

Two-job system built around API Football free plan constraints (100 calls/day, 10 RPM):

- **Fixture resolver** (`resolver.ts`) — resolves `providerEventId` for legs that don't have one. Fetches all fixtures for a given date in one call, fuzzy-matches team names. Runs at startup + on interval (`FIXTURE_RESOLVE_MINUTES`). Manual trigger: `POST /api/settlement/resolve`.
- **Settlement poller** (`runner.ts`) — only polls legs with known `providerEventId` AND `eventTime <= now - MATCH_WINDOW`. Batches up to 20 IDs per call (`?ids=id1-id2-...`). Manual trigger: `POST /api/settlement/run`.

Recommended `.env` for free plan:
```
SETTLEMENT_PROVIDER=api_football
SETTLEMENT_POLL_MINUTES=40
SETTLEMENT_MATCH_WINDOW_MINUTES=90
FIXTURE_RESOLVE_MINUTES=60
```

---

## Recently Completed

- ✅ **Core bet tracker MVP** — Fastify backend, React frontend, Prisma/SQLite, JWT auth, Claude OCR slip upload, parlay support, manual settlement override, audit log
- ✅ **Sports API settlement foundation** — `apiFootball.ts` provider, `runner.ts` settlement cycle, `providerFactory.ts`, `noneProvider` stub, `SETTLEMENT_PROVIDER`/`SETTLEMENT_POLL_MINUTES` env vars
- ✅ **Fixture resolver + smart polling** (Feb 25) — Full strategy implemented. See `.ai/context/sports.api/STRATEGY.md` and Recent Activity below.

---

## Recent Activity

### February 25, 2026

| ID | T | Title | Scope | Components |
|:--:|:-:|:------|:-----:|:-----------|
| 25.1 | ✨ | Sports API: fixture resolver — resolves providerEventId via date-based batch lookup + fuzzy team name match | M | `backend/src/settlement/resolver.ts` (new) |
| 25.2 | ✨ | Sports API: smart settlement polling — eventTime filter, batch ids=, RPM delay | M | `runner.ts`, `apiFootball.ts`, `types.ts` |
| 25.3 | 🔧 | Add SETTLEMENT_MATCH_WINDOW_MINUTES + FIXTURE_RESOLVE_MINUTES env vars | S | `env.ts`, `.env.example` |
| 25.4 | 🔧 | Wire resolver + settlement jobs in server startup, add manual /api/settlement/resolve endpoint | S | `server.ts` |

**25.1:** `resolver.ts` queries `BetLeg` rows where `providerEventId IS NULL AND settlement = "pending"`. Groups by calendar date (UTC). One `GET /fixtures?date=YYYY-MM-DD` call per unique date covers all events that day. Fuzzy-matches fixture home/away names against leg's `teams` string (`"Team A vs Team B"`) using `normalise()` (lowercase, strip FC/CF/SC/AC/United/City, collapse whitespace) + bidirectional substring match. On match writes `providerEventId` + `provider`. Unmatched legs log at debug and retry next run. Returns `{ datesChecked, legsResolved, legsUnmatched }`.

**25.2:** `runner.ts` — added `eventTime: { lte: cutoff }` filter; replaced per-event loop with batched `getFixturesByIds` (up to 20 IDs, `BATCH_DELAY_MS=6500ms` between batches). `apiFootball.ts` — shared `fetchFixtures(params)` helper; added `getFixturesByIds(ids[])` and `getFixturesByDate(date)`. `types.ts` — extended `SettlementProvider` with both new methods. `none.ts` — no-op stubs added.

**25.3:** `SETTLEMENT_MATCH_WINDOW_MINUTES` (default 90) and `FIXTURE_RESOLVE_MINUTES` (default 0 = disabled) added to env schema. `.env.example` updated.

**25.4:** Server creates `resolverInterval` alongside `settlementInterval`. Resolver runs once immediately on startup, then on interval. Both cleared on graceful shutdown. `POST /api/settlement/resolve` added (auth-required), mirrors `POST /api/settlement/run`.

---

## Key Decisions

- **Single `server.ts`** for all routes — deliberate simplicity for a 2-user app
- **Resolver and settler are separate jobs** — resolver is cheap (1 call/date), settler is rate-sensitive (1 call/20 events)
- **No queue library** — `setInterval` is sufficient; crash recovery handled by resolver running immediately on startup
- **Pluggable provider interface** — adding a sport/provider = implement `SettlementProvider` (3 methods) + factory branch
- **Dedup constraint on `Bet`**: `(teams, matchTime, betType, stake)` — duplicate slip upload returns HTTP 409
- **Soft deletes** — all queries filter `deletedAt: null`
