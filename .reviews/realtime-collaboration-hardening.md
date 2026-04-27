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
| **Last reviewed** | `2026-04-27 11:49:14 BST` |
| **Total turns** | `10` |
| **Open findings** | `0` |
| **Resolved findings** | `15` |
| **Accepted findings** | `0` |

## Turn 10 — 2026-04-27 11:49:14 BST

| Field | Value |
|-------|-------|
| **Commit** | `4361ca7a` |
| **IDE / Agent** | `Codex` |

**Summary:** Imported the latest external review finding. One live issue was fixed: refresh token signing happened before the best-effort helper's `try` boundary, so missing `COLLABORATION_TOKEN_SECRET` could reject the helper and convert successful document/work-item writes into route failures after commit.
**Outcome:** all clear for current actionable findings.
**Risk score:** high — this is a post-commit partial-failure path in user-facing mutation routes.
**Change archetypes:** partial-failure containment, integration misconfiguration, best-effort notification contract, route latency/error isolation.
**Intended change:** make every refresh-notification setup and delivery failure non-fatal to the caller after canonical Convex state has already committed.
**Intent vs actual:** `notifyCollaborationDocumentChangedServer` now wraps token creation, abort setup, and fetch delivery inside its non-fatal error boundary. Missing token secret returns `{ ok: false, reason }` and skips fetch, matching missing service URL and timeout behavior.
**Confidence:** high for the reported issue; the helper has a direct regression test and the route callers already treat non-ok helper results as warnings.
**Coverage note:** reviewed refresh helper, token creation error source, document PATCH/DELETE, item description PATCH, work item DELETE notification callers, and prior timeout behavior.
**Finding triage:** RCH-015 was live and fixed. Other pasted notes remain already fixed, stale, intentional, or non-blocking observations from Turns 7-9.
**Bug classes / invariants checked:** best-effort external notification containment, post-commit route response safety, missing secret misconfiguration, timeout cleanup, fetch suppression on setup failure.
**Branch totality:** re-reviewed the collaboration refresh helper in context of all current API callers and prior refresh-related findings.
**Sibling closure:** all current refresh notification callers share this helper, so document route, item description route, and work-item deletion notifications inherit the non-fatal token-signing behavior.
**Remediation impact surface:** `lib/server/collaboration-refresh.ts` and `tests/lib/server/collaboration-refresh.test.ts`.
**Residual risk / unknowns:** none beyond operational warning visibility; a missing secret means active rooms will not be notified, but canonical data remains correct and routes do not fail after commit.

### External finding import

| Source | Finding | Status | Bug class | Missed invariant / variant | Action |
|---|---|---|---|---|---|
| User / external review | Missing `COLLABORATION_TOKEN_SECRET` rejects refresh helper after canonical write commits | Resolved | post-commit partial-failure containment | Best-effort notification setup failures must return `{ ok:false }`, not throw | Wrapped token creation in helper error boundary; added missing-secret regression test |

### Validation

- `pnpm exec prettier --write lib/server/collaboration-refresh.ts tests/lib/server/collaboration-refresh.test.ts` — passed.
- `pnpm exec vitest run tests/lib/server/collaboration-refresh.test.ts` — passed, `1` file / `3` tests.
- `pnpm exec eslint $(git diff --name-only origin/main -- '*.ts' '*.tsx') --max-warnings 0` — passed for changed TypeScript/TSX files.
- `pnpm typecheck` — passed.
- `pnpm exec vitest run tests/services/partykit-server.test.ts tests/app/api/document-workspace-route-contracts.test.ts tests/lib/server/collaboration-refresh.test.ts tests/hooks/use-document-collaboration.test.tsx tests/components/document-detail-screen.test.tsx tests/components/work-item-detail-screen.test.tsx tests/lib/collaboration-partykit-adapter.test.ts tests/app/api/document-collaboration-route-contracts.test.ts tests/lib/collaboration-client-session.test.ts tests/lib/collaboration-foundation.test.ts tests/lib/server/collaboration-token.test.ts tests/lib/collaboration-config.test.ts tests/app/api/work-route-contracts.test.ts` — passed, `13` files / `154` tests.
- `git diff --check` — passed.

### Branch-totality proof

- **Non-delta files/systems re-read:** refresh helper, token signing helper, document and work-item API notification callers, refresh timeout tests, prior review turns.
- **Prior open findings rechecked:** none open.
- **Prior resolved/adjacent areas revalidated:** RCH-010 refresh timeout remains intact; RCH-011 body-only document refresh remains intact; RCH-012 clean-room callback guard remains intact.
- **Hotspots or sibling paths revisited:** missing service URL, missing token secret, fetch timeout, non-ok PartyKit response, route warning behavior.
- **Dependency/adjacent surfaces revalidated:** `createSignedCollaborationToken` error behavior, `resolveCollaborationServiceUrl`, `resolveCollaborationRefreshTimeoutMs`, shared caller handling.
- **Why this is enough:** the helper is the single boundary used by all current refresh notification routes, and the new test proves the exact setup-failure variant no longer escapes.

### Challenger pass

- `done` — Assumed another setup step could still throw outside the helper boundary. `createDocumentCollaborationRoomId`, token signing, abort setup, URL creation, fetch, response parsing, and timeout cleanup are now inside the non-fatal path after service URL resolution.

### Resolved / Carried / New findings

#### RCH-015 [P1] Treat refresh token-signing failures as non-fatal notification failures

**Status:** Resolved.

**Issue:** `createSignedCollaborationToken` could throw before `notifyCollaborationDocumentChangedServer` entered its `try` block, causing route callers to fail after canonical writes had already committed.

**Fix:** The helper now catches token-signing/setup failures and returns `{ ok: false }`. Tests cover missing token secret and assert no fetch is attempted.

### Recommendations

1. **Fix first:** none open.
2. **Then address:** keep monitoring refresh warning logs after deploy for missing secret or timeout reasons.
3. **Patterns noticed:** best-effort helpers need their entire setup path inside the non-fatal boundary, not only the external `fetch`.
4. **Suggested approach:** for future post-commit side effects, test missing configuration before testing network failure.
5. **Defer on purpose:** no background retry queue in this PR.

