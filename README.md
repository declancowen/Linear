# Linear

Internal project workspace app built with `Next.js`, `Convex`, `WorkOS`, hosted `PartyKit` collaboration services, and an optional `Electron` desktop shell.

This README is intended for contributors joining the repo so they can get the project running locally without needing existing team context.

## Stack

- `Next.js` App Router for the web app and API routes
- `Convex` for app data, queries, mutations, and generated bindings
- `PartyKit` + `Yjs` for live collaborative editing and transient chat presence
- scoped read-model sync for bounded realtime refreshes, with legacy snapshot streaming kept as a rollback path
- `WorkOS AuthKit` for authentication and organization membership
- `Resend` for email delivery
- `100ms` for video/call rooms
- `Electron` for the desktop wrapper
- `pnpm` for package management

## Project structure

- `app/`: Next.js pages, layouts, auth routes, and API routes
- `components/`: app UI and shared UI primitives
- `convex/`: schema, functions, and generated Convex API bindings
- `electron/`: desktop entrypoints
- `hooks/`: client hooks for collaboration, scoped refresh, and retained UI state
- `lib/`: server helpers, auth helpers, Convex client code, collaboration utilities, and shared app logic
- `services/partykit/`: hosted PartyKit collaboration runtime
- `scripts/`: operational scripts for bootstrapping and maintenance
- `tests/`: Vitest coverage for app, Convex, collaboration, scripts, and Electron behavior
- `docs/architecture/`: operational runbooks and architecture notes

## Prerequisites

Before you start, make sure you have:

- A recent version of `Node.js`
- `pnpm` installed
- Access to the required third-party services:
  - Convex
  - PartyKit / Cloudflare for deploying and inspecting the hosted collaboration runtime
  - WorkOS
  - Resend
  - 100ms

## Environment variables

Copy the example file and fill in real values locally:

```bash
cp .env.example .env.local
```

The app expects the following variables.

Use the exact runtime env names below in `.env.local`. Do not create parallel
`*_DEVELOPMENT` or `*_PRODUCTION` copies in the same file. If you want to point
local development at production services, keep the provider credentials here and
use local values only for the app URL fields.

If you want the file to also capture development and production reference
profiles, keep that information as comment-only blocks in `.env.local`, grouped
by provider. Do not add extra live env variable names for those references
unless the runtime actually reads them.

### Convex

- `CONVEX_URL`: server-side Convex deployment URL
- `NEXT_PUBLIC_CONVEX_URL`: browser-visible Convex deployment URL
- `CONVEX_SERVER_TOKEN`: shared server token used by Next.js routes and Convex functions for the active app environment
- `CONVEX_DEPLOY_KEY`: Convex deploy key used for deployment/codegen workflows

### Realtime / collaboration

- `NEXT_PUBLIC_PARTYKIT_URL`: canonical hosted PartyKit base URL for the active environment
- `COLLABORATION_TOKEN_SECRET`: shared token secret used by the app and the matching PartyKit service
- `NEXT_PUBLIC_ENABLE_COLLABORATION`: optional collaborative editor flag, defaults to enabled
- `NEXT_PUBLIC_ENABLE_SCOPED_SYNC`: optional scoped read-model sync flag, defaults to enabled
- `NEXT_PUBLIC_ENABLE_LEGACY_SNAPSHOT_STREAM`: optional legacy snapshot stream flag, defaults to disabled

New config should use `NEXT_PUBLIC_PARTYKIT_URL`. The runtime still accepts the
older `PARTYKIT_URL`, `NEXT_PUBLIC_COLLABORATION_SERVICE_URL`, and
`COLLABORATION_SERVICE_URL` aliases, but they should not be used for new env
profiles.

### WorkOS

- `WORKOS_CLIENT_ID`: WorkOS client ID
- `WORKOS_API_KEY`: WorkOS server API key
- `WORKOS_COOKIE_PASSWORD`: cookie encryption secret
- `WORKOS_COOKIE_DOMAIN`: shared auth cookie domain, usually blank on localhost
- `NEXT_PUBLIC_WORKOS_REDIRECT_URI`: WorkOS callback URL

### Vercel / App hosting

- `APP_URL`: base app URL used by the app and email links
- `NEXT_PUBLIC_APP_URL`: public app origin fallback used by email and script helpers
- `TEAMS_URL`: app/team entry URL used in auth routing
- `NEXT_DEV_SERVER_URL`: optional Electron dev-server override

### Email

- `RESEND_API_KEY`: Resend API key
- `RESEND_FROM_EMAIL`: sender address for outbound email
- `RESEND_FROM_NAME`: optional sender display name for outbound email
- `CRON_SECRET`: bearer secret used by Vercel cron routes
- `DRY_RUN`: optional script flag for previewing notification digests without sending them

### Video / calls

- `HMS_ACCESS_KEY`: 100ms access key
- `HMS_SECRET`: 100ms secret
- `HMS_TEMPLATE_ID`: 100ms room template ID
- `HMS_TEMPLATE_SUBDOMAIN`: 100ms subdomain

## Provider verification

These commands help verify the linked project and the provider-side env names
without changing local runtime config:

```bash
vercel env ls
vercel env pull .vercel/.env.production.local
convex env list
```

