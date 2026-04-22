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

# Design Document: Realtime Collaboration and Scoped Synchronization Architecture

## Summary
- Add true collaborative rich-text editing for documents and work item descriptions using `Tiptap + Yjs + PartyKit`.
- Keep `Convex` as the canonical store for durable document content, access control, mention validation, and delete lifecycle.
- Retire the current monolithic snapshot synchronization model in favor of bounded shell bootstrap plus scoped invalidation/refetch, with `SSE` for normal app surfaces and `PartyKit` only for session-oriented collaboration.

## Scope Statement
- This spec governs the shared architecture for realtime collaboration and the breakup of the global snapshot synchronization model.
- It covers collaborative document sessions, editor presence, provider boundaries, scoped read-model invalidation, migration sequencing, and rollback posture.

## Repository Discovery Summary

### Repo Root
- `/Users/declancowen/Documents/GitHub/Linear`

### Repo-Specific Profile and House Patterns
- No repo-local `.spec/_shared/repo-profile.md` or `.spec/_shared/house-patterns.md` exists today.
- Existing architectural direction is captured in [docs/architecture/target-state-architecture.md](/Users/declancowen/Documents/GitHub/Linear/docs/architecture/target-state-architecture.md) and [docs/architecture/transformation-roadmap.md](/Users/declancowen/Documents/GitHub/Linear/docs/architecture/transformation-roadmap.md).
- The repo is a governed modular monolith using `Next.js`, `Convex`, `WorkOS`, and `Electron`, with route handlers and `lib/server/convex/*` wrappers enforcing auth and typed error mapping.

### Entry Points and Execution Path
- Global client synchronization starts in [components/providers/convex-app-provider.tsx](/Users/declancowen/Documents/GitHub/Linear/components/providers/convex-app-provider.tsx), which loads `/api/snapshot`, subscribes to `/api/snapshot/events`, and calls `replaceDomainData(snapshot)`.
- Snapshot streaming is implemented in [app/api/snapshot/events/route.ts](/Users/declancowen/Documents/GitHub/Linear/app/api/snapshot/events/route.ts).
- Document editing flows through [components/app/screens/document-detail-screen.tsx](/Users/declancowen/Documents/GitHub/Linear/components/app/screens/document-detail-screen.tsx), [components/app/rich-text-editor.tsx](/Users/declancowen/Documents/GitHub/Linear/components/app/rich-text-editor.tsx), [app/api/documents/[documentId]/route.ts](/Users/declancowen/Documents/GitHub/Linear/app/api/documents/[documentId]/route.ts), and [convex/app/document_handlers.ts](/Users/declancowen/Documents/GitHub/Linear/convex/app/document_handlers.ts).
- Work item description editing and edit-time presence live in [components/app/screens/work-item-detail-screen.tsx](/Users/declancowen/Documents/GitHub/Linear/components/app/screens/work-item-detail-screen.tsx).
- Current document presence flows through [app/api/documents/[documentId]/presence/route.ts](/Users/declancowen/Documents/GitHub/Linear/app/api/documents/[documentId]/presence/route.ts), `syncHeartbeatDocumentPresence`, and `heartbeatDocumentPresenceHandler`.

### Confirmed Code and Runtime Facts
- `appConfig.snapshotVersion` is the current global invalidation clock in [convex/schema.ts](/Users/declancowen/Documents/GitHub/Linear/convex/schema.ts) and [convex/app.ts](/Users/declancowen/Documents/GitHub/Linear/convex/app.ts).
- The default Convex mutation wrapper bumps the global snapshot version after each mutation, while `operationalMutation` does not.
- Documents are canonically stored as HTML strings in `documents.content` in [convex/validators.ts](/Users/declancowen/Documents/GitHub/Linear/convex/validators.ts).
- The editor already uses `Tiptap` in [components/app/rich-text-editor.tsx](/Users/declancowen/Documents/GitHub/Linear/components/app/rich-text-editor.tsx).
- Document updates already pass through shared sanitation and typed error mapping in [lib/server/convex/documents.ts](/Users/declancowen/Documents/GitHub/Linear/lib/server/convex/documents.ts).
- Work item descriptions are document-backed and follow the same rich-text patterns as standalone documents.
- Current document and work item presence are heartbeat-based and session-aware, not collaborative content synchronization.

