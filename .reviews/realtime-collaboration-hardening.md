# Review: Realtime Collaboration Hardening

## Project context

| Field | Value |
|-------|-------|
| **Repository** | `Linear` |
| **Remote** | `https://github.com/declancowen/Linear.git` |
| **Branch** | `realtime-collab-hardening` |
| **Stack** | `Next.js / React / Convex / PartyKit / Yjs / TipTap / Zustand / TypeScript` |

## Scope

- `lib/collaboration/**` — added Turn 1
- `lib/server/collaboration-token.ts` — added Turn 1
- `lib/server/collaboration-refresh.ts` — added Turn 1
- `app/api/collaboration/documents/[documentId]/session/route.ts` — added Turn 1
- `app/api/documents/[documentId]/route.ts` — added Turn 1
- `app/api/items/[itemId]/description/route.ts` — added Turn 1
- `app/api/items/[itemId]/route.ts` — added Turn 1
- `services/partykit/**` — added Turn 1
- `hooks/use-document-collaboration.ts` — added Turn 1
- collaboration protocol, route, adapter, hook, and PartyKit tests — added Turn 1
- `.audits/realtime-collaboration-outline-comparison.md` and architecture docs/specs — added Turn 1

## Hotspots

- realtime source-of-truth drift between Convex HTML and active Yjs room — added Turn 1
- stale editor/schema compatibility — added Turn 1
- active flush versus teardown fallback authority — added Turn 1
- room admission and payload/state limits — added Turn 1
- active-room refresh for canonical update/delete/access changes — added Turn 1
- structured close/error taxonomy and user recovery — added Turn 1
- work item description sibling paths — added Turn 1

## Review status

| Field | Value |
|-------|-------|
| **Review started** | `2026-04-27 09:22:52 BST` |
| **Last reviewed** | `2026-04-27 10:16:53 BST` |
| **Total turns** | `3` |
| **Open findings** | `0` |
| **Resolved findings** | `6` |
| **Accepted findings** | `0` |

## Turn 3 — 2026-04-27 10:16:53 BST

| Field | Value |
|-------|-------|
| **Commit** | `c79a10ac` |
| **IDE / Agent** | `Codex` |

**Summary:** Re-reviewed the branch after external findings and a local duplicate-sync report. Four live issues were found and fixed: refresh clean-room replacement had an async dirty-check race, viewer admission was incorrectly blocked by full editor slots, manual flush did not require client version params, and dev Strict Mode/document remounts could issue duplicate collaboration session opens or show the initial sync modal twice.
**Outcome:** all clear for the actionable findings in this turn.
**Risk score:** high — collaboration room authority, admission, version compatibility, and initial editor boot flow changed.
**Change archetypes:** authority, async race, role/permission parity, compatibility gate, lifecycle/retry, UX state.
**Intended change:** preserve server-owned room state, reject stale non-websocket flushes, allow viewer overflow past editor cap, and show one initial sync preview per document open/session.
**Intent vs actual:** implementation now checks room dirty/update-version on both sides of the canonical fetch, scopes editor limits to connecting editors only, applies client-version evidence to manual flushes, delays session open until Strict Mode probes can cancel, and records the sync modal as shown when it first opens while keeping that current modal visible until bootstrapping ends.
**Confidence:** high for targeted collaboration paths; medium for whole-repo because known full-suite baseline failures remain outside this branch.
**Coverage note:** rechecked PartyKit refresh, admission, request auth, hook lifecycle, document/work-item modal gating, and protocol docs.
**Finding triage:** RCH-003 through RCH-006 were live and fixed in this turn.
**Bug classes / invariants checked:** TOCTOU/async preservation, authority boundary, role-specific limits, stale-client compatibility, Strict Mode idempotence, one-shot UI lifecycle.
**Branch totality:** branch state was reassessed after all new fixes, not just the pasted line references.
**Sibling closure:** document body and work-item description sync previews both use the shared one-shot gate; websocket join and manual flush both require client version evidence; delete/access refresh paths close without destructive async replacement.
**Remediation impact surface:** PartyKit admission/server refresh/auth, document collaboration hook, document/work-item detail screens, collaboration protocol doc, regression tests.
**Residual risk / unknowns:** `localhost:4000` is running and hot-reloaded successfully; local logs still show session issuance from multiple active browser users/tabs, so a clean single-tab manual smoke is still useful before deploy.

