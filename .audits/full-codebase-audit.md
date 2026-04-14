# Full Codebase Audit

## Header

- Turn: 1
- Date: 2026-04-14 00:42:20 BST
- Commit: `74fceec` (`74fceec17c0265f5bd6b2148652691ffa080d588`)
- Remote: `https://github.com/declancowen/Linear.git`
- OS: `Darwin 25.4.0`
- Stack: Next.js 16, React 19, Convex, WorkOS, Zustand, Electron, 100ms, Resend

## Verification

- Static audit completed across app routes, Convex functions, client/store wiring, integrations, scripts, and Electron wrapper.
- Runtime verification could not run in this environment because `node`, `npm`, and `pnpm` are not installed, so `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm convex:codegen`, and `pnpm exec electron --version` were unavailable.

## Turn 1 Summary

The findings below describe the original Turn 1 issues. The current working tree now contains a remediation pass for the full Turn 1 set, but runtime verification is still blocked in this environment because Node/pnpm are unavailable.

## Remediation Status

- `Resolved in working tree, pending runtime verification`: `S1-01` and `S1-04`. Sensitive Convex queries and mutations now require `CONVEX_SERVER_TOKEN`, the browser snapshot path moved to authenticated Next.js API routes, server lookups use WorkOS user id as the primary identity key, and the operational scripts now call the privileged path.
- `Resolved in working tree, pending runtime verification`: `S1-02` and `B1-02`. Mention resolution is now audience-scoped for comments, channel posts, channel post comments, and chats, follower notifications are filtered to the readable audience, and team/workspace conversation participant lists are resynced when memberships change.
- `Resolved in working tree, pending runtime verification`: `B1-01`. Workspace chat/channel creation, message sending, and call-start flows now enforce editable workspace roles in Convex, the Next routes, and optimistic client state.
- `Resolved in working tree, pending runtime verification`: `P1-01`. Workspace project selectors and page copy are now aligned with the broader workspace-shared visibility model already present in the snapshot and detail route.
- `Resolved in working tree, pending runtime verification`: `S1-03`. Electron now runs with `sandbox: true`, packaged startup uses an ephemeral loopback port, and external navigation is restricted to an allowlisted set of protocols.
- `Resolved in working tree, pending runtime verification`: `B1-03`. Persistent conversation-room joins now store and reuse a stable 100ms room id instead of creating a new room on every join.
- `Resolved in working tree, pending runtime verification`: `A1-01`. Authenticated app context loading is split from reconciliation, and the expensive WorkOS/Convex repair path now runs only on explicit lifecycle and mutation flows.
- `Resolved in working tree, pending runtime verification`: `B1-04`. Digest emails are now marked as emailed immediately after each successful send instead of after the whole batch.

## Findings

### S1-01 Critical: The Convex deployment is acting like a trusted backend even though its public functions trust caller-supplied identity

- Evidence: `components/providers/convex-app-provider.tsx:23-26`, `lib/convex/client.ts:24-31`, `lib/convex/client.ts:59-67`, `lib/server/convex.ts:17-33`, `lib/server/convex.ts:40-220`, `convex/app.ts:1960-2197`, `convex/app.ts:2200-2294`, `convex/app.ts:2296-2345`
- Detail: the browser mounts a public `ConvexReactClient` against `NEXT_PUBLIC_CONVEX_URL` and calls `api.app.getSnapshot` directly with an `email`; the server wrapper also calls public Convex queries and mutations through the same public URL; inside Convex, `getSnapshot` and `getAuthContext` derive visibility from a caller-provided email, while most mutations authorize solely from a caller-provided `currentUserId`.
- Impact: anyone who can reach the Convex deployment can bypass the Next.js WorkOS gate and query or mutate data as another user by supplying a different `email` or `currentUserId`. This undermines the repo’s primary auth model and turns all downstream authorization checks into client-controlled claims.
- Recommendation: move identity enforcement into Convex itself using authenticated Convex contexts or server-only/internal functions, stop exposing user selection by raw email, and remove public direct-browser access to sensitive Convex functions unless they can validate the caller cryptographically.

