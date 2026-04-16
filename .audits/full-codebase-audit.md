# Full Codebase Audit

## Turn 1

### Scope

- Full repo audit covering frontend, API routes, Convex, WorkOS, 100ms, Electron, scripts, tooling, and performance.
- Behavior-preserving refactor policy: no route, payload, or provider-contract changes unless recorded as an explicit bug fix.

### Environment

- Date: 2026-04-15
- Commit: `a562587`
- Branch: `t3code/repo-audit-refactor-optimize`
- Baseline install: `pnpm install --frozen-lockfile` passed
- Baseline checks:
  - `pnpm typecheck`: passed
  - `pnpm build`: passed
  - `pnpm lint`: failed with pre-existing issues

### Initial Findings

#### O1-01 Missing test and CI guardrails

- Severity: P1
- Impact: regressions can ship undetected while refactors touch auth, providers, and route flows.
- Evidence: no test stack or `.github/workflows` files were present before this turn.
- Action: add Vitest, Testing Library, MSW, `pnpm check`, and CI.

#### A1-02 API route boilerplate is duplicated across the repo

- Severity: P1
- Impact: auth, parsing, and error handling drift across 46 route handlers.
- Evidence: repeated `withAuth`, `request.json`, `safeParse`, and `NextResponse.json` patterns across `app/api/**`.
- Action: introduce shared `requireSession`, `requireAppContext`, `parseJsonBody`, `jsonOk`, and `jsonError` helpers and migrate routes incrementally.

#### P1-03 Snapshot/store model creates broad rerender risk

- Severity: P1
- Impact: replacing the full snapshot in Zustand can invalidate large UI trees.
- Evidence: provider loads `AppSnapshot` through `/api/snapshot`; many UI files subscribe with unscoped `useAppStore()`.
- Action: move changed surfaces to selector-based subscriptions and add snapshot diagnostics.

#### A1-04 Several core modules are monoliths

- Severity: P1
- Impact: high coupling and difficult safe refactors.
- Evidence:
  - `convex/app.ts` ~7.8k LOC
  - `components/app/screens.tsx` ~7.6k LOC
  - `lib/store/app-store.ts` ~4.0k LOC
  - `components/app/collaboration-screens.tsx` ~2.3k LOC
  - `components/app/shell.tsx` ~2.2k LOC
- Action: split by domain while preserving public barrels and generated Convex API names.

#### O1-05 Current lint failures block an enforceable quality gate

- Severity: P1
- Impact: `pnpm check` cannot pass until existing hook/state issues are fixed.
- Evidence: `react-hooks/set-state-in-effect` errors in `components/app/collaboration-screens.tsx`, `components/app/rich-text-editor.tsx`, `components/app/screens.tsx`, `components/app/shell.tsx`, plus `no-explicit-any` in `convex/app.ts`.
- Action: fix the existing blockers as part of this remediation slice.

#### B1-06 CRUD coverage is intentionally asymmetric across some entities

- Severity: P2
- Impact: not every domain currently exposes symmetric create/read/update/delete operations.
- Evidence:
  - projects: create/update only
  - labels: create only
  - views: read/update only
  - chats/channels: action-oriented rather than CRUD-complete
  - invites: create/accept/decline only
- Action: classify each asymmetry as intentional product scope, missing capability, or integration gap before adding APIs.

#### S1-07 Provider reconciliation paths are high-risk change surfaces

- Severity: P1
- Impact: WorkOS session handling, Convex user bootstrap, and workspace-org sync are tightly coupled.
- Evidence: auth routes call WorkOS, save sessions, and reconcile Convex/workspace state inline.
- Action: centralize provider error handling and keep live verification staged-only.

## Turn 2

### Implemented in this pass

- Added shared route helpers and migrated a first slice of API handlers to them:
  - `app/api/account/email/route.ts`
  - `app/api/account/password-reset/route.ts`
  - `app/api/comments/route.ts`
  - `app/api/documents/[documentId]/presence/route.ts`
  - `app/api/profile/route.ts`
  - `app/api/workspace/current/route.ts`
  - `app/api/chats/[chatId]/calls/route.ts`
- Moved internal client-side `/api/**` mutations behind `lib/convex/client.ts` wrappers for invite, onboarding, settings, account, and workspace flows.
- Added dev-only snapshot diagnostics for fetch duration, payload size, apply duration, and SSE reconnect counts.
- Added Vitest, Testing Library, MSW, `pnpm check`, and GitHub Actions CI.
- Fixed the pre-existing lint blockers that prevented a green baseline.

### Verification

- `pnpm lint`: passes with warnings only
- `pnpm typecheck`: passes
- `pnpm test`: passes
- `pnpm build`: passes

### Remaining planned work

- Split the largest monoliths (`convex/app.ts`, `components/app/screens.tsx`, `components/app/collaboration-screens.tsx`, `components/app/shell.tsx`, `lib/store/app-store.ts`) into stable domain modules.
- Replace the remaining broad `useAppStore()` subscriptions with selector-based reads.
- Continue route-helper migration across the rest of `app/api/**`, especially snapshot, invite, team, item, project, and channel surfaces.
- Classify and document intentionally partial CRUD surfaces versus missing capabilities.

## Turn 3

### Implemented in this pass

- Migrated additional CRUD-heavy routes onto the shared auth/body/response/error helpers:
  - `app/api/invites/route.ts`
  - `app/api/items/route.ts`
  - `app/api/items/[itemId]/route.ts`
  - `app/api/chats/[chatId]/messages/route.ts`
  - `app/api/channels/[channelId]/posts/route.ts`
  - `app/api/channel-posts/[postId]/comments/route.ts`
- Narrowed a first batch of broad Zustand subscriptions in route pages and settings screens:
  - workspace docs/projects/views pages
  - team docs/projects/views pages
  - project redirect page
  - create-team screen
  - workspace settings screen

### Verification

- `pnpm typecheck`: passes
- `pnpm test`: passes
- `pnpm build`: passes
- `pnpm lint`: passes with warnings only

### Measured progress

- Broad `useAppStore()` calls in `components`, `app`, `hooks`, and `lib` dropped from `48` to `39`.
- Direct UI-owned internal `/api/**` fetches remain eliminated.

### Remaining planned work

- Continue reducing the remaining `39` broad store subscriptions, prioritizing `components/app/screens.tsx`, `components/app/collaboration-screens.tsx`, and `components/app/shell.tsx`.
- Decompose the largest monoliths into stable internal modules while preserving public barrels and route contracts.
- Migrate the remaining API handlers to the shared route layer, especially the snapshot, team, project, notification, and channel-adjacent surfaces that still own bespoke request/error flow.

## Turn 4

### Implemented in this pass

- Decomposed `lib/convex/client.ts` into stable internal modules while preserving the public barrel:
  - `lib/convex/client/shared.ts`
  - `lib/convex/client/core.ts`
  - `lib/convex/client/work.ts`
  - `lib/convex/client/collaboration.ts`
- Removed the follow-on lint regression from that split (`UserStatus` unused import in `lib/convex/client/work.ts`).
- Continued the selector migration across large UI surfaces:
  - `components/app/screens.tsx`
  - `components/app/collaboration-screens.tsx`
- Replaced several whole-store reads with narrower selectors for:
  - collection layout routing
  - team work and assigned surfaces
  - project/view/doc surface reads
  - collaboration sidebars
  - chat thread message/user reads
  - workspace chat creation
  - channel post composition

### Verification

- `pnpm check`: passes
- `pnpm lint`: passes with warnings only
- `pnpm typecheck`: passes
- `pnpm test`: passes
- `pnpm build`: passes

### Measured progress

- Broad `useAppStore()` calls in `components`, `app`, `hooks`, and `lib` dropped from `39` to `20` in this pass.
- Net reduction across the audit so far: `48` to `20`.
- Direct UI-owned internal `/api/**` fetches remain eliminated.
- Public import compatibility for `@/lib/convex/client` remains intact after the client split.

### Remaining planned work

- Continue reducing the remaining `20` exact unscoped store subscriptions, with the biggest concentration still in `components/app/screens.tsx` and `components/app/collaboration-screens.tsx`.
- Split the next monoliths into stable internal modules, prioritizing `lib/server/convex.ts`, `components/app/shell.tsx`, and then the largest screen files.
- Migrate the remaining API handlers to the shared route layer, especially snapshot, team, project, notification, and other provider-adjacent routes that still own bespoke auth/body/error flow.

## Turn 5

### Implemented in this pass

- Continued the selector migration across the remaining search and collaboration surfaces:
  - `components/app/global-search-dialog.tsx`
  - `components/app/workspace-search-screen.tsx`
  - `components/app/collaboration-screens.tsx`
- Narrowed a large second batch inside `components/app/screens.tsx`, including:
  - inbox state reads
  - document detail mention/editability reads
  - filter popover data sourcing
  - inline comment surfaces
  - create-project, create-document, create-work-item, and child-item dialog reads
  - label editor reads
- Kept behavior stable while moving those surfaces off direct whole-store subscriptions.

### Verification

- `pnpm check`: passes
- `pnpm lint`: passes with warnings only
- `pnpm typecheck`: passes
- `pnpm test`: passes
- `pnpm build`: passes

### Measured progress

- Broad `useAppStore()` calls in `components`, `app`, `hooks`, and `lib` dropped from `20` to `3` in this pass.
- Net reduction across the audit so far: `48` to `3`.
- The remaining `3` exact whole-store reads are all in `components/app/screens.tsx`:
  - `WorkItemDetailScreen`
  - `ProjectDetailScreen`
  - `WorkSurface`

### Remaining planned work

- Refactor the last `3` whole-store screen surfaces by changing the downstream board/list/timeline/detail component contracts so they no longer require full `AppData` to be threaded through.
- Split the next monoliths into stable internal modules, prioritizing `lib/server/convex.ts`, `components/app/shell.tsx`, and then the remaining large screen/detail modules.
- Migrate the remaining API handlers to the shared route layer, especially snapshot, team, project, notification, and other provider-adjacent routes that still own bespoke auth/body/error flow.

## Turn 6

### Implemented in this pass

- Finished the store-subscription cleanup in `components/app/screens.tsx` by replacing the final exact `useAppStore()` reads with typed picked-snapshot selectors.
- Standardized the snapshot API trio onto the shared route helper path:
  - `app/api/snapshot/route.ts`
  - `app/api/snapshot/version/route.ts`
  - `app/api/snapshot/events/route.ts`
- Preserved snapshot behavior:
  - same JSON payload shapes
  - same version fallback to `0`
  - same SSE event names (`ready`, `snapshot`, `ping`)
  - same polling and heartbeat timing

### Verification

- `pnpm check`: passes
- `pnpm lint`: passes with warnings only
- `pnpm typecheck`: passes
- `pnpm test`: passes
- `pnpm build`: passes

### Measured progress

- Broad exact `useAppStore()` calls in `components`, `app`, `hooks`, and `lib` dropped from `3` to `0` in this pass.
- Net reduction across the audit so far: `48` to `0`.
- Snapshot/provider-adjacent routes are now on the shared auth/response/error handling path instead of bespoke `withAuth` + `NextResponse` implementations.

### Remaining planned work

- Split the next monoliths into stable internal modules, prioritizing `lib/server/convex.ts`, `components/app/shell.tsx`, and then the remaining large screen/detail modules.
- Continue migrating the rest of the remaining bespoke API handlers to the shared route layer, especially team, project, notification, and other provider-adjacent routes that still own inline auth/body/error flow.
- Decide whether the final picked-snapshot screen selectors should remain as compatibility adapters or whether the downstream board/list/timeline/detail component contracts should be narrowed further in a dedicated follow-up refactor.

## Turn 7

### Implemented in this pass

- Cleared the remaining lint-warning backlog in the large UI and domain files:
  - `components/app/screens.tsx`
  - `components/app/settings-screens/user-settings-screen.tsx`
  - `components/app/settings-screens/workspace-settings-screen.tsx`
  - `components/app/shell.tsx`
  - `lib/domain/types.ts`
- Reworked several effect dependencies to use stable derived primitives instead of object references, removing `react-hooks/exhaustive-deps` warnings without changing behavior.
- Removed stale/unused imports and dead local symbols that were still generating warning noise.
- Fixed the follow-on `DocumentDetailScreen` type/lint regression introduced during the warning cleanup by normalizing its resolved document identity handling for title sync, presence heartbeat, and delete flows.

### Verification

- `pnpm lint`: passes with `0` warnings
- `pnpm typecheck`: passes
- `pnpm check`: passes