### External finding import

| Source | Finding | Status | Bug class | Missed invariant / variant | Action |
|---|---|---|---|---|---|
| User / external review | TOCTOU race in `canonical-updated` refresh can overwrite edits arriving during async fetch | Resolved | async preservation / TOCTOU | Dirty state must remain valid across every `await` before destructive replacement | Added `updateVersion` and pre/post-fetch dirty-version checks; conflict closes room instead of replacing |
| User / external review | Viewer rejected when editor slots are full | Resolved | role-specific admission | Editor cap applies only to connecting editors; total cap applies to all connections | Admission now receives connecting role and only applies editor cap for editors |
| User / external review | Manual flush accepts missing client protocol/schema params | Resolved | compatibility / authority | Non-websocket operations need the same stale-client evidence as websocket joins | Flush requests now call request verification with `requireClientVersionParams` |
| User local report | Initial sync modal/session appears twice | Resolved | lifecycle idempotence / Strict Mode variant | Opening a room must be cancellable before network session issuance, and the initial modal must be one-shot per document session | Delayed session open by one task for Strict Mode cancellation; added shared one-shot sync-preview hook for document and work-item description surfaces |

### Validation

- `pnpm typecheck` — passed.
- `pnpm exec vitest run tests/services/partykit-server.test.ts tests/hooks/use-document-collaboration.test.tsx tests/components/document-detail-screen.test.tsx tests/components/work-item-detail-screen.test.tsx tests/lib/collaboration-partykit-adapter.test.ts tests/app/api/document-collaboration-route-contracts.test.ts tests/lib/collaboration-client-session.test.ts tests/lib/collaboration-foundation.test.ts tests/lib/server/collaboration-token.test.ts tests/app/api/work-route-contracts.test.ts tests/app/api/document-workspace-route-contracts.test.ts` — passed, `11` files / `134` tests.
- `git diff --check` — passed.
- `~/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — completed; no new branch-specific architecture blocker identified.
- `localhost:4000` — Next dev server is running; hot reload compiled the latest changes.

### Branch-totality proof

- **Non-delta files/systems re-read:** `services/partykit/server.ts`, `services/partykit/collaboration/admission.ts`, `hooks/use-document-collaboration.ts`, document/work-item detail sync preview code, protocol docs.
- **Prior open findings rechecked:** none open.
- **Prior resolved/adjacent areas revalidated:** RCH-001 and RCH-002 remain fixed; new manual flush path now has the same version gate as websocket admission.
- **Hotspots or sibling paths revisited:** refresh canonical update/delete/access variants, viewer/editor admission variants, manual flush and teardown-content variants, document and work-item collaboration boot modals.
- **Dependency/adjacent surfaces revalidated:** session bootstrap side effects under React Strict Mode, sessionStorage one-shot modal state, yjs room dirty tracking, structured refresh conflict close code.
- **Why this is enough:** each external finding now has a direct runtime guard and regression coverage at the authoritative boundary that failed.

### Challenger pass

- `done` — Assumed the external findings indicated family-level gaps, not one-line bugs. Checked async dirty-state siblings, role variants, non-websocket protocol bypasses, and Strict Mode lifecycle variants.

### Resolved / Carried / New findings

#### RCH-003 [P1] Prevent canonical refresh from overwriting edits made during async fetch

**Status:** Resolved.

**Issue:** `canonical-updated` checked `dirty`, awaited Convex canonical content, then destructively replaced the Y.Doc without rechecking whether clients edited during the fetch window.

**Fix:** Room metadata now tracks an `updateVersion` incremented on every Y.Doc update. Canonical refresh records the version before fetch and rechecks both `dirty` and `updateVersion` after fetch. Any change closes the room with `collaboration_conflict_reload_required`.

#### RCH-004 [P1] Apply editor-room limits only to connecting editors

**Status:** Resolved.

**Issue:** Admission rejected all new connections when editor slots were full, including viewers that should still be allowed when total room capacity remains.

**Fix:** Admission now receives the connecting role and only applies `maxEditorsPerRoom` when that role is `editor`. Total connection caps still apply to every role.

#### RCH-005 [P1] Require client version params on manual flush

**Status:** Resolved.

**Issue:** Flush requests verified token claims but did not require client-reported protocol/schema query params, allowing stale clients to bypass the websocket version gate.

**Fix:** PartyKit request auth now requires client version params for `action=flush`, including teardown fallback. Known failures return structured reload-required errors before parsing the body.

#### RCH-006 [P2] Avoid duplicate initial collaboration sync modal/session opens

**Status:** Resolved.

**Issue:** The initial sync modal was marked as seen only after attach, so remounts/restarts during bootstrap could show it twice. In dev, React Strict Mode effect probing could also issue a throwaway collaboration session request before cleanup.

**Fix:** Collaboration session open is scheduled with a cancellable zero-delay timer so Strict Mode cleanup can prevent the probe request. A shared `useInitialCollaborationSyncPreview` hook records the modal as shown when it opens, while keeping that current modal visible until bootstrapping exits.

### Recommendations

1. **Fix first:** none open.
2. **Then address:** run a clean single-tab browser smoke against local/hosted PartyKit to confirm only one session is issued per document open outside multi-tab test noise.
3. **Patterns noticed:** every async destructive update needs a post-await invariant check; every cap must be checked against the connecting variant, not just current aggregate state.
4. **Suggested approach:** keep adding family-level tests for external review findings, not only the exact reported line.
5. **Defer on purpose:** existing full-suite baseline failures remain outside this branch.

## Turn 2 — 2026-04-27 09:35:20 BST

| Field | Value |
|-------|-------|
| **Commit** | `23648be8` |
| **IDE / Agent** | `Codex` |

**Summary:** Re-reviewed the branch after the final runtime contract cleanup. One live protocol-authority issue was found and fixed: PartyKit was validating server-minted token versions but not the client-reported editor/schema version on websocket join.
**Outcome:** all clear with documented full-suite baseline failures outside this branch.
**Risk score:** high — realtime auth/protocol/persistence boundaries and deployment compatibility changed.
**Change archetypes:** contract, release-safety, security, fallback-state, migration/compatibility, observability.
**Intended change:** harden the live collaboration protocol so stale clients, stale snapshots, oversized payloads, access changes, deletes, and active-room conflicts fail through explicit server-owned contracts.
**Intent vs actual:** implementation now matches intent more tightly; websocket joins require client version params by default, token claims remain versioned, flush URLs carry client versions, and the documented legacy flag is limited to rollout ordering.
**Confidence:** high for the collaboration diff; medium for whole-repo because the full Vitest suite has unrelated existing failures.
**Coverage note:** rechecked PartyKit auth, adapter params, token claims, flush parsing, structured errors, observability event names, route notifications, docs/runbook/rollout contract, and changed tests.
**Finding triage:** RCH-002 was live and fixed in this turn.
**Bug classes / invariants checked:** authority, compatibility/legacy clients, release safety, role/permission parity, payload limits, source-of-truth preservation.
**Branch totality:** current branch state was reassessed after the new fix; prior hotspots from Turn 1 were rechecked.
**Sibling closure:** websocket join and manual flush paths now both carry/validate protocol version evidence; refresh/internal tokens remain server-only and do not require document schema params.
**Remediation impact surface:** PartyKit auth module, PartyKit server connect path, adapter flush URL construction, error reload semantics, tests, protocol/runbook/rollout docs.
**Residual risk / unknowns:** no hosted two-browser PartyKit smoke test was run locally; full suite failures are outside this branch and listed below.

### Validation

- `pnpm typecheck` — passed.
- `pnpm exec vitest run tests/services/partykit-server.test.ts tests/hooks/use-document-collaboration.test.tsx tests/lib/collaboration-partykit-adapter.test.ts tests/app/api/document-collaboration-route-contracts.test.ts tests/lib/collaboration-client-session.test.ts tests/lib/collaboration-foundation.test.ts tests/lib/server/collaboration-token.test.ts tests/app/api/work-route-contracts.test.ts tests/app/api/document-workspace-route-contracts.test.ts` — passed, `9` files / `101` tests.
- `git diff --check` — passed.
- `~/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — completed; no new branch-specific architecture blocker identified.
- `pnpm exec vitest run` — failed in unrelated baseline areas: `tests/components/views-screen.test.tsx` missing `Robot` icon mock, document presence `activeBlockId: null` expectation drift, create-document return shape expectation drift, chat call route mock returning `500`, platform route mock returning `500`, and `tests/lib/server/convex-collaboration.test.ts` pretty-format assertion failure.
- `pnpm lint` — failed in pre-existing repo-wide lint errors/warnings outside this branch; the one new branch warning found in `tests/services/partykit-server.test.ts` was fixed and the targeted suite was rerun.

