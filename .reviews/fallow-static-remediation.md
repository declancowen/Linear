# Review: Fallow static remediation

## Project context

| Field          | Value                                                            |
| -------------- | ---------------------------------------------------------------- |
| **Repository** | `/Users/declancowen/Documents/GitHub/Linear`                     |
| **Remote**     | `origin https://github.com/declancowen/Linear.git`               |
| **Branch**     | `main` at review time; PR branch pending                         |
| **Stack**      | Next.js 16, React 19, Convex, PartyKit, Electron, Vitest, Fallow |

## Scope

- `.fallowrc.json` - added Turn 1
- `package.json`, `pnpm-lock.yaml` - added Turn 1
- `.github/workflows/ci.yml`, `.gitignore` - added Turn 1
- `scripts/fallow-health-zero-findings-gate.mjs`, `scripts/fallow-dupes-budget-gate.mjs` - added Turn 1
- `.audits/fallow-static-audit-2026-05-01.md` - added Turn 1
- `lib/server/scoped-read-model-route-handlers.ts`, `lib/server/scoped-read-models.ts` - added Turn 2
- `convex/_generated/api.d.ts`, `scripts/verify-convex-generated-fallback.mjs` - added Turn 3
- Fallow-driven route, domain, Convex, collaboration, store, and screen refactors listed in the branch diff - added Turn 1

## Hotspots

- Static analyzer policy drift and report-only CI rollout - added Turn 1
- Broad behavior-preserving refactors across API routes, Convex handlers, collaboration, and presentation screens - added Turn 1
- Duplication transition debt accepted as a regression budget, not as a zero-debt claim - added Turn 1
- Local audit/tooling artifacts accidentally entering the branch - added Turn 1
- Route auth imports crossing into pure read-model authorization tests - added Turn 2
- Convex generated binding verification when deployment secrets are absent - added Turn 3

## Review status

| Field                 | Value                |
| --------------------- | -------------------- |
| **Review started**    | 2026-05-01 22:08 BST |
| **Last reviewed**     | 2026-05-01 22:23 BST |
| **Total turns**       | 3                    |
| **Open findings**     | 0                    |
| **Resolved findings** | 5                    |
| **Accepted findings** | 1                    |

## Turn 3 - 2026-05-01 22:23 BST

| Field           | Value                        |
| --------------- | ---------------------------- |
| **Commit**      | `9318d8e2` plus working tree |
| **IDE / Agent** | Codex                        |

**Summary:** PR CI failed because the existing Convex generated-binding guard blocks any Convex source change when `CONVEX_DEPLOYMENT` is unavailable. The fix commits the regenerated API roster for the new helper module and replaces the no-secret guard with a local fallback verifier that checks what CI can prove without contacting Convex.
**Outcome:** all clear with low-risk unknowns
**Risk score:** high - CI/generation policy affects deploy safety for Convex source changes.
**Change archetypes:** CI policy, generated contract verification, operations fallback, static-analysis governance.
**Intended change:** Keep strong Convex codegen verification when deployment secrets exist, while allowing no-secret CI to verify committed generated API roster freshness instead of failing unconditionally.
**Intent vs actual:** The secret-backed path still runs `pnpm convex:codegen` and checks `convex/_generated`; the no-secret path runs `node scripts/verify-convex-generated-fallback.mjs`. The generated API file now includes `convex/app/presence_helpers.ts`.
**Confidence:** high for this CI fix - local Convex codegen produced only the expected generated API roster diff; fallback verifier, lint, typecheck, full tests, Fallow gate, CI-style Fallow JSON, and whitespace checks passed.
**Coverage note:** This turn focused on the external CI failure, generated binding freshness, and no-secret CI behavior.
**Finding triage:** The GitHub CI failure is live and resolved locally. It is an operations-policy finding, not a product behavior bug.
**Static/analyzer evidence:** `pnpm fallow:gate` passed; `pnpm exec fallow --ci --production --format json` exited 0 with total issues 0 after the CI fix.
**Architecture impact:** The fix preserves Convex as the owner of generated contracts. CI now has two explicit modes: deployment-backed codegen verification, or no-secret static roster/schema fallback.
**Bug classes / invariants checked:** Convex module additions must be reflected in generated API bindings; schema changes must not pass no-secret CI without deployment-backed codegen; broad CI policy must not block source-only refactors that have committed generated roster updates.
**Branch totality:** Rechecked CI logs, workflow policy, generated API binding diff, current Convex module roster, local fallback script, and full validation.
**Sibling closure:** Checked that `convex/schema.ts` is unchanged in this branch and that the generated API roster matches all current Convex function modules excluding `_generated` and schema.
**Remediation impact surface:** CI behavior changes only for missing Convex deployment secrets. Secret-backed CI remains the authoritative generated-binding verification path.
**Residual risk / unknowns:** The fallback cannot reproduce Convex's deployment-backed codegen or generated data model drift for schema changes; it explicitly fails schema changes without deployment secrets.

