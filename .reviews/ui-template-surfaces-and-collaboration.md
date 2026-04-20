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
- `components/app/screens/create-view-dialog.tsx` — saved-view draft routing and scope derivation
- `components/app/screens/work-surface-controls.tsx` — persisted view chip controls and property popovers
- `components/app/screens.tsx` — workspace/team saved-view directory actions
- `components/app/screens/entity-context-menus.tsx` — per-view mutation authorization
- `lib/domain/selectors-internal/content.ts` — view authorization selectors for mixed-scope directories
- `lib/domain/default-views.ts` — canonical saved-view identity and route helpers
- `lib/store/app-store-internal/slices/views.ts` — optimistic saved-view creation and mutation gates
- `lib/date-input.ts` — calendar-date parsing and chip-label formatting for date input values
- `components/ui/collapsible-right-sidebar.tsx` — sidebar mount/unmount behavior
- `lib/convex/client/work.ts` — project update route contract typing
- `lib/server/convex/teams-projects.ts` — project update server contract typing
- `tests/components/create-dialogs.test.tsx` — create-view route derivation regression coverage
- `tests/components/entity-context-menus.test.tsx` — per-view saved-view mutation authorization coverage
- `tests/components/work-item-detail-screen.test.tsx` — main activity timeline and sidebar regression coverage
- `tests/components/work-surface.test.tsx` — non-persisted view compatibility fallback coverage
- `tests/lib/store/view-slice.test.ts` — optimistic saved-view creation regression coverage
- `tests/lib/domain/default-views.test.ts` — canonical system-view identity coverage
- `tests/lib/date-input.test.ts` — date-only input formatting regression coverage
- `templates/*.html`, `templates/*.js`, `templates/*.css` — imported HTML/CSS reference assets, including duplicate `* 2.*` copies

## Review status (updated every turn)

| Field | Value |
|-------|-------|
| **Review started** | `2026-04-19 18:41:21 BST` |
| **Last reviewed** | `2026-04-20 15:43:34 BST` |
| **Total turns** | `17` |
| **Open findings** | `0` |
| **Resolved findings** | `26` |
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

---

## Turn 10 — 2026-04-20 13:57:00 BST

| Field | Value |
|-------|-------|
| **Commit** | `e318e54` |
| **IDE / Agent** | `unknown` |

**Summary:** The next review pass turns up five branch-current bugs. Three are boundary issues where local UI compatibility or page-level assumptions are being persisted across shared view state and permissions. One is an async stale-closure bug in the new detail-sidebar label flow. The last is a remaining dead control in the board column header. Several other reports in this batch are stale against the current tree, duplicate prior findings, or better treated as observations rather than blockers.

| Status | Count |
|--------|-------|
| Findings | `5` |

### Findings

#### B10-01 [BUG] High — `components/app/screens/work-surface.tsx:99` — Surface-level grouping compatibility is being persisted back into saved shared views

**What's happening:**
The work-surface effect auto-corrects `grouping` and `subGrouping` when the current team experience does not allow the saved values, but it does so by calling `updateViewConfig(activeView.id, ...)` directly.

**Root cause:**
The compatibility adjustment is implemented as a store mutation instead of a local presentation fallback. That mixes a view-render concern with persisted shared configuration.

**Codebase implication:**
Opening a saved view in a context that excludes `epic`/`feature` can silently overwrite the shared saved view to `status`, permanently changing what other users see and what the original author sees when they return to a compatible context.

**Solution options:**
1. **Quick fix:** Derive a local corrected view object for rendering and keep the persisted store record untouched.
2. **Proper fix:** Model capability compatibility explicitly in the view layer so render-time fallback and persisted configuration remain separate concerns everywhere.

**Investigate:**
Any other auto-correction path that writes compatibility fallbacks back into persisted view state should be treated with the same suspicion.

> The persistence bug is in `work-surface.tsx:99-125`.

#### B10-02 [BUG] High — `components/app/screens/create-view-dialog.tsx:294` — Caller-supplied route survives scope changes and can become invalid for the selected view scope

**What's happening:**
The dialog keeps preferring `dialog.defaultRoute` whenever no project is selected, even after the user switches the effective scope.

**Root cause:**
Route derivation is split between caller-provided seed data and dialog-owned scope state, but the dialog never re-validates that seed against the current scope/entity pair.

