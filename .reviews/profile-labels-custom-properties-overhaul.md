# Profile / Labels / Custom Properties Overhaul — Deep Diff Review

Scope of this review is limited to the changes made in this thread. The working
tree also contains unrelated, pre-existing uncommitted work (chat-thread,
conversation-files-panel, scoped_read_models, auth_bootstrap, etc.) which is
explicitly **out of scope** and was not reviewed or modified.

## Changes in scope (this thread)

### 1. Person profile redesign — `components/app/people-screen.tsx`
- Added `ProfilePill` + `StatusPill` so the status pill and role/team pills share
  one size/shape (fixes the "offline vs member pills are different sizes" issue).
  Removed all `Badge` usages from this screen.
- `ProfileHero`: avatar gets a soft status-accent halo + ring/offset and a larger
  status badge; status, roles, and email render as uniform pills; Message/Email
  actions retained.
- `ProfileSidebar` (About): clean label/value rows; teams and roles use `ProfilePill`.
- `ActivityRow`: category dot + inline category chip; comment-style activities
  (`workItemCommented`, `documentCommented`, `channelPostCommented`,
  `projectUpdatePosted`) render their detail as a quoted preview; timestamps keep a
  full-date `title` tooltip.
- `AssignedWorkRow`: real `StatusIcon` + `PriorityDot` visuals.
- Replaced the shared `SettingsNav` with a local underline-style `ProfileTabs`;
  removed the redundant section headers now that tabs label + count each list.

### 2. Custom property modal — `components/app/screens/custom-property-controls.tsx`
- `CustomPropertyDefinitionDialog` redesigned (clearer header, name+icon row, type
  select, option rows with color dot + label input + remove + Add option).
- Added **edit mode** via an optional `definition` prop; `useRef(definition)` +
  `useEffect([open])` seed the form, and `handleSave` routes to
  `updateCustomPropertyDefinition` when editing, else `createCustomPropertyDefinition`.

### 3. Sidebar add/edit/remove — `components/app/screens/work-item-detail-screen.tsx`
- `WorkItemSidebarCustomPropertyRows` now exposes hover Edit (`NotePencil`) and
  Remove (`Trash` → `archiveCustomPropertyDefinition`) controls per property.
- Parent tracks `editingCustomProperty`; the Add button resets it to `null`; the
  dialog receives `definition` and clears it on close.

### 4. Enter values for empty custom properties — `components/app/screens/work-surface-view.tsx`
- `renderCustomWorkItemDisplayProperty` no longer returns `null` for an empty value,
  so a free-text (and every other) custom property renders an editable control even
  before a value exists. This is the single shared renderer used by both `ListView`
  and `BoardView` (variant `list`/`board`), which are consumed by team views, My
  Items, **and** project views (`project-detail-screen.tsx` imports the same
  components) — so coverage spans all views/boards/projects/My Items uniformly.

### 5. Label dropdown polish + rename — `detail-sidebar-labels-row.tsx`
- Dropdown is now a clean vertical list with check marks and an inline
  "Create new label" footer.
- Inline **rename**: hover pencil turns a row into an input; Enter commits, Escape
  cancels (blur-vs-Enter double-commit guarded via `skipRenameCommitRef`).

### 6. Label rename backend (new mutation, full architecture parity with `createLabel`)
- `convex/app/workspace_team_handlers.ts`: `updateLabelHandler` — token assert, user
  + label lookup (`getLabelDoc`), private-owner / editable-workspace access checks,
  name normalization, duplicate-name guard (excluding self), `ctx.db.patch`.
- `convex/app.ts`: registered `updateLabel` mutation (auto-typed via `ApiFromModules`).
- `lib/server/convex/work.ts`: `updateLabelServer` (same error-mapping wrapper as create).
- `lib/convex/client/work.ts` + `lib/convex/client.ts`: `syncUpdateLabel` (PATCH).
- `app/api/labels/route.ts`: `PATCH` handler with `labelUpdateSchema`, mirroring the
  POST read-model scope bumps (`bumpPrivateLabelReadModelScopesServer` for private,
  `bumpWorkspaceMembershipReadModelScopesServer` for workspace labels).
