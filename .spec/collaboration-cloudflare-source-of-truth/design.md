---
title: Collaboration Cloudflare Source Of Truth Design
scope: documents, work item descriptions, collaboration storage, Convex projections
status: design-ready
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

# Collaboration Cloudflare Source Of Truth Design

## Decision

Proceed with a Cloudflare Workers/PartyKit cloud-prem plan for collaborative document body storage.

The target architecture is:

- PartyKit running in the user's own Cloudflare account owns durable Yjs document state.
- Cloudflare Durable Object storage is the body store for migrated collaborative documents and work item descriptions.
- Convex remains the app database for metadata, access control, lifecycle, references, and read/search/mention projections.
- Convex body content is a projection for app workflows, not a body source of truth after migration.

This migration preserves the existing presence, typing, access control, document management, and work-item management surfaces by default. The change is intentionally about body source of truth, editor hydration, projection safety, and the operational guardrails needed for that swap. If one of those otherwise-working surfaces must change to make the body-source migration correct, the change should be narrow, called out as a compatibility requirement, and reviewed against the existing behavior it preserves.

The cost posture is Cloudflare Workers Free first, with Workers Paid as the explicit upgrade path only if observed limits require it. This does not require Cloudflare Pro. Cloudflare Workers Paid is a separate Workers billing model from the general Cloudflare Free/Pro/Business site plans.

## Why this direction

The current system has a split-brain shape:

- Convex stores `documents.content`.
- PartyKit/Yjs stores live CRDT state.
- The server periodically converts Yjs to HTML and writes Convex.
- On connection, the server can reload Convex content and replace the Yjs room.
- The client session also receives Convex `contentJson`/`contentHtml` as bootstrap content.

That model can work only while Convex HTML is canonical. It is the wrong model if PartyKit is expected to retain durable Yjs state across sessions.

Outline's live collaboration architecture shows the safer invariant: Yjs state is durable, and content JSON is a projection. Outline stores both in its primary DB; Linear can choose Cloudflare Durable Object storage for the durable Yjs body to avoid Convex pay-as-you-go body growth, but the same invariant still applies.

## Design decisions

- **DES-001 - Single body authority:** migrated document bodies are authoritative in PartyKit/Cloudflare Yjs state, not Convex projection content.
- **DES-002 - Convex remains metadata/projection owner:** Convex owns identity, access, lifecycle, references, search/read projections, and work item links.
- **DES-003 - Workers Free first:** deploy cloud-prem to the user's Cloudflare account and start on Workers Free; upgrade only to Workers Paid if metrics show Free limits are insufficient.
- **DES-004 - Managed PartyKit is non-durable for bodies:** `*.partykit.dev` managed Individual storage is not acceptable for durable document body storage.
- **DES-005 - Snapshot persistence by default:** migrated document rooms use y-partykit snapshot persistence unless long-lived offline edit history is an approved product requirement.
- **DES-006 - One-time migration seed:** Convex content may seed Yjs only when a document has no persisted Yjs body and is being migrated.
- **DES-007 - Yjs-first hydration:** migrated editors hydrate from Yjs provider sync, not Convex projection bootstrap content.
- **DES-008 - Projection pipeline:** body changes produce idempotent Convex projections for mentions, references, previews, search, and read models.
- **DES-009 - Explicit external update contract:** non-editor body updates must go through Yjs or be rejected/converted to a safe reload path.
- **DES-010 - Backup and restore before production cutover:** durable Yjs body state needs export, restore, and projection regeneration paths.
- **DES-011 - Awareness coordinate continuity:** presence, typing, cursor, and selection awareness must stay attached to the same synced Yjs document state as body edits.

## Source-of-truth contract

For migrated documents:

- `DocumentIdentity` is in Convex.
- `DocumentBody` is in PartyKit/Cloudflare Durable Object Yjs state.
- `DocumentProjection` is in Convex.
- `DocumentAccess` is in Convex.
- `DocumentLifecycle` is in Convex.

Convex may reject access, delete documents, rename documents, and update metadata. Convex must not overwrite a non-empty persisted Yjs body from a projection.

## Storage choice

Recommended storage path:

- Use PartyKit cloud-prem to deploy the collaboration Worker to the user's Cloudflare account.
- Use y-partykit built-in persistence backed by `room.storage`.
- Use `persist: { mode: "snapshot" }` for normal document and work item description rooms.
- Keep `history` out of the default path unless the product explicitly supports long-lived offline collaborative editing.

Free storage location:

- Cloudflare SQLite-backed Durable Object storage can store the durable Yjs body on Workers Free.
- The app must prove the PartyKit cloud-prem deploy creates SQLite-backed Durable Object namespaces because Workers Free cannot use key-value-backed Durable Objects.
- If observed usage approaches or hits Free limits, move to Workers Paid. Do not move to the general Cloudflare Pro plan for this concern.

## Convex responsibilities

Convex remains necessary even if it does not store the canonical body:

- document ID, title, kind, workspace/team scope
- work item `descriptionDocId`
- permissions and team/project access checks
- document deletion/archive state
- mentions, notifications, linked document/work item references
- searchable/readable content projection
- scoped read model invalidation
- optimistic metadata updates

The existing `documents.content` field can remain during migration as the projection field. A later cleanup can rename or add explicit projection fields if needed.

## PartyKit responsibilities

PartyKit owns:

- durable Yjs body state
- active WebSocket collaboration state
- awareness/presence within the room
- room-level access enforcement using Convex-issued tokens
- migration seed from Convex content only when no durable Yjs body exists
- projection callbacks to Convex after body changes
- room close/reload semantics for deletion and access revocation

## Migration model

Migration should be per document and reversible until cutover:

1. Add a Convex migration marker per document, for example `bodySource: "convex-html" | "cloudflare-yjs"` and `bodyMigratedAt`.
2. For `convex-html`, keep the existing model.
3. On first migration, create a Yjs document from Convex HTML, persist it to PartyKit/Cloudflare storage, and mark migration complete.
4. Once migrated, never re-seed the Yjs body from Convex projection.
5. Write Convex projections from Yjs callbacks.
6. Keep rollback as "freeze room, export Yjs to HTML/JSON projection, set bodySource back to Convex" until confidence is high.

## Hydration model

The collaboration session API should return identity and authorization data, not Convex body content, for migrated documents.

For migrated documents:

- Editor initial content comes from Yjs provider sync.
- UI loading state waits for provider sync or a bounded timeout.
- Convex projection may be used for read-only preview surfaces outside the editor.
- Convex projection must not initialize an editor that will then attach to a different Yjs body.
- Remote cursor/selection markers must be based on awareness state and relative positions from the synced Yjs document, so edits such as inserting paragraphs move other users' carets with the document instead of leaving them anchored to stale absolute offsets or a Convex-bootstrapped copy.

For unmigrated documents:

- Existing Convex bootstrap can remain until migration.

## Projection pipeline

Projection writes should be idempotent and versioned:

- Convert Yjs to canonical editor JSON and HTML.
- Compare against the last stored projection hash.
- Write Convex projection only when it changed.
- Recompute mentions and linked references from the projection.
- Bump scoped read model keys.
- Attribute changes to the latest known editor user when possible.
- Preserve work item title/body semantics for item description rooms.

Projection failures should not mutate the Yjs body. They should mark projection lag and retry.

## External/API updates

Body updates should go through the collaboration path after migration. If an API must modify a body while a room is active, it needs one of these explicit paths:

- load Yjs state, apply a Yjs update, notify the active room to apply the diff, then update projection
- reject the API body write while a room is active and require editor reload
- treat API body writes as metadata/projection-only operations and never as body authority

The Outline `APIUpdateExtension` pattern is the reference model if API body updates remain necessary.

## Operations and cost controls

Cloudflare Free guardrails:

- confirm Durable Object backend is SQLite
- set room size limits
- set connection limits
- set payload limits
- prefer snapshot persistence
- track DO requests, duration, rows read, rows written, and stored data
- define upgrade threshold to Workers Paid before user data is at risk

Backups:

- scheduled export of Yjs state or projection snapshots is required before production cutover
- restore must be tested on a copied room/document

## Out of scope for first implementation

- replacing Convex entirely
- replacing existing presence, typing, access control, document management, or work-item management flows except for narrow compatibility edits required by the body-source migration
- full offline editing with indefinite history retention
- custom CRDT storage engine
- moving search/indexing out of Convex
- changing document/work item product semantics

## Open validation gates

- Confirm PartyKit `0.0.115` cloud-prem deployment creates Free-compatible SQLite-backed Durable Object namespaces.
- Measure y-partykit `snapshot` persistence row/write behavior for representative editing sessions.
- Decide backup target for Yjs exports.
- Decide whether to rename `documents.content` to make projection status explicit.

## References

- Audit: `.audits/collaboration-source-of-truth-cloudflare.md`
- PartyKit pricing: https://www.partykit.io/
- PartyKit cloud-prem: https://docs.partykit.io/guides/deploy-to-cloudflare/
- y-partykit persistence: https://docs.partykit.io/reference/y-partykit-api/#persistence
- Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Convex limits: https://docs.convex.dev/production/state/limits
- Outline persistence reference: https://github.com/outline/outline/blob/be3f28afeaaa8b92137685376fe17fff94e62255/server/collaboration/PersistenceExtension.ts
- Outline updater reference: https://github.com/outline/outline/blob/be3f28afeaaa8b92137685376fe17fff94e62255/server/commands/documentCollaborativeUpdater.ts
- Outline API update reference: https://github.com/outline/outline/blob/be3f28afeaaa8b92137685376fe17fff94e62255/server/collaboration/APIUpdateExtension.ts

## Excluded from target-state authority

Older repo specs and audits for Convex-canonical collaboration are intentionally excluded from the target design. They may explain why the current code looks the way it does, but they are not guidance for the Cloudflare-body architecture.
