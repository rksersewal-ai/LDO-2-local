# Dense Vercel-Inspired UI Design System

This file defines the visual language, layout rules, interaction patterns, and page-level requirements for building a compact SaaS dashboard similar to the shared references: Vercel-inspired, neutral, minimal, fast, theme-aware, but denser and more operational than a marketing dashboard.

The target experience is a professional admin workspace: five KPI cards per row, centered floating data pages, dense tables, compact reports, strong controls, drill-down actions, separate scroll regions, and a reliable header/sidebar system.

## 1. Product design goals

Build the UI around these principles:

1. **Dense but calm**: show more useful information above the fold without looking crowded.
2. **Border-first, light-shadow surfaces**: cards, tables, reports, and panels use subtle borders plus a soft shadow for separation.
3. **Top-centered work area**: floating pages, tables, reports, and dashboards should align top-center with a small offset from the header.
4. **Theme-aware by default**: every component must use tokens and work in both light and dark modes.
5. **Operational controls are visible**: tables and reports need search, filters, column controls, export, pagination, refresh, and density controls.
6. **Actionable navigation**: notifications, drill-downs, breadcrumbs, help, and page actions must take users to a concrete next step.
7. **No wasted chrome**: the sidebar has its own scroll region; the main page has its own scroll region; utility links are fixed at the bottom.
8. **Compact Vercel style**: neutral surfaces, sharp hierarchy, small controls, precise spacing, minimal decoration, and restrained orange accent usage.

Avoid oversized dashboards, large rounded cards, heavy drop shadows, decorative gradients, excessive whitespace, and consumer-app styling.

## 2. Core visual tokens

Use CSS variables as the single source of truth. Do not hard-code colors inside components except for semantic chart colors when unavoidable.

### Typography

```css
:root {
  --font-sans: "Geist", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-serif: "Source Serif 4", Georgia, serif;
  --font-mono: "Geist Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace;

  --text-2xs: 0.625rem;   /* 10px */
  --text-xs: 0.6875rem;   /* 11px */
  --text-sm: 0.75rem;     /* 12px */
  --text-base: 0.8125rem; /* 13px */
  --text-md: 0.875rem;    /* 14px */
  --text-lg: 1rem;        /* 16px */
  --text-xl: 1.25rem;     /* 20px */
  --text-metric: 1.5rem;  /* 24px */
}
```

Typography rules:

- Body text: `12px` to `13px`.
- Page title: `18px` to `22px`.
- Section title: `13px` to `15px`.
- Card metric: `22px` to `28px`.
- Table body: `12px`.
- Helper text, nav labels, badges: `10px` to `12px`.
- Use `font-variant-numeric: tabular-nums` globally for metrics, money, dates, row counts, and pagination.
- Use `500` or `600` for labels, headings, table headers, and navigation. Reserve `700` for page titles and KPI metrics only.

### Spacing and density

```css
:root {
  --space-1: 0.25rem;  /* 4px */
  --space-2: 0.5rem;   /* 8px */
  --space-3: 0.75rem;  /* 12px */
  --space-4: 1rem;     /* 16px */
  --space-5: 1.25rem;  /* 20px */
  --space-6: 1.5rem;   /* 24px */
  --space-8: 2rem;     /* 32px */
}
```

Recommended defaults:

- App header height: `44px` to `48px`.
- Page top offset under header: `16px` to `24px`.
- Page horizontal padding: `16px` to `20px`.
- Dashboard grid gap: `10px` to `14px`.
- Card padding: `12px` to `16px`.
- Table cell padding: `7px 10px`.
- Table row height: `34px` to `42px`.
- Button height: `28px` to `32px`.
- Input height: `30px` to `34px`.
- Nav item height: `28px` to `32px`.

### Radius and shadows

The interface should remain crisp. Use small radius and light shadows everywhere cards, tables, report panels, popovers, and floating pages need separation.

