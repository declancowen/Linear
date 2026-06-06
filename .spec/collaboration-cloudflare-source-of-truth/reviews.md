---
title: Collaboration Cloudflare Source Of Truth Reviews
scope: documents, work item descriptions, PartyKit cloud-prem, Cloudflare Durable Objects, Convex projections
status: draft
repo_root: /Users/declancowen/Documents/GitHub/Linear
change_class: architecture-migration
risk_level: high
owner: product-engineering
reviewers: []
approvers: []
implementation_owner: unassigned
operations_owner: unassigned
last_updated: 2026-06-06
---

# Reviews

## Review protocol

Every implementation slice must complete this loop before the next slice starts:

1. Run focused verification for the slice.
2. Run a deep diff-review with `architecture-standards`.
3. Fix findings.
4. Rerun normal diff-review passes until clean.
5. Record validation, findings, fixes, architecture decisions, spec drift, and residual risk here.

After all slices:

1. Run the repo Fallow gate.
2. Rerun a whole-worktree diff-review loop starting with deep diff review plus `architecture-standards`.
3. Fix findings.
4. Rerun normal whole-worktree diff-review passes until clean.

## PR feedback loop - 2026-06-06 - Codex Review 1d69cc22

Status: review-clean for the third PR-feedback patch; pushed validation pending.

Scope:

- Waited for Codex to review commit `1d69cc22` before making further changes.
- Imported the thread-aware PR feedback and started with a deep branch-total review plus `architecture-standards`.
- Ran escaped-finding learning because this is the third external-finding loop after previous local clean reviews.
- Swept the migration handoff by authority boundary: app route token issuance, PartyKit token consumption, Yjs seed/snapshot, Convex body marker flip, canonical refresh, and normal flush/title persist paths.

External finding import:

| Source | Finding | Current status | Bug class | Missed invariant/variant | Action |
|--------|---------|----------------|-----------|--------------------------|--------|
| GitHub Codex review on `258c68f3` | Legacy/degraded item description body protection suppresses `updateItemDescription` sync. | already fixed in current tree | Invariant transfer / fallback persistence | Body protection must track collaboration authority, not editability. | no new code |
| GitHub Codex review on `1d69cc22` | Migration token issuance checks edit access, but PartyKit can consume the token after edit access is revoked and still seed/flip the migrated body under server authority. | live | Authority / invariant transfer / access-loss stale token | Migration execution must revalidate current edit permission at the write owner boundary. | fixed |

Architecture-standard outcome:

- PartyKit migration execution now rechecks current `canEdit` from Convex before any Yjs durable write, update-log compaction, room canonical marking, or Convex `cloudflare-yjs` marker mutation.
- The app route remains the admission/token issuance boundary; PartyKit is the execution boundary and must enforce the stale-token/lost-access variant.
- Convex marker mutation still enforces content staleness with `expectedUpdatedAt`; edit permission stays in PartyKit because the marker mutation is an operational server-token mutation and does not receive `currentUserId`.
- Normal content/title flush paths already use `getEditableCollaborationDocument` at persist time; canonical refresh remains read-only and does not persist.

Findings and fixes:

- PR3-01 - High - A user could receive a migration token while editable, lose edit permission during the token TTL, and still have PartyKit seed the Yjs document and flip Convex body authority. Fixed with a PartyKit-side `payload.canEdit` guard before migrated/no-op handling, active-room checks, Yjs snapshot writes, or Convex marker mutation.

Validation:

- `pnpm exec vitest run tests/services/partykit-server.test.ts --reporter=dot` passed, `1` file / `50` tests.
- `pnpm exec vitest run tests/app/api/document-collaboration-route-contracts.test.ts tests/convex/collaboration-document-helpers.test.ts tests/services/partykit-server.test.ts --reporter=dot` passed, `3` files / `65` tests.
- `pnpm exec eslint services/partykit/server.ts tests/services/partykit-server.test.ts --max-warnings 0` passed.
- `git diff --check -- services/partykit/server.ts tests/services/partykit-server.test.ts` passed.

Residual risk:

- Whole-worktree verification remains blocked by unrelated unstaged deletions of tracked files outside this patch. The PR-feedback commit stages only the PartyKit migration fix and review-log update.
- The old work-item protection GitHub thread remains unresolved in GitHub's thread state, but the current branch contains the fix from `1d69cc22`; the thread is stale by behavior, not by GitHub resolution metadata.

