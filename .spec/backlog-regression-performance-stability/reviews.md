---
title: Backlog Regression Performance Stability
scope: backlog-regression-performance-stability
status: implementation-ready
repo_root: /Users/declancowen/Documents/GitHub/Linear
change_class: audit-remediation
risk_level: high
owner: product-engineering
reviewers: []
approvers: []
implementation_owner: product-engineering
operations_owner: product-engineering
last_updated: 2026-06-03
---

# Reviews: Backlog Regression Performance Stability

## Review Ledger Purpose
This file is the authoritative implementation review ledger for `.spec/backlog-regression-performance-stability`.

Every future implementation slice must record:
- slice ID and linked tasks,
- linked `DES-*` and `REQ-*`,
- focused validation,
- deep diff-review outcome,
- findings and fixes,
- normal re-review outcomes until clean,
- architecture-standard decisions,
- spec drift decisions,
- requirement audit,
- residual risk,
- whether the slice is cleared to continue.

## Required Per-Slice Review Loop
1. Read linked `DES-*`, `REQ-*`, task entries, original ask, relevant code, and tests before editing.
2. Implement one coherent slice only.
3. Run focused validation.
4. Run deep `diff-review` first with `architecture-standards`.
5. Fix live findings.
6. Run normal `diff-review` loops until clean.
7. Record the complete outcome here before moving to the next slice.

## Required Final Review Loop
1. Run full validation across all completed slices.
2. Run a final deep total-diff review across the entire worktree and full plan.
3. Fix live findings.
4. Run normal total-diff reviews until clean.
5. Record final clean state here.
6. Only after that, create/use a branch, commit, push, and open a draft PR to `main`.

## Review Entries

### 2026-06-03: Slice 99.1 final total-diff review, architecture assessment, and PR readiness
- Linked tasks: 99.1
- Linked requirements: REQ-FINAL-001, REQ-PR-001, REQ-KNOWLEDGE-001, REQ-RECORD-001, REQ-DRIFT-001
- Linked design decisions: DES-001 through DES-015
- Review mode: final deep total-diff review with architecture-standards, followed by normal full-worktree re-review and final full-diff architecture assessment
- Scope reviewed:
  - Original backlog prompt, slash/reference clarification, billing/cost prompt, later user corrections, and the full spec package.
  - Every implementation slice from cost containment/scoped read models through product regressions, chat/read receipts, guardrails, and operational cleanup.
  - Everything touched and connected around read-model authority, snapshot removal, scoped invalidation, Convex cost bounds, route/backend contract fit, store reconciliation, and shared UI surfaces.
- Final findings and fixes:
  - Finding 1: idempotent channel post comment deletion could still resolve/bump scope keys after a no-op delete. Fixed by returning `{ deleted: false }` from the Convex handler for missing comments and only resolving/bumping scopes after real deletes.
  - Finding 2: two final-suite tests asserted before deferred sidebar/collaboration state attached. Fixed with deterministic waits in the work item detail and document collaboration tests.
  - Finding 3: conversation-list scoped read model still read full chat histories for previews. Fixed with `chatMessages.by_conversation_created_at`, bounded latest-readable-message helpers, and handler/static tests proving list previews no longer call full conversation message history.
- Final architecture assessment:
  - Clean after fixes. Read-model API routes are thin scoped adapters, read-model authority and authorization are server/Convex-owned, scoped invalidation authorizes scope keys before streaming, polling/retry/degraded refresh intervals are cost-bounded, and static cost guardrails prevent snapshot-backed read-model relapse.
  - The scoped Convex materializer remains a transitional compatibility layer over scoped collections only; it does not call `getSnapshotServer` and is protected by route/static/handler tests.
  - Conversation lists now load bounded previews while conversation threads keep full thread reads because they own detail rendering.
  - Legacy snapshot and custom-property snapshot routes remain outside this read-model migration and are recorded as residual cost/audit risk if those paths become hot.
- Validation:
  - `pnpm exec vitest run tests/convex/scoped-read-model-handlers.test.ts tests/app/api/read-model-static-guards.test.ts tests/components/workspace-chats-screen.test.tsx` - passed, 3 files / 12 tests after final cost-bound fix.
  - `pnpm cost:guardrails` - passed, 4 files / 15 tests.
  - `pnpm exec tsc --noEmit --pretty false` - passed.
  - `pnpm lint` - passed.
  - `pnpm test` - passed, 222 files / 1471 tests.
  - `pnpm build` - passed.
  - `python3 ~/.codex/skills/spec-driven-development/scripts/lint_spec.py --spec-dir .spec/backlog-regression-performance-stability` - passed.
  - `python3 ~/.codex/skills/spec-driven-development/scripts/traceability_report.py --spec-dir .spec/backlog-regression-performance-stability --strict` - passed.
  - `git diff --check` - passed.
  - Browser smoke was intentionally not run because the user instructed the implementation agent not to run smoke tests; manual browser smoke is user-owned validation.
- Normal re-review result:
  - Re-read final fixes, route/backend contracts, scoped read-model boundaries, cost guardrails, schema indexes, chat read-state/store suppression, and updated tests after fixes.
  - No live Critical, High, or Medium findings remain.
- Spec drift:
  - No drift remains. The spec covers the original backlog, billing/cost plan, review-loop addendum, no-partial-fixes rule, backend investigation requirement, read-receipt/chat clarifications, project icon inheritance, user-owned browser smoke, and final architecture assessment requirement.
- Requirement audit:
  - Slash Reference opens scoped search mode from typed/rendered slash Reference.
  - Cost drivers are addressed through polling/reconnect containment, real scoped read models, bounded conversation-list previews, no read-model route snapshots, and guardrails.
  - Product slices cover performance/TipTap/create-modal typing, work-surface selection/filtering/private leakage/bulk actions, document pills, inherited project name/icon, sort/label dropdowns, chat panel/read previews/message metadata/link styling, profile/sidebar/comment polish.
  - Review protocol was followed and recorded per slice and finally across the whole worktree.
- Residual risk:
  - Manual browser smoke remains user-owned.
  - High-cardinality detail streams may still need pagination as production data grows.
  - Failed unsent email jobs still use a bounded `createdAt` fallback until a terminal failure timestamp exists.
  - Legacy snapshot/custom-property snapshot routes should be watched in cost diagnostics if traffic makes them hot.
- Cleared for PR delivery:
  - Yes. Create/use a branch, stage intended files, commit, push, and open a draft PR to `main`.