### Measured progress

- Repo lint warnings dropped from the previous baseline of `16` to `0`.
- The verification baseline is now clean across lint, typecheck, test, and build.

### Remaining planned work

- Split the next monoliths into stable internal modules, prioritizing `lib/server/convex.ts`, `components/app/shell.tsx`, and then the remaining large screen/detail modules.
- Continue migrating the rest of the remaining bespoke API handlers to the shared route layer, especially team, project, notification, and other provider-adjacent routes that still own inline auth/body/error flow.
- Continue the broader full-repo audit/remediation backlog beyond warning cleanup, keeping the existing no-behavior-change rule in place for refactors.

## Turn 8

### Implemented in this pass

- Standardized the remaining team, project, and notification CRUD-heavy routes onto the shared route helper path:
  - `app/api/teams/route.ts`
  - `app/api/teams/[teamId]/details/route.ts`
  - `app/api/teams/[teamId]/settings/route.ts`
  - `app/api/teams/[teamId]/join-code/route.ts`
  - `app/api/teams/join/route.ts`
  - `app/api/teams/lookup/route.ts`
  - `app/api/projects/route.ts`
  - `app/api/projects/[projectId]/route.ts`
  - `app/api/notifications/route.ts`
  - `app/api/notifications/[notificationId]/route.ts`
- Replaced inline `withAuth` / `NextResponse` / `request.json()` handling in that slice with:
  - `requireSession`
  - `requireAppContext` or `requireConvexUser`
  - `parseJsonBody`
  - `jsonOk`
  - `jsonError`
- Preserved existing response payloads and route paths while normalizing provider-error logging and message shaping.
- Kept existing behavioral quirks intact for safety:
  - team creation still treats post-create auth-context reconciliation as best-effort
  - team join still fails the whole request if post-join reconciliation throws
  - notification bulk archive/unarchive remains sequential rather than changing mutation ordering semantics

### Verification

- Targeted eslint on the refactored route set: passes
- `pnpm typecheck`: passes
- `pnpm check`: passes

### Measured progress

- `25` route files under `app/api` now use the shared `requireSession` helper path.
- Remaining direct `withAuth` route files under `app/api` dropped to `20`, concentrated in attachments, calls, document, label, workspace, and a few remaining collaboration routes.

### Remaining planned work

- Split the next monoliths into stable internal modules, prioritizing `lib/server/convex.ts`, `components/app/shell.tsx`, and then the remaining large screen/detail modules.
- Continue migrating the rest of the remaining bespoke API handlers to the shared route layer, especially attachments, document, label, view, workspace, and call-adjacent surfaces that still own inline auth/body/error flow.
- Continue the broader full-repo audit/remediation backlog beyond API route standardization, keeping the existing no-behavior-change rule in place for refactors.

## Turn 9

### Implemented in this pass

- Decomposed `components/app/shell.tsx` into stable internal modules while keeping the public `@/components/app/shell` entrypoint intact.
- Added extracted shell modules under `components/app/shell/`:
  - `sidebar-link.tsx`
  - `status-dialog.tsx`
  - `team-editor-fields.tsx`
  - `workspace-dialog.tsx`
  - `team-dialogs.tsx`
  - `invite-dialog.tsx`
  - `profile-dialog.tsx`
- Kept `AppShell` in `components/app/shell.tsx` and re-exported the public dialog components from the same entry file so no import path changes were required.
- Preserved existing dialog and shell behavior:
  - sidebar navigation and team expansion logic unchanged
  - status editing behavior unchanged
  - invite, profile, workspace, and team dialog flows unchanged
  - no route, store, or provider contract changes introduced

### Verification

- Targeted eslint on `components/app/shell.tsx` and `components/app/shell/*.tsx`: passes
- `pnpm typecheck`: passes
- `pnpm check`: passes

### Measured progress

- `components/app/shell.tsx` dropped from `2243` lines to `721`.
- The extracted shell internals now live across `7` focused modules, each smaller than the original monolith and with the largest extracted module at `461` lines.
- Public import compatibility for `@/components/app/shell` remains intact.

### Remaining planned work

- Continue migrating the remaining old-style `app/api` handlers onto the shared route helper layer.
- Split `lib/server/convex.ts` into stable internal modules behind the existing public import surface.
- Continue the broader monolith decomposition for the remaining large UI/domain/store files after the higher-risk server surface is addressed.

## Turn 10

### Implemented in this pass

- Standardized the remaining attachment, document, label, view, and workspace-creation routes onto the shared route helper path:
  - `app/api/attachments/route.ts`
  - `app/api/attachments/[attachmentId]/route.ts`
  - `app/api/attachments/upload-url/route.ts`
  - `app/api/documents/route.ts`
  - `app/api/documents/[documentId]/route.ts`
  - `app/api/labels/route.ts`
  - `app/api/views/[viewId]/route.ts`
  - `app/api/workspaces/route.ts`
- Replaced inline `withAuth` / `NextResponse` / raw `request.json()` handling in that slice with:
  - `requireSession`
  - `requireAppContext`
  - `parseJsonBody`
  - `jsonOk`
  - `jsonError`
- Preserved existing payload shapes and behavior for:
  - attachment creation and upload-url responses
  - document create/update/delete responses
  - label creation response
  - view mutation behavior and action semantics
  - workspace creation plus best-effort post-create auth-context reconciliation

### Verification

- Targeted eslint on the refactored route set: passes
- `pnpm typecheck`: passes
- `pnpm check`: passes

### Measured progress

- Remaining direct `withAuth` route files under `app/api` dropped from `20` to `12`.
- The remaining old-style route set is now concentrated in:
  - `calls/join`
  - channel/chat/comment reaction and creation surfaces
  - invite accept/decline
  - item description/schedule
  - settings image upload

### Remaining planned work

- Finish migrating the remaining `12` old-style `app/api` handlers onto the shared route helper layer.
- Split `lib/server/convex.ts` into stable internal modules behind the existing public import surface.
- Continue the broader monolith decomposition for the remaining large UI/domain/store files after the higher-risk server surface is addressed.

## Turn 11

### Implemented in this pass

- Standardized the remaining collaboration and invite/item adjunct routes onto the shared route helper layer:
  - `app/api/calls/join/route.ts`
  - `app/api/channel-posts/[postId]/route.ts`
  - `app/api/channel-posts/[postId]/reactions/route.ts`
  - `app/api/channels/route.ts`
  - `app/api/chats/route.ts`
  - `app/api/chats/team/route.ts`
  - `app/api/comments/[commentId]/reactions/route.ts`
  - `app/api/invites/accept/route.ts`
  - `app/api/invites/decline/route.ts`
  - `app/api/items/[itemId]/description/route.ts`
  - `app/api/items/[itemId]/schedule/route.ts`
  - `app/api/settings-images/upload-url/route.ts`
- Preserved the special browser behavior in `app/api/calls/join/route.ts`:
  - still redirects unauthenticated users to login
  - still returns HTML error pages for 100ms join failures
  - still preserves the same call/conversation permission checks and join redirects
- Removed the final direct `withAuth` usage from `app/api/**`, completing the route-layer standardization effort for this repo.

### Verification

- Targeted eslint on the refactored route set: passes
- `pnpm typecheck`: passes
- `pnpm check`: passes

### Measured progress

- Remaining direct `withAuth` route files under `app/api` dropped from `12` to `0`.
- The full `app/api` surface is now on the shared auth/body/response helper pattern, with `calls/join` using the shared helpers while preserving its redirect-specific behavior.

### Remaining planned work

- Split `lib/server/convex.ts` into stable internal modules behind the existing public import surface.
- Continue the broader monolith decomposition for `convex/app.ts`, `components/app/screens.tsx`, `components/app/collaboration-screens.tsx`, `lib/store/app-store.ts`, `lib/domain/types.ts`, and `lib/domain/selectors.ts`.
- Continue the full-repo maintainability cleanup with the existing no-behavior-change rule in place for refactors.

## Turn 12

### Implemented in this pass

- Decomposed `lib/server/convex.ts` into focused internal server modules while preserving `@/lib/server/convex` as the stable public import surface.
- Added extracted modules under `lib/server/convex/`:
  - `core.ts`
  - `auth.ts`
  - `workspace.ts`
  - `notifications.ts`
  - `work.ts`
  - `documents.ts`
  - `teams-projects.ts`
  - `collaboration.ts`
- Replaced the previous monolith file with a thin public barrel at `lib/server/convex.ts` that re-exports the existing server helpers without changing call sites.
- Preserved behavior for:
  - Convex transport retry behavior and diagnostics
  - auth-context and snapshot loading
  - invite/notification mutations
  - workspace/profile/settings image helpers
  - work/document/comment/attachment helpers
  - team/project helpers
  - collaboration/chat/channel/call helpers

### Verification

- Targeted eslint on `lib/server/convex.ts` and `lib/server/convex/*.ts`: passes
- `pnpm typecheck`: passes
- `pnpm check`: passes

### Measured progress

- `lib/server/convex.ts` dropped from `1103` lines to `9`.
- The extracted internal modules are all below `200` lines except `documents.ts` at `182`.
- Public import compatibility for `@/lib/server/convex` remains intact.

### Remaining planned work

- Continue the broader monolith decomposition for `convex/app.ts`, `components/app/screens.tsx`, `components/app/collaboration-screens.tsx`, `lib/store/app-store.ts`, `lib/domain/types.ts`, and `lib/domain/selectors.ts`.
- Prioritize `convex/app.ts` next as the largest remaining backend monolith after the server helper split.
- Continue the maintainability cleanup with the existing no-behavior-change rule in place for refactors.

## Turn 13

### Implemented in this pass

- Decomposed the private helper layer inside `convex/app.ts` while keeping every exported Convex query, mutation, and action in `convex/app.ts` so the generated `api.app.*` surface remains unchanged.
- Added focused internal helper modules under `convex/app/`:
  - `core.ts`
  - `data.ts`
  - `normalization.ts`
  - `collaboration-utils.ts`
- Moved the following helper categories out of the monolith and back into `convex/app.ts` via imports:
  - server-token, ID, slug, join-code, icon, and default-value helpers
  - shared data lookup and app-config helpers
  - user/workspace/team/document/view normalization helpers
  - document-presence snapshot helpers
  - collaboration mention/reaction/notification utility helpers
- Preserved behavior for:
  - all existing exported Convex handlers
  - snapshot payload normalization and document-presence listing
  - auth/bootstrap flows that rely on `serverAccessArgs`, `assertServerToken`, and user bootstrap helpers
  - team join-code, slug, membership-role, and notification behavior

### Verification

- Targeted eslint on `convex/app.ts` and `convex/app/*.ts`: passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `convex/app.ts` dropped from `7777` lines to `6767`.
- The extracted internal modules are:
  - `convex/app/collaboration-utils.ts` at `103` lines
  - `convex/app/core.ts` at `246` lines
  - `convex/app/data.ts` at `381` lines
  - `convex/app/normalization.ts` at `384` lines
- This pass removed more than `1000` lines of private helper implementation from the main backend monolith without changing the public Convex export surface.

### Remaining planned work

- Continue the broader monolith decomposition for `components/app/screens.tsx`, `components/app/collaboration-screens.tsx`, `lib/store/app-store.ts`, `lib/domain/types.ts`, and `lib/domain/selectors.ts`.
- Decide whether the next safest tranche is the large UI screen decomposition or the domain/store decomposition, depending on which gives the best further size reduction with the lowest behavior risk.
- Keep the same refactor rule in place: no route, payload, auth, or generated API contract changes unless a bug fix explicitly requires it.

## Turn 14

### Implemented in this pass

- Decomposed `lib/domain/selectors.ts` into focused internal domain modules while keeping `@/lib/domain/selectors` stable as the public import surface.
- Added extracted selector modules under `lib/domain/selectors-internal/`:
  - `core.ts`
  - `projects.ts`
  - `content.ts`
  - `work-items.ts`
  - `activity.ts`
  - `search.ts`
- Replaced the previous monolith file with a thin barrel at `lib/domain/selectors.ts` that re-exports the existing selector surface without changing call sites.
- Preserved behavior for:
  - current-user, workspace, team, membership, and permission selectors
  - project/document/view/conversation lookup helpers
  - work-item filtering, grouping, sorting, and display-format helpers
  - global workspace search result shaping and filtering
  - notification/document recency selectors

### Verification

