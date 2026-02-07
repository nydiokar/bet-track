# Shared Bet Tracker 📊

**Track your sports bets together, automatically.** A modern betting tracker built for two users who want to see their betting history, stats, and results in one shared dashboard.

## What's This?

Ever placed a bet and then forgot about it? Or wanted to keep track of your betting performance over time? This app solves that.

**The Problem:** Betting slips pile up (physical or digital), it's hard to remember what you bet on, and tracking your wins/losses manually is tedious.

**The Solution:** A clean, shared web app where you can log bets, upload screenshots from your betting slip, and watch as results get automatically settled. You get a dashboard showing your betting history, statistics, and performance over time.

## Features ✨

- **Shared Dashboard** - Two users, one view of all your bets
- **Screenshot Upload** - Snap a pic of your betting slip and upload it with your bet
- **Auto Settlement** - Connects to sports APIs to automatically settle your bets when games finish
- **Parlay Support** - Track multi-leg bets with individual leg outcomes
- **Stats & History** - See your performance over time with persistent records
- **Secure & Private** - JWT authentication, rate limiting, and security best practices built-in
- **Modern Stack** - Fast, type-safe, and built with modern web technologies

## How It Works

1. **Log in** to your account (supports two users)
2. **Create a bet** by entering teams, odds, stake, and match details
3. **Upload a screenshot** of your betting slip (optional but helpful)
4. **Watch it settle** automatically when the game finishes (if auto-settlement is enabled)
5. **Review your stats** on the dashboard to see your betting performance

Behind the scenes, the app connects to sports data providers to fetch game results and automatically determines if your bet won or lost. No more manual checking!

## Tech Stack

Built with modern, production-ready tools:

- **Backend:** Fastify + TypeScript + Prisma ORM
- **Frontend:** React + TypeScript + TanStack Query + react-hook-form + zod
- **Database:** SQLite (with easy PostgreSQL migration path)
- **Security:** JWT auth, rate limiting, helmet, file validation, schema validation

Want to know more about the architecture decisions? Check out `ARCHITECTURE.md`.

## Quick Start

### Prerequisites

- Node.js 18+ installed
- pnpm (we'll set it up below)

### Step-by-Step Setup

**1. Enable pnpm and install dependencies**

```bash
corepack enable
pnpm install
```

**2. Set up backend environment**

```bash
cd backend
cp .env.example .env
# Follow the Password Setup section below to generate your password hash
```

**3. Set up frontend environment**

```bash
cd frontend
cp .env.example .env
```

**4. Initialize database and start the app**

```bash
pnpm --filter bet-track-backend db:push
pnpm --filter bet-track-backend db:seed
pnpm dev
```

That's it! The app should now be running. Check your console for the URLs.

## Password Setup

Generate a secure password hash:

```bash
pnpm --filter bet-track-backend hash:password
```

Copy the output and paste it into `backend/.env` as the `PASSWORD_HASH` value.

**Verify your password works** (optional):

```bash
pnpm --filter bet-track-backend check:password
```

## Available Scripts

| Command | What It Does |
|---------|--------------|
| `pnpm dev` | Starts both backend and frontend in development mode |
| `pnpm build` | Builds all packages for production |
| `pnpm typecheck` | Runs TypeScript type checking across the project |
| `pnpm db:push` | Syncs your Prisma schema to the database |
| `pnpm db:seed` | Seeds the database with baseline data |

## Auto Settlement & Parlays

### What is Auto Settlement?

Instead of manually marking bets as won/lost, the app can automatically check sports results and settle your bets for you. Just enable it in the config!

**How it works:**

- When creating a bet, you can link it to a provider event ID (like an API Football game)
- The settlement service polls the provider for game results
- When a game finishes, it automatically updates your bet status

**Enable Auto Settlement:**

In `backend/.env`, configure:

```bash
SETTLEMENT_PROVIDER=api_football  # Options: none | api_football
SETTLEMENT_POLL_MINUTES=10        # How often to check for results
API_FOOTBALL_KEY=your_api_key     # Your API key from api-football.com
```

**Manual Settlement Trigger:**

You can also trigger settlement manually:

```bash
POST /api/settlement/run
# Requires authentication
```

### Parlay Bets

Parlays (multi-leg bets) are fully supported! Each leg tracks separately, and the overall ticket settles when all legs complete.

**Example Parlay Creation:**

```json
POST /api/bets
{
  "kind": "parlay",
  "teams": "Parlay Ticket",
  "bet_type": "3-leg combo",
  "odds": 6.2,
  "stake": 25,
  "currency": "EUR",
  "match_time": "2026-02-07T18:00:00Z",
  "legs": [
    {
      "teams": "Arsenal vs Liverpool",
      "market_type": "1x2",
      "selection": "home",
      "odds": 2.1,
      "event_time": "2026-02-07T18:00:00Z",
      "provider": "api_football",
      "provider_event_id": "12345"
    },
    {
      "teams": "Inter vs Milan",
      "market_type": "over_under",
      "selection": "over",
      "line": 2.5,
      "odds": 1.8,
      "event_time": "2026-02-07T20:00:00Z",
      "provider": "api_football",
      "provider_event_id": "67890"
    }
  ]
}
```

## Deployment

Ready to deploy to production? Check out `DEPLOYMENT.md` for detailed deployment instructions and best practices.

## Questions?

- **Architecture details:** See `ARCHITECTURE.md`
- **Security considerations:** See `SECURITY.md`
- **Deployment guide:** See `DEPLOYMENT.md`

---

Built with ❤️ for better bet tracking.
