# Chat Message Model Stability Review

## Review Status

| Field | Value |
| --- | --- |
| Last reviewed | 2026-06-04 12:15 BST |
| Total turns | 4 |
| Open findings | 0 |

## Scope

- chat message read-model pruning and disappearing history regression
- seen receipt derivation and metadata order
- collapsed left conversation icon rail
- rich-text link mark containment
- duplicate untracked Convex file cleanup
- profile hover-card layering in chats/channels
- direct/group chat sidebar email truncation and presence dot sizing
- self-authored read receipt admission and seen derivation regression
- spec ledger under `.spec/chat-message-model-stability/`

## Turn 4 - 2026-06-04 12:15 BST

**Outcome:** Scoped deep `diff-review` loop completed with `architecture-standards` as the explicit review lens. One Medium backend ownership finding was fixed during review; no open scoped findings remain.

**Scope boundary:** This pass reviewed only the read-receipt/message-read-model slice from this thread: `lib/domain/chat-read-state.ts`, `components/app/collaboration-screens/chat-thread.tsx` receipt/seen hunks, `lib/store/app-store-internal/slices/collaboration-conversation-actions.ts`, `convex/app/chat_read_states.ts`, the `sendChatMessageHandler` self-receipt removal in `convex/app/collaboration_handlers.ts`, and the matching tests. Attachment, comments, sidebar, file-panel, and other dirty-tree work are explicitly out of scope, including unrelated hunks in mixed files.

**Architecture lens used for every review pass:**

- `conversation-list` owns preview data only.
- `conversation-thread` owns full message history.
- read receipts are owned by `chatReadStates`.
- chat UI only derives presentation state from authoritative models.
- `messageReadAtById` may store per-message receipts only for non-deleted messages authored by another user; a sender's conversation-level `readAt` must not create a self per-message receipt.

**Pass A, correctness and safety:**

- Confirmed `ChatThread` asks to mark only unread, non-deleted messages from other users as per-message receipt candidates while still calling `markChatRead` with an empty list when needed, so conversation-level unread state can still clear.
- Confirmed store optimistic state and sync payloads use the filtered candidate list, and sending a chat marks the conversation read without adding the sender's own message ID to `messageReadAtById`.
- Confirmed Convex now enforces the receipt-candidate admission rule inside `markChatConversationRead`, so route callers and future server callers cannot persist self-authored, deleted, cross-conversation, or unknown message IDs as receipts through the read-state writer.
- Confirmed `sendChatMessageHandler` no longer seeds the sender's self message receipt.
- Confirmed seen presentation ignores stale current-user self receipts and renders only when another participant has read a current-user-authored, non-deleted message.

**Pass B, maintainability and structure:**

- The candidate rule is centralized in `getReadableChatMessageReceiptIds` and reused by UI, store, and Convex, avoiding three divergent definitions of a readable receipt.
- The authoritative server admission check lives in the `chatReadStates` writer boundary rather than only in a route adapter.
- UI remains a presentation consumer of `chatReadStates`; it filters early to reduce bad optimistic writes, but backend admission remains authoritative.

**Finding fixed during review:**

| Finding | Severity | Status | Action |
| --- | --- | --- | --- |
| `markChatConversationRead` could still merge unfiltered `messageIds` if another server caller passed self-authored IDs directly, leaving the read-receipt invariant only partially enforced at the route boundary. | Medium | Resolved | Moved receipt candidate filtering into `markChatConversationRead` and updated Convex tests to prove the writer filters self-authored candidates. |

**Normal clean-loop re-review:** Completed after the backend admission move. No new scoped findings.

**Verification:**

- `pnpm vitest tests/lib/domain/chat-read-state.test.ts tests/components/chat-thread.test.tsx tests/lib/store/collaboration-conversation-actions.test.ts tests/convex/chat-message-notifications.test.ts --run` — 4 files, 51 tests passed.
- `pnpm typecheck` — passed.
- `pnpm exec eslint lib/domain/chat-read-state.ts components/app/collaboration-screens/chat-thread.tsx lib/store/app-store-internal/slices/collaboration-conversation-actions.ts convex/app/chat_read_states.ts convex/app/collaboration_handlers.ts tests/lib/domain/chat-read-state.test.ts tests/components/chat-thread.test.tsx tests/lib/store/collaboration-conversation-actions.test.ts tests/convex/chat-message-notifications.test.ts --max-warnings 0` — passed.
- Scoped `git diff --check` for the same receipt-related files — passed.

