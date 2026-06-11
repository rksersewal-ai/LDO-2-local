/**
 * File Validation Utility
 *
 * Validates uploaded files for the EDMS pipeline. Checks include:
 *   - File size (configurable max, default 500MB from ocr_pipeline.yaml)
 *   - MIME type (allowlist for engineering docs)
 *   - File extension matching
 *   - Magic bytes detection (PDF, PNG, TIFF, JPEG)
 *
 * Config alignment: config/ocr_pipeline.yaml max_file_size_mb: 500
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface FileValidationOptions {
  /** Maximum file size in bytes. Default: 500MB (from ocr_pipeline.yaml) */
  maxSizeBytes?: number;
  /** Allowed MIME types. Defaults to engineering document types. */
  allowedMimeTypes?: string[];
  /** Allowed file extensions (with dot). Defaults to engineering extensions. */
  allowedExtensions?: string[];
  /** Whether to check magic bytes. Default: true */
  checkMagicBytes?: boolean;
}

export type DetectedFileType = "pdf" | "png" | "tiff" | "jpeg" | "unknown";

// ─── Constants (aligned with config/ocr_pipeline.yaml) ────────────────────────

/** Default max file size: 500MB from config/ocr_pipeline.yaml max_file_size_mb */
export const DEFAULT_MAX_SIZE_BYTES = 500 * 1024 * 1024;

/** Allowed MIME types for engineering documents */
export const ALLOWED_MIME_TYPES: string[] = [
  "application/pdf",
  "image/tiff",
  "image/png",
  "image/jpeg",
  "application/acad",
  "image/vnd.dwg",
  "image/x-dwg",
  "application/dxf",
  "image/vnd.dxf",
];

/** Allowed file extensions */
export const ALLOWED_EXTENSIONS: string[] = [
  ".pdf",
  ".tiff",
  ".tif",
  ".png",
  ".jpeg",
  ".jpg",
  ".dwg",
  ".dxf",
];

/**
 * Magic byte signatures for file type detection.
 * PDF:  %PDF (hex 25 50 44 46)
 * PNG:  89 50 4E 47
 * TIFF: 49 49 2A 00 (little-endian) or 4D 4D 00 2A (big-endian)
 * JPEG: FF D8 FF
 */
export const MAGIC_BYTES: Record<DetectedFileType, number[][]> = {
  pdf: [[0x25, 0x50, 0x44, 0x46]], // %PDF
  png: [[0x89, 0x50, 0x4e, 0x47]], // .PNG
  tiff: [
    [0x49, 0x49, 0x2a, 0x00], // Little-endian TIFF
    [0x4d, 0x4d, 0x00, 0x2a], // Big-endian TIFF
  ],
  jpeg: [[0xff, 0xd8, 0xff]], // JPEG SOI marker
  unknown: [],
};

/** Map extensions to expected detected file types */
const EXTENSION_TYPE_MAP: Record<string, DetectedFileType> = {
  ".pdf": "pdf",
  ".png": "png",
  ".tiff": "tiff",
  ".tif": "tiff",
  ".jpeg": "jpeg",
  ".jpg": "jpeg",
};

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Detect file type from magic bytes (first few bytes of file content).
 *
 * @param bytes - The first 4+ bytes of the file as a Uint8Array
 * @returns The detected file type or "unknown"
 */
export function detectFileType(bytes: Uint8Array): DetectedFileType {
  if (bytes.length < 3) return "unknown";

  for (const [type, signatures] of Object.entries(MAGIC_BYTES)) {
    if (type === "unknown") continue;
    for (const sig of signatures) {
      if (bytes.length >= sig.length) {
        const match = sig.every((byte, i) => bytes[i] === byte);
        if (match) return type as DetectedFileType;
      }
    }
  }

  return "unknown";
}

/**
 * Extract the file extension from a filename (lowercased, with dot).
 *
 * @param filename - The file name to extract extension from
 * @returns The extension (e.g., ".pdf") or empty string
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1 || lastDot === filename.length - 1) return "";
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Validate a file against configured rules.
 *
 * Checks (in order):
 *   1. File is not empty
 *   2. File size within limit
 *   3. MIME type in allowlist
 *   4. Extension in allowlist
 *   5. Magic bytes match expected type (if enabled and bytes provided)
 *
 * @param file - Object with file metadata (name, size, type) and optional header bytes
 * @param options - Validation options to override defaults
 * @returns ValidationResult with valid flag and errors array
 */
export function validateFile(
  file: {
    name: string;
    size: number;
    type: string;
    headerBytes?: Uint8Array;
  },
  options?: FileValidationOptions,
): ValidationResult {
  const errors: ValidationError[] = [];
  const maxSize = options?.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
  const allowedTypes = options?.allowedMimeTypes ?? ALLOWED_MIME_TYPES;
  const allowedExts = options?.allowedExtensions ?? ALLOWED_EXTENSIONS;
  const checkMagic = options?.checkMagicBytes ?? true;

  // 1. Check for empty file
  if (file.size === 0) {
    errors.push({
      field: "size",
      message: "File is empty (0 bytes)",
      code: "FILE_EMPTY",
    });
    return { valid: false, errors };
  }

  // 2. Check file size
  if (file.size > maxSize) {
    const maxMB = Math.round(maxSize / (1024 * 1024));
    const fileMB = (file.size / (1024 * 1024)).toFixed(1);
    errors.push({
      field: "size",
      message: `File size ${fileMB}MB exceeds maximum allowed ${maxMB}MB`,
      code: "FILE_TOO_LARGE",
    });
  }

  // 3. Check MIME type
  if (file.type && !allowedTypes.includes(file.type)) {
    errors.push({
      field: "type",
      message: `File type '${file.type}' is not supported. Allowed: ${allowedTypes.join(", ")}`,
      code: "FILE_INVALID_TYPE",
    });
  }

  // 4. Check extension
  const extension = getFileExtension(file.name);
  if (extension && !allowedExts.includes(extension)) {
    errors.push({
      field: "extension",
      message: `File extension '${extension}' is not supported. Allowed: ${allowedExts.join(", ")}`,
      code: "FILE_INVALID_EXTENSION",
    });
  }

  // 5. Check magic bytes (if enabled and header bytes provided)
  if (checkMagic && file.headerBytes && file.headerBytes.length >= 3) {
    const detectedType = detectFileType(file.headerBytes);
    if (detectedType !== "unknown" && extension) {
      const expectedType = EXTENSION_TYPE_MAP[extension];
      if (expectedType && expectedType !== detectedType) {
        errors.push({
          field: "content",
          message: `File content (${detectedType}) does not match extension '${extension}'`,
          code: "FILE_EXTENSION_MISMATCH",
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
