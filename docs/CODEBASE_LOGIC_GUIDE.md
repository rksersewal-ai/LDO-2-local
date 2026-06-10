# LDO-2 Codebase Logic Guide

Last updated: 2026-04-23

This document is a build-from-scratch map of the current `LDO-2` codebase. It is not a marketing overview. It explains what the system does, where the real logic lives, which pages are real vs mocked, how data moves through the stack, how RBAC works, what the admin surfaces actually control, and what you would need to reproduce the same architecture from zero.

## 1. What This System Is

`LDO-2` is a monorepo for an EDMS (Engineering Document Management System) focused on:

- engineering document registration, storage metadata, OCR, and duplicate detection
- PL/BOM/configuration management
- work records and approvals
- cases / issue tracking tied to PL and documents
- search across documents, PL items, work records, and cases
- admin operations such as source indexing, OCR monitoring, deduplication review, and audit visibility

The repository is not a perfectly uniform full-stack application. It is a hybrid:

- some flows are truly backed by Django APIs
- some flows are frontend-only and stored in localStorage or mock data
- some pages are mixed and use backend where possible with mock fallback

If you want the correct mental model, treat this repo as:

1. a real Django backend with document/search/indexing/OCR/config-management logic
2. a React frontend that is partly integrated and partly still running mock/demo behavior
3. a mock API/dev harness that exists so the UI can run without the backend

## 2. High-Level Repository Map

| Path | Purpose | Reality |
| --- | --- | --- |
| `artifacts/edms/` | Main React/Vite EDMS app | Primary frontend |
| `backend/` | Django/DRF/Celery backend | Primary backend |
| `artifacts/api-server/` | Small Node mock API | Dev helper, not full backend |
| `artifacts/mockup-sandbox/` | UI sandbox | Design/prototyping |
| `lib/api-spec/` | OpenAPI and Orval config | Codegen infrastructure |
| `lib/api-client-react/` | Generated React Query client | Present but not used by live EDMS app |
| `lib/api-zod/` | Generated Zod schemas | Present but not used by live EDMS app |
| `src/` | Legacy frontend sandbox | Reference only, not primary app |
| `docs/` | Docs, audits, ADRs | Useful, but some files are stale |

## 3. The Actual Runtime Picture

```text
Browser
  -> artifacts/edms React app
      -> local contexts + services
      -> handwritten ApiClient
      -> /api or /api/v1 Django endpoints
      -> or localStorage/mock data depending on page/service

Django
  -> edms/urls.py
      -> shared views
      -> documents views
      -> config_mgmt views
      -> work views
  -> service layer
  -> edms_api models + documents support models
  -> AuditLog + DomainEvent
  -> Celery / Redis for OCR, indexing, dedup, source crawling
```

There are two admin worlds:

- Django admin at `/admin/` on the backend
- React admin workspace routes like `/admin`, `/settings`, `/health`, `/ocr`, `/banners`

They are not the same thing, and many React admin pages are not wired to backend persistence.

## 4. Source of Truth: Read These, Ignore These First

| Concern | True source of truth | Notes |
| --- | --- | --- |
| Frontend routes and roles | `artifacts/edms/src/App.tsx` | This is the live route map |
| Frontend shell and navigation | `artifacts/edms/src/components/layout/AppLayout.tsx`, `Sidebar.tsx`, `Header.tsx` | Real layout logic |
| Frontend auth/session | `artifacts/edms/src/lib/auth.tsx`, `services/ApiClient.ts` | Session and JWT logic are split |
| Active frontend styling root | `artifacts/edms/src/index.css` | `src/index.css` is legacy |
| Backend project config | `backend/edms/settings.py`, `settings_api.py`, `urls.py` | Real runtime config |
| Backend auth/search/inbox/dashboard/report logic | `backend/shared/services.py`, `backend/shared/views.py` | Shared service layer |
| Document ingest/index/OCR/dedup logic | `backend/documents/services.py`, `backend/documents/indexing.py`, `backend/documents/tasks.py` | Highest-value backend files |
| PL/BOM/change-control logic | `backend/config_mgmt/services.py`, `views.py` | Core config management logic |
| Work/approval/case logic | `backend/work/services.py`, `views.py` | Work module logic |
| Core domain models | `backend/edms_api/models.py` | Main business models live here |
| Support document-indexing models | `backend/documents/models.py` | OCR entities, crawl jobs, duplicate decisions, etc. |
| Frontend mock/static data | `artifacts/edms/src/lib/mock.ts`, `mockExtended.ts`, `bomData.ts`, `deduplicationMock.ts`, `reporting.ts` | Many pages still depend on these |

Files to distrust on first pass:

- `docs/audits/DEPENDENCY_AND_FLOW_MAP.md`: useful background, but it still points at old frontend route locations
- older ADRs that reference `src/src/routes.ts`: the live app routes are now in `artifacts/edms/src/App.tsx`
- `src/` legacy frontend files: reference only

## 5. Dependencies and Tooling

### 5.1 Workspace / build tooling

- Package manager: `pnpm` only
- Workspace config: `pnpm-workspace.yaml`
- Formatting/linting: Biome + Prettier
- Testing: Vitest for frontend workspace, Django test suite for backend
- Build orchestration: root `package.json` scripts run filtered package builds

