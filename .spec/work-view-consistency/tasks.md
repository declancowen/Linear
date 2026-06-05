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

# Tasks: Work View Consistency

## Source Artifacts
- `.spec/work-view-consistency/design.md`
- `.spec/work-view-consistency/requirements.md`
- `.spec/work-view-consistency/reviews.md`
- Original user reports and process requirements from 2026-06-05.

## Gating Status
- Status: ready.
- Open decisions: none.
- Runtime edits may begin only with task 0.1, because the behavior matrix is the guardrail for the rest of the transition.
- If a critical auth, data-model, public-contract, or rollout decision appears during implementation, pause implementation and update the package before continuing.

## Execution Status Summary
- To do: none.
- In progress: none.
- Completed: 0.1, 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1, 99.1.
- Deferred: none.
- Blocked: none.

## Sequencing Notes
- Run tasks in numeric order unless the review ledger records a justified architecture reason to reorder.
- Task 0.1 is mandatory before runtime behavior changes because user symptoms need reproduction or evidence-backed classification.
- Contract work comes before domain/model adoption so no-grouping and tri-state state have one durable shape.
- Domain-owned semantics come before renderer migration so list, board, calendar, timeline, private views, and project views can consume one source of truth.
- Each implementation slice must close its own validation and review loop before the next slice starts.

## Implementation Authority And Review Loop
- The original user request is authoritative for product outcome.
- `architecture-standards` is authoritative for ownership, dependency direction, source of truth, compatibility, verification, and transition safety.
- Live repo behavior and tests are authoritative for current reality.
- This spec is guidance and must be updated if implementation evidence shows drift.

## Blocking Work
- No blocking spikes are open.
- Potential future blockers: unresolved public representation for no primary grouping, incompatible saved view data, private visibility ambiguity, or product ambiguity for calendar/timeline tri-state group affordances.
- If any future blocker appears, record it in `.spec/work-view-consistency/reviews.md`, add a blocking spike, and update design, requirements, and tasks before continuing.

## Tasks

- [x] 0. Current-state audit and reproduction matrix
  - [x] 0.1 Build the work-view behavior matrix and focused reproduction fixtures
    - Status: completed
    - Depends on: none
    - Linked requirements: REQ-AUDIT-001, REQ-TEST-001, REQ-REVIEW-001
    - Likely areas: `tests/lib/domain/view-item-level.test.ts`, `tests/components/work-surface.test.tsx`, `tests/components/work-surface-view.test.tsx`, `tests/lib/domain/project-views.test.ts`, `.spec/work-view-consistency/reviews.md`
    - Validation: focused tests or documented reproduction notes for every user-observed symptom and sibling risk.
    - Exit criteria: matrix records scope/layout/hierarchy/grouping/filter/taxonomy/private/project cases and identifies which cases currently fail.
    - Rollback impact: test-only and review-ledger changes can be reverted without runtime behavior impact.
    - Blocking unknowns: none before starting; fixture setup may uncover missing factories or data builders.
    - Pre-implementation context check: re-read DES-001, DES-002, DES-003, DES-011, REQ-AUDIT-001, REQ-TEST-001, REQ-REVIEW-001, original user reports, current tests, and `.spec/work-view-consistency/reviews.md`.
    - Test creation review: classify every fixture as current-state proof, expected product behavior, or product-conflicting legacy behavior.
    - Slice review loop: apply the Global Slice Review Loop with a deep diff-review before moving to task 1.1.
    - Post-implementation review: record reproduced symptoms, unreproduced symptoms, sibling risks, validation output, and review findings in `.spec/work-view-consistency/reviews.md`.
    - Spec drift check: update design and requirements if the matrix proves a symptom belongs to another owner or an additional surface.
    - _Requirements: REQ-AUDIT-001, REQ-TEST-001, REQ-REVIEW-001_

