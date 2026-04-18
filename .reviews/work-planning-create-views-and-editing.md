# Review: Work Planning Create Views And Editing

## Project context (captured on Turn 1 — not re-detected on subsequent turns)

| Field | Value |
|-------|-------|
| **Repository** | `Linear` |
| **Remote** | `https://github.com/declancowen/Linear.git` |
| **Branch** | `feature/work-planning-20260418` |
| **Repo type** | `single repo` |
| **Stack** | `Next.js App Router / Convex / TypeScript` |
| **Packages affected** | `n/a` |
| **OS** | `Darwin 25.4.0` |
| **Package manager** | `pnpm 9.7.1` |
| **Node** | `v25.8.0` |
| **Python** | `n/a` |

## Scope (cumulative — updated each turn as new files are touched)

Files and areas reviewed across all turns:
- `components/app/shell.tsx` — `Cmd+K` create action orchestration
- `components/app/global-search-dialog.tsx` — command-palette create action rendering
- `lib/domain/search-create-actions.ts` — team/workspace-scoped create-action policy
- `components/app/screens.tsx` — workspace/team projects surface permissions and fallback views
- `components/app/screens/create-view-dialog.tsx` — view-create scope selection and permission gating
- `components/app/screens/create-work-item-dialog.tsx` — work-item create flow, selected-team label creation
- `components/app/screens/helpers.ts` — persisted view-filter cloning/guard helpers
- `components/app/screens/project-detail-screen.tsx` — project detail item views, saved view routing, create-view launch path
- `components/app/screens/work-surface-view.tsx` — board/list parent containers and child disclosure rendering
- `lib/domain/selectors-internal/projects.ts` — project detail route model
- `lib/domain/selectors-internal/work-items.ts` — visible-item and child-disclosure filtering
- `lib/domain/default-views.ts` — view-route constraints and fallback view semantics
- `lib/domain/types-internal/work.ts` — view-level defaults for team and project contexts
- `components/app/screens/work-item-detail-screen.tsx` — main-section edit/save flow, mention-delivery follow-up, live concurrent editing UI
- `components/app/screens/shared.tsx` — full-row sidebar property controls, workspace-aware work-item label creation
- `components/app/screens/work-surface-controls.tsx` — highest-parent configuration options
- `components/app/screens/work-surface-view.tsx` — parent-container rendering for child rows/cards
- `lib/content/rich-text-mentions.ts` — pending mention merge/filter helpers for retry-safe delivery
- `lib/store/app-store-internal/slices/work-document-actions.ts` — main-section persistence contract
- `lib/store/app-store-internal/slices/work-item-actions.ts` — label creation scope and status-notification mirror semantics
- `lib/store/app-store-internal/slices/views.ts` — optimistic view creation and canonical ID sync
- `lib/store/app-store-internal/types.ts` — view-create input contract
- `app/api/labels/route.ts` — label creation route workspace scoping
- `app/api/items/[itemId]/description/mentions/route.ts` and `lib/server/convex/documents.ts` — post-save mention-delivery contract
- `app/api/views/route.ts` — view creation route contract
- `convex/app/document_handlers.ts` — work-item self-mention delivery semantics
- `convex/app.ts` and `convex/app/view_handlers.ts` — canonical view create mutation contract
- `lib/domain/types-internal/schemas.ts` — validated view create payload shape
- `lib/convex/client/work.ts` and `lib/server/convex/work.ts` — typed view-create route/server wrappers
- `tests/lib/domain/search-create-actions.test.ts` — command-palette create-action regression coverage
- `tests/lib/domain/project-views.test.ts` — project view routing/fallback regression coverage
- `tests/components/work-item-detail-screen.test.tsx` — work-item edit recovery/concurrency regression coverage
- `tests/convex/document-handlers.test.ts` — work-item self-mention server regression coverage
- `tests/lib/content/rich-text-mentions.test.ts` — pending mention merge/filter regression coverage
- `tests/lib/store/view-slice.test.ts` — canonical optimistic-view ID regression coverage
- `tests/lib/store/work-item-actions.test.ts` — workspace-aware label creation regression coverage
- `tests/app/api/asset-notification-invite-route-contracts.test.ts` — label route workspace contract coverage
- `tests/app/api/work-route-contracts.test.ts` — view-create route contract coverage
- `tests/components/create-dialogs.test.tsx` — create-dialog render regression coverage
- `tests/components/project-detail-screen.test.tsx` — project-detail fallback presentation regression coverage
- `tests/components/screen-helpers.test.ts` — persisted filter-key regression coverage

## Review status (updated every turn)

| Field | Value |
|-------|-------|
| **Review started** | `2026-04-18 14:22:31 BST` |
| **Last reviewed** | `2026-04-18 19:46:59 BST` |
| **Total turns** | `12` |
| **Open findings** | `0` |
| **Resolved findings** | `21` |
| **Accepted findings** | `0` |

---

## Turn 1 — 2026-04-18 14:22:31 BST

| Field | Value |
|-------|-------|
| **Commit** | `47e5aa3` (working tree updated after this base) |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** Review of the local work-planning diff found two real correctness regressions in the new view/editing flows. One was a partial-failure bug in the work-item save path: content could persist successfully while a later mention-delivery error left the UI stuck in edit mode as if the save had failed. The other was a route-model bug in project detail: item views created from inside a project were still wired to the project collection route, so the create-view path validated against the wrong route and persisted views would not round-trip back to the detail screen.

| Status | Count |
|--------|-------|
| New findings | 2 |
| Resolved during Turn 1 | 2 |
| Carried from previous turns | 0 |
| Accepted | 0 |

### Resolved during Turn 1

#### F1-01 ~~[BUG] High~~ → RESOLVED — Work-item saves could succeed while mention-delivery failure trapped the editor in a false unsaved state
**Where:** [components/app/screens/work-item-detail-screen.tsx](../components/app/screens/work-item-detail-screen.tsx), [lib/store/app-store-internal/slices/work-document-actions.ts](../lib/store/app-store-internal/slices/work-document-actions.ts)

**What was wrong:** `handleSaveMainEdit()` only cleared the local edit session after post-save mention delivery succeeded. If `saveWorkItemMainSection()` persisted the new title/description but `syncSendItemDescriptionMentionNotifications()` failed afterward, the editor stayed open with the old mention baseline. At that point the content was already saved, but the UI still looked unsaved and subsequent retries kept re-attempting the mention batch from stale local state.

**How it was fixed:** [handleSaveMainEdit](../components/app/screens/work-item-detail-screen.tsx:470) now snapshots the pending mention batch, finalizes the saved draft state immediately after the main-section save succeeds, and treats mention-delivery failure as a non-blocking post-save error toast instead of as a failed save. That keeps the save boundary honest and prevents the editor from getting stuck in a retry loop after content is already persisted.

**Verified:** Added regression coverage in [work-item-detail-screen.test.tsx](../tests/components/work-item-detail-screen.test.tsx:367), then ran:
- `pnpm exec vitest run tests/components/work-item-detail-screen.test.tsx tests/lib/domain/project-views.test.ts tests/lib/domain/view-item-level.test.ts`
- `pnpm exec eslint components/app/screens/work-item-detail-screen.tsx components/app/screens/project-detail-screen.tsx lib/domain/selectors-internal/projects.ts tests/components/work-item-detail-screen.test.tsx tests/lib/domain/project-views.test.ts`

#### F1-02 ~~[BUG] High~~ → RESOLVED — Project-detail item views still used the collection route, so create-view from inside a project validated against the wrong target
**Where:** [components/app/screens/project-detail-screen.tsx](../components/app/screens/project-detail-screen.tsx), [lib/domain/selectors-internal/projects.ts](../lib/domain/selectors-internal/projects.ts), [lib/domain/default-views.ts](../lib/domain/default-views.ts)

**What was wrong:** The project-detail screen filtered saved item views, selected the active item view, and launched `Create view` using `backHref` (`/team/<slug>/projects` or `/workspace/projects`) instead of the actual project-detail route. But team/workspace item views for project detail are only allowed on `/team/<slug>/projects/<projectId>` or `/workspace/projects/<projectId>`. That meant the create dialog launched with an invalid route for `entityKind: "items"`, so the store-side validation rejected the create, and any persisted project-detail item views were keyed to the wrong route.

