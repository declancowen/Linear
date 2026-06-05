---
title: Work View Consistency
scope: work-view-consistency
status: implementation-ready
repo_root: /Users/declancowen/Documents/GitHub/Linear
change_class: architecture-transition
risk_level: high
owner: product-engineering
reviewers: []
approvers: []
implementation_owner: product-engineering
operations_owner: product-engineering
last_updated: 2026-06-05
---

# Requirements Document: Work View Consistency

## Source Artifacts
- `.spec/work-view-consistency/design.md`
- Original 2026-06-05 user reports and process requirements.

## Scope Statement
- Requirements cover shared work item view semantics, no primary grouping, tri-state group visibility, taxonomy, private isolation, project item views, layout parity, config compatibility, Fallow, and review gates.
- Requirements do not cover unrelated docs/project-list/chat/release behavior.

## Upstream Alignment Audit
- Original plan requirements reviewed: yes.
- Design decisions reviewed: DES-001 through DES-011.
- Repository evidence and current tests reviewed: work surface, project detail, domain selectors, schemas, Convex handlers, store slices, and current tests.
- Architecture standards implications reviewed: ownership, dataflow, compatibility, verification, and transition planning.
- Requirements added, changed, or rejected during audit: none rejected; requirements were grouped by invariant.
- Design updates required before continuing: none.
- Agent judgment or justified architecture-standard deviations: none.
- Post-requirements audit outcome: requirements are traceable and ready for task planning.

## Cross-Cutting Coverage
- Security: scope and permission boundaries must remain enforced.
- Privacy: private task leakage is a primary failure case.
- Performance: shared model work must avoid unnecessary hot render traversal.
- Resilience: old view records must normalize safely.
- Migration: no-grouping and tri-state config require compatibility handling.
- Architecture transition: business rules move toward a domain-owned owner.
- Observability: review ledger records validation evidence.
- Supportability: centralized semantics reduce one-surface fixes.
- Backward compatibility: saved views, viewer overrides, and project presentation data must load.

## Requirements

### REQ-AUDIT-001: Behavior Matrix And Reproduction
Source Design Decisions:
- DES-001
- DES-002
- DES-003
- DES-011

Priority: High

Rationale:
- The user reports many symptoms, but sibling paths may fail in additional ways. Runtime edits need a current matrix first.

Requirement:
- THE system SHALL have a codebase-grounded behavior matrix for scope, layout, hierarchy, filters, grouping, empty groups, hidden/excluded groups, private views, and project views before remediation edits begin.

Verification Method:
- Domain/component fixture tests or documented reproduction notes recorded in `.spec/work-view-consistency/reviews.md`.

Risk if Unmet:
- Fixes may patch one visible surface while preserving the rule drift.

Acceptance Criteria
1. Matrix includes `My Items`, `All Issues`, TeamSpace work, TeamSpace project, project detail, workspace project, and private task contexts.
2. Matrix includes list, board, calendar, and timeline layouts.
3. User-observed symptoms are reproduced or recorded as not reproducible with evidence.

Negative Cases
1. A passing test for a single board view is not enough to clear this requirement.

### REQ-ELIGIBILITY-001: Central Scope Acquisition
Source Design Decisions:
- DES-001
- DES-002
- DES-008

Priority: High

Rationale:
- Item disappearance starts when different surfaces acquire different source pools.

Requirement:
- THE system SHALL acquire eligible work items through a shared scope model for personal, assigned, assigned-with-ancestors, team, workspace, project, and private contexts.

Verification Method:
- Domain tests for every scope and component tests proving callers consume the same eligible set.

Risk if Unmet:
- Items continue to appear in one view and disappear in another.

Acceptance Criteria
1. Team/workspace/project views exclude private work unless explicitly in private mode.
2. Private work appears only through approved personal/private rules.
3. Project item views use project-linked item scope through the shared model.

Negative Cases
1. Other-workspace private work must not appear in current-user private views.
2. Team work must not appear in a private-only source pool.

