# Target-State Gap Matrix

## Purpose

This document maps the open findings in [full-codebase-audit-2026-04-16.md](../../.audits/full-codebase-audit-2026-04-16.md) onto the target state defined in [target-state-architecture.md](../../docs/architecture/target-state-architecture.md).

It is not a tactical bug list. It is a strategic gap map from the current repo shape to the target architecture standard.

All streams in this document are governed by the frontend-backend compatibility contract in [target-state-architecture.md](../../docs/architecture/target-state-architecture.md): additive first, parallel migration where needed, stable selectors and gateways, and removal last.

## Score position

| Measure | Value |
|--------|--------|
| Current audited architecture score | `97 / 100` |
| Practical operating target | `97-98 / 100` |
| Design aspiration | `100 / 100` |

## Strategic streams

| Stream | What it closes |
|--------|--------|
| `Contract` | typed commands, queries, and errors; truthful route semantics |
| `Read-model` | scoped, index-backed reads instead of broad snapshot dependence |
| `Write-command` | narrow command surfaces and idempotent action flows |
| `Ownership` | explicit tenancy, scope, and schema/index alignment |
| `Lifecycle` | deletion, anonymization, retention, and identity reconciliation |
| `Side-effects-jobs` | outbox, claims, retries, and external side-effect durability |
| `Identity-provider` | WorkOS/session boundary hygiene and sanitized provider handling |
| `Deployment-migration` | release choreography, runbooks, and migration/deploy ownership |
| `Governance` | operational controls, test discipline, dependency policy, and hardening |
| `Desktop-runtime` | Electron runtime hardening, release/update ownership, and smoke verification |

## Current open gap matrix

This section reflects the current open findings after the earlier refactor work landed on `main`.

| Finding | Severity | Strategic gap | Primary stream | Target-state closure condition |
|--------|--------|--------|--------|--------|
| `A5-18` | High | The provider/bootstrap and default store sync contract are still fundamentally snapshot-first, even though many narrow mutations now patch local state directly. | `Read-model` | The shell bootstrap is bounded and capability data reads independently through scoped models rather than broad graph replacement. |
| `A4-14` | Medium | The call-join flow no longer depends on the full snapshot, but the public compatibility surface is still a stateful `GET` redirect. | `Write-command` | Call join is a narrow, idempotent command/contract that does not depend on full snapshot lookup and can eventually retire the compatibility `GET`. |
| `O4-16` | Medium | CI now enforces generated-contract freshness and high-severity dependency audit policy, but still under-enforces broader architecture verification, coverage, and performance-budget policy. | `Governance` | CI enforces codegen freshness and the agreed verification/coverage posture for critical architecture paths. |
| `O4-17` | Medium | Operational entrypoints now have a repo-owned runbook and packaged-runtime smoke baseline, but scheduling and release ownership are still incomplete. | `Deployment-migration`, `Desktop-runtime` | Privileged scripts, schedules, runbooks, and desktop smoke expectations are repo-owned and explicit. |
| `A6-19` | Medium | Electron is supported in practice, but desktop packaging, signing, update, and release governance are still undefined in source control. | `Desktop-runtime` | Desktop packaging, signing, update, and smoke validation are explicitly owned and governed. |

## Historical matrix

