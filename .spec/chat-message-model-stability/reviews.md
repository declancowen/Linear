---
title: Chat Message Model Stability Reviews
scope: chat-message-model-stability
status: implementation-ready
repo_root: /Users/declancowen/Documents/GitHub/Linear
change_class: bugfix
risk_level: medium
owner: Codex
reviewers: [diff-review, architecture-standards]
approvers: [user]
implementation_owner: Codex
operations_owner: Codex
last_updated: 2026-06-04
---

# Review Ledger

All diff-review entries in this ledger must explicitly use `architecture-standards` as the review lens.

Architecture ownership rules checked in every review:

- `conversation-list` owns preview data only.
- `conversation-thread` owns full message history.
- read receipts are owned by `chatReadStates`.
- chat UI only derives presentation state from authoritative models.

## Slice 1: Spec Setup

- Review mode: deep `diff-review` with `architecture-standards`.
- Validation: design, requirements, tasks, and review ledger audited against the user request and live repo evidence.
- Architecture lens: confirmed the spec records the ownership rules that `conversation-list` owns preview data only, `conversation-thread` owns full message history, read receipts are owned by `chatReadStates`, and chat UI only derives presentation state.
- Findings: none.
- Residual risk: none for the spec setup slice.

## Slice 2: Message Model Stability

- Review mode: deep `diff-review` with `architecture-standards`, followed by normal architecture-aware re-review.
- Linked requirements: REQ-001, REQ-002, REQ-008.
- Validation: `pnpm vitest tests/lib/app-store-read-model-merge.test.ts --run`.
- Architecture lens: `conversation-list` was reviewed as a preview-only model and must not prune `chatMessages`; `conversation-thread` remains the full-history authority and still prunes non-pending thread messages on replacement.
- Findings: none.
- Residual risk: preview messages still share the existing `chatMessages` store because this repo does not yet have a separate preview-message model; the branch contains that by skipping list-time message pruning rather than making the list authoritative over history.

## Slice 3: Seen Receipt Derivation

- Review mode: deep `diff-review` with `architecture-standards`, followed by normal architecture-aware re-review after fixes.
- Linked requirements: REQ-003, REQ-004, REQ-008.
- Validation: `pnpm vitest tests/components/chat-thread.test.tsx tests/lib/domain/chat-read-state.test.ts tests/lib/scoped-read-models.test.ts tests/convex/scoped-read-model-handlers.test.ts --run`.
- Architecture lens: read receipts remain owned by `chatReadStates`; conversation-thread read models hydrate participant read states for the active conversation; conversation-list keeps lightweight current-user read state; chat UI derives seen presentation from those records.
- Findings fixed:
  - User validation found the first seen derivation was too narrow because it ignored the current user's own per-message read receipts. Fixed `getSeenChatMessageIds` so current-user receipts render seen for visible non-deleted messages, while participant receipts render seen for current-user-authored non-deleted messages.
  - Verification gap found during final deep review. The first test set did not directly prove deleted/current-user-received/nonparticipant variants or server-side participant filtering.
- Fix: added `tests/lib/domain/chat-read-state.test.ts` for seen derivation variants, updated chat-thread coverage for current-user receipt rendering, and added a Convex scoped read-model handler test proving thread read models use `listChatReadStatesByConversation`, include current/recipient participant states, and exclude nonparticipants.
- Metadata result: seen icon, separator dot, 24-hour time-only sent stamp, separator dot, edited pencil icon. No read timestamp and no edited timestamp/text render. Message content uses a reserved `minmax(0, 1fr) max-content` metadata grid so long threads cannot overlap the stamps.
- Residual risk: participant read timestamps are present in the thread read model because that is the existing `chatReadStates` contract; the UI intentionally renders only a derived seen icon and no read timestamp.

## Slice 4: Collapsed Left Icon Rail

- Review mode: deep `diff-review` with `architecture-standards`, followed by normal architecture-aware re-review.
- Linked requirements: REQ-005, REQ-008.
- Validation: `pnpm vitest tests/components/workspace-chats-screen.test.tsx --run`.
- Architecture lens: the list pane owns chat navigation affordances and collapsed avatar rail; the thread header owns the active chat title area and collapse/expand control next to that title.
- Findings: none.
- Residual risk: browser visual smoke was attempted but blocked because no in-app browser instance was registered in this session; HTTP `/chats` returned a login redirect as expected for an unauthenticated local request.

## Slice 5: Link Mark Containment

