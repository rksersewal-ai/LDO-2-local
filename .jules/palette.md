## 2026-06-11 - Added missing aria-labels to inputs
**Learning:** Input fields relying solely on icons or placeholders need explicit `aria-label`s to be accessible to screen readers when `<label htmlFor>` cannot be easily used.
**Action:** Audit all search bars and filtering inputs without visible text labels for missing ARIA properties.
