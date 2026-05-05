# Review: Fallow static remediation

## Project context

| Field          | Value                                                            |
| -------------- | ---------------------------------------------------------------- |
| **Repository** | `/Users/declancowen/Documents/GitHub/Linear`                     |
| **Remote**     | `origin https://github.com/declancowen/Linear.git`               |
| **Branch**     | `codex/fallow-static-remediation`                                |
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
- No-secret CI fallback must fail closed when it cannot resolve a schema diff base - added Turn 4
- Test-only production exports weakening the production Fallow report lens - added Turn 5

## Review status

| Field                 | Value                |
| --------------------- | -------------------- |
| **Review started**    | 2026-05-01 22:08 BST |
| **Last reviewed**     | 2026-05-05 18:22 BST |
| **Total turns**       | 6                    |
| **Open findings**     | 0                    |
| **Resolved findings** | 7                    |
| **Accepted findings** | 1                    |

## Turn 6 - 2026-05-05 18:22 BST

| Field           | Value                        |
| --------------- | ---------------------------- |
| **Commit**      | `7c031a58` plus working tree |
| **IDE / Agent** | Codex                        |

**Summary:** Resolved the Turn 5 production dead-code regression by removing test-only exports from production modules and moving directly testable branches into owner-local modules imported by production and tests. A final full-health rerun briefly surfaced one moderate workspace chat helper finding; that was fixed by extracting `getLatestMessagesByConversationId` into the collaboration-screen owner and covering the visible-conversation/latest-message branches.
**Outcome:** all clear with residual broad-refactor risk
**Risk score:** high - the branch remains a large analyzer-driven refactor across route, Convex, store, collaboration, screen, script, Electron, and test surfaces.
**Change archetypes:** static analyzer remediation, owner-local decomposition, testability extraction, architecture boundary cleanup.
**Intended change:** Preserve the full zero dead-code, zero duplication, and zero health-findings state while restoring the clean production Fallow lens.
**Intent vs actual:** Matches intent. Full and production Fallow inventories are clean; production exports no longer exist only for tests.
**Confidence:** medium-high. Static gates, lint, typecheck, full tests, coverage, and build pass locally; GitHub PR review is still needed because the diff is broad.
**Coverage note:** `pnpm test` and `pnpm test:coverage` both passed with `174` test files and `953` tests.
**Finding triage:** FSR-08 is resolved. No new local diff-review findings are open.
**Static/analyzer evidence:** Diff-review preflight at `2026-05-05 18:22 BST` reports changed-file audit pass, production/full dead-code `0`, production/full duplication `0`, production health findings `0`, and full health findings `0`.
**Architecture impact:** Testability moved back behind owner-local modules instead of public production module APIs. The workspace chat helper stayed inside `components/app/collaboration-screens/`, matching the collaboration-screen owner.
**Bug classes / invariants checked:** Production public surface, analyzer policy integrity, owner-local extraction, PartyKit behavior preservation, and zero-suppression policy.
**Branch totality:** Current review target is the full local working tree after the Fallow remediation and export cleanup.
**Sibling closure:** Production/full dead-code, full duplication, and full health were rerun after the final helper extraction.
**Remediation impact surface:** Rich-text/collaboration helpers, work-surface and inbox helpers, store/domain helpers, route/server helpers, Convex helpers, scripts, Electron utilities, and test fixtures.
**Residual risk / unknowns:** The branch size creates integration risk that local static and test gates cannot fully eliminate; the next control is the GitHub PR/Codex review loop.

### Validation

- `pnpm exec fallow dead-code --format json --quiet --explain` - passed, `total_issues: 0`
- `pnpm exec fallow dupes --ignore-imports --format json --quiet --explain` - passed, `clone_groups: 0`, `duplicated_lines: 0`, `duplication_percentage: 0`
- `pnpm exec fallow health --format json --quiet --explain` - findings `0`, functions above threshold `0`; command exits `1` only because aggregate score remains below `100`
- `pnpm fallow:gate` - passed
- `pnpm lint` - passed
- `pnpm typecheck` - passed
- `pnpm exec vitest run tests/components/workspace-chats-screen.test.tsx` - passed, `5` tests
- `pnpm test` - passed, `174` test files and `953` tests
- `pnpm test:coverage` - passed, `174` test files and `953` tests
- `pnpm build` - passed
- `~/.codex/skills/diff-review/scripts/review-preflight.sh` - passed analyzer preflight

### Branch-totality proof