**How it was fixed:** [getProjectDetailModel](../lib/domain/selectors-internal/projects.ts:137) now exposes `detailHref`, and [ProjectDetailScreen](../components/app/screens/project-detail-screen.tsx:54) now uses that detail route for saved view selection, fallback item views, and the project-detail create-view launcher. The project item view layer now round-trips through the same route contract that `isRouteAllowedForViewContext()` expects.

**Verified:** Added selector coverage in [project-views.test.ts](../tests/lib/domain/project-views.test.ts:160), then ran:
- `pnpm exec vitest run tests/lib/domain/project-views.test.ts tests/lib/domain/view-item-level.test.ts tests/components/work-item-detail-screen.test.tsx`
- `pnpm exec eslint components/app/screens/project-detail-screen.tsx lib/domain/selectors-internal/projects.ts tests/lib/domain/project-views.test.ts`

## Turn 2 — 2026-04-18 14:22:31 BST

| Field | Value |
|-------|-------|
| **Commit** | `47e5aa3` (working tree updated after this base) |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** Re-reviewed the touched command-palette, project-view, and work-item editing paths after the fixes landed. No new correctness issue was confirmed in the follow-up pass.

| Status | Count |
|--------|-------|
| New findings | 0 |
| Resolved during Turn 2 | 0 |
| Carried from Turn 1 | 0 |
| Accepted | 0 |

### Verification approach

- Reviewed the local working diff across the command palette, project surfaces, and work-item save/presence flows
- Read the surrounding route, store, selector, and screen code for the changed paths in full
- Re-ran focused regression coverage after fixes:
  - `pnpm exec vitest run tests/components/work-item-detail-screen.test.tsx tests/lib/domain/project-views.test.ts tests/lib/domain/view-item-level.test.ts`
  - `pnpm exec eslint components/app/screens/work-item-detail-screen.tsx components/app/screens/project-detail-screen.tsx lib/domain/selectors-internal/projects.ts tests/components/work-item-detail-screen.test.tsx tests/lib/domain/project-views.test.ts`

## Turn 3 — 2026-04-18 15:27:22 BST

| Field | Value |
|-------|-------|
| **Commit** | `47e5aa3` (working tree updated after this base) |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** Re-reviewed the current local worktree after the later hierarchy/sidebar fixes. Two actionable issues surfaced in this pass: work-item self-mentions were still suppressed end-to-end even though self-assignment/status notifications had already been enabled, and the branch still contained stray duplicate files with Finder-style suffixes that were not part of the intended feature scope. Both were fixed before closing the turn.

| Status | Count |
|--------|-------|
| New findings | 2 |
| Resolved during Turn 3 | 2 |
| Carried from Turn 2 | 0 |
| Accepted | 0 |

### Resolved during Turn 3

#### F3-01 ~~[BUG] High~~ → RESOLVED — Work-item self-mentions were still filtered out on both the client and server paths
**Where:** [components/app/screens/work-item-detail-screen.tsx](../components/app/screens/work-item-detail-screen.tsx), [convex/app/document_handlers.ts](../convex/app/document_handlers.ts)

**What was wrong:** The work-item main-section save flow still called `getPendingRichTextMentionEntries()` with `ignoredUserIds: [currentUserId]`, and the server-side work-item mention handler separately skipped `args.currentUserId` during validation and delivery. That meant tagging yourself in a work-item description could never create an inbox notification or email, even after the earlier assignment/status self-notification fix.

**How it was fixed:** The client-side work-item save path now sends pending mention entries without filtering out the current user, and the work-item description mention handler now validates and delivers self-mentions like any other eligible team mention recipient. This keeps work-item self-mention behavior consistent with the rest of the notification model.

**Verified:** Added regression coverage in [work-item-detail-screen.test.tsx](../tests/components/work-item-detail-screen.test.tsx) and [document-handlers.test.ts](../tests/convex/document-handlers.test.ts), then ran:
- `pnpm exec vitest run tests/components/work-item-detail-screen.test.tsx tests/convex/document-handlers.test.ts tests/lib/server/convex-documents.test.ts tests/lib/content/rich-text-mentions.test.ts`
- `pnpm exec eslint components/app/screens/work-item-detail-screen.tsx convex/app/document_handlers.ts tests/components/work-item-detail-screen.test.tsx tests/convex/document-handlers.test.ts`

#### F3-02 ~~[HYGIENE] Medium~~ → RESOLVED — The worktree still contained stray duplicate files that would have polluted the PR scope
**Where:** `.gitattributes 2`, `.vercelignore 2`, `scripts/generate-icons 2.mjs`, `scripts/resend-from 2.mjs`, `docs/architecture/target-state-architecture 3.md`

**What was wrong:** The branch contained several Finder-style duplicate files (`* 2`, `* 3`) that were not part of the intended feature work. Two were exact copies of tracked files, one was an outdated broken Resend helper variant, and one was an accidental extra architecture-doc copy. Leaving them in the worktree would have made the PR harder to review and risked staging unrelated artifacts.

**How it was fixed:** Removed the stray duplicate files from the branch so the remaining diff is limited to the actual feature and regression-fix work.

**Verified:** Re-ran `git diff --check -- . ':!.reviews/'` and confirmed the duplicates no longer appear in `git status --short`.

## Turn 4 — 2026-04-18 15:28:51 BST

| Field | Value |
|-------|-------|
| **Commit** | `47e5aa3` (working tree updated after this base) |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** Re-reviewed the full local worktree after the Turn 3 fixes and reran broad lint plus the targeted regression suites covering work-item editing, view levels, project views, notification delivery, and the email worker helpers. No new code defects surfaced in the follow-up pass.

| Status | Count |
|--------|-------|
| New findings | 0 |
| Resolved during Turn 4 | 0 |
| Carried from Turn 3 | 0 |
| Accepted | 0 |

### Verification approach

- Re-reviewed the local diff after removing accidental duplicate files and enabling work-item self-mentions
- Re-ran broad repo lint:
  - `pnpm exec eslint app components convex lib scripts tests`
- Re-ran focused regression coverage:
  - `pnpm exec vitest run tests/components/work-item-detail-screen.test.tsx tests/convex/document-handlers.test.ts tests/lib/server/convex-documents.test.ts tests/lib/content/rich-text-mentions.test.ts tests/lib/domain/search-create-actions.test.ts tests/lib/domain/project-views.test.ts tests/lib/domain/view-item-level.test.ts tests/lib/domain/work-item-progress.test.ts tests/lib/store/work-item-actions.test.ts tests/lib/store/project-slice.test.ts tests/app/api/work-route-contracts.test.ts tests/scripts/resend-from.test.ts tests/scripts/send-email-jobs.test.ts tests/scripts/send-notification-digests.test.ts`
- Verified patch formatting and whitespace:
  - `git diff --check -- . ':!.reviews/'`

## Turn 5 — 2026-04-18 17:40:27 BST

| Field | Value |
|-------|-------|
| **Commit** | `8a3f6f5` (working tree updated after this base) |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** Reviewed the external PR analysis against the current branch and confirmed both findings as real correctness bugs. The create-view flow was generating one ID optimistically and persisting another on the server, which made immediate follow-up mutations target a non-existent view until a refresh. Separately, the work-item main-section save path still treated mention delivery as an untracked post-save side effect, so a failed notification batch was lost once the edit session baseline advanced. Both paths were fixed with cleaner application boundaries: a single canonical view ID now flows from optimistic create through persistence, and failed work-item mention deliveries now persist as explicit retry work instead of being inferred from the edit baseline.

| Status | Count |
|--------|-------|
| New findings | 2 |
| Resolved during Turn 5 | 2 |
| Carried from Turn 4 | 0 |
| Accepted | 0 |

### Resolved during Turn 5

