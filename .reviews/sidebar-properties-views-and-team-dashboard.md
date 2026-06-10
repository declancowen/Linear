# Sidebar properties, view editing, empty groups, and team dashboard

Scope: custom-property dropdown/editor UX, icon set expansion, empty-group fix,
built-in (system) view editing, and the new team-space Dashboard. Reviewed with
architecture-standards + diff-review + fallow.

Status: CLEAN (local). Verified: typecheck, lint (--max-warnings 0), fallow
dead-code + dupes, full test suite (235 files / 1664 tests), production build.

## Turn 4 — 2026-06-10 (icons + greyscale sweep)

Outcome: all-clear (local). Risk: Low-Medium (presentation only). Verified: typecheck, lint, Fallow clean, full suite (1666), production build.
- Work-surface view tabs now show the view icon (getViewIconName + PhosphorIconGlyph).
- Greyscale sweep across board layouts and projects: project list + project board card icons, doc board card art (DocumentPreviewArt → foreground accent), and the view board card preview (ViewLayoutPreview → neutral accent) now use grey chips / monochrome art instead of status/health/label color tints. Removed the now-unused projectIconTint map.
- Residual: browser smoke pending for the board layouts.

## Turn 3 — 2026-06-10 (drift fixes)

Outcome: all-clear (local). Risk: Medium-High (cross-layer schema add + broad UI).
Verified: codegen, typecheck, lint, Fallow dead-code (1 pre-existing) + dupes (114 pre-existing), full suite (1664), production build.