- **Non-delta files/systems re-read:** Fallow package scripts, `.fallowrc.json`, existing audit/review records, CI Fallow posture, and final raw Fallow JSON outputs.
- **Prior open findings rechecked:** FSR-08 was rechecked with production dead-code and full dead-code after the export cleanup; both are zero.
- **Prior resolved/adjacent areas revalidated:** Full duplication, full health findings, production health, lint, typecheck, tests, coverage, and build were rerun.
- **Hotspots or sibling paths revisited:** Collaboration/rich-text owner-local helper modules, workspace chat helper extraction, PartyKit tests, and production export surfaces.
- **Dependency/adjacent surfaces revalidated:** Package Fallow gates now enforce full dead-code and full zero duplication locally while CI remains report-only.
- **Why this is enough:** The local review finding was concrete and analyzer-measurable. The relevant analyzers and full validation suite now agree it is resolved.

### Challenger pass

- `pass with residual risk` - The likely failure mode was leaving test-only production exports behind. Production dead-code and full dead-code now return zero. A secondary stale-coverage health finding was caught and fixed before commit.

### Resolved / Carried / New findings

#### FSR-08 - Resolved - Test-only exports pollute production module APIs and production Fallow dead-code reporting

- **Type / Severity:** Bug, High
- **Resolution:** Removed the test-only production export surface by moving testable primitives into owner-local modules imported by production and tests, or by keeping helpers file-local when only the runtime owner needs them.
- **Evidence:** Production dead-code and full dead-code now report `total_issues: 0`; diff-review preflight reports production dead-code `0`.
- **Prevention artifact:** `pnpm fallow:gate` now includes full-scope dead-code and full zero-duplication gates, with production health still checked by the configured gate.

### Recommendations

1. **Fix first:** No local review bugs remain before commit.
2. **Then address:** Open the GitHub PR and run the Codex/PR feedback loop because the branch is broad.
3. **Patterns noticed:** Coverage-first refactors need a final production export sweep, not just full dead-code.
4. **Suggested approach:** Keep future helper extraction inside the owning capability and import it from production plus tests.
5. **Architecture transition:** The repo is now in a zero dead-code, zero duplication, zero health-findings static state; CI blocking promotion remains a separate policy pass.
6. **Defer on purpose:** Aggregate health score chasing remains out of scope because it is no longer backed by Fallow findings.

## Turn 5 - 2026-05-05 17:04 BST

| Field           | Value                        |
| --------------- | ---------------------------- |
| **Commit**      | `7c031a58` plus working tree |
| **IDE / Agent** | Codex                        |

**Summary:** Preflight for the final local diff-review loop found that the full remediation branch is clean for full dead-code, full duplication, full health findings, lint, typecheck, tests, coverage, and build, but production dead-code now reports 81 unused exports. These are test-only exports added in production modules during coverage-first health remediation.
**Outcome:** blocked by open findings
**Risk score:** high - the branch is broad and analyzer-policy driven, and this regression weakens the configured/report-only production Fallow signal that CI still runs.
**Change archetypes:** static analyzer remediation, broad behavior-preserving refactor, testability extraction, architecture boundary cleanup.
**Intended change:** Drive Fallow duplication/dead-code/health inventories to zero while preserving production behavior and keeping CI policy unchanged.
**Intent vs actual:** Full inventories are clean, but production dead-code is not scope-safe because 81 production exports exist only for tests.
**Confidence:** high for the finding - `pnpm exec fallow dead-code --production --format json --quiet --explain` reports exactly 81 unused exports and identifies each export.
**Coverage note:** The bug is in analyzer policy and production public-surface shape, not failed runtime behavior.
**Finding triage:** One new live finding is open. No suppressions, ignores, threshold changes, or CI changes are acceptable fixes.
**Static/analyzer evidence:** Full dead-code `0`, full duplication `0`, full health findings `0`; production dead-code `81` unused exports at `/tmp/linear-production-dead-code-review.json`.
**Architecture impact:** The coverage-first tests exposed internals through production module APIs. The fix needs to move testable primitives to owner-local modules imported by production and tests, or test public behavior, without adding generic helper buckets.
**Bug classes / invariants checked:** Authority and API surface. Production exports should model product/runtime interfaces, not test-only reachability.
**Branch totality:** Current review target is the full local working tree after the Fallow remediation work.
**Sibling closure:** All production dead-code exports will be swept by Fallow after remediation, not fixed one file at a time without a final production rerun.
**Remediation impact surface:** UI feature modules, rich-text/collaboration helpers, domain selectors, email worker helper, scoped read-model helper, and store channel action helper.
**Residual risk / unknowns:** Broad refactors remain high risk until the production export cleanup and full validation loop rerun.

### Validation

