---
title: Chat Private Task Polish Reviews
scope: chat-private-task-polish
status: in-progress
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

# Review Ledger

All entries must record:

- linked slice, tasks, requirements, and design decisions
- refreshed live-code evidence
- architecture-standard decisions before editing
- focused validation commands and results
- `pnpm fallow:gate` command/result/findings/fixes/residual risk
- deep diff-review outcome and fixes
- normal diff-review clean-loop outcome
- spec drift decision

## Slice 1: Spec Package

- Review mode: deep `diff-review` with `architecture-standards`, followed by normal architecture-aware re-review.
- Linked requirements: REQ-001.
- Linked design: DES-001 through DES-014.
- Live-code evidence refreshed:
  - `components/app/collaboration-screens/conversation-files-panel.tsx`
  - `components/app/collaboration-screens/chat-thread.tsx`
  - `components/app/collaboration-screens.tsx`
  - `components/app/rich-text-content.tsx`
  - `components/app/message-quote.ts`
  - `components/app/collaboration-screens/workspace-chat-avatar.tsx`
  - `components/app/collaboration-screens/workspace-chats-screen.tsx`
  - `lib/domain/labels.ts`
  - `lib/domain/types-internal/schemas.ts`
  - `lib/store/app-store-internal/validation.ts`
  - `lib/store/app-store-internal/slices/work-item-actions.ts`
  - `lib/store/app-store-internal/slices/custom-properties.ts`
  - `app/api/labels/route.ts`
  - `app/api/custom-properties/route.ts`
  - `convex/validators.ts`
  - `convex/schema.ts`
  - `convex/app.ts`
  - `convex/app/work_helpers.ts`
  - `convex/app/work_item_handlers.ts`
  - `convex/app/workspace_team_handlers.ts`
  - `convex/app/custom_property_handlers.ts`
  - `lib/scoped-sync/read-models.ts`
  - `convex/app/scoped_read_models.ts`
  - `components/app/screens/work-surface-view.tsx`
  - `components/app/screens/work-item-selection.tsx`
- Architecture lens before editing: spec assigns private metadata invariants to domain/API/Convex/read-model owners, composer in-flight behavior to the composer with backend idempotency as backstop, and polish to shared work-surface primitives.
- Validation:
  - `test -f .spec/chat-private-task-polish/design.md && test -f .spec/chat-private-task-polish/requirements.md && test -f .spec/chat-private-task-polish/tasks.md && test -f .spec/chat-private-task-polish/reviews.md && rg -n "^---$|^title:|^scope:|^status:|^repo_root:|^change_class:|^risk_level:|^owner:|^reviewers:|^approvers:|^implementation_owner:|^operations_owner:|^last_updated:" .spec/chat-private-task-polish/*.md` passed.
  - `git diff --check -- .spec/chat-private-task-polish` passed.
- Fallow: `pnpm fallow:gate` passed.
  - Dead-code: 0 issues.
  - Production health gate: findings=0, functions_above_threshold=0, score=95.7, grade=A.
  - Duplication budget: clone_groups=0, duplicated_lines=0, duplication_percentage=0.00%.
- Deep review findings:
  - Wording typo in Slice 7 task said `label-pipe` instead of `label pill`; fixed before closing the slice.
- Normal re-review findings: none.
- Spec drift: none identified in the spec package slice.
- Residual risk: implementation slices remain pending; this slice only establishes the spec and review process.

## Slice 2: Chat Files And Previews

- Review mode: deep `diff-review` with `architecture-standards`, followed by normal architecture-aware re-review.
- Linked requirements: REQ-001, REQ-002.
- Linked design: DES-002, DES-003.
- Refreshed live-code evidence:
  - `components/app/collaboration-screens/conversation-files-panel.tsx` owns shared files collection and file-row rendering.
  - `components/app/rich-text-content.tsx` owns existing image preview behavior for rich-text content.
  - `components/app/collaboration-screens/chat-thread.tsx` owns chat thread tab state and renders `ConversationFilesPanel`.
  - `components/app/collaboration-screens.tsx` already renders channel Chat/Files tabs and team chat through `ChatThread showHeader={false}`.
  - `tests/components/rich-text-content.test.tsx`, `tests/components/chat-thread.test.tsx`, and `tests/components/channel-ui.test.tsx` were checked for adjacent test patterns.
- Architecture lens before editing: file preview is a conversation presentation concern owned by `ConversationFilesPanel`; `ChatThread` owns tab state; download remains an explicit direct-link contract; channel and team chat reuse the shared panel rather than adding sibling-specific preview logic.
- Implementation summary:
  - `ConversationFilesPanel` now opens file rows and open actions through an in-app preview dialog instead of `target="_blank"` anchors.
  - Image files render an in-app image preview.
  - Non-image files render an in-app attachment modal with filename, type/date context, and download.
  - Direct download links remain anchors with `download`.
  - `ChatThread showHeader={false}` now renders a slim Chat/Files tab bar, so team chat gets Files without the workspace-chat header.
