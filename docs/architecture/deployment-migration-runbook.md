# Deployment And Migration Runbook

## Purpose

This document defines the minimum repo-owned operating contract for privileged scripts, Convex deploys, and migration/backfill work.

It is intentionally practical. The goal is to remove ambiguity from the flows that can mutate shared state or external systems.

## Principles

- run privileged scripts only against the intended environment
- prefer explicit verification before and after every mutation
- backfills and sync jobs must be safe to re-run
- deploy choreography must be documented before schema assumptions tighten
- repo-owned commands are the source of truth for how these operations are executed

## Owned entrypoints

| Command | Purpose | Mutates shared state | Notes |
|--------|--------|--------|--------|
| `pnpm convex:codegen` | refresh generated Convex bindings | no | must leave `convex/_generated` clean in CI |
| `pnpm convex:deploy` | deploy Convex functions/schema to the configured environment | yes | run only after confirming env target |
| `pnpm maintenance:backfill-lookups` | patch legacy lookup fields and label/workspace ownership metadata | yes | safe to re-run; supports `BACKFILL_BATCH_LIMIT` |
| `pnpm sync:workos:workspaces` | reconcile Convex workspaces to WorkOS organizations | yes | mutates WorkOS and Convex |
| `pnpm bootstrap:workspace` | create/bootstrap a workspace and team for a user | yes | intended for controlled setup flows, not casual local use |
| `pnpm notifications:send-digests` | send unread-notification digest emails | yes | supports `DRY_RUN=1`; digest claims are now enforced |
| `pnpm emails:send-jobs` | send queued outbound email jobs from the durable outbox | yes | claim-safe delivery worker; safe to re-run |
| `pnpm desktop:dev` | run Electron against the local dev server | no | development-only runtime lane |
| `pnpm desktop:start` | run Electron against the packaged production build | no | smoke path for desktop runtime |

## Environment contract

These commands depend on `.env.local` or equivalent environment injection.

Minimum high-risk variables:

- `CONVEX_URL` or `NEXT_PUBLIC_CONVEX_URL`
- `CONVEX_SERVER_TOKEN`
- `WORKOS_API_KEY`
- `WORKOS_CLIENT_ID`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `APP_URL` or `NEXT_PUBLIC_APP_URL`

Rules:

- never assume `.env.local` points at the correct environment
- confirm the target deployment before every mutating script
- do not run production-affecting scripts from a local shell unless the environment target is explicit and intentional

## Standard deploy choreography

Use this sequence whenever a change affects Convex schema, generated bindings, or migration-sensitive reads.

1. Run local verification:
   - `pnpm convex:codegen`
   - `pnpm check`
2. Confirm generated bindings are clean:
   - no diff in `convex/_generated`
3. Deploy to the intended non-prod environment first:
   - `pnpm convex:deploy`
4. If the change depends on backfilled lookup fields, run:
   - `pnpm maintenance:backfill-lookups`
5. Verify post-deploy status:
   - backfill reports zero remaining when applicable
   - critical route/test smoke paths still pass
6. Repeat the same choreography for production.

## Backfill policy

`pnpm maintenance:backfill-lookups` is the owned path for legacy lookup-field remediation.

Expectations:

- it may be run multiple times safely
- it should be run after deploy when new lookup invariants exist
- non-zero remaining rows after completion are a release blocker for changes that depend on those invariants

Useful controls:

- `BACKFILL_BATCH_LIMIT=<n>` to reduce mutation batch size

## WorkOS sync policy

`pnpm sync:workos:workspaces` is a privileged reconciliation path.

Expectations:

- run only when WorkOS organization state may have drifted
- confirm the Convex environment and WorkOS project before execution
- review output and reconcile unexpected organization changes immediately

## Notification delivery policy

`pnpm notifications:send-digests` is a privileged digest worker with claim-safe delivery semantics.

`pnpm emails:send-jobs` is the owned worker for queued outbound email jobs.

Expectations:

- use `DRY_RUN=1` when validating template/output behavior without delivery
- overlapping runners are acceptable for digests and queued outbound email jobs because claims are enforced
- queued outbound email delivery should run from the owned worker, not inline from request routes
- invite, mention, assignment, and access-change email families now run through the durable outbox

## Desktop runtime policy

Desktop is a supported runtime and should be validated explicitly.

Minimum expectation today:

1. `pnpm build`
2. `pnpm desktop:start`
3. verify the shell launches and the packaged server comes up successfully

This is only a smoke baseline. Packaging, signing, update, and release ownership remain part of the mandatory desktop/runtime architecture stream.

## Release ownership

The repo currently owns:

- command entrypoints
- deploy choreography
- backfill choreography
- desktop smoke expectation

The repo does not yet fully own:

- desktop packaging/signing/update automation
- scheduled execution for digest/email/sync flows
- scheduling/automation ownership for the durable outbound-email worker

Those are active architecture work items, not undefined responsibilities.
