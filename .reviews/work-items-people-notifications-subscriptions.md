# Review: Work Items, People, Notifications, And Subscriptions

## Project context

| Field | Value |
|-------|-------|
| **Repository** | Linear |
| **Remote** | https://github.com/declancowen/Linear.git |
| **Branch** | main working tree, to be pushed from feature branch |
| **Stack** | Next.js, React, Convex, Zustand, TypeScript |

## Scope

- Work item subscription/unsubscription API, backend handler, optimistic store action, detail UI, read-model bumps, and subscriber filters.
- Subscriber notification delivery for work item status changes and work item comments, including in-app and email paths.
- Private task creation/update/access semantics, private numbering, team/workspace destructive cleanup paths, and My Items private-task visibility.
- Work item status-change activity persistence and detail read-model delivery.
- Notification inbox read-state reconciliation, message-list presentation, resize-handle affordance, and timestamp containment.
- People workspace surface, profile surface UI, profile activity selectors/read model, hover-card Profile action, and sidebar navigation under the workspace Channel section.
- Workspace/global search user results and profile navigation.
- Work view reset behavior, My Items active/backlog/subscribed defaults, hierarchy filters, and child-item naming.
- Channel post/comment post-creation reliability and optimistic reconciliation.
- Sidebar hover-card containment for shell/surface sidebars.

## Hotspots

- Authorization and tenancy boundaries across workspace, team, private-task, people, search, and channel activity read models.
- Destructive cleanup paths for team/workspace deletion and private-task isolation.
- Optimistic/persisted reconciliation for subscriptions, notifications, channel posts, and view configuration.
- Broad presentation changes in inbox, people/profile, hover cards, work item detail sidebars, and work surfaces.
- Shared selectors and scoped read-model seed paths.

## Review status

| Field | Value |
|-------|-------|
| **Review started** | 2026-05-31 |
| **Last reviewed** | 2026-05-31 18:09 BST |
| **Total turns** | 8 |
| **Open findings** | 0 |
| **Resolved findings** | 9 |
| **Accepted findings** | 0 |

## Turn 8 - 2026-05-31 18:09 BST

| Field | Value |
|-------|-------|
| **Commit** | 21ba8e20 working tree |
| **IDE / Agent** | Codex |

**Summary:** Ran the requested full local-diff deep review against `origin/main`, including the broad People/profile, work item subscription/private-task, notification, search, project/view, desktop route, and Convex backend changes. Fixed two full-suite test reliability findings discovered during the loop, then reran the normal and deep gates until clean.

**Outcome:** all clear after deep review, full-suite verification, and normal re-review; no open findings.

**Risk score:** high - the branch spans backend authorization and mutation paths, scoped read models, notification delivery, private-task isolation, work/project/view presentation, and packaged desktop routing.

**Change archetypes:** full-branch diff review, backend authorization/tenancy, notification delivery, private-task isolation, scoped read models, desktop route parity, frontend presentation, regression test hardening.

**Intended change:** verify every local change against `origin/main`, fix any review findings, and prepare the branch for a non-draft PR.

**Intent vs actual:** matches intent. The full diff was reviewed as the unit of change. The only new findings were test harness issues exposed by full-suite timing and shared fixture state; both were fixed without weakening production assertions.

**Confidence:** high after full suite, static audit, typecheck, lint, production build, and desktop renderer smoke all passed on the latest tree.

**Coverage note:** component, store, Convex, read-model, desktop, build, and full Vitest coverage passed. In-app Browser visual smoke was attempted earlier in the loop but unavailable because the `iab` browser backend was not present in this session.

**Finding triage:**

| Source | Finding | Current status | Bug class | Missed invariant/variant | Action |
|--------|---------|----------------|-----------|--------------------------|--------|
| Full `pnpm test` | Work item detail mention retry test could time out under full-suite load while waiting on external scoped read-model effects unrelated to the seeded editor fixture | resolved | Test reliability / async isolation | Component unit tests with fully seeded local state should not depend on scoped read-model refresh plumbing | Stubbed `useScopedReadModelRefresh` in the work item detail component test so editor/mention assertions own their data boundary |
| Full `pnpm test` | Status-change activity assertion intermittently read shared store state instead of an explicit sidebar-surface fixture | resolved | Test reliability / fixture isolation | Sidebar-surface tests should render from immutable local `AppData` when asserting persisted activity labels | Added `createWorkItemDetailTestData()` and made the status activity test render from a local fixture |

**Static/analyzer evidence:** `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` passed on 88 changed files with 0 dead-code issues, 0 complexity findings, and 0 duplication clone groups. Fallow emitted its known `node_modules directory not found` warning but returned a passing verdict.

**Architecture impact:** no new architecture boundary was introduced during this turn. The fixes tightened test isolation around existing component/read-model boundaries and kept production ownership unchanged.

**Deep-review evidence:** Pass A checked authorization/privacy, subscriber notification fanout, private-task CRUD/comment/tag exclusions, project/view routing, people/profile/read-model access, search user navigation, notification read-state/status labels, desktop people/profile route parity, and project property controls. Pass B checked ownership, dead/legacy logic removal, helper placement, static-analysis output, and cross-surface label consistency. Re-review after fixes found no new issue.

**Bug classes / invariants checked:** private tasks never team-board scoped; private tasks have no comments/tags/subscriptions; subscribers receive work item comment/status notifications; project item routes open scoped project boards; child create shows inherited disabled project; People/profile routes work in web and desktop; user search opens profiles; project properties exclude ID and use Type/Team naming; notification status labels show `To-Do`.

**Branch totality:** the full local diff against `origin/main` was reviewed, including all modified and untracked files. The PR branch will include the review ledger and the new `tests/components/directory-controls.test.tsx` file.

**Sibling closure:** checked adjacent work item create/update/comment/document routes, scoped read-model selectors, private/team/workspace filters, project and view tab logic, people/profile selectors, desktop route definitions, global/workspace search, and project context menus.

