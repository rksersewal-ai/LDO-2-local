# LDO-2 EDMS Gap Closure Plan

**Version:** 1.0  
**Date:** June 2026  
**Author:** Principal Engineer  
**Target:** Production-grade engineering document management for 6 lakh+ documents  
**Niche:** Engineering-document intelligence (OCR, BOM linkage, PL management, tiled drawing viewing)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Strengths to Preserve](#2-current-strengths-to-preserve)
3. [Production Gaps to Fix](#3-production-gaps-to-fix)
4. [Engineering-Document Intelligence Improvements](#4-engineering-document-intelligence-improvements)
5. [User Experience Improvements](#5-user-experience-improvements)
6. [Admin Experience Improvements](#6-admin-experience-improvements)
7. [Performance and Scale Improvements](#7-performance-and-scale-improvements)
8. [OCR and Tiled Drawing Improvements](#8-ocr-and-tiled-drawing-improvements)
9. [Reliability and Crash-Protection Improvements](#9-reliability-and-crash-protection-improvements)
10. [Security Improvements](#10-security-improvements)
11. [Storage and Search Improvements](#11-storage-and-search-improvements)
12. [Testing and Verification Plan](#12-testing-and-verification-plan)
13. [Rollout Strategy](#13-rollout-strategy)
14. [Risk Register](#14-risk-register)
15. [Decision Table](#15-decision-table)
16. [Acceptance Criteria for 10/10 Production Readiness](#16-acceptance-criteria-for-1010-production-readiness)

---

## 1. Executive Summary

LDO-2 is an Engineering Document Management System (EDMS) built for LAN-deployed industrial environments. It currently scores 8/10 on production readiness with a strong foundation: clean React 19 + Vite 7 frontend, Django 5.2 backend, role-based access, and full Docker Compose orchestration.

This plan identifies the remaining 2/10 gap and provides a structured path to close it. The primary gaps are:

- **Quality debt**: 88 lint errors, 16 typecheck errors, near-zero test coverage (1 test file with 5 tests)
- **Missing OCR pipeline**: No tiled processing for A0/A1 engineering drawings
- **Scale untested**: No evidence the system handles 6 lakh documents
- **Security gaps**: No MFA, no encryption at rest, basic JWT only
- **Observability incomplete**: Structured logger exists but is not connected to an APM stack
- **No HA strategy**: Single-node Docker deployment with no failover

The gap closure follows a phased approach: stabilize first (fix existing quality issues), then enhance (add missing production features), then validate (prove the system meets targets under load).

All risky additions use feature flags to enable incremental rollout and safe rollback.

---

## 2. Current Strengths to Preserve

These are working systems that must not regress during gap closure:

### 2.1 Frontend Architecture (artifacts/edms/)

| Strength | Evidence | Preservation Strategy |
|----------|----------|----------------------|
| **React 19 + Vite 7 with lazy loading** | `App.tsx` uses `React.lazy()` for all 35 page-level routes | Do not change routing structure; add tests to verify code splitting |
| **Role-based route protection** | `ProtectedRoute` component checks role arrays (admin, supervisor, engineer, reviewer, viewer) | Add integration tests for role checks; never modify without ADR |
| **Command palette (Ctrl+K)** | Functional global search via `CommandPalette.tsx` | Extend, do not replace; add keyboard shortcut tests |
| **Dark/light theme system** | CSS variables in `globals.css` with `ThemeProvider` context | All new components must use `var(--token)` tokens, never hardcoded colors |
| **ErrorBoundary at route level** | `ErrorBoundary.tsx` wraps pages, catches render errors | Preserve; add Sentry integration behind feature flag |
| **Biome linter/formatter** | `biome.json` configured with recommended rules | Keep Biome as canonical tool; remove any residual Prettier config |
| **Pre-commit hooks** | `.pre-commit-config.yaml` with format/lint checks | Maintain; add typecheck to pre-commit |
| **Code splitting** | Vite produces per-route chunks via dynamic imports | Verify with bundle analysis; do not introduce eager imports for page components |

### 2.2 Backend Architecture (backend/)

| Strength | Evidence | Preservation Strategy |
|----------|----------|----------------------|
| **Django 5.2 + DRF modular apps** | Separate apps: `shared`, `documents`, `config_mgmt`, `work`, `edms_api`, `integrations`, `services` | New features go in existing apps or new apps; never merge apps |
| **Health check endpoint** | `/api/v1/health/status/` in `shared/views.py` | Extend with dependency checks (DB, Redis, Celery); do not remove |
| **Structured error handling** | `shared/exceptions.py` with `edms_exception_handler`, standardized `success_response`/`error_response` helpers | All new views must use these helpers; add tests for error formats |
| **Correlation ID middleware** | Request correlation IDs for distributed tracing | Preserve; wire into Sentry/logging backends |
| **Audit logging** | `AuditLog` model with `AuditService` | Extend to immutable hash-chain; do not modify existing schema without migration |
| **Celery task queue** | Background processing with Redis broker, beat scheduler | Add OCR tasks to new queue; do not overload default queue |
| **5-role RBAC** | admin, supervisor, engineer, reviewer, viewer permissions | Enhance with object-level permissions; never reduce existing role capabilities |

### 2.3 Infrastructure

| Strength | Evidence | Preservation Strategy |
|----------|----------|----------------------|
| **Docker Compose full stack** | `docker-compose.yml` with PostgreSQL 16, PgBouncer, Redis 7, Celery worker/beat | All new services must be added to compose; never break single-command startup |
| **CI/CD pipeline** | `.github/workflows/ci.yml` with backend lint/test, frontend typecheck/lint/test/build, security scan, docker build | Add new CI steps; never remove existing checks |
| **PgBouncer connection pooling** | Transaction-mode pooling configured | Tune pool sizes for production; do not remove |
| **pnpm workspace with catalogs** | Monorepo dependency management via `pnpm-workspace.yaml` | All packages use workspace protocol; no duplicate dependency versions |

### 2.4 Domain Features

| Strength | Evidence | Preservation Strategy |
|----------|----------|----------------------|
| **Document CRUD with metadata** | Full lifecycle management in `documents/` app | Add versioning; never break existing API contract |
| **PL/BOM linkage system** | Parts list association with documents | Core differentiator from competitors; enhance with batch operations |
| **Work record management** | Approvals workflow in `work/` app | Add state machine validation; preserve existing states |
| **Deduplication console** | Multi-algorithm duplicate detection | Optimize UI (component is 2,309 lines); preserve detection logic |
| **Mock API for development** | Express-based mock server in `artifacts/api-server/` | Keep for frontend development; add contract tests against real backend |

---

## 3. Production Gaps to Fix

### 3.1 Code Quality Gaps (Immediate Priority)

| Gap | Current State | Target | Fix Strategy |
|-----|--------------|--------|--------------|
| **Lint errors** | 88 errors, 32 warnings across frontend | 0 errors, <10 warnings | Fix in priority order: 5 label association (a11y), unused variables, `noExplicitAny`, `noNonNullAssertion` |
| **TypeScript errors** | 16 errors (test files: `ErrorBoundary.test.tsx`, `LoadingState.test.tsx`, `setup.ts` + `WorkLedger.tsx` argument mismatch) | 0 errors on `pnpm run typecheck` | Fix test type definitions first; resolve WorkLedger argument error |
| **Test coverage** | 1 test file (`*.test.tsx`) with 5 smoke tests | 70%+ statement coverage | Add tests for auth, services, hooks, DataTable, ErrorBoundary |
| **God components** | `PLDetail.tsx` (2,744 lines), `DeduplicationConsole.tsx` (2,309 lines), `WorkLedger.tsx` (1,755 lines) | No file >800 lines | Extract sub-components with stable APIs |
| **Dead dependencies** | `wouter`, `next-themes`, `react-icons` unused; both `framer-motion` and `motion` installed | Zero unused deps | Audit and remove; keep single motion library |

### 3.2 Architecture Gaps

| Gap | Current State | Target | ADR Reference |
|-----|--------------|--------|---------------|
| **No full-text search at scale** | No search index for 6 lakh documents | Sub-500ms search with GIN indexes | [ADR-001](decisions/ADR-001-search-architecture.md) |
| **No OCR pipeline** | Basic Tesseract, no tiling for large drawings | Tiled pipeline processing A0/A1 in <3 minutes | [ADR-002](decisions/ADR-002-ocr-and-tiled-processing.md) |
| **No large drawing viewer** | Download-only for large files | Tiled viewer with pan/zoom/OCR overlay | [ADR-003](decisions/ADR-003-large-drawing-viewer.md) |
| **No storage tiering** | Single storage tier | Hot/warm/cold with automated migration | [ADR-004](decisions/ADR-004-storage-architecture.md) |
| **Basic auth only** | JWT with 5 roles, no MFA | SSO + MFA + object-level permissions | [ADR-005](decisions/ADR-005-auth-security-mfa.md) |
| **Single-node deployment** | Docker Compose, no HA | HA with automatic failover, <30s RTO | [ADR-006](decisions/ADR-006-deployment-model.md) |
| **No monitoring stack** | Structured logger only | Prometheus + Grafana + Loki + alerting | [ADR-007](decisions/ADR-007-monitoring-backup-recovery.md) |
| **No open-source policy** | Ad-hoc dependency adoption | Formal criteria for adopting OSS tools | [ADR-008](decisions/ADR-008-open-source-adoption-policy.md) |

### 3.3 Security Gaps

| Gap | Severity | Current State | Target |
|-----|----------|--------------|--------|
| Demo credentials in production bundle | Critical | `Login.tsx` exposes demo creds | Gate behind `import.meta.env.DEV` |
| No MFA | High | Password-only authentication | TOTP for admin/supervisor roles |
| No encryption at rest | High | Plain files on disk, unencrypted DB | AES-256 volumes, pgcrypto for sensitive columns |
| No dependency vulnerability scanning | High | Not in CI | `pnpm audit --audit-level=high` in CI |
| path-to-regexp ReDoS override | Medium | `^0.1.12` pinned in overrides | Remove or upgrade |

---

## 4. Engineering-Document Intelligence Improvements

This is the competitive differentiator that sets LDO-2 apart from Paperless-ngx and Mayan EDMS.

### 4.1 OCR Intelligence

| Feature | Priority | Description | Feature Flag |
|---------|----------|-------------|--------------|
| **Tiled OCR for A0/A1 drawings** | P0 | Split large drawings into overlapping tiles, parallel OCR, merge with deduplication | `FEATURE_TILED_OCR` |
| **Engineering term dictionary** | P1 | Custom Tesseract traineddata with GD&T symbols, part numbers, drawing conventions | `FEATURE_CUSTOM_OCR_DICT` |
| **Layout detection** | P1 | Identify title blocks, BOM tables, revision tables, notes regions | `FEATURE_LAYOUT_DETECTION` |
| **Drawing number extraction** | P0 | Regex-based extraction of DWG-XXXXX patterns from OCR text | Part of base OCR |
| **Part number detection** | P0 | 8-digit PL number pattern matching for automatic linkage | Part of base OCR |
| **BOM table structured extraction** | P1 | Parse tabular data from BOM region into structured metadata | `FEATURE_BOM_EXTRACTION` |

### 4.2 Document Intelligence

| Feature | Priority | Description | Feature Flag |
|---------|----------|-------------|--------------|
| **Automatic metadata enrichment** | P1 | Extract revision codes, scales, material specs from OCR output | `FEATURE_AUTO_METADATA` |
| **Similar document detection** | P2 | Beyond hash dedup: content-similarity using TF-IDF on OCR text | `FEATURE_CONTENT_SIMILARITY` |
| **Revision chain tracking** | P1 | Automatic linking of document revisions by drawing number | Part of base system |
| **Cross-reference graph** | P2 | Visualize document dependencies (references, supersedes, supports) | `FEATURE_DOC_GRAPH` |

### 4.3 Integration Intelligence

| Feature | Priority | Description | Feature Flag |
|---------|----------|-------------|--------------|
| **Scanner API endpoint** | P1 | Direct ingestion from networked document scanners | `FEATURE_SCANNER_API` |
| **Batch import pipeline** | P0 | Process 50+ documents/minute from folder watch | Part of base system |
| **Export to enterprise systems** | P2 | SAP/ERP integration for BOM sync | `FEATURE_ERP_EXPORT` |

---

## 5. User Experience Improvements

### 5.1 Search and Discovery

| Improvement | Priority | Current | Target | Feature Flag |
|-------------|----------|---------|--------|--------------|
| **Instant search (<300ms)** | P0 | No full-text search index | Debounced typeahead with GIN-backed search | `FEATURE_INSTANT_SEARCH` |
| **Saved searches** | P1 | No persistence | Per-user saved filter combinations | `FEATURE_SAVED_SEARCHES` |
| **Recent documents** | P1 | No history | Last 20 accessed documents quick-access | Part of base UX |
| **Advanced filters** | P1 | Basic filtering | Date range, size, OCR status, department, PL number | Part of base UX |

### 5.2 Document Interaction

| Improvement | Priority | Current | Target | Feature Flag |
|-------------|----------|---------|--------|--------------|
| **Tiled drawing viewer** | P0 | Download-only | Pan/zoom/OCR overlay without download | `FEATURE_TILED_VIEWER` |
| **Drag-and-drop upload** | P1 | Form-based upload | Drop zone with progress tracking | Part of base UX |
| **Bulk operations** | P1 | Single document actions | Multi-select for tag/move/approve/export | `FEATURE_BULK_OPS` |
| **Optimistic updates** | P1 | Wait for server response | Immediate UI feedback with rollback on error | Part of base UX |
| **Keyboard shortcuts** | P0 | Command palette only | Vim-style table navigation (j/k/enter/esc) | Part of base UX |

### 5.3 Workflow

| Improvement | Priority | Current | Target | Feature Flag |
|-------------|----------|---------|--------|--------------|
| **Approval notifications** | P1 | No notifications | WebSocket/SSE push for approval state changes | `FEATURE_REALTIME_NOTIFY` |
| **Workflow dashboard** | P1 | Work ledger list | Visual pipeline showing pending/approved/rejected | Part of base UX |
| **Batch approvals** | P1 | One-at-a-time | Select multiple work records, approve/reject in batch | `FEATURE_BULK_APPROVE` |

---

## 6. Admin Experience Improvements

### 6.1 System Health Visibility

| Improvement | Priority | Current | Target | Feature Flag |
|-------------|----------|---------|--------|--------------|
| **Health dashboard** | P0 | Single `/api/v1/health/status/` endpoint | Full Grafana dashboards with API latency, error rates, queue depth | `FEATURE_GRAFANA_EMBED` |
| **OCR queue monitor** | P0 | No visibility | Real-time queue depth, ETA, retry controls | Part of admin UI |
| **Storage analytics** | P1 | No tracking | Per-department usage, growth projections, tier distribution | `FEATURE_STORAGE_ANALYTICS` |
| **User activity dashboard** | P1 | Audit log model exists | Searchable audit viewer with export and anomaly alerts | Part of admin UI |

### 6.2 Operations

| Improvement | Priority | Current | Target | Feature Flag |
|-------------|----------|---------|--------|--------------|
| **Auto-scaling Celery workers** | P1 | Fixed worker count | Scale based on queue depth (2-8 workers) | `FEATURE_WORKER_AUTOSCALE` |
| **Backup verification** | P1 | No automated verification | Weekly restore test with alert on failure | Part of ops |
| **Configuration hot-reload** | P2 | Restart required for config changes | django-constance for runtime settings | `FEATURE_HOT_CONFIG` |
| **Capacity planning alerts** | P1 | No alerts | Storage >80% warning, >90% critical | Part of monitoring |

### 6.3 Compliance

| Improvement | Priority | Current | Target | Feature Flag |
|-------------|----------|---------|--------|--------------|
| **Immutable audit log** | P0 | Existing AuditLog model (mutable) | Append-only with hash chain for tamper detection | Enhancement to existing |
| **Retention policies** | P1 | No enforcement | Configurable per document type (15 years for railways) | `FEATURE_RETENTION_POLICY` |
| **Compliance reports** | P2 | No reporting | Scheduled compliance status reports | `FEATURE_COMPLIANCE_REPORT` |

---

## 7. Performance and Scale Improvements

### 7.1 API Performance

| Metric | Current Estimate | Target (p95) | Strategy |
|--------|-----------------|--------------|----------|
| Document list (paginated) | ~300ms | <150ms | Database indexes + query optimization + Redis cache |
| Full-text search (600K docs) | Not supported | <500ms | PostgreSQL GIN + tsvector with proper indexes |
| Document download | ~400ms | <200ms | Nginx cache + pre-signed URLs |
| Thumbnail delivery | ~500ms (on-demand) | <80ms | Pre-generated thumbnails + immutable cache headers |
| API mutations | ~300ms | <200ms | Optimistic response + async background processing |

### 7.2 Frontend Performance

| Metric | Current | Target | Strategy |
|--------|---------|--------|----------|
| Initial load (LCP) | Not measured | <2.5s | Already code-split; add compression, preload critical chunks |
| Route transition | Not measured | <300ms | Keep existing React.lazy; add route prefetching |
| Table rendering (500 rows) | Full DOM render | 60fps scroll | Add `@tanstack/react-virtual` for large tables |
| Bundle size (main) | Not measured | <200KB gzipped | Tree-shake unused deps; verify chunk isolation |

### 7.3 Database Performance

| Optimization | Status | Impact | Implementation |
|--------------|--------|--------|----------------|
| **GIN index on search_vector** | Missing | 10-50x faster text search | `CREATE INDEX ... USING GIN (search_vector)` |
| **BRIN index on created_at** | Missing | 5-10x faster time-range queries | `CREATE INDEX ... USING BRIN (created_at)` |
| **Partial indexes for status** | Missing | Skip obsolete docs in queries | `WHERE status != 'OBSOLETE'` |
| **Table partitioning** | Not implemented | Per-partition maintenance, query pruning | Range partition by `created_at` via pg_partman |
| **Connection pool tuning** | PgBouncer exists, tuning unknown | Handle 200+ concurrent users | Increase `max_client_conn` to 500, `default_pool_size` to 40 |
| **Materialized views** | Not implemented | Fast dashboard stats | Refresh every 5 minutes for aggregates |

---

## 8. OCR and Tiled Drawing Improvements

### 8.1 Tiled OCR Pipeline Architecture

The core differentiator for LDO-2 in the engineering-document intelligence space.

**Problem:** A0 engineering drawings at 300 DPI produce 14000x9900 pixel images. Standard OCR engines fail or produce poor results on images this large.

**Solution:** Tile the image into overlapping 4096x4096 segments, process in parallel, merge results with coordinate transform and IoU-based deduplication.

| Configuration | Value | Rationale |
|---------------|-------|-----------|
| Tile size | 4096x4096 px | Optimal for Tesseract LSTM; fits in 16GB RAM |
| Overlap | 15% | Captures text spanning tile boundaries |
| Min image for tiling | 5000px (either dimension) | Below this, single-pass is sufficient |
| Max parallel tiles | 8 workers per document | Balances throughput vs. memory |
| Confidence threshold | 60% | Below this, OCR result is discarded |
| IoU dedup threshold | 0.6 | Merge duplicates from overlap zones |
| DPI target | 400 | Upscale for better engineering text recognition |

### 8.2 Processing Pipeline Stages

1. **Ingest** - Accept PDF/TIFF/PNG via upload or folder watch
2. **Pre-process** - Deskew, binarize, normalize DPI to 400
3. **Layout analysis** - Detect title block, BOM table, notes, drawing area
4. **Tiling** - Split into overlapping tiles (only for images >5000px)
5. **Parallel OCR** - Tesseract LSTM on each tile independently
6. **Merge** - Transform tile coordinates to global; IoU dedup in overlap zones
7. **Post-process** - Extract drawing numbers, PL numbers, revision codes, GD&T
8. **Index** - Write structured metadata + full text to search index
9. **Generate tiles** - Create DZI pyramid for tiled viewer

### 8.3 Feature Flags for OCR Rollout

| Flag | Default | Purpose |
|------|---------|---------|
| `FEATURE_TILED_OCR` | `false` | Enable tiled processing for large images |
| `FEATURE_OCR_LAYOUT_DETECTION` | `false` | Enable ML-based layout analysis |
| `FEATURE_OCR_CUSTOM_DICT` | `false` | Use engineering-specific Tesseract dictionary |
| `FEATURE_OCR_MULTI_ENGINE` | `false` | Fall back to EasyOCR if Tesseract confidence <60% |
| `FEATURE_OCR_BOM_EXTRACTION` | `false` | Enable structured BOM table parsing |

### 8.4 Performance Targets by Drawing Size

| Drawing | Pixels (300 DPI) | Tiles | Target OCR Time | Target Viewer Load |
|---------|-----------------|-------|-----------------|-------------------|
| A4 | 2480x3508 | 1 (no tiling) | <10s | <1s |
| A3 | 3508x4960 | 2 | <20s | <1s |
| A2 | 4960x7016 | 4 | <45s | <2s |
| A1 | 7016x9933 | 6 | <90s | <2s |
| A0 | 9933x14043 | 12 | <180s | <3s |

---

## 9. Reliability and Crash-Protection Improvements

### 9.1 Current Reliability Posture

| Component | Current | Risk |
|-----------|---------|------|
| Frontend | ErrorBoundary at route level | Component crash isolates to page; user can navigate away |
| Backend | `edms_exception_handler` with correlation IDs | Errors are logged with trace IDs; 500s return safe error response |
| Database | Single PostgreSQL instance via PgBouncer | Single point of failure; no automatic failover |
| Cache/Queue | Single Redis instance | Loss means queue tasks lost; no persistence configured |
| Workers | Single Celery worker + beat | Worker crash stops all background processing |
| Storage | Docker volumes | No redundancy; volume loss means data loss |

### 9.2 Target Reliability Architecture

| Component | Target | RTO | RPO | Feature Flag |
|-----------|--------|-----|-----|--------------|
| Frontend | Service worker for offline assets | 0 (cached) | N/A (stateless) | `FEATURE_SERVICE_WORKER` |
| Backend API | 2+ Gunicorn instances, load-balanced | <5s | 0 (stateless) | Infrastructure change |
| Database | Streaming replication + Patroni failover | <30s | <1s | Infrastructure change |
| Redis | Sentinel with 3 nodes | <10s | Last-second writes | Infrastructure change |
| Celery | 4+ workers, auto-restart, dead-letter queue | <5s (task requeued) | Task metadata in DB | `FEATURE_CELERY_DLQ` |
| Storage | RAID-6 + nightly backup + weekly verify | <1h (restore) | <24h | Infrastructure change |

### 9.3 Crash Protection Features

| Feature | Priority | Description | Feature Flag |
|---------|----------|-------------|--------------|
| **Circuit breaker for external services** | P1 | Prevent cascading failures when OCR/search is down | `FEATURE_CIRCUIT_BREAKER` |
| **Dead-letter queue** | P1 | Failed Celery tasks move to DLQ for inspection/replay | `FEATURE_CELERY_DLQ` |
| **Graceful degradation** | P1 | Search falls back to DB LIKE if ES is down; OCR queues if workers busy | Part of service design |
| **Health check expansion** | P0 | Check DB, Redis, Celery, storage connectivity from `/api/v1/health/status/` | Enhancement to existing |
| **Automatic retry with backoff** | P1 | Failed OCR tasks retry 3x with exponential backoff | Part of Celery config |
| **Data integrity checks** | P2 | Periodic verification of file checksums against stored hashes | `FEATURE_INTEGRITY_CHECK` |

---

## 10. Security Improvements

### 10.1 Authentication and Authorization

| Improvement | Priority | Current | Target | Feature Flag |
|-------------|----------|---------|--------|--------------|
| **SSO via Keycloak** | P1 | Username/password JWT | OIDC login with Keycloak, JWT fallback | `FEATURE_KEYCLOAK_SSO` |
| **MFA (TOTP)** | P0 | None | Required for admin/supervisor, optional for others | `FEATURE_MFA_TOTP` |
| **Object-level permissions** | P1 | Role-based only (5 roles) | Django Guardian for per-document access | `FEATURE_OBJECT_PERMS` |
| **API key management** | P1 | No service accounts | Scoped API keys for integrations (scanner, ERP) | `FEATURE_API_KEYS` |
| **Session hardening** | P0 | Long-lived tokens | 15-min access token, 7-day refresh with rotation | Configuration change |

### 10.2 Data Protection

| Improvement | Priority | Current | Target | Feature Flag |
|-------------|----------|---------|--------|--------------|
| **Encryption at rest (files)** | P1 | Plain files on NAS | AES-256 encrypted volumes (LUKS/dm-crypt) | Infrastructure |
| **Encryption at rest (DB)** | P1 | Plain PostgreSQL | pgcrypto for sensitive columns + encrypted tablespace | Infrastructure |
| **Encrypted backups** | P1 | Not implemented | GPG-encrypted pg_dump with separate key storage | Infrastructure |
| **TLS 1.3 on LAN** | P0 | TLS via Nginx (version unspecified) | TLS 1.3 mandatory, including internal services | Configuration |

### 10.3 Supply Chain Security

| Improvement | Priority | Current | Target |
|-------------|----------|---------|--------|
| **Dependency vulnerability scanning** | P0 | Not in CI | `pnpm audit --audit-level=high` + `pip-audit` in CI |
| **Remove unused dependencies** | P1 | 3+ unused packages | Zero unused packages in production bundle |
| **Lock file integrity** | P0 | pnpm-lock.yaml exists | CI verifies lockfile matches; frozen installs only |
| **SBOM generation** | P2 | None | Automated Software Bill of Materials per release |

### 10.4 Application Security

| Improvement | Priority | Current | Target |
|-------------|----------|---------|--------|
| **Remove demo credentials from production** | P0 | Hardcoded in `Login.tsx` | Gate behind `import.meta.env.DEV` |
| **CSP headers** | P1 | Not configured | Strict Content-Security-Policy via Nginx |
| **Rate limiting** | P1 | None | 100 req/s per IP at load balancer |
| **Input validation hardening** | P1 | DRF serializer validation | Add file type validation, size limits, path traversal protection |
| **Immutable audit log** | P0 | Mutable AuditLog model | Append-only table with hash chain for tamper detection |

---

## 11. Storage and Search Improvements

### 11.1 Content-Addressed Storage

| Feature | Description | Benefit |
|---------|-------------|---------|
| **SHA-256 content addressing** | Store files by content hash, deduplicate at storage level | 20-40% storage savings for duplicate uploads |
| **Integrity verification** | Periodic checksum validation against stored hash | Detect bit rot or unauthorized modification |
| **Immutable file storage** | Files never modified after write; new version = new file | Simpler backup, no corruption risk |

### 11.2 Storage Tiering

| Tier | Media | Capacity | Contents | Migration Trigger |
|------|-------|----------|----------|-------------------|
| **Hot** | NVMe SSD | 500 GB | Recent uploads (<90 days), thumbnails, DZI tiles, search indexes | Default for new files |
| **Warm** | HDD RAID-6 | 3 TB | Documents 90 days - 2 years, accessed <5 times/month | 90 days no access |
| **Cold** | Object storage/LTO | Archive | Documents >2 years, compliance retention | 2 years no access |

**Feature flag:** `FEATURE_STORAGE_TIERING` (default: false; all files stay on primary storage until enabled)

### 11.3 Search Architecture

| Component | Implementation | Scale Target |
|-----------|---------------|--------------|
| **Primary search** | PostgreSQL GIN index on `tsvector` column | 6 lakh documents, <500ms p95 |
| **Trigram search** | pg_trgm extension for fuzzy/partial matching | Handles typos and partial document numbers |
| **Faceted filtering** | Indexed columns: status, category, department, date range | <100ms filter application |
| **Optional full-text** | Elasticsearch (add only if PostgreSQL insufficient at 10L+) | Future scale path |
| **Search suggestions** | Materialized view of top terms, refreshed every 5 minutes | Instant typeahead |

**Decision:** Start with PostgreSQL GIN (simpler ops for LAN deployment). Add Elasticsearch behind `FEATURE_ELASTICSEARCH` flag only if PostgreSQL cannot meet targets at full document volume. See [ADR-001](decisions/ADR-001-search-architecture.md).

### 11.4 Capacity Planning

| Metric | 6 Lakh Target | Growth Buffer | Alert Threshold |
|--------|---------------|---------------|-----------------|
| Raw document storage | 4 TB | +50% (6 TB provisioned) | 80% = warning, 90% = critical |
| OCR text + indexes | 50 GB | +100% (100 GB provisioned) | 70% = warning |
| Thumbnails + DZI tiles | 200 GB | +50% (300 GB provisioned) | 80% = warning |
| Database size | 50 GB | +200% (150 GB provisioned) | 60% = warning |
| Total infrastructure | 4.5 TB | 7 TB provisioned | Per-tier monitoring |

---

## 12. Testing and Verification Plan

### 12.1 Current State

| Area | Current Coverage | Evidence |
|------|-----------------|----------|
| Frontend unit tests | Near zero (1 file, 5 smoke tests) | Only `ErrorBoundary.test.tsx` and `LoadingState.test.tsx` exist |
| Frontend integration | None | No component interaction tests |
| Frontend E2E | Stale Playwright config | `tests-e2e/core-workflows.spec.ts` exists but likely non-functional |
| Backend unit tests | Configured in CI | `pytest` configured with coverage |
| Backend integration | Unknown | No visible API integration tests |
| Load testing | None | No performance baseline |
| Security testing | Basic security scan in CI | No penetration testing |

### 12.2 Target Coverage

| Area | Target | Priority | Strategy |
|------|--------|----------|----------|
| **Frontend unit** | 70%+ statement coverage | P0 | Add tests for: auth hooks, services, DataTable, ErrorBoundary, Toast, ThemeContext |
| **Frontend integration** | Critical paths covered | P1 | Test: login flow, document CRUD, role-based visibility, command palette |
| **Frontend E2E** | 5 core workflows | P1 | Playwright: login, upload, search, approve, export |
| **Backend unit** | 80%+ statement coverage | P0 | pytest with factory_boy for all views, serializers, services |
| **Backend integration** | All API endpoints | P1 | DRF test client for endpoint contracts |
| **Load testing** | 600K docs, 200 concurrent users | P1 | k6 or Locust scripts with realistic document mix |
| **Visual regression** | Critical pages | P2 | Playwright screenshots for dark/light themes |
| **Security testing** | Annual penetration test | P2 | External security audit |

### 12.3 Test Infrastructure

| Component | Tool | Configuration |
|-----------|------|---------------|
| Frontend unit/integration | Vitest + jsdom + React Testing Library | `vitest.config.ts` (exists) |
| Frontend E2E | Playwright | `playwright.config.ts` (exists, needs update) |
| Backend | pytest + factory_boy + DRF test client | `pytest.ini` / `pyproject.toml` |
| Load testing | k6 (recommended) or Locust | New: `tests/load/` directory |
| Coverage reporting | Vitest coverage + pytest-cov | CI integration with badge |
| Mutation testing | Stryker (frontend), mutmut (backend) | Future enhancement |

### 12.4 Verification Gates

No code reaches production without passing:

1. `pnpm run typecheck` - zero errors
2. `pnpm run lint:frontend` - zero errors
3. `pnpm run test` - all tests pass
4. `pnpm run build` - production build succeeds
5. `pytest --cov --cov-fail-under=80` - backend coverage minimum
6. `pnpm audit --audit-level=high` - no high/critical vulnerabilities
7. `docker build` - container builds successfully
8. Load test baseline - no regression from previous release

---

## 13. Rollout Strategy

### 13.1 Phased Approach

| Phase | Duration | Focus | Success Criteria |
|-------|----------|-------|-----------------|
| **Phase 1: Stabilize** | Weeks 1-4 | Fix quality debt (lint, types, tests) | 0 lint errors, 0 type errors, 15+ test files |
| **Phase 2: Foundation** | Weeks 5-8 | Search index, monitoring, security hardening | GIN search works, Grafana live, demo creds removed |
| **Phase 3: OCR Pipeline** | Weeks 9-12 | Tiled OCR, DZI viewer, batch import | A0 drawings processed in <3 min |
| **Phase 4: Scale** | Weeks 13-16 | Storage tiering, HA, load testing | 600K docs loaded, <500ms search confirmed |
| **Phase 5: Enterprise** | Weeks 17-20 | SSO, MFA, audit hardening, compliance | Keycloak login, MFA enforced for admins |
| **Phase 6: Launch** | Weeks 21-24 | Production deployment, migration, training | System live on target hardware |

### 13.2 Feature Flag Strategy

All risky additions are gated behind feature flags to enable:

- **Gradual rollout**: Enable for admin users first, then expand
- **Safe rollback**: Disable flag instantly without code deployment
- **A/B testing**: Compare old vs. new behavior with metrics
- **Emergency kill**: Disable features causing production issues

**Flag implementation:** Environment variables checked at runtime.  
**Flag management:** Django-waffle for backend, Vite env vars for frontend.  
**Flag cleanup:** Remove flags 30 days after feature reaches 100% rollout.

### 13.3 Migration Strategy

| Data | Source | Approach | Rollback |
|------|--------|----------|----------|
| Existing documents | Current PostgreSQL | In-place schema migration with Django migrations | Reverse migration scripts |
| File storage | Docker volumes | Copy to content-addressed store; keep originals until verified | Symlink fallback to originals |
| User accounts | Current auth tables | Migrate to Keycloak; keep JWT fallback active | `FEATURE_KEYCLOAK_SSO=false` reverts to JWT |
| Audit logs | Current AuditLog table | Migrate to append-only table; backfill hash chain | Keep original table as read-only archive |
| Search index | No existing index | Build GIN index on existing data (background, non-blocking) | Drop index; queries fall back to sequential scan |

### 13.4 Rollback Criteria

Automatic rollback is triggered if:

- Error rate exceeds 5% (5xx responses) for 5 consecutive minutes
- API p95 latency exceeds 2000ms for 5 consecutive minutes
- Any data loss detected (checksum mismatch)
- Authentication failure rate exceeds 10%

---

## 14. Risk Register

| ID | Risk | Probability | Impact | Mitigation | Contingency |
|----|------|-------------|--------|------------|-------------|
| R-001 | OCR accuracy insufficient for engineering drawings | Medium | High | Multi-engine approach (Tesseract + EasyOCR); custom dictionary; human review queue | Manual metadata entry for low-confidence documents |
| R-002 | PostgreSQL cannot handle 6 lakh document search | Low | High | Benchmarking early (Phase 2); GIN indexes proven at this scale | Add Elasticsearch behind feature flag |
| R-003 | Large drawing DZI generation overwhelms storage | Medium | Medium | Generate on first view, not on upload; aggressive cache eviction | Limit DZI to A1+ only; smaller drawings use direct render |
| R-004 | Keycloak complexity delays SSO deployment | Medium | Medium | Phase SSO as last feature; JWT works indefinitely | Keep JWT as permanent fallback; SSO is enhancement only |
| R-005 | Breaking change in god component extraction | High | Medium | Extract one component at a time; comprehensive test coverage before refactoring | Revert individual extraction; keep monolith temporarily |
| R-006 | Network restrictions prevent dependency updates | Medium | Low | Pre-approve all dependencies; use pnpm-lock.yaml frozen installs | Work within existing lockfile; defer new deps |
| R-007 | Staff availability for 6-month execution | Medium | High | Front-load critical path (OCR, search); parallelize independent tracks | Reduce scope to core features; defer P2 items |
| R-008 | Legacy data migration corrupts existing documents | Low | Critical | Migrate in stages; verify checksums; keep originals | Restore from pre-migration backup; retry migration |
| R-009 | Performance regression from new features | Medium | Medium | Load test after each phase; performance budget in CI | Feature flag disable; revert specific commit |
| R-010 | Security vulnerability in new dependencies | Low | High | Audit all new deps before adoption (ADR-008); CI vulnerability scanning | Remove/replace vulnerable dep within 24 hours |

---

## 15. Decision Table

Architectural decisions that require formal evaluation. Each is documented as an ADR in `docs/decisions/`.

| # | Decision | Recommended | ADR | Status |
|---|----------|-------------|-----|--------|
| D-001 | Search engine selection | PostgreSQL GIN (start), Elasticsearch (scale) | [ADR-001](decisions/ADR-001-search-architecture.md) | Proposed |
| D-002 | OCR pipeline architecture | Tiled processing with parallel workers | [ADR-002](decisions/ADR-002-ocr-and-tiled-processing.md) | Proposed |
| D-003 | Large drawing viewer technology | OpenSeadragon with DZI tiles | [ADR-003](decisions/ADR-003-large-drawing-viewer.md) | Proposed |
| D-004 | Storage architecture | Content-addressed with hot/warm/cold tiering | [ADR-004](decisions/ADR-004-storage-architecture.md) | Proposed |
| D-005 | Authentication and MFA strategy | Keycloak OIDC + TOTP MFA | [ADR-005](decisions/ADR-005-auth-security-mfa.md) | Proposed |
| D-006 | Deployment model | Docker Compose first, Kubernetes later | [ADR-006](decisions/ADR-006-deployment-model.md) | Proposed |
| D-007 | Monitoring and backup stack | Prometheus + Grafana + Loki; automated backup verification | [ADR-007](decisions/ADR-007-monitoring-backup-recovery.md) | Proposed |
| D-008 | Open-source adoption criteria | Formal evaluation matrix for all new dependencies | [ADR-008](decisions/ADR-008-open-source-adoption-policy.md) | Proposed |

---

## 16. Acceptance Criteria for 10/10 Production Readiness

### 16.1 Performance Criteria

| Criterion | Target | Measurement Method |
|-----------|--------|-------------------|
| API p95 latency | <200ms | Prometheus histogram (continuous) |
| Search latency (600K docs) | <500ms | Load test with realistic query mix |
| OCR success rate | >95% | Celery task success/failure ratio |
| Concurrent users without degradation | 200+ | k6 load test |
| Document upload throughput | 50 docs/min sustained | Batch import test |
| Frontend LCP | <2.5s | Web Vitals measurement |
| Route transition time | <300ms | Performance monitoring |

### 16.2 Reliability Criteria

| Criterion | Target | Measurement Method |
|-----------|--------|-------------------|
| System uptime | 99.9% (< 8.7 hours downtime/year) | Monitoring dashboard |
| Recovery Time Objective (RTO) | <30 minutes | DR drill (quarterly) |
| Recovery Point Objective (RPO) | <1 minute | WAL streaming lag measurement |
| Backup freshness | Never >24 hours | Automated alert |
| Backup restorability | Verified weekly | Automated restore test |
| Zero data loss on component failure | Verified | Chaos testing |

### 16.3 Security Criteria

| Criterion | Target | Measurement Method |
|-----------|--------|-------------------|
| Zero critical/high CVEs | Continuous | CI vulnerability scan + monthly audit |
| MFA coverage | 100% of admin/supervisor users | Auth metrics |
| Encryption at rest | All tiers | Audit of storage configuration |
| Audit trail completeness | Every data mutation logged | Automated audit coverage check |
| Penetration test | Zero critical findings | Annual external audit |
| TLS coverage | 100% of network traffic | Certificate monitoring |

### 16.4 Quality Criteria

| Criterion | Target | Measurement Method |
|-----------|--------|-------------------|
| Frontend test coverage | >70% statements | Vitest coverage report in CI |
| Backend test coverage | >80% statements | pytest-cov report in CI |
| Lint errors | 0 | CI gate (Biome) |
| TypeScript errors | 0 | CI gate (tsc --noEmit) |
| Accessibility | WCAG AA compliance | axe-core automated audit |
| No file >800 lines | Enforced | CI check |
| API documentation | 100% endpoints documented | OpenAPI spec validation |

### 16.5 Operational Criteria

| Criterion | Target | Measurement Method |
|-----------|--------|-------------------|
| Deployment time | <10 minutes (zero-downtime) | Measured deployment |
| Monitoring coverage | All services instrumented | Grafana dashboard completeness |
| Alert accuracy | <5% false positive rate | Alert review (monthly) |
| Runbook coverage | All failure modes documented | Incident response drill |
| Capacity runway | >6 months before scaling needed | Growth projection dashboard |

### 16.6 Business Criteria

| Criterion | Target | Measurement Method |
|-----------|--------|-------------------|
| Document findability | <15 seconds to locate any document | User study |
| OCR accuracy (engineering text) | >90% character accuracy | Sample verification on 100 documents |
| User adoption | >90% of target users active within 30 days | Login analytics |
| Admin intervention rate | <2% of uploads require manual correction | Exception logs |
| Document processing SLA | 95% processed within 5 minutes of upload | Queue metrics |

---

## Appendix A: File References

Key files in the current codebase referenced by this plan:

| File | Role |
|------|------|
| `artifacts/edms/src/App.tsx` | Route definitions, lazy loading, ProtectedRoute usage |
| `artifacts/edms/src/lib/auth.tsx` | JWT authentication hook and context |
| `artifacts/edms/src/components/ui/ErrorBoundary.tsx` | Route-level error boundary |
| `artifacts/edms/src/pages/WorkLedger.tsx` | Work record management (typecheck error location) |
| `artifacts/edms/src/test/setup.ts` | Test setup (typecheck error location) |
| `backend/shared/views.py` | Health check endpoint, response helpers |
| `backend/shared/exceptions.py` | Centralized error handling, correlation IDs |
| `backend/documents/views.py` | Document CRUD API |
| `backend/edms/settings.py` | Django configuration, Celery, database |
| `docker-compose.yml` | Full stack orchestration (PG + PgBouncer + Redis + Celery) |
| `.github/workflows/ci.yml` | CI pipeline definition |
| `biome.json` | Linter/formatter configuration |
| `vitest.config.ts` | Frontend test configuration |
| `docs/ROADMAP_8_TO_10.md` | Detailed 6-month technical roadmap |
| `docs/ISSUE_REGISTER.md` | 52-issue remediation register |

---

## Appendix B: Related Documents

- [Architecture Decision Records](decisions/) - Formal architectural decisions
- [6-Month Roadmap](ROADMAP_8_TO_10.md) - Detailed execution plan
- [Issue Register](ISSUE_REGISTER.md) - Complete issue catalogue
- [Contributing Guidelines](../CONTRIBUTING.md) - Development standards
