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
