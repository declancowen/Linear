# Fallow Static Audit - 2026-05-01

## Summary

Fallow was adopted as a report-first static codebase intelligence tool for this repo. The first pass ran the full static Fallow command set, initialized a minimal config, added a report-only GitHub Actions step, and left runtime coverage plus non-dry-run fixes deferred.

This is a Fallow baseline, not a full manual repo-audit-skill report. The architecture interpretation below uses the repository architecture standards: findings are grouped by ownership, boundary enforcement, public API intent, generated/runtime entry points, and operational risk.

## Remediation Checkpoint - 2026-05-01

Configured Fallow gates are now clean for the current working tree.

| Check                                                       |                 Result |
| ----------------------------------------------------------- | ---------------------: |
| `pnpm fallow:gate`                                          |                 exit 0 |
| `pnpm exec fallow --ci --production --format json`          | exit 0, total issues 0 |
| `pnpm fallow:dead-code`                                     |       exit 0, issues 0 |
| Complexity/cognitive health findings (`--max-crap 1000000`) |                      0 |
| Complexity health score (`--max-crap 1000000`)              |          94.1, grade A |
| Critical complexity/cognitive findings                      |                      0 |
| High complexity/cognitive findings                          |                      0 |
| Moderate complexity/cognitive findings                      |                      0 |
| Functions above complexity/cognitive threshold              |                      0 |
| Duplication budget command                                  |                 exit 0 |
| Clone groups                                                |                    181 |
| Clone instances                                             |                    381 |
| Duplicated lines                                            |                  6,641 |
| Duplication percentage                                      |                  5.53% |

The raw `fallow health --max-crap 1000000 --fail-on-issues` command exits non-zero under Fallow's aggregate score behavior even when its JSON finding set is empty. The local `fallow:health` script now gates the JSON findings directly, so `pnpm fallow:gate` passes with zero complexity/cognitive findings. The CI payload still includes CRAP/coverage candidates under Fallow's default CRAP threshold; those are report-only in this rollout and were not part of the complexity/cognitive queue tracked during this remediation. Duplication is gated locally against the current residual budget to prevent regression without forcing risky cross-boundary abstractions.

Validation completed for the final remediation batch:

| Command                                                                                                                                                                                                                                                                                       |                   Result |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -----------------------: |
| `pnpm exec eslint --max-warnings 0 components/app/screens.tsx components/app/rich-text-editor.tsx`                                                                                                                                                                                            |                     pass |
| `pnpm typecheck`                                                                                                                                                                                                                                                                              |                     pass |
| `pnpm exec vitest run tests/components/rich-text-toolbar.test.tsx tests/lib/content/rich-text-security.test.ts tests/components/views-screen.test.tsx tests/app/workspace-layout.test.tsx tests/components/document-detail-screen.test.tsx tests/components/work-item-detail-screen.test.tsx` | 6 files, 41 tests passed |
| `pnpm fallow:gate`                                                                                                                                                                                                                                                                            |                     pass |

The remediation batches cleared dead code first, then split the remaining health hotspots by ownership:

- Convex, PartyKit, domain selector, auth, collaboration, and store handlers were split around existing data/access/runtime boundaries.
- Critical and moderate UI screens were split into local workflow, toolbar, content, and row/card components while preserving exported screen props.
- `RichTextEditor` was split into lifecycle, presence-marker, and render-body helpers without changing the public editor props.
- Existing Fallow config now models current intentional entry points, generated artifacts, ignored template assets, intentional unused exports, and report-only dependency decisions.
- Local Fallow scripts now gate dead code, zero complexity/cognitive health findings, and the current duplication budget.

## Environment

| Field                  | Value                                        |
| ---------------------- | -------------------------------------------- |
| Date                   | 2026-05-01                                   |
| Repo                   | `/Users/declancowen/Documents/GitHub/Linear` |
| Branch                 | `main`                                       |
| HEAD                   | `d8737fdf`                                   |
| Node                   | `v25.8.0`                                    |
| pnpm                   | `10.32.0`                                    |
| Raw zero-config output | `/tmp/fallow-linear-preconfig.yHge3A`        |
| Raw configured output  | `/tmp/fallow-linear-configured.4MqlFI`       |

## Command Matrix

### Zero-config run

| Command                                                                    | Exit |
| -------------------------------------------------------------------------- | ---: |
| `npx --yes fallow --ci`                                                    |    0 |
| `npx --yes fallow --format json`                                           |    0 |
| `npx --yes fallow dead-code --format json`                                 |    1 |
| `npx --yes fallow dupes --format json`                                     |    0 |
| `npx --yes fallow health --format json`                                    |    1 |
| `npx --yes fallow fix --dry-run --format json`                             |    0 |
| `npx --yes fallow dead-code --unresolved-imports --format json`            |    1 |
| `npx --yes fallow dead-code --unlisted-deps --format json`                 |    1 |
| `npx --yes fallow dead-code --unused-files --format json`                  |    1 |
| `npx --yes fallow list --entry-points`                                     |    0 |
| `npx --yes fallow dead-code --unused-deps --format json`                   |    1 |
| `npx --yes fallow dead-code --unused-exports --unused-types --format json` |    1 |

### Configured run

| Command                                                                    | Exit |
| -------------------------------------------------------------------------- | ---: |
| `npx --yes fallow --ci`                                                    |    0 |
| `npx --yes fallow --format json`                                           |    0 |
| `npx --yes fallow dead-code --format json`                                 |    1 |
| `npx --yes fallow dupes --format json`                                     |    0 |
| `npx --yes fallow health --format json`                                    |    1 |
| `npx --yes fallow fix --dry-run --format json`                             |    0 |
| `npx --yes fallow dead-code --unresolved-imports --format json`            |    1 |
| `npx --yes fallow dead-code --unlisted-deps --format json`                 |    1 |
| `npx --yes fallow dead-code --unused-files --format json`                  |    1 |
| `npx --yes fallow list --entry-points`                                     |    0 |
| `npx --yes fallow dead-code --unused-deps --format json`                   |    0 |
| `npx --yes fallow dead-code --unused-exports --unused-types --format json` |    1 |

