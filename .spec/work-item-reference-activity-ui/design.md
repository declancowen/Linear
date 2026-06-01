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

# Design Document: Work Item Reference Activity And Surface Refinements

## Summary
- Deliver the requested work-surface, detail-sidebar, profile-activity, search, people-grid, reference-linking, and typing-responsiveness refinements without drifting away from the original behavior request.
- Keep the original request authoritative for the desired product outcome, use `architecture-standards` as the solution-shape lens, and use live repo evidence as the authority for where code belongs.
- Split implementation into small reviewable slices because the requested plan spans domain selectors, app store actions, Convex handlers, rich text/editor surfaces, detail views, and UI primitives.

## Scope Statement
- This spec covers board/list child-row filter inheritance, create-modal inherited project display, breadcrumb back navigation across breadcrumb surfaces, work-item/profile activity alignment, private-activity visibility, global search row icon alignment, work item sidebar relationship cleanup, entity references across documents/work items/comments, assignee avatar display cleanup, typing responsiveness, people directory grid behavior, and popup containment inside work item detail surfaces.
- This spec does not redesign the broader workspace shell, replace the rich text editor, replace Convex read models, or introduce a new design system.

## Original Plan Alignment Audit
- Original plan or prompt excerpts reviewed: child rows inheriting board filters, breadcrumb back navigation across breadcrumbs, inherited project display in child creation, remove child label, relevant work item change activity in profiles, search modal icon alignment, hide private activity from other profiles, remove projects from work item sidebar relationships, cross-entity mentions/references/embeds, private reference exclusion, private edit errors, assignee avatar cleanup, typing lag, people grid auto-fill, popup containment, and implementation through iterative spec/architecture review loops.
- Explicit requirements confirmed from the original plan: board/list child rows inherit and mirror active parent filters with no explicit subtask filter state or second tick UI; private artifacts must not leak through profiles or references; project inheritance must be visible but disabled when inherited from parent; entity references must be access-aware; every implementation slice must use architecture standards during the change, then still run end-of-slice and final plan/architecture audits.
- Plan items excluded or deferred, with reason: no unrelated shell navigation redesign; no generic realtime/collaboration protocol rewrite; no broad data migration unless the reference model requires a narrow additive field.
- Gaps, contradictions, or stale assumptions found: the code already hides private work/document activity from non-creators in `lib/domain/selectors-internal/people.ts`, so the profile privacy task is a regression guard plus work-item-change activity extension rather than a brand-new privacy model.
- Upstream artifact changes required before continuing: none.
- Architecture standards reviewed: target-state modular monolith, presentation/domain/backend ownership, scoped read models, public contract compatibility, privacy boundaries, and frontend component containment.
- Agent judgment or justified architecture-standard deviations: entity references are designed as incremental reuse of existing linked entity arrays and mention queues first; a separate graph table is deferred unless implementation proves arrays cannot express required references.
- Post-design audit outcome: all user-requested items are represented in design decisions and downstream requirements.

## Repository Discovery Summary

### Repo Root
- `/Users/declancowen/Documents/GitHub/Linear`

### Repo-Specific Profile and House Patterns
- `docs/architecture/target-state-architecture.md` defines a governed modular monolith with clear presentation-to-application-to-domain-to-persistence dependency direction.
- `DESIGN.md` defines a compact operational UI with small controls, restrained surfaces, dense metadata, and CSS grid/card behavior that should not stretch cards into marketing-style panels.
- Existing `.spec/realtime-collaboration-scoped-sync/design.md` and related docs establish scoped read-model discipline rather than a full snapshot for every surface.

### Entry Points and Execution Path
- Work surfaces: `components/app/screens/work-surface.tsx`, `components/app/screens/work-surface-view.tsx`, `components/app/screens/work-surface-controls.tsx`, `components/app/screens/helpers.ts`, `lib/domain/selectors-internal/work-items.ts`.
- Work detail and sidebar: `components/app/screens/work-item-detail-screen.tsx`, `components/app/screens/work-item-ui.tsx`, `components/app/screens/work-item-inline-property-control.tsx`, `components/app/screens/property-chips.tsx`, `components/ui/popover.tsx`, `components/ui/dropdown-menu.tsx`.
- Create flows: `components/app/screens/create-work-item-dialog.tsx`, `components/app/screens/inline-child-composer-state.ts`, `lib/store/app-store-internal/slices/work-item-actions.ts`, `convex/app/work_item_handlers.ts`.
- Activity/profile: `components/app/people-screen.tsx`, `lib/domain/selectors-internal/people.ts`, `convex/app/work_item_handlers.ts`, `convex/validators.ts`, `convex/schema.ts`.
- Search and people grid: `components/app/global-search-dialog.tsx`, `lib/domain/selectors-internal/search.ts`, `components/app/people-screen.tsx`, `tests/components/workspace-search-screen.test.tsx`, `tests/components/people-screen.test.tsx`.
- Rich text references: `components/app/rich-text-editor.tsx`, `components/app/rich-text-content.tsx`, `components/app/screens/document-detail-screen.tsx`, `components/app/screens/work-item-detail-screen.tsx`, `components/app/screens/use-comment-composer.ts`, `lib/content/rich-text-mentions.ts`, `lib/content/document-mention-queue.ts`.
- Backend/reference surfaces: `convex/app/document_handlers.ts`, `convex/app/work_item_handlers.ts`, `convex/app/comment_handlers.ts`, `convex/app/access.ts`, `convex/validators.ts`, `convex/schema.ts`.