**Codebase implication:**
From workspace-level project surfaces this can produce a team-scoped create payload with a workspace route, which passes optimistic local creation and then fails server-side as an invalid route/scope combination. It is a contract drift bug between UI state, store create logic, and the route validator.

**Solution options:**
1. **Quick fix:** Only retain `defaultRoute` while it is still valid for the current effective scope and entity kind; otherwise derive a fresh route from the active scope.
2. **Proper fix:** Treat `defaultRoute` as an initial hint only and centralize all final route derivation inside the dialog from effective scope/project state.

**Investigate:**
Check every create-view entrypoint that passes `defaultRoute` without locking scope. The invariant should be that final route derivation always happens from current dialog state, not caller state.

> The route mismatch starts at `create-view-dialog.tsx:294-304`.

#### B10-03 [BUG] High — `components/app/screens.tsx:600` — Workspace view directories still gate mutations with a page-level editable flag instead of the view’s actual scope

**What's happening:**
The workspace saved-views directory renders team-scoped and workspace-scoped views together, but each `ViewContextMenu` still receives the same page-level `editable` flag.

**Root cause:**
Mutation rights are being inferred from the page container instead of the resource being mutated.

**Codebase implication:**
Users with writable workspace access but read-only membership in a particular team can still see rename/delete affordances for that team’s view from the workspace directory, only to fail when the server correctly enforces team edit access. That is a broken authorization boundary in the UI layer.

**Solution options:**
1. **Quick fix:** Derive view mutation permissions per view scope before rendering the context menu.
2. **Proper fix:** Move the permission derivation into `ViewContextMenu` itself so action affordances are always keyed off the view resource, not off whichever page embedded it.

**Investigate:**
Search for any other shared action menu that takes a page-level `editable` boolean while rendering mixed-scope resources.

> The mixed-scope directory usage is at `screens.tsx:599-600`, and the menu currently trusts the caller in `entity-context-menus.tsx:130-149`.

#### B10-04 [BUG] Medium — `components/app/screens/work-item-detail-screen.tsx:425` — Label creation in the detail sidebar can restore stale label ids after async completion

**What's happening:**
`handleCreateLabel()` awaits `createLabel()` and then appends the new id to `item.labelIds` captured from the render-time closure.

**Root cause:**
The follow-up update is composed from stale component state instead of re-reading the current label ids from the store after the async boundary.

**Codebase implication:**
If the user toggles labels while the create request is in flight, the final `updateWorkItem()` call can reintroduce labels that were intentionally removed or drop labels added by another interaction. This is a classic stale-closure write-after-async bug.

**Solution options:**
1. **Quick fix:** Re-read the current item from the store after `await createLabel(...)` and build the next label list from live state.
2. **Proper fix:** Move “create label and attach to item” into a single store action so the read-modify-write sequence is centralized and atomic from the UI’s point of view.

**Investigate:**
Any async UI flow that awaits entity creation and then patches a parent entity with closed-over arrays should be checked for the same race.

> The stale follow-up write is in `work-item-detail-screen.tsx:425-441`.

#### B10-05 [BUG] Low — `components/app/screens/work-surface-view.tsx:1015` — Board column overflow button is still rendered as an interactive control with no behavior

**What's happening:**
The column header still renders a `DotsThree` button styled as a live control, but it has no click behavior.

**Root cause:**
Template chrome remains in the board header without an implemented overflow action behind it.

**Codebase implication:**
This is a small but repeated dead affordance on every board column. It also undercuts the earlier cleanup work that removed unsupported controls from other primary surfaces.

**Solution options:**
1. **Quick fix:** Remove the button until a real overflow action exists.
2. **Proper fix:** Wire it to a concrete column actions menu once there is real behavior to expose.

**Investigate:**
Treat the board surface consistently with the prior dead-affordance cleanup: unsupported controls should disappear rather than remain decorative.

> The dead button is in `work-surface-view.tsx:1015-1020`.

### Notes on reviewed-but-not-promoted reports