**Residual risk:** Minor. Existing persisted self-receipt rows are not migrated out, but current UI no longer renders them as seen and new UI/store/server paths no longer create them.

## Turn 3 - 2026-06-04 08:35 BST

**Outcome:** Final scoped deep `diff-review` loop completed with `architecture-standards` as the explicit review lens. No open in-thread findings remain.

**Scope boundary:** Attachment/rich-text upload changes are explicitly out of scope for this review, including attachment hunks in mixed files. This pass reviewed only the chat/message stability, read receipts, left icon rail/header control, chat link normalization, profile hover-card layering, sidebar email truncation, offline dot sizing, and message spacing/metadata changes.

**Architecture lens used for every review pass:**

- `conversation-list` owns preview data only.
- `conversation-thread` owns full message history.
- read receipts are owned by `chatReadStates`.
- chat UI only derives presentation state from authoritative models.

**Pass A, correctness and safety:**

- Confirmed conversation-list preview refreshes no longer prune loaded thread history, while conversation-thread replacement remains authoritative for the full message set.
- Confirmed thread read models hydrate participant `chatReadStates`; seen presentation derives from those records and does not synthesize read timestamps.
- Confirmed message metadata order is seen icon, dot, 24-hour sent time, dot, edited pencil icon, with lighter `text-fg-4` treatment and no date stamps.
- Confirmed message body and metadata use separate grid columns so long content/links do not overlay receipt/time/edit stamps.
- Confirmed chat-only link normalization unwraps stale non-URL anchors and keeps only URL substrings linked, without changing generic rich-text mixed-anchor storage.
- Confirmed collapsed conversation state is a left icon rail with `New chat` and scrollable avatars/no names; the Phosphor `SidebarIcon` collapse control lives next to the active chat title.
- Confirmed `UserHoverCard` renders above chat/channel canvases through the default portal and higher `z-[120]` layer; sidebar member rows no longer opt out of portalling.
- Confirmed long sidebar hero emails truncate inside a fixed grid row while preserving the copy button, and offline status dots use the same visible size as other status dots.

**Pass B, maintainability and structure:**

- The ownership split remains intact: list-pane code owns navigation/preview presentation; thread code owns full message rendering; `lib/domain/chat-read-state.ts` owns receipt derivation.
- Profile-card layering stays centralized in `UserHoverCard`, so both chat and channel author surfaces inherit the fix.
- Sidebar email containment is local to the details-card row, avoiding sidebar/container overflow changes.
- Chat-specific link repair remains at the chat-message sanitizer boundary, not in generic rich-text storage.

**Findings:** none.

**Verification:**

- `pnpm vitest tests/lib/content/rich-text-security.test.ts tests/components/chat-thread.test.tsx tests/components/workspace-chats-screen.test.tsx tests/lib/rich-text-extensions.test.ts tests/lib/domain/chat-read-state.test.ts tests/lib/app-store-read-model-merge.test.ts tests/lib/scoped-read-models.test.ts tests/convex/scoped-read-model-handlers.test.ts tests/components/user-presence.test.tsx --run` — 9 files, 96 tests passed.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- Scoped `git diff --check` for in-thread files — passed.
- `test ! -e 'convex/app 2.ts' && test ! -e 'convex/validators 2.ts'` — passed.

**Git caveat:** Full unscoped Git diff commands still cannot inspect `components/app/rich-text-editor/toolbar.tsx` because the index references a missing base blob. That file belongs to the separate attachment thread and is not part of this scoped review.

**Browser smoke:** Not run. The user asked not to worry about browser tests and is checking manually.

**Residual risk:** Minor. The repo still uses the existing `chatMessages` collection for latest preview records rather than a separate preview-message model, but list refreshes are no longer allowed to prune full thread history.

