# Electron Packaged Frontend Plan

## Decision

The desktop app should be a packaged Electron frontend that renders the same
product UI as the website and calls hosted backend/API services.

This is not a simple website wrapper as the target state, and it is not a local
full-stack app for real users.

## Locked Requirements

| Requirement                     | Decision                                                                                                                                      |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Website visual parity           | Required. The desktop renderer must share the same product UI and design system as the web app.                                               |
| Offline mode                    | Out of scope for v1.                                                                                                                          |
| Hosted backend/API              | Required. Vercel API routes, Convex, PartyKit, WorkOS, Resend, and 100ms remain hosted.                                                       |
| Packaged frontend               | Required. Electron should package frontend assets once the renderer split exists.                                                             |
| Private server keys in Electron | Forbidden. WorkOS API keys, cookie encryption secrets, Convex server tokens, Resend keys, 100ms secrets, and cron secrets remain hosted only. |
| Desktop deep links              | Required for v1 if email links or auth callbacks should reopen the app.                                                                       |
| Native notifications            | Required for v1 through an Electron-controlled bridge, not broad browser notification permission.                                             |
| Local privileged backend        | Out of scope for real users. A local server is allowed only as a development or smoke-test lane.                                              |

## Target Shape

```text
Electron main process
  - window lifecycle
  - protocol/deep-link handling
  - native notification bridge
  - updater/signing integration
  - no provider secrets

Packaged renderer
  - shared app UI
  - public config only
  - calls `NEXT_PUBLIC_API_BASE_URL`
  - built into `dist/desktop-renderer` with `pnpm desktop:renderer:build`

Hosted Vercel app/API
  - WorkOS callback/session issuance
  - desktop browser auth handoff through `DESKTOP_WORKOS_REDIRECT_URI`
  - desktop session signing through server-only `DESKTOP_SESSION_SECRET`
  - API routes requiring server credentials
  - explicit desktop CORS/origin allowlist
  - email/video/provider adapters

Hosted services
  - Convex system of record
  - PartyKit collaboration runtime
  - WorkOS identity
  - Resend email
  - 100ms video
```

## Key Handling Rule

The Electron build can contain public config such as a hosted API base URL,
public Convex URL, public PartyKit URL, and WorkOS client-facing URLs.

The Electron build must not contain server credentials. Building locally with
secrets does not make them safe; anything shipped inside the app can be
extracted by users.

## Auth And Session Spike

The highest-risk unknown is session transport between a packaged frontend origin
and hosted Vercel routes.

The current Next/AuthKit web flow is cookie-oriented and optimized for a hosted
web origin. A packaged renderer cannot assume those cookies will attach to
hosted API calls unless the origin model is deliberately designed and tested.

Preferred spike:

1. Use a system browser or trusted hosted page for WorkOS authentication.
2. Complete WorkOS callback on hosted Vercel.
3. Issue a desktop-specific user session or token from hosted Vercel.
4. Store only user-scoped session material in Electron.
5. Authenticate desktop API requests to hosted Vercel with that user-scoped material.
6. Persist the desktop token through Electron `safeStorage` when OS encryption
   is available, and fall back to memory-only storage when it is not.
7. Keep the visible auth UI shared, but switch provider links to the hosted
   desktop callback flow when the renderer is running in Electron.

Alternative spike:

1. Serve packaged assets under the production origin through Electron protocol
   interception.
2. Preserve same-origin cookie semantics with the hosted app.
3. Prove this does not break updates, caching, redirects, CSP, or provider auth.

The preferred spike is clearer operationally. The protocol-interception
alternative should only win if it proves materially simpler and safer in a
working prototype.

## Implementation Sequence

1. Harden current Electron runtime defaults.
   - Do not auto-start a local standalone Next server for packaged apps.
   - Keep generic web URL env vars from silently controlling Electron.
   - Deny unexpected renderer permission prompts by default.
   - Prevent embedded webviews.
2. Create the renderer/API contract.
   - Use `NEXT_PUBLIC_API_BASE_URL` as the public desktop API base URL.
   - Ensure browser calls that currently assume same-origin can call hosted Vercel.
   - Use `DESKTOP_API_ALLOWED_ORIGINS` to allow only selected desktop renderer origins.
   - Keep API routes as the only place server secrets are used.
3. Prove desktop auth.
   - Implement the WorkOS desktop callback/session spike.
   - Exchange a short-lived hosted handoff ticket for a desktop session token.
   - Keep `DESKTOP_SESSION_SECRET` hosted only; never bundle it in Electron.
   - Add WorkOS redirect entries for desktop callback/deep-link flow if selected.
   - Register `DESKTOP_DEEP_LINK_SCHEME` in Electron packages.
   - Add tests for callback replay, token expiry, logout, and revoked sessions.
