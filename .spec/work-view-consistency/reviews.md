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

# Reviews: Work View Consistency

## Project Context

| Field | Value |
| --- | --- |
| Repository | `/Users/declancowen/Documents/GitHub/Linear` |
| Branch | `main` |
| Stack | Next.js 16, React 19, Convex, Zustand, Vitest, Fallow |
| Review ledger authority | `.spec/work-view-consistency/reviews.md` |

## Cumulative Scope
- Work item view eligibility, filtering, grouping, hierarchy, taxonomy, empty groups, hidden/excluded groups, no grouping, private isolation, project item views, list/board/calendar/timeline parity, saved view config, viewer overrides, Convex view handlers, and store optimistic state.

## Hotspots
- `lib/domain/selectors-internal/work-items.ts`
- `components/app/screens/work-surface.tsx`
- `components/app/screens/work-surface-view.tsx`
- `components/app/screens/work-surface-controls.tsx`
- `components/app/screens/project-detail-screen.tsx`
- `lib/domain/types-internal/primitives.ts`
- `lib/domain/types-internal/models.ts`
- `lib/domain/types-internal/schemas.ts`
- `convex/app/view_handlers.ts`
- `lib/store/app-store-internal/slices/views.ts`
- `lib/store/app-store-internal/slices/ui.ts`

## Review Status

| Field | Value |
| --- | --- |
| Review started | 2026-06-05 |
| Last reviewed | 2026-06-05 |
| Total turns | 4 |
| Open findings | 0 |
| Resolved findings | 2 |
| Accepted findings | 0 |

## Turn 4 - 2026-06-05

| Field | Value |
| --- | --- |
| Commit | `babe4ce7` |
| Agent | Codex |

**Summary:** Completed tasks 2.1 through 99.1. The implementation centralizes work-view matching/group visibility, adds taxonomy-backed level options, migrates WorkSurface and project item views to shared semantics, prevents private grouping leakage, removes the legacy project settings popover path, implements group include/exclude state, hardens tests, runs Fallow, and completes the final prompt/spec/review audit.

**Outcome:** Complete. No open review findings.

**Risk score:** High. The final diff changes shared view selection semantics, persisted/viewer-local config, Convex validators/handlers, project detail rendering, board/list/calendar/timeline data flow, private scope option filtering, and tests.

**Change archetypes:** architecture transition, shared domain model, persisted config compatibility, UI renderer migration, private scope isolation, project-view convergence, static analyzer cleanup.

**Intended change:** Fix inconsistent work item view behavior across My Items, team/workspace/project/private views and across list, board, calendar, and timeline, while documenting the full spec-driven and review-driven process.

**Intent vs actual:** Aligned. The branch now has one shared work-view model for matched/scoped/visible items, durable no-grouping, normalized hidden/include state, taxonomy-derived levels, project item convergence, and private group-option isolation.

**Confidence:** High for covered logic and contracts. Confidence is reduced only for visual browser evidence because the in-app browser connector had no available browser instances in this session.

**Coverage note:** Covered domain selectors, work controls, board/list renderers, timeline/calendar item inputs, WorkSurface, project detail screen, create-view dialog, Convex validators/handlers, server/client mutation wrappers, Zustand view/viewer slices, schemas, saved/viewer config normalization, and focused plus full test suites.

**Finding triage:** Fallow found unused exports and duplicate blocks after the first implementation pass. All were fixed by removing dead legacy surface, narrowing internal helpers, extracting shared Convex/Zod validators, extracting board/list group helpers, and adding test fixture helpers.

**Static/analyzer evidence:** `pnpm fallow:gate` passed with dead-code clean, health findings `0`, score `95.7`, grade `A`, and duplication budget `0/0`.

**Architecture impact:** Strengthens DES-001 through DES-011 by moving scattered business logic into domain-owned selectors and normalized config contracts. UI components now consume shared model outputs and render/control state; Convex/store remain persistence/sync owners.