- [x] 1. View config contract and compatibility
  - [x] 1.1 Make no primary grouping representable across types, schemas, store, Convex, and viewer overrides
    - Status: completed
    - Depends on: 0.1
    - Linked requirements: REQ-GROUPING-001, REQ-CONFIG-001, REQ-REVIEW-001
    - Likely areas: `lib/domain/types-internal/primitives.ts`, `lib/domain/types-internal/models.ts`, `lib/domain/types-internal/schemas.ts`, `convex/app/view_handlers.ts`, `lib/store/app-store-internal/slices/views.ts`, `lib/store/app-store-internal/slices/ui.ts`, `lib/domain/viewer-view-config.ts`, `components/app/screens/helpers.ts`
    - Validation: typecheck plus tests for schema parse, create/update view handlers, optimistic pending reconciliation, viewer overrides, and old saved view loading.
    - Exit criteria: no-grouping is a first-class contract and existing grouped views remain compatible.
    - Rollback impact: persisted contract edits require compatibility notes and a rollback path that still loads old grouped view records.
    - Blocking unknowns: public no-grouping representation must be selected before editing; choose `null` or a serialized sentinel based on schema and persistence compatibility.
    - Pre-implementation context check: re-read DES-005, DES-010, REQ-GROUPING-001, REQ-CONFIG-001, REQ-REVIEW-001, current view types, schemas, Convex handlers, store slices, viewer overrides, and review ledger.
    - Test creation review: add old-record and new-record fixtures before relying on UI tests.
    - Slice review loop: apply the Global Slice Review Loop with a deep diff-review before moving to task 2.1.
    - Post-implementation review: record chosen representation, compatibility behavior, validation output, and review findings in `.spec/work-view-consistency/reviews.md`.
    - Spec drift check: update design, requirements, and tasks if no grouping needs a wider persisted migration than expected.
    - _Requirements: REQ-GROUPING-001, REQ-CONFIG-001, REQ-REVIEW-001_

- [x] 2. Domain-owned work view model
  - [x] 2.1 Centralize acquisition, matching, hierarchy, grouping, empty groups, and hidden/excluded state behind a shared domain model
    - Status: completed
    - Depends on: 1.1
    - Linked requirements: REQ-ELIGIBILITY-001, REQ-FILTER-001, REQ-HIERARCHY-001, REQ-EMPTY-GROUPS-001, REQ-LAYOUT-PARITY-001, REQ-REVIEW-001
    - Likely areas: `lib/domain/selectors-internal/work-items.ts`, `components/app/screens/work-surface-view.tsx`, `components/app/screens/helpers.ts`
    - Validation: domain matrix tests for base scope, filters, item level, parent filter, parent grouping, assigned descendant lifting, no grouping, and empty groups.
    - Exit criteria: list/board/project callers can consume one normalized model without reimplementing parent/header/empty semantics.
    - Rollback impact: domain model changes affect all work item views and must retain old helper behavior until migrated or covered by compatibility tests.
    - Blocking unknowns: exact module boundary may depend on existing helper coupling discovered while extracting renderer semantics.
    - Pre-implementation context check: re-read DES-001, DES-002, DES-003, DES-007, REQ-ELIGIBILITY-001, REQ-FILTER-001, REQ-HIERARCHY-001, REQ-EMPTY-GROUPS-001, REQ-LAYOUT-PARITY-001, and current selector/rendering code.
    - Test creation review: include parent/child property disagreement, parent header promotion, stale parent references, and empty lane cases.
    - Slice review loop: apply the Global Slice Review Loop with a deep diff-review before moving to task 3.1.
    - Post-implementation review: record ownership moves, retained temporary compatibility code, validation output, and review findings in `.spec/work-view-consistency/reviews.md`.
    - Spec drift check: update requirements if eligibility or hierarchy modes need finer-grained named contracts.
    - _Requirements: REQ-ELIGIBILITY-001, REQ-FILTER-001, REQ-HIERARCHY-001, REQ-EMPTY-GROUPS-001, REQ-LAYOUT-PARITY-001, REQ-REVIEW-001_