- `~/.codex/skills/diff-review/scripts/review-preflight.sh` - failed changed-file audit because production dead-code reports 81 unused exports
- `pnpm exec fallow dead-code --production --format json --quiet --explain` - failed with `total_issues: 81`
- `pnpm exec fallow dead-code --format json --quiet --explain` - passed before this review turn, full `total_issues: 0`
- `pnpm exec fallow dupes --ignore-imports --format json --quiet --explain` - passed before this review turn, full duplication `0`
- `pnpm exec fallow health --format json --quiet --explain` - no health findings before this review turn; exit remained advisory because score was below `100`
- `pnpm fallow:gate` - passed before this review turn
- `pnpm lint` - passed before this review turn
- `pnpm typecheck` - passed before this review turn
- `pnpm test` - passed before this review turn
- `pnpm test:coverage` - passed before this review turn
- `pnpm build` - passed before this review turn

### Branch-totality proof

- **Non-delta files/systems re-read:** Existing Fallow audit/review history, package analyzer scripts, Fallow production/full outputs, and CI Fallow posture.
- **Prior open findings rechecked:** Prior turns had no open local findings; the new production-dead-code regression supersedes the previous all-clear state.
- **Prior resolved/adjacent areas revalidated:** Full dead-code, full duplication, full health findings, and local gate results were revalidated before this turn.
- **Hotspots or sibling paths revisited:** All 32 production files with test-only exports are in remediation scope.
- **Dependency/adjacent surfaces revalidated:** Production Fallow mode remains relevant because CI still runs report-only `fallow --ci --production`.
- **Why this is enough:** The open finding is analyzer-policy concrete and blocks a scope-safe conclusion until the production dead-code command returns zero.

### Challenger pass

- `blocked` - The most likely remaining issue is that a coverage helper was made public for tests but is not a real production API. The production dead-code report confirmed that exact class.

### Resolved / Carried / New findings

#### FSR-08 - Open - Test-only exports pollute production module APIs and production Fallow dead-code reporting

- **Type / Severity:** Bug, High
- **Files:** 32 production modules including `components/app/rich-text-editor.tsx`, `components/app/screens.tsx`, `components/app/screens/work-surface-view.tsx`, `components/app/collaboration-screens/*`, `hooks/use-document-collaboration.ts`, `lib/collaboration/canonical-content.ts`, `lib/rich-text/extensions.ts`, and `lib/store/app-store-internal/slices/collaboration-channel-actions.ts`
- **Root cause:** Health remediation preferred direct helper coverage and exported branch-bearing internals from production modules so tests could import them.
- **Impact:** Production configured Fallow dead-code now reports 81 unused exports, making the CI report-only Fallow output noisy and contradicting the audit claim that the production lens is clean.
- **Concrete evidence:** `/tmp/linear-production-dead-code-review.json` reports `summary.total_issues: 81`, all `unused_exports`.
- **Solution options:** Proper fix: move stable primitives/components into owner-local modules imported by production and tests, or test behavior through existing public components. Quick fix rejected: suppressions, ignores, dummy imports, or widening Fallow policy would hide the issue.
- **Remediation radius:** Must fix now before commit/PR because it invalidates the analyzer-policy conclusion.
- **Prevention artifact:** Production Fallow dead-code rerun plus full dead-code/duplication/health and local gates after remediation.

### Recommendations

1. **Fix first:** Remove all 81 production-unused test exports without suppressions or Fallow config changes.
2. **Then address:** Rerun production and full Fallow gates, lint, typecheck, tests, coverage, build, and `git diff --check`.
3. **Patterns noticed:** Coverage-first helper exports can accidentally become public production surface.
4. **Suggested approach:** Keep direct unit-testable code in owner-local modules that production imports, not as test-only exports from feature files.
5. **Architecture transition:** Public component/module APIs should shrink back to runtime-owned boundaries after the health-zero campaign.
6. **Defer on purpose:** CI workflow promotion remains out of scope.

## Turn 4 - 2026-05-01 22:32 BST

| Field           | Value                        |
| --------------- | ---------------------------- |
| **Commit**      | `58b0eee0` plus working tree |
| **IDE / Agent** | Codex                        |