**Deep-review evidence:** Deep total-diff review performed over domain selectors, hidden-state primitives, WorkSurface, board/list renderers, project detail, Convex validators/handlers, schemas, and new tests. Correctness/safety pass checked no-grouping compatibility, include/exclude normalization, parent/child item matching, empty group behavior under active filters, private scope leakage, project view saved/local paths, and layout item parity. Maintainability pass fixed Fallow dead exports/duplication, removed the unused legacy `ViewConfigPopover`, extracted repeated validators/helpers, and cleaned formatting artifacts.

**Bug classes / invariants checked:** scope acquisition drift, parent/child property substitution, root-only display collapse vs matched item set, empty lane synthesis under active filters, private TeamSpace leakage, stale config conflict, null grouping persistence, hidden/include conflict, project-detail bypass, layout parity drift, test-only production exports, duplicated validators.

**Branch totality:** Reviewed the cumulative branch diff, not only the last patch. Rechecked tasks 0.1 and 1.1 assumptions after adding tri-state hidden state and shared work-view model. No prior no-grouping invariant was weakened.

**Sibling closure:** Covered My Items/personal taxonomy, all-item no-level matching, team/workspace work surfaces, private task group options, project detail item views, saved project views, list/board group controls, calendar/timeline item visibility, Convex create/update/toggle paths, viewer-local override paths, and create-view cloning.

**Remediation impact surface:** Runtime changes are scoped to work-view semantics and config. Documentation updates are scoped to `.spec/work-view-consistency`. Tests added or updated in domain, component, store, Convex, and API contract suites.

**Residual risk / unknowns:** In-app browser visual smoke was unavailable because `agent.browsers.list()` returned `[]` and `agent.browsers.get("iab")` returned unavailable. Local HTTP smoke against the running dev server verified protected work/project routes redirect without 5xx and `/login` renders, but this is not a visual authenticated workspace smoke.

### Completed slices
- 2.1: Shared work-view model added via `buildWorkViewModel`, `getViewMatchedItems`, visible/hidden group helpers, and corrected empty-group synthesis.
- 3.1: Taxonomy provider added for personal/team/project level options, including issue/sub-issue and task/sub-task coverage.
- 4.1: WorkSurface, board, list, calendar, and timeline migrated to shared matched/scoped/visible model outputs.
- 5.1: Private task group options now use shared compatibility semantics and avoid team/project/assignee leakage in private boards.
- 6.1: Project item views consume shared semantics and the legacy project view settings button path was removed.
- 7.1: Group click state now cycles normal -> include-only -> excluded, persists through saved/viewer-local hidden state, and normalizes conflicts.
- 8.1: Matrix coverage expanded across domain, component, store, Convex, API, project, and renderer paths.
- 9.1: Fallow findings fixed and final gate passed.
- 99.1: Original request, requirements, tasks, and review ledger audited and aligned.

### Validation
- `pnpm lint` - passed.
- `pnpm typecheck` - passed.
- `pnpm vitest run tests/lib/domain/view-item-level.test.ts tests/lib/domain/view-config-contract.test.ts tests/lib/domain/project-views.test.ts tests/components/group-chip-popover.test.tsx tests/components/work-surface.test.tsx tests/components/work-surface-view.test.tsx tests/components/project-detail-screen.test.tsx tests/lib/store/viewer-view-config.test.ts tests/lib/store/view-slice.test.ts tests/convex/view-handlers.test.ts tests/app/api/work-route-contracts.test.ts` - passed, 11 files and 236 tests.
- `pnpm test` - passed, 233 files and 1,638 tests.
- `pnpm build` - passed.
- `pnpm fallow:gate` - passed.
- `git diff --check` - passed.
- `python3 /Users/declancowen/.codex/skills/spec-driven-development/scripts/lint_spec.py --spec-dir .spec/work-view-consistency` - passed.
- `python3 /Users/declancowen/.codex/skills/spec-driven-development/scripts/traceability_report.py --spec-dir .spec/work-view-consistency --strict` - passed.
- `python3 /Users/declancowen/.codex/skills/spec-driven-development/scripts/check_code_refs.py --spec-dir .spec/work-view-consistency --repo-root /Users/declancowen/Documents/GitHub/Linear` - passed.
- Browser connector check: `agent.browsers.list()` returned `[]`; in-app browser unavailable.
- HTTP route smoke on local dev server: `/assigned`, `/workspace/items`, `/team/platform/work`, `/workspace/projects`, and `/projects/project_1` returned `307` to login; `/login` returned `200`; no 5xx responses.

