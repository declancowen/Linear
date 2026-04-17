# Transformation Roadmap

## Purpose

This document converts the target-state architecture and gap matrix into an execution roadmap.

It is designed to move `Linear` from the current `97 / 100` architecture score toward a `97-98 / 100` operating standard while preserving the frontend-backend relationship throughout the transformation.

## Guiding rule

The roadmap is governed by the compatibility contract in [target-state-architecture.md](/Users/declancowen/Documents/GitHub/Linear/docs/architecture/target-state-architecture.md):

- additive before subtractive
- old and new paths can coexist during migration
- frontend changes happen behind stable selectors and gateways
- contract and integration tests validate each boundary before removals

## Baseline

| Measure | Value |
|--------|--------|
| Current architecture score | `97 / 100` |
| Practical target | `97-98 / 100` |
| Design aspiration | `100 / 100` |
| Deployment target | `Disciplined modular monolith` |

## Current execution position

The original roadmap phases remain useful as the historical transformation path, but the repo is now operating from a later position.

The mandatory work left is no longer broad architectural cleanup. It is the final set of structural and operational streams needed to turn the current repo into a fully governed target-state monolith.

Phase A is now materially complete:

- auth/provider routes no longer log raw WorkOS error objects directly
- provider-boundary logging is pinned by route-level regression coverage

Phase B is now materially complete:

- CI enforces Convex codegen freshness
- CI enforces the high-severity dependency audit policy
- the repo owns a deployment/migration runbook for privileged scripts and smoke expectations

Phase C is now materially complete:

- notification digest delivery is claim-safe under overlapping runners
- invite, mention, assignment, and access-change email families now queue through the durable email outbox
- the owned email worker claims, sends, marks, and releases jobs with observable failure state

Phase D is now partially complete:

- the join route no longer loads the full snapshot to authorize or locate call state
- call join now runs through a narrow join-context query and canonical finalize mutation
- the public `GET` redirect remains as a compatibility surface for existing links

Phase E is now in progress:

- several narrow workspace/team/document/item mutations now apply local command results instead of waiting for an immediate full snapshot refetch
- failure reconciliation now rolls back locally and refreshes in the background instead of blocking user actions on a full snapshot round-trip
- onboarding workspace creation now reloads into a fresh shell bootstrap instead of fetching the full snapshot inline before navigation

## Remaining mandatory streams

| Stream | Why it is still mandatory |
|--------|--------|
| `Read architecture` | the client/store contract is still snapshot-first at the provider/bootstrap layer and still uses broad graph replacement as the default sync model |
| `Write and command architecture` | the call-join flow no longer uses the full snapshot, but the public compatibility path is still a stateful `GET` redirect |
| `Verification and governance architecture` | CI now enforces codegen freshness and high-severity dependency audit policy, but coverage floors and stronger architecture budgets are still not codified |
| `Deployment and migration architecture` | the repo owns a runbook, but scheduling/release ownership for privileged scripts is still partly out-of-band |
| `Desktop/runtime architecture` | packaged-runtime smoke exists, but Electron packaging, signing, update, and release ownership are still not repo-governed |

## Final execution plan

This is the dependency-ordered plan from the current `97 / 100` state to the expected `97-98 / 100` state.

| Phase | Stream | Why now | Expected score band after phase |
|--------|--------|--------|--------|
| `A` | Identity and provider boundary | completed | `94` |
| `B` | Verification, governance, and deployment foundation | materially complete; remaining work is broader coverage/budget governance rather than missing foundation | `95` |
| `C` | Side-effect and job architecture | materially complete; digest delivery and repo-owned outbound email families now run through claim-safe workers | `97` |
| `D` | Write and command architecture | in progress; the snapshot-backed join flow is gone, but the compatibility `GET` still exists | `96-97` |
| `E` | Read architecture | in progress; local command application is broader, but provider/bootstrap sync is still snapshot-first | `97` |
| `F` | Desktop/runtime architecture | turns Electron into a governed supported release lane | `97-98` |

## Phase A: Identity And Provider Boundary

### Objective

Remove the remaining raw-provider logging and make auth/provider diagnostics consistent with the rest of the backend boundary.

### Closes

- `S6-20`

### Required end state

- auth routes use sanitized provider diagnostics instead of raw provider objects
- WorkOS logging follows one governed error contract
- provider-boundary debugging remains useful without leaking temporary payload details

### Acceptance criteria

