# Architecture Decisions

## 1) ORM Choice: Prisma

Decision: use `Prisma` for this project.

Why:
- You already know Prisma well, reducing onboarding and maintenance cost.
- Strong migration + client ergonomics for a small team/shared project.
- Reliable upgrade path from SQLite to Postgres with minimal app-layer churn.

Tradeoff vs Drizzle:
- Drizzle can be leaner and more SQL-centric.
- Prisma is heavier, but wins here on developer throughput and consistency.

## 2) Runtime: Fastify + TypeScript

Decision: Fastify over Express for a modern typed baseline.

Why:
- Better performance profile and clean plugin model.
- Strong TypeScript ergonomics with explicit request/response boundaries.
- Better long-term maintainability than untyped Express handlers.

## 3) PM2: Optional, not mandatory

Decision:
- If deploying plain Node on a VPS, PM2 is acceptable.
- If deploying with systemd or containers, PM2 is unnecessary.

Recommendation for this app:
- Use systemd or Docker in production where possible.
- Keep PM2 documented as a fallback for personal server simplicity.

## 4) Frontend Data + Forms

Decision: `TanStack Query` + `react-hook-form` + `zod`.

Why:
- Robust server-state handling (cache, retries, invalidation).
- Reliable form control and validation with typed schemas.
- Better UX under network variance and partial failures.

## 5) DB choice now

Decision: SQLite now, with Prisma schema designed for easy Postgres migration.

Why:
- 2 users and low operational overhead requirement.
- Backup/restore simplicity.
- No immediate multi-writer scaling pressure.