4. Package the frontend renderer.
   - Run `pnpm desktop:renderer:readiness` to keep coverage explicit.
   - Build the desktop-specific client bundle into `dist/desktop-renderer`.
   - Use `DESKTOP_RENDERER_MODE=packaged` to package those assets.
   - Fail packaging if packaged mode is requested before
     `dist/desktop-renderer/index.html` exists.
   - Load those assets from Electron without changing app visuals.
   - Keep `desktop:dev` as a fast local development lane.
5. Add desktop-native features.
   - Deep links for email/auth reopen behavior.
   - Native notifications through a narrow preload/main-process API.
   - Auto-update, signing, notarization, crash/log capture.
6. Add release verification.
   - Desktop smoke against packaged renderer.
   - Auth login/logout smoke.
   - Hosted API smoke.
   - Deep-link and notification smoke.
   - Visual parity screenshots for representative app screens.

## Coverage Gate

Before calling the desktop architecture complete, every row below needs either
implementation evidence or an explicit accepted exclusion.

| Area                   | Required Evidence                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Visual parity          | Packaged desktop screenshots match representative hosted web screens at desktop window sizes.                                        |
| Renderer mode          | Hosted transition packages are explicit; packaged renderer packages must load local `desktop-renderer/index.html`.                   |
| Renderer readiness     | Current blockers are repeatable through `pnpm desktop:renderer:readiness`.                                                           |
| API routing            | Packaged renderer calls hosted Vercel API routes through an explicit base URL contract.                                              |
| CORS/origin policy     | Hosted API routes allow only the selected desktop renderer origin and never use wildcard credentialed CORS.                          |
| Secret handling        | Build/package inspection shows no server-only env values or provider private keys in Electron artifacts.                             |
| WorkOS auth            | Login, callback, logout, expired session, and revoked session flows work from desktop.                                               |
| Desktop session tokens | Hosted callback issues only short-lived handoff tickets; desktop APIs accept user-scoped bearer tokens signed by hosted-only secret. |
| WorkOS redirects       | WorkOS contains the production web callback plus any selected desktop callback/deep-link redirect.                                   |
| Deep-link registration | Packaged Electron app registers `DESKTOP_DEEP_LINK_SCHEME` and handles cold-start and already-running links.                         |
| Session storage        | Desktop stores only user-scoped session material and can clear it on logout.                                                         |
| Convex                 | Desktop uses public Convex client config only; privileged Convex operations stay hosted.                                             |
| PartyKit               | Desktop uses public hosted PartyKit URL and hosted-issued collaboration tokens.                                                      |
| Resend and 100ms       | Desktop reaches these integrations only through hosted API routes.                                                                   |
| Deep links             | Email/auth links can reopen the desktop app when required.                                                                           |
| Native notifications   | Notifications are issued through a narrow Electron bridge with denied-by-default renderer permissions.                               |
| Offline behavior       | Confirmed excluded for v1, with no misleading local persistence promises.                                                            |
| Updates and signing    | macOS package is signed/notarized or explicitly marked internal-only; update path is owned.                                          |
| Release smoke          | Packaged app smoke covers launch, auth, hosted API, deep link, notification, and visual checks.                                      |

## Current Transition State

The repo now has a packaged renderer build lane:

```bash
pnpm desktop:renderer:build
pnpm desktop:package:mac:packaged-renderer
pnpm desktop:renderer:readiness
pnpm desktop:release:preflight
```

The local standalone path remains useful for development verification, but it
is not the real-user target. The remaining completion work is release-grade
visual parity screenshots, signing/notarization, updater ownership, and
provider-side WorkOS/CORS configuration verification.

`pnpm desktop:release:preflight` inspects the built app, packaged renderer,
macOS Info.plist, signing state, secret leakage, hosted env contract, and
update-path ownership. Normal mode fails only on local provable blockers.
Run with `DESKTOP_RELEASE_STRICT=1` before shipping to treat warnings and
pending provider/manual checks as release blockers.

Release macOS packaging is signed and notarized by default. A release build
must be produced with Developer ID signing and notarization credentials:

```bash
pnpm desktop:release:mac
```

`DESKTOP_RELEASE=1` fails fast unless Apple notarization credentials are
available through one of electron-builder's supported credential sets.

The package script keeps server secrets out of Electron. It only accepts public
renderer config at build time; WorkOS API keys, desktop session signing secrets,
email/video provider secrets, and privileged Convex credentials must stay in
hosted Vercel/provider environments.
