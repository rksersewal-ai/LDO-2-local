/**
 * DrawingViewerControls
 *
 * Toolbar component for the large drawing viewer.
 * Provides zoom, rotation, fit mode, page navigation, and OCR overlay toggle.
 * Uses Button from the shared UI primitives and Lucide icons.
 */

import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Maximize,
  Minimize2,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "../ui/Shared";

export type FitMode = "width" | "page" | "none";

export interface DrawingViewerControlsProps {
  /** Current zoom level (0.1 - 5.0) */
  zoom: number;
  /** Current rotation (0, 90, 180, 270) */
  rotation: number;
  /** Current fit mode */
  fitMode: FitMode;
  /** Current page number (1-based) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether OCR overlay is visible */
  showOcrOverlay: boolean;
  /** Zoom in handler */
  onZoomIn: () => void;
  /** Zoom out handler */
  onZoomOut: () => void;
  /** Rotate handler */
  onRotate: () => void;
  /** Fit to width handler */
  onFitWidth: () => void;
  /** Fit to page handler */
  onFitPage: () => void;
  /** Page change handler */
  onPageChange: (page: number) => void;
  /** Toggle OCR overlay handler */
  onToggleOverlay: () => void;
}

export function DrawingViewerControls({
  zoom,
  rotation,
  fitMode,
  currentPage,
  totalPages,
  showOcrOverlay,
  onZoomIn,
  onZoomOut,
  onRotate,
  onFitWidth,
  onFitPage,
  onPageChange,
  onToggleOverlay,
}: DrawingViewerControlsProps) {
  const zoomPercent = Math.round(zoom * 100);

  const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= totalPages) {
      onPageChange(value);
    }
  };

  return (
    <div className="flex items-center gap-1 p-2 rounded-lg border border-border bg-background/80 backdrop-blur-sm flex-wrap">
      {/* Zoom controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onZoomOut}
          disabled={zoom <= 0.1}
          title="Zoom out (-)"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground min-w-[3rem] text-center tabular-nums">
          {zoomPercent}%
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onZoomIn}
          disabled={zoom >= 5.0}
          title="Zoom in (+)"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      {/* Divider */}
      <div className="h-5 w-px bg-border mx-1" />

      {/* Rotation */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onRotate}
        title={`Rotate (r) - currently ${rotation}deg`}
        aria-label="Rotate clockwise"
      >
        <RotateCw className="h-4 w-4" />
      </Button>

      {/* Divider */}
      <div className="h-5 w-px bg-border mx-1" />

      {/* Fit controls */}
      <Button
        variant={fitMode === "width" ? "secondary" : "ghost"}
        size="sm"
        onClick={onFitWidth}
        title="Fit to width"
        aria-label="Fit to width"
      >
        <Maximize className="h-4 w-4" />
      </Button>
      <Button
        variant={fitMode === "page" ? "secondary" : "ghost"}
        size="sm"
        onClick={onFitPage}
        title="Fit to page"
        aria-label="Fit to page"
      >
        <Minimize2 className="h-4 w-4" />
      </Button>

      {/* Divider */}
      <div className="h-5 w-px bg-border mx-1" />

      {/* Page navigation */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            title="Previous page"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={handlePageInput}
              className="w-10 h-7 text-center text-xs bg-background border border-border rounded tabular-nums"
              aria-label="Page number"
            />
            <span className="text-xs text-muted-foreground">/ {totalPages}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            title="Next page"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Divider */}
      <div className="h-5 w-px bg-border mx-1" />

      {/* OCR Overlay toggle */}
      <Button
        variant={showOcrOverlay ? "secondary" : "ghost"}
        size="sm"
        onClick={onToggleOverlay}
        title="Toggle OCR overlay (o)"
        aria-label="Toggle OCR overlay"
      >
        <Layers className="h-4 w-4" />
      </Button>
    </div>
  );
}
