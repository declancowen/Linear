# Review: Workspace Auth and Work Item Review

## Project context (captured on Turn 1 — not re-detected on subsequent turns)

| Field | Value |
|-------|-------|
| **Repository** | `linear` |
| **Remote** | `https://github.com/declancowen/Linear.git` |
| **Branch** | `feature/team-context-reconcile-logging` |
| **Repo type** | single repo |
| **Stack** | Next.js 16 / React 19 / TypeScript / Convex / WorkOS |
| **OS** | `Darwin 25.4.0` |
| **Package manager** | `pnpm` lockfile present |

## Scope (cumulative — updated each turn as new files are touched)

Files and areas reviewed across all turns:
- `lib/store/app-store.ts` — optimistic work item updates and validation
- `convex/app.ts` — server-side work item mutation rules and auth context
- `app/api/workspaces/route.ts` — workspace creation guardrails
- `lib/domain/selectors.ts` — project scope and workspace-admin selectors
- `lib/domain/types.ts` — work item normalization and hierarchy rules
- `components/providers/convex-app-provider.tsx` — snapshot hydration and readiness gating
- `components/app/onboarding-workspace-form.tsx` — onboarding redirect behavior
- `app/(workspace)/projects/[projectId]/page.tsx` — project redirect flow
- `app/onboarding/page.tsx` — invite/join entry wiring
- `app/auth/logout/route.ts` — logout transport
- `app/auth/signup/route.ts` — signup redirect parameter handling

## Review status

| Field | Value |
|-------|-------|
| **Review started** | 2026-04-14 18:25 BST |
| **Last reviewed** | 2026-04-14 18:25 BST |
| **Total turns** | 1 |
| **Open findings** | 2 |
| **Resolved findings** | 0 |
| **Accepted findings** | 0 |

---

## Turn 1 — 2026-04-14 18:25 BST

| Field | Value |
|-------|-------|
| **Commit** | `8c5456f` |
| **IDE / Agent** | `zsh / Codex` |

**Summary:** Reviewed the reported onboarding, auth, selector, and work item model concerns against the current branch. Two issues look real in the current code: descendant project links are overwritten during parent/project cascades, and the new snapshot readiness gate can strand the UI on an infinite loading screen after an initial non-auth fetch failure. The remaining reports are either intentional behavior changes, stale relative to the current code, or low-risk implementation notes.

| Status | Count |
|--------|-------|
| New findings | 2 |
| Resolved from prior turns | 0 |
| Carried | 0 |
| Accepted | 0 |

### New findings

#### W1-01 [BUG] Medium — `lib/store/app-store.ts:1615` / `convex/app.ts:4031` — Work item project cascades overwrite independently assigned descendant projects

**What's happening:**
When a work item changes `parentId`, or when `primaryProjectId` is set directly, the update path computes `shouldCascadeProjectLink` and then rewrites `primaryProjectId` for the entire descendant subtree. The cascade also overwrites every descendant description document's `linkedProjectIds`.

**Root cause:**
The cascade only checks whether the parent/project changed. It does not track whether a descendant inherited its project from its ancestor versus having its own explicitly chosen project.

**Codebase implication:**
Moving a parent under a different project can silently rewrite project links on grandchildren that users previously assigned independently. Because the same behavior exists in both the optimistic store path and the Convex mutation path, the overwrite persists after server reconciliation rather than being a client-only glitch.

**Recommendation:**
Persist an "inherits project from parent" bit, or only cascade through descendants whose current project still matches the old inherited value. If the intended product rule is strict subtree-wide project consistency, document that explicitly because it is a user-visible semantic change.

#### W1-02 [BUG] Medium — `components/providers/convex-app-provider.tsx:79` — Initial non-401 snapshot failure can leave the app on an indefinite loading screen

**What's happening:**
`ConvexAppProvider` now blocks rendering behind `ready`. `ready` flips to `true` only after the first successful `fetchSnapshotState()`. If that initial call throws a non-401 error, the code logs the error but leaves `ready` false. The stream is opened only from `syncSnapshot().then(() => openStream())`, so there is no automatic retry loop after the first failure.

**Root cause:**
The new fail-closed hydration gate introduced a "success-only" readiness transition without a retry timer or explicit retry UI for transient errors.

**Codebase implication:**
On a flaky network, a transient timeout or 5xx during the first load can strand the user on `Loading workspace...` until something else triggers `focus`, `visibilitychange`, or `online`. A tab that stays focused after the failure has no self-healing path.

**Recommendation:**
Add either a short retry backoff for the initial load, or an error state with a retry button. Keeping the fail-closed model is reasonable, but it needs a recovery path.

### Notes on reports that did not reproduce as current bugs

- `app/api/workspaces/route.ts:54` duplicate-workspace concern is stale in the current code. `authContext.currentWorkspace` now resolves to `currentWorkspace ?? pendingWorkspace` in `convex/app.ts:2755-2777`, so the existing guard at `app/api/workspaces/route.ts:47-52` still blocks creating another workspace while a pending one exists.
- `lib/domain/selectors.ts:236` team-scope project picker behavior change is real, but it currently looks intentional rather than broken. Editing still preserves a previously selected workspace project because `getTeamProjectOptions` re-adds `selectedProjectId` when needed.
- The strict work item hierarchy and the removal of the old depth-1 restriction are substantial model changes, but they appear deliberate. The specific orphaning concern for legacy `sub-task` children is weak because the old validation model already prevented nested child-of-child structures in valid data.
- `app/onboarding/page.tsx:171` passing `signupHref={loginHref}` is brittle but not user-visible in the authenticated onboarding path those components currently run under.
- `app/auth/logout/route.ts:27` allowing GET logout is a low-risk logout-CSRF tradeoff, not an immediate correctness bug. The bodiless `formData()` call is wasteful but harmless because it is caught.
- `app/auth/signup/route.ts:100` relying on `buildAuthPageHref(...)` to always include `?` is a coupling smell, but not a present failure.
