---
title: Work Item Reference Activity And Surface Refinements
scope: work-item-reference-activity-ui
status: implementation-ready
repo_root: /Users/declancowen/Documents/GitHub/Linear
change_class: feature
risk_level: high
owner: product-platform
reviewers: product-platform,frontend,backend
approvers: engineering-lead
implementation_owner: product-platform
operations_owner: product-platform
last_updated: 2026-06-01
---

# Task Plan: Work Item Reference Activity And Surface Refinements

## Source Artifacts
- `.spec/work-item-reference-activity-ui/design.md`
- `.spec/work-item-reference-activity-ui/requirements.md`

## Gating Status
- Ready for implementation
- Blocking design decisions:
  - None

## Execution Status Summary
- To do: none
- In progress: none
- Completed: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 4.1, 4.2, 5.1, 5.2, 6.1, 6.2
- Deferred: none
- Blocked: none

## Sequencing Notes
- Start with selector and small UI polish slices because they are easier to verify and reduce ambiguity before broader reference work.
- Activity/privacy and references must be implemented before any sidebar backlink UI is considered complete.
- Popup containment should remain optional/container-driven so global shell portals do not regress.
- Each slice must check the original request, linked requirements, current code, and architecture standards before editing and must keep using architecture standards while making material design, code, and test decisions.

## Implementation Authority And Review Loop
- The spec is guidance; the original user request is authoritative for the target outcome, architecture standards are the review lens for solution shape, and live code/current tests are authoritative for current reality.
- Before each leaf task, read linked `DES-*` entries, linked `REQ-*` entries, the task entry, relevant code, and current tests.
- After each implementation slice, run focused validation, review the diff against requirements, and check architecture standards proportional to risk.
- After test creation, verify tests prove requirement behavior and relevant negative cases rather than implementation details.
- If code reality and spec intent diverge, update `.spec/work-item-reference-activity-ui/design.md`, then `.spec/work-item-reference-activity-ui/requirements.md`, then `.spec/work-item-reference-activity-ui/tasks.md` before continuing.
- If the user corrects a generated artifact or says an item drifted, treat that correction as authoritative and refresh upstream spec artifacts before continuing implementation.
- The implementing agent may challenge a stale task or skill interpretation, but must document the rationale and update upstream artifacts before continuing.

## Blocking Work
- None.

## Tasks

- [x] 1. Work surface child filtering
  - [x] 1.1 Make board/list child rows inherit active view filters
    - Status: completed
    - Depends on: none
    - Likely areas: `lib/domain/selectors-internal/work-items.ts`, `components/app/screens/work-surface-view.tsx`, `tests/lib/domain/view-item-level.test.ts`, `tests/components/work-surface-view.test.tsx`
    - Validation: domain/component tests for active status/completion filters hiding non-matching child rows under visible parents in board and list views; passed focused Vitest run for tests/lib/domain/view-item-level.test.ts and tests/components/work-surface-view.test.tsx
    - Exit criteria: when show-child-items is enabled, displayed child rows mirror active parent board/list filters while still ignoring only item-level constraints needed to show valid child types
    - Rollback impact: local selector/view-model change can revert without schema migration
    - Blocking unknowns: none
    - Pre-implementation context check: read DES-001, DES-002, DES-003, REQ-FILT-001, REQ-FILT-002, current work-surface grouping code, existing filter selector tests, and architecture standards for domain-owned filtering
    - Test creation review: tests assert visible child row behavior from rendered board/list surfaces and domain selectors rather than only object shape
    - Post-implementation review: diff reviewed against the clarified no-second-tick child-filter request and architecture standards for centralized filtering; renderer bypass removed so existing domain filtering remains authoritative
    - Spec drift check: completed; upstream artifacts corrected from child-filter state/double-tick drift to cascading filter inheritance before implementation
    - _Requirements: REQ-FILT-001, REQ-FILT-002, REQ-ARCH-001, REQ-TEST-001_

  - [x] 1.2 Prevent child-filter state or second-tick UI from reappearing
    - Status: completed
    - Depends on: 1.1
    - Likely areas: `lib/domain/types-internal/primitives.ts`, `lib/domain/types-internal/schemas.ts`, `convex/validators.ts`, `components/app/screens/work-surface-controls.tsx`, `tests/components/work-surface.test.tsx`
    - Validation: focused code review and `rg` confirmed no child-filter state, subtask filter scope, second-tick UI, or double-tick UI in product code
    - Exit criteria: no view schema field, persisted filter field, store state, or filter UI affordance exists for a separate child/subtask filter scope
    - Rollback impact: no migration or persisted state to roll back
    - Blocking unknowns: none
    - Pre-implementation context check: read DES-002, DES-003, REQ-FILT-001, REQ-FILT-002, view filter schemas, work-surface controls, and architecture standards for avoiding unnecessary state
    - Test creation review: tests prove child rows mirror filters without interacting with a child-only filter control
    - Post-implementation review: diff reviewed against the clarified request and architecture standards for minimal state ownership; no schema, store, validator, or filter-control state was added
    - Spec drift check: completed; no existing hidden child-filter state was discovered
    - _Requirements: REQ-FILT-001, REQ-FILT-002, REQ-ARCH-001, REQ-TEST-001_

