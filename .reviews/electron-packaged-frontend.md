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
| Last reviewed | `2026-05-22 10:10 BST` |
| Risk | High |
| Open findings | `0` |
| Residual risks | Internal/ad-hoc mac signing only; desktop token persistence intentionally disabled by default pending a non-blocking keychain strategy; desktop preflight still reports hosted env/WorkOS checks as pending when those values are not visible locally; diff preflight's production-dead-code lens reports 17 test-covered helper exports while the configured full dead-code gate is clean; local full Vitest can hit default 5s per-test timeouts under parallel load, but the timed-out files pass with an explicit 15s timeout |

---

## Turn 5 - 2026-05-22 10:10 BST

**Outcome:** No open Critical/High findings after applying the latest PR review feedback and re-running the diff-review loop with architecture/static-analysis evidence.

**Current-turn changes reviewed:**
- Calendar and timeline inline detail panels now toggle closed when the selected item is clicked again.
- Calendar timezone selector sits to the left of the Day/Week/Month control, and the calendar date row/detail header row use the same shorter height.
- Timeline bars now open the inline detail panel from the bar itself, while drag movement, resize handles, non-primary pointer buttons, and stray pointer-up events are guarded so they do not toggle selection.
- Desktop search params are memoized by the route search string so desktop effects depending on `useAppSearchParams()` do not loop when the query string is unchanged.

**External finding triage:**

| Source | Finding | Current status | Bug class | Missed invariant/variant | Action |
|--------|---------|----------------|-----------|--------------------------|--------|
| Codex PR review on commit `9c03dca435` | `useAppSearchParams` returned a fresh object every render | Fixed this turn | React identity / effect lifecycle | Query-param object identity should change only when serialized search changes | Memoized by search string and added desktop renderer regression |
| Codex PR review older open threads | Handoff replay, fetch SSE reconnect, desktop signup handoff, opaque-origin navigation, notification click URL | Already fixed/stale in current tree | Authority, fallback parity, contract encoding, runtime compatibility | Current-tree behavior must be checked, not GitHub thread resolution state | Reverified owning paths and prior tests; no new code change needed |

**Architecture/static-analysis pass:** Work-surface presentation state remains owned by the calendar/timeline view components; the Electron navigation adapter remains a thin renderer boundary over browser routing. The final preflight still reports 17 production-only unused exports that are test-covered helper exports from this branch, while `pnpm fallow:gate` passes the repo-configured full dead-code, production-health, and duplication gates. No new production export was added in this turn.

**Branch totality / sibling closure:** Rechecked calendar event cards, all-day/timed click selection, timeline label links, timeline bars, drag and resize pointer variants, desktop route search-param consumers, and the stale PR-review hotspots from previous turns.

**Validation:**
- `pnpm vitest run tests/components/work-surface-view.test.tsx tests/desktop/renderer-smoke.test.tsx` -> `2 passed`, `68 passed`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm fallow:gate`
- `git diff --check`
- `pnpm desktop:renderer:smoke` -> renderer build plus `8 passed`
- `pnpm build`
- `~/.codex/skills/diff-review/scripts/review-preflight.sh`
- `~/.codex/skills/architecture-standards/scripts/architecture-preflight.sh`

---

## Turn 4 - 2026-05-22 09:41 BST

**Outcome:** No open Critical/High findings after importing the latest Codex PR review, adding the requested calendar/timeline/settings/desktop polish, and rerunning the branch diff/architecture pass.

**UI and desktop changes reviewed:**
- Calendar detail now opens inline beside the calendar grid, below the toolbar, so the date header/timed grid resize with the detail surface instead of the sidebar covering the shell.
- Timeline detail now opens inline beside the timeline rows, with click selection from row labels and bars; drag and resize interactions are guarded so they do not also open the detail panel.
- Calendar toolbar now includes a timezone selector near Day/Week/Month, and user settings timezone options show formatted offsets such as `UTC (UTC+00:00)`.
- Calendar all-day rows now have independent vertical overflow with horizontal day-scroll sync to the timed area.
- Properties popover now aligns inside the work-surface toolbar with viewport padding instead of overflowing off the right edge.
- Desktop item-link copy now uses the Electron clipboard bridge and copies hosted URLs for packaged `file://` renderer routes.
- Private task codes now use `PVT` via a shared domain constant used by the store and Convex work-item numbering.