## Turn 2 - 2026-06-04 07:46 BST

**Outcome:** Final total-diff deep `diff-review` rerun with `architecture-standards` as the explicit review lens after the user receipt and metadata corrections. No open branch-specific findings remain.

**Risk:** Medium. The diff touches shared scoped read-model reconciliation, Convex read-model assembly, chat-thread presentation, chat-message rich-text sanitization, and shared rich-text extension behavior.

**Architecture lens used for every review pass:**

- `conversation-list` owns preview data only.
- `conversation-thread` owns full message history.
- read receipts are owned by `chatReadStates`.
- chat UI only derives presentation state from authoritative models.

**Pass A, correctness and safety:**

- Reviewed preview-vs-thread pruning behavior. `conversation-list` no longer prunes `chatMessages`; `conversation-thread` replacements remain authoritative for full thread history.
- Reviewed read receipt authority. Thread read models include participant read states for the active conversation; list read models remain lightweight/current-user scoped. Seen icons are derived from current-user per-message receipts for visible non-deleted messages and from participant receipts for current-user-authored non-deleted messages. Nonparticipants are ignored.
- Reviewed metadata behavior. Metadata renders seen icon, separator dot, 24-hour time-only sent stamp, separator dot, edited pencil icon. No read timestamp, edited timestamp, edited text, or date stamp is rendered in the message metadata.
- Reviewed layout containment. Message body and metadata now use separate grid columns, so long text/links wrap in the message column and cannot overlay the receipt/time/edit stamps.
- Reviewed link containment. The shared Tiptap Link extension is non-inclusive, and stale/overextended chat anchors are normalized only by the chat-message sanitizer.

**Pass B, maintainability and structure:**

- The read-state helper lives in `lib/domain/chat-read-state.ts`, the domain owner for receipt derivation.
- Convex data access follows the existing indexed helper pattern with `listChatReadStatesByConversation`.
- Presentation changes keep list navigation concerns in `WorkspaceConversationListPane` and active-thread/header concerns in `ChatThread`.
- Chat-only stale-link cleanup stays in `sanitizeRichTextMessageContent`; generic rich-text storage preserves mixed descriptive anchors.

**Findings fixed during review:**

| Finding | Severity | Status | Action |
| --- | --- | --- | --- |
| Seen derivation ignored current-user per-message receipts, so the seen icon could disappear | High | Resolved | Updated `getSeenChatMessageIds` to include current-user visible-message receipts and participant receipts for current-user-authored messages; added component/domain coverage. |
| Chat-specific mixed-anchor cleanup leaked into generic rich-text sanitization | Medium | Resolved | Removed mixed-anchor cleanup from the generic sanitizer and added coverage proving non-chat mixed anchors are preserved. |
| Recipient-seen verification missed deleted/received/nonparticipant variants and server participant filtering | Medium | Resolved | Added `tests/lib/domain/chat-read-state.test.ts` and Convex handler coverage for participant read-state hydration/filtering. |

**Verification:**

- `pnpm vitest tests/lib/content/rich-text-security.test.ts tests/components/chat-thread.test.tsx tests/components/workspace-chats-screen.test.tsx tests/lib/rich-text-extensions.test.ts tests/lib/domain/chat-read-state.test.ts tests/lib/app-store-read-model-merge.test.ts tests/lib/scoped-read-models.test.ts tests/convex/scoped-read-model-handlers.test.ts --run` — 8 files, 87 tests passed.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `git diff --check` — passed.
- `test ! -e 'convex/app 2.ts' && test ! -e 'convex/validators 2.ts'` — passed.
- `curl -I http://localhost:3000/chats` — local route responded with `307 Temporary Redirect` to login for unauthenticated access.

**Current worktree caveat:** A later rerun of `pnpm typecheck` failed in out-of-scope attachment/conversation-target changes being handled in another thread. Those files were left untouched; this chat review does not claim the combined dirty worktree typechecks.

**Browser smoke:** No authenticated in-app browser instance was available for a screenshot smoke in this session. User-side localhost testing confirmed the link behavior during the loop; route-level smoke was used as limited local-server evidence.

