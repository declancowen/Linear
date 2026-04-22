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

# Requirements Document: Realtime Collaboration and Scoped Synchronization Architecture

## Source Artifacts
- `.spec/realtime-collaboration-scoped-sync/design.md`

## Scope Statement
- This requirement set governs collaborative rich-text sessions for documents and work item descriptions, plus the scoped invalidation architecture that replaces the current monolithic snapshot sync model over time.

## Cross-Cutting Coverage
- Security:
  - `REQ-SEC-001`, `REQ-SEC-002`
- Privacy:
  - `REQ-SEC-001`, `REQ-DATA-001`
- Performance:
  - `REQ-NFR-001`, `REQ-NFR-002`
- Resilience:
  - `REQ-FUNC-003`, `REQ-OPS-001`
- Migration:
  - `REQ-FUNC-005`, `REQ-OPS-001`
- Observability:
  - `REQ-OPS-001`
- Supportability:
  - `REQ-OPS-001`, `REQ-FUNC-003`
- Backward compatibility:
  - `REQ-FUNC-005`, `REQ-DATA-001`

## Requirements

### REQ-FUNC-001: Collaborative rich-text sessions for documents and work item descriptions
Source Design Decisions:
- DES-001
- DES-002
- DES-004
- DES-006

Priority: High

Rationale:
- The product needs true simultaneous editing and awareness on rich-text document surfaces, not just heartbeat presence.

Requirement:
- THE system SHALL support collaborative editing sessions for standalone documents and work item description documents using a shared-document collaboration model that is transport-backed but app-owned in identity, room naming, and lifecycle semantics.

Verification Method:
- Integration and end-to-end verification

Risk if Unmet:
- Editors remain single-writer in practice, leading to overwrites, stale content, and inconsistent user expectations.

Acceptance Criteria
1. WHEN two authenticated users open the same standalone document, THEN both users SHALL see shared document changes converge without last-write-wins overwrites.
2. WHEN two authenticated users open the same work item description, THEN the same collaborative behavior SHALL apply without a separate collaboration implementation path.
3. WHEN the collaboration transport is available, THEN the editor SHALL expose awareness state for presence, typing, or cursor/selection metadata for that session.

Negative Cases
1. WHEN a non-collab surface renders rich text outside an active editing session, THEN it SHALL NOT require PartyKit or collaborative room membership to function.
2. WHEN a user lacks edit access, THEN the collaboration session SHALL NOT grant edit capability through the transport path alone.

Notes
- This requirement governs the eligible surface set for the first collaboration phase.

### REQ-FUNC-002: Collaborative presence and awareness replace heartbeat presence on migrated editor surfaces
Source Design Decisions:
- DES-001
- DES-004

Priority: High

Rationale:
- Migrated editor surfaces should not continue paying heartbeat-style presence costs when awareness is already present inside the collaboration session.

Requirement:
- THE system SHALL provide editor-session presence for migrated collaborative surfaces through the collaboration awareness channel rather than through the current heartbeat-based presence routes as the primary mechanism.

Verification Method:
- Integration and screen-level verification

Risk if Unmet:
- The app keeps duplicate realtime paths for the same editor state, increasing inconsistency and operational cost.

Acceptance Criteria
1. WHEN a document detail screen is migrated to collaboration mode, THEN presence shown for the editor session SHALL come from collaboration awareness state.
2. WHEN a work item description editor is migrated to collaboration mode, THEN edit-time presence SHALL come from collaboration awareness state.
3. WHEN the user leaves the collaborative session, THEN local awareness state SHALL clear and remote viewers SHALL no longer see the user as present in that session.

Negative Cases
1. WHEN a surface is not yet migrated, THEN the existing heartbeat-based presence path MAY continue to operate without regression.
2. WHEN the awareness transport is unavailable, THEN the editor SHALL fail safely and SHALL NOT leave permanently stale session-presence UI.

### REQ-FUNC-003: Canonical persistence, rehydration, and tombstone/delete safety
Source Design Decisions:
- DES-002
- DES-003

Priority: High

Rationale:
- Provider-hosted session state must not become the only durable copy of a document, and delete/access decisions must remain authoritative in Convex.

Requirement:
- THE system SHALL rehydrate collaborative document sessions from canonical Convex-backed content and SHALL persist collaborative changes back through app-controlled persistence boundaries that preserve current sanitation, mention-count, access-control, and delete semantics.

Verification Method:
- Integration, migration, and rollback verification

Risk if Unmet:
- Data loss, stale-room editing after delete, or bypassed business invariants become possible.