Changes:
- View `icon` field end-to-end (the deferred #3): schema (`v.optional(nullableString)`), createView + updateViewConfig mutation args/handlers, server forwarders, viewSchema + viewConfigPatchSchema, store create + updateViewConfig (generic), CreateViewInput/ViewConfigPatch/ViewDefinition types, read-model (normalizeViewDefinition spread) + canonical reconciliation patch. Regenerated `convex/_generated`.
- Default built-in view icons via `getDefaultViewIcon`/`getViewIconName` (single source): Private tasks→LockSimple, Subscribed→Bell, Active→Lightning, Backlog→ClipboardText, All issues→ListBullets, projects→Kanban, docs→FileText. Custom views use the chosen icon.
- Create-view modal: added a Phosphor icon picker (threaded controller→frame→fields), persisted on create + edit.
- Greyscale view/doc icon chips (the deferred #8): views list/cards (`ViewCardHeader`, `SavedViewRow`) + `DocumentIconTile` now use `bg-surface-3 text-fg-2`, no colored tint/border.
- Docs filter bug: enforce the base docs view's `documentKinds` as identity so viewer-config can't surface the wrong kinds (Workspace docs no longer shows private docs). Pre-existing; not from prior turns.
- Dashboard header: title "Dashboard", tabs inline, no subtitle (dropped PageHeader for an inline SidebarTrigger row).
- Default-view properties editor: display-props tier now a flat on/off Switch list (reuses exported `getViewDisplayPropertyOptions`/`getDisplayPropertyLabel`) instead of the chip popover.
- Team landing route → `/team/{slug}/dashboard`.
- Icons: Dashboard nav uses SquaresFour; Views nav/reference icons use Cards (board layout icon unchanged).

Test added: getViewIconName defaults + chosen-icon passthrough.
Residual: browser smoke still pending for the new modal icon picker, greyscale chips, dashboard header, and flat toggle list.

## Turn 2 — 2026-06-10 (follow-up)

Outcome: all-clear (local), pre-redeploy. Risk: Medium (UI redesign + new dependency + routing).
Verified: typecheck, lint, Fallow dead-code (1 pre-existing) + dupes (114 pre-existing), full suite (1664), production build (Recharts SSR OK).

Changes:
- Bugfix (F3, escaped from Turn 1): built-in/system + fallback view tabs were rendered as plain buttons in `WorkSurfaceTopbar`, bypassing `ViewContextMenu` — so All issues/Active/Backlog (and My-items Private tasks/Subscribed) had no right-click menu. Now every view tab is wrapped in `ViewContextMenu`. Removed the now-unused `isSystemView` import. Root cause: the #11 capability lived in `ViewContextMenu` but a sibling render path skipped it (missed sibling-path sweep).
- Team landing route → `/team/{slug}/dashboard` (`getTeamLandingHref` simplified; Dashboard is always-on). Fixes "lands on issues" in web + Electron (Electron nav policy is origin-based, not path-based, so no allowlist change needed).
- Icons: Dashboard now uses `SquaresFour` (former Views icon); Views nav/reference icons (team + workspace sidebar, view reference, linked-view rows) now use `Cards`. Board *layout* icon intentionally unchanged.
- Dashboard redesign: common `PageHeader` (collapsible sidebar button) + view-style segmented tabs; stat cards; shadcn chart primitive (`components/ui/chart.tsx`, Recharts 2.15.4) with a monochrome `var(--foreground)` completion bar chart and a status donut colored from the shared `STATUS_ACCENTS` map (exported from `event-accent.ts` as the single source). Trimmed unused `ChartLegend`/`ChartLegendContent`/`ChartStyle` exports (Fallow) — `ChartStyle` kept internal.

New dependency: `recharts@2.15.4` (pinned 2.x, the version shadcn's chart wrapper targets).

Residual: dashboard charts/tabs still want a browser smoke (presentation-heavy); production web is live for smoking. Dashboard still reads current store state (no scoped refresh).

## Turn 1 — 2026-06-10

Outcome: all-clear (local), pre-deploy.
Risk: Medium (broad UI + new capability + nav/route + settings + domain selectors).
Archetypes: shared-UI, presentation, domain read-models, feature-gate (services), activity aggregation.

Changes by owner:
- Domain: `lib/domain/selectors-internal/team-dashboard.ts` (completion %, status
  breakdown, project progress — pure, team-scoped). `people.ts`
  `getTeamSpaceActivity` reuses `getWorkspacePersonActivity` + the `PersonActivity`
  model, scoped to a team and enriched with the acting member. `default-views.ts`
  `getSystemViewEditCapability` owns built-in-view edit tiers.
- Presentation: `team-dashboard-screen.tsx` (Overview/Work/Activity tabs, theme
  `bg-foreground` bars, no new chart dependency); `system-view-defaults-dialog.tsx`
  (reuses board chips, persists to viewer-config); `entity-context-menus.tsx`
  (system-view edit entry); `custom-property-controls.tsx` (borderless trigger +
  option colors + two-column editor); `phosphor-icon-picker.tsx` (+95 icons);
  shell nav (always-on Dashboard above Chat); `team-editor-fields.tsx` (always-on
  Dashboard service row).
- Persistence owner reused: empty-group synthesis moved off `editable` onto the
  view's `showEmptyGroups` (view-config owner) in `work-surface-view.tsx`.

Findings (all resolved this turn):
- F1 (dead-code, fixed): unused `systemViewSurfaceKey`/`editCapability` fields added
  to `CreateDialogState` during an abandoned approach — removed from `models.ts`.
- F2 (dead-code + duplication, fixed): 10 untracked `" 2.ts"` Finder-duplicate
  files (14.5k duplicated lines, 10 dead files) removed. They were identical clones
  of tracked files, unreachable, and at risk of accidental commit.

Invariant/contract checks:
- No Convex schema/function/validator changes; no migration; no public API/contract
  change. Dashboard + activity are read-only, team-scoped reads (filter by teamId);
  no auth/tenancy change. System-view edits persist only to viewer-config (system
  view records stay immutable) — same owner the board toolbar already writes to.
- Empty-group behavior transfer: read-only surfaces now show configured empty
  groups; the two tests that encoded the old "read-only hides empty groups" rule
  were updated to the new view-config-owned rule.

Fallow (post-cleanup): dead-code = 1 pre-existing tracked script
(`scripts/seed-dummy-data.mjs`, intentionally unreachable, left as-is); duplication
= 114 pre-existing lines (a test block + duplicate status-literal arrays in
`convex/validators.ts`). No new clone/dead-code debt from this work.

Residual risk (non-blocking):
- Dashboard reads current store state (no scoped read-model refresh), so a cold
  deep link can show stale/empty data until the workspace loads. Acceptable v1.
- `getTeamSpaceActivity` iterates each member's full workspace activity
  (O(members × activity)); capped to 30 results, memoized. Revisit if large teams
  show lag.
- Dashboard appears for all team experiences (incl. community); work-completion
  content degrades to empty states there — reasonable-assumption decision.
- Browser smoke still recommended for the dashboard charts/tabs and the system-view
  defaults dialog (presentation-heavy; not headless-smokeable here).

Recommendation: safe to push and deploy from a code-correctness standpoint;
perform a browser smoke of the team dashboard and system-view editor post-deploy.
