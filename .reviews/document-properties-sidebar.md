# Review: Document Properties Sidebar

## Project context

| Field | Value |
|-------|-------|
| **Repository** | Linear |
| **Remote** | https://github.com/declancowen/Linear.git |
| **Branch** | main |
| **Stack** | Next.js, React, TypeScript, Zustand |

## Scope

- `components/app/screens/document-detail-sidebar.tsx` — added Turn 1
- `components/app/screens/document-detail-screen.tsx` — added Turn 1
- `components/app/screens/docs-content.tsx` — added Turn 1
- `components/app/screens/collection-boards.tsx` — added Turn 1
- `components/app/screens.tsx` — added Turn 1
- `components/app/screens/work-surface-view.tsx` — added Turn 1
- `tests/components/document-detail-screen.test.tsx` — added Turn 1
- `app/api/custom-properties/route.ts` — added Turn 3
- `app/api/custom-properties/[propertyId]/route.ts` — added Turn 4
- `app/api/documents/[documentId]/custom-properties/[propertyId]/route.ts` — added Turn 3
- `app/api/work-items/[workItemId]/custom-properties/[propertyId]/route.ts` — added Turn 3
- `components/app/screens/custom-property-controls.tsx` — added Turn 3
- `components/app/screens/document-detail-sidebar.tsx` — added Turn 3
- `components/app/screens/work-surface.tsx` — added Turn 3
- `components/app/screens/work-surface-controls.tsx` — added Turn 4
- `components/app/screens/work-surface-view/board-child-item-row.tsx` — added Turn 3
- `components/app/screens/work-item-menus.tsx` — added Turn 3
- `convex/app.ts` — added Turn 3
- `convex/app/auth_bootstrap.ts` — added Turn 3
- `convex/app/custom_property_handlers.ts` — added Turn 3
- `convex/app/data.ts` — added Turn 3
- `convex/app/scoped_read_models.ts` — added Turn 3
- `convex/schema.ts` — added Turn 3
- `convex/validators.ts` — added Turn 3
- `lib/convex/client/work.ts` — added Turn 3
- `lib/domain/labels.ts` — added Turn 3
- `lib/domain/types-internal/models.ts` — added Turn 3
- `lib/domain/types-internal/primitives.ts` — added Turn 3
- `lib/domain/types-internal/schemas.ts` — added Turn 3
- `lib/scoped-sync/read-model-instructions.ts` — added Turn 3
- `lib/scoped-sync/read-models.ts` — added Turn 3
- `lib/server/convex/work.ts` — added Turn 3
- `lib/server/scoped-read-models.ts` — added Turn 3
- `lib/store/app-store-internal/slices/custom-properties.ts` — added Turn 3
- `lib/store/app-store-internal/types.ts` — added Turn 3
- `tests/components/properties-chip-popover.test.tsx` — added Turn 4
- `tests/lib/scoped-read-models.test.ts` — added Turn 4

## Hotspots

- Sidebar selected entity must follow the currently visible/scope-filtered source set — added Turn 1
- Document title editing must preserve existing collaboration/non-collaboration persistence paths — added Turn 1
- Shared selector ownership should stay in `screens/helpers` — added Turn 2
- Custom property value persistence must omit legacy `workItemId` for document targets — added Turn 3
- Document custom properties must enforce document access and document scope visibility at backend/domain/store boundaries — added Turn 3
- Custom-property definition changes must invalidate every target surface for their scope, including document index/detail surfaces — added Turn 4

## Review status

| Field | Value |
|-------|-------|
| **Review started** | 2026-06-05 10:55 BST |
| **Last reviewed** | 2026-06-05 11:55 BST |
| **Total turns** | 4 |
| **Open findings** | 0 |
| **Resolved findings** | 7 |
| **Accepted findings** | 0 |

## Turn 4 — 2026-06-05 11:55 BST

| Field | Value |
|-------|-------|
| **Commit** | c8d166b8 |
| **IDE / Agent** | Codex |