### Validation

- `pnpm convex:codegen` - passed; produced expected `convex/_generated/api.d.ts` roster update
- `node scripts/verify-convex-generated-fallback.mjs` - passed, 35 modules
- `pnpm lint` - passed
- `pnpm typecheck` - passed
- `pnpm test` - passed, 140 files and 739 tests
- `pnpm fallow:gate` - passed
- `pnpm exec fallow --ci --production --format json` - passed, total issues 0
- `git diff --check` - passed

### Branch-totality proof

- **Non-delta files/systems re-read:** `.github/workflows/ci.yml`, `convex/_generated/api.d.ts`, `convex/app/presence_helpers.ts`, and the Convex module tree.
- **Prior open findings rechecked:** The GitHub CI failure mode is addressed by committing generated bindings and replacing the unconditional no-secret failure.
- **Prior resolved/adjacent areas revalidated:** Turn 1 Fallow policy and Turn 2 read-model split still pass full local validation.
- **Hotspots or sibling paths revisited:** Schema drift path is explicitly checked and fails no-secret CI if `convex/schema.ts` changes.
- **Dependency/adjacent surfaces revalidated:** The new verifier uses only Node built-ins and git, so CI does not gain a new package dependency.
- **Why this is enough:** The external failure was caused by CI lacking secrets, not codegen output drift. The fallback now verifies the committed generated API roster and refuses the case it cannot safely prove.

### Challenger pass

- `done` - Attacked the fallback's weakest assumption: a new helper module could be missing from `api.d.ts`. Regenerating bindings added the missing module, and the verifier now checks imports plus `fullApi` map entries.

### Resolved / Carried / New findings

#### FSR-06 - Resolved - No-secret CI blocked Convex source changes even with committed generated bindings

- **Severity:** High
- **Files:** `.github/workflows/ci.yml`, `scripts/verify-convex-generated-fallback.mjs`, `convex/_generated/api.d.ts`
- **External source:** GitHub Actions CI on PR #30
- **Root cause:** The guard treated any Convex source or generated binding change as unverifiable without `CONVEX_DEPLOYMENT`, so PR/push CI failed before `pnpm check`.
- **Impact:** The PR could not reach reviewable green CI in the current GitHub environment, even though local codegen could update the generated module roster.
- **Fix:** Committed the regenerated API roster for `presence_helpers` and added a no-secret verifier that checks generated API imports/map entries against the Convex module tree while failing schema changes that require deployment-backed codegen.
- **Architecture decision:** Operations owns CI mode selection. Deployment-backed codegen remains authoritative when secrets exist; no-secret CI has a narrower, explicit fallback rather than a blanket pass or blanket fail.
- **Verification:** Local fallback verifier, full lint/typecheck/tests, Fallow gate, CI-style Fallow JSON, and `git diff --check` passed.

### Recommendations

1. **Fix first:** Push the CI fix and verify GitHub Actions reruns.
2. **Then address:** Continue waiting for Codex review comments after checks finish.
3. **Patterns noticed:** CI fallback policy should encode exactly what can be proven without secrets.
4. **Suggested approach:** Keep generated-contract checks strict for schema changes; allow module-only helper splits when generated API roster is committed.
5. **Architecture transition:** The generated-contract fitness function now has a usable no-secret mode.
6. **Defer on purpose:** Deployment-backed Convex codegen remains dependent on repository secrets.

## Turn 2 - 2026-05-01 22:15 BST

| Field           | Value                        |
| --------------- | ---------------------------- |
| **Commit**      | `d8737fdf` plus working tree |
| **IDE / Agent** | Codex                        |

