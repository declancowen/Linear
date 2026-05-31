# Review: Work Items, People, Notifications, And Subscriptions

## Project context

| Field | Value |
|-------|-------|
| **Repository** | Linear |
| **Remote** | https://github.com/declancowen/Linear.git |
| **Branch** | main working tree, to be pushed from feature branch |
| **Stack** | Next.js, React, Convex, Zustand, TypeScript |

## Scope

- Work item subscription/unsubscription API, backend handler, optimistic store action, detail UI, read-model bumps, and subscriber filters.
- Subscriber notification delivery for work item status changes and work item comments, including in-app and email paths.
- Private task creation/update/access semantics, private numbering, team/workspace destructive cleanup paths, and My Items private-task visibility.
- Work item status-change activity persistence and detail read-model delivery.
- Notification inbox read-state reconciliation, message-list presentation, resize-handle affordance, and timestamp containment.
- People workspace surface, profile surface UI, profile activity selectors/read model, hover-card Profile action, and sidebar navigation under the workspace Channel section.
- Workspace/global search user results and profile navigation.
- Work view reset behavior, My Items active/backlog/subscribed defaults, hierarchy filters, and child-item naming.
- Channel post/comment post-creation reliability and optimistic reconciliation.
- Sidebar hover-card containment for shell/surface sidebars.

## Hotspots

- Authorization and tenancy boundaries across workspace, team, private-task, people, search, and channel activity read models.
- Destructive cleanup paths for team/workspace deletion and private-task isolation.
- Optimistic/persisted reconciliation for subscriptions, notifications, channel posts, and view configuration.
- Broad presentation changes in inbox, people/profile, hover cards, work item detail sidebars, and work surfaces.
- Shared selectors and scoped read-model seed paths.

## Review status

| Field | Value |
|-------|-------|
| **Review started** | 2026-05-31 |
| **Last reviewed** | 2026-05-31 10:49 BST |
| **Total turns** | 3 |
| **Open findings** | 0 |
| **Resolved findings** | 1 |
| **Accepted findings** | 0 |

## Turn 3 - 2026-05-31 10:49 BST

| Field | Value |
|-------|-------|
| **Commit** | d2428bc0 working tree |
| **IDE / Agent** | Codex |

**Summary:** Branch-total deep diff review rerun after the inbox resize/timestamp fix and after including the people/profile UI improvements in scope. The current tree has no open findings. The previous private-task backend ownership finding is resolved in the current implementation, and the latest user-reported inbox issue is resolved by constraining the notification row layout and making the resize grip always visible.

**Outcome:** all clear with one explicit verification gap: browser visual smoke could not be run because the Browser tool was not exposed by tool discovery and Playwright is not installed locally.

**Risk score:** high - shared API contracts, Convex persistence, read models, authorization/privacy, optimistic state, email/in-app notification fan-out, and broad UI surfaces changed.

**Change archetypes:** shared contracts, persistence/read models, authorization/tenancy, optimistic state, async side effects, broad UI/navigation, static-analysis-gated branch.

**Intended change:** implement work item subscriptions and subscriber notifications; fix private tasks so they are user-private task/sub-task items; add work item status activity; make notification inbox read/presentation behavior stable; add people/profile surfaces and people search; add reset/default-view behavior; fix channel post reliability; keep hover overlays contained.

**Intent vs actual:** matches intent. The people/profile UI work is included as part of the reviewed presentation scope, not treated as out-of-band polish.

**Confidence:** high for code and automated coverage. Medium-high overall because representative browser visual smoke was not available for the broad authenticated UI changes.

**Coverage note:** Full test, typecheck, lint, build, diff whitespace check, focused inbox/people/search tests, and changed-file Fallow audit all passed on the current tree.

**Finding triage:** no new findings. User-reported inbox row/date/ellipsis resize issue was treated as an external finding and is fixed in the current tree.

**Static/analyzer evidence:** `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` passed with 94 changed files, 0 dead-code issues, 0 complexity findings, and 0 duplication clone groups. Fallow emitted its existing `node_modules directory not found` warnings but returned a passing verdict.

**Architecture impact:** improved ownership. Private-task rules are enforced in backend/store boundaries instead of only UI filters; subscriptions are owned by work item mutation/read-model paths; people/profile activity is exposed through domain selectors and a workspace people read-model route; search consumes selector-built people entries instead of duplicating membership rules in presentation.

**Deep-review evidence:** Pass A (correctness/safety) found no live data, auth, stale-read, destructive-cleanup, subscriber notification, or resize-regression issues after fixes. Pass B (maintainability/structure) found no blocking structure issues; notable tradeoffs are existing large UI files and a broad branch, mitigated by capability-owned selectors, route handlers, tests, and Fallow changed-file evidence.

