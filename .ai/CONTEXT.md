# Bet Tracker - Project Context

## Project Purpose
A modern, shared betting tracker application for two users to log sports bets, upload screenshots of betting slips, and automatically settle bets when game results are available. Features include parlay support, dashboard with statistics, and integration with sports data APIs for auto-settlement.

## Key Technologies
- **Backend:** Fastify + TypeScript + Prisma ORM
- **Frontend:** React 19 + TypeScript + Vite + TanStack Query + react-hook-form + zod
- **Database:** SQLite (with designed migration path to PostgreSQL)
- **Security:** JWT auth, rate limiting, helmet, file validation, schema validation
- **Auth:** bcryptjs for password hashing
- **Package Manager:** pnpm (workspace with backend/frontend packages)

## Project Structure

```
/c/Users/solastic/prj/bet-track/
├── .ai/                    # AI context and documentation
├── .github/                # GitHub Actions CI/CD workflows
├── backend/                # Fastify API server
│   ├── src/
│   │   ├── server.ts       # Main Fastify server setup & routes
│   │   ├── lib/            # Utilities and helpers
│   │   ├── services/       # Business logic services
│   │   ├── settlement/     # Auto-settlement logic & providers
│   │   └── types/          # TypeScript type definitions
│   ├── prisma/             # Prisma schema & migrations
│   ├── scripts/            # Utility scripts (password hashing, seeding)
│   ├── package.json        # Backend dependencies
│   └── tsconfig.json
├── frontend/               # React SPA (Vite)
│   ├── src/
│   │   ├── App.tsx         # Main React component
│   │   ├── api.ts          # API client/queries
│   │   ├── main.tsx        # Entry point
│   │   └── styles.css      # Global styles
│   ├── index.html          # HTML entry
│   ├── package.json        # Frontend dependencies
│   └── vite.config.ts
├── ops/                    # Operations scripts
│   ├── backup.sh           # Database backup script
│   └── nginx.conf          # Production Nginx config
├── pnpm-workspace.yaml     # Workspace configuration
├── package.json            # Root workspace config
├── ARCHITECTURE.md         # Architecture decisions (Prisma, Fastify, SQLite)
├── DEPLOYMENT.md           # Production deployment guide
├── SECURITY.md             # Security considerations
├── README.md               # Quick start & features
└── specs.md                # Detailed specifications
```

## Key Development Scripts

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start backend + frontend dev servers |
| `pnpm build` | Build all packages for production |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm --filter bet-track-backend db:push` | Sync Prisma schema to DB |
| `pnpm --filter bet-track-backend db:seed` | Seed database with baseline data |
| `pnpm --filter bet-track-backend hash:password` | Generate password hash for auth |
| `pnpm --filter bet-track-backend check:password` | Verify password hash |

## Key Environment Variables

**Backend (.env)**
- `DATABASE_URL` - SQLite database path
- `PASSWORD_HASH` - hashed password for authentication
- `JWT_SECRET` - secret key for JWT tokens
- `NODE_ENV` - development/production
- `SETTLEMENT_PROVIDER` - auto-settlement provider (none | api_football)
- `SETTLEMENT_POLL_MINUTES` - how often to check results
- `API_FOOTBALL_KEY` - API Football API key

**Frontend (.env)**
- `VITE_API_URL` - backend API endpoint

## Architecture Decisions

### ORM: Prisma
- Choice: Prisma over Drizzle for better developer ergonomics
- Migration path from SQLite to PostgreSQL is straightforward
- Strong type safety and migration tooling

### Runtime: Fastify
- Modern, fast, clean plugin model
- Strong TypeScript support
- Better performance than Express

### Database: SQLite now, PostgreSQL-ready
- Low operational overhead for 2 users
- Easy backup/restore
- Prisma schema supports seamless migration to PostgreSQL when needed

### Frontend: TanStack Query + react-hook-form + zod
- Robust server-state caching and invalidation
- Typed forms and validation
- Better UX under network variance

## Core Features

### Betting Functionality
- **Bet Creation:** Log bets with teams, odds, stake, currency, match time
- **Bet Types:** Single bets and parlays (multi-leg bets)
- **Screenshot Upload:** Attach betting slip images to bets
- **Auto Settlement:** Connect to sports APIs (e.g., api-football.com) to automatically settle bets when games finish

### Parlay Support
- Track multi-leg bets with individual leg outcomes
- Each leg has market type (1x2, over/under), selection, odds, and event time
- Overall parlay settles when all legs complete

### Dashboard & Stats
- Shared view for two users
- Betting history with persistent records
- Performance statistics over time
- Currency support (EUR, etc.)

### Security
- JWT authentication (2-user system)
- Password hashing with bcryptjs
- Rate limiting on API endpoints
- File validation for uploads
- CORS and helmet middleware
- Schema validation with zod

## Important Patterns & Conventions

### Code Style
- Prefer functional programming (no unnecessary classes)
- Use TypeScript strict mode
- Minimal changes - only modify what's necessary for the task
- Follow TDD when feasible, or explicit technical verification

### Database
- Avoid N+1 query patterns
- Use Prisma's createMany/updateMany/transactions for batch operations
- Schema is in `backend/prisma/schema.prisma`

### Settlement Architecture
- Settlement providers are pluggable (see `backend/src/settlement/`)
- Polling mechanism runs on interval (configurable via `SETTLEMENT_POLL_MINUTES`)
- Results are fetched from sports data providers and bets are marked as won/lost/pending

### Frontend Architecture
- API client in `frontend/src/api.ts` using TanStack Query
- Form handling with react-hook-form and zod validation
- Main app logic in `frontend/src/App.tsx`

## Common Tasks & Entry Points

- **Adding an API endpoint:** Edit `backend/src/server.ts`
- **Adding a service:** Create in `backend/src/services/` and import in server.ts
- **Updating database schema:** Edit `backend/prisma/schema.prisma`, then run `pnpm db:push`
- **Adding React components:** Add to `frontend/src/`, import in App.tsx
- **Adding API queries:** Add to `frontend/src/api.ts` using TanStack Query patterns
- **Settlement integration:** Extend `backend/src/settlement/` with new provider

## Notes

- Always read relevant specification files (ARCHITECTURE.md, SECURITY.md) before making major changes
- Keep development with pnpm workspace - use `--filter` flag to target specific packages
- Database migrations are managed by Prisma - no manual SQL needed
- Frontend is a single-page app (SPA) with client-side routing
- Backend provides REST API with JWT-protected endpoints
