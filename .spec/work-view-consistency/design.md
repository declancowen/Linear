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

# Design Document: Work View Consistency

## Summary
- This spec records an under-the-hood audit and remediation plan for inconsistent work item view behavior across `My Items`, `All Issues`, TeamSpace work views, TeamSpace project views, project item views, and private task views.
- The visible reports point to scattered eligibility, filtering, grouping, hierarchy, taxonomy, empty-group, hidden-group, and scope rules.
- The target state is a domain-owned work-view model that computes shared business semantics once, then feeds list, board, calendar, and timeline renderers.

## Scope Statement
- In scope: work item eligibility, view matching, parent/child hierarchy behavior, grouping, no grouping, hidden/excluded group state, empty groups, level/type taxonomy, private scope isolation, project item views, saved view config, viewer overrides, local fallback views, and Convex view handlers.
- In scope: list, board, calendar, and timeline parity for the same view config.
- In scope: the legacy project item settings button currently rendered by `ViewConfigPopover`.
- Out of scope: unrelated project-list views, docs views, chat, release packaging, and new product surfaces that do not consume work item views.
- This package is implementation-ready, but task 0.1 must create the behavior matrix and reproduction fixtures before runtime architecture edits begin.

## Original Plan Alignment Audit
- Original plan or prompt excerpts reviewed: user reports from 2026-06-05 about broken boards/views, missing sub-issues/subtasks, private parent leakage, no grouping, empty-group failures, parent/child property override, legacy project settings, and tri-state group clicks.
- Explicit requirements confirmed from the original plan: all work item view scopes and all four layouts must be audited; business logic should be centralized where duplicated; `architecture-standards`, `spec-driven-development`, `diff-review`, and `fallow` are mandatory.
- Plan items excluded or deferred, with reason: none from the requested view-consistency scope.
- Gaps, contradictions, or stale assumptions found: user symptoms are not yet reproduced in fixtures; current tests encode some behaviors that may now be product-wrong.
- Upstream artifact changes required before continuing: none.
- Architecture standards reviewed: current-state diagnosis, target-state design, enforcement patterns, and transition planning.
- Agent judgment or justified architecture-standard deviations: none.
- Post-design audit outcome: design is ready to drive traceable requirements and implementation slices.

## Repository Discovery Summary

### Repo Root
- `/Users/declancowen/Documents/GitHub/Linear`

### Repo-Specific Profile and House Patterns
- Existing specs live under `.spec` and use frontmatter plus separate design, requirements, tasks, and reviews files.
- No shared repo profile exists under the shared spec profile directory, so this package records the relevant local profile.
- App stack is Next.js, React, Convex, Zustand, Vitest, and Fallow.
- UI surfaces live under `components/app/screens`; domain selectors live under `lib/domain`; optimistic store work lives under `lib/store/app-store-internal`; Convex authority lives under `convex/app`.

### Entry Points and Execution Path
- `app/(workspace)/assigned/page.tsx` renders `AssignedScreen`.
- `app/(workspace)/workspace/items/page.tsx` renders `WorkspaceItemsScreen`.
- `app/(workspace)/team/[teamSlug]/work/page.tsx` renders `TeamWorkScreen`.
- Project item routes render `ProjectDetailScreen`.
- `components/app/screens.tsx` acquires scoped items/views and passes them into `WorkSurface`.
- `components/app/screens/work-surface.tsx` resolves active views, fallback views, viewer overrides, group options, filter items, and visible items.
- `components/app/screens/work-surface-view.tsx` renders list/board and currently owns parent group header promotion, hidden group chips, group create defaults, and some selection semantics.
- `components/app/screens/project-detail-screen.tsx` renders a separate project item viewbar/body and currently includes `ViewConfigPopover`.
- `lib/domain/selectors-internal/work-items.ts` owns current item matching, child display helpers, and group construction.
- `convex/app/view_handlers.ts`, store slices, and schemas own persisted and optimistic view config.

