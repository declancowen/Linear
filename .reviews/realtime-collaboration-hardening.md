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
| **Last reviewed** | `2026-04-27 09:35:20 BST` |
| **Total turns** | `2` |
| **Open findings** | `0` |
| **Resolved findings** | `2` |
| **Accepted findings** | `0` |

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