### Branch-totality proof
- **Non-delta files/systems re-read:** domain selectors/types, WorkSurface, work-surface controls/renderers, project detail, Convex validators/handlers, store slices, viewer config helpers, schema validators, and focused tests.
- **Prior open findings rechecked:** none.
- **Prior resolved/adjacent areas revalidated:** WV-001 stale subgrouping under no primary grouping remains fixed; null grouping is preserved across schemas, store, Convex, WorkSurface, and project presentation.
- **Hotspots or sibling paths revisited:** saved views, viewer-local overrides, project built-in/saved views, private views, My Items, board/list/calendar/timeline, hidden group rail, group header actions, taxonomy popovers.
- **Dependency/adjacent surfaces revalidated:** server/client wrappers, route contract schema, create view dialog cloning, default view hidden-state cloning, Fallow analyzer policy.
- **Why this is enough:** all named requirements have concrete runtime owners, tests, or recorded environment gaps; full static/runtime gates pass.

### Challenger pass
- Done. Strongest concern: include-only state could hide groups in renderers while calendar/timeline used a different item source. Addressed by `getGroupVisibleItemsForView` and shared model outputs, with domain/component tests plus full suite.
- Done. Strongest concern: private views could still synthesize TeamSpace parent lanes. Addressed by scoped source items and compatible group options, with private model coverage.
- Done. Strongest concern: Fallow cleanup could create test-only production helpers. Addressed by final `pnpm fallow:gate`, lint, typecheck, focused tests, full tests, and build.

### Resolved Findings
- **WV-002 - Static analyzer cleanup after work-view refactor.**
  - Severity: Medium for maintainability and public API hygiene.
  - Root cause: the broad refactor temporarily left unused exports and duplicate validator/renderer/test blocks.
  - Fix: removed unused legacy config popover and dead helper exports, made internal helpers private, extracted shared Convex/Zod validators, extracted board/list group state helpers, and extracted repeated test setup helpers.
  - Verification: `pnpm fallow:gate`, `pnpm lint`, `pnpm typecheck`, focused tests, full tests, and build passed.

### Findings
- No open findings.

### Next Step
- Hand off for product-authenticated manual QA in a seeded workspace, especially visual verification of My Items, team work, private tasks, project item views, and group include/exclude controls across list, board, calendar, and timeline.

## Turn 3 - 2026-06-05

| Field | Value |
| --- | --- |
| Commit | `babe4ce7` |
| Agent | Codex |

**Summary:** Completed task 1.1 by making no primary grouping a first-class `null` value across domain types, Zod schemas, Convex validators/handlers, server wrapper types, store patches, viewer overrides, WorkSurface compatibility, project item presentation state, project list draft state, and shared grouping controls.

**Outcome:** Slice complete after one deep-review fix.

**Risk score:** High. The slice changes a shared persisted view config contract used by saved views, viewer-local overrides, project presentation, optimistic store state, Convex mutations, and shared UI controls.

**Change archetypes:** persisted config compatibility, shared UI control contract, optimistic state, Convex mutation contract, architecture transition.

**Intended change:** Allow `grouping: null` as the durable no-primary-grouping representation without storing a fake group key or coercing null back to `status`.

**Intent vs actual:** Aligned. The durable representation is `null`; UI select controls use `"none"` only as a local string value and convert it back to `null` at the patch boundary.

**Confidence:** High for the contract slice. Typecheck, lint, domain/schema tests, component tests, store tests, Convex tests, and existing work/project view suites passed.

**Coverage note:** Covered default view creation, Zod schemas, project presentation schema, domain grouping behavior, group chip UI, WorkSurface compatibility normalization, viewer overrides, store create/update sync, Convex create/update, project detail state, and project list draft state.

