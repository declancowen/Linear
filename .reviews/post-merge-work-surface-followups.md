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
