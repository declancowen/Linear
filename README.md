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

The app expects `NEXT_PUBLIC_CONVEX_URL` to be set. An example is included in `.env.example`.

Required environment variables:

- `NEXT_PUBLIC_CONVEX_URL`
- `CONVEX_DEPLOY_KEY`
- `WORKOS_CLIENT_ID`
- `WORKOS_API_KEY`
- `WORKOS_COOKIE_PASSWORD`
- `NEXT_PUBLIC_WORKOS_REDIRECT_URI`
- `APP_URL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

Useful commands:

```bash
pnpm convex:codegen
pnpm convex:deploy
pnpm bootstrap:workspace -- --email declan@reciperoom.io --workspace-name "Recipe Room" --team-name "Recipe Room" --team-join-code RECIPE24
```

The current repo has already been deployed and seeded against the configured Convex deployment.

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