**Bug classes / invariants checked:** private tasks remain creator-private and not team-owned for destructive cleanup; private tasks cannot be subscribed to; subscribers receive work item comment/status notifications like assignees/creators where applicable; read notifications do not flip unread from stale read models; person activity excludes direct chat and inaccessible/private content; people search routes to `/workspace/people/[userId]`; inbox row timestamp and resize grip remain contained under narrow widths.

**Branch totality:** current working tree diff against `origin/main` was reviewed, including untracked people/review files and the latest inbox UI fix.

**Sibling closure:** subscription API/store/UI/server paths checked together; private create/update/read-model/cleanup/store/test paths checked together; people board/profile/search/hover/sidebar/read-model paths checked together; inbox row/list pane/controller/read-state tests checked together.

**Remediation impact surface:** broad but coherent. Changes land in owning layers: Convex/application handlers for persistence and authorization, domain selectors for read/search decisions, scoped read models for delivery, Zustand slices for optimistic state, and presentation components for layout/actions.

**Residual risk / unknowns:** no browser smoke for authenticated `/workspace/people`, `/workspace/people/[userId]`, `/inbox`, and work item detail surfaces in this environment. The automated coverage and build passed, but a manual UI pass in a logged-in browser remains useful after PR creation.

### Validation

- `git diff --check` - passed.
- `pnpm typecheck` - passed.
- `pnpm lint` - passed.
- `pnpm vitest run tests/components/inbox-ui.test.tsx tests/components/inbox-screen.test.tsx tests/components/people-screen.test.tsx tests/lib/domain/workspace-search.test.ts tests/components/workspace-search-screen.test.tsx` - passed, 5 files / 16 tests.
- `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` - passed.
- `pnpm build` - passed.
- `pnpm test` - passed, 210 files / 1292 tests.

### Branch-totality proof

- **Non-delta files/systems re-read:** inbox row/list pane/controller; people/profile screen and selectors; user hover-card/hover-card primitive; work item subscription API/server/store/detail UI; search selector and search UI; private task backend/store/cleanup tests.
- **Prior open findings rechecked:** WI-PVT-001 is resolved by private-task workspace fields, creator-scoped PVT numbering, private description docs not team-linked, private create not requiring editable team work-item support, subscription rejection for private tasks, and team deletion preserving private tasks.
- **Prior resolved/adjacent areas revalidated:** status activity persistence, hover containment, read-state reconciliation, channel post optimistic update reliability, subscribed default view behavior, and reset view behavior.
- **Hotspots or sibling paths revisited:** work item comments/status notification fan-out, email job kind/builders, scoped read-model seeds, search seed users, direct-chat exclusion from people activity, and team/channel access checks for person activity.
- **Dependency/adjacent surfaces revalidated:** route contracts, Convex handlers, domain selectors, store slices, UI components, scoped read models, and default view definitions.
- **Why this is enough:** the branch changes are covered by direct focused tests and full repo gates, and the remaining unknown is visual/authenticated browser smoke rather than unreviewed code behavior.

### Challenger pass

- done - assumed one serious issue remained and hunted in destructive cleanup, stale read-model reconciliation, private task/team ownership, subscriber fan-out, people activity privacy, responsive inbox layout, and search scope. No new live issue found.

### Resolved / Carried / New findings

#### WI-PVT-001 [High] Private tasks are still team-owned in destructive backend paths - resolved

The current tree removes the live data-loss risk called out in Turn 2. Private work items now carry workspace scope, private description docs are not team-linked, private numbering is creator-scoped across teams, team cleanup filters out private work items, and tests cover preserving private work items, documents, and activities during team deletion.

**Resolution evidence:** `convex/app/work_item_handlers.ts`, `convex/app/data.ts`, `convex/app/cleanup.ts`, `tests/convex/work-item-handlers.test.ts`, `tests/convex/cleanup.test.ts`, `tests/lib/store/work-item-actions.test.ts`.

### Recommendations

1. **Fix first:** none.
2. **Then address:** run a manual authenticated browser pass on people/profile, inbox resizing, and work item subscription UI after the PR is available.
3. **Patterns noticed:** large existing UI files remain a maintainability pressure, but this branch did not introduce a new analyzer finding or a new generic helper bucket.
4. **Suggested approach:** keep future work in the same ownership pattern: backend invariants in Convex/application handlers, query visibility in domain selectors/read models, and UI components focused on presentation/actions.
5. **Architecture transition:** no additional transition artifact required beyond the tests and selectors added here.
6. **Defer on purpose:** browser smoke is deferred only because the required tooling is unavailable in this environment.

