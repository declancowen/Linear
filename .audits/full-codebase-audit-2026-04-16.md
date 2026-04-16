# Audit: Full Codebase Audit

## Project context

| Field | Value |
|-------|-------|
| **Repository** | `Linear` |
| **Remote** | `https://github.com/declancowen/Linear.git` |
| **Branch** | `main` |
| **Commit** | `b1419ff` |
| **Date** | `2026-04-16 20:22:16 BST` |
| **Repo type** | `single repo` |
| **Stack** | `Next.js 16 / React 19 / Convex / WorkOS / Zustand / Electron / TypeScript` |
| **OS** | `Darwin 25.4.0 arm64` |
| **Node** | `v25.8.0` |
| **pnpm** | `10.32.0` |
| **Codebase size** | `~309 source files / ~58.6k LOC across app, components, convex, lib, electron, scripts, and tests` |

## Audit scope

Areas covered by this audit:

- Full repo audit across frontend, route layer, Convex backend, auth, permissions, state management, scripts, tooling, and desktop wrapper
- Explicit re-check of prior lifecycle and membership-management work as context only, not as the answer
- Architecture review using `architecture-standards`
- Performance and security review with emphasis on hot paths and multi-workspace correctness

## Audit status

| Field | Value |
|-------|-------|
| **Audit started** | `2026-04-16 20:22:16 BST` |
| **Last audited** | `2026-04-16 20:40:35 BST` |
| **Total turns** | `3` |
| **Open findings** | `13` |
| **Resolved findings** | `0` |
| **Accepted findings** | `0` |

## Findings summary

| Severity | Open | Resolved | Accepted |
|----------|------|----------|----------|
| Critical | 1 | 0 | 0 |
| High | 7 | 0 | 0 |
| Medium | 5 | 0 | 0 |
| Low | 0 | 0 | 0 |

---

## Turn 1 - 2026-04-16 20:22:16 BST

| Field | Value |
|-------|-------|
| **Commit** | `b1419ff` |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** The repo is still a coherent modular monolith with materially better structure than the older audit history implies, and the core source tree passes source-only lint, typecheck, tests, and build. The main risks are now concentrated in security and scale: unsanitized rich-text rendering creates a stored-XSS path, labels are globally scoped across the whole database instead of per workspace, and the snapshot/bootstrap model still leans heavily on full-table scans in the most frequently hit backend path. The architecture is workable and does not need a rewrite, but it does need targeted hardening and scope modeling before the current design assumptions start causing real operational pain.

**Health rating:** Needs attention

**Architecture score:** `72 / 100`

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 3 |
| Medium | 4 |
| Low | 0 |

### Architecture overview

This codebase is best understood as a modular monolith: Next.js owns the web shell and route boundary, Convex owns the domain write/read model, WorkOS sits at the identity edge, and Zustand holds a client-side snapshot of the visible workspace graph. The boundary direction is mostly reasonable: route handlers are thin adapters, access-control helpers are centralized in `convex/app/access.ts`, and most business behavior sits inward in Convex handlers or domain selectors.

The design is strongest where policy is explicit and centralized. The main architectural weakness is that the data-access model has not been tightened to match that modular intent: the snapshot/bootstrap path still assembles user-visible state with broad `collect()` calls, and some domain entities still do not encode tenant scope directly in the schema. That mismatch is the main source of both performance debt and the worst current correctness/security gaps.

### Findings by category

#### Security

##### S1-01 [SECURITY] Critical - `components/app/rich-text-content.tsx:18`, `lib/domain/types-internal/schemas.ts:205-275`, `lib/utils.ts:27-43`, `app/api/chats/[chatId]/messages/route.ts:18-46` - Rich-text content is rendered without server-side sanitization, creating a stored-XSS path

**What's happening:**
User-authored rich text is rendered with `dangerouslySetInnerHTML`, while the write path only validates string length and plain-text presence. `getPlainTextContent` strips tags only to count visible characters; it does not sanitize or normalize the stored HTML. A malicious user can therefore submit hostile markup through chat, channel-post, comment, or document update routes and have it rendered back to other users.

