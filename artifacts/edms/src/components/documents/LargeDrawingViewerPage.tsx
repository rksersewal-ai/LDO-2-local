/**
 * LargeDrawingViewerPage
 *
 * Page-level component that composes TiledDrawingViewer with TilePyramidStatus.
 * Fetches OCR job status from TiledOcrService and provides tile progress
 * alongside the drawing viewer. Gated behind the LARGE_DRAWING_VIEWER feature flag.
 *
 * If the feature flag is disabled, displays a fallback message.
 */

import React, { useMemo } from "react";
import { isFeatureEnabled } from "../../lib/featureFlags";
import { TiledOcrService } from "../../services/TiledOcrService";
import { GlassCard, PageHeader } from "../ui/Shared";
import { TiledDrawingViewer } from "./TiledDrawingViewer";
import { TilePyramidStatus } from "./TilePyramidStatus";
import type { OcrRegion } from "./OcrTextOverlay";

export interface LargeDrawingViewerPageProps {
  /** Document ID to load */
  documentId: string;
  /** Optional file URL for the drawing image */
  fileUrl?: string;
  /** Total pages in the document */
  totalPages?: number;
  /** Optional document title for the page header */
  documentTitle?: string;
}

function LargeDrawingViewerPage({
  documentId,
  fileUrl,
  totalPages = 1,
  documentTitle,
}: LargeDrawingViewerPageProps) {
  // Fetch OCR jobs for this document
  const ocrJobs = useMemo(() => {
    return TiledOcrService.getJobsForDocument(documentId);
  }, [documentId]);

  // Get the latest active or completed job
  const activeJob = useMemo(() => {
    if (ocrJobs.length === 0) return null;
    // Prefer active jobs, then most recent
    const active = ocrJobs.find(
      (j) => j.status === "processing" || j.status === "tiling" || j.status === "merging",
    );
    if (active) return active;
    return ocrJobs[0];
  }, [ocrJobs]);

  // Convert tile results to OCR overlay regions (for completed tiles with text)
  const ocrOverlayData: OcrRegion[] = useMemo(() => {
    if (!activeJob || activeJob.tiles.length === 0) return [];
    const completedTiles = activeJob.tiles.filter(
      (t) => t.status === "completed" && t.ocrText.length > 0,
    );
    if (completedTiles.length === 0) return [];

    // Calculate the bounding box of all tiles to determine relative positions
    const maxX = Math.max(...activeJob.tiles.map((t) => t.coordinates.x + t.coordinates.width));
    const maxY = Math.max(...activeJob.tiles.map((t) => t.coordinates.y + t.coordinates.height));

    if (maxX === 0 || maxY === 0) return [];

    return completedTiles.map((tile) => ({
      text: tile.ocrText,
      x: (tile.coordinates.x / maxX) * 100,
      y: (tile.coordinates.y / maxY) * 100,
      width: (tile.coordinates.width / maxX) * 100,
      height: (tile.coordinates.height / maxY) * 100,
      confidence: tile.confidence,
    }));
  }, [activeJob]);

  // Feature flag gate - placed after all hooks to comply with Rules of Hooks
  if (!isFeatureEnabled("LARGE_DRAWING_VIEWER")) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-muted-foreground">
        <p className="text-sm">Large drawing viewer is not enabled</p>
      </div>
    );
  }

  const title = documentTitle || `Document ${documentId}`;

  return (
    <div className="flex flex-col gap-4 p-4 h-full">
      <PageHeader
        title={title}
        subtitle="Large Drawing Viewer"
      />

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Main viewer area */}
        <div className="flex-1 min-w-0">
          <GlassCard className="h-full p-4">
            <TiledDrawingViewer
              documentId={documentId}
              fileUrl={fileUrl}
              totalPages={totalPages}
              ocrOverlayData={ocrOverlayData}
            />
          </GlassCard>
        </div>

        {/* Side panel with tile status */}
        {activeJob && (
          <div className="w-64 flex-shrink-0">
            <GlassCard className="p-4">
              <TilePyramidStatus
                totalTiles={activeJob.totalTiles}
                completedTiles={activeJob.completedTiles}
                failedTiles={activeJob.failedTiles}
                status={activeJob.status}
              />
            </GlassCard>
          </div>
        )}
      </div>
    </div>
  );
}

export default LargeDrawingViewerPage;