**Remediation impact surface:** test-only for this turn. Product/runtime code remained as previously reviewed.

**Residual risk / unknowns:** browser visual smoke remains unavailable in this Codex session due the missing in-app browser backend; build, component tests, route tests, and desktop renderer smoke mitigate the route/layout risk.

### Validation

- `git diff --check -- . ':!.reviews/'` - passed.
- `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` - passed, 88 changed files, 0 dead-code issues, 0 complexity findings, 0 duplication clone groups.
- `pnpm typecheck` - passed.
- `pnpm lint` - passed.
- `pnpm exec vitest run tests/components/create-dialogs.test.tsx tests/components/work-item-detail-screen.test.tsx tests/components/work-item-ui-comments-inline.test.tsx tests/components/views-screen.test.tsx tests/components/project-detail-screen.test.tsx tests/components/people-screen.test.tsx tests/components/directory-controls.test.tsx tests/desktop/desktop-route.test.tsx tests/convex/comment-handlers.test.ts tests/convex/work-item-handlers.test.ts tests/convex/work-helpers.test.ts tests/convex/access.test.ts tests/lib/scoped-read-models.test.ts tests/lib/store/work-item-actions.test.ts tests/lib/store/work-comment-actions.test.ts` - passed, 15 files / 180 tests.
- `pnpm exec vitest run tests/components/work-item-detail-screen.test.tsx` - passed, 29 tests.
- `pnpm test` - passed, 211 files / 1317 tests.
- `pnpm build` - passed.
- `pnpm desktop:renderer:smoke` - passed, desktop renderer build plus 1 file / 9 tests.

### Branch-totality proof

- **Non-delta files/systems re-read:** architecture and diff-review skills, work item detail tests, scoped read-model hook boundary, desktop route tests, People screen tests, Convex access/work-item/comment/document handlers, project/view controls, and search selectors.
- **Prior open findings rechecked:** none open from prior turns.
- **Prior resolved/adjacent areas revalidated:** private-task backend isolation, subscriber notification delivery, project scoped views, People desktop routing, project property labels, notification status labels, and search user profile navigation.
- **Hotspots or sibling paths revisited:** `convex/app/access.ts`, `convex/app/work_item_handlers.ts`, `convex/app/comment_handlers.ts`, `convex/app/document_handlers.ts`, `components/app/screens/work-item-detail-screen.tsx`, `components/app/screens/project-detail-screen.tsx`, `components/app/screens.tsx`, `desktop/renderer/desktop-route.tsx`, and search/read-model selectors.
- **Dependency/adjacent surfaces revalidated:** full test suite, targeted high-risk slice, typecheck, lint, production build, desktop renderer smoke, whitespace check, and Fallow changed-file audit.
- **Why this is enough:** the latest loop found and fixed the only failures produced by full-suite and static gates, then reran the same gates to a clean state on the current tree.

### Challenger pass

- done - assumed the clean targeted slice might be hiding full-suite timing or shared-state issues. Full suite found two such issues; both were fixed with tighter fixture isolation, and the final full-suite run passed.

## Turn 7 - 2026-05-31 12:20 BST

| Field | Value |
|-------|-------|
| **Commit** | cc39a368 working tree |
| **IDE / Agent** | Codex |

**Summary:** Added packaged Electron routing for the workspace People directory and profile pages, changed the People board grid from `auto-fit` to `auto-fill` so short rows keep the current responsive column geometry, and refactored the desktop static-route dispatcher into a route table after deep review caught a Fallow complexity regression.

**Outcome:** all clear after deep review, one maintainability finding fixed, and normal re-review passed.

**Risk score:** medium - packaged Electron routing is a separate presentation boundary from Next App Router, and the People surface has user-facing navigation/layout behavior.

**Change archetypes:** desktop packaged renderer routing, presentation layout, route-contract regression, static-analysis remediation.

**Intended change:** make `/workspace/people` and `/workspace/people/:userId` reachable in the packaged desktop renderer and prevent People cards from stretching across a partially filled responsive row.

**Intent vs actual:** matches intent. `DesktopRoute` now owns the people collection/profile routes alongside existing workspace routes; profile routes resolve to `PeopleProfileScreen`; the board grid keeps empty responsive tracks via `auto-fill`.

**Confidence:** high for the targeted desktop route and grid invariants. Focused route/layout tests, typecheck, lint on changed files, whitespace check, and changed-file Fallow audit passed.

**Coverage note:** focused desktop route and People screen tests cover the new Electron route boundary and grid class. Full app/Vercel/desktop builds are run after the review loop as release verification.

**Finding triage:**

| Source | Finding | Current status | Bug class | Missed invariant/variant | Action |
|--------|---------|----------------|-----------|--------------------------|--------|
| Deep diff review / Fallow changed-file audit | Adding People as another `StaticRoute` branch pushed desktop route dispatch above the cognitive-complexity gate | resolved | Maintainability / route dispatcher growth | Packaged desktop route ownership must not degrade into an ever-growing branch chain | Replaced static route branching with a data-driven `STATIC_ROUTE_DEFINITIONS` table and reran Fallow successfully |

**Static/analyzer evidence:** First changed-file Fallow audit failed with 1 introduced moderate complexity finding in `StaticRoute`. After the route-table fix, `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` passed with 4 changed files, 0 dead-code issues, 0 complexity findings, and 0 duplication clone groups. Existing production/full advisory inventories remain unrelated baseline debt.

**Architecture impact:** strengthened the existing presentation boundary. Packaged Electron route admission remains centralized in `desktop/renderer/desktop-route.tsx`; the People domain/read-model logic remains in `components/app/people-screen.tsx` and domain selectors. No data, auth, or backend ownership moved into Electron.

**Deep-review evidence:** Pass A (correctness/safety) checked desktop path matching, collection/profile dispatch, fallback route behavior, search-param preservation for existing static routes, and People grid behavior. Pass B (maintainability/structure) found and fixed the route-branch complexity regression, then rechecked the route table for local ownership and no new generic helper bucket.

