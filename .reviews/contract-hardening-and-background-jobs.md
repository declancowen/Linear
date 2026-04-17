# Review: Contract Hardening And Background Jobs

## Project context (captured on Turn 1 — not re-detected on subsequent turns)

| Field | Value |
|-------|-------|
| **Repository** | `Linear` |
| **Remote** | `https://github.com/declancowen/Linear.git` |
| **Branch** | `feature/contract-hardening` |
| **Repo type** | `single repo` |
| **Stack** | `Next.js App Router / Convex / WorkOS / TypeScript / Electron` |
| **Packages affected** | `n/a` |
| **OS** | `Darwin 25.4.0` |
| **Package manager** | `pnpm 10.32.0` |
| **Node** | `v25.8.0` |
| **Python** | `n/a` |

## Scope (cumulative — updated each turn as new files are touched)

Files and areas reviewed across all turns:
- `app/api/calls/join/route.ts` — call-join contract and compatibility flow
- `app/api/chats/[chatId]/messages/route.ts` — message route and mention email enqueueing
- `app/api/channel-posts/[postId]/comments/route.ts` — channel-post comment route and mention email enqueueing
- `app/api/channels/[channelId]/posts/route.ts` — channel-post route and mention email enqueueing
- `app/api/comments/route.ts` — comment route and mention email enqueueing
- `app/api/invites/route.ts` — invite creation and invite email enqueueing
- `app/api/items/route.ts` and `app/api/items/[itemId]/route.ts` — assignment email enqueueing
- `app/api/teams/[teamId]/leave/route.ts`, `app/api/teams/[teamId]/members/[userId]/route.ts`, `app/api/workspace/current/leave/route.ts`, `app/api/workspace/current/users/[userId]/route.ts`, `app/api/account/route.ts` — access-change email enqueueing and provider cleanup follow-up
- `convex/app/email_job_handlers.ts` — outbox job storage, claim, completion, and release semantics
- `convex/app/notification_handlers.ts` — digest claim flow
- `convex/app/collaboration_handlers.ts` — narrow call-join context/finalize mutations
- `convex/app.ts`, `convex/schema.ts`, `convex/validators.ts` — exported mutations, schema, and validators for email jobs and digest claims
- `lib/server/convex/notifications.ts` — server wrappers for notification and email-job mutations
- `lib/server/convex/collaboration.ts` — typed collaboration wrappers for call-join flow
- `lib/email/builders.ts` and `lib/server/email.ts` — shared email-job builders and compatibility barrel
- `scripts/send-email-jobs.mjs` and `scripts/send-notification-digests.mjs` — operational workers
- `lib/store/app-store-internal/domain-updates.ts`, `lib/store/app-store-internal/runtime.ts`, `lib/store/app-store-internal/slices/workspace.ts` — local store/domain patching after workspace/team mutations
- `components/app/onboarding-workspace-form.tsx` — onboarding workspace creation navigation path
- `tests/app/api/call-join-route.test.ts`, `tests/convex/email-job-handlers.test.ts`, `tests/convex/notification-digest-claims.test.ts`, `tests/lib/store/domain-updates.test.ts`, `tests/lib/server/convex-collaboration.test.ts` — regression coverage for the new contracts

## Review status (updated every turn)

| Field | Value |
|-------|-------|
| **Review started** | `2026-04-17 12:51:22 BST` |
| **Last reviewed** | `2026-04-17 13:25:10 BST` |
| **Total turns** | `4` |
| **Open findings** | `0` |
| **Resolved findings** | `8` |
| **Accepted findings** | `0` |

---

## Turn 1 — 2026-04-17 12:51:22 BST

| Field | Value |
|-------|-------|
| **Commit** | `0eefdae` |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** Review of PR `#9` (`feature/contract-hardening` vs `main`) found that the new collaboration contract cleanup is directionally sound, but the new email-job system still has two real durability/idempotency gaps and one operational observability issue. The largest problem is that the new “outbox” is not transactionally attached to the domain mutations that generate email intents, and its enqueue wrapper is retried even though the underlying mutation is not idempotent.

| Status | Count |
|--------|-------|
| New findings | 3 |
| Resolved during Turn 1 | 0 |
| Carried from previous turns | 0 |
| Accepted | 0 |

