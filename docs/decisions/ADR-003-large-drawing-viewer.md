# ADR-003: Large Drawing Viewer Technology

**Date:** June 2026  
**Status:** Proposed  
**Deciders:** Principal Engineer, Frontend Lead  
**Technical Area:** Document Viewing and Rendering

---

## Context

LDO-2 manages 6 lakh engineering documents, with approximately 100,000 being large-format engineering drawings (A0-A2). These drawings contain fine details (dimension annotations, GD&T symbols, small part numbers) that users need to inspect at full resolution. The current system requires downloading the full file to view it, which is impractical for 25MB+ A0 drawings over a LAN with many concurrent users.

The engineering-document intelligence niche demands that users can pan and zoom through large drawings in-browser, toggle OCR text overlays for copy-paste, and annotate without downloading the source file. This viewing experience is a key differentiator over Paperless-ngx and Mayan EDMS, neither of which offers tiled viewing for large documents.

## Problem

A0 engineering drawings at 300 DPI are 9933x14043 pixels (approximately 25-50MB as compressed images). Loading the full image in a browser:

1. Takes 5-15 seconds over a 1Gbps LAN with 50 concurrent users
2. Consumes 500MB+ of browser memory (uncompressed bitmap)
3. Causes UI jank during rendering and pan/zoom operations
4. Makes mobile/tablet viewing impossible (shop floor use case)

Users need instant pan/zoom similar to Google Maps or digital microscopy viewers, where only visible tiles at the current zoom level are loaded on demand.

## Current Implementation

- Documents are served as full-file downloads via Django/DRF endpoints
- No tile generation or deep-zoom image support exists
- No document viewing component exists in the frontend
- The frontend uses React 19 with lazy-loaded pages (`artifacts/edms/src/App.tsx`)
- Docker Compose includes Nginx for static asset serving
- No image processing infrastructure for tile generation (no Pillow/OpenCV in backend)

## Options Considered

### Option A: OpenSeadragon with DZI Tiles (Recommended)

Use OpenSeadragon (open-source deep zoom viewer) with pre-generated DZI (Deep Zoom Image) tile pyramids. Generate tiles on first view or during OCR processing.

### Option B: Leaflet.js with Custom Tile Layer

Repurpose Leaflet.js (map viewer) with a custom tile source serving document tiles.

### Option C: PDF.js with Canvas Rendering

Use Mozilla PDF.js to render PDFs directly in the browser with its built-in zoom/pan.

### Option D: Commercial Viewer (PSPDFKit, Accusoft PrizmDoc)

License a commercial document viewing SDK with built-in tiling support.

## Recommended Decision

**Option A: OpenSeadragon with DZI tile pyramids, behind feature flag `FEATURE_TILED_VIEWER`.**

Architecture:
- **Backend**: Generate DZI tile pyramids (256x256px tiles at multiple zoom levels) during OCR pipeline or on-demand on first view
- **Frontend**: OpenSeadragon React wrapper component with OCR text overlay layer and annotation layer
- **Storage**: DZI tiles stored in hot-tier storage (SSD) with Nginx direct serving and immutable cache headers
- **Caching**: 1-year cache-control headers (tiles are content-addressed and immutable)

Tile pyramid specification:
- Tile size: 256x256 pixels
- Zoom levels: 8 (from 1:1 full resolution down to 1:256 thumbnail)
- Format: JPEG 85% quality (balance of size and quality for engineering drawings)
- Storage per A0: ~50-100MB of tiles (acceptable for 100K large drawings = 5-10TB dedicated)

## Why This Decision is Best

1. **Purpose-built for deep zoom**: OpenSeadragon was designed specifically for viewing high-resolution images with smooth pan/zoom. Used by museums, medical imaging, and scientific visualization.
2. **DZI is an open standard**: Deep Zoom Image format is well-documented, tool-supported, and vendor-neutral.
3. **Minimal bandwidth**: Only visible tiles (typically 4-9 at any time) are loaded. Viewing an A0 drawing loads ~100KB initially, not 25MB.
4. **60fps interaction**: Pan/zoom operates on already-loaded 256px tiles. No re-rendering or full-image processing.
5. **OCR overlay integration**: OpenSeadragon supports overlay layers. OCR text can be positioned at original coordinates for click-to-copy functionality.
6. **React integration**: `openseadragon-react-viewer` or custom wrapper integrates cleanly with existing React 19 architecture.
7. **Progressive enhancement**: Initial view loads instantly with lowest zoom level. Full detail loads as user zooms in.
8. **Offline-capable**: Viewed tiles are cached by the browser. Revisiting a drawing loads from cache.
9. **Annotation-ready**: OpenSeadragon supports annotation plugins (Annotorious) for markup without modifying source files.
10. **Open source (BSD license)**: No licensing cost. Meets open-source adoption criteria (ADR-008).