- [x] 3. Taxonomy and level options
  - [x] 3.1 Replace hardcoded/presence-only level and type option generation with an authoritative taxonomy provider
    - Status: completed
    - Depends on: 2.1
    - Linked requirements: REQ-TAXONOMY-001, REQ-PRIVATE-001, REQ-CONFIG-001, REQ-REVIEW-001
    - Likely areas: `components/app/screens/work-surface-controls.tsx`, `components/app/screens/work-grouping-labels.ts`, `lib/domain/types-internal/work.ts`, `lib/domain/default-views.ts`, `tests/components/group-chip-popover.test.tsx`
    - Validation: tests for issue/sub-issue, task/subtask, software-development levels, mixed workspace experience, project template fallback, private task levels, and `My Items`.
    - Exit criteria: filters and level controls expose the correct taxonomy consistently and do not depend solely on currently visible items.
    - Rollback impact: taxonomy changes can affect filter menus and grouping labels across personal, team, workspace, project, and private views.
    - Blocking unknowns: existing canonical type/level source may be incomplete and may require a small new domain provider.
    - Pre-implementation context check: re-read DES-004, REQ-TAXONOMY-001, REQ-PRIVATE-001, REQ-CONFIG-001, current level popover logic, grouping labels, default views, and project template types.
    - Test creation review: cover valid options even when no currently visible item has that level.
    - Slice review loop: apply the Global Slice Review Loop with a deep diff-review before moving to task 4.1.
    - Post-implementation review: record taxonomy source of truth, validation output, and review findings in `.spec/work-view-consistency/reviews.md`.
    - Spec drift check: update design if taxonomy ownership belongs somewhere more specific than initially identified.
    - _Requirements: REQ-TAXONOMY-001, REQ-PRIVATE-001, REQ-CONFIG-001, REQ-REVIEW-001_

- [x] 4. WorkSurface adoption and layout parity
  - [x] 4.1 Migrate `WorkSurface`, board, list, calendar, and timeline to consume shared model outputs
    - Status: completed
    - Depends on: 3.1
    - Linked requirements: REQ-LAYOUT-PARITY-001, REQ-HIERARCHY-001, REQ-EMPTY-GROUPS-001, REQ-GROUPING-001, REQ-REVIEW-001
    - Likely areas: `components/app/screens/work-surface.tsx`, `components/app/screens/work-surface-view.tsx`, `components/app/screens/work-surface-view/calendar-view.tsx`, `components/app/screens/work-surface-view/timeline-view.tsx`
    - Validation: component tests for list/board parity, calendar/timeline item parity, no grouping, empty groups, hidden/excluded groups, and child display behavior.
    - Exit criteria: all four layouts use the same eligible/matched item set for a given view config.
    - Rollback impact: renderer migration affects visible work views and must preserve drag/drop, create defaults, and inline property editing behavior.
    - Blocking unknowns: calendar/timeline may need explicit product handling for group metadata that has no visible lane UI.
    - Pre-implementation context check: re-read DES-007, REQ-LAYOUT-PARITY-001, REQ-HIERARCHY-001, REQ-EMPTY-GROUPS-001, REQ-GROUPING-001, current layout components, and task 2.1 model output.
    - Test creation review: assert the same item ids feed list, board, calendar, and timeline for matched fixture configs.
    - Slice review loop: apply the Global Slice Review Loop with a deep diff-review before moving to task 5.1.
    - Post-implementation review: record layout parity evidence, validation output, and review findings in `.spec/work-view-consistency/reviews.md`.
    - Spec drift check: update requirements if a layout has a documented inability to render a class of item.
    - _Requirements: REQ-LAYOUT-PARITY-001, REQ-HIERARCHY-001, REQ-EMPTY-GROUPS-001, REQ-GROUPING-001, REQ-REVIEW-001_

- [x] 5. Private and scope isolation
  - [x] 5.1 Move private/team/workspace/project option filtering and leakage prevention into shared scope semantics
    - Status: completed
    - Depends on: 4.1
    - Linked requirements: REQ-PRIVATE-001, REQ-ELIGIBILITY-001, REQ-FILTER-001, REQ-REVIEW-001
    - Likely areas: `lib/domain/selectors-internal/work-items.ts`, `components/app/screens/work-surface.tsx`, `components/app/screens/work-surface-controls.tsx`, `components/app/screens/shared.tsx`
    - Validation: tests for private parent grouping, private task grouping by task, team parent leakage prevention, private label/custom property options, and personal assigned/private combinations.
    - Exit criteria: private views do not leak TeamSpace grouping entities and still allow valid private task workflows.
    - Rollback impact: private isolation failures are privacy-sensitive; rollback must preserve or improve current private leakage prevention.
    - Blocking unknowns: private relationship rules may need clarification if team-linked projects intentionally appear in personal non-private views.
    - Pre-implementation context check: re-read DES-008, REQ-PRIVATE-001, REQ-ELIGIBILITY-001, REQ-FILTER-001, current private compatibility code, private label/custom-property helpers, and project/team option derivation.
    - Test creation review: include negative fixtures for TeamSpace parents in private task group options.
    - Slice review loop: apply the Global Slice Review Loop with a deep diff-review before moving to task 6.1.
    - Post-implementation review: record private-scope invariants, validation output, and review findings in `.spec/work-view-consistency/reviews.md`.
    - Spec drift check: update design if private mode needs a separate named scope profile rather than a flag on the shared model.
    - _Requirements: REQ-PRIVATE-001, REQ-ELIGIBILITY-001, REQ-FILTER-001, REQ-REVIEW-001_

