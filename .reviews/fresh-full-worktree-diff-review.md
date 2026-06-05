# Review: Fresh Full Worktree Deep Diff Review

We run in the normal diff review across all of the changes to see if anything new pops up and then fix those.

## Project context

| Field | Value |
|-------|-------|
| **Repository** | `/Users/declancowen/Documents/GitHub/Linear` |
| **Remote** | `https://github.com/declancowen/Linear.git` |
| **Branch** | `main` |
| **Stack** | Next.js, React, TypeScript, Convex, Zustand, Fallow |

## Scope

- Full local working tree excluding prior `.reviews/` ledgers as deep diff-review input — added Turn 1, rechecked Turn 2
- Chat/private task polish spec and implementation surfaces — added Turn 1, rechecked Turn 2
- Document properties/sidebar and target migration surfaces — added Turn 1, rechecked Turn 2
- Profile, labels, custom-property editing surfaces — added Turn 1, rechecked Turn 2
- Current Fallow policy, prior Fallow evidence, and fresh analyzer output — added Turn 1, made current after Turn 1, rechecked Turn 2

## Hotspots

- Private label and custom-property privacy must be enforced at domain/API/Convex/read-model owners, not only presentation filters — added Turn 1, clean Turn 2
- Document custom-property target migration must preserve serialized route contracts and read-model invalidation for document and work-item targets — added Turn 1, clean Turn 2
- Chat quote metadata and rich-text attachment rendering must stay within sanitizer/canonical/TipTap boundaries — added Turn 1, clean Turn 2
- Broad presentation changes require component-level verification and stable shared primitives — added Turn 1, clean Turn 2
- Fallow duplication/health evidence must be current, not inherited from older clean passes — added Turn 1, clean Turn 2

## Review status

| Field | Value |
|-------|-------|
| **Review started** | 2026-06-05 12:02 BST |
| **Last reviewed** | 2026-06-05 12:54 BST |
| **Total turns** | 2 |
| **Open findings** | 0 |
| **Resolved findings** | 5 |
| **Accepted findings** | 0 |

## Turn 2 — 2026-06-05 12:51 BST

| Field | Value |
|-------|-------|
| **Commit** | `c8d166b8` |
| **IDE / Agent** | Codex |

**Summary:** Final DEEP DIFF REVIEW loop after the first deep-review loop and Fallow cleanup.
**Outcome:** clean — no new live findings.
**Risk score:** high — cumulative branch still crosses API contracts, Convex persistence/read models, private metadata privacy, shared store slices, sanitizer/content rules, and broad UI presentation.
**Change archetypes:** API contract, auth/tenancy, data model/read model migration, optimistic state, sanitizer/content contract, broad UI, static-analysis remediation.
**Intended change:** Re-review the whole current local diff after Fallow cleanup, prove the first-loop fixes and structural refactors did not create sibling regressions, and leave the worktree clean of review/Fallow issues.
**Intent vs actual:** Matches. First loop started with deep diff review, Fallow ran only after that loop was clean, and this final loop also started with deep diff review.
**Confidence:** high for static/code/test coverage; no browser smoke was run in this review turn.
**Coverage note:** Changed source, sibling paths, prior resolved findings, route/store/Convex contracts, sanitizer/canonical content paths, private-label paths, and Fallow refactor surfaces were re-read.
**Finding triage:** No new findings in the final loop. DR-001 through DR-005 remain resolved in the current tree.
**Static/analyzer evidence:** Current Fallow gate is clean: dead-code clean, health clean, duplication clean.
**Architecture impact:** Cleanup stayed inside owning boundaries: route helper ownership in server utilities, Convex target/scope enforcement in handlers and validators, local optimistic authorization in the store slice, and UI primitive reuse in detail-sidebar surfaces.
**Deep-review evidence:** Completed correctness/safety pass and maintainability/structure pass separately before synthesis.
**Bug classes / invariants checked:** authz/tenancy enforcement, target/scope contract validity, route serialization, read-model invalidation, optimistic-state rollback surfaces, rich-text sanitizer/canonical parity, static-analysis regression, duplicated abstraction ownership.
**Branch totality:** Current local worktree, not only latest edits, was reviewed.
**Sibling closure:** Sibling API routes, Convex mutations, store guards, read-model materialization, detail-sidebar UI, work-surface controls, and tests were checked.
**Remediation impact surface:** Fallow-driven extractions did not move policy out of owners or create test-only production helpers.
**Residual risk / unknowns:** Browser visual smoke was not run; coverage is from code review, component tests, full test suite, lint, typecheck, and Fallow gate.

