---
title: Chat Message Model Stability Requirements
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

# Requirements

## REQ-001: Conversation Preview Refresh Must Not Delete Thread History

Derived from DES-001.

When a `conversation-list` read model refresh includes only latest preview messages, existing loaded thread messages must remain in the store. Pending optimistic messages must remain protected.

## REQ-002: Thread Refresh Remains Authoritative

Derived from DES-001.

When a `conversation-thread` read model refresh replaces a chat thread, it may prune non-pending messages in that conversation to match the authoritative thread payload.

## REQ-003: Seen Receipt Derivation

Derived from DES-002 and DES-003.

The chat UI must show a seen icon only for current-user-authored, non-deleted messages in workspace direct/group chats when another participant has a per-message read receipt for that message. Current-user read states, messages authored by another user, deleted messages, and nonparticipant read states must not produce seen icons. TeamSpace/team chats must remain conversation-level read/unread only: they must not render seen icons or persist per-message read receipt entries.

## REQ-004: Metadata Ordering

Derived from DES-004.

Message metadata must render as `seen icon`, separator dot, `edited pencil`, separator dot, `sent time` when applicable. Sent time must be 24-hour time-only. Seen and Edited must render as icons only; they must not render timestamps or text labels.

## REQ-005: Collapsed Left Icon Rail

Derived from DES-005.

When the workspace conversation list is collapsed, it must render a left icon rail with a `New chat` button and scrollable chat avatar buttons. Chat names must not be visible in the collapsed rail, but avatar buttons need accessible labels/tooltips. The collapse/expand control must sit next to the active chat title above the thread.

## REQ-006: Link Autolink Containment

Derived from DES-006.

When a user enters prose and a URL in a chat text thread, only the URL text must become a link. Surrounding prose and later typed text must not inherit the link mark.

Chat message sanitization must unwrap stale non-URL links after a link is removed or edited away. Generic non-chat rich-text sanitization must not apply the chat-only mixed-anchor cleanup rule.

## REQ-007: Duplicate File Cleanup

Derived from DES-007.

Remove the byte-for-byte duplicate untracked files `convex/app 2.ts` and `convex/validators 2.ts`. Do not alter the canonical Convex files as part of duplicate cleanup.

## REQ-008: Architecture-Aware Diff Review

Derived from DES-001 through DES-007 and the user's final planning constraint.

Every deep slice review, normal re-review, final total-diff deep review, and final normal clean-loop re-review must explicitly use `architecture-standards` as the review lens. `.spec/chat-message-model-stability/reviews.md` must record that lens for each review.

## Audit

- Requirements derive from the design decisions and do not introduce scope beyond the user request.
- Architecture standards are represented as enforceable ownership and review requirements, not just documentation.
- No upstream design changes are required before tasks.