- Targeted eslint on `lib/domain/selectors.ts` and `lib/domain/selectors-internal/*.ts`: passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `lib/domain/selectors.ts` dropped from `1548` lines to `6`.
- The extracted internal modules are:
  - `lib/domain/selectors-internal/activity.ts` at `10` lines
  - `lib/domain/selectors-internal/projects.ts` at `113` lines
  - `lib/domain/selectors-internal/search.ts` at `305` lines
  - `lib/domain/selectors-internal/content.ts` at `322` lines
  - `lib/domain/selectors-internal/core.ts` at `356` lines
  - `lib/domain/selectors-internal/work-items.ts` at `505` lines
- Public import compatibility for `@/lib/domain/selectors` remains intact across app, component, and store callers.

### Remaining planned work

- Continue the domain/store decomposition with `lib/domain/types.ts` and then `lib/store/app-store.ts`.
- After the domain/store layer is reduced further, return to the large UI monoliths `components/app/screens.tsx` and `components/app/collaboration-screens.tsx`.
- Keep the same no-behavior-change rule in place for all remaining refactor tranches.

## Turn 15

### Implemented in this pass

- Decomposed `lib/domain/types.ts` into focused internal domain modules while keeping `@/lib/domain/types` stable as the public import surface.
- Added extracted type/config modules under `lib/domain/types-internal/`:
  - `primitives.ts`
  - `models.ts`
  - `work.ts`
  - `schemas.ts`
- Replaced the previous monolith file with a thin barrel at `lib/domain/types.ts` that re-exports the existing domain type, metadata, helper, and schema surface without changing call sites.
- Preserved behavior for:
  - literal unions and shared domain constants
  - entity interfaces and app snapshot shapes
  - team/workflow/template/work-item normalization helpers and metadata
  - zod validation schemas used across route handlers and client forms

### Verification

- Targeted eslint on `lib/domain/types.ts` and `lib/domain/types-internal/*.ts`: passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `lib/domain/types.ts` dropped from `1609` lines to `4`.
- The extracted internal modules are:
  - `lib/domain/types-internal/primitives.ts` at `306` lines
  - `lib/domain/types-internal/schemas.ts` at `319` lines
  - `lib/domain/types-internal/models.ts` at `363` lines
  - `lib/domain/types-internal/work.ts` at `692` lines
- Public import compatibility for `@/lib/domain/types` remains intact across the app, store, Convex layer, and route helpers.

### Remaining planned work

- Continue with the next high-value structural target: `lib/store/app-store.ts`.
- After the store layer is decomposed, return to the large UI monoliths `components/app/screens.tsx` and `components/app/collaboration-screens.tsx`.
- Keep the same no-behavior-change rule in place for all remaining refactor tranches.

## Turn 16

### Implemented in this pass

- Decomposed `lib/store/app-store.ts` into focused internal store modules while keeping `@/lib/store/app-store` stable as the public import surface.
- Added extracted store composition modules under `lib/store/app-store-internal/`:
  - `create-store.ts`
  - `helpers.ts`
  - `runtime.ts`
  - `types.ts`
  - `validation.ts`
  - `slices/ui.ts`
  - `slices/notifications.ts`
  - `slices/workspace.ts`
  - `slices/views.ts`
  - `slices/projects.ts`
  - `slices/work.ts`
  - `slices/collaboration.ts`
- Replaced the previous monolith file with a thin public barrel at `lib/store/app-store.ts` that wires `persist(createAppStore, ...)` without changing the exported `useAppStore` hook or `AppStore` type surface.
- Preserved behavior for:
  - persisted `ui` state with the existing storage key, version, partialize, and merge rules
  - notification, workspace, team, profile, view, project, work-item, document, attachment, comment, chat, channel, and invite actions
  - queued rich-text syncing and snapshot refresh fallback behavior
- Fixed one extraction drift before verification: work-item key generation now uses the original `toTeamKeyPrefix(team?.name, teamId)` logic instead of the temporary incorrect prefix path introduced during the split.
- Removed the remaining dynamic-import fallback in the workspace slice so the extracted store composition is fully static and easier to verify.

### Verification

- Targeted eslint on `lib/store/app-store.ts` and `lib/store/app-store-internal/**/*.ts`: passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `lib/store/app-store.ts` dropped from `4013` lines to `30`.
- The extracted internal modules are:
  - `lib/store/app-store-internal/slices/ui.ts` at `85` lines
  - `lib/store/app-store-internal/runtime.ts` at `106` lines
  - `lib/store/app-store-internal/slices/projects.ts` at `138` lines
  - `lib/store/app-store-internal/slices/views.ts` at `163` lines
  - `lib/store/app-store-internal/slices/notifications.ts` at `183` lines
  - `lib/store/app-store-internal/create-store.ts` at `30` lines
  - `lib/store/app-store-internal/types.ts` at `338` lines
  - `lib/store/app-store-internal/helpers.ts` at `342` lines
  - `lib/store/app-store-internal/validation.ts` at `465` lines
  - `lib/store/app-store-internal/slices/workspace.ts` at `484` lines
  - `lib/store/app-store-internal/slices/collaboration.ts` at `930` lines
  - `lib/store/app-store-internal/slices/work.ts` at `1040` lines
- Public import compatibility for `@/lib/store/app-store` remains intact across app pages, UI components, and providers.

### Remaining planned work

- Continue with the large UI monoliths, starting with `components/app/screens.tsx`.
- After that, move to `components/app/collaboration-screens.tsx`, then the remaining oversized UI/domain files.
- Return to `convex/app.ts` later for further private helper extraction while keeping the exported `api.app.*` surface stable.

## Turn 17

### Implemented in this pass

- Began decomposing `components/app/screens.tsx` by extracting the shared UI primitives into `components/app/screens/shared.tsx` while keeping `@/components/app/screens` stable as the public import surface.
- Moved the reusable screen chrome and shared helpers into the new module:
  - `ScreenHeader`
  - `HeaderTitle`
  - `ViewsDisplaySettingsPopover`
  - `CollectionDisplaySettingsPopover`
  - `StatusIcon`
  - `PriorityDot`
  - `CollapsibleSection`
  - `PropertySelect`
  - `WorkItemLabelsEditor`
  - `PropertyRow`
  - `PropertyDateField`
  - `ConfigSelect`
  - `FilterChip`
  - `MissingState`
  - shared helpers such as `buildPropertyStatusOptions`, `formatEntityKind`, `getEntityKindIcon`, `getDocumentPreview`, and `getPatchForField`
- Updated `components/app/screens.tsx` to consume the extracted shared module instead of carrying duplicate local definitions.
- Preserved behavior for:
  - screen headers and collection display controls
  - work-item property editors and label management
  - view formatting and document preview rendering
  - drag/drop field patch generation and shared empty-state rendering

### Verification

- Targeted eslint on `components/app/screens.tsx` and `components/app/screens/shared.tsx`: passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `components/app/screens.tsx` dropped from `7877` lines to `7194`.
- The new shared module `components/app/screens/shared.tsx` is `721` lines.
- Public import compatibility for `@/components/app/screens` remains intact across route pages and shell navigation.

### Remaining planned work

- Continue the `components/app/screens.tsx` breakup by extracting the heavier screen-specific sections next, starting with the work-item/project/document detail surfaces and then the shared work-surface renderer.
- After that, move to `components/app/collaboration-screens.tsx`.
- Keep the same no-behavior-change rule in place for the remaining UI refactor tranches.

## Turn 18

### Implemented in this pass

- Continued decomposing `components/app/screens.tsx` by extracting shared non-screen-specific logic into:
  - `components/app/screens/helpers.ts`
  - `components/app/screens/document-ui.tsx`
- Moved reusable screen helper logic into `helpers.ts`, including:
  - app-data snapshot selection
  - view-filter cloning/counting helpers
  - project/team option helpers used by multiple dialogs and detail surfaces
  - document editing and presence session helpers
  - project presentation/view-label helpers
  - inline description formatting helpers
- Moved reusable document UI into `document-ui.tsx`, including:
  - `DocumentContextMenu`
  - `DocumentAuthorAvatar`
  - `DocumentPresenceAvatarGroup`
- Updated `components/app/screens.tsx` to consume the extracted helper and document UI modules instead of carrying duplicate local implementations.
- Kept the actual detail-screen bodies in place for this pass after narrowing the scope, rather than forcing a larger dependency move that would have raised regression risk.

### Verification

- Targeted eslint on `components/app/screens.tsx`, `components/app/screens/helpers.ts`, and `components/app/screens/document-ui.tsx`: passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `components/app/screens.tsx` dropped from `7194` lines to `6765`.
- The new extracted modules are:
  - `components/app/screens/helpers.ts` at `321` lines
  - `components/app/screens/document-ui.tsx` at `179` lines
  - existing `components/app/screens/shared.tsx` remains `721` lines
- Public import compatibility for `@/components/app/screens` remains intact across route pages and shell navigation.

### Remaining planned work

- Continue the `components/app/screens.tsx` breakup by extracting the actual detail-screen bodies next.
- After that, extract the shared `WorkSurface` renderer and its related board/list/timeline dependencies.
- Then move to `components/app/collaboration-screens.tsx`.

## Turn 19

### Implemented in this pass

- Continued decomposing `components/app/screens.tsx` with a second safe extraction pass.
- Kept the public `@/components/app/screens` surface stable while moving detail-specific logic into dedicated internal modules:
  - `components/app/screens/document-detail-screen.tsx`
  - `components/app/screens/project-detail-ui.tsx`
- Fully moved `DocumentDetailScreen` out of `components/app/screens.tsx`, including:
  - document title editing
  - document presence heartbeat/leave handling
  - document delete flow
  - mention candidate selection
  - document header and presence UI wiring
- Extracted the self-contained `ProjectDetailScreen` sections that do not depend on the heavier shared work-surface stack:
  - overview tab content
  - activity tab content
  - project properties sidebar
- Trimmed stale imports/constants from `components/app/screens.tsx` after the move so the file stayed lint-clean.
- Kept the items tab and board/list/timeline rendering in `components/app/screens.tsx` for now because those still share dense dependencies with `WorkSurface` and the rest of the work-view stack.

### Verification

- Targeted eslint on:
  - `components/app/screens.tsx`
  - `components/app/screens/document-detail-screen.tsx`
  - `components/app/screens/project-detail-ui.tsx`
  - `components/app/screens/helpers.ts`
  - `components/app/screens/document-ui.tsx`
  passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `components/app/screens.tsx` dropped from `6765` lines to `6274`.
- The new extracted screen modules are:
  - `components/app/screens/document-detail-screen.tsx` at `327` lines
  - `components/app/screens/project-detail-ui.tsx` at `290` lines
  - `components/app/screens/helpers.ts` remains `321` lines
  - `components/app/screens/document-ui.tsx` remains `179` lines
- Public import compatibility for `@/components/app/screens` remains intact across the route pages.

### Remaining planned work

- Continue the `components/app/screens.tsx` breakup by extracting the remaining heavy detail/work surfaces, starting with the work-item detail and shared work-surface stack.
- After that, move to `components/app/collaboration-screens.tsx`.
- Keep the same no-behavior-change rule and full `pnpm check` verification on each tranche.

## Turn 20

### Implemented in this pass

- Continued decomposing `components/app/screens.tsx` with the next safe work-item-focused extraction pass.
- Kept the public `@/components/app/screens` surface stable while moving work-item-specific logic into dedicated internal modules:
  - `components/app/screens/work-item-detail-screen.tsx`
  - `components/app/screens/work-item-ui.tsx`
- Fully moved `WorkItemDetailScreen` out of `components/app/screens.tsx`, including:
  - work-item detail header and breadcrumb
  - inline description editing
  - child-item section and inline child creation flow
  - activity/comments section
  - properties sidebar
  - project cascade confirmation and delete flow
- Extracted the reusable work-item detail support UI into `work-item-ui.tsx`, including:
  - `WorkItemTypeBadge`
  - `CommentsInline`
  - the threaded comment item renderer
  - `InlineChildIssueComposer`
- Rewired the remaining board/list/timeline surfaces in `components/app/screens.tsx` to consume the shared `WorkItemTypeBadge` from the extracted module.
- Trimmed stale imports and removed the duplicated in-file work-item helpers after the move so the file stayed lint-clean.

### Verification

- Targeted eslint on:
  - `components/app/screens.tsx`
  - `components/app/screens/work-item-ui.tsx`
  - `components/app/screens/work-item-detail-screen.tsx`
  passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `components/app/screens.tsx` dropped from `6274` lines to `5240`.
