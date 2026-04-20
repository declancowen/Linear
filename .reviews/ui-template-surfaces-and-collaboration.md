# Review: UI Template Surfaces And Collaboration

## Project context (captured on Turn 1 — not re-detected on subsequent turns)

| Field | Value |
|-------|-------|
| **Repository** | `Linear` |
| **Remote** | `https://github.com/declancowen/Linear.git` |
| **Branch** | `ui-templates` |
| **Repo type** | `single repo` |
| **Stack** | `Next.js App Router / Convex / TypeScript / Electron` |
| **Packages affected** | `n/a` |
| **OS** | `Darwin 25.4.0` |
| **Package manager** | `pnpm 10.32.0` |
| **Node** | `v25.8.0` |
| **Python** | `n/a` |

## Scope (cumulative — updated each turn as new files are touched)

Files and areas reviewed across all turns:
- `components/app/screens/create-work-item-dialog.tsx` — create-work modal surface and property chips
- `components/app/screens/work-surface-view.tsx` — list/board interaction affordances
- `components/app/screens/work-surface.tsx` — work surface topbar controls
- `components/app/screens/work-item-detail-screen.tsx` — work-item detail sidebar rendering
- `components/app/screens/collection-boards.tsx` — project board visual tokens
- `components/app/collaboration-screens/channel-ui.tsx` — channel post cards and new-post composer affordances
- `components/app/collaboration-screens/chat-thread.tsx` — chat composer affordances
- `components/app/screens/project-creation.tsx` — project create shortcut path
- `components/app/screens/work-surface-controls.tsx` — persisted view chip controls and property popovers
- `components/ui/collapsible-right-sidebar.tsx` — sidebar mount/unmount behavior
- `lib/convex/client/work.ts` — project update route contract typing
- `lib/server/convex/teams-projects.ts` — project update server contract typing
- `templates/*.html`, `templates/*.js`, `templates/*.css` — imported HTML/CSS reference assets, including duplicate `* 2.*` copies

## Review status (updated every turn)

| Field | Value |
|-------|-------|
| **Review started** | `2026-04-19 18:41:21 BST` |
| **Last reviewed** | `2026-04-20 13:51:35 BST` |
| **Total turns** | `9` |
| **Open findings** | `0` |
| **Resolved findings** | `14` |
| **Accepted findings** | `0` |

---

## Turn 1 — 2026-04-19 18:41:21 BST

| Field | Value |
|-------|-------|
| **Commit** | `db6459f` |
| **IDE / Agent** | `unknown` |

**Summary:** The branch successfully ports a large amount of template styling, but it still introduces several dead affordances that the product does not support. The remaining issues are concentrated in the primary create-work flow, collaboration composers, and the reference-assets folder, where accidental duplicate files were committed.

| Status | Count |
|--------|-------|
| Findings | `4` |

### Findings

#### B1-01 [BUG] High — `components/app/screens/create-work-item-dialog.tsx:1324` — Create-work modal still ships unsupported property chips

**What's happening:**
The create-work modal still renders `Due date`, `Milestone`, and `Estimate` chips as disabled controls even though those flows do not exist in the current product contract. This is exactly the UI drift the branch was supposed to remove.

**Root cause:**
The modal was ported from the HTML template by preserving placeholder chips instead of mapping only the properties that the real create flow can submit today.

**Codebase implication:**
This keeps the most important authoring surface out of sync with the actual backend-supported create payload. Users get a form that advertises scheduling and estimation controls the app cannot honor, and future cleanup gets harder because downstream work has to distinguish real inputs from decorative placeholders.

**Solution options:**
1. **Quick fix:** Remove the three disabled chips from the modal footer row.
2. **Proper fix:** Define the create-modal chip row from an explicit list of supported create-time fields so template-only placeholders cannot leak back in.

**Investigate:**
Confirm whether any near-term API work is planned for due date, milestone, or estimate on item creation. If not, these chips should be deleted rather than hidden behind `disabled`.

> Disabled placeholder chips remain at `create-work-item-dialog.tsx:1324-1352`.

#### B1-02 [BUG] High — `components/app/collaboration-screens/channel-ui.tsx:166` — Channel UI still contains multiple non-functional action controls

**What's happening:**
The channel surface adds several controls that do not work: a disabled `Copy link` action on post cards, disabled formatting/link/attach controls in the new-post composer, and a disabled `Preview` button.

