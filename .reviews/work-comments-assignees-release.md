# Work Comments, Channels, and Assignees Release Review

Date: 2026-05-30
Branch: `codex/full-local-diff-review-release`
Base: `origin/main`

## Turn 5 - PR #44 Serialized Deferred Post Edits

External feedback:
- Codex review P2 on PR #44: after a pending channel-post create resolves, the deferred PATCH can still be in flight while later edits fall through to the normal PATCH path.
- That allowed two backend edits to race, so an older deferred payload could finish last and leave the persisted post stale.

Architecture decision:
- Kept channel-post optimistic create/edit/delete sequencing in `createCollaborationChannelActions`, which already owns local state mutation, create reconciliation, and backend sync scheduling.
- Modelled deferred post edits as a single update queue with aliases for optimistic, reconciled, and current post ids instead of adding UI blocking or backend retry behavior.
- The queue is the local ordering boundary: edits made before create settles and edits made while a deferred PATCH is in flight coalesce through the same serialized path.

Fix:
- Replaced the one-shot pending-create update map/task pair with `PendingChannelPostUpdateQueue`.
- `updateChannelPost` now detects an active queue first, updates the latest prepared payload, and returns after applying the optimistic local state.
- The deferred sync task aliases the reconciled backend id, drains the queue in order, and only sends the latest payload after any previous PATCH completes.
- Queue aliases are cleared only after the deferred create/update chain settles.
- Added a regression test proving a second edit made while the first deferred PATCH is unresolved does not send a concurrent backend call, then flushes the latest title/content afterward.
- Split repeated owned-comment lookup logic after Fallow caught introduced changed-file complexity.

Verification:
- `pnpm test tests/lib/store/collaboration-channel-actions.test.ts` passed: 16 tests.
- `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` passed with no introduced dead code, duplication, or complexity.
- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `git diff --check` passed.
- `~/.codex/skills/diff-review/scripts/review-preflight.sh` completed; changed-file audit passed.
- `~/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` completed; no branch-specific architecture blocker found beyond existing advisory baseline noise.
- `pnpm test` passed: 208 files, 1272 tests.
- `pnpm build` passed.
- `pnpm desktop:smoke` passed.

## Turn 4 - PR #44 Coalesced Pending Post Edits

External feedback:
- Codex review P2 on PR #44: multiple edits to a just-created channel post could queue multiple deferred PATCHes with captured payloads, allowing an older edit to complete after a newer one and leave backend state stale.

Architecture decision:
- The collaboration store action remains the owner of optimistic channel post lifecycle, create reconciliation, and backend sync ordering.
- Kept the fix inside `createCollaborationChannelActions`; no UI block, route workaround, or backend-only retry path was added.
- Enforced the invariant with store-level regression tests, because the risk is local optimistic state diverging from persisted backend state.

Fix:
- Pending channel-post edits now coalesce by optimistic post id while create sync is unresolved.
- Only one deferred backend update task is scheduled for a pending create.
- Later edits update the coalesced payload, and the deferred task uses the reconciled current post id plus the latest prepared title/content.
- Edit-then-delete remains covered: if the post is gone after create reconciliation, no deferred PATCH is sent.
- Extracted the repeated pending-create assertion into a test helper after Fallow caught introduced test duplication.