**Root cause:**
The repo treats editor-generated HTML as trusted application data instead of untrusted user input. Validation exists, but it is semantic validation, not security sanitization.

**Codebase implication:**
This is a cross-user stored-XSS risk in an authenticated collaboration product. In practice, it can become credential theft, session abuse, or lateral action execution inside another user's workspace session.

**Solution options:**
1. **Quick fix:** Sanitize all persisted rich-text HTML at the route or Convex boundary with a strict allowlist matching the Tiptap features you actually support.
2. **Proper fix:** Standardize on a canonical content format at the domain boundary, preferably sanitized HTML or structured JSON, and reject unsupported tags/attributes before persistence.
3. **Strategic fix:** Move rich-text security to a dedicated content module with one write sanitizer and one safe render path, then make all chat/post/comment/document surfaces consume that module.

**Investigate:**
Confirm every surface that persists or renders user HTML, including comments, channel posts, chat messages, documents, and work-item descriptions, and add regression tests with hostile payloads such as event handlers and `javascript:` links.

##### S1-02 [SECURITY] High - `convex/validators.ts:324-328`, `convex/schema.ts:51`, `convex/app/workspace_team_handlers.ts:890-928`, `convex/app/auth_bootstrap.ts:645`, `convex/app/work_item_handlers.ts:155-160` - Labels are modeled as global records instead of workspace-scoped data

**What's happening:**
`labels` have only `id`, `name`, and `color`. They do not carry `workspaceId` or `teamId`, `createLabelHandler` deduplicates across the entire table, snapshots return every label to every authenticated user, and work-item validation only checks that a label ID exists anywhere in the database.

**Root cause:**
Tenant scope was not encoded in the label domain model. The schema treats labels like app-global reference data even though the rest of the product is workspace/team scoped.

**Codebase implication:**
This creates cross-workspace metadata bleed and invalid cross-tenant associations. A user in workspace A can see and reuse labels created in workspace B, which is both a permissions problem and a data-model bug.

**Solution options:**
1. **Quick fix:** Add `workspaceId` to labels, filter snapshot labels by accessible workspace, and require label ownership checks in work-item mutations.
2. **Proper fix:** Decide whether labels are workspace-scoped or team-scoped, update the schema and indexes accordingly, and migrate existing data.
3. **Strategic fix:** Audit every non-core entity for explicit ownership and scope so the schema itself encodes tenancy instead of relying on higher-level conventions.

**Investigate:**
Check whether any existing work items already reference labels that belong to another logical workspace context, and plan a migration that preserves visible labels for seeded data.

##### S1-03 [SECURITY] Medium - `next.config.mjs:1-6` - Web security headers are not codified

**What's happening:**
The Next config only sets `output: "standalone"`. There is no application-level CSP, `X-Frame-Options`, HSTS, or similar hardening configuration in the repo.

**Root cause:**
Security hardening is being left to deployment defaults instead of being represented as a versioned application contract.

**Codebase implication:**
This increases blast radius if any HTML injection or third-party script issue lands, and it makes behavior depend on external platform defaults rather than repo-owned policy.

**Solution options:**
1. **Quick fix:** Add a minimum header set in Next config or middleware for CSP, frame-ancestors / `X-Frame-Options`, and HSTS in production.
2. **Proper fix:** Define a tested security-header policy per environment, including allowances needed for WorkOS, 100ms, and any required image/media origins.
3. **Strategic fix:** Treat browser hardening as part of platform governance, with explicit tests or smoke checks in CI.

**Investigate:**
Enumerate the exact third-party origins required for WorkOS auth, Resend-linked assets, and 100ms so a CSP can be strict without breaking runtime flows.

#### Architecture and performance

##### O1-04 [OBSERVATION] High - `convex/app/auth_bootstrap.ts:312-645`, `app/api/snapshot/events/route.ts:14-16`, `:110-145` - The snapshot/bootstrap path still depends on full-table scans in the hottest backend flow

