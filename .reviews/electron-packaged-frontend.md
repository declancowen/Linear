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
| Last reviewed | `2026-05-21 20:17 BST` |
| Risk | High |
| Open findings | `0` |
| Residual risks | Internal/ad-hoc mac signing only; desktop token persistence intentionally disabled by default pending a non-blocking keychain strategy |

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