### Related Code and Pattern Inventory
- [docs/architecture/target-state-architecture.md](/Users/declancowen/Documents/GitHub/Linear/docs/architecture/target-state-architecture.md) already distinguishes `SSE` invalidation from `WebSocket` collaboration and requires full resync as a recovery path.
- [docs/architecture/document-presence-avatar-hot-path-spec.md](/Users/declancowen/Documents/GitHub/Linear/docs/architecture/document-presence-avatar-hot-path-spec.md) already pushes document presence toward lightweight identity payloads and client-side joins.
- [lib/server/convex/documents.ts](/Users/declancowen/Documents/GitHub/Linear/lib/server/convex/documents.ts) is the existing gateway for safe document persistence and error mapping.
- [tests/components/document-detail-screen.test.tsx](/Users/declancowen/Documents/GitHub/Linear/tests/components/document-detail-screen.test.tsx), [tests/convex/document-handlers.test.ts](/Users/declancowen/Documents/GitHub/Linear/tests/convex/document-handlers.test.ts), and [tests/lib/server/convex-documents.test.ts](/Users/declancowen/Documents/GitHub/Linear/tests/lib/server/convex-documents.test.ts) lock current document behavior.

### Adjacent Pattern Comparison
- Preferred existing pattern:
  - keep durable business state in Convex
  - route all external-facing requests through Next routes and `lib/server/convex/*`
  - use typed wrappers and truth-preserving error mapping
- This design conforms by keeping PartyKit out of canonical persistence and treating it as a transport/session layer.
- This design intentionally diverges from the current full-snapshot replacement path by introducing capability-scoped read models and scoped invalidation.

### Blast Radius Review
- Shared utilities and clients:
  - `components/providers/convex-app-provider.tsx`
  - `lib/convex/client/core.ts`
  - `lib/store/app-store-internal/runtime.ts`
  - `lib/store/app-store-internal/slices/work-document-actions.ts`
  - `components/app/rich-text-editor.tsx`
- Callers and adjacent consumers:
  - document detail screens
  - work item detail screens
  - mention notification routes
  - server wrappers in `lib/server/convex`
- Hidden coupling points:
  - `appConfig.snapshotVersion`
  - document mention validation against persisted HTML
  - delete cascade cleanup for `documentPresence`
  - client assumptions about `replaceDomainData(snapshot)`

### Recent Related Repository History
- `8a3f6f5` implemented work planning views and editing overhaul.
- `2374d58` added the deferred presence hot-path spec.
- `255f09c` fixed presence hot path and stale heartbeat viewer state.
- `d1d5d55` fixed document presence session rotation and hidden resume.
- `194335a` added document presence and editor stats.

### Impacted Boundaries and Adjacent Systems
- Upstream:
  - `Next.js` routes under `app/api/*`
  - authentication and session handling in `lib/server/route-auth`
- Downstream:
  - Convex mutation/query handlers
  - client store synchronization and screen-level selectors
  - support/debugging paths for document editing failures
- Adjacent systems:
  - WorkOS-backed auth
  - Electron runtime, which must continue using the same web contracts

### Data, Contracts, and Config Surfaces
- `documents`, `documentPresence`, `appConfig` in Convex
- `/api/snapshot`, `/api/snapshot/events`, `/api/documents/[documentId]`, `/api/documents/[documentId]/presence`, `/api/documents/[documentId]/mentions`
- New scoped invalidation channels and collaboration token/bootstrap/persist contracts
- Internal secret/config for PartyKit-to-app callbacks

