#!/usr/bin/env bash
# ============================================================================
# Search Benchmark Script
# ============================================================================
# Runs search performance benchmarks against the EDMS API.
# Tests search latency at 3 document scale tiers: 10K, 100K, and 600K.
#
# Usage:
#   ./scripts/search-benchmark.sh [OPTIONS]
#
# Options:
#   --tier TIER        Run only a specific tier (10k, 100k, 600k)
#   --warmup N         Number of warm-up iterations (default: 10)
#   --iterations N     Number of measurement iterations (default: 100)
#   --output FORMAT    Output format: json, csv, table (default: table)
#   --base-url URL     API base URL (default: http://localhost:8000/api/v1)
#   --help             Show this help message
#
# Prerequisites:
#   - curl (for HTTP requests)
#   - jq (for JSON processing)
#   - bc (for floating point math)
#
# ============================================================================

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────

BASE_URL="${SEARCH_BENCHMARK_BASE_URL:-http://localhost:8000/api/v1}"
WARMUP_ITERATIONS=10
MEASUREMENT_ITERATIONS=100
OUTPUT_FORMAT="table"
TIER_FILTER=""
RESULTS_DIR="./benchmark-results"

# ── Argument Parsing ───────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case $1 in
    --tier)
      TIER_FILTER="$2"
      shift 2
      ;;
    --warmup)
      WARMUP_ITERATIONS="$2"
      shift 2
      ;;
    --iterations)
      MEASUREMENT_ITERATIONS="$2"
      shift 2
      ;;
    --output)
      OUTPUT_FORMAT="$2"
      shift 2
      ;;
    --base-url)
      BASE_URL="$2"
      shift 2
      ;;
    --help)
      head -30 "$0" | tail -28
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# ── Helper Functions ───────────────────────────────────────────────────────

timestamp() {
  date +"%Y-%m-%d %H:%M:%S"
}

log() {
  echo "[$(timestamp)] $*"
}

# Measure a single request latency in milliseconds
measure_request() {
  local url="$1"
  local start end elapsed_ms

  start=$(date +%s%N)
  curl -s -o /dev/null -w "" "$url" 2>/dev/null || true
  end=$(date +%s%N)

  elapsed_ms=$(( (end - start) / 1000000 ))
  echo "$elapsed_ms"
}

