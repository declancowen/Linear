# Audit: Collaboration Source Of Truth And Cloudflare Storage

## Project context

| Field | Value |
| --- | --- |
| Repository | `Linear` |
| Remote | `https://github.com/declancowen/Linear.git` |
| Branch | `main` |
| Commit | `4cdff60c` |
| Audit date | `2026-06-06` |
| Stack | `Next.js / React / Convex / PartyKit / y-partykit / Yjs / TipTap` |

## Scope

- `services/partykit/server.ts`
- `app/api/collaboration/documents/[documentId]/session/route.ts`
- `hooks/use-document-collaboration.ts`
- `lib/convex/client/document-collaboration.ts`
- `convex/app/collaboration_documents.ts`
- `convex/app/document_handlers.ts`
- `convex/app/work_item_handlers.ts`
- `convex/validators.ts`
- `package.json`
- `.env.local`
- Outline live collaboration implementation at `outline/outline@be3f28afeaaa8b92137685376fe17fff94e62255`
- Current vendor/pricing docs for PartyKit, Cloudflare Workers, Convex, and y-partykit

## Explicit exclusions

The older repo specs and audits for realtime collaboration are intentionally not used as target-state authority in this audit. They describe a different solution: Convex HTML as the durable body and PartyKit/Yjs as the live room. This audit is based on the current code reality, architecture-standards ownership analysis, current vendor constraints, and Outline's live collaboration implementation as guidance.

## External source notes

- PartyKit pricing says managed Individual storage is cleared every 24 hours, while cloud-prem deployments to a user's own Cloudflare account have no PartyKit platform fee and pay only Cloudflare usage: https://www.partykit.io/
- PartyKit cloud-prem docs say deploys to a user's Cloudflare account require `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, and `partykit deploy --domain ...`: https://docs.partykit.io/guides/deploy-to-cloudflare/
- Cloudflare Workers pricing says Durable Objects are available on Free and Paid plans; Free can only create/access SQLite-backed Durable Objects. Free Durable Object limits include 100,000 requests/day, 13,000 GB-s/day duration, 5 million SQLite rows read/day, 100,000 rows written/day, and 5 GB stored data total. Workers Paid is separate from Cloudflare Free/Pro/Business site plans: https://developers.cloudflare.com/workers/platform/pricing/
- y-partykit docs recommend `persist: { mode: "snapshot" }` for most apps. `history` stores full edit history and is meant for offline merge cases, with a practical 10 MB history cap before snapshotting: https://docs.partykit.io/reference/y-partykit-api/#persistence
- Convex Free has hard resource caps while Starter can exceed included resources with pay-as-you-go pricing. Current documented Free database storage is 0.5 GB total and database I/O is 1 GB/month total: https://docs.convex.dev/production/state/limits

## Architecture-standards lens

This is an ownership and authority migration:

- **Current authority:** Convex owns document body content; PartyKit/Yjs owns active collaboration state.
- **Target authority:** PartyKit/Cloudflare Durable Objects own document body state; Convex owns identity, access, lifecycle, metadata, and projections.
- **Main failure consequence:** stale Convex projection can hydrate or overwrite the canonical Yjs body, causing lost edits or hydration drift.
- **Architecture standard:** body authority must be enforced at the persistence owner boundary, not by convention or docs.

## Current state versus target state

| Concern | Current repo behavior | Target behavior |
| --- | --- | --- |
| Body source of truth | `documents.content` in Convex is treated as canonical. | Cloudflare Durable Object Yjs state is canonical for migrated docs. |
| Live room | PartyKit/Yjs handles active collaboration. | PartyKit/Yjs handles active collaboration and durable body. |
| Bootstrap | Session API returns Convex `contentJson` and `contentHtml`. | Migrated sessions return identity/auth only; editor body comes from Yjs sync. |
| Cold rehydrate | PartyKit can replace Yjs room from Convex when no active users exist. | Existing persisted Yjs state is never overwritten by Convex projection. |
| Projection | Convex body write is the canonical save. | Convex projection is derived from Yjs and used for search, mentions, references, previews, and read models. |
| Deploy target | Scripts/env point at managed `*.partykit.dev`. | PartyKit cloud-prem in the user's Cloudflare account. |
| Cost path | Convex carries body storage/I/O growth. | Start Cloudflare Workers Free; upgrade only to Workers Paid if limits require it. |

## Outline guidance

Outline's implementation is the most useful comparison. Outline does not keep canonical collaboration state in a transient collaboration host. It persists Yjs state in its primary database next to a ProseMirror JSON projection, loads existing Yjs state first, migrates from older content only once under a row lock, and writes both Yjs state and projection transactionally. It also has API-update sync, editor-version gates, connection limits, payload limits, Redis-assisted scaling, and metrics.

For Linear, the closest cost-conscious version of that pattern is:

1. PartyKit cloud-prem on Cloudflare Durable Objects owns the durable Yjs body.
2. Convex owns metadata, access control, document identity, lifecycle, references, search/mention/read projections, and work item links.
3. Convex `documents.content` becomes a projection/cache for app read models, not the canonical body once a document is migrated.

## Findings

### COLLAB-ST-001 - High - Current cold-room seeding can overwrite durable PartyKit state from Convex