The matrix below captures the earlier transformation gaps that drove the large refactor already completed. Most of those findings are now materially closed on `main`, but the historical mapping remains useful as architectural context.
| Finding | Severity | Strategic gap | Target-state sections | Primary stream | Target-state closure condition |
|--------|--------|--------|--------|--------|--------|
| `S1-01` | Critical | User-authored rich text crosses the write boundary as trusted HTML. | `Non-negotiable architectural principles`; `Write architecture`; `Verification and governance` | `Contract`, `Governance` | All rich text passes through one canonical content-security boundary; persisted content is safe by construction; hostile payload regression coverage exists. |
| `S1-02` | High | Labels are mutable global state instead of tenant-owned business data. | `Non-negotiable architectural principles`; `Data and schema target state`; `What a 100 / 100 system means here` | `Ownership` | Labels are explicitly workspace-owned, index-backed by scope, and impossible to read or attach outside tenant boundaries. |
| `S1-03` | Medium | Browser hardening is implicit and environment-dependent rather than repo-governed. | `Operational architecture`; `Verification and governance` | `Governance` | A versioned security-header baseline exists with tested CSP, framing, and transport policy for every runtime environment. |
| `O1-04` | High | The hottest user-facing read path is still designed around broad scans and giant snapshot assembly. | `Read architecture`; `Data and schema target state`; `Operational architecture` | `Read-model` | The shell bootstrap is bounded and hot capabilities read through scoped models with no whole-table scans by design. |
| `O1-05` | Medium | Global search is a render-time derivation over the whole in-memory app graph. | `Read architecture`; `Operational architecture` | `Read-model` | Search runs from a workspace-scoped derived read model or index with bounded query cost and predictable UI latency. |
| `O1-06` | High | Quality gates are polluted by generated artifacts, so the repo cannot trust its own green/red signals. | `Verification and governance` | `Governance` | Lint, test, and validation gates operate only on governed source and declared generated outputs, with no artifact noise. |
| `S1-07` | High | Framework security posture depends on manual dependency hygiene rather than platform governance. | `Operational architecture`; `Verification and governance` | `Governance` | Security-sensitive dependencies are governed by an explicit upgrade cadence, CI checks, and owner-backed review policy. |
| `O1-08` | Medium | High-risk architecture contracts are under-tested, so change safety depends too much on manual review. | `Verification and governance`; `Operational architecture` | `Governance` | Permissions, lifecycle, API-contract, and scale-sensitive paths are covered by integration, contract, and performance verification. |
| `S2-09` | Medium | Membership removal is symmetric in Convex but asymmetric at the external identity boundary. | `Lifecycle, privacy, and retention subsystem`; `Provider and integration model` | `Lifecycle` | Workspace membership commands reconcile local state and WorkOS state together, including revoke/deactivate and retry-safe compensation paths. |
| `S2-10` | High | Account deletion is a tombstone patch, not a governed retention and anonymization workflow. | `Lifecycle, privacy, and retention subsystem`; `Provider and integration model`; `What a 100 / 100 system means here` | `Lifecycle` | Deleted users retain shared authorship only through anonymized identity; private artifacts and avatars are removed; lifecycle behavior is centralized and idempotent. |
| `A3-11` | High | The schema is optimized for identity lookup, but the application behaves by scope, target, and capability. | `Data and schema target state`; `Read architecture` | `Ownership`, `Read-model` | Core entities have scope-aware ownership and indexes that match real read, cleanup, and access patterns across the repo. |
| `A3-12` | High | The HTTP boundary does not preserve semantic truth about domain failures. | `API and error contract`; `Non-negotiable architectural principles` | `Contract` | Routes surface typed application outcomes with stable error codes and truthful status mapping; expected domain failures are never flattened into generic `500`s. |
| `A3-13` | Medium | Narrow user actions drift through snapshots or broad mutations instead of narrow commands. | `Write architecture`; `API and error contract`; `Target-state dependency rules` | `Contract` | Every narrow route action maps to a narrow command surface; routes stop reconstructing write payloads from snapshots or broad update contracts. |

## Stream view

### `Contract`

- `S1-01`: establish a canonical safe content boundary
- `A3-12`: introduce typed application errors and truthful route semantics
- `A3-13`: align narrow HTTP actions with narrow backend commands

**Target-state outcome:** routes become protocol adapters over intentional commands and typed outcomes.

### `Read-model`

- `O1-04`: replace giant default snapshot on hot flows
- `O1-05`: move search to a bounded derived read model
- `A3-11`: align read access patterns with scope-aware indexes

**Target-state outcome:** the system reads by capability and scope, not by full graph reconstruction.

### `Ownership`

- `S1-02`: remove implicit global mutable label state
- `A3-11`: align schema and indexes with actual ownership and access shape

**Target-state outcome:** all mutable business data has explicit tenancy, scope, and enforceable boundaries.

### `Lifecycle`

- `S2-09`: make membership removal symmetric across local and external identity state
- `S2-10`: centralize deletion, anonymization, retention, and compensation

**Target-state outcome:** lifecycle behavior becomes a governed subsystem with explicit invariants.

### `Governance`

- `S1-03`: codify browser hardening
- `O1-06`: make quality gates trustworthy
- `S1-07`: govern framework and dependency security
- `O1-08`: verify the contracts that matter

**Target-state outcome:** the repo becomes operationally credible, not just structurally tidy.

### `Desktop-runtime`

- keep Electron as the current desktop platform
- harden preload, navigation, and runtime assumptions continuously
- make desktop startup, packaging, signing, updating, and smoke checks repo-governed

**Target-state outcome:** desktop becomes a trustworthy supported runtime, not an ad hoc wrapper.

## Transformation order

This is the architecture-first order that best moves the repo toward the target state:

1. `Contract`
   This makes the route boundary and application semantics trustworthy.
2. `Ownership`
   This makes tenancy and data scope explicit in the schema.
3. `Read-model`
   This removes broad scans and giant snapshot dependence from hot paths.
4. `Lifecycle`
   This centralizes the most sensitive privacy and identity behaviors.
5. `Governance`
   This makes the architecture durable under ongoing change.

## Target-state interpretation

The repo should be considered materially transformed when the matrix no longer describes recurring architectural patterns, only isolated defects.

`95+` means these streams are in place and enforced.

`100` means the architecture standard is fully embodied and future changes naturally preserve it.