### 2026-06-03: Slice 9.1 cost guardrails and operational cleanup
- Linked tasks: 9.1
- Linked requirements: REQ-GUARDRAIL-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001
- Linked design decisions: DES-014, DES-015, DES-007, DES-008
- Review mode: deep diff-review with architecture-standards, followed by normal re-review and a clean slice architecture assessment
- Scope implemented:
  - Added `cost:guardrails` as a package script for read-model/static cost checks.
  - Added cost diagnostic row helpers exposing function/route, calls/day, DB I/O/day, return bytes, and source.
  - Added Convex environment target audit helpers that make local/prod target differences and local URL/CLI mismatches visible.
  - Strengthened read-model static guards so snapshot-backed route/server-handler relapse and non-scoped route handlers fail tests.
  - Added retention indexes and a token-gated, dry-run-by-default Convex operational retention cleanup mutation for old terminal notifications, sent/failed email jobs, and stale scoped read-model version rows.
  - Extended the Convex test DB helper to record query operations and support range filters so bounded cleanup behavior is testable.
- Owner and sibling-path audit:
  - Operations diagnostics owner: `lib/operations/convex-cost-guardrails.ts`.
  - Static architecture guard owner: `tests/app/api/read-model-static-guards.test.ts`.
  - Retention policy owner: `convex/app/maintenance.ts`, exported through `convex/app.ts` as an operational mutation using the existing server-token gate.
  - Schema/index owner: `convex/schema.ts`.
  - Backend/cost audit: no read-model route or scoped read-model server handler reintroduced `getSnapshotServer`; adjacent scoped route/handler contract tests still pass.
- Validation:
  - `pnpm cost:guardrails` - passed, 4 files / 15 tests.
  - `pnpm exec vitest run tests/app/api/read-model-route-contracts.test.ts tests/app/api/scoped-events-route-contracts.test.ts tests/convex/scoped-read-model-handlers.test.ts` - passed, 3 files / 24 tests.
  - `pnpm exec tsc --noEmit --pretty false` - passed.
  - `pnpm lint` - passed.
  - `git diff --check` - passed.
  - Browser smoke was intentionally not run because the user instructed the implementation agent not to run smoke tests; it is not applicable to this ops/static slice.
- Deep-review findings:
  - Finding 1: the initial retention cleanup was delete-bounded but not read-bounded, and the first bounded-read shape could get stuck behind old active notifications or pending email jobs. Fixed by using indexed terminal timestamp scans with capped `take()` calls, candidate dedupe, query-operation assertions, and blocker regression tests.
- Normal re-review result:
  - Re-read diagnostics/env helpers, static guards, schema indexes, maintenance cleanup, Convex mutation export, test DB range/query logging, and retention tests after the fixes.
  - No live Critical, High, or Medium findings remain for slice 9.1.
- Architecture assessment:
  - Clean. Cost/ops helpers stay in an operations module, retention policy stays in the Convex maintenance authority, schema indexes make cleanup bounded, and static tests act as architecture fitness functions.
  - The cleanup mutation is server-token gated, dry-run by default, bounded by read and delete limits, and avoids deleting active notifications or pending/retryable email jobs.
  - No UI/client helper or Next route owns retention deletion policy.
- Spec drift:
  - No spec drift found. Task 9.1 covers REQ-GUARDRAIL-001 and continues the billing/cost plan after the earlier immediate-containment and real-scoped-read-model slices.
- Requirement audit:
  - Snapshot-backed read-model route/server-handler relapse fails static tests.
  - Unsafe scoped polling defaults remain covered by the cost guardrails script.
  - Diagnostics expose function/route cost fields.
  - Retention cleanup is bounded, dry-run first, and covered by active-data and blocker regression tests.
  - Local/prod Convex target confusion is visible through env audit findings.
- Residual risk:
  - Failed unsent email jobs still use a bounded `createdAt` fallback because the current schema has no terminal failure timestamp. Future schema work can add a failure timestamp/index if cleanup volume shows that path is material.
- Cleared to continue:
  - Yes. Continue to task 99.1.

### 2026-06-03: Slice 8.1 collaboration polish and shared interaction contracts
- Linked tasks: 8.1
- Linked requirements: REQ-POLISH-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001
- Linked design decisions: DES-013, DES-015, DES-001, DES-002, DES-003
- Review mode: deep diff-review with architecture-standards, followed by normal re-review and a clean slice architecture assessment
- Scope implemented:
  - Changed channel posts/comments, work item inline comments, and work item detail activity comments from Quote actions to Reply actions with a reply icon and no quote insertion.
  - Preserved direct chat Quote behavior and added a writable-chat regression test for it.
  - Raised profile hover-card layering through the `UserHoverCard` owner so avatar hover cards render above app surfaces.
  - Replaced the offline X glyph with a plain decorative status dot.
  - Added denser profile activity detail for comment previews, work item status transitions, label changes, assignee changes, channel comments, and project update previews.
- Owner and sibling-path audit:
  - Reply/quote rendering owner: `MessageHoverActionBar`; surface behavior owner: channel/work item/comment components.
  - Direct chat quote owner: `chat-thread.tsx` and `message-quote.ts`, left intact.
  - Profile hover/status owner: `user-presence.tsx`; no global hover-card z-index change was needed.
  - Activity detail owner: `people-screen.tsx` presentation/view model over existing domain-selected records from `getWorkspacePersonActivity`.
  - Backend/read-model audit: existing comments, work item activities, labels, users, channel comments, and project updates already contain the needed detail; no backend route or Convex mutation change was required.
- Validation:
  - `pnpm exec vitest run tests/components/channel-ui.test.tsx tests/components/work-item-ui-comments-inline.test.tsx tests/components/chat-thread.test.tsx tests/components/user-presence.test.tsx tests/components/people-screen.test.tsx` - passed, 5 files / 41 tests.
  - `pnpm exec tsc --noEmit --pretty false` - passed.
  - `pnpm lint` - passed.
  - `python3 ~/.codex/skills/spec-driven-development/scripts/lint_spec.py --spec-dir .spec/backlog-regression-performance-stability` - passed.
  - `python3 ~/.codex/skills/spec-driven-development/scripts/traceability_report.py --spec-dir .spec/backlog-regression-performance-stability --strict` - passed.
  - `git diff --check` - passed.
  - Browser smoke was intentionally not run because the user instructed the implementation agent not to run smoke tests; manual browser smoke is user-owned validation.
- Deep-review findings:
  - Finding 1: initial reply open handlers cleared existing reply composer drafts, and the offline dot used an `aria-label` for testability that could pollute parent accessible names. Fixed by opening reply composers without changing draft content and making the offline dot decorative/`aria-hidden` while rendering no X glyph.
