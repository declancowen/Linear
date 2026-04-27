---
title: Realtime Collaboration and Scoped Synchronization Architecture
scope: realtime-collaboration-scoped-sync
status: implementation-ready
repo_root: /Users/declancowen/Documents/GitHub/Linear
change_class: platform
risk_level: high
owner: app/runtime
reviewers: app/runtime
approvers: app/runtime
implementation_owner: app/runtime
operations_owner: app/runtime
last_updated: 2026-04-22
---

# Task Plan: Realtime Collaboration and Scoped Synchronization Architecture

## Source Artifacts
- `.spec/realtime-collaboration-scoped-sync/design.md`
- `.spec/realtime-collaboration-scoped-sync/requirements.md`

## Gating Status
- `Ready for implementation`
- `Implementation in progress`
- Completed lanes: foundation contracts, scoped version ownership, PartyKit/Yjs service and app bridge, collaborative document/work-item editor migration, scoped invalidation transport, shell/admin breakup, work index/saved-view breakup, document/project migration, inbox/chat/channel breakup, search seed and utility breakup, bounded `/api/snapshot` clamp, and rollout telemetry/runbook coverage
- Outstanding lanes: fallback and rollback validation closure
- Blocking design decisions:
  - None.

## Sequencing Notes
- The work is ordered to establish app-owned contracts and migration-safe boundaries before touching editor screens or the global provider path.
- Collaboration and scoped sync are separate lanes, but the shared foundation is scope ownership and app-controlled contracts.
- Rollback safety depends on preserving the existing document PATCH path and legacy snapshot path until migrated surfaces are proven.

## Blocking Work
- None.

## Tasks

- [x] 1. Foundation: scope ownership, contracts, and migration-safe boundaries
  - [x] 1.1 Add shared collaboration contracts, room naming, and provider adapter boundaries
    - Depends on: none
    - Likely areas: `lib/collaboration/**`, `components/app/rich-text-editor.tsx`, `components/app/screens/document-detail-screen.tsx`, `components/app/screens/work-item-detail-screen.tsx`
    - Validation: unit coverage for room IDs, awareness payload shaping, token claim parsing, and adapter contract tests
    - Exit criteria: screen code can consume collaboration through app-owned abstractions without importing PartyKit-specific APIs directly
    - Rollback impact: none; additive contract layer
    - Blocking unknowns: none
    - _Requirements: REQ-FUNC-001, REQ-SEC-001, REQ-SEC-002_
  - [x] 1.2 Introduce scoped version ownership for read models
    - Depends on: none
    - Likely areas: `convex/schema.ts`, `convex/app.ts`, `convex/app/**/*.ts`, `lib/domain/**`, `lib/application/**`
    - Validation: integration tests for scoped version bump helpers and no-regression tests around `operationalMutation`
    - Exit criteria: the repo can bump capability-specific invalidation keys without relying solely on `appConfig.snapshotVersion`
    - Rollback impact: low; legacy global snapshot version can continue in parallel
    - Blocking unknowns: none
    - _Requirements: REQ-FUNC-004, REQ-FUNC-005, REQ-NFR-002_

- [x] 2. Collaboration backend and internal app bridge
  - [x] 2.1 Add PartyKit service code to the repo with Yjs-backed room lifecycle
    - Depends on: 1.1
    - Likely areas: `partykit/**` or `services/realtime/**`, `package.json`, shared `lib/collaboration/**`
    - Validation: service-level integration tests for join, awareness, rehydrate, flush scheduling, and tombstone handling, plus performance verification against warm-join and cold-rehydrate targets
    - Exit criteria: one repository-owned PartyKit service can host `doc:<documentId>` rooms for collaborative rich-text sessions
    - Rollback impact: low; service can remain undeployed or unused while legacy paths continue
    - Blocking unknowns: none
    - _Requirements: REQ-FUNC-001, REQ-FUNC-002, REQ-FUNC-003, REQ-NFR-001_
  - [x] 2.2 Add app-controlled collaboration token, bootstrap, and persist endpoints
    - Depends on: 1.1, 2.1
    - Likely areas: `app/api/collaboration/**`, `app/api/internal/collaboration/**`, `lib/server/route-auth.ts`, `lib/server/convex/documents.ts`, `tests/app/api/**`, `tests/lib/server/**`
    - Validation: route contract tests, security tests for internal credential enforcement, integration tests for persisted content correctness
    - Exit criteria: PartyKit can bootstrap canonical document content and persist through app-owned boundaries without direct browser bypass
    - Rollback impact: moderate; internal endpoints can be disabled while legacy PATCH persistence remains
    - Blocking unknowns: none
    - _Requirements: REQ-FUNC-003, REQ-DATA-001, REQ-SEC-001, REQ-SEC-002_