#### F5-01 ~~[BUG] High~~ → RESOLVED — View creation used different optimistic and persisted IDs, so immediate follow-up mutations could target a missing view
**Where:** [lib/store/app-store-internal/slices/views.ts](../lib/store/app-store-internal/slices/views.ts:110), [lib/domain/types-internal/schemas.ts](../lib/domain/types-internal/schemas.ts:190), [convex/app/view_handlers.ts](../convex/app/view_handlers.ts:257)

**What was wrong:** `createView()` generated a local `view_*` ID for the optimistic record, but `syncCreateView()` only sent the parsed payload without that ID. The server then created a second ID when persisting the view. Until a full snapshot refresh happened, any follow-up mutations in the same session still used the optimistic local ID and could fail with `VIEW_NOT_FOUND`.

**How it was fixed:** The view-create contract now accepts an optional `id` end to end. [createView](../lib/store/app-store-internal/slices/views.ts:110) generates one canonical ID, uses it for the optimistic record, and sends the same ID through [syncCreateView](../lib/convex/client/work.ts:188), [viewSchema](../lib/domain/types-internal/schemas.ts:190), [createViewServer](../lib/server/convex/work.ts:308), and the Convex mutation in [createViewHandler](../convex/app/view_handlers.ts:257). A defensive refresh remains in place if the server ever returns a different ID anyway.

**Verified:** Added regression coverage in [view-slice.test.ts](../tests/lib/store/view-slice.test.ts:69) and extended the route contract check in [work-route-contracts.test.ts](../tests/app/api/work-route-contracts.test.ts:564), then ran:
- `pnpm exec vitest run tests/lib/store/view-slice.test.ts tests/app/api/work-route-contracts.test.ts`
- `pnpm exec eslint lib/store/app-store-internal/slices/views.ts lib/store/app-store-internal/types.ts lib/domain/types-internal/schemas.ts lib/convex/client/work.ts lib/server/convex/work.ts convex/app.ts convex/app/view_handlers.ts tests/lib/store/view-slice.test.ts tests/app/api/work-route-contracts.test.ts`

#### F5-02 ~~[BUG] High~~ → RESOLVED — Work-item mention notifications were still dropped after a post-save delivery failure
**Where:** [components/app/screens/work-item-detail-screen.tsx](../components/app/screens/work-item-detail-screen.tsx:132), [lib/content/rich-text-mentions.ts](../lib/content/rich-text-mentions.ts:92)

**What was wrong:** The work-item screen still derived pending mention notifications from the current edit baseline only. After a successful save, the component exited edit mode and the saved content became the new baseline. If `syncSendItemDescriptionMentionNotifications()` then failed, those saved mentions no longer appeared as “new” on the next edit unless the user reintroduced them manually, so the missed notifications were effectively lost.

**How it was fixed:** The save boundary now keeps failed mention deliveries as explicit retry work instead of relying on the edit baseline to rediscover them. [WorkItemDetailScreen](../components/app/screens/work-item-detail-screen.tsx:132) stores unresolved mention entries per item, filters them against the latest draft content, and merges them with newly-added mentions before the next save. The merge/filter logic lives in [rich-text-mentions.ts](../lib/content/rich-text-mentions.ts:92), so retry semantics stay deterministic without reopening the old false-unsaved-state bug.

**Verified:** Added retry regression coverage in [work-item-detail-screen.test.tsx](../tests/components/work-item-detail-screen.test.tsx:418) and helper coverage in [rich-text-mentions.test.ts](../tests/lib/content/rich-text-mentions.test.ts:107), then ran:
- `pnpm exec vitest run tests/components/work-item-detail-screen.test.tsx tests/lib/content/rich-text-mentions.test.ts`
- `pnpm exec eslint components/app/screens/work-item-detail-screen.tsx lib/content/rich-text-mentions.ts tests/components/work-item-detail-screen.test.tsx tests/lib/content/rich-text-mentions.test.ts`

### Verification approach

- Re-reviewed the current code paths identified by the external PR analysis rather than assuming the findings were stale
- Applied the fixes using the existing architecture boundaries already present elsewhere in the repo:
  - canonical client/server IDs for optimistic creates, matching the document create flow
  - explicit retry state for post-save side effects, rather than coupling notification delivery to edit baselines
- Re-ran focused verification:
  - `pnpm exec eslint components/app/screens/work-item-detail-screen.tsx lib/content/rich-text-mentions.ts lib/store/app-store-internal/slices/views.ts lib/store/app-store-internal/types.ts lib/domain/types-internal/schemas.ts lib/convex/client/work.ts lib/server/convex/work.ts convex/app.ts convex/app/view_handlers.ts tests/components/work-item-detail-screen.test.tsx tests/lib/content/rich-text-mentions.test.ts tests/lib/store/view-slice.test.ts tests/app/api/work-route-contracts.test.ts`
  - `pnpm exec vitest run tests/components/work-item-detail-screen.test.tsx tests/lib/content/rich-text-mentions.test.ts tests/lib/store/view-slice.test.ts tests/app/api/work-route-contracts.test.ts`
  - `git diff --check -- . ':!.reviews/'`

## Turn 6 — 2026-04-18 18:00:12 BST

| Field | Value |
|-------|-------|
| **Commit** | `5834fb6` (working tree updated after this base) |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** Reviewed the latest batch of external PR notes and separated the real defects from the stale or intentional observations. Three correctness bugs were confirmed: label creation in the work-item create/edit flows still targeted the active workspace instead of the selected team’s workspace, pending mention retries were only filtered by presence and could keep an over-large count after repeated mentions were reduced, and the project-detail fallback item view was still coercing an omitted presentation `itemLevel` into an explicit `null`, which skipped the team default and collapsed list/board views to `parentId === null`. Those three defects were fixed and re-verified. The remaining notes in this batch were either already correct (`cloneViewFilters`, `activeCreateDialog` persistence), explicitly requested product semantics (offline default status, assignee-only status notifications), or non-bugs in the current branch.

| Status | Count |
|--------|-------|
| New findings | 3 |
| Resolved during Turn 6 | 3 |
| Carried from Turn 5 | 0 |
| Accepted | 0 |

### Resolved during Turn 6

#### F6-01 ~~[BUG] High~~ → RESOLVED — Label creation still targeted the active workspace instead of the selected team’s workspace
**Where:** [components/app/screens/create-work-item-dialog.tsx](../components/app/screens/create-work-item-dialog.tsx:320), [components/app/screens/shared.tsx](../components/app/screens/shared.tsx:396), [lib/store/app-store-internal/slices/work-item-actions.ts](../lib/store/app-store-internal/slices/work-item-actions.ts:52), [app/api/labels/route.ts](../app/api/labels/route.ts:43)

**What was wrong:** The work-item create dialog and the sidebar label editor both called `createLabel()` without passing a workspace. The store action then deduplicated and created labels against `currentWorkspaceId`, even when the selected item/team belonged to a different workspace. In a multi-workspace account, that produced labels that were invalid for the selected team’s workspace and could cause subsequent work-item validation failures.

**How it was fixed:** The label-create contract now accepts an optional `workspaceId` all the way through the client and route layers. [CreateWorkItemDialog](../components/app/screens/create-work-item-dialog.tsx:320) passes the selected team’s workspace, [WorkItemLabelsEditor](../components/app/screens/shared.tsx:396) passes the current item’s workspace, [createLabel](../lib/store/app-store-internal/slices/work-item-actions.ts:52) scopes duplicate detection and creation to that workspace, and [app/api/labels/route.ts](../app/api/labels/route.ts:43) respects an explicit workspace override instead of always forcing the active workspace.

**Verified:** Added regression coverage in [work-item-actions.test.ts](../tests/lib/store/work-item-actions.test.ts:184) and extended the route contract in [asset-notification-invite-route-contracts.test.ts](../tests/app/api/asset-notification-invite-route-contracts.test.ts:196), then ran:
- `pnpm exec vitest run tests/lib/store/work-item-actions.test.ts tests/app/api/asset-notification-invite-route-contracts.test.ts`
- `pnpm exec eslint app/api/labels/route.ts components/app/screens/create-work-item-dialog.tsx components/app/screens/shared.tsx lib/convex/client/work.ts lib/domain/types-internal/schemas.ts lib/store/app-store-internal/slices/work-item-actions.ts lib/store/app-store-internal/types.ts tests/app/api/asset-notification-invite-route-contracts.test.ts tests/lib/store/work-item-actions.test.ts`

