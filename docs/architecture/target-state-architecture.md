# Target-State Architecture

## Purpose

This document defines the target-state architecture for `Linear`.

The aim is to design for `100 / 100`, while recognizing that a system operating at `95+` with discipline is already excellent. The goal is not architectural theater. The goal is a system that is:

- secure
- tenant-safe
- operationally credible
- easy to evolve
- extraction-ready if a future service boundary becomes justified

## Target score

| Measure | Target |
|--------|--------|
| Design aspiration | `100 / 100` |
| Practical operating standard | `95+ / 100` |
| Current preferred deployment shape | `Disciplined modular monolith` |
| Default distribution stance | `Do not split into microservices by default` |

## Executive position

The target state for this repo is **not** a microservice architecture.

The target state is a **governed modular monolith** with:

- explicit ownership and tenancy in the schema
- scoped read models instead of a giant default snapshot
- narrow, intention-revealing command and query contracts
- centralized lifecycle, privacy, and retention policy
- typed backend errors with truthful HTTP semantics
- strong operational controls, verification, and architectural governance

Microservices are an **optional future extraction mechanism**, not the desired end state for this phase of the product.

## Non-negotiable architectural principles

1. Every mutable entity must have explicit ownership and scope.
2. Every hot read must be index-backed and scope-aware.
3. Every write must express business intent, not generic record mutation.
4. Every lifecycle rule must live in one policy surface, not across unrelated handlers.
5. Every HTTP response must preserve semantic truth about the failure mode.
6. Every external side effect must be reconciled as part of the application contract.
7. Every boundary must be real enough that future extraction would be straightforward.
8. Frontend and backend contracts must evolve compatibly, not through breaking cutovers.
9. Every high-risk path must be observable and testable.

## Target architecture shape

### Deployment

- `Next.js` remains the web and route shell.
- `Convex` remains the system of record and real-time backend.
- `WorkOS`, `Resend`, and `100ms` remain edge integrations behind adapters.
- `Electron` remains a shell over the web app, not an independent business surface.

### Internal shape

The repo should behave like a capability-oriented modular monolith with clear dependency direction:

`presentation -> application contract -> domain policy -> persistence/integration`

### Target-state dependency rules

| Layer / module | Owns | May depend on | Must not depend on |
|--------|--------|--------|--------|
| `app/` | routes, pages, request/response adaptation | `components/`, `lib/domain/`, `lib/application/`, `lib/server/` | `convex/app/*` internals |
| `components/` | rendering, interaction, local UI state | `lib/domain/` selectors and UI-safe contracts | `lib/server/`, provider SDKs |
| `lib/domain/` | pure models, selectors, invariants, policy vocabulary | pure TypeScript only | framework and provider code |
| `lib/application/` | command/query DTOs, error codes, boundary contracts | `lib/domain/` | UI and provider SDKs |
| `lib/server/` | HTTP adapters, provider adapters, command/query gateways | `lib/application/`, provider SDKs, generated Convex client | UI modules |
| `convex/app/` | authoritative business behavior and persistence orchestration | `lib/domain/`, `lib/application/` contracts | `app/`, `components/` |
| `scripts/` | operational entrypoints | same command/query gateways as routes | bespoke bypass logic |

## Target-state repo organization

The exact folder names can evolve, but the conceptual shape should converge toward this:

```text
app/
  api/
  (workspace)/
components/
lib/
  domain/
  application/
  server/
    convex/
    providers/
    http/
convex/
  app/
    commands/
    queries/
    lifecycle/
    collaboration/
    work/
    access/
    data/
docs/
  architecture/
```

## Read architecture

### Target state

The system should stop treating one giant snapshot as the default backend read model.

Instead:

- a **small shell bootstrap** loads identity, current workspace selection, and minimal navigation context
- each capability owns its own **scoped read model**
- high-churn surfaces subscribe or query independently by capability and scope

### Required read models

- `ShellContextReadModel`
- `WorkspaceMembershipReadModel`
- `WorkIndexReadModel`
- `WorkItemDetailReadModel`
- `DocumentIndexReadModel`
- `DocumentDetailReadModel`
- `ConversationThreadReadModel`
- `ChannelFeedReadModel`
- `NotificationInboxReadModel`

### Read rules