## Turn 2 - 2026-05-31

| Field | Value |
|-------|-------|
| **Commit** | d2428bc0 working tree |
| **IDE / Agent** | Codex |
| **Risk score** | High |
| **Outcome** | one open High finding |
| **Change archetypes** | ownership boundary, destructive cleanup, persistence/read models |

### Open Findings

#### WI-PVT-001 [High] Private tasks are still team-owned in destructive backend paths

Private task create had started to bypass team work-item feature inheritance, but still required and stored `teamId`. That storage detail was still treated as ownership by backend cleanup and numbering paths:

- `requireCreateWorkItemTeam` still required readable team access for private creation.
- `buildCreatedWorkItem` persisted `teamId: args.teamId`.
- `getCreateWorkItemNumbering` counted private keys from `by_team_id`, so a user could get duplicate `PVT-*` keys across teams.
- `cascadeDeleteTeamData` deleted every work item returned by `listWorkItemsByTeam`, including private tasks whose only link to the team was the legacy field.

This violated the target rule that private tasks are user-private and not part of a teamspace. The immediate risk was data loss when a teamspace is deleted: user private tasks tied to that team id would be deleted with team work items.

**Expected fix:** introduce an explicit private-task ownership/scope boundary, or at minimum make every team-owned destructive/listing path filter out `visibility === "private"` and make private numbering user/workspace scoped instead of team scoped. Add a regression test that deleting a team leaves the current user's private tasks and their description docs intact.

**Evidence:** `convex/app/work_item_handlers.ts`, `convex/app/data.ts`, `convex/app/cleanup.ts`.

**Verification this turn:**

- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh`
- `/Users/declancowen/.codex/skills/architecture-standards/scripts/architecture-preflight.sh`
- `git diff --check`
- `pnpm typecheck`

## Turn 1 - 2026-05-31

| Field | Value |
|-------|-------|
| **Commit** | d2428bc0 working tree |
| **IDE / Agent** | Codex |
| **Risk score** | High |
| **Outcome** | no open Critical/High findings after fixes |
| **Change archetypes** | shared contracts, persistence/read models, optimistic state, broad UI/navigation |

**Summary:** Fixed the two live gaps found in the initial final review pass. Work item status changes now persist to a dedicated `workItemActivities` collection instead of being inferred from per-recipient notifications, and work item detail read models include those activities and actor users. Sidebar user hover cards can now render without a body portal, and shell/surface sidebar usages opt into that local rendering so profile popups stay inside their owning surface.

**Architecture decision:** status history is now owned by the work-item mutation/read-model path, not by inbox notifications. Notifications remain delivery/read-state records; activity remains item history.

**Verification:**

- `pnpm typecheck`
- `pnpm vitest run tests/lib/scoped-read-models.test.ts tests/lib/convex/read-models.test.ts tests/convex/work-item-handlers.test.ts tests/components/work-item-detail-screen.test.tsx tests/components/user-presence.test.tsx tests/lib/store/work-item-actions.test.ts tests/lib/store/domain-updates.test.ts tests/lib/app-store-read-model-merge.test.ts`
- `pnpm vitest run tests/lib/domain/default-views.test.ts tests/lib/domain/view-item-level.test.ts tests/lib/store/ui-slice.test.ts tests/lib/store/work-item-actions.test.ts tests/lib/store/work-comment-actions.test.ts tests/lib/store/collaboration-channel-actions.test.ts tests/convex/comment-handlers.test.ts tests/convex/chat-message-notifications.test.ts tests/convex/work-item-handlers.test.ts tests/convex/email-job-handlers.test.ts tests/lib/email-builders.test.ts tests/components/people-screen.test.tsx tests/components/user-presence.test.tsx tests/components/inbox-ui.test.tsx tests/components/work-surface.test.tsx tests/components/work-item-detail-screen.test.tsx tests/app/api/read-model-route-contracts.test.ts tests/app/api/work-route-contracts.test.ts tests/lib/scoped-read-models.test.ts tests/lib/convex/read-models.test.ts tests/lib/app-store-read-model-merge.test.ts tests/lib/store/domain-updates.test.ts`
- `git diff --name-only --diff-filter=ACMRTUXB | rg '\\.(ts|tsx)$' | xargs pnpm exec eslint`
- `git diff --check`
- `pnpm build`

**Residual risk:** browser visual smoke for authenticated `/workspace/*` pages could not be completed in this environment. The dev server was available, but unauthenticated page requests redirected to login, the Browser MCP tool was not available from tool discovery, and Playwright was not installed locally.