**Finding triage:** One live review finding was found during deep review and fixed before completion: stale `subGrouping` could remain when `grouping` became `null`.

**Static/analyzer evidence:** Fallow not rerun for this slice; final Fallow remains task 9.1. `pnpm lint` and `pnpm typecheck` passed.

**Architecture impact:** Strengthens DES-005 and DES-010 by moving no-grouping into the shared contract instead of a UI-only mode. Persistence and UI now agree on the same representation.

**Deep-review evidence:** Deep dual-pass completed. Correctness/safety pass found and fixed stale subgrouping under null grouping. Maintainability/structure pass found the `ViewGrouping = ViewDefinition["grouping"]` alias removes duplicated Convex union drift and the UI conversion keeps `"none"` out of persisted state.

**Bug classes / invariants checked:** null-vs-undefined persistence, optimistic/server reconciliation, schema/validator mismatch, viewer-local override loss, fake sentinel storage, stale subgrouping, invalid grouping fallback.

**Branch totality:** Reviewed the full task 1.1 diff plus the task 0.1 spec additions. No unrelated runtime files were changed.

**Sibling closure:** Checked saved view, viewer override, project presentation, project detail, project list, WorkSurface, group chip, ViewConfigPopover, store, Convex, and schema paths. Create-view item controls inherit the shared `GroupChipPopover` behavior.

**Remediation impact surface:** Updated runtime code and tests in the exact files implicated by REQ-GROUPING-001 and REQ-CONFIG-001.

**Residual risk / unknowns:** Renderer-level no-grouping visual polish remains task 4.1. Tri-state group include/exclude remains task 7.1. Real saved data with unusual `subGrouping` combinations may still need browser smoke in task 8.1, but WorkSurface now normalizes stale subgrouping locally.

### Validation
- `pnpm vitest run tests/lib/domain/view-config-contract.test.ts tests/components/group-chip-popover.test.tsx tests/components/work-surface.test.tsx tests/lib/store/viewer-view-config.test.ts tests/lib/store/view-slice.test.ts tests/convex/view-handlers.test.ts` - passed, 6 files and 61 tests.
- `pnpm typecheck` - passed.
- `pnpm vitest run tests/lib/domain/view-config-contract.test.ts tests/lib/domain/view-item-level.test.ts tests/lib/domain/project-views.test.ts tests/components/group-chip-popover.test.tsx tests/components/work-surface.test.tsx tests/components/work-surface-view.test.tsx tests/components/project-detail-screen.test.tsx tests/lib/store/viewer-view-config.test.ts tests/lib/store/view-slice.test.ts tests/convex/view-handlers.test.ts` - passed, 10 files and 202 tests.
- `pnpm lint` - passed.
- `git diff --check` - passed.

### Branch-totality proof
- **Non-delta files/systems re-read:** View config types/schemas, Convex validators and handlers, server mutation wrapper, WorkSurface compatibility, project detail presentation state, project list draft state, shared grouping controls, store view slice, viewer override helper.
- **Prior open findings rechecked:** none.
- **Prior resolved/adjacent areas revalidated:** task 0.1 matrix rows for no grouping, project views, viewer overrides, and config compatibility.
- **Hotspots or sibling paths revisited:** saved views, viewer-local overrides, project presentation, optimistic sync, Convex create/update, group chip, legacy config popover.
- **Dependency/adjacent surfaces revalidated:** typecheck and existing project/work-view suites proved the widened type did not break adjacent view behavior.
- **Why this is enough:** task 1.1 is a contract slice; all contract owners and immediate UI emitters were updated and validated.

### Challenger pass
- Done. The strongest remaining concern was stale subgrouping when primary grouping is `null`; it was fixed in `WorkSurface` compatibility and both grouping controls now clear sub-grouping when choosing `None`.