- The due-date placeholder regression, label-color hashing, template-only CSS variable leaks, full-card drag target, detail-sidebar `dangerouslySetInnerHTML`, plain-text comment rendering, and textarea composer reports are stale against the current branch.
- The second `DotsThree` report is a duplicate of `B10-05`.
- The progress-bar layering and naming comments, sidebar child unmounting, resize-handle width, `dt`/`dd` structural requirement, manual hook dependency lists, and `today` capture in `ProjectBoard` are real observations but not strong enough to promote as blocking defects in this pass.
- `countChildItems()` remains a legitimate scale/performance watchpoint in `work-surface-view.tsx`, but I am treating it as a follow-up optimization unless the current fix pass materially reshapes that rendering path.

### Recommendations

1. **Fix first:** Keep grouping compatibility local in `WorkSurface`, make `CreateViewDialog` derive a route from effective scope, and move view mutation permission checks to the resource boundary.
2. **Then fix:** Re-read live label ids after async label creation and remove the dead board column button.
3. **After that:** Re-run focused typecheck/tests, append a clean rerun turn, and only then commit the code plus the updated review artifact.

---

## Turn 11 — 2026-04-20 14:21:40 BST

| Field | Value |
|-------|-------|
| **Commit** | `e318e54` |
| **IDE / Agent** | `unknown` |

**Summary:** The five open findings from Turn 10 are resolved in the working tree. Grouping compatibility is now a local render-time fallback in `WorkSurface`, create-view route derivation is recomputed from live dialog scope, saved-view mutation permissions are derived from the view resource rather than the embedding page, async label creation re-reads live label ids before updating the item, and the dead board-column overflow button has been removed. Focused regression tests plus the adjacent screen suites and `pnpm typecheck` all passed on this pass.

| Status | Count |
|--------|-------|
| Findings | `0` |
| Resolved | `5` |

### Status updates

- `B10-01` Resolved — `WorkSurface` now derives a compatibility-corrected local view object for rendering and no longer persists grouping/sub-grouping fallbacks back into shared saved-view state.
- `B10-02` Resolved — `CreateViewDialog` now treats `defaultRoute` as an initial hint only and re-validates it against the current scope/entity pair before reuse; otherwise it derives a fresh route from the active dialog scope.
- `B10-03` Resolved — per-view mutation rights now come from a scope-aware selector keyed off the actual `ViewDefinition`, so mixed workspace/team directories no longer leak rename/delete affordances across authorization boundaries.
- `B10-04` Resolved — detail-sidebar label creation now re-reads the current work item from store state after the async `createLabel()` boundary before composing the follow-up `labelIds` patch.
- `B10-05` Resolved — the unsupported `DotsThree` board-column control has been removed rather than left as a dead affordance.

### Findings

No new findings in this turn.

### Recommendations

1. No open findings remain in this review slice after the Turn 10 fixes and rerun.
2. Keep `countChildItems()` and the collection-board progress-bar naming/layering notes as follow-up watchpoints, not blockers, unless a later pass materially expands those surfaces.

### Verification

- `pnpm vitest run tests/components/create-dialogs.test.tsx`
- `pnpm vitest run tests/components/entity-context-menus.test.tsx`
- `pnpm vitest run tests/components/work-surface.test.tsx`
- `pnpm vitest run tests/components/views-screen.test.tsx`
- `pnpm vitest run tests/components/project-detail-screen.test.tsx tests/components/work-item-detail-screen.test.tsx`
- `pnpm typecheck`

---

## Turn 12 — 2026-04-20 14:55:46 BST

| Field | Value |
|-------|-------|
| **Commit** | `fe23583` |
| **IDE / Agent** | `unknown` |

**Summary:** This rerun surfaces three live issues in the branch-current tree. One is a presentation-boundary bug where `WorkSurface` renders a second empty state below view-owned empty content. One is a state-shape bug where optimistic saved-view creation drops validated container metadata for project-scoped item views. The last is a resource-identity bug: system-view protection is still keyed off labels/routes instead of canonical ids, which can freeze custom views that happen to reuse names like `All work` or `All projects`.

| Status | Count |
|--------|-------|
| Findings | `3` |

### Findings

#### B12-01 [BUG] Medium — `components/app/screens/work-surface.tsx:254` — WorkSurface renders a duplicate empty state below view-owned empty layouts

**What's happening:**
When an active view exists and `visibleItems` is empty, `WorkSurface` still renders a standalone centered `emptyLabel` block below the active layout.

**Root cause:**
The surface shell is trying to own empty-state presentation even though the active board/list layouts already render their own empty affordances.

