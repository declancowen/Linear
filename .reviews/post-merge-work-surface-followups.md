# Post-Merge Work Surface Follow-ups

## Scope

- legacy workspace/team edit gating for existing short or blank values
- row/card inline property rendering for empty assignee/project values
- grouped `Add item` defaults for parent-based lanes
- Electron workspace-project routing and native update menu feedback
- channel post/comment delete affordances and idempotent delete contracts
- filtered grouped work lanes, hidden scrollbars that preserve scrolling, and inbox split behavior

## Review Loop

### Turn 1

Reviewed the local diff with an architecture-first pass over the affected families.

Resolved:

- workspace branding updates now allow empty descriptions on edit paths while create remains strict
- team detail updates now allow empty summaries on edit paths while create remains strict
- empty inline assignee/project pills are hidden on editable surfaces
- parent-grouped lane create flows now derive `parentId` from the lane identity instead of the first child row

Open findings from this turn:

- nested parent grouping/subgrouping still preferred the broader parent for `initialType`

### Turn 2

Re-reviewed the lane-default family after the first fix.

Resolved:

- subgroup parent lanes now override broader group parents for `initialType`
- explicit project defaults from grouped lanes are preserved in the create dialog even when a parent is preselected
- parent options now preserve the preselected parent even when the explicit lane project differs from the parent project
- non-project lane flows still inherit the parent project when no explicit lane project default is present

### Turn 3

Re-reviewed the branch after the next diff-review / architecture pass.

Resolved:

- team settings now passes relaxed edit-time summary constraints through the settings-screen `TeamEditorFields`, so the field-level validation UI matches the save guard
- parent-lane default resolution is now scoped to the active team, preventing duplicate `key · title` parents from another team from hijacking create defaults

Verification rerun:

- `pnpm exec tsc --noEmit --pretty false`
- `pnpm exec vitest run tests/components/work-surface-view.test.tsx tests/components/create-dialogs.test.tsx tests/app/api/workspace-profile-route-contracts.test.ts tests/app/api/team-collaboration-route-contracts.test.ts tests/lib/store/workspace-slice.test.ts`

### Turn 4

Re-reviewed the inline property control family after the child-row regression report.

Resolved:

- empty assignee/project controls remain hidden on list and board surface rows
- editable child rows now keep the dashed empty assignee/project controls so users can set those properties inline from the work item detail surface

Verification rerun:

- `pnpm exec tsc --noEmit --pretty false`
- `pnpm exec vitest run tests/components/work-item-detail-screen.test.tsx tests/components/work-surface-view.test.tsx tests/components/create-dialogs.test.tsx tests/app/api/workspace-profile-route-contracts.test.ts tests/app/api/team-collaboration-route-contracts.test.ts tests/lib/store/workspace-slice.test.ts`

### Turn 5

Re-reviewed the private-task create dialog destination fix with architecture standards.

Resolved:

- private-task create dialogs now expose `Private tasks` as the selected destination instead of showing the backing team-space name
- selecting `Private tasks` clears team-only project, parent, and label state and submits with `visibility: "private"`
- switching from a private-task dialog back to a team-space destination submits with `visibility: "team"` and lets the destination team choose its own valid work-item type defaults
- switching from a private-task dialog to a team destination no longer treats the private-only `primaryProjectId: null` as a team-mode project override, so parent project inheritance is restored
- the shared team-space crumb picker keeps its original defaults while allowing destination-specific copy for the work-item create dialog

Verification rerun:

- `pnpm test tests/components/create-dialogs.test.tsx`
- `pnpm exec eslint components/app/screens/create-work-item-dialog.tsx components/app/screens/team-space-crumb-picker.tsx tests/components/create-dialogs.test.tsx --max-warnings 0`
- `pnpm typecheck`
- `git diff --check`
- `pnpm fallow:gate` partially passed: dead-code and health passed; duplication failed on 8 existing clone groups that do not touch changed files. The branch-introduced create-dialog test duplicate was removed before this rerun.

### Turn 6

Re-reviewed the current uncommitted follow-up batch with architecture standards after the latest desktop, channel, inbox, and grouped-board reports.

Resolved:

- Electron workspace project collection routes now stay on the projects surface instead of being parsed as a project detail id, while `/workspace/projects/:projectId` still opens project detail.
- the packaged Electron renderer now mounts the desktop update controller, so native update menu events can reach the app modal layer.
- the macOS update menu now exposes one stateful action at a time: `Check for Updates...`, `Download Update`, or `Restart to Update`.
- forced native update checks now open the app dialog for latest-version, update-available, downloaded, unavailable, and error states instead of relying only on passive toasts.
- channel post deletion now uses a direct trash action instead of an overflow dropdown that could render in the wrong place.
- channel post/comment delete routes now preflight ownership from the read model and treat already-deleted records as idempotent success; Convex handlers mirror that idempotency and clean up owned orphan comments when the parent post has already gone.
- grouped work surfaces preserve group lanes/add buttons from the source item set when filters hide every visible item.
- hidden scrollbars continue to keep Radix scroll primitives mounted, preserving scroll behavior while hiding the scrollbar chrome.
- inbox defaults to a 50/50 split, can snap/reset back to 50/50, and aligns the detail body with the notification title/icon.
- app icon assets were regenerated from the grey target/work-item mark for the Mac/download icon path.

Reviewed architecture boundaries:

- desktop route parsing remains owned by `desktop/renderer/desktop-route.tsx`, with regression coverage for collection and detail variants.
- update menu state remains owned by `electron/desktop-updates.cjs`/`electron/main.cjs`; renderer feedback stays in `DesktopUpdateController`.
- delete authority remains server/Convex-owned; the UI only invokes the delete action and the API/Convex boundaries enforce ownership/idempotency.
- grouped lane semantics remain in the domain selector, not in list/board/timeline/calendar view components.
- private task visibility still follows the existing personal-work invariant: private work is visible when created by or assigned to the current user. The live `declan@cowen.co` Convex check showed private tasks under that user, while the other Declan account had none, so no data-layer rewrite was made in this diff.

Verification rerun:

- `pnpm exec vitest run tests/desktop/desktop-route.test.tsx tests/electron/desktop-updates.test.ts tests/components/desktop-update-controller.test.tsx tests/components/channel-ui.test.tsx tests/app/api/platform-route-contracts.test.ts tests/lib/domain/view-item-level.test.ts tests/components/ui-primitives.test.tsx tests/components/inbox-ui.test.tsx`
- `pnpm typecheck`
- `pnpm lint`
- `git diff --check`
- `pnpm desktop:renderer:smoke`
- `pnpm build`
- `~/.codex/skills/architecture-standards/scripts/architecture-preflight.sh`
- `~/.codex/skills/diff-review/scripts/review-preflight.sh`

Diff-review result:

- No open branch-specific findings remain after the final pass.
- Changed-file Fallow audit passed. The preflight still reports the repo's existing production/full dead-code, health, and duplication advisory inventories; those are not introduced by this diff and remain outside this targeted follow-up batch.

### Turn 7

Ran the final pre-PR diff review before publishing this work.

Outcome:

- no new branch-specific bugs or architecture blockers found
- `git diff --check` passed
- `~/.codex/skills/diff-review/scripts/review-preflight.sh` passed changed-file audit with `complexity=0` and `clone_groups=0`
- the remaining Fallow dead-code/health/duplication lines are the repo's existing advisory inventory, not introduced by this branch

PR target note:

- only `origin` is configured for this checkout (`declancowen/Linear`)
- the PR should target `origin/main`, not an upstream remote

## Verification

- `pnpm exec tsc --noEmit --pretty false`
- `pnpm exec vitest run tests/components/create-dialogs.test.tsx tests/components/work-surface-view.test.tsx tests/app/api/workspace-profile-route-contracts.test.ts tests/app/api/team-collaboration-route-contracts.test.ts tests/lib/store/workspace-slice.test.ts`

## Outcome

No open findings remain from the final local diff review.

### Turn 8

Reviewed the direct-main follow-up for create-modal positioning, fixed-width work toolbar controls, the web Mac download icon, Electron minimum width, and the `0.0.8` desktop release bump.

Outcome:

- no new branch-specific bugs or architecture blockers found
- create/project/view dialogs now share the search modal vertical start point
- shared work-view chips and view tabs no longer shrink, and toolbar right action groups keep the `New` button stable
- Electron minimum width now matches the non-wrapping toolbar constraint
- the web `Download desktop app` CTA uses the Apple logo icon through the existing Phosphor icon boundary
- tracked duplicate/copy-suffix file scan found no true `* 2.*` source files; three ignored local duplicate artifacts were removed from the worktree (`tsconfig 2.tsbuildinfo`, `.tools/certs/partykit-local-cert 2.pem`, `.tools/certs/partykit-local-key 2.pem`)

