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

# Requirements Document: Work Item Reference Activity And Surface Refinements

## Source Artifacts
- `.spec/work-item-reference-activity-ui/design.md`

## Scope Statement
- This document defines behavior, privacy, UI, reference-linking, and validation requirements for the requested work item, document, activity, people, and popup refinements.

## Upstream Alignment Audit
- Original plan requirements reviewed: board/list child rows inherit active parent filters with no second tick/subtask state, breadcrumb back navigation across breadcrumbs, inherited project display, activity/profile parity for relevant work item changes, search icon alignment, private activity hiding, relationship cleanup, cross-entity references, private reference exclusions, private edit errors, assignee avatar cleanup, typing lag, people grid auto-fill, popup containment.
- Design decisions reviewed: DES-001 through DES-010.
- Repository evidence and current tests reviewed: work-surface selectors/tests, people selectors/profile, Convex work item activity, rich text mention tests, people grid class, global search row markup, Radix portal primitives.
- Architecture standards implications reviewed: user intent is outcome authority; domain selectors own derivation; Convex owns access/persistence; UI components own compact presentation and local containment; architecture standards must shape each slice and material change before the final audit.
- Requirements added, changed, or rejected during audit: privacy requirements are regression guards plus extension requirements because private profile filtering already exists for some activity types.
- Design updates required before continuing: none.
- Agent judgment or justified architecture-standard deviations: no deviation; implementation may update `.spec/work-item-reference-activity-ui/design.md` first if reference arrays prove insufficient.
- Post-requirements audit outcome: requirements cover all original plan items and stay within the design.

## Cross-Cutting Coverage
- Security: REQ-SEC-001, REQ-REF-002, REQ-REF-003
- Privacy: REQ-SEC-001, REQ-ACT-002, REQ-REF-003
- Performance: REQ-NFR-001
- Resilience: REQ-POP-001, REQ-NFR-001
- Migration: not applicable; all persisted fields are additive and optional
- Architecture transition: REQ-ARCH-001
- Observability: REQ-ACT-001, REQ-TEST-001
- Supportability: REQ-REF-002, REQ-POP-001
- Backward compatibility: REQ-FILT-001, REQ-REF-002, REQ-UI-004

## Requirements

### REQ-FILT-001: Mirror active board and list filters onto child rows
Source Design Decisions:
- DES-002
- DES-003

Priority: High

Rationale:
- The clarified user intent is that displayed children inherit active parent board/list filters with no separate subtask filter state.

Requirement:
- THE system SHALL apply the same active work-surface filters to displayed child disclosure rows that it applies to parent/container rows, while still ignoring only the parent item-level constraint where required to show valid child item types.

Verification Method:
- Domain unit tests and board/list component tests

Risk if Unmet:
- Users see child rows that contradict the board/list filters they selected.

Acceptance Criteria
1. WHEN a status or completion filter hides done parent rows, THEN done child rows under still-visible parents SHALL also be hidden.
2. WHEN an assignee, label, project, type, team, visibility, or priority filter is active, THEN displayed child rows SHALL mirror that filter where the property applies.
3. WHEN a view item level is configured for parent rows, THEN child rows SHALL not be hidden solely because they have a valid child item type.

Negative Cases
1. WHEN implementing this behavior, THEN the system SHALL NOT add explicit subtask filter state, a second tick, or separate child-only filter values.

### REQ-FILT-002: Keep child filtering schema-free and UI-free
Source Design Decisions:
- DES-002
- DES-009

Priority: High

Rationale:
- The user clarified that the second tick was drift and that children should simply mirror parent filters.

Requirement:
- THE system SHALL preserve the existing single filter state and SHALL NOT add a subtask filter toggle, second tick affordance, or view schema field for this child-row behavior.

Verification Method:
- Domain and component regression tests plus diff review

Risk if Unmet:
- The implementation overbuilds the wrong requirement and creates avoidable saved-view/schema complexity.

Acceptance Criteria
1. WHEN users open the work filter UI, THEN active filter values SHALL keep the existing single selected state.
2. WHEN child rows are filtered, THEN no persisted child-filter scope SHALL be written.
3. WHEN saved views load, THEN no migration is required for child filtering.

Negative Cases
1. WHEN a task proposes subtask filter state or a second tick, THEN the spec SHALL be updated or the task SHALL be rejected before implementation continues.

### REQ-UI-001: Provide back navigation in breadcrumbs
Source Design Decisions:
- DES-009

