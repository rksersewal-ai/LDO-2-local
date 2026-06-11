/**
 * OcrTextOverlay
 *
 * Renders OCR text regions as positioned overlays on the drawing viewer.
 * Each region is absolutely positioned within the viewer container and
 * color-coded by confidence level (green >85, yellow 60-85, red <60).
 * Text is shown on hover for each region.
 */

import React, { useState } from "react";

export interface OcrRegion {
  /** Extracted text content */
  text: string;
  /** X position as percentage of container width */
  x: number;
  /** Y position as percentage of container height */
  y: number;
  /** Width as percentage of container width */
  width: number;
  /** Height as percentage of container height */
  height: number;
  /** OCR confidence score (0-100) */
  confidence: number;
}

export interface OcrTextOverlayProps {
  /** Array of OCR text regions to display */
  regions: OcrRegion[];
  /** Whether the overlay is visible */
  visible: boolean;
  /** Current zoom level of the viewer */
  zoom: number;
}

function getConfidenceColor(confidence: number): string {
  if (confidence > 85) return "rgba(34, 197, 94, 0.25)";
  if (confidence >= 60) return "rgba(234, 179, 8, 0.25)";
  return "rgba(239, 68, 68, 0.25)";
}

function getConfidenceBorderColor(confidence: number): string {
  if (confidence > 85) return "rgba(34, 197, 94, 0.6)";
  if (confidence >= 60) return "rgba(234, 179, 8, 0.6)";
  return "rgba(239, 68, 68, 0.6)";
}

export function OcrTextOverlay({ regions, visible, zoom }: OcrTextOverlayProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!visible || regions.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
      aria-label="OCR text overlay"
    >
      {regions.map((region, index) => (
        <div
          key={`ocr-region-${index}`}
          className="absolute pointer-events-auto cursor-help transition-opacity duration-150"
          style={{
            left: `${region.x}%`,
            top: `${region.y}%`,
            width: `${region.width}%`,
            height: `${region.height}%`,
            backgroundColor: getConfidenceColor(region.confidence),
            border: `1px solid ${getConfidenceBorderColor(region.confidence)}`,
            borderRadius: "2px",
          }}
          onMouseEnter={() => setHoveredIndex(index)}
          onMouseLeave={() => setHoveredIndex(null)}
          title={region.text}
        >
          {hoveredIndex === index && (
            <div
              className="absolute bottom-full left-0 mb-1 px-2 py-1 bg-background/95 border border-border rounded text-xs text-foreground shadow-lg max-w-[200px] truncate"
              style={{ fontSize: `${Math.max(10, 12 / zoom)}px`, zIndex: 20 }}
            >
              <span className="block truncate">{region.text}</span>
              <span className="block text-muted-foreground mt-0.5">
                Confidence: {region.confidence}%
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