### Findings

#### F1-01 [BUG] High — Retrying `enqueueEmailJobsServer` can duplicate outbound emails because the enqueue mutation is not idempotent
**Where:** [lib/server/convex/notifications.ts](../lib/server/convex/notifications.ts:135), [convex/app/email_job_handlers.ts](../convex/app/email_job_handlers.ts:68)

**What’s wrong:** `enqueueEmailJobsServer()` now wraps `api.app.enqueueEmailJobs` in `runConvexRequestWithRetry()`. The underlying Convex mutation blindly inserts fresh `emailJobs` rows with new generated ids on every call. If Convex commits the first mutation but the HTTP response is lost to a transient transport error, the retry will enqueue the same logical email batch a second time. The worker will then deliver duplicate invite, mention, assignment, or access-change emails.

**Why it matters:** This turns transient Convex transport failures into user-visible duplicate emails. Because the whole point of the new worker model is to make background delivery more reliable, duplicating the side effect on retry is a correctness regression, not just an implementation detail.

**Root cause:** A non-idempotent mutation is being wrapped in a generic transport-retry helper without any dedupe key, compare-and-set token, or unique logical job key.

**What to change:** Make email-job enqueue idempotent before retrying it. Typical fixes are:
- include a stable logical key per job batch / per notification and ignore duplicates in the mutation
- or remove transport retries for this mutation until a dedupe key exists
- or move job creation fully inside the originating Convex mutation so the write is retried at the mutation level rather than by the caller

#### F1-02 [BUG] High — The new “durable” email outbox is still outside the transaction that creates the email intent, so emails can be dropped permanently on partial failure
**Where:** [app/api/chats/[chatId]/messages/route.ts](../app/api/chats/%5BchatId%5D/messages/route.ts:64), [app/api/invites/route.ts](../app/api/invites/route.ts:51), [app/api/items/route.ts](../app/api/items/route.ts:45), [app/api/account/route.ts](../app/api/account/route.ts:114), [app/api/teams/[teamId]/members/[userId]/route.ts](../app/api/teams/%5BteamId%5D/members/%5BuserId%5D/route.ts:104), plus the other route-level `enqueueEmailJobsServer(...)` call sites

**What’s wrong:** The branch introduces an outbox table and worker, but the job rows are still created *after* the primary business mutation returns, in a second best-effort step at the route layer. If the process crashes, the route handler is interrupted, or Convex is unavailable after the business mutation commits but before `enqueueEmailJobsServer()` succeeds, the email intent is lost forever. This is especially bad for invite and access-change emails, which do not have a later replay path from pending notifications.

**Why it matters:** The PR description and architecture docs frame this as a move toward durable background jobs, but the actual durability boundary is still wrong. The branch improves worker-side claiming, but it does not yet make the source write and the email intent atomic.

**Root cause:** Email intent creation is still a route concern instead of part of the domain mutation that generates the notification / invite / access-change side effect.

**What to change:** Persist email jobs inside the originating Convex mutations, in the same transaction that creates the relevant notification / invite / lifecycle change. The route should not be responsible for durability of the side effect.

#### F1-03 [OPERATIONS] Medium — `scripts/send-email-jobs.mjs` exits successfully even when some or all email jobs fail
**Where:** [scripts/send-email-jobs.mjs](../scripts/send-email-jobs.mjs:27)

**What’s wrong:** The worker increments `failedCount` and releases claims on failure, but it never exits nonzero when failures occur. That means a cron runner, CI step, or external scheduler will see a successful process exit even if every email delivery failed.

**Why it matters:** This hides operational failures and makes alerting unreliable. The digest worker already behaves differently by rethrowing and failing the process on delivery failure, so the two repo-owned workers now have inconsistent failure semantics.

**Root cause:** The per-job `catch` block swallows failures and the script falls through to a final `console.log(...)` without setting `process.exitCode`.

**What to change:** Set `process.exitCode = 1` when `failedCount > 0`, or aggregate and throw after the loop. That preserves claim release behavior while making scheduler-visible failure truthful.

### Verification approach