Important root facts:

- `package.json` enforces `pnpm`
- workspace packages include `artifacts/*`, `lib/*`, `lib/integrations/*`, `scripts`
- root overrides pin things like `xlsx` and `esbuild`

### 5.2 Frontend stack

Main package: `artifacts/edms/package.json`

Core stack:

- React 19
- React Router 7
- Vite 7
- Tailwind CSS 4
- Radix UI
- TanStack Query
- Axios
- Zustand
- Framer Motion
- Recharts
- `xlsx`
- Lucide icons

Important architectural note:

- TanStack Query is provisioned, but the live app mostly uses custom services and direct `useState/useEffect`
- the generated workspace client in `lib/api-client-react` is not used by the main EDMS frontend
- the main frontend instead uses the handwritten `artifacts/edms/src/services/ApiClient.ts`

### 5.3 Backend stack

From `backend/requirements.txt`:

- Django 5.2
- DRF
- `djangorestframework-simplejwt`
- `django-cors-headers`
- `django-filter`
- `django-celery-beat`
- `django-guardian`
- `django-fsm-2`
- `psycopg`
- Redis
- Celery
- `psutil`
- `watchdog`

Optional OCR stack from `backend/requirements-ocr.txt`:

- `pdfplumber`
- `easyocr`
- `pytesseract`
- `pdf2image`
- `Pillow`

### 5.4 Generated API packages

Codegen pipeline:

`lib/api-spec/openapi.yaml` -> Orval -> `lib/api-client-react/src/generated` and `lib/api-zod/src/generated`

Current reality:

- the live EDMS app does not import `@workspace/api-client-react`
- the live EDMS app does not import `@workspace/api-zod`
- the codegen packages exist as infrastructure, not as the main runtime API layer

### 5.5 Mock API package

`artifacts/api-server/` is a very small Express app.

What it actually exposes:

- `/auth/login/`
- `/auth/logout/`
- `/healthz`

It is not a full document/PL/work backend. The frontend still works in mock mode because many pages use local mock services, not because this Node server implements the full backend.

## 6. Frontend Architecture

### 6.1 Boot sequence

Main entry:

- `artifacts/edms/src/main.tsx`

Boot flow:

1. create React root
2. wrap app in `QueryClientProvider`
3. wrap app in error boundary
4. render `App`

`App.tsx` then wraps the router in:

- `ThemeProvider`
- `AuthProvider`
- `TooltipProvider`
- `ToastProvider`
- `PLDetailDialogProvider`
- `RightPanelProvider`
- `DocTabsProvider`

### 6.2 Auth, session, and token model

Main files:

- `artifacts/edms/src/lib/auth.tsx`
- `artifacts/edms/src/services/ApiClient.ts`

How auth works:

- login goes through `ApiClient.login()`
- backend may return `access`/`refresh`; mock API may return `token`
- `ApiClient` stores:
  - `auth_token` in localStorage
  - `auth_refresh_token` in localStorage
  - `user` in localStorage
- `AuthProvider` stores session info under:
  - `ldo2_session` in sessionStorage
  - `ldo2_session_ts` in sessionStorage
- session timeout is a 30-minute sliding window on the frontend

Role set used by the frontend:

- `admin`
- `supervisor`
- `engineer`
- `reviewer`
- `viewer`

Frontend route group constants:

- `ALL_ROLES`
- `ADMIN_ONLY`
- `ADMIN_SUPERVISOR`
- `ENGINEER_UP`
- `REVIEWER_UP`

Important nuance:

- frontend authorization is simple role-membership gating
- backend authorization is separate and stronger: Django auth + groups + object permissions

### 6.3 Layout shell

Main layout files:

- `components/layout/AppLayout.tsx`
- `Sidebar.tsx`
- `Header.tsx`
- `ProtectedRoute.tsx`
- `RightPanel.tsx`

What the shell does:

- renders the authenticated chrome
- persists sidebar state and last visited path through `PreferencesService`
- tracks document tabs with `DocTabsContext`
- exposes a right-side utility panel via `RightPanelContext`
- filters sidebar entries using the same role checks as route protection

Important banner detail:

- `BannerManagement.tsx` edits `BannerService` data in localStorage
- the actual header banner is currently hard-coded in `Header.tsx`
- so the banner admin page does not control the banner users really see

### 6.4 Contexts

| Context | Purpose |
| --- | --- |
| `ThemeContext` | Theme mode and theme persistence |
| `ToastContext` | In-app toast queue |
| `RightPanelContext` | Contextual side panel content |
| `DocTabsContext` | Multi-document tab strip in the main shell |
| `PLDetailDialogContext` | Open PL detail in modal/dialog flows |

### 6.5 Hooks

| Hook | Purpose | Data source |
| --- | --- | --- |
| `usePLItems` | Load PL items for selectors/pages | `PLService` |
| `usePlLinkableDocuments` | Load documents eligible for PL linking | backend/mapped documents |
| `useDocuments` | Load document list | `DocumentService` mock layer |
| `useWorkRecords` | Load work records | `WorkLedgerService` local layer |
| `useCases` | Load cases | `CaseService` local layer |
| `useDocumentChangeAlerts` | Supervisor review alerts | backend only |
| `useAppInbox` | Notification/workflow inbox | backend with fallback |
| `useAbortOnNavigate` | Abort controller helper for search/navigation | helper |
| `useOverloadProtection` | debouncing/throttling helpers | helper |
| `useFormDraft` | form persistence helper | helper |
| `useSelection` | generic selection state helper | helper |
| `usePauseOnHidden` | pause behavior when tab hidden | helper |
| `useApi` | generic React Query wrapper | present, but not central to the live app |