**What's happening:**
`getSnapshotHandler` builds the visible app graph by collecting entire tables for workspaces, teams, memberships, users, projects, work items, documents, views, comments, attachments, invites, conversations, calls, chat messages, posts, and post comments, then filters in memory. The snapshot event stream polls every second for up to 55 seconds per connection. Across `convex/app`, there are `306` `collect()` call sites; `getSnapshotHandler` alone contains `29`.

**Root cause:**
The repo adopted a full-snapshot client model early and has incrementally added access filtering on top of it instead of moving the hot path toward indexed, scope-aware reads.

**Codebase implication:**
This will scale poorly with real workspace growth, especially under multiple open tabs and frequent snapshot refreshes. It also makes access correctness harder to reason about because visibility is assembled from a sequence of broad table reads rather than from scoped query contracts.

**Solution options:**
1. **Quick fix:** Add missing indexes and replace the easiest full-table reads on the snapshot path with scope-constrained queries.
2. **Proper fix:** Break snapshot assembly into scoped query helpers per entity family so access rules and query shape live together.
3. **Strategic fix:** Keep the modular-monolith shape, but migrate the client from one large graph snapshot toward capability-scoped reads or incremental subscriptions where the churn is highest.

**Investigate:**
Profile the largest live workspaces: snapshot latency, payload size, per-user SSE connection count, and the top collections by row count.

##### O1-05 [OBSERVATION] Medium - `components/app/global-search-dialog.tsx:98-100`, `lib/domain/selectors-internal/search.ts:37-90` - Global search still subscribes to the entire app store and recomputes a full workspace search in render

**What's happening:**
The global search dialog uses `useAppStore()` without a selector and immediately runs `searchWorkspace(data, query)` in render. `searchWorkspace` traverses accessible teams, workspace projects, searchable documents, and visible work items to build results.

**Root cause:**
Search remains implemented as a synchronous derived-view concern over the full in-memory snapshot rather than as a scoped selector or cached search model.

**Codebase implication:**
This is not the most dangerous hotspot in the repo, but it keeps an expensive UI path tied to every store update and will become increasingly noticeable as snapshot size grows.

**Solution options:**
1. **Quick fix:** Replace `useAppStore()` with a shallow snapshot selector and memoize the indexed search inputs.
2. **Proper fix:** Build a small search selector layer or precomputed search index derived from the current workspace snapshot.
3. **Strategic fix:** Move global search to a dedicated query service once the data volume justifies server-side search or separate indexing.

**Investigate:**
Measure dialog open latency and keystroke cost on a seeded large workspace rather than on the current lightweight dataset.

#### Tooling and maintainability

##### O1-06 [OBSERVATION] High - `package.json:18`, `eslint.config.mjs:1-19` - The advertised `pnpm check` gate is artifact-sensitive and fails when `.vercel/output` exists locally

**What's happening:**
`pnpm check` runs bare `eslint`, and the ESLint config ignores `.next/**`, `out/**`, `build/**`, and generated Convex files, but not `.vercel/**`. In the current workspace, `pnpm check` fails with thousands of lint findings from generated `.vercel/output/**` artifacts even though source-only lint, typecheck, tests, and build all pass.

**Root cause:**
Tooling assumptions were encoded around a clean workspace rather than around explicit generated-artifact exclusions.

**Codebase implication:**
The quality gate is unreliable in normal local workflows. Developers can see a red repo without any source issue, which weakens trust in the gate and increases the chance of real failures being ignored.

**Solution options:**
1. **Quick fix:** Add `.vercel/**` to ESLint global ignores.
2. **Proper fix:** Scope the lint script to source roots and generated-file exclusions explicitly.
3. **Strategic fix:** Standardize a repo-wide generated-artifact policy across lint, test, search, and review tooling so local build outputs never pollute quality signals.

**Investigate:**
Check whether any other generated directories besides `.vercel/output` can land in the repo root and produce the same false-negative workflow.

##### S1-07 [SECURITY] High - `package.json:39`, `pnpm audit --audit-level high` - The repo is pinned to a vulnerable Next.js release