- [x] 3. Collaborative editor surfaces
  - [x] 3.1 Add collaboration mode to `RichTextEditor`
    - Depends on: 1.1, 2.1, 2.2
    - Likely areas: `components/app/rich-text-editor.tsx`, `components/app/rich-text-editor/**`, `tests/components/**`
    - Validation: component tests covering local mode, collaboration mode, mention count updates, formatting controls, slash commands, upload hooks, and degradation when collaboration is unavailable
    - Exit criteria: `RichTextEditor` supports collaboration mode without regressing existing non-collab consumers or current editor capabilities
    - Rollback impact: low; screens can continue using local-only mode
    - Blocking unknowns: none
    - _Requirements: REQ-FUNC-001, REQ-FUNC-002, REQ-FUNC-005, REQ-FUNC-006_
  - [x] 3.2 Migrate standalone document editing to collaborative sessions
    - Depends on: 3.1
    - Likely areas: `components/app/screens/document-detail-screen.tsx`, `lib/store/app-store-internal/slices/work-document-actions.ts`, `lib/convex/client/core.ts`, `tests/components/document-detail-screen.test.tsx`
    - Validation: multi-user integration coverage, screen tests for presence/leave/tombstone behavior, mention-send flush verification, canonical-content compatibility checks against existing document consumers, and parity checks for title/editing/upload flows
    - Exit criteria: document detail uses collaboration mode for editing and awareness while preserving delete, title update, mention behavior, and current editor capabilities
    - Rollback impact: moderate; revert the screen to queued PATCH writes and legacy presence if needed
    - Blocking unknowns: none
    - _Requirements: REQ-FUNC-001, REQ-FUNC-002, REQ-FUNC-003, REQ-DATA-001, REQ-FUNC-005, REQ-FUNC-006, REQ-NFR-001_
  - [x] 3.3 Migrate work item description editing to the same collaboration capability
    - Depends on: 3.1
    - Likely areas: `components/app/screens/work-item-detail-screen.tsx`, `lib/store/app-store-internal/slices/work-document-actions.ts`, `tests/components/work-item-detail-screen.test.tsx`
    - Validation: multi-user integration coverage and regression tests for edit-only presence removal, draft save behavior, mention retry flows, canonical-content compatibility checks for work-item-backed document content, and parity checks for editor capabilities used on that surface
    - Exit criteria: work item description editing uses the same collaborative-document path as standalone documents while preserving current editor capabilities
    - Rollback impact: moderate; revert the work item description surface to current local edit flow if needed
    - Blocking unknowns: none
    - _Requirements: REQ-FUNC-001, REQ-FUNC-002, REQ-FUNC-003, REQ-DATA-001, REQ-FUNC-005, REQ-FUNC-006, REQ-NFR-001_