Priority: Medium

Rationale:
- Breadcrumbs should provide practical back navigation across work/private/detail surfaces, not only in the private task case.

Requirement:
- THE system SHALL render breadcrumb/back targets on applicable detail screens that return to the originating list/surface or a safe route fallback for the current scope.

Verification Method:
- Component test and manual navigation smoke

Risk if Unmet:
- Users get trapped in detail screens without the expected navigation path.

Acceptance Criteria
1. WHEN a task, private task, document, project, view, or other detail surface is opened from a list/surface, THEN its breadcrumb/back target SHALL navigate back to that origin where available.
2. WHEN no origin route exists, THEN the breadcrumb SHALL navigate to a stable safe fallback for the current entity scope.
3. WHEN a private task is opened, THEN the fallback SHALL remain a private-task route rather than a team route.

Negative Cases
1. WHEN a breadcrumb is rendered, THEN it SHALL NOT navigate to a scope the current entity does not belong to.

### REQ-UI-002: Show inherited project context in child creation
Source Design Decisions:
- DES-005

Priority: High

Rationale:
- Users need to see which project a child inherits while understanding why the project field is disabled.

Requirement:
- THE system SHALL render the inherited project icon and name as a disabled project property when creating a child item from a parent with an inherited project.

Verification Method:
- Create dialog component tests and store validation tests

Risk if Unmet:
- Users may think the child has no project or may expect to edit a value that must be inherited.

Acceptance Criteria
1. WHEN a parent has a primary project and the user creates an allowed child, THEN the create modal SHALL display that project with icon/name.
2. WHEN the project is inherited from the parent, THEN the project control SHALL be disabled.
3. WHEN the child is private or the parent has no project, THEN the project control SHALL follow existing private/no-project behavior.

Negative Cases
1. WHEN the project is inherited, THEN the user SHALL NOT be able to select a different project in the create modal.

### REQ-UI-003: Remove redundant child context label from create modal crumb row
Source Design Decisions:
- DES-005
- DES-009

Priority: Medium

Rationale:
- The user asked to remove the dead parent label/dot child text from the top context row.

Requirement:
- THE system SHALL remove the redundant child label from the create modal crumb row while preserving destination and item-type controls.

Verification Method:
- Create dialog component tests

Risk if Unmet:
- The modal keeps confusing, non-actionable context text.

Acceptance Criteria
1. WHEN creating a child item, THEN the crumb row SHALL show destination and item type without the redundant dot child label.
2. WHEN creating a root item, THEN existing destination and type selection behavior SHALL remain unchanged.

Negative Cases
1. WHEN the child label is removed, THEN parent-derived defaults SHALL NOT be lost.

### REQ-ACT-001: Include visible work item change activity in people profiles
Source Design Decisions:
- DES-004

Priority: High

Rationale:
- Relevant work item changes are part of a user's contribution history and should appear in the actor profile activity feed.

Requirement:
- THE system SHALL include relevant work item change entries, including status and labels where tracked or newly added, in a user's workspace profile activity when the viewer may see the target work item.

Verification Method:
- Domain selector tests and people profile component tests

Risk if Unmet:
- Profile activity remains incomplete and inconsistent with work item detail activity.

Acceptance Criteria
1. WHEN a user changes a visible work item's status, labels, or another relevant tracked property, THEN that change SHALL appear in that user's profile activity.
2. WHEN profile activity is sorted, THEN work item change entries SHALL sort by `createdAt` with existing activity entries.
3. WHEN rendered, THEN the activity row SHALL identify the work item change as work activity and link to the work item.

Negative Cases
1. WHEN the target item is not visible to the viewer, THEN the work item change activity SHALL NOT appear.

### REQ-ACT-002: Preserve private activity visibility boundaries
Source Design Decisions:
- DES-003
- DES-004

Priority: Critical

Rationale:
- The user explicitly stated private tasks and private documents must not show on other people profiles.

Requirement:
- THE system SHALL hide private task and private document activity from every viewer except the creator/current user who owns that private artifact.

Verification Method:
- Domain selector tests for created, commented, and work item change activity

Risk if Unmet:
- Private user activity leaks to workspace members.

Acceptance Criteria
1. WHEN a user views another person's profile, THEN private tasks created or changed by that person SHALL NOT appear.
2. WHEN a user views another person's profile, THEN private documents created or commented by that person SHALL NOT appear.
3. WHEN a user views their own profile, THEN their own private task/document activity MAY appear.