#### F6-02 ~~[BUG] High~~ → RESOLVED — Pending mention retries could keep an outdated count after repeated mentions were reduced
**Where:** [lib/content/rich-text-mentions.ts](../lib/content/rich-text-mentions.ts:95), [components/app/screens/work-item-detail-screen.tsx](../components/app/screens/work-item-detail-screen.tsx:345)

**What was wrong:** `filterPendingDocumentMentionsByContent()` only checked whether a user still appeared in the content. If a failed mention batch originally contained three mentions for the same user and the editor later reduced that to one mention before retrying, the retry entry stayed at `count: 3`. The server-side mention validator could then reject the retry as “not present,” creating a repeated failure loop.

**How it was fixed:** [filterPendingDocumentMentionsByContent](../lib/content/rich-text-mentions.ts:95) now clamps each pending retry entry to the current per-user mention count instead of preserving the stale count. The work-item retry flow therefore only resends the number of mentions that still exist in the current content.

**Verified:** Added clamp coverage in [rich-text-mentions.test.ts](../tests/lib/content/rich-text-mentions.test.ts:106), then ran:
- `pnpm exec vitest run tests/lib/content/rich-text-mentions.test.ts tests/components/work-item-detail-screen.test.tsx`
- `pnpm exec eslint lib/content/rich-text-mentions.ts components/app/screens/work-item-detail-screen.tsx tests/lib/content/rich-text-mentions.test.ts tests/components/work-item-detail-screen.test.tsx`

#### F6-03 ~~[BUG] High~~ → RESOLVED — Project detail fallback item views still collapsed omitted `itemLevel` into explicit top-level filtering
**Where:** [components/app/screens/project-detail-screen.tsx](../components/app/screens/project-detail-screen.tsx:104), [tests/lib/domain/project-views.test.ts](../tests/lib/domain/project-views.test.ts:192)

**What was wrong:** The project detail screen initialized and reset `projectItemsLevel` with `itemLevel ?? null`. For default project presentations, `itemLevel` is intentionally omitted, not `null`. Coercing it to `null` meant the fallback item view skipped the team default item level and flowed into `getVisibleItemsForView()` as an explicit “no level,” which filters to `parentId === null`.

**How it was fixed:** [ProjectDetailScreen](../components/app/screens/project-detail-screen.tsx:104) now preserves an omitted `itemLevel` as `undefined` in local presentation state and resolves it through `getDefaultViewItemLevelForTeamExperience()` when materializing the fallback item view. That keeps the default project detail list/board behavior aligned with the team’s configured highest parent level instead of silently degrading to a top-level-only filter.

**Verified:** Added regression coverage in [project-views.test.ts](../tests/lib/domain/project-views.test.ts:192), then ran:
- `pnpm exec vitest run tests/lib/domain/project-views.test.ts`
- `pnpm exec eslint components/app/screens/project-detail-screen.tsx tests/lib/domain/project-views.test.ts`

### Remaining notes classified

- The `cloneViewFilters` note was stale. [cloneViewFilters](../components/app/screens/helpers.ts:51) already copies `creatorIds`, `leadIds`, `health`, `milestoneIds`, `relationTypes`, and `teamIds`.
- The status-change notification target shift is intentional. It matches the requested product rule to only send status-change notifications when the item has an assignee, and the client/server mirrors plus tests already reflect that policy.
- The `activeCreateDialog` persistence note is correct-by-design. The field is intentionally excluded from persisted UI state.
- The offline default-user-status note is intentional and matches the earlier product request to default new/rejoined users to offline rather than active.
- The `normalizeResendFrom` display-name formatting change is a behavioral difference, but no code defect was confirmed in the current branch from this note alone.
- The async `createDocument` return-type change is intentional and the known caller already awaits it.
- The work-item presence dependency note was speculative; as a hardening follow-up, [WorkItemDetailScreen](../components/app/screens/work-item-detail-screen.tsx:116) now reads `currentUserId` through a dedicated selector so the heartbeat effect no longer depends on that field through the larger app snapshot object.

### Verification approach

- Re-reviewed the current diff against the latest external PR-analysis notes rather than assuming they were all still live
- Applied the fixes in the existing architectural seams:
  - explicit workspace scoping for label creation, owned by the application/store/API contract rather than by incidental UI context
  - retry-count clamping in the mention helper layer rather than in ad hoc screen logic
  - fallback item-level resolution in the project-detail presentation layer rather than by changing global view semantics
- Re-ran focused verification:
  - `pnpm exec eslint app/api/labels/route.ts components/app/screens/create-work-item-dialog.tsx components/app/screens/project-detail-screen.tsx components/app/screens/shared.tsx components/app/screens/work-item-detail-screen.tsx lib/content/rich-text-mentions.ts lib/convex/client/work.ts lib/domain/types-internal/schemas.ts lib/store/app-store-internal/slices/work-item-actions.ts lib/store/app-store-internal/types.ts tests/app/api/asset-notification-invite-route-contracts.test.ts tests/lib/content/rich-text-mentions.test.ts tests/lib/domain/project-views.test.ts tests/lib/store/work-item-actions.test.ts`
  - `pnpm exec vitest run tests/app/api/asset-notification-invite-route-contracts.test.ts tests/lib/content/rich-text-mentions.test.ts tests/lib/domain/project-views.test.ts tests/lib/store/work-item-actions.test.ts tests/components/work-item-detail-screen.test.tsx`
  - `pnpm exec vitest run tests/components/create-dialogs.test.tsx`
  - `git diff --check -- . ':!.reviews/'`

## Turn 7 — 2026-04-18 18:21:27 BST

| Field | Value |
|-------|-------|
| **Commit** | `32f68ea` (working tree updated after this base) |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** Reviewed the next PR-analysis batch and confirmed three live defects plus one low-risk cleanup item. The work-item create dialog still had an unimported root-type helper in the team-switch path, so changing team space with an `initialType` set could throw at runtime. The persisted filter-key guard in the shared screen helpers had not been updated with the newer project/view filter keys, which left a latent persistence trap for those filters. And `updateViewConfig()` was still spreading `showCompleted` as a stray top-level property instead of keeping it solely in `view.filters`. I fixed those three issues, cleaned up the transient fallback project-view timestamps, and re-ran the targeted review suite. The remaining notes in this batch were either already addressed, intentionally changed product behavior, or safe because the access control lives in the server mutation layer.

| Status | Count |
|--------|-------|
| New findings | 3 |
| Resolved during Turn 7 | 3 |
| Carried from Turn 6 | 0 |
| Accepted | 0 |

### Resolved during Turn 7

#### F7-01 ~~[BUG] High~~ → RESOLVED — Switching team space in the work-item create dialog could throw because the root-type helper was never imported
**Where:** [components/app/screens/create-work-item-dialog.tsx](../components/app/screens/create-work-item-dialog.tsx:13), [tests/components/create-dialogs.test.tsx](../tests/components/create-dialogs.test.tsx:1)

**What was wrong:** `syncTeamSelection()` called `getDefaultRootWorkItemTypesForTeamExperience()` when recalculating the item type for the newly selected team, but the symbol was missing from the module imports. That path only runs after the user changes the team selector, so the dialog could render fine initially and then throw a `ReferenceError` as soon as the team changed while `initialType` was set.

**How it was fixed:** [CreateWorkItemDialog](../components/app/screens/create-work-item-dialog.tsx:13) now imports the root-type helper directly from the domain types module. I also hardened the dialog regression test by replacing the brittle Radix-portal interaction with a lightweight native-select test double in [create-dialogs.test.tsx](../tests/components/create-dialogs.test.tsx:1), so the test exercises the team-switch code path deterministically in jsdom.

