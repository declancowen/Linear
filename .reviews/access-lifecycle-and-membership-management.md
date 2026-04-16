# Review: Access Lifecycle And Membership Management

## Project context (captured on Turn 1 — not re-detected on subsequent turns)

| Field | Value |
|-------|-------|
| **Repository** | `Linear` |
| **Remote** | `https://github.com/declancowen/Linear.git` |
| **Branch** | `main` |
| **Repo type** | `single repo` |
| **Stack** | `Next.js App Router / Convex / WorkOS / TypeScript` |
| **Packages affected** | `n/a` |
| **OS** | `Darwin 25.4.0` |
| **Package manager** | `pnpm 10.32.0` |
| **Node** | `v25.8.0` |
| **Python** | `n/a` |

## Scope (cumulative — updated each turn as new files are touched)

Files and areas reviewed across all turns:
- `app/api/account/route.ts` — account deletion route, WorkOS deletion follow-up
- `app/api/settings-images/upload-url/route.ts` — workspace-logo upload authorization for settings flows
- `app/api/teams/[teamId]/leave/route.ts` — leave-team route
- `app/api/teams/[teamId]/members/[userId]/route.ts` — team member role and removal routes
- `app/api/workspace/current/leave/route.ts` — leave-workspace route
- `app/api/workspace/current/route.ts` — workspace branding and delete route authorization
- `app/api/workspace/current/users/[userId]/route.ts` — workspace user removal route
- `components/app/settings-screens/member-management.tsx` — shared team/workspace member management UI
- `components/app/settings-screens/team-settings-screen.tsx` — team settings tabs, member management, delete team
- `components/app/settings-screens/workspace-settings-screen.tsx` — workspace settings tabs, workspace users, delete workspace
- `components/app/settings-screens/user-settings-screen.tsx` — delete account UI
- `components/app/shell.tsx` — leave team/workspace actions from shell
- `components/app/collaboration-screens/chat-thread.tsx` — read-only chat behavior for departed/deleted users
- `components/app/collaboration-screens/workspace-chats-screen.tsx` — workspace chat preview text rendering
- `components/app/collaboration-screens/channel-ui.tsx` — channel composer follow-up layout touch
- `components/app/rich-text-editor.tsx` — optional slash command disabling for chat composer
- `components/app/screens/inbox-ui.tsx` — new notification entity icons
- `components/app/user-presence.tsx` — deleted-account / left-workspace presentation and messaging guard
- `convex/app.ts` — new mutations exported for access lifecycle flows
- `convex/app/auth_bootstrap.ts` — snapshot visibility and auth bootstrap behavior for deleted users
- `convex/app/access.ts` — centralized owner-only and team-admin-only authorization helpers
- `convex/app/cleanup.ts` — cleanup after workspace/team access removal
- `convex/app/collaboration_handlers.ts` — server-side read-only guard for workspace chats
- `convex/app/collaboration_utils.ts` — notification entity support for team/workspace access events
- `convex/app/data.ts` — membership lookup helpers and role lookup reuse
- `convex/app/normalization.ts` — `accountDeletedAt` normalization
- `convex/app/server_users.ts` — server-side deleted-account resolution behavior
- `convex/app/workspace_team_handlers.ts` — leave/remove/delete account handlers and team/workspace mutations
- `convex/validators.ts` — new notification entity types and `accountDeletedAt`
- `lib/convex/client.ts` — client exports for new access lifecycle routes
- `lib/convex/client/core.ts` — workspace/account client mutations
- `lib/convex/client/work.ts` — team member and leave-team client mutations
- `lib/domain/selectors-internal/core.ts` — workspace access selector helpers
- `lib/domain/types-internal/models.ts` — `accountDeletedAt` on user model
- `lib/domain/types-internal/primitives.ts` — notification entity types
- `lib/domain/types-internal/schemas.ts` — team membership role schema
- `lib/server/convex/teams-projects.ts` — server wrappers for team membership actions
- `lib/server/convex/workspace.ts` — server wrappers for workspace/account actions
- `lib/server/email.ts` — access-change email rendering and sending
- `lib/server/workos.ts` — WorkOS user deletion helper
- `lib/store/app-store-internal/slices/collaboration-conversation-actions.ts` — client-side chat read-only guard
- `lib/store/app-store-internal/slices/workspace.ts` — client-side leave/remove/member-role actions
- `lib/store/app-store-internal/types.ts` — new workspace/team membership action types