**Root cause:**
The template composition was ported directly into the live channel UI, but placeholder actions from the reference HTML were left in place instead of being mapped to current product capabilities.

**Codebase implication:**
The forum-style channel surface now communicates functionality that does not exist, and it does so in the primary post-authoring path. That undermines confidence in the feature and creates more places where future contributors must reverse-engineer whether a control is real or decorative.

**Solution options:**
1. **Quick fix:** Remove the disabled `Copy link`, formatting/link/attach toolbar buttons, and `Preview` button.
2. **Proper fix:** Build the channel composer action row from the same capability gates used by the rich-text editor and collaboration APIs so only implemented actions render.

**Investigate:**
Check whether there is an existing channel-post permalink flow or preview route elsewhere in the product. If not, these controls should be deleted instead of visually retained.

> Non-functional controls remain at `channel-ui.tsx:166-173`, `channel-ui.tsx:557-605`, and `channel-ui.tsx:632-639`.

#### B1-03 [BUG] Medium — `components/app/collaboration-screens/chat-thread.tsx:104` — Chat composer now advertises unsupported message actions

**What's happening:**
The chat composer renders disabled `Attach`, `Mention`, and `Link item` buttons in the primary message-entry row even though those actions are not implemented.

**Root cause:**
The chat composer was restyled toward the template shell, but the extra action buttons were introduced as static UI rather than being driven by real chat capabilities.

**Codebase implication:**
This creates the same product-parity problem as the create-work and channel surfaces, but in a high-frequency flow. Because chat is used repeatedly, users will hit dead controls constantly and assume the feature is partially broken.

**Solution options:**
1. **Quick fix:** Remove the disabled attach/mention/link buttons from the composer row.
2. **Proper fix:** Source chat composer actions from a shared collaboration capability model so unsupported actions never render in chat or channels.

**Investigate:**
Confirm whether chat should support rich mentions beyond the existing editor mention flow. If mentions are already handled inline by typing `@`, the disabled explicit mention button should be removed rather than later wired up separately.

> Dead composer actions remain at `chat-thread.tsx:104-143`.

#### O1-04 [OBSERVATION] Medium — `templates/* 2.*` — Duplicate template reference files were committed alongside the canonical copies

**What's happening:**
The branch includes duplicate template artifacts like `templates/board 2.html`, `templates/chat 2.html`, `templates/_icons 2.js`, and similar `* 2.*` copies next to the canonical reference files.

**Root cause:**
The template import added filesystem duplicates instead of curating a single source-of-truth set of reference assets.

**Codebase implication:**
This does not break runtime behavior, but it makes the `templates/` directory ambiguous for future UI work. Anyone using the folder as the design source now has to guess which copy is authoritative, and automated tooling or future reviewers may inspect the wrong file.

**Solution options:**
1. **Quick fix:** Delete all `* 2.*` duplicates and keep one canonical copy per template asset.
2. **Proper fix:** Add a small `templates/README.md` documenting the intended reference set and naming conventions so accidental duplicates are easier to catch in future diffs.

**Investigate:**
Compare one or two duplicate pairs to confirm they are byte-for-byte duplicates before deleting them. If any differ, decide which version is the intended source of truth and rename it accordingly.

> Duplicate assets include `templates/board 2.html`, `templates/chat 2.html`, `templates/channel 2.html`, `templates/create-modal 2.html`, `templates/item-sidebar 2.html`, `templates/projects 2.html`, `templates/property-dropdown 2.html`, `templates/table 2.html`, `templates/views 2.html`, plus matching duplicated JS/CSS helpers.

### Recommendations

1. **Fix first:** Remove the dead controls in the create-work modal and the collaboration composers. Those are the most user-visible product mismatches and they directly violate the “no unsupported UI” constraint for this branch.
2. **Then address:** Delete the duplicated `templates/* 2.*` files so the design-reference folder has a single authoritative copy of each asset.
3. **Patterns noticed:** The branch repeatedly ports template chrome faster than it reconciles actual product capability. The recurring issue is not styling quality — it is capability drift.
4. **Suggested approach:** Do one tight cleanup pass per surface: create-work modal, chat composer, channel composer/post card, then template folder hygiene. After that, re-run a focused diff review to confirm no other dead affordances remain.

---

## Turn 2 — 2026-04-19 18:56:22 BST

| Field | Value |
|-------|-------|
| **Commit** | `db6459f` |
| **IDE / Agent** | `unknown` |