### Confirmed Code and Runtime Facts
- `getVisibleWorkItems` handles initial team, workspace, assigned, and assigned-with-ancestors acquisition.
- `getVisibleItemsForView` filters items and collapses no-level work views to root items when no item-type or parent filter is active.
- `itemMatchesView` applies parent filters by walking ancestors.
- `getDirectChildWorkItemsForDisplay` supports direct children and assigned-descendant compression.
- `buildItemGroupsWithEmptyGroups` synthesizes empty groups and source lanes.
- Primary grouping is currently required by `ViewDefinition`, `ProjectPresentationConfig`, schemas, Convex handler arg types, store patches, and viewer overrides.
- `GroupChipPopover` has no primary `None`; it only has `None` for sub-grouping.
- `LevelChipPopover` hardcodes `My Items` parent groups and private task level options.
- `ProjectDetailScreen` bypasses `WorkSurface` for project item rendering and shows `ViewConfigPopover`.

### Related Code and Pattern Inventory
- Related domain tests: `tests/lib/domain/view-item-level.test.ts`, `tests/lib/domain/default-views.test.ts`, `tests/lib/domain/project-views.test.ts`.
- Related component tests: `tests/components/work-surface.test.tsx`, `tests/components/work-surface-view.test.tsx`, `tests/components/group-chip-popover.test.tsx`.
- Related store/tests: `tests/lib/store/viewer-view-config.test.ts`, `tests/lib/store/view-slice.test.ts`.
- Related Convex tests: `tests/convex/view-handlers.test.ts`.
- Related review evidence: `.reviews/work-surface-and-desktop-release.md` and `.reviews/post-merge-work-surface-followups.md`.

### Adjacent Pattern Comparison
- Shared work surfaces use `WorkSurface`; project item detail uses custom viewbar/body logic.
- Saved views persist through Convex; viewer-local overrides persist through Zustand UI state.
- Private task compatibility is currently applied in `WorkSurface` and controls, not as one shared scope rule.
- Parent grouping was recently reviewed as a presentation/domain split, but user reports show the current split is not holding across all surfaces.

### Blast Radius Review
- Direct blast radius: domain selectors, view config types/schemas, Convex handlers, store slices, controls, list/board rendering, calendar/timeline input, project detail, and tests.
- Indirect blast radius: create defaults, drag/drop group updates, inline property controls, viewer config persistence, fallback `My Items` views, and project presentation defaults.
- User-facing blast radius: item disappearance, wrong status lanes, wrong level options, private leakage, incorrect group visibility, and project view controls.

### Recent Related Repository History
- Recent commits include `6e02a9ec Fix backlog regressions and scoped read model costs`, `9c5c7793 Implement workspace surface stability spec`, and work-surface review ledgers from late May.
- Prior reviews resolved parent grouping and empty lane issues, but current user reports show more sibling paths remain.
- Current branch is `main` at `babe4ce7` with no pre-existing dirty runtime changes observed before this spec package.

### Impacted Boundaries and Adjacent Systems
- Presentation: work surface, project detail, controls, list, board, calendar, timeline.
- Domain: item acquisition, matching, hierarchy, grouping, taxonomy, empty groups, and scope semantics.
- Data/config: saved views, project presentation config, viewer overrides, hidden state, filters.
- API/backend: Convex view create/update/toggle handlers and schema validation.
- Operations: Fallow and diff-review gates.

### Data, Contracts, and Config Surfaces
- `ViewDefinition`, `ViewConfigPatch`, `CreateViewInput`, `ViewerViewConfigOverride`, `ProjectPresentationConfig`.
- Zod view and project schemas.
- Convex view handler args and persisted view rows.
- Zustand persisted UI viewer config and pending view config reconciliation.
- Local fallback views built for assigned work.

### Existing Tests and Operational Signals
- Tests already cover item levels, parent filters, parent grouping, assigned-descendant lifting, default/project views, private task view compatibility, and group chips.
- Current Fallow configured gate is clean.
- Browser smoke is not yet run for this task because no runtime implementation has been done.