Negative Cases
1. WHEN work item change activity targets a private item, THEN another user SHALL NOT see it.

### REQ-SEARCH-001: Center command-search icons against first-line labels
Source Design Decisions:
- DES-009

Priority: Low

Rationale:
- The user identified top-aligned icons in the command search modal as visually wrong.

Requirement:
- THE system SHALL align command-search result icons with the vertical center of the first-line label text.

Verification Method:
- Component test or visual smoke of `GlobalSearchDialog`

Risk if Unmet:
- Search results continue to look misaligned.

Acceptance Criteria
1. WHEN a result has a subtitle, THEN the icon SHALL align to the first-line label center rather than the full two-line row top.
2. WHEN a result has no subtitle, THEN the icon SHALL remain visually centered with the single-line label.

Negative Cases
1. WHEN icons are centered, THEN row height and keyboard selection behavior SHALL NOT regress.

### REQ-REL-001: Remove projects from work item sidebar relations
Source Design Decisions:
- DES-007

Priority: Medium

Rationale:
- Project already exists as a property and should not be duplicated in relationships.

Requirement:
- THE system SHALL omit projects from the work item sidebar relations section because projects are already represented as work item properties.

Verification Method:
- Work item detail sidebar component tests

Risk if Unmet:
- The sidebar keeps duplicate project metadata and obscures actual references.

Acceptance Criteria
1. WHEN a work item has a primary project, THEN the project property SHALL remain available in the properties area.
2. WHEN the relations section renders, THEN primary or secondary linked projects SHALL NOT render as relation entries.
3. WHEN linked document/reference entries exist, THEN they SHALL still render in relations or references.

Negative Cases
1. WHEN projects are removed from relations, THEN project editing through properties SHALL NOT regress.

### REQ-REF-001: Insert and render inline references to allowed entities
Source Design Decisions:
- DES-006

Priority: High

Rationale:
- The user wants documents, work items, projects, views, other documents, and comments/descriptions to reference entities inline.

Requirement:
- THE system SHALL allow rich text surfaces to insert and render inline references to accessible work items, documents, projects, and views.

Verification Method:
- Rich text parser/render tests and component tests

Risk if Unmet:
- Users cannot create the requested cross-entity context in documents, work items, and comments.

Acceptance Criteria
1. WHEN editing a workspace or team document, THEN the user SHALL be able to reference accessible documents, work items, projects, and views in that scope.
2. WHEN editing a work item description, THEN the user SHALL be able to reference accessible documents and work items.
3. WHEN writing a work item comment, THEN the user SHALL be able to reference an accessible work item inline.
4. WHEN opening reference insertion from an editor, THEN the system SHALL use a contained command-search picker scoped to that editor surface rather than the global shell search modal.
5. WHEN a reference renders, THEN it SHALL navigate or preview according to access rules.

Negative Cases
1. WHEN an entity is outside the user's workspace/team membership, THEN it SHALL NOT appear as an insertable reference option.

### REQ-REF-002: Persist reference relationships and show backlinks where allowed
Source Design Decisions:
- DES-006
- DES-007

Priority: High

Rationale:
- Referenced entities should know they have been referenced and should show that relationship in sidebars.

Requirement:
- THE system SHALL persist allowed inline references as entity relationships and SHALL render allowed backlinks in the relevant work item or document sidebar.

Verification Method:
- Store/Convex route tests, domain tests, and detail sidebar component tests

Risk if Unmet:
- References render as text without durable relationship value.

Acceptance Criteria
1. WHEN a document references a work item, THEN the work item detail SHALL show an allowed reference/backlink.
2. WHEN a work item description references a document or work item, THEN the referenced entity SHALL show an allowed reference/backlink.
3. WHEN a reference is removed from content and saved, THEN the persisted relationship SHALL be removed unless another source still references it.

Negative Cases
1. WHEN an entity is private, THEN no shared backlink SHALL be created for another user's sidebar.

### REQ-REF-003: Exclude private artifacts from shared references
Source Design Decisions:
- DES-006

Priority: Critical

Rationale:
- The user explicitly said private tasks and private documents should not have references.

Requirement:
- THE system SHALL reject shared reference creation for private tasks and private documents except self-local rendering that does not create shared backlinks.

Verification Method:
- Convex/store tests and rich text reference tests

Risk if Unmet:
- Private artifacts leak through relationship metadata.

