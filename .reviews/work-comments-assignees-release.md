# Work Comments, Channels, and Assignees Release Review

Date: 2026-05-30
Branch: `codex/full-local-diff-review-release`
Base: `origin/main`

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