1. No route may read the full snapshot to authorize a narrow action.
2. No hot query may rely on whole-table `collect()` plus local filtering by default.
3. Every read model must declare:
   - scope
   - freshness expectation
   - required indexes
   - allowed row volume
4. The shell snapshot, if retained, must be bootstrap-oriented and bounded in size.

## Write architecture

### Target state

Writes must be **intentful commands**, not generic patch surfaces.

Good examples of the target pattern:

- `RegenerateTeamJoinCode`
- `StartChatCall`
- `RemoveWorkspaceUser`
- `LeaveWorkspace`
- `DeleteCurrentAccount`
- `UpdateProjectStatus`
- `AssignWorkItem`

Bad examples of the target pattern:

- broad `update*` commands used for narrow actions
- routes rebuilding write payloads from snapshots
- clients inferring business workflow from raw record shape

### Command rules

1. Each command must express one business intent.
2. Each command must own all required side effects for that intent.
3. Each command must be idempotent when external systems are involved.
4. Each command must return typed outcomes, not message-only failures.

## Data and schema target state

### Ownership model

Every mutable entity must be explicitly one of:

- `workspace-owned`
- `team-owned`
- `personal`
- `platform-global` only when genuinely immutable reference data

### Schema rules

1. No mutable business entity may be effectively global unless that is intentional and safe.
2. All tenant-relevant entities must encode scope directly in the schema.
3. Every table must have indexes aligned with its primary read and cleanup paths.
4. Every cross-entity reference must be valid within the same ownership boundary unless explicitly modeled otherwise.

### Required schema moves

- labels become explicitly workspace-scoped
- documents gain indexes for workspace, team, creator, and kind-driven lookups
- projects and views gain scope-aware indexes
- comments, attachments, and related activity tables gain target-aware access patterns wherever missing
- lifecycle-sensitive records gain actor- and scope-oriented auditability

## Lifecycle, privacy, and retention subsystem

### Target state

Lifecycle behavior becomes a first-class subsystem, not an accidental side effect of several handlers.

This subsystem owns:

- workspace membership changes
- team membership changes
- workspace leave/remove flows
- account deletion
- anonymization
- retention
- external identity reconciliation
- compensation and retry behavior

### User lifecycle states

- `active`
- `pending_deletion`
- `deleted`
- `removed_from_scope`

### Retention policy

| Artifact | Target behavior |
|--------|--------|
| workspace docs | retain |
| team docs | retain |
| chat messages | retain |
| thread/channel content | retain |
| private documents | hard delete |
| personal app state | hard delete |
| avatar storage | hard delete |
| retained shared authorship | anonymize to stable deleted-user identity |
| external org membership | revoke or deactivate symmetrically |

### Lifecycle invariants

1. Shared collaborative history remains readable.
2. Deleted users do not continue to expose personal profile data.
3. Private user-owned artifacts are removed.
4. Local app state and external identity state remain reconciled.
5. All lifecycle operations are safe to retry.

## API and error contract

### Target state

The HTTP layer must tell the truth.

Every route should be a thin adapter over typed application outcomes.

### Standard error envelope

```json
{
  "code": "team_admin_required",
  "message": "Only team admins can perform this action",
  "details": {},
  "retryable": false
}
```

### Required status mapping

- `400` validation failure
- `401` authentication required
- `403` permission denied
- `404` resource not found
- `409` conflict / invariant violation
- `412` failed precondition
- `429` throttling
- `502` upstream integration failure
- `503` temporary dependency unavailability
- `500` unexpected internal fault only

### Route rules

1. `app/api` may adapt protocol, but must not embed business policy drift.
2. Route handlers may not reconstruct wide write payloads from read snapshots.
3. Narrow route actions must call narrow command surfaces.
4. The route layer must never be the only place where authorization is enforced.

## Frontend-backend compatibility contract

### Target state

The relationship between frontend and backend must remain stable while the architecture evolves.

This repo should move toward scoped read models, typed commands, and stricter contracts without breaking the UI through abrupt boundary changes.

### Compatibility rules