### S1-02 High: Mentions in comments and channel flows can notify or email users who cannot see the underlying entity

- Evidence: `convex/app.ts:1176-1187`, `convex/app.ts:3957-4017`, `convex/app.ts:5181-5245`, `convex/app.ts:5297-5360`, `lib/server/email.ts:117-151`
- Detail: `createMentionIds` resolves handles against all users in the database. Work item comments, document comments, channel posts, and channel post comments all use that global match set and then immediately create notifications and mention emails. Only chat messages filter mentions back down to conversation participants.
- Impact: a user can mention any matching handle in content and cause out-of-scope users to receive notifications or email containing entity titles and comment text for teams/channels/documents they should not know about.
- Recommendation: restrict mention resolution to the readable audience for the target entity before persisting `mentionUserIds` or emitting notifications/emails.

### B1-01 Medium: Workspace-scoped chat and channel writes ignore read-only roles

- Evidence: `convex/app.ts:1148-1165`, `convex/app.ts:4691-4748`, `convex/app.ts:4858-4895`, `convex/app.ts:4899-4960`, `convex/app.ts:5006-5057`, `app/api/chats/[chatId]/calls/route.ts:77-105`
- Detail: `requireConversationAccess(..., "write")` enforces editable roles for team conversations but not workspace conversations. `createWorkspaceChat` and the workspace branch of `createChannel` only require some workspace role, not an editable one. The API route for starting calls explicitly blocks read-only team members but has no equivalent workspace-role check.
- Impact: users who are only `viewer` or `guest` within a workspace can still create workspace chats, create the primary workspace channel, send workspace chat messages, and start workspace calls.
- Recommendation: define workspace write semantics explicitly and reuse `requireEditableWorkspaceAccess` for workspace-scoped conversation creation and write operations.

### P1-01 Medium: Workspace project visibility is broader in the snapshot than the product model and selectors imply

- Evidence: `convex/app.ts:2018-2024`, `lib/domain/selectors.ts:230-258`, `components/app/screens.tsx:1633-1655`, `app/(workspace)/workspace/projects/page.tsx:17-20`
- Detail: `getSnapshot` includes every workspace-scoped project in any accessible workspace, but the workspace selector only intends to show workspace projects where the current user is a lead or member. The project detail screen then renders directly from `data.projects.find(...)`, so any project already present in the snapshot is effectively accessible by id.
- Impact: workspace members can receive and deep-link into workspace projects they are not participating in, even though the page copy says workspace projects are limited to the ones they participate in.
- Recommendation: align the server snapshot with the intended product model by filtering workspace projects at source, then keep detail routes constrained to the same visibility rule.

### S1-03 Medium: The Electron shell is running with weak desktop hardening

- Evidence: `electron/main.mjs:63-75`, `electron/main.mjs:89-99`
- Detail: the desktop window disables Chromium sandboxing with `sandbox: false`, opens every `window.open` target through `shell.openExternal(url)` without any scheme or origin allowlist, and hardcodes the packaged renderer server to `127.0.0.1:3000`.
- Impact: any renderer compromise or unsafe content path has a larger blast radius on desktop than it should, and packaged startup is more brittle when port `3000` is already occupied.
- Recommendation: enable Electron sandboxing unless there is a proven blocker, restrict external navigation to explicit safe protocols/origins, and pick an ephemeral port or reserve/check the port before launching the packaged Next server.

## Residual Risks

- I could not run the repo’s declared verification commands because the local environment is missing Node/pnpm entirely, so this pass is based on static code analysis rather than live execution.

### S1-04 High: Several operational Convex functions are public and effectively unauthenticated control-plane endpoints