**Summary:** The prior cleanup pass resolved the four Turn 1 findings in the working tree: the dead create-work chips are gone, the dead chat/channel controls are gone, and the duplicate template copies are deleted. One remaining mismatch is still present in the create-view modal, where an informational route chip is rendered as a disabled button even though there is no direct route-picker interaction there.

| Status | Count |
|--------|-------|
| Findings | `1` |
| Resolved | `4` |

### Status updates

- `B1-01` Resolved — the unsupported `Due date`, `Milestone`, and `Estimate` chips were removed from `create-work-item-dialog.tsx`.
- `B1-02` Resolved — the disabled `Copy link`, formatting/link/attach toolbar buttons, and `Preview` button were removed from `channel-ui.tsx`.
- `B1-03` Resolved — the disabled `Attach`, `Mention`, and `Link item` buttons were removed from `chat-thread.tsx`.
- `O1-04` Resolved — the duplicate `templates/* 2.*` files were deleted from the working tree.

### Findings

#### B2-01 [BUG] Medium — `components/app/screens/create-view-dialog.tsx:402` — Create-view modal still renders an informational route chip as a disabled button

**What's happening:**
The create-view modal still renders the resolved route chip using a disabled `<button>`. There is no click behavior on that control; the route is derived from the selected scope and entity and cannot actually be chosen from this chip.

**Root cause:**
The create modal shell reused the same chip-button styling pattern as interactive create-work controls, but this specific route display is read-only state, not an actionable control.

**Codebase implication:**
This leaves one more template-style false affordance in a core create surface. The modal visually suggests a route picker that does not exist, which is the same product-parity problem the recent cleanup was intended to remove.

**Solution options:**
1. **Quick fix:** Replace the disabled `<button>` with a non-interactive `<div>` or `<span>` using the same visual styling.
2. **Proper fix:** Split “interactive chip” and “read-only chip” primitives so create surfaces cannot accidentally render read-only state as disabled buttons.

**Investigate:**
Confirm whether route selection is intentionally derived-only for saved views. If direct route picking is not planned, this control should remain purely presentational.

> The disabled route chip remains at `create-view-dialog.tsx:402-410`.

### Recommendations

1. **Fix next:** Replace the disabled route chip in the create-view modal with a read-only presentation element.
2. **After that:** Re-run one final diff review; the branch is otherwise clear of the dead template affordances flagged in Turn 1.

---

## Turn 3 — 2026-04-19 19:02:00 BST

| Field | Value |
|-------|-------|
| **Commit** | `db6459f` |
| **IDE / Agent** | `unknown` |

**Summary:** The create-view route chip has been removed from the working tree, and a focused re-review of the create/chat/channel/sidebar surfaces did not reveal any additional dead affordances of the same kind. The prior open finding is now resolved.

| Status | Count |
|--------|-------|
| Findings | `0` |
| Resolved | `1` |

### Status updates

- `B2-01` Resolved — the read-only route chip was removed from `create-view-dialog.tsx`.

### Findings

No new findings in this turn.

### Recommendations

1. No further issues found in this review slice after the route-chip cleanup.

---

## Turn 4 — 2026-04-19 19:25:17 BST

| Field | Value |
|-------|-------|
| **Commit** | `068ca96` |
| **IDE / Agent** | `unknown` |

**Summary:** External PR analysis surfaced several additional concerns. After re-checking them against the current branch, four hold up as actionable findings: one security regression in the new item sidebar, one stale-closure bug in the create-work shortcut, one dead affordance in the list surface, and one project-board token bug caused by template CSS variable names leaking into the app. The remaining comments are valid observations but not blockers.

| Status | Count |
|--------|-------|
| Findings | `4` |

### Findings

#### B4-01 [BUG] High — `components/app/screens/work-item-detail-screen.tsx:1607` — Detail sidebar bypasses rich-text sanitization and injects description HTML directly

**What's happening:**
The new work-item detail sidebar renders `sidebarDescription` with `dangerouslySetInnerHTML`, while the established rich-text display path uses `RichTextContent`, which sanitizes through `sanitizeRichTextContent`.

**Root cause:**
The sidebar template port introduced a standalone HTML render block instead of reusing the existing sanitized rich-text component.

**Codebase implication:**
Any unsanitized description HTML that makes it into item content would now execute in the sidebar surface, even though the main description renderer already protects against that class of input. This creates an inconsistent and weaker security boundary for the same content field.

