# Review: Full Codebase Remediation

## Project context (captured on Turn 1 — not re-detected on subsequent turns)

| Field | Value |
|-------|-------|
| **Repository** | `linear` |
| **Remote** | `https://github.com/declancowen/Linear.git` |
| **Branch** | `t3code/full-codebase-sweep` |
| **Repo type** | single repo |
| **Stack** | Next.js 16 / React 19 / TypeScript / Convex / WorkOS / Electron |
| **Packages affected** | n/a |
| **OS** | `Darwin 25.4.0` |
| **Package manager** | `pnpm` lockfile present, binary unavailable in current environment |
| **Node** | unavailable in current environment |
| **Python** | n/a |

## Scope (cumulative — updated each turn as new files are touched)

Files and areas reviewed across all turns:
- `.audits/full-codebase-audit.md` — imported Turn 1 audit baseline
- `convex/app.ts` — auth boundary, access control, mentions, conversation membership, call metadata
- `lib/server/convex.ts` — server-side Convex transport wrappers
- `lib/server/authenticated-app.ts` — session-to-Convex identity and reconciliation flow
- `components/providers/convex-app-provider.tsx` — client snapshot hydration and refresh behavior
- `lib/convex/client.ts` — browser snapshot transport
- `lib/store/app-store.ts` — optimistic state, server refresh fallback, workspace write gating
- `app/api/snapshot/route.ts` — authenticated snapshot endpoint
- `app/api/calls/join/route.ts` — persistent room join flow
- `app/api/chats/[chatId]/calls/route.ts` — call creation and role gating
- `app/api/workspaces/route.ts` — workspace provisioning flow
- `app/api/teams/route.ts` — team creation and post-create reconciliation
- `app/auth/login/route.ts` — password auth redirect flow
- `components/app/auth-entry-screen.tsx` — auth form submission targets
- `electron/main.mjs` — desktop shell hardening and navigation policy
- `electron/preload.mjs` — desktop preload compatibility
- `scripts/bootstrap-app-workspace.mjs` — operational bootstrap path
- `scripts/send-notification-digests.mjs` — digest delivery idempotency
- `scripts/sync-workspace-organizations.mjs` — WorkOS organization sync
- `README.md` and `.env.example` — deployment and env changes

## Review status (updated every turn)

| Field | Value |
|-------|-------|
| **Review started** | 2026-04-14 09:54 BST |
| **Last reviewed** | 2026-04-14 10:49 BST |
| **Total turns** | 6 |
| **Open findings** | 0 |
| **Resolved findings** | 3 |
| **Accepted findings** | 0 |

---

## Turn 6 — 2026-04-14 10:49 BST

| Field | Value |
|-------|-------|
| **Commit** | `bfcb098` |
| **IDE / Agent** | `zsh / Codex` |

**Summary:** Addressed another round of PR feedback that surfaced one real desktop lifecycle bug and a few smaller hardening/type-safety issues. The Electron packaged server is now reused across macOS re-activation, snapshot requests fail closed when the authenticated user cannot be resolved, the server-token check no longer uses a simple early-exit comparison, and the vestigial `fetchSnapshot(email)` API is gone.

| Status | Count |
|--------|-------|
| New findings | 0 |
| Resolved from Turn 5 | 0 |
| Carried from Turn 5 | 0 |
| Accepted | 0 |

### Recommendations

1. **Fix first:** No new static blockers remain from this review round.
2. **Then address:** Leave the polling-load and ephemeral-port TOCTOU notes as documented operational observations unless runtime evidence shows they are causing real problems.
3. **Patterns noticed:** The remaining issues are mostly around fail-closed behavior and desktop lifecycle handling rather than authz logic.
4. **Suggested approach:** Push the latest follow-up commit to the PR once you are ready, then keep runtime verification as the remaining merge gate.

---

## Turn 5 — 2026-04-14 10:39 BST

| Field | Value |
|-------|-------|
| **Commit** | `74fceec` |
| **IDE / Agent** | `zsh / Codex` |

**Summary:** Applied a final follow-up hardening pass from PR feedback. Snapshot fetching now preserves `AppSnapshot` typing, invite/join-code Convex lookups are server-token protected too, and the provider effect no longer depends on `setTheme` reference stability.

