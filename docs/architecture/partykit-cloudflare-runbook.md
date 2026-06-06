# PartyKit Cloudflare Runbook

## Purpose

This runbook defines the operating contract for the PartyKit collaboration runtime deployed to the owner's Cloudflare account with PartyKit cloud-prem.

Service topology:

- `linear-collaboration-dev` -> Convex dev -> `PARTYKIT_CLOUDFLARE_DEV_DOMAIN`
- `linear-collaboration-prod` -> Convex prod -> `PARTYKIT_CLOUDFLARE_PROD_DOMAIN`

Body-source contract:

- `convex-html`: legacy/unmigrated documents use Convex `documents.content` as canonical body content.
- `cloudflare-yjs`: migrated documents use PartyKit/Yjs state in Cloudflare Durable Objects as canonical body content.
- Convex remains canonical for document identity, access, lifecycle, metadata, work-item links, and read/search/reference projections.
- Convex `documents.content` is a projection for migrated documents and must not rehydrate or overwrite the Cloudflare Yjs body.

Managed `*.partykit.dev` storage is not acceptable for durable document bodies because PartyKit Individual storage is cleared every 24 hours. The explicit `partykit:deploy:managed:*` scripts are for non-durable experiments only.

## Product Scope

PartyKit is used for:

- team and workspace documents
- work-item descriptions that are collaborative
- migrated document body storage after `bodySource` is set to `cloudflare-yjs`

PartyKit is not used for:

- private documents
- normal non-collaborative Convex-only editing paths
- Convex-owned permission or lifecycle decisions

Private documents should never enter a PartyKit session. If collaboration is unavailable or disabled, the app should fall back to the existing non-collaborative editor behavior instead of opening a room.

## Cloudflare Plan

Start on Cloudflare Workers Free.

Required Free-plan checks before migrating production documents:

- The PartyKit cloud-prem deploy creates/accesses SQLite-backed Durable Object storage.
- Workers Free limits are measured for representative editing sessions:
  - Durable Object requests
  - duration
  - SQLite rows read
  - SQLite rows written
  - stored data
- `y-partykit` persistence uses `snapshot` mode unless an explicit offline-history requirement is approved.

Cloudflare Pro is not required for collaboration storage. If Free limits are too tight, upgrade the Workers plan to Workers Paid; do not upgrade the general Cloudflare site plan for this concern.

## Required Environment Variables

### Cloudflare deploy shell

Required for `pnpm partykit:deploy:dev` and `pnpm partykit:deploy:prod`:

- `CLOUDFLARE_ACCOUNT_ID=<cloudflare-account-id>`
- `CLOUDFLARE_API_TOKEN=<workers-edit-token>`
- `PARTYKIT_CLOUDFLARE_DEV_DOMAIN=<dev-collab-hostname>`
- `PARTYKIT_CLOUDFLARE_PROD_DOMAIN=<prod-collab-hostname>`

The domain value must be a hostname only, for example `collab-dev.example.com`. Dev and prod intentionally use separate domain env vars so a production deploy cannot silently reuse the development hostname.

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

- `NEXT_PUBLIC_PARTYKIT_URL=https://<PARTYKIT_CLOUDFLARE_DEV_DOMAIN>`
- `COLLABORATION_TOKEN_SECRET=<dev-collaboration-token-secret>`
- `CONVEX_URL=https://<convex-dev>.convex.cloud`
- `NEXT_PUBLIC_CONVEX_URL=https://<convex-dev>.convex.cloud`
- `CONVEX_SERVER_TOKEN=<convex-dev-server-token>`

Prod app:

- `NEXT_PUBLIC_PARTYKIT_URL=https://<PARTYKIT_CLOUDFLARE_PROD_DOMAIN>`
- `COLLABORATION_TOKEN_SECRET=<prod-collaboration-token-secret>`
- `CONVEX_URL=https://<convex-prod>.convex.cloud`
- `NEXT_PUBLIC_CONVEX_URL=https://<convex-prod>.convex.cloud`
- `CONVEX_SERVER_TOKEN=<convex-prod-server-token>`