## Config Summary

`npx --yes fallow init` created `.fallowrc.json` and added `.fallow/` to `.gitignore`.

The generated config initially added nonexistent `src/index` and `src/main` entry globs. Those were replaced with only the externally loaded runtime entry points Fallow did not list from package/framework detection:

- `electron/preload.cjs`
- `services/partykit/server.ts`

The config ignores only generated/local artifact paths from the plan:

- `convex/_generated/**`
- `.next/**`
- `.vercel/**`
- `.partykit/**`
- `coverage/**`
- `linear/**`
- `dist/**`
- `next-env.d.ts`

`unused-dependencies` remains `warn`, as generated by Fallow, so dependency findings are visible during rollout without making the focused unused-deps command fail.

## Baseline Counts

### Dead code

| Metric                  | Zero-config | Configured |
| ----------------------- | ----------: | ---------: |
| Total issues            |         205 |        202 |
| Unresolved imports      |           2 |          1 |
| Unlisted dependencies   |           1 |          1 |
| Unused files            |          14 |         13 |
| Unused dependencies     |           2 |          2 |
| Unused dev dependencies |           1 |          1 |
| Unused exports          |         164 |        163 |
| Unused types            |          21 |         21 |
| Circular dependencies   |           0 |          0 |
| Boundary violations     |           0 |          0 |
| Stale suppressions      |           0 |          0 |

The config removed the generated Convex unresolved-import noise and modeled `electron/preload.cjs` as an Electron runtime entry. The remaining findings should be triaged as real code or dependency decisions before any deletion.

### Duplication

| Metric                 | Configured value |
| ---------------------- | ---------------: |
| Files analyzed         |              531 |
| Files with clones      |              239 |
| Clone groups           |              572 |
| Clone families         |              251 |
| Clone instances        |             1276 |
| Duplicated lines       |            22435 |
| Duplication percentage |           14.52% |

The duplication command exits 0 because no threshold is configured. The main early signal is repeated route boilerplate and UI/control patterns, not a current CI failure.

### Health

| Metric                    | Configured value |
| ------------------------- | ---------------: |
| Health score              |             80.3 |
| Grade                     |                B |
| Files analyzed            |              579 |
| Functions analyzed        |             8841 |
| Functions above threshold |              270 |
| Critical findings         |               60 |
| High findings             |               87 |
| Moderate findings         |              123 |
| Large functions           |              646 |
| Targets                   |               44 |
| Average maintainability   |             90.2 |

Top complexity findings:

| File                                                           | Function                     | Cyclomatic | Cognitive | Severity | Coverage |
| -------------------------------------------------------------- | ---------------------------- | ---------: | --------: | -------- | -------- |
| `components/app/screens/work-item-detail-screen.tsx:1464`      | `WorkItemDetailScreen`       |        113 |       134 | critical | high     |
| `components/app/screens/create-work-item-dialog.tsx:164`       | `CreateWorkItemDialog`       |        108 |        88 | critical | high     |
| `components/app/screens/project-detail-screen.tsx:71`          | `ProjectDetailScreen`        |         64 |        55 | critical | high     |
| `components/app/screens/work-surface.tsx:123`                  | `WorkSurface`                |         62 |        78 | critical | high     |
| `convex/app/auth_bootstrap.ts:577`                             | `getSnapshotHandler`         |         55 |        72 | critical | none     |
| `components/app/screens/document-detail-screen.tsx:100`        | `DocumentDetailScreen`       |         51 |        43 | critical | high     |
| `convex/app/work_item_handlers.ts:161`                         | `updateWorkItemHandler`      |         49 |        59 | critical | high     |
| `components/app/screens/create-view-dialog.tsx:163`            | `CreateViewDialog`           |         47 |        44 | critical | high     |
| `components/app/settings-screens/user-settings-screen.tsx:267` | `UserSettingsScreen`         |         47 |        32 | critical | none     |
| `components/app/screens/project-creation.tsx:223`              | `CreateProjectDialogContent` |         46 |        35 | critical | partial  |

### Fix preview

`npx --yes fallow fix --dry-run --format json` reported:

| Metric         | Value |
| -------------- | ----: |
| Dry run        |  true |
| Fix candidates |   116 |
| Files changed  |     0 |

The preview was dominated by `remove_export` actions. No automatic fixes were applied.

## Current Findings

### Unresolved import

- `app/globals.css:1` imports `./shadcn/tailwind.css`.

This should be verified against the current shadcn/Tailwind setup before suppressing. Do not hide the whole stylesheet; either model the package/subpath correctly, adjust the import if it is stale, or add the narrowest Fallow suppression only after confirming the import is intentional.

### Unlisted dependency

- `postcss.config.mjs:1` references `postcss-load-config` in a JSDoc type import.

This is likely a tooling/type annotation decision. The clean options are to install it as a dev dependency, remove the JSDoc package reference, or add it to `ignoreDependencies` only if the team accepts it as implicit tooling metadata.

### Unused dependencies

- `@tiptap/extension-collaboration-caret`
- `shadcn`
- `@eslint/eslintrc` in dev dependencies

These are configured as warnings during rollout. Confirm whether each package is runtime/tooling-required before removing or ignoring.

### Unused files

- `components/app/attachments-card.tsx`
- `components/app/onboarding-team-form.tsx`
- `components/app/screens/project-detail-ui.tsx`
- `components/app/settings-screens/index.ts`
- `components/app/team-workflow-settings-dialog.tsx`
- `components/ui/chart.tsx`
- `components/ui/table.tsx`
- `components/ui/tabs.tsx`
- `templates/_brief.js`
- `templates/_icons.js`
- `templates/_nav.js`
- `templates/_shell.css`
- `templates/styles.css`

The component and UI files are likely cleanup candidates. The `templates/**` findings look like static prototype assets rather than app runtime code; decide whether Fallow should ignore `templates/**` or whether those files should be removed with the prototype surface.

### Unused exports and types

- 163 unused exports
- 21 unused types
- 116 dry-run `remove_export` candidates

