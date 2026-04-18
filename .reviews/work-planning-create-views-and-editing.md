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
- `components/app/screens/project-detail-screen.tsx` — project detail item views, saved view routing, create-view launch path
- `lib/domain/selectors-internal/projects.ts` — project detail route model
- `lib/domain/default-views.ts` — view-route constraints and fallback view semantics
- `components/app/screens/work-item-detail-screen.tsx` — main-section edit/save flow, mention-delivery follow-up, live concurrent editing UI
- `components/app/screens/shared.tsx` — full-row sidebar property controls
- `components/app/screens/work-surface-controls.tsx` — highest-parent configuration options
- `components/app/screens/work-surface-view.tsx` — parent-container rendering for child rows/cards
- `lib/content/rich-text-mentions.ts` — pending mention merge/filter helpers for retry-safe delivery
- `lib/store/app-store-internal/slices/work-document-actions.ts` — main-section persistence contract
- `lib/store/app-store-internal/slices/views.ts` — optimistic view creation and canonical ID sync
- `lib/store/app-store-internal/types.ts` — view-create input contract
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
- `tests/app/api/work-route-contracts.test.ts` — view-create route contract coverage

## Review status (updated every turn)

| Field | Value |
|-------|-------|
| **Review started** | `2026-04-18 14:22:31 BST` |
| **Last reviewed** | `2026-04-18 17:40:27 BST` |
| **Total turns** | `5` |
| **Open findings** | `0` |
| **Resolved findings** | `6` |
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