### Resolved Findings
- **WV-001 - Stale subgrouping under no primary grouping.**
  - Severity: High for config correctness.
  - Root cause: the first pass allowed `grouping: null` but did not guarantee `subGrouping: null`, so stale saved/viewer/project state could still subgroup an otherwise ungrouped view.
  - Fix: `GroupChipPopover` and `ViewConfigPopover` now emit `subGrouping: null` when selecting `None`; `WorkSurface` compatibility normalizes any loaded `grouping: null` view to `subGrouping: null`.
  - Verification: focused WorkSurface/group chip tests, broader 202-test work-view suite, typecheck, and lint passed.

### Findings
- No open findings for task 1.1.

### Next Step
- Start task 2.1: centralize acquisition, matching, hierarchy, grouping, empty groups, and hidden/excluded state behind the shared domain model.

## Turn 2 - 2026-06-05

| Field | Value |
| --- | --- |
| Commit | `babe4ce7` |
| Agent | Codex |

**Summary:** Completed task 0.1 by turning the user report into a current-state behavior matrix and mapping existing tests to the reported failure families before runtime edits.

**Outcome:** Audit slice complete; ready for task 1.1 view config contract work.

**Risk score:** High. The implementation work still touches shared view semantics, private scope, persisted config, and every work item layout.

**Change archetypes:** spec-driven audit, architecture transition, behavior matrix, review-ledger update.

**Intended change:** Document exactly what must be fixed and where current coverage is strong, weak, or product-conflicting.

**Intent vs actual:** Aligned. No runtime behavior changed; this slice created the matrix evidence required before remediation.

**Confidence:** Medium-high for the audit slice. The code paths, tests, and user symptoms now have traceable entries; real-data reproduction remains part of later browser smoke.

**Coverage note:** Reviewed current selectors, controls, project detail, project/domain/component tests, and Fallow baseline. The matrix names the next slice that owns each gap.

**Finding triage:** No diff-review findings in the spec/audit diff. Product behavior gaps are carried as planned implementation tasks rather than review findings against this documentation slice.

**Static/analyzer evidence:** Current configured Fallow gate was already refreshed in Turn 1; no runtime TypeScript changed in Turn 2.

**Architecture impact:** Unchanged target-state rule: domain owns durable work-view semantics; UI renders/adapts; Convex/store own compatible persistence.

**Deep-review evidence:** Deep dual-pass applied to the spec/audit diff. Correctness/safety pass found the requirements and task dependencies cover the user reports without adding unrelated runtime scope. Maintainability/structure pass found the package is traceable, validator-clean, and avoids wildcard or missing repo references.

**Bug classes / invariants checked:** split authority, scope leakage, parent/child property substitution, hierarchy lifting, taxonomy omission, empty group synthesis, no-group contract absence, project-detail bypass, layout parity drift.

**Branch totality:** Reviewed all newly added spec files and traced affected runtime/test hotspots named in the matrix. No pre-existing runtime changes are included in this branch state.

**Sibling closure:** Matrix covers `My Items`, `All Issues`, TeamSpace work, project item views, private views, list, board, calendar, and timeline. Sibling runtime fixes are intentionally deferred to tasks 1.1 through 8.1.

**Remediation impact surface:** Future slices must update types/schemas, Convex handlers, store slices, selectors, controls, renderers, project detail, and focused tests.

**Residual risk / unknowns:** Real workspace data may expose stale-parent, mixed-team, or saved-view records beyond current fixtures. Calendar/timeline tri-state UI semantics still need implementation-time product judgment.

### Behavior Matrix