## Review status (updated every turn)

| Field | Value |
|-------|-------|
| **Review started** | `2026-04-16 17:53:42 BST` |
| **Last reviewed** | `2026-04-16 18:44:15 BST` |
| **Total turns** | `5` |
| **Open findings** | `0` |
| **Resolved findings** | `7` |
| **Accepted findings** | `0` |

---

## Turn 5 — 2026-04-16 18:44:15 BST

| Field | Value |
|-------|-------|
| **Commit** | `41b4d9f` |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** Re-review after the latest fix pass found no remaining blocking findings in the reviewed scope. The two Turn 4 issues are now resolved: manual team/workspace removals notify the required leadership paths and removed users correctly, workspace deletion no longer removes Convex user rows, and delete-account now validates eligibility before provider deletion. The final cleanup in this turn also moved the preflight eligibility check from a mutation to a query so the route no longer emits a no-op global snapshot invalidation before the real delete.

| Status | Count |
|--------|-------|
| New findings | 0 |
| Resolved from Turn 4 | 2 |
| Carried from Turn 4 | 0 |
| Accepted | 0 |

### Resolved from Turn 4

#### B4-01 ~~[BUG] Medium~~ → RESOLVED — Manual remove flows still did not notify workspace/team owners about the access change
**How it was fixed:** [removeTeamMemberHandler](/Users/declancowen/Documents/GitHub/Linear/convex/app/workspace_team_handlers.ts:1128) now notifies team admins in addition to the removed user, and [removeWorkspaceUserHandler](/Users/declancowen/Documents/GitHub/Linear/convex/app/workspace_team_handlers.ts:1210) now sends the owner-facing access-change email jobs alongside the removed-user email. The route layer in [team member removal](/Users/declancowen/Documents/GitHub/Linear/app/api/teams/[teamId]/members/[userId]/route.ts:78) and [workspace user removal](/Users/declancowen/Documents/GitHub/Linear/app/api/workspace/current/users/[userId]/route.ts:33) now forwards those jobs through the shared transactional email sender.
**Verified:** Manual remove, self-leave, and delete-account now all use the same owner/admin notification pattern, while team removal still notifies the removed user and workspace removal remains email-only for the removed user.

#### B4-02 ~~[BUG] Medium~~ → RESOLVED — Account deletion could succeed locally while leaving the WorkOS sign-in identity alive
**How it was fixed:** [account route](/Users/declancowen/Documents/GitHub/Linear/app/api/account/route.ts:25) now validates deletion eligibility first, then deletes the WorkOS user, then runs the final Convex delete. The validation preflight now lives in [validateCurrentAccountDeletion](/Users/declancowen/Documents/GitHub/Linear/convex/app.ts:378) and [validateCurrentAccountDeletionHandler](/Users/declancowen/Documents/GitHub/Linear/convex/app/workspace_team_handlers.ts:1414) with the shared server wrapper in [lib/server/convex/workspace.ts](/Users/declancowen/Documents/GitHub/Linear/lib/server/convex/workspace.ts:79).
**Verified:** The route no longer reports success after a failed WorkOS delete, and the preflight no longer uses a dry-run mutation that would bump the global snapshot version without changing data.

### Additional alignment verified on this rerun

- [deleteWorkspaceHandler](/Users/declancowen/Documents/GitHub/Linear/convex/app/workspace_team_handlers.ts:442) now returns `deletedUserIds: []` and no longer invokes user cleanup at the workspace-delete level.
- [cascadeDeleteTeamData](/Users/declancowen/Documents/GitHub/Linear/convex/app/cleanup.ts:663) is already called with `cleanupGlobalState: false` from workspace deletion, so team cascades in that path also avoid deleting Convex user rows.

### Verification