- The new extracted work-item modules are:
  - `components/app/screens/work-item-detail-screen.tsx` at `621` lines
  - `components/app/screens/work-item-ui.tsx` at `489` lines
- Public import compatibility for `@/components/app/screens` remains intact across the route pages.

### Remaining planned work

- Continue the `components/app/screens.tsx` breakup by extracting the shared `WorkSurface` renderer and its related board/list/timeline dependencies.
- After that, move to `components/app/collaboration-screens.tsx`.
- Keep the same no-behavior-change rule and full `pnpm check` verification on each tranche.

## Turn 21

### Implemented in this pass

- Continued decomposing `components/app/screens.tsx` with the first dedicated `WorkSurface` extraction pass.
- Kept the public `@/components/app/screens` surface stable while moving shared view controls and work-item action menus into dedicated internal modules:
  - `components/app/screens/work-surface-controls.tsx`
  - `components/app/screens/work-item-menus.tsx`
- Extracted the shared view-control layer into `work-surface-controls.tsx`, including:
  - `FilterPopover`
  - `ViewConfigPopover`
  - `displayPropertyOptions`
  - `orderingOptions`
  - `ViewConfigPatch`
  - `getGroupFieldOptionLabel`
- Extracted the reusable item action-menu layer into `work-item-menus.tsx`, including:
  - `IssueActionMenu`
  - `IssueContextMenu`
  - `stopMenuEvent`
- Rewired `components/app/screens.tsx` so the remaining board/list/timeline stack now consumes those extracted modules instead of carrying duplicate local definitions.
- Trimmed the stale in-file copies and import fallout after the move so the file stayed lint-clean.

### Verification

- Targeted eslint on:
  - `components/app/screens.tsx`
  - `components/app/screens/work-surface-controls.tsx`
  - `components/app/screens/work-item-menus.tsx`
  passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `components/app/screens.tsx` dropped from `5240` lines to `4602`.
- The new extracted shared modules are:
  - `components/app/screens/work-surface-controls.tsx` at `476` lines
  - `components/app/screens/work-item-menus.tsx` at `235` lines
- Public import compatibility for `@/components/app/screens` remains intact across the route pages.

### Remaining planned work

- Continue the `components/app/screens.tsx` breakup by extracting the remaining board/list/timeline and `WorkSurface` renderer bodies.
- After that, move to `components/app/collaboration-screens.tsx`.
- Keep the same no-behavior-change rule and full `pnpm check` verification on each tranche.

## Turn 22

### Implemented in this pass

- Continued decomposing `components/app/screens.tsx` with the main `WorkSurface` renderer extraction.
- Kept the public `@/components/app/screens` surface stable while moving the board/list/timeline renderer stack into:
  - `components/app/screens/work-surface-view.tsx`
- Extracted the renderer/view layer into `work-surface-view.tsx`, including:
  - `BoardView`
  - `ListView`
  - `TimelineView`
  - grouped board/list/timeline helper functions
  - drag/drop helpers and supporting row/card/bar components
- Rewired `components/app/screens.tsx` so `WorkSurface` is now a thinner wrapper that owns:
  - route/view selection
  - create-dialog state
  - header tabs and view controls
  - delegation into the extracted board/list/timeline renderer module
- Trimmed the stale in-file imports after the move so the file stayed lint-clean.

### Verification

- Targeted eslint on:
  - `components/app/screens.tsx`
  - `components/app/screens/work-surface-view.tsx`
  passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `components/app/screens.tsx` dropped from `4602` lines to `3059`.
- The new extracted renderer module is:
  - `components/app/screens/work-surface-view.tsx` at `1562` lines
- Public import compatibility for `@/components/app/screens` remains intact across the route pages.

### Remaining planned work

- Continue the `components/app/screens.tsx` breakup by extracting or thinning the remaining `WorkSurface` wrapper and then the other residual screen-specific helpers.
- Move next to `components/app/collaboration-screens.tsx`.
- Continue the deeper private-helper extraction in `convex/app.ts`.
- Keep the same no-behavior-change rule and full `pnpm check` verification on each tranche.

## Turn 23

### Implemented in this pass

- Started the `components/app/collaboration-screens.tsx` breakup with the lower-risk channel-only extraction first.
- Kept the public `@/components/app/collaboration-screens` surface stable while moving the forum/channel UI into:
  - `components/app/collaboration-screens/channel-ui.tsx`
  - `components/app/collaboration-screens/utils.ts`
- Extracted the channel/forum UI into `channel-ui.tsx`, including:
  - `ForumPostCard`
  - `NewPostComposer`
  - channel reaction options and post/comment interaction handlers
- Extracted the pure collaboration helpers into `utils.ts`, including:
  - `formatTimestamp`
  - `formatShortDate`
  - `getChatMessageMarkup`
  - `buildCallJoinHref`
  - `parseCallInviteMessage`
- Rewired `components/app/collaboration-screens.tsx` so the remaining file keeps the chat/thread and screen composition logic while consuming the extracted channel and utility modules.

### Verification

- Targeted eslint on:
  - `components/app/collaboration-screens.tsx`
  - `components/app/collaboration-screens/channel-ui.tsx`
  - `components/app/collaboration-screens/utils.ts`
  passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `components/app/collaboration-screens.tsx` dropped from `2427` lines to `1856`.
- The new extracted collaboration modules are:
  - `components/app/collaboration-screens/channel-ui.tsx` at `526` lines
  - `components/app/collaboration-screens/utils.ts` at `64` lines
- Public import compatibility for `@/components/app/collaboration-screens` remains intact across the route pages.

### Remaining planned work

- Continue the `components/app/collaboration-screens.tsx` breakup by extracting the chat-thread/shared chat primitives next.
- Continue thinning the remaining `WorkSurface` wrapper and residual helpers in `components/app/screens.tsx`.
- Continue the deeper private-helper extraction in `convex/app.ts`.
- Keep the same no-behavior-change rule and full `pnpm check` verification on each tranche.

## Turn 24

### Implemented in this pass

- Continued the `components/app/collaboration-screens.tsx` breakup with the shared chrome/sidebar extraction.
- Kept the public `@/components/app/collaboration-screens` surface stable while moving the reusable collaboration screen UI into:
  - `components/app/collaboration-screens/shared-ui.tsx`
- Extracted the shared collaboration UI layer into `shared-ui.tsx`, including:
  - `EmptyState`
  - `PageHeader`
  - `SurfaceSidebarContent`
  - `MembersSidebar`
  - `TeamSurfaceSidebar`
  - `DetailsSidebarToggle`
  - `ChatHeaderActions`
- Rewired `components/app/collaboration-screens.tsx` so the remaining file focuses on the conversation list, chat-thread path, dialog logic, and screen composition while consuming the extracted shared UI module.

### Verification

- Targeted eslint on:
  - `components/app/collaboration-screens.tsx`
  - `components/app/collaboration-screens/shared-ui.tsx`
  passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `components/app/collaboration-screens.tsx` dropped from `1856` lines to `1615`.
- The new extracted shared collaboration UI module is:
  - `components/app/collaboration-screens/shared-ui.tsx` at `254` lines
- Public import compatibility for `@/components/app/collaboration-screens` remains intact across the route pages.

### Remaining planned work

- Continue the `components/app/collaboration-screens.tsx` breakup by extracting the chat-thread/composer path next.
- Continue thinning the remaining `WorkSurface` wrapper and residual helpers in `components/app/screens.tsx`.
- Continue the deeper private-helper extraction in `convex/app.ts`.
- Keep the same no-behavior-change rule and full `pnpm check` verification on each tranche.

## Turn 25

### Implemented in this pass

- Continued the `components/app/collaboration-screens.tsx` breakup with the chat-thread extraction.
- Kept the public `@/components/app/collaboration-screens` surface stable while moving the chat-thread path into:
  - `components/app/collaboration-screens/chat-thread.tsx`
- Extracted the thread/composer layer into `chat-thread.tsx`, including:
  - `ChatThread`
  - the internal `ChatComposer`
  - message grouping and call-invite rendering
  - welcome-state rendering and send-message wiring
- Rewired `components/app/collaboration-screens.tsx` so the remaining file focuses on:
  - screen composition
  - conversation-list state
  - workspace chat dialog state
  - team/workspace channel orchestration
  - the lightweight `CallInviteLauncher`

### Verification

- Targeted eslint on:
  - `components/app/collaboration-screens.tsx`
  - `components/app/collaboration-screens/chat-thread.tsx`
  - `components/app/collaboration-screens/shared-ui.tsx`
  - `components/app/collaboration-screens/channel-ui.tsx`
  - `components/app/collaboration-screens/utils.ts`
  passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `components/app/collaboration-screens.tsx` dropped from `1615` lines to `1244`.
- The new extracted chat-thread module is:
  - `components/app/collaboration-screens/chat-thread.tsx` at `388` lines
- Public import compatibility for `@/components/app/collaboration-screens` remains intact across the route pages.

### Remaining planned work

- Continue the `components/app/collaboration-screens.tsx` breakup by extracting the remaining conversation-list and workspace-chat dialog path next.
- Continue thinning the remaining `WorkSurface` wrapper and residual helpers in `components/app/screens.tsx`.
- Continue the deeper private-helper extraction in `convex/app.ts`.
- Keep the same no-behavior-change rule and full `pnpm check` verification on each tranche.

## Turn 26

### Implemented in this pass

- Continued the `components/app/collaboration-screens.tsx` breakup with the workspace-chat UI extraction.
- Kept the public `@/components/app/collaboration-screens` surface stable while moving the workspace chat list/dialog layer into:
  - `components/app/collaboration-screens/workspace-chat-ui.tsx`
- Extracted the workspace chat UI support layer into `workspace-chat-ui.tsx`, including:
  - `ConversationList`
  - `CreateWorkspaceChatDialog`
  - `WORKSPACE_CHAT_LIST_WIDTH_STORAGE_KEY`
  - `WORKSPACE_CHAT_LIST_DEFAULT_WIDTH`
  - `clampWorkspaceChatListWidth`
- Rewired `components/app/collaboration-screens.tsx` so the remaining file keeps the screen composition/state logic while consuming the extracted workspace chat UI module.

### Verification

- Targeted eslint on:
  - `components/app/collaboration-screens.tsx`
  - `components/app/collaboration-screens/workspace-chat-ui.tsx`
  - the already-extracted collaboration modules
  passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `components/app/collaboration-screens.tsx` dropped from `1244` lines to `919`.
- The new extracted workspace chat UI module is:
  - `components/app/collaboration-screens/workspace-chat-ui.tsx` at `325` lines
- Public import compatibility for `@/components/app/collaboration-screens` remains intact across the route pages.

### Remaining planned work

- Continue the `components/app/collaboration-screens.tsx` breakup by extracting the `WorkspaceChatsScreen` body and shared call-launcher next.
- Continue thinning the remaining `WorkSurface` wrapper and residual helpers in `components/app/screens.tsx`.
- Continue the deeper private-helper extraction in `convex/app.ts`.
- Keep the same no-behavior-change rule and full `pnpm check` verification on each tranche.

## Turn 27

### Implemented in this pass

- Continued the `components/app/collaboration-screens.tsx` breakup with the workspace chat screen extraction.
- Kept the public `@/components/app/collaboration-screens` surface stable while moving the workspace chat screen path into:
  - `components/app/collaboration-screens/workspace-chats-screen.tsx`
  - `components/app/collaboration-screens/call-invite-launcher.tsx`
- Extracted the workspace chat screen layer into `workspace-chats-screen.tsx`, including:
  - `WorkspaceChatsScreen`
  - the resizable conversation-list state and persistence
  - active-chat resolution and preview rendering
  - workspace chat mobile details sheet
- Extracted the shared conversation-call launcher into `call-invite-launcher.tsx`.
- Rewired `components/app/collaboration-screens.tsx` so the remaining file now acts as a stable public barrel plus the remaining workspace/team channel and team chat screens.

### Verification

- Targeted eslint on:
  - `components/app/collaboration-screens.tsx`
  - `components/app/collaboration-screens/workspace-chats-screen.tsx`
  - `components/app/collaboration-screens/call-invite-launcher.tsx`
  - the already-extracted collaboration modules
  passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `components/app/collaboration-screens.tsx` dropped from `919` lines to `459`.
- The new extracted workspace chat screen modules are:
  - `components/app/collaboration-screens/workspace-chats-screen.tsx` at `439` lines
  - `components/app/collaboration-screens/call-invite-launcher.tsx` at `52` lines