| Status | Count |
|--------|-------|
| New findings | 0 |
| Resolved from Turn 4 | 0 |
| Carried from Turn 4 | 0 |
| Accepted | 0 |

### Recommendations

1. **Fix first:** No open static review findings remain.
2. **Then address:** Run runtime verification when toolchain access is available, then update the PR branch with these follow-up fixes.
3. **Patterns noticed:** The remaining useful review feedback was type-safety and hardening cleanup rather than functional regressions.
4. **Suggested approach:** Treat this as the final static pass; the next action is to push the latest commit to the open PR after runtime checks or with explicit acceptance of the pending runtime gap.

---

## Turn 4 — 2026-04-14 10:28 BST

| Field | Value |
|-------|-------|
| **Commit** | `74fceec` |
| **IDE / Agent** | `zsh / Codex` |

**Summary:** Re-reviewed the current remediation diff after the Turn 3 fixes. No new issues turned up in the updated snapshot refresh path, Electron navigation policy, or auth reconciliation flow, so this review thread is clean on static analysis.

| Status | Count |
|--------|-------|
| New findings | 0 |
| Resolved from Turn 3 | 0 |
| Carried from Turn 3 | 0 |
| Accepted | 0 |

### Recommendations

1. **Fix first:** No open diff-review findings remain.
2. **Then address:** Run runtime verification when `node` and `pnpm` are available: `pnpm typecheck`, `pnpm lint`, auth login/signup flows, multi-user chat refresh, and packaged Electron navigation/auth.
3. **Patterns noticed:** The latest changes preserved the hardened server boundary without introducing another round of behavioral drift.
4. **Suggested approach:** From a static diff-review perspective this thread is clear. The remaining gate is runtime validation, then deployment to Convex/Vercel and the next desktop build.

---

## Turn 3 — 2026-04-14 10:24 BST

| Field | Value |
|-------|-------|
| **Commit** | `74fceec` |
| **IDE / Agent** | `zsh / Codex` |

**Summary:** Fixed the three regressions introduced by the remediation patch. The server boundary remains intact, while the client regains continuous snapshot refresh, the desktop shell allows same-origin app navigation again, and WorkOS identity sync is explicit in the reconciliation path.

| Status | Count |
|--------|-------|
| New findings | 0 |
| Resolved from Turn 2 | 3 |
| Carried from Turn 2 | 0 |
| Accepted | 0 |

### Resolved from Turn 2

#### B2-01 ~~[BUG] High~~ → RESOLVED — Live collaboration updates were lost after removing the Convex subscription
**How it was fixed:** [components/providers/convex-app-provider.tsx](/Users/declancowen/.t3/worktrees/Linear/t3code-45394e1b/components/providers/convex-app-provider.tsx:15) now polls `/api/snapshot` every 5 seconds while visible, and also refreshes on `focus`, `visibilitychange`, and `online`. The effect now serializes overlapping refreshes so multiple triggers do not stampede the endpoint.
**Verified:** Static code review confirms there is once again an always-on refresh path while a tab stays open, rather than only mount/focus refreshes.

#### B2-02 ~~[BUG] High~~ → RESOLVED — Electron navigation hardening blocked valid same-origin app routes
**How it was fixed:** [electron/main.mjs](/Users/declancowen/.t3/worktrees/Linear/t3code-45394e1b/electron/main.mjs:96) now distinguishes same-origin app URLs from external URLs. `will-navigate` allows any same-origin route, and `setWindowOpenHandler` keeps same-origin popups inside the existing app window instead of denying them outright.
**Verified:** Static code review confirms the desktop shell now allows route-handler form posts and nested route navigations while still externalizing only allowlisted non-app URLs.

#### B2-03 ~~[BUG] Medium~~ → RESOLVED — Existing users stopped syncing from WorkOS after the auth split
**How it was fixed:** [lib/server/authenticated-app.ts](/Users/declancowen/.t3/worktrees/Linear/t3code-45394e1b/lib/server/authenticated-app.ts:38) now uses an internal loader with an explicit `syncUserFromAuth` mode. `reconcileAuthenticatedAppContext(...)` takes that path, forcing `ensureConvexUserFromAuth(...)` before reloading auth context.
**Verified:** Static code review confirms reconciliation once again updates existing Convex users from WorkOS instead of only provisioning missing users.

