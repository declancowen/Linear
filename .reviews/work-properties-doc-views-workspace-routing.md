# Review: Work Properties, Document Views, Workspace Routing

## Project context

| Field          | Value                                       |
| -------------- | ------------------------------------------- |
| **Repository** | `Linear`                                    |
| **Remote**     | `https://github.com/declancowen/Linear.git` |
| **Branch**     | `codex/work-properties-doc-views-routing`   |
| **Stack**      | Next.js, React, Convex, PartyKit, Zustand   |

## Scope

- `app/**`, `components/app/**`, `convex/**`, `lib/**`, `services/partykit/**`, `tests/**` — added Turn 1
- Duplicate numeric-suffix local files — added Turn 1
- Workspace selector route, custom work properties, document views/taskbar, project/view edit flows, inbox/chat layout fixes, drag/drop reset, notification routing, chat reactions, PartyKit persistence guard — added Turn 1

## Hotspots

- Tenancy and team-scoped custom property validation — added Turn 1
- Workspace selection and selected-workspace cookie routing — added Turn 1
- Notification optimistic read mutations during route navigation — added Turn 1
- Live document teardown persistence and destructive flush prevention — added Turn 1
- Static analyzer drift from broad UI/data-model changes — added Turn 1

## Review status

| Field                 | Value                |
| --------------------- | -------------------- |
| **Review started**    | 2026-05-12 18:06 BST |
| **Last reviewed**     | 2026-05-12 18:39 BST |
| **Total turns**       | 3                    |
| **Open findings**     | 0                    |
| **Resolved findings** | 11                   |
| **Accepted findings** | 0                    |

## Turn 3 — 2026-05-12 18:39 BST

| Field           | Value      |
| --------------- | ---------- |
| **Commit**      | `b8e90c3a` |
| **IDE / Agent** | Codex      |

### Automation context

| Field                          | Value                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------- |
| **Trigger**                    | `pull_request.opened` / CI check                                             |
| **PR**                         | `declancowen/Linear#34`                                                      |
| **Base ref**                   | `main`                                                                       |
| **Base SHA**                   | `19e92e2dd82e447ff65af210892937c5aa589ab9`                                   |
| **Head SHA**                   | `b8e90c3acff541d6246ba21e00911c71e368dd2a`                                   |
| **Previous reviewed head SHA** | none                                                                         |
| **Diff reviewed**              | `19e92e2d...b8e90c3a` plus dependency fix delta                              |
| **Workflow run**               | `25751359758`                                                                |
| **Review comment/check**       | CI `check` failed at `pnpm audit:deps`                                       |
| **Trusted state source**       | GitHub check run                                                             |
| **Verification policy**        | Fix live CI dependency audit failure and rerun local audit/static/test/build |

**Summary:** Imported GitHub CI feedback for PR #34. CI failed before Convex generation and `pnpm check` because `pnpm audit:deps` found high-severity advisories in `next@16.2.4` and transitive `fast-uri@3.1.0`. The branch now upgrades Next and its ESLint config to `16.2.6` and pins `fast-uri` to patched `3.1.2` via pnpm override.
**Outcome:** local fix complete; waiting for new PR check run
**Risk score:** high — framework/security dependency update on top of a broad feature branch.
**Change archetypes:** external CI finding, dependency security, framework patch update, lockfile update.
**Intended change:** Clear the PR CI security audit failure without widening dependency changes beyond the vulnerable packages.
**Intent vs actual:** The fix is narrow: no unrelated dependencies changed, `pnpm audit:deps` now passes the high threshold, and framework validation still passes locally.
**Confidence:** medium-high — local validation is clean; GitHub CI still needs to rerun on the pushed fix.
**Coverage note:** Full test and build passed on Next `16.2.6`.
**Finding triage:** Live CI finding. Not stale: current branch had vulnerable versions in `package.json`/`pnpm-lock.yaml`.
**Static/analyzer evidence:** `pnpm fallow:gate` still passes after the dependency update with dead-code `0`, health findings `0`, duplication `0/0`.
**Architecture impact:** Dependency patch only; no application boundary moved. The `fast-uri` override is narrow and records an explicit security floor for the transitive dependency.
**Bug classes / invariants checked:** dependency security gate, framework compatibility, lockfile/package consistency, CI parity.
**Branch totality:** Rechecked current PR head and local diff after importing the CI finding.
**Sibling closure:** Checked both vulnerable dependency families reported by audit: direct `next` and transitive `fast-uri`.
**Remediation impact surface:** `package.json` and `pnpm-lock.yaml`.
**Residual risk / unknowns:** GitHub CI and any Codex/Convex review comments are still pending after push.