## Turn 9 — 2026-04-27 11:39:46 BST

| Field | Value |
|-------|-------|
| **Commit** | `1a4cf0fc` |
| **IDE / Agent** | `Codex` |

**Summary:** Imported the latest external review batch. Three live issues were fixed: server-applied canonical refreshes could trigger periodic persistence in viewer-only rooms, room mismatch errors returned 500 instead of 401 and bypassed fresh-bootstrap retry, and teardown fallback skipped when only viewers remained.
**Outcome:** all clear for current actionable findings.
**Risk score:** high — the fixes touch active-room persistence authority, error/status contract recovery, and last-editor teardown safety.
**Change archetypes:** server-applied update suppression, auth/retry status contract, viewer/editor role separation, dead-code cleanup, realtime lifecycle.
**Intended change:** prevent server-owned refresh reconciliation from being treated as user-authored dirty state, keep room mismatch recoverable, and preserve last-editor teardown when remaining connections are read-only.
**Intent vs actual:** the PartyKit periodic persist callback now no-ops for clean rooms, including server-applied refreshes that are immediately marked canonical; `collaboration_room_mismatch` maps to 401/4401; teardown skip logic now counts only other editors; the unused duplicate response helper was removed.
**Confidence:** high for the reported issues; targeted unit coverage now exercises viewer-only refresh callback, structured room-mismatch retry, and viewer-only teardown.
**Coverage note:** reviewed PartyKit session state, refresh handler, Yjs dirty/canonical metadata, periodic callback, manual teardown flush, shared collaboration error status/close mapping, and adapter retry behavior.
**Finding triage:** RCH-012 through RCH-014 were live and fixed. The pasted TOCTOU and premature `connect_accepted` findings are stale in the current tree; timing-safe compare, legacy rollout bypass, Convex casts, lossy close-code reverse mapping, ref timing, bounded fire-and-forget refresh, and Strict Mode notes remain intentional/non-blocking observations.
**Bug classes / invariants checked:** server-authored vs user-authored Yjs updates, clean-room persistence no-op, viewer/editor role split, structured retry status parity, teardown fallback data preservation.
**Branch totality:** re-reviewed the current branch against the realtime collaboration hotspots and prior resolved findings, not just the latest line references.
**Sibling closure:** active refresh, ensure-seed server updates, periodic callback, manual teardown, manual flush room mismatch, websocket close code mapping, and adapter retry paths were checked together.
**Remediation impact surface:** `services/partykit/server.ts`, `lib/collaboration/errors.ts`, `services/partykit/collaboration/errors.ts`, PartyKit server tests, adapter tests, and foundation tests.
**Residual risk / unknowns:** hosted two-client smoke remains useful for provider timing, but the code-level lifecycle variants now have direct regression coverage.

### External finding import

| Source | Finding | Status | Bug class | Missed invariant / variant | Action |
|---|---|---|---|---|---|
| User / external review | Server-applied canonical refresh update can trigger persist and close viewer-only rooms | Resolved | server-authored update suppression | Clean/server-applied Yjs updates must not require editor claims or persist | Periodic callback skips clean rooms; added viewer-only refresh callback regression test |
| User / external review | `collaboration_room_mismatch` returns 500 but retry expects 401 | Resolved | error/status contract mismatch | Retryable auth recovery codes must use retryable auth status | Mapped room mismatch to 401/4401; adapter test now covers structured room mismatch retry |
| User / external review | Teardown skip counts viewers as other editors | Resolved | role-specific connection variant | Last-editor teardown should skip only when another editor remains | Count only editor connections; added viewer-only teardown persist test |
| User / external review | Duplicate exported PartyKit JSON response helper unused | Resolved | dead code / boundary confusion | One response helper should own PartyKit error JSON shape | Removed unused exported helper |
| User / external review | Canonical refresh TOCTOU | Stale / already fixed | async destructive replacement | Dirty/update version is checked after async fetch | Revalidated existing post-fetch guard and test |
| User / external review | Premature `connect_accepted` | Stale / already fixed | observability atomicity | Accepted/rejected events are terminal and mutually exclusive | Revalidated current accepted event placement after provider handoff |

### Validation

- `pnpm exec prettier --write services/partykit/server.ts services/partykit/collaboration/errors.ts lib/collaboration/errors.ts tests/services/partykit-server.test.ts tests/lib/collaboration-foundation.test.ts tests/lib/collaboration-partykit-adapter.test.ts` — passed.
- `pnpm exec vitest run tests/services/partykit-server.test.ts tests/lib/collaboration-foundation.test.ts tests/lib/collaboration-partykit-adapter.test.ts` — passed, `3` files / `66` tests.
- `pnpm exec eslint $(git diff --name-only origin/main -- '*.ts' '*.tsx') --max-warnings 0` — passed for changed TypeScript/TSX files.
- `pnpm typecheck` — passed.
- `pnpm exec vitest run tests/services/partykit-server.test.ts tests/app/api/document-workspace-route-contracts.test.ts tests/lib/server/collaboration-refresh.test.ts tests/hooks/use-document-collaboration.test.tsx tests/components/document-detail-screen.test.tsx tests/components/work-item-detail-screen.test.tsx tests/lib/collaboration-partykit-adapter.test.ts tests/app/api/document-collaboration-route-contracts.test.ts tests/lib/collaboration-client-session.test.ts tests/lib/collaboration-foundation.test.ts tests/lib/server/collaboration-token.test.ts tests/lib/collaboration-config.test.ts tests/app/api/work-route-contracts.test.ts` — passed, `13` files / `153` tests.
- `git diff --check` — passed.

### Branch-totality proof