### Confirmed Code and Runtime Facts
- `lib/domain/selectors-internal/work-items.ts` already applies `itemMatchesView` to direct child disclosure rows via `getDirectChildWorkItemsForDisplay`, including completion/status filtering when a view is passed.
- `components/app/screens/work-surface.tsx` passes `childDisplayMode` and `matchItems` for assigned-descendant child display, and board/list rendering already supports `showChildItems`.
- `components/app/screens/work-surface-controls.tsx` exposes a single completion toggle and filter popovers; no additional subtask filter state or second tick UI is needed for the clarified plan.
- `components/app/screens/create-work-item-dialog.tsx` has a crumb row, destination picker, type picker, and secondary context label; inherited project display is currently in the property area, not made explicit in the child-create context.
- `convex/app/work_item_handlers.ts` creates `workItemActivities` for status changes with `type: "status-change"`, `actorId`, `fromStatus`, and `toStatus`; other relevant work item update activity, such as labels or property changes, may need activity tracking to make profiles complete.
- `lib/domain/selectors-internal/people.ts` builds profile activity from created work items, comments, channel posts, channel comments, and project updates; it does not include `workItemActivities`.
- `lib/domain/selectors-internal/people.ts` hides private work items and private documents unless the current user created them, so privacy needs to be preserved while adding new activity types.
- `components/app/people-screen.tsx` uses `repeat(auto-fit,minmax(min(100%,18rem),1fr))`, which collapses empty tracks and stretches cards.
- `components/ui/popover.tsx` and `components/ui/dropdown-menu.tsx` portal content to `document.body`; work item detail popovers therefore can visually escape the work item surface.
- `convex/validators.ts` already stores `workItems.linkedProjectIds`, `workItems.linkedDocumentIds`, `documents.linkedProjectIds`, and `documents.linkedWorkItemIds`; it does not store linked view IDs or document-to-document reference IDs.

### Related Code and Pattern Inventory
- Domain selectors in `lib/domain/selectors-internal/work-items.ts`, `lib/domain/selectors-internal/people.ts`, and `lib/domain/selectors-internal/search.ts` are the right owner for derived visibility/filter/search behavior.
- Store slices in `lib/store/app-store-internal/slices/work-item-actions.ts`, `lib/store/app-store-internal/slices/work-document-actions.ts`, and `lib/store/app-store-internal/slices/work-comment-actions.ts` own optimistic local updates and mutation orchestration.
- Convex handlers such as `convex/app/work_item_handlers.ts`, `convex/app/document_handlers.ts`, and `convex/app/comment_handlers.ts` own authoritative persistence, access checks, activity creation, and scoped read-model invalidation.
- Tests already exist for the exact domains: `tests/lib/domain/view-item-level.test.ts`, `tests/components/work-surface-view.test.tsx`, `tests/components/work-item-detail-screen.test.tsx`, `tests/components/people-screen.test.tsx`, `tests/lib/content/rich-text-mentions.test.ts`, and `tests/app/api/document-workspace-route-contracts.test.ts`.

### Adjacent Pattern Comparison
- Preferred existing pattern: keep pure derivation in `lib/domain`, UI state in presentation components, optimistic mutation in store slices, and authoritative writes/access checks in Convex handlers.
- Why it applies here: every requested behavior has both a UI rendering surface and a domain/access invariant.
- Whether the proposed solution conforms or diverges: conforms for filtering/activity/profile/search/popup containment; reference linking may extend existing linked arrays rather than introducing a new graph table.
- If it diverges, why: rich text references are a wider entity graph than the existing arrays; the first pass should still reuse entity arrays and mention parsing until implementation evidence proves a graph table is needed.

### Blast Radius Review
- Shared utilities used by the target code: `components/ui/popover.tsx`, `components/ui/dropdown-menu.tsx`, `components/app/rich-text-editor.tsx`, `lib/domain/selectors-internal/work-items.ts`, `lib/domain/selectors-internal/people.ts`.
- Callers of the target code: workspace work boards, private tasks, project detail boards, work item details, document details, people profiles, command search, comments.
- Imports into and from the target code: work surfaces import domain selectors and store actions; Convex handlers import validators and access helpers; rich text screens import mention parsing and notification queues.
- Sibling modules in the same domain: `components/app/screens/document-detail-screen.tsx`, `components/app/screens/document-ui.tsx`, `components/app/screens/work-item-hover-card.tsx`, `components/app/screens/work-item-menus.tsx`.
- Feature flags, config, or env vars affecting the path: none identified; release should be controlled by small PR slices and tests.