### Validation

- `pnpm audit:deps` — passed; high advisories cleared
- `pnpm typecheck` — passed
- `pnpm lint` — passed
- `pnpm fallow:gate` — passed
- `pnpm test` — passed, 174 files / 956 tests
- `pnpm build` — passed on Next `16.2.6`

### Branch-totality proof

- **Non-delta files/systems re-read:** CI check log, `package.json`, `pnpm-lock.yaml`, PR check rollup.
- **Prior open findings rechecked:** none in the local review file.
- **Prior resolved/adjacent areas revalidated:** full validation from Turn 2 still passes after the dependency update.
- **Hotspots or sibling paths revisited:** direct Next runtime package and matching `eslint-config-next`; transitive `fast-uri` through `shadcn>@modelcontextprotocol/sdk>ajv`.
- **Dependency/adjacent surfaces revalidated:** install lockfile, audit gate, typecheck/lint/test/build.
- **Why this is enough:** the CI failure was solely the dependency audit step, and the exact vulnerable packages now resolve to patched versions with local audit proof.

### Challenger pass

- done — Checked whether the fix should be a broad dependency upgrade. It should not: the audit only required `next >=16.2.6` and `fast-uri >=3.1.2`, so the patch stays narrow.

### Resolved / Carried / New findings

#### WPDV-11 — resolved locally — CI dependency audit failed on high-severity advisories

- **Severity:** high
- **Evidence:** GitHub CI run `25751359758` failed at `pnpm audit:deps`, reporting `next@16.2.4` and `fast-uri@3.1.0` high-severity advisories.
- **Fix:** Upgraded `next` and `eslint-config-next` to `16.2.6`; added `pnpm.overrides.fast-uri = 3.1.2`; regenerated `pnpm-lock.yaml`.
- **Prevention:** `pnpm audit:deps` now passes locally and remains part of CI.

### Recommendations

1. **Fix first:** Commit and push this dependency audit fix.
2. **Then address:** Wait for the new GitHub CI/Codex/Convex feedback and import any live findings into the next turn.
3. **Patterns noticed:** CI has a stricter dependency-audit step than the first local loop ran; keep `pnpm audit:deps` in the publish validation set.
4. **Suggested approach:** Keep dependency overrides narrow and remove `fast-uri` override later only when the upstream chain resolves to `>=3.1.2`.
5. **Architecture transition:** None.
6. **Defer on purpose:** Low/moderate audit advisories remain below this repo's configured `--audit-level high` gate.

## Turn 2 — 2026-05-12 18:28 BST

| Field           | Value                      |
| --------------- | -------------------------- |
| **Commit**      | `19e92e2d` plus local diff |
| **IDE / Agent** | Codex                      |

