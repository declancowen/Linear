# Desktop GitHub Releases Review

## Review Status

| Field         | Value                |
| ------------- | -------------------- |
| Last reviewed | 2026-05-22 13:39 BST |
| Total turns   | 3                    |
| Open findings | 0                    |

## Hotspots

- macOS update feed requires both GitHub release assets and packaged `app-update.yml`.
- Public macOS auto-install still requires Developer ID signing and notarization.
- Desktop/web compatibility depends on hosted API contract compatibility across at least one previous desktop release.
- Mac release artifacts must stay pinned to the stable arm64 asset contract until universal/x64 distribution is intentionally designed.
- Draft and prerelease publishes must not take over the stable `/releases/latest/...` download URL.

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
