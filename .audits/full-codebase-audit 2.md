# Full Codebase Audit

## Header

- Turn: 1
- Date: 2026-04-13 15:11:06 BST
- Commit: `4301f87` (`4301f874b9154536917dec62db04b6b741f798d0`)
- Remote: `https://github.com/declancowen/Linear.git`
- OS: `Darwin 25.4.0`
- Stack: Next.js 16, React 19, Convex, WorkOS, Zustand, Electron

## Verification

- `pnpm lint` passed with two warnings.
- `pnpm typecheck` passed.
- `pnpm build` passed.
- `pnpm convex:codegen` passed.
- `pnpm exec electron --version` returned `v24.14.0`.

## Turn 1 Summary

This turn fixed the repo back to a green runtime/tooling baseline and tightened the relationship rules around teams, projects, and work items. The app now prevents cross-team assignees, rejects unrelated project links, enforces project-template item types, and respects team feature flags when creating team-scoped projects, docs, and issues.

## Resolved This Turn

### B1-01 Resolved: Rich text editor lint failure from reading refs during render

- Evidence: `components/app/rich-text-editor.tsx`
- Root cause: slash menu positioning read `containerRef.current` during render.
- Fix: moved width measurement into a `ResizeObserver`-backed effect and used derived state for layout.

### B1-02 Resolved: Work item relationships were not validated

- Evidence: `convex/app.ts`, `lib/store/app-store.ts`, `components/app/screens.tsx`
- Root cause: issue creation and update flows accepted any user as assignee, any project as primary project, and any item type regardless of project template or team semantics.
- Fix: added store and Convex validation for team membership, team/workspace project scope, team feature gates, and allowed item types; filtered the UI to only show valid assignees, projects, and item types.

### B1-03 Resolved: Team feature gates were only a UI convention for some entities

- Evidence: `convex/app.ts`, `lib/store/app-store.ts`
- Root cause: team-scoped project and document creation did not enforce `projects` and `docs` feature flags server-side.
- Fix: added server and optimistic-store validation so disabled surfaces cannot silently accept new entities.

### D1-01 Resolved: Seed taxonomy mislabeled the development team

- Evidence: `lib/domain/seed.ts`
- Root cause: the seeded Development team was marked as `issue-analysis` even though its summary and membership reflected engineering work.
- Fix: changed the seeded team experience to `software-development`.

## Open Findings

### A1-01 Medium: There is no first-class project-management team archetype

- Evidence: `lib/domain/types.ts:9-21`, `lib/domain/types.ts:463-530`
- Detail: projects support a `project-management` template, but teams only support `software-development`, `issue-analysis`, and `community`.
- Impact: the product can brand a project as project-management, but it still cannot model a project/program-management team with its own defaults, copy, and governance rules.
- Recommendation: add a dedicated team experience for project/program management and wire it into feature defaults, onboarding, workflow defaults, and iconography.

### B1-04 Medium: Sub-issues are modeled in data but not implemented in product flows

- Evidence: `lib/domain/types.ts:267-290`, `components/app/screens.tsx:1013-1015`, `convex/app.ts:3016-3028`
- Detail: `WorkItem.parentId` exists, the detail screen renders an "Add sub-issues" affordance, but create flows still hardcode `parentId: null` and there is no parent-selection/edit path.
- Impact: tasks, sub-tasks, issues, and sub-issues cannot be edited at the correct hierarchy level because the hierarchy is not operational.
- Recommendation: add parent selection and creation flows plus server validation for allowed parent/child type pairs.

### D1-02 Low: Team icons are stored but not actually enforced or rendered as a taxonomy

- Evidence: `lib/domain/types.ts:195-210`, `components/app/shell.tsx:394-412`, `components/app/shell.tsx:825-831`
- Detail: teams carry a free-form `icon` string and the settings UI exposes a raw "Icon token" field, but the sidebar renders only team names and there is no allowed icon registry.
- Impact: icon consistency is manual, so "right icons for the right project types" is not enforceable today.
- Recommendation: introduce a finite icon map, render it in navigation and previews, and validate saved tokens against that registry.

### T1-01 Low: Desktop verification is inconsistent in the local environment