## Why Alternatives are Rejected or Deferred

### Option B (Leaflet.js) - Rejected

- **Map-oriented API**: Leaflet's API uses geographic coordinates (latitude/longitude). Adapting it for pixel-coordinate documents requires significant workarounds.
- **No deep-zoom optimization**: Leaflet assumes uniform tile density. DZI pyramids with varying resolution levels require custom tile source implementations.
- **Annotation ecosystem**: Leaflet's annotation tools (Leaflet.draw) are designed for geographic features, not document markups.
- **Larger bundle**: Leaflet + plugins is larger than OpenSeadragon for this use case.
- **Not purpose-built**: While functional, it is a map viewer adapted for documents rather than a document viewer.

### Option C (PDF.js) - Rejected

- **Single-format**: Only handles PDF files. Engineering drawings may be TIFF, PNG, or scanned images.
- **No tiling**: PDF.js renders pages at the requested zoom level. For A0 at full zoom, it attempts to render the entire page at high resolution - causing the same memory and performance issues.
- **Poor performance at high zoom**: Zooming to 400% on an A0 page requires rendering a 40000x56000 pixel canvas. Browser crashes.
- **No OCR overlay**: PDF.js renders existing PDF text layers but cannot overlay externally-generated OCR results.
- **Limited annotation**: PDF.js annotation support is read-only for existing PDF annotations.

### Option D (Commercial Viewer) - Rejected

- **License cost**: PSPDFKit charges $3,000-50,000/year. PrizmDoc similar. Not justified for a LAN-deployed system.
- **Vendor dependency**: Commercial viewers may be discontinued, change pricing, or add restrictive terms.
- **Cloud-oriented**: Most commercial viewers assume cloud deployment. LAN support is secondary.
- **Overkill**: These SDKs include features (form filling, digital signatures, redaction) that are not needed.
- **Against open-source strategy**: ADR-008 requires evaluating open-source alternatives first.

## Impact on Current App

### New Frontend Components
- `artifacts/edms/src/components/viewer/TiledViewer.tsx` - OpenSeadragon wrapper with React lifecycle management
- `artifacts/edms/src/components/viewer/OcrOverlay.tsx` - Text overlay layer with click-to-copy
- `artifacts/edms/src/components/viewer/ViewerToolbar.tsx` - Zoom controls, rotation, fullscreen, OCR toggle
- `artifacts/edms/src/components/viewer/AnnotationLayer.tsx` - Comment/markup annotations (Phase 2)

### New Backend Components
- `backend/services/tiles/` - DZI tile generation service
  - `generator.py` - Pillow-based DZI pyramid generator
  - `tasks.py` - Celery tasks for background tile generation
  - `views.py` - Tile serving endpoint (or direct Nginx serving)
- Storage: `/documents/tiles/{document_id}/` directory structure for DZI pyramids

### Modified Components
- `backend/documents/models.py` - Add `tiles_generated` boolean, `tile_path` field
- `backend/documents/views.py` - Add tile status endpoint, trigger tile generation
- `docker-compose.yml` - Nginx configuration for direct tile serving with long cache headers
- Frontend document detail page - Embed TiledViewer instead of download link

### New Dependencies
- Frontend: `openseadragon` (~150KB gzipped) - BSD license
- Backend: `Pillow` (already needed for OCR) - used for DZI generation

## Migration Strategy

1. **Phase 1** (backend): Implement DZI tile generator. Test with sample A0 drawings.
2. **Phase 2** (storage): Configure tile storage directory. Add Nginx location block for direct serving.
3. **Phase 3** (frontend): Build TiledViewer component. Integrate with document detail page behind `FEATURE_TILED_VIEWER` flag.
4. **Phase 4** (generation): Wire tile generation into OCR pipeline (generate DZI after successful OCR).
5. **Phase 5** (on-demand): Add on-demand tile generation for existing documents (trigger on first view, show "generating..." progress).
6. **Phase 6** (overlay): Add OCR text overlay layer using coordinates from OCR results.
7. **Phase 7** (annotation): Add annotation layer for comments and markups (future).