### Recent Related Repository History
- `.reviews/work-comments-assignees-release.md` and `.reviews/work-items-people-notifications-subscriptions.md` indicate recent activity around work comments, assignees, people, notifications, and subscriptions.
- `.reviews/work-properties-doc-views-workspace-routing.md` and `.reviews/post-merge-work-surface-followups.md` indicate recent work-surface and document/view routing changes.
- `docs/architecture/document-presence-avatar-hot-path-spec.md` is relevant to avatar rendering and hot-path UI work.
- `.audits/fallow-static-audit-2026-05-01.md` and `.fallowrc.json` show static-analysis governance exists and should remain advisory/gated according to package scripts.

### Impacted Boundaries and Adjacent Systems
- UI: board/list/timeline work surfaces, detail sidebar, create modal, comments, documents, search modal, people grid/profile.
- Domain: filter semantics, profile activity derivation, reference visibility/access rules, search result rows.
- Backend: Convex work item activity persistence, document/work item reference extraction and persistence, comment/reference parsing.
- Access/privacy: private tasks and private documents must not leak through profiles, search, references, or backlinks.
- Read models: work item detail, document detail, workspace people, search seed, and scoped invalidation keys may require updates when references/activity change.

### Data, Contracts, and Config Surfaces
- `ViewDefinition.filters` in `convex/validators.ts` and `lib/domain/types.ts` should remain the single filter state for parent and displayed child rows.
- `workItemActivities` in `convex/schema.ts` and `convex/validators.ts` already exists for status changes and may need additive activity types for other relevant work item changes.
- `documents.linkedWorkItemIds`, `documents.linkedProjectIds`, `workItems.linkedDocumentIds`, and `workItems.linkedProjectIds` exist; linkable views and document-to-document references may need additive fields or a normalized derived reference model.
- Rich text content stores HTML; reference extraction must treat content as untrusted and reuse existing rich text parsing/sanitization patterns.

### Existing Tests and Operational Signals
- `tests/lib/domain/view-item-level.test.ts` covers view filtering, child display, parent grouping, and assigned-descendant compression.
- `tests/components/work-surface-view.test.tsx` covers board/list rendering, create defaults, child rows, parent grouping, drag behavior, and property pickers.
- `tests/components/work-item-detail-screen.test.tsx` covers detail sidebar behavior.
- `tests/components/people-screen.test.tsx` covers people directory/profile behavior.
- `tests/components/workspace-search-screen.test.tsx` and `tests/lib/domain/workspace-search.test.ts` cover search.
- `tests/lib/content/rich-text-mentions.test.ts`, `tests/lib/content/document-mention-queue.test.ts`, and `tests/app/api/document-workspace-route-contracts.test.ts` cover mention parsing/notification contracts.

### Static Analyzer and Audit Evidence
- Relevant audit/review artifacts: `.audits/fallow-static-audit-2026-05-01.md`, `.reviews/work-comments-assignees-release.md`, `.reviews/work-items-people-notifications-subscriptions.md`, `.reviews/work-properties-doc-views-workspace-routing.md`.
- Analyzer commands, modes, configs, baselines, suppressions, allowlists, and thresholds: `package.json` defines `fallow:dead-code`, `fallow:health`, `fallow:dupes`, and `fallow:gate`; this spec authoring pass did not run Fallow.
- Duplication, health, module-budget, boundary, or coverage signals that influence the design: large UI surfaces such as `components/app/screens/work-item-detail-screen.tsx` and `components/app/screens/work-surface-controls.tsx` should receive narrow, helper-oriented edits rather than broad rewrites.
- Gate vs advisory inventory distinction: final implementation should run focused tests plus typecheck/lint; Fallow may be run if the implementation creates shared helpers or changes broad module boundaries.
- For each analyzer result: no fresh analyzer result was produced during spec authoring.
- CI parity: package scripts identify lint/typecheck/test/build as standard validation; PR-specific validation should stay focused until implementation scope is known.
- Accepted-debt register: no new accepted static-analysis debt is intended.

## Problem Statement and Context
- The current product has several sharp edges in work planning and collaboration workflows: child row filtering needs to consistently mirror board/list parent filters, profile activity omits relevant work item change activity, reference behavior is too limited for documents/work items/comments, and some UI details undermine a compact operational experience.
- The requested changes are tied to correctness and trust: users should not see private activity they cannot access, references should respect membership, child creation should make inherited project context visible, and popups should stay inside the active work item surface.
- If the work is wrong, users can see private data, lose navigation context, create children under the wrong project context, or get a misleading spec-complete result that did not implement the original request.

