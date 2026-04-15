# Linear

Internal project workspace app built with `Next.js`, `Convex`, `WorkOS`, and an optional `Electron` desktop shell.

This README is intended for contributors joining the repo so they can get the project running locally without needing existing team context.

## Stack

- `Next.js` App Router for the web app and API routes
- `Convex` for app data, queries, mutations, and generated bindings
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
- `lib/`: server helpers, auth helpers, Convex client code, and shared app logic
- `scripts/`: operational scripts for bootstrapping and maintenance

## Prerequisites

Before you start, make sure you have:

- A recent version of `Node.js`
- `pnpm` installed
- Access to the required third-party services:
  - Convex
  - WorkOS
  - Resend
  - 100ms

## Environment variables

Copy the example file and fill in real values locally:

```bash
cp .env.example .env.local
```

The app expects the following variables.

### Convex

- `CONVEX_URL`: server-side Convex deployment URL
- `NEXT_PUBLIC_CONVEX_URL`: browser-visible Convex deployment URL
- `CONVEX_SERVER_TOKEN`: shared server token used by Next.js routes, Convex functions, and scripts
- `CONVEX_SERVER_TOKEN_DEVELOPMENT` / `CONVEX_SERVER_TOKEN_PRODUCTION`: optional script-only tokens for dual-environment wipe workflows
- `CONVEX_DEPLOY_KEY`: Convex deploy key used for deployment/codegen workflows

### WorkOS

- `WORKOS_CLIENT_ID`: WorkOS client ID
- `WORKOS_API_KEY`: WorkOS server API key
- `WORKOS_COOKIE_PASSWORD`: cookie encryption secret
- `WORKOS_COOKIE_DOMAIN`: shared auth cookie domain
- `NEXT_PUBLIC_WORKOS_REDIRECT_URI`: WorkOS callback URL

### App URLs

- `APP_URL`: base app URL used by the app and email links
- `NEXT_PUBLIC_APP_URL`: public app origin fallback used by email and script helpers
- `TEAMS_URL`: app/team entry URL used in auth routing
- `NEXT_DEV_SERVER_URL`: optional Electron dev-server override

### Email

- `RESEND_API_KEY`: Resend API key
- `RESEND_FROM_EMAIL`: sender address for outbound email
- `DRY_RUN`: optional script flag for previewing notification digests without sending them

### Video / calls

- `HMS_ACCESS_KEY`: 100ms access key
- `HMS_SECRET`: 100ms secret
- `HMS_TEMPLATE_ID`: 100ms room template ID
- `HMS_TEMPLATE_SUBDOMAIN`: 100ms subdomain

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

## Common commands

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm typecheck
pnpm convex:codegen
pnpm convex:deploy
pnpm desktop:dev
pnpm desktop:start
```

## Bootstrap and maintenance scripts

These scripts require a correctly configured `.env.local` and usually talk to live services:

- `pnpm bootstrap:workspace`: create/bootstrap a workspace for a user
- `pnpm backfill:work-item-model`: run the work item model backfill
- `pnpm notifications:send-digests`: send notification digest emails
- `pnpm sync:workos:workspaces`: sync Convex workspaces to WorkOS organizations

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
