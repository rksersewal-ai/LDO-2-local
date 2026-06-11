# LDO-2 EDMS Issue Register

**Created:** June 11, 2026  
**Remediation Lead:** Principal Engineer (Kiro)  
**Methodology:** Systematic 12-phase remediation, executed in dependency order  

---

## Issue Catalogue

### Phase 1: Theme / Token Cleanup

| ID | Severity | Issue | Root Cause | Affected Files | Fix Strategy | Acceptance Criteria |
|----|----------|-------|-----------|----------------|--------------|---------------------|
| T-001 | High | Duplicate formatters: Prettier AND Biome both configured | Historical migration from Prettier to Biome left both active | `package.json`, `.pre-commit-config.yaml` | Remove Prettier from devDeps and pre-commit; Biome is canonical | `grep -r prettier package.json` returns 0 results; Biome alone handles format |
| T-002 | Medium | `globals.css` has hardcoded HSL values in `.app-shell-bg` pseudo-elements instead of CSS variables | Direct HSL values pre-date the token system | `src/styles/globals.css` | Replace hardcoded HSL values with `var(--primary)` / `var(--background)` references | All colors in globals.css use either `hsl(var(--token))` or semantic classes |
| T-003 | Low | `.glass-card-teal` class undefined in CSS but referenced in `Shared.tsx` | Ghost reference from deleted CSS | `Shared.tsx`, `globals.css` | Remove `GlassCardTeal` or add CSS class | No runtime console errors for missing classes |
| T-004 | Medium | `StatCard` in Shared.tsx references `stat-card-teal`, `stat-card-amber` etc. classes that may not exist in CSS | Orphan token references | `Shared.tsx`, `globals.css` | Audit and either define or remove; use semantic `--status-*` tokens | StatCard renders without missing-class warnings |
| T-005 | Low | Root `vite.config.ts` has stale version-pinned aliases (`vaul@1.1.2`, `sonner@2.0.3`) | Copy-paste from old Replit scaffold | Root `vite.config.ts` | Clean up or remove this file (production config is in `artifacts/edms/vite.config.ts`) | Root vite.config.ts either deleted or cleaned |

### Phase 2: Component Unification

| ID | Severity | Issue | Root Cause | Affected Files | Fix Strategy | Acceptance Criteria |
|----|----------|-------|-----------|----------------|--------------|---------------------|
| C-001 | High | `Shared.tsx` wraps canonical components (Button, Badge, Input) adding confusion about which to import | Abstraction layer created during rapid prototyping | 25+ pages import from `Shared.tsx` | Keep `Shared.tsx` as the single public API surface; ensure it cleanly delegates to `ui/button.tsx`, `ui/badge.tsx`, etc. with no style drift | All page imports resolve through consistent path; no duplicate variant definitions |
| C-002 | Medium | Two Badge components: `ui/badge.tsx` (CVA-based) and `Shared.tsx Badge` (wrapper) | CVA badge uses `variant` as union type; Shared Badge maps to different variant names | `badge.tsx`, `Shared.tsx`, all consumers | Align variant names: Shared Badge's `success`/`warning`/`danger` must map 1:1 to badge.tsx variants | Single type system for badge variants across app |
| C-003 | Medium | `ErrorBoundary.tsx` uses hardcoded `rose-900/10`, `rose-500/20`, `rose-300` colors | Pre-theme-hardening code | `ErrorBoundary.tsx` | Replace with `--status-danger` CSS variable tokens | ErrorBoundary renders with semantic colors in both themes |
| C-004 | Medium | `ErrorState.tsx` uses hardcoded `rose-400`, `amber-400`, `rose-900/20` | Same as above | `ErrorState.tsx` | Replace with semantic status tokens | All error/warning icons use `var(--status-*)` |
| C-005 | Low | `spinner.tsx` exists alongside `LoadingState.tsx` — overlapping loading primitives | Two developers created separate solutions | `spinner.tsx`, `LoadingState.tsx` | Keep both (Spinner is inline, LoadingState is full-page); document usage | Clear JSDoc on each explaining when to use which |

### Phase 3: Layout / Spacing Alignment