- `components/app/collaboration-screens.tsx` is now below the `500` line target.
- Public import compatibility for `@/components/app/collaboration-screens` remains intact across the route pages.

### Remaining planned work

- Continue the broader UI refactor by returning to the remaining `WorkSurface` wrapper and residual helpers in `components/app/screens.tsx`.
- Optionally continue decomposing the remaining collaboration screen exports further, but the main `components/app/collaboration-screens.tsx` monolith target has now been met.
- Continue the deeper private-helper extraction in `convex/app.ts`.
- Keep the same no-behavior-change rule and full `pnpm check` verification on each tranche.

## Turn 28

### Implemented in this pass

- Returned to the `components/app/screens.tsx` breakup after finishing the collaboration-screen tranche.
- Kept the public `@/components/app/screens` surface stable while moving the create-dialog and project-creation layer into:
  - `components/app/screens/project-creation.tsx`
  - `components/app/screens/create-document-dialog.tsx`
  - `components/app/screens/create-work-item-dialog.tsx`
- Extracted the project creation layer into `project-creation.tsx`, including:
  - `CreateProjectDialog`
  - `ProjectPresentationPopover`
  - `ProjectFiltersPopover`
- Extracted the standalone document creation dialog into `create-document-dialog.tsx`.
- Extracted the standalone work-item creation dialog into `create-work-item-dialog.tsx`.
- Rewired `components/app/screens.tsx` so the remaining file now focuses on:
  - route-level screen composition
  - inbox/projects/views/docs surfaces
  - board/document helper sections
  - `ProjectDetailScreen`
  - the remaining `WorkSurface` wrapper

### Verification

- Targeted eslint on:
  - `components/app/screens.tsx`
  - `components/app/screens/project-creation.tsx`
  - `components/app/screens/create-document-dialog.tsx`
  - `components/app/screens/create-work-item-dialog.tsx`
  passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `components/app/screens.tsx` dropped from `3059` lines to `2014`.
- The new extracted screen modules are:
  - `components/app/screens/project-creation.tsx` at `579` lines
  - `components/app/screens/create-document-dialog.tsx` at `88` lines
  - `components/app/screens/create-work-item-dialog.tsx` at `462` lines
- Public import compatibility for `@/components/app/screens` remains intact across the route pages.

### Remaining planned work

- Continue the `components/app/screens.tsx` breakup with the board/document helper layer above `WorkSurface`, then thin the remaining `WorkSurface` wrapper itself.
- Continue the deeper private-helper extraction in `convex/app.ts`.
- Keep the same no-behavior-change rule and full `pnpm check` verification on each tranche.

## Turn 29

### Implemented in this pass

- Continued the `components/app/screens.tsx` breakup with the board/document helper extraction above `WorkSurface`.
- Kept the public `@/components/app/screens` surface stable while moving the collection-board layer into:
  - `components/app/screens/collection-boards.tsx`
- Extracted the collection-board layer into `collection-boards.tsx`, including:
  - `ProjectBoard`
  - `SavedViewsBoard`
  - `DocumentBoard`
- Rewired `components/app/screens.tsx` so the remaining file now focuses on:
  - route-level screens
  - `ProjectDetailScreen`
  - the remaining `WorkSurface` wrapper
  - inbox/docs/projects/views orchestration

### Verification

- Targeted eslint on:
  - `components/app/screens.tsx`
  - `components/app/screens/collection-boards.tsx`
  passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `components/app/screens.tsx` dropped from `2014` lines to `1825`.
- The new extracted board helper module is:
  - `components/app/screens/collection-boards.tsx` at `217` lines
- Public import compatibility for `@/components/app/screens` remains intact across the route pages.

### Remaining planned work

- Continue the `components/app/screens.tsx` breakup with the `ProjectDetailScreen` support layer and then thin the remaining `WorkSurface` wrapper itself.
- Continue the deeper private-helper extraction in `convex/app.ts`.
- Keep the same no-behavior-change rule and full `pnpm check` verification on each tranche.

## Turn 30

### Implemented in this pass

- Continued the `components/app/screens.tsx` breakup by extracting the remaining shared work-surface wrapper into:
  - `components/app/screens/work-surface.tsx`
- Moved the `WorkSurface` wrapper out of `components/app/screens.tsx`, including:
  - route-driven selected-view resolution
  - filter application via `itemMatchesView`
  - board/list/timeline wrapper dispatch
  - create-item dialog wiring
  - header/tab rendering for work views
- Rewired `components/app/screens.tsx` so the remaining file now focuses on:
  - route-level screen composition
  - inbox/projects/views/docs orchestration
  - collection layout helpers
  - exported detail-screen entry points

### Verification

- Targeted eslint on:
  - `components/app/screens.tsx`
  - `components/app/screens/work-surface.tsx`
  passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `components/app/screens.tsx` dropped from `1498` lines to `1325`.
- The new extracted work-surface module is:
  - `components/app/screens/work-surface.tsx` at `178` lines
- Public import compatibility for `@/components/app/screens` remains intact across the route pages.

### Remaining planned work

- Continue the `components/app/screens.tsx` breakup by extracting the remaining large screen surfaces, with `InboxScreen` now the most obvious UI monolith left there.
- Continue the deeper private-helper extraction in `convex/app.ts`.
- Keep the same no-behavior-change rule and full `pnpm check` verification on each tranche.

## Turn 31

### Implemented in this pass

- Continued the `components/app/screens.tsx` breakup by extracting the inbox surface into:
  - `components/app/screens/inbox-screen.tsx`
- Moved the full inbox route implementation out of `components/app/screens.tsx`, including:
  - notification list/detail rendering
  - inbox/archive tab state
  - list-width persistence and pointer-resize behavior
  - invite acceptance flow
  - notification archive/delete actions
- Rewired `components/app/screens.tsx` so the remaining file now acts as:
  - the stable public barrel for detail/inbox exports
  - the route-level team/projects/views/docs screens
  - the collection-layout helper layer

### Verification

- Targeted eslint on:
  - `components/app/screens.tsx`
  - `components/app/screens/inbox-screen.tsx`
  passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `components/app/screens.tsx` dropped from `1325` lines to `696`.
- The new extracted inbox module is:
  - `components/app/screens/inbox-screen.tsx` at `646` lines
- `components/app/screens.tsx` is now below the `800`-line target.
- Public import compatibility for `@/components/app/screens` remains intact across the route pages.

### Remaining planned work

- Continue the UI cleanup by either decomposing `components/app/screens/inbox-screen.tsx` further or moving to the next remaining oversized UI/helper modules.
- Continue the deeper private-helper extraction in `convex/app.ts`.
- Keep the same no-behavior-change rule and full `pnpm check` verification on each tranche.

## Turn 32

### Implemented in this pass

- Continued the inbox refactor for consistency rather than chasing an arbitrary line-count threshold.
- Split the inbox surface into a controller/presentation boundary by adding:
  - `components/app/screens/inbox-ui.tsx`
- Kept `components/app/screens/inbox-screen.tsx` as the stateful controller for:
  - store subscriptions
  - selection state
  - resize persistence
  - invite acceptance
  - archive/delete mutations
- Moved the presentational inbox surfaces into `inbox-ui.tsx`, including:
  - the notification list pane
  - the notification detail pane
  - inbox-specific entity icon rendering

### Verification

- Targeted eslint on:
  - `components/app/screens/inbox-screen.tsx`
  - `components/app/screens/inbox-ui.tsx`
  passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `components/app/screens/inbox-screen.tsx` dropped from `646` lines to `372`.
- The new extracted inbox presentation module is:
  - `components/app/screens/inbox-ui.tsx` at `355` lines
- Both inbox modules are now below the `500`-line UI heuristic.
- The controller/presentation split keeps the inbox surface consistent with the rest of the ongoing screen refactor.

### Remaining planned work

- Continue the deeper private-helper extraction in `convex/app.ts`.
- Review the remaining UI/helper modules for any similarly obvious controller/presentation splits, but `components/app/screens.tsx` and the inbox surface are now in a materially healthier state.
- Keep the same no-behavior-change rule and full `pnpm check` verification on each tranche.

## Turn 33

### Implemented in this pass

- Returned to the backend monolith cleanup in `convex/app.ts`.
- Extracted the shared access-control helper layer into:
  - `convex/app/access.ts`
- Moved the following private helper responsibilities out of `convex/app.ts`:
  - team read/edit access checks
  - workspace read/edit/admin access checks
  - document read/edit access checks
- Kept the exported Convex query/mutation surface unchanged in `convex/app.ts`, so `api.app.*` remains stable.
- Preserved one direct `isWorkspaceOwner` check in `deleteWorkspace`, which still belongs at the callsite because it is not part of the reusable access helper layer.

### Verification

- Targeted eslint on:
  - `convex/app.ts`
  - `convex/app/access.ts`
  passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `convex/app.ts` dropped from `6767` lines to `6620`.
- The new extracted access module is:
  - `convex/app/access.ts` at `162` lines
- The access-control layer is now isolated from the rest of the Convex handler implementation, which makes future extractions safer.

### Remaining planned work

- Continue the deeper private-helper extraction in `convex/app.ts`, with the next likely candidates being deletion/cleanup helpers or collaboration audience/membership helpers.
- Keep reviewing the remaining UI/helper modules for any similarly obvious modular boundaries, but the `screens` and inbox surfaces are now materially improved.
- Keep the same no-behavior-change rule and full `pnpm check` verification on each tranche.

## Turn 34

### Implemented in this pass

- Continued the deeper Convex refactor in `convex/app.ts`.
- Extracted the conversation helper layer into:
  - `convex/app/conversations.ts`
- Moved the following private helper responsibilities out of `convex/app.ts`:
  - team/workspace conversation audience resolution
  - team/workspace conversation discovery
  - team/workspace conversation creation and participant syncing
  - reusable conversation access checks
  - room update helpers for conversations and calls
- Kept the exported Convex query/mutation surface unchanged in `convex/app.ts`, so `api.app.*` remains stable.
- Preserved the small number of direct `getEffectiveRole` and workspace-role lookups that still belong in the main file because they are not part of the reusable conversation helper layer.

### Verification

- Targeted eslint on:
  - `convex/app.ts`
  - `convex/app/conversations.ts`
  passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `convex/app.ts` dropped from `6620` lines to `6224`.
- The new extracted conversation module is:
  - `convex/app/conversations.ts` at `431` lines
- The conversation/membership/access layer is now isolated from the rest of the Convex handlers, which makes future backend extractions safer.

### Remaining planned work

- Continue the deeper private-helper extraction in `convex/app.ts`, with the next strongest candidate being the deletion/cleanup helper block.
- Keep reviewing the remaining UI/helper modules for any similarly obvious modular boundaries, but the main frontend `screens` surface and inbox flow are now in materially healthier shape.
- Keep the same no-behavior-change rule and full `pnpm check` verification on each tranche.

## Turn 35

### Implemented in this pass

- Continued the deeper Convex refactor in `convex/app.ts`.
- Extracted the deletion and cleanup helper layer into:
  - `convex/app/cleanup.ts`
- Moved the following private helper responsibilities out of `convex/app.ts`:
  - bulk document/storage deletion helpers
  - view-filter cleanup after entity deletion
  - link cleanup across documents and work items after deletion
  - unused-label cleanup
  - user-app-state cleanup after workspace deletion
  - unreferenced-user cleanup
  - team cascade deletion orchestration
- Reused the shared cleanup delete helpers inside `wipeAllAppData` so the repo no longer keeps a second local bulk-delete helper there.
- Kept the exported Convex query/mutation surface unchanged in `convex/app.ts`, so `api.app.*` remains stable.

### Verification

- Targeted eslint on:
  - `convex/app.ts`
  - `convex/app/cleanup.ts`
  passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `convex/app.ts` dropped from `6224` lines to `5672`.
- The new extracted cleanup module is:
  - `convex/app/cleanup.ts` at `567` lines
- The destructive cleanup and cascade-delete logic is now isolated from the main Convex handler file, which makes future backend extractions safer and easier to review.

### Remaining planned work

- Continue the deeper private-helper extraction in `convex/app.ts`, focusing next on the remaining large domain-specific helper clusters.
- Keep reviewing the remaining UI/helper modules for any similarly obvious modular boundaries, but the main frontend `screens` surface and inbox flow are now in materially healthier shape.
- Keep the same no-behavior-change rule and full `pnpm check` verification on each tranche.

## Turn 36

### Implemented in this pass

- Continued the deeper Convex refactor in `convex/app.ts`.
- Extracted the work and view helper layer into:
  - `convex/app/work-helpers.ts`
