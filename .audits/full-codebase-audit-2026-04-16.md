# Audit: Full Codebase Audit

## Project context

| Field | Value |
|-------|-------|
| **Repository** | `Linear` |
| **Remote** | `https://github.com/declancowen/Linear.git` |
| **Branch** | `main` |
| **Commit** | `249311a` |
| **Date** | `2026-04-17 09:39:43 BST` |
| **Repo type** | `single repo` |
| **Stack** | `Next.js 16 / React 19 / Convex / WorkOS / Zustand / Electron / TypeScript` |
| **OS** | `Darwin 25.4.0 arm64` |
| **Node** | `v25.8.0` |
| **pnpm** | `10.32.0` |
| **Codebase size** | `~337 source files / ~69.1k LOC across app, components, convex, lib, electron, scripts, and tests` |

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
| **Last audited** | `2026-04-17 11:35:00 BST` |
| **Total turns** | `11` |
| **Open findings** | `5` |
| **Resolved findings** | `15` |
| **Accepted findings** | `0` |

## Findings summary

| Severity | Open | Resolved | Accepted |
|----------|------|----------|----------|
| Critical | 0 | 1 | 0 |
| High | 1 | 9 | 0 |
| Medium | 4 | 5 | 0 |
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

---

## Turn 4 - 2026-04-17 09:39:43 BST

| Field | Value |
|-------|-------|
| **Commit** | `249311a` |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** This turn re-audited the merged `main` branch after the major architecture and lifecycle hardening landed. The merged state closes the original security, ownership, lifecycle, route-semantics, and dependency findings from Turns 1-3: rich text is sanitized, labels are tenant-scoped, lifecycle policy is centralized, typed application errors are in place, the framework vulnerability is gone, and the repo gate now passes end to end on `main`. The remaining gaps are narrower and deeper: one legacy call-join flow still violates the target command/read model, outbound email and provider side effects still lack a durable outbox/job contract, and the repo’s CI/ops governance still does not fully enforce the target-state standard.

**Health rating:** Strong with targeted follow-up

**Architecture score:** `94 / 100`

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 2 |
| Medium | 2 |
| Low | 0 |

### Turn focus

- Re-audit merged `main` after the architecture refactor and lifecycle work landed
- Inspect under-audited layers: scripts, background jobs, operational seams, desktop shell, and CI governance
- Re-run the repo verification gate on current `main`

### Resolved since Turn 3

The merged `main` branch materially closes the original `13` findings from Turns 1-3:

- `S1-01`: rich-text content now crosses a canonical sanitize-on-write and safe-render boundary
- `S1-02`: labels are explicitly workspace-scoped and validated at the write boundary
- `S1-03`: browser hardening is codified through repo-owned security headers
- `O1-04`: the worst snapshot/bootstrap whole-table reads were replaced with scope-aware indexed helpers
- `O1-05`: workspace search now runs through a bounded derived model with dedicated tests
- `O1-06`: the lint gate no longer breaks on `.vercel` artifacts
- `S1-07`: `next` and `eslint-config-next` were upgraded to patched versions
- `O1-08`: the repo now has meaningful contract, server, security, and search regression coverage
- `S2-09`: workspace membership removal is reconciled at the WorkOS boundary
- `S2-10`: account deletion now follows a governed privacy/anonymization policy
- `A3-11`: schema ownership and index shape are materially closer to actual access/query patterns
- `A3-12`: routes now preserve typed domain failures instead of flattening them into generic `500`s
- `A3-13`: the earlier narrow-command drift examples were corrected

### New findings

#### A4-14 [ARCHITECTURE] High - `app/api/calls/join/route.ts:102-339`, `lib/server/100ms.ts:185-247` - The call-join flow is still a state-changing GET backed by the full snapshot and a non-idempotent provider side effect

**What's happening:**
`GET /api/calls/join` is still orchestrating a narrow action by loading the full snapshot, finding the target call/conversation in memory, and then performing mutations and external work before redirecting. In the same request it can:

- read the full snapshot for authorization and entity lookup
- create a 100ms room when `roomId` is missing
- persist `roomId` / `roomName`
- mark the call as joined
- redirect the browser to the provider join URL

Because room creation happens before the room identifiers are persisted, concurrent joins on the same call/conversation can race and create multiple provider rooms for one logical conversation.

**Root cause:**
The join flow remains a route-centric legacy path instead of being modeled as a narrow application command with idempotent room provisioning semantics.

**Codebase implication:**
This is the strongest remaining contract violation in the repo:

- safe HTTP semantics are broken because a `GET` performs writes and external side effects
- a narrow action still depends on the broad snapshot read model
- room provisioning is not structurally idempotent

**Solution options:**
1. **Quick fix:** Move room provisioning and join bookkeeping behind a single narrow server helper that authorizes by indexed lookup rather than by snapshot.
2. **Proper fix:** Replace the stateful `GET` flow with an explicit command that claims or resolves one canonical room once, then returns a join URL or redirect token.
3. **Strategic fix:** Treat provider room provisioning as a first-class application contract with idempotency keys / claim semantics, not as opportunistic route work.

**Investigate:**
Decide whether browser UX really requires a mutating `GET`, or whether the route can become a pure redirect over a previously prepared join contract.

#### A4-15 [ARCHITECTURE] High - `scripts/send-notification-digests.mjs:224-256`, `lib/server/email.ts:524-695`, `app/api/invites/route.ts:44-74`, `app/api/comments/route.ts:52-63`, `app/api/account/route.ts:106-121` - External email side effects still bypass a durable outbox/job contract

**What's happening:**
The repo now handles primary data integrity well, but outbound email and related provider work still run as best-effort side effects:

- request handlers create app state, then send invite/mention/access-change emails inline
- failures are caught and logged, but there is no durable retry queue or operator-visible claim state
- the digest script queries pending notifications, sends emails, and only then marks them emailed

That means two overlapping digest runs can both observe the same pending notifications and send duplicates before either marks them complete.

**Root cause:**
External side effects are still modeled as inline route/script work instead of as outbox-backed jobs with claim, retry, and replay semantics.

**Codebase implication:**
This is the main remaining operational-architecture gap:

- request latency is still coupled to email/provider latency on several flows
- failures are mostly log-only, not durable work items
- background digest delivery is not claim-safe under concurrency

**Solution options:**
1. **Quick fix:** Add a claim/lease mutation for notification digests so one runner owns a batch before send.
2. **Proper fix:** Introduce an outbox table and dispatcher for invite, mention, access-change, and digest emails.
3. **Strategic fix:** Move all external side effects onto a governed job contract with idempotency keys, replay, and operator-visible failure state.

**Investigate:**
Decide which side effects must be exactly-once vs at-least-once, and align the outbox/job model with that policy explicitly.

#### O4-16 [OBSERVATION] Medium - `.github/workflows/ci.yml:1-24`, `package.json:12-24`, `vitest.config.ts:5-17` - CI is green, but it still does not enforce generated-contract freshness or the target-state verification standard

**What's happening:**
The current CI workflow is materially better than before and the main repo gate passes, but the automation contract is still lighter than the target architecture expects:

- CI only runs `pnpm check`
- generated Convex bindings are not re-generated and asserted clean in CI
- there are no coverage thresholds or failure budgets in Vitest config
- dependency audit policy exists as a manual script, not an enforced CI step

**Root cause:**
The repo’s architecture and contract quality improved faster than the verification policy did.

**Codebase implication:**
The codebase is now operating at a higher standard than CI is explicitly enforcing. That creates governance slack: generated-contract drift, test-shape regressions, or budget erosion can re-enter unless humans keep catching them.

**Solution options:**
1. **Quick fix:** Add `pnpm convex:codegen` plus a clean-working-tree assertion to CI.
2. **Proper fix:** Add coverage thresholds and elevate the existing performance/security checks to explicit CI policy where they are stable enough not to create noise.
3. **Strategic fix:** Treat CI as the executable architecture standard, not just a source-build gate.

**Investigate:**
Define the minimum architecture gate you want to enforce continuously: generated contract freshness, coverage floors, performance budgets, dependency audit severity, and desktop smoke scope.

#### O4-17 [OBSERVATION] Medium - `.github/workflows/ci.yml:1-24`, `package.json:14-19`, `package.json:23-24` - Repo-owned operational entrypoints still depend on out-of-band scheduling and verification

**What's happening:**
The repo now owns several operational entrypoints directly:

- `notifications:send-digests`
- `sync:workos:workspaces`
- `maintenance:backfill-lookups`
- `desktop:start`

But the repo itself still does not own their execution policy:

- there is no repo-owned scheduled workflow or equivalent job definition for the digest/sync paths
- desktop startup is part of the supported deployment shape, but CI never exercises `desktop:start`
- mutating scripts rely on local runtime env configuration and manual invocation discipline

**Root cause:**
These paths are still treated as local helper scripts instead of first-class operational surfaces with repo-governed runbooks and verification.