```css
:root {
  --radius-xs: 0.25rem;
  --radius-sm: 0.375rem;
  --radius: 0.5rem;
  --radius-lg: 0.75rem;

  --shadow-card: 0 1px 2px rgb(0 0 0 / 0.06), 0 8px 24px rgb(0 0 0 / 0.035);
  --shadow-table: 0 1px 2px rgb(0 0 0 / 0.05), 0 10px 30px rgb(0 0 0 / 0.04);
  --shadow-popover: 0 8px 30px rgb(0 0 0 / 0.12);
  --shadow-focus: 0 0 0 3px color-mix(in oklab, var(--primary), transparent 78%);
}

.dark {
  --shadow-card: 0 1px 0 rgb(255 255 255 / 0.035), 0 14px 35px rgb(0 0 0 / 0.32);
  --shadow-table: 0 1px 0 rgb(255 255 255 / 0.035), 0 18px 42px rgb(0 0 0 / 0.38);
  --shadow-popover: 0 20px 60px rgb(0 0 0 / 0.55);
}
```

Usage rules:

- Cards: `border: 1px solid var(--border)` plus `box-shadow: var(--shadow-card)`.
- Tables and reports: `box-shadow: var(--shadow-table)`.
- Popovers, notification panels, command palettes: `box-shadow: var(--shadow-popover)`.
- Avoid heavy blur, large shadows, glow effects, or glassmorphism.

## 3. Theme tokens

### Light theme

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.1450 0 0);

  --card: oklch(1 0 0);
  --card-foreground: oklch(0.1450 0 0);

  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.1450 0 0);

  --primary: #d38738;
  --primary-hover: color-mix(in oklab, var(--primary), black 8%);
  --primary-soft: color-mix(in oklab, var(--primary), transparent 88%);
  --primary-foreground: oklch(0.9850 0 0);

  --secondary: oklch(0.9700 0 0);
  --secondary-foreground: oklch(0.2050 0 0);

  --accent: oklch(0.9700 0 0);
  --accent-foreground: oklch(0.2050 0 0);

  --muted: oklch(0.9700 0 0);
  --muted-foreground: oklch(0.5560 0 0);

  --destructive: oklch(0.5770 0.2450 27.3250);
  --destructive-foreground: oklch(1 0 0);

  --border: oklch(0.9220 0 0);
  --input: oklch(0.9220 0 0);
  --ring: oklch(0.7080 0 0);

  --chart-1: #cab0b0;
  --chart-2: oklch(0.6200 0.1900 260);
  --chart-3: oklch(0.5500 0.2200 263);
  --chart-4: oklch(0.4900 0.2200 264);
  --chart-5: oklch(0.4200 0.1800 266);

  --sidebar: oklch(0.9850 0 0);
  --sidebar-foreground: oklch(0.1450 0 0);
  --sidebar-primary: oklch(0.2050 0 0);
  --sidebar-primary-foreground: oklch(0.9850 0 0);
  --sidebar-accent: oklch(0.9700 0 0);
  --sidebar-accent-foreground: oklch(0.2050 0 0);
  --sidebar-border: oklch(0.9220 0 0);
  --sidebar-ring: oklch(0.7080 0 0);
}
```

### Dark theme

```css
.dark {
  --background: oklch(0.1450 0 0);
  --foreground: oklch(0.9850 0 0);

  --card: oklch(0.2050 0 0);
  --card-foreground: oklch(0.9850 0 0);

  --popover: oklch(0.2690 0 0);
  --popover-foreground: oklch(0.9850 0 0);

  --primary: #d38738;
  --primary-hover: color-mix(in oklab, var(--primary), white 7%);
  --primary-soft: color-mix(in oklab, var(--primary), transparent 84%);
  --primary-foreground: oklch(0.2050 0 0);

  --secondary: oklch(0.2690 0 0);
  --secondary-foreground: oklch(0.9850 0 0);

  --accent: oklch(0.3710 0 0);
  --accent-foreground: oklch(0.9850 0 0);

  --muted: oklch(0.2690 0 0);
  --muted-foreground: oklch(0.7080 0 0);

  --destructive: oklch(0.7040 0.1910 22.2160);
  --destructive-foreground: oklch(0.9850 0 0);

  --border: oklch(0.2750 0 0);
  --input: oklch(0.3250 0 0);
  --ring: oklch(0.5560 0 0);

  --chart-1: oklch(0.8100 0.1000 252);
  --chart-2: oklch(0.6200 0.1900 260);
  --chart-3: oklch(0.5500 0.2200 263);
  --chart-4: oklch(0.4900 0.2200 264);
  --chart-5: oklch(0.4200 0.1800 266);

  --sidebar: oklch(0.2050 0 0);
  --sidebar-foreground: oklch(0.9850 0 0);
  --sidebar-primary: oklch(0.4880 0.2430 264.3760);
  --sidebar-primary-foreground: oklch(0.9850 0 0);
  --sidebar-accent: oklch(0.2690 0 0);
  --sidebar-accent-foreground: oklch(0.9850 0 0);
  --sidebar-border: oklch(0.2750 0 0);
  --sidebar-ring: oklch(0.4390 0 0);
}
```

## 4. App shell and layout architecture

### Required shell structure

```text
.app
  .app-header
    .header-left
      .sidebar-collapse-button
      .single-breadcrumb
    .header-center optional command/search
    .header-right
      notifications
      live-clock
      help-center
      theme-toggle
      user-menu
  .app-body
    .sidebar
      .sidebar-brand optional compact brand area
      .sidebar-scroll   scrollable page links only
      .sidebar-utility  fixed settings/help/search bottom links
    .main-scroll        independent main content scrollbar
      .page-frame       top-centered floating content