- [ ] 2. Create modal, breadcrumb, sidebar, and compact UI polish
  - [x] 2.1 Fix child creation context, breadcrumb back navigation, search icon alignment, assignee avatar display, and people grid
    - Status: completed
    - Depends on: none
    - Likely areas: `components/app/screens/create-work-item-dialog.tsx`, `components/app/screens/work-item-detail-screen.tsx`, `components/app/global-search-dialog.tsx`, `components/app/screens/work-item-inline-property-control.tsx`, `components/app/people-screen.tsx`, `tests/components/create-dialogs.test.tsx`, `tests/components/people-screen.test.tsx`, `tests/components/work-item-detail-screen.test.tsx`, `tests/components/work-surface-view.test.tsx`, `tests/components/global-search-dialog.test.tsx`
    - Validation: passed focused Vitest run for tests/components/people-screen.test.tsx, tests/components/create-dialogs.test.tsx, tests/components/work-item-detail-screen.test.tsx, tests/components/work-surface-view.test.tsx, and tests/components/global-search-dialog.test.tsx; passed focused ESLint for changed product/test files; passed TypeScript no-emit; passed whitespace diff check for changed files
    - Exit criteria: requested UI polish is visible and local without broad shell redesign
    - Rollback impact: local UI changes can revert independently
    - Blocking unknowns: none
    - Pre-implementation context check: read DES-005, DES-009, REQ-UI-001, REQ-UI-002, REQ-UI-003, REQ-SEARCH-001, REQ-UI-004, REQ-UI-005, related components/tests, and architecture standards for local presentation edits
    - Test creation review: tests assert inherited parent project display/disabled state, absence of the stale parent-child crumb label, private breadcrumb href, search icon alignment class, avatar-only assignee display, and `auto-fill` people grid behavior
    - Post-implementation review: diff reviewed against original UI requests and architecture standards for narrow presentation edits; code stayed local to existing surface components, reused existing routing/store patterns, and avoided introducing new state or broad abstractions
    - Spec drift check: completed; existing child project inheritance behavior was preserved and made visible, private work item breadcrumb fallback used the existing private tasks route, and existing dirty hover-card work was accommodated in tests without reverting user changes
    - _Requirements: REQ-UI-001, REQ-UI-002, REQ-UI-003, REQ-SEARCH-001, REQ-UI-004, REQ-UI-005, REQ-ARCH-001, REQ-TEST-001_

  - [x] 2.2 Remove projects from work item sidebar relations while preserving reference entries
    - Status: completed
    - Depends on: none
    - Likely areas: `components/app/screens/work-item-detail-screen.tsx`, `tests/components/work-item-detail-screen.test.tsx`
    - Validation: passed focused Vitest run for tests/components/work-item-detail-screen.test.tsx; passed focused ESLint for components/app/screens/work-item-detail-screen.tsx and tests/components/work-item-detail-screen.test.tsx; passed TypeScript no-emit; passed whitespace diff check for changed files
    - Exit criteria: projects are no longer duplicated in relations and linked documents/reference entries still render
    - Rollback impact: local sidebar rendering can revert independently
    - Blocking unknowns: none
    - Pre-implementation context check: read DES-007, REQ-REL-001, current `WorkItemRelationsSection`, project property rows, and sidebar tests
    - Test creation review: tests assert projects remain visible through the property row, are omitted from Relations even if legacy `linkedProjectIds` contains primary or secondary project ids, and linked document/work item references still render
    - Post-implementation review: diff reviewed against original relationship cleanup request and architecture standards for metadata ownership; the relations renderer now only handles non-project reference entries while the project property remains the editable source of truth
    - Spec drift check: completed; the original request was to remove projects from work item sidebar relationships because projects are already properties, so DES-007 and REQ-REL-001 were corrected before the code fix
    - _Requirements: REQ-REL-001, REQ-ARCH-001, REQ-TEST-001_