**Codebase implication:**
This is not a source-code correctness bug, but it is a target-state architecture gap. Important operational behavior still depends on implicit human process or external scheduler setup that the repo does not describe or verify strongly enough.

**Solution options:**
1. **Quick fix:** Add documented runbooks and ownership for digest delivery, WorkOS workspace sync, and maintenance scripts.
2. **Proper fix:** Put scheduled jobs and desktop smoke checks under repo-owned automation where feasible.
3. **Strategic fix:** Treat operational entrypoints as part of the deployable product surface, with explicit schedule, environment, dry-run, and rollback expectations.

**Investigate:**
Decide which operational behaviors should be repo-owned versus platform-owned, and record that ownership explicitly.

### Architecture standards reassessment

- **What is now strong:** The repo has reached a credible governed modular-monolith shape. Tenancy, lifecycle, content security, typed errors, compatibility rules, and the main query/index boundaries are all materially stronger than the original audit state.
- **What is still weak:** The remaining debt is mostly in operational architecture and a few legacy edge flows, not in the core domain shape.
- **What matters most now:** The next gains are not another broad refactor. They are: removing the last snapshot-backed action flow, putting provider side effects behind a durable job contract, and making CI/ops enforce the standard the code now mostly meets.
- **Updated score rationale:** `94 / 100` because the merged `main` branch now clears the original architecture-remediation bar, but the remaining gaps are still real enough that I would not call the repo fully target-state yet.

### Verification

- `pnpm install --frozen-lockfile`: passed
- `pnpm check`: passed
- `pnpm convex:codegen`: passed and left a clean working tree
- `pnpm audit --audit-level high`: passed the high-severity gate; `1` moderate vulnerability remains

### Updated recommendations

1. **Fix first:** replace the stateful snapshot-backed call join flow with a narrow, idempotent join contract.
2. **Then fix the operational contract:** introduce an outbox / claimed-job model for outbound emails and notification digests.
3. **Then tighten governance:** make CI enforce Convex codegen freshness and add explicit coverage / budget policy for the critical suites that now exist.
4. **Then repo-own the remaining ops surfaces:** document or automate digest scheduling, WorkOS sync ownership, maintenance invocation, and desktop smoke expectations.
5. **Do not re-open broad architecture work:** the current gaps are narrower than the old ones. The right move is targeted operational hardening, not another large structural refactor.

---

## Turn 5 - 2026-04-17 09:53:26 BST

| Field | Value |
|-------|-------|
| **Commit** | `249311a` |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** This turn re-opened one structural question that the earlier merged-main pass had treated too optimistically: the backend snapshot path is much healthier than before, but the frontend/backend contract is still fundamentally organized around a large shared snapshot. The repo has removed the worst scan-heavy implementation debt, but it has not yet completed the target-state read-model refactor described in the architecture standard. That means the remaining architecture work is not just edge-flow cleanup and ops hardening; one meaningful read-model refactor stream is still open.

**Health rating:** Needs attention

**Architecture score:** `94 / 100`

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 1 |
| Medium | 0 |
| Low | 0 |

### Turn focus

- Re-check whether the merged `main` branch actually retired the monolithic snapshot contract
- Compare the current implementation against the target-state architecture and roadmap promises for read-model decomposition
- Separate “hot path fixed” from “architectural shape replaced”

### New findings

#### A5-18 [ARCHITECTURE] High - `components/providers/convex-app-provider.tsx:38-40`, `:133-152`, `:227-251`, `app/api/snapshot/route.ts:39-45`, `lib/store/app-store-internal/runtime.ts:22-25`, `lib/store/app-store-internal/slices/workspace.ts:181-184` - The client contract is still fundamentally snapshot-first, so the read-model refactor is only partially complete

**What's happening:**
The merged repo no longer has the old scan-heavy version of the snapshot path, but the shell is still architected around one broad app snapshot:

- the provider bootstraps through `fetchSnapshotState()`
- `/api/snapshot` still returns the full visible app graph
- `/api/snapshot/events` still drives client refresh through version notifications
- client store code still replaces large sections of domain state through `replaceDomainData(snapshot)`

That means the system is still relying on “one large shared graph snapshot” as the default frontend/backend read contract, even though the backend internals underneath that contract are now much cleaner.

**Root cause:**
The refactor completed the data-access hardening phase but stopped short of decomposing the read model into bounded shell bootstrap plus capability-scoped reads.

**Codebase implication:**
This is the biggest remaining structural refactor item:

- the shell contract is still broader than the target-state architecture intends
- large parts of the store are still synchronized by whole-graph replacement semantics
- future performance and product-surface growth remain coupled to the size and churn of the shared snapshot