- Normal re-review result:
  - Re-read reply/quote paths, chat quote preservation, profile hover/status rendering, activity detail helpers, and tests after the fix.
  - No live Critical, High, or Medium findings remain for slice 8.1.
- Architecture assessment:
  - Clean. The shared action primitive only owns icon/label variants; channel/work item surfaces own reply state; chat remains the only quote insertion owner; profile activity detail remains presentation-level view modeling over domain-selected data.
  - No new backend/read-model bypass, snapshot read, polling path, or shared business helper was introduced.
- Spec drift:
  - No spec drift found. The implementation covers REQ-POLISH-001 and the backend-relevance instruction by explicitly checking that current read-model/domain records already carry the required activity details.
- Requirement audit:
  - Non-chat channels/comments/work item comments show Reply with a reply icon and do not insert quoted content.
  - Direct chat messages still expose Quote in writable direct chats.
  - User hover-card content carries a higher app-surface layer class.
  - Offline status dots render without the X glyph and remain decorative.
  - Profile activity rows include comment previews, status from/to, label changes, and update previews with denser typography.
- Residual risk:
  - Manual browser smoke remains user-owned for real hover-card layering across chat/channel/work surfaces and subjective activity row fit.
- Cleared to continue:
  - Yes. Continue to task 9.1.

### 2026-06-03: Slice 7.1 chat consistency and message metadata
- Linked tasks: 7.1
- Linked requirements: REQ-CHAT-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001
- Linked design decisions: DES-012, DES-015, DES-001, DES-002, DES-003
- Review mode: deep diff-review with architecture-standards, followed by normal re-review and a clean slice architecture assessment
- Scope implemented:
  - Stabilized the left workspace conversation-list pane with a fixed default width and a scoped collapse/expand affordance for that left pane only.
  - Changed conversation previews to select the latest non-deleted readable message and guard direct deleted-message preview formatting.
  - Protected pending optimistic chat messages through scoped read-model pruning, merge, and replacement until the send sync settles.
  - Kept read-state writes suppressed when there are no unread state transitions or unread per-message receipt IDs.
  - Redesigned message row metadata so created/read/edited status is right-aligned inline; read state uses an eye icon with timestamp and edited state renders `Edited` without an edited timestamp.
  - Removed the five-minute same-sender grouping cutoff while still resetting grouping across day boundaries, call messages, and sender changes.
  - Rendered chat message links as blue underlined anchor-only text without applying underline/link styling to the message container.
- Owner and sibling-path audit:
  - Left-pane layout/collapse owner: `workspace-chats-screen.tsx` and `workspace-conversation-list-pane.tsx`; details/member sidebars were not touched.
  - Preview owner: `workspace-conversation-preview.ts`, consumed by the conversation list pane.
  - Message metadata/grouping/link presentation owner: `chat-thread.tsx`, using the existing shared `RichTextContent` renderer rather than a new chat renderer.
  - Optimistic disappearance owner: app-store read-model merge/pruning in `ui.ts`, with pending chat sync authority set/cleared in `collaboration-conversation-actions.ts`.
  - Backend/read-state audit: Convex read-state handler already filters unreadable/deleted receipt IDs; this slice narrowed the client readable IDs and did not add new read-state writes.
- Validation:
  - `pnpm exec vitest run tests/components/chat-thread.test.tsx tests/components/workspace-chats-screen.test.tsx tests/lib/store/collaboration-conversation-actions.test.ts tests/lib/store/ui-slice.test.ts tests/lib/app-store-read-model-merge.test.ts` - passed, 5 files / 58 tests.
  - `pnpm exec vitest run tests/convex/chat-message-notifications.test.ts tests/convex/scoped-read-model-handlers.test.ts tests/app/api/read-model-route-contracts.test.ts` - passed, 3 files / 29 tests.
  - `pnpm exec tsc --noEmit --pretty false` - passed.
  - `pnpm lint` - passed after the review finding fix.
  - `python3 ~/.codex/skills/spec-driven-development/scripts/lint_spec.py --spec-dir .spec/backlog-regression-performance-stability` - passed.
  - `python3 ~/.codex/skills/spec-driven-development/scripts/traceability_report.py --spec-dir .spec/backlog-regression-performance-stability --strict` - passed.
  - `git diff --check` - passed.
  - Browser smoke was intentionally not run because the user instructed the implementation agent not to run smoke tests; manual browser smoke is user-owned validation.
- Deep-review findings:
  - Finding 1: the first pane persistence fix read `localStorage` inside initial state and then used a layout effect with synchronous state updates, creating either hydration-mismatch risk or a React lint/performance violation. Fixed by moving persisted width/collapse reads to `useSyncExternalStore` with server snapshots and using explicit local override state for user changes.
- Normal re-review result:
  - Re-read pane sizing/collapse, preview selection, chat row metadata/grouping/link styling, pending chat sync markers, scoped read-model pruning/replace/merge, and read-state mutation guards after the fix.
  - No live Critical, High, or Medium findings remain for slice 7.1.
- Architecture assessment:
  - Clean. Presentation concerns stay in chat components, preview logic stays in the preview selector, optimistic/read-model reconciliation stays in the app-store merge boundary, and backend read-state authority remains in Convex.
  - The pending chat marker is ephemeral UI-store state, not persisted domain data, and is cleared by sync-token ownership when the send task settles.
  - No new broad snapshot read, polling path, or per-render read-state write was introduced.
- Spec drift:
  - No spec drift found. Later read-receipt clarifications are covered by compact right-aligned metadata, eye/read timestamp, and `Edited` text.
- Requirement audit:
  - Left conversation-list panel width is stable and has a scoped collapse/expand control.
  - Deleted messages do not win conversation previews.
  - Pending sent messages are preserved through stale scoped read-model replacement/merge until sync completion.
  - Same-sender identity chrome no longer repeats solely because 30 minutes elapsed, and grouping resets when another sender posts.
  - Links render blue/underlined only on the anchor text.
  - Message metadata is right-aligned inline; read state uses an eye icon plus timestamp where present; edited state says `Edited`.
- Residual risk:
  - Manual browser smoke remains user-owned for real chat pane feel, collapse ergonomics, and visual right-rail metadata fit.
  - Failed message-send rollback remains the existing runtime/background-sync behavior; this slice prevents stale read-model disappearance while a send is pending.
- Cleared to continue:
  - Yes. Continue to task 8.1.

