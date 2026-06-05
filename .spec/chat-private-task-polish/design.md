---
title: Chat Private Task Polish Design
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

# Design

## Discovery Evidence

- Chat thread UI is in `components/app/collaboration-screens/chat-thread.tsx`; `ChatComposer` currently calls `flushPendingAttachmentUploads` without a send-in-flight guard, and its send button is disabled only by editability and plain text.
- Chat files UI is in `components/app/collaboration-screens/conversation-files-panel.tsx`; file rows and the open action are currently anchors with `target="_blank"`.
- Channel files already exist in `components/app/collaboration-screens.tsx` through `ChannelPostFeedPanel`, `ConversationTabBar`, and `ConversationFilesPanel`.
- Team chat is in `TeamChatBody` in `components/app/collaboration-screens.tsx`; it renders `ChatThread showHeader={false}`, so the existing header-hosted tab bar is hidden there.
- Rich-text image preview behavior exists in `components/app/rich-text-content.tsx`; that component already owns click interception for image preview and access-safe reference navigation.
- Chat quote creation is in `components/app/message-quote.ts`; it only extracts plain text and drops image/link structure and message identity.
- Rich-text sanitizer/canonical owners are `lib/content/rich-text-security.ts` and `lib/collaboration/canonical-content.ts`; both can strip newly invented metadata unless updated narrowly.
- Chat conversation-list avatars are in `components/app/collaboration-screens/workspace-chat-avatar.tsx` and `workspace-chats-screen.tsx`; they hardcode `showStatus={false}` while thread avatars use presence-derived status.
- Reaction rows exist in `ChatMessageReactions`, `ForumPostReactions`, and channel comment primitives; layout currently relies on local margin rather than reserved row space across containers.
- Label domain rules live in `lib/domain/labels.ts`; current rules make only workspace labels visible and reject labels for private work items.
- Store and backend validation also reject or strip private labels: `lib/store/app-store-internal/validation.ts`, `lib/store/app-store-internal/slices/work-item-actions.ts`, `convex/app/work_helpers.ts`, and `convex/app/work_item_handlers.ts`.
- Label creation currently accepts only workspace labels at `labelCreateSchema`, `app/api/labels/route.ts`, `lib/server/convex/work.ts`, `lib/convex/client/work.ts`, `convex/app.ts`, and `convex/app/workspace_team_handlers.ts`.
- Convex label validators already include optional `scopeType: "workspace" | "private"` and `ownerId`, but schema indexes and handlers are not owner-scoped.
- Custom property validators have partial private fields, but models, schemas, store, API, Convex handlers, and read models still require team-owned definitions and values.
- `customPropertyDefinitions` and `customPropertyValues` indexes are team-oriented in `convex/schema.ts`; private owner/workspace read and cleanup paths need owner-scoped indexes.
- Scoped read models select labels and custom properties through workspace/team paths in `lib/scoped-sync/read-models.ts` and `convex/app/scoped_read_models.ts`; private metadata must not leak into broad workspace/team/project/document models.
- Custom property route invalidation in `app/api/custom-properties/[propertyId]/route.ts` resolves by `teamId`; private definitions need an owner/workspace invalidation target instead of pretending a team exists.
- Custom property view display-prop validation in `convex/app/view_handlers.ts` allows team properties in personal views and rejects private ones without checking whether the personal view is non-shared and private-only; visibility changes also need to revalidate existing custom display props.
- `convex/app/auth_bootstrap.ts` loads custom property definitions by accessible teams only, so nullable-team private definitions are not bootstrapped, and any owner-private direct payload must still be constrained to accessible owner-private workspaces and visible work items.
- Custom property person values are collected into scoped read-model users, but `convex/app/cleanup.ts` unreferenced-user cleanup does not count person custom property values, so a user referenced only by a property value could be deleted.
- `components/app/screens/custom-property-controls.tsx` creates custom properties with `teamId` only and derives person-picker users from `item.teamId`; private tasks need workspace-scoped create and workspace-visible person candidates.
- Private label discovery found that `selectLabelsForWorkspaceIds` intentionally emits workspace labels only, while personal work-index and private work-item detail read models need a narrower owner-private label lane for the current user's private tasks.
- Private label review found direct auth bootstrap payloads in `convex/app/auth_bootstrap.ts` that bypass selector-level read-model filtering; workspace membership bootstrap must stay workspace-label-only, while owner-only full snapshots may include owner-private label definitions for accessible workspaces so unassigned private labels remain usable.
- Private label review found `assertViewLabelIds` in `convex/app/work_helpers.ts` still rejected private labels in all personal item view filters; private labels must be allowed only for non-shared owner personal item views whose visibility filter is exactly private, while mixed/shared/non-item views remain workspace-label-only.
- Default private task view `view_assigned_private_tasks` in `lib/domain/default-views.ts` omits `labels`.
- Work-surface label chips and row controls are in `components/app/screens/work-surface-view.tsx`; the label control appends a `CaretDown`, private labels are hidden, row hover actions reserve `pr-10` with `right-3.5`, and shared checkbox style is in `components/app/screens/work-item-selection.tsx`.
- Fallow is configured through `pnpm fallow:gate` with dead-code, health, and duplication scripts in `package.json`; this spec treats those as blocking slice checkpoints separate from advisory inventories.