**What's happening:**
`pnpm audit --audit-level high` reports a high-severity advisory against `next@16.1.7`, with patched versions at `>=16.2.3`. `pnpm outdated` shows both `next` and `eslint-config-next` can move to `16.2.4`.

**Root cause:**
Dependency updates have not kept pace with the current major's security patch releases.

**Codebase implication:**
This leaves the deployed web surface exposed to a known denial-of-service issue in the framework layer even if application code is otherwise correct.

**Solution options:**
1. **Quick fix:** Upgrade `next` and `eslint-config-next` to `16.2.4`, then rerun the full check/build/auth smoke path.
2. **Proper fix:** Add a dependency-security review cadence so framework patch updates do not wait for larger feature work.
3. **Strategic fix:** Treat framework and auth-provider upgrades as part of platform maintenance, with a scheduled owner and checklist.

**Investigate:**
Confirm whether any deployment environment is already overriding or pinning a different Next runtime artifact than the repo lockfile.

##### O1-08 [OBSERVATION] Medium - `vitest.config.ts:5-16`, `tests/**/*.test.*` - Test coverage remains too thin for the current change surface

**What's happening:**
The test harness is present and healthy, but it currently covers only `4` actual test files / `11` tests, focused mostly on route helpers and the Convex client boundary. There is no coverage collection or threshold configured.

**Root cause:**
The test stack was added as a baseline quality layer, but it has not yet expanded with the product's most failure-prone flows.

**Codebase implication:**
High-risk paths such as account deletion, membership removal, snapshot visibility, content sanitization, and data-scope rules still depend heavily on manual review and static reasoning.

**Solution options:**
1. **Quick fix:** Add focused tests for delete-account, remove-member/remove-workspace-user, label scoping, and rich-text sanitization.
2. **Proper fix:** Add coverage reporting and a minimum threshold for the route layer and Convex helper modules that encode policy.
3. **Strategic fix:** Build a small integration-style test matrix around the highest-risk user journeys instead of only unit-testing helpers.

**Investigate:**
Identify the 5-10 most expensive failure modes in production terms and make those the first mandatory test scenarios.

### Architecture standards assessment

- **What is good:** The repo is correctly staying in modular-monolith territory. Access helpers, route adapters, Convex handlers, and domain selectors are materially clearer than earlier audit history suggested.
- **What is weak:** Policy is more centralized than before, but ownership and scope are still not encoded consistently in the schema. That is why labels escaped tenant boundaries and why snapshot assembly still has to perform broad filtering after the fact.
- **What to avoid:** Do not respond to the hot-path scale issues by jumping to microservices or a wholesale rewrite. The current team and product do not need distributed complexity; they need sharper boundaries inside the existing monolith.
- **Score rationale:** `72 / 100` because the architecture shape is proportionate and evolvable, but current security hardening, hot-path query design, and tenant-scope modeling are below the standard expected for a collaboration product handling permissions and cross-user content.

### Verification

- `pnpm exec eslint app components convex lib scripts tests test electron proxy.ts next.config.mjs eslint.config.mjs vitest.config.ts`: passed
- `pnpm typecheck`: passed
- `pnpm test`: passed (`4` test files, `11` tests)
- `pnpm build`: passed
- `pnpm check`: failed only because lint traversed generated `.vercel/output/**` artifacts in the local workspace
- `pnpm audit --audit-level high`: failed with `1` high and `1` moderate vulnerability, including `next@16.1.7`
- `pnpm outdated --format json`: shows `next` and `eslint-config-next` can move to `16.2.4`
- `pnpm why electron` plus `./node_modules/.bin/electron --version`: local Electron binary mismatch still exists (`41.2.0` declared, `v24.14.0` binary), which remains an environment-level verification concern rather than a committed source issue

### Recommendations