## Current-State Analysis
- Work item filters operate through `itemMatchesView`; direct child rows can already use filters when a view is passed, so the target behavior is to preserve and verify child-row inheritance instead of adding a separate subtask filter state.
- Completion filtering is a single `showCompleted` boolean on view filters and should be inherited by displayed child rows with the rest of the board/list filters.
- People profile activity omits `workItemActivities`, so relevant work item changes recorded by Convex do not appear in profile timelines.
- Private activity filtering exists for work item/document creation and comments; adding work item change activity must preserve the same self-only visibility rule.
- People cards stretch because CSS grid uses `auto-fit`, which collapses empty tracks.
- Popover/dropdown primitives portal to the body, which is correct globally but wrong for work item detail surfaces that need containment.
- Entity references are represented partially by linked arrays, mentions, and notifications; the model does not yet cover inline links to views, document-to-document references, work-item-to-document references from descriptions/comments, or access-denied confirmation/preview behavior.

## Target-State Architecture
- Intended owner for each durable invariant: domain selectors own filtering/activity visibility/search; Convex handlers own persisted activity/reference updates and access checks; UI components own presentation and containment only.
- Dependency direction and public surfaces: presentation components call domain helpers and store actions; domain helpers stay framework-free; Convex handlers enforce writes and privacy.
- Contracts, data ownership, async/reliability, and operational ownership: reference extraction must update existing linked fields or an additive reference model through authoritative route/Convex handlers and bump scoped read models for affected entities.
- What must stop happening after the transition: child rows must not ignore active board/list filters; private activity must not leak through profiles/references/search; work item sidebar relations must not duplicate the project property; popups must not escape the work item surface; architecture standards must not be deferred to a final checklist after a slice is already shaped.
- Fitness functions that prove the target state is holding: focused domain tests, component tests for visible behavior, route/Convex tests for access/reference persistence, and browser smoke for popup containment if UI primitives change broadly.
- Static analyzer fitness functions, if relevant: no new broad helper dumping ground; shared popup containment helpers must be narrow and UI-owned.

## Goals
- Ensure displayed child rows inherit and mirror active board/list filters without adding explicit subtask filter state or second-tick UI.
- Preserve private-task and private-document privacy in people profiles, search, references, and backlinks.
- Show relevant visible work item change activity in people profiles for the actor, including status changes and other tracked property changes such as labels where applicable.
- Make child creation show inherited project context with icon/name while keeping inherited project disabled.
- Remove duplicate project entries from work item sidebar relationships while keeping document/reference relationships.
- Add access-aware inline entity references for documents, work items, projects, and views across documents, work item descriptions, and comments.
- Fix the people directory grid with CSS grid `auto-fill`, not `auto-fit`.
- Keep popup/dropdown content visually contained inside work item detail surfaces.

## Non-Goals
- No generic graph database.
- No replacement of TipTap/Yjs collaboration.
- No broad redesign of all popovers, menus, or the app shell.
- No private task comments unless separately requested; current backend rejects private task comments.
- No new external search service.

## Confirmed Facts
- `getDirectChildWorkItemsForDisplay` can filter children using the active view.
- `workItemActivities` is an existing Convex table with status-change records.
- Profile activity derives from selectors, not directly from Convex in the UI.
- People grid currently uses `auto-fit`.
- Popover/dropdown primitives portal to body by default.
- Work items and documents already have linked entity arrays for some relationship types.

## Assumptions
- No explicit child/subtask filter state is required; existing filter state remains the single source for parent and displayed child rows.
- Inline references can be represented in rich text content and synchronized through existing save/flush flows.
- Existing membership helpers can determine whether a user may open a referenced entity.
- Project references should not render in the work item sidebar Relations section; projects remain represented through work item properties instead.

## Open Questions
- None.

## Decision Needed
- None.

## Proposed Design

### Solution Overview
- Preserve child-row filter inheritance in work-surface filtering and add regression coverage so no separate subtask filter state or second-tick UI is introduced.
- Extend people activity selectors with relevant work item change activities from `workItemActivities`, and extend tracking where needed for labels/property changes, preserving existing private visibility checks.
- Update create modal context presentation so inherited project is visibly shown and disabled when derived from a parent.
- Keep relationship display focused on non-project references/backlinks and remove project duplication from Relations.
- Extend rich text reference parsing and link insertion across documents, work item descriptions, and comments while enforcing access-aware navigation/preview rules.
- Add popup containment support to UI primitives and pass a work-item-surface container from detail screens.
- Fix people grid `auto-fill` behavior and adjust command search icon alignment.

