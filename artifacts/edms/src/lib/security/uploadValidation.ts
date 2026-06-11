/**
 * Upload Validation
 *
 * Enhanced upload security that goes beyond basic file validation.
 * Validates file headers (magic bytes) against declared extensions,
 * rejects dangerous MIME types, and detects embedded scripts in
 * SVG/HTML content.
 *
 * Usage:
 *   import { validateUploadSecurity } from "@/lib/security/uploadValidation";
 *
 *   const result = await validateUploadSecurity(file);
 *   if (!result.valid) {
 *     console.error(result.errors);
 *   }
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Result of upload security validation */
export interface ValidationResult {
  /** Whether the file passed all security checks */
  valid: boolean;
  /** List of validation errors found */
  errors: ValidationError[];
  /** List of warnings (non-blocking issues) */
  warnings: string[];
  /** The detected file type based on magic bytes, if determinable */
  detectedType?: string;
}

/** A single validation error */
export interface ValidationError {
  /** Error code for programmatic handling */
  code: ValidationErrorCode;
  /** Human-readable error message */
  message: string;
}

/** Validation error codes */
export type ValidationErrorCode =
  | "MAGIC_BYTE_MISMATCH"
  | "DANGEROUS_MIME_TYPE"
  | "EMBEDDED_SCRIPT"
  | "EMPTY_FILE"
  | "SUSPICIOUS_EXTENSION";