Acceptance Criteria
1. WHEN a collaboration room starts cold, THEN it SHALL be able to reconstruct the shared document state from canonical stored document content.
2. WHEN users make collaborative edits, THEN canonical persistence SHALL occur in bounded batches rather than on every keystroke.
3. WHEN a document is deleted or becomes unauthorized while a room is active, THEN the collaborative session SHALL stop treating that document as editable and the UI SHALL fall back to the normal missing/forbidden state.
4. WHEN mention notifications are sent from a collaborative editor, THEN the system SHALL flush canonical content before mention validation occurs.

Negative Cases
1. WHEN PartyKit session state is lost, THEN the document SHALL still be recoverable from Convex.
2. WHEN canonical persistence fails, THEN the app SHALL NOT silently claim the document is durably saved.

### REQ-DATA-001: Canonical document schema and business invariants remain in Convex
Source Design Decisions:
- DES-002
- DES-003

Priority: High

Rationale:
- Existing document lifecycle, sanitation, mention validation, and typed error behavior already live at the Convex/app boundary and should remain authoritative.

Requirement:
- THE system SHALL keep durable document content, document lifecycle rules, and rich-text sanitation anchored to Convex-backed persistence and existing application boundaries rather than moving those concerns into the collaboration provider.

Verification Method:
- Schema, integration, and compatibility verification

Risk if Unmet:
- Data corruption, inconsistent behavior across editing paths, and provider lock-in become much more likely.

Acceptance Criteria
1. WHEN collaborative content is persisted, THEN the persisted canonical representation SHALL remain compatible with existing document consumers that read `documents.content`.
2. WHEN a collaborative persist path writes document content, THEN sanitation and existing typed error semantics SHALL remain enforced.
3. WHEN delete cascades run, THEN canonical document deletion SHALL remain the authority for related cleanup behavior.

Negative Cases
1. WHEN PartyKit storage is cleared, THEN this SHALL NOT delete or corrupt canonical document data.
2. WHEN a persistence path tries to bypass existing document-safe boundaries, THEN that path SHALL be considered invalid for rollout.

### REQ-FUNC-004: Scoped invalidation replaces monolithic snapshot synchronization across snapshot-backed app surfaces
Source Design Decisions:
- DES-001
- DES-005
- DES-007

Priority: High

Rationale:
- The current global snapshot model is too coarse and directly conflicts with the repo’s target-state architecture.

Requirement:
- THE system SHALL replace global full-snapshot synchronization with scoped invalidation and scoped refetch across the current snapshot-backed app surfaces, while preserving bounded HTTP bootstrap and full resync as a recovery path.

Verification Method:
- Integration and end-to-end verification

Risk if Unmet:
- The app keeps paying the cost of whole-store replacement and may simply reimplement the same problem on a new transport.

Acceptance Criteria
1. WHEN a document, work item, project, notification, conversation, channel, view, settings/admin, or search-seed surface changes, THEN only the affected scoped read model SHALL require refetch rather than a full app snapshot replacement.
2. WHEN shell-level bootstrap data is required, THEN the shell SHALL still load through a bounded HTTP bootstrap path rather than a whole-app data graph replacement.
3. WHEN the client reconnects or detects drift, THEN it SHALL still have an HTTP-based full recovery path.

Negative Cases
1. WHEN a document collaboration event occurs, THEN it SHALL NOT force a full app snapshot reload by default.
2. WHEN a scoped invalidation route is used for a normal app surface, THEN it SHALL NOT require a websocket room to function.

### REQ-FUNC-005: Shell bootstrap remains bounded and migration remains additive
Source Design Decisions:
- DES-001
- DES-005
- DES-007

Priority: High

Rationale:
- The current system cannot cut over every surface at once, so the migration must preserve a safe coexistence period.

Requirement:
- THE system SHALL preserve a bounded shell/bootstrap path and SHALL allow legacy and scoped-sync paths to coexist during migration without forcing a single cutover.

Verification Method:
- Integration, compatibility, and rollback verification

Risk if Unmet:
- Cross-cutting rollout becomes brittle and rollback becomes unsafe.

Acceptance Criteria
1. WHEN only some capability surfaces are migrated, THEN non-migrated surfaces SHALL continue to function on the legacy path.
2. WHEN the app starts, THEN shell bootstrap SHALL remain available without requiring every capability surface to have already migrated.
3. WHEN a migrated scoped-sync surface fails, THEN the system SHALL have a documented and testable fallback/rollback path.

Negative Cases
1. WHEN the global snapshot path still exists during migration, THEN new collaborative/editor paths SHALL NOT rely on it as their primary realtime mechanism.
2. WHEN a screen migrates, THEN it SHALL NOT continue depending on incidental global `replaceDomainData(snapshot)` semantics for that surface’s core freshness behavior.

### REQ-FUNC-007: Every current snapshot-backed surface maps to an explicit target read model and transport
Source Design Decisions:
- DES-001
- DES-005
- DES-007

Priority: High

Rationale:
- If the spec leaves some surfaces unassigned, the repo can drift back into partial migration with a hidden global snapshot dependency.

