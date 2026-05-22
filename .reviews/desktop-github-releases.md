# Desktop GitHub Releases Review

## Review Status

| Field         | Value                |
| ------------- | -------------------- |
| Last reviewed | 2026-05-22 14:30 BST |
| Total turns   | 6                    |
| Open findings | 0                    |

## Hotspots

- macOS update feed requires both GitHub release assets and packaged `app-update.yml`.
- Public macOS auto-install still requires Developer ID signing and notarization.
- Desktop/web compatibility depends on hosted API contract compatibility across at least one previous desktop release.
- Mac release artifacts must stay pinned to the stable arm64 asset contract until universal/x64 distribution is intentionally designed.
- Draft and prerelease publishes must not take over the stable `/releases/latest/...` download URL.
- Server-side minimum-version policy must treat prerelease app versions as lower precedence than matching stable versions.
- Manual update failures must force the persistent desktop update toast back into view.
- Startup update-policy enforcement must not be skipped by a failed, non-policy Electron IPC call.
- Existing-release edits must explicitly clear draft/prerelease state when publishing stable builds.
- The web download CTA must not advertise arm64-only artifacts to unsupported or unknown Mac architectures.

## Turn 6 - 2026-05-22 14:30 BST

**Outcome:** No open Critical/High findings after importing the latest Codex PR review and fixing the live desktop-download eligibility bug.

**Risk:** Medium. The bug was a user-facing distribution compatibility issue for Intel Macs, not an update-security or server-secret boundary.

**Archetypes:** external PR finding import, browser capability detection, release artifact compatibility, workspace menu CTA gating.

**Finding import:**

| Source          | Finding                                                                                 | Current status | Bug class                         | Missed invariant / variant                                                          | Action                                                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------- | -------------- | --------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Codex PR review | The desktop download CTA appeared for any macOS browser despite arm64-only Mac artifacts | Resolved       | Contract Encoding / Compatibility | Web download eligibility must match the published Mac artifact architecture contract | CTA now requires a positive Apple Silicon signal from user-agent client hints or explicit arm64/aarch64 UA text, and excludes iPad/Electron. |

**Architecture review:** The release artifact contract remains arm64-only. The browser shell now delegates eligibility to `lib/browser/desktop-download-eligibility.ts`, keeping architecture detection separate from workspace menu rendering. Unknown Mac architecture is treated as unsupported rather than risking an incompatible installer.

**Branch-totality and sibling closure:** Rechecked the workspace dropdown CTA path, Electron exclusion, iPad desktop-UA exclusion, Intel Mac rejection, Apple Silicon acceptance, and the earlier arm64 artifact contract thread.

**Static/analyzer evidence:** `diff-review` preflight and `fallow audit --changed-since origin/main --format compact --quiet` were rerun. Fallow still reports the pre-existing intra-package-script clone group and advisory complexity in release/update code; CI treats Fallow as advisory. The new eligibility helper did not add clone findings.

**Verification:**

- `pnpm vitest run tests/lib/browser/desktop-download-eligibility.test.ts`
- `pnpm vitest run tests/lib/browser/desktop-download-eligibility.test.ts tests/components/desktop-update-controller.test.tsx tests/scripts/publish-electron-github-release.test.ts tests/lib/desktop-update-policy.test.ts tests/electron/desktop-updates.test.ts`
- `pnpm exec eslint components/app/shell.tsx lib/browser/desktop-download-eligibility.ts tests/lib/browser/desktop-download-eligibility.test.ts --max-warnings 0`
- `pnpm lint`
- `pnpm typecheck`
- `git diff --check`
- `~/.codex/skills/diff-review/scripts/review-preflight.sh`
- `pnpm exec fallow audit --changed-since origin/main --format compact --quiet`

**Residual risk:** Safari and other browsers that do not expose architecture may hide the CTA on Apple Silicon until we either ship a universal artifact or add a stronger supported detection path. This is intentional for the current arm64-only release contract.

## Turn 5 - 2026-05-22 14:15 BST

**Outcome:** No open Critical/High findings after importing the latest Codex PR review and fixing the two live release/update-policy findings.

**Risk:** High. The findings touched startup enforcement of the server-driven minimum desktop version and the stable GitHub Release channel state.

**Archetypes:** external PR finding import, startup IPC partial failure, compatibility policy enforcement, GitHub Release state contract, analyzer cleanup.

**Finding import:**

