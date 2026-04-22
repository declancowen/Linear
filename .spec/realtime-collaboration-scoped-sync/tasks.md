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
- Blocking design decisions:
  - None.

## Sequencing Notes
- The work is ordered to establish app-owned contracts and migration-safe boundaries before touching editor screens or the global provider path.
- Collaboration and scoped sync are separate lanes, but the shared foundation is scope ownership and app-controlled contracts.
- Rollback safety depends on preserving the existing document PATCH path and legacy snapshot path until migrated surfaces are proven.

## Blocking Work
- None.

## Tasks

- [ ] 1. Foundation: scope ownership, contracts, and migration-safe boundaries
  - [ ] 1.1 Add shared collaboration contracts, room naming, and provider adapter boundaries
    - Depends on: none
    - Likely areas: `lib/collaboration/**`, `components/app/rich-text-editor.tsx`, `components/app/screens/document-detail-screen.tsx`, `components/app/screens/work-item-detail-screen.tsx`
    - Validation: unit coverage for room IDs, awareness payload shaping, token claim parsing, and adapter contract tests
    - Exit criteria: screen code can consume collaboration through app-owned abstractions without importing PartyKit-specific APIs directly
    - Rollback impact: none; additive contract layer
    - Blocking unknowns: none
    - _Requirements: REQ-FUNC-001, REQ-SEC-001, REQ-SEC-002_
  - [ ] 1.2 Introduce scoped version ownership for read models
    - Depends on: none
    - Likely areas: `convex/schema.ts`, `convex/app.ts`, `convex/app/**/*.ts`, `lib/domain/**`, `lib/application/**`
    - Validation: integration tests for scoped version bump helpers and no-regression tests around `operationalMutation`
    - Exit criteria: the repo can bump capability-specific invalidation keys without relying solely on `appConfig.snapshotVersion`
    - Rollback impact: low; legacy global snapshot version can continue in parallel
    - Blocking unknowns: none
    - _Requirements: REQ-FUNC-004, REQ-FUNC-005, REQ-NFR-002_

- [ ] 2. Collaboration backend and internal app bridge
  - [ ] 2.1 Add PartyKit service code to the repo with Yjs-backed room lifecycle
    - Depends on: 1.1
    - Likely areas: `partykit/**` or `services/realtime/**`, `package.json`, shared `lib/collaboration/**`
    - Validation: service-level integration tests for join, awareness, rehydrate, flush scheduling, and tombstone handling
    - Exit criteria: one repository-owned PartyKit service can host `doc:<documentId>` rooms for collaborative rich-text sessions
    - Rollback impact: low; service can remain undeployed or unused while legacy paths continue
    - Blocking unknowns: none
    - _Requirements: REQ-FUNC-001, REQ-FUNC-002, REQ-FUNC-003, REQ-NFR-001_
  - [ ] 2.2 Add app-controlled collaboration token, bootstrap, and persist endpoints
    - Depends on: 1.1, 2.1
    - Likely areas: `app/api/collaboration/**`, `app/api/internal/collaboration/**`, `lib/server/route-auth.ts`, `lib/server/convex/documents.ts`, `tests/app/api/**`, `tests/lib/server/**`
    - Validation: route contract tests, security tests for internal credential enforcement, integration tests for persisted content correctness
    - Exit criteria: PartyKit can bootstrap canonical document content and persist through app-owned boundaries without direct browser bypass
    - Rollback impact: moderate; internal endpoints can be disabled while legacy PATCH persistence remains
    - Blocking unknowns: none
    - _Requirements: REQ-FUNC-003, REQ-DATA-001, REQ-SEC-001, REQ-SEC-002_

- [ ] 3. Collaborative editor surfaces
  - [ ] 3.1 Add collaboration mode to `RichTextEditor`
    - Depends on: 1.1, 2.1, 2.2
    - Likely areas: `components/app/rich-text-editor.tsx`, `components/app/rich-text-editor/**`, `tests/components/**`
    - Validation: component tests covering local mode, collaboration mode, mention count updates, and degradation when collaboration is unavailable
    - Exit criteria: `RichTextEditor` supports collaboration mode without regressing existing non-collab consumers
    - Rollback impact: low; screens can continue using local-only mode
    - Blocking unknowns: none
    - _Requirements: REQ-FUNC-001, REQ-FUNC-002, REQ-FUNC-005_
  - [ ] 3.2 Migrate standalone document editing to collaborative sessions
    - Depends on: 3.1
    - Likely areas: `components/app/screens/document-detail-screen.tsx`, `lib/store/app-store-internal/slices/work-document-actions.ts`, `lib/convex/client/core.ts`, `tests/components/document-detail-screen.test.tsx`
    - Validation: multi-user integration coverage, screen tests for presence/leave/tombstone behavior, mention-send flush verification
    - Exit criteria: document detail uses collaboration mode for editing and awareness while preserving delete, title update, and mention behaviors
    - Rollback impact: moderate; revert the screen to queued PATCH writes and legacy presence if needed
    - Blocking unknowns: none
    - _Requirements: REQ-FUNC-001, REQ-FUNC-002, REQ-FUNC-003, REQ-FUNC-005, REQ-NFR-001_
  - [ ] 3.3 Migrate work item description editing to the same collaboration capability
    - Depends on: 3.1
    - Likely areas: `components/app/screens/work-item-detail-screen.tsx`, `lib/store/app-store-internal/slices/work-document-actions.ts`, `tests/components/work-item-detail-screen.test.tsx`
    - Validation: multi-user integration coverage and regression tests for edit-only presence removal, draft save behavior, and mention retry flows
    - Exit criteria: work item description editing uses the same collaborative-document path as standalone documents
    - Rollback impact: moderate; revert the work item description surface to current local edit flow if needed
    - Blocking unknowns: none
    - _Requirements: REQ-FUNC-001, REQ-FUNC-002, REQ-FUNC-003, REQ-FUNC-005, REQ-NFR-001_

