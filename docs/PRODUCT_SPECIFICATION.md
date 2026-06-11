# LDO-2 EDMS v3 — Complete Product Specification

**Version:** 3.0  
**Date:** June 2026  
**Stack:** Next.js 15 + shadcn/UI + PostgreSQL + Redis  
**Target:** Production-grade Engineering Document Intelligence Platform  
**Scale:** 10 lakh+ (1,000,000+) documents, 200+ concurrent LAN users  

---

## Table of Contents

1. [Product Vision & Objectives](#1-product-vision--objectives)
2. [Target Users & Personas](#2-target-users--personas)
3. [Technology Stack](#3-technology-stack)
4. [System Architecture](#4-system-architecture)
5. [Database Schema](#5-database-schema)
6. [API Design](#6-api-design)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [Frontend Architecture](#8-frontend-architecture)
9. [Component Library](#9-component-library)
10. [PL-Centric Logic](#10-pl-centric-logic)
11. [BOM Module](#11-bom-module)
12. [Work Ledger Module](#12-work-ledger-module)
13. [Document Management](#13-document-management)
14. [OCR Pipeline](#14-ocr-pipeline)
15. [Search System](#15-search-system)
16. [Dashboard & Reports](#16-dashboard--reports)
17. [Admin Controls](#17-admin-controls)
18. [Security Model](#18-security-model)
19. [Performance & Scalability](#19-performance--scalability)
20. [Storage Architecture](#20-storage-architecture)
21. [Deployment & Operations](#21-deployment--operations)
22. [Testing Strategy](#22-testing-strategy)
23. [UI/UX Guidelines](#23-uiux-guidelines)
24. [Migration Plan](#24-migration-plan)
25. [Project Timeline & Milestones](#25-project-timeline--milestones)

---

## 1. Product Vision & Objectives

### Vision Statement

LDO-2 EDMS v3 is a **production-grade, LAN-deployed Engineering Document Intelligence Platform** purpose-built for Indian Railways locomotive design offices. It manages the complete lifecycle of engineering documents — from scanning and OCR extraction through approval, revision control, and archival — with native understanding of railway-specific identifiers (PL Numbers, Drawing Numbers, BOM structures).

### Core Objectives

| # | Objective | Success Metric |
|---|-----------|----------------|
| 1 | Manage 10 lakh+ engineering documents with sub-second search | p95 search < 500ms at 10L docs |
| 2 | Extract structured metadata from A0/A1 engineering drawings via tiled OCR | >90% extraction accuracy on title blocks |
| 3 | Provide PL-centric document intelligence (link every document to its PL number) | 95% of documents have PL linkage |
| 4 | Enable daily work tracking with KPI enforcement | Zero missed disposal deadlines |
| 5 | Support BOM management with revision control | Full audit trail on every BOM change |
| 6 | Deliver industrial-grade reliability (99.9% uptime) | < 8.7 hours downtime/year |
| 7 | Maintain enterprise security on isolated LAN | Zero unauthorized document access |
| 8 | Provide admin self-service for all operations | Admin resolves 95% of issues without developer help |

### What Makes This Different

Unlike Paperless-ngx (consumer documents) or Mayan EDMS (generic DMS), LDO-2 v3 is **purpose-built for engineering**:

- **PL Number is the primary entity** (not folders or tags)
- **BOM-aware** — documents link to product structures
- **Drawing-intelligent** — OCR extracts DWG numbers, revisions, title block fields
- **Railway-specific** — CAT-A/B/C/D inspection categories, disposal day tracking, IC/consent workflows
- **LAN-optimized** — no cloud dependency, works on isolated networks

---

## 2. Target Users & Personas

### Primary Users

| Persona | Role | Key Tasks | Access Level |
|---------|------|-----------|-------------|
| **Design Engineer** | `engineer` | Upload drawings, link to PLs, create work records, view BOM | Create + Read + Update own records |
| **Section Supervisor** | `supervisor` | Approve work records, review documents, manage team workload | All engineer access + approve + assign |
| **Quality Reviewer** | `reviewer` | Verify documents, approve releases, flag discrepancies | Read all + approve/reject + create cases |
| **System Administrator** | `admin` | User management, system config, health monitoring, backups | Full system access |
| **Read-Only Viewer** | `viewer` | Search documents, view previews, generate reports | Read-only access |

### User Stories (Critical Path)

```
As a Design Engineer, I want to:
- Upload a scanned A0 drawing and have OCR automatically extract the drawing number, revision, and linked PL numbers
- See all documents linked to a specific PL number in one view
- Track my daily work records and see which are approaching disposal deadlines
- Search across all documents using drawing number, PL number, or text content

As a Supervisor, I want to:
- See a dashboard of pending approvals, overdue work records, and team workload
- Approve or reject document releases with one click
- See which PLs have outdated or missing documents
- Generate reports on team productivity and disposal compliance

As an Admin, I want to:
- Monitor system health (OCR queue, storage, database) from a single dashboard
- Manage users and their role assignments
- Configure alert rules for document changes
- Verify that backups are current and valid
- Put the system in maintenance mode without data loss
```

---

## 3. Technology Stack

### Frontend

| Layer | Technology | Version | Justification |
|-------|-----------|---------|---------------|
| Framework | **Next.js** | 15.x (App Router) | Server components, streaming, built-in API routes, Vercel-optimized |
| UI Library | **shadcn/ui** | Latest | Vercel design patterns, accessible, customizable, no lock-in |
| Styling | **Tailwind CSS** | 4.x | Utility-first, design token system, dark/light themes |
| State | **Zustand** | 5.x | Lightweight, no boilerplate, works with server components |
| Data Fetching | **TanStack Query** | 5.x | Caching, deduplication, optimistic updates, infinite scroll |
| Forms | **React Hook Form** + **Zod** | Latest | Performant forms with schema validation |
| Charts | **Recharts** | 2.x | Composable, responsive, SSR-compatible |
| Icons | **Lucide React** | Latest | Consistent, tree-shakeable, 1000+ icons |
| Animations | **Framer Motion** | 12.x | Gesture support, layout animations, exit animations |
| DnD | **@dnd-kit** | Latest | Accessible drag-and-drop, sortable, tree structures |
| Viewer | **OpenSeadragon** | 4.x | Deep zoom for large engineering drawings |
| Tables | **TanStack Table** | 8.x | Headless, virtual scrolling, sorting, filtering |

### Backend

| Layer | Technology | Version | Justification |
|-------|-----------|---------|---------------|
| Runtime | **Node.js** | 22 LTS | Same language as frontend, excellent async I/O |
| Framework | **Next.js API Routes** + **tRPC** | Latest | Type-safe API, co-located with frontend |
| ORM | **Drizzle ORM** | Latest | Type-safe SQL, migrations, PostgreSQL-native features |
| Database | **PostgreSQL** | 16 | Full-text search, GIN indexes, partitioning, JSONB |
| Cache | **Redis** | 7.x | Session cache, API response cache, pub/sub |
| Queue | **BullMQ** | 5.x | Redis-backed job queue for OCR, indexing, notifications |
| Auth | **NextAuth.js** (Auth.js) | 5.x | JWT + session, role-based, extensible providers |
| File Storage | **Local filesystem** | — | Content-addressed (SHA-256), LAN-optimized |
| Search | **PostgreSQL FTS** | Built-in | tsvector + GIN + pg_trgm for fuzzy matching |
| OCR | **Tesseract** | 5.x | Open-source, tiled pipeline for large drawings |
| PDF | **Poppler** (pdftocairo) | Latest | High-quality PDF rasterization |
| Image | **Sharp** | Latest | Fast image processing, tile generation, thumbnails |

### Infrastructure

| Layer | Technology | Justification |
|-------|-----------|---------------|
| Container | Docker Compose | LAN deployment, single-command start |
| Reverse Proxy | Nginx | SSL termination, static caching, rate limiting |
| Monitoring | Prometheus + Grafana | LAN-native, no cloud dependency |
| Logging | Loki + Promtail | Structured logs, Grafana integration |
| Backup | pgBackRest | Point-in-time recovery, compressed, encrypted |
| CI/CD | GitHub Actions | Lint, test, build, Docker image creation |

### Why This Stack (vs. Current Django + React SPA)

| Concern | Current (Django + Vite SPA) | New (Next.js Full-Stack) | Benefit |
|---------|---------------------------|--------------------------|---------|
| Type safety | Separate TS frontend + Python backend | End-to-end TypeScript with tRPC | Zero runtime type errors at API boundary |
| Server rendering | Client-only (slow first paint) | Server Components + Streaming | 3x faster first contentful paint |
| API design | Manual REST endpoints + Axios | tRPC with auto-generated types | Zero boilerplate, instant refactoring |
| Deployment | 2 separate containers | Single Next.js container + workers | Simpler ops, fewer failure modes |
| Code sharing | Separate lib/ packages | Direct imports within monorepo | No publish step, instant feedback |
| SEO/SSR | Not applicable (LAN) | Available if needed | Future-proofing |

---

## 4. System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        LAN NETWORK                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────┐         ┌────────────────────────────────────┐  │
│  │ User Browser  │ ──────→ │ Nginx (Reverse Proxy)              │  │
│  │ (LAN Client)  │ ←────── │ - SSL/TLS termination              │  │
│  └───────────────┘         │ - Static asset caching (1yr)       │  │
│                            │ - Rate limiting                     │  │
│                            │ - Security headers (CSP, HSTS)      │  │
│                            └────────────────┬───────────────────┘  │
│                                             │                       │
│                            ┌────────────────▼───────────────────┐  │
│                            │ Next.js Application Server          │  │
│                            │ ┌─────────────────────────────────┐│  │
│                            │ │ Server Components (SSR/Streaming)││  │
│                            │ │ API Routes (tRPC endpoints)      ││  │
│                            │ │ Auth (NextAuth.js + JWT)         ││  │
│                            │ │ File Upload Handler              ││  │
│                            │ └─────────────────────────────────┘│  │
│                            └────────────────┬───────────────────┘  │
│                                             │                       │
│         ┌───────────────────────────────────┼──────────────────┐   │
│         │                                   │                  │   │
│  ┌──────▼──────┐  ┌──────────────┐  ┌──────▼──────────────┐  │   │
│  │ PostgreSQL  │  │ Redis 7      │  │ BullMQ Workers       │  │   │
│  │ 16          │  │              │  │ ┌──────────────────┐ │  │   │
│  │ - Documents │  │ - Sessions   │  │ │ OCR Worker       │ │  │   │
│  │ - PL Numbers│  │ - Cache      │  │ │ (Tesseract+Tile) │ │  │   │
│  │ - Work Recs │  │ - Pub/Sub    │  │ ├──────────────────┤ │  │   │
│  │ - FTS Index │  │ - BullMQ Q   │  │ │ Index Worker     │ │  │   │
│  │ - Audit Log │  │              │  │ │ (FTS Update)     │ │  │   │
│  └─────────────┘  └──────────────┘  │ ├──────────────────┤ │  │   │
│         │                            │ │ Notify Worker    │ │  │   │
│  ┌──────▼──────┐                     │ │ (Alerts/Email)   │ │  │   │
│  │ PgBouncer   │                     │ └──────────────────┘ │  │   │
│  │ (Pool: 40)  │                     └──────────────────────┘  │   │
│  └─────────────┘                                               │   │
│                                                                 │   │
│  ┌─────────────────────────────────────────────────────────┐   │   │
│  │ File Storage (NAS / Local RAID)                          │   │   │
│  │ /storage/originals/sha256/aa/bb/<hash>                   │   │   │
│  │ /storage/thumbnails/<doc_id>.webp                        │   │   │
│  │ /storage/tiles/<doc_id>/level/x_y.webp                   │   │   │
│  │ /storage/ocr/<doc_id>.json                               │   │   │
│  │ /storage/temp/<job_id>/                                   │   │   │
│  └─────────────────────────────────────────────────────────┘   │   │
│                                                                 │   │
│  ┌─────────────────────────────────────────────────────────┐   │   │
│  │ Monitoring (Prometheus + Grafana + Loki)                  │   │   │
│  └─────────────────────────────────────────────────────────┘   │   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Request Flow

```
1. Browser → Nginx → Next.js Server Component (SSR)
2. Server Component → Drizzle ORM → PostgreSQL (data fetch)
3. Server Component → Rendered HTML streamed to browser
4. Client hydration → Interactive UI
5. Client mutations → tRPC API route → Drizzle → PostgreSQL
6. File upload → API route → Disk write → BullMQ job queued
7. BullMQ worker → Tesseract OCR → Index update → Notification
```


---

## 5. Database Schema

### Entity Relationship Overview

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   users      │────→│  documents   │←────│  pl_numbers  │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                     │
       │              ┌─────┴─────┐              │
       │              │           │              │
       ▼              ▼           ▼              ▼
┌──────────────┐ ┌────────┐ ┌────────┐ ┌──────────────┐
│ work_records │ │ocr_jobs│ │doc_revs│ │  bom_entries  │
└──────────────┘ └────────┘ └────────┘ └──────────────┘
       │                                      │
       ▼                                      ▼
┌──────────────┐                      ┌──────────────┐
│  approvals   │                      │   products   │
└──────────────┘                      └──────────────┘
```

### Core Tables

#### `users`
```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(50) UNIQUE NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(200) NOT NULL,
  designation   VARCHAR(100),
  department    VARCHAR(100),
  section       VARCHAR(50),
  employee_id   VARCHAR(20),
  phone         VARCHAR(20),
  role          VARCHAR(20) NOT NULL DEFAULT 'viewer'
                CHECK (role IN ('admin','supervisor','engineer','reviewer','viewer')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  mfa_enabled   BOOLEAN NOT NULL DEFAULT false,
  mfa_secret    VARCHAR(100),
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_role ON users (role) WHERE is_active = true;
CREATE INDEX idx_users_department ON users (department);
```

#### `pl_numbers` (Core Entity)
```sql
CREATE TABLE pl_numbers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pl_number             CHAR(8) UNIQUE NOT NULL,  -- 8-digit railway PL code
  name                  VARCHAR(500) NOT NULL,
  description           TEXT NOT NULL,
  category              VARCHAR(5) NOT NULL CHECK (category IN ('CAT-A','CAT-B','CAT-C','CAT-D')),
  controlling_agency    VARCHAR(50) NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE','UNDER_REVIEW','OBSOLETE')),
  safety_critical       BOOLEAN NOT NULL DEFAULT false,
  safety_classification VARCHAR(10) CHECK (safety_classification IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  severity_of_failure   TEXT,
  consequences          TEXT,
  functionality         TEXT,
  application_area      TEXT,
  used_in               TEXT[],           -- Array of product/assembly names
  drawing_numbers       TEXT[],           -- Linked drawing numbers
  spec_numbers          TEXT[],           -- Linked specification numbers
  mother_part           VARCHAR(8),       -- Parent PL number reference
  uvam_id               VARCHAR(50),      -- Vendor development tracking
  str_number            VARCHAR(50),
  eligibility_criteria  TEXT,
  procurement_conditions TEXT,
  design_supervisor     VARCHAR(100),
  concerned_supervisor  VARCHAR(100),
  e_office_file         VARCHAR(50),
  vendor_type           VARCHAR(5) CHECK (vendor_type IN ('VD','NVD')),
  created_by            UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Full-text search vector (auto-populated by trigger)
  search_vector         TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(pl_number, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(application_area, '')), 'C')
  ) STORED
);

CREATE INDEX idx_pl_number ON pl_numbers (pl_number);
CREATE INDEX idx_pl_category ON pl_numbers (category);
CREATE INDEX idx_pl_status ON pl_numbers (status);
CREATE INDEX idx_pl_agency ON pl_numbers (controlling_agency);
CREATE INDEX idx_pl_safety ON pl_numbers (safety_critical) WHERE safety_critical = true;
CREATE INDEX idx_pl_fts ON pl_numbers USING GIN (search_vector);
CREATE INDEX idx_pl_trigram ON pl_numbers USING GIN (name gin_trgm_ops);
```

#### `documents`
```sql
CREATE TABLE documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number VARCHAR(100) NOT NULL,
  title           VARCHAR(500) NOT NULL,
  category        VARCHAR(30) NOT NULL
                  CHECK (category IN ('DRAWING','SPECIFICATION','ELIGIBILITY_CRITERIA',
                    'SCOPE_OF_SUPPLY','SMI','STANDARD','TENDER','SDR',
                    'TEST_REPORT','CERTIFICATE','PROCEDURE','OTHER')),
  status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                  CHECK (status IN ('ACTIVE','OBSOLETE','UNDER_REVIEW','DRAFT','APPROVED')),
  revision        VARCHAR(20) NOT NULL DEFAULT 'R0',
  revision_date   DATE,
  agency          VARCHAR(50),
  file_type       VARCHAR(10) NOT NULL,   -- pdf, tiff, png, dwg
  file_size       BIGINT,                 -- bytes
  file_hash       CHAR(64),              -- SHA-256 of original file
  file_path       VARCHAR(500),          -- Content-addressed path
  pages           INTEGER DEFAULT 1,
  owner_id        UUID REFERENCES users(id),
  uploaded_by     UUID REFERENCES users(id),
  
  -- OCR fields
  ocr_status      VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                  CHECK (ocr_status IN ('PENDING','PROCESSING','COMPLETED','FAILED','FLAGGED','SKIPPED','NOT_REQUIRED')),
  ocr_confidence  SMALLINT CHECK (ocr_confidence BETWEEN 0 AND 100),
  ocr_text        TEXT,                   -- Full extracted text
  ocr_structured  JSONB,                  -- Structured extraction (drawing num, revision, etc.)
  ocr_error       TEXT,
  ocr_retry_count SMALLINT DEFAULT 0,
  
  -- Metadata
  tags            TEXT[],
  is_latest       BOOLEAN DEFAULT true,
  is_duplicate    BOOLEAN DEFAULT false,
  duplicate_of    UUID REFERENCES documents(id),
  
  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Full-text search
  search_vector   TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(document_number, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(ocr_text, '')), 'C')
  ) STORED
) PARTITION BY RANGE (created_at);

-- Monthly partitions (managed by pg_partman)
CREATE TABLE documents_2026_01 PARTITION OF documents
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- Indexes
CREATE INDEX idx_doc_number ON documents (document_number);
CREATE INDEX idx_doc_status ON documents (status);
CREATE INDEX idx_doc_category ON documents (category, status);
CREATE INDEX idx_doc_owner ON documents (owner_id, created_at DESC);
CREATE INDEX idx_doc_hash ON documents (file_hash) WHERE file_hash IS NOT NULL;
CREATE INDEX idx_doc_ocr_status ON documents (ocr_status) WHERE ocr_status IN ('PENDING','PROCESSING','FAILED');
CREATE INDEX idx_doc_fts ON documents USING GIN (search_vector);
CREATE INDEX idx_doc_tags ON documents USING GIN (tags);
CREATE INDEX idx_doc_created ON documents USING BRIN (created_at);
```

#### `document_pl_links` (Many-to-Many)
```sql
CREATE TABLE document_pl_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  pl_id       UUID NOT NULL REFERENCES pl_numbers(id) ON DELETE CASCADE,
  link_type   VARCHAR(20) DEFAULT 'reference',  -- reference, primary, supersedes
  linked_by   UUID REFERENCES users(id),
  linked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, pl_id)
);

CREATE INDEX idx_dpl_doc ON document_pl_links (document_id);
CREATE INDEX idx_dpl_pl ON document_pl_links (pl_id);
```

#### `work_records`
```sql
CREATE TABLE work_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id),
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  work_category     VARCHAR(20) NOT NULL
                    CHECK (work_category IN ('GENERAL','DRAWING','SPECIFICATION','TENDER',
                      'SHOP','IC','AMENDMENT','VENDOR','EXTERNAL','FAILURE','INSPECTION')),
  work_type_code    VARCHAR(10) NOT NULL,   -- e.g., DWG-001, SPEC-002
  work_type_label   VARCHAR(200) NOT NULL,
  description       TEXT NOT NULL,
  reference_number  VARCHAR(100),
  pl_number         CHAR(8),              -- Linked PL
  drawing_number    VARCHAR(100),
  specification_number VARCHAR(100),
  tender_number     VARCHAR(100),
  other_number      VARCHAR(100),
  remarks           TEXT,
  e_office_number   VARCHAR(50),
  e_office_file_no  VARCHAR(50),
  concerned_officer VARCHAR(100),
  section_type      VARCHAR(50),
  target_days       INTEGER,              -- Disposal target
  days_taken        INTEGER,              -- Actual days (computed)
  document_ref      UUID REFERENCES documents(id),
  consent_given     VARCHAR(50),
  status            VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                    CHECK (status IN ('OPEN','SUBMITTED','VERIFIED','CLOSED')),
  is_locked         BOOLEAN DEFAULT false,
  verified_by       UUID REFERENCES users(id),
  verification_date DATE,
  completion_date   DATE,
  closed_date       DATE,
  dispatch_date     DATE,
  priority          VARCHAR(10) DEFAULT 'MEDIUM'
                    CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wr_user_date ON work_records (user_id, date DESC);
CREATE INDEX idx_wr_status ON work_records (status) WHERE status != 'CLOSED';
CREATE INDEX idx_wr_pl ON work_records (pl_number) WHERE pl_number IS NOT NULL;
CREATE INDEX idx_wr_category ON work_records (work_category);
CREATE INDEX idx_wr_priority ON work_records (priority) WHERE priority IN ('HIGH','CRITICAL');
```

#### `approvals`
```sql
CREATE TABLE approvals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         VARCHAR(500) NOT NULL,
  type          VARCHAR(30) NOT NULL,    -- document_release, work_verification, bom_change
  status        VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING','APPROVED','REJECTED','ESCALATED')),
  urgency       VARCHAR(10) DEFAULT 'NORMAL',
  requester_id  UUID NOT NULL REFERENCES users(id),
  approver_id   UUID REFERENCES users(id),
  document_id   UUID REFERENCES documents(id),
  work_record_id UUID REFERENCES work_records(id),
  pl_id         UUID REFERENCES pl_numbers(id),
  notes         TEXT,
  decision_notes TEXT,
  due_date      DATE,
  decided_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_approvals_status ON approvals (status) WHERE status = 'PENDING';
CREATE INDEX idx_approvals_approver ON approvals (approver_id, status);
```

#### `cases`
```sql
CREATE TABLE cases (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number   VARCHAR(20) UNIQUE NOT NULL,  -- Auto-generated: CASE-2026-001
  title         VARCHAR(500) NOT NULL,
  description   TEXT NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                CHECK (status IN ('OPEN','IN_PROGRESS','CLOSED')),
  severity      VARCHAR(10) NOT NULL DEFAULT 'MEDIUM'
                CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  type          VARCHAR(30),          -- failure_investigation, discrepancy, vendor_issue
  pl_number     CHAR(8),
  vendor_name   VARCHAR(200),
  tender_number VARCHAR(100),
  assignee_id   UUID REFERENCES users(id),
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `bom_products`
```sql
CREATE TABLE bom_products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name  VARCHAR(300) NOT NULL,
  product_code  VARCHAR(50) UNIQUE NOT NULL,
  description   TEXT,
  version       INTEGER NOT NULL DEFAULT 1,
  status        VARCHAR(20) DEFAULT 'DRAFT',
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `bom_entries`
```sql
CREATE TABLE bom_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES bom_products(id) ON DELETE CASCADE,
  pl_id         UUID REFERENCES pl_numbers(id),
  parent_id     UUID REFERENCES bom_entries(id),  -- Self-referential for tree
  name          VARCHAR(300) NOT NULL,
  type          VARCHAR(20) NOT NULL CHECK (type IN ('assembly','sub_assembly','component')),
  quantity      INTEGER DEFAULT 1,
  unit          VARCHAR(20) DEFAULT 'NOS',
  position      INTEGER DEFAULT 0,            -- Sort order within parent
  level         SMALLINT DEFAULT 0,           -- Depth in tree (0=root)
  specifications TEXT,
  material      VARCHAR(100),
  weight_kg     DECIMAL(10,3),
  drawing_ref   VARCHAR(100),
  vendor        VARCHAR(200),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bom_product ON bom_entries (product_id);
CREATE INDEX idx_bom_parent ON bom_entries (parent_id);
CREATE INDEX idx_bom_pl ON bom_entries (pl_id);
```

#### `ocr_jobs`
```sql
CREATE TABLE ocr_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES documents(id),
  status        VARCHAR(20) NOT NULL DEFAULT 'QUEUED'
                CHECK (status IN ('QUEUED','PROCESSING','COMPLETED','FAILED','CANCELLED')),
  engine        VARCHAR(20) DEFAULT 'tesseract',
  config        JSONB,                    -- Pipeline config snapshot
  total_pages   INTEGER,
  processed_pages INTEGER DEFAULT 0,
  total_tiles   INTEGER,
  processed_tiles INTEGER DEFAULT 0,
  confidence    SMALLINT,
  error_message TEXT,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ocr_status ON ocr_jobs (status) WHERE status IN ('QUEUED','PROCESSING');
CREATE INDEX idx_ocr_document ON ocr_jobs (document_id);
```

#### `audit_log`
```sql
CREATE TABLE audit_log (
  id            BIGSERIAL PRIMARY KEY,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id       UUID REFERENCES users(id),
  action        VARCHAR(30) NOT NULL,     -- VIEW, DOWNLOAD, CREATE, UPDATE, DELETE, APPROVE, REJECT, LOGIN, LOGOUT
  resource_type VARCHAR(30) NOT NULL,     -- document, pl_number, work_record, user, bom, case
  resource_id   UUID,
  details       JSONB,                    -- Changed fields, before/after
  ip_address    INET,
  user_agent    TEXT,
  request_id    UUID,                     -- Correlation ID
  prev_hash     CHAR(64),                -- Hash of previous entry (tamper detection)
  entry_hash    CHAR(64) NOT NULL        -- SHA-256(prev_hash + this entry)
) PARTITION BY RANGE (timestamp);

-- Append-only: REVOKE UPDATE, DELETE on audit_log FROM app_user;
CREATE INDEX idx_audit_user ON audit_log (user_id, timestamp DESC);
CREATE INDEX idx_audit_resource ON audit_log (resource_type, resource_id);
CREATE INDEX idx_audit_action ON audit_log (action, timestamp DESC);
```

#### `notifications`
```sql
CREATE TABLE notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id),
  type          VARCHAR(30) NOT NULL,
  title         VARCHAR(300) NOT NULL,
  body          TEXT,
  target_url    VARCHAR(500),
  is_read       BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_user ON notifications (user_id, is_read, created_at DESC);
```

#### `settings`
```sql
CREATE TABLE settings (
  key           VARCHAR(100) PRIMARY KEY,
  value         JSONB NOT NULL,
  description   TEXT,
  updated_by    UUID REFERENCES users(id),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 6. API Design (tRPC Routers)

### Router Structure

```typescript
// src/server/routers/_app.ts
export const appRouter = router({
  auth:       authRouter,
  users:      usersRouter,
  documents:  documentsRouter,
  pl:         plRouter,
  bom:        bomRouter,
  work:       workRouter,
  approvals:  approvalsRouter,
  cases:      casesRouter,
  search:     searchRouter,
  ocr:        ocrRouter,
  admin:      adminRouter,
  reports:    reportsRouter,
  audit:      auditRouter,
  notifications: notificationsRouter,
});
```

### Key Procedures

#### Documents Router
```typescript
documents: router({
  list:       protectedProcedure.input(documentListSchema).query(/* paginated list with filters */),
  getById:    protectedProcedure.input(z.object({ id: z.string().uuid() })).query(/* single doc */),
  upload:     protectedProcedure.input(uploadSchema).mutation(/* create + queue OCR */),
  update:     protectedProcedure.input(updateDocSchema).mutation(/* metadata update */),
  delete:     protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(/* soft delete */),
  linkPL:     protectedProcedure.input(linkSchema).mutation(/* link document to PL */),
  unlinkPL:   protectedProcedure.input(unlinkSchema).mutation(/* unlink */),
  approve:    supervisorProcedure.input(approveSchema).mutation(/* approve for release */),
  getPreview: protectedProcedure.input(previewSchema).query(/* tile URLs for viewer */),
  bulkAction: protectedProcedure.input(bulkSchema).mutation(/* bulk tag/move/delete */),
})
```

#### PL Router
```typescript
pl: router({
  list:         protectedProcedure.input(plListSchema).query(/* paginated PL list */),
  getById:      protectedProcedure.input(z.object({ id: z.string().uuid() })).query(/* full PL detail */),
  create:       engineerProcedure.input(createPLSchema).mutation(/* new PL number */),
  update:       engineerProcedure.input(updatePLSchema).mutation(/* edit PL */),
  getLinkedDocs: protectedProcedure.input(z.object({ plId: z.string().uuid() })).query(/* docs for this PL */),
  getLinkedWork: protectedProcedure.input(z.object({ plId: z.string().uuid() })).query(/* work records */),
  getLinkedCases: protectedProcedure.input(z.object({ plId: z.string().uuid() })).query(/* cases */),
  search:       protectedProcedure.input(searchSchema).query(/* FTS on PL numbers */),
})
```

#### BOM Router
```typescript
bom: router({
  products:    protectedProcedure.query(/* list products */),
  getProduct:  protectedProcedure.input(z.object({ id: z.string().uuid() })).query(/* full tree */),
  createProduct: engineerProcedure.input(createProductSchema).mutation(/* new product */),
  addEntry:    engineerProcedure.input(addEntrySchema).mutation(/* add node to tree */),
  moveEntry:   engineerProcedure.input(moveEntrySchema).mutation(/* reorder/reparent */),
  removeEntry: engineerProcedure.input(z.object({ id: z.string().uuid() })).mutation(/* remove node */),
  linkPL:      engineerProcedure.input(bomLinkSchema).mutation(/* link BOM entry to PL */),
})
```

#### Work Router
```typescript
work: router({
  list:       protectedProcedure.input(workListSchema).query(/* paginated work records */),
  create:     engineerProcedure.input(createWorkSchema).mutation(/* new work record */),
  update:     engineerProcedure.input(updateWorkSchema).mutation(/* edit record */),
  submit:     engineerProcedure.input(z.object({ id: z.string().uuid() })).mutation(/* submit for verification */),
  verify:     supervisorProcedure.input(verifySchema).mutation(/* verify and close */),
  lock:       supervisorProcedure.input(z.object({ id: z.string().uuid() })).mutation(/* lock record */),
  getKPIs:    protectedProcedure.input(kpiSchema).query(/* disposal day metrics */),
})
```

#### Search Router
```typescript
search: router({
  global:     protectedProcedure.input(globalSearchSchema).query(/* cross-entity FTS */),
  documents:  protectedProcedure.input(docSearchSchema).query(/* document-specific */),
  facets:     protectedProcedure.input(facetSchema).query(/* filter counts */),
  suggest:    protectedProcedure.input(z.object({ query: z.string() })).query(/* typeahead */),
  saveFilter: protectedProcedure.input(saveFilterSchema).mutation(/* persist filter preset */),
})
```


---

## 7. Authentication & Authorization

### Auth Architecture

```
NextAuth.js (Auth.js v5)
├── Credentials Provider (username/password for LAN)
├── LDAP/AD Provider (optional, for enterprise)
├── Keycloak Provider (optional, for SSO)
└── JWT Session Strategy (stateless, 15min access + 7d refresh)
```

### Role-Permission Matrix

| Action | viewer | reviewer | engineer | supervisor | admin |
|--------|--------|----------|----------|------------|-------|
| View documents | ✅ | ✅ | ✅ | ✅ | ✅ |
| Search | ✅ | ✅ | ✅ | ✅ | ✅ |
| Download | ✅ | ✅ | ✅ | ✅ | ✅ |
| Upload documents | ❌ | ❌ | ✅ | ✅ | ✅ |
| Create work records | ❌ | ❌ | ✅ | ✅ | ✅ |
| Create/edit PL numbers | ❌ | ❌ | ✅ | ✅ | ✅ |
| Edit BOM | ❌ | ❌ | ✅ | ✅ | ✅ |
| Approve documents | ❌ | ✅ | ❌ | ✅ | ✅ |
| Verify work records | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage cases | ❌ | ✅ | ✅ | ✅ | ✅ |
| Manage users | ❌ | ❌ | ❌ | ❌ | ✅ |
| System settings | ❌ | ❌ | ❌ | ❌ | ✅ |
| View audit log | ❌ | ❌ | ❌ | ✅ | ✅ |

### Object-Level Permissions

Beyond role-based access, documents have owner-based restrictions:
- **Own documents**: Full edit access
- **Department documents**: View + comment
- **Other department**: View only (if not restricted)
- **Restricted documents**: Only explicit grantees + admin

---

## 8. Frontend Architecture (Next.js App Router)

### Directory Structure

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout (providers, theme)
│   ├── page.tsx                 # Dashboard (/)
│   ├── login/page.tsx           # Authentication
│   ├── (protected)/             # Auth-required route group
│   │   ├── layout.tsx           # Shell (sidebar + header)
│   │   ├── documents/
│   │   │   ├── page.tsx         # Document Hub
│   │   │   ├── [id]/page.tsx    # Document Detail
│   │   │   ├── [id]/preview/page.tsx  # Preview/Viewer
│   │   │   ├── upload/page.tsx  # Upload wizard
│   │   │   └── templates/page.tsx
│   │   ├── pl/
│   │   │   ├── page.tsx         # PL Knowledge Hub
│   │   │   ├── [id]/page.tsx    # PL Detail
│   │   │   └── new/page.tsx     # Create PL
│   │   ├── bom/
│   │   │   ├── page.tsx         # BOM Explorer
│   │   │   ├── [productId]/page.tsx  # Product View
│   │   │   └── new/page.tsx     # Create Product
│   │   ├── ledger/
│   │   │   ├── page.tsx         # Work Ledger
│   │   │   └── reports/page.tsx # Ledger Reports
│   │   ├── approvals/page.tsx
│   │   ├── cases/page.tsx
│   │   ├── search/page.tsx      # Search Explorer
│   │   ├── notifications/page.tsx
│   │   ├── profile/page.tsx
│   │   └── admin/
│   │       ├── page.tsx         # Admin Dashboard
│   │       ├── users/page.tsx
│   │       ├── settings/page.tsx
│   │       ├── health/page.tsx  # System Health
│   │       ├── ocr/page.tsx     # OCR Monitor
│   │       ├── audit/page.tsx   # Audit Log
│   │       ├── dedup/page.tsx   # Deduplication
│   │       └── banners/page.tsx
│   └── api/                     # API routes (tRPC)
│       └── trpc/[trpc]/route.ts
├── components/
│   ├── ui/                      # shadcn/ui primitives
│   ├── layout/                  # Shell, Sidebar, Header
│   ├── documents/               # Document-specific components
│   ├── pl/                      # PL-specific components
│   ├── bom/                     # BOM tree components
│   ├── charts/                  # Dashboard chart components
│   └── shared/                  # Cross-cutting (CommandPalette, Toast)
├── lib/
│   ├── db/                      # Drizzle schema + queries
│   ├── auth/                    # Auth config + helpers
│   ├── ocr/                     # OCR pipeline logic
│   ├── search/                  # Search query builders
│   ├── storage/                 # File storage utilities
│   ├── validators/              # Zod schemas
│   └── utils.ts                 # cn(), formatDate(), etc.
├── hooks/                       # Custom React hooks
├── stores/                      # Zustand stores
├── server/                      # tRPC routers + server-only code
│   ├── routers/
│   ├── middleware/
│   └── services/
└── styles/
    └── globals.css              # Tailwind + CSS variables
```

### Layout Hierarchy

```tsx
// app/layout.tsx — Root
<html>
  <ThemeProvider>
    <QueryProvider>
      <SessionProvider>
        {children}
      </SessionProvider>
    </QueryProvider>
  </ThemeProvider>
</html>

// app/(protected)/layout.tsx — Shell
<div className="flex h-screen">
  <Sidebar />
  <div className="flex-1 flex flex-col overflow-hidden">
    <Header />
    <main className="flex-1 overflow-auto p-4">
      {children}
    </main>
  </div>
</div>
```

---

## 9. Component Library (shadcn/ui + Custom)

### Base Primitives (from shadcn/ui)

| Component | Usage |
|-----------|-------|
| `Button` | Primary, secondary, ghost, destructive, outline variants |
| `Card` | Content containers with header/content/footer |
| `Input` | Text inputs with label and error states |
| `Select` | Dropdown selection (Radix) |
| `Dialog` | Modal dialogs with accessible focus trap |
| `Sheet` | Slide-over panels (mobile nav, filters) |
| `DropdownMenu` | Context menus, action menus |
| `Tabs` | Content switching |
| `Table` | Data display with sort indicators |
| `Badge` | Status indicators (success, warning, danger, info, processing) |
| `Tooltip` | Hover information |
| `Popover` | Floating content |
| `Command` | Command palette (Ctrl+K) |
| `Progress` | Loading bars |
| `Skeleton` | Loading placeholders |
| `Switch` | Toggle controls |
| `Checkbox` | Multi-select |
| `Toast` (Sonner) | Notifications |
| `Separator` | Visual dividers |
| `ScrollArea` | Custom scrollbars |

### Custom Application Components

| Component | Props | Usage |
|-----------|-------|-------|
| `PageHeader` | title, subtitle, actions, breadcrumbs | Every page header |
| `DataTable` | columns, data, sort, filter, paginate, select | All list views |
| `MetricCard` | title, value, trend, icon, sparkline, onClick | Dashboard KPIs |
| `GlassCard` | children, className | Elevated content cards |
| `StatusBadge` | status, size | Document/work status pills |
| `OcrStatusBadge` | ocrStatus, confidence | OCR pipeline status |
| `PLLink` | plNumber, showTooltip | Clickable PL reference |
| `DocumentPreview` | documentId, mode | Thumbnail or full viewer |
| `DrawingViewer` | documentId, tiles | OpenSeadragon deep-zoom |
| `BomTree` | product, onSelect, onDrop | Interactive BOM hierarchy |
| `WorkKPIBadge` | daysTarget, daysTaken | Red/amber/green disposal indicator |
| `FilterBar` | filters, onApply, onSave | Reusable filter strip |
| `EmptyState` | icon, title, description, action | No-data placeholders |
| `ErrorState` | variant, onRetry | Error recovery UI |
| `LoadingState` | message, size | Section loading |
| `CommandPalette` | open, onClose | Global search/nav (Ctrl+K) |
| `UploadDropzone` | onUpload, maxSize, accept | Drag-and-drop file upload |
| `AuditTimeline` | entries | Chronological action log |

---

## 10. PL-Centric Logic

### What is a PL Number?

In Indian Railways, every part, assembly, or sub-assembly is identified by an **8-digit numeric code** called the **PL Number** (Parts List Number). This is the fundamental unit of engineering identification.

Example: `30154821` = Traction Motor Armature for WAP-7 locomotive

### PL Knowledge Hub (Primary Interface)

The PL Knowledge Hub is the **central intelligence view** — a searchable, filterable registry of all PL numbers with their linked documents, work records, cases, and BOM positions.

#### PL Hub Features
1. **Searchable registry** — Find any PL by number, name, description, or linked drawing
2. **Category filters** — CAT-A/B/C/D with color coding
3. **Status filters** — Active, Under Review, Obsolete
4. **Agency filters** — CLW, RDSO, etc.
5. **Safety-critical flag** — Prominent indicator for safety items
6. **Linked document count** — Badges showing drawings, specs, certificates
7. **Detail view** — Full PL information with tabbed sections

#### PL Detail Tabs
| Tab | Content |
|-----|---------|
| Overview | All PL metadata, safety classification, vendor info |
| Documents | Linked documents (can add/remove links) |
| BOM | Where this PL appears in product structures |
| Work Records | Work records referencing this PL |
| Cases | Open/closed cases for this PL |
| History | Engineering changes and revision timeline |

#### PL Validation Rules
- Must be exactly 8 digits: `/^\d{8}$/`
- Must be unique in the system
- Category assignment is mandatory (CAT-A/B/C/D)
- Safety-critical PLs (CAT-A, CAT-B) require additional fields:
  - Safety classification (LOW/MEDIUM/HIGH/CRITICAL)
  - Severity of failure description
  - Consequences description
- Vendor-developed (VD) PLs require UVAM Item ID

#### PL Search Integration
When OCR extracts text from a document, the system:
1. Scans for 8-digit patterns with PL prefix context
2. Validates against existing PL registry
3. Auto-suggests linkage to the document
4. Engineer confirms or rejects the suggestion

---

## 11. BOM Module

### Overview
The BOM (Bill of Materials) module manages the hierarchical product structure of locomotives and their assemblies. Each node in the tree is linked to a PL number.

### Product Structure
```
WAP-7 Locomotive (Product)
├── Traction System (Assembly)
│   ├── Traction Motor (Sub-assembly, PL: 30154821)
│   │   ├── Armature (Component, PL: 30154822)
│   │   ├── Field Coil (Component, PL: 30154823)
│   │   └── Bearing Assembly (Component, PL: 30154824)
│   └── Transformer (Sub-assembly, PL: 30158901)
├── Bogie Assembly (Assembly)
│   ├── Frame (Component, PL: 30162001)
│   └── Suspension (Sub-assembly, PL: 30162045)
└── Control Electronics (Assembly)
    └── ...
```

### BOM Features
1. **Product creation** — Name, code, description
2. **Tree builder** — Add assemblies, sub-assemblies, components
3. **Drag-and-drop reordering** — Move nodes within and between parents
4. **PL linkage** — Each BOM entry links to a PL number
5. **Quantity and units** — Per-node quantity specifications
6. **Version control** — BOM versions with comparison
7. **Export** — Excel/PDF export of BOM structure
8. **Drawing references** — Link relevant drawings to BOM nodes

### BOM Interaction Pattern
```
1. Admin creates a Product (e.g., "WAP-7 3-Phase Locomotive")
2. Engineer adds top-level assemblies
3. Each assembly is linked to its PL number
4. Sub-assemblies and components are added recursively
5. System validates PL numbers exist in registry
6. Changes are versioned and auditable
```

---

## 12. Work Ledger Module

### Purpose
The Work Ledger tracks daily engineering work with **disposal day targets** (government-mandated response times). Every work item has a category, target days for completion, and KPI tracking.

### Work Categories and Disposal Targets

| Code | Category | Disposal Days | Priority |
|------|----------|---------------|----------|
| DWG-001 | New Drawing Preparation | 30 | MEDIUM |
| DWG-002 | Drawing Amendment | 15 | MEDIUM |
| DWG-003 | Drawing Review | 10 | MEDIUM |
| DWG-004 | Drawing Approval | 7 | HIGH |
| SPEC-001 | Specification Preparation | 45 | HIGH |
| SPEC-002 | Specification Review | 15 | HIGH |
| TEND-001 | Tender Processing | 60 | HIGH |
| TEND-002 | Tender Evaluation | 30 | HIGH |
| SHOP-001 | Shop Inspection | 7 | MEDIUM |
| IC-001 | IC Preparation | 10 | MEDIUM |
| FAIL-001 | Failure Investigation | 14 | CRITICAL |
| FAIL-002 | Root Cause Analysis | 21 | CRITICAL |
| INSP-001 | Type Test Inspection | 30 | HIGH |

### KPI Indicators
- 🟢 **On Time**: Days taken ≤ Target days
- 🟡 **At Risk**: Days taken > 75% of target, not yet overdue
- 🔴 **Overdue**: Days taken > Target days

### Work Record Lifecycle
```
OPEN → SUBMITTED → VERIFIED → CLOSED
         ↓ (rejected)
       OPEN (returned for correction)
```

### Ledger Reports
- **Category breakdown** — Bar chart of work by category
- **Disposal compliance** — % on-time per period
- **User productivity** — Records per user per month
- **Overdue items** — List of breached disposal targets
- **Trend analysis** — Monthly/quarterly work volume

---

## 13. Document Management

### Upload Flow
```
1. User selects file(s) or drops onto upload zone
2. Client validates: file size (<500MB), type (PDF/TIFF/PNG/JPEG)
3. File uploaded with progress bar
4. Server computes SHA-256, checks for duplicates
5. File stored at /storage/originals/sha256/aa/bb/<hash>
6. Metadata record created (DRAFT status, PENDING OCR)
7. OCR job queued in BullMQ
8. Thumbnail generated via Sharp
9. User can add metadata while OCR processes in background
10. OCR completion triggers: search index update, PL linkage suggestion
```

### Document Lifecycle
```
DRAFT → UNDER_REVIEW → APPROVED → ACTIVE
                                      ↓ (superseded)
                                   OBSOLETE
```

### Revision Control
- Each document has a revision code (R0, R1, R2... or A, B, C...)
- New revisions create new document records linked to the same document_number
- `is_latest` flag marks the current revision
- Older revisions remain accessible but clearly marked

### Preview System
- **Standard documents (< A3)**: Full-page preview rendered server-side
- **Large drawings (A1/A0)**: DZI tile pyramid with OpenSeadragon viewer
- **Multi-page**: Page navigation with thumbnail strip

---

## 14. OCR Pipeline

### Tiled Processing Architecture

```yaml
# config/ocr-pipeline.yaml
pipeline:
  tile_size: 4096              # px per tile edge
  overlap_percent: 15          # overlap between adjacent tiles
  dpi_target: 400              # rasterization DPI
  min_dimension_for_tiling: 5000  # px threshold for tiling
  max_pixels: 200000000        # safety limit
  max_file_size_mb: 500
  max_pages: 100
  worker_concurrency: 4
  ocr_timeout_seconds: 300
  retry_count: 3
  confidence_threshold: 60
  dedup_threshold: 0.6
  temp_directory: /storage/temp
  cleanup_policy: on_success
  fallback_behavior: skip_tile
```

### Pipeline Stages
1. **Ingest** — Validate file, compute hash, detect format
2. **Rasterize** — PDF → TIFF via Poppler at target DPI
3. **Pre-process** — Deskew, binarize, noise reduction
4. **Tile** — Split into overlapping 4096px tiles
5. **OCR** — Run Tesseract on each tile in parallel
6. **Merge** — Combine results, deduplicate overlap zones
7. **Extract** — Drawing number, revision, PL numbers, title block
8. **Score** — Calculate per-tile and per-document confidence
9. **Index** — Update PostgreSQL full-text search vector
10. **Notify** — Alert user of completion/failure

### Structured Extraction Output
```json
{
  "drawing_number": "CLW/ED/TM/0425",
  "title": "TRACTION MOTOR ARMATURE ASSEMBLY",
  "revision": "R3",
  "pl_numbers": ["30154821", "30154822"],
  "sheet": "1 of 3",
  "scale": "1:5",
  "date": "2024-03-15",
  "approved_by": "CWE/Design",
  "confidence": 87,
  "warnings": ["Low confidence on revision field (62%)"],
  "bom_table": [
    {"item": 1, "part": "30154822", "desc": "Armature Core", "qty": 1},
    {"item": 2, "part": "30154823", "desc": "Commutator", "qty": 1}
  ]
}
```

---

## 15. Search System

### Architecture: PostgreSQL Full-Text Search

```sql
-- Combined search across all entities
SELECT * FROM (
  SELECT 'document' AS type, id, document_number AS identifier, title,
         ts_rank(search_vector, query) AS rank
  FROM documents, plainto_tsquery('english', $1) query
  WHERE search_vector @@ query
  
  UNION ALL
  
  SELECT 'pl' AS type, id, pl_number AS identifier, name AS title,
         ts_rank(search_vector, query) AS rank
  FROM pl_numbers, plainto_tsquery('english', $1) query
  WHERE search_vector @@ query
) combined
ORDER BY rank DESC
LIMIT 20 OFFSET $2;
```

### Search Features
- **Global search** — Cross-entity (documents + PLs + work records + cases)
- **Faceted filters** — Category, status, date range, OCR status, department
- **Fuzzy matching** — pg_trgm for typo tolerance
- **Typeahead suggestions** — Top 5 results as user types
- **Saved searches** — Persist filter combinations per user
- **Recent searches** — Last 10 search queries
- **Search explain** — Show why a result matched

### Performance at Scale
- **GIN index** on tsvector columns → sub-100ms for 10L documents
- **BRIN index** on created_at → efficient date-range queries
- **Partial indexes** on active/common statuses
- **Query timeout** — 5s hard limit prevents runaway queries
- **Result caching** — Redis cache with 60s TTL for repeated searches

---

## 16. Dashboard & Reports

### Dashboard Layout (Home Page)

```
┌─────────────────────────────────────────────────────────────┐
│ [Metric Cards Row - 4 cards]                                 │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────┐│
│ │ Documents   │ │ Approvals   │ │ OCR Queue   │ │ Cases  ││
│ │ 12,847      │ │ 23 pending  │ │ 5 processing│ │ 3 open ││
│ │ +12 today ↑ │ │ 15% pending │ │ 2 failed    │ │ 1 high ││
│ │ [sparkline] │ │ [sparkline] │ │ [sparkline] │ │[spark] ││
│ └─────────────┘ └─────────────┘ └─────────────┘ └────────┘│
├─────────────────────────────────────────────────────────────┤
│ [Two-column: Workload Chart | Recent Activity]               │
│ ┌──────────────────────────┐ ┌────────────────────────────┐│
│ │ Operational Load         │ │ Recent Activity            ││
│ │ [Horizontal bar chart]   │ │ • Approval: DWG-0425...   ││
│ │ Documents ████████ 12847 │ │ • Case: CASE-2026-001...  ││
│ │ Work Recs ██████ 8,234   │ │ • Upload: spec-001.pdf    ││
│ │ PL Items  ████ 3,421     │ │ • Verified: WR-2026-...   ││
│ │ Approvals ██ 23          │ │                            ││
│ └──────────────────────────┘ └────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│ [Document Table - Latest controlled documents]               │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ Document | Owner | Status | Date | Action               ││
│ │ [Clickable rows with preview button]                    ││
│ └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Drill-Down Pattern
Every metric card is clickable:
1. Click "Documents: 12,847" → Opens modal with sortable/filterable table
2. Table has export buttons (CSV, Excel, PDF)
3. Each row links to the entity detail page
4. Filters persist in URL for sharing

### Report Types
| Report | Data | Visualization |
|--------|------|---------------|
| Document Statistics | Category breakdown, upload trends, OCR success rate | Pie + Line charts |
| Disposal Compliance | On-time %, by category, by user, by period | Stacked bar |
| PL Coverage | PLs with/without linked docs, missing specs | Coverage heatmap |
| User Productivity | Records per user, approval times | Leaderboard table |
| OCR Performance | Processing time, accuracy, failure rate | Histogram |
| Storage Usage | By category, growth forecast | Area chart |

---

## 17. Admin Controls

### Admin Dashboard Sections
1. **System Health** — Service status (DB, Redis, OCR, Storage)
2. **User Management** — CRUD users, assign roles, disable accounts
3. **OCR Monitor** — Queue depth, processing rate, failed jobs with retry
4. **Storage** — Usage by category, growth trend, cleanup tools
5. **Deduplication** — Duplicate groups, merge/keep controls
6. **Audit Log** — Searchable action history
7. **Settings** — System configuration (work types, agencies, categories)
8. **Banners** — System-wide announcement management
9. **Alert Rules** — Document change notification configuration
10. **Health Checks** — Automated status of all services

### Settings Schema
```typescript
interface SystemSettings {
  workTypes: WorkTypeDefinition[];     // Configurable work categories
  agencies: string[];                  // CLW, RDSO, etc.
  documentCategories: string[];        // DRAWING, SPECIFICATION, etc.
  inspectionCategories: string[];      // CAT-A through CAT-D
  maxUploadSizeMB: number;            // Default: 500
  ocrEnabled: boolean;                // Toggle OCR processing
  maintenanceMode: boolean;           // System-wide maintenance flag
  backupSchedule: string;             // Cron expression
  retentionDays: number;              // Audit log retention
  sessionTimeoutMinutes: number;      // Idle timeout
}
```

---

## 18. Security Model

### Defense Layers
1. **Network** — VLAN segmentation, firewall rules
2. **Transport** — TLS 1.3 on all connections (even LAN)
3. **Authentication** — JWT with short-lived access tokens (15 min)
4. **Authorization** — Role + object-level permissions
5. **Input validation** — Zod schemas on all inputs
6. **File validation** — MIME, extension, magic bytes, size limits
7. **Rate limiting** — Per-IP, per-user, per-endpoint
8. **Audit trail** — Hash-chained immutable log
9. **Encryption at rest** — LUKS on storage volumes
10. **Headers** — CSP, HSTS, X-Frame-Options, Referrer-Policy

### Security Headers (Nginx)
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'self';
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

## 19. Performance & Scalability

### Targets

| Metric | Target | Strategy |
|--------|--------|----------|
| API p95 latency | < 200ms | Connection pooling, query optimization, Redis cache |
| Search p95 (10L docs) | < 500ms | GIN index, tsvector, pagination |
| Document list | < 150ms | Server components, streaming |
| First contentful paint | < 1.5s | SSR + static assets on CDN/Nginx |
| OCR (standard doc) | < 30s | Optimized Tesseract config |
| OCR (A0 drawing) | < 3min | Parallel tiled processing |
| Concurrent users | 200+ | Horizontal app scaling |
| Upload throughput | 50 docs/min | Async queue, parallel workers |

### Caching Strategy
| Layer | What | TTL | Invalidation |
|-------|------|-----|-------------|
| Browser | Static assets (JS/CSS/fonts) | 1 year | Content hash in filename |
| Nginx | Thumbnails, tile images | 24h | Purge on re-upload |
| Redis | API responses (lists, search) | 60s | On mutation |
| Redis | Session data | 7 days | On logout |
| PostgreSQL | Materialized views (stats) | 5 min | Refresh schedule |

---

## 20. Storage Architecture

### Content-Addressed Layout
```
/storage/
├── originals/          # Source files (never modified)
│   └── sha256/
│       └── aa/bb/<full-sha256-hash>
├── thumbnails/         # WebP thumbnails (200×200)
│   └── <document_id>.webp
├── tiles/              # DZI tile pyramids for large drawings
│   └── <document_id>/
│       ├── metadata.json
│       └── tiles/
│           └── <level>/<x>_<y>.webp
├── ocr/                # Structured OCR output
│   └── <document_id>.json
├── exports/            # Generated reports/exports (temporary)
│   └── <job_id>/
└── temp/               # Processing workspace (auto-cleaned)
    └── <job_id>/
```

### Storage Tiering Policy
| Tier | Storage | Documents | Access Pattern |
|------|---------|-----------|----------------|
| Hot | NVMe SSD | Last 90 days + thumbnails + tiles | Multiple times/day |
| Warm | HDD RAID | 90 days - 2 years | Few times/month |
| Cold | Archive NAS | > 2 years | Few times/year |

### Deduplication
- SHA-256 hash computed on upload
- If hash matches existing file → link to same storage path
- Metadata record created (different document_number may reference same file)
- Saves 15-30% storage for organizations with revision copies

---

## 21. Deployment & Operations

### Docker Compose (Production)
```yaml
services:
  app:
    build: .
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgresql://...
      REDIS_URL: redis://redis:6379
      STORAGE_PATH: /storage
    depends_on: [db, redis]
    deploy:
      replicas: 2

  worker-ocr:
    build: .
    command: node dist/workers/ocr.js
    deploy:
      replicas: 2
      resources:
        limits: { memory: 4G, cpus: '4' }

  worker-index:
    build: .
    command: node dist/workers/indexing.js

  db:
    image: postgres:16-alpine
    volumes: [pgdata:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine

  nginx:
    image: nginx:1.27-alpine
    ports: ["443:443", "80:80"]
    volumes: [./nginx.conf:/etc/nginx/conf.d/default.conf]

  monitoring:
    image: grafana/grafana
    ports: ["3001:3000"]
```

### Hardware (Production, 10L docs, 200 users)
| Component | Spec | Qty |
|-----------|------|-----|
| App Server | 8 vCPU, 32GB RAM, 100GB NVMe | 2 |
| DB Server | 8 vCPU, 64GB RAM, 1TB NVMe | 1+1 replica |
| OCR Workers | 16 vCPU, 32GB RAM, 500GB NVMe | 2 |
| Storage NAS | RAID-6, 10TB, 10GbE | 1 |
| Redis | 4 vCPU, 16GB RAM | 1 |

---

## 22. Testing Strategy

| Type | Tool | Coverage Target |
|------|------|-----------------|
| Unit | Vitest | 80% (business logic) |
| Component | Testing Library | 60% (critical components) |
| Integration | Vitest + test DB | All API endpoints |
| E2E | Playwright | Critical user journeys |
| Load | k6 | 10K/100K/1M doc benchmarks |
| Visual | Chromatic | UI regression detection |
| Security | npm audit + OWASP ZAP | Zero critical/high CVEs |

### Makefile Targets
```makefile
make dev          # Start development server
make build        # Production build
make test         # All unit + integration tests
make test-e2e     # Playwright E2E suite
make lint         # Biome lint + type check
make doctor       # Full preflight (lint + test + build)
make benchmark    # Search + OCR performance tests
make ci           # Complete CI pipeline locally
make deploy       # Build + push Docker images
make backup       # Trigger database backup
make restore      # Restore from latest backup
```

---

## 23. UI/UX Guidelines (Vercel Style)

### Design Principles
1. **Content-first** — Data is the star, not the chrome
2. **Consistent density** — Information-dense but not cluttered
3. **Obvious actions** — Primary action is always clear
4. **Keyboard accessible** — Every action reachable via keyboard
5. **Fast feedback** — Optimistic updates, streaming responses
6. **Progressive disclosure** — Show summary first, detail on demand

### Color System (CSS Variables)
```css
:root {
  --background: 0 0% 100%;
  --foreground: 0 0% 3.9%;
  --card: 0 0% 100%;
  --primary: 172 76% 36%;          /* Teal accent */
  --secondary: 210 20% 96%;
  --muted: 210 20% 96%;
  --muted-foreground: 215 16% 44%;
  --destructive: 0 84% 60%;
  --border: 210 20% 90%;
  --ring: 172 76% 36%;
  --status-success: 142 71% 35%;
  --status-warning: 38 92% 40%;
  --status-danger: 0 84% 45%;
  --status-info: 210 80% 45%;
}
```

### Typography
- Font: `Inter` (system fallback: `-apple-system, system-ui, sans-serif`)
- Base size: 14px
- Scale: 11px (caption) / 12px (small) / 13px (body-sm) / 14px (body) / 16px (h4) / 18px (h3) / 20px (h2) / 24px (h1)
- Weight: 400 (normal), 500 (medium), 600 (semibold)

### Spacing Scale
- 4px base unit
- gap-1 (4px) / gap-2 (8px) / gap-3 (12px) / gap-4 (16px) / gap-6 (24px)
- Card padding: p-4 (default), p-6 (form/dialog)
- Page padding: px-4 (provided by layout)

---

## 24. Migration Plan (From Current App)

### Phase 1: Data Migration
1. Export all documents, PLs, work records from Django PostgreSQL
2. Map Django models to new Drizzle schema
3. Run migration script (preserve UUIDs, timestamps)
4. Verify record counts match

### Phase 2: File Migration
1. Copy /media files to new content-addressed structure
2. Compute SHA-256 for each file
3. Update file_path references in database
4. Verify file integrity with checksums

### Phase 3: User Migration
1. Export user accounts (without passwords)
2. Force password reset for all users
3. Map existing roles to new role system
4. Send notification emails with new login instructions

### Phase 4: Cutover
1. Put old system in read-only mode
2. Run final incremental data sync
3. Switch DNS/proxy to new system
4. Monitor for 48 hours
5. Decommission old system after 2 weeks

---

## 25. Project Timeline & Milestones

### 24-Week Execution Plan

| Sprint | Weeks | Milestone | Deliverables |
|--------|-------|-----------|-------------|
| 1-2 | 1-4 | **Foundation** | Next.js project, auth, DB schema, basic CRUD |
| 3-4 | 5-8 | **Core Modules** | Document upload, PL hub, work ledger |
| 5-6 | 9-12 | **Intelligence** | OCR pipeline, search, extraction |
| 7-8 | 13-16 | **Scale & UX** | Performance tuning, viewer, bulk ops |
| 9-10 | 17-20 | **Admin & Security** | Monitoring, audit, hardening |
| 11-12 | 21-24 | **Launch** | Migration, testing, deployment, training |

### Team Requirement
| Role | Count | Responsibility |
|------|-------|---------------|
| Lead Full-Stack Engineer | 1 | Architecture, API, critical paths |
| Frontend Engineer | 1 | UI components, viewer, dashboard |
| Backend Engineer | 1 | OCR pipeline, search, workers |
| DevOps Engineer | 0.5 | Docker, monitoring, deployment |
| QA Engineer | 0.5 | Testing, load tests, security audit |
| Product Owner | 0.5 | Requirements, user feedback, priorities |

---

*End of Product Specification — LDO-2 EDMS v3*  
*Total scope: ~6 person-months for MVP, ~12 person-months for full feature parity*
