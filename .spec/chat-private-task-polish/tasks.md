---
title: Chat Private Task Polish Tasks
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

# Tasks

Every implementation slice below must:

1. Re-read linked `DES-*`, linked `REQ-*`, this task entry, live code, and relevant tests before editing.
2. Apply `architecture-standards` before editing by naming the owner boundary, dataflow/contract risks, and bypass paths.
3. Implement only the coherent slice.
4. Add or update focused tests proving public behavior and negative privacy/contract variants where relevant.
5. Run focused validation.
6. Run `pnpm fallow:gate`.
7. Run deep `diff-review` with `architecture-standards`.
8. Fix findings.
9. Run normal architecture-aware diff-review passes and Fallow reruns until clean or explicitly blocked.
10. Record validation, Fallow result, review findings, fixes, architecture decisions, spec drift, and residual risk in `reviews.md`.

## Slice 1: Spec Package

- [completed] Create `.spec/chat-private-task-polish/design.md`. Requirements: REQ-001.
- [completed] Create `.spec/chat-private-task-polish/requirements.md`. Requirements: REQ-001.
- [completed] Create `.spec/chat-private-task-polish/tasks.md`. Requirements: REQ-001.
- [completed] Create `.spec/chat-private-task-polish/reviews.md`. Requirements: REQ-001.
- [completed] Run focused spec validation and the slice review/Fallow loop. Requirements: REQ-001.

## Slice 2: Chat Files And Previews

- [completed] Refresh discovery for workspace chats, team chat, channels, rich-text preview, download links, and tests. Requirements: REQ-002.
- [completed] Add a header-independent Chat/Files tab rendering path so team chat exposes Files without reintroducing the full workspace-chat header. Requirements: REQ-002.
- [completed] Change `ConversationFilesPanel` file rows/open action to in-app preview/modal behavior while preserving direct download links. Requirements: REQ-002.
- [completed] Add tests for workspace chat files, team chat files, channel files, image preview, non-image modal, and direct download behavior. Requirements: REQ-002.
- [completed] Complete the mandatory slice validation, Fallow, deep review, fix, normal review loop, and `reviews.md` record. Requirements: REQ-001.

## Slice 3: Chat Send, Scroll, Reply Quote, And Status

- [completed] Refresh discovery for composer send flow, pending attachments, image-only draft meaning, message idempotency, scroll hook, quote sanitizer/canonical/TipTap paths, message DOM anchors, conversation-list avatars, and tests. Requirements: REQ-003, REQ-004, REQ-005, REQ-006.
- [completed] Add a single in-flight guarded send path for Enter and button click while preserving drafts on flush failure and allowing image-only attachment drafts after flush. Requirements: REQ-003.
- [completed] Strengthen latest-message scroll on open, send, Files-to-Chat return, and image load/error settlement. Requirements: REQ-004.
- [completed] Preserve source image/link structure in chat reply quotes and add source metadata, sanitizer/canonical allowances, original-message navigation, highlight/focus behavior, and tests. Requirements: REQ-005.
- [completed] Add presence/status indicators to conversation-list avatars consistently with thread avatars. Requirements: REQ-006.
- [completed] Complete the mandatory slice validation, Fallow, deep review, fix, normal review loop, and `reviews.md` record. Requirements: REQ-001.

## Slice 4: Reactions Layout

- [completed] Refresh discovery for chat messages, channel posts, channel comments, hover action layers, overflow parents, and tests. Requirements: REQ-007.
- [completed] Reserve reaction row space and safe overflow in chat message rows. Requirements: REQ-007.
- [completed] Reserve reaction row space and safe overflow in channel posts and comments. Requirements: REQ-007.
- [completed] Add focused layout/class tests for all three surfaces. Requirements: REQ-007.
- [completed] Complete the mandatory slice validation, Fallow, deep review, fix, normal review loop, and `reviews.md` record. Requirements: REQ-001.

## Slice 5: Private Labels