- **Non-delta files/systems re-read:** PartyKit server refresh/callback/teardown paths, shared collaboration errors, adapter flush retry path, PartyKit error helper module, prior Turn 8 route fix.
- **Prior open findings rechecked:** none open.
- **Prior resolved/adjacent areas revalidated:** RCH-007 through RCH-011 remain resolved; the clean-room callback guard does not weaken dirty-room conflict handling or manual flush authority.
- **Hotspots or sibling paths revisited:** server-applied canonical refresh, ensure-seeded canonical writes, periodic persistence, last-close persistence, teardown fallback, room mismatch flush retry, viewer/editor admission.
- **Dependency/adjacent surfaces revalidated:** Yjs dirty metadata, latest editor claims, close-code/status mapping, adapter structured JSON parsing, stale TOCTOU guard, connect telemetry placement.
- **Why this is enough:** each live finding is now fixed at the owning boundary and has a regression test for the exact weak role/status/lifecycle variant.

### Challenger pass

- `done` — Assumed server-authored Yjs writes could still persist through a sibling path. Checked `ensureCanonicalDocumentSeeded`, `handleRefreshRequest`, periodic callback, manual teardown, and last-close persistence. Clean rooms now no-op in the periodic callback; dirty editor-authored rooms still persist.

### Resolved / Carried / New findings

#### RCH-012 [P1] Skip periodic persistence for clean server-applied refresh updates

**Status:** Resolved.

**Issue:** `replaceCollaborationDocFromJson` during canonical refresh emits a Yjs update, which could trigger the periodic callback. In viewer-only rooms there are no editor claims, so persistence failed and closed viewers.

**Fix:** The periodic callback now returns immediately when room metadata is clean. Server-applied refresh marks the room canonical after replacement, so the callback does not require editor claims or close sockets.

#### RCH-013 [P2] Make room mismatch retryable through the auth recovery path

**Status:** Resolved.

**Issue:** `collaboration_room_mismatch` fell through to HTTP 500, while the adapter retries with fresh bootstrap only for 401 auth-style failures.

**Fix:** Room mismatch now maps to HTTP 401 and close code 4401. Adapter coverage now uses a structured room-mismatch response.

#### RCH-014 [P2] Skip teardown fallback only when another editor remains

**Status:** Resolved.

**Issue:** Teardown fallback counted viewers as active editors, so last-editor teardown could be skipped when only read-only participants remained.

**Fix:** The skip check counts only other editor connections. Viewer-only remaining rooms now accept the last editor's teardown persist.

### Recommendations

1. **Fix first:** none open.
2. **Then address:** run hosted PartyKit smoke with one editor and one viewer after deployment.
3. **Patterns noticed:** every realtime side effect needs role-aware and source-aware classification: editor vs viewer, client edit vs server reconciliation, body vs metadata.
4. **Suggested approach:** keep adding regression tests around role/source variants whenever touching `handleRefreshRequest`, callback persistence, or flush teardown.
5. **Defer on purpose:** no durable Yjs migration or metadata-only refresh protocol in this PR.

## Turn 8 — 2026-04-27 11:26:32 BST

| Field | Value |
|-------|-------|
| **Commit** | `72e8622d` |
| **IDE / Agent** | `Codex` |

**Summary:** Imported the latest external review finding. One live issue was found and fixed: document title-only PATCH requests emitted `canonical-updated`, which PartyKit treats as a body-content refresh and can close dirty active rooms with `collaboration_conflict_reload_required`.
**Outcome:** all clear for current actionable findings.
**Risk score:** high — route-level metadata writes were crossing into the active-room body reconciliation protocol.
**Change archetypes:** realtime protocol boundary, metadata/body authority split, active-room lifecycle, route contract regression.
**Intended change:** keep `canonical-updated` limited to canonical body changes and avoid disconnecting active editors for title-only document updates.
**Intent vs actual:** document PATCH now notifies PartyKit only when `parsed.content !== undefined`; title-only updates still persist and bump read models, but do not trigger body reconciliation. Body updates still send `canonical-updated`.
**Confidence:** high for the reported issue; the route tests now cover both title-only and body-update variants, and the collaboration targeted suite passed.
**Coverage note:** reviewed document PATCH, PartyKit `canonical-updated` dirty-room handling, item-description PATCH, document DELETE, work-item DELETE notification fan-out, and the prior refresh timeout helper.
**Finding triage:** RCH-011 was live and fixed. The rest of the latest pasted notes remain already fixed, intentional, or non-blocking observations from Turn 7.
**Bug classes / invariants checked:** metadata/body authority separation, destructive refresh conflict avoidance, PATCH variant matrix (`title`, `content`, delete), sibling route notification semantics.
**Branch totality:** re-reviewed current branch state against `origin/main` and the realtime collaboration hotspots, not only the patched route.
**Sibling closure:** item-description PATCH always changes body content, so it still sends `canonical-updated`; document DELETE still sends `document-deleted`; work-item DELETE still notifies deleted description rooms in parallel.
**Remediation impact surface:** `app/api/documents/[documentId]/route.ts` and `tests/app/api/document-workspace-route-contracts.test.ts`.
**Residual risk / unknowns:** if future title changes need live-room metadata propagation, add a metadata-only refresh kind instead of overloading `canonical-updated`.

### External finding import

| Source | Finding | Status | Bug class | Missed invariant / variant | Action |
|---|---|---|---|---|---|
| User / external review | Title-only document PATCH emits `canonical-updated` and can close dirty active rooms | Resolved | metadata/body authority split | Body reconciliation signals must not be emitted for metadata-only writes | Gate refresh notification on `parsed.content !== undefined`; added title-only/body-update route tests |

### Validation