### Recommendations

1. **Fix first:** No open review findings remain in this thread.
2. **Then address:** Run runtime verification once `node` and `pnpm` are available: `pnpm typecheck`, `pnpm lint`, relevant auth flows, multi-user chat refresh, and desktop auth/navigation.
3. **Patterns noticed:** The safer pattern here is to preserve runtime semantics explicitly whenever a security hardening change replaces a transport or lifecycle path.
4. **Suggested approach:** Deploy only after runtime verification passes, then keep this review file with the changes until the branch is ready to merge.

---

## Turn 2 — 2026-04-14 10:12 BST

| Field | Value |
|-------|-------|
| **Commit** | `74fceec` |
| **IDE / Agent** | `zsh / Codex` |

**Summary:** This remediation patch closes the original direct Convex exposure paths, but the diff introduces three new regressions. Two are user-visible behavior breaks: the desktop shell now blocks legitimate in-app navigations, and the web client no longer receives live Convex updates while a page stays open.

| Status | Count |
|--------|-------|
| New findings | 3 |
| Resolved from Turn 1 | 0 |
| Carried from Turn 1 | 0 |
| Accepted | 0 |

### New findings

#### B2-01 [BUG] High — `components/providers/convex-app-provider.tsx:22` — Replacing the Convex subscription with focus-only fetches removes live collaboration updates

**What's happening:**
The provider no longer mounts `ConvexProvider` or subscribes with `useQuery`. It now fetches `/api/snapshot` once on mount, then only on `window.focus` and `visibilitychange`. The store still has explicit refresh helpers for local mutation failure and a few mutation success paths, but there is no remaining always-on subscription path for passive updates from other users.

**Root cause:**
The security fix moved snapshot reads behind an authenticated Next.js route, but the reactive transport was removed entirely instead of being replaced with an authenticated streaming or polling mechanism.

**Codebase implication:**
Any multi-user flow becomes stale while the page remains open: chat messages, comments, notifications, channel posts, call join counts, participant changes, and invite acceptance will not appear until the tab regains focus or the current user triggers a refreshing mutation. That is a material regression from the prior live Convex behavior and undercuts the collaboration surfaces the audit was trying to protect.

**Solution options:**
1. **Quick fix:** Add an interval-based refresh in the provider so open tabs re-fetch snapshots regularly until a proper reactive transport is restored.
2. **Proper fix:** Restore a real subscription model behind authenticated server mediation, for example an authenticated snapshot stream or SSE/WebSocket fan-out from Next.js to the client.

**Investigate:**
Check the chat, notifications, and channel views in two browser sessions. If one session stays focused while the other writes data, it should update without blur/focus to preserve previous behavior.

> ```tsx
> useEffect(() => {
>   void syncSnapshot()
>   window.addEventListener("focus", handleFocus)
>   document.addEventListener("visibilitychange", handleVisibilityChange)
> }, [authenticatedUser?.email, replaceDomainData, setTheme])
> ```

#### B2-02 [BUG] High — `electron/main.mjs:150` — Desktop hardening now blocks valid same-origin navigations, including auth form submissions

**What's happening:**
The new `will-navigate` handler allows only the exact root `rendererUrl` and blocks everything else. That means same-origin navigations like `http://127.0.0.1:3000/auth/login`, route-handler redirects, reloads on nested paths, and other full-page app navigations are prevented. The app’s auth screen still posts forms directly to `/auth/login` and `/auth/signup`.

**Root cause:**
The navigation lock-down compares against the full URL string instead of the renderer origin. That is a common hardening mistake: it protects against cross-origin escapes, but accidentally denies legitimate in-app URLs on the same host.

**Codebase implication:**
The packaged Electron app can lose basic navigation flows. Email/password auth is the clearest break because the form submits to a route handler, but reloads and any future same-origin full navigations are also at risk. This turns the desktop security hardening into a desktop usability regression.