- `pnpm typecheck`
- `pnpm eslint app/api/account/route.ts 'app/api/teams/[teamId]/members/[userId]/route.ts' 'app/api/workspace/current/users/[userId]/route.ts' 'app/api/teams/[teamId]/leave/route.ts' app/api/workspace/current/leave/route.ts convex/app.ts convex/app/auth_bootstrap.ts convex/app/workspace_team_handlers.ts convex/app/cleanup.ts lib/server/convex/workspace.ts lib/server/workos.ts`

### Residual testing gap

- I did not run a live end-to-end WorkOS failure simulation, so the remaining risk is operational rather than code-structure-related: provider outage behavior is only covered by static review plus route-level error handling, not an exercised integration test.

---

## Turn 4 — 2026-04-16 18:22:28 BST

| Field | Value |
|-------|-------|
| **Commit** | `41b4d9f` |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** Re-review after the fix and architecture passes found two remaining issues. The earlier five findings remain resolved, but the current diff still misses owner/admin notifications on manual removal flows, and account deletion still reports success even when WorkOS user deletion fails, which leaves the external sign-in identity linked to a tombstoned local account.

| Status | Count |
|--------|-------|
| New findings | 2 |
| Resolved from Turn 3 | 0 |
| Carried from Turn 3 | 0 |
| Accepted | 0 |

### Findings

#### B4-01 [BUG] Medium — `convex/app/workspace_team_handlers.ts:1131` and `:1200` — Manual remove flows still do not notify workspace/team owners about the access change

**What's happening:**
`removeTeamMemberHandler` and `removeWorkspaceUserHandler` only notify the removed user. They do not call the same owner/admin inbox + email helpers that `leaveTeamHandler`, `leaveWorkspaceHandler`, and `deleteCurrentAccountHandler` now use.

**Root cause:**
The access-change side effects were centralized for leave/delete-account, but the explicit remove-member/remove-user paths were left on their older “notify the removed user only” branch.

**Codebase implication:**
This still falls short of the clarified requirement that remove, leave, and delete-account should all surface access-loss events to the responsible workspace/team leadership. Operationally, owners/admins still do not get a durable inbox/email trail when a member is manually removed.

**Evidence:**
- [removeTeamMemberHandler](/Users/declancowen/Documents/GitHub/Linear/convex/app/workspace_team_handlers.ts:1164) inserts a notification only for `removedUser.id` and returns email jobs only for `removedUser.email`.
- [removeWorkspaceUserHandler](/Users/declancowen/Documents/GitHub/Linear/convex/app/workspace_team_handlers.ts:1277) returns email jobs only for the removed user and never calls `notifyWorkspaceOwnerOfAccessChange`.

#### B4-02 [BUG] Medium — `app/api/account/route.ts:49` and `convex/app/data.ts:100` — Account deletion can succeed locally while leaving the WorkOS sign-in identity alive

**What's happening:**
The account is tombstoned locally first, then `deleteWorkOSUser` runs afterward in a best-effort `try/catch`. If WorkOS deletion fails, the route still returns success. Because the tombstoned row keeps its `workosUserId`, future auth resolution by WorkOS ID will keep throwing “This account has been deleted.”

**Root cause:**
The route treats provider-side deletion as non-blocking even though the requirement says account deletion should remove sign-in linkage, not just app access.

**Codebase implication:**
You can end up with a partially deleted account: the app reports success, the local account is unusable, but the external WorkOS identity still exists and remains linked to that deleted row. That is an operationally confusing failure mode and violates the intended lifecycle contract.

**Evidence:**
- [account route](/Users/declancowen/Documents/GitHub/Linear/app/api/account/route.ts:49) logs WorkOS deletion failures and still returns `ok: true`.
- [local tombstone](/Users/declancowen/Documents/GitHub/Linear/convex/app/workspace_team_handlers.ts:1482) preserves the row with `accountDeletedAt`.
- [identity resolution](/Users/declancowen/Documents/GitHub/Linear/convex/app/data.ts:100) still hard-fails if that same `workosUserId` appears again.

### Recommendations

