/**
 * Content-Addressed Storage
 *
 * Provides path generation for content-addressed file storage.
 * Given a hex hash string, generates a hierarchical storage path in the format
 * /aa/bb/<full-hash> where aa = first 2 chars, bb = next 2 chars of the hash.
 *
 * Also includes a synchronous deterministic hash function (FNV-1a based)
 * for hashing file content without requiring Web Crypto APIs.
 *
 * NOTE: The hash function is NOT cryptographically secure. It uses multiple
 * rounds of FNV-1a to produce 256 bits of output, which is sufficient for
 * deduplication of non-adversarial inputs but trivially forgeable. Intentional
 * collisions can be constructed. For production use where collision resistance
 * matters (e.g., untrusted inputs), prefer SubtleCrypto with SHA-256.
 *
 * Usage:
 *   import { generateStoragePath, validateHash, hashContent } from "@/lib/storage/contentAddressedStorage";
 *
 *   const hash = hashContent("file content here");
 *   const path = generateStoragePath(hash);
 *   // => "/ab/cd/abcd1234...full-hash"
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Parsed components of a content-addressed storage path */
export interface ParsedStoragePath {
  /** First 2-character prefix directory */
  prefix1: string;
  /** Second 2-character prefix directory */
  prefix2: string;
  /** Full hash string (filename) */
  hash: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Expected length of a valid SHA-256 hex hash */
const HASH_LENGTH = 64;

/** Pattern matching a valid hex string of exactly 64 characters */
const HEX_PATTERN = /^[0-9a-f]{64}$/;

/** Pattern matching the content-addressed path format */
const PATH_PATTERN = /^\/([0-9a-f]{2})\/([0-9a-f]{2})\/([0-9a-f]{64})$/;

// ─── Hash Function ────────────────────────────────────────────────────────────

/**
 * Deterministic hash function using FNV-1a variant.
 * Produces a 64-character hex string (simulating SHA-256 length) for
 * compatibility with the content-addressed storage path format.
 *
 * This is NOT cryptographically secure and is NOT collision-resistant against
 * adversarial inputs. It is suitable for deterministic content addressing and
 * deduplication of non-adversarial data in a client-side context. For production
 * systems requiring collision resistance, prefer SubtleCrypto/SHA-256.
 *
 * @param content - The string content to hash
 * @returns A 64-character lowercase hexadecimal hash string
 */
export function hashContent(content: string): string {
  // Use multiple rounds of FNV-1a to produce enough bits for 64 hex chars (256 bits)
  const segments: string[] = [];

  for (let round = 0; round < 4; round++) {
    let h1 = (0xdeadbeef + round * 17) | 0;
    let h2 = (0x41c6ce57 + round * 31) | 0;

    for (let i = 0; i < content.length; i++) {
      const ch = content.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }

    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    const part1 = (h1 >>> 0).toString(16).padStart(8, "0");
    const part2 = (h2 >>> 0).toString(16).padStart(8, "0");
    segments.push(part1 + part2);
  }

  return segments.join("");
}

// ─── Path Generation ──────────────────────────────────────────────────────────

/**
 * Generate a content-addressed storage path from a hex hash.
 * The path follows the format: /aa/bb/<full-hash>
 * where aa = first 2 chars and bb = next 2 chars of the hash.
 *
 * @param hash - A 64-character lowercase hexadecimal hash string
 * @returns The storage path string
 * @throws Error if the hash is not valid
 */
export function generateStoragePath(hash: string): string {
  const normalizedHash = hash.toLowerCase();

  if (!validateHash(normalizedHash)) {
    throw new Error(
      `Invalid hash: expected a 64-character hexadecimal string, got "${hash}"`,
    );
  }

  const prefix1 = normalizedHash.slice(0, 2);
  const prefix2 = normalizedHash.slice(2, 4);

  return `/${prefix1}/${prefix2}/${normalizedHash}`;
}

/**
 * Parse a content-addressed storage path into its components.
 * Returns null if the path does not match the expected format.
 *
 * @param path - A storage path string in the format /aa/bb/<hash>
 * @returns Parsed components or null if invalid
 */
export function parseStoragePath(path: string): ParsedStoragePath | null {
  const match = path.match(PATH_PATTERN);

  if (!match) {
    return null;
  }

  return {
    prefix1: match[1],
    prefix2: match[2],
    hash: match[3],
  };
}

/**
 * Validate that a string is a properly formatted SHA-256 hex hash.
 * Must be exactly 64 lowercase hexadecimal characters.
 *
 * @param hash - The string to validate
 * @returns true if the hash is valid
 */
export function validateHash(hash: string): boolean {
  if (typeof hash !== "string") {
    return false;
  }

  if (hash.length !== HASH_LENGTH) {
    return false;
  }

  return HEX_PATTERN.test(hash);
}