- [ ] 3. People profile activity and privacy
  - [x] 3.1 Extend profile activity selectors with visible work item change entries
    - Status: completed
    - Depends on: none
    - Likely areas: `lib/domain/selectors-internal/people.ts`, `components/app/people-screen.tsx`, `lib/domain/types-internal/primitives.ts`, `lib/domain/types-internal/models.ts`, `convex/validators.ts`, `convex/app/work_item_handlers.ts`, `tests/lib/domain/people-activity.test.ts`, `tests/components/people-screen.test.tsx`, `tests/convex/work-item-handlers.test.ts`
    - Validation: passed focused Vitest run for tests/lib/domain/people-activity.test.ts, tests/components/people-screen.test.tsx, tests/convex/work-item-handlers.test.ts, tests/components/work-item-detail-screen.test.tsx, tests/components/channel-ui.test.tsx, tests/lib/scoped-read-models.test.ts, and tests/lib/store/collaboration-channel-actions.test.ts; passed focused ESLint for changed files; passed TypeScript no-emit; passed whitespace diff check
    - Exit criteria: relevant visible work item changes recorded in `workItemActivities` appear in the actor profile when the item is visible
    - Rollback impact: selector-only changes can revert without data migration unless new activity types are added additively
    - Blocking unknowns: none
    - Pre-implementation context check: read DES-003, DES-004, REQ-ACT-001, REQ-ACT-002, existing people selector visibility helpers, Convex activity creation, and architecture standards for privacy-owned derivation
    - Test creation review: tests assert profile feed behavior with real selector output and rendered activity rows, durable label-change activity creation, status/label sort order, and private work item change hiding for another viewer
    - Post-implementation review: diff reviewed against profile activity request and architecture standards for domain-owned derivation; status and label changes now use the durable `workItemActivities` source, visibility remains in the people selector, and UI only maps domain activity to presentation copy
    - Spec drift check: completed; additive `label-change` activity type was required to satisfy the user's clarified "add labels etc." requirement, so task likely areas were expanded while keeping scope within work item activity/profile rendering
    - _Requirements: REQ-ACT-001, REQ-ACT-002, REQ-ARCH-001, REQ-TEST-001_

  - [x] 3.2 Add private activity regression coverage across profile activity types
    - Status: completed
    - Depends on: 3.1
    - Likely areas: `lib/domain/selectors-internal/people.ts`, `tests/components/people-screen.test.tsx`, `tests/lib/domain/workspace-access.test.ts`
    - Validation: passed focused Vitest run for tests/lib/domain/people-activity.test.ts and tests/components/people-screen.test.tsx; passed focused ESLint for tests/lib/domain/people-activity.test.ts; passed whitespace diff check; repo-wide TypeScript no-emit was attempted but blocked by unrelated dirty-file error in `components/app/collaboration-screens/chat-thread.tsx` missing `isCurrentUser`
    - Exit criteria: profile activity hides private artifacts from non-owners and still shows self-owned private activity to the current user where allowed
    - Rollback impact: tests remain valuable even if selector implementation is adjusted
    - Blocking unknowns: none
    - Pre-implementation context check: read DES-003, DES-004, REQ-ACT-002, REQ-SEC-001, current private visibility helpers, and current profile tests
    - Test creation review: tests prove privacy from another user's view and self-profile visibility through `getWorkspacePersonActivity` output, not private helper branches
    - Post-implementation review: diff reviewed against private activity request and architecture standards for privacy boundaries; no production changes were needed because the existing domain selector owns and already enforces the work item/document visibility rule
    - Spec drift check: completed; no upstream artifact changes required, but the current selector has no document-created profile activity source, so the regression surface for private documents is document-comment activity rather than a created-document row
    - _Requirements: REQ-ACT-002, REQ-SEC-001, REQ-ARCH-001, REQ-TEST-001_

