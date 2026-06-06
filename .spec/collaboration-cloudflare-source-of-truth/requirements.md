---
title: Collaboration Cloudflare Source Of Truth Requirements
scope: documents, work item descriptions, PartyKit, Cloudflare Workers, Convex projections
status: requirements-ready
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

# Requirements

## REQ-001 - Single body authority

Design refs: `DES-001`, `DES-006`, `DES-008`

Each collaborative document must have exactly one canonical body source at runtime.

Acceptance criteria:

- Unmigrated documents may use Convex HTML as canonical.
- Migrated documents must use PartyKit/Cloudflare Yjs state as canonical.
- Convex projection drift must never overwrite a non-empty migrated Yjs body.
- The body source must be visible in persistent metadata.

## REQ-002 - Cloudflare deployment gate

Design refs: `DES-003`, `DES-004`

The durable-body plan must use PartyKit cloud-prem, not managed `*.partykit.dev` storage.

Acceptance criteria:

- Deployment config supports `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, and `--domain` or `partykit.json` `domain`.
- Production env URLs point at the cloud-prem domain.
- The old managed PartyKit URL path is documented as non-durable for body storage.

## REQ-003 - Workers Free first with paid upgrade path

Design refs: `DES-003`, `DES-005`

The first deployment should target Cloudflare Workers Free, with a measured upgrade path to Workers Paid if limits are hit or too close.

Acceptance criteria:

- Durable Object namespace is confirmed SQLite-backed.
- Representative editing sessions are measured for DO requests, duration, rows read, rows written, and stored data.
- Cloudflare Pro is not required for collaboration storage.
- Workers Paid upgrade steps are documented before production migration.

## REQ-004 - y-partykit persistence mode

Design refs: `DES-005`

Normal collaborative documents must use snapshot persistence by default.

Acceptance criteria:

- `persist: { mode: "snapshot" }` is used for migrated document rooms unless an explicit offline-history requirement is approved.
- Any use of `history` includes a documented product reason and max limits.
- Tests cover persistence across last disconnect and reconnect.

## REQ-005 - Safe migration seeding

Design refs: `DES-001`, `DES-006`

Convex content may seed PartyKit only once per migrated document.

Acceptance criteria:

- First migration creates Yjs from Convex content and records a migration marker.
- Reconnect/cold-start reads existing persisted Yjs state first.
- If Yjs state exists, Convex projection is ignored for body initialization.
- A failed migration cannot leave a document marked migrated without persisted Yjs state.

## REQ-006 - Hydration and bootstrap safety

Design refs: `DES-001`, `DES-007`

Migrated editor sessions must not hydrate editor body content from Convex projection.

Acceptance criteria:

- Session bootstrap for migrated docs returns room, token, role, schema/protocol versions, limits, and metadata only.
- Editor body content comes from Yjs provider sync.
- Loading and timeout states are explicit.
- Unmigrated docs can continue using existing Convex bootstrap until migrated.

## REQ-007 - Convex projection pipeline

Design refs: `DES-002`, `DES-008`

Migrated body changes must produce Convex projections.

Acceptance criteria:

- Projection writes include canonical HTML/JSON or equivalent read model fields.
- Mention counts, notifications, linked references, and scoped invalidation are preserved.
- Projection writes are idempotent and compare by content hash/version.
- Projection failures are observable and retryable without corrupting Yjs body state.

## REQ-008 - Work item description compatibility

Design refs: `DES-001`, `DES-002`, `DES-008`

Work item descriptions must follow the same source-of-truth contract as documents.

Acceptance criteria:

- `descriptionDocId` remains the reference from work item to description document.
- Migrated item descriptions use PartyKit/Cloudflare Yjs body state.
- Convex continues to own work item metadata and title.
- Work item description projections update item preview/search/reference behavior.

## REQ-009 - API/body update contract

Design refs: `DES-009`

Non-editor body updates must have a defined conflict model.

Acceptance criteria:

- Body writes after migration either go through Yjs or are rejected.
- Active-room API updates are applied as Yjs diffs or force a safe reload.
- Delete/access revoke continues to close active rooms.
- Metadata-only updates remain Convex-owned.

## REQ-010 - Backup and recovery

Design refs: `DES-010`

Production cutover requires a backup and restore plan for body state outside Convex.

Acceptance criteria:

- Yjs body state can be exported for a document.
- Yjs body state can be restored into a test room.
- Projection can be regenerated from restored Yjs state.
- Backup cadence and storage target are documented.

## REQ-011 - Observability and limits

Design refs: `DES-003`, `DES-005`, `DES-008`, `DES-010`

The system must expose enough signals to detect data drift, quota pressure, and sync failure.

Acceptance criteria:

- Logs distinguish body writes, projection writes, migration seed, projection lag, and room close reasons.
- Metrics or dashboard steps exist for Cloudflare DO requests/duration/storage rows.
- Admission limits, payload limits, and state size limits are documented.
- Rollback trigger thresholds are defined.

## REQ-012 - Review gate

Design refs: `DES-001` through `DES-011`

No runtime source-of-truth migration should land without architecture review.

Acceptance criteria:

- This spec is referenced in the PR.
- Old Convex-canonical specs/audits are not used as target-state authority for this migration.
- Code review checks the single-body-authority invariant.
- Tests cover cold rehydrate, active edit, teardown, projection failure, delete/access revoke, and work item description migration.

## REQ-013 - Preserve working collaboration and management surfaces

Design refs: `DES-001`, `DES-002`, `DES-007`, `DES-008`

The migration must not rewrite or degrade presence, typing, access control, document management, or work-item management behavior unless a narrow compatibility change is required by the body-source and hydration migration.

Acceptance criteria:

- Presence and typing continue using the existing PartyKit/runtime paths.
- Document and work-item metadata, lifecycle, and permission decisions remain Convex-owned.
- Migration changes are limited to body authority, editor hydration, Convex projection safety, and operational guardrails.
- Tests and reviews treat unrelated presence/typing/document-management rewrites as scope creep.
- Any required compatibility edit to those surfaces must name the body-source invariant it protects and include regression coverage for the preserved behavior.

## REQ-014 - Cursor, selection, and typing continuity

Design refs: `DES-007`, `DES-011`

Migrated editor awareness must remain tied to the shared Yjs document state, not to Convex projection content or a separate editor copy.

Acceptance criteria:

- Migrated editors do not initialize remote cursor/selection coordinate mapping from Convex body bootstrap content.
- Awareness `typing`, `activeBlockId`, cursor, selection, and relative-position fields continue to flow through the existing provider awareness path.
- When one user inserts content before another user's cursor or selection, the remote marker moves with the document through Yjs/relative-position mapping.
- Tests cover at least one shifted-position case, such as inserting a paragraph before a remote user's caret and verifying the marker resolves to the shifted document position.
