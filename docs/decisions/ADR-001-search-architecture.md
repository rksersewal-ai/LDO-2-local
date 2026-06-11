# ADR-001: Search Architecture for 6 Lakh Engineering Documents

**Date:** June 2026  
**Status:** Proposed  
**Deciders:** Principal Engineer, Backend Lead  
**Technical Area:** Search and Indexing

---

## Context

LDO-2 is an engineering-document intelligence platform targeting 6 lakh (600,000) documents including engineering drawings, specifications, test reports, and standards. Users need to find documents by content (OCR text), metadata (drawing number, PL number, category, status), and relationships (BOM linkage, revision chains).

The system is deployed on-premises (LAN) with no cloud dependencies. Operational simplicity is a priority since the deployment team may not include dedicated search infrastructure specialists.

## Problem

The current system has no full-text search capability at scale. Document discovery relies on metadata filtering only. As the document count grows to 6 lakh, users need sub-500ms full-text search across OCR-extracted text, document titles, and metadata fields. The search must handle engineering-specific queries: partial drawing numbers, PL number patterns, revision codes, and GD&T terminology.

## Current Implementation

- No full-text search index exists
- Documents are stored in PostgreSQL with basic metadata columns
- Filtering is done via Django ORM queries with no text search optimization
- The existing `documents` table has no `tsvector` column or GIN index
- PgBouncer is configured for connection pooling (transaction mode)
- Backend uses DRF serializers for document list endpoints in `backend/documents/views.py`

## Options Considered

### Option A: PostgreSQL GIN with tsvector (Recommended Start)

Add a `search_vector` tsvector column to the documents table, maintain it via triggers, and create a GIN index for fast full-text search. Supplement with pg_trgm for fuzzy/partial matching.

### Option B: Elasticsearch Cluster

Deploy a dedicated Elasticsearch cluster alongside PostgreSQL. Use CDC (Change Data Capture) via Debezium or application-level sync to keep the search index updated.

### Option C: Apache Solr

Deploy Solr as the search backend. Similar to Elasticsearch in capability but with a different operational model.

### Option D: Meilisearch / Typesense

Lightweight search engines designed for instant search. Simpler to operate than Elasticsearch but with fewer features.

## Recommended Decision

**Start with Option A (PostgreSQL GIN + tsvector + pg_trgm), with Option B (Elasticsearch) as a documented scale-out path behind a feature flag.**

Implementation:
1. Add `search_vector TSVECTOR` column to documents table
2. Create GIN index: `CREATE INDEX idx_documents_fts ON documents USING GIN (search_vector)`
3. Add pg_trgm extension for fuzzy matching on document numbers
4. Create trigger to update search_vector on INSERT/UPDATE
5. Add BRIN index on `created_at` for time-range queries
6. Add partial indexes for common filter patterns
7. Feature flag `FEATURE_ELASTICSEARCH` for future Elasticsearch integration

## Why This Decision is Best

1. **Operational simplicity**: PostgreSQL is already deployed and managed. No additional service to monitor, backup, or upgrade.
2. **Proven at scale**: PostgreSQL GIN indexes handle millions of documents with sub-200ms search. 600K is well within proven limits.
3. **Transactional consistency**: Search results are always consistent with the source of truth. No sync lag.
4. **LAN-friendly**: No additional hardware or containers required for the initial deployment.
5. **Cost-effective**: Zero additional licensing or infrastructure cost.
6. **Engineering-domain fit**: pg_trgm handles partial drawing numbers (DWG-12345 matches "DWG-123" query). Custom dictionaries can be loaded for domain terms.
7. **Gradual migration path**: Elasticsearch can be added later behind a feature flag without changing the application API layer.

## Why Alternatives are Rejected or Deferred

### Option B (Elasticsearch) - Deferred

- **Operational overhead**: Requires dedicated JVM tuning, index management, cluster health monitoring, and separate backup procedures.
- **Sync complexity**: CDC or application-level sync introduces eventual consistency. Documents may not appear in search for seconds after creation.
- **Resource requirements**: Elasticsearch recommends 32GB+ RAM for production. This is significant for a LAN deployment.
- **Overkill for 600K**: The advanced features (relevancy tuning, aggregations, nested objects) are not needed at this document count.
- **When to adopt**: If search latency exceeds 500ms at full volume, or if multi-language search / semantic similarity is required.

### Option C (Apache Solr) - Rejected

- **Declining ecosystem**: Community momentum has shifted to Elasticsearch. Fewer integrations with Django/Python.
- **Similar complexity to Elasticsearch**: Same operational burden without the ecosystem benefits.
- **No unique advantage**: Does not solve any problem better than Options A or B.