### Validation

- `~/.codex/skills/diff-review/scripts/review-preflight.sh` — passed at 2026-06-05 12:54:57 BST; confirmed current local worktree scope and no GitHub PR context.
- `pnpm fallow:gate` — passed after the final preflight; dead-code clean, health 0 findings, duplication 0 groups.
- `pnpm fallow:dupes` — passed; 0 clone groups.
- `pnpm fallow:health` — passed; 0 findings.
- `pnpm exec tsc --noEmit --pretty false` — passed.
- `pnpm lint` — passed.
- `pnpm test` — passed; 232 files / 1619 tests.
- `git diff --check -- . ':!.reviews/'` — passed.
- Focused custom-property/route/UI/Convex slice — passed; 8 files / 96 tests.

### Branch-totality proof

- **Non-delta files/systems re-read:** Custom-property domain predicates, shared schemas, Convex handlers/validators, server route utilities, route handlers, store slices, read-model materialization, detail-sidebar primitives, document sidebar, work-surface controls, rich-text sanitizer/canonical paths, chat quote handling.
- **Prior open findings rechecked:** DR-001 through DR-005 all rechecked in current tree.
- **Prior resolved/adjacent areas revalidated:** Private-label creation/update paths, workspace/team/private label filters, document/work-item custom-property values, route invalidation scope keys, optimistic store guards, component tests with updated accessible queries.
- **Hotspots or sibling paths revisited:** Document and work-item custom-property sibling routes, Convex and local-store target guards, read-model filter paths, custom-property picker visibility, item-description document sidebar, Fallow-extracted helpers.
- **Dependency/adjacent surfaces revalidated:** Shared validators, API route helper call sites, `isCustomPropertyDefinitionVisibleToUser` usage, `isCustomPropertyDefinitionForDocument` and `isCustomPropertyDefinitionForWorkItem` consumers, shared detail-sidebar primitives, work-surface subgroup extraction.
- **Why this is enough:** The review traced each high-risk contract from domain schema through API/Convex/store/read-model/UI consumers and validated with full static and test gates.

### Challenger pass

Completed. The main challenge cases were workspace-scoped work-item custom-property creation, item-description documents gaining custom property creation, private labels leaking through read-model or display paths, Fallow helper extraction moving policy to the wrong layer, and rich-text quote metadata bypassing sanitizer/canonical parity. No live issue remained.

### Resolved / Carried / New findings

- No new findings in Turn 2.

## Turn 1 — 2026-06-05 12:02 BST

| Field | Value |
|-------|-------|
| **Commit** | `c8d166b8` |
| **IDE / Agent** | Codex |