### Existing Tests and Operational Signals
- Existing tests:
  - [tests/components/document-detail-screen.test.tsx](/Users/declancowen/Documents/GitHub/Linear/tests/components/document-detail-screen.test.tsx)
  - [tests/components/work-item-detail-screen.test.tsx](/Users/declancowen/Documents/GitHub/Linear/tests/components/work-item-detail-screen.test.tsx)
  - [tests/convex/document-handlers.test.ts](/Users/declancowen/Documents/GitHub/Linear/tests/convex/document-handlers.test.ts)
  - [tests/lib/server/convex-documents.test.ts](/Users/declancowen/Documents/GitHub/Linear/tests/lib/server/convex-documents.test.ts)
  - route contract tests under `tests/app/api/*`
- Existing operational signals:
  - snapshot diagnostics in [lib/browser/snapshot-diagnostics.ts](/Users/declancowen/Documents/GitHub/Linear/lib/browser/snapshot-diagnostics.ts)
  - provider error logging in `lib/server/provider-errors`

## Problem Statement and Context
- The product now needs realtime collaboration that goes beyond “viewer heartbeat” semantics: live editing, cursors, typing, and active-editor presence for both standalone documents and work item descriptions.
- The current app-wide sync model uses one global snapshot version and full-store replacement, which is too coarse for high-churn surfaces and directly conflicts with the target-state architecture already documented in the repo.
- If this change is done incorrectly, the likely outcomes are document drift, mention-validation regressions, excessive transport load, hard provider lock-in, and continued coupling to a monolithic snapshot.

## Current-State Analysis
- Current global synchronization:
  - `ConvexAppProvider` fetches a full snapshot and replaces the entire domain state.
  - `/api/snapshot/events` polls `getSnapshotVersionServer()` every second and tells the client to refetch the full snapshot when the version changes.
  - nearly every mutation bumps the same `appConfig.snapshotVersion`.
- Current document editing:
  - document content is edited locally in `RichTextEditor`
  - queued writes call `syncUpdateDocument`
  - persistence lands in `updateDocumentHandler`
- Current realtime for documents and work items:
  - only presence is realtime
  - presence uses heartbeat/leave routes and Convex side-table rows
  - there is no multi-user document merge logic
- Existing strengths that must be preserved:
  - Convex remains the source of truth
  - route/auth wrappers and typed errors are already in place
  - sanitization, mention counting, and delete lifecycle are already implemented

## Legacy Architecture Guidance
- Still valid from existing architecture docs:
  - `WebSocket` is for genuinely bidirectional, session-oriented collaboration
  - `SSE` is the default for server-to-client invalidation on ordinary app surfaces
  - `HTTP` bootstrap and full resync remain required recovery paths
  - transport choice must not be confused with read-model design
- Superseded by this design:
  - any implication that document/work item editor presence should remain heartbeat-driven once those surfaces move to collaborative sessions
  - any implementation assumption that the current global snapshot stream is an acceptable long-term primary sync mechanism
  - any suggestion that adding websocket transport alone would solve the monolithic snapshot problem

## Goals
- Provide true collaborative editing for:
  - team documents
  - workspace documents
  - private documents
  - work item description documents
- Provide live awareness for those editor sessions:
  - who is present
  - who is typing
  - cursor/selection state
- Keep durable document state and lifecycle in Convex.
- Break the global snapshot into scoped read models plus scoped invalidation/refetch.
- Keep provider migration cost bounded by isolating PartyKit-specific code behind adapters.

## Non-Goals
- Replace Convex as the canonical store.
- Move the full app onto PartyKit or WebSocket transport.
- Rebuild the entire store architecture in one cutover.
- Change current mention notification product semantics.
- Introduce general websocket transport for notifications, index pages, or shell data.

## Confirmed Facts
- The repo already distinguishes operational mutations from snapshot-invalidating mutations.
- The repo already models work item descriptions as rich-text document content.
- The repo already has tests for document presence, mention validation, route contracts, and document persistence wrappers.
- The target-state architecture already says `WebSocket` is for genuinely bidirectional collaboration and `SSE` remains preferred for ordinary invalidation.

## Assumptions
- PartyKit remains an acceptable first transport/provider for realtime collaboration.
- PartyKit hosted storage will be treated as ephemeral session state, not the canonical store.
- The product is willing to accept additive migration phases rather than a single “replace snapshot everywhere” cutover.

