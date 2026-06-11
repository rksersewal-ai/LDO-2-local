# ADR-004: Storage Architecture for 6 Lakh Document Capacity

**Date:** June 2026  
**Status:** Proposed  
**Deciders:** Principal Engineer, DevOps Lead  
**Technical Area:** Storage, Tiering, and Content Management

---

## Context

LDO-2 targets management of 6 lakh (600,000) engineering documents totaling approximately 4.5 TB of raw storage. The system is deployed on-premises (LAN) in an industrial environment where documents have long retention requirements (up to 15 years for railway/nuclear compliance). Storage must be cost-effective, performant for active documents, and compliant for archived ones.

The engineering-document intelligence niche requires content-addressed storage (for deduplication), integrity verification (for compliance), and transparent access across storage tiers (so users do not need to know where a document physically resides).

## Problem

With 6 lakh documents at approximately 4.5 TB total:

1. Storing everything on high-performance NVMe is cost-prohibitive (~$500/TB vs $50/TB for HDD)
2. Access patterns are highly skewed: 90% of accesses target 10% of documents (recently uploaded or frequently referenced)
3. Compliance requires documents to be retained for 15+ years but rarely accessed after 2 years
4. Duplicate uploads (same document, different filenames) waste 20-40% of storage
5. Document integrity must be verifiable at any time (detect bit rot, unauthorized modification)
6. Retrieval from cold storage must be transparent to users (no "file not found" errors)

## Current Implementation

- Documents are stored in Docker volumes (single tier, no tiering)
- No content-addressing or deduplication exists
- The `documents` app has a `file_path` field in the model
- Docker Compose mounts a named volume for document storage
- No integrity checking (checksums not stored or verified)
- The deduplication console exists in the frontend (`DeduplicationConsole.tsx`, 2,309 lines) for detecting duplicate metadata, but not content-level deduplication
- No backup automation or verification

## Options Considered

### Option A: Content-Addressed Storage with Hot/Warm/Cold Tiering (Recommended)

Store files by SHA-256 hash (content-addressed). Implement three storage tiers with automated migration policies. Transparent retrieval from any tier.

### Option B: Single-Tier NAS with RAID-6

Store all documents on a single NAS with RAID-6 redundancy. No tiering, no content addressing.

### Option C: MinIO (S3-Compatible Object Storage)

Deploy MinIO as an on-premises S3-compatible object store with lifecycle policies.

### Option D: Ceph Distributed Storage

Deploy Ceph cluster for distributed, replicated object/block/file storage.

## Recommended Decision

**Option A: Content-addressed storage with three-tier automated migration, deployed behind feature flag `FEATURE_STORAGE_TIERING`.**

Storage design:
- **Content addressing**: Files stored as `{sha256_prefix}/{sha256_full}` with original filename in metadata
- **Deduplication**: Same content uploaded twice stores only one physical copy
- **Integrity**: SHA-256 verified on upload and periodically (weekly CRON)
- **Immutability**: Files never modified after write; new version = new file with new hash

Tier layout:

| Tier | Media | Capacity | Use Case | Migration Trigger |
|------|-------|----------|----------|-------------------|
| Hot | NVMe SSD | 500 GB | Recent uploads (<90 days), thumbnails, DZI tiles | Default for new files |
| Warm | HDD RAID-6 NAS | 3 TB | Documents 90 days - 2 years, infrequent access | 90 days no access |
| Cold | Object storage or LTO tape | Archive (expandable) | Documents >2 years, compliance retention | 2 years no access |

## Why This Decision is Best

1. **Cost optimization**: 85% of documents (by count) live on inexpensive HDD/archive. Only active 15% on expensive NVMe. Estimated 60% cost reduction vs all-NVMe.
2. **Content deduplication**: SHA-256 addressing eliminates 20-40% of storage waste from duplicate uploads. Critical at 4.5TB scale.
3. **Compliance-ready**: Immutable storage + integrity verification + 15-year retention on cold tier meets railway/nuclear audit requirements.
4. **Performance where it matters**: Hot tier (NVMe) serves recently uploaded and frequently accessed documents at full speed. Users never notice tiering.
5. **Transparent access**: Application layer resolves file location across tiers. User requests document by ID; system retrieves from wherever it resides.
6. **Bit rot detection**: Periodic integrity checks catch silent data corruption before it causes data loss.
7. **Backup efficiency**: Content-addressed storage is backup-friendly (deduplicated at source, incremental sync is fast).
8. **Scalable**: Each tier grows independently. Add more HDD when warm fills; add more tape when cold fills.