Requirement:
- THE system SHALL assign every current snapshot-backed product surface to an explicit target read model and a target transport pattern of `HTTP bootstrap`, `SSE invalidation + refetch`, or `PartyKit + Yjs` where collaboration genuinely requires it.

Verification Method:
- Design, integration, and compatibility verification

Risk if Unmet:
- Some surfaces remain implicitly coupled to the monolithic snapshot, making the migration incomplete and confusing.

Acceptance Criteria
1. WHEN reviewing the migration plan, THEN shell/bootstrap, memberships/admin, work, work item detail, documents, projects, views, notifications, chats, channels, and search seed surfaces SHALL each have an explicit target model and transport.
2. WHEN a surface remains on `SSE + refetch`, THEN the spec SHALL state that it is intentionally not using PartyKit/WebSockets for that surface.
3. WHEN a surface uses `PartyKit + Yjs`, THEN the spec SHALL state why bidirectional session behavior is required for that surface.
4. WHEN comparing the target plan to the current `selectAppDataSnapshot(...)` state shape, THEN every current snapshot-backed domain SHALL map to at least one explicit target read model rather than remaining an implicit residual bucket.

Negative Cases
1. WHEN a product surface is currently snapshot-backed, THEN it SHALL NOT be left as an implicit “later” migration bucket without a target-state assignment.
2. WHEN a transport is chosen for a surface, THEN it SHALL NOT be justified only by convenience if the product behavior does not require it.
3. WHEN a concrete snapshot-backed domain such as labels, milestones, comments, attachments, project updates, calls, or channel/thread data is only implied by a broader surface name, THEN the design SHALL still make its ownership explicit.

### REQ-FUNC-006: Migrated collaborative editor surfaces preserve existing editing capabilities
Source Design Decisions:
- DES-004
- DES-008

Priority: High

Rationale:
- A collaboration rollout that regresses current editing behavior would create a product regression even if the realtime architecture is sound.

Requirement:
- THE system SHALL preserve the existing user-visible editing capabilities on migrated document and work item description surfaces, including formatting controls, mention insertion/counting behavior, slash-command behavior where currently enabled, attachment/image insertion flows, and current title synchronization semantics.

Verification Method:
- Component, integration, and end-to-end verification

Risk if Unmet:
- Users lose existing editing functionality on the very surfaces being upgraded, creating adoption and support problems.

Acceptance Criteria
1. WHEN a standalone document surface migrates to collaboration mode, THEN the migrated editor SHALL preserve the existing formatting and title-edit behavior expected on that surface.
2. WHEN mentions are inserted or removed in collaboration mode, THEN mention counting and mention-notification preparation behavior SHALL remain compatible with the current product flow.
3. WHEN a migrated surface currently supports attachment or image insertion, THEN that insertion flow SHALL continue to function in collaboration mode.
4. WHEN slash commands are enabled on a migrated surface today, THEN they SHALL remain available after migration unless explicitly removed by a separate product decision.

Negative Cases
1. WHEN collaboration mode is enabled, THEN the surface SHALL NOT silently drop existing editor capabilities just because the transport changed.
2. WHEN a capability cannot yet be preserved safely, THEN the surface SHALL NOT be considered rollout-ready until the gap is resolved or explicitly descoped by a separate design decision.

### REQ-SEC-001: Collaboration authorization is app-issued and least-privilege
Source Design Decisions:
- DES-002
- DES-006

Priority: High

Rationale:
- PartyKit must not become a second authorization authority or a bypass around existing access control.

Requirement:
- THE system SHALL issue short-lived collaboration credentials from the app after normal auth and access checks and SHALL limit those credentials to the minimum claims necessary for the specific room/session.

Verification Method:
- Unit, integration, and security verification

Risk if Unmet:
- Unauthorized editing or room access becomes possible.

Acceptance Criteria
1. WHEN a user requests a collaboration session, THEN the app SHALL verify normal document/workspace/team access before issuing room credentials.
2. WHEN PartyKit validates a session, THEN it SHALL rely on app-issued claims rather than creating an independent authorization model.
3. WHEN a user loses access, THEN future collaboration session requests SHALL be denied.

Negative Cases
1. WHEN a token is presented for the wrong room, THEN the room join SHALL fail.
2. WHEN a token is expired or malformed, THEN the room join SHALL fail without granting editor state.

### REQ-SEC-002: Internal provider callbacks are separately authenticated
Source Design Decisions:
- DES-003
- DES-006

Priority: Medium

Rationale:
- Provider-to-app callbacks for bootstrap and persistence cross a trust boundary and should not rely on public auth alone.

Requirement:
- THE system SHALL protect PartyKit-to-app internal endpoints with dedicated server-to-server authentication separate from end-user session credentials.

Verification Method:
- Integration and security verification

Risk if Unmet:
- Internal bootstrap/persist endpoints become an attack surface.