Small but important state-store detail:

- `artifacts/edms/src/store/useSearchStore.ts` is the main Zustand store in the app
- it persists recent and saved searches
- most other app state is service-driven or page-local, not globally normalized

### 6.6 Frontend services: what is real vs local

#### Backend-first or hybrid services

| Service | What it does | Notes |
| --- | --- | --- |
| `ApiClient.ts` | Handwritten Axios client for `/api` | Main frontend API layer |
| `SearchService.ts` | Unified search UI adapter | Uses backend search, DEV fallback to local |
| `PLService.ts` | PL CRUD and document linking | Uses backend unless mock mode is enabled |
| `InboxService.ts` | Workflow inbox and action execution | Backend first, fallback queue locally |
| `DeduplicationService.ts` | Duplicate group UI model | Backend first, mock fallback |
| `DashboardDataService.ts` | Dashboard data adapter | Mostly mock snapshot, overlays backend stats |
| `DocumentChangeAlertService.ts` | Maps supervisor-review API payloads | Backend response mapper only |

#### Local/localStorage services

| Service | Backing store | What it powers |
| --- | --- | --- |
| `DocumentService.ts` | mock arrays | document hub list behavior |
| `ApprovalService.ts` | `ldo2_approvals` | approvals page and queueing |
| `OcrJobService.ts` | `ldo2_ocr_jobs` | local OCR retry queue |
| `CaseService.ts` | `ldo2_cases` | cases page |
| `WorkLedgerService.ts` | in-memory mock store | work ledger and ledger analytics |
| `BannerService.ts` | `ldo2_banners` | banner admin page only |
| `SystemSettingsService.ts` | `ldo2_system_settings` | settings page only |
| `UserService.ts` | `ldo2_managed_users` | React user admin page only |
| `AlertRuleService.ts` | localStorage | alert rules page |
| `DocumentTemplateService.ts` | localStorage | templates page |
| `BomDraftService.ts` | localStorage | BOM draft products/trees |
| `PLPreviewService.ts` | localStorage | PL preview drafts and revision history |
| `SystemHealthService.ts` | `ldo2_system_backups` | health page backup card data |
| `PreferencesService.ts` | localStorage | UI behavior and per-user preferences |
| `SearchHistoryService.ts` | localStorage | recent searches UI |
| `NavigationHistoryService.ts` | localStorage | recent navigation |
| `DocumentPreviewService.ts` | localStorage | recent preview state |

#### Helper/export services

| Service | Purpose |
| --- | --- |
| `ExportImportService.ts` | CSV/XLSX/PDF/Word export helpers and some imports |
| `DocumentPreviewService.ts` | remember preview-related state |
| `NavigationHistoryService.ts` | cross-page navigation breadcrumbs/history |

### 6.7 Page and route inventory

This is the most important frontend table if you want to understand the app quickly.