**Verified:** Added team-switch coverage in [create-dialogs.test.tsx](../tests/components/create-dialogs.test.tsx:220), then ran:
- `pnpm exec vitest run tests/components/create-dialogs.test.tsx`
- `pnpm exec eslint components/app/screens/create-work-item-dialog.tsx tests/components/create-dialogs.test.tsx`

#### F7-02 ~~[BUG] Medium~~ → RESOLVED — Persisted view-filter guard was missing newer filter keys, leaving a latent persistence trap
**Where:** [components/app/screens/helpers.ts](../components/app/screens/helpers.ts:34), [tests/components/screen-helpers.test.ts](../tests/components/screen-helpers.test.ts:1)

**What was wrong:** `PersistedViewFilterKey` and `isPersistedViewFilterKey()` still only covered the original filter set. The newer persisted filters (`creatorIds`, `leadIds`, `health`, `milestoneIds`, `relationTypes`, `teamIds`) were already supported elsewhere in the view model, but anything routed through the shared `FilterPopover` guard would have been treated as non-persisted and silently skipped.

**How it was fixed:** [helpers.ts](../components/app/screens/helpers.ts:34) now includes the full persisted filter-key set in both the type union and the runtime guard. I added focused coverage in [screen-helpers.test.ts](../tests/components/screen-helpers.test.ts:1) so future filter additions have a regression check at the helper boundary.

**Verified:** Added guard coverage in [screen-helpers.test.ts](../tests/components/screen-helpers.test.ts:1), then ran:
- `pnpm exec vitest run tests/components/screen-helpers.test.ts`
- `pnpm exec eslint components/app/screens/helpers.ts tests/components/screen-helpers.test.ts`

#### F7-03 ~~[BUG] Medium~~ → RESOLVED — `updateViewConfig()` leaked `showCompleted` as a stray top-level property on the view object
**Where:** [lib/store/app-store-internal/slices/views.ts](../lib/store/app-store-internal/slices/views.ts:133), [tests/lib/store/view-slice.test.ts](../tests/lib/store/view-slice.test.ts:101)

**What was wrong:** The optimistic `updateViewConfig()` path spread the raw `patch` onto the view object before rebuilding `filters.showCompleted`. That left `showCompleted` duplicated at both `view.showCompleted` and `view.filters.showCompleted`. The top-level field was ignored by current readers, but it polluted the object shape and risked confusing future serialization or debugging.

**How it was fixed:** [updateViewConfig](../lib/store/app-store-internal/slices/views.ts:133) now destructures `showCompleted` out of the patch, spreads only the remaining view fields, and writes `showCompleted` exclusively inside `filters`. The store regression test in [view-slice.test.ts](../tests/lib/store/view-slice.test.ts:101) asserts that the top-level property is no longer present after an update.

**Verified:** Added slice coverage in [view-slice.test.ts](../tests/lib/store/view-slice.test.ts:101), then ran:
- `pnpm exec vitest run tests/lib/store/view-slice.test.ts`
- `pnpm exec eslint lib/store/app-store-internal/slices/views.ts tests/lib/store/view-slice.test.ts`

### Remaining notes classified

- The label-route workspace override is safe in the current architecture. [createLabelHandler](../convex/app/workspace_team_handlers.ts:148) still enforces `requireEditableWorkspaceAccess()` on the target workspace, so route-level trust is not being widened without a downstream authorization check.
- The status-change notification shift to the assignee is intentional and matches the requested product behavior plus the current client/server tests.
- Excluding `activeCreateDialog` from persisted UI state is correct-by-design.
- Defaulting new/rejoined users to `offline` is intentional and matches the requested presence semantics.
- The `normalizeResendFrom` display-name note is a behavioral change, but this review pass did not confirm a new code defect from it.
- The async `createDocument` return type is intentional and the known UI caller awaits it.
- The “pending mention retries are lost on navigation” note remains an accepted best-effort trade-off for local retry state; this pass did not surface a correctness regression from it.
- The `cloneViewFilters` note was stale. [cloneViewFilters](../components/app/screens/helpers.ts:62) already copies the newer filter fields.
- The previous presence-effect dependency concern was already addressed by reading `currentUserId` through a dedicated selector in the work-item screen.
- As a small hygiene cleanup, the fallback project view in [components/app/screens.tsx](../components/app/screens.tsx:244) now uses a live timestamp instead of a hardcoded date literal.

### Verification approach

- Re-reviewed the current diff against the latest external PR-analysis notes instead of assuming they were all still live
- Applied the fixes in the existing architecture seams:
  - domain helper imports stay explicit at the presentation boundary
  - persisted filter policy stays centralized in shared view-helper code
  - view filter shape stays normalized in the store slice
- Re-ran focused verification:
  - `pnpm exec eslint components/app/screens/create-work-item-dialog.tsx components/app/screens/helpers.ts components/app/screens.tsx lib/store/app-store-internal/slices/views.ts tests/components/create-dialogs.test.tsx tests/components/screen-helpers.test.ts tests/lib/store/view-slice.test.ts`
  - `pnpm exec vitest run tests/components/create-dialogs.test.tsx tests/components/screen-helpers.test.ts tests/lib/store/view-slice.test.ts tests/app/api/asset-notification-invite-route-contracts.test.ts tests/lib/content/rich-text-mentions.test.ts tests/lib/domain/project-views.test.ts tests/lib/store/work-item-actions.test.ts tests/components/work-item-detail-screen.test.tsx`
  - `git diff --check -- . ':!.reviews/'`

## Turn 8 — 2026-04-18 18:40:38 BST

| Field | Value |
|-------|-------|
| **Commit** | `6a69029` (working tree updated after this base) |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** Re-reviewed the next PR-analysis batch and fixed the live defects in the view stack. The optimistic view-create path still had no rollback on server failure, so a rejected create could leave a ghost view selected locally. Project detail was still deriving the fallback item level from team experience even for workspace-scoped projects, which silently defaulted workspace project views to software-delivery. Child disclosure rows were still bypassing the active view filters, so hidden children could leak under visible parents. I fixed all three, and I also hardened the create-view dialog so its scope options react to current membership state instead of memoizing against `useAppStore.getState()`, plus memoized the fallback project view object to avoid a new object on every render.

| Status | Count |
|--------|-------|
| New findings | 4 |
| Resolved during Turn 8 | 4 |
| Carried from Turn 7 | 0 |
| Accepted | 0 |

### Resolved during Turn 8

#### F8-01 ~~[BUG] High~~ → RESOLVED — Optimistic views were never rolled back when server-side creation failed
**Where:** [lib/store/app-store-internal/slices/views.ts](../lib/store/app-store-internal/slices/views.ts:88), [tests/lib/store/view-slice.test.ts](../tests/lib/store/view-slice.test.ts:118)

**What was wrong:** `createView()` optimistically appended the new view and selected it for the route, but the background sync path only showed a toast on failure. If the create mutation was rejected on the server, the local view stayed in `state.views` and remained selected until a later full refresh.

**How it was fixed:** [createView](../lib/store/app-store-internal/slices/views.ts:88) now snapshots the previously selected route view, and the background create promise explicitly rolls back both the optimistic view record and the route selection before rethrowing into the standard sync-failure handler. The store now behaves like the document create flow: optimistic first, but reverted locally if persistence fails.

**Verified:** Added rollback coverage in [view-slice.test.ts](../tests/lib/store/view-slice.test.ts:118), then ran:
- `pnpm exec vitest run tests/lib/store/view-slice.test.ts`
- `pnpm exec eslint lib/store/app-store-internal/slices/views.ts tests/lib/store/view-slice.test.ts`

#### F8-02 ~~[BUG] High~~ → RESOLVED — Workspace-scoped project detail views still defaulted to software-delivery item levels
**Where:** [components/app/screens/project-detail-screen.tsx](../components/app/screens/project-detail-screen.tsx:205), [lib/domain/types-internal/work.ts](../lib/domain/types-internal/work.ts:107), [tests/lib/domain/project-views.test.ts](../tests/lib/domain/project-views.test.ts:203)

**What was wrong:** When a project presentation omitted `itemLevel`, project detail always derived the default from `team?.settings.experience`. For workspace-scoped projects, `team` is `null`, so the helper fell back to `software-development` and defaulted the fallback view to `epic`, even for task-based or issue-based project templates.