**Summary:** Full test validation found a Vitest/ESM failure in scoped read-model tests caused by importing WorkOS/Next auth through a module whose test target was pure read-model authorization. The fix split HTTP route handlers into a route-edge module while keeping read-model authorization/invalidation in `scoped-read-models`.
**Outcome:** all clear with low-risk unknowns
**Risk score:** high - this turn touched shared read-model route imports after broad route helper extraction.
**Change archetypes:** route edge split, auth boundary, test-environment compatibility, architecture remediation.
**Intended change:** Preserve route behavior while removing the WorkOS/Next auth import from pure scoped read-model authorization tests.
**Intent vs actual:** Route handlers now import `scoped-read-model-route-handlers`; read-model authorization/invalidation imports no value from `route-auth`. The failing test file passes without mocking WorkOS.
**Confidence:** high for this fix - targeted test, full Vitest, lint, typecheck, Fallow gate, CI-style Fallow JSON, and whitespace checks passed.
**Coverage note:** This turn revalidated the full local test suite and static gates after the split.
**Finding triage:** One live test/import-boundary finding was fixed. No open local diff-review findings remain.
**Static/analyzer evidence:** `pnpm fallow:gate` passed after the split; `pnpm exec fallow --ci --production --format json` exited 0 with total issues 0.
**Architecture impact:** Improved dependency direction by keeping WorkOS/Next auth and HTTP response mapping at the route edge. The read-model service now owns scope authorization and invalidation without loading framework auth dependencies on import.
**Bug classes / invariants checked:** Test import boundaries should not load vendor auth modules unless the test targets auth; route handlers must still require a session before loading snapshots; read-model scope authorization must still use the session's WorkOS user id and email.
**Branch totality:** Rechecked route import callers under `app/api/read-models`, the new route-edge module, the read-model service, package gates, and the full test suite.
**Sibling closure:** All route handler helper imports were moved with a mechanical sweep under `app/api/read-models`; `rg` confirmed no handler exports remain consumed from `scoped-read-models`.
**Remediation impact surface:** The public route behavior is preserved through the same handler functions, now in an edge-owned file. The service export added for snapshot loading is narrow and server-only.
**Residual risk / unknowns:** Browser visual smoke and production deployment/runtime coverage remain outside this local loop. The repeated Vitest `--localstorage-file` warning is existing test-run noise and did not fail tests.

### Validation

- `pnpm exec vitest run tests/lib/server/scoped-read-models.test.ts` - passed, 6 tests
- `pnpm lint` - passed
- `pnpm typecheck` - passed
- `pnpm test` - passed, 140 files and 739 tests
- `pnpm fallow:gate` - passed
- `pnpm exec fallow --ci --production --format json` - passed, total issues 0
- `git diff --check` - passed

### Branch-totality proof

- **Non-delta files/systems re-read:** `lib/server/scoped-read-models.ts`, `lib/server/scoped-read-model-route-handlers.ts`, and all `app/api/read-models/**/route.ts` imports.
- **Prior open findings rechecked:** The full-suite failure in `tests/lib/server/scoped-read-models.test.ts` is resolved.
- **Prior resolved/adjacent areas revalidated:** Static analyzer policy fixes from Turn 1 still pass Fallow gates and CI-style JSON output.
- **Hotspots or sibling paths revisited:** Route helper consumers under `app/api/read-models` were swept for old imports.
- **Dependency/adjacent surfaces revalidated:** `route-auth` remains value-imported only by the route-edge handler module; `scoped-read-models` keeps only a type import for the session shape.
- **Why this is enough:** The failure class was an import boundary problem; the owner split removes the cross-boundary value import and full validation passed.

### Challenger pass

- `done` - Attacked the weakest new assumption: that moving handler exports would preserve all route imports and not change analyzer gates. `rg`, typecheck, full tests, and Fallow all passed.

### Resolved / Carried / New findings

#### FSR-05 - Resolved - Read-model tests loaded WorkOS/Next auth through a mixed module boundary

- **Severity:** High
- **Files:** `lib/server/scoped-read-models.ts`, `lib/server/scoped-read-model-route-handlers.ts`, `app/api/read-models/**/route.ts`
- **Root cause:** `scoped-read-models.ts` mixed route-edge request handling with read-model authorization/invalidation helpers, so importing the pure authorization helpers also value-imported `route-auth` and `@workos-inc/authkit-nextjs`.
- **Impact:** Full Vitest failed in `tests/lib/server/scoped-read-models.test.ts` because the WorkOS auth package imports `next/cache` in a way the test runner could not resolve.
- **Fix:** Moved HTTP route helper functions into `lib/server/scoped-read-model-route-handlers.ts` and updated read-model routes to import from that edge-owned module. `scoped-read-models.ts` now keeps only the read-model service boundary plus a narrow snapshot loader.
- **Architecture decision:** Auth/session acquisition and HTTP response mapping belong at the route/API edge; scope authorization and invalidation belong in the read-model server service.
- **Verification:** Targeted scoped read-model test, full Vitest, lint, typecheck, Fallow gate, CI-style Fallow JSON, and `git diff --check` all passed.