### Branch-totality proof

- **Non-delta files/systems re-read:** `services/partykit/collaboration/auth.ts`, `services/partykit/server.ts`, `lib/collaboration/adapters/partykit.ts`, `lib/collaboration/transport.ts`, `lib/collaboration/errors.ts`, session route, route notification paths, protocol/runbook/rollout docs.
- **Prior open findings rechecked:** none.
- **Prior resolved/adjacent areas revalidated:** RCH-001 remains fixed; admission excludes the current connection and limit rejections now emit the documented event.
- **Hotspots or sibling paths revisited:** stale client websocket join, stale client flush, viewer flush, teardown fallback, active server-owned content flush, internal refresh.
- **Dependency/adjacent surfaces revalidated:** token signing compatibility, token parser strictness, y-partykit provider params, adapter manual flush URL construction, hook reload-required mapping.
- **Why this is enough:** the weakest invariant was stale client admission. It now has runtime enforcement at PartyKit auth plus regression tests for missing websocket params and stale flush params.

### Challenger pass

- `done` — Assumed the version gate was insufficient because server-issued token versions are not proof of the browser/editor build. Confirmed the gap, fixed it, and added tests.

### Resolved / Carried / New findings

#### RCH-002 [P1] Validate client-reported protocol/schema versions on websocket join