| Route | Roles | Page file | Main data source | What it actually does |
| --- | --- | --- | --- | --- |
| `/login` | public | `Login.tsx` | backend login or mock auth | signs user in; shows demo credentials |
| `/` | all | `Dashboard.tsx` | mostly mock via `DashboardDataService` | high-level metrics and quick actions |
| `/search` | all | `SearchExplorer.tsx` | backend search with DEV fallback | cross-entity search, facets, saved searches |
| `/documents` | all | `DocumentHub.tsx` | mock documents | list/filter/export/request approval |
| `/documents/ingest` | all | `DocumentIngestion.tsx` | backend | real ingest form and file upload |
| `/documents/:id` | all | `DocumentDetail.tsx` | mock document + local approvals/OCR | document workspace and actions |
| `/documents/:id/preview` | all | `DocumentPreviewPage.tsx` | backend with mock fallback | preview metadata, OCR entities/assertions, reindex actions |
| `/bom` | engineer+ | `BOMExplorer.tsx` | `bomData.ts` + `BomDraftService` | BOM product explorer |
| `/bom/new` | engineer+ | `BOMCreate.tsx` | PL selector + local draft save | create draft BOM workspace |
| `/bom/:productId` | engineer+ | `BOMProductView.tsx` | local BOM tree data | interactive BOM editor/viewer |
| `/pl` | engineer+ | `PLKnowledgeHub.tsx` | `PLService` | PL list/search/create/link docs |
| `/pl/preview/:draftId` | engineer+ | `PLPreviewPage.tsx` | `PLPreviewService` + `PLService` save | review PL changes before commit |
| `/pl/:id` | engineer+ | `PLDetail.tsx` | `PLService`, doc alerts, linkable docs | deep PL editor/detail page |
| `/ledger` | engineer+ | `WorkLedger.tsx` | `WorkLedgerService` local | create/update/verify work records |
| `/ledger-reports` | admin/supervisor | `LedgerReports.tsx` | local work analytics | charts and export for work records |
| `/cases` | reviewer+ | `Cases.tsx` | `CaseService` local | case list, comments, link docs, close case |
| `/approvals` | reviewer+ | `Approvals.tsx` | `ApprovalService` local | pending/approved/rejected decisions |
| `/profile` | all | `ProfilePage.tsx` | auth context + `PreferencesService` | personal profile and user preferences |
| `/notifications` | all | `NotificationsPage.tsx` | backend inbox + document change alerts | workflow inbox, direct actions |
| `/reports` | admin/supervisor | `Reports.tsx` | local reporting definitions | report catalog and charts |
| `/reports/:reportId` | admin/supervisor | `ReportTablePage.tsx` | local reporting definitions | report table and export |
| `/alerts` | reviewer+ | `AlertRules.tsx` | `AlertRuleService` local | manage notification rules |
| `/templates` | all | `DocumentTemplates.tsx` | `DocumentTemplateService` local | choose metadata templates before ingest |
| `/admin` | admin | `AdminWorkspace.tsx` | mostly static/mock | admin landing page |
| `/admin/initial-run` | admin | `AdminInitialRun.tsx` | backend | source indexing, hash backfill, dedup refresh, OCR backlog |
| `/admin/users` | admin | `UserManagement.tsx` | `UserService` local | local user registry, not Django users |
| `/admin/deduplication` | admin | `DeduplicationConsole.tsx` | backend first | duplicate review console |
| `/ocr` | admin | `OCRMonitor.tsx` | backend first | OCR jobs, retries, fallback queue |
| `/audit` | admin | `AuditLog.tsx` | mock audit dataset | audit UI, not the backend audit endpoint |
| `/health` | admin | `SystemHealth.tsx` | local mock health view | styled operations dashboard, not live backend health |
| `/settings` | admin | `Settings.tsx` | local settings | local preferences only |
| `/banners` | admin | `BannerManagement.tsx` | local banners | banner records, but not wired to live header banner |
| `/design-system` | admin | `DesignSystem.tsx` | static | UI component/token showcase |
| `/restricted` | unauthorized | `RestrictedAccess.tsx` | static | access denied page |
| `*` | any | `not-found.tsx` | static | 404 page |

### 6.8 Frontend state/persistence keys worth knowing

| Key | Store | Meaning |
| --- | --- | --- |
| `auth_token` | localStorage | access token |
| `auth_refresh_token` | localStorage | refresh token |
| `user` | localStorage | serialized user profile |
| `ldo2_session` | sessionStorage | session payload |
| `ldo2_session_ts` | sessionStorage | session heartbeat timestamp |
| `ldo2_approvals` | localStorage | frontend-only approvals |
| `ldo2_ocr_jobs` | localStorage | frontend-only OCR retries |
| `ldo2_cases` | localStorage | frontend-only cases |
| `ldo2_banners` | localStorage | banner records |
| `ldo2_system_settings` | localStorage | admin settings page values |
| `ldo2_managed_users` | localStorage | frontend admin users |
| `ldo2_pl_preview_drafts` | localStorage | PL drafts |
| `ldo2_pl_revision_history` | localStorage | PL revision snapshots |
| `ldo2-search-store` | localStorage | persisted recent/saved search UI state |

## 7. Backend Architecture

### 7.1 App ownership

| Backend app | What it owns |
| --- | --- |
| `edms` | Django project settings and URL mounting |
| `edms_api` | Core domain models, Django admin registration, OCR engine abstraction, throttles |
| `shared` | auth views, search, inbox, workflow actions, dashboard stats, reports, permissions, request context |
| `documents` | ingest workflow, indexing, OCR processing, deduplication, source crawling, initial-run operations |
| `config_mgmt` | PL items, BOM operations, baselines, change requests, change notices, supervisor document reviews |
| `work` | work record service logic, approval service logic, case service logic, export job creation |
| `integrations` | event dispatch helpers, email, webhooks, S3 integration helpers |

Important design quirk:

- the main `Document`, `PlItem`, `WorkRecord`, `Case`, `Approval`, and related business models live in `backend/edms_api/models.py`
- the `documents` app mainly owns support models such as indexed sources, crawl jobs, duplicate decisions, OCR entities/pages, and metadata assertions

### 7.2 Settings and environment

Main files:

- `backend/edms/settings.py`
- `backend/edms/settings_api.py`
- `backend/.env.example`

Key runtime behavior:

- SQLite is the default development database
- PostgreSQL is optional and unlocks the better search engine path
- JWT auth is enabled via SimpleJWT
- object permissions are enabled via Django Guardian
- Celery is configured for OCR, indexing, work, and notification queues
- Redis is used for Celery and cache
- JSON logging is supported
- request correlation and request scope are injected by middleware

Important middleware/security detail:

- `RequestContextMiddleware` extracts `tenant_id` and `plant_id` from verified JWT claims
- spoofable `X-Tenant-ID` and `X-Plant-ID` headers are ignored
- correlation IDs are created and returned on responses

### 7.3 URL surface

Top-level URL mounting:

- `/admin/` -> Django admin
- `/api/` -> legacy alias
- `/api/v1/` -> versioned alias

Both `/api/` and `/api/v1/` currently expose the same app routes.