- [x] 6. Project item view convergence
  - [x] 6.1 Align project item views with shared work-view semantics and remove the legacy settings button
    - Status: completed
    - Depends on: 5.1
    - Linked requirements: REQ-PROJECT-001, REQ-LAYOUT-PARITY-001, REQ-CONFIG-001, REQ-REVIEW-001
    - Likely areas: `components/app/screens/project-detail-screen.tsx`, `components/app/screens/work-surface.tsx`, `components/app/screens/work-surface-controls.tsx`, `tests/lib/domain/project-views.test.ts`
    - Validation: project detail tests for no legacy `ViewConfigPopover`, saved project view config, project presentation defaults, team/workspace project routes, grouping/no-grouping, and filters.
    - Exit criteria: project item views behave like other work views and no longer show the legacy settings button.
    - Rollback impact: project item views are user-facing; rollback must preserve project route rendering and saved project presentation config compatibility.
    - Blocking unknowns: implementation must decide whether project detail calls `WorkSurface` directly or consumes shared domain/control primitives.
    - Pre-implementation context check: re-read DES-007, DES-009, REQ-PROJECT-001, REQ-LAYOUT-PARITY-001, REQ-CONFIG-001, project routes, project detail screen, project view tests, and shared work surface APIs.
    - Test creation review: add assertions that project detail does not render `ViewConfigPopover` and uses shared semantics for grouping/filtering.
    - Slice review loop: apply the Global Slice Review Loop with a deep diff-review before moving to task 7.1.
    - Post-implementation review: record convergence path, removed legacy path, validation output, and review findings in `.spec/work-view-consistency/reviews.md`.
    - Spec drift check: update design if project detail has a justified project-only semantic that must remain explicit.
    - _Requirements: REQ-PROJECT-001, REQ-LAYOUT-PARITY-001, REQ-CONFIG-001, REQ-REVIEW-001_

- [x] 7. Tri-state group include/exclude
  - [x] 7.1 Implement normal/include-only/exclude group state across saved and viewer-local config
    - Status: completed
    - Depends on: 6.1
    - Linked requirements: REQ-TRISTATE-001, REQ-CONFIG-001, REQ-EMPTY-GROUPS-001, REQ-REVIEW-001
    - Likely areas: `lib/domain/selectors-internal/work-items.ts`, `components/app/screens/work-surface-view.tsx`, `components/app/screens/work-surface-controls.tsx`, `lib/store/app-store-internal/slices/views.ts`, `lib/store/app-store-internal/slices/ui.ts`, `convex/app/view_handlers.ts`
    - Validation: tests for first-click include, second-click exclude/`X`, reset/clear, saved view persistence, viewer override persistence, hidden empty groups, and list/board parity.
    - Exit criteria: group/status controls provide the requested tri-state behavior without conflicting with existing hidden-group controls.
    - Rollback impact: config and UI state changes affect saved and viewer-local view state; rollback must normalize or ignore new state safely.
    - Blocking unknowns: storage shape for include/exclude state and relationship to existing `hiddenState` must be chosen before editing.
    - Pre-implementation context check: re-read DES-006, DES-010, REQ-TRISTATE-001, REQ-CONFIG-001, REQ-EMPTY-GROUPS-001, current hidden group handling, store patches, Convex handlers, and renderer click logic.
    - Test creation review: include conflicting-state negative tests where a group cannot be both include-only and excluded.
    - Slice review loop: apply the Global Slice Review Loop with a deep diff-review before moving to task 8.1.
    - Post-implementation review: record tri-state state machine, persistence behavior, validation output, and review findings in `.spec/work-view-consistency/reviews.md`.
    - Spec drift check: update requirements if tri-state behavior is narrower or broader than group/status chips.
    - _Requirements: REQ-TRISTATE-001, REQ-CONFIG-001, REQ-EMPTY-GROUPS-001, REQ-REVIEW-001_