### Static Analyzer and Audit Evidence
- Relevant audit/review artifacts: `.audits/fallow-static-audit-2026-05-01.md`, `.reviews/work-surface-and-desktop-release.md`, `.reviews/post-merge-work-surface-followups.md`.
- Analyzer commands, HEAD, date, mode, scope, baseline/gate, and result: `pnpm fallow:gate`, `babe4ce7`, 2026-06-05, configured repo gate, passed with dead-code `0`, production health findings `0`, duplication `0`.
- Gate versus advisory inventory distinction: configured gate is clean; this transition is behavior/ownership-driven rather than Fallow-finding-driven.
- CI parity and accepted-debt status: local package scripts define the gate; no accepted debt is introduced by this spec.

## Problem Statement and Context
- Users cannot trust work item views because eligible items can disappear, land in the wrong group, expose the wrong taxonomy, or leak wrong-scope parents depending on surface and layout.
- The current architecture lets business rules live in several places, so fixing one renderer or scope can miss another.

## Current-State Analysis
- Acquisition, matching, rendering containers, child disclosure, group synthesis, filter options, private compatibility, and project detail rendering are not owned by one coherent boundary.
- The current persisted contract cannot express no primary grouping.
- Project item views are a major bypass because they do not use the same `WorkSurface` body and expose an extra settings button.
- Existing tests are valuable but incomplete; they verify isolated rules rather than a cross-scope/cross-layout matrix.

## Target-State Architecture
- Intended owner for each durable invariant: domain selectors own eligibility, matching, hierarchy, grouping, taxonomy, scope isolation, empty groups, and group visibility semantics; presentation owns layout; Convex/store own persistence and optimistic sync.
- Dependency direction and public surfaces: UI consumes a shared work-view model; UI must not reimplement eligibility or private-scope business rules.
- Contracts, data ownership, async/reliability, and operational ownership: view config contracts live in domain types/schemas and Convex handlers; optimistic state must reconcile the same contract.
- What must stop happening after the transition: renderers must not decide which business records are eligible, project detail must not bypass shared semantics, and private scope rules must not be presentation-only.
- Fitness functions that prove the target state is holding: behavior matrix tests, schema/store/Convex tests, layout parity tests, Fallow, browser smoke, and deep diff-review.

## Goals
- Find the root causes of inconsistent work item view behavior.
- Centralize shared view business logic.
- Preserve explicit private/project/team differences.
- Add no grouping and tri-state group visibility.
- Make list, board, calendar, and timeline consume the same eligible/matched item model.
- Remove the legacy project item settings button.

## Non-Goals
- Replacing the whole app shell.
- Redesigning unrelated docs/project-list views.
- Changing unrelated collaboration, chat, auth, or release flows.
- Shipping code without per-slice review evidence.

## Confirmed Facts
- Current code has separate paths for shared work surfaces and project item surfaces.
- Current type/schema contracts require primary grouping.
- Current `My Items` level group options are hardcoded.
- Current configured Fallow gate passed on 2026-06-05.

## Assumptions
- The product intent is that eligible items should not disappear because of grouping or layout.
- Private views can differ in available options but should use shared semantics with private-specific scope rules.
- The implementation can add tests before modifying runtime behavior.

## Open Questions
- Exact UI copy and persistence shape for tri-state group state may be decided in task 7.1 after compatibility review.
- Calendar/timeline treatment of group include/exclude may need product judgment if there is no existing visible group UI.

## Decision Needed
- No decision is needed before task 0.1. Task 1.1 must decide the public representation of no primary grouping before editing config contracts.

## Proposed Design

### Solution Overview
- Build a behavior matrix and reproduction fixtures.
- Add a compatible no-grouping contract.
- Introduce or refactor toward a domain-owned work-view model.
- Migrate shared work surface and project item views to consume shared semantics.
- Replace hardcoded taxonomy option logic.
- Implement tri-state group include/exclude.
- Run Fallow and deep review loops.

### Transition Plan From Current State
- Containment gate: no runtime slice may proceed without task 0.1 matrix evidence and per-slice deep diff-review.
- Safe implementation slices: contract, domain model, taxonomy, layout adoption, private scope, project convergence, tri-state interaction, final hardening.
- Old bypasses or compatibility paths to remove: project detail duplicated semantics and legacy `ViewConfigPopover`.
- Baselines, suppressions, allowlists, or module-budget caps that remain temporarily: none introduced.
- Revisit trigger for each accepted exception: any future exception must be recorded in reviews with owner, reason, cap, and revisit trigger.