- Validation:
  - `pnpm vitest tests/components/conversation-files-panel.test.tsx tests/components/chat-thread.test.tsx --run` passed: 2 files, 28 tests.
  - `pnpm exec eslint components/app/collaboration-screens/conversation-files-panel.tsx components/app/collaboration-screens/chat-thread.tsx tests/components/conversation-files-panel.test.tsx tests/components/chat-thread.test.tsx --max-warnings 0` passed.
  - `git diff --check -- components/app/collaboration-screens/conversation-files-panel.tsx components/app/collaboration-screens/chat-thread.tsx tests/components/conversation-files-panel.test.tsx tests/components/chat-thread.test.tsx .spec/chat-private-task-polish` passed.
  - `pnpm typecheck` was attempted and failed before project checking on pre-existing generated `.next/types/cache-life.d 3.ts` duplicate definitions. No Slice 2 TypeScript errors were reported before that generated-file blocker.
- Fallow: `pnpm fallow:gate` passed.
  - Dead-code: 0 issues.
  - Production health gate: findings=0, functions_above_threshold=0, score=95.7, grade=A.
  - Duplication budget: clone_groups=0, duplicated_lines=0, duplication_percentage=0.00%.
- Deep review findings: none.
- Normal re-review findings: none.
- Spec drift: none. The implementation matched the plan; channel behavior is covered through the shared panel, and team chat is covered through the header-independent tab bar.
- Residual risk: browser visual smoke remains pending for final UI audit. Full typecheck remains blocked by generated `.next/types` duplication outside this slice.

## Slice 3: Chat Send, Scroll, Reply Quote, And Status

- Review mode: deep `diff-review` with `architecture-standards`, followed by normal architecture-aware re-review.
- Linked requirements: REQ-001, REQ-003, REQ-004, REQ-005, REQ-006.
- Linked design: DES-004, DES-005, DES-006, DES-007.
- Refreshed live-code evidence:
  - `components/app/collaboration-screens/chat-thread.tsx` owns composer send, pending attachment flush, message scrolling, reply quote actions, message DOM rows, and team/workspace Chat/Files tab state.
  - `components/app/message-quote.ts` owns quote markup creation.
  - `lib/content/rich-text-security.ts`, `lib/collaboration/canonical-content.ts`, and `lib/rich-text/extensions.ts` own sanitizer, canonical normalization, and TipTap blockquote serialization for quote-source metadata.
  - `components/app/collaboration-screens/workspace-chat-avatar.tsx` and `components/app/collaboration-screens/workspace-chats-screen.tsx` own conversation-list avatar rendering.
  - Focused tests in `tests/components/chat-thread.test.tsx`, `tests/components/workspace-chats-screen.test.tsx`, `tests/lib/content/rich-text-security.test.ts`, and `tests/lib/collaboration-canonical-content.test.ts` were updated.
- Architecture lens before editing: composer concurrency stays local to the composer UI with backend idempotency only as a backstop; quote-source metadata is a narrow content contract owned in `lib/content` and admitted by sanitizer/canonical/TipTap boundaries; scroll and highlight state remain presentation-only; presence display derives from the existing workspace presence helper rather than duplicated status rules.
- Spec drift found during discovery:
  - Image-only rich-text drafts can be meaningful without plain text, so REQ-003/DES-004/tasks were tightened before implementation.
  - Quote metadata must survive TipTap blockquote parsing/rendering as well as sanitizer/canonical cleanup, so REQ-005/DES-006/tasks were tightened before implementation.
- Implementation summary:
  - `ChatComposer` now uses one guarded async send command for Enter and button click, disables composer controls while flushing/sending, preserves drafts on upload failure, allows image/attachment-only drafts, and defers successful unlock until the composer reset can commit.
  - Latest-message auto-scroll now runs on Chat tab remount after Files and still listens for pending message image load/error settlement.
  - Reply quotes preserve sanitized image/link/attachment markup, add validated `data-chat-source-message-id`, and clicking the quote scrolls/highlights/focuses the original message.
  - Sanitizer, canonical normalization, and TipTap blockquote attributes allow only validated quote-source message ids.
  - Workspace direct/group conversation-list avatars now show status consistently with thread avatars while suppressing status for former/unavailable participants.
- Validation:
  - `pnpm vitest tests/components/chat-thread.test.tsx tests/components/workspace-chats-screen.test.tsx tests/lib/content/rich-text-security.test.ts tests/lib/collaboration-canonical-content.test.ts --run` passed: 4 files, 52 tests.
  - `pnpm exec eslint components/app/collaboration-screens/chat-thread.tsx components/app/message-quote.ts components/app/collaboration-screens/workspace-chat-avatar.tsx components/app/collaboration-screens/workspace-chats-screen.tsx lib/content/chat-message-quote-metadata.ts lib/content/rich-text-security.ts lib/collaboration/canonical-content.ts lib/rich-text/extensions.ts tests/components/chat-thread.test.tsx tests/components/workspace-chats-screen.test.tsx tests/lib/content/rich-text-security.test.ts tests/lib/collaboration-canonical-content.test.ts --max-warnings 0` passed.
  - `git diff --check -- components/app/collaboration-screens/chat-thread.tsx components/app/message-quote.ts components/app/collaboration-screens/workspace-chat-avatar.tsx components/app/collaboration-screens/workspace-chats-screen.tsx lib/content/chat-message-quote-metadata.ts lib/content/rich-text-security.ts lib/collaboration/canonical-content.ts lib/rich-text/extensions.ts tests/components/chat-thread.test.tsx tests/components/workspace-chats-screen.test.tsx tests/lib/content/rich-text-security.test.ts tests/lib/collaboration-canonical-content.test.ts .spec/chat-private-task-polish` passed.
  - `pnpm typecheck` was attempted and failed before project checking on pre-existing generated `.next/types/cache-life.d 3.ts` duplicate definitions. No Slice 3 TypeScript errors were reported before that generated-file blocker.