### 2026-06-03: Slice 6.1 property/create/document/sort controls
- Linked tasks: 6.1
- Linked requirements: REQ-PROPERTY-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001
- Linked design decisions: DES-011, DES-015, DES-001, DES-002, DES-003
- Review mode: deep diff-review with architecture-standards, followed by normal clean re-review and a clean slice architecture assessment
- Scope implemented:
  - Rendered configured project icons in the create-modal project trigger, project options, and create footer.
  - Rendered the inherited project icon and name in the work item detail inline sub-task composer.
  - Moved document property pills to the right-side meta column and deduped configured property pills.
  - Fixed the sort trigger by forwarding Radix trigger props and refs through the shared sort chip button.
  - Added editable visible label property dropdowns for assignable work-surface rows/cards while keeping private task rows non-editable.
  - Made the per-slice and final architecture assessment gates explicit in design, requirements, and tasks.
- Owner and sibling-path audit:
  - Project icon rendering stays in the existing project icon presentation owner via `ProjectIconGlyph`.
  - Inherited project identity stays in the create dialog and inline child composer owners; no backend persistence path was changed.
  - Document pills use configured display properties and dedupe at the document content presentation boundary.
  - Sort trigger behavior stays in the shared work-surface controls layer.
  - Label editing reuses `useWorkItemLabelEditorState`, existing assignability rules, and `updateWorkItem`; private tasks return no editable label control.
- Backend/read-model audit:
  - No new backend read/write path was required for this slice. Project names/icons, document properties, sort options, and labels already arrive through the relevant scoped read models and store data.
  - The only persistence call added is the existing `updateWorkItem` label patch from the work item store authority.
- Validation:
  - `pnpm exec vitest run tests/components/create-dialogs.test.tsx tests/components/work-item-ui-comments-inline.test.tsx tests/components/docs-content.test.tsx tests/components/group-chip-popover.test.tsx tests/components/work-surface-view.test.tsx` - passed, 5 files / 140 tests.
  - `pnpm exec vitest run tests/components/work-surface-view.test.tsx` - passed, 1 file / 94 tests after adding the private-task negative case.
  - `pnpm typecheck` - passed.
  - `pnpm lint` - passed.
  - `python3 ~/.codex/skills/spec-driven-development/scripts/lint_spec.py --spec-dir .spec/backlog-regression-performance-stability` - passed.
  - `python3 ~/.codex/skills/spec-driven-development/scripts/traceability_report.py --spec-dir .spec/backlog-regression-performance-stability --strict` - passed.
  - `git diff --check` - passed.
  - Browser smoke was intentionally not run because the user instructed the implementation agent not to run smoke tests; manual browser smoke is user-owned validation.
- Deep-review findings:
  - No live Critical, High, or Medium findings were found for slice 6.1.
- Normal re-review result:
  - Re-read create project identity/icon paths, inline sub-task project chip, document pill rendering, sort trigger composition, label dropdown assignability, private task negative behavior, and focused tests.
  - No live findings remain for slice 6.1.
- Architecture assessment:
  - Clean. UI presentation-only changes remain in presentation owners, label mutation remains in the store/domain update authority, private task assignability is protected by a negative test, and no new backend/read-model bypass was introduced.
  - The process architecture now explicitly requires a slice architecture assessment after each clean review loop and a final full-diff architecture assessment before PR delivery.
- Spec drift:
  - User requested per-slice and final architecture assessments with `architecture-standards`; design, requirements, and tasks were updated before continuing.
  - No product requirement drift remains for task 6.1.
- Requirement audit:
  - Disabled inherited project fields show the real project name and configured project icon.
  - Create-modal project options and footer use configured project icons.
  - Work item detail sub-task creation shows the inherited project's icon and name.
  - Document pills are right-aligned and deduped from configured properties.
  - Sort opens and updates.
  - Visible label properties open editable dropdowns only when assignable and remain unavailable for private task rows.
- Residual risk:
  - Manual browser smoke remains user-owned for exact visual placement and real interaction feel.
  - Project option icon coverage is strongest through selected/inherited project chip assertions; the option-render path is covered through the same glyph component and project-picker data.
- Cleared to continue:
  - Yes. Continue to task 7.1.

### 2026-06-03: Slice 5.1 work surface correctness
- Linked tasks: 5.1
- Linked requirements: REQ-WORKSURFACE-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001
- Linked design decisions: DES-010, DES-015
- Review mode: deep diff-review with architecture-standards, followed by normal re-review after fixes
- Scope implemented:
  - Replaced the old bordered/accent selection checkbox with a shared gray, borderless selection box and black checked tick.
  - Moved list-row selection after the disclosure slot so it sits with the item identity/PVT cluster rather than the far-left group/dropdown gutter.
  - Changed selected list rows, board cards, and board child rows to use gray surface styling instead of brand/accent selected styling.
  - Added selected-item bulk delete from the shared work item context menu with confirmation and per-target delete fan-out.
  - Made parent filters match descendants through the ancestor chain and prevented the default root-only fallback from hiding parent-filtered child rows.
  - Fixed my-items assigned-descendant container lifting so descendants must pass active filters before their containers are rendered.
  - Removed team grouping from private task compatible group options.
  - Preserved pending optimistic work item fields during stale scoped and replacement read-model merges to prevent status-change bounce.
- Owner and sibling-path audit:
  - Selection visual owner: `components/app/screens/work-item-selection.tsx`.
  - List/board placement and rendered target-set owner: `components/app/screens/work-surface-view.tsx` and `components/app/screens/work-surface-view/board-child-item-row.tsx`.
  - Bulk action/delete owner: `components/app/screens/work-item-menus.tsx`, reusing existing `deleteWorkItem` store authority.
  - Parent and assigned-descendant filtering owner: `lib/domain/selectors-internal/work-items.ts`.
  - Private task grouping compatibility owner: `components/app/screens/work-surface.tsx`.
  - Filtered status bounce/read-model reconciliation owner: `lib/store/app-store-internal/slices/ui.ts`.
  - Store mutation audit: `updateWorkItem` already fan-outs per target with no small UI batch limit; no backend batch limit was found in the current path.
- Backend/read-model audit:
  - Bulk updates still use the existing per-item store mutation and backend sync path; no backend batch mutation was added without evidence of a backend batch limit.
  - The visible status bounce had a read-model reconciliation root cause: stale incoming read models could overwrite a pending optimistic work item after pruning protected it from deletion.
  - Scoped and replacement read-model merge paths now preserve pending work item IDs until the mutation settles.
