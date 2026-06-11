# LDO-2 EDMS — Roadmap: 8/10 → 10/10 Production-Readiness

**Vision:** Make LDO-2 a production-grade, LAN-deployed EDMS that manages 6 lakh+ engineering documents with competitive OCR, performance, and reliability — superior to Paperless-ngx and Mayan EDMS for industrial/engineering use cases.

**Date:** June 11, 2026  
**Target Completion:** Q1 2027 (6-month execution window)

---

## Table of Contents

1. [Gap Analysis: 8/10 → 10/10](#1-gap-analysis)
2. [User & Admin Experience Roadmap](#2-user--admin-experience)
3. [Performance & Load Handling](#3-performance--load-handling)
4. [OCR Pipeline: Tiled Methodology for Large Drawings](#4-ocr-pipeline)
5. [Storage & Scaling for 6 Lakh Documents](#5-storage--scaling)
6. [Security Hardening to Enterprise Grade](#6-security-hardening)
7. [Reliability & High Availability](#7-reliability--high-availability)
8. [Competitive Feature Matrix](#8-competitive-feature-matrix)
9. [Infrastructure & Deployment Architecture](#9-infrastructure--deployment)
10. [Technology Decisions](#10-technology-decisions)
11. [Phased Execution Plan](#11-phased-execution-plan)
12. [Success Metrics & KPIs](#12-success-metrics)

---

## 1. Gap Analysis: 8/10 → 10/10 {#1-gap-analysis}

| Area | Current (8/10) | Target (10/10) | Gap |
|------|---------------|----------------|-----|
| **OCR** | Basic Tesseract, no tiling | Tiled OCR for A0/A1 drawings, multi-engine | Complete OCR pipeline redesign |
| **Scale** | Tested with ~200 mock docs | 6,00,000 documents with sub-500ms search | Database partitioning, search layer, storage tiering |
| **Performance** | No load testing in CI | p95 < 200ms API, p95 < 500ms search | Caching, connection pooling tuning, read replicas |
| **Reliability** | Single-node Docker | HA with zero-downtime deploys, auto-recovery | Orchestration, health monitoring, circuit breakers |
| **Security** | Basic JWT + CSP | Zero-trust LAN, MFA, audit trails, encryption at rest | SSO, RBAC overhaul, immutable audit log |
| **User Experience** | Functional but dense | Instant search, keyboard-first, offline support | Progressive enhancement, optimistic updates |
| **Admin Experience** | Manual operations | Self-healing, auto-scaling workers, monitoring dashboards | Grafana, alerting, capacity planning |
| **Testing** | 7 test files | 80%+ coverage, visual regression, load tests | Comprehensive test suite |
| **Observability** | Structured logger (unconnected) | Full APM: Sentry + Grafana + distributed tracing | Integration work |
| **Documentation** | Contributing + Runbook | Complete API docs, user manual, admin guide | OpenAPI spec, user docs |

---

## 2. User & Admin Experience {#2-user--admin-experience}

### 2.1 User Experience Enhancements

| Feature | Priority | Impact | Implementation |
|---------|----------|--------|----------------|
| **Instant Search (< 300ms)** | P0 | Users find documents instantly | Elasticsearch with pre-computed suggestions + debounced typeahead |
| **Keyboard-First Navigation** | P0 | Power users never touch mouse | Command palette (exists) + vim-style shortcuts for table navigation |
| **Optimistic Updates** | P1 | UI feels instantaneous | Mutation cache invalidation with React Query |
| **Bulk Operations** | P1 | Handle 100+ docs at once | Multi-select → bulk tag/move/approve/export |
| **Saved Searches & Filters** | P1 | Repeat common workflows | Persist filter states per user |
| **Document Preview (Tiled)** | P0 | View A0 drawings without downloading | Tile-based viewer (like Google Maps for drawings) |
| **Offline-Ready PWA** | P2 | Works during network issues | Service worker for cached assets + queued uploads |
| **Drag-and-Drop Upload** | P1 | Intuitive document ingestion | Drop zone on Document Hub with progress tracking |
| **Real-time Notifications** | P2 | Instant workflow updates | WebSocket/SSE for approval notifications |
| **Dark/Light Theme** | ✅ Done | User preference | Already implemented |
| **Mobile-Responsive** | P2 | Access from tablets on shop floor | Progressive enhancement for touch |
| **Document Annotation** | P2 | Mark up drawings without downloading | Canvas-based annotation layer |

### 2.2 Admin Experience Enhancements

| Feature | Priority | Impact | Implementation |
|---------|----------|--------|----------------|
| **System Health Dashboard** | P0 | At-a-glance infrastructure status | Grafana embedded panels or custom metrics page |
| **OCR Queue Monitor** | P0 | See processing backlog and failures | Real-time queue depth, ETA, retry controls |
| **User Activity Audit** | P0 | Compliance and security | Immutable audit log with search and export |
| **Storage Analytics** | P1 | Capacity planning | Per-department usage, growth projections |
| **Auto-Scaling Workers** | P1 | Handle ingestion spikes | Celery autoscaler based on queue depth |
| **Backup Verification** | P1 | Prove recoverability | Automated restore tests with alerts |
| **Configuration Hot-Reload** | P2 | No-restart config changes | Django constance or similar for runtime settings |
| **Custom Report Builder** | P2 | Flexible analytics | SQL-backed report templates with scheduling |

---

## 3. Performance & Load Handling {#3-performance--load-handling}

### 3.1 Target Performance Benchmarks

| Operation | Target (p95) | Current Estimate | Strategy |
|-----------|-------------|------------------|----------|
| Document list (paginated) | < 150ms | ~300ms | Database indexes + query optimization + cache |
| Full-text search (600K docs) | < 500ms | Unknown (no index) | Elasticsearch cluster or PostgreSQL GIN + tsvector |
| Document download (redirect) | < 200ms | ~400ms | CDN/nginx cache + pre-signed URLs |
| Thumbnail delivery | < 80ms | ~500ms (on-demand) | Pre-generated thumbnails + CDN cache |
| API mutation (create/update) | < 200ms | ~300ms | Optimistic response + async background processing |
| OCR completion (standard doc) | < 30s | ~60s | Worker parallelization + GPU acceleration |
| OCR completion (A0 drawing) | < 3min | Not supported | Tiled pipeline with 8 parallel workers |
| Concurrent users | 200+ | ~50 | Horizontal scaling + connection pooling |
| Upload throughput | 50 docs/min | ~10 docs/min | Batch processing + async queues |

### 3.2 Caching Architecture

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│  Browser    │ ←→ │  Nginx/CDN   │ ←→ │  Redis      │
│  (SW Cache) │    │  (Static +   │    │  (Session + │
│             │    │   Thumbnails) │    │   API Cache) │
└─────────────┘    └──────────────┘    └─────────────┘
                         ↓
              ┌────────────────────┐
              │  Django + DRF      │
              │  (ViewSet caching) │
              └────────────────────┘
                         ↓
              ┌────────────────────┐
              │  PostgreSQL        │
              │  (Materialized     │
              │   views for stats) │
              └────────────────────┘
```

**Caching Layers:**
1. **Browser**: Service Worker caches static assets (JS/CSS/fonts) — instant page loads
2. **Nginx**: Serves thumbnails/previews from disk cache (1yr immutable headers)
3. **Redis**: API response cache (document lists, search results) with 60s TTL
4. **Django**: Per-view cache decorators for expensive queries (dashboard stats)
5. **PostgreSQL**: Materialized views for aggregated statistics (refresh every 5 min)

### 3.3 Connection Pooling & Database Optimization

```yaml
# PgBouncer Configuration (production-optimized)
pool_mode: transaction          # Release connection after each transaction
max_client_conn: 500            # Handle 500 app connections
default_pool_size: 40           # 40 real PostgreSQL connections
reserve_pool_size: 10           # Extra connections for burst
server_idle_timeout: 300        # Reclaim idle connections
query_wait_timeout: 30          # Fail fast if pool exhausted
```

**Database Indexes (Critical for 600K docs):**
```sql
-- Full-text search (GIN index on tsvector column)
CREATE INDEX idx_documents_fts ON documents USING GIN (search_vector);

-- Time-range queries (BRIN for append-only data)
CREATE INDEX idx_documents_created ON documents USING BRIN (created_at);

-- Common filter patterns
CREATE INDEX idx_documents_status ON documents (status) WHERE status != 'OBSOLETE';
CREATE INDEX idx_documents_category_status ON documents (category, status);
CREATE INDEX idx_documents_owner ON documents (owner_id, created_at DESC);

-- Deduplication (partial index for active fingerprints)
CREATE INDEX idx_documents_hash ON documents (sha256) WHERE sha256 IS NOT NULL;

-- PL linkage (many-to-many join optimization)
CREATE INDEX idx_doc_pl_link ON document_pl_links (document_id, pl_number_id);
```

---

## 4. OCR Pipeline: Tiled Methodology for Large Drawings {#4-ocr-pipeline}

### 4.1 Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                    OCR Pipeline (Celery)                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────────────┐  │
│  │ Ingest   │ → │ Pre-Process  │ → │ Layout Analysis      │  │
│  │ (Upload/ │   │ (Deskew,     │   │ (Detect: title block,│  │
│  │  Consume)│   │  Binarize,   │   │  BOM table, notes,   │  │
│  │          │   │  Normalize)  │   │  drawing area)       │  │
│  └──────────┘   └──────────────┘   └──────────────────────┘  │
│                                              ↓                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              TILING ENGINE                                │ │
│  │                                                          │ │
│  │  Input: Full image (14000×9900px for A0 at 300DPI)       │ │
│  │                                                          │ │
│  │  Strategy:                                               │ │
│  │  ┌─────┬─────┬─────┬─────┐                              │ │
│  │  │ T1  │ T2  │ T3  │ T4  │  ← 4096×4096 tiles          │ │
│  │  ├─────┼─────┼─────┼─────┤     with 15% overlap         │ │
│  │  │ T5  │ T6  │ T7  │ T8  │                              │ │
│  │  ├─────┼─────┼─────┼─────┤                              │ │
│  │  │ T9  │ T10 │ T11 │ T12 │                              │ │
│  │  └─────┴─────┴─────┴─────┘                              │ │
│  │                                                          │ │
│  │  Parallel OCR: Each tile processed independently          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                          ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │           MERGE & DEDUPLICATION                           │ │
│  │                                                          │ │
│  │  1. Transform tile coordinates → global coordinates       │ │
│  │  2. IoU-based dedup in overlap zones (threshold: 0.6)     │ │
│  │  3. Keep higher-confidence result for duplicates          │ │
│  │  4. Spatial sorting → reading order reconstruction        │ │
│  │  5. Region classification (title block, BOM, notes)       │ │
│  └──────────────────────────────────────────────────────────┘ │
│                          ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │           POST-PROCESSING                                 │ │
│  │                                                          │ │
│  │  - Drawing number extraction (regex: DWG-XXXXX)           │ │
│  │  - Part number detection (PL 8-digit pattern)             │ │
│  │  - Revision code extraction                               │ │
│  │  - Dimension/tolerance parsing (GD&T notation)            │ │
│  │  - BOM table structured extraction                        │ │
│  │  - Full-text indexing into Elasticsearch/PostgreSQL        │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

### 4.2 Tile Configuration

| Drawing Size | Pixels (300 DPI) | Tile Size | Overlap | Tiles Generated | Est. OCR Time |
|--------------|-----------------|-----------|---------|-----------------|---------------|
| A4 (210×297mm) | 2480×3508 | No tiling needed | — | 1 | 5-10s |
| A3 (297×420mm) | 3508×4960 | 4096×4096 | 15% | 2 | 15-20s |
| A2 (420×594mm) | 4960×7016 | 4096×4096 | 15% | 4 | 30-45s |
| A1 (594×841mm) | 7016×9933 | 4096×4096 | 15% | 6 | 60-90s |
| A0 (841×1189mm) | 9933×14043 | 4096×4096 | 15% | 12 | 120-180s |

### 4.3 Implementation Specifications

```python
# Tile OCR Configuration
TILE_OCR_CONFIG = {
    "tile_size": 4096,           # pixels per tile edge
    "overlap_percent": 15,       # 15% overlap between adjacent tiles
    "min_image_size_for_tiling": 5000,  # Only tile images > 5000px
    "max_parallel_tiles": 8,     # Concurrent OCR workers per document
    "confidence_threshold": 60,  # Discard OCR results below 60%
    "iou_dedup_threshold": 0.6,  # IoU threshold for overlap deduplication
    "dpi_target": 400,           # Upscale to 400 DPI for engineering text
    "tesseract_config": {
        "psm": 6,               # Assume uniform block of text
        "oem": 3,               # LSTM + legacy engine
        "languages": "eng",
        "custom_dict": "engineering_terms.traineddata",
    },
    "layout_detection": {
        "enabled": True,
        "model": "detectron2_publaynet",  # Or custom fine-tuned
        "regions": ["title_block", "bom_table", "revision_table", "notes", "drawing_area"],
    },
}
```

### 4.4 Tiled Document Viewer (Frontend)

For viewing A0/A1 drawings in the browser without downloading full resolution:

```
┌─────────────────────────────────────────────┐
│  Tiled Document Viewer (OpenSeadragon-style) │
├─────────────────────────────────────────────┤
│                                             │
│  - Deep Zoom Image (DZI) pyramid generation │
│  - Zoom levels: 8 (1:1 to 1:256)           │
│  - Tile size: 256×256 px per tile           │
│  - Lazy loading: only visible tiles loaded  │
│  - Pan/zoom with mouse + pinch gestures     │
│  - OCR text overlay toggle (click-to-copy)  │
│  - Annotation layer (comments, markups)     │
│                                             │
│  Tech: OpenSeadragon or Leaflet.js          │
│  Storage: Pre-generated DZI tile pyramid    │
│  Backend: Generate on first view, cache     │
│                                             │
└─────────────────────────────────────────────┘
```

### 4.5 Custom Setup Requirements (OCR Infrastructure)

| Component | Specification | Purpose |
|-----------|---------------|---------|
| **Tesseract 5.x** | Custom-compiled with LSTM models | Primary OCR engine |
| **Engineering Dictionary** | Custom `.traineddata` with part numbers, GD&T symbols | Improved accuracy for technical text |
| **Layout Detection Model** | Detectron2 or YOLOv8 fine-tuned on engineering drawings | Identify title blocks, BOM tables, revision tables |
| **Image Processing** | OpenCV + Pillow + pdf2image | Pre-processing pipeline |
| **PDF Rendering** | Poppler (pdftocairo) at 400 DPI | High-quality rasterization for PDF inputs |
| **TIFF Support** | libtiff + Pillow | Handle multi-page TIFF engineering scans |
| **GPU (Optional)** | NVIDIA GPU with CUDA | 3-5x faster layout detection inference |
| **Memory** | 16GB+ per OCR worker | Large TIFF decompression in memory |
| **Storage** | NVMe SSD for temp tiles | Fast I/O during tile generation |

---

## 5. Storage & Scaling for 6 Lakh Documents {#5-storage--scaling}

### 5.1 Storage Estimation

| Document Type | Avg Size | Count | Total Storage |
|---------------|----------|-------|---------------|
| Engineering Drawings (A0-A2) | 25 MB | 1,00,000 | 2.5 TB |
| Specifications (PDF) | 5 MB | 1,50,000 | 750 GB |
| Standards/Procedures | 2 MB | 1,00,000 | 200 GB |
| Test Reports/Certificates | 3 MB | 1,50,000 | 450 GB |
| Miscellaneous | 1 MB | 1,00,000 | 100 GB |
| **Total Raw Storage** | — | **6,00,000** | **~4 TB** |
| OCR Text + Indexes | — | — | ~50 GB |
| Thumbnails + DZI Tiles | — | — | ~200 GB |
| **Grand Total** | — | — | **~4.5 TB** |

### 5.2 Storage Tiering Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    STORAGE TIERS                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  HOT (NVMe SSD) — 500 GB                                   │
│  ├── Recently uploaded (< 90 days)                          │
│  ├── Thumbnails & DZI tile pyramids                         │
│  ├── Search indexes (PostgreSQL + Elasticsearch)            │
│  └── Active document metadata                               │
│                                                             │
│  WARM (HDD / NAS RAID-6) — 3 TB                            │
│  ├── Documents 90 days - 2 years old                        │
│  ├── Accessed < 5 times/month                               │
│  └── Full OCR text stored alongside                         │
│                                                             │
│  COLD (Object Storage / LTO Tape) — Archive                 │
│  ├── Documents > 2 years old                                │
│  ├── Accessed < 1 time/quarter                              │
│  ├── Compliance retention (15 years for railways)           │
│  └── Read-only, integrity-verified                          │
│                                                             │
│  POLICY ENGINE:                                             │
│  - Auto-migrate based on access frequency + age             │
│  - Transparent to users (same URL, lazy retrieval)          │
│  - Hot → Warm: after 90 days of no access                   │
│  - Warm → Cold: after 2 years                               │
│  - Cold → Warm: on access (with 5-30s delay notification)   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Database Partitioning Strategy

```sql
-- Range partition documents by year-month
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_number TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- ... other columns
    search_vector TSVECTOR
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE documents_2024_01 PARTITION OF documents
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE documents_2024_02 PARTITION OF documents
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
-- ... automated via pg_partman

-- Partition pruning makes time-range queries touch only relevant partitions
-- VACUUM and REINDEX operate per-partition (no full-table locks)
```

### 5.4 Search Architecture (600K+ Documents)

**Decision: PostgreSQL Full-Text Search + Optional Elasticsearch**

For 6 lakh documents, PostgreSQL with GIN indexes handles full-text search efficiently (< 100ms for most queries). Elasticsearch is recommended only if:
- Complex relevancy ranking is needed
- Multi-language search is required
- More-like-this / semantic search is desired

```
Option A (Recommended for LAN deployment):
  PostgreSQL GIN + pg_trgm → handles 600K docs with < 200ms search

Option B (For future growth beyond 10L documents):
  PostgreSQL (source of truth) + Elasticsearch (search layer)
  CDC sync via Debezium or manual indexing triggers
```

---

## 6. Security Hardening to Enterprise Grade {#6-security-hardening}

### 6.1 Authentication & Authorization

| Feature | Current | Target | Implementation |
|---------|---------|--------|----------------|
| Auth Method | JWT (username/password) | SSO + MFA + JWT fallback | Keycloak/ADFS integration via OIDC |
| MFA | None | TOTP for all admin users | django-otp + QR enrollment |
| Session Management | JWT with refresh | Short-lived access (15min) + secure refresh (7d) | Rotate refresh tokens on use |
| API Authentication | Bearer token | Token + API key + HMAC for service accounts | Per-integration API keys with scoped permissions |
| Permission Model | Role-based (5 roles) | Role + Object-level + Attribute-based | Django Guardian + custom policy engine |

### 6.2 Encryption

| Layer | Current | Target | Implementation |
|-------|---------|--------|----------------|
| In Transit | TLS (Nginx) | TLS 1.3 mandatory (LAN too) | Certificate management via Vault/mkcert |
| At Rest (DB) | None | Transparent Data Encryption | PostgreSQL pgcrypto + encrypted tablespace |
| At Rest (Files) | None | AES-256 encrypted storage volumes | LUKS/dm-crypt on storage volumes |
| At Rest (Backups) | None | Encrypted backups with separate key | GPG-encrypted pg_dump output |

### 6.3 Audit & Compliance

```python
# Immutable Audit Log Schema
class AuditEntry:
    id: UUID
    timestamp: datetime        # Server-side, tamper-resistant
    user_id: UUID
    action: str               # VIEW, DOWNLOAD, CREATE, UPDATE, DELETE, APPROVE, REJECT
    resource_type: str        # document, work_record, approval, pl_number
    resource_id: UUID
    details: JSON             # Changed fields, before/after values
    ip_address: str
    user_agent: str
    session_id: UUID
    hash: str                 # SHA-256 of previous entry + current entry (hash chain)
    
# Properties:
# - Append-only table (no UPDATE/DELETE permissions for any user)
# - Hash chain provides tamper detection
# - Retention: 15 years (configurable per compliance regime)
# - Real-time alerting on suspicious patterns
```

### 6.4 Network Security (LAN Deployment)

```
┌─────────────────────────────────────────────────────────────┐
│                 NETWORK ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  VLAN 10: User Workstations                                 │
│  ├── Only HTTPS (443) allowed to VLAN 20                    │
│  └── No direct access to DB/Storage/Redis                   │
│                                                             │
│  VLAN 20: Application Tier (DMZ)                            │
│  ├── Nginx reverse proxy (443 inbound)                      │
│  ├── Django/Gunicorn (8420, internal only)                  │
│  ├── Celery workers (no inbound ports)                      │
│  └── Allowed: → VLAN 30 (DB), → VLAN 40 (Storage)          │
│                                                             │
│  VLAN 30: Database Tier                                     │
│  ├── PostgreSQL (5432, from VLAN 20 only)                   │
│  ├── Redis (6379, from VLAN 20 only)                        │
│  └── Elasticsearch (9200, from VLAN 20 only)                │
│                                                             │
│  VLAN 40: Storage Tier                                      │
│  ├── NAS/SAN (NFS/iSCSI, from VLAN 20 only)               │
│  ├── Backup target (from VLAN 30 only)                      │
│  └── Scanner input endpoint (from Scanner VLAN only)        │
│                                                             │
│  VLAN 50: Management/Monitoring                             │
│  ├── Grafana, Prometheus, Loki                              │
│  ├── Backup management                                      │
│  └── Admin SSH jump box                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Reliability & High Availability {#7-reliability--high-availability}

### 7.1 Architecture for Zero-Downtime

| Component | HA Strategy | RTO | RPO |
|-----------|-------------|-----|-----|
| Frontend | 2+ Nginx instances behind HAProxy/Keepalived | < 1s (failover) | 0 (stateless) |
| Backend API | 2+ Gunicorn instances, load-balanced | < 5s | 0 (stateless) |
| Database | PostgreSQL streaming replication (1 primary + 1 replica) | < 30s (auto-failover via Patroni) | < 1s (sync replication) |
| Redis | Redis Sentinel (1 primary + 2 replicas) | < 10s | Last-second writes |
| Celery Workers | 4+ workers across 2 nodes | < 5s (auto-restart) | Task requeued |
| Storage | RAID-6 + nightly backup | < 1h (restore from backup) | < 24h |

### 7.2 Backup Strategy

```
Schedule:
  - Full database backup: Daily at 02:00 (pg_dump --format=custom)
  - WAL archiving: Continuous (Point-in-Time Recovery capable)
  - File storage backup: Daily incremental (rsync/restic)
  - Backup verification: Weekly automated restore test
  
Retention:
  - Daily backups: 30 days
  - Weekly backups: 12 weeks
  - Monthly backups: 24 months
  - Yearly backups: 15 years (compliance)

Storage:
  - Primary backup: Separate NAS on VLAN 50
  - Secondary backup: Off-site or different building (for DR)
  - Encryption: AES-256 with key stored in hardware security module
```

### 7.3 Monitoring & Alerting

| Metric | Warning | Critical | Alert Channel |
|--------|---------|----------|---------------|
| API p95 latency | > 500ms | > 2000ms | Slack/Email |
| OCR queue depth | > 50 | > 200 | Slack |
| Database connections | > 80% pool | > 95% pool | PagerDuty |
| Storage utilization | > 80% | > 90% | Email + Slack |
| Error rate (5xx) | > 1% | > 5% | PagerDuty |
| Failed OCR jobs | > 5/hour | > 20/hour | Slack |
| Backup age | > 26 hours | > 48 hours | PagerDuty |
| SSL certificate expiry | < 30 days | < 7 days | Email |

---

## 8. Competitive Feature Matrix {#8-competitive-feature-matrix}

| Feature | Paperless-ngx | Mayan EDMS | LDO-2 (Target) | Notes |
|---------|--------------|------------|-----------------|-------|
| Engineering drawing support | Basic | Basic | **Tiled OCR + DZI viewer** | Our differentiator |
| BOM/Parts List integration | No | No | **Yes (native)** | Unique to LDO-2 |
| Work record management | No | No | **Yes (native)** | Unique to LDO-2 |
| Workflow engine | No | Yes (visual) | **Yes (django-fsm + approval queues)** | Competitive |
| Full-text search | Whoosh (slow) | PostgreSQL | **PostgreSQL GIN + optional ES** | Faster |
| OCR engine | Tesseract only | Tesseract | **Tesseract + EasyOCR + tiled pipeline** | Superior for large docs |
| Multi-user permissions | Object-level | Document-level | **Role + Object + Attribute-based** | Most flexible |
| REST API | Full (DRF) | Full (DRF) | **Full (DRF) + OpenAPI spec** | Equivalent |
| LAN deployment | Docker | Docker | **Docker + Kubernetes-ready** | More scalable |
| Consumption pipeline | Folder watch + Email | Folder watch | **Folder watch + Upload + Scanner API** | Competitive |
| Deduplication | Hash-based | No | **Multi-algorithm (hash + fingerprint + metadata)** | Superior |
| Audit trail | Basic | Basic | **Immutable hash-chain audit log** | Enterprise-grade |
| Compliance (retention) | No | No | **Configurable per document type** | Industrial-grade |
| Engineering-specific metadata | No | Custom fields | **Native: PL number, drawing number, revision, IC category** | Purpose-built |
| Large drawing viewer | No | No | **Tiled DZI viewer with OCR overlay** | Unique |
| SSO/MFA | No | No (plugin) | **Keycloak/OIDC + TOTP** | Enterprise-ready |

---

## 9. Infrastructure & Deployment Architecture {#9-infrastructure--deployment}

### 9.1 Production Deployment (LAN)

```
┌─────────────────────────────────────────────────────────────────┐
│                 PRODUCTION ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Load Balancer (HAProxy / Keepalived VIP)                       │
│  ├── SSL termination (TLS 1.3)                                  │
│  ├── Health check routing                                       │
│  └── Rate limiting (100 req/s per IP)                           │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────┐  ┌──────────────────┐                   │
│  │ Frontend (Nginx) │  │ Frontend (Nginx) │  ← Static assets  │
│  │ Instance 1       │  │ Instance 2       │                    │
│  └──────────────────┘  └──────────────────┘                   │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────┐  ┌──────────────────┐                   │
│  │ Backend (Gunicorn)│  │ Backend (Gunicorn)│  ← API servers  │
│  │ 4 workers        │  │ 4 workers        │                    │
│  └──────────────────┘  └──────────────────┘                   │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │ PostgreSQL   │  │ Redis        │  │ Elasticsearch     │    │
│  │ (Primary)    │  │ (Sentinel)   │  │ (Optional)        │    │
│  │ + Replica    │  │ 3 nodes      │  │ Single node       │    │
│  └──────────────┘  └──────────────┘  └──────────────────┘    │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Celery Workers (OCR + Indexing + Notifications)           │ │
│  │ ├── 4 workers: default queue (API tasks, notifications)   │ │
│  │ ├── 4 workers: OCR queue (CPU-intensive, tiled pipeline)  │ │
│  │ ├── 2 workers: indexing queue (search index updates)      │ │
│  │ └── 1 worker: beat scheduler (periodic tasks)             │ │
│  └──────────────────────────────────────────────────────────┘ │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Storage (RAID-6 NAS)                                      │ │
│  │ ├── /documents/hot/   (NVMe, 500GB)                       │ │
│  │ ├── /documents/warm/  (HDD, 3TB)                          │ │
│  │ ├── /thumbnails/      (SSD, 200GB)                        │ │
│  │ └── /backups/         (Separate NAS, 5TB)                 │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Hardware Requirements (Production - 600K Documents, 100 Concurrent Users)

| Component | Specification | Quantity | Purpose |
|-----------|--------------|----------|---------|
| Application Server | 8 vCPU, 32GB RAM, 100GB NVMe | 2 | Django + Nginx (active-active) |
| Database Server | 8 vCPU, 64GB RAM, 1TB NVMe | 1 (+1 replica) | PostgreSQL + indexes in RAM |
| OCR Worker Node | 16 vCPU, 32GB RAM, 500GB NVMe | 1-2 | CPU-intensive OCR processing |
| Storage NAS | RAID-6, 8TB usable, 10GbE | 1 | Document file storage |
| Redis/Elasticsearch | 4 vCPU, 16GB RAM | 1 | Cache + search + queue |
| Backup NAS | 16TB, separate location | 1 | Off-site backup |

**Estimated Total Cost (on-premise):** ₹15-25 lakhs hardware investment
**Operational Cost:** ₹2-4 lakhs/year (power, maintenance, licensing)

---

## 10. Technology Decisions {#10-technology-decisions}

### Decisions Required

| # | Decision | Options | Recommended | Rationale |
|---|----------|---------|-------------|-----------|
| D1 | Search engine | PostgreSQL GIN only vs. Elasticsearch | **PostgreSQL GIN** (start), add ES later if needed | Simpler ops for LAN; GIN handles 600K easily |
| D2 | OCR engine | Tesseract only vs. Tesseract + EasyOCR | **Tesseract primary + EasyOCR fallback** | EasyOCR better for non-Latin; Tesseract faster for English |
| D3 | Layout detection | Rule-based vs. ML model | **Rule-based first**, ML as enhancement | Title blocks have consistent locations; ML adds complexity |
| D4 | Drawing viewer | OpenSeadragon vs. Leaflet.js | **OpenSeadragon** | Purpose-built for deep zoom; better engineering drawing support |
| D5 | SSO provider | Keycloak vs. ADFS | **Keycloak** (self-hosted) | Open-source, LAN-friendly, OIDC/SAML support |
| D6 | Monitoring stack | Prometheus+Grafana vs. Datadog | **Prometheus + Grafana + Loki** | LAN-friendly, no cloud dependency, free |
| D7 | Container orchestration | Docker Compose vs. K8s | **Docker Compose** (start), K8s for >200 users | Simpler ops; K8s overkill for initial deployment |
| D8 | File storage | Local filesystem vs. MinIO (S3-compatible) | **Local filesystem** with tiering script | Simplest for LAN; MinIO if multi-node needed |
| D9 | Replace xlsx dependency | exceljs vs. @sheet/core | **exceljs** | Active maintenance, MIT license, npm-hosted |
| D10 | Replace react-dnd | @dnd-kit/core vs. pragmatic-drag-and-drop | **@dnd-kit/core** | Best a11y, React-first, actively maintained |

---

## 11. Phased Execution Plan {#11-phased-execution-plan}

### Sprint 1-2 (Weeks 1-4): Foundation

| Task | Owner | Deliverable |
|------|-------|-------------|
| Connect Sentry error reporting | Frontend | Errors flow to Sentry dashboard |
| Replace `xlsx` with `exceljs` | Frontend | Export functionality preserved |
| Replace `react-dnd` with `@dnd-kit` | Frontend | BOM drag-and-drop works |
| Split god components (PLDetail, DeduplicationConsole) | Frontend | No file > 800 lines |
| Add backend API test coverage to 60%+ | Backend | pytest coverage report |
| Set up Prometheus + Grafana on monitoring VLAN | DevOps | Basic dashboards live |
| Implement database partitioning (monthly) | Backend | pg_partman configured |

### Sprint 3-4 (Weeks 5-8): OCR Pipeline v1

| Task | Owner | Deliverable |
|------|-------|-------------|
| Implement tiled OCR pipeline | Backend | Large drawings process correctly |
| Add pre-processing stage (deskew, binarize, DPI normalize) | Backend | Consistent input quality |
| Implement tile coordinate merge + dedup | Backend | No duplicate text in output |
| Add engineering-specific post-processing (DWG/PL extraction) | Backend | Structured metadata from OCR |
| Generate DZI tile pyramids for large documents | Backend | Efficient storage of zoom levels |
| Build tiled document viewer (OpenSeadragon) | Frontend | Pan/zoom on A0 drawings |
| Load test with 10K documents | QA | Performance baseline established |

### Sprint 5-6 (Weeks 9-12): Scale & Security

| Task | Owner | Deliverable |
|------|-------|-------------|
| Implement storage tiering (hot/warm/cold) | Backend/DevOps | Automatic migration policies |
| Add PostgreSQL GIN full-text search with tsvector | Backend | Sub-200ms search at 100K docs |
| Implement immutable audit log with hash chain | Backend | Tamper-evident audit trail |
| Add MFA (TOTP) for admin users | Backend | django-otp integration |
| Configure PgBouncer for 500 connections | DevOps | Handle concurrent load |
| Add Redis caching layer for API responses | Backend | 60s TTL on list endpoints |
| Load test with 100K documents | QA | Performance verified at scale |

### Sprint 7-8 (Weeks 13-16): Reliability & HA

| Task | Owner | Deliverable |
|------|-------|-------------|
| Set up PostgreSQL streaming replication | DevOps | Automatic failover via Patroni |
| Configure Redis Sentinel (3 nodes) | DevOps | Redis auto-failover |
| Implement automated backup with verification | DevOps | Daily backup + weekly restore test |
| Add health checks + circuit breakers | Backend | Graceful degradation |
| Implement bulk import pipeline (batch OCR) | Backend | 50 docs/min sustained |
| Add saved searches + filter persistence | Frontend | User productivity feature |
| Implement real-time notifications (WebSocket) | Full-stack | Instant approval alerts |

### Sprint 9-10 (Weeks 17-20): Polish & Documentation

| Task | Owner | Deliverable |
|------|-------|-------------|
| Load test with 600K documents (full target) | QA | Performance meets benchmarks |
| Complete user manual | Technical Writer | PDF/HTML user guide |
| Complete admin guide | Technical Writer | Operations manual |
| OpenAPI spec + Swagger UI for all endpoints | Backend | Interactive API documentation |
| Security audit (external) | Security Team | Penetration test report |
| Implement SSO (Keycloak) | Backend/DevOps | OIDC login for all users |
| Final performance tuning | All | All targets met |

### Sprint 11-12 (Weeks 21-24): Launch Preparation

| Task | Owner | Deliverable |
|------|-------|-------------|
| Production deployment on target hardware | DevOps | System live on LAN |
| Data migration from legacy system | Backend | All existing documents imported |
| User training sessions | Product | All user roles trained |
| Monitoring dashboard tuning | DevOps | Alerts calibrated |
| 2-week burn-in period | All | Stability validated |
| Launch 🚀 | All | System in production |

---

## 12. Success Metrics & KPIs {#12-success-metrics}

### Production-Readiness (10/10) Checklist

| Criterion | Target | Measurement |
|-----------|--------|-------------|
| API p95 latency | < 200ms | Prometheus histogram |
| Search latency (600K docs) | < 500ms | Prometheus histogram |
| OCR success rate | > 95% | Celery task metrics |
| System uptime | 99.9% (8.7 hours downtime/year) | Monitoring dashboard |
| Backup age | Never > 24 hours | Alert trigger |
| Security scan | Zero critical/high CVEs | Monthly audit |
| Test coverage (frontend) | > 70% | CI coverage report |
| Test coverage (backend) | > 80% | CI coverage report |
| WCAG AA compliance | 100% | axe-core audit |
| Document storage capacity | 6 lakh+ verified | Load test |
| Concurrent users | 200+ without degradation | Load test |
| Deployment time | < 10 minutes (zero-downtime) | Measured |
| Recovery time (RTO) | < 30 minutes | DR drill |
| Data loss window (RPO) | < 1 minute | WAL streaming lag |

### Business KPIs

| KPI | Target | Measurement |
|-----|--------|-------------|
| Document findability | < 15 seconds to locate any document | User study |
| OCR accuracy (engineering text) | > 90% character accuracy | Sample verification |
| User adoption | > 90% of target users active within 30 days | Login analytics |
| Document processing SLA | 95% processed within 5 minutes of upload | Queue metrics |
| Admin intervention rate | < 2% of uploads require manual correction | Exception logs |

---

## Summary: What Makes This a 10/10

1. **Purpose-built for engineering** — BOM/PL integration, tiled OCR for large drawings
2. **Scale-proven** — 6 lakh documents with sub-500ms search, verified via load testing
3. **Industrial-grade reliability** — HA, automatic failover, immutable audit trails
4. **Superior OCR** — Tiled pipeline handles A0 drawings that break competitor systems
5. **Enterprise security** — Zero-trust LAN, MFA, encrypted storage, hash-chain audit
6. **Observable** — Full Grafana stack with alerting and capacity planning
7. **Tested** — 80%+ coverage, E2E, load tests, security audit
8. **Documented** — User manual, admin guide, API docs, deployment runbook
9. **Competitive** — Feature-parity with Paperless-ngx/Mayan plus engineering-specific capabilities
10. **Future-proof** — Kubernetes-ready, storage tiering, modular OCR pipeline

---

*Roadmap authored by: Kiro (Principal Engineer)*  
*Date: June 11, 2026*  
*Estimated execution: 24 weeks (6 months)*  
*Team requirement: 2 full-stack + 1 DevOps + 1 QA*