```

### Required scroll behavior

Use separate scrollbars for the main area and the sidebar link list.

```css
html,
body,
.app {
  height: 100%;
  overflow: hidden;
}

.app {
  display: grid;
  grid-template-rows: 46px 1fr;
}

.app-body {
  min-height: 0;
  display: grid;
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
}

.sidebar {
  min-height: 0;
  display: grid;
  grid-template-rows: auto 1fr auto;
  border-right: 1px solid var(--sidebar-border);
  background: var(--sidebar);
}

.sidebar-scroll {
  min-height: 0;
  overflow-y: auto;
}

.sidebar-utility {
  position: sticky;
  bottom: 0;
  background: var(--sidebar);
  border-top: 1px solid var(--sidebar-border);
}

.main-scroll {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  background: var(--background);
}
```

### Floating centered page frames

Floating pages, tables, report builders, and dashboards must be top-center aligned after a small top distance from the header.

```css
.page-frame {
  width: min(100% - 32px, 1480px);
  margin: 18px auto 32px;
}

.page-frame.page-frame-sm { max-width: 960px; }
.page-frame.page-frame-md { max-width: 1180px; }
.page-frame.page-frame-lg { max-width: 1480px; }
.page-frame.page-frame-xl { max-width: 1680px; }
```

Rules:

- Do not pin dense content to the far left of the viewport.
- Keep tables and reports visually floating in the main canvas using a border and light shadow.
- Use `margin-top: 16px` to `24px` under the header; avoid excessive hero-like spacing.
- Wide dashboards can use `page-frame-xl`, but they should still be centered.
- On small screens, reduce side margins to `12px`.

## 5. Header system

The header is the command area for the whole app. It should remain compact, fixed, and useful.

### Header requirements

- Include the **sidebar collapse button in the header**, not buried in the sidebar.
- Use a **single breadcrumb** in the correct location: left side after the collapse button.
- Breadcrumb should show current location only, for example `Dashboard`, `Reports`, or `Projects / Alpha`. Do not duplicate breadcrumbs in the page body unless the page is deeply nested.
- Include notification button with unread count.
- Include notification view/dropdown with actionable items.
- Include a live clock.
- Include Help Center access.
- Include theme toggle and user/profile menu.
- Include the main page action only when relevant, for example `Save`, `Export`, `New Report`, or `Add Section`.

### Header layout

```css
.app-header {
  height: 46px;
  display: grid;
  grid-template-columns: minmax(240px, 1fr) auto minmax(240px, 1fr);
  align-items: center;
  gap: var(--space-3);
  padding: 0 var(--space-3);
  border-bottom: 1px solid var(--border);
  background: color-mix(in oklab, var(--background), transparent 2%);
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.header-right {
  justify-content: flex-end;
}
```

### Notifications

Notification view must support:

- Unread count badge.
- Grouping by urgency: `Needs action`, `FYI`, `System`.
- Each notification has title, short context, timestamp, state, and action.
- Primary notification action takes the user to the relevant page, filtered table, report row, task, or approval drawer.
- Secondary actions: mark as read, snooze, dismiss.
- Empty state: `No new notifications` and a link to notification settings.

Recommended actions:

- `Review report` opens the report page with the related row focused.
- `Open task` opens the project/task drawer.
- `View account` opens a customer/account detail panel.
- `Resolve failed export` opens export history filtered to failed jobs.

### Live clock

Show compact local time in the header.

Rules:

- Use `HH:mm` or `HH:mm:ss` depending on available width.
- Include timezone in tooltip or user menu, not always visible.
- Keep the clock muted so it does not compete with primary actions.

### Help Center

Help Center must be visible in the header and also fixed at the bottom of the sidebar utility area.

Help Center features:

- Search docs.
- Contact support.
- Keyboard shortcuts.
- Page-specific guide.
- Release notes.
- Link to status page if the product has operational dependencies.

## 6. Sidebar navigation

### Structure

```text
.sidebar
  optional brand/workspace switcher
  .sidebar-scroll
    primary action
    dashboard links
    grouped page links
    overflow/more links
  .sidebar-utility fixed bottom
    settings
    help center
    search/command menu
```

### Required behavior

- Page links are scrollable independently of the main page.
- Settings and Help Center are fixed in the lower-left navbar area and do not scroll away.
- Collapse/expand is controlled from the header.
- Collapsed state shows icons only and exposes labels through tooltips.
- Active page is visually obvious using selected background, border, or accent bar.
- Section labels are tiny, muted, and uppercase or title case.
- Keep nav item height between `28px` and `32px`.

### Sidebar CSS pattern

```css
:root { --sidebar-width: 232px; }
.app.sidebar-collapsed { --sidebar-width: 64px; }

.nav-item {
  height: 30px;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-2);
  border-radius: var(--radius-sm);
  color: var(--sidebar-foreground);
}