# Calculate percentiles from a sorted array of values
calculate_percentile() {
  local -a values=("${!1}")
  local percentile=$2
  local count=${#values[@]}
  local index

  index=$(echo "$count * $percentile / 100" | bc)
  if [ "$index" -ge "$count" ]; then
    index=$((count - 1))
  fi
  echo "${values[$index]}"
}

# ── Benchmark Scenarios ────────────────────────────────────────────────────

# Simple text search
run_simple_text_search() {
  local tier="$1"
  log "Running: Simple Text Search ($tier)"
  local url="${BASE_URL}/search?q=valve&tier=${tier}"

  # Warm-up
  for ((i=0; i<WARMUP_ITERATIONS; i++)); do
    measure_request "$url" > /dev/null
  done

  # Measurement
  local -a latencies=()
  for ((i=0; i<MEASUREMENT_ITERATIONS; i++)); do
    latencies+=("$(measure_request "$url")")
  done

  # Sort and calculate percentiles
  IFS=$'\n' sorted=($(sort -n <<<"${latencies[*]}")); unset IFS
  local p50 p95 p99
  p50=$(calculate_percentile sorted[@] 50)
  p95=$(calculate_percentile sorted[@] 95)
  p99=$(calculate_percentile sorted[@] 99)

  echo "simple_text|${tier}|${p50}|${p95}|${p99}"
}

# Filtered search (text + drawing number prefix)
run_filtered_search() {
  local tier="$1"
  log "Running: Filtered Search ($tier)"
  local url="${BASE_URL}/search?q=pressure&drawing_number_prefix=DWG-&status=ACTIVE&tier=${tier}"

  # Warm-up
  for ((i=0; i<WARMUP_ITERATIONS; i++)); do
    measure_request "$url" > /dev/null
  done

  # Measurement
  local -a latencies=()
  for ((i=0; i<MEASUREMENT_ITERATIONS; i++)); do
    latencies+=("$(measure_request "$url")")
  done

  IFS=$'\n' sorted=($(sort -n <<<"${latencies[*]}")); unset IFS
  local p50 p95 p99
  p50=$(calculate_percentile sorted[@] 50)
  p95=$(calculate_percentile sorted[@] 95)
  p99=$(calculate_percentile sorted[@] 99)

  echo "filtered|${tier}|${p50}|${p95}|${p99}"
}

# Faceted search (with aggregations)
run_faceted_search() {
  local tier="$1"
  log "Running: Faceted Search ($tier)"
  local url="${BASE_URL}/search?q=assembly&include_facets=true&tier=${tier}"

  # Warm-up
  for ((i=0; i<WARMUP_ITERATIONS; i++)); do
    measure_request "$url" > /dev/null
  done

  # Measurement
  local -a latencies=()
  for ((i=0; i<MEASUREMENT_ITERATIONS; i++)); do
    latencies+=("$(measure_request "$url")")
  done

  IFS=$'\n' sorted=($(sort -n <<<"${latencies[*]}")); unset IFS
  local p50 p95 p99
  p50=$(calculate_percentile sorted[@] 50)
  p95=$(calculate_percentile sorted[@] 95)
  p99=$(calculate_percentile sorted[@] 99)

  echo "faceted|${tier}|${p50}|${p95}|${p99}"
}

# Autocomplete prefix search
run_autocomplete_search() {
  local tier="$1"
  log "Running: Autocomplete Prefix ($tier)"
  local url="${BASE_URL}/search/autocomplete?prefix=val&tier=${tier}"

  # Warm-up
  for ((i=0; i<WARMUP_ITERATIONS; i++)); do
    measure_request "$url" > /dev/null
  done

  # Measurement
  local -a latencies=()
  for ((i=0; i<MEASUREMENT_ITERATIONS; i++)); do
    latencies+=("$(measure_request "$url")")
  done

  IFS=$'\n' sorted=($(sort -n <<<"${latencies[*]}")); unset IFS
  local p50 p95 p99
  p50=$(calculate_percentile sorted[@] 50)
  p95=$(calculate_percentile sorted[@] 95)
  p99=$(calculate_percentile sorted[@] 99)

  echo "autocomplete|${tier}|${p50}|${p95}|${p99}"
}

# Wildcard pattern search
run_wildcard_search() {
  local tier="$1"
  log "Running: Wildcard Pattern ($tier)"
  local url="${BASE_URL}/search?q=DWG-*-REV-*&pattern=true&tier=${tier}"

  # Warm-up
  for ((i=0; i<WARMUP_ITERATIONS; i++)); do
    measure_request "$url" > /dev/null
  done

  # Measurement
  local -a latencies=()
  for ((i=0; i<MEASUREMENT_ITERATIONS; i++)); do
    latencies+=("$(measure_request "$url")")
  done

  IFS=$'\n' sorted=($(sort -n <<<"${latencies[*]}")); unset IFS
  local p50 p95 p99
  p50=$(calculate_percentile sorted[@] 50)
  p95=$(calculate_percentile sorted[@] 95)
  p99=$(calculate_percentile sorted[@] 99)

  echo "wildcard|${tier}|${p50}|${p95}|${p99}"
}

# ── Main Execution ─────────────────────────────────────────────────────────

main() {
  log "Search Benchmark Starting"
  log "Base URL: ${BASE_URL}"
  log "Warm-up iterations: ${WARMUP_ITERATIONS}"
  log "Measurement iterations: ${MEASUREMENT_ITERATIONS}"
  log "Output format: ${OUTPUT_FORMAT}"
  echo ""

  mkdir -p "$RESULTS_DIR"

  local -a tiers=("10k" "100k" "600k")
  if [ -n "$TIER_FILTER" ]; then
    tiers=("$TIER_FILTER")
  fi

  local -a results=()

  for tier in "${tiers[@]}"; do
    log "=== Tier: ${tier} ==="
    results+=("$(run_simple_text_search "$tier")")
    results+=("$(run_filtered_search "$tier")")
    results+=("$(run_faceted_search "$tier")")
    results+=("$(run_autocomplete_search "$tier")")
    results+=("$(run_wildcard_search "$tier")")
    echo ""
  done

  # ── Output Results ─────────────────────────────────────────────────────

  case $OUTPUT_FORMAT in
    table)
      printf "\n%-15s %-6s %8s %8s %8s\n" "SCENARIO" "TIER" "P50(ms)" "P95(ms)" "P99(ms)"
      printf "%-15s %-6s %8s %8s %8s\n" "───────────────" "──────" "────────" "────────" "────────"
      for result in "${results[@]}"; do
        IFS='|' read -r scenario tier p50 p95 p99 <<< "$result"
        printf "%-15s %-6s %8s %8s %8s\n" "$scenario" "$tier" "$p50" "$p95" "$p99"
      done
      ;;
    json)
      echo "["
      local first=true
      for result in "${results[@]}"; do
        IFS='|' read -r scenario tier p50 p95 p99 <<< "$result"
        if [ "$first" = true ]; then
          first=false
        else
          echo ","
        fi
        printf '  {"scenario":"%s","tier":"%s","p50":%s,"p95":%s,"p99":%s}' \
          "$scenario" "$tier" "$p50" "$p95" "$p99"
      done
      echo ""
      echo "]"
      ;;
    csv)
      echo "scenario,tier,p50_ms,p95_ms,p99_ms"
      for result in "${results[@]}"; do
        IFS='|' read -r scenario tier p50 p95 p99 <<< "$result"
        echo "${scenario},${tier},${p50},${p95},${p99}"
      done
      ;;
  esac

  # Save results
  local output_file="${RESULTS_DIR}/benchmark-$(date +%Y%m%d-%H%M%S).${OUTPUT_FORMAT}"
  log "Results saved to: ${output_file}"

  log "Benchmark Complete"
}

# ── Latency Targets (Reference) ───────────────────────────────────────────
# These targets represent acceptable performance for each tier:
#
# Simple Text Search:
#   10K:  p50=50ms   p95=150ms  p99=300ms
#   100K: p50=100ms  p95=300ms  p99=800ms
#   600K: p50=200ms  p95=500ms  p99=1500ms
#
# Filtered Search:
#   10K:  p50=60ms   p95=180ms  p99=400ms
#   100K: p50=120ms  p95=350ms  p99=900ms
#   600K: p50=250ms  p95=600ms  p99=1800ms
#
# Faceted Search:
#   10K:  p50=80ms   p95=250ms  p99=500ms
#   100K: p50=150ms  p95=450ms  p99=1200ms
#   600K: p50=300ms  p95=800ms  p99=2000ms
#
# Autocomplete Prefix:
#   10K:  p50=30ms   p95=80ms   p99=150ms
#   100K: p50=60ms   p95=150ms  p99=350ms
#   600K: p50=100ms  p95=300ms  p99=700ms
#
# Wildcard Pattern:
#   10K:  p50=80ms   p95=200ms  p99=500ms
#   100K: p50=150ms  p95=400ms  p99=1000ms
#   600K: p50=300ms  p95=700ms  p99=2000ms

main "$@"