## Open Questions
- None.

## Decision Needed
- None.

## Proposed Design

### Solution Overview
- Introduce a dedicated collaboration lane and a separate scoped synchronization lane.
- Collaboration lane:
  - `Tiptap` on the client
  - `Yjs` as the shared document model
  - `PartyKit` as the first transport/room runtime
  - `Convex` remains canonical through app-controlled bootstrap/persist endpoints
- Scoped synchronization lane:
  - keep `HTTP` bootstrap
  - replace global snapshot invalidation with scoped read-model invalidation over `SSE`
  - refetch only the affected capability model

### Realtime Surface Map
- Use `PartyKit + Yjs` now for:
  - standalone document editing
  - work item description editing
  - editor awareness for those surfaces: presence, typing, cursor, selection
- Keep `PartyKit` eligible later, but not in initial implementation, for:
  - active thread typing indicators
  - active composer/session presence on explicitly collaborative non-document surfaces
  - other future session-oriented features where client-to-client or client-to-room signaling is the product requirement
- Use scoped `SSE` invalidation + refetch for:
  - document detail outside the active collaborative editor session
  - document and work indexes
  - work item detail metadata
  - notification inbox
  - channel/chat thread freshness when append-delta semantics are not yet warranted
- Keep plain `HTTP` bootstrap for:
  - shell bootstrap
  - auth context
  - current workspace and navigation context
  - reconnect/full recovery flows

### End-to-End Flow
1. The app bootstraps a bounded shell context over `HTTP`; no collaborative transport is required for shell load.
2. A document detail or work item detail screen loads its scoped Convex-backed read model over normal application paths.
3. If the user opens a collaborative rich-text surface, the client requests a short-lived collaboration token from a Next route.
4. The client joins a PartyKit room named from app-owned room conventions such as `doc:<documentId>`.
5. The PartyKit room validates the token and, if it has no hot Yjs state, rehydrates from the canonical document HTML fetched through an app-controlled internal bootstrap endpoint.
6. `Tiptap` runs in collaboration mode using the shared Yjs document and awareness state for cursors, typing, and presence.
7. The PartyKit room periodically flushes sanitized canonical content back through an app-controlled persist endpoint, which writes through existing Convex-safe wrappers and updates scoped invalidation clocks.
8. Mention notifications still execute through the existing route, but the client or collaboration layer must flush pending shared content before invoking that route.
9. Non-collaboration surfaces receive scoped invalidation over `SSE`; the client refetches only the affected read model instead of replacing the whole store.
10. If a document is deleted or access is revoked, the canonical store wins: the room receives a tombstone/authorization failure, clients leave the room, and the UI falls back to the normal missing/forbidden state.

### Component and Module Changes

#### UI or Client
- Extend `RichTextEditor` to support a collaboration mode without forcing non-collab surfaces to use it.
- Add a collaboration client adapter layer under `lib/collaboration/` so screens do not import PartyKit-specific code directly.
- Migrate `DocumentDetailScreen` and work item description editing in `WorkItemDetailScreen` to shared collaborative-document hooks.
- Replace editor-specific heartbeat presence on migrated surfaces with Yjs awareness-driven presence.
- Refactor the global provider/store path so migrated surfaces subscribe to scoped models instead of depending on `replaceDomainData(snapshot)`.

#### API or Application Layer
- Add app routes for:
  - collaboration token minting
  - collaboration bootstrap of canonical document content
  - collaboration flush/persist
  - collaboration tombstone/delete propagation if needed
- Add a scoped invalidation `SSE` route that emits scoped version changes instead of one global snapshot version.
- Preserve existing document update and mention routes during migration; collaborative persistence should reuse them or a thin equivalent contract rather than bypass them.

#### Domain or Business Logic
- Treat standalone docs and work item descriptions as one `collaborative rich-text document` capability.
- Define app-owned room IDs, awareness payload shapes, and scope keys.
- Define a transport eligibility matrix:
  - `PartyKit/Yjs` only for truly session-oriented, bidirectional collaboration
  - `SSE` for ordinary invalidation/refetch
  - `HTTP` for bootstrap and recovery
