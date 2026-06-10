# LDO-2 Codebase Knowledge Graph & Context

**Generated:** 2026-04-20
**Total Files:** 777 files (~363k words)

## Project Overview

LDO-2 is an Enterprise Document Management System (EDMS) with:
- **Frontend:** React 19 + Vite 7 + TailwindCSS 4 + Radix UI
- **Backend:** Django 5.2 + Django REST Framework + Celery 5.5.3 + Redis
- **Architecture:** Monorepo with pnpm workspaces

## Directory Structure

```
LDO-2-local/
├── artifacts/
│   ├── edms/                    # Main EDMS frontend application
│   │   ├── src/
│   │   │   ├── components/      # React components
│   │   │   │   ├── layout/      # Layout components (AppLayout, Header, Sidebar)
│   │   │   │   ├── ui/          # Radix UI components (50+ components)
│   │   │   │   └── documents/   # Document-specific components
│   │   │   ├── pages/           # Page components (40+ pages)
│   │   │   ├── services/        # API service layer (15+ services)
│   │   │   ├── hooks/           # React hooks (12+ custom hooks)
│   │   │   ├── contexts/        # React contexts (5 contexts)
│   │   │   └── lib/             # Utilities and helpers
│   │   └── public/              # Static assets
│   ├── api-server/              # Mock API server for development
│   └── mockup-sandbox/          # UI mockup testing environment
├── backend/
│   ├── edms/                    # Django project settings
│   ├── edms_api/                # Main API app (models, views, serializers)
│   ├── documents/               # Document management app
│   ├── work/                    # Work ledger app
│   ├── config_mgmt/             # Configuration management
│   ├── integrations/            # External integrations (S3, email, webhooks)
│   ├── shared/                  # Shared utilities and middleware
│   └── services/                # Business logic services
├── lib/
│   ├── api-client-react/        # React API client (Orval generated)
│   ├── api-zod/                 # Zod schemas for API validation
│   └── api-spec/                # OpenAPI specifications
├── src/                         # Legacy frontend (being migrated)
└── docs/                        # Documentation and ADRs

```

## Core Components

### Frontend Architecture

#### 1. Layout System
- **AppLayout.tsx** - Main application shell with sidebar, header, tabs
- **Header.tsx** - Top navigation with search, notifications, user menu
- **Sidebar.tsx** - Left navigation menu
- **RightPanel.tsx** - Contextual right panel for details

#### 2. UI Component Library (50+ components)
Based on Radix UI primitives:
- Form controls: Input, Select, Checkbox, Radio, Switch, Textarea
- Data display: Table, DataTable, Card, Badge, Avatar
- Overlays: Dialog, Sheet, Popover, Tooltip, DropdownMenu
- Navigation: Tabs, Breadcrumb, Pagination
- Feedback: Toast, Alert, Spinner, LoadingState, ErrorState
- Custom: CommandPalette, RightClickPalette, DatePicker

#### 3. Page Components (40+ pages)
**Document Management:**
- DocumentHub - Main document listing
- DocumentDetail - Document viewer with metadata
- DocumentPreviewPage - Full document preview
- DocumentIngestion - Bulk document upload
- DocumentTemplates - Template management

**Product Lifecycle (PL):**
- PLKnowledgeHub - PL listing and search
- PLDetail - PL details with linked documents
- PLPreviewPage - PL preview

**Bill of Materials (BOM):**
- BOMExplorer - BOM navigation
- BOMCreate - Create new BOMs
- BOMProductView - Product BOM details

**Work Management:**
- WorkLedger - Work record tracking
- Cases - Case management
- Approvals - Approval workflows

**Admin:**
- UserManagement - User administration
- Settings - System settings
- AuditLog - Audit trail
- SystemHealth - System monitoring
- AlertRules - Alert configuration
- BannerManagement - System banners

**Other:**
- Dashboard - Main dashboard
- Reports - Reporting interface
- SearchExplorer - Advanced search
- DeduplicationConsole - Duplicate detection
- OCRMonitor - OCR processing status

#### 4. Services Layer (15+ services)
Type-safe API clients:
- DocumentService - Document CRUD operations
- PLService - Product lifecycle operations
- CaseService - Case management
- WorkLedgerService - Work record operations
- SearchService - Full-text search
- UserService - User management
- BomDraftService - BOM operations
- DocumentTemplateService - Template operations
- DeduplicationService - Duplicate detection
- InboxService - Notification inbox
- PreferencesService - User preferences
- SystemSettingsService - System configuration

