# ADR-008: Open-Source Adoption Policy

**Date:** June 2026  
**Status:** Proposed  
**Deciders:** Principal Engineer, Tech Lead, Security Lead  
**Technical Area:** Dependency Management, Supply Chain Security, and Technology Governance

---

## Context

LDO-2 is an engineering-document intelligence platform built on open-source foundations (React, Django, PostgreSQL, Redis, Docker). As the system grows toward production readiness, new dependencies are regularly evaluated for features like OCR processing, monitoring, authentication, and document viewing.

The project currently has no formal policy for evaluating and adopting open-source tools. Decisions have been made ad hoc, leading to:
- Dead dependencies in package.json (`wouter`, `next-themes`, `react-icons` - unused)
- Duplicate solutions (both `framer-motion` and `motion` installed)
- Known-vulnerable overrides (`path-to-regexp@^0.1.12` with ReDoS risk)
- No documented rationale for technology choices

A formal adoption policy ensures consistent evaluation, reduces supply chain risk, and provides auditability for compliance-sensitive deployments.

## Problem

Without a formal open-source adoption policy:

1. **Security risk**: Unvetted dependencies may contain vulnerabilities or malicious code. No systematic vulnerability monitoring.
2. **Maintenance burden**: Abandoned or infrequently-maintained packages become technical debt.
3. **License compliance**: Some open-source licenses (AGPL, SSPL) may conflict with deployment models or organizational policies.
4. **Bloat**: Unused or duplicate dependencies increase attack surface and bundle size.
5. **Vendor risk**: Reliance on single-maintainer projects creates bus-factor risk.
6. **Reproducibility**: Without pinned versions and integrity verification, builds may produce different outputs over time.
7. **Audit requirements**: Industrial compliance regimes increasingly require Software Bill of Materials (SBOM) and supply chain attestation.

## Current Implementation

- `pnpm-workspace.yaml` with catalog dependencies for version consistency
- `pnpm-lock.yaml` locks dependency versions (integrity hashes included)
- `biome.json` for code quality (replaces ESLint/Prettier)
- No dependency audit step in CI pipeline
- No documented policy for adopting new dependencies
- 3+ unused packages in production dependencies
- `path-to-regexp@^0.1.12` override with known ReDoS vulnerability
- Pre-commit hooks check formatting but not dependency security
- No SBOM generation

## Options Considered

### Option A: Formal Evaluation Matrix with Automated Enforcement (Recommended)

Define a multi-criteria evaluation matrix for all new dependencies. Enforce through CI automation (license check, vulnerability scan, maintenance health check).

### Option B: Informal Best Practices Document

Write a best practices guide. Rely on code review to enforce.

### Option C: Strict Allow-List Only

Maintain an explicit allow-list of approved packages. Any new package requires formal approval.

### Option D: No Policy (Status Quo)

Continue ad hoc adoption based on developer judgment during implementation.

## Recommended Decision

**Option A: Formal evaluation matrix with CI automation.**

Every new dependency must score above threshold on the evaluation matrix before adoption. CI pipeline enforces license compatibility, vulnerability scanning, and maintenance health.

### Evaluation Matrix

| Criterion | Weight | Scoring (0-5) | Minimum |
|-----------|--------|---------------|---------|
| **License compatibility** | Required (pass/fail) | Apache 2.0, MIT, BSD, ISC = pass; AGPL, SSPL, proprietary = fail | Pass |
| **Maintenance health** | 25% | 5=weekly releases; 3=monthly; 1=annual; 0=abandoned (>2 years) | 2 |
| **Security track record** | 20% | 5=no CVEs; 3=CVEs patched quickly; 1=unpatched vulnerabilities | 3 |
| **Community size** | 15% | 5=>10K stars, >100 contributors; 3=>1K stars; 1=<100 stars | 2 |
| **Bundle size impact** | 15% | 5=<10KB; 3=<50KB; 1=<200KB; 0=>200KB (frontend) | 1 |
| **Documentation quality** | 10% | 5=complete API docs + examples; 3=basic docs; 1=README only | 2 |
| **TypeScript support** | 10% | 5=native TS; 3=@types package; 1=no types; 0=incompatible (frontend) | 3 (frontend) |
| **Alternative availability** | 5% | 5=unique; 3=few alternatives; 1=many alternatives (indicates commoditization) | N/A |

