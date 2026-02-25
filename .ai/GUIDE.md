# Work Guide

Personal bet tracker — Fastify/Prisma/SQLite backend, React/Vite frontend, Claude OCR slip upload, auto-settlement via API Football.

---

## Key Files

| File | Purpose |
|------|---------|
| `backend/src/server.ts` | All routes + app bootstrap |
| `backend/src/lib/env.ts` | Zod env schema |
| `backend/src/lib/schemas.ts` | Zod request schemas |
| `backend/src/lib/domain.ts` | `newId()`, `autoStatus()` |
| `backend/src/services/extraction.ts` | Claude OCR pipeline |
| `backend/src/settlement/runner.ts` | Settlement batch poller |
| `backend/src/settlement/resolver.ts` | Fixture ID resolver (date lookup + fuzzy match) |
| `backend/src/settlement/providers/apiFootball.ts` | API Football v3 provider |
| `backend/src/settlement/rules.ts` | Leg outcome rules (1x2, O/U, BTTS) |
| `backend/prisma/schema.prisma` | DB schema |

---

## Dev Commands

```bash
pnpm dev                                          # backend + frontend dev servers
pnpm build                                        # production build
pnpm typecheck                                    # TypeScript check
pnpm --filter bet-track-backend db:push           # sync Prisma schema
pnpm --filter bet-track-backend db:seed           # seed DB
pnpm --filter bet-track-backend hash:password     # generate password hash
```

---

## Common Entry Points

- **New API endpoint** → `backend/src/server.ts`
- **New settlement provider** → `backend/src/settlement/providers/<name>.ts`, implement `SettlementProvider`, add branch in `providerFactory.ts` + enum in `env.ts`
- **DB schema change** → `backend/prisma/schema.prisma` → `pnpm db:push`
- **New React component** → `frontend/src/` → import in `App.tsx`

---

## When Stuck

1. Check `CONTEXT.md` for current state and prior decisions
2. Read the relevant code path before changing anything
3. Reproduce via API or manual trigger before guessing