## PR feedback loop - 2026-06-06 - Codex Review 258c68f3

Status: review-clean for the second PR-feedback patch; pushed validation pending.

Scope:

- Watched PR #50 without making changes until Codex posted a new review for commit `258c68f3`.
- Imported the new thread-aware review feedback.
- Started a fresh deep diff-review plus `architecture-standards` before editing.
- Triaged the single unresolved Codex review thread against the work-item always-editable/body-protection path.

External finding import:

| Source | Finding | Current status | Bug class | Missed invariant/variant | Action |
|--------|---------|----------------|-----------|--------------------------|--------|
| GitHub Codex review | Always-editable work-item descriptions marked the description document protected even in legacy/degraded mode, causing `updateItemDescription` to patch locally without queueing the legacy rich-text sync. | live | Invariant transfer / fallback persistence | Body protection must track collaboration authority, not editability. Legacy/degraded edits need the unprotected sync path. | fixed |

Architecture-standard outcome:

- Work item body protection is now owned by collaboration lifecycle only: bootstrapping and attached protect the Convex projection from stale rehydration, while legacy/degraded leave the existing `updateItemDescription` sync path unprotected.
- The always-editable UI remains intact; editability no longer implies collaboration body protection.
- Existing store semantics remain unchanged: `updateItemDescription` still skips queued sync only when a description document is protected by collaboration.

Findings and fixes:

- PR2-01 - High - Legacy/degraded always-editable item descriptions were protected for the lifetime of the editable screen, so local edits could be lost after refresh/navigation because the queued sync was suppressed. Fixed by removing `editing` from `useProtectedWorkItemDescriptionBody` and limiting protection to `bootstrapping`/`attached`.

Validation:

- `pnpm exec eslint components/app/screens/work-item-detail-screen.tsx tests/components/work-item-detail-screen.test.tsx hooks/use-document-collaboration.ts tests/hooks/use-document-collaboration.test.tsx --max-warnings 0` passed.
- `git diff --check -- components/app/screens/work-item-detail-screen.tsx tests/components/work-item-detail-screen.test.tsx hooks/use-document-collaboration.ts tests/hooks/use-document-collaboration.test.tsx .spec/collaboration-cloudflare-source-of-truth/reviews.md` passed.
- `pnpm exec vitest run tests/components/work-item-detail-screen.test.tsx --reporter=dot` was attempted but blocked before test execution because the local worktree has an unrelated unstaged deletion of `lib/browser/url-hash-target.ts`, which `work-item-detail-screen.tsx` imports. This deletion is not staged for this PR-feedback patch.

Residual risk:

- The work-item component regression is added but could not be executed in this dirty local worktree until the unrelated tracked deletion is restored or otherwise resolved.
- CI/GitHub review will run against the pushed branch state, where this patch does not stage that deletion.

## PR feedback loop - 2026-06-06 - Codex Review 7301532f

Status: review-clean for the PR-feedback patch; pushed validation pending.

Scope:

- Imported GitHub PR #50 review threads using the thread-aware GitHub review workflow.
- Started with deep diff-review plus `architecture-standards` before editing.
- Triaged the single unresolved Codex review thread against current branch behavior.
- Swept sibling acquisition modes for migrated `cloudflare-yjs` documents: initial Yjs sync timeout, exhausted post-bootstrap connection failures, and attached-session disconnects.

External finding import:

| Source | Finding | Current status | Bug class | Missed invariant/variant | Action |
|--------|---------|----------------|-----------|--------------------------|--------|
| GitHub Codex review | Migrated `cloudflare-yjs` documents could clear `bodySource` after initial sync timeout, fall into degraded/legacy mode, and call `updateDocumentContent` against stale Convex projection content. | live | Invariant transfer / stale fallback | Body authority transfer must keep migrated bodies protected whenever Yjs is not synced. | fixed |

Architecture-standard outcome:

- The body-source authority marker is now preserved once session bootstrap identifies a document as `cloudflare-yjs`.
- A migrated body that is not attached to a synced Yjs provider remains in the protected bootstrapping lifecycle instead of becoming an editable legacy Convex body.
- The fix stays in the hook lifecycle owner; document screens continue relying on collaboration lifecycle/body protection rather than duplicating provider failure policy.
- Legacy `convex-html` timeout behavior is unchanged: legacy documents may expose bootstrap editor bindings while still suppressing Convex persistence during bootstrapping.

Findings and fixes:

- PR-01 - High - Initial Yjs sync timeout for migrated documents erased the `cloudflare-yjs` marker on failure, allowing the screen to re-enter legacy editing and persist stale Convex body content. Fixed by treating migrated sync timeout as a protected non-attached collaboration state with no editor binding, no bootstrap content, and preserved `bodySource`.
- PR-02 - Medium - A sibling post-bootstrap failure path could still erase the migrated body marker after retries exhausted. Fixed by preserving protected `cloudflare-yjs` state in `handleCollaborationOpenFailure` when the current state already came from a migrated bootstrap.
- PR-03 - Medium - Attached migrated sessions that later disconnect shared the same fallback risk because disconnected non-attached states were resolved as degraded/legacy. Fixed by resolving non-attached `cloudflare-yjs` states as bootstrapping/protected until Yjs sync is attached again.

Validation:

- `pnpm exec vitest run tests/hooks/use-document-collaboration.test.tsx --reporter=dot` passed, `1` file / `20` tests.
- `pnpm exec vitest run tests/components/document-detail-screen.test.tsx tests/hooks/use-document-collaboration.test.tsx --reporter=dot` passed, `2` files / `40` tests.
- `pnpm exec eslint hooks/use-document-collaboration.ts tests/hooks/use-document-collaboration.test.tsx --max-warnings 0` passed.
- `git diff --check -- hooks/use-document-collaboration.ts tests/hooks/use-document-collaboration.test.tsx` passed.

Residual risk:

- Whole-worktree verification was intentionally not run in this loop because the local working tree contains unrelated unstaged deletions of tracked files outside this fix (`lib/browser/url-hash-target.ts`, `tests/components/conversation-files-panel.test.tsx`, `tests/components/custom-property-controls.test.tsx`, `tests/components/rich-text-content.test.tsx`). Those deletions are not part of the PR-feedback patch and should not be staged with this fix.
- The protected unavailable state currently reuses the bootstrapping lifecycle for migrated non-attached bodies; that is deliberate to prevent stale Convex body writes without adding a new UI lifecycle enum in this review-response patch.

## Final whole-worktree review - 2026-06-06

Status: review-clean before external dev deployment/reset/PR.

Scope:

- Whole worktree review of the Cloudflare/Yjs body-source migration implementation.
- Rechecked architecture-standard risks: source-of-truth ownership, hydration/dataflow, route/token contracts, migration sequence, legacy compatibility, mention side effects, work-item always-editable behavior, deploy safety, and static-fitness drift.
- Started with a deep diff-review pass, fixed findings, reran focused verification, Fallow, and normal whole-worktree review until clean.

Architecture-standard outcome:

- PartyKit/Yjs is the migrated body authority only for documents marked `cloudflare-yjs`; Convex remains metadata/access/lifecycle/projection authority.
- Session bootstrap and hook hydration now prevent migrated documents from materializing Convex projection content into the editor body.
- Migration is seed-before-flip and refuses active rooms, preserving presence, typing, active-block, cursor, and selection invariants.
- Work item title remains Convex-owned metadata; the work item description body follows PartyKit/Yjs when attached and legacy sync only outside attached/bootstrapping collaboration.
- Mention notification delivery remains an explicit user-confirmed side effect for both documents and work item descriptions.

Findings and fixes:

- FW-01 - Medium - Work item title blur/Enter could leave an empty local title draft without saving, and a stale dirty draft could still submit over a remotely changed title. Fixed by resetting empty drafts to the current title and refusing title commits when the dirty draft baseline differs from the current Convex title; added empty/stale title regressions.
- FW-02 - Medium - Always-editable title made the sidebar/detail draft title a continuously visible projection, but the controller only updated its parent draft state when the dirty flag changed. Fixed by materializing every title keystroke into the controller draft state; added a sidebar-title regression across multiple keystrokes.
- FW-03 - Static fitness - Fallow duplication found repeated remote-title fixture setup in the work item screen tests. Fixed by extracting `applyRemoteWorkItemTitleChange`; reran Fallow to zero duplication.

Validation:

- `pnpm convex:codegen` passed.
- `pnpm exec vitest run tests/app/api/document-collaboration-route-contracts.test.ts tests/hooks/use-document-collaboration.test.tsx tests/services/partykit-server.test.ts tests/components/work-item-detail-screen.test.tsx tests/components/document-detail-screen.test.tsx tests/lib/collaboration-partykit-adapter.test.ts tests/lib/store/work-document-actions.test.ts tests/app/api/document-workspace-route-contracts.test.ts --reporter=dot --bail=50` passed, `8` files / `197` tests.
- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `git diff --check` passed.
- `pnpm fallow:gate` passed: dead-code `0`, health findings `0`, duplication `0`.
- Local app smoke: `pnpm dev` booted Next at `http://localhost:3000`; `HEAD /login` returned `200`; `HEAD /items/item_1` returned `307` to auth before the protected work-item detail UI could render.

Residual risk:

- Authenticated browser visual smoke of the work-item detail UI was not available in this session because the Browser tool did not expose a navigation/screenshot capability, Playwright/Puppeteer were not installed, and the target route redirects through WorkOS auth without a session. Component tests cover the changed UI states.
- External dev deployment, Cloudflare/PartyKit storage verification, Convex dev data reset, and PR creation remain pending after review because the live shell does not currently export Cloudflare/Convex deploy environment variables.

## Slice 5 - Work-item editor source-of-truth and mention workflow

Status: review-clean for Slice 5.

Scope:

- Make work item title and description always editable for users with edit access.
- Remove the work item main-section Edit/Save/Done/Close UI.
- Keep work item titles Convex-owned metadata for collection/list/board/timeline/calendar/search surfaces.
- Keep work item description body edits on the PartyKit/Yjs collaboration path when attached, and the existing item-description sync path when legacy/degraded.
- Add work item description mention notification confirmation using the same reducer/process as document mentions.
- Extract shared pending-mention navigation guards so document and work item editors use the same leave-with-unsent-mentions behavior.
- Keep the old `work-item-main` PartyKit flush shape compatible server-side, but stop using it from the work item editor title path.

Architecture-standard shaping:

- Title authority remains in the work item metadata owner (`updateWorkItem` / Convex), not in the Cloudflare/Yjs body room.
- Body authority remains in the editor/body owner: PartyKit/Yjs when collaboration is attached, legacy rich-text sync only when not attached and not bootstrapping.
- Mention notifications are explicit side effects: local mention count increases create a pending queue, remote/external count changes rebase the queue, and notifications are sent only after user confirmation.
- Collection and planning surfaces keep reading Convex projections; the work item detail editor is the only surface that opens the PartyKit body room.
- The always-editable state makes body protection continuous for editable work item details, preventing Convex read-model refreshes from rehydrating over the active editor.

Review outcome:

- Deep diff-review with `architecture-standards`: found two Medium issues.
- Normal re-review after fixes: clean.
- Branch-totality check for Slice 5 plus Slice 1-4 interaction: clean.

Findings and fixes:

- S5-01 - Medium - The title stale-draft guard originally used broad `updatedAt`, so unrelated description/projection updates could falsely block a local title edit. Fixed by tracking the baseline title string directly and treating the draft as stale only when that title baseline differs from the current item title.
- S5-02 - Medium - The work item mention leave guard duplicated the document guard and missed the document path's `defaultPrevented`/`a[href]` behavior. Fixed by extracting `pending-mention-navigation.ts` and using it from both document and work item screens; added a work item navigation prompt regression.

Invariant proof:

- Work item title commit uses `updateWorkItem(currentItem.id, { title })`; no work item title is written through PartyKit/Yjs from the always-editable screen path.
- Attached description keystrokes do not patch Convex local projection on every change; PartyKit/Yjs remains the live body path until the server projection flush.
- Legacy/degraded description edits still call `updateItemDescription`, and confirmed mention notification sends flush `item-description:${itemId}` first.
- Attached mention notification sends call collaboration `flush()` before `syncSendItemDescriptionMentionNotifications`.
- Self mentions and private work item mentions do not create notification sends.
- Pending mentions survive failed notification delivery and clear on success or already-delivered conflict.
- Internal navigation with pending work item mentions opens the exit confirmation and does not route until send/skip is chosen.
- Document mention navigation continues to use the same behavior through the shared helper.

Validation:

- `pnpm exec vitest run tests/components/work-item-detail-screen.test.tsx tests/components/document-detail-screen.test.tsx tests/services/partykit-server.test.ts tests/lib/collaboration-partykit-adapter.test.ts tests/lib/store/work-document-actions.test.ts tests/app/api/document-workspace-route-contracts.test.ts` passed, `6` files / `167` tests.
- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `git diff --check` passed.

Residual risk:

- This slice does not include an authenticated browser visual smoke of the changed work item detail layout; final whole-worktree review records the auth/tooling limitation and component-test coverage.
- Final whole-worktree review added a regression so the sidebar draft-title preview follows every local title keystroke while the title field is open.
- Old `work-item-main` PartyKit flush compatibility remains for stale clients/tests and should be deleted only after rollout proves no clients use it.

## Slice 4 - Hydration and awareness continuity

Status: review-clean for Slice 4.

Scope:

- Keep Convex bootstrap content hidden for migrated `cloudflare-yjs` documents.
- Track document `bodySource` in the hook's internal collaboration state.
- Gate migrated editor collaboration bindings until the Yjs provider has synced the document body.
- Prevent websocket `connected` status from exposing migrated editor bindings before the first Yjs sync.
- Add a real Tiptap/Yjs relative-position regression for remote caret movement after paragraphs are inserted above the caret.

Architecture-standard shaping:

- `cloudflare-yjs` migrated documents must get editor body state from the synced Yjs provider, not from Convex projection HTML/JSON.
- `state.collaboration` is the hook's local synced-body marker; migrated editor bindings are not exposed only because a websocket transport is connected.
- Existing `convex-html` documents keep their current bootstrap behavior so legacy documents can still render from Convex while they are not migrated.
- Presence, typing, active block, cursor, selection, and relative cursor fields remain on the existing PartyKit/provider awareness path.

Review outcome:

- Deep diff-review with `architecture-standards`: clean, no open Critical/High/Medium findings.
- Normal re-review after focused verification: clean.
- Branch-totality check for Slice 4 plus Slice 1-3 interaction: clean.

Invariant proof:

- Migrated bootstrap: the hook returns `bootstrapContent: null` when `bodySource` is `cloudflare-yjs`.
- Pre-sync editor safety: migrated documents with a pending provider `connect()` expose neither `editorCollaboration` nor `collaboration`.
- Websocket-before-sync variant: if websocket status changes to `connected` before provider sync completes, migrated editor bindings remain hidden until `state.collaboration` is set.
- Sync-timeout variant: migrated sync timeouts no longer take the legacy bootstrap fallback path.
- Awareness continuity: editor presence updates still write through the existing provider awareness user merge path; relative cursor/selection fields remain attached to the Yjs-backed editor state.
- Shifted caret regression: a cursor serialized through `absolutePositionToRelativePosition` inside paragraph three resolves to the new shifted paragraph-three position after a paragraph is inserted above it in the same Y.Doc.

Validation:

- `pnpm exec vitest run tests/hooks/use-document-collaboration.test.tsx tests/lib/collaboration-partykit-adapter.test.ts tests/components/rich-text-editor-helpers.test.tsx` passed, `3` files / `59` tests.
- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `git diff --check` passed.

Residual risk:

- This slice proves local Yjs relative-position mapping, not a full browser two-client visual cursor overlay.
- Convex projection hash/version idempotency, work-item projection coverage, backup/restore, and Cloudflare dev deployment remain future slices.
- Cloudflare cloud-prem has not yet been deployed from this environment; host/storage verification remains in the final deployment phase.

## Slice 3 - One-time migration seed

Status: review-clean for Slice 3.

Scope:

- Add an internal body migration token/action for PartyKit document rooms.
- Add an app route that signs the internal migration command only during an explicit migration window.
- Seed the room Yjs document from Convex HTML/JSON, snapshot and compact y-partykit storage, then mark Convex `bodySource` as `cloudflare-yjs`.
- Refuse migration while document collaborators are connected.
- Add Convex marker tests, PartyKit migration tests, route contract tests, and token parser coverage.

Architecture-standard shaping:

- The migration writes Yjs durable state before flipping Convex metadata.
- Convex body content is treated as source only while `bodySource` is still `convex-html`.
- The migration route is disabled unless `COLLABORATION_BODY_MIGRATION_ENABLED=true`.
- Active rooms are not migrated; this preserves existing awareness/cursor/typing behavior by avoiding server-side Yjs replacement while clients are bound to the document.
- Migration token claims keep `sub: "server"` and carry `currentUserId` separately so PartyKit can fetch the source document through the existing access-checked Convex path.

Review outcome:

- Deep diff-review with `architecture-standards`: found two migration-safety issues.
- Normal re-review after fixes: clean.
- Branch-totality check for Slice 3 plus Slice 1/2 interaction: clean.