The linked Vercel project metadata lives in `.vercel/project.json`. Keep that
metadata there instead of copying `VERCEL_*` values into `.env.local`.

## Local setup

1. Install dependencies:

```bash
pnpm install
```

2. Create your local env file:

```bash
cp .env.example .env.local
```

3. Fill in the required environment variables in `.env.local`.

4. Start the web app:

```bash
pnpm dev
```

5. Open `http://localhost:3000`.

Local web development uses the hosted dev PartyKit service. Do not start a
separate local `partykit dev` process for normal app work.

## PartyKit and collaboration

PartyKit is the live room/runtime layer only. Convex remains canonical for app
data, document content, work-item descriptions, and permission checks.

Hosted services are mapped 1:1 to Convex:

- `linear-collaboration-dev` -> Convex dev
- `linear-collaboration-prod` -> Convex prod

Use these app env values with the matching provider stack:

- local/dev app: `NEXT_PUBLIC_PARTYKIT_URL=https://linear-collaboration-dev.<subdomain>.partykit.dev`
- production app: `NEXT_PUBLIC_PARTYKIT_URL=https://linear-collaboration-prod.<subdomain>.partykit.dev`

For each hosted PartyKit service, provision these secrets directly in
Cloudflare/PartyKit:

- `CONVEX_URL`
- `CONVEX_SERVER_TOKEN`
- `COLLABORATION_TOKEN_SECRET`

The app and the matching PartyKit service must use the same
`COLLABORATION_TOKEN_SECRET`. Do not rely on `.env.local` to inject service
secrets during PartyKit deploys.

Current PartyKit scope:

- team and workspace document collaboration
- collaborative work-item descriptions, including main-section flushes that can persist title and description together
- ephemeral chat presence and typing state

Not in PartyKit scope:

- private documents
- non-collaborative Convex-only editor paths
- long-term storage ownership or permission decisions

Collaboration sessions are issued by the Next.js API routes under
`app/api/collaboration/`. The client receives a short-lived signed room token,
then connects to the hosted PartyKit room. Document rooms reseed from Convex on
connect and flush canonical content back to Convex on debounce, manual save, and
last-editor teardown paths.

Deploy the hosted runtime with `pnpm partykit:deploy:dev` or
`pnpm partykit:deploy:prod`, then inspect it with the matching
`pnpm partykit:tail:*` command. If a change touches PartyKit room behavior,
session issuance, token semantics, collaborative editor boot/save behavior, or
Convex-backed collaboration helpers, coordinate the web app, PartyKit, and Convex
deploys unless the change is explicitly backward compatible across mixed
versions.

If collaboration needs to be disabled without rolling back the whole app, set:

```bash
NEXT_PUBLIC_ENABLE_COLLABORATION=false
```

## Common commands

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm typecheck
pnpm test
pnpm test:watch
pnpm check
pnpm audit:deps
pnpm convex:codegen
pnpm convex:deploy
pnpm partykit:deploy:dev
pnpm partykit:deploy:prod
pnpm partykit:tail:dev
pnpm partykit:tail:prod
pnpm maintenance:backfill-lookups
pnpm maintenance:backfill-workspace-memberships
pnpm desktop:dev
pnpm desktop:start
pnpm desktop:smoke
pnpm desktop:package:mac
```

## Bootstrap and maintenance scripts

These scripts require a correctly configured `.env.local` and usually talk to live services:

- `pnpm bootstrap:workspace`: create/bootstrap a workspace for a user
- `pnpm maintenance:backfill-lookups`: backfill legacy lookup fields and label/workspace ownership metadata
- `pnpm maintenance:backfill-workspace-memberships`: backfill workspace membership records
- `pnpm emails:send-jobs`: send queued outbound email jobs from the durable email outbox
- `pnpm notifications:send-digests`: send notification digest emails
- production queued email delivery runs through the scheduled `/api/internal/email-jobs` worker
- `pnpm sync:workos:workspaces`: sync Convex workspaces to WorkOS organizations

`BACKFILL_BATCH_LIMIT=<n>` can be used to reduce mutation batch size for the
backfill scripts.

Operational expectations for deploys, backfills, sync jobs, and desktop smoke
checks are documented in [docs/architecture/deployment-migration-runbook.md](docs/architecture/deployment-migration-runbook.md).

Collaboration-specific architecture and operations:

- [docs/architecture/partykit-cloudflare-runbook.md](docs/architecture/partykit-cloudflare-runbook.md)
- [docs/architecture/realtime-collaboration-rollout.md](docs/architecture/realtime-collaboration-rollout.md)
- [docs/architecture/collaboration-production-assessment.md](docs/architecture/collaboration-production-assessment.md)

## Desktop app

For web-only work, `pnpm dev` is enough.

If you need the Electron shell in development:

```bash
pnpm desktop:dev
```

For a production-style desktop run:

```bash
pnpm build
pnpm desktop:start
```

## Notes for contributors

- Do not commit real secrets or copied `.env.local` values
- Update `.env.example` when new required environment variables are added
- `convex/_generated/` is generated output; run `pnpm convex:codegen` if Convex types drift
- Some scripts mutate shared data or external services, so do not run them casually against production credentials