## Decisions

### DES-001: Spec And Review Process Is Part Of The Implementation Contract

This change is implemented from `.spec/chat-private-task-polish/` and each slice must refresh live-code evidence before editing. The known plan is a guardrail, not an exhaustive file list. If implementation discovery contradicts this design, update `design.md`, then `requirements.md`, then `tasks.md` before continuing.

Architecture lens: verification and enforcement. The review loop is encoded in tasks and reviews so broad, privacy-sensitive work cannot drift through silent local patches.

### DES-002: File Preview Is A Chat/Channel Presentation Capability

`ConversationFilesPanel` remains the shared files surface for workspace chats, team chat, and channels. File rows open an in-app preview contract. Images reuse the existing rich-text image preview pattern. Non-image attachments open an in-app attachment modal with metadata and a direct download action. Explicit download links remain direct downloads.

Architecture lens: ownership and contract. File presentation belongs in the conversation files UI; storage URLs stay data, not navigation authority.

### DES-003: Team Chat Gets Tabs Without Reintroducing The Workspace Chat Header

`ChatThread` should support a visible tab control even when `showHeader={false}`. Team chat needs Chat/Files controls, but not the full workspace chat header.

Architecture lens: presentation boundary. The thread owns active tab state; the caller chooses header composition.

### DES-004: Composer Sending Is A Single In-Flight Command

Chat composer send must be blocked while attachment flushing or message send is in flight. Enter and click send route through the same guarded command. Pending attachment flush failures keep composer content intact. Image-only drafts count as meaningful content when they contain editor image or attachment markup, even when plain text is empty. The existing server idempotency path remains a backstop, not the primary UI behavior.

Architecture lens: async state ownership. The composer owns in-flight UI state; store/API/Convex idempotency remains authoritative for duplicate delivery resilience.

### DES-005: Chat Scroll Targets The Latest Message On Open, Send, Tab Return, And Image Settle

The chat pane scroll behavior remains in `ChatThread`/`useChatMessagesAutoScroll`. It must run when a thread opens, latest message changes, Files returns to Chat, and images inside messages load or error.

Architecture lens: user journey and reliability. Scroll is a presentation effect tied to message materialization, not a store mutation.

### DES-006: Reply Quotes Preserve Source Structure And Navigation

Chat reply quotes must preserve source image/link format: posted image previews stay image previews and inline attachment links stay inline links. The quote includes narrow source metadata identifying the original chat message. Clicking the quoted source navigates to and highlights/focuses the original message. The metadata must be modeled as a rich-text content contract so sanitizer, TipTap blockquote attributes, and canonical collaboration normalization preserve only the validated source message id.

Architecture lens: contract and compatibility. Quote metadata is narrowly admitted by sanitizer and canonical normalization; message DOM anchors provide the navigation target.

### DES-007: Conversation List Presence Mirrors Thread Avatar Presence

Workspace direct and group conversation-list avatars use the same presence view as thread avatars. Former or unknown members must not show misleading live status.

Architecture lens: shared presentation contract. Presence display derives from workspace-user presence helpers, not duplicated status decisions in list rows.

### DES-008: Reaction Rows Reserve Space At Their Owner Surfaces

Chat message, channel post, and channel comment containers must reserve enough vertical/overflow space for reactions so reaction chips are not clipped by adjacent content or hover action layers.

Architecture lens: presentation containment. Each message/post/comment surface owns its own reaction layout safety.

### DES-009: Private Labels Are Owner-Scoped Domain Data

Private labels are valid only for private work items owned by the current user in a workspace. `ownerId` is derived server-side from `currentUserId`; clients may request `scopeType: "private"` but cannot supply owner authority. Workspace labels remain assignable to team/workspace work items and must not be assignable to private tasks.