- `pnpm exec prettier --write 'app/api/documents/[documentId]/route.ts' tests/app/api/document-workspace-route-contracts.test.ts` — passed.
- `pnpm exec vitest run tests/app/api/document-workspace-route-contracts.test.ts` — passed, `1` file / `15` tests.
- `pnpm exec eslint $(git diff --name-only origin/main -- '*.ts' '*.tsx') --max-warnings 0` — passed for changed TypeScript/TSX files.
- `pnpm typecheck` — passed.
- `pnpm exec vitest run tests/services/partykit-server.test.ts tests/app/api/document-workspace-route-contracts.test.ts tests/lib/server/collaboration-refresh.test.ts tests/hooks/use-document-collaboration.test.tsx tests/components/document-detail-screen.test.tsx tests/components/work-item-detail-screen.test.tsx tests/lib/collaboration-partykit-adapter.test.ts tests/app/api/document-collaboration-route-contracts.test.ts tests/lib/collaboration-client-session.test.ts tests/lib/collaboration-foundation.test.ts tests/lib/server/collaboration-token.test.ts tests/lib/collaboration-config.test.ts tests/app/api/work-route-contracts.test.ts` — passed, `13` files / `150` tests.
- `git diff --check` — passed.

### Branch-totality proof

- **Non-delta files/systems re-read:** document PATCH/DELETE route, PartyKit refresh handler, collaboration refresh helper, item-description PATCH route, work-item DELETE notification path, Turn 7 review notes.
- **Prior open findings rechecked:** none open.
- **Prior resolved/adjacent areas revalidated:** RCH-007 through RCH-010 remain resolved; the new route guard does not alter server-owned active flush or refresh timeout behavior.
- **Hotspots or sibling paths revisited:** canonical content refresh, metadata-only document rename, document delete close path, item description body update, dirty active-room conflict handling.
- **Dependency/adjacent surfaces revalidated:** read-model bump still happens for title-only updates, route response remains successful when no PartyKit notification is needed, body updates still notify active rooms.
- **Why this is enough:** the bug was a route authority-classification issue, and the fix is at the route boundary that has the parsed payload variant information.

### Challenger pass

- `done` — Assumed the same class might exist in sibling routes. Item-description PATCH cannot be metadata-only, document DELETE uses a distinct delete kind, and work-item DELETE notification only targets deleted description documents. No sibling route needed the same guard.

### Resolved / Carried / New findings

#### RCH-011 [P2] Limit document PATCH canonical refresh to body-content updates

**Status:** Resolved.

**Issue:** Title-only document updates sent `canonical-updated`, causing PartyKit to treat metadata edits as canonical body refreshes and potentially close dirty rooms unnecessarily.

**Fix:** Document PATCH now sends `canonical-updated` only when the request includes `content`. Tests cover no refresh for title-only updates and refresh for body updates.

### Recommendations

1. **Fix first:** none open.
2. **Then address:** if live title propagation becomes necessary, add a metadata-only refresh kind rather than overloading `canonical-updated`.
3. **Patterns noticed:** refresh kinds must remain authority-specific; broad names like `updated` are too easy to misuse across body and metadata changes.
4. **Suggested approach:** keep route tests for each PATCH variant whenever a route fans out to realtime side effects.
5. **Defer on purpose:** no metadata refresh protocol in this PR.

## Turn 7 — 2026-04-27 11:14:29 BST

| Field | Value |
|-------|-------|
| **Commit** | `a1658974` |
| **IDE / Agent** | `Codex` |

**Summary:** Imported the latest external review batch and rechecked the current tree with diff-review and architecture standards. No new blocking collaboration issue remains. I applied three cheap hardening cleanups from non-blocking notes: collaboration error response guards now reject unknown codes, the PartyKit adapter no longer double-normalizes refreshed bootstrap payloads, and document content refs are no longer assigned during render.
**Outcome:** all clear for current actionable findings.
**Risk score:** high — this branch still covers realtime protocol, auth, active-room reconciliation, async notification failure modes, and client lifecycle behavior.
**Change archetypes:** protocol guard, client adapter simplification, React lifecycle cleanup, review hardening.
**Intended change:** close out the latest review notes without changing collaboration authority semantics or introducing another lifecycle/compatibility variant.
**Intent vs actual:** the runtime semantics remain unchanged except for stricter client-side error response validation; the other two changes remove maintainability footguns while preserving current behavior.
**Confidence:** high for the latest pasted notes and cleanup set; the same targeted collaboration suite, typecheck, changed-file lint, and diff whitespace checks passed after the changes.
**Coverage note:** reviewed the pasted current-tree notes, shared collaboration errors, PartyKit adapter bootstrap refresh, document detail content-ref lifecycle, and the prior Turn 5/6 resolved hotspots.
**Finding triage:** no live High/Medium issue remained. WebSocket close-code propagation, flush version params, canonical refresh TOCTOU, connect metrics, malformed request classification, duplicate sync modal, and refresh timeout findings are already fixed in the current branch. Timing-safe compare, legacy schema flag behavior, Convex wrapper casts, fire-and-forget refresh semantics, and work-item preview eligibility remain intentional/accepted observations.
**Bug classes / invariants checked:** structured error code validity, stale-client recovery, destructive refresh post-await preservation, bounded best-effort notification latency, React render/effect lifecycle, adapter bootstrap identity preservation.
**Branch totality:** re-reviewed current branch state against `origin/main`, not only the four cleanup files.
**Sibling closure:** the collaboration error guard is shared by adapter/hook consumers; the adapter cleanup is confined to refresh bootstrap normalization; document body and work-item body collaboration preview paths were checked via targeted component/hook tests.
**Remediation impact surface:** `lib/collaboration/errors.ts`, `lib/collaboration/adapters/partykit.ts`, `components/app/screens/document-detail-screen.tsx`, and foundation tests.
**Residual risk / unknowns:** hosted two-browser PartyKit smoke remains the only useful residual check after deploy; no unresolved code-level finding blocks the PR.

### External finding import