**Codebase implication:**
Empty board/list views now show two independent empty states at once: the layout-level placeholder and the extra shell-level message below it. This mixes concerns between the shell and the view implementation and produces visibly duplicated empty UI.

**Solution options:**
1. **Quick fix:** Remove the shell-level empty block for active views.
2. **Proper fix:** Make each layout own its own empty state and keep `WorkSurface` responsible only for the no-active-view case.

**Investigate:**
If timeline needs a dedicated empty message, add it inside `TimelineView` rather than keeping a generic shell-level fallback for all layouts.

> The duplicate shell-level empty block is at `work-surface.tsx:254-258`.

#### B12-02 [BUG] High — `lib/store/app-store-internal/slices/views.ts:98` — Optimistic createView drops validated container metadata

**What's happening:**
`createView()` validates `containerType` and `containerId` through `viewSchema`, but the optimistic `createViewDefinition(...)` call omits both fields when constructing the local view object.

**Root cause:**
The optimistic state path reconstructs the `ViewDefinition` from a partial subset of validated input instead of carrying the full persisted identity/placement fields forward.

**Codebase implication:**
Newly created project-item views are temporarily misclassified as top-level saved views until a refresh arrives from the server. Anything that relies on `containerType/containerId` in local state can show the wrong UI immediately after creation.

**Solution options:**
1. **Quick fix:** Thread `containerType` and `containerId` into the optimistic `createViewDefinition(...)` call.
2. **Proper fix:** Centralize optimistic view construction so it mirrors the validated create contract instead of hand-selecting fields at each callsite.

**Investigate:**
Check other optimistic entity creation flows for the same pattern: validated transport fields being silently dropped in the local reconstruction step.

> The optimistic reconstruction currently omits container metadata at `views.ts:98-116`.

#### B12-03 [BUG] High — `lib/domain/default-views.ts:363` — System-view protection still depends on mutable labels and routes

**What's happening:**
`isSystemView(...)` still treats any matching name/route pair like `All work`, `Active`, `Backlog`, or `All projects` as a built-in system view.

**Root cause:**
Protection logic is keyed off presentation labels and routes instead of stable canonical identity.

**Codebase implication:**
A user-created view that legitimately reuses one of the canonical names on a matching route becomes undeletable and unrenamable because both the menu layer and the local mutation guards treat it as a system view even though it is not one of the canonical defaults.

**Solution options:**
1. **Quick fix:** Identify system views by canonical ids generated by the default-view builders.
2. **Proper fix:** Model built-in/default status explicitly in view data instead of inferring it from display labels.

**Investigate:**
Any other logic that infers resource identity from names should be treated similarly; labels are presentation, not authority.

> The label/route-based classification is at `default-views.ts:363-382`.

### Notes on reviewed-but-not-promoted reports

- The grouping-persistence bug, due-date grid placeholder regression, whole-card drag target, label-color hashing, CSS token leaks, sidebar XSS path, dead board-column button, and async label-id race reports are stale against the current tree; they were fixed in earlier passes and remain fixed.
- The project progress-bar naming/layering comments remain valid observations, but I am still treating them as follow-up clarity work rather than release-blocking defects.
- The `CreateViewDialog` workspace-scope fallback for top-level item views is still branch-current behavior and is covered by existing tests; I am treating that as an intentional product behavior for this branch unless we explicitly choose to reopen workspace item-view support as a separate change.
- `CollapsibleRightSidebar` unmounting children, the shell resize-handle width, and the `countChildItems()` O(N²) path remain watchpoints rather than blockers in this rerun.

### Recommendations

1. **Fix first:** Remove the duplicate `WorkSurface` empty state, preserve container metadata in optimistic saved-view creation, and move system-view detection onto canonical ids.
2. **Then rerun:** Exercise `WorkSurface`, saved-view menu flows, view-slice optimistic creation, and the adjacent screen suites before committing.

---

## Turn 13 — 2026-04-20 14:55:46 BST

| Field | Value |
|-------|-------|
| **Commit** | `fe23583` |
| **IDE / Agent** | `unknown` |

**Summary:** The three Turn 12 findings are resolved in the working tree. `WorkSurface` no longer appends a second shell-level empty state under empty layouts, optimistic `createView` now preserves `containerType/containerId`, and system-view protection now keys off canonical built-in ids rather than mutable labels. A small follow-on cleanup also removed the now-misleading `editable` prop from `ViewContextMenu` and its callers. Focused regression tests plus adjacent screen suites and `pnpm typecheck` all passed.