- Review mode: deep `diff-review` with `architecture-standards`, followed by normal architecture-aware re-review.
- Linked requirements: REQ-006, REQ-008.
- Validation: `pnpm vitest tests/lib/content/rich-text-security.test.ts tests/components/chat-thread.test.tsx tests/lib/rich-text-extensions.test.ts --run`.
- Architecture lens: link mark inclusivity is enforced in the shared rich-text extension owner, while stale/overextended chat message anchor cleanup is enforced at the chat-message rich-text sanitization boundary. Generic rich-text storage remains unchanged for mixed descriptive anchors.
- Finding fixed during final deep review: mixed-anchor normalization initially also ran in the generic rich-text sanitizer, which could change non-chat rich text. Removed that generic sanitizer path and added coverage proving generic rich text preserves mixed anchors outside chat-message normalization.
- Residual risk: none identified for the changed link-mark behavior.

## Slice 6: Duplicate Cleanup

- Review mode: architecture-aware `diff-review` with `architecture-standards`.
- Linked requirements: REQ-007, REQ-008.
- Validation: `test ! -e 'convex/app 2.ts' && test ! -e 'convex/validators 2.ts'`.
- Architecture lens: removed only confirmed untracked duplicates and did not alter canonical Convex files.
- Findings: none.
- Residual risk: none.

## Slice 7: Final Total-Diff Review

- Review mode: final total-diff **deep** `diff-review` with `architecture-standards`, followed by a normal architecture-aware clean-loop re-review.
- Linked requirements: REQ-001 through REQ-008.
- Validation:
  - `pnpm vitest tests/lib/content/rich-text-security.test.ts tests/components/chat-thread.test.tsx tests/lib/rich-text-extensions.test.ts --run` — 3 files, 34 tests passed after the chat-sanitizer ownership fix.
  - `pnpm vitest tests/lib/content/rich-text-security.test.ts tests/components/chat-thread.test.tsx tests/components/workspace-chats-screen.test.tsx tests/lib/rich-text-extensions.test.ts tests/lib/domain/chat-read-state.test.ts tests/lib/app-store-read-model-merge.test.ts tests/lib/scoped-read-models.test.ts tests/convex/scoped-read-model-handlers.test.ts --run` — 8 files, 87 tests passed.
  - `pnpm typecheck` — passed.
  - `pnpm lint` — passed.
  - `git diff --check` — passed.
  - `test ! -e 'convex/app 2.ts' && test ! -e 'convex/validators 2.ts'` — passed.
  - `curl -I http://localhost:3000/chats` — local dev route responded with `307 Temporary Redirect` to login for unauthenticated access.
- Current worktree caveat: a later rerun of `pnpm typecheck` failed in out-of-scope attachment/conversation-target changes being handled in another thread. Those files were left untouched; this chat review does not claim the combined dirty worktree typechecks.
- Architecture lens: final review checked the ownership rules on the total diff: `conversation-list` owns preview data only, `conversation-thread` owns full message history, read receipts are owned by `chatReadStates`, and chat UI only derives presentation state from authoritative models.
- Pass A, correctness and safety: no open Critical/High findings. The disappearing-message root cause is closed by preventing preview read-model replacement from pruning full thread history, while thread replacement remains authoritative. Seen receipts derive from `chatReadStates` including current-user per-message receipts and participant receipts, with no read timestamp rendered. Link marks are non-inclusive and stale chat links are normalized at the chat-message sanitizer boundary. Collapsed list behavior matches the requested left icon rail.
- Pass B, maintainability and structure: no structural blocker after the sanitizer fix. The read receipt helper lives in the domain read-state module, Convex data access uses the existing indexed data helper pattern, UI changes keep navigation/list concerns separate from thread rendering, and chat-specific link cleanup no longer changes generic rich-text storage behavior.
- Findings fixed during review: current-user read receipts were initially excluded from seen derivation; generic rich-text sanitizer initially applied chat-specific mixed-anchor cleanup; missing negative/server coverage for receipt semantics. All are resolved.
- Static-analysis context: Fallow exists in this repo and preflight reported baseline advisory inventories. This branch did not change Fallow policy or claim static-remediation completion; lint/typecheck/tests are branch validation, not full static cleanliness.
- Browser smoke: attempted through the Browser skill, but the in-app browser runtime reported no available browser instances. Route-level HTTP check was used as limited fallback evidence.
- Final result: no open branch-specific findings remain after the deep architecture-aware total-diff review and normal clean-loop re-review.

## Slice 8: Final Scoped In-Thread Review