1. **Fix first:** Close `S1-01`, `S1-02`, and `S1-07` in that order. Stored XSS, tenant-scope leakage, and a known framework vulnerability are the only issues in this audit that clearly cross the line from debt into urgent risk.
2. **Then address:** `O1-04` and `O1-06`. The snapshot/bootstrap path and the artifact-sensitive lint gate are the biggest day-2 operational problems.
3. **Architecture move with the best ROI:** Keep the existing modular-monolith shape, but make data ownership explicit. The next worthwhile step is not distribution; it is scoping entities correctly and replacing the hottest `collect()`-plus-filter paths with indexed helpers.
4. **Security hardening batch:** Add HTML sanitization, codified security headers, and regression tests for membership/account lifecycle plus content rendering as one hardening slice.
5. **Refactoring path without re-engineering:** After the security fixes, extract snapshot assembly into per-entity query helpers and start shrinking the global snapshot contract where churn is highest instead of rebuilding the whole app architecture.

### Additional notes

- Prior audit and review files were used only as historical context. This file is a fresh audit artifact.
- The current working tree contains several untracked duplicate or backup-style files (for example `... 2.tsx`, `... 3.md`). They were not treated as committed source findings in this audit, but the recurrence suggests a local workflow hygiene problem worth cleaning up before future review cycles.

---

## Turn 2 - 2026-04-16 20:34:12 BST

| Field | Value |
|-------|-------|
| **Commit** | `b1419ff` |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** This turn re-audited the permission and lifecycle surfaces end to end, with special focus on workspace-user removal, leaving a workspace, account deletion, WorkOS reconciliation, and how deleted users are projected back into snapshots. The route-to-Convex permission chain is more internally consistent than the first pass alone could prove: owner-only and admin-only checks mostly line up, and `accountDeletionPendingAt` is doing meaningful safety work. The new problems are lifecycle-governance gaps rather than missing guards: workspace removal does not revoke WorkOS organization membership, and account deletion does not yet implement the intended privacy contract of “retain shared content, scrub identity, delete private artifacts.”

**Health rating:** Needs attention

**Architecture score:** `68 / 100`

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 1 |
| Medium | 1 |
| Low | 0 |

### Turn focus

- Re-check permission boundaries across route handlers, Convex access helpers, and snapshot assembly
- Trace workspace leave/remove-user flows through Convex and WorkOS reconciliation
- Validate whether account deletion matches the intended shared-content retention and privacy model
- Reassess lifecycle architecture using `architecture-standards`

### New findings

#### S2-09 [SECURITY] Medium - `app/api/workspace/current/users/[userId]/route.ts:43-47`, `app/api/workspace/current/leave/route.ts:31-46`, `lib/server/authenticated-app.ts:94-129`, `lib/server/workos.ts:260-285` - Workspace removal and leave flows stop at Convex and do not revoke the user's WorkOS organization membership

**What's happening:**
Workspace leave and workspace-user removal update local Convex membership state, and the self-serve leave route then calls `reconcileAuthenticatedAppContext`. But reconciliation is additive only: it ensures the current workspace organization exists and that the current user has a membership in it. The WorkOS layer exposes `ensureUserOrganizationMembership`, but there is no matching deactivate/delete path for the workspace the user just lost.

**Root cause:**
The lifecycle contract is asymmetric. Join/create flows synchronize additions to the identity provider, while workspace-removal flows stop at the app database boundary.

**Codebase implication:**
Application access is removed correctly inside Convex, but WorkOS organization state can drift. Removed users can remain represented as organization members in the identity provider, which is a governance and permissions-review gap even if the app-level data filters still block normal product access.

**Solution options:**
1. **Quick fix:** Add a `removeUserOrganizationMembership` helper in `lib/server/workos.ts` and call it from workspace leave and workspace-user removal flows using the workspace's `workosOrganizationId`.
2. **Proper fix:** Centralize workspace membership reconciliation so add/remove operations update Convex and WorkOS symmetrically, including not-found and already-inactive cases.
3. **Strategic fix:** Treat external identity reconciliation as part of the permission mutation contract, with regression tests for join, leave, owner removal, and workspace transfer/deletion paths.

**Investigate:**
Confirm the desired WorkOS behavior for users who still belong to other workspaces, and verify how stale organization memberships affect admin tooling, org switching, and future login/session flows.