- Preserve current invariants for:
  - document access control
  - canonical HTML sanitation
  - mention notification validation
  - delete lifecycle

#### Data Model and Persistence
- Keep `documents.content` in Convex as the canonical durable document body.
- Add a scoped version registry, preferably as a dedicated table such as `readModelVersions`, keyed by stable app-owned scope keys rather than one global clock.
- Keep PartyKit/Yjs state ephemeral; rehydrate from Convex on cold room start or after session loss.
- Leave `documentPresence` as a transitional surface for non-migrated screens, but do not extend it as the primary collaboration transport.

#### Integrations, Events, or Background Jobs
- Add a PartyKit service in this repository, deployed separately from Vercel but sharing contracts and types from the same codebase.
- PartyKit should call app-controlled internal endpoints for bootstrap and persistence rather than holding direct Convex admin authority if that can be avoided.
- No new queue or replay subsystem is required initially; periodic flush, explicit flush-on-leave, and flush-before-mention-send are sufficient for the first phase.

#### Security and Permissions
- Mint short-lived collaboration tokens from the app after the normal auth/access checks succeed.
- Tokens must carry only the minimum claims needed to identify the user, document, and allowed room.
- PartyKit must not become a second independent authorization system.
- Internal app endpoints used by PartyKit must require a dedicated shared secret or equivalent server-to-server trust mechanism.

#### Performance and Scalability
- Stop using document/work item collaborative changes as a reason to reload the full app snapshot.
- Keep `SSE` payloads to scope/version envelopes, not full models.
- Keep collaborative persistence batched and amortized; do not write on every keystroke.
- Keep a recovery path: if the room is cold or lost, rehydrate from Convex and continue.

#### Observability and Operations
- Add metrics/logs for:
  - room join success/failure
  - bootstrap latency
  - flush success/failure
  - rehydrate count
  - stale-room or tombstone events
  - scoped invalidation lag
  - scoped refetch failures
- Extend existing snapshot diagnostics to cover the scoped model path so the repo can quantify reduction in full snapshot churn.

## Impacted Surfaces Matrix
- UI:
  - `DocumentDetailScreen`
  - `WorkItemDetailScreen`
  - `RichTextEditor`
  - provider/store synchronization layer
- API:
  - `/api/snapshot/events`
  - document/work item document routes
  - new collaboration token/bootstrap/persist routes
  - new scoped invalidation `SSE` route
- Domain logic:
  - room naming
  - scope-key ownership
  - transport eligibility rules
- Persistence:
  - `documents`
  - `appConfig`
  - new scoped version registry
- Integrations:
  - PartyKit service
  - WorkOS-backed auth token minting
- Auth:
  - app-issued collaboration tokens
  - PartyKit internal callback trust
- Infra:
  - PartyKit deployment in the repo but outside Vercel
- Telemetry:
  - snapshot/scoped-sync diagnostics
  - collaboration metrics
- Tests:
  - document and work item screen tests
  - route contract tests
  - Convex handler tests
- Docs:
  - architecture docs and runbooks after implementation

## Change Impact Map
- Direct impact:
  - document editing
  - work item description editing
  - snapshot provider/client sync model
- Indirect impact:
  - mention notification flush timing
  - delete/tombstone UX
  - store selector assumptions
- Unchanged but risk-adjacent areas:
  - comments and attachments
  - Electron shell
  - non-editor routes that still rely on shell bootstrap

## Invariants and Forbidden Outcomes
- Convex remains the canonical durable store for document content and access control.
- PartyKit is not the only durable copy of any document.
- A deleted or unauthorized document must not remain editable because a room still exists.
- Mention notifications must still validate against persisted canonical content.
- Scaled-down sync must not regress to hidden whole-store replacement under a different transport name.
- WebSocket transport must not become the new default for general app synchronization.

## Compatibility Matrix
- Public API:
  - additive internal routes only; existing document routes remain compatible during migration
- Internal API:
  - new collaboration and scoped invalidation contracts required
