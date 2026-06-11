# God Component Decomposition Plan

**Status:** Planned (requires test coverage from Phase 8 before execution)  
**Risk:** High (these are the most complex pages with the most user interactions)  
**Prerequisite:** Phase 8 tests must cover critical paths before refactoring

---

## P-001: PLDetail.tsx (2,744 lines → 5 files)

### Proposed Split

| New File | Lines (est.) | Responsibility |
|----------|-------------|----------------|
| `PLDetailHeader.tsx` | ~150 | Page header, export buttons, status badge |
| `PLFormModal.tsx` | ~800 | Create/edit PL form (already partially extracted as `PLFormModal` function) |
| `PLDocumentLinking.tsx` | ~400 | Two-column document link/unlink section |
| `PLEngineeringChanges.tsx` | ~300 | EC timeline, status dots, revision history |
| `PLDetail.tsx` (remaining) | ~800 | Main layout, tabs, info rows, orchestration |

### Migration Strategy
1. Extract `PLFormModal` (it's already a named export — just move to own file)
2. Extract `DocumentLinkingSection` (already a named function)
3. Extract EC timeline rendering
4. Extract header/action bar
5. Verify no broken imports; run typecheck

---

## P-002: DeduplicationConsole.tsx (2,309 lines → 4 files)

### Proposed Split

| New File | Lines (est.) | Responsibility |
|----------|-------------|----------------|
| `DedupFilterBar.tsx` | ~300 | Filter popovers, mode selector, confidence slider |
| `DedupGroupList.tsx` | ~400 | Group cards, selection, bulk actions |
| `DedupComparisonTable.tsx` | ~500 | Side-by-side document comparison |
| `DeduplicationConsole.tsx` (remaining) | ~800 | Page layout, state orchestration, stats |

---

## P-003: WorkLedger.tsx (1,755 lines → 3 files)

### Proposed Split

| New File | Lines (est.) | Responsibility |
|----------|-------------|----------------|
| `WorkRecordForm.tsx` | ~500 | Create/edit work record modal |
| `WorkLedgerFilters.tsx` | ~250 | Filter bar, date range, category pills |
| `WorkLedger.tsx` (remaining) | ~800 | Table, state, pagination, bulk actions |

---

## Execution Criteria

Do NOT execute these splits until:
- [ ] Phase 8 tests provide coverage for login + navigation + CRUD flows
- [ ] TypeScript strict mode passes without suppressed errors
- [ ] At least one E2E test covers each page's happy path

Each split should be a single atomic commit with:
1. Move function to new file
2. Update imports in parent
3. Verify typecheck passes
4. Verify dev server renders correctly
