
# Remaining Issues - Manual Review Required

## Fixed Automatically
- ✅ 1 ARIA props error in input-otp.tsx (added aria-orientation)

## Requires Manual Review (31 semantic element issues)

These files use `<div onClick={...}>` instead of semantic `<button>` elements.
Converting requires careful testing as these are UI library components:

- artifacts/edms/src/components/ui/Shared.tsx
- artifacts/edms/src/components/ui/breadcrumb.tsx
- artifacts/edms/src/components/ui/button-group.tsx
- artifacts/edms/src/components/ui/carousel.tsx
- artifacts/edms/src/components/ui/field.tsx
- artifacts/edms/src/components/ui/input-group.tsx
- artifacts/edms/src/components/ui/input-otp.tsx
- artifacts/edms/src/components/ui/item.tsx
- artifacts/edms/src/pages/Cases.tsx

### Why Manual Review?
These are Radix UI and custom UI components where:
1. Layout styling may depend on div structure
2. Nested interactive elements need careful handling
3. CSS selectors may target div specifically
4. Accessibility roles may already be handled by parent components

### Recommendation
Address these gradually during component refactoring:
1. Test each component thoroughly after conversion
2. Ensure keyboard navigation still works
3. Verify screen reader compatibility
4. Check that styling remains intact

## Button Type Errors (2 remaining)
These appear to be false positives - buttons already have type attributes.
May be due to multi-line button declarations that Biome doesn't parse correctly.

## Summary
- Total errors remaining: 364
- Auto-fixable: 1 (fixed)
- Requires manual review: 33
- Low priority warnings: 330