Acceptance Criteria
1. WHEN PartyKit calls an internal bootstrap or persist endpoint, THEN the endpoint SHALL require an internal trust credential.
2. WHEN that internal credential is absent or invalid, THEN the endpoint SHALL reject the request.

Negative Cases
1. WHEN a browser or third party hits an internal collab endpoint directly without the internal credential, THEN the request SHALL fail.

### REQ-NFR-001: Collaboration session performance stays within bounded targets
Source Design Decisions:
- DES-001
- DES-002
- DES-005

Priority: Medium

Rationale:
- A collaboration system that is correct but slow will still fail adoption and increase support burden.

Requirement:
- THE system SHALL meet bounded latency and batching targets for collaborative session join, cold rehydrate, and canonical flush cadence.

Target Metrics:
- warm room join p95 <= `1000ms`
- cold room rehydrate-to-editable p95 <= `2000ms`
- canonical steady-state flush rate <= `1 flush / 3s / active room`

Verification Method:
- Performance and operational verification

Risk if Unmet:
- Users experience laggy joins, expensive write amplification, or unstable editing behavior.

Acceptance Criteria
1. WHEN a warm room is joined under normal conditions, THEN p95 join latency SHALL remain within target.
2. WHEN a cold room is rehydrated from canonical content, THEN p95 rehydrate latency SHALL remain within target.
3. WHEN users type continuously, THEN canonical persistence SHALL remain batched within the target cadence.

Negative Cases
1. WHEN one user types rapidly, THEN the app SHALL NOT persist every keystroke as an independent canonical write.

### REQ-NFR-002: Scoped invalidation lag remains bounded for migrated surfaces
Source Design Decisions:
- DES-001
- DES-005

Priority: Medium

Rationale:
- Scoped sync only improves the user experience if invalidation and refetch stay timely.

Requirement:
- THE system SHALL keep scoped invalidation visibility and refetch behavior within bounded lag targets for migrated surfaces under the initial SSE-based transport.

Target Metrics:
- invalidation visibility target p95 <= `3s`
- migrated-surface scoped refetch failure rate < `1%`

Verification Method:
- Performance and operational verification

Risk if Unmet:
- The app becomes stale in more subtle ways than the current snapshot path.

Acceptance Criteria
1. WHEN a migrated scoped surface changes, THEN connected clients SHALL observe invalidation within the target lag.
2. WHEN invalidation is observed, THEN the affected scope SHALL refetch without requiring full app reload.

Negative Cases
1. WHEN the scoped invalidation path fails, THEN the client SHALL retain an HTTP recovery path instead of silently staying stale.

### REQ-OPS-001: Observability, rollout safety, and rollback support are mandatory
Source Design Decisions:
- DES-002
- DES-005
- DES-007

Priority: High

Rationale:
- This change is both architectural and operational; without visibility and staged fallback, the rollout risk is too high.

Requirement:
- THE system SHALL emit collaboration and scoped-sync operational signals and SHALL support additive rollout and safe rollback at the capability level.

Verification Method:
- Operational and rollback verification

Risk if Unmet:
- Failures become hard to detect, and rollback may require emergency code changes.

Acceptance Criteria
1. WHEN collaboration rooms are joined, rehydrated, flushed, or tombstoned, THEN those transitions SHALL be observable in logs and/or metrics.
2. WHEN scoped invalidation is emitted or consumed, THEN the system SHALL expose enough signal to diagnose lag or refetch failures.
3. WHEN a capability rollout is aborted, THEN the app SHALL be able to return that capability to the legacy path without requiring a same-day architectural rewrite.

Negative Cases
1. WHEN a migration phase is active, THEN the team SHALL NOT rely solely on ad hoc manual browser testing as the only release signal.

## Traceability Matrix
- DES-001 -> REQ-FUNC-001, REQ-FUNC-002, REQ-FUNC-004, REQ-FUNC-005, REQ-FUNC-007, REQ-NFR-001, REQ-NFR-002
- DES-002 -> REQ-FUNC-001, REQ-FUNC-003, REQ-DATA-001, REQ-SEC-001, REQ-NFR-001, REQ-OPS-001
- DES-003 -> REQ-FUNC-003, REQ-DATA-001, REQ-SEC-002
- DES-004 -> REQ-FUNC-001, REQ-FUNC-002, REQ-FUNC-006
- DES-005 -> REQ-FUNC-004, REQ-FUNC-005, REQ-FUNC-007, REQ-NFR-001, REQ-NFR-002, REQ-OPS-001
- DES-006 -> REQ-FUNC-001, REQ-SEC-001, REQ-SEC-002
- DES-007 -> REQ-FUNC-004, REQ-FUNC-005, REQ-FUNC-007, REQ-OPS-001
- DES-008 -> REQ-FUNC-006