.nav-item:hover {
  background: var(--sidebar-accent);
}

.nav-item[aria-current="page"] {
  background: var(--primary);
  color: var(--primary-foreground);
  font-weight: 700;
}
```

## 7. Cards and dashboard widgets

Cards should be compact, lightly elevated, and slightly highlighted on hover.

### Card CSS pattern

```css
.card,
.widget,
.report-panel,
.table-panel {
  background: var(--card);
  color: var(--card-foreground);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}

.card.interactive-card {
  transition: border-color 140ms ease, background 140ms ease, box-shadow 140ms ease, transform 140ms ease;
}

.card.interactive-card:hover {
  background: color-mix(in oklab, var(--card), var(--primary) 3%);
  border-color: color-mix(in oklab, var(--border), var(--primary) 30%);
  box-shadow: var(--shadow-card), 0 0 0 1px color-mix(in oklab, var(--primary), transparent 86%);
  transform: translateY(-1px);
}
```

### Five dashboard cards per row

Dashboard KPI rows should fit five cards in one row on large screens.

```css
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--space-3);
}

@media (max-width: 1380px) {
  .kpi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 900px) {
  .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 620px) {
  .kpi-grid { grid-template-columns: 1fr; }
}
```

Each KPI card must include:

- Label.
- Current value.
- Delta badge.
- One-line context.
- Last updated or data freshness in tooltip/details.
- Drill-down action.

Drill-down patterns:

- Open a detail drawer with breakdown by segment, date, owner, or status.
- Link to filtered report page.
- Show mini menu: `View trend`, `View records`, `Compare period`, `Export metric`.
- Preserve user context when navigating: date range, filter, and source page.

### Guidance on hover

Every dense widget should provide user guidance after hover using a tooltip, helper popover, or accessible `title` equivalent.

Examples:

- KPI card hover: `Click to drill into revenue by segment.`
- Chart range control hover: `Switch chart window without changing page filters.`
- Export control hover: `Export current filtered rows.`
- Disabled action hover: `Select at least one row to enable bulk action.`

Do not show long instructions inline by default. Keep helper text short and contextual.

## 8. Tables and reports

Tables and reports are primary surfaces. They must be compact, exportable, paginated, and controllable.

### Table/report panel structure

```text
.table-panel or .report-panel
  .panel-header
    title, description, count, status
    primary action
  .panel-toolbar
    search
    filter button
    date range
    saved views
    column chooser
    density selector
    refresh
    export menu
  .bulk-toolbar conditional when rows selected
  .table-scroll
    table with sticky header
  .pagination-footer
    selected count
    rows per page
    page number
    previous/next/first/last
