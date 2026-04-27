# PartyKit Cloudflare Runbook

## Purpose

This runbook defines the operating contract for the hosted PartyKit collaboration runtime.

Service topology:

- `linear-collaboration-dev` -> Convex dev
- `linear-collaboration-prod` -> Convex prod

Convex remains canonical. PartyKit is the live collaboration room/runtime layer for shared editors.

## Product Scope

PartyKit is used for:

- team and workspace documents
- work-item descriptions that are collaborative

PartyKit is not used for:

- private documents
- normal non-collaborative Convex-only editing paths

Private documents should never enter a PartyKit session. If collaboration is unavailable or disabled, the app should fall back to the existing non-collaborative editor behavior instead of opening a room.

## Required Environment Variables

### Dev PartyKit service

- `CONVEX_URL=https://<convex-dev>.convex.cloud`
- `CONVEX_SERVER_TOKEN=<convex-dev-server-token>`
- `COLLABORATION_TOKEN_SECRET=<dev-collaboration-token-secret>`

### Prod PartyKit service

- `CONVEX_URL=https://<convex-prod>.convex.cloud`
- `CONVEX_SERVER_TOKEN=<convex-prod-server-token>`
- `COLLABORATION_TOKEN_SECRET=<prod-collaboration-token-secret>`

### App environments

Local/dev app:

- `NEXT_PUBLIC_PARTYKIT_URL=https://linear-collaboration-dev.<subdomain>.partykit.dev`
- `COLLABORATION_TOKEN_SECRET=<dev-collaboration-token-secret>`
- `CONVEX_URL=https://<convex-dev>.convex.cloud`
- `NEXT_PUBLIC_CONVEX_URL=https://<convex-dev>.convex.cloud`
- `CONVEX_SERVER_TOKEN=<convex-dev-server-token>`

Prod app:

- `NEXT_PUBLIC_PARTYKIT_URL=https://linear-collaboration-prod.<subdomain>.partykit.dev`
- `COLLABORATION_TOKEN_SECRET=<prod-collaboration-token-secret>`
- `CONVEX_URL=https://<convex-prod>.convex.cloud`
- `NEXT_PUBLIC_CONVEX_URL=https://<convex-prod>.convex.cloud`
- `CONVEX_SERVER_TOKEN=<convex-prod-server-token>`

## One-Time Secret Provisioning

Provision PartyKit service secrets directly in Cloudflare/PartyKit. Do not depend on `.env.local` injection during deploy.

For each service, set:

- `CONVEX_URL`
- `CONVEX_SERVER_TOKEN`
- `COLLABORATION_TOKEN_SECRET`

Optional limit overrides:

- `COLLABORATION_MAX_CONNECTIONS_PER_ROOM`
- `COLLABORATION_MAX_EDITORS_PER_ROOM`
- `COLLABORATION_MAX_FLUSH_BODY_BYTES`
- `COLLABORATION_MAX_CONTENT_JSON_BYTES`
- `COLLABORATION_MAX_CANONICAL_HTML_BYTES`
- App-only: `COLLABORATION_REFRESH_TIMEOUT_MS` bounds best-effort refresh notification waits after Convex mutations. Default: `1500`.

Keep the app and the matching PartyKit service on the same collaboration token secret.

## Release Coordination

Treat collaboration releases as a multi-layer contract.

Deploy all required layers together when a change touches any of:

- PartyKit room/server behavior
- collaboration session issuance
- collaboration token semantics
- collaborative editor boot or save lifecycle
- Convex-backed collaboration helpers or scoped-sync freshness behavior

Typical combinations:

- PartyKit-only runtime change: PartyKit deploy only
- app-only UI change: Vercel/web deploy only
- collaboration contract change: Vercel + PartyKit + Convex together when applicable

Do not assume a collaboration change is safe to roll out with only one layer updated unless the change has been explicitly designed to tolerate mixed versions.

## Deployment Commands

Deploy dev:

```bash
pnpm partykit:deploy:dev
```

Deploy prod:

```bash
pnpm partykit:deploy:prod
```

## Log Inspection

Tail dev logs:

```bash
pnpm partykit:tail:dev
```

Tail prod logs:

```bash
pnpm partykit:tail:prod
```

Expected log prefixes:

- `[collaboration]`

Structured collaboration event names:

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

## Rollback

If a hosted collaboration deploy is unhealthy:

1. Redeploy the previous known-good PartyKit code to the same service name.
2. If necessary, set `NEXT_PUBLIC_ENABLE_COLLABORATION=false` in the app to disable collaboration completely.
3. Do not perform any data rollback in Convex. Convex remains canonical and collaboration persistence is CAS-protected.

## Verification Checklist

### Local/dev

- local Next.js app boots without running a local PartyKit process
- `NEXT_PUBLIC_PARTYKIT_URL` points at the dev PartyKit service
- two clients can edit the same team/workspace document live
- two clients can edit the same work-item description live
- private documents remain Convex-only and do not request collaboration sessions
- PartyKit dev logs show room bootstrap and persist activity against Convex dev

### Prod

- `NEXT_PUBLIC_PARTYKIT_URL` points at the prod PartyKit service
- collaboration session issuance succeeds for non-private documents
- private documents remain non-collaborative
- manual flush with work-item title + description persists atomically
- restarting a PartyKit worker causes rooms to reseed from Convex canonical content without drift