- [completed] Refresh discovery for domain rules, store validation/actions, API routes, Convex handlers/helpers/schema/indexes, read models, auth bootstrap payloads, cleanup/account deletion, default views, UI editors, bulk menus, search/activity, and tests. Requirements: REQ-008, REQ-009, REQ-010.
- [completed] Update label domain helpers for workspace and owner-private visibility/assignability. Requirements: REQ-008.
- [completed] Update label create payloads, store/client/server wrappers, API route, Convex mutation args/handler, schema indexes, and data helpers so private label `ownerId` is server-derived. Requirements: REQ-009.
- [completed] Update work item create/update store and Convex paths to preserve valid private label ids and reject invalid labels through authoritative helpers. Requirements: REQ-008, REQ-009.
- [completed] Update read models/materialization/auth bootstrap/invalidation so private labels appear only in owner-private work-index/detail/full-snapshot paths for accessible workspaces, including unassigned owner-private labels, and do not leak to shared or broad membership surfaces. Requirements: REQ-010.
- [completed] Update cleanup/account deletion and unreferenced-user cleanup for private label lifecycle. Requirements: REQ-010.
- [completed] Update default private-task view display props and private task label UI/create/edit/bulk behavior. Requirements: REQ-010.
- [completed] Add domain, store, API, Convex, read-model, cleanup, default-view, UI, bulk-menu, and leak tests. Requirements: REQ-008, REQ-009, REQ-010.
- [completed] Complete the mandatory slice validation, Fallow, deep review, fix, normal review loop, and `reviews.md` record. Requirements: REQ-001.

## Slice 6: Private Custom Properties

- [completed] Refresh discovery for custom property schemas, types, store, API, Convex handlers/schema/indexes, read models, auth bootstrap payloads, invalidation, cleanup/account deletion, saved view display props, visibility-change bypasses, UI property controls, view chips, person validation, and tests. Requirements: REQ-011, REQ-012, REQ-013.
- [completed] Update TypeScript models, Zod schemas, Convex validators, and schema indexes for team/private discriminated scopes and nullable private `teamId`. Requirements: REQ-011.
- [completed] Update client/server wrappers, API routes, store slice, and Convex handlers for private definitions, updates, archives, and values. Requirements: REQ-011, REQ-012.
- [completed] Add private person-property workspace-visible user validation while preserving team-member validation for team properties. Requirements: REQ-012.
- [completed] Update scoped read models and invalidation targets for private custom property definitions/values and private-only personal views. Requirements: REQ-013.
- [completed] Update cleanup/account deletion and unreferenced-user retention for private definitions, values, and person values. Requirements: REQ-013.
- [completed] Update private-task UI for creating, showing, editing, filtering, and setting private custom properties without exposing them in shared or mixed views. Requirements: REQ-012, REQ-013.
- [completed] Add schema, store, API, Convex, read-model, cleanup, view, UI, and leak tests. Requirements: REQ-011, REQ-012, REQ-013.
- [completed] Complete the mandatory slice validation, Fallow, deep review, fix, normal review loop, and `reviews.md` record. Requirements: REQ-001.

## Slice 7: Work Surface Polish

- [completed] Refresh discovery for work-surface label pills, property chips, shared row checkbox, row hover actions, board/list variants, and tests. Requirements: REQ-014, REQ-015.
- [completed] Remove only the inconsistent label pill chevron from the work-surface label pill/dropdown surface. Requirements: REQ-014.
- [completed] Darken shared unchecked selection checkbox contrast without regressing selected state. Requirements: REQ-015.
- [completed] Align row action trigger/dropdown by adjusting reserved padding and trigger offset together. Requirements: REQ-015.
- [completed] Add focused component tests for chevron absence, checkbox contrast class, and row action alignment class contract. Requirements: REQ-014, REQ-015.
- [completed] Complete the mandatory slice validation, Fallow, deep review, fix, normal review loop, and `reviews.md` record. Requirements: REQ-001.

## Slice 8: Final Validation And Total Review

- [completed] Run focused test suites for all changed surfaces. Requirements: REQ-016.
- [blocked] Run `pnpm typecheck`. Requirements: REQ-016.
- [completed] Run `pnpm lint`. Requirements: REQ-016.
- [completed] Run `pnpm test` where feasible. Requirements: REQ-016.
- [completed] Run final `pnpm fallow:gate` and distinguish blocking gates from advisory inventories. Requirements: REQ-016.
- [blocked] Run browser/visual smoke for chat/files/work-surface UI when a running app is available, or record why it is blocked. Requirements: REQ-016.
- [completed] Run total branch/worktree deep `diff-review` with `architecture-standards` against the original request, full spec, live repo evidence, tests, and accumulated changes. Requirements: REQ-016.
- [completed] Fix findings, then run normal architecture-aware diff-review and Fallow loops until clean or explicitly blocked. Requirements: REQ-016.
- [completed] Record final audit in `reviews.md`. Requirements: REQ-016.

## Audit

- Tasks map to requirements and do not add scope beyond the requirements.
- Every implementation slice encodes the requested deep-first review, normal clean loop, architecture standards, Fallow checkpoint, and review ledger record.
- The private metadata slices explicitly require bypass-path and leak testing rather than only UI happy paths.