| Source | Finding | Status | Bug class | Missed invariant / variant | Action |
|---|---|---|---|---|---|
| User / external review | `isCollaborationErrorResponse` accepts arbitrary string codes | Hardened | protocol guard / type narrowing | Structured recovery should only accept known collaboration codes | Added known-code validation and regression test |
| User / external review | Redundant `normalizeBootstrap` call | Hardened | maintainability / adapter simplification | Bootstrap refresh should have one normalization boundary | Removed redundant inner normalization |
| User / external review | Ref assignment during render in document detail | Hardened | React lifecycle / render side effect | Refs used by effects should be updated after commit where easy | Moved latest document content ref update into an effect |
| User / external review | Timing-safe compare length branch | Intentional | crypto implementation detail | HMAC expected length is fixed/public and no secret is leaked by length mismatch | No code change |
| User / external review | Legacy schema flag bypass behavior | Intentional | deploy compatibility | Legacy bypass must apply only to fully missing params, not partial version evidence | No code change |
| User / external review | Convex wrapper return casts | Intentional / compatibility | generated client contract | Wrapper remains backward-compatible with older Convex deployments | No code change |
| User / external review | Fire-and-forget refresh notifications | Already bounded | async partial failure | Best-effort notification must not stall route responses indefinitely | Turn 6 added timeout and tests |
| User / external review | WebSocket close reasons may not map to structured errors | Already fixed | recovery propagation | Recovery code must survive HTTP and websocket variants | Turn 5 added close-code/code-string mapping and tests |
| User / external review | Flush requests skip required client version params | Already fixed | stale-client bypass | HTTP flush must require version params when using document flush path | Current tree uses `requireClientVersionParams: isFlushRequest` and tests cover it |

### Validation

- `pnpm exec prettier --write components/app/screens/document-detail-screen.tsx lib/collaboration/errors.ts lib/collaboration/adapters/partykit.ts tests/lib/collaboration-foundation.test.ts` — passed.
- `pnpm exec eslint $(git diff --name-only origin/main -- '*.ts' '*.tsx') --max-warnings 0` — passed for changed TypeScript/TSX files.
- `pnpm typecheck` — passed.
- `pnpm exec vitest run tests/services/partykit-server.test.ts tests/hooks/use-document-collaboration.test.tsx tests/components/document-detail-screen.test.tsx tests/components/work-item-detail-screen.test.tsx tests/lib/collaboration-partykit-adapter.test.ts tests/app/api/document-collaboration-route-contracts.test.ts tests/lib/collaboration-client-session.test.ts tests/lib/collaboration-foundation.test.ts tests/lib/server/collaboration-token.test.ts tests/lib/server/collaboration-refresh.test.ts tests/lib/collaboration-config.test.ts tests/app/api/work-route-contracts.test.ts tests/app/api/document-workspace-route-contracts.test.ts` — passed, `13` files / `148` tests.
- `git diff --check` — passed.

### Branch-totality proof

- **Non-delta files/systems re-read:** latest pasted external notes, current review history, diff-review gates, architecture review checklist, collaboration errors/protocol, PartyKit adapter refresh path, document detail sync lifecycle.
- **Prior open findings rechecked:** none open.
- **Prior resolved/adjacent areas revalidated:** RCH-001 through RCH-010 remain resolved in current tree.
- **Hotspots or sibling paths revisited:** stale-client websocket/flush compatibility, active-room destructive refresh guard, server-owned active flush, bounded app-to-PartyKit refresh notification, one-shot sync modal/session lifecycle.
- **Dependency/adjacent surfaces revalidated:** shared error guard, close-code mapping consumers, adapter bootstrap identity assertion, document detail editor reset effect, collaboration targeted test suite.
- **Why this is enough:** the latest notes were either already fixed, intentional, or local hardening opportunities; each applied cleanup has a direct test or existing behavior-preserving validation path.

### Challenger pass

- `done` — Assumed one latest note was still a live blocker despite being classified as observational. Rechecked websocket close mapping, flush URL version requirements, canonical refresh post-await guard, refresh timeout behavior, and document/work-item initial sync lifecycle. No new live High/Medium issue found.

### Recommendations

1. **Fix first:** none open.
2. **Then address:** run a hosted two-client PartyKit smoke after deploy.
3. **Patterns noticed:** repeated external notes are now mostly stale/intentional; keep requiring current-tree triage before changing code.
4. **Suggested approach:** keep collaboration recovery logic centralized in shared protocol/error modules and treat adapter/server divergence as a review hotspot.
5. **Defer on purpose:** broader repo-wide lint debt and generated Convex return typing improvements remain outside this PR.

## Turn 6 — 2026-04-27 11:03:44 BST

| Field | Value |
|-------|-------|
| **Commit** | `a1978af7` |
| **IDE / Agent** | `Codex` |

**Summary:** Imported the latest external review batch. One live issue was found and fixed: app-side collaboration refresh notifications were best-effort semantically but could still stall document/work-item mutation responses because the awaited PartyKit `fetch` had no timeout.
**Outcome:** all clear for current actionable findings.
**Risk score:** high — this touches mutation response latency after canonical Convex commits and active-room reconciliation notification delivery.
**Change archetypes:** async integration, partial-failure containment, config contract, route latency, operability.
**Intended change:** ensure refresh notification failure cannot block user-facing PATCH/DELETE responses indefinitely after canonical data has already been committed.
**Intent vs actual:** `notifyCollaborationDocumentChangedServer` now uses an app-owned bounded timeout with `AbortController`; timeout configuration is centralized in collaboration config and documented in env/runbook/protocol docs.
**Confidence:** high for the reported issue; the helper has direct abort/timeout tests and all existing collaboration route/helper suites passed.
**Coverage note:** reviewed the refresh helper, document PATCH/DELETE, item description PATCH, work item DELETE notification callers, config docs, and prior external findings.
**Finding triage:** RCH-010 was live and fixed. The rest of the pasted items were already classified in Turn 5 as intentional/stale/observational or remain non-blocking notes.
**Bug classes / invariants checked:** best-effort async containment, bounded external dependency latency, config fallback safety, canonical mutation independence.
**Branch totality:** re-ran diff and architecture preflight on the current branch and rechecked the prior realtime collaboration hotspots.
**Sibling closure:** all three call sites use the same helper, so the timeout applies to document route refresh, item description refresh, and deleted work-item description room notifications.
**Remediation impact surface:** `lib/collaboration/config.ts`, `lib/server/collaboration-refresh.ts`, `.env.example`, protocol/runbook docs, config and refresh helper tests.
**Residual risk / unknowns:** timeout value may need tuning in production, but the env override gives operations a safe adjustment point without code changes.