- Review mode: final scoped **deep** `diff-review` with `architecture-standards`, followed by normal architecture-aware clean-loop re-review.
- Scope boundary: attachment/rich-text upload work is explicitly excluded, including attachment hunks in mixed files. This pass covers only the chat/message stability, receipts, collapsed left icon rail/header control, chat link normalization, profile hover-card layering, sidebar email truncation, offline dot sizing, and message spacing/metadata work from this thread.
- Validation:
  - `pnpm vitest tests/lib/content/rich-text-security.test.ts tests/components/chat-thread.test.tsx tests/components/workspace-chats-screen.test.tsx tests/lib/rich-text-extensions.test.ts tests/lib/domain/chat-read-state.test.ts tests/lib/app-store-read-model-merge.test.ts tests/lib/scoped-read-models.test.ts tests/convex/scoped-read-model-handlers.test.ts tests/components/user-presence.test.tsx --run` — 9 files, 96 tests passed.
  - `pnpm typecheck` — passed.
  - `pnpm lint` — passed.
  - Scoped `git diff --check` for in-thread files — passed.
  - `test ! -e 'convex/app 2.ts' && test ! -e 'convex/validators 2.ts'` — passed.
- Architecture lens: final scoped review checked that `conversation-list` owns preview data only, `conversation-thread` owns full message history, read receipts are owned by `chatReadStates`, and chat UI only derives presentation state from those authoritative models.
- Pass A, correctness and safety: no open Critical/High findings. Preview refresh cannot prune full thread history; thread refresh remains authoritative; seen metadata renders without read timestamps; long content cannot overlay metadata; stale chat links normalize only in chat message rendering/storage; the collapsed list is a left icon rail; hover cards are portalled/front-layered; sidebar email truncates without moving the copy button.
- Pass B, maintainability and structure: no structural blocker. The read receipt helper remains in the domain read-state module, list/thread ownership remains split, profile-card layering is centralized in `UserHoverCard`, and sidebar email containment is local to the details-card row.
- Findings: none.
- Git caveat: full unscoped Git diff commands still cannot inspect `components/app/rich-text-editor/toolbar.tsx` because the index references a missing base blob. That file belongs to the separate attachment thread and is not part of this scoped review.
- Browser smoke: not run because the user explicitly asked not to worry about browser tests and is checking manually.
- Final result: no open in-thread findings remain after the deep architecture-aware scoped review and normal clean-loop re-review.

## Slice 9: Read Receipt Self-Admission Investigation

- Review mode: scoped **deep** `diff-review` with `architecture-standards`, followed by normal architecture-aware clean-loop re-review after fixes.
- Scope boundary: this pass covers only the read-receipt/message-read-model investigation from this thread: domain receipt helpers, chat-thread receipt/seen derivation, store read-state writes, Convex read-state admission, send-message self-receipt behavior, and their tests. Attachment, comments, sidebar, file-panel, and other dirty-tree changes are excluded, including unrelated hunks in mixed files.
- Validation:
  - `pnpm vitest tests/lib/domain/chat-read-state.test.ts tests/components/chat-thread.test.tsx tests/lib/store/collaboration-conversation-actions.test.ts tests/convex/chat-message-notifications.test.ts --run` — 4 files, 51 tests passed.
  - `pnpm typecheck` — passed.
  - `pnpm exec eslint lib/domain/chat-read-state.ts components/app/collaboration-screens/chat-thread.tsx lib/store/app-store-internal/slices/collaboration-conversation-actions.ts convex/app/chat_read_states.ts convex/app/collaboration_handlers.ts tests/lib/domain/chat-read-state.test.ts tests/components/chat-thread.test.tsx tests/lib/store/collaboration-conversation-actions.test.ts tests/convex/chat-message-notifications.test.ts --max-warnings 0` — passed.
  - Scoped `git diff --check` for the same receipt-related files — passed.
- Architecture lens: final scoped review checked that `conversation-list` owns preview data only, `conversation-thread` owns full message history, read receipts are owned by `chatReadStates`, and chat UI only derives presentation state from authoritative models. It also records the receipt admission rule that `messageReadAtById` may store only non-deleted messages authored by another user; sender conversation-level `readAt` must not create a self per-message receipt.
- Pass A, correctness and safety: no open Critical/High findings. ChatThread filters per-message receipt candidates to unread non-deleted messages from other users while still clearing conversation-level unread state; store optimistic writes and sync payloads use the filtered candidates; Convex enforces candidate filtering inside `markChatConversationRead`; `sendChatMessageHandler` does not seed a self receipt; seen rendering ignores stale current-user self receipts and derives seen only from other participant reads of current-user messages.
- Pass B, maintainability and structure: no structural blocker after moving the admission guard inward. `getReadableChatMessageReceiptIds` centralizes the candidate rule across UI/store/server, and `chatReadStates` remains the authoritative persistence boundary.
- Finding fixed during review: `markChatConversationRead` initially still accepted unfiltered `messageIds` from direct server callers. Fixed by moving receipt candidate filtering into the writer and updating Convex tests to prove self-authored candidates are excluded there.
- Final result: no open scoped findings remain after the deep architecture-aware review and normal clean-loop re-review.