## Why Alternatives are Rejected or Deferred

### Option B (Single-Tier NAS) - Rejected

- **No cost optimization**: All 4.5TB on the same media regardless of access frequency.
- **No deduplication**: Duplicate files consume full space.
- **No integrity verification**: No mechanism to detect corruption.
- **Performance cliff**: As NAS fills, performance degrades for all documents equally.
- **Acceptable only for**: Very small deployments (<100K documents) where simplicity outweighs efficiency.

### Option C (MinIO) - Deferred

- **Operational overhead**: MinIO requires its own cluster management, monitoring, and upgrade process.
- **Resource intensive**: Minimum viable MinIO deployment needs 4 nodes with 4 drives each for erasure coding.
- **Complexity mismatch**: For a single-site LAN deployment, MinIO's distributed features are overkill.
- **When to adopt**: If multi-site deployment is required, or if S3-compatible API is needed for third-party tool integration.
- **Migration path**: Content-addressed local storage can be migrated to MinIO later by moving files and updating path resolution.

### Option D (Ceph) - Rejected

- **Extreme complexity**: Ceph requires dedicated operations expertise. Not appropriate for a team with 1 DevOps engineer.
- **Resource intensive**: Minimum 3 OSD nodes + 3 MON nodes. Significant hardware investment for LAN deployment.
- **Overkill**: Ceph's multi-petabyte scale and multi-site replication are not needed for 4.5TB single-site.
- **Maintenance burden**: Ceph upgrades, OSD failures, and rebalancing require ongoing attention.
- **When to consider**: Only if deployment scales beyond 50TB or requires multi-site active-active replication.

## Impact on Current App

### New Backend Components
- `backend/services/storage/` - Storage service app
  - `content_store.py` - Content-addressed file storage with SHA-256
  - `tiering.py` - Tier migration policy engine
  - `integrity.py` - Checksum verification service
  - `tasks.py` - Celery tasks: tier migration, integrity check, deduplication scan
  - `models.py` - StorageObject model (hash, tier, size, access_count, last_accessed)

### Modified Components
- `backend/documents/models.py` - Replace `file_path` with `storage_hash` FK to StorageObject
- `backend/documents/views.py` - File retrieval resolves through storage service (not direct path)
- `docker-compose.yml` - Mount separate volumes for hot/warm tiers; configure migration worker

### Infrastructure Changes
- Hot tier: NVMe SSD volume (500GB) mounted at `/storage/hot/`
- Warm tier: HDD NAS share (3TB) mounted at `/storage/warm/`
- Cold tier: Separate backup NAS or tape library (future, not initial deployment)
- Celery periodic task: tier migration runs nightly at 03:00
- Celery periodic task: integrity check runs weekly (Saturday 02:00)

### Frontend Changes
- Document download resolves transparently (no user-visible change)
- Admin storage dashboard shows tier distribution and capacity
- Integrity check results visible in admin panel

## Migration Strategy

1. **Phase 1** (non-breaking): Deploy StorageObject model. Start recording SHA-256 for new uploads.
2. **Phase 2** (backfill): Background task computes SHA-256 for all existing documents.
3. **Phase 3** (content-address): New uploads stored by hash. Old paths maintained as symlinks.
4. **Phase 4** (dedup): Identify duplicate content (same hash, multiple records). Merge to single physical copy.
5. **Phase 5** (tiering): Enable tier migration behind `FEATURE_STORAGE_TIERING`. Monitor for 30 days.
6. **Phase 6** (cold tier): Configure cold tier for documents >2 years. Enable lazy retrieval.

Estimated migration time: 2-4 hours for 600K documents (hashing), non-blocking.

## Rollback Strategy