| Status | Count |
|--------|-------|
| Findings | `0` |
| Resolved | `3` |

### Status updates

- `B12-01` Resolved — the shell-level empty-state block for active views was removed from `WorkSurface`, so empty board/list layouts no longer show a duplicate message below their own empty affordances.
- `B12-02` Resolved — optimistic saved-view creation now carries validated `containerType` and `containerId` into `createViewDefinition(...)`, preserving project-view placement in local state before the server round-trip completes.
- `B12-03` Resolved — `isSystemView(...)` now recognizes only canonical built-in ids, so custom views that reuse labels like `All work` or `All projects` remain renameable and deletable.

### Findings

No new findings in this turn.

### Recommendations

1. No open findings remain in this review slice after the Turn 12 fixes and rerun.
2. Leave the progress-bar naming/layering notes, workspace item-view scope behavior, sidebar unmount tradeoff, and `countChildItems()` scale path as follow-up review topics rather than blockers for this pass.

### Verification

- `pnpm vitest run tests/components/work-surface.test.tsx`
- `pnpm vitest run tests/components/entity-context-menus.test.tsx`
- `pnpm vitest run tests/lib/store/view-slice.test.ts tests/lib/domain/default-views.test.ts`
- `pnpm vitest run tests/components/views-screen.test.tsx tests/components/project-detail-screen.test.tsx tests/components/create-dialogs.test.tsx`
- `pnpm typecheck`

---

## Turn 14 — 2026-04-20 15:19:30 BST

| Field | Value |
|-------|-------|
| **Commit** | `14716a7` |
| **IDE / Agent** | `unknown` |

**Summary:** This rerun surfaces two live issues in the branch-current tree. The first is another authorization-boundary leak: workspace project directories can mix workspace and team-scoped projects, but destructive project actions are still gated by one page-level `editable` flag instead of the project’s actual scope. The second is a date-only value handling bug in both creation flows: chip labels format `input[type="date"]` strings through `new Date(value)`, which treats `YYYY-MM-DD` as UTC and can render the prior day in negative UTC offsets.

| Status | Count |
|--------|-------|
| Findings | `2` |

### Findings

#### B14-01 [BUG] Medium — `components/app/screens.tsx:407` — Project mutation affordances still inherit page-level editability in mixed-scope directories

**What's happening:**
Workspace project directories render `ProjectContextMenu` with the page-level `editable` flag even though the directory can include a mix of workspace-scoped projects and team-scoped projects from accessible teams.

**Root cause:**
Mutation authorization is still being decided at the container/page layer instead of at the project resource boundary.

**Codebase implication:**
If a user can edit the workspace directory but only has read-only access in one of the included teams, that team’s projects still show rename/delete actions locally and then fail server-side on mutation. This is the same cross-scope permission leak pattern that previously affected saved views.

**Solution options:**
1. **Quick fix:** Derive a `canMutateProject(data, project)` selector and gate project menu actions off the project’s own scope.
2. **Proper fix:** Remove page-level mutability props from `ProjectContextMenu` entirely so mutation UI can only be authorized from resource-aware selectors.

**Investigate:**
Any other mixed-scope collection surface that passes one `editable` flag into per-entity destructive actions should be reviewed for the same leak.

> The page-level prop flow is visible at `screens.tsx:397-411`, with the destructive gating still inside `entity-context-menus.tsx:212-246`.

#### B14-02 [BUG] Medium — `components/app/screens/create-work-item-dialog.tsx:150` — Date chip labels parse date-input values as UTC instants instead of calendar dates

**What's happening:**
Both create dialogs format `YYYY-MM-DD` values from `input[type="date"]` with `new Date(value)`, then render the chip label from that timestamp.

**Root cause:**
Date-only form values are being coerced through the JavaScript timestamp model instead of being treated as calendar values.

**Codebase implication:**
For users west of UTC, the chip can show one day earlier than the chosen value. That misleads users in the create flow and can push them to compensate manually, resulting in the wrong saved date. The duplication across work-item and project creation also makes future drift more likely.

**Solution options:**
1. **Quick fix:** Parse the `YYYY-MM-DD` string into local calendar parts before formatting.
2. **Proper fix:** Centralize date-input parsing/formatting in a shared helper so date-only values never flow through `new Date(value)` in UI code.