Verification rerun:

- `pnpm exec vitest run tests/components/group-chip-popover.test.tsx tests/components/properties-chip-popover.test.tsx`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `git diff --check`
- `~/.codex/skills/diff-review/scripts/review-preflight.sh`

Diff-review result:

- No open findings remain for this direct-main release follow-up.
- Changed-file Fallow audit passed. Existing production/full analyzer advisory inventories remain unrelated to this diff.

### Turn 9

Reviewed the final direct-main channel follow-up before rebuilding and releasing `0.0.8`.

Outcome:

- no new branch-specific bugs found
- channel comment deletion now matches channel post deletion by opening the shared destructive confirmation dialog before invoking the store delete action
- the delete authority and idempotent server path remain unchanged; only the UI confirmation gate moved

Verification rerun:

- `pnpm exec vitest run tests/components/channel-ui.test.tsx tests/components/group-chip-popover.test.tsx tests/components/properties-chip-popover.test.tsx`
- `pnpm exec eslint components/app/collaboration-screens/channel-ui.tsx tests/components/channel-ui.test.tsx components/app/shell.tsx components/app/screens/work-surface-controls.tsx components/ui/template-primitives.tsx components/app/screens/work-surface.tsx components/app/screens/project-detail-screen.tsx components/app/screens.tsx tests/components/group-chip-popover.test.tsx --max-warnings 0`
- `pnpm typecheck`
- `pnpm build`

Diff-review result:

- No open findings remain for the channel comment-confirmation follow-up.

### Turn 10

Deep-reviewed the work-view consistency follow-up after the filter dropdown and parent/child display regressions.

Outcome:

- no open Critical/High findings remain after the loop
- grouped property include/exclude now lives in the Filter dropdown, not board/list headers, and updates `hiddenState` instead of item filters
- the dropdown keeps optimistic hidden-state while open, so a fast second click advances from include-only to excluded/X without waiting for the saved view to rerender
- board/list hidden group rails no longer render the filter X affordance
- parent-level `showChildItems` now keeps eligible children in `buildWorkViewModel().scopedSourceItems`, while `matchedItems` remains the selected parent/container level
- parent-grouped boards now materialize child cards inside promoted parent lanes when child display is enabled
- no-group board/list views keep parents as expandable cards/rows under the neutral all bucket instead of promoting parent rows into grouping headers
- project item views now use the shared work-view model, so child source materialization and group visibility semantics match team and My Items surfaces

Architecture pass:

- Domain selector ownership was rechecked: `lib/domain/selectors-internal/work-items.ts` owns matched items, visible group items, scoped child source items, and group visibility semantics.
- View controls own view-config mutations only: filter dropdown property include/exclude writes `hiddenState`, while normal non-grouping rows still use persisted item filters.
- Board/list renderers own only presentation: they consume `items` plus `scopedItems` and decide card/row disclosure, without reimplementing item-level or filter eligibility.
- Project and general work surfaces now share `buildWorkViewModel` for the same matrix of `itemLevel`, `showChildItems`, grouping, filters, private/team scope, and parent grouping.

Resolved during the loop:

- Fallow duplication initially failed on newly added work-surface component tests. The repeated parent/child issue setup was extracted into test-local helpers, and the duplication gate then passed at `0/0`.

Verification rerun:

- `pnpm exec vitest run tests/components/group-chip-popover.test.tsx tests/components/work-surface-view.test.tsx tests/lib/domain/view-item-level.test.ts`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm fallow:gate`
- `git diff --check`
- `~/.codex/skills/diff-review/scripts/review-preflight.sh`

Diff-review result:

- Deep correctness/safety pass: no remaining branch-specific bug found in the filter dropdown property-visibility path or the parent/no-group child display path.
- Maintainability/structure pass: no open blocker after extracting the duplicated regression-test setup.
- Residual risk: browser verification on a logged-in production-backed workspace is still the best final confidence check for the live data matrix, but the code-level invariants now have focused domain and component coverage.

### Turn 11

Deep-reviewed the follow-up slice for the corrected Filter dropdown click contract and the no-group board/list rendering contract.

Outcome:

- no open Critical/High findings remain after the loop
- Filter dropdown property rows now use the requested state machine: first click applies the include filter/tick, second click removes that include and writes excluded property visibility/X, and excluded rows cycle back to normal
- the X affordance stays inside the Filter dropdown row only; board/list cards, rows, group headers, and hidden rails do not expose it
- fast second clicks are handled with optimistic filter and hidden-state state while the popover remains open
- `Group: None` no longer renders a visible `All` group/header/container in board or list mode
- no-group board/list views still use the same item-lane renderers as grouped views, so parent rows/cards remain expandable and child items render from the shared child-display path

Architecture pass:

- Control ownership: include-only state remains an item filter in `view.filters`; excluded/X state is a view property-visibility change in `hiddenState.groups`.
- Domain ownership: `lib/domain/types-internal/primitives.ts` owns hidden-state normalization and the direct excluded-state helper, avoiding UI-local persistence shapes.
- Presentation ownership: `components/app/screens/work-surface-view.tsx` only decides whether a visible group container is drawn. The internal grouping bucket remains available for sorting/drop calculations, but no fake `All` group is rendered when `view.grouping` is `null`.
- Structural prevention: board/list lane rendering now shares owner-local lane and subgroup section components. Fallow initially caught clone debt; the implementation was refactored until duplication returned to `0/0`.

Verification rerun:

- `pnpm exec vitest run tests/components/group-chip-popover.test.tsx tests/components/work-surface-view.test.tsx tests/lib/domain/view-item-level.test.ts tests/lib/domain/view-config-contract.test.ts`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm fallow:gate`
- `git diff --check`
- `~/.codex/skills/diff-review/scripts/review-preflight.sh`
- Local prod-backed reachability: `curl http://127.0.0.1:3000/login` returned `200`

Diff-review result:

- Deep correctness/safety pass: no remaining branch-specific bug found in the corrected filter row state machine, no-group visual rendering, or parent/child expansion paths covered by the focused tests.
- Maintainability/structure pass: no open blocker after extracting lane controls, shared subgroup sections, and shared board/list lane components.
- Residual risk: authenticated browser smoke against live board data was not completed because no direct Browser MCP tool is exposed and Playwright is not installed in the workspace. Hidden group state also remains value-based rather than field-scoped, so duplicate property display values can still collide across group fields; that is existing compatibility debt in the persisted `hiddenState` model and should be handled by a field-scoped visibility-state migration if it becomes a product requirement.

### Turn 12

Deep-reviewed the no-group lane alignment follow-up after the request to avoid a fake full-width group while keeping chevrons/control affordances aligned.

Outcome:

- no open Critical/High findings remain after the loop
- no-group board rendering now uses a wider neutral lane instead of a grouped column or full-width fake group container
- no-group list rows keep the disclosure/chevron gutter but no longer reserve grouped-only blank selection indentation when there is no selection control
- no-group Add item uses the same row-control alignment grid as the item rows, while grouped Add item keeps the existing grouped lane indent
- the no-group parent/child expansion path remains covered by board and list regression tests, including the absence of a visible `All` group

Architecture pass:

- Presentation ownership stays in `components/app/screens/work-surface-view.tsx`: grouped and no-group lanes share row/card lane renderers, and only the outer no-group visual container/alignment differs.
- View model ownership remains unchanged: `items`, `scopedItems`, `showChildItems`, filters, hidden groups, and parent eligibility are still supplied by the shared work-view model and domain selectors.
- The new alignment branch is explicit on the lane component contract (`addButtonAlignment`, `reserveSelectionSlot`) instead of inferring layout from unrelated group state inside row bodies.

Verification rerun:

- `pnpm typecheck`
- `pnpm exec vitest run tests/components/work-surface-view.test.tsx`
- `pnpm lint`
- `pnpm fallow:gate`
- `git diff --check`

Diff-review result:

- Deep correctness/safety pass: no remaining branch-specific bug found in the no-group board/list alignment changes or the Add item alignment path.
- Maintainability/structure pass: no open blocker; the change is localized to lane presentation props and one focused regression test.

### Turn 13

Deep-reviewed the no-group list compact-gutter follow-up after visual feedback showed rows still looked too indented once the visible group container was removed.

Outcome:

- no open Critical/High findings remain after the loop
- grouped list rows keep their existing grouped-lane gutter and `Add item` indentation
- no-group list rows now use an explicit compact row alignment: `0px` base padding, tighter row gap, retained disclosure/chevron slot, and the same selection slot when editable
- no-group `Add item` now uses the same compact gutter as no-group rows instead of inheriting grouped-lane spacing
- the existing no-group parent/child expansion behavior remains unchanged

Architecture pass:

- Presentation ownership remains local to `components/app/screens/work-surface-view.tsx`; no domain selector or view-model behavior changed for this visual correction.
- The alignment difference is expressed as explicit lane/row props (`rowAlignment`, `addButtonAlignment`) instead of coupling row spacing to ad hoc checks inside the row body.
- Grouped and no-group modes still share the same row renderer, with only the gutter constants varied by the lane contract.

Verification rerun:

- `pnpm typecheck`
- `pnpm exec vitest run tests/components/work-surface-view.test.tsx`
- `pnpm lint`
- `pnpm fallow:gate`
- `git diff --check`
- `~/.codex/skills/diff-review/scripts/review-preflight.sh`
- Local server reachability: `curl -I --max-time 5 http://127.0.0.1:3000/login` returned `200`

Diff-review result:

- Deep correctness/safety pass: no remaining branch-specific bug found in compact no-group gutter handling.
- Maintainability/structure pass: no open blocker; the row/add-item alignment variant is narrow and covered by the focused component regression.
- Verification caveat: authenticated browser screenshot automation was unavailable because no Browser MCP tool is exposed and `playwright` is not installed in the workspace. Programmatic server reachability and component-level layout assertions passed.
- Local cleanup note: untracked duplicate conflict copies named like `* 2.ts` / `* 2.test.ts` were moved out of the repo to `/tmp/linear-conflict-copies-20260605` so TypeScript and Fallow analyze only canonical source files.

### Turn 14

Deep-reviewed the corrected no-group list alignment after clarification that the chevron/disclosure column must not move.

Outcome:

- no open Critical/High findings remain after the loop
- the no-group row gutter now uses the same base padding and gap as grouped rows, so chevrons keep their original position
- no-group row selection is no longer an inline width-reserving column; it overlays in the gutter on hover/selection, allowing the ID/title/properties lane to start closer to the grouped header content width
- no-group `Add item` keeps the same chevron gutter and aligns its label lane with the no-group row content instead of using the grouped `pl-[45px]` indent
- grouped rows and grouped `Add item` remain unchanged

Architecture pass:

- Presentation ownership remains local to the list row/lane components.
- The lane contract still carries the mode explicitly via `rowAlignment` and `addButtonAlignment`; no domain/view-model behavior changed.
- Selection behavior remains wired through the existing `WorkItemSelectionController`; only its no-group visual placement changed.

Verification rerun:

- `pnpm typecheck`
- `pnpm exec vitest run tests/components/work-surface-view.test.tsx`
- `pnpm lint`
- `pnpm fallow:gate`
- `git diff --check`

Diff-review result:

- Deep correctness/safety pass: no remaining branch-specific bug found in the corrected no-group chevron/content alignment path.
- Maintainability/structure pass: no open blocker; the change is isolated to no-group row presentation and its focused regression assertion.

### Turn 15

Final release validation pass for the work-view consistency release.

Resolved:

- normalized all accidental extensionless TypeScript/TSX conflict artifacts before release validation, including files that Turbopack would resolve before canonical `.ts`/`.tsx` paths
- restored the no-group list `Add item` regression assertion after file normalization
- bumped the app version to `0.0.28`
- removed the locally generated `electron/app-icon.ico` artifact from commit scope

Verification rerun:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm fallow:gate`
- `pnpm exec vitest run tests/components/work-surface-view.test.tsx`
- `pnpm test`
- `pnpm build`
- `git diff --check`
- source artifact sweep for extensionless TS/TSX files and duplicate `* 2` files
- `~/.codex/skills/diff-review/scripts/review-preflight.sh`

Release note:

- Local `pnpm desktop:release:all` was blocked by missing Apple notarization/signing credentials, as expected for public desktop releases.
- The repository-owned `.github/workflows/desktop-release.yml` workflow is the correct GitHub release path because it uses repository secrets for macOS signing/notarization and publishes the desktop release assets.