**Summary:** Re-ran the diff-review loop after static cleanup and full validation. One new test-fixture regression was found and fixed: the shared dialog stub changed the controlled dialog root shape used by `RenameDialog` tests. Architecture preflight also surfaced remaining empty/generated duplicate `* 2` / `* 3` artifacts, which were removed. Current Fallow changed-file, full duplication, lint, typecheck, build, and full Vitest validation are clean.
**Outcome:** all clear pending PR automation feedback
**Risk score:** high — this remains a broad auth, tenancy, data model, realtime persistence, and presentation branch.
**Change archetypes:** shared contract, auth/tenancy, optimistic state, realtime persistence, shared UI, analyzer-backed refactor, test fixture extraction.
**Intended change:** Complete the requested work-properties/document-views/workspace-routing feature set and close review-found regressions before publishing.
**Intent vs actual:** The branch now matches the requested scope locally. The dialog fixture fix preserves the previous controlled-root behavior for menu tests while still centralizing shared dialog primitives.
**Confidence:** high for local static and automated coverage; medium-high overall until GitHub/Codex/Convex PR feedback is imported.
**Coverage note:** Full Vitest suite passed after the fixture fix. Browser smoke has not been run in this local loop.
**Finding triage:** No open local findings remain. The new test-stub regression was live, fixed, and verified. Remaining duplicate-style directories/cache files were empty or generated artifacts and are removed. Prior Fallow clone caveats are resolved: full duplication now reports zero clone groups.
**Static/analyzer evidence:** `pnpm fallow:gate` passes with dead-code `0`, health findings `0`, and duplication `0/0`. `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` exits `0` with verdict `pass`, dead code `0`, complexity `0`, clone groups `0`.
**Architecture impact:** Shared validation remains at the Convex/data boundary; route helpers hold route-specific error translation; test fixture sharing is limited to UI primitive stubs rather than product behavior.
**Bug classes / invariants checked:** tenant/team scope, typed persisted values, destructive flush guard, route/cookie selection matrix, optimistic background failure UX, display-property scope, parent-filtered child rows, controlled dialog container behavior.
**Branch totality:** Rechecked the whole local diff via review preflight and current `git status`, not just the last fixture edit.
**Sibling closure:** Revisited workspace routing, custom property API/Convex/store/UI, notification mutation UX, PartyKit persistence, and test fixture consumers after static cleanup.
**Remediation impact surface:** Fixed test fixture ownership in `tests/lib/fixtures/component-stubs.tsx` and updated dialog consumers without changing production dialog behavior.
**Residual risk / unknowns:** PR automation and Convex review have not run yet. Browser smoke remains a manual follow-up risk for the broad UI surfaces.

### Validation

- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh` — passed; no PR detected yet
- `/Users/declancowen/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — passed; surfaced duplicate artifacts that were removed
- `find . ... \( -name '* 2' -o -name '* 2.*' -o -name '* 3' -o -name '* 3.*' \) -print` — passed after cleanup; no duplicate-style paths remain
- `git diff --check` — passed
- `pnpm typecheck` — passed
- `pnpm lint` — passed
- `pnpm fallow:gate` — passed
- `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` — passed; changed-file clone groups `0`
- `pnpm exec vitest run tests/convex/work-item-handlers.test.ts` — passed
- `pnpm exec vitest run tests/components/entity-context-menus.test.tsx` — passed
- `pnpm test` — passed, 174 files / 956 tests
- `pnpm build` — passed

### Branch-totality proof

- **Non-delta files/systems re-read:** review history, diff-review gates, static-analysis rules, workspace entry helpers, custom property route helpers, Convex access helpers, notification runtime, PartyKit teardown guard.
- **Prior open findings rechecked:** none remain open in this review file.
- **Prior resolved/adjacent areas revalidated:** WPDV-1 through WPDV-8 remain fixed under typecheck, lint, full tests, build, and Fallow gates.
- **Hotspots or sibling paths revisited:** custom property definitions/values, project/view edit dialogs, document taskbar/viewbars, filter/group display selectors, workspace selector route, notification read background sync, chat reaction access, DnD completion state, live document teardown persistence.
- **Dependency/adjacent surfaces revalidated:** proxy matchers, generated Convex API typing, route contract fixtures, component stubs, store slice registration, read-model bootstrap collections.
- **Why this is enough:** the branch has no current static/test/build failures, the analyzer modes no longer carry clone/dead-code findings, and the new regression was in test harness behavior with direct focused coverage.

### Challenger pass

- done — Assumed one serious issue remained in the latest shared-fixture refactor. Full Vitest exposed the controlled-dialog root mismatch; the fixture now supports the two prior root shapes explicitly and the focused menu test passes.

### Resolved / Carried / New findings

#### WPDV-9 — resolved — shared dialog test stub changed controlled menu-dialog behavior

- **Severity:** low
- **Evidence:** `pnpm test` failed in `tests/components/entity-context-menus.test.tsx`; the extracted dialog stub wrapped the dialog in an extra root `<div>`, so the test sent Enter to the wrong node and `onConfirm` was not called.
- **Fix:** Added a configurable `rootAsFragment` mode to `createDialogStubModule()` and filtered `showCloseButton` out of DOM props.
- **Prevention:** Focused `entity-context-menus` test and full Vitest suite now pass.

#### WPDV-10 — resolved — empty/generated duplicate-style directories remained after source duplicate cleanup