**Summary:** Deep re-review of the scoped document custom-property and inline sidebar changes after the latest fixes.
**Outcome:** all review findings fixed for scoped files; full repo typecheck remains blocked by unrelated malformed test file.
**Risk score:** high — schema/API/store/read-model migration plus editable document sidebar and shared work-surface UI.
**Change archetypes:** data model migration, API contract, auth/tenancy, optimistic state, scoped read models, shared UI.
**Intended change:** Re-review only this thread's document properties/sidebar work, fix net-new issues, and keep unrelated dirty worktree changes out of scope.
**Intent vs actual:** Matches intent. Fixes stayed in custom-property target filtering, read-model invalidation, and UI copy/formatting for the changed feature surface.
**Confidence:** high for contract/type/unit coverage in scoped files; medium for visual layout because the in-app Browser `iab` surface was unavailable.
**Coverage note:** Review excluded unrelated dirty files and the unrelated broken `tests/lib/domain/people-activity.test.ts`.
**Finding triage:** DOC-PROP-005, DOC-PROP-006, and DOC-PROP-007 opened during this review and fixed in-tree.
**Static/analyzer evidence:** Scoped `git diff --check` passed for tracked files; no-index whitespace checks passed for untracked feature files.
**Architecture impact:** Read-model invalidation now follows the same target/scope model as the data model: team, workspace, and private definitions refresh the corresponding work and document surfaces.
**Deep-review evidence:** Correctness/safety pass traced create/update/archive/value flows through route -> server -> Convex/read-model targets -> store/UI. Maintainability pass checked component ownership and prevented document-specific policy from leaking into work item property menus.
**Bug classes / invariants checked:** scoped read-model invalidation, target-type filtering, stale display references, workspace/private/team scope compatibility, document detail/index freshness, editable custom-property dialog copy.
**Branch totality:** Scoped to this thread's feature files and tests. Existing unrelated dirty worktree changes were not reviewed.
**Sibling closure:** Team, private, and workspace custom-property definition mutation paths; work-item property menu team/private branches; document detail/index read-model paths; tracked and untracked feature files.
**Remediation impact surface:** API route resolver, scoped read-model key helpers, work-surface properties popover, shared custom-property dialog, route/read-model/component tests.
**Residual risk / unknowns:** Full `pnpm exec tsc --noEmit --pretty false` is still blocked by unrelated syntax errors in `tests/lib/domain/people-activity.test.ts` lines 281-282. Browser visual smoke could not run because `iab` is unavailable; `curl -I http://localhost:3000` confirmed the dev server responds with a `/login` redirect.

### Validation

- Filtered TypeScript compiler API check excluding only `tests/lib/domain/people-activity.test.ts` — passed
- `pnpm vitest run tests/components/custom-property-controls.test.tsx tests/components/document-detail-screen.test.tsx tests/components/properties-chip-popover.test.tsx tests/components/work-surface-view.test.tsx tests/lib/store/custom-properties.test.ts tests/convex/custom-property-handlers.test.ts tests/app/api/custom-properties-route-contracts.test.ts tests/lib/scoped-read-models.test.ts` — passed, 160 tests
- `pnpm vitest run tests/app/api/custom-properties-route-contracts.test.ts tests/components/properties-chip-popover.test.tsx tests/lib/scoped-read-models.test.ts` — passed, 33 tests
- `git diff --check -- <scoped tracked files>` — passed
- `git diff --no-index --check -- /dev/null <untracked feature files>` — passed
- `curl -I http://localhost:3000` — passed, app responded with `/login` redirect
- `pnpm exec tsc --noEmit --pretty false` — blocked by unrelated `tests/lib/domain/people-activity.test.ts` syntax error

### Resolved / Carried / New findings

#### DOC-PROP-005 — Resolved — High

Custom-property definition invalidation did not cover all document surfaces for document-capable scopes. Team definitions missed team document index/detail keys, and private definitions missed private document index/detail keys. Fixed by adding team document scope keys and private document scope keys in `lib/scoped-sync/read-models.ts`, with read-model tests covering both.