Keep the app and the matching PartyKit service on the same `COLLABORATION_TOKEN_SECRET`.

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
- App-only: `COLLABORATION_BODY_MIGRATION_ENABLED=true` is required before the app will sign one-time body migration requests. Leave it disabled outside controlled migration windows.

## Release Coordination

Treat collaboration releases as a multi-layer contract.

Deploy all required layers together when a change touches any of:

- PartyKit room/server behavior
- collaboration session issuance
- collaboration token semantics
- collaborative editor boot or save lifecycle
- Convex-backed collaboration helpers or scoped-sync freshness behavior
- body-source migration behavior

Typical combinations:

- PartyKit-only runtime change: PartyKit deploy only
- app-only UI change: Vercel/web deploy only
- collaboration contract change: Vercel + PartyKit + Convex together when applicable

Do not assume a collaboration change is safe to roll out with only one layer updated unless the change has been explicitly designed to tolerate mixed versions.

## Deployment Commands

Deploy dev to Cloudflare cloud-prem:

```bash
pnpm partykit:deploy:dev
```

Deploy prod to Cloudflare cloud-prem:

```bash
pnpm partykit:deploy:prod
```

These commands require `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, and the target cloud-prem domain env var.

Legacy managed deployments:

```bash
pnpm partykit:deploy:managed:dev
pnpm partykit:deploy:managed:prod
```

Use managed deployments only for non-durable experiments. Do not point migrated `cloudflare-yjs` production documents at managed `*.partykit.dev` storage.

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
- `migration_seed_started`
- `migration_seed_succeeded`
- `migration_seed_skipped`
- `refresh_received`
- `refresh_applied`
- `refresh_conflict`
- `refresh_projection_skipped`
- `room_closed`
- `limit_rejected`

## Rollback

If a collaboration deploy is unhealthy:

1. Redeploy the previous known-good PartyKit code to the same cloud-prem service name and domain.
2. If necessary, set `NEXT_PUBLIC_ENABLE_COLLABORATION=false` in the app to disable collaboration completely.
3. For unmigrated `convex-html` documents, Convex remains canonical and no body rollback is needed.
4. For migrated `cloudflare-yjs` documents, do not flip `bodySource` back to `convex-html` unless the room is frozen, Yjs state has been exported to HTML/JSON, and the rollback projection is verified.

## Verification Checklist

### Local/dev

- local Next.js app boots without running a local PartyKit process
- `NEXT_PUBLIC_PARTYKIT_URL` points at the dev cloud-prem domain
- two clients can edit the same team/workspace document live
- two clients can edit the same work-item description live
- private documents remain Convex-only and do not request collaboration sessions
- unmigrated `convex-html` documents preserve existing Convex bootstrap behavior
- migrated test documents do not receive Convex `contentJson`/`contentHtml` in the session bootstrap
- migrated test documents survive worker restart/cold reconnect without reseeding from Convex projection
- migrated test documents preserve typing, active block, cursor, and selection awareness after another user inserts content above a remote caret
- PartyKit dev logs show room bootstrap and projection persistence against Convex dev

### Cloudflare Free gate

- Durable Object namespace is SQLite-backed
- Workers usage stays under Free request and duration limits for representative sessions
- SQLite row reads, row writes, and stored data are measured after representative sessions
- upgrade threshold to Workers Paid is documented before production body migration

### Prod

- `NEXT_PUBLIC_PARTYKIT_URL` points at the prod cloud-prem domain
- collaboration session issuance succeeds for non-private documents
- private documents remain non-collaborative
- manual flush with work-item title + description persists projection updates
- migrated documents reload from Cloudflare Yjs body state, not Convex projection content
- migrated documents preserve remote cursor/selection positions across paragraph inserts and other content shifts

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

- Symptoms: large documents fail to seed, sync, or flush; logs show `collaboration_payload_too_large`, `collaboration_state_too_large`, or Cloudflare storage errors.
- Inspect: `pnpm partykit:tail:prod | rg "payload_too_large|state_too_large|limit_rejected|SQLITE_FULL"`.
- Healthy signal: normal-sized documents seed and flush with `flush_succeeded`.
- Rollback: use non-collaborative editing for affected unmigrated documents; freeze and export migrated documents before changing body source.
- Verify: affected document either opens in fallback mode or is reduced below the configured cap.

### Flush Or Projection Failure

- Symptoms: edits appear live but Convex projection/read/search/reference state is stale; logs show `flush_failed` without later `flush_succeeded`.
- Inspect: `pnpm partykit:tail:prod | rg "flush_started|flush_succeeded|flush_failed"`.
- Healthy signal: every meaningful `flush_started` has a corresponding `flush_succeeded` or a known no-op unchanged content path.
- Rollback: redeploy previous known-good PartyKit service; disable collaboration if persistence remains unhealthy.
- Verify: edit and reload a migrated document; body remains from Cloudflare Yjs, while Convex projection eventually matches.

### Suspected Drift

- Symptoms: active room content differs from Convex projection or between clients.
- Inspect: `pnpm partykit:tail:prod | rg "refresh_projection_skipped|refresh_conflict|flush_failed|persist_failed"`.
- Healthy signal: migrated rooms ignore Convex projection refreshes and persist projections from server-held Yjs state.
- Rollback: disable collaboration and freeze affected migrated rooms before any body-source rollback.
- Verify: reload clients and confirm they converge on the Cloudflare Yjs body for migrated documents.

### Cursor Or Typing Position Drift

- Symptoms: remote cursor, selection, active block, or typing indicator appears in the wrong paragraph after another editor inserts content above it.
- Inspect: browser/editor diagnostics for duplicate editor initialization, Convex bootstrap body usage, and Yjs provider sync timing.
- Healthy signal: awareness markers are derived from the same synced Yjs document as body edits and move with relative-position mapping.
- Rollback: disable migrated-body rollout for affected documents and keep them on `convex-html` until the awareness mapping regression is fixed.
- Verify: two clients edit the same migrated document; place one caret several paragraphs down, insert content above it from the other client, and confirm the remote marker shifts with the document.

### Refresh Conflict

- Symptoms: users are asked to reload after an external canonical update.
- Inspect: `pnpm partykit:tail:prod | rg "refresh_received|refresh_conflict|refresh_projection_skipped|room_closed"`.
- Healthy signal: `convex-html` clean rooms may emit `refresh_applied`; dirty rooms emit `refresh_conflict`; `cloudflare-yjs` rooms emit `refresh_projection_skipped`.
- Rollback: if conflicts are noisy, disable collaboration and investigate external update sources.
- Verify: clean unmigrated-room external update applies; dirty unmigrated-room update does not overwrite active edits; migrated-room projection refresh does not replace body content.

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

- Symptoms: reconnect after restart loses or duplicates body content.
- Inspect: `pnpm partykit:tail:prod | rg "room_seeded|connect_accepted|refresh_projection_skipped"`.
- Healthy signal: unmigrated rooms seed from Convex content; migrated rooms load existing Cloudflare Yjs state and do not append/duplicate body content.
- Rollback: redeploy previous known-good PartyKit service if cold load fails.
- Verify: restart/redeploy and re-open the same document in two clients.

### Collaboration Disabled Fallback

- Symptoms: collaboration incident requires isolation.
- Inspect: app logs for fallback diagnostics and PartyKit logs for reduced traffic.
- Healthy signal: editors remain usable through non-collaborative paths where supported.
- Rollback action: set `NEXT_PUBLIC_ENABLE_COLLABORATION=false`.
- Verification: reload the app and confirm documents/work-item descriptions open without PartyKit sessions.