| Area | User symptom or sibling risk | Current evidence | Classification | Owning task |
| --- | --- | --- | --- | --- |
| Personal `My Items` acquisition | Items visible in some personal views but missing in others, especially descendants | `getVisibleWorkItems` has separate assigned and assigned-with-ancestors modes; `WorkSurface` passes `matchItems` for assigned descendants | Covered in parts; needs unified model | 2.1, 4.1 |
| `All Issues` no-level views | Child/sub-item records can disappear when no level or parent filter is active | `getVisibleItemsForView` collapses no-level item views to root rows when no item type or parent filter is active | Product-conflicting candidate | 2.1 |
| Parent/child status mismatch | Done children under non-done parents do not reliably appear in `Done` status grouping | `itemMatchesView` evaluates child status when matching, but renderer parent-header promotion and displayed containers are separate | Untested sibling risk | 2.1, 4.1 |
| Parent grouping/highest parent | Grouping by parent or highest parent can hide eligible children or show only headers | Existing tests cover direct parent grouping and promoted empty parent lanes, not every layout/scope | Covered in parts; needs matrix tests | 2.1, 4.1 |
| Empty groups | `showEmptyGroups: false` and hidden/selected empty groups behave inconsistently | Existing domain tests cover hidden empty status groups and source lanes; private/project/layout variants are missing | Covered in parts; needs scope/layout tests | 2.1, 4.1, 7.1 |
| Taxonomy and level options | `My Items` misses sub-issue/subtask choices; issue tracker is labeled as `Issues` but lacks sub-issue | `LevelChipPopover` hardcodes `My Items` groups to issue-only and task-only parent options; component test only opens the chip | Product-conflicting current behavior | 3.1 |
| No primary grouping | Users need no group for parent/task/status views | `GroupField`, schemas, models, Convex handlers, store patches, and group controls currently require a primary grouping | Product-conflicting current contract | 1.1 |
| Tri-state group click | First click should isolate a group, second click should show an `X` and hide/exclude it | Current state has hidden groups/subgroups but no include-only/exclude state machine | Missing feature/contract | 7.1 |
| Private task isolation | Private board/group-by-task leaks TeamSpace parent groups | Private acquisition is partly domain-owned, but grouping/filter option pruning lives in `WorkSurface` and controls | Privacy-sensitive sibling risk | 5.1 |
| Project item views | Project detail has the legacy settings button and can miss shared fixes | `ProjectDetailScreen` uses custom viewbar/body and test stubs `ViewConfigPopover` as `Switch layout` | Product-conflicting current behavior | 6.1 |
| Layout parity | List, board, calendar, and timeline must return the same business result set | Tests cover many layout behaviors but not a shared item-id parity assertion across all four layouts | Untested sibling risk | 4.1, 8.1 |
| Config compatibility | New no-grouping/tri-state state must survive saved views, viewer overrides, optimistic sync, and project presentation | Current config contract has multiple owners and required grouping | High-risk contract gap | 1.1, 7.1 |

### Existing Fixture Map

| Fixture/test file | Current useful coverage | Known gap for this spec |
| --- | --- | --- |
| `tests/lib/domain/view-item-level.test.ts` | item levels, parent filters, empty groups, parent groups, timeline level, child disclosure, assigned ancestors, private acquisition | no no-grouping, no full layout parity, no private group option leakage |
| `tests/components/work-surface.test.tsx` | fallback views, private task compatibility, stale private filters, assigned descendant filter matching | heavily mocked renderer; does not prove public board/list/calendar/timeline item parity |
| `tests/components/work-surface-view.test.tsx` | board/list rendering details, parent grouped headers, selection, create defaults, calendar/timeline interaction utilities | not a shared semantics matrix across all four layouts |
| `tests/components/group-chip-popover.test.tsx` | group chip opens, parent labels, parent filter values | no primary `None`, no tri-state state machine, weak taxonomy coverage |
| `tests/components/project-detail-screen.test.tsx` | project item local presentation and legacy `ViewConfigPopover` path | must invert once the legacy settings button is removed |
| `tests/lib/domain/project-views.test.ts` | project view filtering/default presentation logic | project item views do not yet prove shared work-view semantics |

### Validation
- `python3 /Users/declancowen/.codex/skills/spec-driven-development/scripts/lint_spec.py --spec-dir .spec/work-view-consistency` - passed.
- `python3 /Users/declancowen/.codex/skills/spec-driven-development/scripts/traceability_report.py --spec-dir .spec/work-view-consistency --strict` - passed.
- `python3 /Users/declancowen/.codex/skills/spec-driven-development/scripts/check_code_refs.py --spec-dir .spec/work-view-consistency --repo-root /Users/declancowen/Documents/GitHub/Linear` - passed.
- `git diff --check -- .spec/work-view-consistency` - passed.
- `pnpm vitest run tests/lib/domain/view-item-level.test.ts tests/components/work-surface.test.tsx tests/components/work-surface-view.test.tsx tests/components/group-chip-popover.test.tsx tests/components/project-detail-screen.test.tsx tests/lib/domain/project-views.test.ts` - passed, 6 files and 162 tests.

