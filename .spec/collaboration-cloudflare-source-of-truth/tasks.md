---
title: Collaboration Cloudflare Source Of Truth Tasks
scope: documents, work item descriptions, PartyKit cloud-prem, Cloudflare Durable Objects, Convex projections
status: implementation-ready
repo_root: /Users/declancowen/Documents/GitHub/Linear
change_class: architecture-migration
risk_level: high
owner: product-engineering
reviewers: []
approvers: []
implementation_owner: unassigned
operations_owner: unassigned
last_updated: 2026-06-06
---

# Task Plan

## Phase 0 - Approval and validation

- [todo] Approve the Cloudflare Workers/PartyKit cloud-prem target architecture. (`REQ-001`, `REQ-002`)
- [todo] Confirm Workers Free as the first target and Workers Paid as the upgrade path only if limits require it. (`REQ-003`)
- [todo] Confirm Cloudflare account/domain to use for cloud-prem. (`REQ-002`)
- [todo] Confirm backup target for Yjs exports. (`REQ-010`)

## Phase 1 - Cloudflare/PartyKit proof

- [todo] Create a non-production PartyKit cloud-prem deployment using the current PartyKit version. (`REQ-002`)
- [todo] Verify the Durable Object namespace is SQLite-backed and Free-compatible. (`REQ-003`)
- [todo] Verify `NEXT_PUBLIC_PARTYKIT_URL` can point at the cloud-prem domain. (`REQ-002`)
- [todo] Measure y-partykit `snapshot` persistence on representative edits. (`REQ-003`, `REQ-004`)
- [todo] Capture Cloudflare dashboard/API evidence for DO requests, duration, row reads, row writes, and stored data. (`REQ-003`, `REQ-011`)
- [todo] Define Workers Paid upgrade thresholds and steps, without requiring Cloudflare Pro. (`REQ-003`, `REQ-011`)

## Phase 2 - Architecture contract changes

- [todo] Add persistent body-source metadata to Convex documents. (`REQ-001`, `REQ-005`)
- [todo] Document that old Convex-canonical specs/audits are excluded from target-state authority for this migration. (`REQ-012`)
- [todo] Document that presence, typing, access control, document management, and work-item management are preservation constraints, not replacement targets, while allowing narrow compatibility edits required by body-source migration. (`REQ-013`)
- [todo] Update collaboration protocol/runbook docs with cloud-prem domain, body authority, projection authority, and rollback semantics. (`REQ-002`, `REQ-011`, `REQ-012`)
- [todo] Define event names for migration seed, Yjs body write, Convex projection write, projection lag, and restore. (`REQ-007`, `REQ-010`, `REQ-011`)

## Phase 3 - PartyKit body authority

- [todo] Change migrated document rooms to use `persist: { mode: "snapshot" }`. (`REQ-004`)
- [todo] Remove cold-room replacement from Convex projection for migrated docs. (`REQ-001`, `REQ-005`)
- [todo] Add one-time migration seed from Convex content to Yjs state. (`REQ-005`)
- [todo] Add persisted migration marker checks. (`REQ-001`, `REQ-005`)
- [todo] Keep unmigrated documents on the existing Convex-canonical path. (`REQ-001`)
- [todo] Add tests for cold reconnect, persisted non-empty room, first migration seed, and failed migration recovery. (`REQ-004`, `REQ-005`, `REQ-012`)

## Phase 4 - Hydration cleanup

- [done] Stop returning Convex `contentJson`/`contentHtml` for migrated editor sessions. (`REQ-006`)
- [done] Gate editor initialization on Yjs provider sync for migrated docs. (`REQ-006`)
- [done] Verify cursor, selection, active block, and typing awareness remain attached to the synced Yjs document for migrated docs. (`REQ-013`, `REQ-014`)
- [done] Add a shifted-position regression test where a remote caret/selection moves correctly after another user inserts content above it. (`REQ-014`)
- [done] Preserve Convex bootstrap behavior for unmigrated docs. (`REQ-001`, `REQ-006`)
- [done] Add tests for migrated bootstrap payload and client loading/timeout state. (`REQ-006`, `REQ-012`)

## Phase 5 - Convex projection pipeline

- [todo] Convert Yjs state to canonical projection JSON/HTML after body changes. (`REQ-007`)
- [todo] Write projection to Convex with hash/version idempotency. (`REQ-007`)
- [todo] Preserve mention, notification, linked reference, and scoped invalidation behavior. (`REQ-007`, `REQ-008`)
- [todo] Add projection retry/lag observability. (`REQ-007`, `REQ-011`)
- [todo] Add tests for projection success, no-op, failure, retry, and stale projection non-authority. (`REQ-001`, `REQ-007`, `REQ-012`)

## Phase 6 - Work item descriptions

- [todo] Apply the same body-source metadata and migration path to item description documents. (`REQ-008`)
- [todo] Keep work item `descriptionDocId` as the stable reference. (`REQ-008`)
- [todo] Preserve title updates as Convex-owned metadata. (`REQ-008`, `REQ-009`)
- [todo] Add tests for item description migration, projection, title/body split, and linked references. (`REQ-008`, `REQ-012`)

## Phase 7 - Backup and restore

- [todo] Implement a Yjs body export path. (`REQ-010`)
- [todo] Implement restore into a test room/document. (`REQ-010`)
- [todo] Regenerate Convex projection from restored Yjs state. (`REQ-007`, `REQ-010`)
- [todo] Document backup cadence, storage target, and restore runbook. (`REQ-010`, `REQ-011`)
- [todo] Run a restore drill before production migration. (`REQ-010`, `REQ-012`)

## Phase 8 - Review and rollout

- [todo] After every implementation slice, run a deep diff-review loop with `architecture-standards`; fix findings, then rerun normal diff-review passes until clean, and record results in `.spec/collaboration-cloudflare-source-of-truth/reviews.md`. (`REQ-012`, `REQ-014`)
- [todo] Run focused tests for PartyKit server, collaboration adapter, session API, hooks, Convex projection handlers, and work item routes. (`REQ-012`)
- [todo] Verify presence, typing, cursor, selection, and active-block paths remain unchanged unless a body-authority issue requires a targeted compatibility edit, and cover any such edit with a regression test. (`REQ-013`, `REQ-014`)
- [todo] Run `pnpm typecheck`. (`REQ-012`)
- [todo] Run `pnpm lint` if runtime files change. (`REQ-012`)
- [todo] Run the repo Fallow gate at the end of implementation, preserving production/full-inventory mode distinctions in the review record. (`REQ-012`)
- [todo] After Fallow, rerun a whole-worktree diff-review loop starting with deep diff review plus `architecture-standards`; fix findings, then rerun normal whole-worktree diff-review passes until clean. (`REQ-012`)
- [todo] Roll out behind a per-document or per-workspace migration flag. (`REQ-001`, `REQ-011`)
- [todo] Start with one non-critical workspace and verify no projection lag or quota pressure. (`REQ-003`, `REQ-011`)