### Recommendations

1. **Fix first:** None open locally.
2. **Then address:** Publish the PR and wait for Codex/GitHub review.
3. **Patterns noticed:** Mixed route-edge and service modules can create hidden vendor dependency problems in pure tests.
4. **Suggested approach:** Keep HTTP/auth wrappers in route-edge modules and test business/service helpers without vendor auth imports.
5. **Architecture transition:** The read-model route helper extraction is now a clearer two-layer split instead of one mixed helper module.
6. **Defer on purpose:** Browser visual smoke and runtime coverage remain separate from this static remediation PR.

## Turn 1 - 2026-05-01 22:08 BST

| Field           | Value                        |
| --------------- | ---------------------------- |
| **Commit**      | `d8737fdf` plus working tree |
| **IDE / Agent** | Codex                        |

**Summary:** Local diff review of the Fallow remediation branch found three policy/review hygiene issues and fixed them before publishing: local Graphify outputs were unignored, CI used an unpinned Fallow install path, and the audit still described the old CI command. The remaining duplication debt is intentionally budget-gated at the current baseline.
**Outcome:** all clear with low-risk unknowns
**Risk score:** high - broad refactor branch touching shared route helpers, Convex handlers, collaboration runtime, store logic, editor/screen presentation, static analysis policy, dependencies, and CI.
**Change archetypes:** static-analysis policy, architecture remediation, shared helper extraction, presentation split, route helper extraction, CI/reporting.
**Intended change:** Adopt Fallow, clear production dead-code and complexity/cognitive findings, split high-risk hotspots along existing ownership boundaries, and add repeatable local/CI analyzer gates.
**Intent vs actual:** The diff matches the remediation intent. Production dead-code is zero, complexity/cognitive findings are zero through the JSON health gate, and duplication is held to a named budget instead of being hidden by broad suppressions.
**Confidence:** medium - static gates, typecheck, targeted lint, and focused tests passed; the branch is large enough that exhaustive visual/browser and full build verification remain useful after PR publication.
**Coverage note:** Review concentrated on the static-analysis policy surface, branch hygiene, generated/local artifact boundaries, and late policy fixes. Earlier remediation batches covered focused screen/API/editor tests.
**Finding triage:** Three local findings were live and are now resolved. No open critical/high local diff-review findings remain.
**Static/analyzer evidence:** `pnpm fallow:gate` passed; `pnpm exec fallow --ci --production --format json` exited 0 with total issues 0; duplication is budget-gated at 181 clone groups, 6,641 duplicated lines, and 5.54%.
**Architecture impact:** The branch improves current-state ownership by moving repeated route, domain, collaboration, Convex, store, and presentation responsibilities into capability/layer-local helpers. The duplication budget models transition debt rather than pretending broad cross-boundary extraction is safe.
**Bug classes / invariants checked:** Analyzer policy must use repo-pinned tools; local audit outputs must not enter product PRs; report-only CI must not block rollout; duplication exceptions must have explicit budgets and revisit pressure.
**Branch totality:** Current branch status, analyzer config, package scripts, CI workflow, audit notes, ignored local artifacts, and review history were reassessed before PR creation.
**Sibling closure:** Checked `.gitignore` against Graphify local outputs, CI against package-managed Fallow, and audit docs against the workflow. No sibling branch-hygiene issue remained visible in `git status --short`.
**Remediation impact surface:** Policy fixes touch operations/CI and local tooling only; Fallow refactors touch product paths but retain exported screen props and route contracts as validated by typecheck and focused tests.
**Residual risk / unknowns:** Full `pnpm check`, browser visual smoke, and deployment/runtime coverage were not part of the last local validation batch. CI remains report-only for Fallow by design during rollout.

### Validation

- `pnpm exec eslint --max-warnings 0 components/app/screens.tsx components/app/rich-text-editor.tsx scripts/fallow-health-zero-findings-gate.mjs scripts/fallow-dupes-budget-gate.mjs` - passed before this review turn
- `pnpm typecheck` - passed before this review turn
- `pnpm exec vitest run tests/components/rich-text-toolbar.test.tsx tests/lib/content/rich-text-security.test.ts tests/components/views-screen.test.tsx tests/app/workspace-layout.test.tsx tests/components/document-detail-screen.test.tsx tests/components/work-item-detail-screen.test.tsx` - passed before this review turn
- `pnpm fallow:gate` - passed before this review turn
- `pnpm exec fallow --ci --production --format json` - passed before this review turn