- Data schema:
  - additive scoped version registry preferred; existing document schema remains canonical
- Events:
  - global snapshot event path transitions to scoped invalidation path over time
- Cache keys:
  - replace global snapshot dependency with stable scope keys
- Config:
  - new PartyKit/internal secret config required
- External consumers:
  - not applicable; no third-party public consumer contract is introduced
- Rollback compatibility:
  - fallback to existing queued document PATCH writes and current snapshot SSE path must remain possible during rollout

## Contract Examples and Before/After Payloads
- Request examples:
  - `POST /api/collaboration/documents/:documentId/session` -> `{ roomId, token, transport: "partykit" }`
  - `GET /api/internal/collaboration/documents/:documentId/bootstrap` -> `{ documentId, title, contentHtml, updatedAt, deleted: false }`
  - `POST /api/internal/collaboration/documents/:documentId/persist` -> `{ documentId, contentHtml, title, sourceVersion }`
- Response examples:
  - scoped invalidation `SSE` payload:
    - `{ scopeKey: "document-detail:document_1", version: 12 }`
    - `{ scopeKey: "work-item-detail:item_1", version: 33 }`
- Event or message examples:
  - awareness payload:
    - `{ userId, name, avatarUrl, cursor, selection, typing, sessionId }`
- Before/after comparisons:
  - before:
    - any document mutation can lead to full snapshot reload
  - after:
    - collaborative document changes stay inside the room and persist canonically
    - non-collab consumers refetch only the impacted scoped model

## Cross-Cutting Applicability Matrix
- Security:
  - covered by token minting, internal secrets, and canonical access checks
- Privacy:
  - covered by keeping canonical data in Convex and limiting room claims/presence payloads
- Performance:
  - covered by batched persistence and scoped invalidation instead of full snapshot replacement
- Resilience:
  - covered by cold-room rehydration and HTTP recovery path
- Migration:
  - covered by additive rollout with old paths retained until confidence is established
- Observability:
  - covered by collaboration and scoped-sync metrics/logs
- Supportability:
  - covered by explicit tombstone/rehydrate flows and typed error boundaries
- Backward compatibility:
  - covered by retaining current routes/contracts while migrating screens incrementally

## Success Metrics and Numeric NFR Targets
- Latency targets:
  - warm collaborative room join p95 <= `1000ms`
  - cold-room rehydrate-to-editable p95 <= `2000ms`
- Throughput or concurrency targets:
  - collaborative persistence must batch edits so canonical writes do not exceed `1 flush / 3s / active room` during steady editing
- Error-rate or availability targets:
  - collaboration join + bootstrap failure rate < `1%` over a 1-day rolling window after rollout
  - scoped invalidation refetch failure rate < `1%` on migrated surfaces
- Timeout, retry, or queue-depth limits:
  - scoped invalidation visibility target p95 <= `3s` under the initial SSE polling approach

## Decision Register

### DES-001: Separate collaboration transport from general app synchronization
- Context:
  - The repo already distinguishes `SSE` invalidation from `WebSocket` collaboration in its architecture docs, but the implementation still uses one global snapshot path.
- Decision:
  - Use `PartyKit/Yjs` only for bidirectional collaborative sessions and use scoped `SSE` invalidation/refetch for non-collab surfaces.
- Rationale:
  - This solves the actual document collaboration problem without creating a new monolithic websocket-based app sync layer.
- Tradeoffs:
  - Two realtime lanes exist instead of one.
  - More explicit capability boundaries are required.
- Affected surfaces:
  - provider/store sync
  - document/work item editing
  - future realtime feature eligibility decisions

### DES-002: Keep Convex as canonical; treat PartyKit/Yjs state as ephemeral session state
- Context:
  - Hosted PartyKit storage is not appropriate as the only durable source of truth, and the repo already stores documents canonically in Convex.
- Decision:
  - Convex remains canonical; PartyKit/Yjs rooms rehydrate from Convex and flush back to Convex.
- Rationale:
  - This preserves current business invariants, keeps deletes authoritative, and lowers provider migration cost.