**How it was fixed:** I moved the fallback rule into the domain layer by adding [getDefaultViewItemLevelForProjectTemplate](../lib/domain/types-internal/work.ts:107). [ProjectDetailScreen](../components/app/screens/project-detail-screen.tsx:205) now prefers team experience when a team exists, but falls back to the project’s own `templateType` when it does not. That keeps workspace project detail views aligned with the actual project model instead of a team-only assumption.

**Verified:** Added workspace-project coverage in [project-views.test.ts](../tests/lib/domain/project-views.test.ts:203), then ran:
- `pnpm exec vitest run tests/lib/domain/project-views.test.ts`
- `pnpm exec eslint components/app/screens/project-detail-screen.tsx lib/domain/types-internal/work.ts tests/lib/domain/project-views.test.ts`

#### F8-03 ~~[BUG] High~~ → RESOLVED — Child disclosure rows ignored active view filters
**Where:** [lib/domain/selectors-internal/work-items.ts](../lib/domain/selectors-internal/work-items.ts:64), [components/app/screens/work-surface-view.tsx](../components/app/screens/work-surface-view.tsx:253), [tests/lib/domain/view-item-level.test.ts](../tests/lib/domain/view-item-level.test.ts:175)

**What was wrong:** The child-disclosure selector only filtered by `parentId` and allowed child type. That meant children excluded by `showCompleted`, assignee filters, labels, or other view predicates could still appear under a visible parent, which diverged from the active view semantics.

**How it was fixed:** [itemMatchesView](../lib/domain/selectors-internal/work-items.ts:92) now supports an `ignoreItemLevel` mode, and [getDirectChildWorkItemsForDisplay](../lib/domain/selectors-internal/work-items.ts:64) uses it when a view is supplied. [WorkItemChildDisclosure](../components/app/screens/work-surface-view.tsx:954) now passes the active view down to the selector, so child rows respect the same filters as the parent container while still bypassing the parent-level `itemLevel` restriction that would otherwise suppress all children.

**Verified:** Added disclosure-filter coverage in [view-item-level.test.ts](../tests/lib/domain/view-item-level.test.ts:175), then ran:
- `pnpm exec vitest run tests/lib/domain/view-item-level.test.ts`
- `pnpm exec eslint lib/domain/selectors-internal/work-items.ts components/app/screens/work-surface-view.tsx tests/lib/domain/view-item-level.test.ts`

#### F8-04 ~~[BUG] Medium~~ → RESOLVED — Create-view scope options could go stale because they were memoized against `useAppStore.getState()`
**Where:** [components/app/screens/create-view-dialog.tsx](../components/app/screens/create-view-dialog.tsx:41)

**What was wrong:** `CreateViewDialog` built `scopeOptions` from `teams` and `workspace`, but permission checks were reading from `useAppStore.getState()` inside `useMemo()`. That meant membership or role changes could leave the dialog using stale scope/editability decisions until some unrelated dependency changed.

**How it was fixed:** [CreateViewDialog](../components/app/screens/create-view-dialog.tsx:41) now derives editable teams through the reactive `getEditableTeamsForFeature()` selector and reads workspace editability from a dedicated store selector. The dialog no longer closes over a static store snapshot for permission decisions.

**Verified:** Covered indirectly in the focused lint/test pass below:
- `pnpm exec eslint components/app/screens/create-view-dialog.tsx`

### Remaining notes classified

- The dialog/sheet blur change is a deliberate cross-cutting fix for the aria-hidden focus warnings that were surfacing when modals opened over focused inputs. This pass did not confirm a new behavioral regression from that change.
- The label-route workspace override remains safe because [createLabelHandler](../convex/app/workspace_team_handlers.ts:148) still enforces editable workspace access on the target workspace.
- Assignee-targeted status notifications are intentional and match the requested product behavior.
- Excluding `activeCreateDialog` from persistence is correct-by-design.
- Including workspace-scoped views in workspace view queries is intentional and required for the newer shared workspace views.
- Defaulting new or re-bootstrapped users to `offline` is intentional.
- The `normalizeResendFrom` behavioral note is still not confirmed as a new code defect in this branch.
- The `createDocument` async return type remains intentional.
- Team-only project creation remains an intentional contract tightening.
- The work-item title spread-order note is fragile style, but this pass did not surface a live correctness regression from it.
- Self-assignment notifications are intentional.
- Pending mention retry loss across full unmount/navigation remains an accepted best-effort trade-off for local retry state.
- The persisted-filter-key and `cloneViewFilters` notes were already resolved/stale in prior turns.
- The previous hardcoded fallback project-view timestamp note was already resolved in Turn 7; this pass further memoized the fallback view object in [screens.tsx](../components/app/screens.tsx:248) so it no longer re-materializes on every render.
- The previous presence dependency concern was already handled in an earlier turn.

### Verification approach

- Re-reviewed the current diff against the new PR-analysis notes instead of assuming the earlier fixes covered them
- Applied the fixes in the correct layer for each problem:
  - optimistic-create rollback in the application/store slice
  - project-detail default-level rules in the domain/work helper layer
  - child disclosure filtering in the selector layer
  - reactive permission gating in the create-view presentation layer
- Re-ran focused verification:
  - `pnpm exec eslint lib/store/app-store-internal/slices/views.ts components/app/screens/create-view-dialog.tsx components/app/screens/project-detail-screen.tsx components/app/screens/work-surface-view.tsx components/app/screens.tsx lib/domain/selectors-internal/work-items.ts lib/domain/types-internal/work.ts tests/lib/store/view-slice.test.ts tests/lib/domain/project-views.test.ts tests/lib/domain/view-item-level.test.ts`
  - `pnpm exec vitest run tests/lib/store/view-slice.test.ts tests/lib/domain/project-views.test.ts tests/lib/domain/view-item-level.test.ts tests/components/work-item-detail-screen.test.tsx tests/lib/store/work-item-actions.test.ts`
  - `git diff --check -- . ':!.reviews/'`

## Turn 9 — 2026-04-18 19:03:28 BST

| Field | Value |
|-------|-------|
| **Commit** | `a4e93c4` (working tree updated after this base) |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** Re-reviewed the newest note set against the current branch. Most of the list was already resolved or intentionally changed in earlier turns. Two live issues remained: the optimistic view-create rollback now also caught reconciliation failures after a successful create, and the shell still had one non-reactive `useAppStore.getState()` permission check for workspace view creation. I fixed both. Everything else in this batch was either stale, already documented as intentional, or a known trade-off rather than a new regression.

| Status | Count |
|--------|-------|
| New findings | 2 |
| Resolved during Turn 9 | 2 |
| Carried from Turn 8 | 0 |
| Accepted | 0 |

### Resolved during Turn 9

#### F9-01 ~~[BUG] High~~ → RESOLVED — View-create rollback was also firing on reconciliation refresh failure after a successful create
**Where:** [lib/store/app-store-internal/slices/views.ts](../lib/store/app-store-internal/slices/views.ts:118), [tests/lib/store/view-slice.test.ts](../tests/lib/store/view-slice.test.ts:118)

**What was wrong:** The new rollback logic correctly handled server-side create failures, but the chained `.catch()` also caught errors thrown by `refreshFromServer()` when the server returned a different persisted ID. In that case the view had already been created successfully on the server, yet the client removed the optimistic view and restored the previous selection as if creation had failed.

**How it was fixed:** [createView](../lib/store/app-store-internal/slices/views.ts:118) now handles post-create reconciliation failures inside the success branch and reports them as a refresh problem without rethrowing into the rollback path. Only a failed `syncCreateView()` call now triggers optimistic rollback. The regression test in [view-slice.test.ts](../tests/lib/store/view-slice.test.ts:118) covers the successful-create / failed-refresh case directly.

**Verified:** Added refresh-failure coverage in [view-slice.test.ts](../tests/lib/store/view-slice.test.ts:118), then ran:
- `pnpm exec vitest run tests/lib/store/view-slice.test.ts`
- `pnpm exec eslint lib/store/app-store-internal/slices/views.ts tests/lib/store/view-slice.test.ts`