**Bug classes / invariants checked:** packaged renderer route parity with Next routes; workspace People collection and profile detail path separation; short People rows must occupy only populated responsive columns; existing static routes still resolve through the same desktop route owner.

**Branch totality:** current working tree delta was reviewed against `origin/main`, with all changed files read and route/layout sibling paths traced in the desktop renderer.

**Sibling closure:** checked workspace projects/detail, docs/items detail matching, existing static routes, People board layout test, and profile navigation path.

**Remediation impact surface:** presentation-only and narrow: `desktop/renderer/desktop-route.tsx`, `components/app/people-screen.tsx`, and focused tests.

**Residual risk / unknowns:** no browser visual smoke has been run yet for the People board because the requested final verification is Vercel build plus desktop rebuild; layout behavior is still represented by the Tailwind class contract test.

### Validation

- `pnpm vitest run tests/desktop/desktop-route.test.tsx tests/components/people-screen.test.tsx` - passed, 2 files / 6 tests.
- `pnpm exec eslint desktop/renderer/desktop-route.tsx components/app/people-screen.tsx tests/desktop/desktop-route.test.tsx tests/components/people-screen.test.tsx --max-warnings 0` - passed.
- `pnpm typecheck` - passed.
- `git diff --check` - passed.
- `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` - passed after the route-table fix.
- `~/.codex/skills/diff-review/scripts/review-preflight.sh` - completed; changed-file Fallow summary clean after fix.

### Branch-totality proof

- **Non-delta files/systems re-read:** `desktop/renderer/desktop-route.tsx`, `desktop/renderer/adapters/app-navigation.tsx`, Next People pages, People screen/profile component, desktop route tests, People screen tests.
- **Prior open findings rechecked:** none open in this scope.
- **Prior resolved/adjacent areas revalidated:** desktop packaged renderer route ownership and People surface privacy/read-model ownership remain in their existing boundaries.
- **Hotspots or sibling paths revisited:** project/detail route distinction, docs/items detail routes, workspace static routes, search static route context, People collection/profile split.
- **Dependency/adjacent surfaces revalidated:** desktop navigation adapter still supplies pathname/search params; People links already use `AppLink`.
- **Why this is enough:** the only new runtime contract is route admission in the packaged renderer, and it now has focused coverage plus a clean changed-file static gate.

### Challenger pass

- `not needed` - risk is medium, not high/critical; the weakest variant was route-table growth and it was directly fixed and rechecked with Fallow.

## Turn 6 - 2026-05-31 11:41 BST

| Field | Value |
|-------|-------|
| **Commit** | 5a9c2692 working tree |
| **IDE / Agent** | Codex |

**Summary:** Imported the latest Codex PR review feedback on PR #45 and fixed both live private-task compatibility/security issues. Direct private work item APIs now require a resolvable workspace even for legacy rows, and preserved private subtasks can be updated after team deletion when the parent is unchanged.

**Outcome:** all clear after deep review and normal re-review; no open findings.

**Risk score:** high - shared work-item authorization, legacy private data, deleted-team compatibility, and parent/child validation.

**Change archetypes:** external PR finding, authorization/tenancy, compatibility/legacy data, parent validation, regression hardening.

**Intended change:** close the latest PR review findings without weakening the private-task model or relying on deleted legacy records as the only guard.

**Intent vs actual:** matches intent. Missing-workspace private rows now fail closed unless workspace can be resolved through their team, and unchanged private parents no longer force a deleted-team validation path. Explicit private parent changes still validate private ownership, workspace scope, child type, and cycles.

**Confidence:** high for the targeted backend fixes. The changed paths have focused regressions plus full test/build/type/lint/static checks.

**Coverage note:** targeted access/work-item/work-helper/cleanup/bootstrap tests, full Vitest suite, typecheck, lint, build, diff whitespace check, and changed-file Fallow audit all passed.

**Finding triage:**

| Source | Finding | Current status | Bug class | Missed invariant/variant | Action |
|--------|---------|----------------|-----------|--------------------------|--------|
| Codex PR review | Shared private work-item access allows legacy rows without workspace check | resolved | Scope and Tenancy / Compatibility and Legacy Data | Creator ownership alone is not enough; private item access also requires resolvable accessible workspace | Resolved by resolving workspace from `workspaceId` or stored team before authorizing private item APIs |
| Codex PR review | Preserved private subtasks with unchanged parent become uneditable after team deletion | resolved | Compatibility and Legacy Data / Variant State | Unrelated private item edits must not revalidate unchanged parent through a deleted team | Resolved by skipping unchanged private parent validation and adding team-free private parent validation for explicit parent changes |

**Static/analyzer evidence:** `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` passed with 97 changed files, 0 dead-code issues, 0 complexity findings, and 0 duplication clone groups. Fallow still emits the known `node_modules directory not found` warnings while returning a passing verdict.

**Architecture impact:** strengthened the authoritative application boundaries. Authorization remains in `convex/app/access.ts`; parent validation remains in `convex/app/work_helpers.ts`; update orchestration only decides when private parent validation is needed.

**Deep-review evidence:** Pass A (correctness/safety) confirmed both latest PR findings were live and checked direct item APIs, private description document access, deleted-team updates, explicit parent changes, workspace resolution, and prior cleanup/bootstrap fixes. Pass B (maintainability/structure) found the new helper acceptable because it is a narrow production-used validation boundary, not a test-only export or generic helper bucket. Normal re-review after the fixes found no additional issue.

**Bug classes / invariants checked:** private item access requires creator plus accessible workspace; missing workspace is unauthorized unless resolved from storage; unchanged private parent relationships are preserved through unrelated edits; explicit private parent changes stay creator-private, workspace-scoped, type-compatible, and cycle-safe.

**Branch totality:** current PR branch state and current working-tree delta were re-reviewed, with focus on `convex/app/access.ts`, `convex/app/work_item_handlers.ts`, `convex/app/work_helpers.ts`, bootstrap private item filtering, team deletion preservation, and private description access.