Findings and fixes:

- S3-01 - Medium - Successful inactive migration restored prior room session claims, which could preserve stale editor claims and make later refreshes think an inactive room was active. Fixed by clearing migration-owned synthetic state after inactive migration and leaving concurrently connected user-owned state untouched.
- S3-02 - Medium - The new app migration route was initially callable by any document editor once deployed. Fixed by requiring `COLLABORATION_BODY_MIGRATION_ENABLED=true` before the route fetches the document or signs a PartyKit migration token.

Invariant proof:

- Seed-before-flip: PartyKit replaces the Yjs document from Convex canonical JSON, calls y-partykit `writeState()` and `compactUpdateLog()`, then calls the Convex marker mutation with the source document `updatedAt`.
- Stale-source rejection: the Convex marker mutation rejects if `documents.updatedAt` changed after PartyKit fetched and seeded the body.
- No active-room rewrite: migration rejects when room connections or Yjs connections are present, returning `collaboration_conflict_reload_required`.
- No Convex rehydrate for migrated docs: already migrated documents short-circuit, and migrated rooms continue to skip Convex projection refresh/reseed paths.
- Presence/cursor preservation: this slice does not change awareness, typing, active-block, cursor, or selection flows; the new migration path avoids mutating Yjs while those flows can be active.

Validation:

- `pnpm convex:codegen` passed.
- `pnpm exec vitest run tests/app/api/document-collaboration-route-contracts.test.ts tests/services/partykit-server.test.ts tests/convex/collaboration-document-helpers.test.ts tests/lib/collaboration-foundation.test.ts` passed, `4` files / `72` tests.
- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `git diff --check` passed.

Residual risk:

- Cloudflare cloud-prem has not been deployed in this environment because account credentials and target domains are not present.
- The migration API is gated by an app env flag, not yet by a per-document or per-workspace rollout registry.
- Backup/export, restore drill, projection hash/version idempotency, and quota measurement remain future slices before production migration.
- The dedicated shifted remote-caret regression for migrated multi-client editing remains future work; this slice protects that invariant by refusing active-room migration.

## Slice 2 - Cloud-prem deployment and awareness invariants

Status: review-clean for Slice 2.

Scope:

- Make normal PartyKit deploy scripts use a guarded Cloudflare cloud-prem wrapper.
- Keep managed PartyKit deploys available only under explicit non-durable `partykit:deploy:managed:*` scripts.
- Update README and runbooks so cloud-prem, Workers Free first, Workers Paid upgrade, and Cloudflare Pro non-requirement are the documented operating model.
- Mark older Convex-canonical collaboration docs as historical/non-authoritative for this migration.
- Add the preservation rule for presence, typing, access control, document management, and work-item management.
- Add cursor/selection awareness continuity as a named body-source migration invariant.

Architecture-standard shaping:

- Durable body authority must not depend on managed `*.partykit.dev` storage.
- Dev/prod cloud-prem deploys must require explicit target domains to avoid accidental prod-to-dev domain reuse.
- Presence, typing, cursor, selection, and active-block awareness are preservation constraints. Compatibility edits are allowed only when required by the body-source migration and must be reviewed against the existing behavior.
- Awareness coordinates must be attached to the same synced Yjs document state as body edits; Convex projection must not become the coordinate system for migrated editor markers.

Review outcome:

- Deep diff-review with `architecture-standards`: found one deploy-safety issue.
- Normal re-review after the fix: clean.
- Branch-totality check: clean for Slice 2 plus Slice 1 interaction.

Findings and fixes:

- S2-01 - Medium - The first deploy wrapper allowed a generic `PARTYKIT_CLOUDFLARE_DOMAIN` fallback, which could let a production deploy silently reuse a development hostname. Fixed by requiring explicit `PARTYKIT_CLOUDFLARE_DEV_DOMAIN` or `PARTYKIT_CLOUDFLARE_PROD_DOMAIN`.

Invariant proof:

- Managed PartyKit remains possible only through explicit `partykit:deploy:managed:*` commands and is documented as non-durable.
- Default `partykit:deploy:*` commands now fail before deploy unless Cloudflare account, token, and target-specific domain env vars are present.
- The docs and spec now encode `convex-html` versus `cloudflare-yjs` body authority without rewriting existing presence/typing/document-management surfaces.
- Cursor/selection continuity is explicitly tied to Yjs provider awareness and relative-position mapping for migrated docs.