#### DOC-PROP-006 — Resolved — Medium

Work item property menus could list document-target custom-property definitions, and stale `custom:<document-property>` display refs could still count as visible item properties. Fixed by filtering item property options to `targetType === "workItem"` in `PropertiesChipPopover` and adding component coverage for stale document custom-property refs.

#### DOC-PROP-007 — Resolved — High

Updating or archiving a workspace-scoped custom-property definition mutated the definition but skipped read-model invalidation because the property route resolver only returned team/private targets. Fixed by resolving workspace targets explicitly and adding route-contract tests for workspace update/archive invalidation.

### Recommendations

1. **Fix first:** unrelated malformed `tests/lib/domain/people-activity.test.ts` so normal full typecheck can run again.
2. **Next review turn:** rerun diff review after any additional changes, with the same scoped boundary.
3. **Visual follow-up:** browser-smoke board/list/document sidebar layout when the in-app Browser surface is available.

## Turn 3 — 2026-06-05 11:40 BST

| Field | Value |
|-------|-------|
| **Commit** | c8d166b8 |
| **IDE / Agent** | Codex |

**Summary:** Deep architecture-aware review and re-review of inline sidebar behavior plus document custom-property migration.
**Outcome:** all clear for scoped files, with one unrelated repo blocker noted.
**Risk score:** high — schema/API/store/read-model migration plus editable UI and permission-sensitive document metadata.
**Change archetypes:** data model migration, API contract, auth/tenancy, optimistic state, scoped read models, shared UI.
**Intended change:** Make inline work-item sidebars toggle/swap from list/board/parent/child affordances; add document custom-property definitions and values across schema, backend, routes, store, read models, and document sidebar UI.
**Intent vs actual:** Matches scoped intent. Work-item sidebar icons toggle the current item and switch to another item; document properties use document target/scope rules instead of work-item-only paths.
**Confidence:** high for type/contract/unit behavior in scoped files; medium for visual layout because browser smoke was not available in this pass.
**Coverage note:** Review excluded unrelated dirty files and the unrelated broken `tests/lib/domain/people-activity.test.ts`.
**Finding triage:** DOC-PROP-004 opened during review and fixed before final re-review.
**Static/analyzer evidence:** `git diff --check` on scoped files passed. Filtered TypeScript compiler API check passed with only unrelated malformed test excluded.
**Architecture impact:** Data ownership remains in Convex/schema/domain/store boundaries; UI reuses existing sidebar/control components; document access is enforced in backend before value writes.
**Deep-review evidence:** Correctness/safety pass traced schema -> handler -> route -> client -> store -> read model -> sidebar. Maintainability pass checked that document UI reused shared controls and that target-specific policy stayed in domain/backend/store helpers.
**Bug classes / invariants checked:** target migration compatibility, optional legacy key omission, document permission enforcement, optimistic-state keying, scoped read-model invalidation, hover action event isolation, selected sidebar toggle semantics.
**Branch totality:** Scoped to the files listed above. Existing unrelated dirty worktree changes were not reviewed.
**Sibling closure:** Work-item route/client/store legacy callers, document route, work-item and document read models, board parent/child/list item sidebar buttons, and context menu writes were checked.
**Remediation impact surface:** Schema validators, API route contract, Convex mutations, Zustand store, document/work-surface UI, scoped read models.
**Residual risk / unknowns:** Full `pnpm exec tsc --noEmit` is blocked by unrelated syntax errors in `tests/lib/domain/people-activity.test.ts` lines 281-282.

### Validation

- Filtered TypeScript compiler API check excluding only `tests/lib/domain/people-activity.test.ts` — passed
- `pnpm vitest run tests/components/custom-property-controls.test.tsx tests/components/document-detail-screen.test.tsx tests/components/work-surface-view.test.tsx tests/lib/store/custom-properties.test.ts tests/convex/custom-property-handlers.test.ts tests/app/api/custom-properties-route-contracts.test.ts` — passed, 134 tests
- `pnpm vitest run tests/app/api/custom-properties-route-contracts.test.ts` — passed, 7 tests
- `pnpm vitest run tests/lib/store/custom-properties.test.ts tests/convex/custom-property-handlers.test.ts` — passed, 9 tests
- `git diff --check -- <scoped files>` — passed
- `pnpm exec tsc --noEmit --pretty false` — blocked by unrelated `tests/lib/domain/people-activity.test.ts` syntax error