- Fallow:
  - First `pnpm fallow:gate` attempt passed dead-code and health, then failed duplication with clone_groups=2, duplicated_lines=106 in the new chat-thread scroll tests.
  - Fix: extracted the repeated scroll/RAF test setup into `withMockedAutoScroll`.
  - Rerun `pnpm fallow:gate` passed.
  - Dead-code: 0 issues.
  - Production health gate: findings=0, functions_above_threshold=0, score=95.7, grade=A.
  - Duplication budget: clone_groups=0, duplicated_lines=0, duplication_percentage=0.00%.
- Deep review findings:
  - Sync send lock released before React could commit the composer reset, leaving a same-tick duplicate-click window. Fixed by deferring unlock after successful sends and adding a regression test for duplicate synchronous clicks.
- Normal re-review findings: none.
- Spec drift after implementation: none. The implemented scope matches the tightened Slice 3 requirements.
- Residual risk: browser visual smoke remains pending for final UI audit. Full typecheck remains blocked by generated `.next/types` duplication outside this slice.

## Slice 4: Reactions Layout

- Review mode: deep `diff-review` with `architecture-standards`, followed by normal architecture-aware re-review.
- Linked requirements: REQ-001, REQ-007.
- Linked design: DES-008.
- Refreshed live-code evidence:
  - `components/app/collaboration-screens/chat-thread.tsx` owns chat message row, hover action, and reaction row layout.
  - `components/app/collaboration-screens/channel-ui.tsx` owns channel post body, hover action, and post reaction row layout.
  - `components/app/collaboration-screens/channel-post-primitives.tsx` owns channel comment item, hover action, and comment reaction row layout.
  - `components/app/message-hover-action-bar.tsx` was checked as the shared absolute hover-action layer.
  - Focused tests in `tests/components/chat-thread.test.tsx` and `tests/components/channel-ui.test.tsx` were updated.
- Architecture lens before editing: each message/post/comment surface owns its reaction layout safety; the shared hover action bar remains unchanged because the clipping issue is row/container spacing and overflow, not reaction domain behavior.
- Implementation summary:
  - Chat message rows with reactions now reserve bottom space, stay `overflow-visible`, and mark reaction rows with bottom margin/top padding.
  - Channel post bodies with reactions now reserve bottom space, stay `overflow-visible`, and mark post reaction rows with bottom margin/top padding.
  - Channel comment rows with reactions now reserve bottom space, stay `overflow-visible`, and mark comment reaction rows with bottom margin/top padding.
  - Focused class-contract tests assert all three surfaces.
- Validation:
  - `pnpm vitest tests/components/chat-thread.test.tsx tests/components/channel-ui.test.tsx --run` passed: 2 files, 38 tests.
  - `pnpm exec eslint components/app/collaboration-screens/chat-thread.tsx components/app/collaboration-screens/channel-ui.tsx components/app/collaboration-screens/channel-post-primitives.tsx tests/components/chat-thread.test.tsx tests/components/channel-ui.test.tsx --max-warnings 0` passed.
  - `git diff --check -- components/app/collaboration-screens/chat-thread.tsx components/app/collaboration-screens/channel-ui.tsx components/app/collaboration-screens/channel-post-primitives.tsx tests/components/chat-thread.test.tsx tests/components/channel-ui.test.tsx .spec/chat-private-task-polish` passed.
  - `pnpm typecheck` was attempted and failed before project checking on pre-existing generated `.next/types/cache-life.d 3.ts` duplicate definitions. No Slice 4 TypeScript errors were reported before that generated-file blocker.
- Fallow: `pnpm fallow:gate` passed.
  - Dead-code: 0 issues.
  - Production health gate: findings=0, functions_above_threshold=0, score=95.7, grade=A.
  - Duplication budget: clone_groups=0, duplicated_lines=0, duplication_percentage=0.00%.
- Deep review findings: none.
- Normal re-review findings: none.
- Spec drift: none. The slice matched REQ-007 without touching reaction domain/store/API behavior.
- Residual risk: browser visual smoke remains pending for final UI audit. Full typecheck remains blocked by generated `.next/types` duplication outside this slice.

## Slice 5: Private Labels