- [x] 4. Scoped synchronization and snapshot breakup
  - [x] 4.1 Add scoped invalidation `SSE` endpoint and client subscription layer
    - Depends on: 1.2
    - Likely areas: `app/api/snapshot/events/route.ts`, new `app/api/events/scoped/route.ts`, `lib/convex/client/core.ts`, `components/providers/convex-app-provider.tsx`, `lib/browser/snapshot-diagnostics.ts`
    - Validation: route contract tests, client subscription tests, reconnect/recovery tests, and scoped invalidation lag measurement against target
    - Exit criteria: the client can subscribe to scoped invalidation envelopes without depending on one global version event
    - Rollback impact: low; legacy `/api/snapshot/events` path can remain active
    - Blocking unknowns: none
    - _Requirements: REQ-FUNC-004, REQ-FUNC-005, REQ-NFR-002, REQ-OPS-001_
  - [x] 4.2 Carve shell, workspace membership, invite, and admin/settings surfaces off the monolithic snapshot path
    - Depends on: 4.1
    - Likely areas: `components/providers/convex-app-provider.tsx`, `app/(workspace)/layout.tsx`, workspace/team settings screens, invites screens, `lib/store/app-store-internal/runtime.ts`, related route/client contracts
    - Validation: integration tests for bounded shell bootstrap and scoped refetch on workspace/team membership and admin surfaces, plus compatibility tests for settings/invite flows and explicit coverage of `workspaces`, `teams`, membership rows, users, invites, and shell UI context
    - Exit criteria: shell/bootstrap stays bounded and membership/admin surfaces no longer rely on whole-app `replaceDomainData(snapshot)` for freshness, including the snapshot-backed workspace/team/user/invite domains
    - Rollback impact: moderate; shell and admin surfaces must retain a revert path to the legacy snapshot path until proven stable
    - Blocking unknowns: none
    - Branch status: `ConvexAppProvider` now boots through the bounded workspace-membership read model by default, `AppShell` and admin/settings surfaces refresh through scoped membership invalidations, and the shell path no longer depends on full-snapshot replacement except the explicit legacy fallback mode.
    - _Requirements: REQ-FUNC-004, REQ-FUNC-005, REQ-FUNC-007, REQ-NFR-002_
  - [x] 4.3 Carve work index, saved views, assigned surfaces, and work item detail metadata off the monolithic snapshot path
    - Depends on: 4.1
    - Likely areas: `components/app/screens/work-surface.tsx`, `components/app/screens/work-item-detail-screen.tsx`, `components/app/screens/create-view-dialog.tsx`, `lib/domain/selectors-internal/work-items.ts`, `lib/store/app-store-internal/slices/work.ts`, related route/client contracts
    - Validation: integration tests showing scoped refetch instead of whole-store replacement for assigned/work/view surfaces and work item detail metadata, including labels, linked documents, comments, attachments, and milestone-linked metadata on work item detail
    - Exit criteria: work indexes, saved views, and work item detail metadata no longer depend on full app snapshot replacement, including label/filter metadata and work-item-adjacent domains
    - Rollback impact: moderate; work surfaces must retain a revert path to legacy snapshot sync until proven stable
    - Blocking unknowns: none
    - Branch status: work index, assigned, and saved-view screens now refresh through scoped work-index and view-catalog read models, and work-item detail metadata stays on the scoped detail path rather than the global snapshot provider.
    - _Requirements: REQ-FUNC-004, REQ-FUNC-005, REQ-FUNC-007, REQ-NFR-002_
  - [x] 4.4 Carve document index/detail metadata and project index/detail surfaces off the monolithic snapshot path
    - Depends on: 4.1
    - Likely areas: `components/app/screens/document-detail-screen.tsx`, `components/app/screens/project-detail-screen.tsx`, workspace/team docs and projects screens, `lib/domain/selectors-internal/core.ts`, `lib/store/app-store-internal/slices/projects.ts`, related route/client contracts
    - Validation: integration tests showing scoped refetch instead of whole-store replacement for docs/project surfaces, excluding active PartyKit editor state, and explicit coverage for `documents`, `comments`, `attachments`, `projects`, `milestones`, and `projectUpdates`
    - Exit criteria: docs/project lists and detail metadata no longer depend on full app snapshot replacement, including project-update and milestone domains
    - Rollback impact: moderate; each surface must retain a revert path to legacy snapshot sync until proven stable
    - Blocking unknowns: none
    - Branch status: `DocumentDetailScreen`, `ProjectDetailScreen`, `DocsScreen`, and `ProjectsScreen` now refresh through bounded scoped read models, with document/project mutations and project-linked work-item mutations emitting the matching index/detail invalidations.
    - _Requirements: REQ-FUNC-004, REQ-FUNC-005, REQ-FUNC-007, REQ-NFR-002_
  - [x] 4.5 Carve notification inbox, chat conversation list/thread, and channel feed/thread surfaces off the monolithic snapshot path
    - Depends on: 4.1
    - Likely areas: `components/app/screens/inbox-ui.tsx`, `components/app/collaboration-screens/**`, `lib/store/app-store-internal/slices/notifications.ts`, `lib/store/app-store-internal/slices/collaboration.ts`, related route/client contracts
    - Validation: integration tests showing scoped refetch instead of whole-store replacement for inbox, chat, and channel surfaces; compatibility tests for append/update workflows; explicit coverage for `notifications`, `conversations`, `calls`, `chatMessages`, `channelPosts`, and `channelPostComments`
    - Exit criteria: inbox, chats, and channels no longer depend on full app snapshot replacement as their primary freshness path, including call/thread/post/comment domains
    - Rollback impact: moderate; each surface must retain a revert path to legacy snapshot sync until proven stable
    - Blocking unknowns: none
    - Branch status: inbox, workspace chats, team chats, and channel feeds now refresh through targeted notification, conversation-list/thread, and channel-feed read models, with matching invalidation bumps wired through notification/chat/channel mutations.
    - _Requirements: REQ-FUNC-004, REQ-FUNC-005, REQ-FUNC-007, REQ-NFR-002_
  - [x] 4.6 Carve search seed and remaining snapshot-backed utility surfaces off the monolithic snapshot path
    - Depends on: 4.1
    - Likely areas: `app/(workspace)/workspace/search/page.tsx`, `lib/domain/selectors-internal/search.ts`, create-action seed helpers, remaining selectors that still rely on `selectAppDataSnapshot`
    - Validation: integration tests and targeted selector tests proving search/create flows function from explicit scoped seed data instead of the full app snapshot, plus an explicit audit that no remaining `selectAppDataSnapshot` consumer hides an unmapped snapshot domain
    - Exit criteria: search and remaining utility surfaces have explicit read models or explicit HTTP-only contracts and no hidden dependence on the full app snapshot or any unmapped snapshot field
    - Rollback impact: low to moderate; these surfaces can temporarily fall back to legacy snapshot sync if needed
    - Blocking unknowns: none
    - Branch status: workspace search and global search now refresh from a scoped search-seed read model, shell bootstrap now carries workspace labels needed by project-creation utilities on cold load, and the remaining utility consumers are backed by scoped store patches rather than default full-snapshot refresh.
    - _Requirements: REQ-FUNC-004, REQ-FUNC-005, REQ-FUNC-007, REQ-NFR-002_
  - [x] 4.7 Restrict `/api/snapshot` to bounded shell-bootstrap compatibility and remove whole-store replacement from hot surfaces
    - Depends on: 4.2, 4.3, 4.4, 4.5, 4.6
    - Likely areas: `app/api/snapshot/route.ts`, `app/api/snapshot/events/route.ts`, `components/providers/convex-app-provider.tsx`, `lib/store/app-store-internal/runtime.ts`, diagnostics/docs
    - Validation: integration tests proving migrated surfaces no longer depend on whole-store replacement, plus compatibility tests for bounded shell bootstrap
    - Exit criteria: `/api/snapshot` remains only as bounded bootstrap/recovery compatibility and no hot product surface uses it as the default freshness mechanism
    - Rollback impact: explicit; this task is the final compatibility clamp and should only land after all scoped surfaces are proven
    - Blocking unknowns: none
    - Branch status: scoped bootstrap is the default runtime path, hot surfaces refresh through targeted invalidation plus read-model fetches, and `/api/snapshot` plus `/api/snapshot/events` remain only for compatibility fallback and explicit rollback flags.
    - _Requirements: REQ-FUNC-004, REQ-FUNC-005, REQ-FUNC-007, REQ-NFR-002, REQ-OPS-001_

