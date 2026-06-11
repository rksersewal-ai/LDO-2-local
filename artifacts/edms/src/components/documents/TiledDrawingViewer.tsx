/**
 * TiledDrawingViewer
 *
 * Main viewer component for large engineering drawings with pan/zoom/rotate.
 * Supports mouse-drag panning, wheel zoom (ctrl+scroll), keyboard shortcuts,
 * and integrates with the OCR text overlay and drawing viewer controls.
 * Gated behind the LARGE_DRAWING_VIEWER feature flag.
 *
 * Keyboard shortcuts:
 *   + / = : Zoom in
 *   -     : Zoom out
 *   r     : Rotate 90 degrees clockwise
 *   o     : Toggle OCR overlay
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { isFeatureEnabled } from "../../lib/featureFlags";
import { OcrTextOverlay, type OcrRegion } from "./OcrTextOverlay";
import { DrawingViewerControls, type FitMode } from "./DrawingViewerControls";

export interface TiledDrawingViewerProps {
  /** Document ID for loading */
  documentId: string;
  /** URL of the file/image to display */
  fileUrl?: string;
  /** Total pages for multi-page documents */
  totalPages?: number;
  /** OCR overlay data for the current page */
  ocrOverlayData?: OcrRegion[];
}

interface PanOffset {
  x: number;
  y: number;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5.0;
const ZOOM_STEP = 0.25;
const ROTATION_STEP = 90;

export function TiledDrawingViewer({
  documentId,
  fileUrl,
  totalPages = 1,
  ocrOverlayData = [],
}: TiledDrawingViewerProps) {
  // State management
  const [zoom, setZoom] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [panOffset, setPanOffset] = useState<PanOffset>({ x: 0, y: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [showOcrOverlay, setShowOcrOverlay] = useState(false);
  const [fitMode, setFitMode] = useState<FitMode>("none");
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastPanRef = useRef<PanOffset>({ x: 0, y: 0 });

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
    setFitMode("none");
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
    setFitMode("none");
  }, []);

  // Rotation handler
  const handleRotate = useCallback(() => {
    setRotation((prev) => (prev + ROTATION_STEP) % 360);
  }, []);

  // Fit mode handlers
  const handleFitWidth = useCallback(() => {
    setFitMode("width");
    setZoom(1.0);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const handleFitPage = useCallback(() => {
    setFitMode("page");
    setZoom(1.0);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // Page navigation
  const handlePageChange = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) {
        setCurrentPage(page);
        setPanOffset({ x: 0, y: 0 });
      }
    },
    [totalPages],
  );

  // OCR overlay toggle
  const handleToggleOverlay = useCallback(() => {
    setShowOcrOverlay((prev) => !prev);
  }, []);

  // Mouse drag panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    lastPanRef.current = { ...panOffset };
    e.preventDefault();
  }, [panOffset]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPanOffset({
        x: lastPanRef.current.x + dx,
        y: lastPanRef.current.y + dy,
      });
    },
    [isDragging],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  // Wheel zoom (ctrl + scroll)
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoom((prev) => Math.min(Math.max(prev + delta, MIN_ZOOM), MAX_ZOOM));
      setFitMode("none");
    },
    [],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "+":
        case "=":
          handleZoomIn();
          break;
        case "-":
          handleZoomOut();
          break;
        case "r":
          handleRotate();
          break;
        case "o":
          handleToggleOverlay();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleRotate, handleToggleOverlay]);

  // Feature flag gate - placed after all hooks to comply with Rules of Hooks
  if (!isFeatureEnabled("LARGE_DRAWING_VIEWER")) {
    return null;
  }

  // Build transform CSS
  const transformStyle: React.CSSProperties = {
    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom}) rotate(${rotation}deg)`,
    transformOrigin: "center center",
    transition: isDragging ? "none" : "transform 0.15s ease-out",
    width: fitMode === "width" ? "100%" : undefined,
    height: fitMode === "page" ? "100%" : undefined,
  };

  return (
    <div className="flex flex-col gap-3 w-full h-full" data-document-id={documentId}>
      {/* Controls toolbar */}
      <DrawingViewerControls
        zoom={zoom}
        rotation={rotation}
        fitMode={fitMode}
        currentPage={currentPage}
        totalPages={totalPages}
        showOcrOverlay={showOcrOverlay}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onRotate={handleRotate}
        onFitWidth={handleFitWidth}
        onFitPage={handleFitPage}
        onPageChange={handlePageChange}
        onToggleOverlay={handleToggleOverlay}
      />

      {/* Viewer container */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden rounded-lg border border-border bg-muted/30 min-h-[400px]"
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        role="application"
        aria-label={`Drawing viewer for document ${documentId}, page ${currentPage} of ${totalPages}`}
      >
        {/* Transform layer */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={transformStyle}
        >
          {fileUrl ? (
            <img
              src={fileUrl}
              alt={`Document ${documentId} - Page ${currentPage}`}
              className="max-w-full max-h-full object-contain select-none pointer-events-none"
              draggable={false}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground p-8">
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                <span className="text-2xl">📐</span>
              </div>
              <span className="text-sm">No preview available</span>
              <span className="text-xs">Document: {documentId}</span>
            </div>
          )}

          {/* OCR Text Overlay */}
          <OcrTextOverlay
            regions={ocrOverlayData}
            visible={showOcrOverlay}
            zoom={zoom}
          />
        </div>

        {/* Page indicator */}
        {totalPages > 1 && (
          <div className="absolute bottom-2 right-2 px-2 py-1 text-[10px] text-muted-foreground bg-background/80 rounded border border-border">
            Page {currentPage} / {totalPages}
          </div>
        )}
      </div>
    </div>
  );
}