It also explains why the repo is stronger than it was, but not yet fully at the intended `95+` target-state shape.

**Solution options:**
1. **Quick fix:** shrink the shell snapshot to a bounded bootstrap surface and stop using it for capability data that can read independently.
2. **Proper fix:** move work, docs, chat, notifications, and search onto stable scoped read models behind the existing selectors/gateways.
3. **Strategic fix:** treat the shell snapshot as a compatibility/bootstrap artifact only, then retire `replaceDomainData(snapshot)` as the primary app sync model.

**Investigate:**
Start with the highest-churn/highest-volume surfaces first: notifications, chat/channel feeds, work lists, document lists, and search. The call-join flow in `app/api/calls/join/route.ts` remains the clearest narrow-action example that should stop depending on the snapshot altogether.

### Architecture standards reassessment

- **What is now strong:** the backend query/index model and domain contract are materially better than the old snapshot-heavy implementation state.
- **What is still weak:** the frontend/store contract still assumes a large shared snapshot instead of capability-scoped reads.
- **What matters most now:** the next structural gain is read-model decomposition, not another broad backend rewrite.
- **Updated score rationale:** `94 / 100` remains reasonable because the repo is materially healthier than before, but the read-model target state is still incomplete in an important way.

### Updated recommendations

1. **Add to the top of the list:** decompose the snapshot contract into a bounded shell bootstrap plus scoped capability reads.
2. **Then fix:** replace the stateful snapshot-backed call join flow with a narrow, idempotent join contract.
3. **Then fix the operational contract:** introduce an outbox / claimed-job model for outbound emails and notification digests.
4. **Then tighten governance:** make CI enforce Convex codegen freshness and add explicit coverage / budget policy for the critical suites that now exist.
5. **Then repo-own the remaining ops surfaces:** document or automate digest scheduling, WorkOS sync ownership, maintenance invocation, and desktop smoke expectations.

---

## Turn 6 - 2026-04-17 10:08:36 BST

| Field | Value |
|-------|-------|
| **Commit** | `249311a` |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** This turn deep-dived the streams that were still only broadly described: deployment/migration choreography, privileged operational scripts, observability/recovery, auth/provider boundary hygiene, test architecture, and desktop runtime governance. The result is narrower than another broad repo sweep, but two real gaps did emerge: desktop is now a declared mandatory runtime without a repo-governed packaging/update path, and the auth edge still logs raw WorkOS errors in a few places instead of using sanitized provider diagnostics.

**Health rating:** Needs attention

**Architecture score:** `93 / 100`

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 2 |
| Low | 0 |

### Turn focus

- Inspect deployment and migration governance beyond the core source tree
- Re-audit scripts, desktop runtime, auth/provider boundary, observability, and test shape for remaining architectural gaps
- Separate already-covered operational concerns from newly material findings

### New findings

#### A6-19 [ARCHITECTURE] Medium - `package.json:18-19`, `electron/main.mjs:127-205`, `README.md:141-167`, `.github/workflows/ci.yml:1-24` - Desktop is a supported runtime in practice, but the repo still has no governed packaging, signing, update, or smoke-validation contract for Electron

**What's happening:**
The repo clearly treats desktop as a real supported surface:

- `package.json` exposes `desktop:dev` and `desktop:start`
- `electron/main.mjs` boots and manages the packaged runtime
- the README documents how contributors should run the Electron shell

But the repo does not yet contain the release architecture that would make that runtime trustworthy:

- no Electron Forge / electron-builder packaging config
- no code-signing or notarization material
- no updater/release configuration
- no desktop smoke job in CI or release automation

Right now desktop is governed as a local launch mode, not as a release lane.

**Root cause:**
The Electron shell was introduced as a runtime wrapper before packaging, release, and verification ownership were codified in the repo.

**Codebase implication:**
If desktop is now considered mandatory, this is a real architecture gap:

- release readiness is not repo-governed
- startup or packaged-runtime regressions will be caught manually
- the update/distribution contract is still undefined in source control

**Solution options:**
1. **Quick fix:** Add a documented desktop release runbook plus a smoke check for `pnpm desktop:start` and packaged startup.
2. **Proper fix:** Add governed packaging/signing/update configuration and make desktop release validation part of CI or release automation.
3. **Strategic fix:** Treat desktop as a first-class runtime lane with owned update policy, platform release contracts, and smoke validation before release.

**Investigate:**
Decide whether desktop release ownership lives fully in the repo or partly in external platform automation, then document that boundary explicitly.