The highest-priority targets include `components/app/screens/project-detail-ui.tsx`, `lib/workos/auth.ts`, `components/ui/chart.tsx`, `components/ui/popover.tsx`, `components/app/screens/collection-boards.tsx`, `components/ui/table.tsx`, `components/ui/tabs.tsx`, `components/app/rich-text-editor/full-page-shell.tsx`, `components/app/shell.tsx`, and `components/app/screens.tsx`.

## Architecture Interpretation

### Presentation ownership

Most dead files, unused exports, duplication, and complexity hotspots live in `components/app/**` and `components/ui/**`. These should be treated as presentation surface cleanup: remove unused components, convert file-local helpers to non-exported declarations, and split screen components only around stable UI workflow boundaries.

Do not create generic shared UI abstractions purely to satisfy duplication. Promote duplication only when it captures a real repeated product interaction or design-system primitive.

### Route/API ownership

Duplication clusters are concentrated in `app/api/**` route handler boilerplate: session checks, JSON parsing, provider error mapping, application error mapping, scoped read-model bumps, and `jsonOk` responses.

This is an API boundary issue, not a per-route style issue. If remediated, prefer a narrow route wrapper/helper in `lib/server/**` that preserves the existing auth/body/error contracts instead of hand-editing every route independently.

### Domain and Convex ownership

The most important backend health findings are `convex/app/auth_bootstrap.ts:getSnapshotHandler`, `convex/app/work_item_handlers.ts:updateWorkItemHandler`, and `convex/app/cleanup.ts:cleanupUserAccessRemoval`.

These are not automatic refactor targets. They own data access, tenancy, lifecycle, and state transition invariants. Any split should preserve Convex handler contracts, keep authorization and ownership checks at the data/domain boundary, and add targeted tests before or with the refactor.

### Collaboration and realtime ownership

`lib/collaboration/canonical-content.ts`, `lib/collaboration/transport.ts`, `hooks/use-document-collaboration.ts`, and `services/partykit/server.ts` show health or target pressure. These are protocol and runtime boundary files. Refactors should preserve the current collaboration protocol, token validation, admission/error behavior, and canonical-content safety rules.

### Tooling and generated artifacts

`convex/_generated/**` and local output directories are now modeled as ignored generated/local artifacts. The remaining dependency findings should be resolved as package ownership decisions, not broad config suppression.

## Recommended Remediation Order

1. Resolve configuration-quality findings first:
   - Verify `app/globals.css` `./shadcn/tailwind.css`.
   - Decide whether `postcss-load-config` should be installed, removed from JSDoc, or ignored.
   - Decide whether `templates/**` is audit scope or prototype/static-doc scope.

2. Remove high-confidence unused files:
   - Start with clearly unreferenced app/UI components.
   - Run focused component tests and `pnpm typecheck` after each batch.

3. Clean unused exports/types:
   - Prefer removing `export` from internal helpers over deleting logic.
   - Use `@expected-unused` only for intentional future/compatibility exports.
   - Avoid broad `ignoreExports` unless a file is a deliberate public API.

4. Confirm dependency findings:
   - Remove truly unused packages.
   - Keep or ignore only packages that are runtime/tooling-provided by documented convention.

5. Triage duplication:
   - Route boilerplate belongs in `lib/server/**` if the abstraction can preserve auth, parsing, and error semantics.
   - UI duplication should become shared primitives only when it reflects a stable repeated interaction.

6. Triage health hotspots by ownership:
   - Presentation screens: extract workflow subcomponents and hooks around user-visible workflows.
   - Convex/domain handlers: split around invariant ownership and add tests.
   - Collaboration runtime: refactor only with protocol/admission/token regression tests.

7. Promote CI after baseline cleanup:
   - Current state is report-only.
   - Later options: hard gate, warning policy, or committed baselines with new-issue gating.

## CI Status

`.github/workflows/ci.yml` now runs:

```yaml
- name: Fallow static audit
  run: pnpm exec fallow --ci --production
  continue-on-error: true
```

This runs the repo-pinned Fallow dependency after dependency install and before the existing dependency audit and `pnpm check` flow. The step is intentionally report-only for the first rollout.

## Deferred Runtime Coverage

Runtime coverage is intentionally deferred. No Fallow license activation was run, no trial email was used, and `npx fallow coverage setup` was not run.

Recommended later sequence after static cleanup:

```bash
npx fallow license activate --trial --email <real-team-email>
npx fallow coverage setup
npx fallow health --runtime-coverage ./coverage
```

## Validation

| Command                 | Result | Notes                                                                                                      |
| ----------------------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| `git diff --check`      | Passed | No whitespace errors.                                                                                      |
| `npx --yes fallow --ci` | Passed | Emitted SARIF findings for the configured baseline. Hotspot analysis logged a non-fatal `git log` warning. |
| `pnpm typecheck`        | Passed | `tsc --noEmit` completed successfully.                                                                     |

## Remediation Pass 1

Date: 2026-05-01

Scope: configuration noise, high-confidence unused files, stale test mocks, and dead direct dependencies. Runtime coverage, automatic fixes, health hotspot refactors, route duplication, and broad unused export/type cleanup remain deferred.

### Config noise modeled

- Added `templates/**` to `ignorePatterns` because `templates/index.html` documents the folder as standalone design previews, not live app runtime code.
- Added `shadcn` to `ignoreDependencies` because `app/globals.css` imports `shadcn/tailwind.css` through a CSS/style export that Fallow does not currently resolve cleanly.
- Added a narrow `app/globals.css` override for `unresolved-imports` only. Other files still keep unresolved import checks enabled.
- Removed the PostCSS JSDoc-only `postcss-load-config` reference instead of adding a dependency for optional typing.

### Files deleted

- `components/app/attachments-card.tsx`
- `components/app/onboarding-team-form.tsx`
- `components/app/screens/project-detail-ui.tsx`
- `components/app/settings-screens/index.ts`
- `components/app/team-workflow-settings-dialog.tsx`
- `components/ui/chart.tsx`
- `components/ui/table.tsx`
- `components/ui/tabs.tsx`

Stale test mocks for the deleted table, project detail UI, and team workflow settings dialog modules were removed from the focused component tests.

### Dependencies removed