**Status:** Resolved.

**Issue:** The server embedded current protocol/schema versions in tokens, then PartyKit validated those token claims. That did not prove the browser/editor code was current because a stale client could receive a fresh token from the session route.

**Fix:** PartyKit now requires client-reported `protocolVersion` and `schemaVersion` params for websocket joins unless `COLLABORATION_ALLOW_LEGACY_SCHEMA_VERSION=true` is temporarily set. The adapter sends the same params for provider auth and manual flush URLs. Missing/unsupported versions return structured reload-required collaboration errors.

### Recommendations

1. **Fix first:** none open.
2. **Then address:** run a hosted two-client PartyKit smoke after deploy because local unit tests cannot prove real worker/provider behavior.
3. **Patterns noticed:** version authority must be client-reported and server-validated; server-minted tokens alone are not enough to prove client compatibility.
4. **Suggested approach:** keep the rollout compatibility flag short-lived and remove/keep-disabled after web + PartyKit are deployed together.
5. **Defer on purpose:** durable Yjs persistence, local IndexedDB, hidden-tab disconnect, and follow/scroll presence remain separate future decisions.

## Turn 1 — 2026-04-27 09:22:52 BST

| Field | Value |
|-------|-------|
| **Commit** | `23648be8` |
| **IDE / Agent** | `Codex` |

**Summary:** Reviewed the full branch diff for the realtime collaboration hardening plan. One admission-limit edge case was found and fixed during review; no open high/medium actionable findings remain.
**Outcome:** all clear with low-risk unknowns.
**Risk score:** high — shared realtime protocol, auth/token claims, persistence authority, active-room reconciliation, and rollout docs changed.
**Change archetypes:** contract, fallback-state, migration/compatibility, release-safety, security, performance.
**Intended change:** keep Convex HTML durable, make active saves server-owned, add protocol/schema gates, structured errors, limits, refresh reconciliation, observability, and documentation/deferred decisions.
**Intent vs actual:** implementation matches intent; durable Yjs, local IndexedDB, idle disconnect, and follow/scroll presence are intentionally deferred.
**Confidence:** medium-high — targeted collaboration tests and typecheck pass; full suite still has pre-existing unrelated failures outside this branch.
**Coverage note:** reviewed changed files and sibling document/work-item description paths, including non-collab document routes, work-item description route, work-item delete route, token parser, adapter, hook, PartyKit connect/flush/refresh, limits, and docs.
**Finding triage:** one live edge was fixed: current socket could be counted against admission caps if PartyKit includes it in `room.getConnections()`.
**Bug classes / invariants checked:** source-of-truth authority, stale client version rejection, teardown fallback safety, viewer/editor role split, room/document identity, payload/state caps, active-room delete/access refresh, sibling work-item description deletion.
**Branch totality:** current branch state was reviewed, not just latest edits.
**Sibling closure:** standalone documents, item description updates, and work item deletion were checked for active-room notification parity.
**Remediation impact surface:** server protocol/types, app routes, Convex wrappers/handlers, PartyKit server modules, adapter, hook, tests, docs/spec/audit.
**Residual risk / unknowns:** no multi-client browser/manual PartyKit hosted test was run in this turn; full Vitest has unrelated baseline failures that should be handled separately.