### REQ-FILTER-001: Item-Owned Filter Semantics
Source Design Decisions:
- DES-002
- DES-003

Priority: High

Rationale:
- Parent and child properties can differ; filters must not accidentally substitute parent values for child values.

Requirement:
- THE system SHALL evaluate status, priority, assignee, type, project, team, visibility, and labels from the item being matched unless an explicit hierarchy-lifting mode says otherwise.

Verification Method:
- Domain tests for parent/child property disagreement and assigned-descendant lifting.

Risk if Unmet:
- Done children can disappear from `Done`, or parent filters can override child state.

Acceptance Criteria
1. Child status grouping uses child status when the child is matched.
2. Parent filter behavior is explicit and tested as parent/ancestor matching.
3. Assigned/subscribed descendant lifting remains limited to its intended personal-work mode.

Negative Cases
1. A child with status `done` under an active parent must not be grouped as active merely because the parent is active.

### REQ-HIERARCHY-001: Explicit Parent And Child Display Modes
Source Design Decisions:
- DES-002
- DES-003

Priority: High

Rationale:
- Matching records, displayed containers, parent group headers, and child disclosure rows are different concepts.

Requirement:
- THE system SHALL model direct items, rendered containers, direct children, assigned descendants, parent filters, and parent grouping as explicit hierarchy modes.

Verification Method:
- Domain and renderer tests for root rows, child rows, parent headers, assigned descendants, and stale parent references.

Risk if Unmet:
- Grouping by parent or highest parent can hide eligible children.

Acceptance Criteria
1. Parent grouping does not silently remove eligible children.
2. Child disclosure uses the shared model or a shared model-derived child set.
3. Parentless and stale-parent items have deterministic fallback groups.

Negative Cases
1. A child should not vanish because its parent is promoted into a group header.

### REQ-TAXONOMY-001: Complete Level And Type Options
Source Design Decisions:
- DES-004

Priority: High

Rationale:
- The current option generation can hide sub-issues/subtasks and show wrong taxonomy labels.

Requirement:
- THE system SHALL derive level and type options from a shared taxonomy provider based on scope, team experience, project template, private mode, and active view mode.

Verification Method:
- Component/domain tests for issue tracker, project management, software development, mixed workspace, project template, private task, and `My Items` contexts.

Risk if Unmet:
- Users cannot filter by valid sub-item levels or see the correct product taxonomy.

Acceptance Criteria
1. Issue tracker contexts expose `Issue` and `Sub-issue`.
2. Project management contexts expose `Task` and `Subtask`.
3. Software-development contexts expose `Epic`, `Feature`, `Requirement`, and `Story`.
4. Current item presence may affect counts but must not be the sole source of valid taxonomy choices.

Negative Cases
1. `My Items` must not hide valid sub-issue/subtask choices where level filtering expects those levels.

### REQ-GROUPING-001: No Primary Grouping
Source Design Decisions:
- DES-005
- DES-010

Priority: High

Rationale:
- The product requires no grouping, but the current contract requires a group field.

Requirement:
- THE system SHALL represent no primary grouping in saved views, viewer overrides, project presentation state, schemas, Convex handlers, store patches, controls, and renderers.

Verification Method:
- Schema, store, Convex, component, and renderer tests.

Risk if Unmet:
- No grouping works only visually or fails after persistence/reset.

Acceptance Criteria
1. Primary group controls include a no-grouping option.
2. Board, list, calendar, and timeline render no-grouping views safely.
3. Existing grouped saved views continue to load.

Negative Cases
1. A no-grouping view must not synthesize misleading fake status or parent groups.

### REQ-EMPTY-GROUPS-001: Consistent Empty Group Semantics
Source Design Decisions:
- DES-001
- DES-007

Priority: High

Rationale:
- Empty lanes currently depend on source items, filters, renderer editability, and hidden state in ways that can diverge.

Requirement:
- THE system SHALL compute empty groups after eligibility, filters, grouping, scope, and hidden/excluded state have been resolved.

