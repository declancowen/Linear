# Workspace Creation Pattern Explanation

This app treats workspace creation as an authenticated post-signup onboarding flow.

WorkOS/AuthKit owns identity and the authenticated session. Convex owns the app-side workspace, user, membership, and admin model. WorkOS organizations are then reconciled to match the Convex workspace.

The main pattern is:

1. A user signs up or signs in through the WorkOS/AuthKit auth pattern.
2. The app reconciles the local Convex user context.
3. If the user has no current workspace, the workspace layout/root flow sends them to `/onboarding`.
4. `/onboarding` renders a workspace creation form when the user does not already have a workspace.
5. The form posts through the client route helper to `/api/workspaces`.
6. The server route requires an AuthKit session and Convex app context.
7. Convex creates the workspace, makes the creator an admin, and sets it as the user's current workspace.
8. The route best-effort reconciles the new workspace to WorkOS organization state.
9. The client redirects the user into `/workspace/projects`.

In short:

```text
Account auth succeeds
  -> local Convex user exists
  -> no current workspace
  -> /onboarding
  -> create workspace form
  -> /api/workspaces
  -> Convex create workspace + admin membership
  -> reconcile WorkOS organization/membership
  -> enter workspace
```

## Architectural Ownership

WorkOS owns:

- authenticated identity
- AuthKit session
- provider user ID
- provider organization ID
- provider organization membership

Convex owns:

- app user record
- workspace record
- workspace slug/name/settings
- workspace owner
- workspace membership role
- selected/current workspace state
- team/workspace scaffolding
- app authorization flags

The app owns:

- onboarding page routing
- workspace creation UI
- workspace creation API route
- checking whether the user is allowed to create a workspace
- mapping the new Convex workspace to a WorkOS organization
- making the creator ready to use the product

The important distinction is:

```text
WorkOS proves who the user is.
Convex decides what workspace they own or administer.
```

## Account Creation to Onboarding

Signup itself does not directly create a workspace.

The signup flow authenticates with WorkOS, saves the AuthKit session, and reconciles the local app user. After that, the user is redirected to the normalized `next` path. The default post-auth path is:

```text
/workspace/projects
```

If the user reaches the workspace shell without a current workspace, the workspace layout redirects them to:

```text
/onboarding
```

The root page follows the same mental model:

```text
withAuth()
  -> ensureAuthenticatedAppContext(...)
  -> if no current workspace, redirect /onboarding
```

This keeps account creation and workspace creation separate:

```text
identity account
  !=
workspace setup
```

## Onboarding Page Pattern

The onboarding page starts by resolving the AuthKit session:

```text
withAuth()
```

If there is no authenticated user, the page redirects to login with a `next` path back to onboarding.

If there is an authenticated user but the page has not gone through session resolution yet, it redirects through:

```text
/auth/session
```

That makes sure the AuthKit session is fresh before the user creates or joins a workspace.

Then onboarding loads workspace entry state from:

```ts
getWorkspaceEntryJoinState(user, organizationId)
```

That gives the page:

- current workspace
- pending invites
- joined team IDs

If the user already has a current workspace and is not handling an invite or join code, onboarding redirects to:

```text
/workspace/projects
```

If the user does not have a current workspace, onboarding renders:

```ts
OnboardingWorkspaceForm
```

The same onboarding page can also show invite and join-code entry options.

## Workspace Creation Form

The workspace creation UI lives in:

```text
components/app/onboarding-workspace-form.tsx
```

It collects:

- workspace name
- workspace description
- optional workspace logo file

The form validates basic client-side input constraints and then calls:

```ts
syncCreateWorkspace({
  name,
  description,
})
```

That helper sends:

```text
POST /api/workspaces
```

with JSON:

```json
{
  "name": "Product Development",
  "description": "Roadmaps, priorities, and release planning for the core product team."
}
```