Acceptance Criteria
1. WHEN a private task is edited, THEN shared reference/backlink creation SHALL be skipped or rejected.
2. WHEN a private document is edited, THEN shared reference/backlink creation SHALL be skipped or rejected.
3. WHEN another user views references, THEN private artifact titles and IDs SHALL NOT appear.

Negative Cases
1. WHEN a private artifact was previously linked, THEN the new renderer SHALL NOT expose it to unauthorized viewers.

### REQ-SEC-001: Gate inaccessible reference navigation
Source Design Decisions:
- DES-006

Priority: Critical

Rationale:
- The user described clicking a link to an entity outside team membership and receiving a no-access confirmation while still allowing preview from the containing workspace document.

Requirement:
- THE system SHALL block direct navigation to inaccessible referenced entities and SHALL show an access-denied confirmation or preview path only when the containing surface grants legitimate preview context.

Verification Method:
- Route/component tests for reference navigation

Risk if Unmet:
- Inaccessible work items or documents become directly reachable.

Acceptance Criteria
1. WHEN a viewer clicks a referenced team-space work item without team access, THEN the app SHALL not navigate into that work item detail route.
2. WHEN the containing workspace document may preview the reference, THEN the app SHALL show a constrained preview with an access warning.
3. WHEN preview is not permitted, THEN the app SHALL show access denied without entity content.

Negative Cases
1. WHEN access is denied, THEN the app SHALL NOT expose private comments, description content, or hidden metadata.

### REQ-UI-004: Render assignee avatars without count pill decoration
Source Design Decisions:
- DES-009

Priority: Low

Rationale:
- The user wants profile pictures only, with no assignee count or pill around avatars.

Requirement:
- THE system SHALL render work item assignees as compact avatar images without an assignee count pill or surrounding pill decoration.

Verification Method:
- Work surface component tests

Risk if Unmet:
- Work item rows/cards remain visually noisier than requested.

Acceptance Criteria
1. WHEN one assignee exists, THEN one avatar SHALL render without a count pill.
2. WHEN multiple assignees exist, THEN avatar profile pictures SHALL render compactly without a surrounding pill.
3. WHEN no assignees exist, THEN existing empty-assignee behavior SHALL remain usable.

Negative Cases
1. WHEN multiple avatars render, THEN layout SHALL NOT overflow the row/card metadata area.

### REQ-UI-005: Use auto-fill people grid columns
Source Design Decisions:
- DES-009

Priority: Medium

Rationale:
- The user explicitly provided the `auto-fill` CSS grid requirement and rejected stretched two-card rows.

Requirement:
- THE People directory SHALL use CSS grid with `auto-fill` and a stable minimum card width so 1-3 cards do not stretch to fill the row.

Verification Method:
- People screen component test and CSS class assertion

Risk if Unmet:
- People cards continue to become oversized when there are few people.

Acceptance Criteria
1. WHEN the directory has two people in a four-column layout, THEN cards SHALL occupy the first two available grid tracks rather than becoming half-width cards.
2. WHEN desktop width increases, THEN the grid SHALL allow roughly 3, 4, and 5+ card columns as space allows.
3. WHEN mobile width is narrow, THEN cards SHALL remain within the viewport.

Negative Cases
1. WHEN the grid is updated, THEN it SHALL NOT use `auto-fit` for the people card tracks.

### REQ-POP-001: Contain work item detail popups inside the work item surface
Source Design Decisions:
- DES-008

Priority: High

Rationale:
- The user reported property dropdowns overflowing outside the work item surface into the shell.

Requirement:
- THE system SHALL mount dropdowns/popovers opened from work item detail surfaces inside the work item surface container when containment is required.

Verification Method:
- Component tests for portal container behavior and browser smoke if available

Risk if Unmet:
- Detail popups continue to escape into shell UI and overlap unrelated surfaces.

Acceptance Criteria
1. WHEN a property popup opens in a docked or floating work item sidebar, THEN its portal DOM SHALL be contained by the work item surface container.
2. WHEN a global command dialog or shell menu opens, THEN existing body-level portal behavior SHALL remain unchanged.
3. WHEN the work item surface scrolls, THEN contained popup positioning SHALL remain usable.

Negative Cases
1. WHEN containment is enabled, THEN popups SHALL NOT be clipped so severely that their options become unusable.

### REQ-NFR-001: Preserve typing responsiveness in high-edit surfaces
Source Design Decisions:
- DES-010

Priority: High

Rationale:
- The user reported typing lag in create modal and task/subtask descriptions.