1. **Fix first:** `B4-02`, because delete-account is currently allowed to report a successful lifecycle transition while leaving the provider identity in a broken intermediate state.
2. **Then address:** `B4-01`, so the remove-member/remove-user flows finally match the clarified owner/admin notification requirement that the leave/delete-account paths already implement.
3. **Regression check:** The previous five findings still look resolved; these two are residual gaps, not regressions from the selector/authz fixes.

### User clarification captured after Turn 4

- Leave, remove, and delete-account should all notify the relevant workspace owner and team admin(s) via inbox/email.
- If an admin removes a user from a team, the removed user should also be notified.
- If an admin removes a user from a workspace, the removed user should receive email only.
- Deleting a workspace should delete workspace-scoped data in Convex only. It should not delete WorkOS auth identities, and it should not delete Convex user records. User/auth deletion happens only at the delete-account level.
- Current implementation note for the next rerun: [deleteWorkspaceHandler](/Users/declancowen/Documents/GitHub/Linear/convex/app/workspace_team_handlers.ts:592) still calls `cleanupUnreferencedUsers`, so this requirement change is likely to produce another open finding unless that path is changed.

---

## Turn 3 — 2026-04-16 18:17:21 BST

| Field | Value |
|-------|-------|
| **Commit** | `41b4d9f` |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** Architecture-standards pass completed. The change set now fits the intended boundaries better: active identity resolution is centralized in the data layer, auth-entry mutations canonicalize email before persistence, and the new workspace/team lifecycle paths use explicit schema indexes instead of introducing avoidable table scans on the common lookup paths. `pnpm typecheck` and targeted `pnpm eslint` both pass after this pass.

| Status | Count |
|--------|-------|
| New findings | 0 |
| Resolved from Turn 2 | 0 |
| Carried from Turn 2 | 0 |
| Accepted | 0 |

### Architecture Alignment Notes

- **Policy centralized inward:** [data.ts](/Users/declancowen/Documents/GitHub/Linear/convex/app/data.ts:93) now owns the “active user by WorkOS/email identity” rule instead of repeating deleted-account checks across auth entrypoints.
- **Canonical input at the boundary:** [core.ts](/Users/declancowen/Documents/GitHub/Linear/convex/app/core.ts:248) and [auth_bootstrap.ts](/Users/declancowen/Documents/GitHub/Linear/convex/app/auth_bootstrap.ts:121) normalize auth-bound email values before lookup or persistence, which keeps the indexed identity path consistent with future writes.
- **Data-layer access patterns tightened:** [schema.ts](/Users/declancowen/Documents/GitHub/Linear/convex/schema.ts:37) now exposes `teams.by_workspace` and `workspaces.by_created_by`, and [data.ts](/Users/declancowen/Documents/GitHub/Linear/convex/app/data.ts:119), [conversations.ts](/Users/declancowen/Documents/GitHub/Linear/convex/app/conversations.ts:29), and [cleanup.ts](/Users/declancowen/Documents/GitHub/Linear/convex/app/cleanup.ts:265) use those helpers instead of embedding new full-scan workspace ownership/workspace-team lookups in feature code.
- **Residual risk:** There are still broader full-collection snapshot/cleanup reads elsewhere in this codebase, but they predate this feature and were not expanded on the hot path by the access-lifecycle work after this pass.

---

## Turn 2 — 2026-04-16 18:07:28 BST

| Field | Value |
|-------|-------|
| **Commit** | `41b4d9f` |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** The fix pass aligned the change set to a cleaner architecture shape: authorization policy now lives in explicit owner-only and team-admin-only helpers, the route layer mirrors the same rules, settings-screen projections no longer happen inside store selectors, and deleted users are tombstoned in a way that preserves history without blocking future re-onboarding. `pnpm typecheck` and targeted `pnpm eslint` both pass after the changes.

| Status | Count |
|--------|-------|
| New findings | 0 |
| Resolved from Turn 1 | 5 |
| Carried from Turn 1 | 0 |
| Accepted | 0 |

### Resolved from Turn 1

