# Execution Protocol

---

## Session Start

1. Read `.ai/CONTEXT.md` — confirm active task and status
2. Run `git status` to verify working tree state
3. Read relevant source files before touching anything

## Session End

1. Update `CONTEXT.md` — mark completed tasks, note blockers, record any decisions
2. Run `pnpm typecheck` to confirm no regressions
3. Commit with `type(scope): summary` (feat / fix / refactor / chore / docs)

---

## Execution Rules

**Proceed without asking:**
- Creating files documented in GUIDE.md or CONTEXT.md
- Running build/typecheck/test commands
- Updating `.ai/` docs

**Ask before:**
- Deleting files or DB migrations
- Changing dependencies
- Any schema change that requires a migration
- Force-pushing git

---

## Code Standards

- Follow existing style — no reformatting unrelated code
- TypeScript strict mode — no `any` without a comment explaining why
- Keep changes minimal and focused — one task at a time
- No unused imports, variables, or dead code left behind
- Soft-delete pattern: all queries must filter `deletedAt: null`

---

## Quality Gate

Before marking a task done:
- `pnpm typecheck` passes
- Manual smoke test via API or UI confirms the feature works
- `CONTEXT.md` updated

---

**Golden rule:** Minimal changes. Read before editing. Update context when done.