### End-to-End Flow
- Route/screen acquires scoped source items and views.
- Viewer/saved config is normalized.
- Domain work-view model returns eligible items, matched items, rendered containers, child rows, groups, empty groups, filter options, taxonomy options, and hidden/excluded state.
- Layout renderers receive model output and render list, board, calendar, or timeline.
- Store/Convex persist config changes through the same contract.

### Component and Module Changes

#### UI or Client
- Update work surface controls and renderers to consume shared model data.
- Remove legacy project item settings popover.
- Add no-grouping and tri-state group controls.

#### API or Application Layer
- Update client sync and Convex view config handlers for no grouping and group visibility state.

#### Domain or Business Logic
- Centralize eligibility, hierarchy, filter matching, taxonomy, grouping, empty group, and private scope rules.

#### Data Model and Persistence
- Evolve view config types and schemas compatibly.

#### Integrations, Events, or Background Jobs
- Not directly applicable.

#### Security and Permissions
- Preserve team/workspace/private visibility boundaries and Convex mutation access checks.

#### Performance and Scalability
- Avoid repeated per-render recomputation where the shared model can memoize or reuse indexed maps.

#### Observability and Operations
- Record validation, Fallow, and review results in the spec review ledger.

## Impacted Surfaces Matrix
- UI: `WorkSurface`, board, list, calendar, timeline, project detail, view controls.
- API: Convex view create/update/toggle handlers.
- Domain logic: acquisition, matching, hierarchy, grouping, taxonomy, scope.
- Persistence: saved views, project presentation config, viewer overrides, pending patches.
- Integrations: Convex sync client.
- Auth: team/workspace/private read/edit access and private visibility.
- Infra: local test/build/Fallow gates.
- Telemetry: no new telemetry required initially; review ledger records validation.
- Tests: domain, component, store, Convex, browser smoke.
- Docs: this spec package and review ledger.

## Change Impact Map
- Direct impact: work item view behavior and view config contracts.
- Indirect impact: create defaults, drag/drop grouping, inline properties, fallback views, and project item tabs.
- Unchanged but risk-adjacent areas: docs views, project list views, chat/collaboration, read-model fetching, release packaging.

## Invariants and Forbidden Outcomes
- Eligible items must not disappear because grouping changes.
- Child properties must not be overwritten by parent properties outside explicit hierarchy lifting.
- Private views must not leak TeamSpace grouping entities.
- No primary grouping must be valid wherever grouping is configurable.
- Empty groups must obey the active visibility setting after filters and scope.
- Project item views must not keep a divergent legacy settings path.
- No implementation slice may skip the review ledger.

## Compatibility Matrix
- Public API: no external public API change expected; internal route/mutation payloads must remain compatible.
- Internal API: view config types and helpers may change with compatibility tests.
- Data schema: saved view and project presentation config must normalize old records.
- Events: not applicable.
- Cache keys: viewer scoped keys must remain stable.
- Config: Fallow config remains unchanged unless a later review explicitly approves a policy change.
- External consumers: browser app and desktop renderer consume the same app code.
- Rollback compatibility: old grouped view records must still render if a no-grouping implementation is reverted.

## Contract Examples and Before/After Payloads
- Request examples: before, view update sends `grouping: "status"`; after, no-grouping update sends the chosen explicit no-grouping representation from task 1.1.
- Response examples: before, `ViewDefinition.grouping` is always a `GroupField`; after, normalized view definitions include the chosen no-grouping representation.
- Event or message examples: not applicable.
- Before/after comparisons: before, project detail uses a custom viewbar with `ViewConfigPopover`; after, project detail consumes the shared work-view semantics and omits that legacy button.

## Cross-Cutting Applicability Matrix
- Security: private/team/workspace/project scope rules are high-risk and must be tested.
- Privacy: private task leakage is a primary risk.
- Performance: shared model should avoid additional hot render cost; no broad recomputation without memoization review.
- Resilience: persisted config migration/normalization must tolerate old records.
- Migration: no-grouping and tri-state config need compatibility handling.
- Observability: review ledger records validation; no runtime telemetry required by this spec.
- Supportability: centralized semantics reduce future one-surface fixes.
- Backward compatibility: saved views, viewer overrides, and project presentations must continue to load.