- Reviewed the PR diff against `main`
- Read the changed route, server-wrapper, Convex handler, worker-script, and store patching files in full for surrounding context
- Cross-checked the new job flow against the added tests and the retry helper implementation

## Turn 2 — 2026-04-17 13:02:11 BST

| Field | Value |
|-------|-------|
| **Commit** | `0eefdae` |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** Follow-up review of additional PR-analysis notes found three more real issues: the `joinTeamByCode` store path lost both its immediate refresh and any replacement local patch, the digest worker can strand still-claimed notifications after a per-digest failure, and the digest claim/release mutations still use the snapshot-bumping wrapper even though they only mutate operational claim metadata. The remaining pasted notes in this round are either maintainability/performance observations or dead-code cleanup rather than active correctness bugs.

| Status | Count |
|--------|-------|
| New findings | 3 |
| Resolved during Turn 2 | 0 |
| Carried from Turn 1 | 3 |
| Accepted | 0 |

### New findings

#### F2-01 [BUG] Medium — `joinTeamByCode` no longer refreshes or patches local state, so the UI can claim success without showing the joined team
**Where:** [lib/store/app-store-internal/slices/workspace.ts](../lib/store/app-store-internal/slices/workspace.ts:674)

**What’s wrong:** The old implementation refreshed the snapshot after a successful join-code mutation. The current version only awaits `syncJoinTeamByCode(...)`, shows a success toast, and returns `true`. It does not patch the team/membership into local state and it does not trigger a background refresh.

**Why it matters:** The user can be told “Joined team” while the newly joined team and membership remain absent from the store until an external snapshot event arrives. That is inconsistent with the rest of this refactor, where other mutations either apply local domain updates or explicitly reconcile in the background.

**Root cause:** `joinTeamByCode` was left behind when the branch removed immediate full-snapshot refreshes from the workspace slice.

**What to change:** Either:
- add a targeted local patch using the join response plus a lightweight follow-up fetch for any missing team details, or
- restore `runtime.refreshFromServer()` / a background refresh for this path until a proper narrow patch exists.

#### F2-02 [BUG] Medium — A single digest-send failure can leave later claimed digests locked until TTL expiry
**Where:** [scripts/send-notification-digests.mjs](../scripts/send-notification-digests.mjs:232), [convex/app/notification_handlers.ts](../convex/app/notification_handlers.ts:61)

**What’s wrong:** The worker batch-claims all available digests up front via `claimPendingNotificationDigests`, then iterates them sequentially. If sending one digest fails, the script releases the failed digest’s notifications and immediately throws. Any later digests in the batch were already claimed but are never released, so they remain blocked until `DIGEST_CLAIM_TTL_MS` expires.

**Why it matters:** This introduces a new 15-minute blackout window after a mid-batch failure. Before the claim system, the next run would retry the remaining pending notifications immediately.

**Root cause:** The script uses up-front batch claiming but only releases the currently failing digest, not the unprocessed claimed tail.

**What to change:** Either:
- wrap the whole loop in cleanup that releases all still-claimed unprocessed notification ids on early exit, or
- switch to per-digest claim/release semantics instead of pre-claiming the whole batch.

#### F2-03 [PERF/ARCHITECTURE] Medium — Digest claim/release mutations still bump `snapshotVersion` even though they only mutate operational claim metadata
**Where:** [convex/app.ts](../convex/app.ts:357), [convex/app.ts](../convex/app.ts:382)

**What’s wrong:** `claimPendingNotificationDigests` and `releaseNotificationDigestClaim` are registered with the snapshot-bumping `mutation(...)` wrapper rather than `operationalMutation(...)`. Those handlers only patch `digestClaimId` / `digestClaimedAt`, which are operational worker-claim fields rather than user-visible client state.

**Why it matters:** Every digest worker claim/release cycle can trigger unnecessary snapshot-version bumps and client invalidation despite not changing the visible notification graph.

**Root cause:** The digest-claim flow was added on the main notification table, but the mutation registration did not follow the same “operational side effects must not invalidate the snapshot model” rule already used for the email-job outbox operations.

**What to change:** Register `claimPendingNotificationDigests` and `releaseNotificationDigestClaim` with `operationalMutation(...)` instead of `mutation(...)`.

### Additional notes from the pasted analysis