**Investigate:**
Search other create/edit surfaces for `new Date(<date-input-string>)`; any date-only form value should be modeled as a calendar date, not as an instant.

> The duplicated helper lives at `create-work-item-dialog.tsx:150-158` and `project-creation.tsx:137-148`.

### Notes on reviewed-but-not-promoted reports

- The repeated `WorkSurface` duplicate empty-state, grouping-persistence, due-date grid placeholder, full-card drag target, label-color hashing, template-only CSS token leaks, sidebar XSS path, stale label-id append, dead board-column button, and ignored `ViewContextMenu.editable` reports are stale against the current tree; those fixes remain in place.
- The progress-bar layering/naming comments, dialog overlay darkness, sidebar child unmounting, `today` capture, `dt`/`dd` structural requirement, resize-handle width, property clear-all sync pattern, `countChildItems()` scaling path, and duplicated create-effect logic remain valid observations or follow-up refactors, but I am not promoting them as blockers in this pass.
- The workspace item-view scope behavior in `CreateViewDialog` remains branch-current product behavior and is covered by existing tests; I am not reopening that scope decision here.

### Recommendations

1. **Fix first:** Move project mutation rights to a per-project selector and remove the page-level mutability prop from `ProjectContextMenu`.
2. **Then fix:** Replace the duplicated `new Date(value)` chip helpers with a shared date-only formatter/parser.
3. **After that:** Re-run the affected menu/create-dialog suites, add a direct regression test for the date-only helper, and then append a clean rerun turn before committing.

---

## Turn 15 — 2026-04-20 15:19:30 BST

| Field | Value |
|-------|-------|
| **Commit** | `14716a7` |
| **IDE / Agent** | `unknown` |

**Summary:** The two Turn 14 findings are resolved in the working tree. Project rename/delete affordances now derive from each project’s own scope via a shared selector instead of inheriting page-level editability, and both creation dialogs now share a date-only formatting helper that treats `YYYY-MM-DD` values as calendar dates rather than UTC timestamps. Focused regression tests and `pnpm typecheck` passed.

| Status | Count |
|--------|-------|
| Findings | `0` |
| Resolved | `2` |

### Status updates

- `B14-01` Resolved — `ProjectContextMenu` no longer accepts a page-level `editable` prop; it now gates destructive actions through `canMutateProject(data, project)`, and the mixed-scope project directory callers stopped threading container-level mutability into per-project actions.
- `B14-02` Resolved — work-item and project creation now share `lib/date-input.ts`, which parses `YYYY-MM-DD` values as calendar dates and formats chip labels without timezone drift.

### Findings

No new findings in this turn.

### Recommendations

1. No open findings remain from this rerun.
2. Keep the progress-bar semantics note and the broader create-flow cleanup observations as follow-up refactors unless a later pass turns them into user-visible regressions.

### Verification

- `pnpm vitest run tests/components/entity-context-menus.test.tsx`
- `pnpm vitest run tests/components/create-dialogs.test.tsx`
- `pnpm vitest run tests/lib/date-input.test.ts`
- `pnpm vitest run tests/components/views-screen.test.tsx`
- `pnpm typecheck`

---

## Turn 16 — 2026-04-20 15:43:34 BST

| Field | Value |
|-------|-------|
| **Commit** | `352f760` |
| **IDE / Agent** | `unknown` |

**Summary:** This rerun does not reproduce the old product bugs from the pasted list in the current tree. The live failures are verification regressions introduced by the new activity/thread polish and shared level-chip copy changes: the work-item detail test harness no longer mocks the new icon exports used by the activity UI, and the create-dialog tests still assert the old value-only accessible name for the level chip even though the shared control now exposes `Level · <value>`.

| Status | Count |
|--------|-------|
| Findings | `2` |

### Findings

#### B16-01 [BUG] Low — `tests/components/work-item-detail-screen.test.tsx:253` — Work-item detail suite no longer mocks the new activity-thread icon exports

**What's happening:**
`work-item-detail-screen.tsx` now renders `Smiley` and `NotePencil` in the main activity thread and description affordances, but the test mock for `@phosphor-icons/react` still only returns the older icon set.

**Root cause:**
The screen implementation gained new icon dependencies without the test harness being updated alongside the UI change.