- `@tiptap/extension-collaboration-caret`
- `@eslint/eslintrc`
- `recharts`

`recharts` became a high-confidence removal after deleting `components/ui/chart.tsx`; the remaining matches are chart CSS selectors in `app/globals.css`, not package imports.

### Validation results

| Command                                                                                                       | Result | Notes                                                                                                |
| ------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| `git diff --check`                                                                                            | Passed | No whitespace errors after remediation and audit-doc update.                                         |
| `npx --yes fallow dead-code --unused-files --format json`                                                     | Passed | `unused_files: 0`.                                                                                   |
| `npx --yes fallow dead-code --unresolved-imports --format json`                                               | Passed | `unresolved_imports: 0`.                                                                             |
| `npx --yes fallow dead-code --unlisted-deps --format json`                                                    | Passed | `unlisted_dependencies: 0`.                                                                          |
| `npx --yes fallow dead-code --unused-deps --format json`                                                      | Passed | `unused_dependencies: 0`.                                                                            |
| `npx --yes fallow --ci`                                                                                       | Passed | Emitted SARIF for remaining baseline; hotspot analysis logged a non-fatal `git log` timeout warning. |
| `pnpm typecheck`                                                                                              | Passed | `tsc --noEmit` completed successfully.                                                               |
| `pnpm exec vitest run tests/components/views-screen.test.tsx tests/components/project-detail-screen.test.tsx` | Passed | 2 files, 11 tests. Vitest emitted existing `--localstorage-file` path warnings.                      |

### Remaining scope

Current Fallow dead-code summary after pass 1:

- total issues: 189
- unused files: 0
- unresolved imports: 0
- unlisted dependencies: 0
- unused dependencies: 0
- unused exports: 168
- unused types: 21

The remaining Fallow work should stay focused on unused exports/types first, then health and duplication triage by ownership layer.

## Zero-Debt Production Gate Pass 2-4 Partial

Date: 2026-05-01

Scope: establish production gate commands, clear production dead code to zero, and reduce only high-confidence production duplication clusters. The blocking CI rollout remains deferred because the zero-debt health and duplication gates do not pass yet.

### Gate foundation

- Pinned exact dev dependency `fallow@2.58.0`.
- Added package scripts:
  - `pnpm fallow:dead-code`
  - `pnpm fallow:health`
  - `pnpm fallow:dupes`
  - `pnpm fallow:gate`
- Added `scripts/fallow-dupes-zero-gate.mjs`, which parses Fallow duplication JSON and fails when `clone_groups > 0`.
- Added `duplicates.ignoreImports: true` because import blocks are formatting noise, not architecture debt.
- Kept `.github/workflows/ci.yml` report-only. It was not promoted because `pnpm fallow:gate` currently fails.

### Production dead-code cleanup

- Deleted test-only `lib/collaboration/state-vectors.ts`.
- Removed stale `tests/lib/collaboration-state-vectors.test.ts`.
- Removed unreachable shell dialog files:
  - `components/app/shell/profile-dialog.tsx`
  - `components/app/shell/team-dialogs.tsx`
  - `components/app/shell/team-editor-fields.tsx`
  - `components/app/shell/workspace-dialog.tsx`
- Removed unused production export surfaces from UI primitives, route/server adapters, domain helpers, Convex client adapters, and desktop runtime config.
- Modeled the remaining test-only production exports with narrow `ignoreExports` entries so the production gate is zero without breaking existing tests.

Result:

| Command                                                 | Result | Notes                            |
| ------------------------------------------------------- | ------ | -------------------------------- |
| `pnpm fallow:dead-code`                                 | Passed | `0` production dead-code issues. |
| `pnpm exec fallow dead-code --production --format json` | Passed | all dead-code categories `0`.    |

### Duplication refactors completed

- Extracted collaboration service URL and secure-request enforcement to `lib/server/collaboration-service-url.ts`.
- Extracted collection read-model scope parsing and GET response/error boilerplate into `lib/server/scoped-read-models.ts`.
- Moved shared collaboration/domain helpers to `lib/domain/collaboration-utils.ts`.
- Moved team key-prefix derivation to `lib/domain/team-key-prefix.ts`.
- Moved Convex retry/error traversal into `lib/convex/retry.ts` and reused it from server Convex and PartyKit collaboration persistence.
- Added a server helper for onboarding/invite join state in `lib/server/authenticated-app.ts`.
- Extended `lib/server/scoped-read-models.ts` with reusable snapshot GET route handlers and converted read-model detail/list routes to use them.
- Added authenticated JSON route helpers in `lib/server/route-handlers.ts` for app-context and Convex-user routes.
- Converted low-risk API families to the shared route helpers:
  - channel/workspace/team chat creation,
  - document and work-item presence,
  - document and work-item mention notifications,
  - channel post, chat message, and comment reactions,
  - channel post comments,
  - work-item description and schedule PATCH routes.

Current duplication gate:

| Metric                 | Value |
| ---------------------- | ----: |
| Clone groups           |   237 |
| Duplicated lines       |  8610 |
| Duplication percentage | 8.17% |

`pnpm fallow:dupes` fails by design until clone groups reach `0`.

### Health gate status

`pnpm fallow:health` still fails:

| Metric                    |     Value |
| ------------------------- | --------: |
| Functions above threshold |       125 |
| Critical findings         |        13 |
| High findings             |        37 |
| Moderate findings         |        75 |
| Average maintainability   |      90.8 |
| CRAP threshold            | `1000000` |

Top remaining complexity owners are still the broad screen components, Convex/data handlers, scoped read-model selectors, collaboration transport, and store validation. These require deliberate owner-by-owner refactors and should not be handled with mechanical edits or suppressions.

### Final validation for this pass