**Minimum composite score: 3.0/5.0** (weighted average across non-pass/fail criteria)

### License Compatibility Table

| License | Status | Notes |
|---------|--------|-------|
| MIT | Approved | No restrictions |
| Apache 2.0 | Approved | Patent grant included |
| BSD (2/3-clause) | Approved | Minimal restrictions |
| ISC | Approved | Equivalent to MIT |
| MPL 2.0 | Conditional | File-level copyleft; acceptable if modifications are rare |
| LGPL 2.1/3.0 | Conditional | Dynamic linking only; no modifications to library source |
| GPL 2.0/3.0 | Rejected for libraries | Copyleft would apply to our code if linked statically |
| AGPL 3.0 | Rejected | Network copyleft; exposes source code obligation for SaaS |
| SSPL | Rejected | MongoDB Server Side Public License; too restrictive |
| Proprietary | Rejected | Unless explicitly approved by management with contract review |
| Unlicensed | Rejected | No legal basis for use |

## Why This Decision is Best

1. **Consistent decisions**: Every developer uses the same criteria. Reduces subjective "I prefer X" debates.
2. **Auditable**: Each dependency adoption is documented with scored rationale. Compliance auditors can review.
3. **Automated enforcement**: CI catches license violations and vulnerabilities before merge. No manual review bottleneck.
4. **Security-first**: Vulnerability scanning and maintenance health scoring catch risky packages early.
5. **Right-sized**: Not as heavy as a full approval committee (Option C). Not as loose as informal guidelines (Option B).
6. **Supply chain protection**: SBOM generation + integrity verification provides defense-in-depth against supply chain attacks.
7. **LAN-deployment conscious**: Considers that updates may be infrequent in air-gapped environments. Maintenance health matters more when you cannot patch quickly.
8. **Engineering-document niche**: Industrial compliance regimes increasingly require supply chain documentation. This policy satisfies ISO 27001 Annex A.8.1 (asset management) requirements.
9. **Debt prevention**: Unused dependency detection and regular audits prevent accumulation of dead weight.
10. **Team education**: The scoring process teaches developers to think critically about dependency trade-offs.

## Why Alternatives are Rejected or Deferred

### Option B (Informal Best Practices) - Rejected

- **No enforcement**: Guidelines are suggestions, not gates. Easy to bypass under time pressure.
- **Inconsistent application**: Different reviewers apply different standards.
- **No automation**: Manual review cannot scale. Developers forget to check licenses.
- **Compliance gap**: Cannot prove to auditors that every dependency was evaluated.
- **Acceptable only for**: Very early-stage projects where velocity outweighs governance.

### Option C (Strict Allow-List) - Rejected

- **Bottleneck**: Every new package requires formal approval. Slows development significantly.
- **Maintenance overhead**: Allow-list must be updated constantly as ecosystem evolves.
- **False sense of security**: An approved package from 2 years ago may now have vulnerabilities. Point-in-time approval is insufficient.
- **Team friction**: Developers feel distrusted when every dependency requires committee approval.
- **When appropriate**: Extremely high-security environments (defense, nuclear). Not proportionate for EDMS.

### Option D (No Policy) - Rejected

- **Current state has proven problematic**: 3+ unused packages, duplicate motion libraries, known-vulnerable override.
- **Security risk**: No systematic scanning means vulnerabilities may exist undetected.
- **Audit failure**: Cannot satisfy compliance requirements without documented process.
- **Technical debt accumulation**: Without periodic review, dependency bloat increases over time.

## Impact on Current App

### CI Pipeline Changes (`.github/workflows/ci.yml`)
- Add `pnpm audit --audit-level=high` step to frontend job
- Add `pip-audit` step to backend job
- Add license compatibility check (e.g., `license-checker` or custom script)
- Add SBOM generation step (CycloneDX format)

### Package.json Changes
- Remove unused dependencies: `wouter`, `next-themes`, `react-icons`
- Remove duplicate: either `framer-motion` or `motion` (keep one)
- Remove or upgrade `path-to-regexp` override
- Add `pnpm audit` to pre-commit or CI

### New Documentation
- `DEPENDENCY_POLICY.md` - Full policy document with evaluation matrix
- `docs/decisions/dependency-evaluations/` - Directory for completed evaluations
- Template: `docs/decisions/dependency-evaluations/TEMPLATE.md`