#### S2-10 [SECURITY] High - `convex/app/workspace_team_handlers.ts:1515-1622`, `convex/app/normalization.ts:34-114`, `convex/app/auth_bootstrap.ts:390-393`, `convex/app/auth_bootstrap.ts:640-643`, `convex/app/access.ts:131-168`, `convex/app/document_handlers.ts:547-563`, `convex/app/workspace_team_handlers.ts:647-669` - Account deletion is still only a partial soft delete, so retained shared content keeps personal identity and private artifacts are not cleaned up

**What's happening:**
`deleteCurrentAccountHandler` removes memberships and app state, then patches the user row by changing email, handle, lifecycle flags, and status defaults. It does not scrub `name`, `title`, `avatarUrl`, `avatarImageStorageId`, or `workosUserId`, and snapshot assembly still returns any visible user records through `resolveUserSnapshot`. Private documents are created with `createdBy: args.currentUserId`, are readable/editable only by that creator, and are not deleted in the account-deletion flow. The profile-update path already knows how to delete a replaced avatar image, but the account-deletion path does not reuse that cleanup.

**Root cause:**
Account deletion is modeled as a tombstone on the user record instead of as an explicit retention/anonymization policy. The code does not distinguish clearly enough between shared collaborative artifacts that should survive and private user-owned artifacts that should be hard-deleted.

**Codebase implication:**
The current implementation does retain shared chat/thread/document history, which is the right high-level direction. The gap is that retained shared content continues to resolve through the deleted user's original profile data, avatar assets can persist, and private documents become orphaned records that no one can access after deletion.

**Solution options:**
1. **Quick fix:** In `deleteCurrentAccountHandler`, set `name` to a tombstone value such as `"Deleted User"`, clear `title`, `avatarUrl`, `workosUserId`, and `avatarImageStorageId`, delete the stored avatar object if present, and hard-delete `private-document` records created by the user.
2. **Proper fix:** Create a dedicated account-deletion cleanup helper that classifies data into retained-shared, retained-anonymized, and hard-deleted-private sets, then applies that policy in one place.
3. **Strategic fix:** Move deletion/anonymization to an idempotent lifecycle job with explicit tests for shared chat/comment authorship, avatar cleanup, private-doc removal, snapshot projection, and retries after partial external failures.

**Investigate:**
Decide whether deleted-user rendering should be stored directly on the user row or derived at projection time, and whether mentions to deleted users should become inert text instead of live identity links.

### Architecture standards reassessment

- **What held up under deeper review:** The permission checks themselves are mostly aligned. Owner-only workspace actions remain owner-only, team-admin checks are centralized, and the pending account-deletion state prevents unsafe re-entry during the delete flow.
- **What is still weak:** Lifecycle policy is not first-class. The repo still spreads “what gets deleted, what gets anonymized, what external systems must be reconciled” across route handlers, Convex mutations, WorkOS helpers, normalization, and snapshot assembly.
- **Best improvement path:** Keep the modular-monolith shape, but introduce a dedicated lifecycle policy module for workspace membership changes and account deletion. That is the shortest path to better architecture here; it avoids a rewrite while making permissions, privacy, and retention behavior explicit and testable.
- **Updated score rationale:** `68 / 100` because the architecture shape is still proportionate, but the deeper permission/lifecycle pass found governance gaps at exactly the boundary where collaboration, identity, and deletion semantics need to be strongest.

### Updated recommendations

1. **Fix first:** `S1-01`, `S1-02`, and `S2-10`. Stored XSS, tenant-scope leakage, and incomplete deletion/anonymization are the most important correctness and privacy failures now confirmed.
2. **Then close the lifecycle gap:** Implement symmetric WorkOS membership revocation for workspace leave/remove flows (`S2-09`) and add regression tests around those paths.
3. **Then address platform debt:** Upgrade Next.js (`S1-07`) and fix the artifact-sensitive lint gate (`O1-06`) so the repo’s baseline quality signals are trustworthy again.
4. **Architecture move with the best ROI:** Introduce a first-class lifecycle policy module rather than spreading deletion and membership rules across unrelated handlers.
5. **Performance path without re-engineering:** After the security/lifecycle fixes, keep shrinking the snapshot hot path by replacing the worst `collect()` calls with indexed, scope-aware query helpers.

