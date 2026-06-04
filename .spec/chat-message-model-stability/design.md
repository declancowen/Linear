---
title: Chat Message Model Stability Design
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

# Design

## Discovery Evidence

- `components/app/collaboration-screens/chat-thread.tsx` renders chat history, marks visible messages read, and currently derives message-level read metadata from the current user's `chatReadStates`.
- `components/app/collaboration-screens/workspace-chats-screen.tsx` composes the workspace chat split, active thread, list collapsed state, and details sidebar.
- `components/app/collaboration-screens/workspace-conversation-list-pane.tsx` owns the resizable conversation list pane and current collapsed rail.
- `lib/store/app-store-internal/slices/ui.ts` merges scoped read models and prunes scoped domains during replacement.
- `lib/scoped-sync/read-models.ts` defines client-side scoped read-model selectors used by store pruning.
- `convex/app/scoped_read_models.ts` builds server-side scoped read models; conversation-list loads only latest readable chat messages for previews.
- `lib/rich-text/extensions.ts` configures Tiptap Link with `autolink: true`; Tiptap's default Link mark is inclusive when autolink is enabled.
- `lib/content/rich-text-security.ts` owns storage/display sanitization for rich text and has a chat-message-specific storage path.
- `convex/app 2.ts` and `convex/validators 2.ts` are byte-for-byte duplicates of `convex/app.ts` and `convex/validators.ts`.

## Decisions

### DES-001: Preview and Thread Ownership

`conversation-list` owns navigation rows and latest-message previews only. It must not prune full `chatMessages` history. `conversation-thread` owns full message history for a chat and may prune that chat's messages when it returns an authoritative replacement.

Architecture lens: ownership and dataflow. This prevents a preview read model from becoming a shadow authority over thread history.

### DES-002: Read Receipt Authority

`chatReadStates` remains the read receipt source of truth. The UI derives seen presentation from read-state records; it does not own receipt state. Per-message receipt state is supported only for workspace direct/group chats; TeamSpace/team chats use conversation-level read/unread state only.

Architecture lens: state ownership. No schema migration is required because `messageReadAtById` already records first-read timestamps by message.

### DES-003: Seen Receipt Semantics

A message shows the seen icon only when a current-user-authored, non-deleted message in a workspace direct/group chat appears in another participant's per-message read receipts. Current-user read states, received messages, deleted messages, nonparticipant read states, and TeamSpace/team chats do not produce seen icons.

Architecture lens: contract and compatibility. Conversation-list read models stay lightweight and omit per-message receipt maps; conversation-thread read models include participant read states for the active conversation.

### DES-004: Metadata Order

Message metadata renders in this order: seen icon, separator dot, edited pencil icon, separator dot, sent time. The sent time is a 24-hour time-only stamp because day dividers own date context. Seen and Edited are icons only; neither renders a timestamp or text label.

Architecture lens: presentation derives from authoritative state and avoids introducing a new data rule in UI.

### DES-005: Collapsed Left Icon Rail

Collapsed workspace chats keep a narrow left rail. The rail contains a fixed `New chat` icon button and vertically scrollable chat avatar buttons, with no visible names. The collapse/expand control moves next to the active chat name in the chat header.

Architecture lens: presentation ownership. The list pane owns navigation affordances; the thread header owns the active chat title and collapse toggle.

### DES-006: Link Mark Containment

Use a local Tiptap Link extension wrapper with `inclusive() => false`, preserving autolink and paste URL detection while preventing text after a URL from inheriting the link mark. Chat message storage/display also normalizes stale or overextended non-entity anchors so only visible URL text remains linked; generic rich-text storage preserves mixed descriptive anchors outside chat-message normalization.

Architecture lens: shared component contract. The shared rich text extension remains the owner, so chat, comments, and documents do not each implement ad hoc link cleanup.

### DES-007: Duplicate Cleanup

Remove only the two confirmed duplicate untracked files: `convex/app 2.ts` and `convex/validators 2.ts`.

Architecture lens: repository hygiene. Canonical Convex files are unchanged by this cleanup.

## Audit

- Original request covered read receipts, collapsed conversation list behavior, message model disappearance, link autolink containment, duplicate file cleanup, and mandatory architecture-aware diff reviews.
- Live repo evidence confirms the likely disappearing-message root cause: conversation-list server data contains only latest preview messages while store pruning can treat `chatMessages` as replacement-authoritative.
- Architecture standards shaped the owner boundaries above: preview list, full thread history, read-state authority, and presentation derivation are kept separate.
- No upstream artifact changes are required before requirements.
