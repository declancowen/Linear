# Desktop GitHub Releases

Recipe Room desktop is a packaged Electron frontend that calls the hosted Recipe Room API, Convex, PartyKit, and WorkOS services. Desktop releases are distributed through GitHub Releases.

## Release Flow

1. Bump `package.json` version for a new desktop release.
2. Create and push a stable tag such as `v0.0.2`, or run the `Desktop Release`
   workflow manually with that version.

The GitHub workflow builds a signed and notarized macOS release, runs release
preflight, and publishes the GitHub Release assets.

Local releases use the same build path:

```bash
DESKTOP_UPDATE_REPOSITORY=declancowen/Linear pnpm desktop:release:mac
node scripts/publish-electron-github-release.mjs
```

`pnpm desktop:release:mac` sets `DESKTOP_RELEASE=1`, so it fails unless Apple
signing and notarization credentials are available. This is intentional:
macOS auto-update installation requires Developer ID signing, and the stable
app signature also gives Electron safeStorage a consistent app identity for
persisted desktop auth.

The release build writes these assets to `dist/electron`:

- `Recipe-Room-mac-arm64.dmg`
- `Recipe-Room-mac-arm64.dmg.blockmap`
- `Recipe-Room-mac-arm64.zip`
- `Recipe-Room-mac-arm64.zip.blockmap`
- `latest-mac.yml`

The publish script creates or updates the `v<version>` GitHub Release and uploads those assets with `--clobber`. Stable releases are marked as GitHub's latest release. Drafts and prereleases explicitly use `--latest=false` so `/releases/latest/...` continues to point at the stable desktop build.

The stable public download URL is:

```text
https://github.com/declancowen/Linear/releases/latest/download/Recipe-Room-mac-arm64.dmg
```

Override it with `NEXT_PUBLIC_DESKTOP_MAC_DOWNLOAD_URL` if the download should move behind a redirect or a different release host.

## Update Checks

The packaged app includes `electron-updater` and a generated `app-update.yml` pointing at the GitHub release feed. The macOS app menu has `Check for Updates...`.

Update state is shown inside the app with persistent bottom-right toasts:

- update available: user can close or download
- downloading: stays visible while download is active
- downloaded: user can close or restart to install
- checking again reopens the relevant state if the user closed the toast

Unsigned/ad-hoc builds can verify local packaging, but public auto-update
installation on macOS requires Developer ID signing and notarization.

## macOS Signing Secrets

Configure these GitHub Actions secrets before running `Desktop Release`:

- `CSC_LINK`: base64-encoded Developer ID Application certificate (`.p12`)
- `CSC_KEY_PASSWORD`: password for the `.p12`
- `APPLE_API_KEY`: App Store Connect API key contents (`.p8`)
- `APPLE_API_KEY_ID`: App Store Connect key ID
- `APPLE_API_ISSUER`: App Store Connect issuer ID

## Desktop/Web Compatibility

The desktop app ships its own frontend bundle, but it calls the current hosted API and realtime services. That means old desktop builds can continue across web deploys only while hosted API/data contracts remain backward-compatible.

To intentionally block an incompatible old desktop build, set this hosted environment variable:

```text
DESKTOP_MIN_SUPPORTED_VERSION=<minimum desktop version>
```

The desktop app polls `/api/desktop/update-policy`. If its packaged version is below that minimum, it shows a blocking dialog with update/download actions. Desktop API requests also include:

- `X-Recipe-Room-Desktop-Version`
- `X-Recipe-Room-Desktop-Platform`

Those headers let hosted routes make version-aware decisions later without bundling secrets into Electron.