### Option D (Meilisearch/Typesense) - Rejected

- **Immature for production**: Smaller community, fewer enterprise deployments, less battle-tested at 600K+ documents.
- **Limited query capability**: Weaker support for complex boolean queries, faceted search, and custom scoring.
- **No clear advantage over PostgreSQL GIN**: For our scale and query patterns, PostgreSQL provides equivalent performance with zero additional infrastructure.

## Impact on Current App

### Backend Changes
- Add Django migration: new `search_vector` column + GIN index + trigger
- Add `SearchService` in `backend/shared/services.py` abstracting search behind an interface
- Modify document list viewset to accept `?q=` search parameter
- Add management command to rebuild search index for existing documents

### Frontend Changes
- Add search input to Document Hub with debounced API calls
- Integrate with existing command palette (Ctrl+K) for global search
- Display search result highlights (matched text snippets)

### API Changes
- New query parameter: `GET /api/v1/documents/?q=<search_term>`
- Response includes `_highlights` field with matched snippets
- Backward compatible: existing filters continue to work

## Migration Strategy

1. **Phase 1** (non-breaking): Add `search_vector` column as nullable. Deploy migration.
2. **Phase 2** (background): Run management command to populate search_vector for all existing documents.
3. **Phase 3** (index): Create GIN index (CONCURRENTLY to avoid locking).
4. **Phase 4** (trigger): Add trigger for automatic updates on new/modified documents.
5. **Phase 5** (API): Expose search endpoint. Feature flag: `FEATURE_INSTANT_SEARCH`.
6. **Phase 6** (UI): Add search UI. Enable flag for admin users first.

Total estimated migration time for 600K documents: 30-60 minutes (background, non-blocking).

## Rollback Strategy

1. **Immediate**: Disable `FEATURE_INSTANT_SEARCH` flag. Search UI disappears; API ignores `?q=` parameter.
2. **Full rollback**: Drop GIN index (instant), drop trigger, drop search_vector column via reverse migration.
3. **No data loss**: search_vector is derived data; original documents are unmodified.
4. **Recovery time**: <5 minutes for flag disable; <30 minutes for full schema rollback.

## Performance Impact

| Metric | Before | After | Notes |
|--------|--------|-------|-------|
| Document insert time | ~5ms | ~7ms (+2ms for tsvector computation) | Negligible for user experience |
| Document list query | ~300ms (unindexed) | <150ms (indexed) | Improvement due to proper indexes |
| Full-text search (600K) | Not possible | <500ms (p95 target) | GIN index scan + tsvector match |
| Fuzzy search (partial number) | Not possible | <200ms | pg_trgm GIN index |
| Storage overhead | 0 | ~50GB (tsvector + GIN index for 600K docs) | Acceptable; fits in hot tier |
| Memory usage | Baseline | +2-4GB (GIN index in shared_buffers) | PostgreSQL config: shared_buffers 8GB |

## Security Impact

- **No new attack surface**: Search uses parameterized queries via Django ORM; no SQL injection risk.
- **Access control preserved**: Search results filtered by user permissions before returning. The search index does not bypass RBAC.
- **Data exposure risk**: search_vector contains extracted text. Ensure text sanitization before indexing (no personally identifiable information leaked through search suggestions).
- **Audit logging**: All search queries logged with correlation ID for compliance.

## Operational Complexity

| Aspect | Impact | Mitigation |
|--------|--------|------------|
| Index maintenance | GIN index auto-maintained; no manual intervention | Monitor index size via pg_stat_user_indexes |
| Index rebuild | Required after bulk import (~30-60 min for 600K) | Run via management command during maintenance window |
| Backup size increase | +50GB for search index data | Index is rebuildable; can exclude from backup if size is concern |
| Monitoring | New metrics: search query latency, index size, queue depth | Add Prometheus metrics in search service |
| Failure mode | Index corruption (rare) | REINDEX CONCURRENTLY; or drop + rebuild from source data |

## Acceptance Tests

1. **Functional**: Insert 1000 documents with varied content. Search for specific terms. Verify correct documents returned with correct ranking.
2. **Performance**: Load 600K documents (realistic mix). Verify p95 search latency <500ms with 50 concurrent search requests.
3. **Fuzzy matching**: Search "DWG-123" returns documents with "DWG-12345" and "DWG-12367".
4. **Access control**: User with "viewer" role searches. Results exclude documents they lack permission to view.
5. **Consistency**: Create document. Search for it immediately. Verify it appears (no sync lag since PostgreSQL handles both).
6. **Rebuild**: Run full index rebuild. Verify no downtime and correct results after completion.
7. **Rollback**: Disable feature flag. Verify search UI is hidden and API rejects search parameter gracefully.