1. **Feature flag**: Set `FEATURE_STORAGE_TIERING=false`. All file resolution falls back to original paths.
2. **Symlinks**: During migration, original file paths are maintained as symlinks to content-addressed location. Rolling back means files are still accessible at original paths.
3. **Reverse migration**: Script moves files from content-addressed layout back to original paths.
4. **No data loss**: Content-addressed storage is a reorganization, not a transformation. Files are byte-identical.
5. **Recovery time**: <5 minutes for flag disable. 2-4 hours for full reverse migration (600K files).

## Performance Impact

| Metric | Before | After | Notes |
|--------|--------|-------|-------|
| Upload time | ~500ms | ~600ms (+100ms for SHA-256) | SHA-256 computed during upload; minimal overhead |
| Download (hot tier) | ~200ms | ~200ms (unchanged) | Same NVMe serving |
| Download (warm tier) | N/A | ~300ms | HDD sequential read; acceptable for infrequent access |
| Download (cold tier) | N/A | 5-30s (first access) | Notify user of delay; cache on warm after retrieval |
| Deduplication savings | 0% | 20-40% storage freed | Significant at 4.5TB scale |
| Integrity check | N/A | ~4 hours (weekly, all 600K files) | Background; no user impact |
| Tier migration | N/A | ~30 minutes nightly | Move 100-1000 files per night based on access patterns |
| Storage IOPS (hot) | All traffic on one volume | 85% reduction on hot tier | Only active documents hit NVMe |

## Security Impact

- **Content integrity**: SHA-256 provides cryptographic verification of document content. Unauthorized modification is detectable.
- **Access control**: Storage service checks document-level permissions before serving files. No direct filesystem access for users.
- **Path traversal**: Content-addressed paths use validated SHA-256 hashes only. No user-supplied path components.
- **Cold tier encryption**: Cold tier storage should be encrypted at rest (LUKS for local, server-side encryption for object storage).
- **Backup encryption**: All backup copies encrypted with GPG. Keys stored separately from backup media.
- **Audit trail**: All file access logged with document ID, user, timestamp, and tier accessed.
- **Compliance**: Immutable storage + hash verification + audit log meets ISO 27001 and railway compliance requirements.

## Operational Complexity

| Aspect | Complexity | Mitigation |
|--------|-----------|------------|
| Tier migration automation | Medium | Simple Celery periodic task; well-defined policy rules |
| Integrity verification | Low | Single management command; alerting on failures |
| Capacity monitoring | Low | Per-tier disk usage in Prometheus/Grafana |
| Tier expansion | Low | Add more NAS capacity; update mount in Docker Compose |
| Deduplication reporting | Low | Admin dashboard shows savings and duplicate detection |
| Cold tier retrieval latency | Medium | Clear UX messaging ("Retrieving from archive, please wait...") |
| Backup coordination | Medium | Content-addressed store is rsync-friendly; incremental backups are fast |
| Disaster recovery | Medium | Restore from backup to any tier; integrity check confirms completeness |

## Acceptance Tests

1. **Content addressing**: Upload file A. Upload identical file B (different name). Verify only one physical copy exists on disk.
2. **Integrity verification**: Upload file. Manually corrupt one byte on disk. Run integrity check. Verify alert generated.
3. **Hot tier performance**: Access document on hot tier. Verify <200ms response time.
4. **Warm tier retrieval**: Move document to warm tier. Access it. Verify <300ms response time.
5. **Cold tier retrieval**: Move document to cold tier. Access it. Verify retrieval within 30 seconds with user notification.
6. **Automatic migration**: Upload document. Wait 90 days (simulate with adjusted timestamps). Verify migration to warm tier occurred.
7. **Deduplication savings**: Upload 100 documents (50 are duplicates). Verify storage used is ~50 files worth, not 100.
8. **Transparent access**: User accesses document on warm tier. Verify no error; document served normally (user unaware of tier).
9. **Capacity alerts**: Fill hot tier to 80%. Verify warning alert generated. Fill to 90%. Verify critical alert.
10. **Feature flag**: Disable `FEATURE_STORAGE_TIERING`. Verify all documents accessible at original paths. Verify no tier migration occurs.
11. **Backup/restore**: Perform backup. Delete random 10 documents from disk. Restore from backup. Verify all 10 accessible with correct checksums.