#### B1-01 ~~[BUG] Critical~~ → RESOLVED — Settings pages fall into an infinite render loop
**How it was fixed:** [team-settings-screen.tsx](/Users/declancowen/Documents/GitHub/Linear/components/app/settings-screens/team-settings-screen.tsx:55) and [workspace-settings-screen.tsx](/Users/declancowen/Documents/GitHub/Linear/components/app/settings-screens/workspace-settings-screen.tsx:84) now subscribe only to stable raw store slices and derive `teamMembers` / `workspaceUsers` with `useMemo` in the component layer.
**Verified:** This removes the fresh-object store snapshot churn that triggered the `getSnapshot should be cached` / maximum update depth loop.

#### S1-02 ~~[SECURITY] High~~ → RESOLVED — Workspace membership removal was authorized for workspace admins instead of owner-only
**How it was fixed:** [access.ts](/Users/declancowen/Documents/GitHub/Linear/convex/app/access.ts:61) now defines `requireWorkspaceOwnerAccess`, and [workspace_team_handlers.ts](/Users/declancowen/Documents/GitHub/Linear/convex/app/workspace_team_handlers.ts:1228), [workspace/current/route.ts](/Users/declancowen/Documents/GitHub/Linear/app/api/workspace/current/route.ts:48), and [settings-images/upload-url/route.ts](/Users/declancowen/Documents/GitHub/Linear/app/api/settings-images/upload-url/route.ts:46) all enforce owner-only workspace settings behavior consistently.
**Verified:** The UI, Next routes, and Convex mutation layer now agree on the same owner-only workspace policy.

#### S1-03 ~~[SECURITY] High~~ → RESOLVED — Team deletion was authorized at workspace level instead of target-team level
**How it was fixed:** [access.ts](/Users/declancowen/Documents/GitHub/Linear/convex/app/access.ts:41) now defines `requireTeamAdminAccess`, and [workspace_team_handlers.ts](/Users/declancowen/Documents/GitHub/Linear/convex/app/workspace_team_handlers.ts:817) uses it for team deletion. The same helper also consolidates other team-admin operations.
**Verified:** Team delete now follows the same team-admin rule as team settings, workflow updates, join-code regeneration, and member management.

#### B1-04 ~~[BUG] High~~ → RESOLVED — Deleted accounts could not sign back up as a new customer record
**How it was fixed:** [data.ts](/Users/declancowen/Documents/GitHub/Linear/convex/app/data.ts:62) now ignores deleted users for email-based active-user resolution, while [workspace_team_handlers.ts](/Users/declancowen/Documents/GitHub/Linear/convex/app/workspace_team_handlers.ts:1461) tombstones deleted identities by rewriting their email and handle instead of leaving active identifiers in place.
**Verified:** Historical deleted rows remain addressable by ID for content/history, existing stale WorkOS sessions still resolve to the deleted record by WorkOS user ID, and a future fresh OAuth identity can create a new active user with the original email.

#### B1-05 ~~[BUG] Medium~~ → RESOLVED — Account deletion did not notify impacted workspace/team owners about the access loss
**How it was fixed:** [workspace_team_handlers.ts](/Users/declancowen/Documents/GitHub/Linear/convex/app/workspace_team_handlers.ts:205) now centralizes owner/admin access-change notifications, [workspace_team_handlers.ts](/Users/declancowen/Documents/GitHub/Linear/convex/app/workspace_team_handlers.ts:1430) emits those notifications during account deletion, and [account/route.ts](/Users/declancowen/Documents/GitHub/Linear/app/api/account/route.ts:24) sends the resulting transactional emails.
**Verified:** Leave-team, leave-workspace, and delete-account now share the same notification/email orchestration pattern for owner-facing access-loss events.

### Recommendations

1. **Fix first:** No blocking findings remain in the reviewed scope.
2. **Then address:** The next sensible follow-up is broader smoke testing of workspace/team settings and delete-account behavior in a real authenticated session.
3. **Patterns noticed:** The change set is stronger after moving policy into dedicated helpers and keeping selector work out of the store boundary. That is the main architectural improvement from this pass.
4. **Suggested approach:** Keep extending the same pattern if this feature grows further: route-layer authorization should mirror the same policy helpers used by the mutation layer, and access-change side effects should stay centralized instead of being reimplemented per endpoint.

---

## Turn 1 — 2026-04-16 17:53:42 BST

