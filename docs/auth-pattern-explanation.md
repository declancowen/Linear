# Auth Pattern Explanation

This app uses WorkOS AuthKit as the identity and authentication provider, and Convex as the app-side user/workspace data layer.

The main pattern is:

1. A public auth page renders a form.
2. The form posts to an `/auth/...` server route.
3. The server route talks to WorkOS.
4. If WorkOS authenticates the user, the app saves the AuthKit session.
5. Immediately after saving the session, the app reconciles the local Convex user/workspace context.
6. The user is redirected to a normalized `next` path.

In short:

```text
Auth page
  -> /auth/* server route
  -> WorkOS provider call
  -> save AuthKit session
  -> reconcile local app context
  -> redirect to normalized next path
```

## Architectural Ownership

WorkOS owns:

- user identity
- passwords
- email verification codes
- OAuth authentication
- password reset tokens
- provider sessions

The app owns:

- auth pages
- form handling routes
- AuthKit proxy/header wiring
- redirect safety
- local app user creation/sync
- workspace and organization reconciliation
- Convex user readiness
- route-level authorization helpers
- app/provider lifecycle cleanup

This means the app does not store or validate passwords itself. It delegates that to WorkOS. The app only decides how to move users through the product after WorkOS confirms identity.

## Sign In

Sign in starts at `/login`.

The page renders `AuthEntryScreen` in `login` mode. The form posts to:

```text
/auth/login
```

The posted fields are:

- `email`
- `password`
- `next`

The login route reads the form, checks that email and password are present, then calls WorkOS:

```ts
workos.userManagement.authenticateWithPassword(...)
```

If WorkOS accepts the credentials, the route saves the session:

```ts
saveSession(authenticationResponse, request.url)
```

Then it reconciles the local app context:

```ts
reconcileAuthenticatedAppContext(
  authenticationResponse.user,
  authenticationResponse.organizationId
)
```

That reconciliation step is important. It means a successful WorkOS login is not the whole app login story. The app also ensures the user exists in Convex and that workspace/org state is aligned.

After that, the user is redirected to the normalized `next` path.

If `next` is missing or unsafe, the app falls back to:

```text
/workspace/projects
```

## Organization Selection During Login

There is a special WorkOS branch for:

```text
organization_selection_required
```

If WorkOS says an organization must be selected, the app tries to infer the correct organization from:

- the user's WorkOS account
- active WorkOS organization memberships
- the app's Convex workspace list
- matching workspace names/slugs/domains

If exactly one organization can be resolved, the app completes auth with:

```ts
authenticateWithOrganizationSelection(...)
```

Then it follows the normal success path:

```text
save session -> reconcile app context -> redirect
```

## Registration

Signup starts at `/signup`.

The page renders `AuthEntryScreen` in `signup` mode. The form posts to:

```text
/auth/signup
```

The posted fields are:

- `firstName`
- `lastName`
- `email`
- `password`
- `next`

The signup route first creates the user in WorkOS:

```ts
workos.userManagement.createUser({
  email,
  password,
  firstName,
  lastName,
})
```

If WorkOS says the account already exists, the app redirects the user to `/login` with a notice instead of trying to create a duplicate account.

After creating the WorkOS user, the app immediately tries to authenticate that same user:

```ts
workos.userManagement.authenticateWithPassword(...)
```

That means registration is treated as:

```text
create provider user
  -> authenticate provider user
  -> save session
  -> reconcile local app context
  -> redirect
```

Registration is not considered complete from the app's point of view until the user has a real WorkOS session and a reconciled app context.

## Registration With OTP / Email Verification

The app does not generate OTP codes itself. WorkOS sends and verifies the email verification code.

During signup, after the app creates the WorkOS user and tries to authenticate, WorkOS may respond with:

```text
email_verification_required
```

When that happens, the app does not save a session yet.

Instead, it extracts the WorkOS pending authentication token and stores it in a short-lived HTTP-only cookie named:

```text
pending_email_verification
```

The cookie contains:

- email
- auth mode: `signup`
- next path
- WorkOS `pendingAuthenticationToken`

Then the user is redirected to:

```text
/verify-email
```

The user enters the WorkOS verification code there.

The verification form posts to:

```text
/auth/verify-email
```

The route reads:

- the submitted code
- the pending authentication token from the HTTP-only cookie

Then it calls WorkOS:

```ts
authenticateWithEmailVerification({
  code,
  pendingAuthenticationToken,
})
```

If WorkOS accepts the code, the app:

1. saves the AuthKit session
2. reconciles local app context
3. clears the pending verification cookie
4. redirects to the normalized `next` path

So the OTP signup path is:

```text
/signup
  -> /auth/signup
  -> WorkOS createUser
  -> WorkOS authenticateWithPassword
  -> WorkOS says email_verification_required
  -> app stores pending token in HTTP-only cookie
  -> /verify-email
  -> /auth/verify-email
  -> WorkOS authenticateWithEmailVerification
  -> save session
  -> reconcile app context
  -> clear pending cookie
  -> redirect
```

## Login With OTP / Email Verification

Login can hit the same verification flow.

If a user signs in with email/password and WorkOS responds with:

```text
email_verification_required
```

the app stores the pending WorkOS auth token in the same cookie:

```text
pending_email_verification
```

The cookie contains:

- email
- auth mode: `login`
- next path
- WorkOS `pendingAuthenticationToken`

Then the user goes to `/verify-email`.

Once the user submits the code, `/auth/verify-email` exchanges the code and pending token with WorkOS.

If successful:

```text
save session
  -> reconcile app context
  -> clear pending cookie
  -> redirect
```

The important point is that signup verification and login verification use the same verification endpoint. The `mode` field only controls where the user is sent if the verification session expires or fails.

## Verification Cookie Pattern

The pending verification cookie is deliberately short-lived and server-owned.

It is:

- HTTP-only
- same-site lax
- secure in production
- valid for 15 minutes
- scoped to `/`

The browser cannot read it from client-side JavaScript because it is HTTP-only.

The cookie exists only to bridge this temporary WorkOS state:

```text
WorkOS has not authenticated the user yet,
but WorkOS has issued a pending authentication token
that can be completed with an email verification code.
```

If the cookie is missing or expired, the app sends the user back to login/signup with:

```text
Your verification session expired. Sign in again.
```

If verification fails but WorkOS returns a new pending token, the app refreshes the cookie so the user can retry without restarting the whole auth flow.

## OAuth Callback

Google sign-in starts from the `Continue with Google` button.

The button points to:

```text
/auth/google
```

That route builds a WorkOS authorization URL with:

- provider: `GoogleOAuth`
- redirect URI from `NEXT_PUBLIC_WORKOS_REDIRECT_URI`
- state containing `mode` and `nextPath`

The state is JSON. It tells the callback whether the user started from login or signup, and where they should go after authentication.

WorkOS redirects back to:

```text
/auth/callback
```

There is also a top-level `/callback` route that re-exports the same handler.

The callback route reads:

- `code`
- `state`
- possible `error`
- possible `error_description`

If there is a valid code, it calls WorkOS:

```ts
authenticateWithCode(...)
```

If that succeeds, the callback follows the exact same post-auth pattern:

```text
save session
  -> reconcile app context
  -> redirect to normalized next path
```

So password login, email verification, and OAuth callback all converge on the same success pattern.

## Forgot Password

Forgot password starts from the login screen's `Forgot password?` link.

The page is:

```text
/forgot-password
```

The form posts to:

```text
/auth/forgot-password
```

The posted fields are:

- `email`
- `next`

The route validates that an email was entered. Then it asks WorkOS to create a password reset:

```ts
workos.userManagement.createPasswordReset({
  email,
})
```

The route always redirects back with a generic notice:

```text
If an account exists for that email, a password reset link has been sent.
```

That is intentional.

The app does not reveal whether the email exists, because revealing that would allow account enumeration.

If WorkOS errors, the app logs the provider error but still shows the same generic notice.

The forgot-password pattern is:

```text
/forgot-password
  -> /auth/forgot-password
  -> WorkOS createPasswordReset
  -> always show generic notice
```

## Reset Password

The WorkOS reset email sends the user to:

```text
/reset-password?token=...
```

The reset page renders a form with:

- hidden `token`
- hidden `next`
- `password`
- `confirmPassword`

The form posts to:

```text
/auth/reset-password
```

The route validates:

1. the token exists
2. the new password exists
3. the password and confirmation match

Then it calls WorkOS:

```ts
workos.userManagement.resetPassword({
  token,
  newPassword,
})
```

If reset succeeds, the user is redirected to `/login` with:

```text
Password updated. Sign in with your new password.
```

The user is not automatically signed in after password reset.

That is the reset-password pattern:

```text
WorkOS reset email
  -> /reset-password?token=...
  -> /auth/reset-password
  -> WorkOS resetPassword
  -> redirect to login
  -> user signs in again
```

If reset fails, the app maps WorkOS errors into user-facing messages. Examples include:

- invalid token
- invalid password
- generic reset failure

## Session Resolution

The app has a session resolution route:

```text
/auth/session
```

This route calls:

```ts
refreshSession()
```

If there is no user, it redirects to login/signup.

If there is a user, it redirects to the normalized post-auth destination.

If refreshing the session fails, it logs the user out and sends them back to auth with:

```text
Your session expired. Sign in again.
```

This route is used when a user lands on an auth page while already authenticated, or when the app needs to resolve whether an existing session is still valid.

## Protected Route Pattern

After auth, protected server routes do not directly inspect cookies themselves.

They use helpers in `lib/server/route-auth.ts`.

The helper layers are:

```text
requireSession()
  -> requires WorkOS/AuthKit session

requireAppContext()
  -> requires app-side user/workspace context

requireConvexUser()
  -> requires Convex user readiness

requireConvexRouteContext()
  -> returns session + authenticated user + Convex auth context
```

That means the app generally does not trust provider auth alone. For app data routes, it also checks that the user exists in the local app model.

## Post-Auth Reconciliation

The most important app-owned step is:

```ts
reconcileAuthenticatedAppContext(...)
```

This happens immediately after successful WorkOS authentication.

It does the local app work:

- converts the WorkOS user into the app's authenticated user shape
- ensures the Convex user exists
- loads current auth context
- applies selected workspace override if appropriate
- ensures the WorkOS organization exists for the current workspace
- stores the WorkOS organization ID on the workspace if needed
- ensures the WorkOS user has organization membership
- ensures workspace scaffolding exists

This is the bridge between:

```text
external identity provider
```

and:

```text
local product data model
```

Without this step, a user might be authenticated with WorkOS but not ready to use the app's workspace data.

## Wider Repo Impact

This pattern is not isolated to the `/auth/*` routes. It is a repo-level contract between AuthKit, Convex, protected server routes, workspace rendering, lifecycle operations, and tests.

The main dependency rule is:

```text
WorkOS/AuthKit session
  -> app-authenticated user shape
  -> Convex user/workspace context
  -> route/page authorization and app data access
```

Changing the auth flow means checking every layer that assumes that chain exists.

## Global AuthKit Wiring

AuthKit is wired through `proxy.ts`, not only inside individual auth routes.

The proxy calls:

```ts
authkit(request, {
  redirectUri,
})
```

Then it partitions and reapplies AuthKit request/response headers.

The proxy matcher covers:

- public auth pages such as `/login`, `/signup`, `/verify-email`, `/forgot-password`, and `/reset-password`
- auth server routes such as `/auth/login`, `/auth/signup`, `/auth/callback`, `/auth/session`, and `/auth/verify-email`
- workspace and product routes
- most app API routes

Logout is intentionally left outside the AuthKit proxy so middleware cannot refresh the session while logging out.

This means a port to another repo needs both:

1. the explicit `/auth/*` route handlers
2. the proxy/middleware layer that lets AuthKit resolve and refresh sessions

## Page and Layout Dependencies

The auth pages are public entry points, but they still use AuthKit state to redirect already-authenticated users.

Important examples:

- `/login` renders `AuthEntryScreen` in `login` mode.
- `/signup` renders `AuthEntryScreen` in `signup` mode.
- `/verify-email` renders `AuthEmailVerificationScreen` only when the pending verification cookie is present.
- `/forgot-password` and `/reset-password` are public WorkOS-backed account recovery pages.
- `/auth/session` refreshes the AuthKit session and resolves the final destination.

The workspace layout depends on this pattern too. Before rendering the product shell, it:

```text
withAuth()
  -> ensureAuthenticatedAppContext(...)
  -> require current workspace
  -> load workspace membership bootstrap
  -> render authenticated workspace client
```

So provider auth alone is not enough to enter the workspace UI. The page must also have a usable Convex app context.

## Protected API Dependencies

Protected API routes generally do not call `withAuth()` directly.

They use `lib/server/route-auth.ts` or shared route handler wrappers built on top of it.

The dependency chain is:

```text
requireSession()
  -> withAuth()
  -> requires AuthKit user

requireAppContext(session)
  -> ensureAuthenticatedAppContext(...)
  -> requires local app user/workspace context

requireConvexUser(session)
  -> ensureConvexUserReadyServer(...)
  -> requires Convex current user readiness

requireConvexRouteContext()
  -> returns session + authenticated user + Convex auth context
```

Shared helpers such as `handleAppContextJsonRoute`, `handleAuthenticatedJsonRoute`, `handleConvexUserJsonRoute`, and the scoped read-model route handlers call these helpers for API routes.

That means changes to `requireSession`, `requireAppContext`, or the shape returned by `toAuthenticatedAppUser` affect many routes at once.

## API Route Exceptions

Most app API routes are protected by the route-auth helper stack or wrappers around it.

The intentional exceptions are:

- `/api/internal/email-jobs`
  - protected by a `CRON_SECRET` bearer token instead of a user session
- `/api/teams/lookup`
  - unauthenticated join-code lookup used before a user has joined a team

Those exceptions are not part of the user auth session model.

## Convex Data Dependencies

Convex is the app-side source of truth for product user/workspace state.

The auth bridge depends on these Convex concepts:

- users indexed by `workosUserId`
- users also findable by normalized email
- workspaces storing `workosOrganizationId`
- workspace memberships and team memberships determining app authorization
- user app state and selected workspace context
- workspace bootstrap/scaffolding after auth

Server-side Convex calls require:

```text
CONVEX_URL or NEXT_PUBLIC_CONVEX_URL
CONVEX_SERVER_TOKEN
```

The key app-side auth mutation/query pattern is:

```text
ensureConvexUserFromAuth(authenticatedUser)
getAuthContextServer({ workosUserId, email })
getWorkspaceMembershipBootstrapServer(...)
setWorkspaceWorkosOrganizationServer(...)
ensureWorkspaceScaffoldingServer(...)
```

If another repo adopts this pattern, it needs an equivalent local data layer that can answer:

- who is this WorkOS user in my app?
- which workspace/org should they currently land in?
- do they have required local membership?
- is the local product scaffolding ready?

## WorkOS Organization Dependencies

The app maps product workspaces to WorkOS organizations.

During reconciliation it:

1. ensures a WorkOS organization exists for the current workspace
2. stores the WorkOS organization ID on the Convex workspace if needed
3. ensures the authenticated WorkOS user has organization membership
4. ensures workspace scaffolding exists locally

There are maintenance scripts that depend on the same mapping:

- `bootstrap:workspace`
- `sync:workos:workspaces`

So `workosOrganizationId` is not just display metadata. It is part of the app/provider consistency contract.

## Account and Lifecycle Dependencies

Other account routes also assume WorkOS owns identity.

Examples:

- account email changes call WorkOS `updateUser` and send a WorkOS verification email
- account password reset requests call WorkOS password reset APIs
- profile name changes sync back to the WorkOS user profile
- account deletion deletes or cleans up the WorkOS user
- workspace/team/account removal deactivates relevant WorkOS organization memberships

Lifecycle cleanup is best-effort and audit-logged if provider cleanup fails.

This means auth design changes can affect account settings, workspace deletion, team leave/removal, profile editing, and operational audit behavior.

## Environment Dependencies

The auth pattern depends on these runtime values:

```text
WORKOS_CLIENT_ID
WORKOS_API_KEY
WORKOS_COOKIE_PASSWORD
WORKOS_COOKIE_DOMAIN
NEXT_PUBLIC_WORKOS_REDIRECT_URI

CONVEX_URL or NEXT_PUBLIC_CONVEX_URL
CONVEX_SERVER_TOKEN

APP_URL or NEXT_PUBLIC_APP_URL or TEAMS_URL
```

Google OAuth specifically requires a public HTTPS callback in normal deployed use. The route rejects local `localhost` redirect URIs for Google sign-in and tells the user to use a deployed URL or a sandbox WorkOS client for local testing.

## Tests That Lock This Pattern

The current tests assert this contract at several levels:

- auth route contracts: callback, login organization selection, email verification, forgot password, reset password
- authenticated app context: Convex user ensure, selected workspace override, WorkOS organization reconciliation, workspace scaffolding
- route auth helpers: session required, app context required, Convex user required
- workspace layout and root pages: authenticated redirects and app context readiness
- API route contracts: protected routes expect `requireSession` and `requireAppContext`

When changing this pattern, update tests alongside the route/helper changes rather than only updating pages.

## Porting Checklist

To reuse this pattern in another repo, copy the model, not just the route names.

The receiving repo needs equivalents for:

- public auth pages
- `/auth/login`
- `/auth/signup`
- `/auth/verify-email`
- `/auth/google`
- `/auth/callback`
- `/auth/forgot-password`
- `/auth/reset-password`
- `/auth/session`
- `/auth/logout`
- AuthKit proxy/middleware wiring
- redirect normalization
- pending email verification cookie handling
- AuthKit `saveSession` and `refreshSession`
- a local app-context reconciliation function
- protected route helpers
- local user/workspace storage keyed by WorkOS user and organization IDs
- provider lifecycle cleanup for account/workspace/team removal

The critical invariant to preserve is:

```text
Do not redirect into the product after provider auth
until the local app context has been reconciled.
```

## Full Flow Summary

### Password Sign In

```text
/login
  -> /auth/login
  -> WorkOS authenticateWithPassword
  -> save session
  -> reconcile app context
  -> redirect next
```

### Password Sign In With Verification

```text
/login
  -> /auth/login
  -> WorkOS authenticateWithPassword
  -> WorkOS says email_verification_required
  -> store pending token cookie
  -> /verify-email
  -> /auth/verify-email
  -> WorkOS authenticateWithEmailVerification
  -> save session
  -> reconcile app context
  -> clear pending cookie
  -> redirect next
```

### Signup

```text
/signup
  -> /auth/signup
  -> WorkOS createUser
  -> WorkOS authenticateWithPassword
  -> save session
  -> reconcile app context
  -> redirect next
```

### Signup With Verification

```text
/signup
  -> /auth/signup
  -> WorkOS createUser
  -> WorkOS authenticateWithPassword
  -> WorkOS says email_verification_required
  -> store pending token cookie
  -> /verify-email
  -> /auth/verify-email
  -> WorkOS authenticateWithEmailVerification
  -> save session
  -> reconcile app context
  -> clear pending cookie
  -> redirect next
```

### Google OAuth

```text
/auth/google
  -> WorkOS GoogleOAuth authorization URL
  -> WorkOS provider login
  -> /auth/callback
  -> WorkOS authenticateWithCode
  -> save session
  -> reconcile app context
  -> redirect next
```

### Forgot Password

```text
/forgot-password
  -> /auth/forgot-password
  -> WorkOS createPasswordReset
  -> generic reset email notice
```

### Reset Password

```text
/reset-password?token=...
  -> /auth/reset-password
  -> WorkOS resetPassword
  -> /login with success notice
  -> user signs in again
```

## The Core Mental Model

The cleanest way to understand this auth system is:

```text
WorkOS authenticates identity.
AuthKit stores the session.
Convex stores the app user/workspace model.
The app's auth routes connect those three things.
```

The app never treats a submitted form as proof of identity by itself.

The proof always comes from WorkOS.

Once WorkOS proves identity, the app creates or updates the local context needed to actually use the product.