---

## Turn 3 - 2026-04-16 20:40:35 BST

| Field | Value |
|-------|-------|
| **Commit** | `b1419ff` |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** This turn widened the audit back across the whole backend shape: data modeling, schema/index design, HTTP route semantics, and how narrow operations flow through the API boundary into Convex. The repo’s modular-monolith structure is still the right shape, but the backend contract is looser than it should be. The main pattern is drift between what the schema indexes, what the application actually queries, and what the route layer pretends errors and commands mean. That drift is why the codebase keeps falling back to broad snapshots, `collect()` scans, and catch-all `500` responses even when the domain logic itself is often reasonable.

**Health rating:** Needs attention

**Architecture score:** `65 / 100`

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 2 |
| Medium | 1 |
| Low | 0 |

### Turn focus

- Re-assess data model quality and query/index alignment
- Review API route semantics and HTTP error/status behavior
- Look for command-surface drift between route handlers and Convex mutations
- Use `architecture-standards` to judge whether the backend shape can be improved without re-engineering

### New findings

#### A3-11 [ARCHITECTURE] High - `convex/schema.ts:51-74`, `convex/app/auth_bootstrap.ts:367-499`, `convex/app/document_handlers.ts:315-329`, `convex/app/work_item_handlers.ts:338-341` - Core tables are indexed around identity lookup, but the app reads them by scope and target, so the schema is forcing broad scans across the repo

**What's happening:**
Several high-churn tables only expose `by_domain_id` or similarly narrow indexes even though the application reads them by workspace, team, scope, target, or project. Examples:
- `projects`, `milestones`, `documents`, `views`, `comments`, and `projectUpdates` are not indexed for the shapes most often used in snapshot assembly or cleanup.
- `getSnapshotHandler` therefore collects and filters projects, documents, views, comments, attachments, invites, project updates, calls, chat messages, posts, and post comments in memory.
- Delete flows for documents and work items repeat the same pattern by collecting comments, attachments, notifications, and documents before filtering them locally.

**Root cause:**
The schema was designed around record identity first and access/query shape second. As the product added workspace/team views, collaboration, and cleanup behavior, the query layer adapted by scanning and filtering instead of the schema evolving with it.

**Codebase implication:**
This is broader than the existing snapshot hot-path note. It means the query style is structurally biased toward `collect()` everywhere, which keeps performance debt high and makes access rules harder to localize and reason about. New features are likely to repeat the same pattern unless the schema changes.

**Solution options:**
1. **Quick fix:** Add the highest-value missing indexes first, such as project-by-scope, document-by-workspace/team, view-by-scope, comment-by-target, and project-update-by-project.
2. **Proper fix:** Create scope-aware query helpers per aggregate so route handlers and mutations stop hand-rolling `collect()` plus filter logic.
3. **Strategic fix:** Treat scope and access shape as first-class schema design inputs. The modular-monolith can stay; the data layer needs to encode how the app actually works.

**Investigate:**
Measure which collections dominate production row counts and prioritize indexes on the top three most expensive read and cleanup paths before doing a wider migration.

#### A3-12 [ARCHITECTURE] High - `lib/server/provider-errors.ts:19-20`, `app/api/teams/[teamId]/members/[userId]/route.ts:62-67`, `app/api/projects/[projectId]/route.ts:62-67`, `app/api/documents/[documentId]/route.ts:60-65`, `app/api/documents/[documentId]/route.ts:96-100` - The route layer collapses most domain failures into HTTP 500s, so the API contract is systematically lying about validation, authorization, and not-found outcomes

**What's happening:**
`getConvexErrorMessage` extracts only a string. Most route handlers then catch any Convex/domain failure and return that message with status `500`. In this repo, `47` `route.ts` files follow that pattern. That means “Only team admins can manage team members”, “Document not found”, or “Your current role is read-only” can all be surfaced as internal server errors instead of `403`, `404`, or `400`.