Architecture lens: ownership and authority. The domain helper owns visibility/assignability; API and Convex enforce server-derived ownership; UI mirrors that rule.

### DES-010: Private Labels Use Owner-Private Work Read Models Only

Private labels are exposed only through private-task owner surfaces, especially My Items private tasks, non-shared private-only personal item view filters, and private work item detail. Owner-only personal work-index and full-snapshot contexts may include current-user private label definitions for accessible workspaces, including unassigned labels, so private task create/filter flows remain usable. Private work item detail may include current-user private labels for that item's workspace. Broad team, workspace, project, document, search, workspace membership, auth bootstrap membership, and shared pickers stay workspace-label-only or otherwise filter private labels out.

Architecture lens: dataflow and materialization. Private labels travel through owner/private work read models, not broad workspace membership snapshots.

### DES-011: Private Custom Properties Are Owner-Scoped Definitions And Values

Private custom property definitions and values are valid only for owner private tasks. Private definitions have `scopeType: "private"`, `workspaceId`, server-derived `ownerId`, and nullable `teamId`. Private values also use nullable `teamId` and can only attach to private work items owned by the same user in the same workspace.

Architecture lens: persistence and contract. The stored shape must match the domain scope instead of overloading team fields.

### DES-012: Private Person Properties Use Workspace-Visible Users

For private custom properties of type `person`, the value must reference a user visible in the same workspace to the private-task owner. Team membership is not required for private tasks.

Architecture lens: authorization and compatibility. The private path has a workspace membership invariant; team custom properties keep team-member validation.

### DES-013: Private Custom Properties Do Not Enter Shared Or Mixed Views

Private custom properties appear only in owner private-task surfaces and private-only personal views. They must not appear in team views, workspace views, project/document pickers, or mixed personal views that include team work.

Architecture lens: materialization and downstream reads. Definition visibility alone is insufficient; view context must also be private-task-only.

Saved view display-property validation must treat private custom properties like private labels: only non-shared owner personal item views with visibility exactly `["private"]` may include them. If visibility changes away from that shape, existing private custom display props are invalid and must be rejected before persistence.

Architecture lens: dataflow and enforcement. Display props are persisted view contracts and must be revalidated when either the displayed property set or the private-only context changes.

### DES-014: Work-Surface Polish Stays In Shared Work-Surface Primitives

Remove the inconsistent label chip chevron at the label-pill surface only. Darken the shared selection checkbox contrast in `WorkItemSelectionCheckbox`. Align the right-side row action trigger by changing reserved padding and trigger offset together in list-row primitives.

Architecture lens: narrow UI ownership. Styling fixes belong in shared primitives where the repeated row/pill behavior is rendered.

## Public Contracts

- Label create payload supports `scopeType: "workspace" | "private"`; `ownerId` is never accepted from the client.
- Custom property create payload is scope-discriminated:
  - team: `{ scopeType: "team", teamId }`
  - private: `{ scopeType: "private", workspaceId }`
- Custom property definitions and values support nullable `teamId` for private scope.
- Scoped read-model invalidation gains private custom-property targets.
- Rich-text sanitizer and canonical normalization allow only the quote-source metadata needed for chat reply navigation.

## Validation Strategy

- Each slice runs focused tests for the changed owner boundary plus `pnpm fallow:gate`.
- High-risk data slices include domain, store, API, Convex handler, read-model, cleanup/lifecycle, and leak tests.
- Final validation includes focused changed-surface tests, `pnpm typecheck`, `pnpm lint`, `pnpm test` where feasible, `pnpm fallow:gate`, and browser/visual smoke for chat/files/work-surface UI when a running app is available.

## Audit

- Original request coverage: files preview, team chat Files, attachment double-send prevention, bottom scroll, reaction spacing, label chevron removal, private labels, private custom properties, checkbox contrast, row action alignment, reply image quote navigation, conversation-list status icons, architecture standards, slice reviews, final reviews, and Fallow checkpoints are all represented.
- Repository evidence coverage: UI, shared helpers, domain, store, API, Convex handlers, validators, schema/indexes, read models, cleanup/lifecycle, sanitizer/canonical content, tests, and sibling surfaces were audited before this artifact.
- Architecture standards applied: durable rules are assigned to their owning boundaries: UI for presentation state, domain for assignability/visibility, API/Convex for server authority, schema/indexes for persistence access, read models for owner-private materialization, and tests/Fallow/reviews for enforcement.
- No downstream artifact introduces scope beyond these design decisions.