Verification:
- `pnpm test tests/lib/store/collaboration-channel-actions.test.ts` passed: 15 tests.
- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` passed with no introduced dead code, duplication, or complexity.
- `git diff --check` passed.
- `~/.codex/skills/diff-review/scripts/review-preflight.sh` completed; changed-file audit passed.
- `~/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` completed; no branch-specific architecture blocker found beyond existing advisory baseline noise.
- `pnpm test` passed: 208 files, 1271 tests.
- `pnpm build` passed.
- `pnpm desktop:smoke` passed when rerun in isolation after build.

## Turn 3 - Late Codex Review Follow-Up

External feedback:
- Codex review P2 on `0911b60eaf`: defer channel post edits while the post create request is still pending.

Architecture decision:
- The collaboration store action owns optimistic channel post lifecycle and local/backend sync ordering.
- Kept the fix inside `createCollaborationChannelActions`, reusing the existing pending-create reconciliation path instead of adding a backend/API workaround or UI-only block.
- Converted pending post creates from membership tracking to promise tracking so follow-up mutations can chain after create reconciliation.

Fix:
- `updateChannelPost` still applies the local optimistic edit immediately.
- Backend `syncUpdateChannelPost` now waits for the pending create promise when editing a just-published post.
- After create reconciliation, the update targets whichever id is present in local state: the original optimistic id or the returned server id.
- If create fails or the post no longer exists, the deferred edit does not issue a stale PATCH.
- Added sibling coverage for edit-then-delete while create is pending so a deferred edit cannot PATCH a post that was already removed.
- Extracted a test helper for pending post setup to avoid introducing duplicate test scaffolding.

Verification:
- `pnpm test tests/lib/store/collaboration-channel-actions.test.ts` passed: 14 tests.
- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` passed with no introduced dead code, duplication, or complexity.
- `git diff --check` passed.
- `pnpm test` passed: 208 files, 1270 tests.
- `pnpm build` passed.
- `pnpm desktop:smoke` passed.

## Turn 1 - Local Diff Review And Architecture Pass

Scope reviewed:
- Work item comment edit/delete/reply UI and backend mutations.
- Channel post/comment edit/delete UI, optimistic state, route handlers, and Convex handlers.
- Multi-assignee data model, read models, selectors, and work item surfaces.
- Private work item visibility changes and bootstrap snapshot filtering.
- Reaction hover card and desktop update surface changes.
- All local changes in the working tree, including changes outside this thread.

Findings fixed:
- Channel post create/delete ID mismatch could require deleting a newly created post twice. New posts now send the optimistic `postId` to the backend and pending-created deletes reconcile after create sync resolves.
- Unauthorized channel post deletes still scheduled backend sync and a success toast after the local ownership guard. Delete now exits before syncing when ownership fails.
- Channel post create ID conflict was not mapped to an application error. It now returns a conflict mapping instead of falling through as an internal failure.
- Comment descendant delete logic was duplicated between Convex and local store. It now uses the shared domain comment-thread helper.
- Route handlers duplicated application-context/error-handling boilerplate. Channel/comment routes now use shared app-context route helpers.
- Work item detail comment actions duplicated reply/edit/delete state across root comments and replies. Shared hooks/components now own the common mutation and icon action behavior.
- Calendar test used the current date and failed when the multi-day event crossed a week boundary. The test now uses a stable same-week date.
- Auth bootstrap test still encoded assignee-based private visibility. It now matches creator-only private work item visibility.
- Month calendar event buttons leaked `onEditItem` onto DOM buttons. Button interaction props now omit menu-only handlers.
- Changed-file Fallow issues for introduced dead code, duplication, and complexity were resolved.
- Codex PR review found that editing a newly created comment before create sync resolved could PATCH an optimistic id that the backend did not know. Work comments and channel-post comments now send client-supplied ids to the backend and defer pending-create edits/deletes until create sync settles.

Verification:
- `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` passed with no introduced dead code, duplication, or complexity.
- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `pnpm test` passed: 208 files, 1264 tests.
- `pnpm build` passed.
- `pnpm desktop:smoke` passed.

## Turn 2 - PR Review Feedback

External feedback:
- Codex review P2: avoid patching comments while their server id is unknown.
- Codex review P2: map read-only work comment edit/delete failures to 403 instead of generic 500.

Fix:
- Added backend comment id acceptance/conflict handling for work comments and channel-post comments.
- Kept optimistic ids stable across client and backend.
- Deferred edit/delete syncs for comments whose create request is still pending, while keeping local optimistic updates immediate.
- Added read-only mutation error mapping for work comment edit/delete server wrappers.

Verification:
- `pnpm test tests/lib/store/work-comment-actions.test.ts tests/lib/store/collaboration-channel-actions.test.ts tests/convex/comment-handlers.test.ts` passed.
- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` passed with no introduced issues.
- `pnpm test` passed: 208 files, 1267 tests.
- `pnpm build` passed.
- `pnpm desktop:smoke` passed.
- `git diff --check` passed.
