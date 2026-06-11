# ADR-002: OCR and Tiled Processing Architecture for Engineering Drawings

**Date:** June 2026  
**Status:** Proposed  
**Deciders:** Principal Engineer, Backend Lead, OCR Specialist  
**Technical Area:** Document Processing Pipeline

---

## Context

LDO-2 serves as an engineering-document intelligence platform managing 6 lakh documents. A significant portion (estimated 100,000) are large-format engineering drawings (A0, A1, A2 sizes). These drawings contain critical text: drawing numbers, part numbers, revision codes, BOM tables, notes, and GD&T (Geometric Dimensioning and Tolerancing) annotations.

Standard OCR engines (Tesseract, EasyOCR) perform poorly on large images because they either run out of memory, produce garbled output from downscaling, or miss small text in dense engineering drawings. This is the primary competitive differentiator for LDO-2 over Paperless-ngx and Mayan EDMS, which offer only basic OCR with no special handling for large-format documents.

## Problem

Engineering drawings at A0 size (841x1189mm) scanned at 300 DPI produce images of 9933x14043 pixels. These images:

1. Exceed memory limits of standard OCR configurations (Tesseract recommends <4000px per dimension)
2. Contain text at varying scales (large title block text vs. small dimension annotations)
3. Have complex layouts mixing graphics, tables, and text regions
4. Require domain-specific post-processing to extract structured metadata

The system needs to process these drawings automatically with >90% character accuracy and extract structured metadata (drawing number, PL number, revision) without manual intervention.

## Current Implementation

- No OCR pipeline exists in the codebase
- Celery is configured for background task processing (`backend/edms/settings.py`)
- Redis is deployed as the message broker
- The `documents` app handles metadata storage but has no content extraction
- Docker Compose includes Celery worker and beat scheduler services
- No Tesseract or image processing libraries are currently installed

## Options Considered

### Option A: Tiled OCR Pipeline with Parallel Workers (Recommended)

Split large images into overlapping tiles (4096x4096px with 15% overlap), process each tile independently with Tesseract in parallel Celery workers, then merge results with coordinate transformation and IoU-based deduplication.

### Option B: Single-Pass with Image Downscaling

Downscale all images to a maximum dimension (e.g., 4000px) before OCR. Simpler implementation but loses fine detail.

### Option C: Cloud OCR Service (Google Vision, AWS Textract)

Send images to a cloud OCR service that handles large images internally.

### Option D: Multi-Pass at Different Resolutions

Run OCR multiple times at different zoom levels and merge results. No tiling, but multiple passes over the full image.

## Recommended Decision

**Option A: Tiled OCR Pipeline with Parallel Workers, deployed behind feature flag `FEATURE_TILED_OCR`.**

Architecture:

```
Upload/Watch -> Pre-process -> Layout Analysis -> Tiling -> Parallel OCR -> Merge -> Post-process -> Index
```

Configuration:
- Tile size: 4096x4096 pixels
- Overlap: 15% (614px on each shared edge)
- Minimum image size for tiling: 5000px on either dimension
- Maximum parallel tiles per document: 8 Celery workers
- OCR confidence threshold: 60% (discard results below)
- IoU deduplication threshold: 0.6 in overlap zones
- DPI normalization target: 400 DPI (upscale low-res scans)

Feature flags:
- `FEATURE_TILED_OCR` - Enable tiled processing (master switch)
- `FEATURE_OCR_LAYOUT_DETECTION` - Enable ML-based region detection
- `FEATURE_OCR_CUSTOM_DICT` - Use engineering-specific dictionary
- `FEATURE_OCR_MULTI_ENGINE` - EasyOCR fallback for low-confidence tiles

## Why This Decision is Best