```

### Required table controls

Every data table should include these controls when applicable:

- Search within current dataset.
- Filter menu with active filter count.
- Date range picker for time-bound data.
- Saved views or quick tabs.
- Sortable columns.
- Column show/hide and reorder.
- Density switch: compact, comfortable.
- Refresh button and last refreshed timestamp.
- Row selection checkboxes.
- Bulk actions for selected rows.
- Row action menu.
- Pagination with rows per page.
- Export menu.

### Required report controls

Every report page should include:

- Report title and editable description.
- Date range.
- Segment/group-by selector.
- Saved views.
- Chart/table toggle where relevant.
- Compare period toggle.
- Schedule report.
- Share link and permissions.
- Export menu.
- Pagination for tabular report sections.
- Drill-down support from charts/cards to rows.

### Export formats

Support exporting filtered and visible data, not only the raw table.

Recommended export menu:

- CSV for spreadsheets and quick transfer.
- XLSX for business users.
- PDF for formatted reports.
- JSON for integrations and developers.
- Print for browser-native review.

Export UX requirements:

- Export button label should indicate scope when possible: `Export filtered rows`.
- Show file format, row count, and active filters in the confirmation view.
- Long exports should become async jobs with status notifications.
- Failed exports should appear in notifications and export history with retry action.

### Pagination

Pagination must be visible at the bottom of tables and reports.

Required pagination elements:

- Selected row count: `0 of 68 row(s) selected`.
- Rows per page selector: `10`, `25`, `50`, `100`.
- Current page indicator: `Page 1 of 7`.
- First, previous, next, last buttons.
- Disabled states when no navigation is possible.

### Table CSS pattern

```css
.table-panel {
  overflow: hidden;
  box-shadow: var(--shadow-table);
}

.table-scroll {
  max-height: min(58vh, 680px);
  overflow: auto;
}

table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: var(--text-sm);
}

thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  height: 34px;
  background: var(--secondary);
  color: var(--secondary-foreground);
  border-bottom: 1px solid var(--border);
  font-weight: 700;
  text-align: left;
}

tbody td {
  height: 38px;
  border-bottom: 1px solid var(--border);
}

tbody tr:hover {
  background: color-mix(in oklab, var(--accent), var(--primary) 4%);
}
```

## 9. Buttons and controls

### Button hierarchy

1. **Primary**: orange fill; only one primary action per surface.
2. **Secondary**: subtle filled or bordered control.
3. **Ghost**: quiet text/icon action.
4. **Icon**: header, toolbar, row menus, compact controls.
5. **Danger**: destructive action, should require confirmation when irreversible.

```css
.button {
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--card);
  color: var(--foreground);
  font-size: var(--text-sm);
  font-weight: 600;
}

.button:hover {
  background: var(--accent);
}

.button-primary {
  border-color: var(--primary);
  background: var(--primary);
  color: var(--primary-foreground);
}

.button-primary:hover {
  background: var(--primary-hover);
}
```

### Forms and inputs

- Input height: `30px` to `34px`.
- Labels: `11px` to `12px`, weight `600`.
- Helper text: `11px`, muted.
- Validation should show message and state icon, not only color.
- Use compact input groups for filters and date ranges.
- Input focus should use border + focus shadow.

```css
.input,
.select,
.textarea {
  width: 100%;
  min-height: 32px;
  border: 1px solid var(--input);
  border-radius: var(--radius-sm);
  background: var(--background);
  color: var(--foreground);
  padding: 0 10px;
}

