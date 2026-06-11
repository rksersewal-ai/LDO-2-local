# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Structured frontend logger with pluggable transports (`lib/logger.ts`)
- Global error and unhandled rejection reporting in `main.tsx`
- Web Vitals performance monitoring (LCP, CLS, FID)
- Route-level ErrorBoundary in AppLayout preventing white-screen crashes
- WCAG 2.1 AA accessibility: aria-live toasts, focus-visible rings, heading hierarchy
- DataTable `caption` prop for screen reader table identification
- Unit tests: ThemeContext, ToastContext, ErrorBoundary, LoadingState, PreferencesService
- E2E tests: Login flow, navigation, theme toggle, command palette
- Security scanning in CI (pnpm audit + pip-audit)
- Bundle size reporting as CI artifact
- CONTRIBUTING.md with onboarding guide
- Deployment runbook (`docs/DEPLOYMENT_RUNBOOK.md`)
- Layout specification (`artifacts/edms/src/LAYOUT_SPEC.md`)
- Nginx security headers (CSP, X-Frame-Options, X-Content-Type-Options)

### Changed
- CI pipeline now FAILS on typecheck/lint errors (removed `|| echo` suppressors)
- Frontend tests now run in CI before build step
- Biome is sole formatter (Prettier removed from devDeps and pre-commit)
- Demo credentials hidden in production builds (gated behind `import.meta.env.DEV`)
- Light theme muted-foreground contrast improved (4.80:1, WCAG AA pass)
- All hardcoded `slate-*` colors replaced with semantic CSS variables
- ErrorBoundary/ErrorState use `--status-danger` semantic tokens
- `.app-shell-bg` gradients use CSS variable references
- Sonner wrapper uses internal ThemeContext (removed next-themes dependency)
- Header page title uses `aria-level=2` span (pages own their `<h1>`)

### Removed
- `prettier` (3.8.1) — Biome handles all formatting
- `next-themes` (0.4.6) — unused, internal ThemeContext is canonical
- `react-icons` (5.4.0) — redundant with lucide-react
- `wouter` (3.3.5) — unused, react-router is canonical
- `motion` (12.38.0) — duplicate of framer-motion (same library, renamed)
- 14 stale root-level report `.md` files (moved to `docs/archive/`)

### Fixed
- Inline nginx config extracted to standalone `nginx.conf` file
- `gunicorn` added to `backend/requirements.txt` (was used but undeclared)
- Sidebar NavLinks missing focus-visible indicators
- Toast container missing aria-live region for screen readers

### Security
- Added CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy headers
- Demo credentials no longer visible in production builds
- Dependency vulnerability scanning added to CI pipeline
- Verified path-to-regexp@0.1.13 is safe (Express 5's intentional legacy pin)