### External finding import

| Source | Finding | Status | Bug class | Missed invariant / variant | Action |
|---|---|---|---|---|---|
| User / external review | App routes await PartyKit refresh notification fetches with no timeout | Resolved | async partial-failure containment | Best-effort notification must not introduce unbounded route latency after canonical commit | Added `COLLABORATION_REFRESH_TIMEOUT_MS`, aborting fetch, docs, and regression tests |

### Validation

- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh` — completed against PR `#26`, branch `realtime-collab-hardening`, base `origin/main`.
- `/Users/declancowen/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — completed on `HEAD a1978af7`.
- `pnpm exec vitest run tests/lib/collaboration-config.test.ts tests/lib/server/collaboration-refresh.test.ts` — passed, `2` files / `6` tests.
- `pnpm exec eslint $(git diff --name-only origin/main -- '*.ts' '*.tsx') --max-warnings 0` — passed for changed TypeScript/TSX files.
- `pnpm typecheck` — passed.
- `pnpm exec vitest run tests/services/partykit-server.test.ts tests/hooks/use-document-collaboration.test.tsx tests/components/document-detail-screen.test.tsx tests/components/work-item-detail-screen.test.tsx tests/lib/collaboration-partykit-adapter.test.ts tests/app/api/document-collaboration-route-contracts.test.ts tests/lib/collaboration-client-session.test.ts tests/lib/collaboration-foundation.test.ts tests/lib/server/collaboration-token.test.ts tests/lib/server/collaboration-refresh.test.ts tests/lib/collaboration-config.test.ts tests/app/api/work-route-contracts.test.ts tests/app/api/document-workspace-route-contracts.test.ts` — passed, `13` files / `147` tests.
- `git diff --check` — passed.

### Branch-totality proof

- **Non-delta files/systems re-read:** app route notification callers, collaboration config, refresh helper, protocol docs, runbook docs, review history.
- **Prior open findings rechecked:** none open.
- **Prior resolved/adjacent areas revalidated:** RCH-007 through RCH-009 remain resolved; refresh is still fire-and-forget in effect, but now bounded while awaited.
- **Hotspots or sibling paths revisited:** document update/delete, work item description update, work item delete cascade, PartyKit refresh endpoint auth, canonical source-of-truth decision.
- **Dependency/adjacent surfaces revalidated:** env fallback behavior, abort signal propagation, route warning behavior after failed refresh, timeout reason returned to existing logs.
- **Why this is enough:** the single helper is the only path all current refresh notifications use, and the new timeout test proves the exact hanging variant cannot remain unbounded.

### Challenger pass

- `done` — Assumed a timeout could become another silent failure. Verified callers already log non-ok refresh results and canonical Convex writes/read-model bumps are completed before the bounded refresh wait.

### Resolved / Carried / New findings

#### RCH-010 [P1] Bound app-to-PartyKit refresh notification fetches

**Status:** Resolved.

**Issue:** Refresh notifications were best-effort logically but still used an awaited `fetch` without timeout, so slow/unreachable PartyKit could stall user-facing mutation responses after Convex had already committed.

**Fix:** Added `COLLABORATION_REFRESH_TIMEOUT_MS` with default `1500`, passed an `AbortSignal` to the refresh `fetch`, and returns a structured failure reason on timeout. Existing callers keep warning and returning success for the canonical mutation.

### Recommendations

1. **Fix first:** none open.
2. **Then address:** monitor refresh timeout warnings after deploy; tune `COLLABORATION_REFRESH_TIMEOUT_MS` if hosted PartyKit p95 needs more room.
3. **Patterns noticed:** every best-effort external notification should have a bounded latency budget, even when failures are swallowed.
4. **Suggested approach:** if refresh failures become common, decouple delivery into a background/job path rather than increasing route latency indefinitely.
5. **Defer on purpose:** no broader refresh queue/retry mechanism in this PR.

## Turn 5 — 2026-04-27 10:43:41 BST

| Field | Value |
|-------|-------|
| **Commit** | `fac413bf` |
| **IDE / Agent** | `Codex` |

**Summary:** Imported the latest external review set and re-ran the collaboration diff review with architecture standards. Three live issues were fixed: `connect_accepted` was emitted before full admission/provider handoff, websocket plain-string close reasons were not mapped into structured client status, and malformed request payload/token parse failures could fall through as `collaboration_unknown` 5xx errors.
**Outcome:** all clear for current actionable collaboration findings.
**Risk score:** high — the changed paths affect realtime admission metrics, schema/protocol recovery, auth/payload classification, and active-room data preservation.
**Change archetypes:** observability contract, protocol/error taxonomy, auth/input validation, browser transport adapter, lifecycle/async authority.
**Intended change:** keep the hardening architecture intact while closing new externally reported bypasses/misclassification paths.
**Intent vs actual:** accepted telemetry now fires only after full room admission and y-partykit provider handoff; close-code/reason handling is centralized in shared collaboration errors; malformed auth/request bodies are mapped to 401/422 structured collaboration responses.
**Confidence:** high for the reported collaboration issues; medium for repo-wide lint only because `pnpm lint` still reports existing `origin/main` lint debt outside the changed-file set.
**Coverage note:** reviewed current-tree PartyKit `onBeforeConnect`/`onConnect`, request auth/parse/error mapping, close-code helpers, client adapter `connection-error` parsing, canonical refresh TOCTOU guard, docs, and regression tests.
**Finding triage:** RCH-007 through RCH-009 were live and fixed; the pasted canonical-refresh TOCTOU finding is stale because Turn 3 already added the post-fetch `dirty`/`updateVersion` guard and regression test.
**Bug classes / invariants checked:** observability event atomicity, stale-client recovery propagation, malformed input classification, destructive-refresh post-await preservation, sibling websocket/HTTP error parity.
**Branch totality:** current working tree was reviewed against `origin/main`; prior hotspots and Turn 3/4 resolved findings were rechecked, not just the latest pasted lines.
**Sibling closure:** websocket close reason and numeric close-code variants are both tested; flush and refresh malformed JSON variants are both tested; malformed token signature variant is tested; admission rejection is tested after successful token preflight.
**Remediation impact surface:** shared collaboration error code module, PartyKit auth/request/errors/server modules, client PartyKit adapter, protocol/rollout docs, and server/adapter tests.
**Residual risk / unknowns:** hosted multi-client worker smoke remains useful, but no unresolved High/Medium code finding remains in the reviewed collaboration branch.

### External finding import

| Source | Finding | Status | Bug class | Missed invariant / variant | Action |
|---|---|---|---|---|---|
| User / external review | `connect_accepted` emitted before admission and could double-count failed attempts | Resolved | observability atomicity | Accepted/rejected metrics must be mutually exclusive terminal outcomes | Moved `connect_accepted` to successful chat setup and successful document provider handoff; added rejection regression test |
| User / external review | `canonical-updated` dirty check before async fetch could overwrite edits | Stale / already fixed | TOCTOU / destructive async preservation | Dirty/version must be rechecked after every `await` before replacement | Revalidated existing `updateVersion` guard and test from Turn 3 |
| User / external review | Plain websocket close reasons were not parsed by the adapter | Resolved | protocol recovery propagation | Structured recovery must survive both HTTP JSON errors and websocket close events | Added close-code/code-string mapping and adapter tests for reason string and code-only events |
| User / external review | Malformed token/JSON inputs mapped to `collaboration_unknown` 500 | Resolved | malformed input classification | Client/auth parse failures must be 4xx structured errors, not 5xx operational failures | Added `collaboration_invalid_payload`, token decode guards, parse guards, and 401/422 tests |
| User / external review | Flush path allegedly skips required version params | Stale / already fixed | stale-client compatibility | HTTP flush needs the same version evidence as websocket admission | Current tree uses `requireClientVersionParams: isFlushRequest`; existing tests cover missing/stale flush params |
| User / external review | Timing-safe compare length branch | Intentional | crypto implementation detail | HMAC length is public/fixed and length mismatch gives no secret | No change |
| User / external review | Refresh notifications are fire-and-forget | Intentional | partial-failure semantics | Canonical Convex update should not fail because active-room notification failed | No change |

### Validation

- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh` — completed against PR `#26`, branch `realtime-collab-hardening`, base `origin/main`.
- `/Users/declancowen/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — completed on `HEAD fac413bf`.
- `pnpm exec vitest run tests/services/partykit-server.test.ts tests/lib/collaboration-partykit-adapter.test.ts` — passed, `2` files / `56` tests.
- `pnpm typecheck` — passed.
- `pnpm exec eslint $(git diff --name-only origin/main -- '*.ts' '*.tsx') --max-warnings 0` — passed for changed TypeScript/TSX files.
- `pnpm exec vitest run tests/services/partykit-server.test.ts tests/hooks/use-document-collaboration.test.tsx tests/components/document-detail-screen.test.tsx tests/components/work-item-detail-screen.test.tsx tests/lib/collaboration-partykit-adapter.test.ts tests/app/api/document-collaboration-route-contracts.test.ts tests/lib/collaboration-client-session.test.ts tests/lib/collaboration-foundation.test.ts tests/lib/server/collaboration-token.test.ts tests/app/api/work-route-contracts.test.ts tests/app/api/document-workspace-route-contracts.test.ts` — passed, `11` files / `141` tests.
- `git diff --check` — passed.
- `pnpm lint` — still fails on existing repo-wide lint issues outside this branch's changed-file set, including React compiler/ref warnings in unmodified `components/app/rich-text-editor.tsx`, `hooks/use-expiring-retained-value.ts`, and `hooks/use-retained-team-by-slug.ts`.

### Branch-totality proof

- **Non-delta files/systems re-read:** PartyKit server/auth/request/error modules, shared collaboration errors/protocol, client adapter, hook/document sync paths, protocol/rollout docs, previous review turns.
- **Prior open findings rechecked:** none open.
- **Prior resolved/adjacent areas revalidated:** RCH-003 TOCTOU guard, RCH-004 viewer/editor admission split, RCH-005 flush version params, and RCH-006 duplicate sync modal/session path remain resolved.
- **Hotspots or sibling paths revisited:** websocket connect telemetry, admission rejection, HTTP flush parse, internal refresh parse, malformed token decode, websocket close-code propagation, canonical refresh clean/dirty variants.
- **Dependency/adjacent surfaces revalidated:** shared close code mapping, adapter status emitter, hook reload-required handling, docs rollout metric denominator, changed-file lint.
- **Why this is enough:** each live external finding now has a guard at the owning boundary plus targeted regression coverage for the exact weak variant and at least one sibling variant.

### Challenger pass

- `done` — Assumed the new fixes could create another metrics/error mismatch. Checked accepted/rejected event exclusivity, malformed token versus malformed body status codes, close reason string versus numeric code paths, and stale TOCTOU line references against current code.

### Resolved / Carried / New findings

#### RCH-007 [P2] Emit `connect_accepted` only after admission and provider handoff

**Status:** Resolved.

**Issue:** A connection could emit `connect_accepted` during token preflight and later emit `connect_rejected` during admission/seed/provider failure, corrupting rollout failure-rate metrics.

**Fix:** `onBeforeConnect` now performs only auth preflight. `connect_accepted` is emitted after successful chat setup or successful document room admission, seeding, and `onConnect` provider handoff.

#### RCH-008 [P2] Preserve structured recovery for websocket close events

**Status:** Resolved.

**Issue:** HTTP collaboration errors were structured JSON, but websocket close events could arrive as plain collaboration-code strings or numeric close codes, which the adapter ignored.

**Fix:** Shared errors now expose code validation and close-code mapping. The adapter maps plain code strings and code-only close events into `CollaborationErrorResponse` before emitting status.

#### RCH-009 [P2] Classify malformed auth/request payloads as client errors

**Status:** Resolved.

**Issue:** Invalid base64/token decode and malformed flush/refresh JSON could fall through to `collaboration_unknown` with HTTP 500.

**Fix:** Token decode/schema parsing now preserves version errors but maps malformed tokens to `collaboration_unauthenticated`. Flush/refresh parsing throws `collaboration_invalid_payload` and returns structured HTTP 422.

### Recommendations

1. **Fix first:** none open.
2. **Then address:** run hosted two-client PartyKit smoke after deploy.
3. **Patterns noticed:** the strongest prevention artifact here is boundary-level tests for metrics, close-code propagation, and malformed input classification.
4. **Suggested approach:** keep all new collaboration recovery states in `lib/collaboration/errors.ts` first, then consume from server and adapter.
5. **Defer on purpose:** repo-wide lint debt outside this branch remains separate from the collaboration findings fixed here.

## Turn 4 — 2026-04-27 10:20:28 BST

| Field | Value |
|-------|-------|
| **Commit** | `e1132a12` |
| **IDE / Agent** | `Codex` |

**Summary:** Re-ran diff review with architecture standards against the pushed branch state. No new actionable findings found.
**Outcome:** all clear for the branch-level realtime collaboration hardening review.
**Risk score:** high — realtime collaboration authority, protocol compatibility, admission, async persistence, and UX lifecycle are shared production paths.
**Change archetypes:** contract, async ownership, auth/authorization, compatibility, source-of-truth, observability, lifecycle UX.
**Intended change:** keep Convex HTML as durable truth while making live PartyKit/Yjs room behavior safe, versioned, limited, observable, and refresh-aware.
**Intent vs actual:** current branch matches the intended architecture: protocol/limits/errors live in shared collaboration modules, server/PartyKit owns authority, active flush persists server-held room state, refresh replacement is guarded, and client UI lifecycle no longer reopens the same initial sync preview.
**Confidence:** high for targeted collaboration behavior; medium for whole-repo only because known unrelated full-suite baseline failures are outside this branch.
**Coverage note:** rechecked branch diff vs `origin/main`, PartyKit auth/admission/request/refresh paths, Next session/update/delete routes, client adapter/session hook, document and work-item detail sync modal gates, protocol docs, and review history.
**Finding triage:** no live findings.
**Bug classes / invariants checked:** TOCTOU destructive refresh, stale-client protocol bypass, role-specific capacity limits, server-owned persistence authority, internal refresh auth, Strict Mode duplicate side effects, one-shot modal lifecycle, teardown fallback safety.
**Branch totality:** current `HEAD`/`origin/realtime-collab-hardening` at `e1132a12` was reviewed against `origin/main`, not just the last patch.
**Sibling closure:** websocket and manual flush version paths were compared; document body and work-item description boot previews share one helper; document PATCH/DELETE, item description PATCH, and work item DELETE refresh paths were checked for active-room notification parity.
**Remediation impact surface:** no new remediation needed.
**Residual risk / unknowns:** hosted two-browser PartyKit smoke remains the only meaningful residual confidence gap; local unit/contract coverage cannot fully prove deployed worker/provider timing.

### Validation

- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh` — completed against PR `#26`, branch `realtime-collab-hardening`, base `origin/main`.
- `~/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — completed on `HEAD e1132a12`.
- `pnpm typecheck` — passed.
- `git diff --check origin/main` — passed.
- `pnpm exec vitest run tests/services/partykit-server.test.ts tests/hooks/use-document-collaboration.test.tsx tests/components/document-detail-screen.test.tsx tests/components/work-item-detail-screen.test.tsx tests/lib/collaboration-partykit-adapter.test.ts tests/app/api/document-collaboration-route-contracts.test.ts tests/lib/collaboration-client-session.test.ts tests/lib/collaboration-foundation.test.ts tests/lib/server/collaboration-token.test.ts tests/app/api/work-route-contracts.test.ts tests/app/api/document-workspace-route-contracts.test.ts` — passed, `11` files / `134` tests.

### Branch-totality proof

- **Non-delta files/systems re-read:** current review history, architecture standards checklist, review gates, PartyKit auth/admission/request/server modules, client collaboration adapter/session hook, session/update/delete routes, protocol/limits/errors modules.
- **Prior open findings rechecked:** none open.
- **Prior resolved/adjacent areas revalidated:** RCH-001 through RCH-006 remain resolved in current tree.
- **Hotspots or sibling paths revisited:** active save authority, teardown fallback, refresh clean/dirty/delete/access variants, viewer/editor admission, stale client websocket/flush variants, Strict Mode duplicate open behavior, document/work-item modal one-shot behavior.
- **Dependency/adjacent surfaces revalidated:** token signing/parsing, `COLLABORATION_ALLOW_LEGACY_SCHEMA_VERSION` rollout flag, y-partykit flush URL construction, session bootstrap response, refresh internal token path.
- **Why this is enough:** every previous external finding class now has a direct runtime guard at the owning boundary plus regression coverage on the exact failing variant and a sibling variant where relevant.

### Challenger pass

- `done` — Assumed one serious issue still existed in a bypass path. Rechecked flush without client params, stale schema params before body parse, viewer admission with full editor slots, dirty room during async refresh, and React Strict Mode session opens. No new live bug found.

### Recommendations

1. **Fix first:** none open.
2. **Then address:** run a clean hosted two-client PartyKit smoke after deployment to validate real worker/provider behavior.
3. **Patterns noticed:** this branch is now stronger where the earlier misses happened because authority and lifecycle invariants are tested at the owning boundary.
4. **Suggested approach:** keep future collaboration changes behind the protocol/limits/error modules rather than adding route- or component-local policy.
5. **Defer on purpose:** durable Yjs persistence, local IndexedDB, idle tab disconnect, and follow/scroll presence remain documented future work.

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