### Transition Plan From Current State
- Containment gate: add or update domain tests for child filter inheritance and profile activity before broad UI updates.
- Safe implementation slices: grid/search UI polish, board child filtering, create-modal/breadcrumb/sidebar polish, activity/profile selectors, popup containment, references/embeds, typing responsiveness.
- Old bypasses or compatibility paths to remove: sidebar project relation duplication and `auto-fit` people grid behavior.
- Baselines, suppressions, allowlists, or module-budget caps that remain temporarily: none.
- Revisit trigger for each accepted exception: if linked arrays cannot express references/backlinks reliably, update this design before adding a dedicated reference table.

### End-to-End Flow
- User toggles a filter once; board/list parent rows and displayed child rows derive from the same active filter state.
- Work surface derives visible parent rows and child rows through domain selectors so board/list behavior is consistent.
- User creates a child from a parent; modal derives parent, child type, inherited project, and disabled project property from current parent/project context.
- User updates status, labels, or another tracked work item property; Convex persists relevant `workItemActivities`; profile selector merges visible change entries into the actor profile timeline.
- User inserts an entity reference in rich text; editor stores a safe link/mention node, save/flush extracts references, Convex validates access and updates linked/reference fields plus read-model invalidations.
- User clicks a referenced entity they cannot access directly; the app confirms no direct access and offers preview only when the current document/workspace surface legitimately exposes that reference.
- User opens a property dropdown in the work item surface; Radix content portals into the work item surface container instead of the shell body.

### Component and Module Changes

#### UI or Client
- `components/app/screens/work-surface.tsx` and `components/app/screens/work-surface-view.tsx`: preserve passing the active view/filter state into child row derivation and add regression coverage for inherited filtering.
- `components/app/screens/create-work-item-dialog.tsx`: show inherited project icon/name as disabled when parent project cascades; remove redundant child dot label in crumb row.
- `components/app/screens/work-item-detail-screen.tsx`: remove projects from relations, add reference/backlink sections, pass popup container, update breadcrumb/back behavior.
- `components/app/global-search-dialog.tsx`: center result icons against first-line label.
- `components/app/people-screen.tsx`: switch people grid to `repeat(auto-fill,minmax(320px,1fr))` with stable card widths and keep non-stretch behavior.
- `components/app/rich-text-editor.tsx` and `components/app/rich-text-content.tsx`: add entity-reference rendering/insertion behavior without replacing user mention behavior.

#### API or Application Layer
- Next routes such as `app/api/documents/[documentId]/route.ts`, `app/api/items/[itemId]/description/route.ts`, `app/api/items/[itemId]/route.ts`, and `app/api/comments/route.ts` should pass extracted entity references to existing store/Convex mutations where applicable.
- Client read-model refresh functions in `lib/convex/client/read-models.ts` may need additional scope keys for referenced entities.

#### Domain or Business Logic
- `lib/domain/selectors-internal/work-items.ts`: own parent/child filter inheritance semantics.
- `lib/domain/selectors-internal/people.ts`: own visible profile activity composition, including relevant work item change activities.
- `lib/domain/selectors-internal/search.ts`: remain the authority for accessible search entities and avoid private leakage.
- `lib/content/rich-text-mentions.ts` or adjacent content helpers: parse entity references and normalize them into typed reference entries.

#### Data Model and Persistence
- Prefer additive fields that extend existing linked arrays: document-to-document and view references may require `linkedDocumentIds` and `linkedViewIds` additions.
- If implementation evidence shows arrays are insufficient for direction/type/source, update design before introducing a `references` table.
- Existing `workItemActivities` table can represent status-change activity and may need additive activity types for other relevant changes.
- Saved view/filter schema should not gain child/subtask filter state for this requirement.

#### Integrations, Events, or Background Jobs
- No external integration changes.
- Scoped read-model invalidation must include affected document/work item/project/view details after reference updates.

#### Security and Permissions
- Private work items and private documents must never appear in another user's profile activity, search results, or reference backlinks.
- Direct open of inaccessible team-space entities must show an access confirmation/error and must not navigate into forbidden detail routes.
- Preview is allowed only from a workspace document context where the viewer legitimately has the containing-document access and the preview does not expose hidden private entities.

#### Performance and Scalability
- Apply architecture-standards performance guidance during each change: child filtering and profile activity merging should use local maps/sets and avoid repeated full scans inside render loops where cheap memoization/domain helpers exist.
- Typing in create modal, comments, and descriptions must not re-render broad app snapshots on every keystroke.
- Entity reference parsing should run on commit/flush or deferred editor state, not on every keypress when avoidable.

#### Observability and Operations
- No production dashboards required.
- Errors from inaccessible references and reference persistence should use existing typed route errors/toasts so support can understand failures.