#### F9-02 ~~[BUG] Low~~ → RESOLVED — Shell still used a non-reactive store snapshot for workspace view-create permissions
**Where:** [components/app/shell.tsx](../components/app/shell.tsx:420)

**What was wrong:** `buildGlobalCreateActions()` still built `workspaceViewOption` from `canEditWorkspace(useAppStore.getState(), workspace.id)` inside the shell render path. That left one stale permission check in the main create-action surface even after the create-view dialog had been corrected to use reactive selectors.

**How it was fixed:** [AppShell](../components/app/shell.tsx:420) now uses the existing reactive app snapshot (`data`) for the workspace editability check, so the create-action policy no longer mixes reactive and non-reactive permission sources in the same flow.

**Verified:** Covered by focused lint:
- `pnpm exec eslint components/app/shell.tsx`

### Remaining notes classified

- The older “optimistic view not rolled back on server failure” note is now stale; that rollback path was fixed in Turn 8 and remains covered by [view-slice.test.ts](../tests/lib/store/view-slice.test.ts:167).
- The project-detail `null` `itemLevel` note is stale; that path was fixed in Turns 6 and 8.
- The dialog/sheet blur behavior remains an intentional cross-cutting fix for modal focus handoff.
- The label-route workspace override remains safe because the downstream Convex mutation still enforces editable workspace access.
- Status-change notifications targeting the assignee are intentional.
- The main-section save path keeping optimistic draft state until reconciliation is an acceptable trade-off in this UI: the user remains in edit mode with their draft preserved, and the failure path already triggers reconciliation from the server rather than silently committing bad state.
- The top-level fallback in [getVisibleItemsForView](../lib/domain/selectors-internal/work-items.ts:208) is intentional under the new “highest parent” model, with normalization/defaulting covering the supported view types.
- `activeCreateDialog` non-persistence is correct-by-design.
- Workspace view queries including workspace-scoped views are intentional.
- Offline default status remains intentional.
- The `CreateViewDialog` `getState()` note is stale; it was fixed in Turn 8.
- The fallback project-view memoization note is an acceptable minor efficiency trade-off now that the object is memoized; it only re-materializes when its effective layout input changes.
- The remaining notes about `createDocument`, project scope tightening, title spread order, self-assignment notifications, pending mention retry loss on full unmount, helper filter keys, clone-view filters, hardcoded timestamps, `showCompleted` leakage, and the presence dependency are all already resolved, intentional, or previously classified.

### Verification approach

- Re-reviewed the newest note set against the current branch rather than assuming older comments still applied
- Applied the fixes in the right boundaries:
  - optimistic-create success vs rollback paths separated inside the view store slice
  - workspace create-action permission check aligned with the reactive app snapshot already used elsewhere in the shell
- Re-ran focused verification:
  - `pnpm exec eslint lib/store/app-store-internal/slices/views.ts tests/lib/store/view-slice.test.ts components/app/shell.tsx`
  - `pnpm exec vitest run tests/lib/store/view-slice.test.ts`
  - `git diff --check -- . ':!.reviews/'`

## Turn 10 — 2026-04-18 19:17:41 BST

| Field | Value |
|-------|-------|
| **Commit** | `6b4bf6b` (working tree updated after this base) |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** Re-reviewed the next batch and confirmed one live UI bug in project detail. When a project had no persisted presentation, the screen rebuilt the fallback presentation object on every render and included that unstable object in the reset-effect dependency list. That could keep resetting the local items layout/filter state and effectively block interaction with the project items tab until a real presentation was persisted. I memoized the fallback presentation and added a component-level regression test. The rest of the list was stale, already fixed, intentionally changed behavior, or a previously accepted trade-off.

| Status | Count |
|--------|-------|
| New findings | 1 |
| Resolved during Turn 10 | 1 |
| Carried from Turn 9 | 0 |
| Accepted | 0 |

### Resolved during Turn 10

#### F10-01 ~~[BUG] High~~ → RESOLVED — Project-detail reset effect depended on an unstable fallback presentation object
**Where:** [components/app/screens/project-detail-screen.tsx](../components/app/screens/project-detail-screen.tsx:70), [tests/components/project-detail-screen.test.tsx](../tests/components/project-detail-screen.test.tsx:1)

**What was wrong:** For projects without a persisted `presentation`, the screen created a fresh fallback presentation object inline every render and then used `defaultProjectPresentation` in the reset effect dependency list. Because the effect re-applied cloned filters and layout state, unrelated rerenders could keep snapping the local project-items configuration back to the default fallback values.

**How it was fixed:** [ProjectDetailScreen](../components/app/screens/project-detail-screen.tsx:70) now memoizes `defaultProjectPresentation` and `initialProjectPresentation` so the fallback presentation stays referentially stable until the actual project or team inputs change. The new component regression test in [project-detail-screen.test.tsx](../tests/components/project-detail-screen.test.tsx:1) verifies that switching the local item layout away from the fallback default survives an unrelated store rerender when the project has no persisted presentation.

**Verified:** Added component coverage in [project-detail-screen.test.tsx](../tests/components/project-detail-screen.test.tsx:1), then ran:
- `pnpm exec eslint components/app/screens/project-detail-screen.tsx tests/components/project-detail-screen.test.tsx`
- `pnpm exec vitest run tests/components/project-detail-screen.test.tsx tests/lib/domain/project-views.test.ts`

### Remaining notes classified

- The dialog/sheet blur behavior remains an intentional cross-cutting fix for modal focus handoff.
- The label-route workspace override remains safe because the downstream mutation still enforces editable workspace access.
- Assignee-targeted status notifications are intentional.
- The work-item main-section save path preserving the local draft until reconciliation is still an acceptable trade-off for this editing flow and keeps the user’s unsaved content visible after a failure.
- The top-level fallback in `getVisibleItemsForView()` is intentional under the new highest-parent view model.
- `activeCreateDialog` non-persistence is correct-by-design.
- Workspace view queries including workspace-scoped views are intentional.
- Offline default status remains intentional.
- `normalizeResendFrom` is still a behavioral change, but no new code defect was confirmed from it in this branch.
- The async `createDocument` return type is intentional.
- Team-only project creation remains an intentional contract tightening.
- The work-item title spread-order note is still a style concern, not a live bug in the current flow.
- Self-assignment notifications are intentional.
- The presence lifecycle note is positive, not a defect.
- Pending mention retry loss across full unmount/navigation remains an accepted best-effort trade-off.
- The persisted-filter-key, clone-view-filter, shell reactivity, create-view-dialog reactivity, hardcoded fallback timestamp, `showCompleted` leakage, and presence dependency notes are all stale because those were fixed in earlier turns.

### Verification approach

- Re-reviewed the latest batch against the current branch rather than assuming the most recent diff-review turn covered it
- Applied the fix in the presentation layer where the unstable object was being created
- Re-ran focused verification:
  - `pnpm exec eslint components/app/screens/project-detail-screen.tsx tests/components/project-detail-screen.test.tsx`
  - `pnpm exec vitest run tests/components/project-detail-screen.test.tsx tests/lib/domain/project-views.test.ts`
  - `git diff --check -- . ':!.reviews/'`

## Turn 11 — 2026-04-18 19:33:41 BST

| Field | Value |
|-------|-------|
| **Commit** | `00bc3ac` (working tree updated after this base) |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** Re-reviewed the latest batch and confirmed one live correctness bug in the work-item mention retry flow. The screen still stored retry state as a single global `itemId + entries` pair, so saving a different item without mentions could clear the pending retry state for the original item. I moved that retry state to be item-keyed and added a component regression test that switches between items to prove the retry survives. The rest of the list was stale, intentionally changed behavior, or a previously accepted trade-off.

| Status | Count |
|--------|-------|
| New findings | 1 |
| Resolved during Turn 11 | 1 |
| Carried from Turn 10 | 0 |
| Accepted | 0 |

### Resolved during Turn 11

