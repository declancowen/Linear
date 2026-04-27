# Realtime Collaboration Protocol

## Source Of Truth

Convex `documents.content` is the durable canonical body for this PR. PartyKit/Yjs is the live room state for active collaboration sessions.

Active manual saves persist the server-held room Y.Doc. Browser-provided body snapshots are not authoritative for active rooms.

`teardown-content` is the only client-content fallback, and PartyKit accepts it only when no other editor remains in the room.

Durable Yjs/CRDT state in Convex was compared against Outline and remains a future migration option. It should be implemented in a separate PR only if active-room reconciliation becomes too complex, conflict/reload UX is frequent, or wiki-grade offline CRDT continuity becomes a product requirement.

## Room IDs

- Document rooms use `doc:<documentId>`.
- Chat rooms use `chat:<conversationId>` and do not participate in document schema versioning.
- PartyKit URL path room IDs may be URL-encoded; the server normalizes them before validation.

## Versions

- `COLLABORATION_PROTOCOL_VERSION = 1`
- `RICH_TEXT_COLLABORATION_SCHEMA_VERSION = 1`

Document collaboration tokens must carry both versions. Browser websocket joins and manual flush URLs also send `protocolVersion` and `schemaVersion` as client-reported params. PartyKit rejects missing or unsupported document versions before connect or flush so a stale browser build cannot join solely because the server minted a current token.

Mixed-version behavior:

- New web client + new PartyKit: allowed when versions match.
- Old web client + new PartyKit: rejected with `collaboration_schema_version_required` or `collaboration_schema_version_unsupported`.
- Rollout may temporarily allow websocket joins without client version params only with `COLLABORATION_ALLOW_LEGACY_SCHEMA_VERSION=true`. Default behavior is strict rejection.

## Document Token Claims

Document sessions use:

```ts
{
  kind: "doc",
  sub: string,
  roomId: string,
  documentId: string,
  role: "viewer" | "editor",
  sessionId: string,
  workspaceId?: string | null,
  protocolVersion: number,
  schemaVersion: number,
  iat?: number,
  exp: number,
}
```

Internal refresh calls use:

```ts
{
  kind: "internal-refresh",
  sub: "server",
  roomId: string,
  documentId: string,
  action: "refresh",
  protocolVersion: number,
  iat?: number,
  exp: number,
}
```

Browser/user tokens must not be accepted for refresh authority.

## Session Bootstrap

The document session route returns:

```ts
{
  roomId: string,
  documentId: string,
  token: string,
  serviceUrl: string,
  role: "viewer" | "editor",
  protocolVersion: number,
  schemaVersion: number,
  limits: {
    maxConnectionsPerRoom: number,
    maxEditorsPerRoom: number,
    maxFlushBodyBytes: number,
    maxContentJsonBytes: number,
    maxCanonicalHtmlBytes: number,
  },
  contentJson?: JSONContent,
  contentHtml?: string,
  expiresAt?: number,
}
```

## Flush Semantics

Supported flush kinds:

- `content`: active body save; persists server-held room Y.Doc.
- `work-item-main`: active work-item body save plus optional title metadata; persists server-held room Y.Doc.
- `document-title`: metadata-only save; never derives title/body from content.
- `teardown-content`: closing-tab fallback; may apply client content only when no other editor remains.

Viewers cannot flush.

Known flush failures return JSON:

```ts
{
  ok: false,
  code: CollaborationErrorCode,
  message: string,
  retryable?: boolean,
  reloadRequired?: boolean,
}
```

## Refresh Semantics

PartyKit exposes an internal room endpoint:

```text
POST /refresh
```

The request body is:

```ts
{
  kind: "canonical-updated" | "document-deleted" | "access-changed",
  documentId: string,
  reason?: string,
}
```

Rules:

- `document-deleted` closes active connections with `collaboration_document_deleted`.
- `access-changed` closes active connections with `collaboration_access_revoked`.
- `canonical-updated` replaces a clean active room from Convex canonical content.
- `canonical-updated` does not overwrite a dirty room; it closes/notifies with `collaboration_conflict_reload_required`.
- Wrong room/document pairs are rejected.

## Error Codes And Close Codes

Core codes:

- `collaboration_unauthenticated`
- `collaboration_forbidden`
- `collaboration_room_mismatch`
- `collaboration_private_document`
- `collaboration_document_deleted`
- `collaboration_access_revoked`
- `collaboration_schema_version_required`
- `collaboration_schema_version_unsupported`
- `collaboration_too_many_connections`
- `collaboration_payload_too_large`
- `collaboration_state_too_large`
- `collaboration_sync_timeout`
- `collaboration_stale_client_snapshot_rejected`
- `collaboration_conflict_reload_required`
- `collaboration_persist_failed`
- `collaboration_unknown`

Close-code mapping:

- `4401`: unauthenticated
- `4403`: forbidden, private, access revoked
- `4404`: deleted/not found
- `4408`: timeout
- `4422`: invalid payload or version required
- `4499`: reload required
- `4503`: too many connections
- `1009`: too large
- `1011`: internal or persist failed

Client UX should branch on codes, not raw message snippets, for core collaboration outcomes.

## Limits

Defaults:

- `maxConnectionsPerRoom`: `50`
- `maxEditorsPerRoom`: `25`
- `maxFlushBodyBytes`: `2_000_000`
- `maxContentJsonBytes`: `1_500_000`
- `maxCanonicalHtmlBytes`: `1_000_000`

Environment overrides:

- `COLLABORATION_MAX_CONNECTIONS_PER_ROOM`
- `COLLABORATION_MAX_EDITORS_PER_ROOM`
- `COLLABORATION_MAX_FLUSH_BODY_BYTES`
- `COLLABORATION_MAX_CONTENT_JSON_BYTES`
- `COLLABORATION_MAX_CANONICAL_HTML_BYTES`

Invalid overrides fall back to defaults and log once.

## Private Documents And Roles

Private documents do not open PartyKit rooms. They stay on the non-collaborative editor path.

Viewer sessions may join read-only document rooms but cannot flush.

## Operational Events

Structured PartyKit events use the `[collaboration]` prefix and include safe identifiers only. Do not log content or token values.

Event names:

- `session_issued`
- `connect_accepted`
- `connect_rejected`
- `room_seeded`
- `flush_started`
- `flush_succeeded`
- `flush_failed`
- `teardown_flush_skipped`
- `refresh_received`
- `refresh_applied`
- `refresh_conflict`
- `room_closed`
- `limit_rejected`

## Protocol Change Test Matrix

Any protocol change must update tests for:

- token parser version acceptance/rejection
- session route bootstrap fields
- adapter provider params
- PartyKit connect rejection
- PartyKit flush rejection
- hook reload-required state mapping
- active flush server-owned persistence
- teardown fallback safety
- viewer flush rejection
- payload/state/admission limits
- refresh endpoint auth and room/document matching
- clean-room refresh and dirty-room conflict
- structured event emission without content/token leakage