- Tradeoffs:
  - A bootstrap/persist bridge is required.
  - Cold-room startup is slightly more complex than purely durable room storage.
- Affected surfaces:
  - document persistence
  - delete lifecycle
  - migration/rollback

### DES-003: Reuse existing app-controlled document persistence contracts instead of bypassing them
- Context:
  - The repo already sanitizes rich text, maps typed errors, and validates mentions against persisted canonical content.
- Decision:
  - Collaborative persistence must reuse the existing document-safe server boundary or a thin equivalent contract that preserves the same invariants.
- Rationale:
  - The collaboration stack must not create a second, weaker persistence path.
- Tradeoffs:
  - Persist flow is app-mediated rather than provider-direct.
- Affected surfaces:
  - `lib/server/convex/documents.ts`
  - document mutation routes
  - mention notification flow

### DES-004: Treat work item descriptions as first-class collaborative documents
- Context:
  - Work item descriptions already use the same rich-text document patterns and currently have their own edit-time presence.
- Decision:
  - The collaborative-document capability includes both standalone documents and work item description documents.
- Rationale:
  - This avoids two collaboration architectures for the same content model.
- Tradeoffs:
  - Migration work must touch both document and work item screens.
- Affected surfaces:
  - `DocumentDetailScreen`
  - `WorkItemDetailScreen`
  - document/work item read models

### DES-005: Replace the global snapshot clock with scope-key versioning and scoped refetch
- Context:
  - Today almost every mutation bumps `appConfig.snapshotVersion`, causing coarse invalidation and whole-store replacement.
- Decision:
  - Introduce app-owned scope keys and a scoped version registry so clients can refetch only the affected capability model.
- Rationale:
  - This is the direct architectural remedy for the monolithic snapshot problem already documented in the repo.
- Tradeoffs:
  - More version bookkeeping is required.
  - Client sync logic becomes capability-aware.
- Affected surfaces:
  - `ConvexAppProvider`
  - snapshot routes
  - read-model queries and screen-level data loading

### DES-006: Isolate PartyKit behind a repository-owned collaboration adapter
- Context:
  - The team wants to be able to move away from PartyKit if limits or economics change.
- Decision:
  - Encapsulate PartyKit-specific code in a collaboration adapter and keep room IDs, awareness payloads, and token contracts app-owned.
- Rationale:
  - This keeps migration to `Hocuspocus` or another Yjs transport at adapter scope rather than product scope.
- Tradeoffs:
  - Slight upfront abstraction cost.
- Affected surfaces:
  - collaboration client/server modules
  - PartyKit service code

### DES-007: Treat older architecture docs as input, not implementation truth
- Context:
  - Existing architecture docs contain durable principles, but some implementation assumptions are now outdated.
- Decision:
  - Adopt the enduring principles from the existing docs and explicitly supersede outdated implementation details in this spec.
- Rationale:
  - This avoids cargo-culting stale mechanics while preserving sound architecture guidance.
- Tradeoffs:
  - The team must maintain clear “valid vs superseded” documentation.
- Affected surfaces:
  - architecture docs
  - rollout communication
  - follow-on specs

## Risk Register
- Risk:
  - Impact:
    - collaborative state drifts from canonical Convex state
  - Mitigation:
    - periodic flush, explicit flush on leave/delete/mention-send, canonical rehydrate path
  - Residual risk:
    - short-lived drift remains possible during active edits if flush cadence is too slow
- Risk:
  - Impact:
    - scoped invalidation rollout breaks screens that still assume `replaceDomainData(snapshot)`
  - Mitigation:
    - migrate by capability, keep old path as fallback until each surface is proven
  - Residual risk:
    - temporary dual-path complexity
- Risk:
  - Impact:
    - PartyKit-specific coupling makes provider migration expensive
  - Mitigation:
    - app-owned room IDs, token contracts, awareness schema, and adapter interface
  - Residual risk:
    - transport-specific operational tuning still differs by provider
