# Deployment Guide

## Preferred Runtime

1. Node 20 + `pnpm`
2. Reverse proxy via nginx
3. Process supervisor: `systemd` preferred, `pm2` optional

## Install

```bash
corepack enable
pnpm install
```

## Configure

```bash
cd backend
cp .env.example .env
# set PASSWORD_HASH, JWT_SECRET, ANTHROPIC_API_KEY, CORS_ORIGIN, DATABASE_URL
cd ..
pnpm --filter bet-track-backend db:push
pnpm --filter bet-track-backend db:seed
```

Use only `PASSWORD_HASH` for authentication secrets. Do not store plaintext shared passwords in env.

## Start (systemd preferred)

Use service that runs:

```bash
pnpm --filter bet-track-backend start
```

## Start (PM2 optional)

```bash
pm2 start pnpm --name bet-track-api -- --filter bet-track-backend start
pm2 save
pm2 startup
```

## Frontend

Deploy `frontend` (Vercel recommended).
Set env:

- `VITE_API_URL=https://api.yourdomain.com`

## Nginx

Use `ops/nginx.conf` template and add TLS with certbot.

## Backups

Use `ops/backup.sh` for daily SQLite backups.