- Moved the following private helper responsibilities out of `convex/app.ts`:
  - team-scope project ownership checks
  - work-item parent validation and cycle prevention
  - canonical team work-view synchronization
  - work-item cascade-id collection
  - project-link cascade resolution for work-item updates
  - view mutation access checks
- Kept the exported Convex query/mutation surface unchanged in `convex/app.ts`, so `api.app.*` remains stable.

### Verification

- Targeted eslint on:
  - `convex/app.ts`
  - `convex/app/work-helpers.ts`
  passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `convex/app.ts` dropped from `5672` lines to `5363`.
- The new extracted work helper module is:
  - `convex/app/work-helpers.ts` at `338` lines
- The work-item/view orchestration layer is now isolated from the main Convex handler file, which makes future backend refactors safer.

### Remaining planned work

- Continue the deeper private-helper extraction in `convex/app.ts`, focusing next on the remaining notification/path/server-resolution/image/team-surface helper cluster.
- Keep reviewing the remaining UI/helper modules for any similarly obvious modular boundaries, but the main frontend `screens` surface and inbox flow are now in materially healthier shape.
- Keep the same no-behavior-change rule and full `pnpm check` verification on each tranche.

## Turn 37

### Implemented in this pass

- Continued the deeper Convex refactor in `convex/app.ts`.
- Extracted the notification helper layer into:
  - `convex/app/notifications.ts`
- Moved the following private helper responsibilities out of `convex/app.ts`:
  - notification ownership checks
  - bulk invite-notification archiving
  - channel conversation entity-path resolution
  - chat conversation entity-path resolution
- Kept the exported Convex query/mutation surface unchanged in `convex/app.ts`, so `api.app.*` remains stable.

### Verification

- Targeted eslint on:
  - `convex/app.ts`
  - `convex/app/notifications.ts`
  passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `convex/app.ts` dropped from `5363` lines to `5270`.
- The new extracted notification helper module is:
  - `convex/app/notifications.ts` at `103` lines
- The notification-path and notification-ownership layer is now isolated from the main Convex handler file.

### Remaining planned work

- Continue the deeper private-helper extraction in `convex/app.ts`, focusing next on the remaining attachment/server-resolution/image/team-surface helper cluster.
- Keep reviewing the remaining UI/helper modules for any similarly obvious modular boundaries, but the main frontend `screens` surface and inbox flow are now in materially healthier shape.
- Keep the same no-behavior-change rule and full `pnpm check` verification on each tranche.

## Turn 38

### Implemented in this pass

- Continued the deeper Convex refactor in `convex/app.ts`.
- Extracted the remaining top-level helper cluster into:
  - `convex/app/assets.ts`
  - `convex/app/server-users.ts`
  - `convex/app/team-feature-guards.ts`
- Moved the following private helper responsibilities out of `convex/app.ts`:
  - attachment target resolution for work items and team documents
  - uploaded image metadata and size validation
  - server-token-backed user resolution by WorkOS user ID or email
  - team-surface disable guards for docs, chat, and channels
- Kept the exported Convex query/mutation surface unchanged in `convex/app.ts`, so `api.app.*` remains stable.

### Verification

- Targeted eslint on:
  - `convex/app.ts`
  - `convex/app/assets.ts`
  - `convex/app/server-users.ts`
  - `convex/app/team-feature-guards.ts`
  passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `convex/app.ts` dropped from `5270` lines to `5090`.
- The new extracted helper modules are:
  - `convex/app/assets.ts` at `69` lines
  - `convex/app/server-users.ts` at `31` lines
  - `convex/app/team-feature-guards.ts` at `92` lines
- The top-level helper block is now gone from `convex/app.ts`; the remaining file is increasingly concentrated around the exported Convex handlers themselves rather than mixed utility code.

### Remaining planned work

- Continue the deeper `convex/app.ts` decomposition by extracting cohesive handler families by domain while keeping the exported `api.app.*` surface stable.
- Keep reviewing the remaining UI/helper modules for any similarly obvious modular boundaries, but the main frontend `screens` surface and inbox flow are now in materially healthier shape.
- Keep the same no-behavior-change rule and full `pnpm check` verification on each tranche.

## Turn 39

### Implemented in this pass

- Continued the deeper Convex refactor in `convex/app.ts`.
- Extracted the first full handler family into:
  - `convex/app/auth-bootstrap.ts`
- Moved the following exported handler implementations out of `convex/app.ts` while keeping the public `api.app.*` names stable in the barrel:
  - `bootstrapAppWorkspace`
  - `getSnapshot`
  - `getSnapshotVersion`
  - `getAuthContext`
  - `ensureUserFromAuth`
  - `bootstrapWorkspaceUser`
  - `getInviteByToken`
  - `lookupTeamByJoinCode`
  - `listWorkspacesForSync`
- Kept the actual exported Convex surface in `convex/app.ts`, but converted those exports to thin `query(...)` / `mutation(...)` wrappers around imported handlers.

### Verification

- Targeted eslint on:
  - `convex/app.ts`
  - `convex/app/auth-bootstrap.ts`
  passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `convex/app.ts` dropped from `5090` lines to `4308`.
- The new extracted handler module is:
  - `convex/app/auth-bootstrap.ts` at `944` lines
- This is the first Convex tranche that moves full exported handler families, not just private helpers, out of the monolith while preserving the generated `api.app.*` contract.

### Remaining planned work

- Continue the deeper `convex/app.ts` decomposition by extracting the next cohesive handler family, likely the workspace/team administration and notification/update block.
- Keep reviewing the remaining UI/helper modules for any similarly obvious modular boundaries, but the main frontend `screens` surface and inbox flow are now in materially healthier shape.
- Keep the same no-behavior-change rule and full `pnpm check` verification on each tranche.

## Turn 40

### Implemented in this pass

- Continued the deeper Convex refactor in `convex/app.ts`.
- Extracted the next two handler families into:
  - `convex/app/notification-handlers.ts`
  - `convex/app/workspace-team-handlers.ts`
- Moved the following exported handler implementations out of `convex/app.ts` while keeping the public `api.app.*` names stable in the barrel:
  - `listPendingNotificationDigests`
  - `markNotificationRead`
  - `markNotificationsEmailed`
  - `toggleNotificationRead`
  - `archiveNotification`
  - `unarchiveNotification`
  - `deleteNotification`
  - `createWorkspace`
  - `updateWorkspaceBranding`
  - `deleteWorkspace`
  - `setWorkspaceWorkosOrganization`
  - `updateCurrentUserProfile`
  - `ensureWorkspaceScaffolding`
  - `createTeam`
  - `deleteTeam`
  - `createLabel`
  - `updateTeamDetails`
  - `regenerateTeamJoinCode`
  - `updateTeamWorkflowSettings`
- Kept the actual exported Convex surface in `convex/app.ts`, but converted those exports to thin `query(...)` / `mutation(...)` wrappers around imported handlers.

### Verification

- Targeted eslint on:
  - `convex/app.ts`
  - `convex/app/notification-handlers.ts`
  - `convex/app/workspace-team-handlers.ts`
  passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `convex/app.ts` dropped from `4308` lines to `3570`.
- The new extracted handler modules are:
  - `convex/app/notification-handlers.ts` at `181` lines
  - `convex/app/workspace-team-handlers.ts` at `795` lines
- The workspace, team, and notification administration layer is now isolated from the remaining work/document/collaboration mutations in the main Convex barrel.

### Remaining planned work

- Continue the deeper `convex/app.ts` decomposition by extracting the next cohesive mutation family, likely the view/work-item/document block before moving into the collaboration surfaces.
- Keep reviewing the remaining UI/helper modules for any similarly obvious modular boundaries, but the main frontend `screens` surface and inbox flow are now in materially healthier shape.
- Keep the same no-behavior-change rule and full `pnpm check` verification on each tranche.

## Turn 41

### Implemented in this pass

- Continued the deeper Convex refactor in `convex/app.ts`.
- Extracted the next three mutation families into:
  - `convex/app/view-handlers.ts`
  - `convex/app/work-item-handlers.ts`
  - `convex/app/document-handlers.ts`
- Moved the following exported handler implementations out of `convex/app.ts` while keeping the public `api.app.*` names stable in the barrel:
  - `updateViewConfig`
  - `toggleViewDisplayProperty`
  - `toggleViewHiddenValue`
  - `toggleViewFilterValue`
  - `clearViewFilters`
  - `updateWorkItem`
  - `deleteWorkItem`
  - `shiftTimelineItem`
  - `updateDocumentContent`
  - `updateDocument`
  - `heartbeatDocumentPresence`
  - `clearDocumentPresence`
  - `renameDocument`
  - `deleteDocument`
  - `updateItemDescription`
  - `generateAttachmentUploadUrl`
  - `generateSettingsImageUploadUrl`
  - `createAttachment`
  - `deleteAttachment`
- Kept the actual exported Convex surface in `convex/app.ts`, but converted those exports to thin `query(...)` / `mutation(...)` wrappers around imported handlers.

### Verification

- Targeted eslint on:
  - `convex/app.ts`
  - `convex/app/view-handlers.ts`
  - `convex/app/work-item-handlers.ts`
  - `convex/app/document-handlers.ts`
  passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `convex/app.ts` dropped from `3570` lines to `2771`.
- The new extracted handler modules are:
  - `convex/app/view-handlers.ts` at `209` lines
  - `convex/app/work-item-handlers.ts` at `449` lines
  - `convex/app/document-handlers.ts` at `500` lines
- The view, work-item, document, and attachment mutation layer is now isolated from the remaining invite/project/document-creation/collaboration surfaces in the main Convex barrel.

### Remaining planned work

- Continue the deeper `convex/app.ts` decomposition by extracting the next cohesive mutation family, likely comments/invites/project-and-document creation before the final collaboration surfaces.
- Keep reviewing the remaining UI/helper modules for any similarly obvious modular boundaries, but the main frontend `screens` surface and inbox flow are now in materially healthier shape.
- Keep the same no-behavior-change rule and full `pnpm check` verification on each tranche.

## Turn 42

### Implemented in this pass

- Continued the deeper Convex refactor in `convex/app.ts`.
- Added three new focused handler modules:
  - `convex/app/comment-handlers.ts`
  - `convex/app/invite-handlers.ts`
  - `convex/app/project-handlers.ts`
- Extended the existing extracted modules:
  - `convex/app/document-handlers.ts`
  - `convex/app/work-item-handlers.ts`
- Moved the following exported handler implementations out of `convex/app.ts` while keeping the public `api.app.*` names stable in the barrel:
  - `addComment`
  - `toggleCommentReaction`
  - `createInvite`
  - `acceptInvite`
  - `declineInvite`
  - `joinTeamByCode`
  - `createProject`
  - `updateProject`
  - `createDocument`
  - `createWorkItem`
- Kept the actual exported Convex surface in `convex/app.ts`, but converted those exports to thin `mutation(...)` wrappers around imported handlers.
- Replaced the local project-presentation aliasing in the extracted project module with the shared domain types so the extracted handler stays type-aligned with the rest of the app.

### Verification

- Targeted eslint on:
  - `convex/app.ts`
  - `convex/app/comment-handlers.ts`
  - `convex/app/invite-handlers.ts`
  - `convex/app/project-handlers.ts`
  - `convex/app/work-item-handlers.ts`
  - `convex/app/document-handlers.ts`
  passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `convex/app.ts` dropped from `2771` lines to `1993`.
- The new extracted handler modules are:
  - `convex/app/comment-handlers.ts` at `253` lines
  - `convex/app/invite-handlers.ts` at `301` lines
  - `convex/app/project-handlers.ts` at `170` lines
- The expanded extracted modules are now:
  - `convex/app/work-item-handlers.ts` at `628` lines
  - `convex/app/document-handlers.ts` at `567` lines
- The main Convex barrel is now below `2000` lines, and the remaining inline surface is concentrated in the final collaboration/chat/channel/call and backfill block rather than mixed work/document/invite logic.

### Remaining planned work

- Continue the deeper `convex/app.ts` decomposition by extracting the remaining collaboration-oriented handler family:
  - workspace chats
  - team chats and channels
  - call room mutations
  - chat messages
  - channel posts, comments, and reactions
  - backfill utilities
- Keep reviewing the remaining UI/helper modules for any similarly obvious modular boundaries, but the main frontend `screens` surface and inbox flow are now in materially healthier shape.
- Keep the same no-behavior-change rule and full `pnpm check` verification on each tranche.