**Summary:** Imported the Codex PR review finding against the no-secret Convex fallback. The fallback now fails closed when no reliable diff base can be resolved, preventing schema changes from passing without deployment-backed codegen verification.
**Outcome:** all clear with low-risk unknowns
**Risk score:** high - the finding involved CI policy that protects Convex generated data-model correctness.
**Change archetypes:** external finding import, CI fail-closed guard, generated contract verification.
**Intended change:** Preserve the fallback's ability to verify module roster freshness while refusing unprovable schema-drift cases.
**Intent vs actual:** `assertNoSchemaDriftWithoutDeployment` now exits 1 when `diffRange` is unavailable. Normal branch mode still passes with the resolved merge base; the forced missing-base local check fails as expected.
**Confidence:** high for this fix - the live review comment maps directly to one branch in the script, and both positive and negative verifier paths were exercised.
**Coverage note:** This turn focused only on the Codex review finding and its sibling no-diff-base path.
**Finding triage:** One external P1 finding from `chatgpt-codex-connector[bot]` was live and is resolved locally.
**Static/analyzer evidence:** Not an analyzer-count issue; this is CI fitness-function correctness. Fallow gate passed after the fix.
**Architecture impact:** Strengthens operations-owned CI policy by making unverifiable safety checks fail closed instead of warning.
**Bug classes / invariants checked:** Authority and Compatibility. The CI fallback must not claim generated-contract safety when it cannot determine whether the schema changed.
**Branch totality:** Rechecked the current PR review comments, latest review metadata, CI status, and the fallback script.
**Sibling closure:** Checked both fallback variants: normal merge-base resolution and forced missing-base resolution. Schema-change verification remains deployment-backed or fail-closed.
**Remediation impact surface:** One script branch only; no product runtime behavior changed.
**Residual risk / unknowns:** The next push will trigger another automatic Codex review; no further push should happen until that review completes.

### External finding import

| Source                 | Finding                                                    | Current status   | Bug class                 | Missed invariant/variant                                          | Action |
| ---------------------- | ---------------------------------------------------------- | ---------------- | ------------------------- | ----------------------------------------------------------------- | ------ |
| Codex PR review on #30 | P1: fail fallback when schema diff base cannot be resolved | live -> resolved | Authority / Compatibility | no-secret CI must fail closed when schema drift cannot be checked | fixed  |

### Validation

- `node scripts/verify-convex-generated-fallback.mjs` - passed, 35 modules
- `DIFF_BASE=0000000000000000000000000000000000000000 DEFAULT_BRANCH=definitely-missing-branch DIFF_HEAD=HEAD node scripts/verify-convex-generated-fallback.mjs` - expected failure verified, exit 1
- `pnpm lint` - passed
- `pnpm typecheck` - passed
- `pnpm test` - passed, 140 files and 739 tests
- `pnpm fallow:gate` - passed
- `pnpm exec fallow --ci --production --format json` - passed, total issues 0
- `git diff --check` - passed

### Branch-totality proof

- **Non-delta files/systems re-read:** PR review comments, latest review metadata, CI status, and `scripts/verify-convex-generated-fallback.mjs`.
- **Prior open findings rechecked:** FSR-06 is strengthened so its no-secret fallback cannot skip schema verification when no base exists.
- **Prior resolved/adjacent areas revalidated:** Generated API roster remains valid in the normal branch path.
- **Hotspots or sibling paths revisited:** Missing-base path and normal-base path were both tested.
- **Dependency/adjacent surfaces revalidated:** No new dependencies were added.
- **Why this is enough:** The Codex finding identified a single fail-open branch; the fix converts that branch to a hard failure and verifies it.

### Challenger pass

- `done` - Assumed the fallback might still pass an unprovable state. The forced missing-base test now fails, proving the fail-closed behavior.

### Resolved / Carried / New findings

#### FSR-07 - Resolved - No-secret Convex fallback skipped schema-drift enforcement without a diff base

- **Severity:** High
- **Files:** `scripts/verify-convex-generated-fallback.mjs`
- **External source:** Codex PR review on #30
- **Root cause:** `assertNoSchemaDriftWithoutDeployment` logged a warning and returned when `diffRange` was unavailable.
- **Impact:** A CI context with no resolvable base could pass no-secret fallback mode without checking whether `convex/schema.ts` changed.
- **Fix:** Changed the unavailable-diff-base branch to print an error and exit 1.
- **Architecture decision:** Generated contract safety is an operations-owned invariant. When CI cannot prove the schema did not change and lacks deployment-backed codegen, it must fail closed.
- **Verification:** Positive fallback path passes; forced missing-base path fails with exit 1.

### Recommendations

1. **Fix first:** Commit and push this single fix round.
2. **Then address:** Wait for the new auto-review to finish before making any further changes.
3. **Patterns noticed:** Fallback CI modes need explicit fail-closed behavior for evidence gaps.
4. **Suggested approach:** Keep future CI fallbacks small enough that both positive and negative paths are easy to exercise locally.
5. **Architecture transition:** The generated-contract gate now has a clear proof boundary.
6. **Defer on purpose:** Deployment-backed schema/data-model codegen still requires repository secrets.

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