**Solution options:**
1. **Quick fix:** Replace the raw `<div dangerouslySetInnerHTML>` block with `RichTextContent`.
2. **Proper fix:** Consolidate all item-description rendering through a single shared rich-text renderer so sidebar/template variants cannot bypass sanitization.

**Investigate:**
Check whether any other template-derived surfaces render rich text directly instead of going through `RichTextContent` or `sanitizeRichTextContent`.

> Raw HTML injection remains at `work-item-detail-screen.tsx:1607-1609`, while `RichTextContent` sanitizes at `components/app/rich-text-content.tsx:15-26`.

#### B4-02 [BUG] High — `components/app/screens/collection-boards.tsx:33` — Project board token maps reference CSS variables that do not exist in the app

**What's happening:**
`projectHealthAccent` uses `var(--fg-3)` for `"no-update"`, and `projectIconTint` uses `var(--lbl-*)`. Those variables are not defined in `app/globals.css`; the app defines `--text-3` and `--label-*` instead.

**Root cause:**
Template token names from the standalone reference CSS (`--lbl-*`) leaked into app code instead of being mapped to the app’s actual variable names.

**Codebase implication:**
Inline styles that depend on those variables can resolve to nothing, causing missing icon tinting and invisible/incorrect health indicators for project cards. Because these are inline `style` values, Tailwind token aliases like `--color-fg-3` do not rescue them.

**Solution options:**
1. **Quick fix:** Swap `var(--fg-3)` to `var(--text-3)` and `var(--lbl-*)` to `var(--label-*)`.
2. **Proper fix:** Centralize these accent/token maps in a shared helper so board surfaces cannot accidentally mix template-only variable names with app tokens.

**Investigate:**
Search the branch for other uses of `--lbl-*` or `--fg-*` inside inline styles. The same leak pattern may exist in other template-ported surfaces.

> Broken mappings remain at `collection-boards.tsx:33-44`.

#### B4-03 [BUG] Medium — `components/app/screens/create-work-item-dialog.tsx:452` — Cmd/Ctrl+Enter submit can use stale parent state

**What's happening:**
The create-work dialog’s keyboard-submit effect calls `handleCreate()`, but the effect dependency list omits parent selection state even though `handleCreate` reads `selectedParentItem` when building the create payload.

**Root cause:**
The effect intentionally suppresses exhaustive-deps and manually lists state inputs. That list includes `effectiveProjectId` but not `selectedParentId` / `selectedParentItem`, so parent-only changes can leave the keydown handler closure stale.

**Codebase implication:**
If the user changes the selected parent and immediately presses Cmd/Ctrl+Enter without changing another tracked field, the shortcut path can create the item under the previous parent (or no parent) while the click path uses the current form state.

**Solution options:**
1. **Quick fix:** Add parent selection state to the effect dependencies or depend directly on `handleCreate`.
2. **Proper fix:** Move the submission callback behind a stable event helper so keyboard submit and button submit always share the exact same live closure without handwritten dependency management.

**Investigate:**
Check whether the create-work dialog is the only create surface using a manually-maintained keyboard-submit dependency list. Similar stale-closure risk may exist in sibling dialogs.

> The stale shortcut effect remains at `create-work-item-dialog.tsx:452-483`, while `handleCreate` reads `selectedParentItem` at `create-work-item-dialog.tsx:419-433`.

#### B4-04 [BUG] Medium — `components/app/screens/work-surface-view.tsx:547` — List view exposes an “Add an item” row with no behavior

**What's happening:**
Editable grouped list sections render `ListAddItemRow`, but its `onClick` handler is intentionally empty.

**Root cause:**
The template row was carried over as visible UI before the actual add-item flow for grouped lists was wired up.

**Codebase implication:**
This puts a dead affordance directly in the main list workflow. Users are invited to add an item from the group body, but clicking the control does nothing, which undermines trust in the rest of the surface.

**Solution options:**
1. **Quick fix:** Hide the row until the behavior exists.
2. **Proper fix:** Wire the row into the same create-item flow as the main `New` action, ideally pre-scoped to the current group/subgroup.

**Investigate:**
Check whether grouped board columns or timeline groups have matching placeholder add-item affordances. If so, treat them consistently rather than only removing the list version.

> The inert add row remains at `work-surface-view.tsx:547-550`.

### Notes on external comments