- [x] 8. Cross-surface regression hardening
  - [x] 8.1 Complete behavior matrix tests, browser smoke, and compatibility checks
    - Status: completed
    - Depends on: 7.1
    - Linked requirements: REQ-AUDIT-001, REQ-TEST-001, REQ-LAYOUT-PARITY-001, REQ-REVIEW-001
    - Likely areas: `tests/lib/domain/view-item-level.test.ts`, `tests/components/work-surface.test.tsx`, `tests/components/work-surface-view.test.tsx`, `tests/lib/domain/project-views.test.ts`, `tests/convex/view-handlers.test.ts`
    - Validation: targeted Vitest suites, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and browser smoke for representative views unless unavailable and recorded.
    - Exit criteria: every matrix row is tested, explicitly out of scope, or recorded as residual risk with owner and follow-up.
    - Rollback impact: hardening changes are mostly tests and small compatibility fixes; any runtime fix must record rollback impact in the review entry.
    - Blocking unknowns: local browser smoke may require a running app and seed data availability.
    - Pre-implementation context check: re-read REQ-AUDIT-001, REQ-TEST-001, REQ-LAYOUT-PARITY-001, matrix from task 0.1, and every review entry from tasks 1.1 through 7.1.
    - Test creation review: prove public view behavior through component/browser paths, not only helper internals.
    - Slice review loop: apply the Global Slice Review Loop with a deep diff-review before moving to task 9.1.
    - Post-implementation review: record matrix coverage, full validation output, browser smoke evidence or gap, and review findings in `.spec/work-view-consistency/reviews.md`.
    - Spec drift check: update design or requirements for any matrix row intentionally left as residual risk.
    - _Requirements: REQ-AUDIT-001, REQ-TEST-001, REQ-LAYOUT-PARITY-001, REQ-REVIEW-001_

- [x] 9. Fallow and final architecture review
  - [x] 9.1 Run Fallow, fix/triage findings, and complete final total-diff review loop
    - Status: completed
    - Depends on: 8.1
    - Linked requirements: REQ-FALLOW-001, REQ-REVIEW-001, REQ-TEST-001
    - Likely areas: `.spec/work-view-consistency/reviews.md`, `.audits/fallow-static-audit-2026-05-01.md`
    - Validation: `pnpm fallow:gate`, full relevant tests, `pnpm typecheck`, `pnpm lint`, `pnpm build`, browser smoke evidence or explicit gap.
    - Exit criteria: Fallow is clean or findings are fixed/accepted with owner and revisit trigger; final deep total-diff review and normal clean-loop re-reviews are recorded clean.
    - Rollback impact: Fallow-driven cleanup must not change product behavior without tests; any cleanup rollback must preserve completed behavior matrix invariants.
    - Blocking unknowns: Fallow may reveal unrelated findings that require owner triage rather than blind broad refactoring.
    - Pre-implementation context check: re-read REQ-FALLOW-001, REQ-REVIEW-001, REQ-TEST-001, Fallow skill guidance, architecture standards, and every prior review entry.
    - Test creation review: do not create test-only production exports or shallow wrappers to appease static analysis.
    - Slice review loop: this is the final review loop; run deep total-diff review after Fallow, fix findings, rerun normal full-worktree diff reviews until clean, and record all outcomes in `.spec/work-view-consistency/reviews.md`.
    - Post-implementation review: record Fallow output, fixed or accepted findings, final deep review, clean-loop review passes, and residual risk.
    - Spec drift check: update all spec files if Fallow or review findings expose missing architecture work.
    - _Requirements: REQ-FALLOW-001, REQ-REVIEW-001, REQ-TEST-001_