#### F11-01 ~~[BUG] High~~ → RESOLVED — Saving a different item without mentions could wipe stored mention retries for the original item
**Where:** [components/app/screens/work-item-detail-screen.tsx](../components/app/screens/work-item-detail-screen.tsx:135), [tests/components/work-item-detail-screen.test.tsx](../tests/components/work-item-detail-screen.test.tsx:495)

**What was wrong:** The screen tracked failed mention-delivery retries as one global `mainPendingMentionRetryItemId` plus one shared `mainPendingMentionRetryEntries` array. If mention delivery failed on item A, then the user navigated to item B and saved it without mentions, the “no pending mentions” branch cleared the shared retry buffer and silently dropped A’s retries.

**How it was fixed:** [WorkItemDetailScreen](../components/app/screens/work-item-detail-screen.tsx:135) now stores pending mention retries in a per-item map keyed by item ID. Saves now only clear or replace retry entries for the item being saved, so other items’ retry state remains intact. The new regression test in [work-item-detail-screen.test.tsx](../tests/components/work-item-detail-screen.test.tsx:495) fails mention delivery on one item, saves another item without mentions, then returns to the original item and verifies the retry is still delivered on the next save.

**Verified:** Added cross-item retry coverage in [work-item-detail-screen.test.tsx](../tests/components/work-item-detail-screen.test.tsx:495), then ran:
- `pnpm exec eslint components/app/screens/work-item-detail-screen.tsx tests/components/work-item-detail-screen.test.tsx`
- `pnpm exec vitest run tests/components/work-item-detail-screen.test.tsx tests/lib/content/rich-text-mentions.test.ts`

### Remaining notes classified

- The dialog/sheet blur behavior remains an intentional cross-cutting fix for modal focus handoff.
- The label-route workspace override remains safe because the downstream mutation still enforces editable workspace access.
- Assignee-targeted status notifications are intentional.
- The work-item main-section save path preserving the local draft until reconciliation is still an accepted trade-off for this editing flow.
- The top-level fallback in `getVisibleItemsForView()` remains intentional under the highest-parent model.
- `activeCreateDialog` non-persistence is correct-by-design.
- Workspace view queries including workspace-scoped views are intentional.
- Offline default status remains intentional.
- The create-work-item parent-options performance note is valid as a future optimization opportunity, but it is not a correctness bug in this branch.
- The `normalizeResendFrom` note is still a behavioral change without a newly confirmed code defect in this branch.
- The fallback project-view memoization-on-layout note is a minor efficiency concern, not a correctness issue.
- The async `createDocument` return type is intentional.
- Team-only project creation remains an intentional contract tightening.
- Optimistic success toasts before server confirmation are part of the existing optimistic UX pattern.
- The work-item title spread-order note remains a style concern, not a live bug in the current flow.
- Self-assignment notifications are intentional.
- The presence lifecycle note is positive, not a defect.
- The older note about retry entries becoming inert on item navigation is now partly improved by the per-item retry map, though full unmount/navigation still remains a best-effort local-state trade-off.
- The persisted-filter-key, clone-view-filter, shell reactivity, create-view-dialog reactivity, hardcoded fallback timestamp, `showCompleted` leakage, and presence dependency notes are all stale because they were fixed in earlier turns.

### Verification approach

- Re-reviewed the latest note set against the current branch rather than assuming it was covered by the previous turn
- Applied the fix in the screen state model where retry ownership actually lived
- Re-ran focused verification:
  - `pnpm exec eslint components/app/screens/work-item-detail-screen.tsx tests/components/work-item-detail-screen.test.tsx`
  - `pnpm exec vitest run tests/components/work-item-detail-screen.test.tsx tests/lib/content/rich-text-mentions.test.ts`
  - `git diff --check -- . ':!.reviews/'`

## Turn 12 — 2026-04-18 19:46:59 BST

| Field | Value |
|-------|-------|
| **Commit** | `ec98c06` (working tree updated after this base) |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** Re-reviewed the newest batch and confirmed one additional live bug in the optimistic work-item main-section save flow. A failed optimistic save could leave the local `updatedAt` ahead of the server, which in turn poisoned the component’s stale-draft detection and could trap the user in a conflict/reload loop. I fixed that by rolling the optimistic work item and description document back inside the slice before surfacing the failure. The rest of this batch was stale, intentional, or previously accepted/documented.

| Status | Count |
|--------|-------|
| New findings | 1 |
| Resolved during Turn 12 | 1 |
| Carried from Turn 11 | 0 |
| Accepted | 0 |

### Resolved during Turn 12

#### F12-01 ~~[BUG] High~~ → RESOLVED — Failed optimistic main-section saves could poison `updatedAt` locally and trap the editor in a false stale/conflict loop
**Where:** [lib/store/app-store-internal/slices/work-document-actions.ts](../lib/store/app-store-internal/slices/work-document-actions.ts:306), [tests/lib/store/work-document-actions.test.ts](../tests/lib/store/work-document-actions.test.ts:427)

**What was wrong:** `saveWorkItemMainSection()` optimistically updated both the work item and its description document before calling `syncUpdateWorkItem()`, but on failure it only delegated to `runtime.handleSyncFailure()`. That meant the locally optimistic `updatedAt`, title, and description could remain in the store until a later refresh reconciled them. In the work-item screen, this could make the user’s own failed save look like a remote change and disable Save behind a misleading stale-draft warning.

**How it was fixed:** [saveWorkItemMainSection](../lib/store/app-store-internal/slices/work-document-actions.ts:306) now snapshots the previous work item and description document and restores both immediately in the `catch` path before surfacing the sync failure. The optimistic write is therefore owned and reversed within the same application-layer action that created it, which keeps the local `updatedAt` aligned with the server when the mutation fails.

**Verified:** Strengthened the existing conflict regression in [work-document-actions.test.ts](../tests/lib/store/work-document-actions.test.ts:427) to assert rollback of both the work item and the description document, then ran:
- `pnpm exec eslint lib/store/app-store-internal/slices/work-document-actions.ts tests/lib/store/work-document-actions.test.ts`
- `pnpm exec vitest run tests/lib/store/work-document-actions.test.ts`

### Remaining notes classified

- The older notes about optimistic view rollback, refresh-after-create rollback, project-detail `itemLevel`, shell reactivity, create-view dialog reactivity, hardcoded fallback timestamps, `showCompleted` leakage, persisted filter keys, clone-view filters, and work-item mention retry ownership are all stale because they were fixed in earlier turns.
- The dialog/sheet blur behavior remains an intentional cross-cutting fix for modal focus handoff.
- The label-route workspace override remains safe because the downstream mutation still enforces editable workspace access.
- Assignee-targeted status notifications are intentional.
- The top-level fallback in `getVisibleItemsForView()` remains intentional under the highest-parent model.
- `activeCreateDialog` non-persistence is correct-by-design.
- Workspace view queries including workspace-scoped views are intentional.
- Offline default status remains intentional.
- The create-work-item parent-options performance note is a valid future optimization, not a correctness bug.
- The `normalizeResendFrom` note is still a behavioral change without a newly confirmed defect in this branch.
- The fallback project-view `createdAt` timestamp note is only a minor transient-object detail now that the fallback is memoized.
- The async `createDocument` return type is intentional.
- Team-only project creation remains an intentional contract tightening.
- Optimistic success toasts before server confirmation are part of the existing optimistic UX pattern.
- `clearViewFilters` preserving `showCompleted` is a consistent design choice, not a bug.
- The work-item title spread-order note remains a style concern, not a live defect in the current flow.
- Self-assignment notifications are intentional.
- The positive presence-lifecycle note is not a defect.

### Verification approach

- Re-reviewed the newest note set against the current branch instead of assuming the latest push had closed everything
- Applied the fix at the application/store boundary where the optimistic write is owned
- Re-ran focused verification:
  - `pnpm exec eslint lib/store/app-store-internal/slices/work-document-actions.ts tests/lib/store/work-document-actions.test.ts`
  - `pnpm exec vitest run tests/lib/store/work-document-actions.test.ts`
  - `git diff --check -- . ':!.reviews/'`
