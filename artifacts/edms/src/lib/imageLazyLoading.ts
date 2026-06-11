/**
 * Image Lazy Loading Utility
 *
 * Provides utilities for lazy loading images and thumbnails using
 * IntersectionObserver API. Optimizes initial page load by deferring
 * off-screen image loading until they approach the viewport.
 *
 * Features:
 *   - IntersectionObserver factory with configurable thresholds
 *   - Responsive srcSet generation for multiple sizes
 *   - Placeholder data URL generation for layout stability
 *   - Load priority calculation based on viewport proximity
 */

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

/** Configuration for lazy image loading */
export interface LazyImageConfig {
  /** Root margin for intersection observer (default: "200px") */
  rootMargin: string;
  /** Intersection threshold (0-1, default: 0.1) */
  threshold: number;
  /** Whether to use native loading="lazy" attribute (default: true) */
  useNativeLoading: boolean;
  /** Placeholder color while loading (default: "#f0f0f0") */
  placeholderColor: string;
}

/** Responsive image size descriptor */
export interface ImageSizeDescriptor {
  width: number;
  suffix: string;
}

/** Viewport rect for priority calculation */
export interface ViewportRect {
  width: number;
  height: number;
  scrollY: number;
}

/** Element rect for priority calculation */
export interface ElementRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Load priority levels */
export type LoadPriority = "critical" | "high" | "medium" | "low";

/** Observer callback type */
export type IntersectionCallback = (
  entries: IntersectionObserverEntry[],
  observer: IntersectionObserver,
) => void;

// ─────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────

/** Default lazy image configuration */
export const DEFAULT_LAZY_CONFIG: LazyImageConfig = {
  rootMargin: "200px",
  threshold: 0.1,
  useNativeLoading: true,
  placeholderColor: "#f0f0f0",
};

/** Standard responsive image sizes */
export const STANDARD_SIZES: ImageSizeDescriptor[] = [
  { width: 320, suffix: "sm" },
  { width: 640, suffix: "md" },
  { width: 1024, suffix: "lg" },
  { width: 1920, suffix: "xl" },
];

// ─────────────────────────────────────────────────────────────────────────
// Core Functions
// ─────────────────────────────────────────────────────────────────────────

/**
 * Create an IntersectionObserver with lazy loading defaults.
 *
 * @param callback - Function called when elements intersect
 * @param options - Optional override for default config
 * @returns IntersectionObserver instance or null if API unavailable
 */
export function createIntersectionObserver(
  callback: IntersectionCallback,
  options?: Partial<LazyImageConfig>,
): IntersectionObserver | null {
  if (typeof IntersectionObserver === "undefined") {
    return null;
  }

  const config = { ...DEFAULT_LAZY_CONFIG, ...options };

  return new IntersectionObserver(callback, {
    rootMargin: config.rootMargin,
    threshold: config.threshold,
  });
}

/**
 * Build a srcSet string for responsive images.
 * Generates URLs for each size by appending width-based suffixes.
 *
 * @param baseUrl - Base image URL (without extension or with extension)
 * @param sizes - Array of size descriptors (defaults to STANDARD_SIZES)
 * @returns srcSet string for use in img/source elements
 *
 * @example
 *   buildSrcSet('/images/doc-thumb', STANDARD_SIZES)
 *   // "/images/doc-thumb-sm.jpg 320w, /images/doc-thumb-md.jpg 640w, ..."
 */
export function buildSrcSet(
  baseUrl: string,
  sizes: ImageSizeDescriptor[] = STANDARD_SIZES,
): string {
  // Split extension from base
  const lastDot = baseUrl.lastIndexOf(".");
  const hasExtension = lastDot > baseUrl.lastIndexOf("/");

  const base = hasExtension ? baseUrl.slice(0, lastDot) : baseUrl;
  const ext = hasExtension ? baseUrl.slice(lastDot) : ".jpg";

  return sizes
    .map((size) => `${base}-${size.suffix}${ext} ${size.width}w`)
    .join(", ");
}

/**
 * Generate a lightweight placeholder data URL for layout stability.
 * Creates a minimal SVG-based data URL with the specified dimensions and color.
 *
 * @param width - Placeholder width in pixels
 * @param height - Placeholder height in pixels
 * @param color - Fill color (default from config)
 * @returns Data URL string for use as placeholder src
 */
export function generatePlaceholderDataUrl(
  width: number,
  height: number,
  color: string = DEFAULT_LAZY_CONFIG.placeholderColor,
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${color}"/></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Calculate load priority for an image based on viewport proximity.
 * Images closer to the current viewport get higher priority.
 *
 * Priority levels:
 *   - critical: element is within the visible viewport
 *   - high: element is within 1 viewport height of being visible
 *   - medium: element is within 2 viewport heights
 *   - low: element is further than 2 viewport heights away
 *
 * @param viewport - Current viewport dimensions and scroll position
 * @param elementRect - Target element's position and dimensions
 * @returns LoadPriority level
 */
export function calculateLoadPriority(
  viewport: ViewportRect,
  elementRect: ElementRect,
): LoadPriority {
  const viewportBottom = viewport.scrollY + viewport.height;
  const elementTop = elementRect.top;

  // Element is within or above the visible viewport
  if (elementTop < viewportBottom && elementTop + elementRect.height > viewport.scrollY) {
    return "critical";
  }

  // Distance from viewport bottom to element top
  const distanceBelow = elementTop - viewportBottom;

  // Element is above viewport (already scrolled past)
  if (elementTop + elementRect.height < viewport.scrollY) {
    return "low";
  }

  // Within 1 viewport height below
  if (distanceBelow <= viewport.height) {
    return "high";
  }

  // Within 2 viewport heights below
  if (distanceBelow <= viewport.height * 2) {
    return "medium";
  }

  return "low";
}
