/**
 * Search Benchmark Configuration
 *
 * Defines benchmark test scenarios for validating search performance
 * at scale tiers of 10K, 100K, and 600K (6 lakh) documents.
 *
 * Each scenario specifies:
 *   - Query type and parameters
 *   - Expected latency targets (p50, p95, p99)
 *   - Document count tier
 *
 * Latency targets are derived from user experience research:
 *   - p50 < 200ms: perceived as instant
 *   - p95 < 500ms: acceptable for interactive search
 *   - p99 < 2000ms: maximum tolerable for any query
 */

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

/** Document count tiers for benchmarking */
export type BenchmarkTier = "10K" | "100K" | "600K";

/** Types of search operations to benchmark */
export type SearchOperationType =
  | "simple_text"
  | "filtered_search"
  | "faceted_search"
  | "autocomplete_prefix"
  | "wildcard_pattern"
  | "multi_term"
  | "exact_phrase";

/** Latency percentile targets in milliseconds */
export interface LatencyTargets {
  /** 50th percentile (median) - milliseconds */
  p50: number;
  /** 95th percentile - milliseconds */
  p95: number;
  /** 99th percentile - milliseconds */
  p99: number;
}

/**
 * A single benchmark scenario definition.
 */
export interface BenchmarkScenario {
  /** Unique identifier for the scenario */
  id: string;
  /** Human-readable scenario name */
  name: string;
  /** Description of what this scenario tests */
  description: string;
  /** Type of search operation */
  operationType: SearchOperationType;
  /** Document count tier */
  tier: BenchmarkTier;
  /** Example query term for this scenario */
  queryTerm: string;
  /** Filters applied during the benchmark */
  filters: Record<string, string | number | boolean>;
  /** Expected latency targets */
  latencyTargets: LatencyTargets;
  /** Number of iterations to run for statistical significance */
  iterations: number;
  /** Warm-up iterations before measurement begins */
  warmUpIterations: number;
}

/**
 * Complete benchmark configuration.
 */
export interface BenchmarkConfig {
  /** Configuration version */
  version: string;
  /** All benchmark scenarios */
  scenarios: BenchmarkScenario[];
  /** Global settings */
  settings: BenchmarkSettings;
}

/**
 * Global benchmark settings.
 */
export interface BenchmarkSettings {
  /** Base API URL for benchmark requests */
  baseUrl: string;
  /** Request timeout in milliseconds */
  timeoutMs: number;
  /** Concurrent connections during load testing */
  concurrency: number;
  /** Whether to collect detailed timing breakdown */
  detailedTiming: boolean;
  /** Output format for results */
  outputFormat: "json" | "csv" | "table";
}

// ─────────────────────────────────────────────────────────────────────────
// Scenario Definitions
// ─────────────────────────────────────────────────────────────────────────

/**
 * Simple text search scenarios across all tiers.
 */
const SIMPLE_TEXT_SCENARIOS: BenchmarkScenario[] = [
  {
    id: "simple-text-10k",
    name: "Simple Text Search (10K)",
    description: "Single-term full-text search across 10,000 documents",
    operationType: "simple_text",
    tier: "10K",
    queryTerm: "valve",
    filters: {},
    latencyTargets: { p50: 50, p95: 150, p99: 300 },
    iterations: 100,
    warmUpIterations: 10,
  },
  {
    id: "simple-text-100k",
    name: "Simple Text Search (100K)",
    description: "Single-term full-text search across 100,000 documents",
    operationType: "simple_text",
    tier: "100K",
    queryTerm: "valve",
    filters: {},
    latencyTargets: { p50: 100, p95: 300, p99: 800 },
    iterations: 100,
    warmUpIterations: 10,
  },
  {
    id: "simple-text-600k",
    name: "Simple Text Search (600K)",
    description: "Single-term full-text search across 600,000 documents",
    operationType: "simple_text",
    tier: "600K",
    queryTerm: "valve",
    filters: {},
    latencyTargets: { p50: 200, p95: 500, p99: 1500 },
    iterations: 100,
    warmUpIterations: 10,
  },
];