- [ ] 4. Reference insertion, persistence, and access-aware navigation
  - [x] 4.1 Add typed rich text entity reference parsing and insertion for accessible entities
    - Status: completed
    - Depends on: none
    - Likely areas: `components/app/rich-text-editor.tsx`, `components/app/rich-text-content.tsx`, `lib/content/rich-text-mentions.ts`, `components/app/screens/document-detail-screen.tsx`, `components/app/screens/work-item-detail-screen.tsx`, `components/app/screens/use-comment-composer.ts`, `tests/lib/content/rich-text-mentions.test.ts`, `tests/components/document-detail-screen.test.tsx`
    - Validation: passed focused Vitest run for tests/lib/content/rich-text-references.test.ts, tests/lib/content/rich-text-security.test.ts, tests/lib/domain/rich-text-references.test.ts, tests/components/rich-text-editor-helpers.test.tsx, tests/components/document-detail-screen.test.tsx, and tests/components/work-item-detail-screen.test.tsx; passed focused ESLint for changed reference/editor/screen/test files; passed TypeScript no-emit; passed whitespace diff check; spec lint, code-reference check, and strict traceability passed
    - Exit criteria: accessible entities can be inserted and rendered inline in documents, work item descriptions, and work item comments through a contained editor command-search picker
    - Rollback impact: editor rendering can ignore new reference nodes if persistence changes are reverted
    - Blocking unknowns: none
    - Pre-implementation context check: read DES-006, REQ-REF-001, REQ-REF-003, REQ-NFR-001, rich text mention helpers, editor extensions, and content security tests
    - Test creation review: tests prove parser extraction/deduplication, sanitizer preservation of safe reference metadata, access-filtered candidate exclusion, contained editor slash/reference command routing, and document/work item/comment editor candidate wiring rather than only token shape
    - Post-implementation review: diff reviewed against original reference request and architecture standards; content parsing/sanitization lives in `lib/content`, TipTap serialization stays in the rich-text extension boundary, access-aware candidates live in domain selectors, and screens only pass scoped candidates into editors
    - Spec drift check: completed; user clarified that insertion should use a contained search/modal pattern, so DES-006, REQ-REF-001, and this task were updated before continuing implementation
    - _Requirements: REQ-REF-001, REQ-REF-003, REQ-NFR-001, REQ-ARCH-001, REQ-TEST-001_

  - [x] 4.2 Persist allowed relationships, backlinks, and inaccessible navigation behavior
    - Status: completed
    - Depends on: 4.1
    - Likely areas: `convex/validators.ts`, `convex/schema.ts`, `convex/app/document_handlers.ts`, `convex/app/work_item_handlers.ts`, `convex/app/comment_handlers.ts`, `lib/store/app-store-internal/slices/work-document-actions.ts`, `lib/store/app-store-internal/slices/work-item-actions.ts`, `tests/convex/document-handlers.test.ts`, `tests/convex/work-item-handlers.test.ts`, `tests/app/api/document-workspace-route-contracts.test.ts`
    - Validation: passed focused Vitest run for tests/lib/domain/rich-text-references.test.ts, tests/lib/store/work-document-actions.test.ts, tests/components/work-item-detail-screen.test.tsx, tests/convex/document-handlers.test.ts, tests/convex/work-item-handlers.test.ts, tests/convex/comment-handlers.test.ts, tests/lib/content/rich-text-references.test.ts, tests/lib/content/rich-text-security.test.ts, tests/components/rich-text-editor-helpers.test.tsx, and tests/components/document-detail-screen.test.tsx; passed focused ESLint for changed product/test files; passed TypeScript no-emit; passed whitespace diff check
    - Exit criteria: references become durable relationships where allowed and private/inaccessible entities do not leak through sidebars or navigation
    - Rollback impact: additive fields can remain unused if UI extraction is reverted
    - Blocking unknowns: none
    - Pre-implementation context check: read DES-006, DES-007, REQ-REF-002, REQ-REF-003, REQ-SEC-001, existing linked arrays, Convex access helpers, and scoped read-model invalidation patterns
    - Test creation review: tests assert access-filtered relationship derivation, store optimistic persistence, Convex-side revalidation, comment reference metadata, and sidebar backlink rendering rather than only token parsing
    - Post-implementation review: completed; persistence now stores source-owned inline relationships, work item sidebars derive allowed backlinks from those source links, private sources/targets are skipped by client selectors and Convex revalidation, and inaccessible reference clicks are blocked with an access-denied message so direct navigation does not leak hidden content
    - Spec drift check: completed; a normalized references table was not introduced because source-owned linked arrays and optional additive fields were sufficient for the current repo shape, but broader document sidebar previews may need a future normalized reference source if references become query-heavy
    - _Requirements: REQ-REF-002, REQ-REF-003, REQ-SEC-001, REQ-REL-001, REQ-ARCH-001, REQ-TEST-001_