- `lib/domain/types-internal/schemas.ts`: `labelUpdateSchema`.
- Store: `updateLabel` action (optimistic re-sort + rollback on failure) in
  `work-item-actions.ts`, with type + slice-pick wiring.

## Review findings & resolutions

1. **Modal placeholder broke an existing contract** — the redesign changed the name
   input placeholder away from `"Property name"`, failing
   `work-item-detail-screen.test.tsx`. **Fixed**: restored `"Property name"`.
2. **Type change on edit could orphan option/value data** — editing a property's
   `type` after creation is supported by the store but silently invalidates select
   options / existing values. **Fixed**: the type selector is now disabled in edit
   mode with an explanatory hint (create still offers all types).
3. **New backend mutation lacked tests (architecture standard)** — **Fixed** by adding:
   - `updateLabelHandler` tests (workspace rename, duplicate-name rejection, private
     owner-only enforcement) in `tests/convex/workspace-team-handlers.test.ts`.
   - `updateLabel` store tests (optimistic re-sort, failure rollback) in
     `tests/lib/store/work-item-actions.test.ts`.
   - PATCH route contract test (read-model bump) in
     `tests/app/api/asset-notification-invite-route-contracts.test.ts`.

## Accepted as-is (noted, not changed)
- **Empty custom-property cells render an editable control for all viewers.** The
  control hardcodes `editable`, matching the pre-existing behavior for filled values;
  permission is still enforced at commit (`setCustomPropertyValue` toasts for
  read-only roles). Preserving the hardcoded value guarantees the requested
  cross-surface entry without relying on per-surface editable threading.
- **Property removal from the sidebar is immediate** (no confirm dialog). It is a
  reversible soft-archive with a success toast, and was explicitly requested.

## Out of scope / deferred (require their own change)
- **Custom properties on documents + document views.** Not supported by the current
  data model: `customPropertyDefinitionFields.targetType` is `v.literal("workItem")`
  and `customPropertyValueFields` is keyed by a required `workItemId`. Extending to
  documents is a net-new feature (schema/targetType change + value re-keying +
  backend handlers + document UI + read-model sync) and a live-table migration — it
  should be a dedicated, separately reviewed change rather than folded into this one.
- **Drag-reorder of custom property *definitions*.** Needs a persisted `order` field
  on the schema. (Display-property order is already reorderable via
  `PropertiesChipPopover`.)

## Verification
- `pnpm typecheck`: clean (after removing stale `.next/types/* N.ts` filesystem
  duplicates that are unrelated build artifacts).
- Targeted suites pass: `people-screen`, `custom-property-controls`,
  `property-select`, `properties-chip-popover`, `work-surface`, `work-surface-view`,
  `work-item-detail-screen`, `work-item-labels-editor`, `create-dialogs`,
  `work-item-actions`, `workspace-team-handlers`,
  `asset-notification-invite-route-contracts`.

## Follow-up fixes (post-review)

1. **Activity previews showed literal `<p>…</p>`** — `getPlainTextContent`
   (`lib/utils.ts`) stripped tags *before* decoding HTML entities, so escaped markup
   (`&lt;p&gt;…`) re-materialized as visible tags in comment/channel previews.
   **Fixed** by decoding entities first, then stripping markup (behavior is identical
   for raw-HTML input; only escaped content changes). Verified the
   `getPlainTextContent` consumers still pass: `input-constraints`,
   `field-character-limit`, `rich-text-security`, `comment-handlers`,
   `work-comment-actions`.
2. **Profile top redesign** — the right-hand "About" card was removed; its details
   (email + copy, handle, teams) now live in a details grid inside the hero alongside
   the status/role pills, and the bottom is a single full-width canvas containing only
   the Activity / Assigned work tabs. `ProfileSidebar`/`SectionCardHeader` deleted; the
   `people-screen` test's combined "Teams: …" assertion updated to the new team pills.
   Typecheck clean; `people-screen` test passes.