| ID | Severity | Issue | Root Cause | Affected Files | Fix Strategy | Acceptance Criteria |
|----|----------|-------|-----------|----------------|--------------|---------------------|
| L-001 | Medium | Inconsistent page padding: some pages use `p-3 md:p-4`, AppLayout applies `px-3 pb-4 pt-3 md:px-4` | No documented layout spec | `AppLayout.tsx`, all pages | AppLayout provides consistent outer padding; pages should not add their own outer padding | Visual audit shows uniform page margins |
| L-002 | Low | Card padding varies: `p-3.5`, `p-4`, `p-6` across different usages | No spacing scale documented | All pages using GlassCard/Card | Standardize: `p-3` (compact), `p-4` (default), `p-6` (hero/form) | Consistent card padding per context |
| L-003 | Low | Gap between sections varies: `gap-3`, `gap-4`, `gap-6` without clear hierarchy | Ad-hoc spacing | Multiple pages | Document: `gap-3` (within section), `gap-4` (between cards), `gap-6` (between sections) | Spacing follows documented scale |

### Phase 4: Loading / Empty / Error States

| ID | Severity | Issue | Root Cause | Affected Files | Fix Strategy | Acceptance Criteria |
|----|----------|-------|-----------|----------------|--------------|---------------------|
| S-001 | High | No route-level ErrorBoundary wrapping page content | `AppLayout.tsx` renders `<Outlet>` without error protection | `AppLayout.tsx` | Wrap `<Outlet>` in `<ErrorBoundary name="PageContent">` | Component crash doesn't white-screen the app |
| S-002 | Medium | `ErrorBoundary` uses hardcoded rose colors (not theme-aware) | Pre-theme-hardening | `ErrorBoundary.tsx` | Replace with `var(--status-danger)` semantic tokens | Renders correctly in both light and dark themes |
| S-003 | Low | `EmptyState` component exists but many pages inline their own empty states | Awareness gap — component created after pages were built | Multiple pages | Audit and migrate inline empty states to use `EmptyState` component | At least critical pages (DocumentHub, WorkLedger, Cases) use canonical EmptyState |

### Phase 5: Table Virtualization & Performance

| ID | Severity | Issue | Root Cause | Affected Files | Fix Strategy | Acceptance Criteria |
|----|----------|-------|-----------|----------------|--------------|---------------------|
| P-001 | High | `PLDetail.tsx` is 2,744 lines — god component | Feature accretion without refactoring | `PLDetail.tsx` | Extract: `PLFormModal.tsx`, `PLDocumentLinking.tsx`, `PLEngineeringChanges.tsx`, `PLDetailHeader.tsx` | No single file exceeds 800 lines |
| P-002 | High | `DeduplicationConsole.tsx` is 2,309 lines | Same pattern | `DeduplicationConsole.tsx` | Extract: `DedupFilterBar.tsx`, `DedupComparisonTable.tsx`, `DedupGroupList.tsx` | No single file exceeds 800 lines |
| P-003 | Medium | `WorkLedger.tsx` is 1,755 lines | Same pattern | `WorkLedger.tsx` | Extract filter logic, form modal, and table into sub-components | File under 1000 lines |
| P-004 | Medium | No table virtualization for large datasets | DataTable renders all rows to DOM | `DataTable.tsx` | Add `@tanstack/react-virtual` for datasets > 100 rows | Tables with 500+ rows render at 60fps |
| P-005 | Medium | `recharts` (~300KB) loaded in main bundle | No code splitting for chart imports | `Dashboard.tsx`, `LedgerReports.tsx` | Already lazy-loaded via `React.lazy` — verify chunk isolation | Charts in separate Webpack chunk |

### Phase 6: Animation Optimization

| ID | Severity | Issue | Root Cause | Affected Files | Fix Strategy | Acceptance Criteria |
|----|----------|-------|-----------|----------------|--------------|---------------------|
| AN-001 | High | Both `framer-motion` (catalog) AND `motion` (12.38.0) installed | `motion` is the renamed framer-motion; both are in package.json | `package.json` (edms) | Remove `motion` from dependencies; use only `framer-motion` from catalog | Only one motion library in lockfile |
| AN-002 | Medium | `prefers-reduced-motion` global transition override may conflict with intentional animations | `globals.css` applies 250ms transitions to ALL elements | `globals.css` | Scope the global transition to only theme-relevant properties; let motion lib handle component animations | Animations respect user preference; no double-timing |
| AN-003 | Low | AnimatePresence in AppLayout fires on every route change | Wrap in `mode="wait"` with short duration | `AppLayout.tsx` | Already has `mode="wait"` and 100ms — verify it doesn't cause layout shifts | No CLS on route navigation (< 0.1) |

### Phase 7: Accessibility