## Success Metrics and Numeric NFR Targets
- Latency targets: no new interaction path should add more than one additional full `workItems` traversal per render without recorded justification.
- Throughput or concurrency targets: not applicable to this client-side/domain transition.
- Error-rate or availability targets: no new runtime errors in representative view navigation; build and typecheck must pass.
- Timeout, retry, or queue-depth limits: not applicable.

## Decision Register

### DES-001: Domain-Owned Work View Model
- Context: view rules are split across domain selectors and renderers.
- Current-state gap: fixes can land in one surface and miss siblings.
- Decision: centralize shared work-view semantics behind a domain model.
- Rationale: a single owner prevents layout/scope drift.
- Tradeoffs: initial refactor touches more code than a local patch.
- Affected surfaces: selectors, work surface, project detail, tests.
- Fitness signal: matrix tests pass across scopes/layouts.

### DES-002: Separate Acquisition, Matching, And Rendering
- Context: parent containers and matched children are currently conflated in places.
- Current-state gap: parent/child property behavior is ambiguous.
- Decision: represent acquisition, matching, and rendered containers separately.
- Rationale: child filters and parent display can be correct at the same time.
- Tradeoffs: model output may be richer than current arrays.
- Affected surfaces: domain selectors and renderers.
- Fitness signal: tests for child status under parent containers.

### DES-003: Explicit Hierarchy Modes
- Context: direct children, assigned descendants, parent filters, and parent grouping have different semantics.
- Current-state gap: one mode can accidentally affect another.
- Decision: name each hierarchy mode and test it independently.
- Rationale: hierarchy is a business rule, not a renderer accident.
- Tradeoffs: more explicit API surface.
- Affected surfaces: `My Items`, parent grouping, child disclosure.
- Fitness signal: hierarchy matrix tests.

### DES-004: Authoritative Taxonomy Provider
- Context: level options are mixed between team experience, project template, current items, and hardcoded groups.
- Current-state gap: sub-issue/subtask options can be missing.
- Decision: add a shared taxonomy option provider.
- Rationale: taxonomy belongs to product/domain rules.
- Tradeoffs: controls become less self-contained.
- Affected surfaces: level chip, filter popover, project views.
- Fitness signal: tests for issue/sub-issue and task/subtask contexts.

### DES-005: No Primary Grouping Contract
- Context: grouping is required today.
- Current-state gap: product requires no grouping.
- Decision: add an explicit no-grouping representation across contracts.
- Rationale: a UI-only fake no-group state would keep persistence drift.
- Tradeoffs: schema/store/Convex compatibility work.
- Affected surfaces: types, schemas, Convex, store, controls, renderers.
- Fitness signal: saved/viewer/project no-grouping tests.

### DES-006: Tri-State Group Visibility
- Context: hidden groups exist, but include-only/exclude click behavior is not coherent.
- Current-state gap: group chips cannot express the requested normal/include/exclude cycle.
- Decision: design one group visibility state model.
- Rationale: filters and hidden state must not fight.
- Tradeoffs: persistence shape needs careful review.
- Affected surfaces: controls, hidden state, domain grouping.
- Fitness signal: first-click/second-click/reset tests.

### DES-007: Surface Parity Through Shared Inputs
- Context: list/board use grouped renderers; calendar/timeline consume filtered item arrays.
- Current-state gap: layout changes can alter behavior.
- Decision: all layouts consume shared eligible/matched model output.
- Rationale: layout should not change business eligibility.
- Tradeoffs: calendar/timeline may need adapters for group state.
- Affected surfaces: all layouts.
- Fitness signal: same item set across layouts.

### DES-008: Scope Isolation Contract
- Context: private compatibility is local UI logic.
- Current-state gap: TeamSpace entities can leak into private grouping/options.
- Decision: make private/team/project scope options domain-owned.
- Rationale: privacy and scope are not just presentation concerns.
- Tradeoffs: more domain inputs are needed.
- Affected surfaces: private views, controls, labels/custom properties.
- Fitness signal: private leakage regression tests.