- Evidence: `package.json`, `pnpm why electron`, `./node_modules/.bin/electron --version`
- Detail: dependency metadata resolves `electron@41.2.0`, but the executable under `node_modules/.bin/electron` reports `v24.14.0`.
- Impact: desktop verification cannot be trusted until the local Electron binary matches the declared dependency.
- Recommendation: reinstall Electron or clear the package store before relying on desktop wrapper verification.

### Q1-01 Low: Lint still reports two unused-variable warnings

- Evidence: `components/app/collaboration-screens.tsx:603`, `components/app/team-workflow-settings-dialog.tsx:34`
- Impact: non-blocking, but it keeps the repo from being warning-free.
- Recommendation: remove the unused variables or wire them into the intended UI behavior.

## Turn 2

### Verification

- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm build` passed.
- `pnpm convex:codegen` passed.

### Turn 2 Summary

This turn closed the remaining structural product-model gaps from Turn 1. The repo now has a first-class `project-management` team archetype, operational parent/child issue hierarchy flows with server and store validation, and a validated icon registry that is actually rendered in navigation and project/template UI.

### Resolved This Turn

#### A1-01 Resolved: First-class project-management team archetype now exists

- Evidence: `lib/domain/types.ts`, `convex/validators.ts`, `convex/app.ts`, `components/app/shell.tsx`, `lib/domain/seed.ts`, `scripts/bootstrap-app-workspace.mjs`
- Root cause: team experiences stopped at software development, issue analysis, and community, while project templates already modeled project management separately.
- Fix: added `project-management` as a team experience across domain types, validators, bootstrap, team create/update flows, workflow defaults, feature defaults, copy, and seed data. The seeded Operations team was converted into a visible Project Management team with matching defaults and memberships.

#### B1-04 Resolved: Sub-issue hierarchy is now operational instead of dead schema

- Evidence: `convex/app.ts`, `lib/store/app-store.ts`, `app/api/items/[itemId]/route.ts`, `components/app/screens.tsx`, `lib/domain/selectors.ts`, `lib/domain/seed.ts`
- Root cause: `parentId` existed in the model but was ignored by create/update flows, and the UI exposed a non-functional “Add sub-issues” affordance.
- Fix: wired `parentId` through API, client, server, store, and Convex mutations; added same-team, no-cycle, and allowed parent/child type validation; added parent editing and child creation flows in the issue detail screen; and updated seed data with real parent/child examples.

#### D1-02 Resolved: Team and template icons are now validated and rendered consistently

- Evidence: `lib/domain/types.ts`, `components/app/entity-icons.tsx`, `components/app/shell.tsx`, `components/app/screens.tsx`
- Root cause: icon values were free-form strings and were not shown in the main navigation or template selection UI.
- Fix: added a finite icon registry, normalized saved values by team experience, replaced the raw icon-token text field with a validated picker, rendered team icons in the sidebar, and rendered template glyphs in project cards, detail views, and create flows.

#### B2-01 Resolved: Join and invite flows no longer downgrade existing roles

- Evidence: `convex/app.ts`, `lib/store/app-store.ts`
- Root cause: both join-code and invite-acceptance paths overwrote stronger existing memberships with weaker incoming roles.
- Fix: introduced role-priority merging in both optimistic store logic and Convex mutations so existing `admin`/`member` access is preserved and notifications are only created when membership meaningfully changes.

#### B2-02 Resolved: Clearing saved-view filters now syncs to the server

- Evidence: `convex/app.ts`, `lib/convex/client.ts`, `lib/server/convex.ts`, `app/api/views/[viewId]/route.ts`, `lib/store/app-store.ts`
- Root cause: `clearViewFilters` only mutated local Zustand state and never called the server, so refreshed snapshots could bring the filters back.
- Fix: added a dedicated `clearFilters` API action, a matching Convex mutation wrapper, and optimistic-store sync.

#### D2-01 Resolved: Seed data now respects its own project/template taxonomy

- Evidence: `lib/domain/seed.ts`
- Root cause: the seeded `project_platform_docs` project used the `project-management` template while containing a `feature`, which violated the template item rules enforced elsewhere.
- Fix: moved that project to the `software-delivery` template and aligned seeded hierarchy examples with the allowed work-item relationships.

#### Q1-01 Resolved: Lint warnings were removed

- Evidence: `components/app/collaboration-screens.tsx`, `components/app/team-workflow-settings-dialog.tsx`
- Fix: removed the unused variables/imports and kept the repo warning-free under `pnpm lint`.

### Remaining Findings

#### T1-01 Low: Desktop Electron verification is still inconsistent in the local environment

- Evidence: `package.json`, `pnpm why electron`, `./node_modules/.bin/electron --version`
- Status: still open from Turn 1; this pass did not change the local Electron installation state.
- Impact: desktop verification cannot be trusted until the installed binary matches the declared dependency.
- Recommendation: reinstall Electron or clear the package store before relying on desktop wrapper verification.

## Turn 3

### Verification

- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `pnpm convex:codegen` passed.
- `pnpm build` passed.

### Turn 3 Summary

This turn focused on the remaining end-to-end consistency gaps across team issue views, permissions, commenting, and account management. The repo now normalizes team issue-view scaffolding consistently, filters snapshots down to user-accessible data, supports threaded comment replies with reactions, and exposes WorkOS-backed email-change and password-reset flows in the product.

### Resolved This Turn

#### A3-01 Resolved: Team issue views are now canonical and consistent across teams

- Evidence: `lib/domain/default-views.ts`, `lib/domain/seed.ts`, `lib/domain/selectors.ts`, `components/app/screens.tsx`, `convex/app.ts`, `lib/server/authenticated-app.ts`
- Root cause: Recipe Room, Development, and other teams were seeded or left with divergent issue-view naming and routing, so surfaces could show `All work`, `Active`, `Backlog`, or custom legacy names like `Platform Priorities` for the same concept.
- Fix: introduced canonical team issue-view builders, normalized legacy team views into `All issues` / `Active` / `Backlog`, wired deep links through `?view=<id>`, and ensured existing workspaces receive the same scaffolding on authenticated load.

#### P3-01 Resolved: Snapshot and document access are now filtered to readable scope

- Evidence: `convex/app.ts`
- Root cause: `getSnapshot` returned essentially all domain data and document edit rules allowed any editable workspace member to modify private documents.
- Fix: filtered workspaces, teams, memberships, users, projects, milestones, work items, documents, views, comments, attachments, invites, notifications, conversations, chat messages, channel posts, and channel post comments to current-user-visible scope; private documents are now only editable by their creator.

#### C3-01 Resolved: Work-item and document comments now support real threads and reactions

- Evidence: `lib/domain/types.ts`, `convex/validators.ts`, `convex/app.ts`, `lib/server/convex.ts`, `lib/convex/client.ts`, `lib/store/app-store.ts`, `components/app/screens.tsx`, `app/api/comments/route.ts`, `app/api/comments/[commentId]/reactions/route.ts`
- Root cause: `parentCommentId` existed in the model but was not wired through the API or store, and comments had no reaction model at all.
- Fix: threaded replies now persist through API, store, and Convex validation; reply targets are validated to stay on the same entity; comments carry reaction state; the detail UI renders nested threads and reaction toggles; and comment mention-email failures no longer block successful comment writes.

#### A3-02 Resolved: WorkOS account recovery and email change flows are now exposed in-product

- Evidence: `lib/server/workos.ts`, `app/api/account/email/route.ts`, `app/api/account/password-reset/route.ts`, `app/auth/forgot-password/route.ts`, `app/auth/reset-password/route.ts`, `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`, `components/app/auth-entry-screen.tsx`, `components/app/shell.tsx`, `app/auth/logout/route.ts`
- Root cause: the app depended on WorkOS for identity but did not expose user-facing email-change or password-reset flows.
- Fix: added forgot/reset password pages and routes, added authenticated password-reset initiation and email-change APIs, exposed both flows in the profile dialog, and logged the user out after email changes so the new WorkOS email can become canonical.

#### B3-01 Resolved: Canonical team-view scaffolding no longer rewrites views on every authenticated request

- Evidence: `convex/app.ts`, `lib/server/authenticated-app.ts`
- Root cause: workspace scaffolding ran during authenticated bootstrap and patched canonical issue views even when they already matched, causing unnecessary writes and noisy `updatedAt` churn.
- Fix: canonical views are now patched only when their saved structure actually differs from the expected canonical definition.

#### S3-01 Resolved: Logout return paths are now same-origin only

- Evidence: `app/auth/logout/route.ts`
- Root cause: the new `returnTo` support accepted arbitrary absolute URLs and handed them to the logout redirect flow.
- Fix: `returnTo` values are now resolved against the current origin and rejected when they point off-origin, with `/login` as the fallback.

### Remaining Findings

#### T1-01 Low: Desktop Electron verification is still inconsistent in the local environment

- Evidence: `package.json`, `pnpm why electron`, `./node_modules/.bin/electron --version`
- Status: still open from Turns 1 and 2; this pass did not change the local Electron installation state.
- Impact: desktop verification cannot be trusted until the installed binary matches the declared dependency.
- Recommendation: reinstall Electron or clear the package store before relying on desktop wrapper verification.

#### A3-03 Medium: Chat-message mentions still do not produce notifications or email parity

- Evidence: `convex/app.ts:4328-4361`, `app/api/chats/[chatId]/messages/route.ts`, `lib/store/app-store.ts:2260-2321`
- Detail: chat messages record `mentionUserIds`, but unlike issue comments and channel posts they do not create mention notifications or mention emails.
- Impact: direct and group chat mentions are persisted but silent, so messaging behavior is still behind the comment/channel mention model.
- Recommendation: add a first-class notification entity/path for chat messages and wire mention notifications and optional email sends through the same server path used by comments and channel posts.

#### U3-01 Low: Issue actions are implemented as a dropdown, not a true right-click context menu

- Evidence: `components/app/screens.tsx`
- Detail: issue rows and board cards now expose status/priority/assignee/delete actions through a three-dot menu, but there is still no literal context-menu interaction matching Linear’s right-click affordance.
- Impact: the core action set exists, but full interaction parity with Linear is still incomplete.
- Recommendation: add a context-menu trigger that reuses the same action model as the dropdown menu.

#### V3-01 Low: Workspace views are still modeled as personal views rather than shared workspace views

- Evidence: `lib/domain/seed.ts`, `lib/domain/selectors.ts`, `app/(workspace)/workspace/views/page.tsx`
- Detail: workspace-level project/document views shown in the UI are still backed by `scopeType: "personal"` and filtered to the current user.
- Impact: if the target product model is Linear-style shared saved views at the workspace layer, that model is still not present.
- Recommendation: decide explicitly whether workspace views are meant to stay personal or become first-class shared workspace entities, then align routing, permissions, and create/edit UI with that decision.

## Turn 4

### Verification

- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `pnpm convex:codegen` passed.
- `pnpm build` passed.
- `git diff --check` passed.

### Turn 4 Summary

This turn fixed the reported runtime break from stale Convex deployments and closed the remaining messaging parity gap for chat mentions. Auth/bootstrap now tolerates a deployment that does not yet know about `ensureWorkspaceScaffolding`, and chat messages now create in-app mention notifications with inbox links and mention-email support.

### Resolved This Turn

#### B4-01 Resolved: Auth bootstrap no longer crashes against stale Convex deployments

- Evidence: `lib/server/convex.ts`, `lib/server/authenticated-app.ts`
- Root cause: `ensureAuthenticatedAppContext` treated `app.ensureWorkspaceScaffolding` as mandatory, so any environment still running an older Convex deployment threw `Could not find public function for 'app:ensureWorkspaceScaffolding'` during normal auth/bootstrap flows.
- Fix: made `ensureWorkspaceScaffoldingServer` backward-compatible by catching the specific missing-function error and degrading safely instead of taking down the whole authenticated request path.

#### A4-01 Resolved: Chat mentions now generate notifications and mention emails

- Evidence: `convex/app.ts`, `app/api/chats/[chatId]/messages/route.ts`, `lib/store/app-store.ts`, `lib/server/email.ts`, `lib/domain/types.ts`, `convex/validators.ts`, `lib/domain/selectors.ts`, `components/app/screens.tsx`
- Root cause: chat messages persisted `mentionUserIds` but never created notifications or email work, so messaging mentions behaved differently from comments and channel posts.
- Fix: introduced a first-class `chat` notification entity, created mention notifications from chat messages on both server and optimistic store paths, sent mention emails from the chat API route, added exact inbox/open-chat linking, and limited chat mentions to users who actually participate in the conversation.

### Remaining Findings

#### T1-01 Low: Desktop Electron verification is still inconsistent in the local environment

- Evidence: `package.json`, `pnpm why electron`, `./node_modules/.bin/electron --version`
- Status: still open from prior turns; this pass did not change the local Electron installation state.
- Impact: desktop verification cannot be trusted until the installed binary matches the declared dependency.
- Recommendation: reinstall Electron or clear the package store before relying on desktop wrapper verification.

#### U3-01 Low: Issue actions are implemented as a dropdown, not a true right-click context menu

- Evidence: `components/app/screens.tsx`
- Detail: issue rows and board cards now expose status/priority/assignee/delete actions through a three-dot menu, but there is still no literal context-menu interaction matching Linear’s right-click affordance.
- Impact: the core action set exists, but full interaction parity with Linear is still incomplete.
- Recommendation: add a context-menu trigger that reuses the same action model as the dropdown menu.

#### V3-01 Low: Workspace views are still modeled as personal views rather than shared workspace views

- Evidence: `lib/domain/seed.ts`, `lib/domain/selectors.ts`, `app/(workspace)/workspace/views/page.tsx`
- Detail: workspace-level project/document views shown in the UI are still backed by `scopeType: "personal"` and filtered to the current user.
- Impact: if the target product model is Linear-style shared saved views at the workspace layer, that model is still not present.
- Recommendation: decide explicitly whether workspace views are meant to stay personal or become first-class shared workspace entities, then align routing, permissions, and create/edit UI with that decision.

## Turn 5

### Verification

- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm build` passed.
- `git diff --check` passed.