### Resolved / Carried / New findings

#### DOC-PROP-004 — Resolved — High

Document custom-property value inserts included `workItemId: undefined` for document targets. Convex values should omit optional fields rather than sending `undefined`. Fixed by conditionally spreading `workItemId` only for work-item targets in both Convex persistence and optimistic store state.

### Recommendations

1. **Fix first:** unrelated malformed `tests/lib/domain/people-activity.test.ts` so normal full typecheck can run again.
2. **Then address:** add a persisted definition order field if property definition drag-reorder remains required.
3. **Visual follow-up:** browser smoke the board/list/document sidebar layout when browser tooling is available.

## Turn 2 — 2026-06-05 10:55 BST

| Field | Value |
|-------|-------|
| **Commit** | c8d166b8 |
| **IDE / Agent** | Codex |

**Summary:** Normal re-review after fixes for the document properties sidebar and work-surface open-properties affordances.
**Outcome:** all clear with low-risk unknowns
**Risk score:** medium — visible UI state and editable document title behavior across document directory, document detail, and work-surface list/board.
**Change archetypes:** shared UI, sidebar state, editable metadata, route/link presentation.
**Intended change:** Add icon-only hover affordances for document list/cards and work item list/board cards, opening reusable sidebars; add a document detail sidebar that can edit title when permitted.
**Intent vs actual:** Matches intent. Sidebar state is local to each surface; document title updates reuse existing collaboration-aware and standard rename paths.
**Confidence:** high for code-level behavior; medium for visual fit because in-app browser was unavailable.
**Coverage note:** Scoped diff only; unrelated dirty worktree changes were not reviewed except where they intersected `work-surface-view.tsx`.
**Finding triage:** Turn 1 findings rechecked and resolved.
**Static/analyzer evidence:** Not used; no analyzer policy changes.
**Architecture impact:** Improved ownership after re-review by moving document sidebar into a document-owned component while reusing existing sidebar frame and canonical selector.
**Deep-review evidence:** Turn 1 dual pass completed. Turn 2 normal re-review verified fixes and sibling paths.
**Bug classes / invariants checked:** selected entity must be admitted from current visible source set; editable title must preserve existing permission/collaboration authority; hover buttons must not navigate or start drag.
**Branch totality:** Scoped to the files listed above. Pre-existing unrelated dirty hunks in the repository were intentionally excluded.
**Sibling closure:** Document directory and work-surface list/board stale-selection siblings were both fixed.
**Remediation impact surface:** Local UI state only; no schema/API/persistence contract change.
**Residual risk / unknowns:** Browser visual smoke could not run because the in-app `iab` browser surface was unavailable; local server responded at `http://localhost:3000` and redirected to `/login`.

### Validation

- `pnpm exec tsc --noEmit` — passed
- `pnpm vitest run tests/components/docs-content.test.tsx tests/components/document-detail-screen.test.tsx tests/components/work-surface-view.test.tsx` — passed, 118 tests
- `curl -I http://localhost:3000` — passed, app responded with `/login` redirect

### Branch-totality proof

- **Non-delta files/systems re-read:** document sidebar, document detail screen, docs directory parent/content/card surfaces, work-surface list/board hover paths, project route helper.
- **Prior open findings rechecked:** Turn 1 stale document selection and duplicated selector findings resolved; sibling work-surface stale selection resolved.
- **Prior resolved/adjacent areas revalidated:** document detail title edit tests, docs content tests, work-surface layout/action tests.
- **Hotspots or sibling paths revisited:** selected entity lookup now uses visible `documents`/`items` instead of broader loaded source pools.
- **Dependency/adjacent surfaces revalidated:** existing `CollapsibleRightSidebar`, `selectAppDataSnapshot`, `canEditDocumentInUi`, `getProjectHref`.
- **Why this is enough:** The changed behavior is presentation-local and covered by typecheck plus focused component tests across the touched surfaces.

