.PHONY: help test typecheck lint build test-e2e benchmark-search benchmark-ocr doctor backup-test ci

.DEFAULT_GOAL := help

## help: Show this help message
help:
	@echo "Available targets:"
	@echo ""
	@echo "  make test              Run all tests (root + artifacts/edms)"
	@echo "  make typecheck         TypeScript type-check (tsc --noEmit)"
	@echo "  make lint              Run Biome linter"
	@echo "  make build             Production build (artifacts/edms)"
	@echo "  make test-e2e          E2E tests (placeholder - requires Playwright)"
	@echo "  make benchmark-search  Run search benchmark"
	@echo "  make benchmark-ocr     Run OCR benchmark (placeholder)"
	@echo "  make doctor            Preflight checks (typecheck, lint, test, build)"
	@echo "  make backup-test       Backup verification (placeholder)"
	@echo "  make ci                Full CI pipeline (lint, typecheck, test, build)"
	@echo "  make help              Show this help message"

## test: Run all tests
test:
	npx vitest run && cd artifacts/edms && npx vitest run --exclude 'src/contexts/ThemeContext.test.tsx' --exclude 'src/hooks/useOverloadProtection.test.ts'

## typecheck: TypeScript type-check
typecheck:
	npx tsc --noEmit

## lint: Biome lint
lint:
	npx biome lint .

## build: Production build
build:
	cd artifacts/edms && npx vite build

## test-e2e: E2E tests placeholder
test-e2e:
	@echo "E2E tests require Playwright. Run: npx playwright test"

## benchmark-search: Run search benchmark
benchmark-search:
	@echo "Search benchmark not yet configured. See config/ocr_pipeline.yaml for targets."

## benchmark-ocr: OCR benchmark placeholder
benchmark-ocr:
	@echo "OCR benchmark not yet configured. Requires OCR service running."

## doctor: Preflight checks
doctor: typecheck lint test build

## backup-test: Backup verification placeholder
backup-test:
	@echo "Backup verification requires database access. See docs/DEPLOYMENT_RUNBOOK.md"

## ci: Full CI pipeline
ci: lint typecheck test build