### Process Changes
- PR adding a new dependency must include a completed evaluation in the PR description
- Quarterly dependency audit: review maintenance health and vulnerability status of all current deps
- Annual license compliance review
- SBOM published with each release

## Migration Strategy

1. **Phase 1** (Week 1): Publish policy document. Add `pnpm audit` to CI. Immediately effective for new PRs.
2. **Phase 2** (Week 2): Audit existing dependencies against policy. Document findings. Create remediation tickets.
3. **Phase 3** (Week 3): Remove unused dependencies. Resolve duplicate motion library. Fix path-to-regexp override.
4. **Phase 4** (Week 4): Add license checker to CI. Generate first SBOM. Document all current dependency evaluations.
5. **Phase 5** (ongoing): Quarterly reviews. Update evaluations when major versions release.

## Rollback Strategy

1. **Policy document**: Can be revised at any time. Previous versions maintained in git history.
2. **CI checks**: Disable by removing steps from workflow file. Application continues building.
3. **Dependency removals**: Revert package.json change if a "removed" dependency turns out to be needed.
4. **SBOM generation**: Informational only; removing it has no functional impact.
5. **Recovery**: Policy changes are documentation changes. No application code is affected by rollback.

## Performance Impact

| Metric | Impact | Notes |
|--------|--------|-------|
| CI pipeline time | +30-60 seconds | Audit + license check + SBOM generation |
| Bundle size (after cleanup) | -50 to -150KB | Removing unused dependencies |
| Developer velocity | -5 minutes per new dependency | Time to complete evaluation form |
| Build reliability | Improved | Fewer unused packages = fewer potential conflicts |
| Security posture | Significantly improved | Automated detection of known vulnerabilities |
| Application runtime | No impact | Policy is build-time/review-time only |

## Security Impact

- **Positive**: Automated vulnerability detection catches known CVEs before deployment.
- **Positive**: License review prevents accidental adoption of copyleft libraries that could force source disclosure.
- **Positive**: SBOM provides rapid impact assessment when a new vulnerability is disclosed (quickly identify if affected).
- **Positive**: Reduced unused dependencies shrinks attack surface.
- **Positive**: Regular audits catch dependencies that have become unmaintained or compromised.
- **Risk**: False negatives in scanning tools. Not all vulnerabilities are in public databases.
- **Mitigation**: Defense in depth. Scanning is one layer alongside code review, runtime monitoring, and least-privilege deployment.

## Operational Complexity

| Aspect | Complexity | Mitigation |
|--------|-----------|------------|
| Evaluation process | Low (5-10 minutes per dependency) | Template-based; most criteria are factual lookups |
| CI enforcement | Low (runs automatically) | No manual gate; CI passes or fails |
| Quarterly audit | Medium (2-4 hours per quarter) | Script generates current scores; manual review of changes |
| Policy updates | Low (rare) | Formal revision process with team input |
| SBOM management | Low (automated generation) | CycloneDX tool generates on each build |
| New developer onboarding | Low (read policy; fill template) | Clear documentation and examples |

## Acceptance Tests

1. **CI audit gate**: Introduce a dependency with a known high-severity CVE. Verify CI fails with clear error message.
2. **License rejection**: Add a dependency with AGPL license. Verify CI fails with license incompatibility error.
3. **Unused dependency detection**: Verify report identifies currently unused packages (wouter, next-themes, react-icons).
4. **Evaluation template**: Submit PR adding new dependency. Verify reviewer requests evaluation form completion if missing.
5. **SBOM generation**: Run SBOM generation. Verify output contains all direct and transitive dependencies with versions and licenses.
6. **Score calculation**: Evaluate a known-good dependency (e.g., `@tanstack/react-query`). Verify score >3.0. Evaluate a known-risky dependency. Verify score <3.0.
7. **Quarterly audit**: Run audit script on current dependencies. Verify report generated with current maintenance health and vulnerability status.
8. **Override path**: Document process for adopting a below-threshold dependency when no alternative exists (requires explicit ADR approval).
9. **Cleanup verification**: After Phase 3, verify `pnpm why wouter`, `pnpm why next-themes`, `pnpm why react-icons` all return "not installed".
10. **Air-gap compatibility**: Verify all CI checks can run offline (using locked dependency metadata, not live registry queries).