**Summary:** First DEEP DIFF REVIEW loop started across the full local worktree after prior thread-specific reviews and Fallow passes.
**Outcome:** clean after fixes; Fallow was deferred until this loop was clean.
**Risk score:** high — the worktree crosses API contracts, Convex persistence/read models, private metadata privacy, shared store slices, sanitizer/content rules, and broad UI presentation.
**Change archetypes:** API contract, auth/tenancy, data model/read model migration, optimistic state, sanitizer/content contract, broad UI, static-analysis remediation.
**Intended change:** Independently re-review the whole current local diff with a deep diff review, fix newly found issues, run Fallow only after that loop is clean, then start the final loop with another deep diff review until no live findings remain.
**Intent vs actual:** Matches after correction: this turn was treated as the initial deep review loop before Fallow.
**Confidence:** high after source fixes, focused tests, typecheck, lint, full tests, and Fallow follow-up.
**Coverage note:** Preflight and prior review/Fallow ledgers were read; changed source, sibling paths, and high-risk contracts were reviewed before Fallow cleanup.
**Finding triage:** Five findings were fixed or hardened during the first review/verification loop.
**Static/analyzer evidence:** Fallow was intentionally run after the first deep-review loop was clean. It initially reported 3 health findings and 10 duplication groups; all were remediated and rerun clean.
**Architecture impact:** Fixes kept ownership at the right layer: schema/Convex for impossible persisted contracts, store for optimistic editability, server route helper for repeated route mechanics, and UI primitives for repeated sidebar rendering.
**Deep-review evidence:** Correctness/safety and maintainability/structure passes completed, then synthesized before Fallow cleanup.
**Bug classes / invariants checked:** syntax/regression in tests, optimistic authorization, impossible target/scope creation, invalid document property creation, test harness fragility after shared import extraction.
**Branch totality:** Target was current local worktree, not only latest patch and not only older scoped review files.
**Sibling closure:** Route, Convex, store, read-model, and UI siblings were swept for matching target/scope and privacy patterns.
**Remediation impact surface:** Fallow cleanup touched complexity and duplication hotspots after correctness fixes were complete.
**Residual risk / unknowns:** Browser visual smoke was not run; all static, unit, component, Convex, API contract, and Fallow gates passed.

### Validation