#### S6-20 [SECURITY] Medium - `app/auth/signup/route.ts:176`, `:239`, `app/auth/forgot-password/route.ts:57`, `lib/server/workos.ts:34-83` - The auth edge still logs raw WorkOS error objects instead of sanitized diagnostics, which can expose provider payload details in logs

**What's happening:**
Most route and provider boundaries now log sanitized diagnostics through `logProviderError`, but a few auth routes still do direct `console.error(..., error)` on raw WorkOS errors:

- signup account creation failure
- signup immediate authentication failure
- forgot-password reset request failure

At the same time, the WorkOS helper layer explicitly knows that provider errors can contain fields like `pendingAuthenticationToken`, `pending_authentication_token`, and user/email data in raw payloads.

**Root cause:**
These auth routes predate the provider-error hygiene work and were not moved onto the sanitized logging path.

**Codebase implication:**
This is a smaller issue than the earlier architectural gaps, but it is still real:

- provider logs are inconsistent across the repo
- temporary auth-flow payload details may leak into logs unnecessarily
- auth debugging is happening through raw provider objects rather than a governed diagnostic contract

**Solution options:**
1. **Quick fix:** Replace raw `console.error` calls in auth routes with a sanitized WorkOS/provider logger.
2. **Proper fix:** Create one auth-provider logging helper that emits the same diagnostic shape used elsewhere in the route layer.
3. **Strategic fix:** Make provider-log hygiene part of the identity-boundary architecture standard so auth routes cannot drift back to raw-object logging.

**Investigate:**
Re-check the full `app/auth/*` surface and any future widget/provider routes for raw error logging before adding more identity flows.

### Architecture standards reassessment

- **What is now strong:** the remaining codebase risk is no longer hidden in the core domain layers; it is mostly at runtime, operations, and provider boundaries.
- **What is still weak:** desktop release governance and auth/provider log hygiene lag behind the rest of the repo’s stronger boundary work.
- **What matters most now:** the primary refactor streams remain read-model, write/command, jobs/side effects, and governance, but desktop/runtime and identity-boundary hardening are now clearly mandatory supporting streams.
- **Updated score rationale:** `93 / 100` because the repo is still materially stronger than the pre-refactor state, but the mandatory-runtime and provider-boundary expectations are now clearer and not yet fully embodied.

### Updated recommendations

1. **Keep the primary streams at the top:** snapshot/read-model, write/command cleanup, side-effect/jobs, governance, and deployment/migration architecture.
2. **Promote desktop/runtime to mandatory:** define packaging, signing, update, and smoke-validation ownership for Electron.
3. **Tighten the identity edge:** move the remaining WorkOS auth routes onto sanitized provider diagnostics.
4. **Do not reopen a blind whole-repo sweep:** the remaining work is now clearly stream-shaped rather than hidden everywhere at once.

---

## Turn 7 - 2026-04-17 10:19:27 BST

| Field | Value |
|-------|-------|
| **Commit** | `249311a` |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** This turn executed the first slice of the remaining mandatory plan instead of just documenting it. The identity/provider boundary gap is now closed: the remaining auth routes no longer log raw WorkOS error objects directly, and route-level tests pin that behavior. The governance/deployment foundation also moved forward materially: CI now enforces Convex codegen freshness, and the repo owns a deployment/migration runbook for privileged scripts and smoke expectations. The remaining work is now narrower and more clearly concentrated in read-model, job/outbox, desktop release governance, and the legacy call-join flow.

**Health rating:** Good

**Architecture score:** `94 / 100`

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |

### Turn focus

- Execute Phase A of the remaining plan: provider-boundary logging hygiene
- Execute the first practical pieces of Phase B: CI codegen freshness and repo-owned deploy/runbook discipline
- Re-run targeted and full verification gates

### Resolved since Turn 6

- `S6-20`: auth routes now use sanitized provider logging instead of raw WorkOS error objects

### Partially closed since Turn 6

- `O4-16`: CI now enforces `pnpm convex:codegen` plus a clean generated-binding diff, though broader coverage/budget governance is still open
- `O4-17`: the repo now owns a deployment/migration runbook, though scheduled job ownership and desktop smoke automation are still open

### Architecture standards reassessment

- **What is now strong:** the provider boundary is more internally consistent, and the repo’s governance layer has started to enforce generated-contract hygiene rather than only documenting it.
- **What is still weak:** the biggest remaining gaps are now structural read/write/runtime issues, not auth-edge inconsistency.
- **What matters most now:** the next highest-value execution steps are the outbox/job architecture, the call-join contract cleanup, the snapshot/read-model decomposition, and Electron release-lane governance.
- **Updated score rationale:** `94 / 100` because one security/governance inconsistency is now closed and the CI/deploy foundation is stronger, but the major remaining architecture streams are still open.

