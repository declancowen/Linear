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
