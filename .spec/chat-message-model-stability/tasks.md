---
title: Chat Message Model Stability Tasks
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

# Tasks

## Slice 1: Spec Setup

- [completed] Create design, requirements, tasks, and reviews artifacts. Requirements: REQ-008.
- [completed] Run deep diff-review with architecture-standards and record the result in `reviews.md`. Requirements: REQ-008.

## Slice 2: Message Model Stability

- [completed] Add regression coverage proving conversation-list preview refresh does not prune older loaded thread messages. Requirements: REQ-001.
- [completed] Add coverage proving conversation-thread refresh still prunes non-pending messages authoritatively. Requirements: REQ-002.
- [completed] Update store pruning so `conversation-list` skips `chatMessages` pruning and `conversation-thread` keeps it. Requirements: REQ-001, REQ-002.
- [completed] Run deep diff-review with architecture-standards, fix findings, then run normal architecture-aware re-review until clean. Record in `reviews.md`. Requirements: REQ-008.

## Slice 3: Seen Receipt Derivation

- [completed] Include participant read states in conversation-thread read models while keeping conversation-list read states lightweight. Requirements: REQ-003.
- [completed] Derive seen message IDs from other participant receipts for current-user-authored messages while ignoring current-user receipts, received messages, TeamSpace/team chats, and nonparticipants. Requirements: REQ-003.
- [completed] Render metadata as seen icon, separator, edited pencil icon, separator, 24-hour time-only sent stamp. Requirements: REQ-004.
- [completed] Reserve a separate metadata layout column so long message content cannot overlap receipt/time/edit stamps. Requirements: REQ-004.
- [completed] Add tests for current-user receipt rendering, participant receipt rendering, nonparticipant filtering, no receipt timestamp, edited icon, time-only metadata, deleted messages, and metadata-column layout. Requirements: REQ-003, REQ-004.
- [completed] Run deep diff-review with architecture-standards, fix findings, then run normal architecture-aware re-review until clean. Record in `reviews.md`. Requirements: REQ-008.

## Slice 4: Collapsed Left Icon Rail

- [completed] Move collapse/expand control into the active chat header next to the title. Requirements: REQ-005.
- [completed] Render collapsed left rail with `New chat` and scrollable avatar buttons, no visible names. Requirements: REQ-005.
- [completed] Add tests for collapsed rail selection, accessibility labels, absence of names, and expanded list behavior. Requirements: REQ-005.
- [completed] Run deep diff-review with architecture-standards, fix findings, then run normal architecture-aware re-review until clean. Record in `reviews.md`. Requirements: REQ-008.

## Slice 5: Link Mark Containment

- [completed] Replace direct Link extension usage with a non-inclusive local Link extension wrapper. Requirements: REQ-006.
- [completed] Normalize chat message storage/display so only visible URL text remains linked and stale non-URL chat links are unwrapped. Requirements: REQ-006.
- [completed] Add tests that only URL text is linked, stale chat links unwrap, later prose is not link-marked, and generic rich-text sanitization preserves mixed anchors outside chat-message normalization. Requirements: REQ-006.
- [completed] Run deep diff-review with architecture-standards, fix findings, then run normal architecture-aware re-review until clean. Record in `reviews.md`. Requirements: REQ-008.

## Slice 6: Duplicate Cleanup

- [completed] Remove `convex/app 2.ts` and `convex/validators 2.ts` after confirming byte-for-byte duplication. Requirements: REQ-007.
- [completed] Run architecture-aware diff-review record for cleanup. Requirements: REQ-008.

## Slice 7: Final Validation

- [completed] Run focused tests for chat thread, workspace chat screen, app-store read-model merge, scoped read models, Convex scoped read-model handlers, domain read-state helper, and rich-text extension behavior.
- [completed] Run typecheck and lint if focused tests pass or reveal no blocking setup issue.
- [completed] Run final total-diff deep diff-review with architecture-standards, fix findings, then run normal architecture-aware re-review until clean. Requirements: REQ-008.

## Slice 8: Final Scoped In-Thread Review

- [completed] Exclude attachment/rich-text upload work from the final in-thread review scope, including attachment hunks inside mixed files.
- [completed] Run final scoped deep diff-review with architecture-standards for chat/message stability, read receipts, collapsed left icon rail/header control, chat link normalization, profile hover-card layering, sidebar email truncation, offline dot sizing, and message spacing/metadata. Requirements: REQ-008.
- [completed] Run normal architecture-aware clean-loop re-review after the deep pass and record the result in `reviews.md`. Requirements: REQ-008.
- [completed] Run in-thread validation: focused Vitest suite, typecheck, lint, scoped diff check, and duplicate-file check.

## Slice 9: Read Receipt Self-Admission Investigation

- [completed] Investigate whether sent messages were being recorded as read receipts for their own sender using the architecture-standards ownership rule that read receipts are owned by `chatReadStates`.
- [completed] Centralize receipt candidate filtering so UI, store, and Convex all use the same rule: only non-deleted messages from other users may be written into `messageReadAtById`.
- [completed] Move authoritative backend filtering into `markChatConversationRead` so direct server callers cannot bypass the route-level admission check.
- [completed] Ensure sent messages still mark the conversation read without creating sender self-receipts.
- [completed] Add/adjust domain, component, store, and Convex tests for self-authored receipt exclusion and stale self-receipt seen rendering.
- [completed] Run scoped deep diff-review with architecture-standards, fix findings, then run normal architecture-aware re-review until clean. Record in `reviews.md`. Requirements: REQ-008.
- [completed] Run scoped validation: focused Vitest suite, typecheck, scoped eslint, and scoped diff check.

## Audit

- Tasks map to requirements and keep implementation slices coherent.
- Every slice explicitly requires deep diff-review with architecture-standards plus normal re-review until clean.
- The final tasks explicitly require deep review with architecture standards and clean-loop re-review, including the later scoped in-thread pass that excludes the separate attachment thread.