- Evidence: `convex/app.ts:2563-2615`, `convex/app.ts:2775-2795`, `scripts/send-notification-digests.mjs:45-83`, `scripts/sync-workspace-organizations.mjs:72-79`, `scripts/bootstrap-app-workspace.mjs:190-193`
- Detail: `listWorkspacesForSync` returns every workspace and WorkOS organization id, `listPendingNotificationDigests` returns unread notification payloads plus recipient emails for all digest-enabled users, and `setWorkspaceWorkosOrganization` rewrites a workspace’s WorkOS organization id without any caller identity or authorization check.
- Impact: even beyond the general Turn 1 Convex trust-boundary issue, these specific functions expose global workspace/user metadata and allow direct tenant/control-plane mutation with no app-level authorization primitive at all.
- Recommendation: move these functions behind internal/server-only boundaries, require privileged auth, and keep operational scripts off the public Convex API surface.

### B1-02 Medium: Team chat participant lists freeze at creation time and drift from real team membership

- Evidence: `convex/app.ts:1015-1049`, `convex/app.ts:4142-4196`, `convex/app.ts:4260-4325`, `convex/app.ts:5006-5030`, `lib/store/app-store.ts:2413-2442`
- Detail: team-chat conversations snapshot `participantIds` only when the conversation is first created. Later invite acceptance and join-code flows add memberships but never patch the existing conversation, while team-chat mention delivery still filters against the stale `conversation.participantIds` list.
- Impact: newly joined members will be absent from team-chat mention resolution, while users removed from the team can remain mentionable and still receive team-chat mention notifications or emails after they should have lost access.
- Recommendation: derive team-chat audience from live team membership for writes, or resync `participantIds` whenever team membership changes.

### B1-03 Medium: The “persistent room” 100ms join path creates a new room instead of reusing one

- Evidence: `lib/server/100ms.ts:185-196`, `lib/server/100ms.ts:224-235`, `app/api/calls/join/route.ts:137-170`
- Detail: `ensureRoom` always does a `POST /rooms`, and the `conversationId` branch of `/api/calls/join` calls `createConversationJoinUrl` without a stored `roomId`. That means the workspace/team “persistent room” entry path creates a fresh 100ms room on every join rather than reopening a stable room.
- Impact: the implemented behavior does not match the documented persistent-room product model, and it can leave behind orphaned rooms or fail if 100ms room names must be unique.
- Recommendation: persist and reuse a stable room id for persistent chat rooms, or look up an existing room by stable key before creating a new one.

### A1-01 Medium: Authenticated request handling performs mutative reconciliation work on the hot path

- Evidence: `lib/server/authenticated-app.ts:15-45`, `lib/server/workos.ts:58-99`, `app/(workspace)/layout.tsx:18-21`, `app/page.tsx:13-16`, `app/onboarding/page.tsx:63-69`
- Detail: `ensureAuthenticatedAppContext` does more than load auth context: it mutates Convex user records, queries Convex auth state, updates or creates the WorkOS organization, ensures WorkOS organization membership, and runs workspace scaffolding. That helper is used in the workspace layout, app entry pages, onboarding, and many API routes.
- Impact: normal authenticated requests take on multiple extra network round-trips and external management-API dependencies, increasing latency and making ordinary app usage sensitive to WorkOS management outages or rate limits.
- Recommendation: split pure read-time auth context from reconciliation, cache where possible, and move organization/scaffolding repair work off the critical request path.

### B1-04 Low: Notification digest sending is not idempotent across partial failures

- Evidence: `scripts/send-notification-digests.mjs:45-83`, `lib/server/email.ts:189-231`
- Detail: digest emails are sent first and notification ids are only marked as emailed after the batch succeeds. If the run fails after some emails are delivered but before the mark phase completes, the next run will resend those already-delivered digests.
- Impact: users can receive duplicate digest emails after mid-run failures.
- Recommendation: mark each digest batch as emailed immediately after a successful send, or switch to an outbox/job model with per-recipient delivery state.