- no `app/auth/*` route logs raw WorkOS error objects directly
- auth/provider failures are diagnosable through a shared sanitized helper

## Phase B: Verification, Governance, And Deployment Foundation

### Objective

Make the remaining transformation streams executable and trustworthy through repo-owned automation and release discipline.

### Closes

- `O4-16`
- `O4-17` in its CI/runbook/foundation dimension

### Required end state

- CI asserts Convex codegen freshness
- verification expectations for critical suites are explicit
- privileged scripts and migrations have documented ownership and safe invocation expectations
- release and migration choreography are repo-governed rather than mostly procedural

### Acceptance criteria

- CI can fail on generated-contract drift
- architecture-critical test expectations are codified
- maintenance, sync, and bootstrap surfaces have declared runbooks and ownership

## Phase C: Side-Effect And Job Architecture

### Objective

Move external email and digest delivery from inline best-effort work to a durable, claim-safe job model.

### Closes

- `A4-15`

### Required end state

- notification digests are claim-safe under concurrent execution
- outbound emails move through an outbox or equivalent governed job contract
- retry, replay, and operator-visible failure state exist for important side effects

### Acceptance criteria

- digest delivery cannot double-send under overlapping runners by design
- core email side effects are decoupled from request latency
- failed jobs are observable and recoverable

## Phase D: Write And Command Architecture

### Objective

Finish the remaining narrow-action contract cleanup by replacing the legacy snapshot-backed call-join path.

### Closes

- `A4-14`

### Required end state

- call join is modeled as a narrow command or prepared contract
- room provisioning is idempotent
- browser interaction no longer depends on a mutating snapshot-backed `GET`

### Acceptance criteria

- call join no longer reads the full snapshot for authorization or lookup
- room creation is structurally claim-safe / idempotent
- HTTP semantics tell the truth about the action

## Phase E: Read Architecture

### Objective

Complete the read-model refactor by retiring the large shared snapshot as the primary client contract.

### Closes

- `A5-18`

### Required end state

- shell bootstrap is bounded and intentionally small
- capability surfaces read through scoped models
- the store no longer depends on broad `replaceDomainData(snapshot)` semantics as the default sync model

### Acceptance criteria

- high-churn surfaces no longer depend on the monolithic snapshot contract
- `/api/snapshot` is bootstrap-oriented if retained at all
- store synchronization aligns with scoped capability ownership

## Phase F: Desktop/Runtime Architecture

### Objective

Turn Electron from a local runtime mode into a governed release lane.

### Closes

- `A6-19`
- `O4-17` in its desktop/runtime dimension

### Required end state

- packaging/signing/update ownership is explicit
- desktop startup and packaged-runtime smoke validation exist
- Electron release expectations are repo-governed

### Acceptance criteria

- the repo defines how desktop is packaged, signed, and updated
- desktop startup regressions are detectable before release
- Electron remains the governed current platform unless a future dedicated migration plan says otherwise

## Desktop platform decision

For this repo, the desktop plan stays on `Electron`.

This is the correct move for the current architecture because:

- desktop already runs as a governed shell around the existing web application
- the repo still has higher-value work in read models, command contracts, side-effect jobs, and governance
- switching desktop platforms now would be a product/runtime migration, not a simple refactor

`Tauri` is a possible future platform decision, but only if the team later decides to re-architect desktop around a native core on purpose. It is not part of the current transformation roadmap.

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

## Cross-cutting mandatory stream: Desktop/runtime

This stream runs in parallel with the main phases because desktop is a supported runtime and must meet the same architectural standard.

### Objective

Make Electron a governed product runtime instead of an implicit wrapper.

### Required end state

- preload and renderer trust boundaries remain minimal and explicit
- desktop startup and packaged-runtime assumptions are documented and validated
- packaging, signing, update, and release expectations are repo-governed
- desktop smoke validation exists in CI or release automation

### Repo direction

- keep desktop on Electron for the current roadmap
- add explicit smoke checks for `desktop:start` and packaged startup where feasible
- define desktop release, signing, and update ownership
- keep IPC/preload surface intentionally narrow

### Acceptance criteria

- desktop startup regressions are detectable before release
- desktop release/update behavior is documented and owned
- desktop runtime does not bypass web/application contracts

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

This roadmap aims at `100` as the design standard and `97-98` as the expected durable operating state from the current repo position.

The correct strategic move is not to distribute the system prematurely. It is to make the monolith disciplined enough that future extraction is optional rather than necessary.
