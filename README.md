# Linear-Style Multi-Work App

Phase 1 plus the Phase 2 Convex baseline for a Linear-style workspace app built with `Next.js`, `shadcn/ui`, a production Convex deployment, and an Electron-ready desktop wrapper.

## What is included

- Workspace and team shell with sidebar navigation
- Inbox and assigned-to-me surfaces
- Team and workspace projects, views, and docs
- Work item board, list, and timeline views
- Work item, project, and document detail pages
- Rich document and description editing with Tiptap OSS
- Threaded comments on work items and docs
- Mocked invites, team join codes, profile editing, and workspace branding
- Convex schema, queries, mutations, and generated API bindings
- Convex-backed data hydration with Zustand retaining local UI state
- Electron `main` and `preload` entrypoints for a desktop wrapper

## Run

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Convex

The app expects a Convex deployment URL plus a shared server token between the
Next.js app, Convex functions, and operational scripts. An example is included in
`.env.example`.

Required environment variables:

- `CONVEX_URL`
- `NEXT_PUBLIC_CONVEX_URL`
- `CONVEX_SERVER_TOKEN`
- `CONVEX_DEPLOY_KEY`
- `WORKOS_CLIENT_ID`
- `WORKOS_API_KEY`
- `WORKOS_COOKIE_PASSWORD`
- `WORKOS_COOKIE_DOMAIN`
- `NEXT_PUBLIC_WORKOS_REDIRECT_URI`
- `APP_MODE`
- `APP_URL`
- `PORTAL_URL`
- `PROJECTS_URL`
- `TEAMS_URL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `HMS_ACCESS_KEY`
- `HMS_SECRET`
- `HMS_TEMPLATE_ID`
- `HMS_TEMPLATE_SUBDOMAIN`

WorkOS note:

- `portal.reciperoom.io` should own the shared WorkOS sign-in endpoint, homepage, and callback route.
- `projects.reciperoom.io` keeps the project UI, onboarding, invites, and workspace entry.
- Use the same `WORKOS_CLIENT_ID`, `WORKOS_COOKIE_PASSWORD`, and `WORKOS_COOKIE_DOMAIN=reciperoom.io` across portal and product deployments to share the session cookie across subdomains.
- `NEXT_PUBLIC_WORKOS_REDIRECT_URI` should point at the portal callback URL in production. For local work with a production AuthKit client, `127.0.0.1` is the safe loopback callback host.

Useful commands:

```bash
pnpm convex:codegen
pnpm convex:deploy
pnpm bootstrap:workspace -- --email declan@reciperoom.io --workspace-name "Recipe Room" --team-name "Recipe Room" --team-join-code RECIPE24
```

`CONVEX_URL` is the preferred server-side setting. `NEXT_PUBLIC_CONVEX_URL` is
still used by the browser to detect whether the app is running against a live
backend, but snapshot reads now go through authenticated Next.js API routes.

The current repo has already been deployed and seeded against the configured Convex deployment.

## 100ms video

Team chat now includes a 100ms launch action that opens the team's persistent
Prebuilt room inside a modal.

Add these environment variables before using it:

- `HMS_ACCESS_KEY`
- `HMS_SECRET`
- `HMS_TEMPLATE_ID`
- `HMS_TEMPLATE_SUBDOMAIN`

The server persists a stable room per chat conversation for the persistent join
flow, creates one-off rooms for started call threads, and maps app roles to 100ms
roles:

- `admin` and `member` join as `host`
- `viewer` and `guest` join as `guest`

## Desktop

Development mode:

```bash
pnpm desktop:dev
```

Production-style desktop startup after a build:

```bash
pnpm build
pnpm desktop:start
```

## Verification

These commands pass in the current repo state:

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm convex:codegen
pnpm exec electron --version
```

## Key files

- `components/app/shell.tsx`
- `components/app/screens.tsx`
- `components/app/rich-text-editor.tsx`
- `lib/store/app-store.ts`
- `lib/domain/seed.ts`
- `electron/main.mjs`
- `electron/preload.mjs`