## Turn 43

### Implemented in this pass

- Continued the deeper Convex refactor in `convex/app.ts`.
- Added two new focused handler modules:
  - `convex/app/collaboration-handlers.ts`
  - `convex/app/backfill-handlers.ts`
- Moved the following exported handler implementations out of `convex/app.ts` while keeping the public `api.app.*` names stable in the barrel:
  - `createWorkspaceChat`
  - `ensureTeamChat`
  - `createChannel`
  - `startChatCall`
  - `setCallRoom`
  - `setConversationRoom`
  - `markCallJoined`
  - `sendChatMessage`
  - `backfillChatMessageKinds`
  - `backfillUserPreferenceThemes`
  - `backfillWorkItemModel`
  - `createChannelPost`
  - `addChannelPostComment`
  - `deleteChannelPost`
  - `toggleChannelPostReaction`
- Kept the actual exported Convex surface in `convex/app.ts`, but converted those exports to thin `mutation(...)` wrappers around imported handlers.
- Cleaned the now-stale collaboration and backfill imports out of `convex/app.ts` after the extraction, so the barrel stayed lint-clean rather than just type-clean.

### Verification

- Targeted eslint on:
  - `convex/app.ts`
  - `convex/app/collaboration-handlers.ts`
  - `convex/app/backfill-handlers.ts`
  passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `convex/app.ts` dropped from `1993` lines to `1090`.
- The new extracted handler modules are:
  - `convex/app/collaboration-handlers.ts` at `879` lines
  - `convex/app/backfill-handlers.ts` at `162` lines
- The main Convex barrel is now mostly the stable export surface plus the remaining wipe/normalization logic and query/mutation wrappers, rather than a mixed implementation monolith.

### Remaining planned work

- Decide whether to do one final optional `convex/app.ts` cleanup pass for the remaining `wipeAllAppData` / `normalizeAppConfig` inline logic, or leave it as the stable public barrel now that the main implementation families are extracted.
- Keep reviewing the remaining UI/helper modules for any similarly obvious modular boundaries, but the main frontend `screens` surface and inbox flow are now in materially healthier shape.
- Keep the same no-behavior-change rule and full `pnpm check` verification on each tranche.

## Turn 44

### Implemented in this pass

- Continued the structural UI refactor work after the Convex decomposition.
- Extracted the timeline renderer out of `components/app/screens/work-surface-view.tsx` into:
  - `components/app/screens/work-surface-view/timeline-view.tsx`
  - `components/app/screens/work-surface-view/shared.tsx`
- Kept the public `@/components/app/screens/work-surface-view` surface stable by re-exporting `TimelineView` from the existing barrel file.
- Moved the shared group-label and group-adornment helpers out of the monolith so both the remaining board/list surface and the new timeline module use the same implementation.

### Verification

- Targeted eslint on:
  - `components/app/screens/work-surface-view.tsx`
  - `components/app/screens/work-surface-view/shared.tsx`
  - `components/app/screens/work-surface-view/timeline-view.tsx`
  passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `components/app/screens/work-surface-view.tsx` dropped from `1562` lines to `846`.
- The new extracted modules are:
  - `components/app/screens/work-surface-view/shared.tsx` at `41` lines
  - `components/app/screens/work-surface-view/timeline-view.tsx` at `715` lines
- The main work-surface view barrel is now below `900` lines and no longer mixes board/list rendering with the full timeline implementation.

### Remaining planned work

- The remaining primary structural refactor backlog is now:
  - `components/app/rich-text-editor.tsx`
  - `lib/store/app-store-internal/slices/work.ts`
  - `lib/store/app-store-internal/slices/collaboration.ts`
- There is also one optional cleanup pass left on `convex/app.ts` if we want the barrel even thinner, but the major Convex implementation monolith is already resolved.
- Keep the same no-behavior-change rule and full `pnpm check` verification on each tranche.

## Turn 45

### Implemented in this pass

- Continued the structural UI refactor work.
- Extracted the rich-text editor toolbar and command-menu surfaces out of `components/app/rich-text-editor.tsx` into:
  - `components/app/rich-text-editor/toolbar.tsx`
  - `components/app/rich-text-editor/menus.tsx`
- Kept the public `@/components/app/rich-text-editor` surface stable by leaving the editor component itself in the existing file and moving only the toolbar, slash-command catalog, slash menu, and mention menu out.
- Preserved the existing editor behavior:
  - same Tiptap extension/configuration setup
  - same slash-command behavior
  - same mention insertion behavior
  - same upload/image picker flows
  - same full-page canvas width controls

### Verification

- Targeted eslint on:
  - `components/app/rich-text-editor.tsx`
  - `components/app/rich-text-editor/toolbar.tsx`
  - `components/app/rich-text-editor/menus.tsx`
  passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `components/app/rich-text-editor.tsx` dropped from `1589` lines to `743`.
- The new extracted modules are:
  - `components/app/rich-text-editor/menus.tsx` at `550` lines
  - `components/app/rich-text-editor/toolbar.tsx` at `428` lines
- The main editor file now mostly owns the editor lifecycle, state synchronization, and upload plumbing rather than also owning the entire toolbar and command-menu UI surface.

### Remaining planned work

- The remaining primary structural refactor backlog is now:
  - `lib/store/app-store-internal/slices/work.ts`
  - `lib/store/app-store-internal/slices/collaboration.ts`
- There is still one optional cleanup pass left on `convex/app.ts` if we want the barrel even thinner, but the major Convex implementation monolith is already resolved.
- Keep the same no-behavior-change rule and full `pnpm check` verification on each tranche.

## Turn 46

### Implemented in this pass

- Continued the store-layer decomposition.
- Split `lib/store/app-store-internal/slices/work.ts` into focused internal modules:
  - `lib/store/app-store-internal/slices/work-shared.ts`
  - `lib/store/app-store-internal/slices/work-item-actions.ts`
  - `lib/store/app-store-internal/slices/work-document-actions.ts`
  - `lib/store/app-store-internal/slices/work-comment-actions.ts`
- Kept `lib/store/app-store-internal/slices/work.ts` as the stable composition point for the slice while moving the actual action implementations into domain-specific files.
- Preserved behavior across:
  - work item creation/update/delete/timeline shifts
  - document create/update/delete flows
  - attachment upload/delete flows
  - comment create/reaction flows
  - label creation

### Verification

- Targeted eslint on:
  - `lib/store/app-store-internal/slices/work.ts`
  - `lib/store/app-store-internal/slices/work-shared.ts`
  - `lib/store/app-store-internal/slices/work-item-actions.ts`
  - `lib/store/app-store-internal/slices/work-document-actions.ts`
  - `lib/store/app-store-internal/slices/work-comment-actions.ts`
  passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `lib/store/app-store-internal/slices/work.ts` dropped from `1040` lines to `20`.
- The new extracted modules are:
  - `lib/store/app-store-internal/slices/work-shared.ts` at `28` lines
  - `lib/store/app-store-internal/slices/work-item-actions.ts` at `463` lines
  - `lib/store/app-store-internal/slices/work-document-actions.ts` at `407` lines
  - `lib/store/app-store-internal/slices/work-comment-actions.ts` at `223` lines
- The work slice is now organized around action domains instead of one mixed mutation/update monolith.

### Remaining planned work

- The remaining primary structural refactor backlog is now:
  - `lib/store/app-store-internal/slices/collaboration.ts`
- There is still one optional cleanup pass left on `convex/app.ts` if we want the barrel even thinner, but the major Convex implementation monolith is already resolved.
- Keep the same no-behavior-change rule and full `pnpm check` verification on each tranche.

## Turn 47

### Implemented in this pass

- Continued the store-layer decomposition and completed the last primary structural refactor tranche.
- Split `lib/store/app-store-internal/slices/collaboration.ts` into focused internal modules:
  - `lib/store/app-store-internal/slices/collaboration-shared.ts`
  - `lib/store/app-store-internal/slices/collaboration-conversation-actions.ts`
  - `lib/store/app-store-internal/slices/collaboration-channel-actions.ts`
  - `lib/store/app-store-internal/slices/collaboration-invite-actions.ts`
- Kept `lib/store/app-store-internal/slices/collaboration.ts` as the stable composition point for the slice while moving the actual action implementations into domain-specific files.
- Preserved behavior across:
  - workspace chat creation
  - team chat and channel creation
  - conversation call starts
  - chat message send flows
  - channel post/comment/reaction flows
  - invite creation flows

### Verification

- Targeted eslint on:
  - `lib/store/app-store-internal/slices/collaboration.ts`
  - `lib/store/app-store-internal/slices/collaboration-shared.ts`
  - `lib/store/app-store-internal/slices/collaboration-conversation-actions.ts`
  - `lib/store/app-store-internal/slices/collaboration-channel-actions.ts`
  - `lib/store/app-store-internal/slices/collaboration-invite-actions.ts`
  passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes

### Measured progress

- `lib/store/app-store-internal/slices/collaboration.ts` dropped from `930` lines to `20`.
- The new extracted modules are:
  - `lib/store/app-store-internal/slices/collaboration-shared.ts` at `24` lines
  - `lib/store/app-store-internal/slices/collaboration-conversation-actions.ts` at `532` lines
  - `lib/store/app-store-internal/slices/collaboration-channel-actions.ts` at `366` lines
  - `lib/store/app-store-internal/slices/collaboration-invite-actions.ts` at `84` lines
- The collaboration slice is now organized around conversation, channel, and invite domains instead of one mixed collaboration monolith.

### Remaining planned work

- The required primary structural refactor backlog is now complete.
- Remaining optional cleanup:
  - one final barrel-thinning pass on `convex/app.ts` if we want to move `wipeAllAppData` / `normalizeAppConfig`
  - any further opportunistic splits on files that are still above heuristic targets but no longer clearly overloaded
- Remaining non-refactor audit work still separate from structural cleanup:
  - staged provider/runtime verification for WorkOS, Convex, 100ms, and Resend flows
  - final CRUD asymmetry classification and documentation where behavior is intentionally partial
- Keep the same no-behavior-change rule and full `pnpm check` verification on each tranche.

## Turn 48

### Implemented in this pass

- Completed the final optional `convex/app.ts` barrel-thinning pass by moving the last inline admin mutations into `convex/app/maintenance-handlers.ts`:
  - `wipeAllAppDataHandler`
  - `normalizeAppConfigHandler`
- Kept `convex/app.ts` as the stable public `api.app.*` export surface while removing the last large inline maintenance implementations from the barrel.
- Audited the remaining ops/config surfaces and applied the low-risk fixes that were still actionable locally:
  - aligned `.env.example` and `README.md` with the environment variables actually used by the codebase and scripts
  - added `--dry-run` support to `scripts/wipe-convex-data.mjs`
  - fixed `scripts/wipe-convex-data.mjs` so it no longer hard-fails when `.env.local` is absent but env vars are already present in the shell
  - added a hosted-Convex guard so the wipe script does not infer a fake production deployment from a localhost-style URL
- Re-reviewed `electron/main.mjs` and the remaining admin scripts after the env/script fixes. No additional code changes were required there.

### Verification

- Targeted eslint on:
  - `convex/app.ts`
  - `convex/app/maintenance-handlers.ts`
  - `scripts/wipe-convex-data.mjs`
  passes
- `node scripts/wipe-convex-data.mjs --dry-run`: passes and returns a non-destructive preview without requiring `.env.local`
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes end to end

### Measured progress

- `convex/app.ts` dropped from `1090` lines to `957`
- `convex/app/maintenance-handlers.ts` is `153` lines
- `scripts/wipe-convex-data.mjs` now supports a safe preview path and tolerates shell-only env configuration

### CRUD classification closeout

- CRUD-complete surfaces:
  - workspaces
  - teams
  - work items
  - documents
  - attachments
  - notifications
  - account/profile mutation flows
- Intentionally action-oriented or product-limited surfaces, based on end-to-end code shape rather than a partial broken implementation:
  - projects: create/update only, no delete flow exposed
  - labels: create only, no rename/delete flow exposed
  - views: mutate existing saved/system views only, no standalone create/delete flow exposed
  - invites: create/accept/decline only, no revoke/delete flow exposed
  - chats/conversations: create/send/start-call flows, no rename/delete flow exposed
  - channels: create channel/post/comment/reaction/delete-post flows, no channel rename/delete flow exposed
  - comments: create and reaction-toggle flows only