- `sendTeamRemovalEmails` in [lib/server/email.ts](../lib/server/email.ts:675) is still inline Resend delivery, but it is currently dead code in this branch (`rg` finds no call sites). That is cleanup / consistency debt, not a live bug in the PR diff.
- The duplication note against [lib/store/app-store-internal/domain-updates.ts](../lib/store/app-store-internal/domain-updates.ts:73) is fair maintainability feedback, but not a correctness finding for this review.
- The `collect()` note against [convex/app/email_job_handlers.ts](../convex/app/email_job_handlers.ts:108) is a real scale watchpoint, but it is not a blocking bug at current branch scope.
- The fire-and-forget refresh change in [lib/store/app-store-internal/runtime.ts](../lib/store/app-store-internal/runtime.ts:29) is an intentional ordering tradeoff. It weakens the old blocking guarantee, but the code is internally consistent with the branch’s broader shift toward non-blocking reconciliation.

### Verification approach

- Compared the current `joinTeamByCode` implementation against `249311a` to confirm the previous refresh path existed
- Read the digest worker and corresponding claim/release handlers together to verify batch-claim semantics
- Checked the mutation wrapper registrations in `convex/app.ts` against the existing `operationalMutation` policy used for email-job handlers

## Turn 3 — 2026-04-17 13:06:08 BST

| Field | Value |
|-------|-------|
| **Commit** | `0eefdae` (working tree updated after this base) |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** Closed the concrete correctness issues from Turns 1 and 2 that were practical to land in-branch: `joinTeamByCode` now reconciles immediately again, notification digest claim/release no longer invalidates client snapshots, the digest worker releases the unprocessed tail on failure, email-job claiming retires notification-linked jobs already covered by a digest, and the email worker now uses provider idempotency keys plus truthful nonzero failure exit codes. I also removed transport retries from `enqueueEmailJobsServer()` so the non-idempotent enqueue mutation can no longer duplicate emails on lost responses. The main architecture gap still left open is that email intents are created outside the originating domain mutation, so a route/process failure between the business mutation and enqueue step can still drop an email permanently.

| Status | Count |
|--------|-------|
| New findings | 2 |
| Resolved during Turn 3 | 7 |
| Carried from previous turns | 6 |
| Accepted | 0 |

### Resolved findings

- **Resolved:** `F1-01` Retrying `enqueueEmailJobsServer` can duplicate outbound emails because the enqueue mutation is not idempotent.
  Fixed by removing transport-level retries from [lib/server/convex/notifications.ts](../lib/server/convex/notifications.ts).

- **Resolved:** `F1-03` `scripts/send-email-jobs.mjs` exited successfully even when some or all email jobs failed.
  Fixed by returning batch counts and setting `process.exitCode = 1` when any job fails in [scripts/send-email-jobs.mjs](../scripts/send-email-jobs.mjs).

- **Resolved:** `F2-01` `joinTeamByCode` no longer refreshed or patched local state.
  Fixed by restoring immediate reconciliation in [lib/store/app-store-internal/slices/workspace.ts](../lib/store/app-store-internal/slices/workspace.ts).

- **Resolved:** `F2-02` A single digest-send failure could leave later claimed digests locked until TTL expiry.
  Fixed by releasing the current and still-unprocessed claimed digests before aborting in [scripts/send-notification-digests.mjs](../scripts/send-notification-digests.mjs).

- **Resolved:** `F2-03` Digest claim/release mutations still bumped `snapshotVersion` even though they only mutate operational claim metadata.
  Fixed by moving the digest claim/mark/release exports onto `operationalMutation(...)` in [convex/app.ts](../convex/app.ts).

- **Resolved:** Claiming email jobs could still send per-notification emails after a digest had already marked the underlying notification emailed.
  Fixed by retiring already-covered notification-linked jobs during claim in [convex/app/email_job_handlers.ts](../convex/app/email_job_handlers.ts).

- **Resolved:** A post-send acknowledgement failure in the email-job worker could resend the same email on the next run.
  Fixed by separating send vs. acknowledgement failure handling and passing a stable provider idempotency key (`job.id`) in [scripts/send-email-jobs.mjs](../scripts/send-email-jobs.mjs).