**Solution options:**
1. **Quick fix:** Allow any navigation whose `origin` matches `new URL(rendererUrl).origin`, and continue externalizing only non-app `https:` / `mailto:` URLs.
2. **Proper fix:** Centralize desktop URL policy into an allowlist function that distinguishes same-origin app routes, external URLs, and blocked schemes consistently for both `will-navigate` and `setWindowOpenHandler`.

**Investigate:**
In the packaged desktop build, submit the login form and try a hard reload on a nested route such as `/workspace/projects`. Both should stay inside the app window.

> ```js
> mainWindow.webContents.on("will-navigate", (event, url) => {
>   if (url === rendererUrl) return
>   event.preventDefault()
> })
> ```

#### B2-03 [BUG] Medium — `lib/server/authenticated-app.ts:43` — Existing users stop syncing from WorkOS after the hot-path reconciliation split

**What's happening:**
`ensureAuthenticatedAppContext` now reads `getAuthContextServer(...)` first and only calls `ensureConvexUserFromAuth(...)` when no matching Convex user exists. `reconcileAuthenticatedAppContext` reuses that context, so it also skips `ensureConvexUserFromAuth` for existing users. But `ensureUserFromAuth` is the code that patches Convex with the latest WorkOS name, email, handle, and WorkOS user ID.

**Root cause:**
The refactor correctly separated expensive workspace reconciliation from hot-path requests, but it also moved identity synchronization behind an existence check. That conflates "user exists" with "user is up to date."

**Codebase implication:**
After this ships, existing users who change their WorkOS name or email stop propagating those updates into Convex. That leaves stale names in collaboration surfaces and can eventually create mismatch pressure on any flow that still depends on Convex-side email consistency.

**Solution options:**
1. **Quick fix:** In `reconcileAuthenticatedAppContext`, call `ensureConvexUserFromAuth(context.authenticatedUser)` before the workspace/org reconciliation work, then reload auth context.
2. **Proper fix:** Split "identity sync" and "workspace reconciliation" into separate explicit helpers, and keep identity sync on the hot path if it is cheap and idempotent.

**Investigate:**
Update a user’s WorkOS profile name or email, then load the app without creating a new Convex user. Confirm whether the Convex `users` row reflects the new values.

> ```ts
> let authContext = await getAuthContextServer({ workosUserId, email })
> let ensuredUser = authContext?.currentUser ? { userId: authContext.currentUser.id, bootstrapped: false } : null
>
> if (!ensuredUser) {
>   ensuredUser = await ensureConvexUserFromAuth(authenticatedUser)
> }
> ```

### Recommendations

1. **Fix first:** `B2-01` and `B2-02`. They are immediate behavioral regressions in core collaboration and desktop auth/navigation.
2. **Then address:** `B2-03`, because the identity drift will compound quietly and is easiest to fix while the auth refactor is still fresh.
3. **Patterns noticed:** The strongest pattern in this patch is replacing direct public access with server mediation, but not always preserving the previous runtime semantics. Security posture improved; liveness and lifecycle behavior regressed.
4. **Suggested approach:** Restore semantics before deployment: reintroduce a live snapshot mechanism, relax desktop navigation to same-origin rather than exact-URL equality, then make identity sync explicit in the new reconciliation split.

---

## Turn 1 — 2026-04-14 09:54 BST

| Field | Value |
|-------|-------|
| **Commit** | `74fceec` |
| **IDE / Agent** | `zsh / Codex` |

**Summary:** Imported the baseline from `.audits/full-codebase-audit.md`, which remains the authoritative Turn 1 audit for the original repo-wide findings. This review thread uses Turn 2 to validate the remediation diff itself and capture regressions introduced by the fixes.

| Status | Count |
|--------|-------|
| Findings | 0 |

### Recommendations

1. **Fix first:** Use the Turn 1 audit as the remediation target and keep this review thread focused on validating the patch, not re-litigating the original findings.
2. **Then address:** Any new issues introduced while closing the Turn 1 audit.
3. **Patterns noticed:** The remediation touches shared auth, snapshot, and desktop infrastructure, so regressions are most likely in cross-cutting behavior rather than isolated UI screens.
4. **Suggested approach:** Re-review the patch after each fix and keep the audit and diff-review threads separate: the audit tracks original repo issues, this file tracks whether the remediation patch is safe to ship.