**Codebase implication:**
The entire work-item detail screen suite fails before it can exercise any of the real main-section or comment behavior, so it no longer protects the concurrent-edit, mention-delivery, and activity-composer flows it is supposed to cover.

**Solution options:**
1. **Quick fix:** Extend the icon mock with `Smiley` and `NotePencil`.
2. **Proper fix:** Keep the phosphor mock aligned with screen-level imports whenever new icon affordances are introduced in tested surfaces.

**Investigate:**
Any other tests that fully mock `@phosphor-icons/react` should be checked when screen components gain new icon-only affordances; otherwise unrelated suites will fail for harness reasons instead of product reasons.

> The failing harness is in `tests/components/work-item-detail-screen.test.tsx:253-268`.

#### B16-02 [BUG] Low — `tests/components/create-dialogs.test.tsx:441` — Create-dialog tests still assert the old value-only level-chip name

**What's happening:**
The create-dialog suite still looks for a button named `Epic`, but the shared `LevelChipPopover` now renders a labeled control whose accessible name is `Level · Epic`.

**Root cause:**
The verification layer is still coupled to the previous unnamed chip contract even though the shared presentation component now exposes explicit control labeling.

**Codebase implication:**
The item-view create-dialog tests fail even though the UI is rendering the intended control. That blocks verification of the wider create-view flow and obscures real regressions behind stale assertions.

**Solution options:**
1. **Quick fix:** Update the tests to assert the current accessible name.
2. **Proper fix:** When shared control copy changes, audit the tests that intentionally query accessible names so the verification contract evolves with the UI contract.

**Investigate:**
If we later decide that `Level` is the wrong label, change the shared component and the tests together; the important part is that the verification layer should describe the live accessible contract, not an obsolete one.

> The stale assertions are in `tests/components/create-dialogs.test.tsx:441` and `tests/components/create-dialogs.test.tsx:794`.

### Notes on reviewed-but-not-promoted reports

- The repeated pasted reports about grouping persistence, due-date list alignment, full-card drag handles, label colors, CSS tokens, XSS in the sidebar description, duplicate empty states, stale label-id writes, dead board-column controls, and `ViewContextMenu.editable` are stale against the current tree; those fixes remain in place.
- The collection-board progress-bar naming/layering note, dialog overlay opacity, sidebar child unmounting, `today` capture, `dt`/`dd` parent requirement, resize-handle width, `countChildItems()` scale path, and the multi-sync `Clear all` fallback remain follow-up observations rather than blockers in this pass.
- The current unstaged product changes in `work-surface.tsx`, `work-surface-view.tsx`, `work-item-detail-screen.tsx`, and `work-surface-controls.tsx` did not surface new product defects in the focused rerun; the live failures were confined to the verification layer.

### Recommendations

1. **Fix now:** Align the work-item-detail icon mock and the create-dialog accessible-name assertions with the current UI contract.
2. **Then rerun:** Re-exercise the work-item-detail and create-dialog suites plus `pnpm typecheck` before committing the branch state.

---

## Turn 17 — 2026-04-20 15:43:34 BST

| Field | Value |
|-------|-------|
| **Commit** | `352f760` |
| **IDE / Agent** | `unknown` |

**Summary:** The two Turn 16 verification findings are resolved in the working tree. The work-item detail test harness now mocks the icon exports required by the new activity UI, and the create-dialog tests now assert the labeled `Level · <value>` chip contract used by the shared control. Focused reruns of the touched suites and `pnpm typecheck` passed.

| Status | Count |
|--------|-------|
| Findings | `0` |
| Resolved | `2` |

### Status updates

- `B16-01` Resolved — the work-item detail test harness now includes the `Smiley` and `NotePencil` phosphor exports required by the current activity-thread and description affordances.
- `B16-02` Resolved — the create-dialog tests now assert the current labeled level-chip accessibility contract instead of the obsolete value-only `Epic` name.

### Findings

No new findings in this turn.

### Recommendations

1. No open findings remain from this rerun.
2. Keep the collection-board progress semantics note and the other follow-up UI observations as future polish, not blockers for this branch pass.

### Verification

- `pnpm vitest run tests/components/work-surface.test.tsx`
- `pnpm vitest run tests/components/work-item-detail-screen.test.tsx`
- `pnpm vitest run tests/components/create-dialogs.test.tsx`
- `pnpm typecheck`
