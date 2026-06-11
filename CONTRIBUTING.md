# Contributing to LDO-2 EDMS

Thank you for contributing. This guide covers conventions, workflow, and quality gates.

## Prerequisites

- **Node.js** 20+ with corepack enabled
- **pnpm** (enforced — yarn/npm will fail)
- **Python** 3.12+ for backend work
- **Docker** (optional, for full-stack local dev)

## Getting Started

```bash
# Clone and install
git clone <repo-url> && cd LDO-2-local
pnpm install

# Run the frontend (with mock API)
pnpm run dev:edms

# Run the mock API server
pnpm run dev:api-server

# Run backend (separate terminal)
cd backend && pip install -r requirements.txt
python manage.py migrate
python -m config.waitress_runner
```

## Branch Naming

```
feat/short-description     — New features
fix/short-description      — Bug fixes
docs/short-description     — Documentation only
refactor/short-description — Code restructuring
test/short-description     — Test additions
chore/short-description    — Tooling, deps, CI
```

## Commit Messages

We enforce [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(scope): add document export button
fix(auth): handle expired refresh token gracefully
docs(readme): update getting-started section
test(toast): add unit tests for ToastContext
```

Pre-commit hooks validate this automatically.

## Code Quality Gates

Every PR must pass:

1. **`pnpm run typecheck`** — Zero TypeScript errors
2. **`pnpm run lint:frontend`** — Zero Biome lint errors
3. **`pnpm run test`** — All unit tests pass
4. **`pnpm run build`** — Production build succeeds
5. **Backend**: `ruff check .` + `pytest` pass

## UI Component Guidelines

- Import page-level UI from `@/components/ui/Shared` (Button, Badge, GlassCard, Input, Select, PageHeader)
- Import low-level primitives from `@/components/ui/button`, `@/components/ui/badge` only when building new shared components
- All colors must use semantic CSS variables (`--status-*`, `--primary`, `--muted-foreground`, etc.)
- Never use hardcoded Tailwind color classes (`text-rose-400`, `bg-slate-900`)
- Support both dark and light themes — test with the toggle

## File Size Limits

- No single component file should exceed **800 lines**
- If a page exceeds 1000 lines, plan a decomposition (see `docs/GOD_COMPONENT_DECOMPOSITION.md`)

## Testing

- **Unit tests**: Co-locate with source (`Component.test.tsx` next to `Component.tsx`)
- **E2E tests**: Place in `tests-e2e/` directory
- **Run locally**: `pnpm --filter @workspace/edms run test`

## Pull Request Process

1. Create a branch from `develop` (or `main` for hotfixes)
2. Make changes following the guidelines above
3. Ensure all quality gates pass locally
4. Push and create a PR targeting `develop`
5. Request review from at least one team member
6. Squash-merge after approval

## Architecture Decisions

Major decisions are recorded in `docs/adr/`. When proposing a significant architectural change, create a new ADR first.