### Challenger pass

- not needed — Medium risk review; weakest invariant was stale selected entity after filter/scope changes and it was directly fixed on document and work item surfaces.

### Resolved / Carried / New findings

#### DOC-PROP-001 — Resolved — Medium

Document directory properties sidebar selected a document from all loaded documents, so a filter/view change could leave properties open for a document no longer visible in the current directory. Fixed by resolving and validating the selected document against the current `documents` list.

#### DOC-PROP-002 — Resolved — Low

`DocumentDetailScreen` duplicated the app-data selector instead of using the canonical `selectAppDataSnapshot` helper. Fixed by restoring the helper import and updating the focused test mock.

#### DOC-PROP-003 — Resolved — Medium

Work-surface list/board inline details selected from broader `sourceItems`, so a filter/view change could leave properties open for an item outside the current visible list. Fixed by resolving and validating selected items against current `items`.

### Recommendations

1. **Fix first:** none.
2. **Then address:** run a browser smoke when the in-app browser is available.
3. **Patterns noticed:** sidebar selected entity state should always be derived from the same visible source set that rendered the open affordance.

## Turn 1 — 2026-06-05 10:55 BST

| Field | Value |
|-------|-------|
| **Commit** | c8d166b8 |
| **IDE / Agent** | Codex |

**Summary:** Deep review of the initial document properties sidebar and work-surface open-properties changes.
**Outcome:** blocked by open findings
**Risk score:** medium — broad presentation change with editable title path and multiple list/card surfaces.
**Change archetypes:** shared UI, sidebar state, editable metadata.
**Intended change:** Add document/sidebar property viewing and work-item sidebar open affordances in list/board/card views.
**Intent vs actual:** Mostly aligned, but selected sidebars were not constrained to current visible source sets and one production selector was duplicated.
**Confidence:** medium — findings were concrete and fixable.
**Coverage note:** Scoped to this thread's changed files/hunks only.
**Finding triage:** Three findings opened: DOC-PROP-001, DOC-PROP-002, DOC-PROP-003.
**Static/analyzer evidence:** Not used.
**Architecture impact:** Initial document sidebar ownership was good, but selector duplication weakened existing helper ownership.
**Deep-review evidence:** Correctness/safety pass found stale selected-entity bugs. Maintainability/structure pass found selector duplication.
**Bug classes / invariants checked:** stale retained UI state, permission-preserving title mutation, hover action event isolation.
**Branch totality:** Unrelated dirty worktree changes were excluded by scope.
**Sibling closure:** Initial review identified document and work-surface siblings for selected-entity state.
**Remediation impact surface:** Presentation state only.
**Residual risk / unknowns:** Visual smoke pending due unavailable in-app browser.

### Validation

- `pnpm exec tsc --noEmit` — passed before later fixes
- `pnpm vitest run tests/components/docs-content.test.tsx tests/components/document-detail-screen.test.tsx tests/components/work-surface-view.test.tsx` — passed before later fixes

### Branch-totality proof

- **Non-delta files/systems re-read:** document/work-surface parent callers, helper selector, sidebar frame.
- **Prior open findings rechecked:** none before Turn 1.
- **Prior resolved/adjacent areas revalidated:** existing document detail title tests.
- **Hotspots or sibling paths revisited:** document selected state and work item selected state.
- **Dependency/adjacent surfaces revalidated:** title rename/collaboration paths and context menu wrappers.
- **Why this is enough:** The findings were isolated to local UI state and selector ownership.

### Challenger pass

- not needed — Medium risk.

### Resolved / Carried / New findings

- DOC-PROP-001 — opened.
- DOC-PROP-002 — opened.
- DOC-PROP-003 — opened.

### Recommendations

1. **Fix first:** constrain selected sidebars to current visible source sets.
2. **Then address:** remove selector duplication.