### Validation

- `pnpm typecheck` — passed.
- `pnpm exec vitest run tests/services/partykit-server.test.ts tests/lib/collaboration-foundation.test.ts tests/app/api/document-collaboration-route-contracts.test.ts tests/hooks/use-document-collaboration.test.tsx tests/lib/collaboration-partykit-adapter.test.ts tests/lib/server/collaboration-token.test.ts` — passed, `6` files / `65` tests.
- `pnpm exec vitest run tests/app/api/work-route-contracts.test.ts tests/app/api/document-workspace-route-contracts.test.ts` — passed, `2` files / `33` tests.
- `pnpm exec vitest run` — failed in unrelated suites: `tests/components/views-screen.test.tsx` missing `Robot` icon mock, presence normalization expectation drift, chat/platform route mock failures, and one existing convex-collaboration assertion formatting failure.
- `~/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — completed; no new branch-specific architecture blocker identified.

### Branch-totality proof

- **Non-delta files/systems re-read:** `convex/app/document_handlers.ts`, `convex/app/work_item_handlers.ts`, `lib/server/convex/documents.ts`, `lib/server/convex/work.ts`, item/document routes, collaboration adapter, hook, PartyKit server, protocol/error/limits modules.
- **Prior open findings rechecked:** RC-001 through RC-015 from `.audits/realtime-collaboration-outline-comparison.md`.
- **Prior resolved/adjacent areas revalidated:** active flush server-owned persistence, teardown fallback, document-title metadata-only path, viewer flush rejection, schema-version rejection, room refresh, work item description routes.
- **Hotspots or sibling paths revisited:** non-collab document PATCH/DELETE, item-description PATCH, work-item DELETE cascade.
- **Dependency/adjacent surfaces revalidated:** token signing/verification, session bootstrap response, y-partykit adapter params, scoped read-model bumps after document/work-item mutations.
- **Why this is enough:** the highest-risk invariants are now directly covered by tests and runtime guards at the authoritative PartyKit/server boundaries; remaining gaps are manual/hosted validation rather than obvious code-path misses.

### Challenger pass

- `done` — Assumed one serious issue remained and attacked the admission/refresh sibling paths. Found and fixed current-connection double-counting in room admission and added work-item deletion refresh notifications for deleted description documents.

### Resolved / Carried / New findings

#### RCH-001 [P2] Avoid counting the connecting socket against room admission caps

**Status:** Resolved.

**Issue:** `assertDocumentRoomAdmission` originally counted every `room.getConnections()` entry. If PartyKit includes the currently connecting socket, the max-th allowed connection could be rejected as over limit.

**Fix:** `assertDocumentRoomAdmission` now accepts the current connection and excludes it before enforcing total/editor limits. Added a regression test proving a room with max `1` accepts the connecting socket when it is present in `getConnections()`.

### Recommendations

1. **Fix first:** none open.
2. **Then address:** manual hosted PartyKit two-client validation before production deploy.
3. **Patterns noticed:** collaboration correctness depends on server-owned boundaries; tests should keep proving authority at PartyKit, not client assumptions.
4. **Suggested approach:** keep durable Yjs as a separate future PR if metrics/conflicts justify it.
5. **Defer on purpose:** local IndexedDB cache, hidden-tab disconnect, and follow/scroll presence until their revisit triggers fire.