- Review mode: deep `diff-review` with `architecture-standards`, followed by normal architecture-aware re-review and Fallow reruns.
- Linked requirements: REQ-001, REQ-008, REQ-009, REQ-010.
- Linked design: DES-009, DES-010.
- Refreshed live-code evidence:
  - Domain/type/schema: `lib/domain/labels.ts`, `lib/domain/types-internal/schemas.ts`, `lib/domain/default-views.ts`, `convex/validators.ts`, `convex/schema.ts`.
  - API/server/Convex: `app/api/labels/route.ts`, `lib/server/convex/work.ts`, `lib/convex/client/work.ts`, `convex/app.ts`, `convex/app/data.ts`, `convex/app/workspace_team_handlers.ts`, `convex/app/work_helpers.ts`, `convex/app/work_item_handlers.ts`, `convex/app/view_handlers.ts`, `convex/app/auth_bootstrap.ts`, `convex/app/cleanup.ts`.
  - Store/read models: `lib/store/app-store-internal/slices/work-item-actions.ts`, `lib/store/app-store-internal/validation.ts`, `lib/scoped-sync/read-models.ts`, `lib/server/scoped-read-models.ts`.
  - UI/bypass surfaces: create dialog, detail sidebar, detail screen, label editor, work-surface row controls, filter controls, bulk/context menus, search/activity selectors.
  - Tests: domain, store, API route, Convex handlers/helpers/view handlers/bootstrap/cleanup, scoped read models, default views, detail/create/work-surface/menu component tests.
- Architecture decisions:
  - Label visibility/assignability lives in the domain helper; Convex/store/UI call that rule or stricter boundary equivalents.
  - `ownerId` is server-derived for private labels; client/API contracts accept only `scopeType`.
  - Private label creation uses readable workspace access because the metadata is owner-private, while workspace labels keep editable workspace access.
  - Broad workspace membership/auth-bootstrap payloads remain workspace-label-only; owner-only full snapshots and personal work-index read models may include owner-private labels for accessible workspaces, including unassigned labels.
  - Private label view filters are allowed only for non-shared owner personal item views whose visibility filter is exactly private.
- Implementation summary:
  - Added private label create/read support, owner index, server-derived owner handling, private-label invalidation, and cleanup on workspace access removal/account deletion paths.
  - Preserved valid private labels in work item create/update paths and rejected workspace/other-owner/private-label misuse in store and Convex paths.
  - Exposed private labels in My Items/private task detail/create/edit/filter/bulk-menu surfaces and added `labels` to the default private-task display props.
  - Kept project/team/workspace/shared/membership/search paths workspace-label-only.
- Validation:
  - `pnpm vitest tests/lib/domain/labels.test.ts tests/lib/store/work-item-actions.test.ts tests/convex/work-item-handlers.test.ts tests/convex/workspace-team-handlers.test.ts tests/convex/work-helpers.test.ts tests/convex/view-handlers.test.ts tests/convex/auth-bootstrap-health.test.ts tests/convex/cleanup.test.ts tests/lib/scoped-read-models.test.ts tests/app/api/asset-notification-invite-route-contracts.test.ts tests/lib/domain/default-views.test.ts tests/components/work-item-labels-editor.test.tsx tests/components/work-surface-view.test.tsx tests/components/work-item-detail-screen.test.tsx tests/components/create-dialogs.test.tsx tests/components/work-item-menus.test.tsx tests/components/work-surface.test.tsx --run` passed: 17 files, 336 tests.
  - `pnpm exec eslint ...` across Slice 5 changed files passed.
  - `git diff --check` passed.
  - `pnpm typecheck` was attempted repeatedly and now reports only the pre-existing generated `.next/types/cache-life.d 3.ts` duplicate-definition conflict. Slice 5 TypeScript errors found during review were fixed.
- Fallow:
  - First `pnpm fallow:gate` after the initial implementation failed duplication in `tests/convex/work-item-handlers.test.ts`; fixed by extracting `createPrivateWorkItemDoc`.
  - Later `pnpm fallow:gate` failed duplication in `tests/convex/work-helpers.test.ts`; fixed by extracting `createPrivatePersonalItemView`.
  - Final `pnpm fallow:gate` passed.
  - Dead-code: 0 issues.
  - Production health gate: findings=0, functions_above_threshold=0, score=95.7, grade=A.
  - Duplication budget: clone_groups=0, duplicated_lines=0, duplication_percentage=0.00%.
- Deep review findings and fixes:
  - Private label creation incorrectly reused editable workspace access. Fixed to require readable workspace access for private scope and kept editable access for workspace labels.
  - Label handler normalized user input before access after scope branching. Fixed to run access before name normalization.
  - Read-model private label branch needed explicit `scopeType === "private"` checks. Fixed in selectors/bootstrap helpers.
  - Direct auth bootstrap payloads bypassed selector filters. Fixed membership bootstrap to workspace labels only and full snapshot to owner-visible labels only.
  - Saved view label validation rejected all private labels, breaking private-label filters. Fixed to allow private labels only for non-shared owner personal item views with exact private visibility.
  - Visibility filter toggles could leave stale invalid label filters. Fixed `toggleViewFilterValueHandler` to revalidate label filters on label and visibility changes.
  - Shared personal views could have accepted owner-private label filters. Fixed via `isShared` in the validator and tests.
- Normal re-review findings: none after the above fixes and Fallow reruns.
- Spec drift:
  - Added auth bootstrap payloads to discovery/requirements/tasks.
  - Added non-shared private-only personal view filter validation to design/requirements.
  - Clarified that owner-only personal/full-snapshot contexts may include unassigned owner-private labels for accessible workspaces.
- Residual risk:
  - Browser visual smoke remains pending for final UI audit.
  - Full typecheck remains blocked by generated `.next/types/cache-life.d 3.ts` duplication outside this slice.