#### Shared endpoints

From `backend/shared/urls.py`:

- auth login/logout/me/token/refresh
- search
- search history
- inbox
- workflow item action
- report jobs list/detail/retry
- health status
- dashboard stats
- audit log router

#### Document endpoints

From `backend/documents/urls.py`:

- document CRUD router
- document ingest
- document versions
- document OCR entities/assertions/reindex
- OCR jobs and results
- indexed sources
- crawl jobs
- hash backfill jobs
- duplicate groups and decisions
- admin initial-run summary/actions

#### Config-management endpoints

From `backend/config_mgmt/urls.py`:

- PL items
- BOM lines
- PL document links
- supervisor document reviews
- change requests
- change notices
- baselines

#### Work endpoints

From `backend/work/urls.py`:

- work records
- work export jobs
- approvals
- cases

### 7.4 Core domain model map

| Model | File | Purpose |
| --- | --- | --- |
| `Document` | `backend/edms_api/models.py` | main document record |
| `DocumentVersion` | `backend/edms_api/models.py` | uploaded revision/file history |
| `DocumentContentIndex` | `backend/edms_api/models.py` | content fingerprint/index support |
| `PlItem` | `backend/edms_api/models.py` | PL master record |
| `PlDocumentLink` | `backend/edms_api/models.py` | document-to-PL links |
| `PlBomLine` | `backend/edms_api/models.py` | BOM parent/child lines |
| `SupervisorDocumentReview` | `backend/edms_api/models.py` | review record created when linked document revisions change |
| `ChangeRequest` | `backend/edms_api/models.py` | engineering change request |
| `ChangeNotice` | `backend/edms_api/models.py` | engineering change notice |
| `Baseline` / `BaselineItem` | `backend/edms_api/models.py` | released snapshots of PL/BOM/document linkage |
| `WorkRecord` | `backend/edms_api/models.py` | work ledger record |
| `Approval` | `backend/edms_api/models.py` | approval workflow item |
| `Case` | `backend/edms_api/models.py` | issue/case record |
| `OcrJob` | `backend/edms_api/models.py` | OCR processing job |
| `AuditLog` | `backend/edms_api/models.py` | audit trail |
| `IndexedSource` | `backend/documents/models.py` | watched/crawled external source root |
| `IndexedSourceFileState` | `backend/documents/models.py` | per-file source tracking |
| `DuplicateDecision` | `backend/documents/models.py` | dedup review decision record |
| `DocumentOcrPage` | `backend/documents/models.py` | page-level OCR text |
| `DocumentOcrEntity` | `backend/documents/models.py` | extracted OCR entities |
| `DocumentMetadataAssertion` | `backend/documents/models.py` | approved/rejected metadata assertions |
| `DomainEvent` | `backend/shared/models.py` | domain event/outbox style record |
| `ReportJob` | `backend/shared/models.py` | general report generation job |
| `WorkRecordExportJob` | `backend/work/models.py` | work ledger export job |

### 7.5 RBAC and permissions

There is no single centralized RBAC policy engine. Access control is split across layers.

#### Backend RBAC

Files:

- `backend/shared/permissions.py`
- `backend/shared/views.py`
- `backend/work/services.py`
- `backend/config_mgmt/services.py`
- `backend/documents/services.py`

How it works:

- authentication uses Django users
- roles are effectively derived from Django groups
- `resolve_user_role()` in shared views returns:
  - explicit `user.role` if present
  - otherwise first group name
  - otherwise `admin` for staff/superuser
  - otherwise `viewer`
- object-level access is enforced via Django Guardian
- `PermissionService.scope_queryset()` filters querysets by object permission
- creators are granted default object permissions on create
- legacy rows can be repaired with `backfill_object_permissions`

#### Frontend RBAC

Files:

- `artifacts/edms/src/App.tsx`
- `artifacts/edms/src/lib/auth.tsx`
- `components/layout/ProtectedRoute.tsx`
- `components/layout/Sidebar.tsx`

How it works:

- each route declares allowed roles
- sidebar items are filtered by role
- unauthorized route access redirects to `/restricted`

Important limitation:

- the React admin/user/settings pages do not manage real Django roles or Guardian permissions
- they mostly edit frontend-local records

### 7.6 Backend service layer: where the business logic actually lives

#### Shared services

`backend/shared/services.py`

- `AuditService`: writes audit entries
- `EventService`: writes `DomainEvent` records
- `ReportJobService`: creates/retries report jobs
- `WorkflowActionService`: one action router for inbox items
- `SearchService`: unified cross-entity search
- `DashboardService`: aggregate counts for dashboard
- `InboxService`: builds inbox items from approvals, supervisor reviews, dedup decisions, crawl/hash failures, change requests, change notices

Important search fact:

- search engine reports `postgres_full_text` when PostgreSQL is active
- otherwise it falls back to a local/SQLite-style search path
- search history is derived from `AuditLog` entries where action is `SEARCH`

#### Document services

Main files:

- `backend/documents/services.py`
- `backend/documents/indexing.py`
- `backend/documents/tasks.py`

Key service classes:

- `DocumentService`
  - list/query documents with filters
  - create documents
  - ingest uploaded files
  - create new document versions