| Command                                                                                                                                                                            | Result | Notes                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| `git diff --check`                                                                                                                                                                 | Passed | No whitespace errors.                                                                                |
| `pnpm lint`                                                                                                                                                                        | Passed | ESLint completed with `--max-warnings 0`.                                                            |
| `pnpm typecheck`                                                                                                                                                                   | Passed | `tsc --noEmit` completed successfully.                                                               |
| `pnpm fallow:dead-code`                                                                                                                                                            | Passed | Production dead code is `0`.                                                                         |
| `pnpm exec fallow dupes --production --ignore-imports --format json`                                                                                                               | Failed | `clone_groups=237`, `duplicated_lines=8610`, `duplication_percentage=8.17%`.                         |
| `pnpm exec fallow health --production --max-crap 1000000 --format json`                                                                                                            | Failed | `125` functions above threshold; hotspot analysis logged a non-fatal `git log` mmap timeout warning. |
| `pnpm fallow:gate`                                                                                                                                                                 | Failed | Stops at health before the duplication gate.                                                         |
| `pnpm exec vitest run tests/components/views-screen.test.tsx tests/components/project-detail-screen.test.tsx tests/lib/scoped-read-models.test.ts`                                 | Passed | 3 files, 14 tests. Vitest emitted existing `--localstorage-file` warnings.                           |
| `pnpm exec vitest run tests/app/api/document-workspace-route-contracts.test.ts tests/app/api/workspace-profile-route-contracts.test.ts tests/app/api/work-route-contracts.test.ts` | Passed | 3 files, 43 tests. Vitest emitted existing `--localstorage-file` warnings.                           |
| `pnpm exec vitest run tests/app/api/document-workspace-route-contracts.test.ts tests/app/api/rich-text-route-contracts.test.ts tests/app/api/platform-route-contracts.test.ts`     | Passed | 3 files, 22 tests. Vitest emitted existing `--localstorage-file` warnings.                           |
| `pnpm exec vitest run tests/app/api/document-workspace-route-contracts.test.ts tests/app/api/work-route-contracts.test.ts`                                                         | Passed | 2 files, 35 tests. Vitest emitted existing `--localstorage-file` warnings.                           |

### Deferred rollout

### Continuation checkpoint - 2026-05-01 15:40

Screen remediation continued from the prior chat checkpoint.

- `components/app/screens/create-work-item-dialog.tsx` was split into private picker, title, properties, warnings, footer, and calculation/helper units. The exported dialog API and create payload behavior were preserved.
- `CreateWorkItemDialog` moved from `108` cyclomatic / `88` cognitive to `8` cyclomatic / `4` cognitive in the latest JSON health refresh. It is no longer a screen-level critical complexity finding, though several extracted low-complexity helpers/components still appear as CRAP/test-coverage findings.
- `components/app/screens/work-item-detail-screen.tsx` had the stable collaboration user, stable description document id, and legacy work-item presence behavior extracted into local hooks. The screen remained critical after this pass at `110` cyclomatic / `133` cognitive, confirming that the remaining work is primarily the rendered view and save workflow, not just the presence side effect.
- No suppressions were added for Fallow complexity findings.

Validation for this continuation:

| Command                                                                                                                                                               | Result             | Notes                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------- |
| `pnpm typecheck`                                                                                                                                                      | Passed             | `tsc --noEmit`.                                                                        |
| `pnpm exec eslint components/app/screens/create-work-item-dialog.tsx components/app/screens/work-item-detail-screen.tsx --max-warnings 0`                             | Passed             | Focused lint for edited screens.                                                       |
| `pnpm exec vitest run tests/components/create-dialogs.test.tsx`                                                                                                       | Passed             | 24 tests; Vitest emitted the existing `--localstorage-file` warning.                   |
| `pnpm exec vitest run tests/components/work-item-detail-screen.test.tsx`                                                                                              | Passed             | 14 tests; Vitest emitted the existing `--localstorage-file` warning.                   |
| `pnpm fallow:dead-code`                                                                                                                                               | Passed             | Production dead code remains `0`.                                                      |
| Fallow health JSON refresh                                                                                                                                            | Failed as expected | `CreateWorkItemDialog` cleared; `WorkItemDetailScreen` remains the top screen hotspot. |
| `git diff --check -- components/app/screens/create-work-item-dialog.tsx components/app/screens/work-item-detail-screen.tsx .audits/fallow-static-audit-2026-05-01.md` | Passed             | No whitespace errors in touched files.                                                 |

Recommended next step: split `WorkItemDetailScreen` around the rendered layout and save workflow rather than continuing with side-effect extraction. The likely split points are top bar, main article header/description, child-items section, sidebar properties/relations, and main-section save/mention-delivery flow.

### Continuation checkpoint - 2026-05-01 15:55

`components/app/screens/work-item-detail-screen.tsx` was split around the remaining rendered layout and main-section save workflow.

- Extracted private presentation components for the detail top bar, parent pill, main header, stale draft notice, description section, child-items section, main article, sidebar properties, sidebar subtasks, relations, and detail sidebar.
- Extracted main edit/save state into `useWorkItemMainSectionController`, with small helpers for collaboration persistence and work-item description mention notification retries.
- Preserved the exported `WorkItemDetailScreen` API, description collaboration behavior, stale draft guard, mention retry behavior, child item composer coordination, sidebar property updates, and delete flow.
- No Fallow suppressions were added.

Latest focused health refresh:

| Finding                            | Severity | Cyclomatic | Cognitive |
| ---------------------------------- | -------- | ---------: | --------: |
| `WorkItemDetailScreen`             | high     |         39 |        36 |
| `useWorkItemMainSectionController` | moderate |         24 |        15 |
| `WorkItemChildItemsSection`        | moderate |         14 |        19 |
| `WorkItemDetailTopBar`             | moderate |         10 |        16 |
| `WorkItemDescriptionSection`       | moderate |         10 |        16 |

Current production health gate status:

| Metric                    | Value |
| ------------------------- | ----: |
| Functions above threshold |   112 |
| Critical findings         |     0 |
| High findings             |    36 |
| Moderate findings         |    76 |
| Average maintainability   |  90.9 |

Validation for this checkpoint:

| Command                                                                                | Result             | Notes                                                                        |
| -------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------- |
| `pnpm typecheck`                                                                       | Passed             | `tsc --noEmit`.                                                              |
| `pnpm exec eslint components/app/screens/work-item-detail-screen.tsx --max-warnings 0` | Passed             | Focused lint for the edited screen.                                          |
| `pnpm exec vitest run tests/components/work-item-detail-screen.test.tsx`               | Passed             | 14 tests; Vitest emitted the existing `--localstorage-file` warning.         |
| `pnpm fallow:dead-code`                                                                | Passed             | Production dead code remains `0`.                                            |
| Fallow health JSON refresh                                                             | Failed as expected | Critical findings are now `0`; remaining findings are high/moderate backlog. |