| Field | Value |
|-------|-------|
| **Commit** | `41b4d9f` |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** This change set is trying to make membership and account lifecycle a first-class product flow: owner-only workspace membership management, team-admin team management, self-serve leave flows for non-admin users, and tombstoned deleted accounts that keep historical content visible. It also extends cleanup into chats, projects, views, presence, notifications, and email. `pnpm typecheck` passes, but the current diff still has five blocking issues: two runtime regressions in the settings screens, two authorization mismatches, and one account-lifecycle gap against the clarified requirements.

| Status | Count |
|--------|-------|
| Findings | 5 |

### Findings

#### B1-01 [BUG] Critical — `components/app/settings-screens/workspace-settings-screen.tsx:84` and `components/app/settings-screens/team-settings-screen.tsx:55` — Settings pages fall into an infinite render loop

**What's happening:**
Both settings screens call `useAppStore(useShallow(...))` with selectors that build fresh arrays of fresh member view-model objects on every snapshot read. Because each array element is a newly allocated object, shallow equality never matches the previous result, React keeps seeing a different store snapshot, and the page hits the exact `getSnapshot should be cached` / `Maximum update depth exceeded` failure you reported.

**Root cause:**
The store selector is doing non-memoized projection work instead of selecting stable state slices and deriving the display model outside the Zustand subscription boundary.

**Codebase implication:**
Workspace settings and team settings are both unstable, which blocks testing the rest of the feature set. The same pattern is likely to recur anywhere else a selector returns newly allocated arrays of objects under `useShallow`.

**Solution options:**
1. **Quick fix:** Select only stable store slices like `users`, `teamMemberships`, `teams`, and `currentUserId`, then derive `workspaceUsers` / `teamMembers` with `useMemo`.
2. **Proper fix:** Move these projections into shared memoized selectors that preserve references when the underlying slices have not changed.

**Investigate:**
Search every `useAppStore(useShallow(...))` call that maps objects inline and verify whether it can return a fresh unequal snapshot even when the store has not changed.

> `return state.teamMemberships ... .flatMap(...) ... .sort(...)`

#### S1-02 [SECURITY] High — `convex/app/workspace_team_handlers.ts:1108` — Workspace membership removal is owner-only in the product, but the API currently allows any workspace admin

**What's happening:**
The workspace settings UI is explicitly owner-only, but `removeWorkspaceUserHandler` authorizes with `requireWorkspaceAdminAccess`. In this codebase, workspace-admin access is derived from team admin roles inside the workspace, so a non-owner team admin can remove users from the entire workspace by calling the route directly.

**Root cause:**
The server path reused the broader workspace-admin guard instead of enforcing the stricter owner-only requirement that the UI and requirements describe.

**Codebase implication:**
This is an authorization mismatch between frontend and backend. It turns a hidden UI affordance into a direct API capability and lets a non-owner alter membership across all teams in the workspace.

**Solution options:**
1. **Quick fix:** Replace `requireWorkspaceAdminAccess` here with an explicit workspace-owner check.
2. **Proper fix:** Introduce a `requireWorkspaceOwnerAccess` helper and use it consistently for owner-only workspace operations.

**Investigate:**
Confirm whether any non-owner should ever be able to remove workspace users. If the answer is no, the same owner-only guard should be applied to any future workspace-membership endpoints too.

> `await requireWorkspaceAdminAccess(ctx, args.workspaceId, args.currentUserId)`

#### S1-03 [SECURITY] High — `convex/app/workspace_team_handlers.ts:705` — Team deletion is authorized at workspace level instead of target-team level

**What's happening:**
`deleteTeamHandler` checks `requireWorkspaceAdminAccess`, while the other team-management handlers in the same file check that the caller is an admin of the target team. That means an admin of Team A can delete Team B inside the same workspace via the API, even though the UI and requirements treat delete-team as a team-admin capability on that team.

**Root cause:**
The delete path uses a workspace-wide authorization helper instead of the team-specific admin check already used for updating team details, join codes, workflow settings, and member management.

**Codebase implication:**
Backend authorization is broader than the UI and broader than the assignment you clarified. It also explains why the delete-team permission model feels inconsistent: the code does not encode “admin of this team” as the actual rule.