The following external comments were reviewed but not promoted to findings in this turn:
- the project-creation Cmd/Ctrl+Enter path duplicates create logic instead of calling a shared helper — maintainability issue, not a current correctness bug
- the board card drag target now covers the whole card — worth QA, but no repro-backed regression yet
- the sidebar unmount behavior can reset local state — intentional tradeoff for fixing the broken close/reopen interaction
- the project progress-bar layering is a visual/design observation rather than a correctness issue

### Recommendations

1. **Fix first:** Replace the unsafe sidebar description renderer and correct the broken CSS variable names in `collection-boards.tsx`.
2. **Then fix:** Resolve the stale create-work keyboard-submit closure and either wire up or remove the inert list `Add an item` row.
3. **After that:** Re-run the diff review on this same file to confirm the external-analysis findings are fully closed.

---

## Turn 5 — 2026-04-19 19:29:09 BST

| Field | Value |
|-------|-------|
| **Commit** | `068ca96` |
| **IDE / Agent** | `unknown` |

**Summary:** The four blocker findings from Turn 4 are now resolved in the working tree. The detail sidebar uses the sanitized rich-text renderer, project-board token names match the app theme variables, the create-work keyboard-submit effect now tracks parent selection changes, and the dead list/board add-item affordances have been removed. A focused rerun of this review slice did not surface any additional open findings.

| Status | Count |
|--------|-------|
| Findings | `0` |
| Resolved | `4` |

### Status updates

- `B4-01` Resolved — the work-item detail sidebar now renders descriptions through `RichTextContent` instead of raw `dangerouslySetInnerHTML`.
- `B4-02` Resolved — the project board token maps now use `--text-3` and `--label-*` instead of undefined template-only CSS variables.
- `B4-03` Resolved — the create-work Cmd/Ctrl+Enter effect now tracks parent selection changes through `selectedParentId`.
- `B4-04` Resolved — the inert list `Add an item` row was removed, and the matching dead board add-item affordances were removed in the same cleanup.

### Findings

No new findings in this turn.

### Recommendations

1. No open findings remain in this review slice after the blocker fixes.

---

## Turn 6 — 2026-04-19 19:37:25 BST

| Field | Value |
|-------|-------|
| **Commit** | `03de1e1` |
| **IDE / Agent** | `unknown` |

**Summary:** A fresh batch of PR comments included several items already resolved by the recent blocker-fix commit, plus a mix of observations and new branch-current issues. Three new findings hold up against the current code: label colors in list/board surfaces no longer reflect the actual label model, due dates still render even when the property is hidden, and the main work-surface topbar still contains two dead buttons. The remaining comments in that batch were either already fixed, downgraded to observations, or too speculative to promote without a repro.

| Status | Count |
|--------|-------|
| Findings | `3` |

### Findings

#### B6-01 [BUG] Medium — `components/app/screens/work-surface-view.tsx:125` — Label color rendering ignores the actual label color model

**What's happening:**
`getLabelColor()` hashes the label ID into one of five theme tokens instead of using the actual `label.color` value from app data. Other surfaces in this branch — including the create-work dialog and the work-item sidebar — render labels with `label.color` directly.

**Root cause:**
The table/board template port introduced a display-only helper based on template palette slots rather than reusing the real label color source already present in the domain model.

**Codebase implication:**
The same label can render with different colors depending on which surface you view it in. That makes labels visually inconsistent across the product and weakens the usefulness of color as an identifier.

**Solution options:**
1. **Quick fix:** Replace `getLabelColor(labelId)` with a lookup that returns `label.color` when the label exists.
2. **Proper fix:** Centralize label-color rendering in a shared helper/component so all surfaces use the same source of truth.

**Investigate:**
Check whether any other template-derived surfaces also replaced `label.color` with derived palette hashes. If so, fix them together to keep labels consistent product-wide.

> The hash-based helper remains at `work-surface-view.tsx:125-127`, while real label colors are used at `create-work-item-dialog.tsx:1246` and `work-item-detail-screen.tsx:462`.

#### B6-02 [BUG] Medium — `components/app/screens/work-surface-view.tsx:766` — Due-date cell ignores the active property selection

**What's happening:**
List rows still render the due-date cell whenever an item has a date, even if `dueDate` has been removed from the active `displayProps`.

**Root cause:**
The template row structure made the due-date slot unconditional, but the property-toggle behavior from the original work surface was not carried over to that cell.