- `DocumentMetadataService`
  - approve/reject entities
  - create assertions
  - promote entities into assertions
  - reindex metadata
- `IndexedSourceService`
  - create/update indexed source definitions
  - sync source schedules
- `CrawlJobService`
  - crawl watched/shared roots and create/update document records
- `HashBackfillJobService`
  - recompute missing fingerprints and hashes
- `InitialRunService`
  - summary counts
  - dedup backfill
  - OCR backlog queue
- `DuplicateDecisionService`
  - group duplicate families
  - apply merge/ignore decisions
- `DocumentOcrProcessingService`
  - execute OCR job
  - split page payloads
  - extract regex entities
  - update page/entity tables
  - reindex document afterward
- `OcrApplicationService`
  - enqueue OCR jobs and fetch OCR result payloads

#### Config-management services

`backend/config_mgmt/services.py`

- `PlItemService`
  - PL queryset/search
  - set/link/unlink documents
  - where-used and BOM tree
  - baseline lookup
- `BomService`
  - add/update/delete/move/replace/reorder BOM lines
  - build current BOM/document snapshot
  - compare/impact helpers
- `BaselineService`
  - capture released snapshot of PL, BOM lines, and linked docs
  - compare baselines
  - release new baseline and supersede old one
- `ChangeRequestService`
  - draft -> submit -> approve/reject -> implement
- `ChangeNoticeService`
  - issue -> approve -> release -> close
- `SupervisorDocumentReviewService`
  - create/update review tasks when linked document revisions change

Very important business rule:

- linking a document to a PL can create or refresh a `SupervisorDocumentReview`
- releasing a baseline snapshots:
  - the PL record
  - all BOM lines
  - all linked documents

#### Work services

`backend/work/services.py`

- `WorkRecordService`
  - list/create/update work records
  - normalize legacy/canonical statuses
  - create export jobs
- `ApprovalService`
  - list/query approvals
  - approve/reject with concurrency-safe transitions
- `CaseService`
  - list/query cases
  - close cases with resolution

Common work categories seen in the frontend/workflow layer:

- `GENERAL`
- `DRAWING`
- `SPECIFICATION`
- `TENDER`
- `SHOP`
- `IC`
- `AMENDMENT`
- `VENDOR`
- `EXTERNAL`
- `FAILURE`
- `INSPECTION`

### 7.7 Search, OCR, indexing, and deduplication logic

#### Search

Main backend file:

- `backend/shared/services.py`

Search covers:

- documents
- PL items
- work records
- cases
- supporting workflow/change artifacts in backend result payloads

Document filters include:

- duplicates include/exclude/only
- source system
- class/category
- hash status
- linked/unlinked PL
- status
- date window

#### OCR

Main files:

- `backend/edms_api/ocr_service.py`
- `backend/documents/services.py`
- `backend/documents/tasks.py`

OCR engine strategy:

- `PlainTextEngine` for text-like files
- `PdfTextEngine` for normal PDFs
- `EasyOcrEngine` for scanned/image OCR
- `TesseractEngine` as heavier fallback

On OCR completion:

1. document OCR page rows are stored
2. document OCR entity rows are stored
3. document search metadata is updated
4. document is reindexed

#### Indexing and deduplication

Main file:

- `backend/documents/indexing.py`

Important components:

- regex pattern registry for invoices, PL numbers, document refs, drawing refs, tender refs, e-office refs, loco refs
- sparse fingerprinting from selected file segments
- full SHA-256 for higher-confidence identity
- document family key construction
- duplicate group key generation
- duplicate master/duplicate refresh logic

This is one of the highest-value backend files in the whole repo.

### 7.8 Async tasks and file watchers

#### Celery tasks

From `backend/documents/tasks.py`:

- `run_indexed_source_crawl`
- `queue_indexed_source_crawl`
- `run_hash_backfill_job`
- `queue_hash_backfill_job`
- `index_single_document`
- `run_ocr_job`
- `run_initial_dedup_pass`
- `queue_pending_ocr_jobs`

#### File-system watching

Main file:

- `backend/documents/watchers.py`

How it works:

- `watchdog` watches active indexed sources
- file created/modified/moved/deleted events trigger a crawl job
- if a crawl is already queued/running for that source, it skips queueing another one

### 7.9 Django admin and management commands

#### Django admin

Registered backend models include:

- Document
- DocumentVersion
- WorkRecord
- PlItem
- PlDocumentLink
- PlBomLine
- ChangeRequest
- ChangeNotice
- Baseline
- BaselineItem
- Case
- OcrJob
- Approval
- AuditLog
- DomainEvent
- ReportJob
- WorkRecordExportJob

Notable admin behavior:

- `AuditLogAdmin` blocks add permission
- delete is only allowed for superusers

#### Management commands

High-value commands:

- `python manage.py seed_demo_users`
  - creates the demo users shown on the frontend login page
- `python manage.py backfill_object_permissions`
  - restores Guardian perms for legacy records
- `python manage.py index_shared_documents <root_path>`
  - creates/updates an indexed source and runs crawl/index
- `python manage.py reindex_document_search`
  - rebuilds search and hash metadata
- `python manage.py watch_indexed_sources`
  - starts file watchers for active roots

## 8. End-to-End Workflow Logic

