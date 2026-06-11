/**
 * TilePyramidStatus
 *
 * Displays tile generation progress for a tiled OCR job.
 * Shows a progress bar, status text, and a tile grid visualization
 * with color-coded squares (green=complete, yellow=processing, red=failed, gray=pending).
 * Gated behind the LARGE_DRAWING_VIEWER feature flag.
 */

import React from "react";
import * as Progress from "@radix-ui/react-progress";
import { isFeatureEnabled } from "../../lib/featureFlags";
import type { OcrPipelineStatus } from "../../lib/tiledOcrTypes";
import { Badge } from "../ui/Shared";

export interface TilePyramidStatusProps {
  /** Total number of tiles in the job */
  totalTiles: number;
  /** Number of completed tiles */
  completedTiles: number;
  /** Number of failed tiles */
  failedTiles: number;
  /** Current pipeline status */
  status: OcrPipelineStatus;
}

function getStatusBadgeVariant(
  status: OcrPipelineStatus,
): "default" | "success" | "warning" | "danger" | "processing" | "info" {
  switch (status) {
    case "completed":
      return "success";
    case "failed":
    case "cancelled":
      return "danger";
    case "processing":
    case "tiling":
    case "merging":
    case "deduplicating":
      return "processing";
    case "queued":
      return "info";
    default:
      return "default";
  }
}

function getTileColor(
  index: number,
  completedTiles: number,
  failedTiles: number,
  totalTiles: number,
  status: OcrPipelineStatus,
): string {
  if (index < completedTiles) return "bg-green-500";
  if (index < completedTiles + failedTiles) return "bg-red-500";
  if (
    status === "processing" &&
    index === completedTiles + failedTiles &&
    index < totalTiles
  ) {
    return "bg-yellow-500 animate-pulse";
  }
  return "bg-muted-foreground/30";
}

export function TilePyramidStatus({
  totalTiles,
  completedTiles,
  failedTiles,
  status,
}: TilePyramidStatusProps) {
  if (!isFeatureEnabled("LARGE_DRAWING_VIEWER")) {
    return null;
  }

  const progressPercent =
    totalTiles > 0 ? Math.round((completedTiles / totalTiles) * 100) : 0;
  const processingTiles = totalTiles - completedTiles - failedTiles;

  // Calculate grid dimensions for visualization
  const cols = Math.min(Math.ceil(Math.sqrt(totalTiles)), 8);
  const tileIndicators = Array.from({ length: Math.min(totalTiles, 64) }, (_, i) => i);

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-background/50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">Tile Processing</span>
        <Badge variant={getStatusBadgeVariant(status)} size="sm">
          {status}
        </Badge>
      </div>

      {/* Progress bar */}
      <Progress.Root
        className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
        value={progressPercent}
      >
        <Progress.Indicator
          className="h-full rounded-full bg-primary transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${100 - progressPercent}%)` }}
        />
      </Progress.Root>

      {/* Status text */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {completedTiles}/{totalTiles} tiles complete
        </span>
        <span>{progressPercent}%</span>
      </div>

      {/* Tile details */}
      {(failedTiles > 0 || processingTiles > 0) && (
        <div className="flex gap-3 text-[10px] text-muted-foreground">
          {processingTiles > 0 && <span>{processingTiles} pending</span>}
          {failedTiles > 0 && (
            <span className="text-destructive">{failedTiles} failed</span>
          )}
        </div>
      )}

      {/* Tile grid visualization */}
      {totalTiles > 0 && (
        <div
          className="grid gap-0.5 mt-1"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          aria-label="Tile progress grid"
        >
          {tileIndicators.map((i) => (
            <div
              key={`tile-indicator-${i}`}
              className={`h-2 w-full rounded-sm ${getTileColor(i, completedTiles, failedTiles, totalTiles, status)}`}
              title={`Tile ${i + 1}`}
            />
          ))}
          {totalTiles > 64 && (
            <span className="col-span-full text-[10px] text-muted-foreground text-center mt-0.5">
              +{totalTiles - 64} more tiles
            </span>
          )}
        </div>
      )}
    </div>
  );
}