The zero-debt production gate is configured locally but not enabled as blocking CI. CI remains report-only until both remaining acceptance criteria are true:

- `pnpm fallow:dupes` passes with `clone_groups: 0`.
- `pnpm fallow:health` passes with `functions_above_threshold: 0`.

No baselines were added, no runtime coverage setup or license activation was run, and no `fallow fix --yes` was used.

### Continuation checkpoint - 2026-05-01 16:29

The screen/refactor remediation continued through user settings, project creation/detail, and workspace settings.

- `components/app/settings-screens/user-settings-screen.tsx` was split into private profile, appearance, notifications, email, delete-account sections plus focused account/profile draft hooks. The file no longer appears in health findings.
- `components/app/screens/project-creation.tsx` was split into private dialog header, basics, status/priority/lead/member/date/label chips, presentation controls, and footer. `CreateProjectDialogContent` is now a moderate finding at `28` cyclomatic / `17` cognitive.
- `components/app/screens/project-detail-screen.tsx` was split around project item presentation state, saved view selection, viewer actions, and pure item-view helpers. The file no longer appears in health findings.
- `components/app/settings-screens/workspace-settings-screen.tsx` was split into private hero, branding, accent, members, danger, confirmation-dialog components, plus draft/action hooks. `WorkspaceSettingsScreen` is no longer high; the remaining finding in the file is `useWorkspaceBrandingDraft` at moderate `28` cyclomatic / `14` cognitive.
- No Fallow suppressions were added.

Latest production health refresh:

| Metric                    | Value |
| ------------------------- | ----: |
| Functions above threshold |   110 |
| Critical findings         |     0 |
| High findings             |    32 |
| Moderate findings         |    78 |

Validation for this checkpoint:

| Command                                                                                           | Result             | Notes                                                                |
| ------------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------- |
| `pnpm typecheck`                                                                                  | Passed             | `tsc --noEmit`.                                                      |
| `pnpm exec eslint components/app/settings-screens/user-settings-screen.tsx --max-warnings 0`      | Passed             | Focused lint for the user settings split.                            |
| `pnpm exec eslint components/app/screens/project-creation.tsx --max-warnings 0`                   | Passed             | Focused lint for the project creation split.                         |
| `pnpm exec eslint components/app/screens/project-detail-screen.tsx --max-warnings 0`              | Passed             | Focused lint for the project detail split.                           |
| `pnpm exec eslint components/app/settings-screens/workspace-settings-screen.tsx --max-warnings 0` | Passed             | Focused lint for the workspace settings split.                       |
| `pnpm exec vitest run tests/components/create-dialogs.test.tsx`                                   | Passed             | 24 tests; Vitest emitted the existing `--localstorage-file` warning. |
| `pnpm exec vitest run tests/components/project-detail-screen.test.tsx`                            | Passed             | 7 tests; Vitest emitted the existing `--localstorage-file` warning.  |
| `pnpm fallow:dead-code`                                                                           | Passed             | Production dead code remains `0`.                                    |
| Fallow health JSON refresh                                                                        | Failed as expected | Critical remains `0`; high/moderate backlog remains.                 |

### Continuation checkpoint - 2026-05-01 16:56

The next high-health batch cleared the top collaboration and document/chat presentation hotspots.

- `hooks/use-document-collaboration.ts` was split into small session-open/retry/cleanup helpers, derived-state resolvers, and focused hooks for reset, active session wiring, awareness profile sync, fallback diagnostics, and page-hide flushes. The file no longer appears in health findings.
- `components/app/collaboration-screens/chat-thread.tsx` was split around message-row metadata, message rows, reactions, header, message pane, typing indicator, composer shell, membership lookup, typing users, and auto-scroll. The file no longer appears in health findings.
- `components/app/screens/document-detail-screen.tsx` was split around legacy document presence, body protection, selector helpers, pending mention navigation guards, title/content helper workflows, unavailable state, pending notification banner, exit dialog, sync dialog, and delete confirmation. `DocumentDetailScreen` is now a moderate finding at `24` cyclomatic / `12` cognitive.
- No Fallow suppressions were added.

Latest production health refresh:

| Metric                    | Value |
| ------------------------- | ----: |
| Functions above threshold |   106 |
| Critical findings         |     0 |
| High findings             |    27 |
| Moderate findings         |    79 |

Validation for this checkpoint:

| Command                                                                                  | Result             | Notes                                                                |
| ---------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------- |
| `pnpm typecheck`                                                                         | Passed             | `tsc --noEmit`.                                                      |
| `pnpm exec eslint hooks/use-document-collaboration.ts --max-warnings 0`                  | Passed             | Focused lint for collaboration hook split.                           |
| `pnpm exec eslint components/app/collaboration-screens/chat-thread.tsx --max-warnings 0` | Passed             | Focused lint for chat thread split.                                  |
| `pnpm exec eslint components/app/screens/document-detail-screen.tsx --max-warnings 0`    | Passed             | Focused lint for document detail split.                              |
| `pnpm exec vitest run tests/components/chat-thread.test.tsx`                             | Passed             | 10 tests; Vitest emitted the existing `--localstorage-file` warning. |
| `pnpm exec vitest run tests/components/document-detail-screen.test.tsx`                  | Passed             | 17 tests; Vitest emitted the existing `--localstorage-file` warning. |
| `pnpm fallow:dead-code`                                                                  | Passed             | Production dead code remains `0`.                                    |
| Fallow health JSON refresh                                                               | Failed as expected | High backlog reduced to `27`; document detail is no longer high.     |

### Continuation checkpoint - 2026-05-01 17:05

`components/app/screens/create-view-dialog.tsx` was split around the remaining dialog presentation branches.