- `~/.codex/skills/diff-review/scripts/review-preflight.sh` — completed; reported current Fallow mode-separated signals and large worktree scope.
- `~/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — completed; confirmed broad API/Convex/UI/test scope and active Fallow policy.
- `pnpm vitest tests/lib/store/custom-properties.test.ts tests/lib/domain/people-activity.test.ts --run` — passed.
- `pnpm vitest tests/convex/custom-property-handlers.test.ts tests/app/api/custom-properties-route-contracts.test.ts --run` — passed.
- `pnpm vitest tests/lib/scoped-read-models.test.ts tests/convex/scoped-read-model-handlers.test.ts --run` — passed.
- `pnpm vitest tests/components/document-detail-sidebar.test.tsx tests/components/custom-property-controls.test.tsx tests/components/document-detail-screen.test.tsx tests/components/work-item-detail-screen.test.tsx --run` — passed.
- `pnpm vitest tests/lib/collaboration-canonical-content.test.ts tests/lib/content/rich-text-security.test.ts tests/components/chat-thread.test.tsx tests/components/channel-ui.test.tsx --run` — passed.
- `pnpm vitest tests/lib/store/work-item-actions.test.ts tests/components/work-item-detail-screen.test.tsx tests/components/work-item-menus.test.tsx tests/components/work-item-labels-editor.test.tsx tests/components/create-dialogs.test.tsx --run` — passed.
- `pnpm vitest tests/convex/work-item-handlers.test.ts tests/convex/work-helpers.test.ts tests/convex/view-handlers.test.ts tests/app/api/asset-notification-invite-route-contracts.test.ts --run` — passed.
- `pnpm vitest tests/convex/auth-bootstrap-health.test.ts tests/convex/cleanup.test.ts --run` — passed.
- `git diff --check -- . ':!.reviews/'` — passed.
- `pnpm exec tsc --noEmit --pretty false` — passed.
- `pnpm lint` — passed after React lint cleanup.
- `pnpm test` — passed after test harness fix.

### Branch-totality proof

- **Non-delta files/systems re-read:** Custom-property schemas, Convex handlers, server routes, store slices, read-model materializers, document and work-item detail UI, rich-text sanitizer/canonical logic, chat quote handling, label assignment/visibility.
- **Prior open findings rechecked:** Older review findings were treated as advisory and rechecked against current source.
- **Prior resolved/adjacent areas revalidated:** Scoped read-model key expectations, private-label owner checks, document/work-item property filters, component query accessibility, route contract tests.
- **Hotspots or sibling paths revisited:** Private/team/workspace scope variants, document vs work-item target variants, item-description documents, deleted/missing target paths, duplicate property names by scope, optimistic local update guards.
- **Dependency/adjacent surfaces revalidated:** Shared validators, route helpers, Convex validators, store action consumers, detail sidebar primitives, and work-surface property controls.
- **Why this is enough:** Each live first-loop issue was fixed at the owning contract and then checked through its sibling runtime paths and focused tests before Fallow started.

### Challenger pass

Completed. Challenge cases covered read-only optimistic archive, impossible workspace/work-item custom-property state, item-description property creation, custom-property value target routing, private label read-model exposure, and test-only cleanup regressions.

### Resolved / Carried / New findings

#### DR-001 — Resolved — `tests/lib/domain/people-activity.test.ts`

The channel-post activity test was inserted inside the previous private-work-item expectation, leaving the test file syntactically invalid and dropping the `workItemCreated` assertion for the private item. Fixed by restoring the expected activity entry and closing the previous test before adding the channel-post title regression.

#### DR-002 — Resolved — `lib/store/app-store-internal/slices/custom-properties.ts`

`archiveCustomPropertyDefinition` looked up a definition directly and optimistically archived it without the same local editability guard used by `updateCustomPropertyDefinition`. A read-only user could remove the property in local state until the server rejected and refreshed. Fixed by reusing `getEditableCustomPropertyDefinition`; added store coverage for viewer rejection without a sync call.

#### DR-003 — Resolved — `lib/domain/types-internal/schemas.ts`, `convex/app/custom_property_handlers.ts`

The new custom-property create contract allowed `scopeType: "workspace"` with `targetType: "workItem"`, but the domain selectors never attach workspace-scoped properties to work items. That could create definitions that cannot be used consistently. Fixed by rejecting that combination in the shared route/store schema and in the Convex handler; added route and Convex regression tests.

#### DR-004 — Resolved — `components/app/screens/document-detail-sidebar.tsx`

Item-description documents could expose the document custom-property creation row even though domain predicates exclude custom properties for that document kind. Fixed by returning no create scope for `item-description` documents and adding sidebar coverage.

#### DR-005 — Resolved — `tests/components/work-surface.test.tsx`

The work-surface component test mocked the whole `@phosphor-icons/react` package, which broke once shared picker primitives imported additional icons. Fixed with a partial mock and aligned the query to the accessible `New work item` control name.

### Fallow cleanup after Turn 1

- `convex/app/custom_property_handlers.ts` — split custom-property create target/scope checks into owner-local helpers.
- `lib/store/app-store-internal/slices/custom-properties.ts` — split custom-property value editability checks by active definition and target type; added an owner-local patch helper.
- `components/app/screens/custom-property-controls.tsx` — split save/create patch construction and option normalization helpers.
- `lib/server/custom-property-route-utils.ts` — extracted shared custom-property value route context parsing.
- `components/app/screens/detail-sidebar-primitives.tsx` — extracted repeated detail-sidebar relation/property rows.
- `components/app/screens/work-surface-view.tsx` — extracted missing-selection cleanup and parent subgroup header rendering.
- `convex/validators.ts` / `convex/app.ts` — shared custom-property value input fields without changing public argument shape.
- `components/app/screens/docs-content.tsx`, `components/app/screens/document-detail-screen.tsx`, `tests/convex/workspace-team-handlers.test.ts` — removed local duplication with owner-local helpers.

### Recommendations

1. Keep `.reviews/fresh-full-worktree-diff-review.md` with this branch until push/PR so future loops have the corrected deep-review/Fallow/deep-review sequence.
2. If this moves to PR, rerun the same final verification set against the pushed SHA and resolve any hosted-review comments against current-tree evidence.