#### 5. Custom Hooks (12+ hooks)
- useDocuments - Document data fetching
- useCases - Case data management
- usePLItems - PL data fetching
- useWorkRecords - Work record operations
- useApi - Generic API hook with error handling
- useSelection - Multi-select state management
- useFormDraft - Form draft persistence
- useOverloadProtection - API rate limiting
- useAbortOnNavigate - Request cancellation
- usePauseOnHidden - Pause polling when hidden

#### 6. Contexts (5 contexts)
- ThemeContext - Dark/light theme
- ToastContext - Toast notifications
- DocTabsContext - Document tab management
- RightPanelContext - Right panel state
- PLDetailDialogContext - PL detail dialog state

### Backend Architecture

#### 1. Django Apps

**edms_api** - Main API app
- Models: Document, ProductLifecycle, WorkRecord, Case, Baseline, AuditLog
- Views: RESTful API endpoints
- Serializers: DRF serializers for all models
- Tasks: Celery tasks for async operations
- OCR: OCR processing with Tesseract

**documents** - Document management
- Models: DuplicateDecision, DocumentOCRPage, DocumentOCREntity, IndexedSourceFileState
- Indexing: Full-text search indexing
- Watchers: File system watchers for auto-indexing
- Tasks: Background document processing
- Signals: Document lifecycle hooks

**work** - Work ledger
- Models: WorkRecord, WorkType
- Services: Work record business logic
- Views: Work record API endpoints

**config_mgmt** - Configuration management
- Services: BOM services, configuration validation
- Tests: Comprehensive test suite

**integrations** - External integrations
- S3: AWS S3 file storage
- Email: Email notifications
- Webhooks: Webhook handlers

**shared** - Shared utilities
- Middleware: Request logging, error handling
- Permissions: Custom permission classes
- Pagination: Custom pagination
- Cache: Redis caching utilities
- Logging: Structured logging

#### 2. Services Layer
- batch_processor.py - Batch operations
- bom.py - BOM business logic
- export_service.py - Data export
- search_indexing.py - Search index management

#### 3. Celery Tasks
- Document OCR processing
- Search index updates
- File system watching
- Batch operations
- Email notifications

### API Architecture

#### 1. OpenAPI Specifications
- Located in `lib/api-spec/`
- Defines all API endpoints, request/response schemas
- Used to generate type-safe clients

#### 2. Code Generation
- **Orval** - Generates React Query hooks from OpenAPI
- **Zod** - Generates Zod schemas for runtime validation
- Output: `lib/api-client-react/` and `lib/api-zod/`

#### 3. API Versioning
- `/api/v1/` - Current API version
- Legacy endpoints in `/api/legacy/`

## Key Technologies

### Frontend
- **React 19** - UI framework
- **Vite 7** - Build tool
- **TailwindCSS 4** - Styling
- **Radix UI** - Accessible component primitives
- **React Router 7** - Routing
- **React Query** - Data fetching
- **Zod** - Schema validation
- **Lucide React** - Icons

### Backend
- **Django 5.2** - Web framework
- **Django REST Framework** - API framework
- **Celery 5.5.3** - Task queue
- **Redis** - Cache and message broker
- **PostgreSQL** - Database
- **Tesseract** - OCR engine
- **Waitress** - WSGI server

### Development
- **pnpm** - Package manager
- **Biome** - Linter and formatter
- **Vitest** - Testing framework
- **Orval** - API client generator

## Data Flow

### Document Upload Flow
1. User uploads document via DocumentIngestion page
2. Frontend calls DocumentService.uploadDocument()
3. Backend creates Document model instance
4. Celery task processes OCR if needed
5. Document indexed for full-text search
6. Notifications sent to relevant users
7. Frontend updates via React Query cache

### Search Flow
1. User enters search query in SearchExplorer
2. Frontend calls SearchService.search()
3. Backend queries PostgreSQL full-text search
4. Results ranked and filtered
5. Frontend displays results with highlighting