| Source          | Finding                                                                                                      | Current status | Bug class                                          | Missed invariant / variant                                                                                         | Action                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------ | -------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codex PR review | `loadInitialState` used `Promise.all`, so a failed `getUpdateState` IPC skipped policy fetch/version gating | Resolved       | Lifecycle And Transient Containers / Compatibility | Non-policy updater IPC failures must not disable the hosted minimum-version gate                                    | Desktop app-info and update-state startup reads now fail independently; policy fetch still runs, and missing app-info with a minimum policy fails closed.    |
| Codex PR review | Existing release edits did not send `--draft=false` / `--prerelease=false` for stable publishes              | Resolved       | Contract Encoding / Compatibility                  | Re-running the publisher for a stable tag must clear prior draft/prerelease state so stable auto-updaters can see it | Existing-release edits now emit explicit false flags for stable state, while draft/prerelease publishes still avoid GitHub latest.                            |
| Codex PR review | Arm64 release build thread remains unresolved in GitHub UI                                                   | Already fixed  | Contract Encoding / Compatibility                  | Stable artifact names and builder architecture must match                                                           | Current `scripts/package-electron-mac.mjs` still passes `--arm64`; no new code change needed.                                                               |

**Architecture review:** Startup compatibility policy remains a hosted API decision rendered by the app-level desktop controller. Electron IPC is treated as an unreliable transport at startup, so update-state failure no longer blocks policy enforcement. Release channel ownership remains in the publisher script; Electron updater clients still consume the stable GitHub release channel only.

**Branch-totality and sibling closure:** Rechecked desktop controller startup, unsupported-version rendering with app-info present/missing, update-state toast handling, release create/edit command construction, and the stale/open PR threads from earlier turns.

**Static/analyzer evidence:** `diff-review` preflight and `fallow audit --changed-since origin/main --format compact --quiet` were rerun. A newly introduced duplicate test setup block was removed, and the publisher no longer clones the package script's spawn/capture helper. Fallow still reports the pre-existing intra-package-script clone group and advisory complexity in release/update code; CI treats Fallow as advisory.

**Verification:**

- `pnpm vitest run tests/components/desktop-update-controller.test.tsx tests/scripts/publish-electron-github-release.test.ts`
- `pnpm vitest run tests/components/desktop-update-controller.test.tsx tests/scripts/publish-electron-github-release.test.ts tests/lib/desktop-update-policy.test.ts tests/electron/desktop-updates.test.ts`
- `pnpm exec eslint components/app/desktop-update-controller.tsx tests/components/desktop-update-controller.test.tsx scripts/publish-electron-github-release.mjs tests/scripts/publish-electron-github-release.test.ts --max-warnings 0`
- `pnpm lint`
- `pnpm typecheck`
- `git diff --check`
- `~/.codex/skills/diff-review/scripts/review-preflight.sh`
- `pnpm exec fallow audit --changed-since origin/main --format compact --quiet`

**Residual risk:** No Electron app was rebuilt and no GitHub Release was published in this feedback loop, per the merge-first release plan. Final release validation remains post-merge work from merged `main`.

## Turn 4 - 2026-05-22 13:54 BST

**Outcome:** No open Critical/High findings after importing the latest Codex PR review and fixing the two live compatibility/update-feedback issues.

**Risk:** High. The findings touched the minimum supported desktop version gate and the user-visible recovery path for failed manual updater actions.

**Archetypes:** external PR finding import, semver compatibility, renderer/main-process IPC feedback, persistent update notification recovery.

**Finding import:**

| Source          | Finding                                                                                        | Current status | Bug class                                          | Missed invariant / variant                                                                                   | Action                                                                                                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codex PR review | Prerelease app versions like `1.2.0-beta.1` compared as newer than `1.2.0`                     | Resolved       | Contract Encoding / Compatibility                  | A prerelease for the same core version must remain below the stable release in the hosted compatibility gate | Replaced the numeric-fragment parser with semver-style core/prerelease comparison and added regression coverage for prerelease, numeric prerelease ordering, and build metadata. |
| Codex PR review | Renderer-triggered Download/Restart failures moved update state to `error` without `showToast` | Resolved       | Lifecycle And Transient Containers / Compatibility | Failed manual update actions must reopen the persistent toast so users keep a recovery/download path         | Main-process download/install handlers now force-broadcast error results with `showToast: true`; update manager tests cover failed manual actions requiring visible feedback.    |

**Architecture review:** Version precedence remains in the pure desktop update-policy module used by the hosted policy UI. Manual updater feedback remains in the Electron infrastructure boundary: the manager owns update state, and `electron/main.cjs` owns renderer IPC broadcasts.

**Branch-totality and sibling closure:** Rechecked policy comparison, unsupported-version gating, download and install IPC handlers, manager error states, toast force semantics, and the prior release-channel findings. Earlier publisher feedback is now outdated/fixed in GitHub thread state; the arm64 thread still appears unresolved in GitHub UI but is fixed in current code.