- [ ] 5. Popup containment and typing responsiveness
  - [x] 5.1 Add optional portal-container support and contain work item detail popups
    - Status: completed
    - Depends on: none
    - Likely areas: `components/ui/popover.tsx`, `components/ui/dropdown-menu.tsx`, `components/app/screens/work-item-detail-screen.tsx`, `components/app/screens/property-chips.tsx`, `components/app/screens/work-item-inline-property-control.tsx`, `tests/components/work-item-detail-screen.test.tsx`, `tests/components/work-surface-view.test.tsx`
    - Validation: component tests that contained property popups mount inside a work item surface container and global popovers keep default body portals
    - Exit criteria: work item detail dropdowns/popovers no longer escape into the shell when containment is required
    - Rollback impact: optional container path can revert without changing global primitive defaults
    - Blocking unknowns: none
    - Pre-implementation context check: read DES-008, REQ-POP-001, current Radix primitive wrappers, work item detail frame, and property control tests
    - Test creation review: completed; tests assert the status picker portal mounts inside the work item surface, and existing work-surface picker tests protect global/inline picker behavior outside the detail surface
    - Post-implementation review: completed; primitive wrappers gained an optional `portalContainer` without changing defaults, work item sidebar controls read the surface-owned portal context, and shell/global popovers remain body-mounted unless a caller explicitly opts into containment
    - Spec drift check: completed; the existing test suite mocked `CollapsibleRightSidebar` without forwarding props/ref, so the test fixture was updated to preserve the real containment contract rather than altering product code
    - _Requirements: REQ-POP-001, REQ-ARCH-001, REQ-TEST-001_

  - [x] 5.2 Reduce typing lag in create, description, comment, and reference surfaces
    - Status: completed
    - Depends on: 4.1
    - Likely areas: `components/app/screens/create-work-item-dialog.tsx`, `components/app/screens/work-item-detail-screen.tsx`, `components/app/screens/work-item-ui.tsx`, `components/app/rich-text-editor.tsx`, `lib/content/rich-text-mentions.ts`, `tests/components/work-item-detail-screen.test.tsx`, `tests/components/rich-text-editor-helpers.test.tsx`
    - Validation: component tests/code review showing local draft state, deferred parsing, memoized heavy derivations, and no broad app recomputation on keystrokes
    - Exit criteria: typing paths update local drafts without synchronous reference extraction or unrelated app-wide derivation
    - Rollback impact: optimization helpers can revert independently if behavior changes
    - Blocking unknowns: none
    - Pre-implementation context check: read DES-010, REQ-NFR-001, editor/create/comment components, mention/reference parser paths, and existing typing tests
    - Test creation review: completed; tests assert reference relationships stay unchanged during draft typing and update from the debounced current sync, while existing create/detail tests protect non-stale submit behavior
    - Post-implementation review: completed; rich-text relationship extraction moved from keystroke draft updates to save/queued-sync boundaries, work item mention diffing moved to save-time, and create modal heavy option derivations were memoized without changing store ownership
    - Spec drift check: completed; no upstream artifact changes required because the observed lag path was avoidable draft/render work, not collaboration transport itself
    - _Requirements: REQ-NFR-001, REQ-REF-001, REQ-ARCH-001, REQ-TEST-001_