- [ ] 5. Rollout, telemetry, and operational readiness
  - [x] 5.1 Add collaboration and scoped-sync telemetry, diagnostics, and release guidance
    - Depends on: 2.1, 2.2, 4.1
    - Likely areas: `lib/browser/snapshot-diagnostics.ts`, provider logs/metrics, `docs/architecture/**`, release/runbook docs
    - Validation: operational verification of join/flush/invalidation metrics, documented abort thresholds, and explicit measurement hooks for the p95 join/rehydrate and invalidation-lag targets
    - Exit criteria: rollout owners can observe collaboration joins, rehydrates, flush failures, invalidation lag, fallback/rollback status, and the numeric NFR targets defined in the design
    - Rollback impact: low; telemetry is additive and supports rollback decisions
    - Blocking unknowns: none
    - Branch status: collaboration/scoped-sync diagnostics now record bootstrap mode, scoped refresh success/failure, scoped reconnects, collaboration session success/failure, and fallback activation, and the rollout/rollback runbook is documented in `docs/architecture/realtime-collaboration-rollout.md`.
    - _Requirements: REQ-OPS-001, REQ-NFR-001, REQ-NFR-002_
  - [ ] 5.2 Validate fallback and rollback paths before removing legacy sync behavior
    - Depends on: 3.2, 3.3, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1
    - Likely areas: migrated screens, provider/store sync code, route toggles/config, release checklist docs
    - Validation: rollback-safety tests and staging/manual operational exercises
    - Exit criteria: the team can disable collaboration per surface and can revert migrated surfaces to legacy sync without data loss
    - Rollback impact: explicit; this task proves rollback works before legacy paths are deleted
    - Blocking unknowns: none
    - Branch status: the full collaboration remediation tranche is landed, the repo-local audit ledger is closed with no open code findings, and the broad automated collaboration/scoped-sync verification sweep is green (`18/18` suites, `109/109` tests, `pnpm typecheck`); explicit multi-client/manual rollback exercises plus secure-transport validation in the browser remain the final pending gate.
    - _Requirements: REQ-FUNC-005, REQ-OPS-001_
  - [x] 5.3 Harden the document collaboration protocol and PartyKit room boundary
    - Depends on: 2.1, 2.2, 3.2, 3.3, 5.1
    - Likely areas: `lib/collaboration/**`, `lib/server/collaboration-token.ts`, `lib/server/collaboration-refresh.ts`, `app/api/collaboration/**`, `services/partykit/**`, `hooks/use-document-collaboration.ts`, `tests/services/partykit-server.test.ts`
    - Validation: token/parser tests, session route contract tests, adapter params tests, PartyKit connect/flush/limit/refresh tests, hook reload-required mapping tests
    - Exit criteria: stale clients cannot join/flush, active saves persist server-held room state, teardown fallback is safe, limits are enforced, active-room refresh is available, and known errors are code-driven
    - Rollback impact: moderate; deploy web and PartyKit together for protocol changes, or disable collaboration with `NEXT_PUBLIC_ENABLE_COLLABORATION=false`
    - Deferred: durable Yjs state in Convex, local `y-indexeddb`, hidden-tab disconnect, and follow/scroll presence
    - _Requirements: REQ-FUNC-001, REQ-FUNC-003, REQ-DATA-001, REQ-SEC-001, REQ-OPS-001, REQ-NFR-001_