**Sibling closure:** checked readable/editable work item access, item-description document access, private parent change/no-change variants, cleanup preserved private rows, bootstrap workspace resolution, and workspace label cleanup.

**Remediation impact surface:** backend-owned and narrow. The changes affect shared work-item access, private parent validation, update handler branching, and focused Convex tests.

**Residual risk / unknowns:** no browser smoke needed for this backend-only turn. Existing full-branch browser smoke gap from broad UI changes remains unchanged.

### Validation

- `python3 /Users/declancowen/.codex/plugins/cache/openai-curated/github/fef63ecf/skills/gh-address-comments/scripts/fetch_comments.py` - fetched latest PR review threads.
- `pnpm vitest run tests/convex/access.test.ts tests/convex/work-item-handlers.test.ts tests/convex/work-helpers.test.ts tests/convex/cleanup.test.ts tests/convex/auth-bootstrap-health.test.ts` - passed, 5 files / 49 tests.
- `pnpm typecheck` - passed.
- `git diff --check` - passed.
- `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` - passed.
- `pnpm lint` - passed.
- `pnpm test` - passed, 210 files / 1297 tests.
- `pnpm build` - passed.

### Branch-totality proof

- **Non-delta files/systems re-read:** private work-item access helper, workspace access helper, document access route through private work item access, parent validation helper, work item update handler, cleanup preservation, and auth bootstrap.
- **Prior open findings rechecked:** WI-PVT-003 and WI-PVT-004 remain resolved; the new PR feedback is recorded below as WI-PVT-005 and WI-PVT-006 and resolved in this turn.
- **Prior resolved/adjacent areas revalidated:** bootstrap fail-closed private rows, team deletion workspace backfill, preserved description docs, preserved private labels, private item activities, and workspace deletion include-private cascade remain valid.
- **Hotspots or sibling paths revisited:** `requireReadableWorkItemAccess`, `requireEditableWorkItemAccess`, `requireEditableDocumentAccess`, `validateWorkItemParentPatch`, `validatePrivateWorkItemParent`, `cascadeDeleteTeamData`, and `canCurrentUserSeeBootstrapWorkItem`.
- **Dependency/adjacent surfaces revalidated:** focused tests, full test suite, typecheck, lint, build, diff whitespace, and Fallow changed-file audit.
- **Why this is enough:** both bugs were at authoritative backend boundaries; each fix now has a direct regression test and sibling paths were swept for the same missing workspace/deleted-team variants.

### Challenger pass

- done - assumed another legacy private row could bypass workspace checks or become uneditable after team deletion. Checked direct work item APIs, document access, bootstrap, cleanup, parent unchanged/changed variants, missing parent workspace, and explicit cross-workspace private parents. No further live issue found.

### Resolved / Carried / New findings

#### WI-PVT-005 [High] Direct private work item APIs authorize legacy rows without workspace access - resolved

The PR review correctly identified that `requirePrivateWorkItemAccessIfNeeded()` only checked creator ownership for private rows whose `workspaceId` was missing. A removed creator who knew the item ID could still hit direct readable/editable work item APIs if the row had no workspace.

**Fix:** private work item access now resolves workspace from `workspaceId` or the stored team and requires readable workspace access. If no workspace can be resolved, the item is denied.

**Resolution evidence:** `convex/app/access.ts`, `tests/convex/access.test.ts`.

#### WI-PVT-006 [Medium] Preserved private subtasks revalidate unchanged parent through deleted team - resolved

The PR review correctly identified that private subtasks preserved after team deletion could fail ordinary title/status edits because update validation rechecked the existing parent through `validateWorkItemParent()`, which requires the deleted team row.

**Fix:** unchanged private parents are not revalidated on unrelated edits. Explicit private parent changes use a private-specific parent validator that avoids the deleted-team path while still enforcing private ownership, workspace scope, child type, and cycle checks.

**Resolution evidence:** `convex/app/work_item_handlers.ts`, `convex/app/work_helpers.ts`, `tests/convex/work-item-handlers.test.ts`, `tests/convex/work-helpers.test.ts`.

### Recommendations

1. **Fix first:** none.
2. **Then address:** push the branch and wait for the automated PR review/checks before starting another review loop.
3. **Patterns noticed:** private-task compatibility needs both read-side and direct mutation/API authorization proof; bootstrap-only fixes are not enough.

## Turn 5 - 2026-05-31 11:26 BST

| Field | Value |
|-------|-------|
| **Commit** | 380ea965 working tree |
| **IDE / Agent** | Codex |

**Summary:** Imported the second Codex PR review feedback on PR #45 and fixed the live team-deletion/private-work preservation issue. Team deletion now writes the team workspace onto preserved private work items before the team row is removed, detaches their description documents from the deleted team, and keeps private labels referenced by preserved private work items during workspace label cleanup.

**Outcome:** all clear after deep review and normal re-review; no open findings.

**Risk score:** high - destructive cleanup, private-task continuity, workspace/label ownership, and legacy-data compatibility.

**Change archetypes:** external PR finding, destructive cleanup, privacy/tenancy, compatibility/legacy data, label/reference cleanup, regression hardening.

**Intended change:** resolve the PR review without depending on manually deleted legacy PVT rows, while keeping new private-task design data visible and owned by the workspace after team deletion.

**Intent vs actual:** matches intent. Deleted legacy rows reduce current data exposure, but the cleanup path still handles future restored/imported rows and new private tasks that are preserved when a team is deleted.

**Confidence:** high for the backend cleanup fix. The fix has focused cleanup/bootstrap regression coverage, a full test/build pass, typecheck, lint, diff whitespace, and Fallow changed-file audit.

**Coverage note:** targeted cleanup/bootstrap tests, full Vitest suite, typecheck, lint, build, diff whitespace check, and changed-file Fallow audit all passed.

**Finding triage:**

