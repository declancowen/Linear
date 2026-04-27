# Realtime Collaboration Rollout

This document covers rollout, observability, and rollback for the scoped-sync and collaborative-editor migration defined in `.spec/realtime-collaboration-scoped-sync/`.

## Default Runtime Mode

- `NEXT_PUBLIC_ENABLE_SCOPED_SYNC=true`
- `NEXT_PUBLIC_ENABLE_LEGACY_SNAPSHOT_STREAM=false`
- `NEXT_PUBLIC_ENABLE_COLLABORATION=true`

Default behavior:

- shell bootstrap loads through the bounded workspace-membership read model
- migrated product surfaces refresh through scoped invalidation plus targeted read-model fetches
- document and work-item rich-text editing uses the hosted PartyKit collaboration transport
- the legacy full-snapshot route remains available for compatibility recovery and explicit rollback

## Hosted PartyKit Environments

Collaboration now runs through hosted PartyKit services mapped 1:1 to Convex:

- `linear-collaboration-dev` -> Convex dev
- `linear-collaboration-prod` -> Convex prod

Operational expectations:

- Convex remains the only canonical source of truth
- PartyKit rooms reseed from Convex on connect and persist back to Convex on flush
- local web development targets the hosted dev PartyKit environment rather than a local `partykit dev` process
- private documents do not participate in collaboration rooms

## Diagnostics

Development diagnostics are emitted through `lib/browser/snapshot-diagnostics.ts`.

Signals now covered:

- bootstrap mode selection
- scoped read-model refresh success and failure
- scoped invalidation stream reconnects
- collaboration session open success and failure
- fallback activation onto the legacy snapshot path
- legacy snapshot stream reconnects

Expected log prefixes:

- `[realtime]`
- `[scoped-sync]`
- `[collaboration]`
- `[snapshot]`

## Abort Thresholds

Abort or roll back if any of the following persist during rollout:

- collaboration join or bootstrap failure rate exceeds `1%`
- scoped read-model refresh failure rate exceeds `1%`
- p95 scoped invalidation visibility exceeds `3s`
- collaborative documents show durable drift from canonical persisted content
- mention-send flows fail after collaborative edits

## Rollback Controls

### Disable collaboration only

Set:

```bash
NEXT_PUBLIC_ENABLE_COLLABORATION=false
```

Effect:

- document and work-item editors stay on the existing non-collaborative rich-text path
- scoped invalidation remains active for non-editor freshness

### Disable scoped sync and return to legacy snapshot freshness

Set either:

```bash
NEXT_PUBLIC_ENABLE_SCOPED_SYNC=false
```

or:

```bash
NEXT_PUBLIC_ENABLE_LEGACY_SNAPSHOT_STREAM=true
```

Effect:

- provider falls back to `/api/snapshot` plus `/api/snapshot/events`
- `useScopedReadModelRefresh` no-ops
- migrated surfaces regain the legacy whole-store replacement freshness path

### Full rollback

Set:

```bash
NEXT_PUBLIC_ENABLE_COLLABORATION=false
NEXT_PUBLIC_ENABLE_SCOPED_SYNC=false
```

Effect:

- editors revert to legacy non-collaborative behavior
- app freshness reverts to the legacy snapshot stream

## Verification Checklist

- confirm `NEXT_PUBLIC_PARTYKIT_URL` points at the intended hosted PartyKit environment
- open a document in two clients and confirm immediate shared edits plus presence
- open a work-item description in two clients and confirm the same
- mutate work, views, inbox, chat, channel, and search-triggering entities and confirm only the affected surfaces refetch
- force a rollback flag and confirm the app still boots and remains editable
- confirm `/api/snapshot` is no longer the default freshness path during normal scoped-sync operation
- confirm local web development works without running `pnpm partykit:dev`

## Recovery Notes

- the store runtime still retains full-snapshot refresh as a compatibility recovery path after mutation failures
- provider bootstrap will fall back to the legacy snapshot path if scoped bootstrap fails
- keep the legacy snapshot route deployed until the post-deploy verification checklist passes consistently