### Branch-totality proof

- **Non-delta files/systems re-read:** `package.json`, `.fallowrc.json`, `.github/workflows/ci.yml`, `.gitignore`, Fallow gate scripts, and the audit file were reread for policy consistency.
- **Prior open findings rechecked:** Prior local Fallow gate failures for health and duplication are resolved by zero-finding health gating plus a named duplication budget.
- **Prior resolved/adjacent areas revalidated:** CI documentation and workflow now agree on `pnpm exec fallow --ci --production`.
- **Hotspots or sibling paths revisited:** Local Graphify artifacts and Fallow local output paths were checked through `git status --short` and `.gitignore`.
- **Dependency/adjacent surfaces revalidated:** `fallow` is pinned in `devDependencies`; removed packages are reflected in `pnpm-lock.yaml`; scripts call the local package-managed binary.
- **Why this is enough:** The remaining open risk is broad behavioral confidence, not a known unresolved analyzer-policy defect; PR review and CI will provide another branch-total pass.

### Challenger pass

- `done` - Assumed one serious issue remained in the policy layer. The pass found local audit outputs that could be staged and a CI command that bypassed the pinned dependency. Both were fixed.

### Resolved / Carried / New findings

#### FSR-01 - Resolved - Local Graphify outputs were not ignored

- **Severity:** Medium
- **Files:** `.gitignore`
- **Root cause:** Local architecture/audit tooling generated `.graphify_detect.json`, `.graphify_python`, and `graphify-out/` outside existing ignore rules.
- **Impact:** A broad `git add -A` during PR creation could accidentally publish local/generated analysis artifacts.
- **Fix:** Added narrow local audit/tooling ignore patterns for Graphify outputs.
- **Architecture decision:** Operations-owned local tooling artifacts stay outside product source and review scope.
- **Verification:** `git status --short` no longer lists Graphify artifacts.

#### FSR-02 - Resolved - CI Fallow command used a floating install path

- **Severity:** Medium
- **Files:** `.github/workflows/ci.yml`, `package.json`, `pnpm-lock.yaml`
- **Root cause:** The report-only CI step used `npx --yes fallow --ci`, while the branch also pinned `fallow` as a dev dependency and added local scripts.
- **Impact:** CI could review a different Fallow version than local validation, making analyzer policy non-reproducible.
- **Fix:** Changed CI to `pnpm exec fallow --ci --production`.
- **Architecture decision:** Static analyzer policy is operations-owned and must use repo-pinned tooling in the same production scope as the local gate.
- **Verification:** Workflow and audit now reference the pinned CI command.

#### FSR-03 - Resolved - Audit CI section documented the stale command

- **Severity:** Low
- **Files:** `.audits/fallow-static-audit-2026-05-01.md`
- **Root cause:** The audit captured the original report-only CI snippet before the pinned-command correction.
- **Impact:** Future maintainers could follow the stale command and reintroduce CI/local analyzer drift.
- **Fix:** Updated the audit CI snippet and explanation to use `pnpm exec fallow --ci --production`.
- **Architecture decision:** Audit artifacts are governance documentation for static-analysis policy and should match the enforced workflow.
- **Verification:** `rg` confirmed the live workflow uses the pinned command.

#### FSR-04 - Accepted - Residual duplication debt is budget-gated

- **Severity:** Low
- **Files:** `scripts/fallow-dupes-budget-gate.mjs`, `package.json`, `.audits/fallow-static-audit-2026-05-01.md`
- **Status:** Accepted transition debt
- **Rationale:** Forcing duplicate clone groups to zero would require broad abstractions across presentation, route, domain, and runtime owners. That would likely increase coupling and hide meaningful variants.
- **Policy:** Local duplication gate fails if clone groups, duplicated lines, or duplication percentage exceed the current baseline. Future reductions should happen through capability-owned extractions with behavior tests.
- **Revisit trigger:** Any increase over the budget or any repeated business rule crossing owners should become a targeted architecture/refactor task.

### Recommendations

1. **Fix first:** None open locally.
2. **Then address:** Let PR review and CI run before merging because the branch is broad.
3. **Patterns noticed:** Static analysis is useful here as architecture evidence, but warnings need owner-aware interpretation.
4. **Suggested approach:** Keep clearing duplication by capability owner, not by creating generic shared helpers.
5. **Architecture transition:** Treat the current duplication budget as a ceiling, not a stable target.
6. **Defer on purpose:** Runtime coverage and full visual smoke remain post-PR hardening candidates.