1. **Handles all drawing sizes**: A4 through A0 with optimal strategy for each (no tiling for small, full tiling for large).
2. **Parallel processing**: 8 tiles processed simultaneously reduces wall-clock time from 12 minutes (sequential) to <3 minutes for A0.
3. **Memory bounded**: Each worker processes one 4096x4096 tile (~64MB in memory). Predictable resource usage regardless of source image size.
4. **Quality preservation**: No downscaling means fine engineering text (dimension annotations, tolerances) is preserved at full resolution.
5. **Domain-optimized**: Post-processing extracts engineering-specific metadata (drawing numbers, PL numbers, GD&T) that generic OCR services do not provide.
6. **LAN-compatible**: Runs entirely on-premises with no cloud dependencies. Critical for industrial environments with air-gapped networks.
7. **Incremental enhancement**: Start with Tesseract only. Add EasyOCR fallback, custom dictionary, and layout detection incrementally behind feature flags.
8. **Leverages existing infrastructure**: Celery workers and Redis are already deployed. OCR becomes another task queue.

## Why Alternatives are Rejected or Deferred

### Option B (Single-Pass with Downscaling) - Rejected

- **Quality loss**: Downscaling A0 from 14043px to 4000px is a 3.5x reduction. Small text (6-8pt annotations, dimension tolerances) becomes unreadable.
- **Engineering drawings require detail**: A part number "DWG-PM-89712" at 8pt font in a title block becomes smeared at reduced resolution.
- **Insufficient accuracy**: Estimated <70% accuracy on engineering text vs. >90% target.
- **No competitive advantage**: This is what Paperless-ngx already does (poorly).

### Option C (Cloud OCR Service) - Rejected

- **LAN deployment incompatible**: Industrial environments often have air-gapped networks. Cloud services require internet access.
- **Data sovereignty**: Engineering drawings may contain export-controlled or classified information. Cannot send to cloud services.
- **Ongoing cost**: At 6 lakh documents, cloud OCR costs are significant ($0.50-3.00 per page; 600K pages = $300K-1.8M).
- **Vendor lock-in**: Dependency on Google/AWS availability and pricing.
- **Latency**: Network round-trip adds 2-5 seconds per page. Unacceptable for batch processing.

### Option D (Multi-Pass at Different Resolutions) - Rejected

- **Memory intensive**: Each pass loads the full image. A0 at 400 DPI requires ~2GB RAM per pass.
- **Slower than tiling**: Sequential passes take 3-4x longer than parallel tiled processing.
- **Complex merge**: Merging results from different resolutions requires scale-aware coordinate mapping. More error-prone than same-resolution tile merging.
- **No parallelism benefit**: Each pass is sequential within a single worker.

## Impact on Current App

### New Backend Components
- `backend/services/ocr/` - New Django app for OCR pipeline
  - `tasks.py` - Celery tasks: pre-process, tile, OCR, merge, post-process
  - `tiling.py` - Image tiling and coordinate transformation logic
  - `engines.py` - OCR engine abstraction (Tesseract, EasyOCR)
  - `merge.py` - Result merging with IoU deduplication
  - `postprocess.py` - Engineering metadata extraction (regex patterns)
  - `models.py` - OCRJob, OCRResult, OCRTile models

### Modified Components
- `backend/documents/models.py` - Add `ocr_status`, `ocr_text`, `search_vector` fields
- `backend/documents/views.py` - Add OCR status endpoint, re-process trigger
- `docker-compose.yml` - Add OCR worker service with increased memory (16GB)
- Celery configuration - Add `ocr` queue with dedicated workers

### New Infrastructure Requirements
- Tesseract 5.x with LSTM models (container dependency)
- Pillow + OpenCV for image processing (pip dependencies)
- pdf2image + poppler-utils for PDF rasterization
- Dedicated Celery queue: `ocr` (separate from default queue)
- Temporary storage for tile files (NVMe recommended, 50GB)

### Frontend Changes
- Document detail page shows OCR status (pending/processing/complete/failed)
- Admin page shows OCR queue depth and processing statistics
- Re-trigger OCR button for failed/low-confidence documents

## Migration Strategy

1. **Phase 1** (infrastructure): Add Tesseract and image processing libs to Docker image. Deploy OCR worker container.
2. **Phase 2** (schema): Add OCR fields to document model. Deploy migration.
3. **Phase 3** (pipeline): Implement tiling engine + merge logic. Unit test with sample drawings.
4. **Phase 4** (integration): Wire into document upload flow behind `FEATURE_TILED_OCR` flag.
5. **Phase 5** (backfill): Process existing documents in background (lowest priority queue).
6. **Phase 6** (enhancement): Add layout detection, custom dictionary, multi-engine fallback.