- [ ] 6. Final audits, compatibility, and verification
  - [x] 6.1 Run focused validation for all implemented slices
    - Status: completed
    - Depends on: 1.2, 2.1, 2.2, 3.2, 4.2, 5.1, 5.2
    - Likely areas: `tests/lib/domain/view-item-level.test.ts`, `tests/components/work-surface-view.test.tsx`, `tests/components/work-item-detail-screen.test.tsx`, `tests/components/people-screen.test.tsx`, `tests/components/workspace-search-screen.test.tsx`, `tests/lib/content/rich-text-mentions.test.ts`, `tests/app/api/document-workspace-route-contracts.test.ts`
    - Validation: `pnpm test` on affected files, `pnpm typecheck`, and `pnpm lint` when touched files are broad enough
    - Exit criteria: focused tests for every changed behavior pass and validation output is recorded in implementation notes
    - Rollback impact: no production rollout until validation passes
    - Blocking unknowns: none
    - Pre-implementation context check: read DES-001, REQ-ARCH-001, REQ-TEST-001, all completed task notes, and current test changes
    - Test creation review: completed; focused tests cover user-visible requirements, privacy/negative cases, reference permission paths, popup containment, and non-stale typing persistence rather than only helper internals
    - Post-implementation review: completed; focused cross-slice validation, full lint, typecheck, and diff whitespace checks pass before the final diff-review loop
    - Spec drift check: completed; no upstream artifact mismatch found during 6.1 validation, with final 6.2 kept open until the whole local diff-review loop is clean
    - _Requirements: REQ-ARCH-001, REQ-TEST-001_

  - [x] 6.2 Perform final original-request, privacy, and architecture-standard audit
    - Status: completed
    - Depends on: 6.1
    - Likely areas: `.spec/work-item-reference-activity-ui/design.md`, `.spec/work-item-reference-activity-ui/requirements.md`, `.spec/work-item-reference-activity-ui/tasks.md`, implementation diff
    - Validation: manual checklist covering every original plan item, private data paths, popup containment, reference access, and architecture standards; passed `git diff --check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`
    - Exit criteria: every original user request is either implemented and verified or explicitly deferred with rationale approved by the user
    - Rollback impact: final audit blocks merge/release if privacy or original-request coverage is incomplete
    - Blocking unknowns: none
    - Pre-implementation context check: read the full original user plan and clarifications, completed task notes, current implementation diff, diff-review gates, and architecture-standard review checklist
    - Test creation review: completed; the final validation set includes focused requirement tests plus the full Vitest suite so tests cover user-visible behavior, privacy/access negative cases, and broad regression surfaces
    - Post-implementation review: completed; branch-total review found and fixed child-filter drift, unsafe entity-reference href preservation, Next 16 Turbopack build drift, lint hygiene, and read-only chat message mutation drift before local all-clear
    - Spec drift check: completed; no unresolved drift remains between the original request, clarified child-filter semantics, live code, and architecture standards. Chat read/notification changes are tracked in the diff-review ledger because they were completed in parallel threads outside this spec package.
    - _Requirements: REQ-ARCH-001, REQ-TEST-001_
    - Pre-implementation context check: reread the original user plan, this spec package, final diff, and architecture-standards review checklist
    - Test creation review: confirm final tests map to requirements and cover privacy/negative cases
    - Post-implementation review: final diff reviewed against original request and architecture standards; justified deviations recorded
    - Spec drift check: update `.spec/work-item-reference-activity-ui/design.md`, then `.spec/work-item-reference-activity-ui/requirements.md`, then `.spec/work-item-reference-activity-ui/tasks.md` if any mismatch remains
    - _Requirements: REQ-ARCH-001, REQ-TEST-001_