### Verification

- `pnpm test -- tests/app/auth-provider-logging.test.ts tests/lib/server/workos.test.ts`: passed
- `pnpm exec eslint app/auth/signup/route.ts app/auth/forgot-password/route.ts tests/app/auth-provider-logging.test.ts --max-warnings 0`: passed
- `pnpm typecheck`: passed after clearing stale generated `.next/types/* 4.ts` duplicates
- `pnpm convex:codegen && git diff --exit-code -- convex/_generated && pnpm check`: passed

### Updated recommendations

1. **Next:** move to the side-effect/job architecture stream and make digest/email delivery claim-safe.
2. **Then:** replace the stateful snapshot-backed call-join route with a narrow idempotent command contract.
3. **Then:** complete the read-model refactor by shrinking the shell snapshot to bootstrap-only and moving capability reads off the monolithic store replacement model.
4. **Then:** finish desktop/runtime governance with packaging, signing, update, and smoke-validation ownership for Electron.

## Turn 8 - 2026-04-17 10:31:04 BST

| Field | Value |
|-------|-------|
| **Commit** | `249311a` |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** This turn executed the first meaningful slice of the side-effect/job architecture stream instead of leaving it as a planning item. Notification digest delivery is now claim-safe under overlapping runners: the backend can claim pending digest notifications, clear claims on success, and release claims on failure, and the delivery script now uses that contract. This does **not** yet amount to a full durable outbox, but it closes the immediate duplicate-send risk on the repo-owned digest path and raises the architecture floor again.

**Health rating:** Good

**Architecture score:** `95 / 100`

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |

### Turn focus

- Execute the first operationally meaningful part of Phase C: claim-safe digest delivery
- Verify the new claim/release lifecycle at the Convex boundary and script layer
- Re-run the full repo gate after the job-architecture change

### Resolved since Turn 7

- The notification digest path can no longer double-send under overlapping runners by default; digest work is now claimed, marked, and released explicitly through Convex mutations.

### Partially closed since Turn 7

- `A4-15`: digest delivery is now claim-safe, but broader outbound email side effects still lack a durable outbox / retry-visible job contract

### Architecture standards reassessment

- **What is now strong:** the repo’s scheduled digest path is no longer a naive best-effort inline script; it has an explicit concurrency contract and regression coverage.
- **What is still weak:** the broader side-effect architecture is still not a full outbox/job system, so recovery/replay/operator visibility remain incomplete for non-digest email flows.
- **What matters most now:** the next clean execution step is the call-join contract, then the read-model decomposition, then Electron release-lane governance.
- **Updated score rationale:** `95 / 100` because the biggest remaining operational gap is now narrowed from “duplicate-prone digest delivery” to “still missing a full durable outbox model.”

### Verification

- `pnpm convex:codegen`: passed
- `pnpm test -- tests/convex/notification-digest-claims.test.ts tests/app/auth-provider-logging.test.ts tests/lib/server/workos.test.ts tests/lib/server/convex-notifications.test.ts`: passed
- `pnpm exec eslint app/auth/signup/route.ts app/auth/forgot-password/route.ts convex/app.ts convex/app/collaboration_utils.ts convex/app/notification_handlers.ts convex/validators.ts scripts/send-notification-digests.mjs tests/app/auth-provider-logging.test.ts tests/convex/notification-digest-claims.test.ts --max-warnings 0`: passed
- `pnpm typecheck`: passed
- `git diff --exit-code -- convex/_generated && pnpm check`: passed

### Updated recommendations

1. **Next:** replace the state-changing snapshot-backed call-join `GET` with a narrow idempotent contract.
2. **Then:** continue the side-effect architecture from claim-safe digests to a real durable outbox / job model for outbound email.
3. **Then:** decompose the snapshot-first client/store contract into bounded bootstrap plus scoped capability reads.
4. **Then:** make Electron packaging, signing, update, and smoke validation repo-governed.

## Turn 9 - 2026-04-17 10:40:12 BST

| Field | Value |
|-------|-------|
| **Commit** | `249311a` |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** This turn executed the first serious slice of the write/command architecture stream. The call-join route no longer loads the full snapshot to authorize access, locate calls, or attach rooms. Instead it now uses a dedicated join-context query and a canonical finalize mutation, which means the route is operating on a narrow contract rather than reconstructing behavior from the monolithic snapshot. The public `GET` redirect still exists as a compatibility surface for existing links, so this is not the final end-state, but the main structural debt in that flow is now removed.