## Incident Playbooks

### Join Or Bootstrap Failures

- Symptoms: editor stays in bootstrapping/degraded state, `connect_rejected` rises.
- Inspect: `pnpm partykit:tail:prod | rg "connect_rejected|room_seeded"`.
- Healthy signal: `room_seeded` follows `connect_accepted` for non-private documents.
- Rollback: set `NEXT_PUBLIC_ENABLE_COLLABORATION=false` if sessions cannot open.
- Verify: open a non-private document in two clients and confirm both attach.

### Schema Version Mismatch

- Symptoms: clients show reload-required copy; logs show `collaboration_schema_version_required` or `collaboration_schema_version_unsupported`.
- Inspect: `pnpm partykit:tail:prod | rg "schema_version|connect_rejected|flush_failed"`.
- Healthy signal: new clients send protocol/schema versions and are accepted.
- Rollback: deploy matching web app and PartyKit versions together, or temporarily set `COLLABORATION_ALLOW_LEGACY_SCHEMA_VERSION=true` only for the deploy-ordering window.
- Verify: hard refresh the page and confirm a fresh session joins.

### Too Many Editors Or Connections

- Symptoms: users cannot join busy documents; logs show `limit_rejected` or `collaboration_too_many_connections`.
- Inspect: `pnpm partykit:tail:prod | rg "limit_rejected|too_many_connections"`.
- Healthy signal: viewer joins may continue when editor cap is hit and total room cap permits.
- Rollback: raise the relevant limit only after checking PartyKit load; otherwise disable collaboration for the incident.
- Verify: reduce active clients or adjust limits, then confirm new joins succeed.

### Oversized Document Or Flush Payload

- Symptoms: large documents fail to seed or flush; logs show `collaboration_payload_too_large` or `collaboration_state_too_large`.
- Inspect: `pnpm partykit:tail:prod | rg "payload_too_large|state_too_large|limit_rejected"`.
- Healthy signal: normal-sized documents seed and flush with `flush_succeeded`.
- Rollback: use non-collaborative editing for affected documents; do not roll back Convex data.
- Verify: affected document either opens in fallback mode or is reduced below the configured cap.

### Flush Failure

- Symptoms: edits appear live but do not persist; logs show `flush_failed` without later `flush_succeeded`.
- Inspect: `pnpm partykit:tail:prod | rg "flush_started|flush_succeeded|flush_failed"`.
- Healthy signal: every meaningful `flush_started` has a corresponding `flush_succeeded` or a known no-op unchanged content path.
- Rollback: redeploy previous known-good PartyKit service; disable collaboration if persistence remains unhealthy.
- Verify: edit and reload a document; content remains persisted from Convex.

### Suspected Drift

- Symptoms: active room content differs from Convex after reload or between clients.
- Inspect: `pnpm partykit:tail:prod | rg "refresh_conflict|flush_failed|persist_failed"`.
- Healthy signal: active saves persist server-held room state and dirty external updates trigger reload-required instead of overwrite.
- Rollback: disable collaboration and keep Convex canonical content; do not roll back Convex data automatically.
- Verify: reload clients and confirm they converge on Convex canonical content.

### Refresh Conflict

- Symptoms: users are asked to reload after an external canonical update.
- Inspect: `pnpm partykit:tail:prod | rg "refresh_received|refresh_conflict|room_closed"`.
- Healthy signal: clean rooms emit `refresh_applied`; dirty rooms emit `refresh_conflict` and close with reload-required.
- Rollback: if conflicts are noisy, disable collaboration and investigate external update sources.
- Verify: clean-room external update applies; dirty-room external update does not overwrite active edits.

### Document Deleted While Room Active

- Symptoms: active editors are disconnected from a deleted document.
- Inspect: `pnpm partykit:tail:prod | rg "document_deleted|room_closed"`.
- Healthy signal: active connections close with `collaboration_document_deleted`.
- Rollback: none for data; restore the document through product recovery if available.
- Verify: deleted document no longer opens a collaboration session.

### Access Revoked While Room Active

- Symptoms: users lose access and are disconnected.
- Inspect: `pnpm partykit:tail:prod | rg "access_revoked|room_closed"`.
- Healthy signal: affected connections close with `collaboration_access_revoked`.
- Rollback: restore access if the permission change was accidental.
- Verify: revoked user cannot rejoin; authorized user can still join.

### Worker Restart Or Cold Rehydrate

- Symptoms: reconnect after restart reseeds room from Convex.
- Inspect: `pnpm partykit:tail:prod | rg "room_seeded|connect_accepted"`.
- Healthy signal: room seeds from canonical content and does not append/duplicate body content.
- Rollback: redeploy previous known-good PartyKit service if cold load fails.
- Verify: restart/redeploy and re-open the same document in two clients.

### Collaboration Disabled Fallback

- Symptoms: collaboration incident requires isolation.
- Inspect: app logs for fallback diagnostics and PartyKit logs for reduced traffic.
- Healthy signal: editors remain usable through non-collaborative paths.
- Rollback action: set `NEXT_PUBLIC_ENABLE_COLLABORATION=false`.
- Verification: reload the app and confirm documents/work-item descriptions open without PartyKit sessions.