**Static/analyzer evidence:** `diff-review` preflight and `fallow audit --changed-since origin/main --format compact --quiet` were rerun. A new duplicate test setup block was removed. Fallow still reports existing release-script clone groups and advisory complexity in release/update code; CI treats Fallow as advisory.

**Verification:**

- `pnpm vitest run tests/lib/desktop-update-policy.test.ts tests/electron/desktop-updates.test.ts tests/scripts/publish-electron-github-release.test.ts`
- `pnpm vitest run tests/electron/desktop-updates.test.ts tests/lib/desktop-update-policy.test.ts`
- `pnpm exec eslint lib/desktop/update-policy.ts tests/lib/desktop-update-policy.test.ts electron/desktop-updates.cjs electron/main.cjs tests/electron/desktop-updates.test.ts --max-warnings 0`
- `pnpm lint`
- `pnpm typecheck`
- `git diff --check`
- `~/.codex/skills/diff-review/scripts/review-preflight.sh`
- `pnpm exec fallow audit --changed-since origin/main --format compact --quiet`

**Residual risk:** No release was published and no Electron app was rebuilt in this feedback loop. Final release validation and artifact publication remain post-merge work from merged `main`.

## Turn 3 - 2026-05-22 13:39 BST

**Outcome:** No open Critical/High findings after importing the latest Codex PR review and fixing the live publisher issue.

**Risk:** High. The new finding affected the public stable download/update URL contract.

**Archetypes:** external PR finding import, release channel contract, publisher script hardening, documentation/policy alignment.

**Finding import:**

| Source          | Finding                                                                                                     | Current status | Bug class                         | Missed invariant / variant                                                            | Action                                                                                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codex PR review | `--prerelease` publishes still passed `--latest`, allowing RC/beta builds to become GitHub's latest release | Resolved       | Contract Encoding / Compatibility | Stable `/releases/latest/...` must never point at a draft or prerelease desktop build | Publisher now emits `--latest=false` for draft/prerelease creates and existing-release edits, keeps `--latest` only for stable releases, and has dry-run regression coverage. |

**Architecture review:** Release-channel policy remains owned by the publisher script and release policy document. The app/updater code still depends on a single stable latest URL; prerelease channel support is not introduced by this branch.

**Branch-totality and sibling closure:** Rechecked new-release create, existing-release upload/edit, docs, and release policy. The earlier app-info finding is outdated/fixed in current GitHub thread state; the arm64 thread is still unresolved in GitHub UI but current code now passes `--arm64`.

**Static/analyzer evidence:** `diff-review` preflight was rerun after this fix. Fallow remains advisory on this branch; the current turn does not add meaningful branch pressure beyond two small argument builders in the publisher script.

**Verification:**

- `pnpm vitest run tests/scripts/publish-electron-github-release.test.ts tests/lib/browser/desktop-auth-token.test.ts tests/lib/desktop-update-policy.test.ts`
- `pnpm vitest run tests/scripts/publish-electron-github-release.test.ts`
- `pnpm exec eslint scripts/publish-electron-github-release.mjs tests/scripts/publish-electron-github-release.test.ts --max-warnings 0`
- `pnpm lint`
- `pnpm typecheck`
- `node scripts/publish-electron-github-release.mjs --dry-run --prerelease --output-dir dist/electron --version 9.9.9`
- `git diff --check`
- `~/.codex/skills/diff-review/scripts/review-preflight.sh`

**Residual risk:** No release was published and no Electron app was rebuilt in this feedback loop. The final release artifact should still be rebuilt from merged `main` before publishing.

## Turn 2 - 2026-05-22 13:24 BST

**Outcome:** No open Critical/High findings after importing the Codex PR review and fixing the two live review items.

**Risk:** High. The external findings touched the macOS release contract and the desktop/API compatibility headers that support server-driven minimum-version policy.

**Archetypes:** external PR finding import, release artifact contract, transient IPC failure recovery, desktop/web compatibility, operational preflight.

**Finding import:**

| Source          | Finding                                                                                                              | Current status | Bug class                                          | Missed invariant / variant                                                                              | Action                                                                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codex PR review | Release packaging used `--mac` without an explicit architecture while public asset names and URLs are arm64-specific | Resolved       | Contract Encoding / Compatibility                  | The published artifact architecture must match the stable updater/download contract on every build host | Added `--arm64` to the `electron-builder` invocation and rebuilt the release path once to confirm `arch=arm64` artifacts.                          |
| Codex PR review | A transient `getDesktopAppInfo()` bridge rejection cached a rejected promise for the rest of the session             | Resolved       | Lifecycle And Transient Containers / Compatibility | Desktop version/platform header discovery must retry after transient IPC failure                        | Reset the cached app-info promise on rejection and added a regression test proving the second request recovers and sends version/platform headers. |