.input:focus,
.select:focus,
.textarea:focus {
  outline: none;
  border-color: color-mix(in oklab, var(--primary), var(--border) 35%);
  box-shadow: var(--shadow-focus);
}
```

## 10. Breadcrumbs

Breadcrumbs must be single, compact, and consistently located in the header.

Rules:

- Place breadcrumb on the left side of the header, after the sidebar collapse button.
- Use only one breadcrumb instance per page.
- Do not repeat breadcrumb at the top of the content unless the page has nested editor depth.
- For simple pages, show only current page: `Dashboard`.
- For nested pages, show one parent and current page: `Reports / Monthly Revenue`.
- Use slash separators, not large chips.
- Breadcrumb text should be `12px` to `13px`, muted parent and strong current page.

## 11. Status badges, tags, and pills

Use small badges that remain legible in both themes.

Recommended states:

- `Done`: green dot + neutral badge.
- `In process`: spinner or neutral dot + neutral badge.
- `Pending`: muted dot + neutral badge.
- `Failed`: destructive dot/text; avoid full red rows.
- `Blocked`: warning dot + neutral badge.

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  height: 1.25rem;
  padding: 0 0.375rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--secondary);
  color: var(--secondary-foreground);
  font-size: var(--text-2xs);
  font-weight: 700;
  white-space: nowrap;
}
```

## 12. Charts and analytics widgets

Charts should be quiet, readable, and embedded in cards or report panels.

Rules:

- Use faint gridlines.
- Use orange for primary trend or selected series.
- Use blue/slate for secondary series.
- Keep chart controls in the panel header, not below the chart.
- Range selectors should be compact: `7D`, `30D`, `3M`, `YTD`, `Custom`.
- Tooltip should show exact value, date, and comparison.
- Chart click should drill down into filtered table rows.
- Include an empty, loading, and error state for every chart.

## 13. Page-level requirements

These requirements define the minimum controls and features for each major page.

### Dashboard

Required:

- Five KPI cards per row on large desktop.
- Each KPI card supports drill-down.
- Main trend chart with date-range selector.
- Secondary chart/table section with tabs.
- Activity or task table with pagination.
- Notification-driven cards for urgent items.
- Refresh timestamp.
- Export dashboard summary as PDF/CSV.

Recommended controls:

- Date range.
- Segment selector.
- Compare period.
- Save dashboard view.
- Share dashboard.

### Analytics

Required:

- Filter bar with date range, segment, owner/team, and metric selector.
- Chart cards with drill-down into table rows.
- Compare mode.
- Export chart image and data.
- Saved views.
- Report scheduling.

### Data Library

Required:

- Search.
- Type/source filters.
- Owner filter.
- Last updated filter.
- Table with pagination.
- Preview drawer.
- Import/upload action.
- Export metadata as CSV/JSON.
- Row actions: open, duplicate, archive, permissions.

### Reports

Required:

- Report list with search, filters, owner/status, pagination.
- Report builder/editor panel.
- Export to CSV, XLSX, PDF, JSON.
- Schedule delivery.
- Share permissions.
- Version history.
- Audit trail for edits and exports.
- Failed export notification with retry action.

### Projects

Required:

- Project list table with status, owner, due date, progress, risk, and actions.
- Board/list toggle if project workflows need it.
- Filters for owner, status, risk, due date.
- Row drill-down drawer.
- Bulk update for selected projects.
- Export project list.

### Team

Required:

- Team member table with role, status, workload, permissions, last active.
- Invite member action.
- Role filter.
- Permission editor.
- Audit log access.
- Export member list.

### Lifecycle

Required:

- Stage cards or pipeline summary.
- Funnel or timeline chart.
- Records table with stage, owner, status, next action.
- Drill-down from stage to records.
- Automation status and recent changes.
- Export current pipeline.

### Word Assistant / Document Assistant

Required:

- Document list with owner, section, status, reviewer, target, limit.
- Editor or review drawer.
- AI action toolbar: summarize, rewrite, check tone, generate section, extract tasks.
- Version history.
- Comments and reviewer assignment.
- Export document or selected sections.
- Pagination for document list and generated outputs.

### Settings

Required:

- Fixed settings access in sidebar bottom area.
- Search settings.
- Theme editor with live preview.
- Account/workspace settings.
- Notification settings.
- Export/import configuration where applicable.
- Audit log for admin changes.

### Help Center

Required:

- Fixed Help Center access in sidebar bottom area and header.
- Searchable articles.
- Page-specific guidance.
- Keyboard shortcuts.
- Contact support.
- Release notes.
- System status link where applicable.

## 14. Interaction states and motion

All interactive elements need visible states.