## Slice 6: Private Custom Properties

- Review mode: deep `diff-review` with `architecture-standards`, Fallow gate, fixes, then normal architecture-aware re-review.
- Linked requirements: REQ-001, REQ-011, REQ-012, REQ-013.
- Linked design: DES-011, DES-012.
- Refreshed live-code evidence:
  - Domain/type/schema: `lib/domain/labels.ts`, `lib/domain/types-internal/models.ts`, `lib/domain/types-internal/primitives.ts`, `lib/domain/types-internal/schemas.ts`, `convex/validators.ts`, `convex/schema.ts`.
  - API/server/Convex: `app/api/custom-properties/route.ts`, `app/api/custom-properties/[propertyId]/route.ts`, `lib/convex/client/work.ts`, `lib/server/convex/work.ts`, `convex/app.ts`, `convex/app/data.ts`, `convex/app/custom_property_handlers.ts`, `convex/app/view_handlers.ts`, `convex/app/auth_bootstrap.ts`, `convex/app/cleanup.ts`.
  - Store/read models: `lib/store/app-store-internal/slices/custom-properties.ts`, `lib/store/app-store-internal/types.ts`, `lib/scoped-sync/read-models.ts`, `lib/scoped-sync/read-model-instructions.ts`, `lib/server/scoped-read-models.ts`, `convex/app/scoped_read_models.ts`.
  - UI/bypass surfaces: `components/app/screens/custom-property-controls.tsx`, `components/app/screens/work-item-detail-screen.tsx`, `components/app/screens/work-surface-controls.tsx`.
  - Tests: domain, store, API route, Convex handlers/view handlers/bootstrap/cleanup/scoped handlers, scoped read models, and component tests.
- Architecture decisions:
  - Scope ownership is server-derived for private definitions: clients may send `scopeType: "private"` and `workspaceId`, but `ownerId` is derived from `currentUserId`.
  - Domain helper `isCustomPropertyDefinitionForWorkItem` owns assignability for team vs owner-private private-task values.
  - Convex handlers own persistence validation, duplicate checks, person-value workspace membership validation, and private/team update/archive access.
  - Read-model invalidation uses discriminated targets for team vs private definitions; private targets fan out only to the owner personal work index and owner private item detail scopes.
  - View display props are allowed for private custom properties only on non-shared owner personal item views with exact private visibility.
- Implementation summary:
  - Added discriminated team/private custom property create contracts across Zod, store, route, server wrapper, Convex args, and client wrapper.
  - Made custom property definition/value `teamId` nullable for private scope and added owner/workspace indexes.
  - Added private create/update/archive/value support with server-derived owner, workspace-readable private create/update access, duplicate checks scoped by owner/workspace, and private person values validated against workspace-visible users.
  - Updated full bootstrap, scoped read models, materialization, invalidation, cleanup, unreferenced-user retention, and UI controls for owner-private definitions and values.
  - Added private task Add Property behavior, private person user candidates, and private-only view property picker filtering.
- Validation:
  - `pnpm vitest tests/lib/domain/labels.test.ts tests/lib/store/custom-properties.test.ts tests/lib/store/work-item-actions.test.ts tests/convex/custom-property-handlers.test.ts tests/app/api/custom-properties-route-contracts.test.ts tests/lib/scoped-read-models.test.ts tests/convex/scoped-read-model-handlers.test.ts tests/convex/view-handlers.test.ts tests/convex/auth-bootstrap-health.test.ts tests/convex/cleanup.test.ts tests/components/custom-property-controls.test.tsx tests/components/work-item-detail-screen.test.tsx tests/components/work-surface.test.tsx tests/components/work-surface-view.test.tsx --run` passed after review fixes: 14 files, 253 tests.
  - `pnpm lint` passed.
  - `git diff --check` passed.
  - `pnpm typecheck` was attempted and reports only the pre-existing generated `.next/types/cache-life.d 3.ts` duplicate-definition conflict. Slice 6 TypeScript errors found during implementation were fixed.
- Fallow:
  - First `pnpm fallow:gate` failed dead-code on unused `customPropertyScopeTypes`; fixed by converting the runtime array to a direct union type.
  - Second `pnpm fallow:gate` failed health on `assertCustomDisplayPropertyAllowed` and store `createCustomPropertyDefinition`; fixed by extracting owner-bound validation/scope helpers.
  - Third `pnpm fallow:gate` failed duplication in custom property person-user mapping and route/store tests; fixed with owner-local helpers and existing mutable store harness.
  - Final `pnpm fallow:gate` passed.
  - Dead-code: 0 issues.
  - Production health gate: findings=0, functions_above_threshold=0, score=95.7, grade=A.
  - Duplication budget: clone_groups=0, duplicated_lines=0, duplication_percentage=0.00%.
- Deep review findings and fixes:
  - Convex personal work-index loading missed private custom properties for private items in workspaces that were accessible through workspace membership but had no accessible team. Fixed by deriving private definition workspace ids from readable work items as well as teams, and added a scoped handler regression test.
  - Private custom display props were revalidated on visibility toggle but not when filters were cleared, allowing a private custom property to remain on a mixed personal view. Fixed `clearViewFiltersHandler` to revalidate custom display props against the cleared filters and added a regression test.
  - Private custom-property scope-key resolution could be called with another `ownerId` and still return that owner’s personal work-index key. Fixed Convex resolver to return no private keys unless target owner matches the authenticated context user.