**Codebase implication:**
The Properties control no longer matches what the list actually renders. Users can disable due dates in the view config and still see dates (or the placeholder dash) in every row, which makes the configuration UI unreliable.

**Solution options:**
1. **Quick fix:** Guard the due-date cell with `displayProps.includes("dueDate")` and keep the row layout aligned with an empty spacer when hidden.
2. **Proper fix:** Derive the row cells from a single display-property-driven layout model so column visibility and rendered cells cannot drift apart.

**Investigate:**
Check whether the board card metadata area and any timeline/list variants have similar unconditional due-date rendering now that the template layouts are in place.

> The unconditional due-date branch remains at `work-surface-view.tsx:766-779`.

#### B6-03 [BUG] Medium — `components/app/screens/work-surface.tsx:147` — Main work-surface topbar still contains dead interactive controls

**What's happening:**
The topbar renders `Search` and `More options` as clickable icon buttons, but neither has an `onClick` handler or any wired behavior.

**Root cause:**
The template topbar chrome was ported directly into the live work surface without mapping those controls to current product functionality.

**Codebase implication:**
This reintroduces the same kind of dead affordance the earlier cleanup removed from create/chat/channel surfaces. On a primary screen, those inert buttons look like broken functionality rather than harmless decoration.

**Solution options:**
1. **Quick fix:** Remove the buttons until real actions exist.
2. **Proper fix:** Wire them to actual work-surface search and overflow actions once the underlying product behavior exists.

**Investigate:**
Search the other template-ported topbars for similar inert icon buttons. The same pattern may exist in sibling surfaces.

> The inert topbar controls remain at `work-surface.tsx:147-151`.

### Notes on external comments

The following comments were reviewed but not promoted to findings in this turn:
- `collection-boards.tsx` undefined CSS variables — already fixed in the current branch
- `work-item-detail-screen.tsx` raw `dangerouslySetInnerHTML` — already fixed in the current branch
- `create-work-item-dialog.tsx` hand-maintained shortcut deps — still a maintenance smell, but the correctness bug previously tracked as `B4-03` is resolved
- `project-creation.tsx` duplicated create logic in the keyboard shortcut — maintainability issue, not a current correctness bug
- `collapsible-right-sidebar.tsx` unmounting children on close — intentional behavior tradeoff and not a correctness bug by itself
- `collection-boards.tsx` stacked progress bars — visual/design observation
- `work-surface-view.tsx` whole-card drag target and click interference — plausible UX risk, but still needs an actual repro before promotion to a branch-current bug
- `work-surface-view.tsx` O(n²) child-count scans — performance observation worth future cleanup, but not a blocker for this diff without evidence of user-visible slowdown

### Recommendations

1. **Fix next:** Restore real label colors in `work-surface-view.tsx` and make due-date rendering respect `displayProps`.
2. **Then fix:** Remove or wire the dead `Search` / `More options` buttons in `work-surface.tsx`.
3. **After that:** Re-run this review slice to confirm the work-surface surfaces are back to 0 open findings.

---

## Turn 7 — 2026-04-19 19:39:50 BST

| Field | Value |
|-------|-------|
| **Commit** | `03de1e1` |
| **IDE / Agent** | `unknown` |

**Summary:** The three work-surface findings from Turn 6 are now resolved in the working tree. Label chips in list and board views use the actual label model color again, due-date rendering is gated by `displayProps`, and the inert `Search` / `More options` topbar buttons have been removed. A focused rerun of the review slice did not uncover any additional open findings.

| Status | Count |
|--------|-------|
| Findings | `0` |
| Resolved | `3` |

### Status updates

- `B6-01` Resolved — `work-surface-view.tsx` now uses `label.color` for label chip dots in both list and board surfaces.
- `B6-02` Resolved — due-date rendering in `work-surface-view.tsx` now respects `displayProps.includes("dueDate")`.
- `B6-03` Resolved — the inert `Search` and `More options` buttons were removed from `work-surface.tsx`.

### Findings

No new findings in this turn.

### Recommendations

1. No open findings remain in this review slice after the work-surface cleanup.

---

## Turn 8 — 2026-04-20 13:46:20 BST

| Field | Value |
|-------|-------|
| **Commit** | `668b108` |
| **IDE / Agent** | `unknown` |

**Summary:** The post-review WIP commit introduces two branch-current regressions. One is in the new property chip popover, where the `Clear all` affordance is wired through an unsupported view-config mutation path. The other is project-status drift: `planning` is now part of the domain model, but the project UI and update contracts still omit it, which breaks both the status picker and the branch typecheck.