**Static-analysis context:** Fallow is configured in the repo and preflight reported baseline advisory inventories. This branch does not change Fallow policy or claim full static remediation; branch validation is limited to targeted tests, typecheck, lint, diff check, duplicate-file check, and route-level smoke fallback.

**Residual risk:** Minor. The repo still stores preview messages in the existing `chatMessages` collection because there is no separate preview-message model. This change contains that by preventing list refreshes from acting as full message-history authority.

## Turn 1 - 2026-06-04 07:14 BST

**Outcome:** Final total-diff deep `diff-review` completed with `architecture-standards` as the explicit review lens. No open branch-specific findings remain.

**Risk:** Medium. The diff touches shared scoped read-model reconciliation, Convex read-model assembly, chat-thread presentation, and shared rich-text extension behavior.

**Architecture lens used for every review pass:**

- `conversation-list` owns preview data only.
- `conversation-thread` owns full message history.
- read receipts are owned by `chatReadStates`.
- chat UI only derives presentation state from authoritative models.

**Pass A, correctness and safety:**

- Reviewed preview-vs-thread pruning behavior. `conversation-list` no longer prunes `chatMessages`, so latest-message preview refreshes cannot delete loaded thread history. `conversation-thread` replacements still prune non-pending messages authoritatively.
- Reviewed read receipt authority. Thread read models now include participant read states for the active conversation; list read models remain lightweight/current-user scoped. Seen icons are derived from other participants reading current-user non-deleted messages and no read timestamp is rendered.
- Reviewed collapsed rail behavior. The collapsed list renders `New chat` plus scrollable avatar buttons without visible chat names; the collapse/expand control lives next to the active chat title.
- Reviewed link containment. The shared Tiptap Link extension is non-inclusive, so prose typed after a URL does not inherit the link mark.
- Reviewed duplicate cleanup. Only the two confirmed untracked duplicate files were removed; canonical Convex files were not altered.

**Pass B, maintainability and structure:**

- The read-state helper lives in `lib/domain/chat-read-state.ts`, the domain owner for read-state derivation.
- Convex data access follows the existing indexed helper pattern with `listChatReadStatesByConversation`.
- Presentation changes keep list navigation concerns in `WorkspaceConversationListPane` and active-thread/header concerns in `ChatThread`.
- The link fix is centralized in `lib/rich-text/extensions.ts` rather than scattered per editor surface.

**Finding fixed during review:**

| Finding | Severity | Status | Action |
| --- | --- | --- | --- |
| Recipient-seen verification missed deleted/received/nonparticipant variants and server participant filtering | Medium | Resolved | Added `tests/lib/domain/chat-read-state.test.ts` and Convex handler coverage for participant read-state hydration/filtering. |

**Verification:**

- `pnpm vitest tests/lib/domain/chat-read-state.test.ts tests/lib/app-store-read-model-merge.test.ts tests/components/chat-thread.test.tsx tests/components/workspace-chats-screen.test.tsx tests/lib/scoped-read-models.test.ts tests/lib/rich-text-extensions.test.ts tests/convex/scoped-read-model-handlers.test.ts --run` — 7 files, 77 tests passed.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `git diff --check` — passed.
- `test ! -e 'convex/app 2.ts' && test ! -e 'convex/validators 2.ts'` — passed.
- `curl -I http://localhost:3000/chats` — local route responded with `307 Temporary Redirect` to login for unauthenticated access.

**Browser smoke:** Attempted with the Browser skill. The in-app browser runtime reported no registered browser instances, so no visual screenshot smoke was possible in this session.

**Static-analysis context:** Fallow is configured in the repo and preflight reported baseline advisory inventories. This branch does not change Fallow policy or claim full static remediation; branch validation is limited to targeted tests, typecheck, lint, diff check, and the route-level smoke fallback.

**Residual risk:** Minor. The repo still stores preview messages in the existing `chatMessages` collection because there is no separate preview-message model. This change contains that by preventing list refreshes from acting as full message-history authority.