- Normal re-review findings: none after the above fixes, focused validation, lint, diff check, and Fallow rerun.
- Spec drift:
  - Discovery-confirmed gaps for route invalidation, saved view display props, auth bootstrap, cleanup, and UI person candidates were already incorporated into `design.md`, `requirements.md`, and `tasks.md` before the slice implementation continued.
  - No new spec update was needed after the Slice 6 review fixes; they were direct closures of the existing read-model/view-bypass requirements.
- Residual risk:
  - Browser visual smoke remains pending for final UI audit.
  - Full typecheck remains blocked by generated `.next/types/cache-life.d 3.ts` duplication outside this slice.

## Slice 7: Work Surface Polish

- Review mode: deep `diff-review` with `architecture-standards`, followed by normal architecture-aware re-review.
- Linked requirements: REQ-001, REQ-014, REQ-015.
- Linked design: DES-014.
- Refreshed live-code evidence:
  - `components/app/screens/work-surface-view.tsx` owns list/board label property controls, list-row display-property padding, and list-row hover actions.
  - `components/app/screens/work-item-selection.tsx` owns the shared hover-visible selection checkbox used by list rows, board cards, board child rows, and detail surfaces.
  - `components/app/screens/work-surface-view/board-child-item-row.tsx`, `components/app/screens/work-surface-controls.tsx`, `components/app/screens/property-chips.tsx`, `components/ui/template-primitives.tsx`, and `components/app/screens/shared.tsx` were checked as sibling pill/checkbox/control patterns.
  - `tests/components/work-surface-view.test.tsx` and `tests/components/work-surface.test.tsx` were checked as focused validation surfaces.
- Architecture decisions:
  - Label chevron removal stayed in `WorkItemLabelsPropertyControl`; unrelated select/property/filter chevrons remain because they are intentional dropdown affordances.
  - Checkbox contrast stayed in `WorkItemSelectionCheckbox`, the shared primitive that owns row/card selection visuals, while selected-state semantics remained peer-driven.
  - List row action alignment stayed in list-row primitives by pairing a local reserved-padding constant with the action offset constant so future edits cannot move one without seeing the other.
- Implementation summary:
  - Removed the label-pill `CaretDown` from the work-surface label property trigger.
  - Darkened unchecked selection checkboxes with `border border-fg-4` while preserving checked gray box and foreground tick through `peer-checked:border-transparent`.
  - Moved list row hover actions to `right-5` and increased matching row display-property reservation to `pr-12`.
  - Added focused DOM class/structure tests for chevron absence, checkbox contrast, and row action/reserved-padding alignment.
- Validation:
  - `pnpm vitest tests/components/work-surface-view.test.tsx --run` passed: 1 file, 97 tests.
  - `pnpm vitest tests/components/work-surface-view.test.tsx tests/components/work-surface.test.tsx --run` passed: 2 files, 110 tests.
  - `pnpm exec eslint components/app/screens/work-surface-view.tsx components/app/screens/work-item-selection.tsx tests/components/work-surface-view.test.tsx --max-warnings 0` passed.
  - `git diff --check -- components/app/screens/work-surface-view.tsx components/app/screens/work-item-selection.tsx tests/components/work-surface-view.test.tsx .spec/chat-private-task-polish` passed.
- Fallow: `pnpm fallow:gate` passed.
  - Dead-code: 0 issues.
  - Production health gate: findings=0, functions_above_threshold=0, score=95.7, grade=A.
  - Duplication budget: clone_groups=0, duplicated_lines=0, duplication_percentage=0.00%.
- Deep review findings: none.
- Normal re-review findings: none after focused validation, lint, diff check, branch-interaction review, and Fallow.
- Spec drift: none. Discovery confirmed Slice 7 remains a narrow presentation-primitive polish slice; no domain, store, API, Convex, schema, read-model, cleanup, sanitizer, or lifecycle paths changed.
- Residual risk:
  - Browser visual smoke remains pending for final UI audit.
  - Full typecheck remains blocked by generated `.next/types/cache-life.d 3.ts` duplication outside this slice.

## Slice 8: Final Validation And Total Branch Review

- Review mode: total branch/worktree deep `diff-review` with `architecture-standards`, followed by normal architecture-aware re-review and final Fallow rerun.
- Linked requirements: REQ-001 through REQ-016.
- Linked design: DES-001 through DES-014.
- Branch scope reviewed:
  - Spec package: `.spec/chat-private-task-polish/design.md`, `requirements.md`, `tasks.md`, `reviews.md`.
  - Chat/files/reply/status/reactions surfaces: `components/app/collaboration-screens/*`, `components/app/message-quote.ts`, rich-text sanitizer/canonical/TipTap paths.
  - Private metadata contracts: label and custom-property domain helpers, schemas, API routes, server wrappers, Convex handlers/schema/validators/indexes, read models, invalidation, bootstrap, cleanup, store slices, UI editors/menus/views, and tests.
  - Work-surface polish: list/board row checkbox, label property trigger, row action spacing, and focused component tests.