## Rollback Strategy

1. **Immediate**: Set `FEATURE_TILED_VIEWER=false`. Document detail page shows download link instead of viewer.
2. **No data loss**: Generated tiles are cached assets, not source data. Can be deleted and regenerated.
3. **Storage cleanup**: If rolled back permanently, delete tile directories to reclaim storage.
4. **Dependency removal**: `openseadragon` package can be removed from package.json if viewer is abandoned.
5. **Recovery time**: <1 minute for flag disable. User falls back to download behavior.

## Performance Impact

| Metric | Before (Download) | After (Tiled Viewer) | Notes |
|--------|-------------------|---------------------|-------|
| Initial view time (A0) | 5-15s (full download) | <2s (thumbnail tiles) | Only 4-9 tiles loaded initially |
| Zoom to detail | N/A (full image in memory) | <500ms per zoom level | New tiles load on demand |
| Memory usage (browser) | 500MB+ (full bitmap) | 10-50MB (visible tiles only) | Tiles evicted when scrolled away |
| Network per view | 25-50MB (full file) | 100KB-2MB (visible tiles) | 95%+ bandwidth savings |
| Tile generation (A0) | N/A | 30-60s (one-time) | Background processing; cached forever |
| Storage overhead | 0 | 50-100MB per A0 drawing | ~5-10TB for 100K large drawings |
| Nginx serving | Dynamic Django view | Static file serve | Orders of magnitude faster |
| Concurrent viewers | Limited by download bandwidth | Effectively unlimited | Tiles are tiny static files |

## Security Impact

- **Access control**: Tile serving endpoint must verify document access permissions before serving tiles. Options: (a) Nginx auth_request to Django, or (b) signed URLs with expiry.
- **Path traversal**: Tile file paths are derived from document ID. Validate document ID format to prevent directory traversal attacks.
- **Cache poisoning**: Tiles are content-addressed (immutable). Cache poisoning risk is minimal.
- **Information disclosure**: Tile directories should not be listable. Nginx `autoindex off` for tile paths.
- **CORS**: Tiles served from same origin; no CORS needed for LAN deployment.
- **Annotation security**: User-generated annotations must be sanitized to prevent stored XSS.

## Operational Complexity

| Aspect | Complexity | Mitigation |
|--------|-----------|------------|
| Tile storage growth | Medium (5-10TB for 100K large drawings) | Store on warm tier after 90 days; regenerate on demand |
| Tile generation queue | Low (piggybacks on existing OCR queue) | Same Celery workers; separate queue priority |
| Nginx configuration | Low (static file serving) | Template-based config in Docker image |
| Cache management | Low (immutable files, long TTL) | No cache invalidation needed; new version = new tiles |
| Monitoring | Low | Track: generation queue depth, tile serve latency, storage usage |
| Failure mode | Low (graceful degradation to download) | If tiles missing, show download link with "Generating preview..." |

## Acceptance Tests

1. **Basic viewing**: Upload A0 drawing. Generate tiles. Open viewer. Verify smooth pan/zoom at 60fps.
2. **Progressive loading**: Open A0 drawing. Verify initial load <3 seconds (thumbnail level). Zoom to full resolution. Verify detail tiles load within 500ms.
3. **Memory bounded**: Open A0 drawing. Zoom and pan extensively. Verify browser memory stays <100MB (no unbounded tile accumulation).
4. **OCR overlay**: View drawing with OCR results. Toggle OCR overlay. Verify text is positioned correctly. Verify click-to-copy works for drawing numbers.
5. **Concurrent viewers**: 50 users viewing same A0 drawing simultaneously. Verify <200ms tile response time (Nginx cache hit).
6. **On-demand generation**: View document without pre-generated tiles. Verify "Generating preview..." message. Verify tiles become available within 60s.
7. **Feature flag**: Disable `FEATURE_TILED_VIEWER`. Verify document page shows download link, not viewer.
8. **Mobile/tablet**: View drawing on tablet browser. Verify pinch-to-zoom and touch-drag panning work smoothly.
9. **Fallback**: Delete tile files for a document. Verify viewer shows appropriate message and offers download fallback.
10. **Accessibility**: Navigate viewer with keyboard only. Verify zoom (+/-), pan (arrow keys), and toolbar buttons are keyboard accessible.