| Source | Finding | Current status | Bug class | Missed invariant/variant | Action |
|--------|---------|----------------|-----------|--------------------------|--------|
| Codex PR review | Team deletion can preserve legacy private items without workspace backfill | resolved | Data Lifecycle / Compatibility and Legacy Data | Preserved private item must not depend on a soon-deleted team row to resolve workspace | Resolved by patching preserved private item `workspaceId` and detaching its description document before team deletion |
| Deep local review | Workspace label cleanup can drop labels only referenced by preserved private work items | resolved | Data Lifecycle / Reference Cleanup | Preserved private work item references must remain visible to workspace cleanup after the team is deleted | Resolved by including workspace-scoped private work items in label-reference cleanup and adding a regression test |

**Static/analyzer evidence:** `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` passed with 94 changed files, 0 dead-code issues, 0 complexity findings, and 0 duplication clone groups. Fallow still emits the known `node_modules directory not found` warnings while returning a passing verdict.

**Architecture impact:** strengthened the cleanup/data lifecycle boundary. The destructive team-cleanup owner now preserves private-task workspace identity and document ownership before deleting the team, and label cleanup derives references from workspace-private work items instead of only surviving team membership.

**Deep-review evidence:** Pass A (correctness/safety) found the PR review issue live and found the adjacent private-label cleanup variant before commit. Pass B (maintainability/structure) found the added cleanup helper acceptable because the extra scan is in an infrequent destructive/admin path and keeps the invariant in the cleanup owner. Normal re-review after both fixes found no additional issue.

**Bug classes / invariants checked:** preserved private tasks need a durable workspace, private description docs must not remain team-linked after team deletion, preserved private labels must not be cleaned as unused, unused labels still clean up, and workspace deletion still uses `includePrivateWorkItems: true` to cascade private work with the workspace.

**Branch totality:** current PR branch state and current working-tree delta were re-reviewed, with focus on `convex/app/cleanup.ts`, `convex/app/auth_bootstrap.ts`, label cleanup references, team/workspace deletion callers, private item creation shape, and prior private-task preservation tests.

**Sibling closure:** checked team deletion, workspace deletion, bootstrap private-item workspace resolution, item-description document filtering, workspace label cleanup, private label assignment rules, and `cleanupGlobalState` variants.

**Remediation impact surface:** backend-owned and narrow. The changes affect team deletion cleanup and label-reference cleanup plus focused Convex tests.

**Residual risk / unknowns:** no browser smoke needed for this backend-only turn. Existing full-branch browser smoke gap from broad UI changes remains unchanged.

### Validation

- `pnpm vitest run tests/convex/cleanup.test.ts tests/convex/auth-bootstrap-health.test.ts` - passed, 2 files / 11 tests.
- `pnpm typecheck` - passed.
- `git diff --check` - passed.
- `pnpm lint` - passed.
- `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` - passed.
- `pnpm test` - passed, 210 files / 1293 tests.
- `pnpm build` - passed.

### Branch-totality proof

- **Non-delta files/systems re-read:** team deletion handler, workspace deletion handler, cleanup label reference paths, private work item creation, bootstrap private item authorization, private label assignment rules, and cleanup tests.
- **Prior open findings rechecked:** WI-PVT-002 remains resolved; the new PR feedback is recorded below as WI-PVT-003 and resolved in this turn.
- **Prior resolved/adjacent areas revalidated:** private task preservation, private description docs, work item activities, bootstrap fail-closed private workspace resolution, and cleanup-global-state label deletion remain valid.
- **Hotspots or sibling paths revisited:** `cascadeDeleteTeamData`, `preservePrivateWorkItemsForTeamDelete`, `cleanupUnusedLabels`, `listWorkspaceLabelReferences`, `deleteTeamHandler`, `deleteWorkspaceHandler`, and `canCurrentUserSeeBootstrapWorkItem`.
- **Dependency/adjacent surfaces revalidated:** targeted tests, full test suite, typecheck, lint, build, diff whitespace, and Fallow changed-file audit.
- **Why this is enough:** the live bug was in the destructive cleanup owner; the fix runs before team deletion and the regression test covers both workspace/document preservation and the adjacent private-label reference variant.

### Challenger pass

- done - assumed preserving private work items still lost adjacent private state and checked documents, activities, notifications, labels, bootstrap visibility, workspace deletion, and include-private cascade variants. The label cleanup issue was found and fixed; no further live issue found.

### Resolved / Carried / New findings

#### WI-PVT-003 [Medium] Team deletion preserves private items without durable workspace backfill - resolved

The PR review correctly identified that preserving private work items while deleting their team could leave legacy private rows without `workspaceId`; after the bootstrap fix, those rows would fail closed and disappear because their only workspace fallback was the deleted team.

**Fix:** team deletion now patches preserved private work items with the team workspace and detaches their description documents from the deleted team before deleting records.

**Resolution evidence:** `convex/app/cleanup.ts`, `tests/convex/cleanup.test.ts`.

#### WI-PVT-004 [Medium] Workspace label cleanup can delete labels used only by preserved private work items - resolved

During deep review of the cleanup fix, workspace label cleanup still discovered work item label references through surviving workspace teams. A private work item preserved from a deleted team could therefore keep a private label ID while the label row was cleaned up as unused.

**Fix:** workspace label cleanup now includes private work items by workspace as label-reference owners and dedupes them with surviving team work items. A regression proves the used private label remains and an unused private label is removed.

**Resolution evidence:** `convex/app/cleanup.ts`, `tests/convex/cleanup.test.ts`.

### Recommendations

1. **Fix first:** none.
2. **Then address:** push the branch and wait for the automated PR review/checks before starting another review loop.
3. **Patterns noticed:** destructive cleanup must preserve all references owned by an entity it intentionally keeps, not only the primary row.

## Turn 4 - 2026-05-31 11:06 BST

| Field | Value |
|-------|-------|
| **Commit** | 938e6758 working tree |
| **IDE / Agent** | Codex |

**Summary:** Imported the Codex PR review feedback on PR #45 and fixed the live P1 bootstrap privacy bug. Legacy/private work items are now authorized only when their workspace can be resolved and the user still has access to that workspace. The bootstrap path resolves legacy private item team records from storage before filtering, and unknown/orphaned private item workspace is denied instead of allowed.