| ID | Severity | Issue | Root Cause | Affected Files | Fix Strategy | Acceptance Criteria |
|----|----------|-------|-----------|----------------|--------------|---------------------|
| A11Y-001 | High | No `aria-live` region for toast notifications | Toast container renders outside main flow | `Toast.tsx`, `ToastContainer` | Add `aria-live="polite"` and `role="status"` to ToastContainer | Screen readers announce toasts |
| A11Y-002 | Medium | Custom buttons lack consistent `:focus-visible` ring | Some buttons use `focus-visible:ring-2`, others don't | `Shared.tsx` Button, various inline buttons | Ensure all interactive elements have `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring` | Tab navigation shows visible focus on every interactive element |
| A11Y-003 | Medium | Color contrast for `--muted-foreground` in dark theme (`215 20% 65%`) | May not meet 4.5:1 against `--background` (220 38% 5%) | `globals.css` | Calculate contrast ratio; adjust lightness if below 4.5:1 | Passes WCAG AA contrast check |
| A11Y-004 | Low | Heading hierarchy not enforced (multiple `<h1>` per page possible) | Pages have `<h1>` in both Header breadcrumb and page body | `Header.tsx`, page components | Header shows page title as visual only (not `<h1>`); page gets the `<h1>` | One `<h1>` per page in DOM |
| A11Y-005 | Low | DataTable lacks `<caption>` or `aria-label` | Missing semantic | `DataTable.tsx` | Add optional `caption` prop to DataTable | Tables have programmatic name |

### Phase 8: Tests

| ID | Severity | Issue | Root Cause | Affected Files | Fix Strategy | Acceptance Criteria |
|----|----------|-------|-----------|----------------|--------------|---------------------|
| TEST-001 | Critical | Frontend test coverage near 0% (1 test file for 186 TS/TSX files) | Tests never prioritized during rapid development | All frontend code | Add tests for: auth hook, ThemeContext, Toast system, DataTable, ErrorBoundary | Minimum 15 test files covering critical paths |
| TEST-002 | High | E2E test file exists but is likely stale/non-functional | Playwright config references commented-out webServer | `tests-e2e/core-workflows.spec.ts`, `playwright.config.ts` | Update E2E to test login flow against mock API | E2E login test passes in CI |
| TEST-003 | Medium | No test for service layer (ApiClient, DocumentService, etc.) | Services created without TDD | `src/services/*.ts` | Add unit tests for ApiClient error handling, token refresh logic | Services have > 50% coverage |
| TEST-004 | Medium | Backend test files exist but no visible coverage reporting | `pytest --cov` configured in CI but results not tracked | `backend/tests/` | Add coverage badge to README; enforce minimum threshold in CI | Coverage report generated and visible |

### Phase 9: Security Hardening

| ID | Severity | Issue | Root Cause | Affected Files | Fix Strategy | Acceptance Criteria |
|----|----------|-------|-----------|----------------|--------------|---------------------|
| SEC-001 | Critical | Demo credentials hardcoded in `Login.tsx` (visible to all users) | Development convenience leaked to production | `Login.tsx` | Gate behind `import.meta.env.DEV` check — only show in development mode | Production build has no demo credentials visible |
| SEC-002 | Critical | Mock API credentials in `vite.config.ts` (MOCK_USERS object) | Same pattern | `artifacts/edms/vite.config.ts` | Move to external JSON loaded only in dev; mock plugin only active when `VITE_ENABLE_DEV_MOCK_API=true` | Production bundle doesn't contain mock user data |
| SEC-003 | High | No dependency vulnerability scanning in CI | CI pipeline never included it | `.github/workflows/ci.yml` | Add `pnpm audit --audit-level=high` step to frontend job | CI fails if high/critical vulnerabilities found |
| SEC-004 | High | `path-to-regexp: "^0.1.12"` override — known ReDoS vulnerability | Legacy Express compatibility hack | Root `package.json` pnpm overrides | Audit if still needed; if Express 5 is used, remove override | Override removed or upgraded to safe version |
| SEC-005 | Medium | No CSP headers in Nginx config | Nginx config is minimal (inline in Dockerfile) | `Dockerfile.frontend` | Extract nginx.conf; add CSP, X-Frame-Options, X-Content-Type-Options | Security headers present in response |
| SEC-006 | Medium | Unused dependencies increase attack surface | `wouter`, `next-themes`, `react-icons` all unused | `package.json` (edms) | Remove all unused packages | No unused deps in package.json |

### Phase 10: Observability