Requirement:
- THE system SHALL keep create modal, comment, and description typing isolated from unrelated app-wide recomputation and SHALL defer expensive reference parsing until commit or a deferred phase.

Target Metrics:
- Keystroke handlers in create modal/comment/description surfaces SHALL update local draft state without synchronous full reference extraction or full workspace search rebuild; focused tests SHALL not show repeated broad selector work on each keypress.

Verification Method:
- Component tests, code review, and manual typing smoke

Risk if Unmet:
- Editing remains visibly laggy and discourages use of rich descriptions/comments.

Acceptance Criteria
1. WHEN typing in the create modal title/description, THEN unrelated work-surface and people-profile derivations SHALL NOT run on each keystroke.
2. WHEN typing in a work item description or comment, THEN entity reference extraction SHALL run on submit/flush or deferred state, not every keypress.
3. WHEN validation labels update, THEN they SHALL not force a full app snapshot recomputation.

Negative Cases
1. WHEN typing optimization is implemented, THEN draft persistence and mention/reference submission SHALL NOT become stale.

### REQ-ARCH-001: Enforce implementation through original-request and architecture-standard review loops
Source Design Decisions:
- DES-001

Priority: High

Rationale:
- The first requirement from the user was to prevent blind implementation and keep the agent authoritative for live code.

Requirement:
- THE implementation process SHALL embed `architecture-standards` into every material slice and change decision, and SHALL also perform end-of-slice and final plan audits against the original request, linked design decisions, linked requirements, current code, current tests, and `architecture-standards`.

Verification Method:
- Task review, diff review, and spec drift check

Risk if Unmet:
- The code can pass generated tasks while missing the user's requested behavior.

Acceptance Criteria
1. WHEN a task is started, THEN linked `DES-*`, `REQ-*`, current code, and current tests SHALL be read.
2. WHEN a material design/code/test decision is made inside a slice, THEN the decision SHALL be shaped by the relevant architecture-standard ownership, boundary, privacy, performance, and proportionality guidance.
3. WHEN a task is completed, THEN the diff SHALL be reviewed against the original request and architecture standards.
4. WHEN the plan is completed, THEN a final original-request and architecture-standard audit SHALL still run.
5. WHEN a mismatch is found, THEN `.spec/work-item-reference-activity-ui/design.md`, `.spec/work-item-reference-activity-ui/requirements.md`, and `.spec/work-item-reference-activity-ui/tasks.md` SHALL be updated before continuing.

Negative Cases
1. WHEN a skill or generated task conflicts with repo evidence, THEN the agent SHALL NOT silently follow it.

### REQ-TEST-001: Prove behavior rather than implementation details
Source Design Decisions:
- DES-001
- DES-003

Priority: High

Rationale:
- The user explicitly requested review after every deliverable and test creation.

Requirement:
- THE test suite SHALL prove the requested behavior, privacy boundaries, and backwards compatibility instead of only asserting helper implementation details.

Verification Method:
- Test review and focused test execution

Risk if Unmet:
- Tests pass while the user-visible workflow remains wrong.

Acceptance Criteria
1. WHEN child filtering tests run, THEN they SHALL assert visible child rows under board/list behavior.
2. WHEN privacy tests run, THEN they SHALL assert what another user can and cannot see.
3. WHEN reference tests run, THEN they SHALL assert allowed persistence and denied access behavior.

Negative Cases
1. WHEN tests are added, THEN they SHALL NOT rely solely on private helper calls where a public behavior surface exists.

## Traceability Matrix
- DES-001 -> REQ-ARCH-001, REQ-TEST-001
- DES-002 -> REQ-FILT-001, REQ-FILT-002
- DES-003 -> REQ-FILT-001, REQ-ACT-002, REQ-TEST-001
- DES-004 -> REQ-ACT-001, REQ-ACT-002
- DES-005 -> REQ-UI-002, REQ-UI-003
- DES-006 -> REQ-REF-001, REQ-REF-002, REQ-REF-003, REQ-SEC-001
- DES-007 -> REQ-REL-001, REQ-REF-002
- DES-008 -> REQ-POP-001
- DES-009 -> REQ-UI-001, REQ-SEARCH-001, REQ-UI-004, REQ-UI-005
- DES-010 -> REQ-NFR-001

## Authoring notes
- Every requirement cites one or more `DES-*` IDs.
- Before implementation, re-read the original plan and update this file if implementation reveals a missed user-requested behavior.
