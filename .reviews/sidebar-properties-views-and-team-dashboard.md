# Sidebar properties, view editing, empty groups, and team dashboard

Scope: custom-property dropdown/editor UX, icon set expansion, empty-group fix,
built-in (system) view editing, and the new team-space Dashboard. Reviewed with
architecture-standards + diff-review + fallow.

Status: CLEAN (local). Verified: typecheck, lint (--max-warnings 0), fallow
dead-code + dupes, full test suite (235 files / 1664 tests), production build.

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