Validation:

- `node scripts/deploy-partykit-cloudflare.mjs dev` failed with the expected missing-env message.
- `CLOUDFLARE_ACCOUNT_ID=acct CLOUDFLARE_API_TOKEN=token PARTYKIT_CLOUDFLARE_DEV_DOMAIN=http://bad.example node scripts/deploy-partykit-cloudflare.mjs dev` failed with the expected hostname-only message.
- `PARTYKIT_CLOUDFLARE_DOMAIN=collab.example.com CLOUDFLARE_ACCOUNT_ID=acct CLOUDFLARE_API_TOKEN=token node scripts/deploy-partykit-cloudflare.mjs prod` failed with the expected missing `PARTYKIT_CLOUDFLARE_PROD_DOMAIN` message.
- `pnpm exec vitest run tests/lib/collaboration-partykit-adapter.test.ts tests/components/rich-text-editor-helpers.test.tsx tests/hooks/use-document-collaboration.test.tsx tests/app/api/document-collaboration-route-contracts.test.ts` passed, `4` files / `62` tests.
- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `git diff --check` passed.

Residual risk:

- Cloudflare cloud-prem has not been deployed in this environment because account credentials and target domains are not present.
- SQLite-backed Durable Object verification and quota measurement remain future slices before any production document is marked `cloudflare-yjs`.
- The shifted remote-caret regression is now required by spec, but the current slice only preserves existing helper tests; a dedicated migrated-doc multi-client regression remains to be added with the hydration implementation.

## Slice 1 - Body-source migration shell

Status: review-clean for Slice 1.

Scope:

- Add body-source metadata and normalization for documents.
- Carry body source through Convex collaboration payloads and session bootstrap.
- Prevent migrated `cloudflare-yjs` editor sessions from hydrating from Convex projection content.
- Prevent migrated PartyKit rooms from loading/reseeding from Convex projection content.
- Switch y-partykit persistence to snapshot mode for the migrated-path storage direction.

Architecture-standard shaping:

- `DocumentBody` authority moves behind an explicit `bodySource` contract.
- Existing rows default to `convex-html` to preserve current behavior.
- Migrated `cloudflare-yjs` documents must not treat Convex `documents.content` as body authority.
- Convex content writes remain as projection writes during this slice.

Review outcome:

- Deep diff-review with `architecture-standards`: clean, no open Critical/High/Medium findings.
- Normal re-review pass after deep review: clean.
- Branch-totality check: clean for the Slice 1 diff.

Invariant proof:

- Authority: `bodySource` is persisted in Convex metadata and normalized to `convex-html` for legacy rows.
- Hydration: migrated `cloudflare-yjs` sessions omit Convex `contentJson` and `contentHtml`; the hook exposes no Convex bootstrap body for those sessions.
- Cold-room behavior: migrated rooms do not load, replace, or reseed Yjs state from Convex projection content.
- Teardown behavior: migrated rooms ignore client teardown snapshots and persist the server-held Y.Doc projection back to Convex.
- Projection behavior: Convex writes remain projection writes for migrated documents and do not use stale document `updatedAt` as a body-authority conflict token.
- Legacy behavior: unmigrated `convex-html` documents keep existing Convex bootstrap and seeding semantics.

Validation:

- `git diff --check` passed.
- `pnpm convex:codegen` passed with no generated-file diff left behind.
- `pnpm exec vitest run tests/app/api/document-collaboration-route-contracts.test.ts tests/hooks/use-document-collaboration.test.tsx tests/services/partykit-server.test.ts tests/convex/work-item-handlers.test.ts` passed, `4` files / `96` tests.
- `pnpm exec vitest run tests/convex/document-handlers.test.ts tests/convex/work-item-handlers.test.ts tests/lib/store/work-document-actions.test.ts tests/lib/store/work-item-actions.test.ts` passed, `4` files / `94` tests.
- `pnpm typecheck` passed.
- `pnpm lint` passed.

Residual risk:

- High overall migration risk remains because cloud-prem deployment proof, one-time migration seeding, backup/restore, quota measurement, projection hash/versioning, and rollout flagging are not implemented in Slice 1.
- Slice 1 intentionally does not mark any existing document as `cloudflare-yjs`; that must wait for a migration seed path that proves Yjs state exists before flipping the body source.
- Vitest still prints the existing `--localstorage-file was provided without a valid path` warning during these runs; it did not fail the tests and is not introduced by this slice.