- Architecture lens:
  - Private metadata privacy and ownership must be enforced at domain/API/Convex/read-model boundaries, not only in UI filters.
  - Read-model invalidation must derive scope keys through authenticated resolver paths when private owner data is involved.
  - Chat file preview and quote behavior must stay in presentation/content boundaries, with sanitizer/canonical metadata allowances kept narrow.
  - Work-surface polish must remain in shared primitives or owning row controls without changing unrelated dropdown affordances.
- Final deep-review findings and fixes:
  - **FIXED:** Private label creation invalidated the owner personal work index but not owner private task detail scopes, even though private task detail read models include owner-private labels as picker options. Fixed by adding a `private-label` scoped read-model target, resolving keys through the authenticated Convex resolver, checking `ownerId === context.currentUserId`, and adding `getPrivateLabelScopeKeys` for personal work-index plus affected private detail scopes. Updated the label API route and added route, pure read-model, and Convex resolver tests.
  - **FIXED:** Full-suite validation exposed stale tests after earlier branch changes. `tests/lib/server/convex-collaboration.test.ts` now expects stricter unsafe-anchor removal, and `tests/app/api/platform-route-contracts.test.ts` now mocks/asserts the helper-level scoped read-model invalidation path used by the route.
- Normal re-review findings: none after the final private-label invalidation fix, focused validation, lint, full tests, Fallow, and branch-total recheck.
- Final validation:
  - Focused changed-surface suite passed: `pnpm vitest tests/components/conversation-files-panel.test.tsx tests/components/chat-thread.test.tsx tests/components/workspace-chats-screen.test.tsx tests/components/channel-ui.test.tsx tests/lib/content/rich-text-security.test.ts tests/lib/collaboration-canonical-content.test.ts tests/lib/domain/labels.test.ts tests/lib/domain/default-views.test.ts tests/lib/store/work-item-actions.test.ts tests/lib/store/custom-properties.test.ts tests/convex/work-item-handlers.test.ts tests/convex/workspace-team-handlers.test.ts tests/convex/work-helpers.test.ts tests/convex/view-handlers.test.ts tests/convex/auth-bootstrap-health.test.ts tests/convex/cleanup.test.ts tests/convex/custom-property-handlers.test.ts tests/convex/scoped-read-model-handlers.test.ts tests/lib/scoped-read-models.test.ts tests/app/api/asset-notification-invite-route-contracts.test.ts tests/app/api/custom-properties-route-contracts.test.ts tests/components/work-item-labels-editor.test.tsx tests/components/work-surface-view.test.tsx tests/components/work-item-detail-screen.test.tsx tests/components/create-dialogs.test.tsx tests/components/work-item-menus.test.tsx tests/components/work-surface.test.tsx tests/components/custom-property-controls.test.tsx --run`: 28 files, 439 tests.
  - `pnpm lint` passed.
  - `pnpm test` passed: 231 files, 1599 tests.
  - `git diff --check` passed.
  - `pnpm typecheck` remains blocked by generated `.next/types/cache-life.d 3.ts` duplicate identifier conflicts before project-file checking.
- Final Fallow:
  - `pnpm fallow:gate` passed after the final fix.
  - Dead-code: 0 issues.
  - Production health gate: findings=0, functions_above_threshold=0, score=95.7, grade=A.
  - Duplication budget: clone_groups=0, duplicated_lines=0, duplication_percentage=0.00%.
- Browser/visual smoke:
  - A local Next server is already listening on port 3000.
  - `curl -I http://127.0.0.1:3000/` returns 307 to `/login`.
  - `curl -I http://127.0.0.1:3000/login` returns 200.
  - `curl -I http://127.0.0.1:3000/chats` and `curl -I http://127.0.0.1:3000/team/platform/work` return 307 to `/login?next=%2Fworkspace%2Fprojects`.
  - No in-app browser/screenshot tool was callable after tool discovery, and this environment has no authenticated browser session for protected chat/work-surface screens. Visual inspection of authenticated UI remains blocked; HTTP reachability was checked instead.
- Spec drift:
  - The final private-label invalidation fix closes REQ-010/REQ-016 without changing the intended scope.
  - No additional design or requirement broadening was needed; the existing read-model invalidation requirement already covered this gap.
- Residual risk:
  - TypeScript cannot be fully proven until the generated `.next/types/cache-life.d 3.ts` duplicate file conflict is removed or regenerated.
  - Authenticated browser visual smoke for chat/files/work-surface UI remains unperformed due unavailable browser tooling/session, despite passing component tests and HTTP reachability.

## Post-Final Chat Scroll And Reaction Regression

- Review mode: focused normal diff review with `architecture-standards` against REQ-004 and REQ-007 after user-reported runtime behavior.
- User-reported issue:
  - Last-message reactions were still getting cut off near the composer.
  - Opening a loaded chat with previews/images could land halfway through the chat instead of at the bottom.
  - Sending a chat message, including messages with files/images, must force the latest message fully into view.
- Root cause:
  - The chat auto-scroll effect depended on `latestMessageId`; adding a reaction to the latest message changes layout without changing that id, so the effect did not rerun.
  - The message-end sentinel was only `h-px`, leaving no safe bottom room for the final reaction row above the composer.
  - One animation-frame retry and image load listeners were not enough for preview/image layout settlement in all cases.