**Health rating:** Good

**Architecture score:** `96 / 100`

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |

### Turn focus

- Execute the first major slice of Phase D: replace the snapshot-backed call-join lookup path
- Introduce a dedicated narrow join-context contract at the Convex boundary
- Re-run the full repo gate after the route/Convex contract change

### Resolved since Turn 8

- The call-join route no longer depends on the full snapshot to authorize or resolve call/conversation join state.

### Partially closed since Turn 8

- `A4-14`: call join now uses a narrow query/finalize contract, but the public compatibility surface is still a stateful `GET` redirect for existing links

### Architecture standards reassessment

- **What is now strong:** a previously monolithic snapshot-backed edge flow is now aligned with the target architecture shape: narrow contract, scoped authorization, canonical persistence, and regression coverage.
- **What is still weak:** the compatibility `GET` still performs stateful work for call joins, so HTTP semantics are improved structurally but not yet idealized.
- **What matters most now:** the next highest-value work is still the broader outbox/job model, then the snapshot-first client/store decomposition, then Electron release-lane governance.
- **Updated score rationale:** `96 / 100` because the last obvious snapshot-backed route holdout is now materially decomposed, even though a compatibility shim remains.

### Verification

- `pnpm convex:codegen`: passed
- `pnpm test -- tests/app/api/call-join-route.test.ts tests/lib/server/convex-collaboration.test.ts tests/app/api/chat-call-route.test.ts`: passed
- `pnpm exec eslint app/api/calls/join/route.ts convex/app.ts convex/app/collaboration_handlers.ts lib/server/convex/collaboration.ts tests/app/api/call-join-route.test.ts tests/lib/server/convex-collaboration.test.ts --max-warnings 0`: passed
- `git diff --exit-code -- convex/_generated && pnpm check`: passed

### Updated recommendations

1. **Next:** continue the side-effect/job architecture from claim-safe digests to a real durable outbox / retry-visible job model for outbound email.
2. **Then:** decompose the snapshot-first client/store contract into bounded bootstrap plus scoped capability reads.
3. **Then:** make Electron packaging, signing, update, and smoke validation repo-governed.
4. **Later:** retire the compatibility `GET` call-join surface once link-based migration constraints are removed.

## Turn 10 - 2026-04-17 11:04:00 BST

| Field | Value |
|-------|-------|
| **Commit** | `249311a` |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** This turn completed the main repo-owned outbound email refactor instead of leaving the durable outbox as a partial mention-only pattern. Invite, mention, assignment, and access-change emails now all enqueue through the same `emailJobs` outbox and are delivered by the owned `pnpm emails:send-jobs` worker with claim, retry, release, and sent-state semantics. Request routes no longer wait on Resend for those families, and notification-linked emails now mark `emailedAt` only when the claimed job is actually sent. That closes the biggest remaining operational gap outside the read-model/snapshot architecture itself.

**Health rating:** Strong

**Architecture score:** `97 / 100`

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 1 |
| Medium | 4 |
| Low | 0 |

### Turn focus

- Generalize the durable email queue from mention-only to a multi-kind outbox
- Move remaining inline route-level email delivery onto the owned worker contract
- Re-run the full repo gate after the broader job-architecture change

### Resolved since Turn 9

- `A4-15`: the repo-owned outbound email families now run through a durable, claim-safe outbox/worker model instead of inline request-time delivery

### Architecture standards reassessment

- **What is now strong:** external email delivery is now governed through one explicit job seam instead of a mix of inline route sends and worker behavior; failure and retry state are visible in Convex rather than hidden inside request logs.
- **What is still weak:** the client/store contract is still fundamentally snapshot-first, and Electron release governance is still not fully encoded in source control.
- **What matters most now:** the next highest-value work is the read-model/snapshot decomposition, then broader governance/coverage policy, then Electron packaging/signing/update ownership.
- **Updated score rationale:** `97 / 100` because the last major repo-owned operational contract gap in outbound delivery is now closed, leaving mostly read-architecture and governance work rather than another core side-effect design weakness.

### Verification

- `pnpm convex:codegen`: passed
- `pnpm test -- tests/convex/email-job-handlers.test.ts tests/app/api/work-route-contracts.test.ts tests/app/api/asset-notification-invite-route-contracts.test.ts tests/app/api/team-collaboration-route-contracts.test.ts tests/app/api/document-workspace-route-contracts.test.ts`: passed (`35` files / `123` tests)
- `pnpm typecheck`: passed
- `pnpm exec eslint ... --max-warnings 0` on changed files: passed
- `pnpm check`: passed