**Outcome:** all clear after deep review and normal re-review; no open findings.

**Risk score:** high - auth/bootstrap read model, private item privacy, legacy-data compatibility, and workspace/team tenancy boundaries.

**Change archetypes:** external PR finding, authorization/tenancy, compatibility/legacy data, read model/bootstrap snapshot, regression hardening.

**Intended change:** address the PR review finding without relying on manual legacy data deletion as the only control.

**Intent vs actual:** matches intent. The user deleted legacy PVT tasks, but the code still fails closed for future orphaned/imported/restored rows and preserves valid legacy private rows only when their team resolves to an accessible workspace.

**Confidence:** high for the targeted backend privacy fix. The fix has focused regression coverage plus full test/build/type/lint/static checks.

**Coverage note:** targeted auth-bootstrap test, full test suite, typecheck, lint, build, diff whitespace check, and changed-file Fallow audit all passed.

**Finding triage:**

| Source | Finding | Current status | Bug class | Missed invariant/variant | Action |
|--------|---------|----------------|-----------|--------------------------|--------|
| Codex PR review | Private bootstrap allowed creator-owned private items when workspace could not be resolved | resolved | Scope and Tenancy / Compatibility and Legacy Data | Legacy private item with no `workspaceId` and missing/non-visible team must fail closed | Resolved by resolving private item teams from storage and denying unknown workspace; added orphaned legacy private item regression |

**Static/analyzer evidence:** `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` passed with 94 changed files, 0 dead-code issues, 0 complexity findings, and 0 duplication clone groups. The preflight's transient changed-file Fallow failure was not reproduced by the direct audit.

**Architecture impact:** strengthened the bootstrap/read-model authorization boundary. The server-side snapshot owner now resolves legacy private item workspace information from persisted team records and denies unresolved scope rather than letting presentation or cleaned data carry the invariant.

**Deep-review evidence:** Pass A (correctness/safety) found the PR review issue live and confirmed the fix closes both unknown workspace and inaccessible workspace variants. Pass B (maintainability/structure) found the minimal extra team lookup acceptable because it stays in the bootstrap query boundary and avoids spreading compatibility rules into UI or domain display selectors. Normal re-review after the fix found no additional issue.

**Bug classes / invariants checked:** private item visibility requires creator ownership plus resolvable accessible workspace; unknown workspace is unauthorized; fetching a private item's team for authorization must not itself expose the item; orphaned legacy private item descriptions remain excluded because only visible work item description IDs are loaded.

**Branch totality:** current PR branch state and current working-tree delta were re-reviewed, with special focus on `convex/app/auth_bootstrap.ts`, private item data helpers, document visibility, scoped read-model selectors, and prior private-task cleanup fixes.

**Sibling closure:** checked bootstrap private work item filtering, item-description document filtering, workspace access collection, stored team resolution, private item data loading, and adjacent read-model/private task selectors for the same fail-open pattern.

**Remediation impact surface:** small and backend-owned. Only bootstrap snapshot filtering and its regression test changed this turn.

**Residual risk / unknowns:** browser smoke remains unavailable in this environment, but this turn did not change presentation behavior.

### Validation