| Status | Count |
|--------|-------|
| Findings | `2` |

### Findings

#### B8-01 [BUG] High — `components/app/screens/work-surface-controls.tsx:1658` — “Clear all” properties is wired through an unsupported mutation path

**What's happening:**
`PropertiesChipPopover` now renders a `Clear all` action, but the fallback handler tries to call `updateViewConfig(view.id, { displayProps: [] })` even though `displayProps` is not part of the persisted view-config patch contract.

**Root cause:**
The new chip-popover affordance was added on top of the existing `toggleViewDisplayProperty` flow, but the bulk-clear action was implemented as if display props were a first-class `updateViewConfig` field.

**Codebase implication:**
This shipped a dead persisted-view control into the shared work-surface chrome. In practice it fails typecheck immediately, and even if forced through, it would bypass the actual display-property sync path and leave local/server state out of sync.

**Solution options:**
1. **Quick fix:** Clear properties by iterating the existing `toggleViewDisplayProperty` path for every active property.
2. **Proper fix:** Add an explicit “clear display properties” mutation so bulk clearing remains a single atomic persisted action.

**Investigate:**
Search the new chip controls for other bulk actions that were layered on top of single-toggle APIs. The same mismatch can recur anywhere a new `Clear all` affordance gets added without a matching persisted mutation.

> The unsupported clear path is in `work-surface-controls.tsx:1658-1666`.

#### B8-02 [BUG] High — `components/app/screens/project-creation.tsx:105` — Project status support drifted after `planning` was added to the domain model

**What's happening:**
The branch now includes `planning` in the canonical `ProjectStatus` type, but the project status picker/order map and both project update contracts still exclude it.

**Root cause:**
The status-model expansion did not fully propagate through the UI and route/server typing layers touched by the current WIP pass.

**Codebase implication:**
This is both a correctness issue and a release blocker. The project picker can no longer represent the full status model, and project updates reject/under-type a valid status, which is why the branch currently fails `pnpm typecheck`.

**Solution options:**
1. **Quick fix:** Thread `planning` through the UI order/color maps and the client/server project-update patch types.
2. **Proper fix:** Source project status options from shared domain metadata so new statuses cannot be missed by individual surfaces and transport layers.

**Investigate:**
Search for any remaining `ProjectStatus` unions or ordered maps that still inline the old five-value list instead of deferring to the domain type/meta.

> The drift is visible in `project-creation.tsx:105-120`, `lib/convex/client/work.ts:644-652`, and `lib/server/convex/teams-projects.ts:310-318`.

### Recommendations

1. **Fix first:** Route the property-popover bulk clear back through a supported persisted display-property path.
2. **Then fix:** Bring `planning` support back into the project creation/update UI and route/server contract types.
3. **After that:** Re-run typecheck and the focused dialog/view/project tests before considering the branch ready to commit.

---

## Turn 9 — 2026-04-20 13:51:35 BST

| Field | Value |
|-------|-------|
| **Commit** | `668b108` |
| **IDE / Agent** | `unknown` |

**Summary:** The two new findings from Turn 8 are resolved in the working tree. Property clearing now goes back through the supported display-property toggle path, and `planning` is carried through the project status picker plus the client/server project update contracts. A focused rerun of typecheck and the relevant UI/store/server tests did not surface any additional open findings in this review slice.

| Status | Count |
|--------|-------|
| Findings | `0` |
| Resolved | `2` |

### Status updates

- `B8-01` Resolved — the `Clear all` properties action now clears persisted view properties via the supported `toggleViewDisplayProperty` path instead of trying to push `displayProps` through `updateViewConfig`.
- `B8-02` Resolved — `planning` is now included in the project status order/color maps and in the client/server project update patch types, so the branch-current status model is consistent again.

### Findings

No new findings in this turn.

### Recommendations

1. No open findings remain in this review slice after the property-popover and project-status fixes.

### Verification

- `pnpm typecheck`
- `pnpm test -- tests/components/create-dialogs.test.tsx tests/components/views-screen.test.tsx tests/components/project-detail-screen.test.tsx tests/lib/store/view-slice.test.ts tests/lib/store/work-item-actions.test.ts tests/lib/domain/workspace-search.test.ts tests/electron/runtime-config.test.ts tests/convex/document-handlers.test.ts`