- Risk:
  - Impact:
    - mention notification semantics regress under concurrent edits
  - Mitigation:
    - keep persisted HTML canonical, flush before send, preserve current validation endpoint
  - Residual risk:
    - user-facing timing edge cases around simultaneous edits may still need iteration

## Test Impact Matrix
- Existing tests to update:
  - `tests/components/document-detail-screen.test.tsx`
  - `tests/components/work-item-detail-screen.test.tsx`
  - `tests/app/api/*` route contract tests touching snapshot/doc routes
- New tests required:
  - collaboration token/bootstrap/persist route tests
  - scoped invalidation `SSE` contract tests
  - collaboration adapter tests for room lifecycle and fallback/rehydrate behavior
- Compatibility tests:
  - migrated screens still work when collaboration is disabled or unavailable
  - old snapshot path still boots shell during phased rollout
- Rollback-safety tests:
  - document editing falls back to queued PATCH persistence without data loss
  - deleted documents evict collaboration sessions cleanly

## Validation Strategy
- Unit validation:
  - room naming, scope-key generation, token validation, awareness payload shaping
- Integration validation:
  - collaboration bootstrap/persist endpoints
  - scoped invalidation event emission and refetch
- End-to-end validation:
  - multi-user document edit
  - multi-user work item description edit
  - delete while joined
  - mention-send after collaborative edits
- Migration or rollback validation:
  - non-migrated screens still operate under the existing snapshot model
  - migrated screens can fall back to non-collab editing if the collab path is disabled
- Performance validation:
  - warm join latency, cold rehydrate latency, scoped invalidation lag
- Operational validation:
  - metrics fire, logs are attributable, abort thresholds are visible

## Rollout, Abort, and Reversal
- Rollout strategy:
  - implement additive collaboration and scoped invalidation infrastructure first
  - migrate collaborative rich-text surfaces first
  - migrate non-collab read models off the global snapshot incrementally
- Feature flags or progressive exposure:
  - capability-level rollout is preferred over all-user cutover
  - keep old document PATCH path and current snapshot provider path available during migration
- Abort thresholds:
  - collaboration join/bootstrap failures exceed target
  - scoped invalidation refetch failures exceed target
  - document drift or mention validation regressions appear in testing or early rollout
- Rollback preconditions:
  - old screen paths remain intact until new path is proven
- Reversal mechanics:
  - disable collaboration mode on the affected surface
  - return the surface to queued PATCH persistence and current heartbeat presence if needed
  - route non-collab surfaces back through the legacy snapshot stream if scoped invalidation is unstable
- Post-deploy checks:
  - verify room join/flush metrics
  - verify scoped invalidation events are emitted and consumed
  - verify document delete/tombstone behavior from an active room

## Forbidden Shortcuts and Guardrails
- Do not store the only durable copy of document content in PartyKit.
- Do not bypass `lib/server/convex/documents.ts`-level safety semantics for collaborative persistence.
- Do not replace the global snapshot path with a global websocket feed carrying the same broad invalidation semantics.
- Do not spread PartyKit-specific APIs throughout screen components.
- Do not treat old architecture docs as implementation truth when they conflict with confirmed repository behavior.

## Alternatives Considered
- Alternative:
  - Use raw `Socket.IO` as both collaboration transport and general app realtime transport.
  - Why rejected:
    - it solves neither canonical document merge semantics nor the monolithic snapshot problem cleanly.
- Alternative:
  - Use a managed provider for collaboration and presence everywhere.
  - Why rejected:
    - higher recurring cost and less control than needed for the current phase.
- Alternative:
  - Keep using heartbeat presence and queued PATCH writes for rich-text collaboration.
  - Why rejected:
    - it cannot provide true simultaneous editing or consistent merge semantics.
- Alternative:
  - Move canonical document storage into PartyKit room storage.
  - Why rejected:
    - violates durability, rollback, and provider portability goals.

## Residual Risks
- Scoped invalidation migration is still broad cross-cutting work even with a phased plan.
- The first collaboration rollout will likely surface edge cases around concurrent mention authoring and editor lifecycle.
- The repo will temporarily carry both legacy and target-state sync paths during migration.