- Audit classification:
  - these asymmetric surfaces are documented as current product limits, not active regression bugs, because the omissions are consistent across UI, store, API, and Convex layers rather than half-wired or mismatched integrations
  - this is an inference from the codebase shape, not a live product-spec confirmation

### Provider/runtime verification closeout

- Static provider seam review is complete for:
  - WorkOS auth, callbacks, password reset, verification, and organization sync
  - Convex snapshot/bootstrap/server-token flows
  - 100ms call room creation and join orchestration
  - Resend-backed email and digest flows
- Config drift that was still actionable locally is now closed:
  - `.env.example` now includes `NEXT_PUBLIC_APP_URL`
  - `.env.example` now includes `NEXT_DEV_SERVER_URL`
  - `.env.example` now includes `CONVEX_SERVER_TOKEN_DEVELOPMENT` and `CONVEX_SERVER_TOKEN_PRODUCTION`
  - `.env.example` now documents the digest `DRY_RUN` flag
- Script/provider safety status after review:
  - `scripts/bootstrap-app-workspace.mjs`, `scripts/sync-workspace-organizations.mjs`, and `scripts/backfill-work-item-model.mjs` already validate required env before mutating
  - `scripts/send-notification-digests.mjs` already supports dry-run mode through `DRY_RUN=1`
  - `scripts/wipe-convex-data.mjs` now supports an explicit dry-run preview and safer deployment inference
- Electron review closeout:
  - internal app navigation remains in-app
  - external navigation remains restricted to `https:` and `mailto:`
  - the standalone server child process is still cleaned up on quit
  - no additional local code fixes were required in `electron/main.mjs`
- Remaining external verification gap:
  - live staged provider validation was not executed in this audit cycle because no staging credentials/sandbox runbook were provided for WorkOS, Convex, 100ms, or Resend

### Remaining planned work

- The local structural refactor backlog is complete.
- The local audit/documentation closeout is complete.
- The only remaining step outside this repo is staged live verification:
  - run the WorkOS auth and org-sync flows against staging
  - run the Convex snapshot/bootstrap flows against staging
  - run the 100ms call creation/join flows against staging
  - run the Resend email/invite/digest flows against staging
- Before staging or production rollout, deploy/sync the `convex/` changes because this branch contains backend Convex updates, not just client-side refactors.

## Turn 49

### Implemented in this pass

- Ran a branch-wide diff review of `origin/main...HEAD` at commit `f00e6fb`.
- Recorded the diff-review findings in this audit file per user request instead of opening a separate `.reviews/` document.
- Folded in the user-reported runtime error from the refactored work surface controls.

### Diff Review Findings

#### F49-01 High: `FilterPopover` now violates Zustand snapshot stability and can trigger an infinite render loop

- Files:
  - `components/app/screens/work-surface-controls.tsx:132`
  - `lib/domain/selectors-internal/work-items.ts:494`
- Impact:
  - The team/work surface can spam the console with `The result of getSnapshot should be cached to avoid an infinite loop` and can become unstable or unusable in the affected screen tree.
- Root cause:
  - `FilterPopover` subscribes with `useAppStore(useShallow((state) => ({ ... })))`, but the returned object includes freshly allocated arrays on every selector run:
    - `getItemAssignees(state, items)` returns a new array each time
    - `state.projects.filter(...)` returns a new array each time
    - `state.labels.filter(...)` returns a new array each time
  - `useShallow` can stabilize a returned array, or an object of stable references, but it does not make nested freshly allocated arrays inside an object stable. That causes the selector snapshot to change on every render even when the underlying store has not changed.
- Evidence:
  - Reproduced by the user in `TeamWorkScreen -> WorkSurface -> FilterPopover`.
  - `getItemAssignees` explicitly returns `[...]` from a `Map`, so it is always referentially new.
- Recommended fix:
  - Split the selector into stable primitive/raw-slice subscriptions and derive the filtered arrays with `useMemo`, or subscribe to each derived array separately instead of wrapping them in one object selector.

#### F49-02 High: the new dual-environment wipe flow is still deployment-ambiguous and can target the wrong Convex environment

- Files:
  - `scripts/wipe-convex-data.mjs:52`
  - `scripts/wipe-convex-data.mjs:73`
  - `scripts/wipe-convex-data.mjs:185`
  - `.env.example:1`
  - `README.md:50`
- Impact:
  - In mixed environment files where the unsuffixed Convex URL points to production but `CONVEX_SERVER_TOKEN_DEVELOPMENT` / `CONVEX_SERVER_TOKEN_PRODUCTION` are both present, the wipe script can still derive deployment metadata from the production URL. That is a destructive-operation targeting risk.
- Root cause:
  - The branch added split server-token docs and dry-run output for the wipe flow, but the script still resolves deployment identity from only `CONVEX_URL ?? NEXT_PUBLIC_CONVEX_URL`.
  - There is no matching `CONVEX_URL_DEVELOPMENT` / `CONVEX_URL_PRODUCTION` or deploy-key split in the script’s targeting logic, so the “development” and “production” token split is not enough to safely disambiguate the actual deployment target.
- Evidence:
  - During rollout we had to build a manual override env file to safely point local commands at the dev cloud deployment.
  - The current dry-run summary reports separate development/production token readiness, but only one hosted deployment is derived from the shared base URL.
- Recommended fix:
  - Require explicit development and production deployment identifiers or URLs for this script, or refuse execution when env-specific tokens are present but deployment identity is still sourced from a single unsuffixed base URL.

### Review Conclusion

- The current branch-level diff review found `2` high-severity issues worth tracking.
- `F49-01` is an active application bug and is already user-visible.
- `F49-02` is an operational safety issue in destructive tooling and should be fixed before anyone relies on the new dual-environment wipe workflow.
- No additional branch-vs-`main` findings were confirmed in this pass beyond these two issues.

## Turn 50

### Implemented in this pass

- Fixed the user-reported `getSnapshot should be cached to avoid an infinite loop` regression in the refactored work-surface controls.
- Fixed the dual-environment Convex wipe script so it now requires explicit development and production deployment URLs instead of inferring a target from the unsuffixed base URL.
- Updated `.env.example` and `README.md` so the wipe-script env contract matches the implemented behavior.

### Fix details

#### F49-01 Resolved: `FilterPopover` selector now uses stable store subscriptions

- Files:
  - `components/app/screens/work-surface-controls.tsx`
- Fix:
  - Removed the `useShallow` object selector that returned newly allocated `assignees`, `projects`, and `labels` arrays on every store read.
  - Replaced it with stable slice subscriptions for `users`, `projects`, `labels`, and `singleTeam`, then derived the filtered arrays with `useMemo`.
  - Preserved the assignee ordering behavior by reconstructing the assignee list in work-item encounter order rather than switching to a generic user-list filter.
- Outcome:
  - The `FilterPopover` subscription no longer violates Zustand snapshot stability, so the console error reported in `TeamWorkScreen -> WorkSurface -> FilterPopover` is closed.

#### F49-02 Resolved: wipe script now targets explicit dev/prod deployments

- Files:
  - `scripts/wipe-convex-data.mjs`
  - `.env.example`
  - `README.md`
- Fix:
  - Added explicit dual-environment URL resolution via `CONVEX_URL_DEVELOPMENT` / `CONVEX_URL_PRODUCTION` with `NEXT_PUBLIC_...` fallbacks for script use.
  - Removed the shared unsuffixed deployment inference path from the destructive wipe flow.
  - Changed the script to pass explicit Convex deployment names for both development and production runs, instead of mixing split tokens with one inferred deployment target.
  - Updated the docs so `CONVEX_SERVER_TOKEN` is described as the active app-environment token, while the wipe script is documented as using the suffixed dev/prod URL and token vars.
- Outcome:
  - The wipe dry-run now reports separate explicit targets for development and production, eliminating the mixed-env targeting ambiguity from Turn 49.

### Verification

- `pnpm exec eslint components/app/screens/work-surface-controls.tsx scripts/wipe-convex-data.mjs`: passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `node scripts/wipe-convex-data.mjs --dry-run` with explicit dev/prod Convex URL and token envs: passes and reports separate `flexible-cheetah-243` and `content-frog-200` targets
- `pnpm check`: passes end to end

### Review Status

- `F49-01`: fixed in this turn
- `F49-02`: fixed in this turn
- No new issues were introduced by these fixes in the verification pass above

## Turn 51

### Implemented in this pass

- Re-ran the diff review after Turn 50 using the new user-reported console errors from the collaboration surfaces.
- Confirmed two more active Zustand snapshot-stability regressions of the same class as `F49-01`.
- Fixed those active regressions and proactively removed three more same-pattern object selectors that were still returning freshly allocated arrays inside `useShallow` object selectors.

### Diff Review Findings

#### F51-01 High: `CreateWorkspaceChatDialog` still returned a fresh `allUsers` array inside an object selector

- Files:
  - `components/app/collaboration-screens/workspace-chat-ui.tsx`
- Impact:
  - `WorkspaceChatsScreen -> CreateWorkspaceChatDialog` could still trigger `The result of getSnapshot should be cached to avoid an infinite loop`.
- Root cause:
  - The selector returned `{ workspace, allUsers }`, where `allUsers` came from `getWorkspaceUsers(...).filter(...)`, producing a new array on every store read.
- Fix:
  - Replaced the object selector with stable raw-slice subscriptions for workspace, teams, memberships, and users, then derived `allUsers` with `useMemo`.

#### F51-02 High: `NewPostComposer` still returned a fresh `mentionCandidates` array inside an object selector

- Files:
  - `components/app/collaboration-screens/channel-ui.tsx`
- Impact:
  - `WorkspaceChannelsScreen -> NewPostComposer` could still trigger `The result of getSnapshot should be cached to avoid an infinite loop`.
- Root cause:
  - The selector returned `{ currentUser, mentionCandidates }`, where `mentionCandidates` came from `getConversationParticipants(...)`, producing a new array on every store read.
- Fix:
  - Split the selector into stable slice subscriptions and derived `currentUser` / `mentionCandidates` with `useMemo`.

### Additional same-pattern fixes

- `components/app/screens/create-work-item-dialog.tsx`
  - Removed the object selector that returned fresh `teamMembers`, `teamProjects`, and sorted `availableLabels` arrays.
- `components/app/screens/project-creation.tsx`
  - Removed the object selector that returned fresh `teamMembers` and sorted `availableLabels` arrays.
- `components/app/screens/work-item-ui.tsx`
  - Removed the object selector that returned fresh `teamMembers` and `teamProjects` arrays for the inline child-item composer.

### Verification

- `pnpm exec eslint components/app/collaboration-screens/workspace-chat-ui.tsx components/app/collaboration-screens/channel-ui.tsx components/app/screens/create-work-item-dialog.tsx components/app/screens/project-creation.tsx components/app/screens/work-item-ui.tsx`: passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes end to end
- Focused selector sweep:
  - the remaining `useShallow((state) => { ... })` callsites in this repo now resolve to direct-array selectors or primitive/object selectors without freshly allocated array properties in the returned object

### Review Status

- `F51-01`: fixed in this turn
- `F51-02`: fixed in this turn
- No new Convex deployment is required for this turn because no files under `convex/` changed
- Local validation should use the existing repo dev server on `http://127.0.0.1:3000`; if the browser still shows the old console errors, do a hard refresh or restart that dev server so Turbopack serves the updated client bundle

## Turn 52

### Implemented in this pass

- Removed the desktop sidebar rail from the main shell so the sidebar no longer exposes the slide/resize edge interaction there.
- Changed the global-search footer action so `Open full search` is visually filled with a light muted background instead of reading as a hollow outline-only control.
- Re-ran the diff review after these UI changes.

### UI changes

- Files:
  - `components/app/shell.tsx`
  - `components/app/global-search-dialog.tsx`
- Changes:
  - Removed `<SidebarRail />` from the app shell desktop sidebar.
  - Updated the `Open full search` button styling to use a muted filled surface while preserving its existing action and shortcut hint.

### Diff Review Findings

- No new bugs, security issues, or regression risks were identified from this pass.
- The sidebar change is a straightforward removal of an interaction affordance from the shell only; it does not alter route behavior, mobile sidebar behavior, or shared sidebar internals.
- The search-button change is styling-only and does not alter search dialog behavior.

### Verification

- `pnpm exec eslint components/app/shell.tsx components/app/global-search-dialog.tsx`: passes
- `pnpm exec tsc --noEmit --pretty false`: passes
- `pnpm check`: passes end to end

### Review Status

- No new findings in this turn
- No Convex deploy is needed for this turn because no backend files changed
