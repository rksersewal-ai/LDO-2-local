# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

LDO-2 is a monorepo for an EDMS (Engineering Document Management System) web application with a Django REST backend and React/Vite frontend. The system manages documents, BOMs (Bill of Materials), work records, and approvals with OCR capabilities and background processing.

## Architecture

### Three-tier structure

1. **Frontend** (`artifacts/edms/`) — Production React 19 + Vite 7 + TailwindCSS 4 + Radix UI application
2. **Backend** (`backend/`) — Django 5.2 + DRF + Celery + Redis for async tasks
3. **Shared libraries** (`lib/`) — API contract packages shared between frontend and backend

### Backend Django apps

- `documents` — Document upload, OCR, deduplication, metadata, search indexing
- `config_mgmt` — BOM/PL configuration management, revision tracking
- `work` — Work records, approvals, export jobs
- `shared` — Cross-cutting utilities, middleware, health checks
- `edms_api` — API views and serializers
- `integrations` — External system integrations

### Workspace packages

- `artifacts/edms/` — Production frontend (primary deployment target)
- `artifacts/api-server/` — Lightweight Node mock API for local UI development without Django
- `artifacts/mockup-sandbox/` — Isolated UI sandbox for design work
- `lib/api-spec/` — OpenAPI spec and Orval codegen config
- `lib/api-zod/` — Zod schemas for API validation
- `lib/api-client-react/` — React Query hooks generated from API spec
- `src/` — Legacy frontend sandbox (retained for reference, not primary deployment)

## Development Commands

### Frontend

```bash
# Install dependencies (required first)
pnpm install

# Run production frontend (port 5173 by default)
pnpm run dev:edms

# Run mock API server (port 8420)
pnpm run dev:api-server

# Run UI sandbox
pnpm run dev:mockup-sandbox

# Build production frontend
pnpm run build:edms

# Build all artifacts (parallel)
pnpm run build:fast

# Typecheck + build
pnpm run build:strict

# Typecheck workspace
pnpm run typecheck

# Typecheck specific package
pnpm run typecheck:edms
pnpm run typecheck:api-server

# Format code
pnpm run format

# Lint frontend
pnpm run lint:frontend

# Run tests
pnpm run test
pnpm run test:watch
pnpm run test:coverage
```

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt
pip install -r requirements-ocr.txt  # Optional: for image OCR

# Setup database
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Run backend server (Waitress on 0.0.0.0:8765)
python -m config.waitress_runner

# Django shell
python manage.py shell

# Check migrations
python manage.py showmigrations

# Lint backend
python -m ruff check backend
```

### Environment Configuration

Backend requires `.env` file in `backend/` directory:

```bash
# Copy example
cp backend/.env.example backend/.env

# Key variables:
# - DJANGO_SECRET_KEY (required)
# - DJANGO_ALLOWED_HOSTS (comma-separated)
# - EDMS_ALLOWED_IP_RANGES (LAN security, e.g., 192.168.0.0/16)
# - EDMS_RUNTIME_PORT (default: 8765)
# - EDMS_DB_ENGINE (postgresql or unset for sqlite)
# - CORS_ALLOWED_ORIGINS (frontend URL, e.g., http://localhost:5173)
```

Frontend uses Vite env vars in `artifacts/edms/.env.production`:

```bash
# VITE_API_PROXY_TARGET — backend URL (default: http://127.0.0.1:8420)
# VITE_ENABLE_DEV_MOCK_API — use mock API instead of proxy (true/false)
# PORT — dev server port (default: 4173)
```

## Request Flow

1. **Auth**: Frontend calls `/api/auth/login/` → JWT tokens → Bearer auth for subsequent requests
2. **Document upload**: POST to `/api/documents/` → metadata persisted → Celery task for OCR/dedup
3. **BOM/PL**: `/api/config-mgmt/` endpoints coordinate linked documents and revisions
4. **Work records**: `/api/work/` endpoints for approvals and export jobs
5. **Health check**: `/api/health/status/` for monitoring

## API Proxy Configuration

The frontend Vite dev server proxies `/api` requests to the backend:

- Default target: `http://127.0.0.1:8420` (mock API server)
- Override with `VITE_API_PROXY_TARGET=http://127.0.0.1:8765` to use Django backend
- Or set `VITE_ENABLE_DEV_MOCK_API=true` to use built-in Vite mock API middleware

## Database

- **Development**: SQLite (default, `backend/db.sqlite3`)
- **Production**: PostgreSQL 18+ recommended
- Set `EDMS_DB_ENGINE=postgresql` and configure `POSTGRES_*` env vars

## Background Processing

- **Celery** workers handle OCR, deduplication, search indexing
- **Redis** as message broker and cache
- Tasks defined in `backend/documents/tasks.py`

## Testing Strategy

- Frontend: Vitest + Testing Library (`artifacts/edms/vitest.config.ts`)
- Backend: Django test suite (`python manage.py test`)
- Integration tests documented in `docs/audits/INTEGRATION_TEST_SUMMARY.md`

## Build Optimization

- Frontend uses manual chunk splitting for React, Radix UI, motion, and charts
- pnpm workspace with catalog for shared dependency versions
- Parallel builds via `pnpm -r --workspace-concurrency=Infinity`

## Security Notes

- LAN IP filtering via `EDMS_ALLOWED_IP_RANGES` middleware
- CORS configured per environment
- JWT tokens with refresh mechanism
- Django Guardian for object-level permissions

## Documentation

- `backend/LOCAL_SETUP.md` — Detailed backend setup guide
- `backend/OCR_SETUP.md` — Tesseract OCR configuration
- `docs/adr/` — Architecture Decision Records
- `docs/audits/` — Historical audit reports (reference only, may be outdated)
- `docs/audits/DEPENDENCY_AND_FLOW_MAP.md` — Comprehensive dependency map

## Important Notes

- Use `pnpm` exclusively (enforced by preinstall hook)
- The root `src/` directory is legacy; primary frontend is `artifacts/edms/`
- Backend listens on port 8765 by default (Waitress), not Django dev server
- Frontend dev server runs on port 5173 (edms) or 8420 (api-server)
- Always run migrations after pulling backend changes
- OCR requires Tesseract installed separately (optional for PDF text extraction)