Verification Method:
- Domain and board/list tests for show-empty and hide-empty behavior with active filters and source lanes.

Risk if Unmet:
- Hidden empty groups can reappear or valid empty selected groups can disappear.

Acceptance Criteria
1. `showEmptyGroups: false` omits empty groups.
2. Out-of-scope source items do not create empty groups.
3. Selected empty groups are retained only where explicitly intended and tested.

Negative Cases
1. A private view must not create empty lanes for team-only groups.

### REQ-TRISTATE-001: Group Include And Exclude Interaction
Source Design Decisions:
- DES-006
- DES-010

Priority: High

Rationale:
- The requested click behavior needs one coherent state model rather than separate hidden/filter mechanisms fighting each other.

Requirement:
- THE system SHALL provide normal, include-only, and exclude states for group/status interactions, with reset returning to normal.

Verification Method:
- Control, store, Convex, viewer override, and renderer tests.

Risk if Unmet:
- Users cannot reliably isolate or hide groups, and hidden state may conflict with filters.

Acceptance Criteria
1. First click can select only the group/property.
2. Second click can exclude the group/property and show an `X` affordance.
3. Reset clears include/exclude state.
4. Saved and viewer-local paths follow the chosen persistence design.

Negative Cases
1. Include-only and exclude state must not be active for the same group simultaneously.

### REQ-PRIVATE-001: Private Scope Isolation
Source Design Decisions:
- DES-008

Priority: High

Rationale:
- Private board reports show TeamSpace parent leakage.

Requirement:
- THE system SHALL derive private task filter, grouping, parent, label, project, assignee, and custom-property options from private-eligible data only unless a relationship is explicitly valid.

Verification Method:
- Domain/component tests for private owned work, other-workspace private work, other-user private work, team work, labels, parents, and custom properties.

Risk if Unmet:
- Private views leak TeamSpace data or offer invalid actions.

Acceptance Criteria
1. Private parent grouping shows only eligible private parents.
2. Team projects and assignees do not appear in private-only options.
3. Valid private labels and private custom properties remain available.

Negative Cases
1. Grouping by task in a private board must not show TeamSpace parents.

### REQ-PROJECT-001: Project View Parity And Legacy Settings Removal
Source Design Decisions:
- DES-007
- DES-009

Priority: High

Rationale:
- Project detail currently bypasses the shared work surface and shows the reported legacy settings button.

Requirement:
- THE system SHALL make project item views consume the shared work-view semantics and remove `ViewConfigPopover` from project item views unless a new approved settings flow replaces it.

Verification Method:
- Project detail component tests, project view domain tests, and browser smoke.

Risk if Unmet:
- Fixes still miss project item views.

Acceptance Criteria
1. Team and workspace project item views follow shared filtering/grouping/taxonomy semantics.
2. Saved project views and project presentation defaults remain compatible.
3. The legacy settings button is absent from project item viewbar.

Negative Cases
1. Project detail must not keep a separate grouping rule that differs from `WorkSurface`.

### REQ-LAYOUT-PARITY-001: List, Board, Calendar, Timeline Parity
Source Design Decisions:
- DES-007

Priority: High

Rationale:
- The user explicitly extended the work to every layout.

Requirement:
- THE system SHALL feed list, board, calendar, and timeline from the same eligible and matched item result for a given view config.

Verification Method:
- Component tests and browser smoke for representative layouts.

Risk if Unmet:
- Switching layout changes the business result set.

Acceptance Criteria
1. The same eligible items feed all four layouts.
2. Layout-specific differences are limited to presentation.
3. Calendar/timeline do not bypass no-grouping, taxonomy, or private scope rules.

Negative Cases
1. An item visible in board for a config must not disappear in list/calendar/timeline for the same config unless the layout explicitly cannot render that item and records the reason.

### REQ-CONFIG-001: View Config Compatibility
Source Design Decisions:
- DES-005
- DES-006
- DES-010

Priority: High

Rationale:
- Grouping state is stored in several places and can drift.

