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
| **Last reviewed** | 2026-04-14 18:39 BST |
| **Total turns** | 2 |
| **Open findings** | 2 |
| **Resolved findings** | 2 |
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

---

## Turn 2 — 2026-04-14 18:39 BST

| Field | Value |
|-------|-------|
| **Commit** | `8c5456f` |
| **IDE / Agent** | `zsh / Codex` |

**Summary:** Re-reviewed the new flag list after the latest hierarchy and provider changes. Two issues remain actionable in the current code: the onboarding workspace redirect can land on a blank client page before the store learns about the new workspace, and the legacy work-item normalization path can make pre-migration hierarchies fail validation under the new strict model.

| Status | Count |
|--------|-------|
| New findings | 2 |
| Resolved from Turn 1 | 2 |
| Carried | 0 |
| Accepted | 0 |

### New findings

#### W2-01 [BUG] Medium — `components/app/onboarding-workspace-form.tsx:198` / `app/(workspace)/workspace/projects/page.tsx:8` — Workspace creation can navigate into a blank page before the client snapshot includes the new workspace

**What's happening:**
After successful workspace creation the form immediately does `router.replace("/workspace/projects")`. That route reads `getCurrentWorkspace(data)` from the client store and returns `null` if the workspace is missing. There is no optimistic local store update for the new workspace and no route-level loading fallback.

**Root cause:**
The onboarding flow now depends on the provider’s async snapshot refresh to populate the workspace after creation, but the route transition happens synchronously before that refresh is guaranteed to land.

**Codebase implication:**
Users can hit a transient blank page immediately after creating a workspace. If the stream/poll update is delayed, the page stays visually empty until the snapshot refresh catches up.

**Recommendation:**
Either update the local store immediately with the created workspace, or keep the user on onboarding until a refreshed snapshot/server render confirms the active workspace before redirecting.

#### W2-02 [BUG] High — `lib/domain/types.ts:1116` / `lib/domain/types.ts:1251` / `convex/app.ts:1989` — Legacy `sub-task` / `sub-issue` normalization can turn existing hierarchies invalid under the new model

**What's happening:**
Snapshots normalize stored items eagerly: `sub-task -> story` and `sub-issue -> issue` for software-development teams. The new hierarchy only allows `requirement -> story` and `issue -> sub-issue`. That means legacy items can now appear as invalid parent/child pairs in memory before any migration is complete.

**Root cause:**
The migration helper `backfillWorkItemModel` only patches stored item types; it does not repair parent-child structure. Meanwhile the live snapshot normalizer already exposes the remapped types to the client and validation logic.

**Codebase implication:**
Existing legacy items can fail unrelated edits because `updateWorkItem` validates the current parent/type relationship on every update. For example, an old `sub-task` under a `story` becomes a normalized `story` under `story`, which fails `canParentWorkItemTypeAcceptChild(...)`.

**Recommendation:**
Treat this as a real data migration, not just a type remap. Either defer client normalization until after a structural backfill runs, or migrate/reparent legacy hierarchies so normalized types satisfy the new chain before enforcing the new validation rules.

### Resolved from Turn 1

#### W1-01 ~~[BUG] Medium~~ → RESOLVED — Project change propagation is now intentionally whole-hierarchy
**How it was fixed:** The project cascade now resolves the top-most parent and updates the entire resulting hierarchy in both [lib/store/app-store.ts](/Users/declancowen/.t3/worktrees/Linear/t3code-45394e1b/lib/store/app-store.ts:680) and [convex/app.ts](/Users/declancowen/.t3/worktrees/Linear/t3code-45394e1b/convex/app.ts:1015). The work-item sidebar also confirms the hierarchy-wide update in [components/app/screens.tsx](/Users/declancowen/.t3/worktrees/Linear/t3code-45394e1b/components/app/screens.tsx:1424).

#### W1-02 ~~[BUG] Medium~~ → RESOLVED — Initial snapshot load now retries instead of hanging forever on transient failures
**How it was fixed:** [components/providers/convex-app-provider.tsx](/Users/declancowen/.t3/worktrees/Linear/t3code-45394e1b/components/providers/convex-app-provider.tsx:91) now schedules backoff retries for the initial snapshot fetch until a successful load marks the provider ready.

### Notes on reports that are still not current bugs

- The duplicate-workspace flag is still stale for the same reason as Turn 1: `currentWorkspace` already covers `pendingWorkspace`.
- The provider “indefinite loading” flag is stale now; there is an automatic retry path.
- The project-link overwrite flag is no longer a bug under the intended “one hierarchy, one project” rule, and the implementation now matches that rule more fully than before.
- The project redirect, signup-href, logout GET, `withSignupProfileParams`, request-origin redirect base, and `canAdminWorkspace` notes are either low-risk tradeoffs or intentional behavior changes, not present correctness bugs.