**External finding triage:**

| Source | Finding | Current status | Bug class | Missed invariant/variant | Action |
|--------|---------|----------------|-----------|--------------------------|--------|
| Codex PR review | Desktop handoff tickets replayable | Already fixed in current tree | Authority / replay | Handoff `jti` must be single-use at the hosted server boundary | Verified `consumeDesktopHandoffTicketServer` path and replay tests |
| Codex PR review | Fetch-backed desktop SSE does not reconnect | Already fixed in current tree | Lifecycle / fallback parity | Electron fetch fallback must preserve native `EventSource` reconnect semantics | Verified reconnect scheduling and regression test |
| Codex PR review | Desktop signup bypasses auth handoff | Stale/already fixed in current tree | Affordance parity / contract encoding | Login and signup desktop password flows must both exchange hosted handoff tickets | Verified `/auth/desktop/signup`, IPC bridge, renderer smoke, and route-contract tests |
| Codex PR review | Opaque-origin URLs trusted when packaged renderer origin is `null` | Fixed this turn | Security / contract encoding | Only concrete HTTP(S) same-origin URLs may bypass hosted allowlist | Added protocol/origin guards and opaque-origin regression test |
| Codex PR review | Notification click URL built from `origin` instead of renderer URL | Fixed this turn | Runtime compatibility / route resolution | Packaged `file://` renderer navigation must resolve through the full renderer URL/hash route | Notification bridge now accepts resolved target URLs; packaged file renderer regression added |

**Architecture pass:** The implementation keeps the same ownership boundaries: Electron owns native bridges and packaged URL resolution; hosted Vercel routes/server helpers own WorkOS/session secrets and desktop handoff tickets; domain key formatting owns the private work-item prefix; work-surface components own presentation state for inline detail surfaces and scroll synchronization. No server secrets, WorkOS private keys, or hosted API keys move into Electron.

**Branch totality / sibling closure:** Rechecked the prior PR-review hotspots, desktop navigation/notification/copy sibling paths, calendar month/day/week detail variants, timeline label/bar click variants, private numbering in both optimistic store and Convex persistence paths, and settings/calendar timezone rendering.

**Validation:**
- `pnpm lint`
- `pnpm typecheck`
- `pnpm fallow:gate`
- `pnpm vitest run tests/components/work-surface-view.test.tsx tests/components/settings-screen-helpers.test.ts tests/components/work-item-detail-screen.test.tsx tests/electron/navigation-policy.test.ts tests/electron/desktop-notifications.test.ts tests/lib/browser/authenticated-event-source.test.ts tests/lib/server/desktop-session.test.ts tests/app/auth-route-contracts.test.ts tests/lib/domain/work-item-key.test.ts tests/lib/store/work-item-actions.test.ts tests/convex/work-item-handlers.test.ts` -> `11 passed`, `168 passed`
- `pnpm vitest run tests/components/create-dialogs.test.tsx tests/components/work-item-detail-screen.test.tsx tests/components/settings-screen-helpers.test.ts tests/components/work-surface-view.test.tsx --testTimeout 15000` -> `4 passed`, `123 passed`
- `pnpm desktop:renderer:smoke` -> renderer build plus `7 passed`
- `pnpm build`
- `~/.codex/skills/architecture-standards/scripts/architecture-preflight.sh`
- `~/.codex/skills/diff-review/scripts/review-preflight.sh`
- `pnpm test` was rerun twice and hit local default 5s Vitest timeouts in UI-heavy files under full parallel load; the same timed-out files passed directly with a 15s timeout, so this is recorded as a local timing caveat rather than a branch behavior failure.

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