- **Severity:** low
- **Evidence:** Architecture preflight and broad `find` sweep found empty duplicate API route directories such as `app/api/read-models/projects 2`, an empty `services/partykit 2`, and ignored generated `.next` cache files with ` 2`/` 3` suffixes.
- **Fix:** Removed the empty duplicate directories and generated duplicate cache files.
- **Prevention:** Re-ran the duplicate-style path sweep and confirmed no matching paths remain.

### Recommendations

1. **Fix first:** Push the current local branch and wait for GitHub/Codex/Convex automation feedback.
2. **Then address:** Import any automation findings into Turn 3, classify current-tree behavior, fix live issues, and rerun the local loop.
3. **Patterns noticed:** Broad UI fixture extraction needs focused tests plus full-suite confirmation because root/container shape affects keyboard handlers.
4. **Suggested approach:** Keep custom property and workspace-routing invariants enforced server-side; keep UI helpers limited to convenience/state rendering.
5. **Architecture transition:** No new transition item from this turn; current helpers have clear route, Convex, domain, store, or test-fixture ownership.
6. **Defer on purpose:** Browser smoke remains deferred until after PR automation unless automation flags a presentation issue.

## Turn 1 — 2026-05-12 18:06 BST

| Field           | Value                      |
| --------------- | -------------------------- |
| **Commit**      | `19e92e2d` plus local diff |
| **IDE / Agent** | Codex                      |

**Summary:** Reviewed the large local diff with architecture-standards and Fallow signals, removed duplicate/stale numeric-suffix files, fixed real contract and UX regressions, and reran focused validation after each batch.
**Outcome:** all clear with low-risk unknowns
**Risk score:** high — broad auth, tenancy, data model, realtime persistence, and presentation changes.
**Change archetypes:** shared contract, auth/tenancy, optimistic state, realtime persistence, shared UI, analyzer-backed refactor.
**Intended change:** Implement custom work properties, document views/taskbar, project/view editing, workspace selector routing, UI fixes, PartyKit wipe guard, DnD hardening, notification and chat reaction fixes.
**Intent vs actual:** Implementation matches the requested capability set after review fixes. The selected-workspace and notification-read follow-ups were corrected during review.
**Confidence:** medium-high — focused checks and changed-file Fallow gate are clean for dead code/complexity; full-suite validation still needs to run before commit.
**Coverage note:** Focused workspace selection route contract test passed. Full test/type/lint/build are pending in final validation.
**Finding triage:** All live review findings found in this turn were fixed. Fallow clone groups remain advisory under the configured production duplication gate; no duplicate files remain.
**Static/analyzer evidence:** `fallow audit --changed-since origin/main` now exits `0` with no dead-code or complexity findings and `warn` only for clone groups. Production dead-code exits `0`; production dupes exits `0`.
**Architecture impact:** Improved ownership by moving workspace entry routing into server helpers, keeping custom property validation in Convex handlers, and avoiding UI-only validation for persisted property shape.
**Bug classes / invariants checked:** tenancy boundary, cookie/session routing, destructive persistence guard, optimistic mutation failure UX, typed custom property validation, display property scope, drag-state reset.
**Branch totality:** Reviewed cumulative local diff, not only the latest edits; duplicate file candidates were compared against canonical paths and removed where stale/duplicate.
**Sibling closure:** Checked workspace root/layout/selector paths together, custom property UI/API/Convex/read model paths together, and notification toast/store/API paths together.
**Remediation impact surface:** Changed workspace selection route, server helpers, custom property controls/handlers/routes, notification runtime handling, and static-analysis hotspot refactors.
**Residual risk / unknowns:** Browser smoke and full validation are still required before PR. PR automation/Convex review has not run yet.

### Validation

- `pnpm exec tsc --noEmit --pretty false` — passed
- `pnpm exec eslint ...changed files... --max-warnings 0` — passed
- `pnpm exec vitest run tests/app/api/workspace-selection-route-contracts.test.ts` — passed
- `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` — passed with advisory clone warning only
- `pnpm exec fallow dead-code --production --format json --quiet --summary` — passed
- `pnpm exec fallow dupes --production --ignore-imports --format json --quiet` — passed

### Branch-totality proof

