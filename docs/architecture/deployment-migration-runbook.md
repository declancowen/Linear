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
| `pnpm partykit:deploy:dev` | deploy hosted PartyKit collaboration runtime to the dev Cloudflare service | yes | targets `linear-collaboration-dev` |
| `pnpm partykit:deploy:prod` | deploy hosted PartyKit collaboration runtime to the prod Cloudflare service | yes | targets `linear-collaboration-prod` |
| `pnpm partykit:tail:dev` | tail logs from the dev hosted PartyKit service | no | operational verification for `linear-collaboration-dev` |
| `pnpm partykit:tail:prod` | tail logs from the prod hosted PartyKit service | no | operational verification for `linear-collaboration-prod` |
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
- `NEXT_PUBLIC_PARTYKIT_URL`
- `COLLABORATION_TOKEN_SECRET`
- `WORKOS_API_KEY`
- `WORKOS_CLIENT_ID`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `CRON_SECRET`
- `APP_URL` or `NEXT_PUBLIC_APP_URL`

Rules:

- never assume `.env.local` points at the correct environment
- confirm the target deployment before every mutating script
- do not run production-affecting scripts from a local shell unless the environment target is explicit and intentional

## Standard deploy choreography

Use this sequence whenever a change affects Convex schema, generated bindings, migration-sensitive reads, or the hosted collaboration runtime.

For collaboration/scoped-sync work, think in terms of three deployable layers:

- web app (`Next.js` / Vercel)
- PartyKit collaboration runtime
- Convex backend functions/helpers

If the change crosses those boundaries, the release is coordinated. Do not treat it as a single-service deploy.

1. Run local verification:
   - `pnpm convex:codegen`
   - `pnpm check`
2. Confirm generated bindings are clean:
   - no diff in `convex/_generated`
3. Deploy to the intended non-prod environment first:
   - `pnpm convex:deploy`
4. Deploy the web app to the same non-prod environment when route, UI, or browser contract changes are involved.
5. If the change depends on backfilled lookup fields, run:
   - `pnpm maintenance:backfill-lookups`
6. Verify post-deploy status:
   - backfill reports zero remaining when applicable
   - critical route/test smoke paths still pass
7. If the change affects the hosted collaboration runtime, deploy PartyKit to the matching environment:
   - `pnpm partykit:deploy:dev`
8. Tail hosted collaboration logs during smoke verification:
   - `pnpm partykit:tail:dev`
9. Repeat the same choreography for production:
   - `pnpm convex:deploy`
   - deploy the matching web app build
   - `pnpm partykit:deploy:prod`
   - `pnpm partykit:tail:prod`

### Collaboration-specific note

If a release changes collaborative editor behavior, PartyKit session/bootstrap behavior, or scoped-sync freshness/error handling, assume `web + PartyKit + Convex` must be aligned unless the implementation is explicitly backward compatible across mixed versions.

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
- hosted PartyKit deployment choreography

The repo does not yet fully own:

- desktop packaging/signing/update automation
- scheduled execution for digest and sync flows

The queued outbound-email worker is now repo-owned through the scheduled
`/api/internal/email-jobs` route.