```css
.interactive:hover {
  background: var(--accent);
  color: var(--accent-foreground);
}

.interactive:focus-visible {
  outline: 2px solid color-mix(in oklab, var(--ring), transparent 45%);
  outline-offset: 2px;
}

.interactive:disabled,
[aria-disabled="true"] {
  opacity: 0.5;
  cursor: not-allowed;
}
```

Motion rules:

- Use motion only to clarify state changes: drawer open, dropdown open, row expand.
- Keep durations between `120ms` and `180ms`.
- Disable nonessential motion for users with reduced motion preference.
- Hover lift should be subtle: `translateY(-1px)` only.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

## 15. Tooltips and user guidance

Dense pages need discoverability without visible clutter.

Requirements:

- Provide hover guidance for icon-only buttons.
- Provide helper copy for dense filters and export controls.
- Provide disabled reason when an action is unavailable.
- Use short tooltip copy, ideally under 80 characters.
- Do not hide critical instructions only in tooltips.

Example:

```html
<button class="icon-button" aria-label="Export" data-tooltip="Export current filtered rows">
  Export
</button>
```

## 16. Empty, loading, and error states

### Empty state

- Compact panel state, not a full-page illustration.
- Include title, one sentence, and one action.
- Example: `No reports yet. Create your first report or import existing data.`

### Loading state

- Use skeleton rows for tables.
- Use small spinner only for inline controls.
- Preserve layout size to prevent jumps.

### Error state

- Explain what failed.
- Provide retry action.
- Include details link for technical users.
- If export fails, send a notification with retry action.

## 17. Accessibility requirements

- Maintain WCAG AA contrast for body text, labels, controls, and table rows.
- Do not rely on color alone; pair color with text, icons, dots, or state labels.
- Use semantic HTML: `header`, `nav`, `main`, `section`, `table`, `thead`, `tbody`, `button`, `form`.
- Use `aria-label` for icon-only controls.
- Use `aria-current="page"` for current navigation item.
- Use `aria-expanded` on dropdowns and collapsible nav.
- Use focus trap for modals and drawers.
- Minimum hit target: `28px` in dense desktop, `40px` on touch.
- Keep keyboard navigation logical: header controls, sidebar links, page toolbar, table, pagination.

## 18. Implementation checklist

Use this checklist before shipping a page.

### Theme and layout

- [ ] Component colors come from tokens only.
- [ ] Light and dark modes are visually tuned separately.
- [ ] Main content uses independent scroll.
- [ ] Sidebar links use independent scroll.
- [ ] Settings and Help Center stay fixed at the sidebar bottom.
- [ ] Sidebar collapse button is in the header.
- [ ] Breadcrumb is single and placed in the header.
- [ ] Page frame is top-centered with `16px` to `24px` top offset.

### Cards and dashboards

- [ ] Five KPI cards fit in one row on large desktop.
- [ ] Cards have light shadow and border.
- [ ] Cards/widgets slightly highlight on hover.
- [ ] KPI cards include drill-down action.
- [ ] Cards show data freshness or context.
- [ ] Charts include range controls and drill-down behavior.

### Tables and reports

- [ ] Tables/reports have light shadow and border.
- [ ] Sticky table header is implemented.
- [ ] Search, filters, columns, density, refresh, and export controls exist.
- [ ] Pagination includes rows per page and page indicator.
- [ ] Selected row count and bulk actions exist.
- [ ] Export supports CSV, XLSX, PDF, and JSON where applicable.
- [ ] Export respects filters, visible columns, and selected rows when relevant.

### Header and actions

- [ ] Header has notification button and actionable notification view.
- [ ] Header has live clock.
- [ ] Header has Help Center access.
- [ ] Header has theme toggle and user menu.
- [ ] Primary action is clear and not duplicated.

### Guidance and accessibility

- [ ] Icon buttons have labels or tooltips.
- [ ] Disabled controls explain why they are disabled.
- [ ] Focus states are visible.
- [ ] Reduced motion preference is respected.
- [ ] Keyboard navigation is tested.

## 19. Quality bar

A page meets this design system only when it feels like a compact professional SaaS workspace:

- The first screen shows meaningful data, not empty whitespace.
- Every card, table, and report feels clickable or intentionally static.
- The user can search, filter, export, paginate, drill down, and recover from errors.
- The header and sidebar remain useful even on long pages.
- The design looks equally deliberate in light and dark modes.