## Impacted Surfaces Matrix
- UI: work surface filters/boards/lists, create modal, detail sidebar, comments, documents, search, people grid/profile.
- API: item/document/comment update routes if reference extraction payloads change.
- Domain logic: work item filtering, profile activity, search visibility, rich text reference parsing.
- Persistence: saved view filters, documents, work items, maybe views/reference fields.
- Integrations: none.
- Auth: workspace/team/private access checks for references and profile activity.
- Infra: none.
- Telemetry: existing toasts/errors; no new dashboard.
- Tests: domain selector tests, component tests, route/Convex tests, rich text tests.
- Docs: this spec and any architecture note if a reference table becomes necessary.

## Change Impact Map
- Direct impact: `components/app/screens/work-surface.tsx`, `components/app/screens/work-surface-view.tsx`, `components/app/screens/work-surface-controls.tsx`, `components/app/screens/create-work-item-dialog.tsx`, `components/app/screens/work-item-detail-screen.tsx`, `components/app/people-screen.tsx`, `components/app/global-search-dialog.tsx`, `lib/domain/selectors-internal/work-items.ts`, `lib/domain/selectors-internal/people.ts`, rich text content helpers, Convex handlers.
- Indirect impact: scoped read models, search seed data, notifications/mentions, private task/document behavior, work item detail tests.
- Unchanged but risk-adjacent areas: WorkOS membership, desktop shell, external email jobs, PartyKit collaboration transport.

## Invariants and Forbidden Outcomes
- The implementation must satisfy the original requested behavior, not merely complete generated tasks.
- Private work items and private documents must not become visible to other users through profiles, references, search, or backlinks.
- Child rows must inherit active board/list filters and must not require a separate subtask filter state.
- Existing saved views must load without migration for child filtering.
- Primary project remains a property, not a relation duplicate in the work item sidebar.
- Popups inside work item detail must not visually escape into the shell when containment is required.
- Tests must prove user-visible requirements and privacy behavior, not only helper internals.

## Compatibility Matrix
- Public API: Not applicable; app-internal routes only.
- Internal API: Additive route/store payloads for references must default safely; no view/filter schema addition is required for child-row filtering.
- Data schema: Additive fields only where activity/reference tracking requires them; no destructive migration.
- Events: Scoped read-model invalidations may add affected entity scopes.
- Cache keys: Search/detail scope keys may need invalidation after reference changes.
- Config: Not applicable.
- External consumers: Not applicable.
- Rollback compatibility: Additive activity/reference fields remain inert if UI/reference extraction is reverted; child-filter inheritance uses existing filter state.

## Contract Examples and Before/After Payloads
- Request examples: work item/document update payloads may include `references: [{ entityType: "workItem", entityId: "item_1", source: "body" }]`.
- Response examples: inaccessible reference open may return or surface `403` with "You do not have access to this work item".
- Event or message examples: read-model invalidation includes `document-detail:document_1` and `work-item-detail:item_1` when a document references a work item.
- Before/after comparisons: people grid changes from `repeat(auto-fit,minmax(...))` to `repeat(auto-fill,minmax(320px,1fr))`; profile activity changes from creation/comment/project updates only to include visible work item change entries.

## Cross-Cutting Applicability Matrix
- Security: Covered by private activity/reference access rules.
- Privacy: Covered by self-only private activity and no private references/backlinks.
- Performance: Covered by deferred parsing, memoized selectors, and render-scope containment.
- Resilience: Covered by additive schema defaults and access-denied fallbacks.
- Migration: Covered by additive view/reference defaults; no destructive migration.
- Observability: Covered by typed errors/toasts and test coverage; no new dashboard.
- Supportability: Covered by explicit access-denied messages and predictable references.
- Backward compatibility: Covered by saved-view defaults and additive reference fields.

## Success Metrics and Numeric NFR Targets
- Latency targets: typing in title/comment/description inputs must not introduce synchronous app-wide recomputation beyond the current keystroke surface; targeted component tests should avoid act warnings from excessive state loops.
- Throughput or concurrency targets: no new unbounded full-app scans inside per-row render loops for work surfaces or profile activity.
- Error-rate or availability targets: no increase in failed item/document/comment updates in focused tests.
- Timeout, retry, or queue-depth limits: Not applicable; no new background queue.

## Decision Register

### DES-001: Treat original user request as outcome authority
- Context: The user explicitly required feedback loops so generated specs do not become stale instructions.
- Current-state gap: Previous flows could implement a generated task while missing original request nuance.
- Decision: Every slice must use `architecture-standards` while shaping the change, then audit against the original request, live repo evidence, and `architecture-standards` at slice completion and final plan review.
- Rationale: This prevents polished implementation of the wrong behavior.
- Tradeoffs: Slightly more review overhead per slice.
- Affected surfaces: all tasks and tests.
- Fitness signal: task completion notes contain post-implementation review and spec drift check evidence.