### Remaining open finding

#### F1-02 [BUG] High — The new “durable” email outbox is still outside the transaction that creates the email intent, so emails can be dropped permanently on partial failure
**Status:** Still open.

**Why it remains:** Fixing this correctly requires moving email-job persistence into the originating Convex domain mutations so the business write and email intent are atomic. That is a larger application/domain refactor, not a small branch-local patch.

### Verification approach

- Ran focused regression coverage:
  - `pnpm test -- tests/convex/email-job-handlers.test.ts tests/convex/notification-digest-claims.test.ts tests/lib/store/workspace-slice.test.ts tests/scripts/send-email-jobs.test.ts tests/scripts/send-notification-digests.test.ts`
- Ran focused lint:
  - `pnpm exec eslint convex/app.ts convex/app/email_job_handlers.ts lib/server/convex/notifications.ts lib/store/app-store-internal/slices/workspace.ts scripts/send-email-jobs.mjs scripts/send-notification-digests.mjs tests/convex/email-job-handlers.test.ts tests/lib/store/workspace-slice.test.ts tests/scripts/send-email-jobs.test.ts tests/scripts/send-notification-digests.test.ts --max-warnings 0`
- Ran static type verification:
  - `pnpm typecheck`

## Turn 4 — 2026-04-17 13:25:10 BST

| Field | Value |
|-------|-------|
| **Commit** | `55a3e0e` (working tree updated after this base) |
| **IDE / Agent** | `unknown / Codex` |

**Summary:** Closed the last open architectural finding by moving email-intent persistence into the originating Convex domain mutations. Mention, assignment, invite, and access-change emails are now built through a shared pure builder module and inserted into the outbox within the same mutation that creates the underlying notification / invite / lifecycle change. The route layer no longer owns enqueue durability. This also removed the last inline Resend sender by collapsing [lib/server/email.ts](../lib/server/email.ts) into a compatibility barrel over the shared builder module.

| Status | Count |
|--------|-------|
| New findings | 0 |
| Resolved during Turn 4 | 1 |
| Carried from previous turns | 1 |
| Accepted | 0 |

### Resolved findings

- **Resolved:** `F1-02` The email outbox was outside the originating domain transaction, so email intents could be lost on partial failure.
  Fixed by moving email-job construction and insertion into the originating Convex mutations in:
  - [convex/app/comment_handlers.ts](../convex/app/comment_handlers.ts)
  - [convex/app/collaboration_handlers.ts](../convex/app/collaboration_handlers.ts)
  - [convex/app/work_item_handlers.ts](../convex/app/work_item_handlers.ts)
  - [convex/app/invite_handlers.ts](../convex/app/invite_handlers.ts)
  - [convex/app/workspace_team_handlers.ts](../convex/app/workspace_team_handlers.ts)
  using the new shared builder seam in [lib/email/builders.ts](../lib/email/builders.ts) and the internal queue helper in [convex/app/email_job_handlers.ts](../convex/app/email_job_handlers.ts). The affected API routes in [app/api](../app/api) no longer enqueue email jobs after the main mutation returns.

### Verification approach

- Ran route, wrapper, worker, and handler regression coverage:
  - `pnpm test -- tests/app/api/rich-text-route-contracts.test.ts tests/app/api/work-route-contracts.test.ts tests/app/api/asset-notification-invite-route-contracts.test.ts tests/app/api/document-workspace-route-contracts.test.ts tests/app/api/team-collaboration-route-contracts.test.ts tests/convex/email-job-handlers.test.ts tests/scripts/send-email-jobs.test.ts tests/scripts/send-notification-digests.test.ts tests/lib/store/workspace-slice.test.ts tests/lib/server/convex-notifications.test.ts tests/lib/server/convex-work.test.ts tests/lib/server/convex-collaboration.test.ts tests/lib/server/convex-workspace.test.ts tests/lib/server/convex-teams-projects.test.ts`
- Ran broader lint over the affected surfaces:
  - `pnpm exec eslint app/api convex/app lib/email lib/server tests/app/api tests/convex tests/scripts tests/lib/store/workspace-slice.test.ts --max-warnings 0`
- Ran static type verification:
  - `pnpm typecheck`