## Post-Deploy Verification
- Open a work surface grouped by parent or status with child items visible and confirm child rows mirror active parent filters, including status/completion filters.
- Open representative detail surfaces from their origin routes and verify breadcrumb/back navigation.
- Create a child under a parent with a project and verify inherited project display is disabled.
- Change relevant work item properties, including status and labels where tracked, and verify profile activity for the actor while checking private activity is hidden from another user.
- Insert references in document/work item/comment flows and verify allowed backlinks plus denied inaccessible navigation.
- Open work item property dropdowns in docked/floating surfaces and confirm popups stay contained.
- Inspect people directory with 1-3 people and with wider viewport to confirm stable auto-fill columns.

## Traceability Matrix
- REQ-FILT-001 -> 1.1, 1.2
- REQ-FILT-002 -> 1.1, 1.2
- REQ-UI-001 -> 2.1
- REQ-UI-002 -> 2.1
- REQ-UI-003 -> 2.1
- REQ-ACT-001 -> 3.1
- REQ-ACT-002 -> 3.1, 3.2
- REQ-SEARCH-001 -> 2.1
- REQ-REL-001 -> 2.2, 4.2
- REQ-REF-001 -> 4.1, 5.2
- REQ-REF-002 -> 4.2
- REQ-REF-003 -> 4.1, 4.2
- REQ-SEC-001 -> 3.2, 4.2
- REQ-UI-004 -> 2.1
- REQ-UI-005 -> 2.1
- REQ-POP-001 -> 5.1
- REQ-NFR-001 -> 4.1, 5.2
- REQ-ARCH-001 -> 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 4.1, 4.2, 5.1, 5.2, 6.1, 6.2
- REQ-TEST-001 -> 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 4.1, 4.2, 5.1, 5.2, 6.1, 6.2

## Coverage Checklist
- Every `REQ-*` appears in at least one leaf task
- No leaf task introduces scope absent from the requirements
- Validation is included near risky changes
- Rollout and rollback work is present when needed
- Architecture-transition specs include containment, behavior preservation, boundary/public-surface movement, and closure of accepted exceptions
- Fallow-backed specs include changed-file gate, production gate, full advisory inventory, CI parity, stale-evidence check, full-test confidence rule, and accepted-debt ratchet where relevant
- Every leaf task includes pre-implementation context review, test creation review, post-implementation review, and spec drift check fields
- `Depends on` references form a valid acyclic graph
- Every leaf task and blocking spike appears exactly once in `Execution Status Summary`

## Authoring notes
- Leaf tasks must include `Status`, `Depends on`, `Likely areas`, `Validation`, `Exit criteria`, `Rollback impact`, `Blocking unknowns`, `Pre-implementation context check`, `Test creation review`, `Post-implementation review`, `Spec drift check`, and `_Requirements: ..._`.
- Allowed status values are `todo`, `in-progress`, `completed`, `deferred`, and `blocked`.
- Checked tasks must use `Status: completed`; incomplete tasks must not.
- The implementing agent is responsible for live code correctness and must update upstream artifacts before diverging from this task list.