- `python3 /Users/declancowen/.codex/plugins/cache/openai-curated/github/fef63ecf/skills/gh-address-comments/scripts/fetch_comments.py` - fetched 1 unresolved PR review thread.
- `pnpm vitest run tests/convex/auth-bootstrap-health.test.ts` - passed, 1 file / 9 tests.
- `pnpm typecheck` - passed.
- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh` - completed.
- `git diff --check` - passed.
- `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` - passed.
- `pnpm lint` - passed.
- `pnpm build` - passed.
- `pnpm test` - passed, 210 files / 1292 tests.

### Branch-totality proof

- **Non-delta files/systems re-read:** PR review thread, bootstrap workspace access context, private work item snapshot filtering, item-description document visibility, private item data helpers, and prior private-task cleanup paths.
- **Prior open findings rechecked:** WI-PVT-001 remains resolved; the new bootstrap issue is recorded below as WI-PVT-002 and resolved in this turn.
- **Prior resolved/adjacent areas revalidated:** private task cleanup, private description docs, work item activities, scoped read-model privacy, and people activity direct-chat/private exclusions remain unaffected.
- **Hotspots or sibling paths revisited:** `canCurrentUserSeeBootstrapWorkItem`, `getBootstrapWorkItemWorkspaceId`, `loadVisibleBootstrapDocuments`, `isVisibleTeamScopedBootstrapDocument`, `listPrivateWorkItemsByCreator`, and accessible workspace collection.
- **Dependency/adjacent surfaces revalidated:** tests, typecheck, lint, build, full Vitest, and Fallow changed-file audit.
- **Why this is enough:** the bug was isolated to bootstrap's private item workspace fallback; the fix changes the authoritative server snapshot filter and adds a regression for the weak legacy/orphaned variant.

### Challenger pass

- done - assumed another private bootstrap leak remained and checked unknown workspace, inaccessible workspace, visible-team legacy row, item-description document load, and private item loading by creator. No further live leak found.

### Resolved / Carried / New findings

#### WI-PVT-002 [High] Bootstrap authorizes private items with unknown workspace - resolved

The PR review correctly identified that `!workspaceId` allowed creator-owned private work items into the full bootstrap snapshot when `workspaceId` was missing and the legacy `teamId` was no longer visible. That could expose private item data after workspace/team access had been removed.

**Fix:** bootstrap now loads the teams referenced by creator-owned private work items, resolves workspace from `workItem.workspaceId` or the stored team, and denies the item when no workspace can be resolved or the workspace is not accessible.

**Resolution evidence:** `convex/app/auth_bootstrap.ts`, `tests/convex/auth-bootstrap-health.test.ts`.

### Recommendations

1. **Fix first:** none.
2. **Then address:** after push, wait for the automated PR review to re-run before starting any further feedback loop.
3. **Patterns noticed:** legacy-data fallbacks in auth/read-model code should fail closed unless they can resolve tenancy from storage.

## Turn 3 - 2026-05-31 10:49 BST

| Field | Value |
|-------|-------|
| **Commit** | d2428bc0 working tree |
| **IDE / Agent** | Codex |

**Summary:** Branch-total deep diff review rerun after the inbox resize/timestamp fix and after including the people/profile UI improvements in scope. The current tree has no open findings. The previous private-task backend ownership finding is resolved in the current implementation, and the latest user-reported inbox issue is resolved by constraining the notification row layout and making the resize grip always visible.

**Outcome:** all clear with one explicit verification gap: browser visual smoke could not be run because the Browser tool was not exposed by tool discovery and Playwright is not installed locally.

**Risk score:** high - shared API contracts, Convex persistence, read models, authorization/privacy, optimistic state, email/in-app notification fan-out, and broad UI surfaces changed.

**Change archetypes:** shared contracts, persistence/read models, authorization/tenancy, optimistic state, async side effects, broad UI/navigation, static-analysis-gated branch.

**Intended change:** implement work item subscriptions and subscriber notifications; fix private tasks so they are user-private task/sub-task items; add work item status activity; make notification inbox read/presentation behavior stable; add people/profile surfaces and people search; add reset/default-view behavior; fix channel post reliability; keep hover overlays contained.

**Intent vs actual:** matches intent. The people/profile UI work is included as part of the reviewed presentation scope, not treated as out-of-band polish.

**Confidence:** high for code and automated coverage. Medium-high overall because representative browser visual smoke was not available for the broad authenticated UI changes.

**Coverage note:** Full test, typecheck, lint, build, diff whitespace check, focused inbox/people/search tests, and changed-file Fallow audit all passed on the current tree.

**Finding triage:** no new findings. User-reported inbox row/date/ellipsis resize issue was treated as an external finding and is fixed in the current tree.

**Static/analyzer evidence:** `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` passed with 94 changed files, 0 dead-code issues, 0 complexity findings, and 0 duplication clone groups. Fallow emitted its existing `node_modules directory not found` warnings but returned a passing verdict.

**Architecture impact:** improved ownership. Private-task rules are enforced in backend/store boundaries instead of only UI filters; subscriptions are owned by work item mutation/read-model paths; people/profile activity is exposed through domain selectors and a workspace people read-model route; search consumes selector-built people entries instead of duplicating membership rules in presentation.

**Deep-review evidence:** Pass A (correctness/safety) found no live data, auth, stale-read, destructive-cleanup, subscriber notification, or resize-regression issues after fixes. Pass B (maintainability/structure) found no blocking structure issues; notable tradeoffs are existing large UI files and a broad branch, mitigated by capability-owned selectors, route handlers, tests, and Fallow changed-file evidence.

**Bug classes / invariants checked:** private tasks remain creator-private and not team-owned for destructive cleanup; private tasks cannot be subscribed to; subscribers receive work item comment/status notifications like assignees/creators where applicable; read notifications do not flip unread from stale read models; person activity excludes direct chat and inaccessible/private content; people search routes to `/workspace/people/[userId]`; inbox row timestamp and resize grip remain contained under narrow widths.

**Branch totality:** current working tree diff against `origin/main` was reviewed, including untracked people/review files and the latest inbox UI fix.

**Sibling closure:** subscription API/store/UI/server paths checked together; private create/update/read-model/cleanup/store/test paths checked together; people board/profile/search/hover/sidebar/read-model paths checked together; inbox row/list pane/controller/read-state tests checked together.

**Remediation impact surface:** broad but coherent. Changes land in owning layers: Convex/application handlers for persistence and authorization, domain selectors for read/search decisions, scoped read models for delivery, Zustand slices for optimistic state, and presentation components for layout/actions.

**Residual risk / unknowns:** no browser smoke for authenticated `/workspace/people`, `/workspace/people/[userId]`, `/inbox`, and work item detail surfaces in this environment. The automated coverage and build passed, but a manual UI pass in a logged-in browser remains useful after PR creation.

### Validation

- `git diff --check` - passed.
- `pnpm typecheck` - passed.
- `pnpm lint` - passed.
- `pnpm vitest run tests/components/inbox-ui.test.tsx tests/components/inbox-screen.test.tsx tests/components/people-screen.test.tsx tests/lib/domain/workspace-search.test.ts tests/components/workspace-search-screen.test.tsx` - passed, 5 files / 16 tests.
- `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` - passed.
- `pnpm build` - passed.
- `pnpm test` - passed, 210 files / 1292 tests.

### Branch-totality proof

- **Non-delta files/systems re-read:** inbox row/list pane/controller; people/profile screen and selectors; user hover-card/hover-card primitive; work item subscription API/server/store/detail UI; search selector and search UI; private task backend/store/cleanup tests.
- **Prior open findings rechecked:** WI-PVT-001 is resolved by private-task workspace fields, creator-scoped PVT numbering, private description docs not team-linked, private create not requiring editable team work-item support, subscription rejection for private tasks, and team deletion preserving private tasks.
- **Prior resolved/adjacent areas revalidated:** status activity persistence, hover containment, read-state reconciliation, channel post optimistic update reliability, subscribed default view behavior, and reset view behavior.
- **Hotspots or sibling paths revisited:** work item comments/status notification fan-out, email job kind/builders, scoped read-model seeds, search seed users, direct-chat exclusion from people activity, and team/channel access checks for person activity.
- **Dependency/adjacent surfaces revalidated:** route contracts, Convex handlers, domain selectors, store slices, UI components, scoped read models, and default view definitions.
- **Why this is enough:** the branch changes are covered by direct focused tests and full repo gates, and the remaining unknown is visual/authenticated browser smoke rather than unreviewed code behavior.

### Challenger pass

- done - assumed one serious issue remained and hunted in destructive cleanup, stale read-model reconciliation, private task/team ownership, subscriber fan-out, people activity privacy, responsive inbox layout, and search scope. No new live issue found.

### Resolved / Carried / New findings

#### WI-PVT-001 [High] Private tasks are still team-owned in destructive backend paths - resolved

The current tree removes the live data-loss risk called out in Turn 2. Private work items now carry workspace scope, private description docs are not team-linked, private numbering is creator-scoped across teams, team cleanup filters out private work items, and tests cover preserving private work items, documents, and activities during team deletion.

**Resolution evidence:** `convex/app/work_item_handlers.ts`, `convex/app/data.ts`, `convex/app/cleanup.ts`, `tests/convex/work-item-handlers.test.ts`, `tests/convex/cleanup.test.ts`, `tests/lib/store/work-item-actions.test.ts`.

### Recommendations

1. **Fix first:** none.
2. **Then address:** run a manual authenticated browser pass on people/profile, inbox resizing, and work item subscription UI after the PR is available.
3. **Patterns noticed:** large existing UI files remain a maintainability pressure, but this branch did not introduce a new analyzer finding or a new generic helper bucket.
4. **Suggested approach:** keep future work in the same ownership pattern: backend invariants in Convex/application handlers, query visibility in domain selectors/read models, and UI components focused on presentation/actions.
5. **Architecture transition:** no additional transition artifact required beyond the tests and selectors added here.
6. **Defer on purpose:** browser smoke is deferred only because the required tooling is unavailable in this environment.

## Turn 2 - 2026-05-31

| Field | Value |
|-------|-------|
| **Commit** | d2428bc0 working tree |
| **IDE / Agent** | Codex |
| **Risk score** | High |
| **Outcome** | one open High finding |
| **Change archetypes** | ownership boundary, destructive cleanup, persistence/read models |

### Open Findings

#### WI-PVT-001 [High] Private tasks are still team-owned in destructive backend paths

Private task create had started to bypass team work-item feature inheritance, but still required and stored `teamId`. That storage detail was still treated as ownership by backend cleanup and numbering paths:

- `requireCreateWorkItemTeam` still required readable team access for private creation.
- `buildCreatedWorkItem` persisted `teamId: args.teamId`.
- `getCreateWorkItemNumbering` counted private keys from `by_team_id`, so a user could get duplicate `PVT-*` keys across teams.
- `cascadeDeleteTeamData` deleted every work item returned by `listWorkItemsByTeam`, including private tasks whose only link to the team was the legacy field.

This violated the target rule that private tasks are user-private and not part of a teamspace. The immediate risk was data loss when a teamspace is deleted: user private tasks tied to that team id would be deleted with team work items.

**Expected fix:** introduce an explicit private-task ownership/scope boundary, or at minimum make every team-owned destructive/listing path filter out `visibility === "private"` and make private numbering user/workspace scoped instead of team scoped. Add a regression test that deleting a team leaves the current user's private tasks and their description docs intact.

**Evidence:** `convex/app/work_item_handlers.ts`, `convex/app/data.ts`, `convex/app/cleanup.ts`.

**Verification this turn:**

- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh`
- `/Users/declancowen/.codex/skills/architecture-standards/scripts/architecture-preflight.sh`
- `git diff --check`
- `pnpm typecheck`