- Fix:
  - Replaced the auto-scroll dependency with a latest-message layout key that includes id, content, deletion state, and reaction counts.
  - Increased the message-end spacer to `h-10` so the final message/reaction row has safe bottom space.
  - Added an additional animation-frame retry, bounded delayed retries, and pending image load/error listeners during each auto-scroll cycle so image/file preview height settlement keeps the pane pinned to the bottom without a long-lived observer.
- Rerun diff review with architecture standards:
  - **FIXED:** The first post-final patch used a `ResizeObserver` on the scroll container. Architecture review flagged that as the wrong lifecycle/owner shape because it could keep forcing bottom scroll on later container resizes and did not directly observe message content height. Replaced it with bounded layout-settlement retries plus image load/error listeners, keeping the behavior local to each latest-message layout change.
- Validation:
  - Rerun `pnpm vitest tests/components/chat-thread.test.tsx --run` passed: 1 file, 33 tests.
  - Rerun `pnpm exec eslint components/app/collaboration-screens/chat-thread.tsx tests/components/chat-thread.test.tsx --max-warnings 0` passed.
  - Rerun `git diff --check -- components/app/collaboration-screens/chat-thread.tsx tests/components/chat-thread.test.tsx .spec/chat-private-task-polish/reviews.md` passed.
  - `pnpm fallow:gate` passed: dead-code 0 issues; health findings=0, functions_above_threshold=0, score=95.7, grade=A; duplication clone_groups=0, duplicated_lines=0, duplication_percentage=0.00%.
- Residual risk:
  - Authenticated browser visual confirmation still depends on the user testing in the running localhost session because no browser/screenshot driver is callable in this environment.

## Post-Final Chat Load Flicker Improvement

- Review mode: focused normal diff review with `architecture-standards` against REQ-004 after user-reported load flicker.
- User-reported issue:
  - Chat could visibly render before the bottom-scroll correction, creating a flicker/jump while loading an existing conversation.
- Root cause:
  - The first auto-scroll cycle used `useEffect`, so the browser could paint the initial message layout before the hook forced the pane to the bottom.
- Fix:
  - Moved the chat auto-scroll cycle from `useEffect` to `useLayoutEffect` so the initial bottom positioning runs after DOM commit but before paint.
  - Kept the bounded delayed retries and pending image load/error listeners for file/image preview settlement after first paint.
- Architecture review:
  - The change stays presentation-owned inside `ChatThread`; it does not alter store, API, read-model, or message persistence behavior.
  - `useLayoutEffect` is proportionate here because the failure is a pre-paint layout/scroll invariant on a client-only component.
- Validation:
  - `pnpm vitest tests/components/chat-thread.test.tsx --run` passed: 1 file, 33 tests.
  - `pnpm exec eslint components/app/collaboration-screens/chat-thread.tsx tests/components/chat-thread.test.tsx --max-warnings 0` passed.
  - `git diff --check -- components/app/collaboration-screens/chat-thread.tsx tests/components/chat-thread.test.tsx` passed.
  - `pnpm fallow:gate` passed: dead-code 0 issues; health findings=0, functions_above_threshold=0, score=95.7, grade=A; duplication clone_groups=0, duplicated_lines=0, duplication_percentage=0.00%.
- Residual risk:
  - Authenticated browser visual confirmation still depends on the running localhost session because no browser/screenshot driver is callable in this environment.

## Post-Final Chat Bottom Spacing Adjustment

- Review mode: focused normal diff review with `architecture-standards` after user feedback on excess empty space below the final chat message.
- User feedback:
  - The scroll push-up behavior is acceptable, so the added bottom spacer should be removed.
  - Reaction clearance should not create a visibly large empty area under plain or deleted last messages.
- Fix:
  - Restored the message-end element to a minimal `h-px` scroll sentinel.
  - Kept the pre-paint `useLayoutEffect` scroll and bounded layout-settlement retries so the last message can still be scrolled fully into view when reactions/files/images affect height.
  - Refactored duplicate create-dialog test setup surfaced by Fallow during this loop; no product behavior changed there.
- Architecture review:
  - This keeps the spacing concern in the chat presentation boundary and avoids layout state or dynamic pushing logic beyond scroll anchoring.
  - The test refactor is owner-local to `create-dialogs.test.tsx` and removes duplicated setup without introducing a production helper.
- Validation:
  - `pnpm vitest tests/components/chat-thread.test.tsx tests/components/create-dialogs.test.tsx --run` passed: 2 files, 69 tests.
  - `pnpm exec eslint components/app/collaboration-screens/chat-thread.tsx tests/components/chat-thread.test.tsx tests/components/create-dialogs.test.tsx --max-warnings 0` passed.
  - `git diff --check -- components/app/collaboration-screens/chat-thread.tsx tests/components/chat-thread.test.tsx tests/components/create-dialogs.test.tsx` passed.
  - `pnpm fallow:gate` passed: dead-code 0 issues; health findings=0, functions_above_threshold=0, score=95.7, grade=A; duplication clone_groups=0, duplicated_lines=0, duplication_percentage=0.00%.
- Residual risk:
  - Authenticated browser visual confirmation remains user-verified in the running localhost session because no browser/screenshot driver is callable in this environment.