### DES-002: Child rows inherit board/list filters with no separate subtask state
- Context: Clarified user intent is that children mirror active parent filters on boards/lists; no second tick or explicit subtask filter state is required.
- Current-state gap: the spec had drifted toward a separate child-filter state even though the code path can already pass the active view into child row derivation.
- Decision: Preserve a single filter state and ensure displayed child rows use the same active board/list filters as parent/container rows.
- Rationale: This implements the requested behavior without overbuilding UI/state and keeps saved view schemas stable.
- Tradeoffs: Users cannot independently filter parent rows and displayed child rows, by design.
- Affected surfaces: work item selectors and board/list child row rendering tests.
- Fitness signal: board/list tests show filtered-out child rows are hidden when their parent row remains visible.

### DES-003: Keep filtering and privacy derivation in domain selectors
- Context: Work surfaces and profiles both need consistent privacy/filter rules.
- Current-state gap: UI-only filtering risks divergent board/list/profile behavior.
- Decision: Put child filtering and profile activity visibility in `lib/domain/selectors-internal/work-items.ts` and `lib/domain/selectors-internal/people.ts`.
- Rationale: Domain selectors are framework-free and already own similar derivations.
- Tradeoffs: UI components need small props/state to trigger domain behavior.
- Affected surfaces: work item selectors, people selectors, search selectors.
- Fitness signal: domain tests cover all visibility rules.

### DES-004: Extend profile activity with visible work item change activity
- Context: Work item change activity belongs in the actor profile, not only on the work item detail surface.
- Current-state gap: user profile activity does not reflect persisted or newly tracked work item changes such as status and labels.
- Decision: Add visible work item change profile activity entries derived from `workItemActivities`, extending activity tracking types where needed for relevant property changes.
- Rationale: Keeps profile activity consistent with work item detail activity while preserving privacy boundaries.
- Tradeoffs: Activity list may grow; selectors must sort consistently and avoid noisy duplicate entries.
- Affected surfaces: `convex/app/work_item_handlers.ts`, `convex/validators.ts`, `convex/schema.ts`, `lib/domain/selectors-internal/people.ts`, `components/app/people-screen.tsx`.
- Fitness signal: profile tests show visible work item changes and hide private work item changes from other users.

### DES-005: Show inherited project context as disabled in child creation
- Context: User wants child creation to pre-populate and show the inherited project with icon/name.
- Current-state gap: disabled project field can appear empty or generic.
- Decision: Derive inherited project from parent/project cascade and render it as disabled context.
- Rationale: Users understand why the project cannot be edited.
- Tradeoffs: More create-modal context wiring.
- Affected surfaces: create dialog, inline child composer, work item creation state.
- Fitness signal: tests show child modal displays inherited project and keeps it disabled.

### DES-006: Make references access-aware and private-safe
- Context: Documents, work items, comments, and views need inline references/embeds.
- Current-state gap: existing linked arrays and mention queues cover only part of this graph.
- Decision: Extend reference extraction/rendering incrementally while enforcing workspace/team/private access before persistence and navigation. Reference insertion uses a contained command-search picker owned by the editor surface, not the global shell search modal.
- Rationale: Rich references must not leak private or inaccessible entities.
- Tradeoffs: May need additive fields for views/document-to-document references; keeping the picker contained avoids shell overflow but requires editor-local candidate and keyboard handling.
- Affected surfaces: rich text editor/content, document/work item/comment routes, Convex handlers, sidebars.
- Fitness signal: tests prove allowed references, rejected private references, inaccessible navigation confirmation, and backlinks for public entities.

### DES-007: Keep project property out of sidebar relations
- Context: User wants projects removed from relationships because project already exists as a property.
- Current-state gap: `WorkItemRelationsSection` renders selected project and linked projects.
- Decision: Remove projects from relations and reserve relations for non-property references/backlinks.
- Rationale: Prevents duplicate metadata and reduces sidebar noise.
- Tradeoffs: Linked project IDs may remain in legacy data or relationship metadata, but the work item sidebar should not present them as relation entries.
- Affected surfaces: work item detail sidebar.
- Fitness signal: sidebar tests show projects only in properties and not as Relations entries.

### DES-008: Contain popups inside work item surfaces through a container-aware primitive path
- Context: Property dropdowns in work item sidebars escape into the shell.
- Current-state gap: shared Radix primitives portal to body.
- Decision: Add optional portal container support and provide a work item surface container for detail popovers/dropdowns.
- Rationale: Fixes containment without globally changing all popovers.
- Tradeoffs: Components in the detail surface need container context or prop threading.
- Affected surfaces: `components/ui/popover.tsx`, `components/ui/dropdown-menu.tsx`, work item detail property controls.
- Fitness signal: component/browser tests show content DOM is mounted inside the work item surface container.