/**
 * Filtered search scenarios (combining text + filter predicates).
 */
const FILTERED_SEARCH_SCENARIOS: BenchmarkScenario[] = [
  {
    id: "filtered-10k",
    name: "Filtered Search (10K)",
    description: "Text search with drawing number filter across 10,000 documents",
    operationType: "filtered_search",
    tier: "10K",
    queryTerm: "pressure",
    filters: { drawing_number_prefix: "DWG-", status: "ACTIVE" },
    latencyTargets: { p50: 60, p95: 180, p99: 400 },
    iterations: 100,
    warmUpIterations: 10,
  },
  {
    id: "filtered-100k",
    name: "Filtered Search (100K)",
    description: "Text search with drawing number filter across 100,000 documents",
    operationType: "filtered_search",
    tier: "100K",
    queryTerm: "pressure",
    filters: { drawing_number_prefix: "DWG-", status: "ACTIVE" },
    latencyTargets: { p50: 120, p95: 350, p99: 900 },
    iterations: 100,
    warmUpIterations: 10,
  },
  {
    id: "filtered-600k",
    name: "Filtered Search (600K)",
    description: "Text search with drawing number filter across 600,000 documents",
    operationType: "filtered_search",
    tier: "600K",
    queryTerm: "pressure",
    filters: { drawing_number_prefix: "DWG-", status: "ACTIVE" },
    latencyTargets: { p50: 250, p95: 600, p99: 1800 },
    iterations: 100,
    warmUpIterations: 10,
  },
];

/**
 * Faceted search scenarios (aggregation queries).
 */
const FACETED_SEARCH_SCENARIOS: BenchmarkScenario[] = [
  {
    id: "faceted-10k",
    name: "Faceted Search (10K)",
    description: "Search with facet aggregation (source, category, status) across 10K docs",
    operationType: "faceted_search",
    tier: "10K",
    queryTerm: "assembly",
    filters: { include_facets: true },
    latencyTargets: { p50: 80, p95: 250, p99: 500 },
    iterations: 50,
    warmUpIterations: 5,
  },
  {
    id: "faceted-100k",
    name: "Faceted Search (100K)",
    description: "Search with facet aggregation across 100K documents",
    operationType: "faceted_search",
    tier: "100K",
    queryTerm: "assembly",
    filters: { include_facets: true },
    latencyTargets: { p50: 150, p95: 450, p99: 1200 },
    iterations: 50,
    warmUpIterations: 5,
  },
  {
    id: "faceted-600k",
    name: "Faceted Search (600K)",
    description: "Search with facet aggregation across 600K documents",
    operationType: "faceted_search",
    tier: "600K",
    queryTerm: "assembly",
    filters: { include_facets: true },
    latencyTargets: { p50: 300, p95: 800, p99: 2000 },
    iterations: 50,
    warmUpIterations: 5,
  },
];

/**
 * Autocomplete prefix search scenarios.
 */
const AUTOCOMPLETE_SCENARIOS: BenchmarkScenario[] = [
  {
    id: "autocomplete-10k",
    name: "Autocomplete Prefix (10K)",
    description: "Prefix-based autocomplete search across 10K documents",
    operationType: "autocomplete_prefix",
    tier: "10K",
    queryTerm: "val*",
    filters: {},
    latencyTargets: { p50: 30, p95: 80, p99: 150 },
    iterations: 200,
    warmUpIterations: 20,
  },
  {
    id: "autocomplete-100k",
    name: "Autocomplete Prefix (100K)",
    description: "Prefix-based autocomplete search across 100K documents",
    operationType: "autocomplete_prefix",
    tier: "100K",
    queryTerm: "val*",
    filters: {},
    latencyTargets: { p50: 60, p95: 150, p99: 350 },
    iterations: 200,
    warmUpIterations: 20,
  },
  {
    id: "autocomplete-600k",
    name: "Autocomplete Prefix (600K)",
    description: "Prefix-based autocomplete search across 600K documents",
    operationType: "autocomplete_prefix",
    tier: "600K",
    queryTerm: "val*",
    filters: {},
    latencyTargets: { p50: 100, p95: 300, p99: 700 },
    iterations: 200,
    warmUpIterations: 20,
  },
];