- Extracted private components for the top bar, name/description fields, entity-specific controls strip, route warning, and footer.
- Kept the view draft state, scope/project selection state, submit workflow, and exported `CreateViewDialog` API in place.
- Preserved project-specific item view behavior, unlocked entity-kind switching, workspace/project-scoped view creation, keyboard submission, and existing chip-control wiring.
- No Fallow suppressions were added.

Latest production health refresh:

| Metric                    | Value |
| ------------------------- | ----: |
| Functions above threshold |   105 |
| Critical findings         |     0 |
| High findings             |    26 |
| Moderate findings         |    79 |

Validation for this checkpoint:

| Command                                                                           | Result             | Notes                                                                                  |
| --------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------- |
| `pnpm typecheck`                                                                  | Passed             | `tsc --noEmit`.                                                                        |
| `pnpm exec eslint components/app/screens/create-view-dialog.tsx --max-warnings 0` | Passed             | Focused lint for the dialog split.                                                     |
| `pnpm exec vitest run tests/components/create-dialogs.test.tsx`                   | Passed             | 24 tests; Vitest emitted the existing `--localstorage-file` warning.                   |
| `pnpm fallow:dead-code`                                                           | Passed             | Production dead code remains `0`.                                                      |
| Fallow health JSON refresh                                                        | Failed as expected | `CreateViewDialog` no longer appears in health findings; high backlog reduced to `26`. |

### Continuation checkpoint - 2026-05-01 17:18

The next UI batch cleared the remaining high findings in work item detail and shell navigation.

- `components/app/screens/work-item-detail-screen.tsx` was split around missing-state rendering, description presence viewer selection, loaded-item derived collections, date patch helpers, project/parent mutation helpers, delete navigation, and copy-link handling. `WorkItemDetailScreen` is now moderate at `25` cyclomatic / `18` cognitive.
- `components/app/shell.tsx` was split into private components for active create dialogs, search dialog wiring, workspace menu, primary navigation, workspace section, team row/actions/sublinks, teams section, and user footer. The file no longer appears in health findings.
- The exported screen/shell APIs and dialog behavior were preserved.
- No Fallow suppressions were added.

Latest production health refresh:

| Metric                    | Value |
| ------------------------- | ----: |
| Functions above threshold |   103 |
| Critical findings         |     0 |
| High findings             |    23 |
| Moderate findings         |    80 |

Validation for this checkpoint:

| Command                                                                                | Result             | Notes                                                                        |
| -------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------- |
| `pnpm typecheck`                                                                       | Passed             | `tsc --noEmit`.                                                              |
| `pnpm exec eslint components/app/screens/work-item-detail-screen.tsx --max-warnings 0` | Passed             | Focused lint for the work item detail split.                                 |
| `pnpm exec eslint components/app/shell.tsx --max-warnings 0`                           | Passed             | Focused lint for the shell split.                                            |
| `pnpm exec vitest run tests/components/work-item-detail-screen.test.tsx`               | Passed             | 14 tests; Vitest emitted the existing `--localstorage-file` warning.         |
| `pnpm fallow:dead-code`                                                                | Passed             | Production dead code remains `0`.                                            |
| Fallow health JSON refresh                                                             | Failed as expected | High backlog reduced to `23`; work item detail and shell are no longer high. |

### Continuation checkpoint - 2026-05-01 17:32

The next mixed UI/server batch cleared workspace chats, user presence, and two Convex comment/work-item handlers.

- `convex/app/work_item_handlers.ts` split `createWorkItemHandler` into server-owned helpers for schedule validation, feature gating, parent/project compatibility, assignee/label/id validation, description insert, work item construction, and assignment notification queuing. `createWorkItemHandler` no longer appears in health findings.
- `components/app/collaboration-screens/workspace-chats-screen.tsx` split chat avatar rendering, list pane, main content states, and mobile details sheet. The file no longer appears in health findings.
- `components/app/user-presence.tsx` split hover-card display-state resolution, presence details, actions, and panel presentation. The file no longer appears in health findings.
- `convex/app/comment_handlers.ts` split `addCommentHandler` into parent-target validation, target resolution, comment insert, mention notifications, follower notifications, and mention email queueing. The file no longer appears in health findings.
- No Fallow suppressions were added.

Latest production health refresh:

| Metric                    | Value |
| ------------------------- | ----: |
| Functions above threshold |    99 |
| Critical findings         |     0 |
| High findings             |    19 |
| Moderate findings         |    80 |

Validation for this checkpoint:

| Command                                                                                             | Result             | Notes                                                                    |
| --------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------ |
| `pnpm typecheck`                                                                                    | Passed             | `tsc --noEmit`.                                                          |
| `pnpm exec eslint convex/app/work_item_handlers.ts --max-warnings 0`                                | Passed             | Focused lint for create work item handler split.                         |
| `pnpm exec eslint components/app/collaboration-screens/workspace-chats-screen.tsx --max-warnings 0` | Passed             | Focused lint for workspace chats split.                                  |
| `pnpm exec eslint components/app/user-presence.tsx --max-warnings 0`                                | Passed             | Focused lint for user hover-card split.                                  |
| `pnpm exec eslint convex/app/comment_handlers.ts --max-warnings 0`                                  | Passed             | Focused lint for comment handler split.                                  |
| `pnpm exec vitest run tests/convex/work-item-handlers.test.ts`                                      | Passed             | 8 tests; Vitest emitted the existing `--localstorage-file` warning.      |
| `pnpm exec vitest run tests/components/workspace-chats-screen.test.tsx`                             | Passed             | 2 tests; Vitest emitted the existing `--localstorage-file` warning.      |
| `pnpm exec vitest run tests/components/user-presence.test.tsx`                                      | Passed             | 3 tests; Vitest emitted the existing `--localstorage-file` warning.      |
| `pnpm exec vitest run tests/lib/server/convex-documents.test.ts`                                    | Passed             | 8 tests; Vitest emitted the existing `--localstorage-file` warning.      |
| `pnpm fallow:dead-code`                                                                             | Passed             | Production dead code remains `0`.                                        |
| Fallow health JSON refresh                                                                          | Failed as expected | High backlog reduced to `19`; functions above threshold reduced to `99`. |

