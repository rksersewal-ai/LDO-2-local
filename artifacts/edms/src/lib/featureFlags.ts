/**
 * Feature Flags Utility
 *
 * Reads VITE_FF_* environment variables to gate features behind toggles.
 * All flags default to `false` unless explicitly set to "true" or "1".
 *
 * Usage:
 *   import { featureFlags, isFeatureEnabled } from "@/lib/featureFlags";
 *
 *   if (featureFlags.TILED_OCR) { ... }
 *   if (isFeatureEnabled("LARGE_DRAWING_VIEWER")) { ... }
 *
 * To enable a flag, set the environment variable in .env or at build time:
 *   VITE_FF_TILED_OCR=true
 */

/** All known feature flag keys */
export type FeatureFlagKey =
  | "TILED_OCR"
  | "LARGE_DRAWING_VIEWER"
  | "ADVANCED_OCR_POSTPROCESSING"
  | "NEW_SEARCH_BACKEND"
  | "SSO_KEYCLOAK"
  | "STORAGE_TIERING"
  | "NEW_ADMIN_DASHBOARD"
  | "AUDIT_HASH_CHAIN"
  | "BULK_PROCESSING";

const FLAG_KEYS: FeatureFlagKey[] = [
  "TILED_OCR",
  "LARGE_DRAWING_VIEWER",
  "ADVANCED_OCR_POSTPROCESSING",
  "NEW_SEARCH_BACKEND",
  "SSO_KEYCLOAK",
  "STORAGE_TIERING",
  "NEW_ADMIN_DASHBOARD",
  "AUDIT_HASH_CHAIN",
  "BULK_PROCESSING",
];

function readFlag(key: FeatureFlagKey): boolean {
  const envKey = `VITE_FF_${key}`;
  const value = import.meta.env[envKey];
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

/** Resolved feature flags object - evaluated once at module load */
export const featureFlags: Readonly<Record<FeatureFlagKey, boolean>> = Object.freeze(
  FLAG_KEYS.reduce(
    (acc, key) => {
      acc[key] = readFlag(key);
      return acc;
    },
    {} as Record<FeatureFlagKey, boolean>,
  ),
);

/** Check if a specific feature flag is enabled */
export function isFeatureEnabled(key: FeatureFlagKey): boolean {
  return featureFlags[key] ?? false;
}

/** Get all enabled feature flags (useful for diagnostics/logging) */
export function getEnabledFlags(): FeatureFlagKey[] {
  return FLAG_KEYS.filter((key) => featureFlags[key]);
}

/** Get all feature flags with their current values */
export function getAllFlags(): Record<FeatureFlagKey, boolean> {
  return { ...featureFlags };
}