### Work Record Flow
1. User creates work record in WorkLedger
2. Frontend calls WorkLedgerService.createWorkRecord()
3. Backend validates and creates WorkRecord
4. Linked to ProductLifecycle if specified
5. Audit log entry created
6. Frontend updates work ledger list

## Key Features

### 1. Document Management
- Upload, view, edit, delete documents
- OCR processing for scanned documents
- Full-text search across all documents
- Document versioning and history
- Document templates
- Bulk operations
- Duplicate detection

### 2. Product Lifecycle Management
- Track product lifecycles
- Link documents to PLs
- PL search and filtering
- PL preview and details

### 3. Bill of Materials
- Create and manage BOMs
- Product hierarchy navigation
- BOM validation

### 4. Work Ledger
- Track work records
- Link to PLs and documents
- Work type categorization
- Status tracking

### 5. Case Management
- Create and track cases
- Link documents and PLs
- Case status workflow
- Operator notes

### 6. Search & Discovery
- Full-text search
- Advanced filtering
- Search history
- Faceted search

### 7. Admin & Configuration
- User management
- Role-based permissions
- System settings
- Alert rules
- Audit logging
- System health monitoring

## Development Workflow

### Frontend Development
```bash
pnpm install                    # Install dependencies
pnpm run dev:edms              # Start dev server (port 5173)
pnpm run dev:api-server        # Start mock API (port 3001)
pnpm run build:fast            # Parallel build
pnpm run build:strict          # Typecheck + build
pnpm biome:check               # Lint and format check
pnpm biome:fix                 # Auto-fix issues
pnpm test                      # Run tests
```

### Backend Development
```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver     # Dev server (port 8000)
python -m config.waitress_runner  # Production server (port 8765)
celery -A edms worker          # Start Celery worker
redis-server                   # Start Redis
```

## Testing

### Frontend Tests
- Unit tests with Vitest
- Component tests with React Testing Library
- Located in `src/test/` and `artifacts/edms/src/`

### Backend Tests
- Django test suite
- Located in `backend/*/tests/`
- Run with `python manage.py test`

### Load Tests
- Locust load testing
- Located in `backend/loadtests/`
- Run with `locust -f locustfile.py`

## Code Quality

### Current Status (2026-04-20)
- **Errors:** 186 (down from 633 - 70.6% reduction)
- **Warnings:** 93
- **Files:** 777 files analyzed

### Recent Improvements
- ✅ Fixed 447 errors across 85+ files
- ✅ Converted all UI components to semantic HTML
- ✅ Fixed 70+ accessibility label issues
- ✅ Improved button type attributes
- ✅ Removed unused imports and variables
- ✅ Consistent code formatting

### Remaining Issues
- 66 label without control errors
- 43 static element interactions (mostly modal patterns)
- 51 keyboard event handlers
- 11 semantic element issues
- 69 TypeScript any types (warnings)

## Architecture Decisions

See `docs/adr/` for detailed Architecture Decision Records:
- **0001** - Django REST over Node.js
- **0002** - React Router over state-based navigation
- **0003** - PgBouncer connection pooling

## Documentation

- **CLAUDE.md** - Repository guide for AI assistants
- **README.md** - Project overview
- **docs/audits/** - Audit reports and analysis
- **backend/*/README.md** - App-specific documentation
- **artifacts/edms/*.md** - Frontend guides

## Deployment

See `docs/audits/DEPLOYMENT.md` and `docs/audits/PHASE_9_DEPLOYMENT_READINESS_AUDIT.md` for deployment instructions.

## Performance

- Build time: ~30s (parallel build)
- Bundle size: Optimized with code splitting
- API response time: <200ms average
- Load test results: See `docs/audits/PHASE_7_LOAD_TEST_REPORT.md`

## Security

- CSRF protection enabled
- JWT authentication
- Role-based access control
- Input validation with Zod
- SQL injection protection (Django ORM)
- XSS protection (React escaping)
- See `docs/audits/PHASE_3_SECURITY_AUDIT.md`

## Future Enhancements

- Complete migration from legacy `src/` to `artifacts/edms/`
- Expand test coverage
- Implement real-time updates with WebSockets
- Add more comprehensive analytics
- Improve mobile responsiveness
- Add offline support with service workers

---

**Last Updated:** 2026-04-20
**Maintainer:** Development Team
**Status:** Active Development