**Architecture review:** The arm64 guarantee belongs in the packaging script because the script owns the release artifact contract. The retry fix stays in `lib/browser/desktop-auth-token.ts`, the narrow browser bridge boundary that assembles desktop API headers. No server secrets or update policy rules moved into the Electron bundle.

**Branch-totality and sibling closure:** Rechecked the release script, publisher/preflight expectations, desktop update policy headers, preload app-info IPC shape, and the prior desktop GitHub release hotspots. The same app-info helper is used by route mutations and fetch-backed event streams, so both recover from the retry fix.

**Static/analyzer evidence:** `diff-review` and `architecture-standards` preflights were rerun. `fallow audit --changed-since origin/main` still reports advisory complexity/duplication in the broader desktop release scripts and Electron main process; this is not a zero-static-debt branch, and CI currently treats Fallow as advisory (`continue-on-error`). The latest PR review fixes did not add new branchy logic beyond resetting the cached promise on failure and pinning the builder architecture.

**Verification:**

- `pnpm vitest run tests/lib/browser/desktop-auth-token.test.ts tests/electron/desktop-updates.test.ts tests/desktop/renderer-smoke.test.tsx tests/lib/desktop-update-policy.test.ts`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm desktop:release:mac` - ran once before the merge-only rebuild policy was clarified; confirmed electron-builder used `arch=arm64` and emitted the stable `Recipe-Room-mac-arm64.*` artifacts.
- `DESKTOP_RELEASE_ARTIFACTS=1 pnpm desktop:release:preflight`
- `pnpm build`
- `git diff --check`
- `~/.codex/skills/diff-review/scripts/review-preflight.sh`
- `~/.codex/skills/architecture-standards/scripts/architecture-preflight.sh`
- `pnpm exec fallow audit --changed-since origin/main --format compact --quiet`

**Residual risk:** No GitHub Release was published and no final Electron distribution artifact should be treated as release-ready until after PR merge and a fresh main-branch rebuild. Preflight still reports the expected public-release pending items for Developer ID signing, Gatekeeper acceptance, notarization, and hosted/dashboard checks.

## Turn 1 - 2026-05-22 12:54 BST

**Outcome:** No blocking findings found in the current local diff.

**Risk:** High. This changes Electron runtime update behavior, release artifacts, hosted API compatibility policy, and a small web download surface.

**Archetypes:** desktop release/distribution, public API contract, compatibility fallback, shared UI notification surface, operational preflight.

**Intent vs actual:** The branch adds GitHub Release-backed macOS artifacts (`DMG`, `ZIP`, `latest-mac.yml`), packaged `electron-updater` wiring, app-menu update checks, persistent in-app update toasts, a server-driven minimum desktop version policy, stable Mac download link placement in the workspace dropdown, and release/publish/preflight scripts.

**Architecture review:** Update ownership stays in the Electron infrastructure boundary (`electron/desktop-updates.cjs`, main/preload IPC). Desktop/web compatibility policy lives at the hosted API edge (`/api/desktop/update-policy`) with pure version comparison in `lib/desktop/update-policy.ts`. UI notification rendering stays in an app-level controller rather than screen-specific components. Release artifact checks are encoded in the package script and preflight.

**Invariants checked:**

- Packaged app must include `electron-updater` and `electron/desktop-updates.cjs`.
- GitHub latest download URL must remain stable across releases.
- Publisher must upload only DMG, ZIP, blockmaps, and `latest-mac.yml`, not builder debug files.
- Menu-triggered update checks must reopen the relevant persistent state after the user closes a toast.
- A blocked desktop version must still offer update/download actions without bundling server secrets.
- Desktop API requests identify client version/platform without exposing private keys.

**Verification:**

- `pnpm lint`
- `pnpm typecheck`
- `pnpm vitest run tests/electron/desktop-updates.test.ts tests/electron/navigation-policy.test.ts tests/desktop/renderer-smoke.test.tsx tests/lib/desktop-update-policy.test.ts`
- `pnpm build`
- `pnpm desktop:release:mac`
- `node scripts/publish-electron-github-release.mjs --dry-run`
- `DESKTOP_RELEASE_ARTIFACTS=1 pnpm desktop:release:preflight`
- `git diff --check`
- Manual `app.asar` inspection confirmed `/node_modules/electron-updater`, `/electron/desktop-updates.cjs`, and `/electron/main.cjs` are packaged.

**Residual risk:** Preflight still reports expected public-release pending items for Developer ID signing, Gatekeeper acceptance, notarization, and locally unavailable hosted env/dashboard verification. Already-installed desktop builds older than this code cannot display the new minimum-version blocking dialog until they update once.