## Turn 1 - 2026-05-31

| Field | Value |
|-------|-------|
| **Commit** | d2428bc0 working tree |
| **IDE / Agent** | Codex |
| **Risk score** | High |
| **Outcome** | no open Critical/High findings after fixes |
| **Change archetypes** | shared contracts, persistence/read models, optimistic state, broad UI/navigation |

**Summary:** Fixed the two live gaps found in the initial final review pass. Work item status changes now persist to a dedicated `workItemActivities` collection instead of being inferred from per-recipient notifications, and work item detail read models include those activities and actor users. Sidebar user hover cards can now render without a body portal, and shell/surface sidebar usages opt into that local rendering so profile popups stay inside their owning surface.

**Architecture decision:** status history is now owned by the work-item mutation/read-model path, not by inbox notifications. Notifications remain delivery/read-state records; activity remains item history.

**Verification:**

- `pnpm typecheck`
- `pnpm vitest run tests/lib/scoped-read-models.test.ts tests/lib/convex/read-models.test.ts tests/convex/work-item-handlers.test.ts tests/components/work-item-detail-screen.test.tsx tests/components/user-presence.test.tsx tests/lib/store/work-item-actions.test.ts tests/lib/store/domain-updates.test.ts tests/lib/app-store-read-model-merge.test.ts`
- `pnpm vitest run tests/lib/domain/default-views.test.ts tests/lib/domain/view-item-level.test.ts tests/lib/store/ui-slice.test.ts tests/lib/store/work-item-actions.test.ts tests/lib/store/work-comment-actions.test.ts tests/lib/store/collaboration-channel-actions.test.ts tests/convex/comment-handlers.test.ts tests/convex/chat-message-notifications.test.ts tests/convex/work-item-handlers.test.ts tests/convex/email-job-handlers.test.ts tests/lib/email-builders.test.ts tests/components/people-screen.test.tsx tests/components/user-presence.test.tsx tests/components/inbox-ui.test.tsx tests/components/work-surface.test.tsx tests/components/work-item-detail-screen.test.tsx tests/app/api/read-model-route-contracts.test.ts tests/app/api/work-route-contracts.test.ts tests/lib/scoped-read-models.test.ts tests/lib/convex/read-models.test.ts tests/lib/app-store-read-model-merge.test.ts tests/lib/store/domain-updates.test.ts`
- `git diff --name-only --diff-filter=ACMRTUXB | rg '\\.(ts|tsx)$' | xargs pnpm exec eslint`
- `git diff --check`
- `pnpm build`

**Residual risk:** browser visual smoke for authenticated `/workspace/*` pages could not be completed in this environment. The dev server was available, but unauthenticated page requests redirected to login, the Browser MCP tool was not available from tool discovery, and Playwright was not installed locally.
