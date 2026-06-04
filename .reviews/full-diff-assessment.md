# Full Diff Assessment Review

Date: 2026-06-04
Branch: main
HEAD: aa48536f
Status: final deep implementation review complete; no open diff-specific Critical/High/Medium findings
Review lens: diff-review, architecture-standards, Fallow

## Scope Notes

- Reviewed the dirty tree across chat read receipts, scoped read models, rich text uploads/attachments, comments, channel posts, documents, store reducers, tests, and new spec/review artifacts.
- Earlier Git object/ref corruption is fixed in this working copy. `git fsck --full --no-dangling` now passes.
- User-confirmed read receipt rule for this pass: show only that another user has seen the current user's message; do not show/read/write read receipts on TeamSpace/team chats.
- Prior Turn 2 duplication caveat is superseded: full Fallow duplication now passes at `clone_groups=0/0`, `duplicated_lines=0/0`, `duplication_percentage=0.00%`.

## Turn 3 - 2026-06-04 15:43 BST

**Outcome:** Branch-total deep diff review loop completed after the zero-duplication remediation pass. The full local working tree was revalidated and no open diff-specific Critical, High, or Medium findings remain.

**Risk score:** high — this branch remains broad: Convex cleanup/deletion semantics, scoped read-model materialization, chat/read-receipt authority, rich-text attachment persistence, store optimistic writes, Electron packaging scripts, and shared presentation surfaces all changed.

**Deep-review evidence:** dual pass completed. Pass A rechecked correctness/safety across read receipts, attachment last-reference deletion, rich-text storage sanitization, comment emptiness after upload prep, scoped read-model access summary mocks/materialization, and async refresh behavior. Pass B rechecked maintainability/structure for the Fallow cleanup: production helpers stayed owner-local, test helpers stayed test-suite-local, and unused public exports were narrowed rather than suppressed.

**Static-analysis evidence:** current Fallow gates are clean and mode-separated:

- `pnpm fallow:dupes` — passed, `clone_groups=0/0`, `duplicated_lines=0/0`.
- `pnpm fallow:dead-code` — passed, `0` issues.
- `pnpm fallow:health` — passed, production zero-findings gate, `findings=0`, `functions_above_threshold=0`, `score=95.7`, `grade=A`.

**Fixes applied in this turn:**

- Reduced full Fallow duplication from the previously recorded 79 clone groups to zero with owner-local production/test refactors.
- Removed unused public exports exposed by the refactor pass in `lib/domain/notifications.ts` and `scripts/shared/electron-desktop-build.mjs`.
- Added missing scoped-read-model handler test coverage for the new `loadUserWorkspaceAccessSummary` data boundary.
- Fixed async work-item detail comment test timing so it waits for the store mutation before asserting.

**Branch totality:** reviewed current local diff state, not just latest Fallow cleanup files. Prior scoped review ledgers were re-read, their open findings were checked, and the stale full-duplication caveat was replaced with current gate evidence.

**Challenger pass:** done — assumed the remaining issue would be introduced by the cleanup work rather than the original product diff. The sweep found dead-code export leakage and two test validation regressions; those were fixed and revalidated.

**Residual risk:** low for the reviewed code state. Browser visual smoke was not run for the full UI because the available prior smoke redirected to login and the user has been manually checking UI. The repository remains in a mixed staged/unstaged state, but validation covered the complete local working tree.

**Verification:**

- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm fallow:dupes` — passed, zero clone budget.
- `pnpm fallow:dead-code` — passed.
- `pnpm fallow:health` — passed.
- `pnpm vitest tests/lib/domain/chat-read-state.test.ts tests/components/chat-thread.test.tsx tests/lib/store/collaboration-conversation-actions.test.ts tests/convex/chat-message-notifications.test.ts tests/convex/scoped-read-model-handlers.test.ts tests/lib/scoped-read-models.test.ts tests/convex/cleanup.test.ts tests/convex/document-handlers.test.ts tests/convex/comment-handlers.test.ts tests/components/rich-text-content.test.tsx tests/lib/content/html-parsing.test.ts tests/lib/content/rich-text-security.test.ts tests/lib/store/work-comment-actions.test.ts tests/lib/server/convex-documents.test.ts tests/components/workspace-chats-screen.test.tsx tests/components/collaboration-screens-loading.test.tsx tests/lib/app-store-read-model-merge.test.ts tests/lib/store/ui-slice.test.ts tests/lib/browser/desktop-download-eligibility.test.ts tests/components/work-item-menus.test.tsx tests/components/work-surface-view.test.tsx tests/components/work-item-detail-screen.test.tsx tests/components/rich-text-editor-helpers.test.tsx tests/lib/use-scoped-read-model-refresh.test.tsx tests/lib/store/work-document-actions.test.ts tests/lib/domain/rich-text-references.test.ts --run` — passed, 26 files / 415 tests.
- `git diff --check` — passed.
- `git fsck --full --no-dangling` — passed.
- `node --check scripts/shared/electron-desktop-build.mjs && node --check scripts/package-electron-mac.mjs && node --check scripts/package-electron-windows.mjs` — passed.

## Turn 2 - 2026-06-04 14:24 BST

**Outcome:** Final implementation/re-review loop completed. Live findings from the full-diff pass were fixed in code, not just recorded. No open diff-specific Critical, High, or Medium findings remain.

**Risk score:** high — the branch touches backend deletion semantics, Convex read-model materialization, optimistic chat/store writes, shared rich-text persistence, comments, and broad UI presentation surfaces.

**Architecture stance:** durable rules now sit at their owners: chat receipt admissibility is centralized in the domain/server read-state boundary; attachment storage deletion is owned by Convex cleanup/data helpers and checks sibling attachment rows by `storageId`; comment emptiness is checked after storage prep in store/server comment owners; Fallow complexity splits stayed owner-local instead of creating generic helper buckets.

**Fixes applied during review:**

- Repaired the local Git object/ref corruption and verified the repository with `git fsck --full --no-dangling`.
- Enforced read receipts only for current-user-authored messages seen by another participant in workspace direct/group chats; TeamSpace/team chats no longer render, optimistically write, persist, or read-model participant per-message receipts.
- Changed attachment cleanup so content deletion removes only the removed target's attachment records and deletes the stored file only when no remaining attachment records reference that `storageId`.
- Hardened rich-text parsing/storage prep so SSR/client parsing is deterministic, edit-time blob previews remain allowed, and storage-time blob URLs/malformed attachment anchors are stripped.
- Ensured work-item/document comments are rejected as empty after blob stripping, before optimistic or server persistence.
- Removed real Fallow dead-code findings and narrowed accidental test-only/public exports.
- Cleared all Fallow production health/complexity findings with owner-local refactors in scoped read models, work-surface selection, work-item detail effects, hover card rendering, desktop download targeting, and work-item menus.

**Static-analysis evidence:**

- `pnpm fallow:dead-code` passed with 0 issues.
- `pnpm fallow:health` passed with 0 functions above threshold.
- `pnpm fallow:dupes` still fails the full-repo zero budget: 79 clone groups, 3209 duplicated lines, 1.24%. JSON filtering of `/tmp/linear-fallow-dupes.json` against `git diff --name-only` found 0 clone groups touching changed files, so this is pre-existing full-repo duplicate inventory, not branch-introduced duplicate debt.

**Verification:**

- `pnpm typecheck` passed.
- `pnpm lint` passed.
- Focused Vitest suite passed: 22 files, 354 tests.
- `git diff --check` passed.
- `git fsck --full --no-dangling` passed.

**Residual risk:** Full duplication remains a repo-wide baseline issue because the configured duplication gate has a zero budget. It is not introduced or modified by this diff, but a separate duplication-remediation branch is needed before `pnpm fallow:dupes` can pass globally.

## Findings

### Resolved: TeamSpace chats still persisted and rendered per-message read receipts

Team chats were wired into the per-message receipt pipeline. `ChatThread` derived `seenMessageIds` and `readableMessageIds` for every chat conversation, then called `markChatRead(conversationId, readableMessageIds)` with no TeamSpace/team guard. The store mutation input also filtered only by message author/deletion/conversation, not by conversation variant or scope, and sent `messageIds` to Convex. The Convex writer accepted those `messageIds` for any `kind === "chat"` conversation, and the conversation-thread read model returned participant `chatReadStates` for team chat threads. Existing tests encoded this behavior for `scopeType: "team", variant: "team"`.

References:
- `components/app/collaboration-screens/chat-thread.tsx:1642`
- `components/app/collaboration-screens/chat-thread.tsx:1664`
- `components/app/collaboration-screens/chat-thread.tsx:1687`
- `lib/store/app-store-internal/slices/collaboration-conversation-actions.ts:561`
- `lib/store/app-store-internal/slices/collaboration-conversation-actions.ts:1539`
- `convex/app/chat_read_states.ts:111`
- `convex/app/chat_read_states.ts:242`
- `convex/app/scoped_read_models.ts:1103`
- `tests/lib/store/collaboration-conversation-actions.test.ts:100`
- `tests/convex/chat-message-notifications.test.ts:80`
- `tests/convex/scoped-read-model-handlers.test.ts:565`

Follow-up fix applied: added centralized `supportsChatMessageReadReceipts(conversation)` policy for workspace direct/group chats only. TeamSpace/team chats now send no message receipt IDs from the thread UI, do not optimistically write per-message receipt entries, do not persist server-side `messageReadAtById` from read-state updates, do not expose participant message read maps in thread read models, and render no seen icon. Added domain, component, store, Convex writer, Convex read-model, and local read-model tests.

### Resolved: copied attachment records need last-reference storage deletion

Clarified product model: an attachment record belongs to one message/comment/post, while the actual stored file should be deleted only when no remaining attachment records still point to that storage object. `deleteContentReferencedAttachments` currently lists attachments by target, checks whether deleted content contains each storage URL, then deletes both the attachment row and storage object. That is acceptable only while each upload URL/storage object is unique to one content item. If copy/paste creates a new attachment record pointing at the same stored file, cleanup must delete only the removed content's attachment row and delete the storage object only after confirming there are no other records with the same `storageId`.

References:
- `convex/app/cleanup.ts:589`
- `convex/app/cleanup.ts:603`
- `convex/app/cleanup.ts:613`
- `convex/app/cleanup.ts:622`
- `convex/app/collaboration_handlers.ts:1394`
- `convex/app/collaboration_handlers.ts:1977`
- `convex/app/collaboration_handlers.ts:2087`
- `convex/app/comment_handlers.ts:769`

Follow-up fix applied: added an attachment `by_storage` index and data helpers to list sibling attachment records by `storageId`. Cleanup now deletes target attachment rows, checks remaining live content and remaining attachment records for the same storage object, and deletes the stored file only when the removed row was the last reference. Document attachment deletion now uses the same last-reference rule. Added Convex regression coverage for shared-storage attachments: deleting one reference preserves storage; deleting the final reference removes storage.

### Resolved: The spec/tests still contradicted the clarified read-receipt and metadata contracts

`REQ-003` previously said current-user per-message receipts should produce seen icons, but the intended rule is only "another user has seen my message." `REQ-004` said metadata order was seen, time, edited, while the component and test asserted seen, edited, time. These artifacts would have misled the next review loop without alignment to the final product contract.

References:
- `.spec/chat-message-model-stability/requirements.md:30`
- `.spec/chat-message-model-stability/requirements.md:36`
- `components/app/collaboration-screens/chat-thread.tsx:526`
- `components/app/collaboration-screens/chat-thread.tsx:534`
- `components/app/collaboration-screens/chat-thread.tsx:542`
- `tests/components/chat-thread.test.tsx:321`

Follow-up fix applied: updated requirements/design/tasks to state that seen icons render only on current-user-authored messages seen by another participant in workspace direct/group chats, TeamSpace/team chats have no per-message receipts, and metadata order is seen icon, edited icon, then 24-hour time.

## Verification

- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `pnpm vitest tests/lib/domain/chat-read-state.test.ts tests/components/chat-thread.test.tsx tests/lib/store/collaboration-conversation-actions.test.ts tests/convex/chat-message-notifications.test.ts tests/convex/scoped-read-model-handlers.test.ts tests/lib/scoped-read-models.test.ts --run` passed after the TeamSpace read-receipt fix.
- `pnpm vitest tests/lib/domain/chat-read-state.test.ts tests/components/chat-thread.test.tsx tests/lib/store/collaboration-conversation-actions.test.ts tests/convex/chat-message-notifications.test.ts --run` passed.
- `pnpm vitest tests/lib/domain/file-uploads.test.ts tests/components/rich-text-content.test.tsx tests/components/rich-text-editor-helpers.test.tsx tests/lib/content/rich-text-security.test.ts tests/lib/store/work-comment-actions.test.ts tests/lib/store/collaboration-channel-actions.test.ts tests/convex/comment-handlers.test.ts --run` passed.
- `pnpm vitest tests/convex/scoped-read-model-handlers.test.ts tests/convex/comment-handlers.test.ts --run` passed.
- `git diff --check -- . ':(exclude)components/app/rich-text-editor/toolbar.tsx'` passed.