If workspace creation succeeds and a logo file was selected, the client then uploads the logo and updates current workspace branding through the normal workspace settings route.

The final client action is:

```text
window.location.replace("/workspace/projects")
```

## Workspace Creation Route

The route is:

```text
POST /api/workspaces
```

It performs these steps:

```text
requireSession()
  -> parse workspaceSetupSchema
  -> requireAppContext(session)
  -> reject if currentWorkspace exists
  -> reject if pendingWorkspace exists
  -> createWorkspaceServer(...)
  -> best-effort reconcileAuthenticatedAppContext(...)
  -> return workspace ID and slug
```

The route requires both:

- a WorkOS/AuthKit session
- a local Convex app user context

That means an unauthenticated browser cannot create a workspace, and a provider-authenticated user still needs to exist in the app data model first.

The route also prevents duplicate first-workspace creation by rejecting the request if the app context already has:

- `currentWorkspace`
- `pendingWorkspace`

The rejection message is:

```text
You already have an active workspace
```

## Convex Workspace Creation

The server route delegates actual workspace creation to:

```ts
createWorkspaceServer(...)
```

which calls the Convex mutation:

```ts
api.app.createWorkspace
```

The Convex handler:

1. asserts the server token
2. creates a new workspace ID
3. creates a unique workspace slug
4. inserts the workspace record
5. sets `createdBy` to the current user ID
6. sets `workosOrganizationId` to `null` initially
7. creates or updates the creator's workspace membership as `admin`
8. sets the workspace as the user's current workspace
9. returns the workspace ID and slug

The essential Convex write pattern is:

```text
insert workspace {
  id,
  slug,
  name,
  logoUrl,
  createdBy: currentUserId,
  workosOrganizationId: null,
  settings
}

ensureWorkspaceMembership({
  workspaceId,
  userId: currentUserId,
  role: "admin"
})

setCurrentWorkspaceForUser(currentUserId, workspaceId)
```

So the workspace creator becomes:

- the workspace owner, through `workspaces.createdBy`
- a workspace admin, through `workspaceMemberships.role = "admin"`
- the active user for that workspace, through user app state

## Owner vs Admin

This app has both owner and admin concepts.

The creator is both:

```text
workspace owner
workspace admin
```

Owner status comes from:

```text
workspace.createdBy === currentUserId
```

Admin status comes from workspace or team membership roles.

Some operations require owner access, not just admin access. Examples include:

- updating workspace details
- uploading or changing workspace logo
- deleting the workspace
- removing workspace users

Other operations allow workspace or team admin access depending on the feature.

For account-created workspaces, this distinction is simple at first because the creator receives both owner and admin capability.

## WorkOS Organization Reconciliation

Convex creates the workspace first with:

```text
workosOrganizationId: null
```

After the workspace exists, `/api/workspaces` calls:

```ts
reconcileAuthenticatedAppContext(session.user, session.organizationId)
```

That reconciliation step:

1. reloads the authenticated app context
2. finds the current workspace
3. ensures a matching WorkOS organization exists
4. stores the WorkOS organization ID on the Convex workspace if needed
5. ensures the WorkOS user has organization membership
6. ensures workspace scaffolding exists

The workspace creation route treats this as best-effort. If reconciliation fails, the route logs the provider error but still returns the created workspace.

That means the source of truth for workspace creation is Convex. WorkOS organization state is synchronized after creation and can also be repaired by later reconciliation or maintenance scripts.

## Workspace Scaffolding

After WorkOS organization reconciliation, the app ensures workspace scaffolding:

```ts
ensureWorkspaceScaffoldingServer({
  currentUserId,
  workspaceId,
})
```

The Convex scaffolding handler:

- requires readable workspace access
- ensures workspace project views
- ensures team work views for each workspace team
- ensures team project views for each workspace team

For a brand-new workspace with no teams, this mainly ensures workspace-level defaults.

## Logo Upload and Branding After Creation