- [ ] 4. Scoped synchronization and snapshot breakup
  - [ ] 4.1 Add scoped invalidation `SSE` endpoint and client subscription layer
    - Depends on: 1.2
    - Likely areas: `app/api/snapshot/events/route.ts`, new `app/api/events/scoped/route.ts`, `lib/convex/client/core.ts`, `components/providers/convex-app-provider.tsx`, `lib/browser/snapshot-diagnostics.ts`
    - Validation: route contract tests, client subscription tests, reconnect/recovery tests
    - Exit criteria: the client can subscribe to scoped invalidation envelopes without depending on one global version event
    - Rollback impact: low; legacy `/api/snapshot/events` path can remain active
    - Blocking unknowns: none
    - _Requirements: REQ-FUNC-004, REQ-FUNC-005, REQ-NFR-002, REQ-OPS-001_
  - [ ] 4.2 Carve document and work item detail/index surfaces off the monolithic snapshot path
    - Depends on: 4.1
    - Likely areas: `components/providers/convex-app-provider.tsx`, `lib/store/app-store-internal/runtime.ts`, `lib/store/app-store-internal/create-store.ts`, document/work-item selectors and loaders, related route/client contracts
    - Validation: integration tests showing scoped refetch instead of full-store replacement, snapshot diagnostics comparing payload/application behavior before and after
    - Exit criteria: migrated document and work item surfaces no longer depend on full `replaceDomainData(snapshot)` for core freshness
    - Rollback impact: moderate; each surface must retain a revert path to legacy snapshot-driven sync until proven stable
    - Blocking unknowns: none
    - _Requirements: REQ-FUNC-004, REQ-FUNC-005, REQ-NFR-002_
  - [ ] 4.3 Establish the follow-on scoped invalidation policy for other app surfaces
    - Depends on: 4.1
    - Likely areas: `docs/architecture/**`, `lib/domain/**`, `lib/application/**`, capability gateways for notifications/chat/work indexes
    - Validation: design-review validation plus at least one concrete contract or test fixture per next-priority surface
    - Exit criteria: the repo has an explicit surface map stating which surfaces use `SSE`, which remain `HTTP`, and which are eligible for future collaboration transport
    - Rollback impact: none; policy and contracts are additive
    - Blocking unknowns: none
    - _Requirements: REQ-FUNC-004, REQ-FUNC-005, REQ-OPS-001_

- [ ] 5. Rollout, telemetry, and operational readiness
  - [ ] 5.1 Add collaboration and scoped-sync telemetry, diagnostics, and release guidance
    - Depends on: 2.1, 2.2, 4.1
    - Likely areas: `lib/browser/snapshot-diagnostics.ts`, provider logs/metrics, `docs/architecture/**`, release/runbook docs
    - Validation: operational verification of join/flush/invalidation metrics and documented abort thresholds
    - Exit criteria: rollout owners can observe collaboration joins, rehydrates, flush failures, invalidation lag, and fallback/rollback status
    - Rollback impact: low; telemetry is additive and supports rollback decisions
    - Blocking unknowns: none
    - _Requirements: REQ-OPS-001, REQ-NFR-001, REQ-NFR-002_
  - [ ] 5.2 Validate fallback and rollback paths before removing legacy sync behavior
    - Depends on: 3.2, 3.3, 4.2, 5.1
    - Likely areas: migrated screens, provider/store sync code, route toggles/config, release checklist docs
    - Validation: rollback-safety tests and staging/manual operational exercises
    - Exit criteria: the team can disable collaboration per surface and can revert migrated surfaces to legacy sync without data loss
    - Rollback impact: explicit; this task proves rollback works before legacy paths are deleted
    - Blocking unknowns: none
    - _Requirements: REQ-FUNC-005, REQ-OPS-001_

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
- REQ-DATA-001 -> 2.2
- REQ-FUNC-004 -> 1.2, 4.1, 4.2, 4.3
- REQ-FUNC-005 -> 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 5.2
- REQ-SEC-001 -> 1.1, 2.2
- REQ-SEC-002 -> 2.2
- REQ-NFR-001 -> 2.1, 3.2, 3.3, 5.1
- REQ-NFR-002 -> 1.2, 4.1, 4.2, 5.1
- REQ-OPS-001 -> 4.1, 4.3, 5.1, 5.2

## Coverage Checklist
- Every `REQ-*` appears in at least one leaf task
- No leaf task introduces scope absent from the requirements
- Validation is included near risky changes
- Rollout and rollback work is present
- `Depends on` references form a valid acyclic graph
