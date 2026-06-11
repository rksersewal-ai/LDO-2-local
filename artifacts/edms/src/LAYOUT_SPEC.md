# LDO-2 EDMS — Layout & Spacing Specification

## Spacing Scale

All spacing uses Tailwind's default 4px-based scale. The application enforces
these semantic tiers:

| Token | Value | Usage |
|-------|-------|-------|
| `gap-1` / `p-1` | 4px | Icon-to-text micro-gap |
| `gap-1.5` | 6px | Badge/pill internal padding |
| `gap-2` | 8px | Button icon-to-label gap |
| `gap-3` | 12px | Within-card element spacing |
| `gap-4` | 16px | Between cards / section content |
| `gap-6` | 24px | Between major page sections |
| `p-3` / `p-3.5` | 12-14px | Compact card padding (stat cards, list items) |
| `p-4` | 16px | Default card padding |
| `p-6` | 24px | Form/dialog/hero card padding |
| `px-3 md:px-4` | 12-16px | AppLayout content gutter (responsive) |

## Layout Hierarchy

```
AppLayout (full viewport)
├── Sidebar (248px / 64px collapsed)
├── Main column
│   ├── Header (h-14, fixed top)
│   ├── Tab strip (optional, h-~40px)
│   └── Content area (scrollable)
│       ├── outer padding: px-3 pb-4 pt-3 md:px-4
│       └── PageContainer (max-width centering)
│           └── Page content (gap-4 between sections)
└── RightPanel (optional, 400px)
```

## Rules

1. **Pages MUST NOT add their own outer padding** — AppLayout provides it.
2. **Use `gap-4` between peer sections** within a page.
3. **Use `gap-3` within a card** between internal elements.
4. **GlassCard default padding is `p-3.5`** — override with `p-4` for forms.
5. **PageHeader has `mb-4`** built-in — no extra top margin on first section.
6. **Grid gaps: `gap-3` for tight grids, `gap-4` for standard, `gap-6` for hero**.
7. **Border radius: use `rounded-md` (default), `rounded-lg` (cards), `rounded-xl` (panels/dialogs)**.

## Card Variants

| Variant | Class | Padding | Use Case |
|---------|-------|---------|----------|
| Default | `<Card>` | `p-6` (header+content structure) | shadcn standard |
| GlassCard | `<GlassCard>` | `p-3.5` | Dashboard KPIs, list panels |
| Stat | `<Card variant="stat">` | `p-3` | Metric cards with numbers |
| Interactive | `<Card variant="interactive">` | `p-6` | Clickable summary cards |

## Responsive Breakpoints

| Breakpoint | Width | Layout Change |
|------------|-------|---------------|
| Default | < 768px | Single column, sidebar hidden, px-3 |
| `md` | >= 768px | Sidebar visible (collapsed), px-4 |
| `lg` | >= 1024px | Sidebar expanded, right panel visible |
| `xl` | >= 1280px | Full density, 4-column grids |