### 8.1 Login flow

Frontend:

1. user submits credentials on `/login`
2. `useAuth.login()` calls `ApiClient.login()`
3. `ApiClient` stores tokens
4. `AuthProvider` stores session user
5. `UserService.ensureSessionUser()` mirrors the signed-in user into the frontend-local managed-user store

Backend:

1. `LoginView` authenticates Django user
2. SimpleJWT issues tokens
3. audit log writes `LOGIN`
4. frontend receives serialized user with derived role

### 8.2 Document ingest flow

Main frontend page:

- `DocumentIngestion.tsx`

Main backend logic:

- `DocumentViewSet.ingest`
- `DocumentService.ingest`

Flow:

1. user uploads file and metadata
2. backend creates `Document`
3. status starts as `"In Review"`
4. ingest metadata is stored into `search_metadata.ingest`
5. indexing is queued or run inline
6. if requested, OCR job is queued
7. if linked to a PL, the PL link is created and supervisor review may be created
8. audit entry and domain event are emitted

### 8.3 OCR + metadata + preview flow

Flow:

1. OCR job starts through `OcrApplicationService.start_job()`
2. Celery task or inline processing calls `DocumentOcrProcessingService.process_job()`
3. OCR text is extracted by the engine chain
4. page payloads and regex entities are written
5. document OCR status and confidence are updated
6. document is reindexed
7. `DocumentPreviewPage.tsx` can then show:
   - assertions
   - entities
   - reindex action
   - metadata promotion/approval flows

### 8.4 Search flow

Frontend:

- `SearchExplorer.tsx`
- `SearchService.searchAll()`

Backend:

- `SearchView`
- `SearchService.search()`

Flow:

1. user types query
2. UI debounces and supports abort on navigation
3. backend search runs across documents, PL, work, cases
4. search action is audited
5. search history page reads prior `SEARCH` audit events

### 8.5 PL, document-link, and supervisor-review flow

Flow:

1. user edits or creates a PL item via `PLService`
2. `PLPreviewService` stores a draft preview locally
3. `PLPreviewPage` shows field-level change log before save
4. on save, `PLService` calls backend PL endpoints unless mock mode is enabled
5. linking documents to a PL triggers `SupervisorDocumentReviewService.create_or_refresh_for_link()`
6. reviewers see those items via:
   - backend inbox
   - `useDocumentChangeAlerts()`
   - `NotificationsPage`
   - PL detail cross-reference views

### 8.6 BOM and baseline flow

Current reality has two layers:

- frontend BOM editor pages use local `bomData.ts` and `BomDraftService`
- backend has real `PlBomLine` and `Baseline` logic

So the architecture supports a real backend BOM, but the primary BOM UI pages are still local/draft-oriented.

Backend baseline release flow:

1. gather current PL snapshot
2. capture PL item, BOM lines, and linked documents into `BaselineItem`
3. release new baseline
4. supersede previous released baseline
5. optionally advance change request/change notice workflow

### 8.7 Approval, case, and inbox flow

Backend workflow action router:

- `WorkflowActionService.act()`

It understands:

- `approval:*`
- `supervisor-review:*`
- `dedup:*`
- `change-request:*`
- `change-notice:*`

Important frontend reality:

- `/notifications` can execute real backend workflow actions
- `/approvals` page itself is frontend-local
- `/cases` page itself is frontend-local

So the inbox is more real than some of the dedicated pages.

### 8.8 Initial-run and source-indexing flow

Main backend pieces:

- `InitialRunService`
- `IndexedSourceService`
- `CrawlJobService`
- `HashBackfillJobService`
- `watch_indexed_sources`

Flow:

1. define indexed sources (shared roots)
2. crawl source files
3. create/update tracked file states
4. create/update document records
5. compute fingerprints/hashes
6. build dedup groups
7. queue pending OCR

The React page `/admin/initial-run` is one of the clearest backend-integrated admin pages in the frontend.

## 9. How To Run The Current Repo Correctly