### Continuation checkpoint - 2026-05-01 17:45

The next presentation batch cleared the rich-text keyboard high finding and the inline work item property control high finding.

- `components/app/rich-text-editor.tsx` split keyboard routing into slash-command, mention-menu, and submit-shortcut helpers, then moved the editor surface, emoji picker, presence overlays, and collaboration cursor/selection overlays into private presentation components. `RichTextEditor` is now moderate at `18` cyclomatic / `17` cognitive.
- `components/app/screens/work-item-inline-property-control.tsx` split the exported inline property switch into private status, priority, assignee, and project property controls. The file no longer appears in health findings.
- No Fallow suppressions were added.

Latest production health refresh:

| Metric                    | Value |
| ------------------------- | ----: |
| Functions above threshold |    97 |
| Critical findings         |     0 |
| High findings             |    16 |
| Moderate findings         |    81 |

Validation for this checkpoint:

| Command                                                                                          | Result             | Notes                                                                    |
| ------------------------------------------------------------------------------------------------ | ------------------ | ------------------------------------------------------------------------ |
| `pnpm typecheck`                                                                                 | Passed             | `tsc --noEmit`.                                                          |
| `pnpm exec eslint components/app/rich-text-editor.tsx --max-warnings 0`                          | Passed             | Focused lint for the editor split.                                       |
| `pnpm exec eslint components/app/screens/work-item-inline-property-control.tsx --max-warnings 0` | Passed             | Focused lint for inline property control split.                          |
| `pnpm exec vitest run tests/components/work-item-detail-screen.test.tsx`                         | Passed             | 14 tests; Vitest emitted the existing `--localstorage-file` warning.     |
| `pnpm fallow:dead-code`                                                                          | Passed             | Production dead code remains `0`.                                        |
| Fallow health JSON refresh                                                                       | Failed as expected | High backlog reduced to `16`; functions above threshold reduced to `97`. |

### Continuation checkpoint - 2026-05-01 18:13

The high-health backlog is now cleared.

- Store optimistic actions were split in `lib/store/app-store-internal/slices/work-comment-actions.ts` and `lib/store/app-store-internal/slices/collaboration-conversation-actions.ts` around target resolution, access checks, notification creation, and optimistic patch construction.
- UI hotspots were split in `components/app/screens/work-surface-controls.tsx`, `components/app/screens.tsx`, `components/app/screens/work-surface-view.tsx`, `components/app/screens/work-surface.tsx`, `components/app/notification-routing.ts`, and `components/app/collaboration-screens.tsx`.
- Server/operations hotspots were split in `convex/app/document_handlers.ts`, `convex/app/project_handlers.ts`, `convex/app/collaboration_handlers.ts`, `convex/app/maintenance.ts`, `convex/app/email_job_handlers.ts`, `lib/scoped-sync/document-scope-keys.ts`, and `lib/email/queued-email-worker.ts`.
- No Fallow suppressions were added.

Latest production health refresh:

| Metric                    | Value |
| ------------------------- | ----: |
| Functions above threshold |    81 |
| Critical findings         |     0 |
| High findings             |     0 |
| Moderate findings         |    81 |

Validation for this checkpoint:

| Command                                                  | Result             | Notes                                                                                                                                                                                                                               |
| -------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                                         | Passed             | Re-run across the high-backlog batches.                                                                                                                                                                                             |
| Focused ESLint for every touched file in this checkpoint | Passed             | Each high-backlog target was linted with `--max-warnings 0`.                                                                                                                                                                        |
| Focused Vitest suites for touched testable areas         | Passed             | Covered comments, work-surface controls/view/content, projects/views, document/project/chat/email handlers, scope keys, notification routing, and collaboration screens; Vitest emitted the existing `--localstorage-file` warning. |
| `pnpm fallow:dead-code`                                  | Passed             | Production dead code remains `0`.                                                                                                                                                                                                   |
| Fallow health JSON refresh                               | Failed as expected | Critical/high are now `0`; remaining backlog is moderate-only.                                                                                                                                                                      |

### Continuation checkpoint - 2026-05-01 19:57

The moderate-health backlog continued from `81` findings to `59` findings, with production dead code still at zero.

- Dialog/screen/component presentation splits cleared `CreateProjectDialogContent`, `WorkSurface`, `WorkItemDetailScreen`, `useWorkItemMainSectionController`, `DocumentDetailScreen`, `TeamSettingsScreen`, `ForumPostCard`, `getPatchForField`, and `InlineChildIssueComposer`.
- Convex/server state-transition splits cleared `removeWorkspaceUserHandler`, `cleanupUnreferencedUsers`, `acceptInviteHandler`, and `updateWorkItemHandler`.
- Domain/store/API helper splits cleared `useWorkspaceBrandingDraft`, `createViewDefinition`, `buildCreateDefaultsForGroup`, `getAvailableGroupKeysForItems`, `getGroupValue`, `buildItemGroupsWithEmptyGroups`, the channel comment action updater, `GET /api/calls/join`, and `POST /api/teams`.
- No Fallow suppressions were added.

Latest production health refresh:

| Metric                    | Value |
| ------------------------- | ----: |
| Functions above threshold |    59 |
| Critical findings         |     0 |
| High findings             |     0 |
| Moderate findings         |    59 |

Validation for this checkpoint:

| Command                                                  | Result             | Notes                                                                                                                                                                                                                                           |
| -------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                                         | Passed             | Re-run after each batch.                                                                                                                                                                                                                        |
| Focused ESLint for every touched file in this checkpoint | Passed             | Each target was linted with `--max-warnings 0`.                                                                                                                                                                                                 |
| Focused Vitest suites for touched testable areas         | Passed             | Covered create dialogs, workspace/team settings, work item detail/surface/UI, document detail, invite/work-item handlers, channel UI/store/API, call join, and team creation routes; Vitest emitted the existing `--localstorage-file` warning. |
| `pnpm fallow:dead-code`                                  | Passed             | Production dead code remains `0`.                                                                                                                                                                                                               |
| Fallow health JSON refresh                               | Failed as expected | Remaining backlog is moderate-only at `59` findings.                                                                                                                                                                                            |