**Root cause:**
The backend has message propagation but not typed application errors. The route layer knows the text of the failure but not its semantic class.

**Codebase implication:**
Clients cannot reliably distinguish bad input, missing resources, forbidden actions, and actual server faults. That hurts retry behavior, UX, API predictability, and operational visibility because monitoring gets polluted with expected domain failures.

**Solution options:**
1. **Quick fix:** Introduce a small typed error contract for Convex-to-route failures with at least `status`, `code`, and `message`.
2. **Proper fix:** Standardize route wrappers so validation, auth, not-found, and conflict failures are mapped consistently across all API handlers.
3. **Strategic fix:** Treat HTTP status mapping as part of backend governance, with tests for representative route classes instead of ad hoc catches.

**Investigate:**
Sample client behavior for operations like document delete, team-member update, and workspace leave to confirm which flows currently mis-handle retriable vs non-retriable failures because everything looks like a `500`.

#### A3-13 [ARCHITECTURE] Medium - `app/api/teams/[teamId]/join-code/route.ts:3-55`, `lib/server/convex/teams-projects.ts:154-163`, `app/api/chats/[chatId]/calls/route.ts:10-138`, `lib/server/convex/collaboration.ts:98-107`, `convex/app.ts:919-927` - The API surface has started to drift from the command surface, so narrow actions are going through snapshots or broad commands instead of dedicated mutations

**What's happening:**
- The team join-code route fetches the full snapshot and then calls `updateTeamDetailsServer` with copied team fields, even though a dedicated `regenerateTeamJoinCodeServer` mutation already exists.
- The chat-call route fetches the full snapshot for lookup/authorization and then sends a plain chat message containing a join link, even though a dedicated `startChatCallServer` / `startChatCall` mutation exists in the backend command surface.

**Root cause:**
Route handlers are solving user-facing actions opportunistically instead of treating the Convex command/query surface as the authoritative application API.

**Codebase implication:**
This creates hidden coupling, duplicated authorization logic, and long-term overwrite risk. The join-code flow is especially brittle because a single narrow action is currently implemented as “read a broad snapshot, then re-submit a wider command payload.”

**Solution options:**
1. **Quick fix:** Make routes call dedicated mutation helpers when they exist, starting with join-code regeneration and chat-call start.
2. **Proper fix:** Audit `app/api` against `lib/server/convex` and remove any route logic that reconstructs write payloads from snapshot state for narrow commands.
3. **Strategic fix:** Define the Convex server helpers as the application command/query contract and keep routes as thin HTTP adapters only.

**Investigate:**
Check whether the current chat-call route behavior is intentionally replacing structured call records or whether the dedicated call mutation has simply fallen out of use.

### Architecture standards reassessment

- **What is good:** The repo still looks like a modular monolith, not a random pile of framework code. Route files are mostly thin, domain writes still live in Convex, and there is a credible place to improve this without changing the deployment model.
- **What is weak:** The architecture is not strict enough at the boundaries. Data ownership, query shape, HTTP semantics, and application command surfaces are not yet treated as governed contracts.
- **What matters most:** The biggest backend improvement is not “more layers.” It is getting the existing layers to tell the truth: schema indexes should match access patterns, route statuses should match domain outcomes, and routes should call the right commands instead of synthesizing them from snapshots.
- **Updated score rationale:** `65 / 100` because the system shape is still proportionate, but the broader backend review found that the current data/API contracts are looser and less reliable than the high-level module structure suggests.

### Updated recommendations

1. **Fix the backend contracts after the security/privacy work:** Add typed application errors and stop returning generic `500`s for expected domain failures.
2. **Treat indexes as architecture, not optimization:** Add missing scope/target indexes and move hot query logic behind dedicated helpers.
3. **Tighten the command surface:** Make every narrow route action call a narrow Convex command; do not rebuild write payloads from snapshots.
4. **Keep the modular monolith:** None of these issues justify services or a rewrite. The right move is stricter contracts inside the current shape.
5. **Add tests where the contract matters:** Cover status-code mapping, join-code regeneration, lifecycle deletion/anonymization, and the highest-value scoped queries.