Requirement:
- THE system SHALL keep view config contracts aligned across domain types, schemas, Convex handlers, store slices, viewer overrides, project presentation state, and local fallback views.

Verification Method:
- Typecheck, schema tests, Convex tests, store tests, and old/new fixture tests.

Risk if Unmet:
- Config changes work in one path and fail in another after refresh or persistence.

Acceptance Criteria
1. Old records normalize safely.
2. New no-grouping and tri-state state persists and resets correctly.
3. Invalid combinations are rejected or normalized at an authoritative boundary.

Negative Cases
1. An optimistic local no-grouping update must not be lost when the server response arrives.

### REQ-TEST-001: Regression Fitness Functions
Source Design Decisions:
- DES-011

Priority: High

Rationale:
- Current tests are too narrow for this failure class.

Requirement:
- THE system SHALL include regression tests that exercise the full behavior matrix and high-risk negative cases.

Verification Method:
- Focused Vitest suites and browser smoke records.

Risk if Unmet:
- Future edits can regress sibling surfaces.

Acceptance Criteria
1. Domain, component, store, and Convex tests cover the changed invariants.
2. Negative cases cover parent override, private leakage, hidden empty groups, no grouping, and child disappearance.
3. Browser smoke covers representative view paths unless recorded unavailable.

Negative Cases
1. Tests must not rely only on helper internals while public view behavior is untested.

### REQ-FALLOW-001: Fallow Final Gate
Source Design Decisions:
- DES-011

Priority: High

Rationale:
- This transition touches shared TypeScript/React architecture.

Requirement:
- THE system SHALL run `pnpm fallow:gate` after all implementation slices and triage any result through ownership and architecture standards.

Verification Method:
- Fallow command output recorded in `.spec/work-view-consistency/reviews.md`.

Risk if Unmet:
- Refactor debt, dead-code, or duplication can be introduced unnoticed.

Acceptance Criteria
1. `pnpm fallow:gate` result is recorded.
2. Failures are fixed or accepted with owner, reason, and revisit trigger.

Negative Cases
1. Do not create test-only production exports to satisfy coverage or health pressure.

### REQ-REVIEW-001: Deep-First Review Loop
Source Design Decisions:
- DES-011

Priority: High

Rationale:
- The user required deep review after every slice and final deep review after Fallow.

Requirement:
- THE system SHALL complete a deep-first `diff-review` loop with `architecture-standards` after each slice and after final Fallow.

Verification Method:
- Review entries in `.spec/work-view-consistency/reviews.md`.

Risk if Unmet:
- Broad changes can hide subtle regressions.

Acceptance Criteria
1. Each slice records validation, findings, fixes, architecture decisions, spec drift decisions, requirement audit, and residual risk.
2. Final total-diff deep review runs after Fallow and loops until clean.

Negative Cases
1. A slice cannot be marked complete while a live High/Critical review finding remains.

## Traceability Matrix
- DES-001 -> REQ-AUDIT-001, REQ-ELIGIBILITY-001, REQ-EMPTY-GROUPS-001
- DES-002 -> REQ-AUDIT-001, REQ-ELIGIBILITY-001, REQ-FILTER-001, REQ-HIERARCHY-001
- DES-003 -> REQ-AUDIT-001, REQ-FILTER-001, REQ-HIERARCHY-001
- DES-004 -> REQ-TAXONOMY-001
- DES-005 -> REQ-GROUPING-001, REQ-CONFIG-001
- DES-006 -> REQ-TRISTATE-001, REQ-CONFIG-001
- DES-007 -> REQ-EMPTY-GROUPS-001, REQ-PROJECT-001, REQ-LAYOUT-PARITY-001
- DES-008 -> REQ-ELIGIBILITY-001, REQ-PRIVATE-001
- DES-009 -> REQ-PROJECT-001
- DES-010 -> REQ-GROUPING-001, REQ-TRISTATE-001, REQ-CONFIG-001
- DES-011 -> REQ-AUDIT-001, REQ-TEST-001, REQ-FALLOW-001, REQ-REVIEW-001