- Validation:
  - `pnpm exec vitest run tests/lib/domain/view-item-level.test.ts tests/components/work-surface-view.test.tsx tests/components/work-surface.test.tsx` - passed, 3 files / 129 tests.
  - `pnpm exec vitest run tests/components/work-item-menus.test.tsx tests/lib/store/ui-slice.test.ts tests/lib/store/work-item-actions.test.ts` - passed, 3 files / 37 tests.
  - `pnpm typecheck` - passed.
  - `pnpm lint` - passed.
  - `git diff --check` - passed.
  - Browser smoke was intentionally not run because the user instructed the implementation agent not to run smoke tests; manual browser smoke is user-owned validation.
- Deep-review findings:
  - Finding 1: assigned-descendant my-items container lifting bypassed active filters before lifting containers, so my-items board/list variants could ignore parent/status filters even if direct team-space rows looked fixed. Fixed by applying `itemMatchesView(data, item, view, { ignoreItemLevel: true })` to each candidate descendant before resolving its container, with a negative parent-filter regression test.
- Normal re-review result:
  - Re-read the selection primitive, list/board row placement, board child rows, menu target/delete paths, parent/assigned-descendant selectors, private task grouping compatibility, UI read-model merge, and focused tests after the fix.
  - No live Critical, High, or Medium findings remain for slice 5.1.
- Architecture decisions:
  - Selection styling belongs in the shared selection primitive; row placement belongs in the list/board render owners.
  - Parent/descendant matching belongs in the domain selector, not in individual surfaces.
  - Optimistic overwrite protection belongs in the UI read-model merge boundary because that is where stale backend payloads reconcile with local pending mutations.
  - Bulk delete uses existing per-item delete authority so validation, cascade behavior, and permissions remain centralized.
- Spec drift:
  - No spec drift found for task 5.1 after the deep-review fix.
  - Browser smoke remains user-owned manual validation.
- Requirement audit:
  - Multi-select boxes align next to item identity/PVT content in list rows and remain shared on board/card child rows.
  - Selection boxes are gray/borderless with a black checked tick and gray selected row/card styling.
  - Visible selected target sets continue to exclude collapsed/hidden/off-scope child rows.
  - Bulk status/labels/custom-property updates continue to fan out to every selected target; selected-item delete now has confirmation and deletes every selected target.
  - Parent filters now match descendants; assigned-descendant my-items views filter before lifting containers.
  - Private task views no longer expose team grouping.
  - Pending optimistic status changes are preserved against stale read-model merges to avoid bounce.
- Residual risk:
  - Manual browser smoke remains user-owned for visual alignment, hover feel, and real board/list interaction feel.
  - Bulk delete is sequential and can still surface existing per-item validation/toast behavior; no backend batch operation was added in this slice.
- Cleared to continue:
  - Yes. Continue to task 6.1.

### 2026-06-03: Slice 4.2 performance and TipTap lag remediation
- Linked tasks: 4.2
- Linked requirements: REQ-PERF-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001
- Linked design decisions: DES-009, DES-015
- Review mode: deep diff-review with architecture-standards, followed by normal re-review after fixes
- Scope implemented:
  - Moved create-dialog title and description draft values out of the root dialog render state and into local field state plus submit-time refs.
  - Kept root dialog state limited to title submit eligibility, which only changes on validation transitions instead of every character.
  - Preserved create/keyboard-submit correctness by reading the latest title and description refs at submit time and resetting refs through the dialog close/create/cancel boundary.
  - Added regression coverage proving multiple local title/description edits submit the latest title and description.
- Performance baseline and root cause:
  - Static baseline before the fix: `CreateWorkItemDialog` held `title` and `description` in parent state, so every keystroke rerendered project/status/assignee/label/date/parent picker surfaces and recomputed parent/project/label options.
  - Existing work item detail tests from the previous optimization still prove the work item description editor does not rerender on every local title/description keystroke.
  - Existing scoped read-model diagnostics still prove first useful render can be reported from retained data before a scoped refresh resolves.
- Owner and sibling-path audit:
  - Create-modal typing owner: `components/app/screens/create-work-item-dialog.tsx`.
  - Work item detail TipTap owner: `components/app/screens/work-item-detail-screen.tsx`; prior local-ref optimization remains live and was revalidated.
  - Read-model/loading owner: `hooks/use-scoped-read-model-refresh.ts`; retained first-useful-render diagnostics remain live and were revalidated.
  - Dropdown slowness related to create-modal property rows is reduced because those rows are no longer pulled through every title/description keystroke.
- Backend/read-model audit:
  - This slice did not need new backend changes after tasks 2.1 and 3.1 because the live create-modal typing root cause was frontend parent render fan-out.
  - Read-model loading and retained-render diagnostics were still checked through the scoped refresh hook test.
- Validation:
  - `pnpm exec vitest run tests/components/create-dialogs.test.tsx` - passed, 1 file / 33 tests.
  - `pnpm exec vitest run tests/components/work-item-detail-screen.test.tsx -t "does not rerender the description editor"` - passed, 1 file / 2 tests selected.
  - `pnpm exec vitest run tests/lib/use-scoped-read-model-refresh.test.tsx -t "first useful render"` - passed, 1 file / 1 test selected.
  - `pnpm typecheck` - passed.
  - `pnpm lint` - passed after fixing the deep-review finding.
  - `python3 ~/.codex/skills/spec-driven-development/scripts/lint_spec.py --spec-dir .spec/backlog-regression-performance-stability` - passed.
  - `python3 ~/.codex/skills/spec-driven-development/scripts/traceability_report.py --spec-dir .spec/backlog-regression-performance-stability --strict` - passed.
  - `git diff --check` - passed.
  - Browser smoke was intentionally not run because the user instructed the implementation agent not to run smoke tests; manual browser smoke is user-owned validation.
- Deep-review findings:
  - Finding 1: the first draft reset implementation used synchronous `setState` in effects, which lint flagged and which would have contradicted the performance goal by adding cascading renders. Fixed by moving reset to the dialog close/create/cancel boundary and keying the local field subtree on controlled open state.
  - Finding 2: a leftover child ref from the effect-based reset had no useful ownership after the rewrite. Fixed by removing it.
- Normal re-review result:
  - Re-read the create dialog draft ownership, submit path, close/reset path, work item detail editor fan-out tests, scoped refresh diagnostics, and spec updates.
  - No live Critical, High, or Medium findings remain for slice 4.2.
- Architecture decisions:
  - Per-keystroke draft display belongs in the local input/textarea component; create persistence and validation transitions stay in the root dialog owner.
  - Submit-time refs are used only for latest draft values and are reset on explicit dialog lifecycle boundaries.
  - The shared `RichTextEditor` was not changed because current work item detail tests show the named TipTap surface remains protected, and changing the shared editor would affect documents, comments, chats, and channels.