### Turn 5 Summary

This turn closed the remaining issue-surface parity gap and clarified product intent around workspace views. Issue rows and board cards now support a real right-click context menu using the same action model as the existing three-dot dropdown, and workspace views are confirmed to be personal by design rather than an open architecture problem.

### Resolved This Turn

#### U3-01 Resolved: Issue actions now support a true right-click context menu

- Evidence: `components/ui/context-menu.tsx`, `components/app/screens.tsx`
- Root cause: issue actions were exposed only through a hover dropdown trigger, which meant Linear-style right-click interaction parity was still missing even though the action set existed.
- Fix: added a shared context-menu wrapper and reused the existing issue action model for status, priority, assignee, and delete actions on both list rows and board cards.

#### V3-01 Clarified: Workspace views are personal by design, not a missing shared-workspace model

- Evidence: product clarification plus `lib/domain/seed.ts`, `lib/domain/selectors.ts`, `app/(workspace)/workspace/views/page.tsx`
- Detail: users create custom views based on the teams they are part of; those views are intentionally personal rather than shared workspace entities.
- Outcome: this is no longer treated as an open finding. The current personal-view model matches the intended product behavior.

#### Q5-01 Resolved: Repo is back to a warning-free lint baseline

- Evidence: `app/api/teams/[teamId]/details/route.ts`, `components/app/accept-invite-card.tsx`, `lib/portal.ts`
- Root cause: a small unused API result, a stale effect dependency pattern, and intentionally unused helper parameters had reintroduced lint warnings.
- Fix: removed the unused result binding, switched invite auto-accept to `useEffectEvent`, and marked intentionally ignored portal parameters as used.

### Remaining Findings

#### T1-01 Low: Desktop Electron verification is still inconsistent in the local environment

- Evidence: `package.json`, `pnpm why electron`, `./node_modules/.bin/electron --version`
- Status: still open from prior turns; this pass did not change the local Electron installation state.
- Impact: desktop verification cannot be trusted until the installed binary matches the declared dependency.
- Recommendation: reinstall Electron or clear the package store before relying on desktop wrapper verification.