### 9.1 Backend

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
pip install -r requirements-ocr.txt
Copy-Item .env.example .env
python manage.py migrate
python manage.py seed_demo_users
python -m config.waitress_runner
```

If you want async flows to behave like production:

- run Redis
- run Celery worker(s)
- optionally run `python manage.py watch_indexed_sources`

### 9.2 Frontend

```powershell
pnpm install
pnpm run dev:edms
```

Important default behavior:

- `artifacts/edms/.env`
- `artifacts/edms/.env.preview`
- `artifacts/edms/.env.production`

all currently set `VITE_ENABLE_DEV_MOCK_API=true`.

That means the checked-in frontend defaults to mock/dev behavior.

If you want the frontend to use the Django backend, override at least:

```env
VITE_ENABLE_DEV_MOCK_API=false
VITE_API_PROXY_TARGET=http://127.0.0.1:8765
```

### 9.3 Mock API

If you run:

```powershell
pnpm run dev:api-server
```

you only get mock auth/health endpoints. That is useful for UI development, but it is not a substitute for the Django backend.

## 10. If You Rebuilt This System From Scratch

Recommended implementation order:

1. Define the domain model first.
   - documents
   - document versions
   - PL items
   - PL-document links
   - BOM lines
   - work records
   - approvals
   - cases
   - audit log

2. Build the backend before the full frontend.
   - auth + JWT
   - object permissions
   - document CRUD + ingest
   - PL CRUD + document linking
   - work/approval/case CRUD
   - audit log + domain events

3. Add search/indexing next.
   - extracted text
   - metadata assertions
   - pattern extraction
   - PostgreSQL full-text path
   - fallback search path

4. Add OCR and dedup as asynchronous infrastructure.
   - OCR job model
   - OCR page/entity tables
   - fingerprint and full hash logic
   - duplicate grouping and decision records

5. Add config-management workflows.
   - BOM lines
   - baselines
   - change requests
   - change notices
   - supervisor document reviews

6. Build the frontend shell and auth gates.
   - App layout
   - role-aware sidebar
   - session handling
   - protected routing

7. Build backend-backed pages first.
   - login
   - document ingest
   - document preview/evidence
   - search
   - PL hub/detail
   - notifications/inbox
   - initial run
   - dedup console
   - OCR monitor

8. Treat local-only pages as temporary scaffolding unless you intentionally want an offline/demo mode.
   - approvals page
   - cases page
   - work ledger
   - settings
   - banner management
   - user management
   - audit UI
   - health UI

## 11. Current Gaps, Drift, and Important Gotchas

These are the highest-signal truths you should remember.

### 11.1 The frontend is intentionally hybrid

- document ingest is real
- search is real
- supervisor document reviews are real
- dedup console is real-ish/backend-first
- OCR monitor is backend-first
- many other business pages are still local/mock

### 11.2 The React admin pages are not the same as backend admin

- `/admin/users` edits `UserService` localStorage, not Django users
- `/settings` edits local settings, not backend settings
- `/audit` shows mock audit data, not backend `AuditLog`
- `/health` shows a styled mock operations view, not backend `/api/health/status/`

### 11.3 Banner management is not wired to the live banner

- `BannerService` powers the banner admin page
- `Header.tsx` shows a hard-coded maintenance banner instead

### 11.4 Mock mode is the default in checked-in frontend env files

That is convenient for demos, but dangerous if you assume you are testing the real backend.

### 11.5 Mock role data is inconsistent across layers

There is role drift between:

- frontend login labels
- mock API users in `artifacts/api-server/src/routes/auth.ts`
- Django demo users in `backend/shared/management/commands/seed_demo_users.py`

In particular, the mock API swaps the `m.chen` and `s.patel` roles relative to the backend seed command/login labels.

### 11.6 Generated API packages are not the live runtime contract

- `lib/api-client-react` exists
- `lib/api-zod` exists
- but the real frontend uses the handwritten `ApiClient.ts` and local schemas

### 11.7 `documents` app does not own the main `Document` model

This is easy to misread. The core `Document` model is in `edms_api.models`, while the `documents` app owns indexing/OCR/dedup support logic.

## 12. Best Reading Order If You Want To Learn The Codebase Fast

Read in this order:

1. `README.md`
2. `artifacts/edms/src/App.tsx`
3. `artifacts/edms/src/lib/auth.tsx`
4. `artifacts/edms/src/components/layout/AppLayout.tsx`
5. `artifacts/edms/src/services/ApiClient.ts`
6. `artifacts/edms/src/pages/SearchExplorer.tsx`
7. `artifacts/edms/src/pages/DocumentIngestion.tsx`
8. `artifacts/edms/src/pages/DocumentPreviewPage.tsx`
9. `artifacts/edms/src/pages/PLKnowledgeHub.tsx`
10. `artifacts/edms/src/pages/PLDetail.tsx`
11. `backend/edms/settings.py`
12. `backend/edms/urls.py`
13. `backend/shared/views.py`
14. `backend/shared/services.py`
15. `backend/documents/views.py`
16. `backend/documents/services.py`
17. `backend/documents/indexing.py`
18. `backend/documents/tasks.py`
19. `backend/config_mgmt/views.py`
20. `backend/config_mgmt/services.py`
21. `backend/work/views.py`
22. `backend/work/services.py`
23. `backend/edms_api/models.py`
24. `backend/documents/models.py`

If you only have time for ten files, these are the ten:

1. `artifacts/edms/src/App.tsx`
2. `artifacts/edms/src/services/ApiClient.ts`
3. `artifacts/edms/src/lib/auth.tsx`
4. `artifacts/edms/src/pages/SearchExplorer.tsx`
5. `artifacts/edms/src/pages/DocumentIngestion.tsx`
6. `artifacts/edms/src/pages/PLDetail.tsx`
7. `backend/shared/services.py`
8. `backend/documents/services.py`
9. `backend/documents/indexing.py`
10. `backend/config_mgmt/services.py`

## 13. Short Summary To Keep In Your Head

If you remember nothing else, remember this:

- the true app is `artifacts/edms` + `backend`
- the live frontend is hybrid, not fully backend-bound
- auth/search/ingest/PL alerts/dedup/OCR have real backend logic
- work ledger, approvals, cases, many admin settings pages are still frontend-local
- backend business logic lives in service files, not mostly in views
- `edms_api.models` holds the main business entities
- `documents/indexing.py` is the heart of OCR/search/dedup intelligence
- there are two admin surfaces: Django admin and React admin workspace