The onboarding form supports an optional logo upload.

The sequence is intentionally two-step:

```text
create workspace
  -> optionally upload logo
  -> update current workspace branding
```

The logo upload uses:

```text
/api/settings-images/upload-url
```

For `workspace-logo`, that route requires:

- authenticated session
- app context
- current workspace
- workspace owner access

Then the client calls the normal current-workspace branding update route:

```text
PATCH /api/workspace/current
```

That route also requires workspace owner access, updates Convex branding, and ensures the WorkOS organization name stays aligned.

If the logo upload fails after workspace creation, the workspace remains created. The UI shows a recoverable error and tells the user they can retry from workspace settings.

## Selected and Current Workspace State

Workspace creation sets the new workspace as the current workspace for the user in Convex.

Separately, the app also has a selected workspace cookie used when a user can access multiple workspaces:

```text
linear_selected_workspace_id
```

The first-workspace creation path does not depend on that cookie. It writes current workspace state directly through Convex.

Later app-context reads may apply the selected workspace override if the user has access to the selected workspace.

## Protected Route Dependencies

Workspace creation depends on the same protected route stack as other product APIs:

```text
requireSession()
  -> requires AuthKit user

requireAppContext(session)
  -> requires local Convex user/app context
```

This means the workspace creation route inherits the auth pattern's invariant:

```text
Provider auth is not enough.
The local app user must also be ready.
```

## Environment Dependencies

Workspace creation depends on both Convex and WorkOS runtime values.

Convex creation requires:

```text
CONVEX_URL or NEXT_PUBLIC_CONVEX_URL
CONVEX_SERVER_TOKEN
```

WorkOS organization reconciliation requires:

```text
WORKOS_CLIENT_ID
WORKOS_API_KEY
```

Auth/session resolution still depends on the AuthKit environment:

```text
WORKOS_COOKIE_PASSWORD
WORKOS_COOKIE_DOMAIN
NEXT_PUBLIC_WORKOS_REDIRECT_URI
```

## Maintenance and Repair Paths

The app includes scripts that depend on the same workspace-to-organization model:

```text
bootstrap:workspace
sync:workos:workspaces
```

These scripts can create or repair the relationship between Convex workspaces and WorkOS organizations.

This matters because `/api/workspaces` can create a Convex workspace even if the immediate WorkOS reconciliation step fails.

## Full Flow Summary

### New Account Creates First Workspace

```text
/signup
  -> WorkOS account/session
  -> reconcile local app user
  -> /workspace/projects
  -> workspace layout sees no current workspace
  -> /onboarding
  -> user submits workspace form
  -> /api/workspaces
  -> require AuthKit session
  -> require Convex app context
  -> reject if current/pending workspace exists
  -> Convex createWorkspace
  -> creator becomes owner/admin
  -> current workspace is set
  -> best-effort WorkOS organization reconciliation
  -> /workspace/projects
```

### Optional Logo During Onboarding

```text
workspace created
  -> prepare workspace-logo upload URL
  -> upload logo to storage
  -> PATCH /api/workspace/current
  -> require workspace owner
  -> update Convex branding
  -> sync WorkOS organization name
```

### Existing Workspace User Hits Onboarding

```text
/onboarding
  -> withAuth
  -> getWorkspaceEntryJoinState
  -> currentWorkspace exists
  -> no invite or join code
  -> redirect /workspace/projects
```

## The Core Mental Model

The cleanest way to understand workspace creation is:

```text
Auth creates the account.
Convex creates the workspace.
The workspace creator becomes owner/admin.
WorkOS organization state is reconciled after Convex succeeds.
```

The app never creates a workspace from an unauthenticated request.

The app also never treats provider identity alone as sufficient to create product state. The user must be resolved into the local Convex app model first.

The critical invariant is:

```text
Create workspace only after AuthKit session and Convex user context exist.
After creation, make the creator owner/admin and set the workspace current.
```