### Branch-totality proof
- **Non-delta files/systems re-read:** `lib/domain/selectors-internal/work-items.ts`, `components/app/screens/work-surface-controls.tsx`, `components/app/screens/project-detail-screen.tsx`, and the related domain/component tests.
- **Prior open findings rechecked:** none.
- **Prior resolved/adjacent areas revalidated:** prior work-surface reviews were treated as evidence that parent grouping and empty lanes had partial fixes, not as complete closure.
- **Hotspots or sibling paths revisited:** personal views, team/workspace work, private views, project detail, board/list/calendar/timeline, schemas/store/Convex contract surfaces.
- **Dependency/adjacent surfaces revalidated:** project presentation, viewer overrides, fallback views, and hidden state are in scope for later slices.
- **Why this is enough:** task 0.1 is an audit gate; the matrix identifies runtime owners and required tests without modifying behavior.

### Challenger pass
- Done. The most likely missing serious issue is a persisted saved-view shape or real-data stale-parent variant not represented by current fixtures; task 1.1 and task 8.1 explicitly cover old/new config fixtures and matrix hardening.

### Findings
- None for this audit/documentation slice.

### Next Step
- Start task 1.1: choose the no primary grouping representation and update the view config contract with compatibility tests.

## Turn 1 - 2026-06-05

| Field | Value |
| --- | --- |
| Commit | `babe4ce7` |
| Agent | Codex |

**Summary:** Created the implementation-ready spec package after repository discovery, architecture diagnosis, and current Fallow gate refresh.

**Outcome:** Spec package ready for implementation slice 0.1.

**Risk score:** High. The future work changes shared domain semantics, persisted view configuration, UI controls, project detail behavior, and all work item view layouts.

**Change archetypes:** architecture transition, audit remediation, shared UI/domain refactor, persisted config compatibility, private scope isolation.

**Intended change:** Document and sequence a root-cause audit and remediation plan for inconsistent work item view behavior.

**Intent vs actual:** Aligned. No runtime implementation has been performed yet; this turn only creates the spec package and records current evidence.

**Confidence:** Medium-high for planning. The code paths and current tests are identified, but task 0.1 must still build reproduction fixtures and a full behavior matrix before code changes.

**Coverage note:** Repository discovery covered routes, shared work surface, project detail, domain selectors, schemas, Convex handlers, store slices, viewer overrides, current tests, prior review ledgers, and Fallow config.

**Static/analyzer evidence:** `pnpm fallow:gate` passed on 2026-06-05 with dead-code `0`, production health findings `0`, and duplication budget `0`.

**Architecture impact:** The spec names the current-state failure mode as scattered view policy and establishes a target-state domain-owned work-view model.

**Deep-review evidence:** No code diff review was run for runtime code because no runtime code was changed. Future implementation slices require deep-first diff-review.

**Bug classes / invariants checked:** Scope acquisition, view config contract, hierarchy display, parent/child filter authority, taxonomy completeness, private leakage, project detail bypass, layout parity.

**Branch totality:** Not applicable to runtime code in this turn. Spec artifacts were checked against the original user request, live repo paths, current Fallow gate, and architecture standards.

**Sibling closure:** Deferred to task 0.1 behavior matrix.

**Residual risk / unknowns:** The visible symptoms still need reproduction with fixture or real-data-backed tests. Calendar/timeline interpretation of grouping/tri-state behavior may need implementation-time product judgment.

### Validation
- `pnpm fallow:gate` - passed.

### Findings
- None for this spec-authoring turn.

### Next Step
- Start task 0.1: build the behavior matrix and reproduction fixtures before changing runtime architecture.