- **Non-delta files/systems re-read:** workspace auth helpers, workspace selection API, shell notification toast routing, store runtime, custom property API/Convex/read model surfaces.
- **Prior open findings rechecked:** none in this review file; existing `.reviews/` history was checked during preflight.
- **Prior resolved/adjacent areas revalidated:** duplicate numeric-suffix files were removed; Fallow dead-code went from failing to clean.
- **Hotspots or sibling paths revisited:** workspace root/layout/selector route matrix; custom property UI and server validators; notification read mutation failure path.
- **Dependency/adjacent surfaces revalidated:** proxy matchers include `/workspaces`, `/api/custom-properties`, and `/api/work-items`; route smoke had already verified auth redirects/statuses after matcher changes.
- **Why this is enough:** The fixes address authoritative boundaries and the current analyzer gate is no longer failing on dead code or complexity.

### Challenger pass

- done — Rechecked whether analyzer findings were merely cosmetic; fixed the ones tied to exported API drift, validation bypasses, routing contracts, or user-visible failure UX.

### Resolved / Carried / New findings

#### WPDV-1 — resolved — single-workspace users were redirected without selecting the workspace

- **Severity:** medium
- **Evidence:** `/workspaces` redirected directly to `/workspace/projects` for one workspace, but only the POST selection API set `linear_selected_workspace_id`.
- **Fix:** Added a GET selection bridge and shared workspace navigation helper so one-workspace entry redirects through a cookie-setting selection route.
- **Prevention:** Added GET route contract coverage in `tests/app/api/workspace-selection-route-contracts.test.ts`.

#### WPDV-2 — resolved — custom select values could not be cleared from the UI

- **Severity:** medium
- **Evidence:** `CustomPropertyValueControl` allowed selecting options but no `null` clear path for select/multi-select.
- **Fix:** Added `No selection`/`Clear values` options that persist `null`.

#### WPDV-3 — resolved — integer custom property input truncated decimal values

- **Severity:** medium
- **Evidence:** `Number.parseInt("1.5", 10)` committed `1`.
- **Fix:** Switched to `Number(rawValue)` plus `Number.isInteger`.

#### WPDV-4 — resolved — Convex accepted blank custom select option labels

- **Severity:** medium
- **Evidence:** UI prevented blank labels, but direct API/Convex mutations could submit empty trimmed labels.
- **Fix:** Added authoritative option label validation in `convex/app/custom_property_handlers.ts`.

#### WPDV-5 — resolved — custom property type/option edits could invalidate existing values

- **Severity:** medium
- **Evidence:** PATCH could change a property type or remove used choice option ids while historical values existed.
- **Fix:** Reject type changes when values exist and reject removal of option ids currently used by select/multi-select values.

#### WPDV-6 — resolved — notification toast click could show a stale “Failed to update notification” error

- **Severity:** medium
- **Evidence:** Toast click marks notifications read optimistically while navigating; background read failures surfaced a user-visible error despite the navigation succeeding.
- **Fix:** Added runtime support for silent background sync failures and made idempotent mark-read use `refreshStrategy: "none"` with no toast.

#### WPDV-7 — resolved — introduced production-only exports and complexity drift

- **Severity:** low
- **Evidence:** Fallow reported unused exports and changed-file complexity findings.
- **Fix:** Removed unused exports and split complex route/UI/Convex functions into owner-local helpers.

#### WPDV-8 — resolved — duplicate/stale numeric-suffix files polluted the worktree

- **Severity:** low
- **Evidence:** Numeric-suffix files such as `route 2.ts`, `project-inputs 2.ts`, and `server 2.ts` duplicated or lagged canonical files.
- **Fix:** Removed exact duplicates and stale non-canonical copies after comparing with canonical paths.

### Recommendations

1. **Fix first:** Run full lint, typecheck, tests, build, and focused browser smoke before PR.
2. **Then address:** Poll PR/Convex review feedback after opening the PR and import any live findings into a new turn.
3. **Patterns noticed:** Broad feature diffs need static-analysis passes before PR because unused exports and complexity drift appear easily in shared UI/data paths.
4. **Suggested approach:** Keep custom property rules authoritative in Convex; keep UI controls as convenience only.
5. **Architecture transition:** Consider extracting shared route error/auth helpers if custom property route surface grows further.
6. **Defer on purpose:** Remaining Fallow clone groups are advisory and below configured production duplication budget.