### DES-009: Apply targeted UI polish without broad surface rewrites
- Context: People grid, search icon alignment, assignee avatars, and breadcrumbs are small visual fixes.
- Current-state gap: individual UI details violate requested behavior.
- Decision: Patch local component classes/markup only.
- Rationale: Architecture standards favor smallest correct change for low-risk UI polish.
- Tradeoffs: No broader design-system refactor.
- Affected surfaces: people screen, global search dialog, work item rows/cards, detail breadcrumb.
- Fitness signal: focused component tests assert visible layout classes/behavior.

### DES-010: Reduce typing lag by narrowing state fan-out
- Context: User reports typing lag in create modal and descriptions.
- Current-state gap: large components may subscribe to full app snapshots and perform costly derivations during text input.
- Decision: Profile code by inspection first, then isolate text draft state, memoize heavy derivations, and defer reference parsing until commit/flush.
- Rationale: Fixes the requested lag without speculative rewrites.
- Tradeoffs: Some optimization requires careful test coverage for stale drafts.
- Affected surfaces: create modal, work item detail description/comments, document editor reference parsing.
- Fitness signal: tests and manual smoke show typing does not trigger unrelated work-surface/profile recomputation.

## Risk Register
- Risk:
  - Impact: Private data leaks through activity or references.
  - Mitigation: Domain and Convex tests for private tasks/documents, and reject private references from non-owner contexts.
  - Residual risk: Medium because reference surfaces are broad.
- Risk:
  - Impact: Child rows regress and stop mirroring active board/list filters.
  - Mitigation: Domain and component tests for child filtering under visible parents.
  - Residual risk: Low.
- Risk:
  - Impact: Popup containment breaks global popover behavior.
  - Mitigation: Add optional container path only and keep body portal default.
  - Residual risk: Medium.
- Risk:
  - Impact: Reference implementation overbuilds a graph model.
  - Mitigation: Reuse existing linked arrays first and update this spec if a graph table is proven necessary.
  - Residual risk: Medium.

## Test Impact Matrix
- Existing tests to update: `tests/lib/domain/view-item-level.test.ts`, `tests/components/work-surface-view.test.tsx`, `tests/components/work-item-detail-screen.test.tsx`, `tests/components/people-screen.test.tsx`, `tests/components/workspace-search-screen.test.tsx`, `tests/lib/content/rich-text-mentions.test.ts`, `tests/app/api/document-workspace-route-contracts.test.ts`.
- New tests required: child filter inheritance, profile work item change activity, reference access/backlink behavior, popup container behavior, create-modal inherited project display, people grid auto-fill.
- Compatibility tests: existing saved views, private task/document visibility, optional reference fields.
- Rollback-safety tests: additive schema defaults and UI default behavior.
- Use `Not applicable` only with a reason: not applicable for external integration tests because no external system contract changes.

## Validation Strategy
- Unit validation for domain selectors and reference parsing.
- Integration validation for store/Convex mutation paths that persist references/activity.
- End-to-end validation through focused component tests for board/list/create/detail/search/people.
- Migration or rollback validation for additive view/reference fields.
- Browser smoke for popup containment and typing responsiveness if UI primitives change broadly.

## Post-Design Review
- Original plan coverage review: every requested item appears in goals, decisions, requirements, and task slices.
- Repository evidence review: all major target files and existing tests are named with current code facts.
- Architecture standards review: solution keeps derivation in domain selectors, writes/access in Convex handlers, UI polish local, and broad primitive changes optional/container-aware.
- Requirements readiness: ready.
- Required upstream changes before requirements authoring: none.

## Rollout, Abort, and Reversal
- Roll out in small slices: UI polish, work-surface filtering, create/detail cleanup, profile activity, reference architecture, popup containment, typing responsiveness.
- Abort a slice if privacy tests fail, saved views do not load, or popup containment changes global menus unexpectedly.
- Reversal: UI polish and selector changes can revert independently; additive fields remain inert if UI/reference extraction is reverted.

## Forbidden Shortcuts and Guardrails
- Do not implement reference links that bypass access checks.
- Do not infer completion by task count alone; compare behavior to the original user request after every slice.
- Do not move broad logic into large UI components when a domain selector or Convex handler owns the invariant.
- Do not change all popovers globally to solve one work item surface issue.
- Do not hide private activity only in UI after it has already entered shared profile/search data.

## Alternatives Considered
- Alternative:
  - Why rejected: A new generic references table for every entity was rejected as premature until linked arrays and typed extraction prove insufficient.
- Alternative:
  - Why rejected: Adding a second tick or separate subtask filter state was rejected because clarified user intent is for displayed children to inherit active board/list filters.
- Alternative:
  - Why rejected: Changing all Radix portals to local containers was rejected because global dialogs/search/tooltips still need body-level stacking.

## Residual Risks
- Reference embedding is the largest unknown and may require a follow-up design refresh if implementation reveals current linked arrays cannot represent direction, source block, or view references safely.
- Typing lag may need measurement beyond component tests if the bottleneck is collaboration sync rather than React render scope.