## Post-Deploy Verification
- Confirm collaboration room joins, cold rehydrates, and flushes succeed for document and work item description sessions.
- Confirm mention notifications still succeed after collaborative edits and reject stale state correctly.
- Confirm scoped invalidation events are emitted for migrated surfaces and do not trigger whole-app snapshot replacement.
- Confirm delete/tombstone behavior from an active collaboration room.
- Watch join/bootstrap failure rate, scoped invalidation lag, and fallback-path activation rate.
- Abort if document drift, persistent join failures, or scoped refetch regressions exceed the thresholds defined in the design.

## Traceability Matrix
- REQ-FUNC-001 -> 1.1, 2.1, 3.1, 3.2, 3.3
- REQ-FUNC-002 -> 2.1, 3.2, 3.3
- REQ-FUNC-003 -> 2.1, 2.2, 3.2, 3.3
- REQ-DATA-001 -> 2.2, 3.2, 3.3
- REQ-FUNC-004 -> 1.2, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
- REQ-FUNC-005 -> 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.2
- REQ-FUNC-006 -> 3.1, 3.2, 3.3
- REQ-FUNC-007 -> 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
- REQ-SEC-001 -> 1.1, 2.2
- REQ-SEC-002 -> 2.2
- REQ-NFR-001 -> 2.1, 3.2, 3.3, 5.1
- REQ-NFR-002 -> 1.2, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1
- REQ-OPS-001 -> 4.1, 4.7, 5.1, 5.2

## Coverage Checklist
- Every `REQ-*` appears in at least one leaf task
- No leaf task introduces scope absent from the requirements
- Validation is included near risky changes
- Rollout and rollback work is present
- `Depends on` references form a valid acyclic graph