/**
 * Wildcard pattern search scenarios.
 */
const WILDCARD_SCENARIOS: BenchmarkScenario[] = [
  {
    id: "wildcard-10k",
    name: "Wildcard Pattern (10K)",
    description: "Wildcard pattern matching (e.g., DWG-*-REV-*) across 10K docs",
    operationType: "wildcard_pattern",
    tier: "10K",
    queryTerm: "DWG-*-REV-*",
    filters: {},
    latencyTargets: { p50: 80, p95: 200, p99: 500 },
    iterations: 50,
    warmUpIterations: 5,
  },
  {
    id: "wildcard-100k",
    name: "Wildcard Pattern (100K)",
    description: "Wildcard pattern matching across 100K documents",
    operationType: "wildcard_pattern",
    tier: "100K",
    queryTerm: "DWG-*-REV-*",
    filters: {},
    latencyTargets: { p50: 150, p95: 400, p99: 1000 },
    iterations: 50,
    warmUpIterations: 5,
  },
  {
    id: "wildcard-600k",
    name: "Wildcard Pattern (600K)",
    description: "Wildcard pattern matching across 600K documents",
    operationType: "wildcard_pattern",
    tier: "600K",
    queryTerm: "DWG-*-REV-*",
    filters: {},
    latencyTargets: { p50: 300, p95: 700, p99: 2000 },
    iterations: 50,
    warmUpIterations: 5,
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Default Configuration
// ─────────────────────────────────────────────────────────────────────────

/**
 * All benchmark scenarios combined.
 */
export const ALL_BENCHMARK_SCENARIOS: BenchmarkScenario[] = [
  ...SIMPLE_TEXT_SCENARIOS,
  ...FILTERED_SEARCH_SCENARIOS,
  ...FACETED_SEARCH_SCENARIOS,
  ...AUTOCOMPLETE_SCENARIOS,
  ...WILDCARD_SCENARIOS,
];

/**
 * Default benchmark settings.
 */
export const DEFAULT_BENCHMARK_SETTINGS: BenchmarkSettings = {
  baseUrl: "http://localhost:8000/api/v1",
  timeoutMs: 5000,
  concurrency: 10,
  detailedTiming: true,
  outputFormat: "json",
};

/**
 * Complete default benchmark configuration.
 */
export const DEFAULT_BENCHMARK_CONFIG: BenchmarkConfig = {
  version: "1.0.0",
  scenarios: ALL_BENCHMARK_SCENARIOS,
  settings: DEFAULT_BENCHMARK_SETTINGS,
};

// ─────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────

/**
 * Gets all scenarios for a specific tier.
 */
export function getScenariosByTier(tier: BenchmarkTier): BenchmarkScenario[] {
  return ALL_BENCHMARK_SCENARIOS.filter((s) => s.tier === tier);
}

/**
 * Gets all scenarios for a specific operation type.
 */
export function getScenariosByType(type: SearchOperationType): BenchmarkScenario[] {
  return ALL_BENCHMARK_SCENARIOS.filter((s) => s.operationType === type);
}

/**
 * Calculates total estimated benchmark duration in seconds.
 * Accounts for warm-up iterations and a 50ms average per iteration.
 */
export function estimateBenchmarkDuration(scenarios: BenchmarkScenario[]): number {
  const avgIterationMs = 50;
  const totalIterations = scenarios.reduce(
    (sum, s) => sum + s.iterations + s.warmUpIterations,
    0,
  );
  return Math.ceil((totalIterations * avgIterationMs) / 1000);
}

/**
 * Validates that measured latencies meet the targets for a scenario.
 * Returns true if all percentile targets are met.
 */
export function validateLatencyTargets(
  measured: LatencyTargets,
  targets: LatencyTargets,
): boolean {
  return (
    measured.p50 <= targets.p50 &&
    measured.p95 <= targets.p95 &&
    measured.p99 <= targets.p99
  );
}