**Solution options:**
1. **Quick fix:** Gate deletion on `getEffectiveRole(ctx, args.teamId, args.currentUserId) === "admin"`.
2. **Proper fix:** Add a shared `requireTeamAdminAccess` helper and use it across every team-admin mutation, including deletion.

**Investigate:**
Confirm whether there is any intentional workspace-wide override for deleting teams. If not, the server should exactly match the team-level rule the UI already assumes.

> `await requireWorkspaceAdminAccess(ctx, team.workspaceId, args.currentUserId)`

#### B1-04 [BUG] High — `convex/app/server_users.ts:18`, `convex/app/auth_bootstrap.ts:240`, `:814`, and `:908` — Deleted accounts cannot sign back up as a new customer record

**What's happening:**
After account deletion, the old user row keeps the email plus `accountDeletedAt`. Every auth bootstrap path now throws if it finds that deleted row by WorkOS user ID or email. That directly conflicts with the clarified requirement that a user who signs up again with a new OAuth identity should get a fresh customer record.

**Root cause:**
Deleted accounts are being treated as permanently blocked identities instead of historical tombstones that should be ignored during active identity resolution.

**Codebase implication:**
Account deletion becomes irreversible in practice. Anyone who deletes their account and later returns with the same email will be blocked from onboarding instead of creating a new active user.

**Solution options:**
1. **Quick fix:** Skip tombstoned users during email/workos identity resolution when bootstrapping an active login.
2. **Proper fix:** Separate “historical deleted user” handling from “active identity lookup” and explicitly mint a fresh user row when the auth identity is new.

**Investigate:**
Decide whether email uniqueness applies only to active users or also to deleted historical records. The current code assumes the latter, but the requirement you clarified needs the former.

> `if (existing.accountDeletedAt) { throw new Error("This account has been deleted") }`

#### B1-05 [BUG] Medium — `convex/app/workspace_team_handlers.ts:1273` and `app/api/account/route.ts:25` — Account deletion does not notify impacted workspace/team owners about the access loss

**What's happening:**
Leave-team and leave-workspace flows create notifications and email jobs, but `deleteCurrentAccountHandler` only removes memberships, cleans up downstream references, deletes app state, and tombstones the user. No owner/admin notifications or outbound email jobs are produced when the user disappears through account deletion.

**Root cause:**
The delete-account implementation was treated as a data-cleanup operation rather than as another membership-loss event that should trigger the same owner-facing communication pattern as leave flows.

**Codebase implication:**
Workspace and team owners lose operational visibility into why access disappeared. That breaks the requirement you clarified and makes account deletion harder to audit than ordinary leave/remove flows.

**Solution options:**
1. **Quick fix:** Capture affected workspaces/teams before deleting memberships and emit the same owner/admin notifications and email jobs used by leave flows.
2. **Proper fix:** Centralize access-change side effects so leave, remove, and delete-account all share one notification/email orchestration path.

**Investigate:**
Confirm the exact recipient rules for account deletion notifications: workspace owner only at the workspace level, and all team admins vs one designated owner at the team level.

> `return { userId: user.id, removedWorkspaceIds: Object.keys(removedTeamIdsByWorkspace) }`

### Recommendations

1. **Fix first:** `B1-01`, because the team and workspace settings pages currently crash and block practical verification of the rest of the feature.
2. **Then address:** `S1-02` and `S1-03`, because the current server authorization is looser than the product rules and UI affordances.
3. **Then close the lifecycle gaps:** `B1-04` and `B1-05`, since the clarified requirements explicitly depend on fresh-account recreation and owner-facing notifications during account deletion.
4. **Patterns noticed:** The diff is strong on cleanup and historical visibility, but weaker on centralizing permission rules and access-change side effects. The same business rule is currently implemented differently across UI, route handlers, and Convex mutations.
5. **Suggested approach:** Stabilize the settings selectors first, then consolidate authorization helpers (`owner-only`, `team-admin-only`), then refactor account deletion to share the same notification/orchestration path as leave flows while allowing deleted identities to re-onboard as new users.
