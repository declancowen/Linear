---
title: Chat Private Task Polish Requirements
scope: chat-private-task-polish
status: implementation-ready
repo_root: /Users/declancowen/Documents/GitHub/Linear
change_class: feature
risk_level: high
owner: Codex
reviewers: [diff-review, architecture-standards]
approvers: [user]
implementation_owner: Codex
operations_owner: Codex
last_updated: 2026-06-05
---

# Requirements

## REQ-001: Spec Artifacts And Process Gate

Derived from DES-001.

Create `design.md`, `requirements.md`, `tasks.md`, and `reviews.md`. Every implementation slice must refresh live repository evidence, run focused validation, run `pnpm fallow:gate`, run a deep architecture-aware diff review, fix findings, then run normal architecture-aware review and Fallow loops until clean or explicitly blocked. Record commands, findings, fixes, architecture decisions, spec drift, and residual risk in `reviews.md`.

## REQ-002: In-App Files Preview

Derived from DES-002 and DES-003.

Workspace chats, team chat, and channel files surfaces must expose usable Chat/Files controls where relevant. Clicking a file entry or open action must open an in-app preview/modal instead of opening a URL tab. Images must use image preview behavior. Non-images must show an in-app attachment modal with filename, type/date context, and download. Explicit download controls may remain direct links.

## REQ-003: Single In-Flight Chat Send

Derived from DES-004.

Enter-submit and send-button click must share one guarded send path. Sending must be disabled while attachment upload flush is pending or the send command is in flight. Image-only attachment drafts must be sendable after pending upload flush even when plain text is empty. Flush failure must keep the message draft and pending attachment mapping. Duplicate clicks/Enter during the guarded period must not call `onSend` twice.

## REQ-004: Bottom Scroll Reliability

Derived from DES-005.

Opening a chat, sending a message, changing to the latest message, returning from Files to Chat, and message image load/error settlement must scroll the chat pane to the latest message.

## REQ-005: Reply Quote Structure And Navigation

Derived from DES-006.

Chat reply quotes must preserve image previews and inline attachment/link format from the original message. Quote markup must include narrow chat-message source metadata that survives sanitizer, TipTap blockquote parsing/rendering, and canonical normalization. Clicking the quoted source must scroll to and highlight/focus the original message. The metadata must not permit arbitrary script, external navigation bypasses, or unrelated rich-text attributes.

## REQ-006: Conversation List Status Icons

Derived from DES-007.

Workspace conversation-list avatars must show presence/status indicators consistent with chat-thread avatars for direct and group chats. Former or unavailable participants must not render misleading live status.

## REQ-007: Reaction Layout Space

Derived from DES-008.

Chat messages, channel posts, and channel comments must reserve layout space and overflow behavior for reaction rows so reaction chips are not clipped by parent containers, adjacent content, or hover actions.

## REQ-008: Private Label Domain Contract

Derived from DES-009 and DES-010.

Domain rules must allow owner-private labels only for private work items in the same workspace and owner, and workspace labels only for non-private work items in that workspace. Private labels must be visible only to their owner. All store, API, Convex, and UI paths must use those domain rules or stricter authoritative equivalents.

## REQ-009: Private Label Creation And Persistence

Derived from DES-009 and DES-010.

Label creation must support `scopeType: "workspace" | "private"` while deriving `ownerId` server-side. Convex schema/indexes and data helpers must support efficient workspace-private-owner label reads. Create/update work item paths must preserve valid private label ids instead of stripping them, and reject invalid owner/workspace/scope labels.

## REQ-010: Private Label Read Models, Cleanup, And UI

Derived from DES-010.

Private labels must appear in My Items/private-task views, non-shared private-only personal item view filters, and private work item detail/edit/create flows through owner-private work read models. Private labels must not leak to team-space, project, document, workspace, non-owner, broad workspace membership/auth-bootstrap payloads, search, or shared pickers/read models/activity. Owner-only full app and personal work-index contexts may include owner-private labels for accessible workspaces, including unassigned labels. Cleanup/account deletion must delete or preserve private labels according to owner/private work item references and remove private label references when the owner is removed.

## REQ-011: Private Custom Property Contract

Derived from DES-011, DES-012, and DES-013.

Custom property create contracts, TypeScript models, Zod schemas, Convex validators, schema/indexes, server wrappers, client wrappers, store actions, and handlers must support team and private scopes. Private definitions/values must use nullable `teamId`, server-derived `ownerId`, workspace scope, and owner/private work item enforcement.

## REQ-012: Private Custom Property Validation And Values

Derived from DES-011 and DES-012.

Private custom properties may be created, edited, archived, displayed, and assigned only on owner private tasks in the same workspace. Private person property values must reference workspace-visible users in the same workspace. Team custom property behavior must remain team-member scoped and unchanged.

## REQ-013: Private Custom Property Read Models, Invalidation, Cleanup, And UI

Derived from DES-013.

Private custom property definitions and values must appear only in owner private-task surfaces and private-only personal views. Scoped read-model invalidation must cover private custom-property definitions. Cleanup/account deletion must remove private definitions and values owned by the deleted user and protect referenced users from unreferenced-user cleanup when person values still reference them. Private definitions must not appear in team/workspace/project/document/mixed personal views.

Saved view display-property validation must allow private custom properties only on non-shared owner personal item views whose visibility filter is exactly `["private"]`; visibility changes that would make existing private custom display props invalid must be rejected before persistence.

## REQ-014: Work-Surface Label Chevron Removal

Derived from DES-014.

Remove the inconsistent chevron from label pills/dropdowns where the work-surface label pill pattern should match other pills. Do not remove chevrons from unrelated select controls that intentionally use dropdown affordances.

## REQ-015: Work-Surface Row Contrast And Action Alignment

Derived from DES-014.

The shared row-selection checkbox must be darker in the unchecked/hover-visible state to improve contrast. The right-side three-dot action trigger/dropdown must align with the parent row group by adjusting row reserved padding and trigger offset together.

## REQ-016: Final Total Audit

Derived from DES-001.

After all slices, run full validation and final `pnpm fallow:gate`, then run a total branch/worktree deep diff review against the original request, spec package, live repo evidence, tests, and architecture standards. Fix findings, then run normal diff-review and Fallow loops until clean or explicitly blocked. Record the final audit in `reviews.md`.

## Audit

- Requirements derive from design decisions and preserve all original user requirements.
- No new scope is introduced beyond the design public contracts and requested implementation slices.
- Architecture standards are requirements through ownership, authority, materialization, contract compatibility, operations/cost, and enforcement gates.
