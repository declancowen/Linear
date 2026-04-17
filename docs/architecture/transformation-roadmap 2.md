# Transformation Roadmap

## Purpose

This document converts the target-state architecture and gap matrix into an execution roadmap.

It is designed to move `Linear` from the current `65 / 100` architecture score toward a `95+ / 100` operating standard while preserving the frontend-backend relationship throughout the transformation.

## Guiding rule

The roadmap is governed by the compatibility contract in [target-state-architecture.md](/Users/declancowen/Documents/GitHub/Linear/docs/architecture/target-state-architecture.md):

- additive before subtractive
- old and new paths can coexist during migration
- frontend changes happen behind stable selectors and gateways
- contract and integration tests validate each boundary before removals

## Baseline

| Measure | Value |
|--------|--------|
| Current architecture score | `65 / 100` |
| Practical target | `95+ / 100` |
| Design aspiration | `100 / 100` |
| Deployment target | `Disciplined modular monolith` |

## Transformation sequence

| Phase | Stream | Why first | Expected score band after phase |
|--------|--------|--------|--------|
| `0` | Compatibility foundation | makes later change safe | `65-68` |
| `1` | Contract | fixes the truthfulness of boundaries | `72-76` |
| `2` | Ownership | fixes tenant and schema correctness | `78-82` |
| `3` | Read-model | removes structural hot-path debt | `84-89` |
| `4` | Lifecycle | centralizes privacy and identity-critical behavior | `89-92` |
| `5` | Governance | makes the architecture durable and trustworthy | `93-96` |

## Phase 0: Compatibility Foundation

### Objective

Create the migration guardrails so the architecture can evolve without breaking the frontend/backend contract.

### Required end state

- stable frontend-facing selector and gateway surfaces exist for high-risk capability areas
- contract tests exist for auth context, membership, work items, docs, chat, notifications, and lifecycle actions
- old and new backend contracts can run in parallel where migration is required

### Repo direction

- add shared backend contract fixtures for critical routes and server helpers
- define stable UI-facing gateways around:
  - auth context
  - snapshot/bootstrap access
  - work items
  - documents
  - chat/calls
  - lifecycle actions
- add explicit migration rules for response-shape and DTO evolution

### Acceptance criteria

- no high-risk frontend surface depends directly on incidental backend shapes
- critical frontend-backend contracts have regression tests
- future phases can introduce new paths without forced cutover

## Phase 1: Contract

### Objective

Make the application boundary truthful and intentional.

### Closes

- `S1-01`
- `A3-12`
- `A3-13`

### Required end state

- typed application errors with stable codes and HTTP mapping
- narrow commands for narrow user actions
- routes become thin adapters over command/query contracts
- content-security boundary is centralized for all rich-text writes

### Repo direction

- introduce application-level result/error types
- replace message-only Convex failure propagation with typed outcomes
- align routes with dedicated commands instead of snapshot-assisted writes
- create one safe content module for sanitize-on-write and safe render rules

### Acceptance criteria

- expected domain failures no longer surface as generic `500`s
- join-code regeneration, chat-call start, and similar narrow actions use narrow commands
- hostile rich-text payloads fail or sanitize consistently across all surfaces

## Phase 2: Ownership

### Objective

Make schema scope and tenant ownership explicit everywhere.

### Closes

- `S1-02`
- `A3-11` in its tenancy dimension

### Required end state

- mutable entities have explicit ownership class
- scope-aware indexes exist for core entities
- cross-tenant mutation and read leakage becomes structurally impossible

### Repo direction

- workspace-scope labels
- add missing scope/target indexes for:
  - projects
  - documents
  - views
  - comments
  - project updates
  - any other hot capability tables lacking scope-aligned indexes
- move scope-sensitive data access behind shared helpers

### Acceptance criteria

- no mutable business entity behaves as accidental global state
- high-value reads and cleanup flows have matching schema indexes
- tenant ownership is visible in schema, not inferred in handlers

## Phase 3: Read-model

### Objective

Replace giant default snapshot dependence on hot paths with scoped, capability-oriented reads.

### Closes

- `O1-04`
- `O1-05`
- `A3-11` in its read-shape dimension

### Required end state

- shell bootstrap is small and bounded
- chat, docs, work, notifications, and search read through scoped models
- whole-table scans disappear from hot user-facing flows by design

### Repo direction

- keep a minimal shell bootstrap if needed
- introduce capability read models:
  - shell context
  - membership
  - work index/detail
  - document index/detail
  - conversation thread
  - channel feed
  - notification inbox
- migrate one capability at a time behind stable selectors/gateways

### Acceptance criteria

- narrow route actions no longer call full snapshot for auth or lookup
- global search no longer recomputes over the whole store on every change
- p95 read latency and payload budgets are measurable and bounded

## Phase 4: Lifecycle

### Objective

Turn lifecycle, privacy, deletion, and external identity reconciliation into a first-class subsystem.

### Closes

- `S2-09`
- `S2-10`

### Required end state

- one lifecycle policy surface governs membership changes, removal, deletion, anonymization, retention, and reconciliation
- shared artifacts are retained intentionally
- private artifacts are deleted intentionally
- local state and WorkOS state reconcile symmetrically

### Repo direction

- create dedicated lifecycle commands/policies for:
  - remove workspace user
  - leave workspace
  - remove team member
  - delete account
  - anonymize retained authorship
  - revoke/deactivate org membership
- add compensation and retry semantics for provider-side failures

### Acceptance criteria

- deleted users render as anonymized identity on retained shared history
- private docs and avatar storage are removed
- external org membership is revoked or deactivated consistently
- lifecycle operations are retry-safe and fully tested

## Phase 5: Governance

### Objective

Make the architecture durable under continuous change.

### Closes

- `S1-03`
- `O1-06`
- `S1-07`
- `O1-08`

### Required end state

- quality gates are trustworthy
- browser hardening is versioned and tested
- dependency and framework security has an explicit operating model
- observability and auditability exist for high-risk actions

### Repo direction

- formalize source-only lint/test/build contracts
- add coverage and integration thresholds for critical paths
- add security header policy with smoke validation
- add dependency-security governance for framework and auth stack
- add structured audit events and key route/command telemetry

### Acceptance criteria

- local and CI quality gates agree on what counts as source
- high-risk flows are covered by integration and contract tests
- security-sensitive changes emit auditable events
- dependency drift is visible before it becomes a vulnerability

## Migration discipline

### Mandatory rules for every phase

1. Introduce the new contract or path first.
2. Keep existing frontend callers stable during migration.
3. Move selectors, gateways, and route adapters incrementally.
4. Validate parity with contract and integration tests.
5. Remove old shapes only after verified non-use.

### Forbidden shortcuts

- replacing the snapshot model with a big-bang cutover
- changing route error shapes without compatibility coverage
- widening write commands because route code finds narrow commands inconvenient
- schema changes without ownership and index review
- provider-side mutations without compensation paths

## Score interpretation

| State | Meaning |
|--------|--------|
| `65-70` | workable but drifting architecture |
| `72-82` | boundaries becoming truthful and tenant-safe |
| `84-89` | hot reads and commands aligned with architecture |
| `89-92` | lifecycle and privacy model governed correctly |
| `93-96` | operationally trustworthy, durable modular monolith |
| `97-100` | aspirational design standard; maintained through strong governance, not a one-time cleanup |

## Final position

This roadmap aims at `100` as the design standard and `95+` as the expected durable operating state.

The correct strategic move is not to distribute the system prematurely. It is to make the monolith disciplined enough that future extraction is optional rather than necessary.