| ID | Severity | Issue | Root Cause | Affected Files | Fix Strategy | Acceptance Criteria |
|----|----------|-------|-----------|----------------|--------------|---------------------|
| OBS-001 | High | No frontend error tracking (Sentry/Bugsnag) | Never integrated | None (new file needed) | Add error reporting utility that can be wired to Sentry; wrap in ErrorBoundary | Unhandled errors are captured and reportable |
| OBS-002 | Medium | No structured frontend logging | `console.error` used ad-hoc | Multiple services | Create `lib/logger.ts` with structured log levels that can be piped to backend | Logger utility available and used in services |
| OBS-003 | Low | No performance monitoring (Web Vitals) | Never integrated | None (new file needed) | Add `web-vitals` reporting hook | CLS, LCP, FID metrics captured |

### Phase 11: CI/CD

| ID | Severity | Issue | Root Cause | Affected Files | Fix Strategy | Acceptance Criteria |
|----|----------|-------|-----------|----------------|--------------|---------------------|
| CI-001 | Critical | CI uses `\|\| echo "::warning::"` to suppress typecheck/lint failures | Workaround for existing errors that were never fixed | `.github/workflows/ci.yml` | Remove the `\|\| echo` fallback; fix underlying errors | CI fails on typecheck or lint error |
| CI-002 | High | No frontend test execution in CI | Test step never added | `.github/workflows/ci.yml` | Add `pnpm run test` step after build | Frontend tests run in CI pipeline |
| CI-003 | Medium | No bundle size tracking | Never configured | None (new) | Add `size-limit` or Vite bundle analyzer output as CI artifact | Bundle size reported per PR |
| CI-004 | Low | Deploy job is a placeholder (`echo "Deploy would happen here"`) | Staging not yet configured | `.github/workflows/ci.yml` | Document target deployment; add real deploy step or remove placeholder | Deploy step is functional or clearly marked as TODO |

### Phase 12: Deployment & Documentation

| ID | Severity | Issue | Root Cause | Affected Files | Fix Strategy | Acceptance Criteria |
|----|----------|-------|-----------|----------------|--------------|---------------------|
| DOC-001 | Medium | 13 stale `.md` report files at repo root | AI-generated reports left in working tree | Root directory | Move to `docs/archive/` or delete | Root contains only README.md, CLAUDE.md, AGENTS.md |
| DOC-002 | Medium | No `CONTRIBUTING.md` | Never created | None (new) | Add contribution guidelines, PR template, branch naming | CONTRIBUTING.md exists with clear onboarding steps |
| DOC-003 | Medium | No deployment runbook | Deployment is undocumented | None (new) | Create `docs/DEPLOYMENT_RUNBOOK.md` with step-by-step production deploy | Runbook covers: build, deploy, rollback, verify |
| DOC-004 | Low | `gunicorn` not in `requirements.txt` but used in Dockerfile | Dockerfile installs it via pip but file doesn't declare it | `backend/requirements.txt` | Add `gunicorn==23.0.0` | All production deps are explicit |
| DOC-005 | Low | No `CHANGELOG.md` | Conventional commits enforced but not aggregated | None (new) | Add initial CHANGELOG.md; configure auto-generation | CHANGELOG.md exists |

---

## Remediation Execution Order

```
Phase 0  → Issue Register (this document)
Phase 1  → Theme/Token Cleanup (T-001 through T-005)
Phase 2  → Component Unification (C-001 through C-005)
Phase 3  → Layout/Spacing Alignment (L-001 through L-003)
Phase 4  → Loading/Empty/Error States (S-001 through S-003)
Phase 5  → Table Virtualization & Performance (P-001 through P-005)
Phase 6  → Animation Optimization (AN-001 through AN-003)
Phase 7  → Accessibility (A11Y-001 through A11Y-005)
Phase 8  → Tests (TEST-001 through TEST-004)
Phase 9  → Security Hardening (SEC-001 through SEC-006)
Phase 10 → Observability (OBS-001 through OBS-003)
Phase 11 → CI/CD (CI-001 through CI-004)
Phase 12 → Deployment Docs (DOC-001 through DOC-005)
```

**Total Issues:** 52  
**Critical:** 6  
**High:** 17  
**Medium:** 21  
**Low:** 8  

---

## Verification Matrix (per phase)

Each phase must pass ALL of:
1. `pnpm run lint:frontend` — zero errors
2. `pnpm run format` — no changes (already formatted)
3. `pnpm run typecheck` — zero errors
4. `pnpm run test` — all tests pass
5. `pnpm run build` — production build succeeds
6. Manual: no console errors in dev mode
7. Manual: light/dark theme toggle works on all modified pages

---

*Issue Register v1.0 — Principal Engineer Remediation Plan*