Estimated timeline: 4 weeks for Phase 1-4 (MVP), 4 weeks for Phase 5-6 (enhancements).

## Rollback Strategy

1. **Immediate**: Set `FEATURE_TILED_OCR=false`. New uploads skip OCR processing. Existing OCR results remain accessible.
2. **Queue drain**: In-progress OCR tasks complete normally. No tasks are lost.
3. **Full rollback**: Remove OCR worker from Docker Compose. OCR fields remain in DB (nullable). Frontend hides OCR status when feature disabled.
4. **Data preservation**: Extracted OCR text is stored in the document record. Rollback does not delete previously extracted text.
5. **Recovery time**: <1 minute for flag disable. <5 minutes for worker removal.

## Performance Impact

| Metric | Impact | Notes |
|--------|--------|-------|
| Document upload time (user-facing) | No change | OCR runs asynchronously in background |
| OCR processing A4 | 5-10 seconds | Single-pass, no tiling needed |
| OCR processing A0 | 120-180 seconds (parallel) | 12 tiles, 8 workers in parallel |
| Worker memory usage | 2-4GB per worker per tile | Bounded by tile size (4096x4096) |
| Storage (temporary tiles) | 50-200MB per A0 document | Cleaned after processing |
| Storage (OCR text) | ~50GB for 600K documents | Stored in PostgreSQL with search_vector |
| Celery queue throughput | 10-50 documents/minute | Depends on document size mix and worker count |
| CPU usage during OCR | 100% per worker core | CPU-bound; size workers appropriately |

## Security Impact

- **File access**: OCR workers need read access to document storage. Use least-privilege service account.
- **Temporary files**: Tile images written to temp directory. Ensure temp directory is on encrypted volume and cleaned after processing.
- **Input validation**: Validate file types before OCR processing (reject non-image/non-PDF). Prevent path traversal in file paths.
- **Resource limits**: Set memory and CPU limits per worker to prevent denial-of-service from malicious large files.
- **OCR output sanitization**: Extracted text is stored as-is. Sanitize before rendering in frontend (XSS prevention).
- **Audit logging**: Log all OCR operations (start, complete, fail) with document ID and user who triggered upload.

## Operational Complexity

| Aspect | Complexity | Mitigation |
|--------|-----------|------------|
| New service (OCR worker) | Medium | Reuse existing Celery infrastructure; just a new queue |
| Tesseract maintenance | Low | Stable release cycle; container pins version |
| Queue monitoring | Low | Celery Flower or Prometheus metrics for queue depth |
| Failure handling | Medium | Dead-letter queue for failed tasks; admin retry UI |
| Storage management | Medium | Temp file cleanup cron; monitor disk usage |
| Scaling | Low | Add more Celery workers to OCR queue as needed |
| Debugging | Medium | Log tile coordinates and confidence scores for each result |

## Acceptance Tests

1. **A4 document (no tiling)**: Upload A4 PDF. Verify OCR completes in <10s. Verify extracted text matches document content with >90% accuracy.
2. **A0 drawing (full tiling)**: Upload A0 engineering drawing (14000x9900px). Verify 12 tiles generated. Verify OCR completes in <180s. Verify no duplicate text in overlap zones.
3. **Drawing number extraction**: Upload drawing with "DWG-PM-89712" in title block. Verify drawing number extracted and stored in metadata.
4. **PL number detection**: Upload drawing with PL numbers in BOM table. Verify PL numbers extracted and available for linkage.
5. **Confidence filtering**: Provide image with partially obscured text. Verify low-confidence results (<60%) are discarded.
6. **Failure handling**: Submit corrupted file. Verify task moves to failed state. Verify admin can retry.
7. **Feature flag**: Disable `FEATURE_TILED_OCR`. Upload document. Verify no OCR processing occurs.
8. **Concurrent processing**: Upload 10 A0 drawings simultaneously. Verify all complete within 10 minutes with no memory errors.
9. **Memory bounds**: Process A0 drawing. Verify worker memory never exceeds 4GB per tile.
10. **Idempotency**: Trigger OCR on same document twice. Verify results are identical and no duplicate records created.