- Spec drift:
  - Updated REQ-PERF-001 negative-case wording so performance proof requires code/runtime diagnostic or test evidence from the implementation agent while browser smoke remains user-owned manual validation.
  - Added the latest user clarification that work item detail sub-task creation must also show project-specific icons to DES-011, REQ-PROPERTY-001, and task 6.1.
- Requirement audit:
  - Create-modal typing no longer triggers root dialog draft state on every character.
  - Work item detail TipTap rerender protections were revalidated.
  - Retained first-useful-render diagnostics were revalidated for surface loading/read-model evidence.
- Residual risk:
  - Manual browser smoke remains user-owned for subjective typing feel, dropdown feel, and navigation feel.
  - Broader work-surface dropdown flicker/status bounce remains task 5.1 because it involves selection/filter/optimistic reconciliation behavior beyond this editor/create performance slice.
- Cleared to continue:
  - Yes. Continue to task 5.1.

### 2026-06-03: Slice 4.1 slash Reference scoped search
- Linked tasks: 4.1
- Linked requirements: REQ-REFERENCE-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001
- Linked design decisions: DES-009, DES-015
- Review mode: deep diff-review with architecture-standards, followed by normal re-review
- Scope implemented:
  - Marked slash-triggered Reference search as an explicit picker state so the editor update/selection sync does not immediately replace it with the typed `#` trigger detector.
  - Kept the Reference slash command in the existing rich-text menu owner and made the picker state durable through the command-to-picker transition.
  - Added focused coverage for the rendered slash command menu invoking the Reference picker and for picker-mode state tagging.
- Owner and sibling-path audit:
  - Command ownership remains in `components/app/rich-text-editor/menus.tsx`; editor state orchestration remains in `components/app/rich-text-editor.tsx`.
  - Document detail and work item editor/comment callers already pass scoped reference candidates through `getRichTextReferenceCandidates`.
  - Current editor code has a rendered slash-command UI path, not a separate toolbar slash button; toolbar actions were checked and no separate Reference slash button exists.
  - Candidate selector ownership remains in `lib/domain/selectors-internal/rich-text-references.ts`, which returns documents, work items, projects, and views while excluding people and create actions.
- Backend/read-model audit:
  - This symptom is frontend editor state collapse, not a backend query failure.
  - The candidate data path was checked because references can be scope-sensitive; it is still supplied through the existing scoped read-model data and access-filtered domain selector.
- Validation:
  - `pnpm exec vitest run tests/components/rich-text-editor-helpers.test.tsx tests/lib/domain/rich-text-references.test.ts tests/lib/content/rich-text-references.test.ts` - passed, 3 files / 28 tests.
  - `pnpm typecheck` - passed.
  - `pnpm lint` - passed.
  - `python3 ~/.codex/skills/spec-driven-development/scripts/lint_spec.py --spec-dir .spec/backlog-regression-performance-stability` - passed.
  - `python3 ~/.codex/skills/spec-driven-development/scripts/traceability_report.py --spec-dir .spec/backlog-regression-performance-stability --strict` - passed.
  - `git diff --check` - passed.
  - Browser smoke was intentionally not run because the user instructed the implementation agent not to run smoke tests; manual browser smoke is user-owned validation.
- Deep-review findings:
  - No live Critical, High, or Medium findings found for the slash Reference slice.
- Normal re-review result:
  - Re-read the editor menu state code, Reference menu insertion path, rendered slash command test path, document/work item caller candidate paths, and reference selector.
  - No remaining live blocker found for slice 4.1.
- Architecture decisions:
  - The fix stays in the existing editor presentation/state owner rather than adding a second modal/state system.
  - The access/scope invariant stays in the domain reference selector and scoped read-model data path.
  - Picker mode is an explicit state property because the existing trigger-state detector is intentionally pattern-based and should not own command-launched modal lifetime.
- Spec drift:
  - Updated design, requirements, and tasks so browser smoke is recorded as user-owned manual validation per the latest user instruction.
  - Recorded that "slash button" maps to the existing rendered slash-command UI path in this codebase; no separate toolbar slash button was found.
- Requirement audit:
  - Typed `/` plus `Reference` opens scoped search mode through the slash menu command.
  - Rendered slash-command UI selection opens the same Reference picker.
  - Candidate filtering remains restricted to work items, documents, projects, and views.
- Residual risk:
  - Manual browser smoke in real document and work item editors remains user-owned.
  - End-to-end selection/focus behavior should be confirmed manually after the full branch is available.
- Cleared to continue:
  - Yes. Continue to task 4.2.

### 2026-06-03: Slice 3.1 real scoped read models
- Linked tasks: 3.1
- Linked requirements: REQ-SCOPED-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001
- Linked design decisions: DES-008, DES-015, DES-001, DES-002, DES-003
- Review mode: deep diff-review with architecture-standards, followed by normal re-review after fixes
- Scope implemented:
  - Added `convex/app/scoped_read_models.ts` as the Convex-owned query boundary for scoped read models, scope-key resolution, and scope-key authorization.
  - Added Convex queries `getScopedReadModel`, `resolveScopedReadModelScopeKeys`, and `authorizeScopedReadModelScopeKeys`.
  - Replaced read-model route handlers so read-model routes call narrow Convex scoped instructions instead of loading `getSnapshotServer`.
  - Replaced server-side snapshot authorization and mutation scope-key resolution with narrow Convex calls.
  - Updated channel-post mutation routes to resolve invalidation scope keys before mutation without broad snapshot reads.
  - Added a static guard test preventing `getSnapshotServer` or `loadScopedReadModelSnapshotForSession` from returning to read-model route/server-handler paths.
  - Added Convex handler coverage for unauthorized collection scope keys so forbidden team scopes fail before team data is read.
- Route and backend inventory:
  - Migrated read-model routes: document detail/index, work item detail, project detail/index, work index, view catalog, notification inbox, conversation list/thread, channel feed, workspace people, and workspace search seed.
  - Workspace membership bootstrap remains on its existing narrow server helper and was not converted to a snapshot route.
  - Backend paths audited: Convex query handlers, Next route handlers, mutation invalidation scope-key resolvers, channel post delete/comment/reaction routes, access helpers, scoped sync key parsing, and read-model selectors.