1. Backend contract changes must be additive before they are subtractive.
2. Existing frontend callers must continue to work during migrations unless an explicit coordinated cutover is approved.
3. New scoped read models should be introduced alongside existing snapshot surfaces, then adopted incrementally behind stable selectors and gateways.
4. Command and query DTOs must be versioned by shape discipline, even if not by explicit URL versioning.
5. Store and selector migrations must happen behind stable UI-facing contracts, not through component-by-component backend coupling.
6. Contract tests must exist for every critical frontend-backend boundary: auth context, workspace membership, work item flows, docs, chat, notifications, and lifecycle actions.
7. Removal of old fields, routes, or response shapes happens only after usage is eliminated and verified.

### Migration stance

The default migration pattern is:

- introduce new contract
- run old and new paths in parallel
- adapt frontend selectors/gateways
- verify behavior with contract and integration tests
- remove old contract last

This rule applies especially to:

- snapshot decomposition
- route error-shape changes
- lifecycle and permission flows
- command/query DTO changes
- data ownership and schema migrations

## Provider and integration model

### Target state

All provider integrations are edge adapters behind application contracts.

This applies to:

- `WorkOS`
- `Resend`
- `100ms`
- any future sync or identity providers

### Provider rules

1. Provider SDKs do not leak directly into UI or domain layers.
2. External reconciliation is part of the command contract, not a best-effort afterthought.
3. Provider failures must surface typed outcomes and compensation rules.
4. Provider drift must be measurable.

## Operational architecture

### Observability

The target state includes first-class operational telemetry for:

- command success/failure by type
- route error rate by semantic status code
- snapshot and read-model latency
- external identity reconciliation drift
- content sanitization failures
- lifecycle job retries and dead-letter conditions

### Auditability

Sensitive actions must create structured audit events:

- membership changes
- workspace deletion
- account deletion
- team role changes
- invite creation/acceptance/decline
- provider reconciliation failures

### Performance budgets

No architecture is considered complete without budgets. The target state should enforce:

- bounded shell bootstrap payload size
- bounded p95 latency for scoped reads
- zero whole-table scans on hot user-facing flows by design
- explicit large-workspace test fixtures

## Verification and governance

### Testing

The target state requires:

- integration tests for permissions and lifecycle
- contract tests for API status and error codes
- regression tests for tenant isolation
- regression tests for sanitization and content rendering
- seeded performance tests for large workspaces

### Governance rules

1. New entities may not merge without ownership and index review.
2. New routes may not merge without explicit command/query mapping.
3. New lifecycle behaviors may not merge outside the lifecycle subsystem.
4. New provider integrations may not merge without compensation and observability plans.
5. Architecture drift should be caught in review, not discovered in audits months later.

## Microservice stance

### Default rule

Do not split this system into microservices to improve the score.

That would only be justified after the monolith is already clean and only when one or more of these become true:

- materially different scale profiles by capability
- independent team ownership with separate release cadence
- meaningful fault-isolation requirements
- clear data ownership without shared persistence coupling

Until then, microservices are a risk, not an upgrade.

## What a `100 / 100` system means here

`100` is a design standard, not a promise of perfection.

For this repo, `100` means:

- no false boundaries
- no implicit tenancy
- no accidental global mutable state
- no hot-path scans by design
- no untyped domain failures crossing the boundary
- no scattered lifecycle logic
- no provider drift without detection
- no strategic behavior without verification

## Practical definition of `95+`

This repo is at `95+` when:

- the architecture follows this document in substance, not only in naming
- the scoped read model has replaced the giant snapshot on hot surfaces
- the command/query and error contracts are consistent across the backend
- lifecycle/privacy behavior is centralized and tested
- schema ownership and indexes match actual access patterns
- operations and governance controls are in place and trusted

## Strategic transformation streams

These are not tactical fixes. They are the permanent architecture streams that move the repo toward the target state:

1. **Contract stream**
   Build the typed command, query, and error surface.
2. **Read-model stream**
   Replace broad snapshot dependence with scoped, index-backed reads.
3. **Ownership stream**
   Align schema, indexes, and access paths around explicit tenancy.
4. **Lifecycle stream**
   Centralize deletion, anonymization, retention, and identity reconciliation.
5. **Governance stream**
   Add operational controls, architectural gates, and verification standards.

## Final statement

The target state for `Linear` is a `100`-standard modular monolith that can operate at `95+` in reality.

The system should be good enough that microservices become optional, not necessary.