### DES-009: Project Detail Convergence
- Context: project detail duplicates item view surface code.
- Current-state gap: shared fixes can miss project item views.
- Decision: converge project detail onto shared model or `WorkSurface`.
- Rationale: project item views must obey the same rules.
- Tradeoffs: project presentation state must be preserved.
- Affected surfaces: project detail and project tests.
- Fitness signal: project detail parity tests and no legacy settings button.

### DES-010: Compatibility And Migration
- Context: view config exists in saved, viewer, project, optimistic, and Convex paths.
- Current-state gap: contract changes can break old records.
- Decision: normalize old config and validate new config at authoritative boundaries.
- Rationale: no-grouping and tri-state are persisted semantics.
- Tradeoffs: more compatibility tests.
- Affected surfaces: schemas, store, Convex.
- Fitness signal: old/new config tests.

### DES-011: Fitness Functions
- Context: current tests are too local.
- Current-state gap: regressions escape sibling surfaces.
- Decision: require matrix tests, Fallow, browser smoke, and review loops.
- Rationale: architecture changes need evidence beyond helper tests.
- Tradeoffs: implementation takes longer.
- Affected surfaces: tests and review ledger.
- Fitness signal: clean final review and validation.

## Risk Register
- Risk:
  - Impact: no-grouping contract breaks saved views.
  - Mitigation: compatibility tests and normalization.
  - Residual risk: old untested records may need follow-up.
- Risk:
  - Impact: central model changes calendar/timeline behavior unexpectedly.
  - Mitigation: layout parity tests and browser smoke.
  - Residual risk: visual details may need product adjustment.
- Risk:
  - Impact: private scope leakage remains in a bypass path.
  - Mitigation: private leakage tests across options, groups, and parents.
  - Residual risk: real data anomalies may need cleanup.

## Test Impact Matrix
- Existing tests to update: view item level, project views, work surface, work surface view, group chip popover, store view config, Convex view handlers.
- New tests required: matrix fixtures for scope/layout/hierarchy/grouping/private/project/no-group/tri-state behavior.
- Compatibility tests: old saved view records, viewer overrides, project presentation config, Convex create/update payloads.
- Rollback-safety tests: old grouped views still load and render.

## Validation Strategy
- Run focused tests after each slice.
- Run `pnpm typecheck`, `pnpm lint`, and relevant Vitest suites after broad slices.
- Run browser smoke for representative view paths after UI adoption slices.
- Run `pnpm fallow:gate` after implementation.
- Run deep-first `diff-review` per slice and final total-diff review.

## Post-Design Review
- Original plan coverage review: complete; all user-reported symptoms and required process gates are represented.
- Repository evidence review: complete for known entry points, selectors, controls, store, Convex, and tests.
- Architecture standards review: complete; target state names owners and enforcement.
- Requirements readiness: ready.
- Required upstream changes before requirements authoring: none.

## Rollout, Abort, and Reversal
- Roll out in requirement slices with tests before broad migration.
- Abort a slice if eligibility, private scope, or persisted config tests fail and cannot be fixed within the slice.
- Reversal should preserve old grouped view records; no destructive data migration is planned without a separate migration decision.

## Forbidden Shortcuts and Guardrails
- Do not patch only `WorkSurface` while leaving project detail divergent.
- Do not represent no grouping as a visual-only fake group.
- Do not let private scope protection live only in hidden UI options.
- Do not skip per-slice deep review.
- Do not claim parity without list/board/calendar/timeline evidence.

## Alternatives Considered
- Alternative:
  - Patch each visible symptom in its current component.
  - Why rejected: it preserves scattered policy and repeats the failure mode.
- Alternative:
  - Only add no grouping to the UI control.
  - Why rejected: persisted and viewer-local config would remain incompatible.

## Residual Risks
- Real user data may expose taxonomy or stale-parent cases not covered by fixtures.
- The exact tri-state persistence shape remains an implementation-time decision.
- Calendar/timeline may need explicit product confirmation for visual group/exclusion affordances.