- Validation:
  - `pnpm exec vitest run tests/app/api/read-model-route-contracts.test.ts tests/app/api/read-model-static-guards.test.ts tests/lib/server/scoped-read-models.test.ts tests/convex/scoped-read-model-handlers.test.ts` - passed, 4 files / 25 tests.
  - `pnpm typecheck` - passed.
  - `pnpm lint` - passed.
  - `python3 ~/.codex/skills/spec-driven-development/scripts/lint_spec.py --spec-dir .spec/backlog-regression-performance-stability` - passed.
  - `python3 ~/.codex/skills/spec-driven-development/scripts/traceability_report.py --spec-dir .spec/backlog-regression-performance-stability --strict` - passed.
  - `git diff --check` - passed.
  - `rg -n "getSnapshotServer|loadScopedReadModelSnapshotForSession" app/api/read-models lib/server/scoped-read-models.ts lib/server/scoped-read-model-route-handlers.ts` - no matches.
- Deep-review findings:
  - Finding 1: collection-scope authorization could authorize an empty scoped read model, and the underlying team collection loaders still read team-scoped data before proving the requested team scope was accessible. Fixed by adding a Convex-side `isAccessibleCollectionScope` guard at collection loaders and by requiring returned scoped data to prove the requested team/workspace/personal scope before scope-key authorization succeeds.
- Normal re-review result:
  - Re-read the Convex scoped-read-model handler, collection loaders, scope-key authorization, Next route handlers, server mutation invalidation helpers, channel-post mutation routes, and tests after the fix.
  - No live Critical, High, or Medium findings remain for slice 3.1.
- Architecture decisions:
  - The authoritative scoped-read boundary now lives in Convex because access checks, indexed reads, and persistence/query cost are backend-owned.
  - Next read-model routes stay thin and preserve response contracts while delegating query shape and authorization to Convex.
  - The static guard protects the architecture boundary by failing if snapshot-backed reads return to read-model route/server-handler paths.
  - Backend investigation is required for later product slices whenever read models, mutations, optimistic reconciliation, or persistence can contribute to a visible symptom.
- Spec drift:
  - No drift found for REQ-SCOPED-001 after the fix.
  - New user clarifications for chat message metadata, sender grouping, link styling, left conversation-list collapse, and backend-path investigation were added to the chat/process tasks while this slice was active; they do not change the scoped-read-model route migration.
- Residual risk:
  - Large mutable collections still need pagination/bounded-read follow-up where product surfaces require it; this slice removes full-app snapshot reads and adds guardrails but does not redesign every list UX.
  - Production Convex Insights should be checked after deployment to confirm DB I/O and function-call reduction.
- Cleared to continue:
  - Yes. Continue to task 4.1.

### 2026-06-03: Slice 2.1 immediate Convex cost containment
- Linked tasks: 2.1
- Linked requirements: REQ-COST-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001
- Linked design decisions: DES-007, DES-015, DES-001, DES-002, DES-003
- Review mode: deep diff-review with architecture-standards, followed by normal re-review after fixes
- Scope implemented:
  - Added `lib/realtime/cost-policy.ts` with production-safe stream polling, degraded refresh, foreground refresh staleness, and env clamping.
  - Raised scoped invalidation and legacy snapshot stream polling from 1 second to a 15 second minimum/default.
  - Raised scoped stream ready retry to 15 seconds and unavailable retry to 30 seconds.
  - Stopped unchanged reconnect `ready` events from refreshing every scoped subscriber.
  - Gated focus/online refresh by document visibility, in-flight state, and 30 second staleness.
  - Increased degraded scoped refresh interval to 30 seconds.
  - Added visible legacy snapshot stream diagnostics when legacy sync is enabled.
  - Suppressed redundant client chat read-state mutations and made Convex read/unread handlers idempotent for unchanged read boundaries.
- Owner and bypass-path audit:
  - Scoped invalidation cadence owner: `app/api/events/scoped/route.ts`, `app/api/events/scoped/polling.ts`, `hooks/use-scoped-read-model-refresh.ts`, and `lib/scoped-sync/client.ts`.
  - Legacy snapshot stream sibling path: `app/api/snapshot/events/route.ts` and `components/providers/convex-app-provider.tsx`.
  - Read-state hot-write owner: `lib/domain/chat-read-state.ts`, `lib/store/app-store-internal/slices/collaboration-conversation-actions.ts`, and `convex/app/chat_read_states.ts`.
  - Broad snapshot-backed read-model replacement remains intentionally scoped to task 3.1; this slice did not hide or rename broad reads.
- Validation:
  - `pnpm exec vitest run tests/lib/realtime-cost-policy.test.ts tests/app/api/scoped-events-route-contracts.test.ts tests/lib/use-scoped-read-model-refresh.test.tsx tests/lib/store/collaboration-conversation-actions.test.ts tests/convex/chat-message-notifications.test.ts tests/components/convex-app-provider.test.tsx` - passed, 6 files / 49 tests.
  - `pnpm typecheck` - passed.
  - `pnpm lint` - passed.
  - `git diff --check` - passed.
- Deep-review findings:
  - Finding 1: reconnect `ready` version tracking was updated before a refresh succeeded, so a failed refresh could stop retrying on later unchanged ready events. Fixed with `lastRefreshFailedRef` and a regression test proving ready retries failed refreshes.
  - Finding 2: server-side unchanged chat read-state handling could skip legacy unread notification cleanup. Fixed by still running legacy notification cleanup while suppressing the unchanged `chatReadStates` patch, with a Convex regression test.
- Normal re-review result:
  - Re-read changed scoped stream, hook, legacy snapshot stream, diagnostics, client read-state, Convex read-state, and tests after fixes.
  - No live Critical, High, or Medium findings remain for slice 2.1.
- Architecture decisions:
  - The realtime cost thresholds live in a small policy module rather than duplicated route/hook constants.
  - The scoped hook remains the client refresh authority; server routes only control polling/retry cadence.
  - Client read-state suppression reduces most hot writes, while Convex idempotency remains the authoritative backstop for old clients/retries.
  - Legacy snapshot stream is contained and diagnosed, not removed, because full legacy/global invalidation removal belongs to later read-model migration work.
- Spec drift:
  - No upstream spec drift found. Task 3.1 still owns broad snapshot-backed read-model replacement and mutation scope resolver migration.
- Residual risk:
  - This slice reduces idle/reconnect call amplification but does not eliminate broad DB I/O from snapshot-backed read models; that remains the next slice.
  - Exact production call-volume reduction should be confirmed with Convex logs/Insights after deployment.
- Cleared to continue:
  - Yes. Stop here per the user's stop-after-slice instruction; task 3.1 is next.

