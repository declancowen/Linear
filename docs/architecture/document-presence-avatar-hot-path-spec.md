# Document Presence Avatar Hot-Path Spec

## Status

- `Status`: deferred design
- `Owner`: app/runtime
- `Why now`: document presence currently resolves the current user's stored avatar snapshot during `getAuthContext`, which keeps correctness but leaves one storage URL resolution on a hot request path
- `Why deferred`: current behavior is correct and materially better than the earlier per-viewer fanout; this spec captures the next safe step without blocking release

## Problem

Document presence needs to show the app-stored profile photo, not the transient WorkOS/Google avatar and not initials unless there is no uploaded photo.

The current branch achieves correctness by:

- writing the current user's stored avatar fields into presence entries
- returning viewer avatar fields directly from presence entries
- extending `getAuthContextHandler()` to resolve the current user's avatar snapshot

That removes the old per-viewer `listUsersByIds(...).map(resolveUserSnapshot)` heartbeat fanout, but it still means each request that depends on `requireConvexUser()` can pay one `ctx.storage.getUrl()` call for the current user.

For document presence specifically, this leaves one avoidable cost on a hot path:

- document open
- periodic heartbeat
- tab resume / focus heartbeat

## Goals

- Keep document presence avatars sourced from the Convex user profile, not WorkOS fallback data.
- Remove storage URL resolution from the document presence heartbeat path.
- Remove user-record fanout from presence viewer listing.
- Keep presence semantics session-aware and user-aware.
- Preserve a clear migration path with low rollout risk.

## Non-goals

- Reworking the entire auth context model in this pass.
- Replacing Convex storage or avatar upload behavior.
- Changing the current UI behavior for hiding the local user from presence.

## Current State

### Request path

1. Browser sends `POST /api/documents/[documentId]/presence`.
2. Route calls `requireSession()` and `requireConvexUser()`.
3. `requireConvexUser()` calls `ensureConvexUserReadyServer()`.
4. `ensureConvexUserReadyServer()` calls `getAuthContextServer()`.
5. `getAuthContextHandler()` now resolves `currentUser` via `resolveUserSnapshot(ctx, user)`.
6. Route sends `name`, `avatarUrl`, and `avatarImageUrl` into `heartbeatDocumentPresenceServer(...)`.
7. Convex stores those values on the `documentPresence` row.
8. `listDocumentPresenceViewers()` maps stored presence entries directly back into response payloads.

### Hot-path improvement already completed

The branch has already removed the worse version of this problem:

- no per-viewer user lookup in `listDocumentPresenceViewers()`
- no per-viewer storage URL resolution during heartbeat response building

### Remaining hot-path cost

The current user snapshot in `getAuthContextHandler()` still resolves `avatarImageUrl` through storage on each query.

## Constraints And Assumptions

- Presence must use the app-stored user profile as the source of truth.
- `visibleUserIds` in `getSnapshotHandler()` is seeded from visible workspace memberships and team memberships, so the client snapshot already contains workspace/team users available to the current user.
- Resolved storage URLs should be treated as derived values, not durable identity fields.
- Presence heartbeats should stay cheap, idempotent, and operationally boring.

## Recommended Future Design

### Summary

Move document presence rendering to a client-side join against the already-loaded user snapshot, and reduce presence transport to stable identity plus liveness data.

### Target contract

Presence viewer payload should become:

```ts
type DocumentPresenceViewer = {
  viewerKey: string
  appUserId: string
  lastSeenAt: string
}
```

Where:

- `viewerKey` preserves the current dedupe behavior based on `workosUserId ?? userId`
- `appUserId` is the internal user id used to join against the app store
- `lastSeenAt` supports ordering and freshness

### Client behavior

`DocumentDetailScreen` should:

1. receive lightweight presence viewers from the API
2. join each `appUserId` against `useAppStore(...).users`
3. pass the resolved `name`, `avatarUrl`, and `avatarImageUrl` into `DocumentPresenceAvatarGroup`
4. fall back gracefully if a user is missing from the local store

Because snapshot hydration already includes workspace/team membership users, this join should succeed for normal document presence viewers without any additional request.

### Server behavior

The heartbeat path should store only the minimum liveness identity fields:

- `documentId`
- `userId`
- `workosUserId`
- `sessionId`
- `lastSeenAt`
- `createdAt`

Optional temporary compatibility fields may be kept during rollout, but the target state is to stop depending on avatar/name payload in presence rows.

### Auth context behavior

`getAuthContextHandler()` should return a lightweight current user shape again:

- `id`
- `email`
- `name`
- `workosUserId`

No avatar URL resolution should be required for document presence.

## Rollout Plan

### Phase 1: additive contract

- Add `appUserId` and `viewerKey` to the presence viewer payload.
- Keep existing `name` / `avatarUrl` / `avatarImageUrl` fields temporarily for compatibility.
- Update the client to prefer store-joined user data and fall back to payload fields.

### Phase 2: heartbeat slimming

- Stop sending avatar fields from the presence route.
- Stop writing avatar fields into `documentPresence`.
- Keep old stored fields tolerated by validators during migration.

### Phase 3: cleanup

- Remove avatar fields from `documentPresenceFields`.
- Remove avatar dependencies from the presence route contract.
- Return `getAuthContextHandler()` to a lightweight current-user shape.

## Observability

Track these before and after the migration:

- presence route latency p50/p95/p99
- Convex `getAuthContext` latency
- document presence heartbeat error rate
- document presence session conflict rate
- count of presence responses that fail client-side user joins

Add a temporary log/metric on the client join path:

- number of presence viewers missing a matching `appUserId` in local store

If that metric is non-trivial, stop at Phase 1 and fix snapshot coverage first.

## Rejected Alternatives

### 1. Keep resolving the current user avatar in `getAuthContextHandler()`

Rejected as the end state because it leaves storage URL resolution in a hot request path.

### 2. Move avatar resolution into the Next.js route

Rejected because it only moves the same cost to another layer without improving the path.

### 3. Reintroduce server-side viewer enrichment

Rejected because it returns the system to the worse per-viewer heartbeat fanout model.

### 4. Persist resolved avatar URLs directly as durable user identity

Rejected because resolved storage URLs are derived transport values, not trustworthy long-lived identity data.

## Open Questions

- Does any document-presence-visible user ever fail to appear in the current snapshot user set for a valid workspace/team document?
- Should `viewerKey` remain exposed to the client, or can the UI key off `appUserId` safely after dedupe happens on the server?
- Do we want the same lightweight-presence pattern for other presence surfaces later?

## Decision

Do not patch this further in the current release branch.

When revisited, implement the lightweight viewer contract plus client-side user join, then remove avatar resolution from `getAuthContextHandler()` for document presence.
