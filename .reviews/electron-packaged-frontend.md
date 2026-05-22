# Review: Electron Packaged Frontend

## Project Context

| Field | Value |
|-------|-------|
| Repository | `Linear` |
| Branch | `codex/electron-packaged-frontend` |
| Base | `origin/main` |
| Scope | Packaged Electron renderer, desktop auth handoff, hosted API/CORS, packaging and release preflight |

## Review Status

| Field | Value |
|-------|-------|
| Last reviewed | `2026-05-22 08:36 BST` |
| Risk | High |
| Open findings | `0` |
| Residual risks | Internal/ad-hoc mac signing only; desktop token persistence intentionally disabled by default pending a non-blocking keychain strategy; desktop preflight still reports hosted env/WorkOS checks as pending when those values are not visible locally |

---

## Turn 3 - 2026-05-22 08:36 BST

**Outcome:** No open Critical/High findings after importing the latest Codex PR review and re-running the branch diff/architecture pass.

**External finding addressed:**
- P2 desktop signup bypassed the desktop auth handoff. Added a hosted `/auth/desktop/signup` route that creates the WorkOS user, authenticates on the hosted server, mints the same one-time desktop handoff ticket as login, and redirects the packaged renderer back through the deep-link completion flow.

**Additional coverage fixes made during review:**
- Extracted shared server-owned signup/password logic into `lib/server/password-signup.ts` so web signup and desktop signup use the same WorkOS/session/reconcile boundary.
- Routed packaged signup form submits through the Electron bridge and added `submitDesktopPasswordSignup` IPC/preload/main-process support.
- Kept signup error/profile query serialization at the auth-routing boundary and preserved signup fields on desktop error fallback paths.
- Removed new duplication caught by the Fallow zero-duplication gate.

**Architecture pass:** WorkOS user creation, password authentication, hosted session save, app-context reconciliation, and desktop handoff ticket creation remain server-owned. Electron only posts form data to hosted Vercel routes and receives a desktop deep-link handoff; no private server keys or WorkOS secrets move into the packaged app. The serialized contract is covered at the form body, route redirect, IPC bridge, and desktop renderer levels.

**Validation:**
- `pnpm vitest run tests/electron/desktop-auth-flow.test.ts tests/desktop/renderer-smoke.test.tsx tests/app/auth-route-contracts.test.ts tests/lib/server/desktop-auth.test.ts`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test` -> `198 passed`, `1142 passed`
- `pnpm fallow:gate`
- `pnpm desktop:renderer:smoke`
- `pnpm build`
- `pnpm desktop:package:mac:packaged-renderer`
- `pnpm desktop:release:preflight` -> `19 pass, 0 warn, 7 pending, 0 fail`
- `node --env-file=/Users/declancowen/Documents/GitHub/Linear/.env.local scripts/desktop-release-preflight.mjs` -> `20 pass, 0 warn, 6 pending, 0 fail`
- `~/.codex/skills/diff-review/scripts/review-preflight.sh`
- `~/.codex/skills/architecture-standards/scripts/architecture-preflight.sh`

---

## Turn 2 - 2026-05-22 07:58 BST

**Outcome:** No open Critical/High findings after importing the Codex review and rerunning the branch diff/architecture pass.

**External findings addressed:**
- P1 desktop handoff tickets were replayable inside their TTL. Added Convex-backed one-time ticket consumption keyed by handoff `jti`, with expired-ticket cleanup and route-level unavailable handling.
- P2 fetch-backed desktop SSE streams stopped after transient disconnects. Added retry scheduling with per-attempt abort controllers and a reconnect regression test.

**Additional coverage fixes made during review:**
- Project detail no longer flashes `Project not found` before the scoped read model finishes loading.
- Workspace project detail read models now include owning workspace/team context and only aggregate items from teams the viewer can access in that workspace.
- Workspace project indexes and workspace view catalogs now exclude inaccessible teamspaces and accessible teams from other workspaces.

**Architecture pass:** Server-only desktop ticket consumption remains behind `lib/server/convex/auth.ts` and a Convex server-token mutation; Electron/renderer code still receives no server secrets. Scoped read-model access filtering stays centralized in `lib/scoped-sync/read-models.ts`, with route contracts and selector tests covering workspace aggregation boundaries.

**Validation:**
- `pnpm convex:codegen`
- `pnpm vitest run tests/lib/server/desktop-session.test.ts tests/lib/server/route-auth.test.ts tests/app/auth-route-contracts.test.ts tests/lib/browser/authenticated-event-source.test.ts tests/components/project-detail-screen.test.tsx tests/lib/scoped-read-models.test.ts tests/app/api/read-model-route-contracts.test.ts`
- `pnpm vitest run tests/lib/scoped-read-models.test.ts tests/app/api/read-model-route-contracts.test.ts tests/lib/domain/view-directory.test.ts`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test` -> `198 passed`, `1137 passed`
- `pnpm build`
- `pnpm fallow:gate`
- `pnpm desktop:renderer:smoke`
- `pnpm desktop:package:mac:packaged-renderer`
- `pnpm desktop:release:preflight` -> `19 pass, 0 warn, 7 pending, 0 fail`
- `node --env-file=/Users/declancowen/Documents/GitHub/Linear/.env.local scripts/desktop-release-preflight.mjs` -> `20 pass, 0 warn, 6 pending, 0 fail`

---

## Turn 1 - 2026-05-21 20:17 BST

**Outcome:** No open Critical/High findings after branch-total review and fixes.

**Architecture pass:** Server-owned WorkOS/password/session code now lives behind shared server helpers; browser desktop completion is shared through `lib/browser/desktop-auth-complete.ts`; Electron owns protocol/window/native notification boundaries; Vite-only desktop adapter entry points are modeled in `.fallowrc.json`.

**Fixes made during review:**
- Removed copied WorkOS callback exchange logic into `lib/server/workos-auth-callback.ts`.
- Removed copied desktop completion exchange/redirect logic into `lib/browser/desktop-auth-complete.ts`.
- Added real Fallow entry points for desktop renderer, Vite adapters, and Electron Builder hook.
- Split branchy desktop release/readiness scripts to satisfy the configured health gate.
- Removed unused exported internals and test duplication so the zero-duplication gate passes.

**Validation:**
- `pnpm lint`
- `pnpm vitest run tests/app/auth-route-contracts.test.ts tests/components/desktop-aware-auth-anchor.test.tsx tests/desktop/renderer-smoke.test.tsx tests/desktop/vite-config.test.ts tests/electron/deep-links.test.ts tests/electron/desktop-auth-flow.test.ts tests/electron/desktop-auth-store.test.ts tests/electron/desktop-notifications.test.ts tests/electron/navigation-policy.test.ts tests/electron/runtime-config.test.ts tests/lib/api/public-url.test.ts tests/lib/browser/authenticated-event-source.test.ts tests/lib/browser/desktop-notifications.test.ts tests/lib/browser/logout.test.ts tests/lib/server/api-cors.test.ts tests/lib/server/desktop-auth.test.ts tests/lib/server/desktop-session.test.ts tests/lib/server/route-auth.test.ts tests/lib/scoped-sync-client.test.ts`
- `pnpm fallow:gate`
- `pnpm build`
- `pnpm desktop:package:mac:packaged-renderer`
- `node scripts/desktop-release-preflight.mjs` -> `26 pass, 0 warn, 0 pending, 0 fail`
- Packaged zip extraction and `codesign --verify --deep --strict`
- Packaged app CDP smoke: login screen renders, Electron password-login bridge exists, invalid production credentials return a desktop deep-link handoff and render the invalid-password route.