- [x] 99. Final prompt and requirements audit
  - [x] 99.1 Audit implementation against the original request, spec, architecture standards, and review ledger
    - Status: completed
    - Depends on: 9.1
    - Linked requirements: REQ-AUDIT-001, REQ-ELIGIBILITY-001, REQ-FILTER-001, REQ-HIERARCHY-001, REQ-TAXONOMY-001, REQ-GROUPING-001, REQ-TRISTATE-001, REQ-PRIVATE-001, REQ-PROJECT-001, REQ-CONFIG-001, REQ-TEST-001, REQ-FALLOW-001, REQ-REVIEW-001
    - Likely areas: `.spec/work-view-consistency/design.md`, `.spec/work-view-consistency/requirements.md`, `.spec/work-view-consistency/tasks.md`, `.spec/work-view-consistency/reviews.md`
    - Validation: final requirements traceability audit, spec drift check, review ledger audit, and final user-facing summary.
    - Exit criteria: no original requirement is missing, all intentional deviations are recorded, and the final review ledger is clean.
    - Rollback impact: final audit is documentation and verification; any discovered runtime rollback work must be added as a concrete task before closure.
    - Blocking unknowns: none expected after task 9.1; unresolved items become recorded residual risk only with owner and revisit trigger.
    - Pre-implementation context check: re-read the original user request, all DES/REQ records, all completed tasks, architecture standards, Fallow output, and review ledger.
    - Test creation review: no new tests expected unless the audit finds an untested requirement.
    - Slice review loop: run the final audit after task 9.1 is clean; if drift is found, update design, requirements, and tasks before closing.
    - Post-implementation review: record final requirement-by-requirement outcome and any accepted residual risk in `.spec/work-view-consistency/reviews.md`.
    - Spec drift check: final spec must match the implemented code and review evidence before the work is closed.
    - _Requirements: REQ-AUDIT-001, REQ-ELIGIBILITY-001, REQ-FILTER-001, REQ-HIERARCHY-001, REQ-TAXONOMY-001, REQ-GROUPING-001, REQ-TRISTATE-001, REQ-PRIVATE-001, REQ-PROJECT-001, REQ-CONFIG-001, REQ-TEST-001, REQ-FALLOW-001, REQ-REVIEW-001_

## Post-Deploy Verification
- Verify `My Items`, `All Issues`, TeamSpace work views, TeamSpace project views, workspace project views, project detail item views, and private task views.
- Verify list, board, calendar, and timeline against the same behavior matrix.
- Verify no-grouping, status grouping, parent grouping, highest-parent grouping, empty-group visibility, group include/exclude clicks, taxonomy options, and private isolation.
- Record browser smoke evidence or explicit environment gaps in `.spec/work-view-consistency/reviews.md`.

## Traceability Matrix
- REQ-AUDIT-001 -> 0.1, 8.1, 99.1
- REQ-ELIGIBILITY-001 -> 2.1, 5.1, 99.1
- REQ-FILTER-001 -> 2.1, 5.1, 99.1
- REQ-HIERARCHY-001 -> 2.1, 4.1, 99.1
- REQ-TAXONOMY-001 -> 3.1, 99.1
- REQ-GROUPING-001 -> 1.1, 4.1, 99.1
- REQ-TRISTATE-001 -> 7.1, 99.1
- REQ-PRIVATE-001 -> 3.1, 5.1, 99.1
- REQ-PROJECT-001 -> 6.1, 99.1
- REQ-CONFIG-001 -> 1.1, 3.1, 6.1, 7.1, 99.1
- REQ-TEST-001 -> 0.1, 8.1, 9.1, 99.1
- REQ-FALLOW-001 -> 9.1, 99.1
- REQ-REVIEW-001 -> 0.1, 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1, 99.1

## Coverage Checklist
- [x] Original user reports mapped to behavior matrix.
- [ ] Architecture ownership recorded for every slice.
- [x] No primary grouping represented in every config path.
- [ ] Parent/child filter and grouping semantics tested.
- [ ] Taxonomy options include issue/sub-issue, task/subtask, and software-development levels.
- [ ] Private views do not leak TeamSpace grouping entities.
- [ ] Project item views use shared semantics and omit the legacy settings button.
- [ ] List, board, calendar, and timeline consume the same eligible/matched result.
- [ ] Tri-state group include/exclude behavior persists or resets through the chosen contract.
- [ ] Fallow final gate recorded.
- [ ] Deep-first diff-review loop recorded after every slice and after final Fallow.
