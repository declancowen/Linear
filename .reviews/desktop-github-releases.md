# Desktop GitHub Releases Review

## Review Status

| Field         | Value                |
| ------------- | -------------------- |
| Last reviewed | 2026-05-22 12:54 BST |
| Total turns   | 1                    |
| Open findings | 0                    |

## Hotspots

- macOS update feed requires both GitHub release assets and packaged `app-update.yml`.
- Public macOS auto-install still requires Developer ID signing and notarization.
- Desktop/web compatibility depends on hosted API contract compatibility across at least one previous desktop release.

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