### 2026-06-03: Review protocol bootstrap
- Linked tasks: 0.1
- Linked requirements: REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001, REQ-FINAL-001, REQ-PR-001
- Review mode: artifact bootstrap audit
- Validation:
  - `python3 ~/.codex/skills/spec-driven-development/scripts/lint_spec.py --spec-dir .spec/backlog-regression-performance-stability` - passed.
  - `python3 ~/.codex/skills/spec-driven-development/scripts/traceability_report.py --spec-dir .spec/backlog-regression-performance-stability --strict` - passed.
  - `git diff --check -- .spec/backlog-regression-performance-stability` - passed.
- Findings:
  - None recorded during bootstrap authoring.
- Architecture decisions:
  - The review process is encoded in spec artifacts rather than left as a chat-only instruction.
  - The review ledger lives inside the spec folder so future slice state is colocated with design, requirements, and tasks.
- Spec drift:
  - The requested addendum is now explicit in `tasks.md`.
- Residual risk:
  - Future product/cost implementation requirements still need to be authored before code work begins under this scope.

### 2026-06-03: Three-pass pre-plan coverage audit
- Linked tasks: 1.1
- Linked requirements: REQ-AUDIT-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001
- Review mode: pre-implementation thread coverage audit
- Coverage loops:
  - Pass 1, product backlog: covered slash Reference, performance/TipTap lag, multi-select, document pills, inherited project display, parent filter cascade, chat layout/previews/messages/read receipts, offline status, profile activity, sort, reply semantics, bulk actions/delete, private-task leakage, filtered status flicker, profile hover layering, and label dropdowns.
  - Pass 2, billing/cost architecture: covered 1-second polling, reconnect refresh amplification, fake scoped read models, snapshot-backed authorization, mutation scope resolvers, global snapshot version bumps, read-state/presence churn, env targeting, diagnostics, retention cleanup, and static guardrails.
  - Pass 3, execution integrity: covered per-slice deep review, normal clean-loop re-review, review-ledger records, spec drift updates, no partial fixes, stop-after-slice behavior, final total-diff review, clean PR gate, branch/commit/push, and draft PR to `main`.
- Original product prompt validation matrix:
  - Slash button or typed slash `Reference` in document/work item editors opens scoped search mode: REQ-REFERENCE-001, task 4.1.
  - Linking/embedding accessible work items/documents/projects/views with safe component option: REQ-REFERENCE-001, task 4.1.
  - Laggy navigation, slow surface loading, slow create modal typing, slow dropdown changes, and deeper work item TipTap optimization: REQ-PERF-001, task 4.2.
  - Multi-select checkbox placement next to PVT/identity cluster, gray borderless unchecked state, black tick selected state, selected persistence, and hover text stability: REQ-WORKSURFACE-001, task 5.1.
  - Document list pills at the right end, no duplicates, and derived from configured properties: REQ-PROPERTY-001, task 6.1.
  - Create modal disabled inherited Project dropdown shows the actual parent project name instead of generic "Project": REQ-PROPERTY-001, task 6.1.
  - Parent filter cascade to children across team space board, my items board/list, team spaces, and my items surfaces: REQ-WORKSURFACE-001, task 5.1.
  - Chat conversation list width stability, collapse button beside user/username area, deleted-message preview using latest readable message, and disappearing/reappearing sent message audit: REQ-CHAT-001, task 7.1.
  - Read receipts: original prompt says to ignore the current noisy duplicated requirement; later plan keeps compact redesign in scope, so REQ-CHAT-001/task 7.1 treats this as redesign rather than piecemeal repair.
  - Double-click property/filter idea: removed from implementation scope per source prompt clarification and later confirmation.
  - Bottom-left sidebar offline X icon: REQ-POLISH-001, task 8.1.
  - Profile activity detail and denser left-column UI for comments/status/property changes: REQ-POLISH-001, task 8.1.
  - Broken sort dropdown: REQ-PROPERTY-001, task 6.1.
  - Inline comments/channels/work items use Reply with reply icon; quote remains only for direct messaging: REQ-POLISH-001, task 8.1.
  - Bulk actions apply to all selected eligible items with no silent limit; bulk delete is selected work items per later clarification, not workspace deletion: REQ-WORKSURFACE-001, task 5.1.
  - Workspace group/team-only properties leaking into private tasks: REQ-WORKSURFACE-001, task 5.1.
  - Filtered my-list status change disappears once and does not bounce back: REQ-WORKSURFACE-001, task 5.1.
  - Avatar/profile hover popup not clipped or covered by chat/channel/work surfaces: REQ-POLISH-001, task 8.1.
  - Visible label property without enabled dropdown: REQ-PROPERTY-001, task 6.1.
  - Planning/spec/audit/deep performance review/recent-spec review/no regurgitated failed fixes: REQ-AUDIT-001, REQ-KNOWLEDGE-001, REQ-PERF-001, tasks 1.1 and 4.2.
- Validation:
  - `python3 ~/.codex/skills/spec-driven-development/scripts/lint_spec.py --spec-dir .spec/backlog-regression-performance-stability` - passed.
  - `python3 ~/.codex/skills/spec-driven-development/scripts/traceability_report.py --spec-dir .spec/backlog-regression-performance-stability --strict` - passed.
  - `git diff --check -- .spec/backlog-regression-performance-stability` - passed.
- Findings:
  - `tasks.md` had drifted into a placeholder/future-slices shape while `design.md` and `requirements.md` already carried the broader scope.
  - The no-partial-fixes rule was not explicit enough for implementation review.
  - The worktree also contained unrelated deleted tracked files and an untracked duplicate test; those were restored/removed after the user confirmed they were not intended.
- Fixes:
  - Added a three-pass pre-implementation coverage audit to `design.md`.
  - Added DES-015 and REQ-KNOWLEDGE-001 for owner/bypass/sibling-path closure and no partial fixing.
  - Replaced the placeholder task plan with concrete tasks 2.1 through 9.1 plus final task 99.1.
  - Recorded stop-after-slice behavior and review-loop requirements inside every future task.
- Architecture decisions:
  - Each implementation slice must choose the owning boundary before editing and must audit sibling/bypass paths before review clearance.
  - Product, cost, and delivery protocol are all part of the same backlog remediation plan rather than separate cost-only work.
- Spec drift:
  - Corrected the spec so tasks now match the original backlog prompt, slash/reference clarification, billing/cost requirements, review-loop addendum, and no-partial-fixes correction.
- Residual risk:
  - Application code implementation has not started; each future slice still needs fresh live-code discovery, tests, focused validation, deep review, and normal clean-loop re-review.