/** Input representing a file to validate */
export interface FileInput {
  /** File name with extension */
  name: string;
  /** MIME type as reported by the browser */
  type: string;
  /** File size in bytes */
  size: number;
  /** File content as ArrayBuffer or Uint8Array */
  content: ArrayBuffer | Uint8Array;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Known magic byte signatures mapped to file types */
export const MAGIC_BYTES: Record<string, { bytes: number[]; offset?: number }> = {
  pdf: { bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  png: { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  jpg: { bytes: [0xff, 0xd8, 0xff] },
  gif: { bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF8
  zip: { bytes: [0x50, 0x4b, 0x03, 0x04] }, // PK..
  docx: { bytes: [0x50, 0x4b, 0x03, 0x04] }, // Same as zip (OOXML)
  xlsx: { bytes: [0x50, 0x4b, 0x03, 0x04] }, // Same as zip (OOXML)
  pptx: { bytes: [0x50, 0x4b, 0x03, 0x04] }, // Same as zip (OOXML)
  bmp: { bytes: [0x42, 0x4d] }, // BM
  tiff: { bytes: [0x49, 0x49, 0x2a, 0x00] }, // II*.
  exe: { bytes: [0x4d, 0x5a] }, // MZ
};

/** File extensions that share the same magic bytes (ZIP-based) */
const ZIP_BASED_EXTENSIONS = new Set(["zip", "docx", "xlsx", "pptx", "odt", "ods", "odp"]);

/** Dangerous MIME types that should be rejected */
export const DANGEROUS_MIME_TYPES: Set<string> = new Set([
  "application/x-executable",
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-dosexec",
  "application/x-shellscript",
  "application/x-sh",
  "application/x-csh",
  "application/x-bat",
  "application/x-msi",
  "application/hta",
  "application/x-httpd-php",
  "application/x-php",
  "text/x-php",
  "application/vnd.microsoft.portable-executable",
]);

/** Extensions considered dangerous */
export const DANGEROUS_EXTENSIONS: Set<string> = new Set([
  "exe",
  "bat",
  "cmd",
  "com",
  "msi",
  "scr",
  "pif",
  "hta",
  "vbs",
  "vbe",
  "js",
  "jse",
  "ws",
  "wsf",
  "wsc",
  "wsh",
  "ps1",
  "ps2",
  "psc1",
  "psc2",
  "reg",
  "inf",
  "lnk",
]);

/** Patterns indicating embedded scripts in text/XML content */
const SCRIPT_PATTERNS: RegExp[] = [
  /<script[\s>]/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /eval\s*\(/i,
  /<iframe[\s>]/i,
  /<object[\s>]/i,
  /<embed[\s>]/i,
  /<link[^>]+rel\s*=\s*["']?import/i,
];

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Validate a file for upload security concerns.
 *
 * Performs the following checks:
 * 1. Empty file detection
 * 2. Dangerous extension check
 * 3. Dangerous MIME type check
 * 4. Magic byte validation against declared extension
 * 5. Embedded script detection for SVG/HTML/XML content
 *
 * @param file - The file input to validate
 * @returns ValidationResult with detailed findings
 */
export function validateUploadSecurity(file: FileInput): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];
  let detectedType: string | undefined;

  // Check for empty file
  if (file.size === 0) {
    errors.push({
      code: "EMPTY_FILE",
      message: "File is empty (0 bytes)",
    });
    return { valid: false, errors, warnings };
  }

  const extension = getExtension(file.name);

  // Check for dangerous extensions
  if (extension && DANGEROUS_EXTENSIONS.has(extension)) {
    errors.push({
      code: "SUSPICIOUS_EXTENSION",
      message: `File extension ".${extension}" is not allowed for security reasons`,
    });
  }

  // Check for dangerous MIME types
  if (DANGEROUS_MIME_TYPES.has(file.type)) {
    errors.push({
      code: "DANGEROUS_MIME_TYPE",
      message: `MIME type "${file.type}" is not allowed for security reasons`,
    });
  }

  // Validate magic bytes
  const contentBytes = new Uint8Array(
    file.content instanceof ArrayBuffer ? file.content : file.content.buffer,
  );
  const magicResult = validateMagicBytes(contentBytes, extension);
  detectedType = magicResult.detectedType;

  if (magicResult.mismatch) {
    errors.push({
      code: "MAGIC_BYTE_MISMATCH",
      message: magicResult.message ?? `File content does not match declared extension ".${extension}"`,
    });
  }

  if (magicResult.warning) {
    warnings.push(magicResult.warning);
  }

  // Check for embedded scripts in text-like content
  if (isTextLikeContent(extension, file.type)) {
    const scriptResult = checkEmbeddedScripts(contentBytes);
    if (scriptResult.hasScripts) {
      errors.push({
        code: "EMBEDDED_SCRIPT",
        message: scriptResult.message ?? "File contains embedded scripts",
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    detectedType,
  };
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Extract the file extension from a filename (lowercase, without dot).
 */
export function getExtension(filename: string): string | undefined {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot < 0 || lastDot === filename.length - 1) return undefined;
  return filename.slice(lastDot + 1).toLowerCase();
}

/**
 * Check if magic bytes match the declared file extension.
 */
function validateMagicBytes(
  content: Uint8Array,
  extension: string | undefined,
): { mismatch: boolean; detectedType?: string; message?: string; warning?: string } {
  if (!extension || content.length < 2) {
    return { mismatch: false };
  }

  // Detect actual file type from magic bytes
  const detectedType = detectFileType(content);

  // If the declared extension has a known magic byte signature
  const expectedSignature = MAGIC_BYTES[extension];

  if (!expectedSignature) {
    // No known signature for this extension, skip magic byte validation
    return { mismatch: false, detectedType };
  }

  // Check if content matches expected signature
  const offset = expectedSignature.offset ?? 0;
  const matches = expectedSignature.bytes.every(
    (byte, i) => content[offset + i] === byte,
  );

  if (matches) {
    return { mismatch: false, detectedType: extension };
  }

  // Special case: ZIP-based formats share magic bytes
  if (ZIP_BASED_EXTENSIONS.has(extension) && detectedType && ZIP_BASED_EXTENSIONS.has(detectedType)) {
    return { mismatch: false, detectedType: extension };
  }

  // Detected an executable signature for a non-executable extension
  if (detectedType === "exe" && extension !== "exe") {
    return {
      mismatch: true,
      detectedType: "exe",
      message: `File appears to be an executable but has extension ".${extension}"`,
    };
  }

  return {
    mismatch: true,
    detectedType,
    message: `File content does not match declared extension ".${extension}". Detected type: ${detectedType ?? "unknown"}`,
  };
}

/**
 * Detect file type from magic bytes.
 */
function detectFileType(content: Uint8Array): string | undefined {
  for (const [type, sig] of Object.entries(MAGIC_BYTES)) {
    const offset = sig.offset ?? 0;
    if (content.length < offset + sig.bytes.length) continue;

    const matches = sig.bytes.every((byte, i) => content[offset + i] === byte);
    if (matches) return type;
  }
  return undefined;
}

/**
 * Check if the file is a text-like format that could contain embedded scripts.
 */
function isTextLikeContent(extension: string | undefined, mimeType: string): boolean {
  const textExtensions = new Set(["svg", "html", "htm", "xml", "xhtml", "xsl", "xslt"]);
  const textMimeTypes = new Set([
    "image/svg+xml",
    "text/html",
    "text/xml",
    "application/xml",
    "application/xhtml+xml",
  ]);

  if (extension && textExtensions.has(extension)) return true;
  if (textMimeTypes.has(mimeType)) return true;
  return false;
}

/**
 * Check text content for embedded scripts.
 */
function checkEmbeddedScripts(
  content: Uint8Array,
): { hasScripts: boolean; message?: string } {
  // Decode content as text
  let text: string;
  try {
    const decoder = new TextDecoder("utf-8", { fatal: false });
    text = decoder.decode(content);
  } catch {
    return { hasScripts: false };
  }

  for (const pattern of SCRIPT_PATTERNS) {
    if (pattern.test(text)) {
      return {
        hasScripts: true,
        message: `File contains potentially dangerous content matching pattern: ${pattern.source}`,
      };
    }
  }

  return { hasScripts: false };
}