## Turn 11 - 2026-04-17 11:33:20 BST

| Field | Value |
|-------|-------|
| **Commit** | `249311a` |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** This turn executed another meaningful slice of the read-architecture stream without breaking the frontend/backend contract. Team and workspace mutations now apply narrow command results locally instead of waiting for an immediate full snapshot catch-up, onboarding workspace creation no longer fetches the full snapshot inline before navigation, and several rollback paths now reconcile in the background instead of blocking the UI on a broad snapshot round-trip. The repo is still snapshot-first at the provider/bootstrap layer, so `A5-18` remains open, but the remaining gap is now much narrower and more clearly concentrated around provider bootstrap plus version-driven graph replacement.

**Health rating:** Strong

**Architecture score:** `97 / 100`

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 1 |
| Medium | 4 |
| Low | 0 |

### Turn focus

- Reduce client-side dependence on immediate full snapshot refetches after narrow commands
- Apply truthful local command results for workspace/team create/delete/leave flows
- Re-run the full repo gate after the store/runtime reconciliation changes

### Progress since Turn 10

- create-team now returns enough contract data for the store to append the new team and admin membership immediately
- team delete/leave and workspace delete/leave now prune local state directly instead of waiting for the next snapshot event
- onboarding workspace creation now reloads into a fresh shell bootstrap rather than fetching the full snapshot inline before navigation
- several failure paths now roll back locally and reconcile in the background instead of blocking the user on an awaited full snapshot fetch

### Architecture standards reassessment

- **What is now strong:** narrow command flows increasingly tell the truth in both directions: the route contract returns enough data to patch local state, and the store no longer needs to reflexively refetch the entire graph after each success path.
- **What is still weak:** the provider/bootstrap contract still loads and reapplies the broad snapshot as the default read/sync model, so the final read-model decomposition is still the main structural gap.
- **What matters most now:** the remaining architecture work is concentrated in three areas: bounded bootstrap/scoped reads, retirement of the compatibility call-join `GET`, and repo-owned governance for privileged jobs plus Electron release/update ownership.
- **Updated score rationale:** `97 / 100` still fits because the client/store contract is materially less coupled to whole-snapshot reconciliation than it was at Turn 10, but the target-state read architecture is not complete until provider/bootstrap stops depending on the monolithic snapshot by default.

### Verification

- `pnpm test -- tests/lib/store/domain-updates.test.ts tests/app/api/team-collaboration-route-contracts.test.ts tests/lib/convex/client-contracts.test.ts`: passed (`36` files / `127` tests)
- `pnpm audit:deps`: passed (`1` moderate advisory remains below the enforced threshold)
- `pnpm typecheck`: passed
- `pnpm exec eslint lib/store/app-store-internal/domain-updates.ts lib/store/app-store-internal/slices/workspace.ts components/app/onboarding-workspace-form.tsx app/api/teams/route.ts lib/convex/client/contracts.ts tests/lib/store/domain-updates.test.ts tests/app/api/team-collaboration-route-contracts.test.ts tests/lib/convex/route-contract-fixtures.ts --max-warnings 0`: passed
- `pnpm exec eslint lib/store/app-store-internal/runtime.ts lib/store/app-store-internal/slices/work-item-actions.ts lib/store/app-store-internal/slices/workspace.ts electron/main.mjs electron/preload.mjs scripts/desktop-smoke.mjs --max-warnings 0`: passed
- `pnpm check`: passed

### Updated recommendations

1. **Next:** finish the read-model stream at the provider/bootstrap seam by shrinking the shell snapshot and moving high-churn capability data behind scoped reads.
2. **Then:** retire the compatibility `GET` call-join surface once link-based migration constraints are gone.
3. **Then:** make CI and governance enforce broader coverage, dependency, and performance-budget policy instead of only codegen freshness and repo checks.
4. **Then:** turn Electron into a real release lane with packaging, signing, update, and release ownership instead of only a packaged-runtime smoke baseline.

### Updated recommendations

1. **Next:** move to the read architecture stream and start shrinking the snapshot-first client/store contract instead of continuing to optimize around it.
2. **Then:** tighten CI/test-governance expectations so the stronger architecture is continuously enforced.
3. **Then:** finish Electron packaging/signing/update ownership so desktop reaches the same governed standard as the web/runtime boundary.
