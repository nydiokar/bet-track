# Security Notes

## Baseline

- Runtime: Fastify + TypeScript
- Logging: structured JSON logs with redaction of auth/password fields
- Validation: zod on API boundaries
- Auth: shared-password login issuing signed JWT tokens
- Headers: `@fastify/helmet`
- Abuse control: `@fastify/rate-limit`
- Upload protection: MIME + size limits via `@fastify/multipart`
- Persistence: Prisma with parameterized SQL generation
- Integrity: soft delete + audit log entries

## Dependency Governance

- Package manager: `pnpm` workspace
- Weekly dependency update automation via Dependabot
- CI gate: `pnpm audit --prod`, `pnpm typecheck`, `pnpm build`

## Operational Hardening

- Prefer HTTPS termination at reverse proxy
- Rotate `JWT_SECRET` and API keys periodically
- Keep only bcrypt hash in env (`PASSWORD_HASH`)
- Run daily DB backups (`ops/backup.sh`)

## Next Security Steps

- Add optional TOTP second factor for the shared account
- Add suspicious-auth alerting and IP throttling strategy
- Add integration tests for auth, upload and update/delete paths