`services/partykit/server.ts:1375` calls `unstable_getYDoc` and then always fetches the Convex bootstrap payload. When `hasActiveConnections` is false, `services/partykit/server.ts:1390` replaces the Y.Doc from Convex if the JSON differs.

That is incompatible with making PartyKit/Cloudflare Durable Object storage the body source of truth. A cold room with valid persisted Yjs state could be overwritten by stale Convex projection content.

Required fix in the future implementation: seed from Convex only when the durable Yjs room has no body state or an explicit migration marker says this is the first import. Never use Convex projection drift to rewrite persisted Yjs body state.

### COLLAB-ST-002 - High - Session bootstrap still sends Convex body content to the editor

`app/api/collaboration/documents/[documentId]/session/route.ts:101` returns `contentJson` and `contentHtml` from `collaborationDocument.content`. `hooks/use-document-collaboration.ts:187` consumes those fields as bootstrap content.

That preserves a split-initial-state path: the React/editor surface can hydrate from Convex while the provider is syncing from PartyKit. If PartyKit becomes canonical, the session response should identify the room and permissions but should not provide Convex body content as editor initial state except in a controlled migration/fallback mode.

### COLLAB-ST-003 - High - The current PartyKit persist mode is cost-risky for normal documents

`services/partykit/server.ts:1332` uses `persist: { mode: "history" }`. y-partykit documents `snapshot` as recommended for most applications and describes `history` as full edit history for offline merge cases with practical growth limits.

If the plan is Cloudflare Free first, `history` has a worse cost and quota profile because update history means more stored records and compaction pressure. Normal documents and work item descriptions should use `snapshot` unless the product explicitly supports long-lived offline collaborative edits.

### COLLAB-ST-004 - High - Convex projection pipeline is required before removing Convex body authority

`convex/app/collaboration_documents.ts:133` returns `document.content`; `services/partykit/server.ts:872` persists HTML back into Convex; document/work item handlers use document content to maintain mentions, references, previews, and scoped read model invalidations.

If PartyKit owns the body, Convex still needs an idempotent projection pipeline from Yjs to Convex. The pipeline must update:

- `documents.content` or a renamed projection field
- mention counts and notifications
- linked document/work item references
- search/read model invalidation keys
- work item description projections through `descriptionDocId`

The projection must be explicitly non-authoritative for body edits.

### COLLAB-ST-005 - Medium - Current deployment configuration targets managed PartyKit, not Cloudflare cloud-prem

`package.json:15` and `package.json:16` run `partykit deploy --name ...` without a `--domain`. `.env.local:26` through `.env.local:29` point at `*.partykit.dev`.

That is fine for development experiments, but not for durable document bodies. PartyKit's managed Individual plan clears storage every 24 hours. Durable document storage needs cloud-prem deployment into the user's Cloudflare account.

### COLLAB-ST-006 - Medium - Cloudflare Free is the right starting plan, but it needs hard-limit observability

Cloudflare Free can use SQLite-backed Durable Objects, but the free plan is bounded by daily DO requests, duration, row reads/writes, and total stored data. The plan should start on Workers Free, with these conditions:

- PartyKit cloud-prem deploy creates SQLite-backed Durable Object namespaces, because Free cannot use key-value-backed Durable Objects.
- y-partykit `snapshot` persistence row/write behavior is measured under representative editor traffic.
- WebSocket hibernation/idle behavior is understood and monitored.
- Usage checks and an upgrade path to Workers Paid exist before production content is moved.

Cloudflare Pro is not required for this plan. Workers Paid at `$5/month` plus usage is the upgrade path only if Free limits are hit or too close for comfort.

### COLLAB-ST-007 - Medium - Backup, export, and restore are underspecified if body authority leaves Convex

Convex rows are currently the obvious backup/export surface because document bodies live there. If durable bodies move to Cloudflare Durable Objects, the system needs a backup and recovery surface for Yjs state. Durable Object storage is not enough by itself for app-level export, point-in-time recovery, or migration rollback.

Required future design: scheduled export/snapshot of canonical Yjs state into a backup target, plus a tested room restore flow.

## Recommendation

Proceed with the Cloudflare Workers plan, but only as a designed migration:

1. Use PartyKit cloud-prem on the user's Cloudflare account.
2. Start on Cloudflare Workers Free.
3. Upgrade to Workers Paid at `$5/month` plus usage only if observed limits require it.
4. Make PartyKit/Cloudflare Durable Object Yjs state the single body source of truth for migrated collaborative documents.
5. Keep Convex Free for metadata, permissions, document/work-item references, and projections.
6. Do not implement the source-of-truth switch until the spec in `.spec/collaboration-cloudflare-source-of-truth/` is reviewed.

## Verification performed

- `git status --short` before spec work was clean.
- Re-read local collaboration server, session bootstrap, hook bootstrap, Convex collaboration payloads, work item document linkage, deploy scripts, and env configuration.
- Inspected y-partykit installed types and docs for persistence modes.
- Inspected Outline collaboration persistence, API update, and collaborative updater implementation at `be3f28afeaaa8b92137685376fe17fff94e62255`.
- Verified current PartyKit/Cloudflare/Convex pricing and storage facts from primary docs on `2026-06-06`.
- Excluded old collaboration specs/audits as solution authority because they describe the previous Convex-canonical architecture.
