# Audit: Realtime Collaboration Outline Comparison

## Project context

| Field | Value |
|-------|-------|
| **Repository** | `Linear` |
| **Remote** | `https://github.com/declancowen/Linear.git` |
| **Branch** | `realtime-collab-hardening` |
| **Commit** | `23648be8` |
| **Stack** | `Next.js 16 / React 19 / Convex / PartyKit / Yjs / TipTap / Zustand / TypeScript` |
| **Codebase size** | `608 tracked paths / ~173k LOC reported by preflight wc, with spaces-in-path warnings` |

## Audit scope

- `services/partykit/server.ts` — added Turn 1
- `lib/collaboration/**` — added Turn 1
- `hooks/use-document-collaboration.ts` — added Turn 1
- `app/api/collaboration/documents/[documentId]/session/route.ts` — added Turn 1
- `convex/app/collaboration_documents.ts` and document persist handlers — added Turn 1
- `.spec/realtime-collaboration-scoped-sync/**` — added Turn 1
- `README.md` collaboration setup notes — added Turn 4
- `docs/architecture/partykit-cloudflare-runbook.md` — added Turn 4
- `docs/architecture/realtime-collaboration-rollout.md` — added Turn 4
- `docs/architecture/collaboration-production-assessment.md` — added Turn 4
- `/tmp/outline-inspect/server/services/collaboration.ts` — external reference, added Turn 1
- `/tmp/outline-inspect/server/collaboration/*` — external reference, added Turn 1
- `/tmp/outline-inspect/app/scenes/Document/components/MultiplayerEditor.tsx` — external reference, added Turn 1
- `/tmp/outline-inspect/docs/SERVICES.md` and `.env.sample` — external reference, added Turn 4

## Hotspots

- realtime document source-of-truth drift — added Turn 1
- editor schema/version compatibility — added Turn 1
- websocket admission limits and payload safety — added Turn 1
- live-room reconciliation with non-collab writes/deletes/access changes — added Turn 1
- collaboration observability and user-facing close reasons — added Turn 1
- PartyKit server module ownership concentration — added Turn 1
- documentation drift from collaboration source-of-truth and protocol contracts — added Turn 4
- rollout/runbook operability gaps — added Turn 4

## Audit status

| Field | Value |
|-------|-------|
| **Audit started** | `2026-04-27 07:57:39 BST` |
| **Last audited** | `2026-04-27 09:10:00 BST` |
| **Total turns** | `5` |
| **Open findings** | `0` |
| **Resolved findings** | `10` |
| **Accepted findings** | `5` |

## Findings summary

| Severity | Open | Resolved | Accepted |
|----------|------|----------|----------|
| Critical | 0 | 0 | 0 |
| High | 0 | 4 | 0 |
| Medium | 0 | 6 | 3 |
| Low | 0 | 0 | 2 |

---

## Turn 5 — 2026-04-27 09:10:00 BST

| Field | Value |
|-------|-------|
| **Branch** | `realtime-collab-hardening` |
| **IDE / Agent** | `Codex` |

**Summary:** The hardening PR implements the runtime controls for RC-001, RC-002, RC-003, RC-004, RC-006, RC-007, and RC-010, updates the architecture/protocol/runbook documentation for RC-011 through RC-015, and explicitly defers RC-005, RC-008, and RC-009 with revisit triggers.

**Architecture decision:** Convex HTML remains the durable source of truth for this PR. PartyKit/Yjs remains the live active-room model. Durable Yjs state in Convex is documented as a future option after the current model is made safe, observable, and protocol-governed.

### Resolution Table

| Finding | Resolution | Evidence |
|---|---|---|
| `RC-001` | Resolved | `lib/collaboration/protocol.ts`, versioned document token claims, session bootstrap versions, adapter provider/flush params, PartyKit connect/flush client-version rejection tests |
| `RC-002` | Resolved | internal refresh token + PartyKit `/refresh`, clean-room apply, dirty-room conflict, delete/access close semantics |
| `RC-003` | Resolved | `lib/collaboration/limits.ts`, admission checks, flush body cap, teardown JSON cap, canonical HTML cap, tests |
| `RC-004` | Resolved | PartyKit concerns extracted under `services/partykit/collaboration/` for auth, admission, request parsing, errors, and observability |
| `RC-005` | Accepted/deferred | local IndexedDB cache deferred until protocol gates and reconciliation prove stable |
| `RC-006` | Resolved | shared `CollaborationErrorCode`, JSON error responses, close-code mapping, hook reload-required state |
| `RC-007` | Resolved | structured `recordCollaborationEvent` helper and runbook event names |
| `RC-008` | Accepted/deferred | idle hidden-tab disconnect deferred until connection metrics show load pressure |
| `RC-009` | Accepted/deferred | follow/scroll presence remains product enhancement, not correctness work |
| `RC-010` | Resolved | active flush persists server-held Y.Doc; stale client body payload no longer overwrites active room state |
| `RC-011` | Resolved by decision | durable Yjs vs Convex HTML decision recorded in protocol/spec/docs |
| `RC-012` | Resolved | production assessment no longer describes active client payloads as intended authority |
| `RC-013` | Resolved | source-of-truth and durable-Yjs revisit triggers added to protocol/spec docs |
| `RC-014` | Resolved | rollout/runbook thresholds now map to structured event names |
| `RC-015` | Resolved | `docs/architecture/realtime-collaboration-protocol.md` created |

### Validation

- `pnpm typecheck` — passed.
- `pnpm exec vitest run tests/services/partykit-server.test.ts tests/hooks/use-document-collaboration.test.tsx tests/lib/collaboration-partykit-adapter.test.ts tests/app/api/document-collaboration-route-contracts.test.ts tests/lib/collaboration-client-session.test.ts tests/lib/collaboration-foundation.test.ts tests/lib/server/collaboration-token.test.ts tests/app/api/work-route-contracts.test.ts tests/app/api/document-workspace-route-contracts.test.ts` — passed, `9` files / `101` tests.
- `pnpm exec vitest run` — failed in unrelated suites already outside this branch's collaboration scope; see `.reviews/realtime-collaboration-hardening.md` for exact failing test files.

### Deferred Revisit Triggers

- `RC-005`: revisit local Yjs IndexedDB persistence if join/bootstrap p95 remains poor after this hardening, reconnect continuity is a user issue, or sync timeouts recover successfully later.
- `RC-008`: revisit hidden/idle tab disconnect if room connection metrics show idle tabs materially increasing PartyKit load or admission-limit events become common.
- `RC-009`: revisit follow/scroll presence if wiki/document collaboration becomes a primary workflow.

---

## Turn 4 — 2026-04-27 08:20:22 BST

| Field | Value |
|-------|-------|
| **Commit** | `23648be8` |
| **IDE / Agent** | `Codex` |

**Summary:** Documentation exists, but it is not yet strong enough for this collaboration subsystem. The problem is not the absence of files. The problem is that the docs/specs do not fully encode the runtime contracts needed to safely operate, review, and extend the system: source-of-truth semantics, manual flush authority, protocol/version compatibility, admission/error contracts, measurement procedures, and incident playbooks. One existing production assessment now actively conflicts with the latest audit finding around client-snapshot manual flush.

**Outcome:** blocked by documentation and architecture-contract findings; no runtime code changed in this turn.
**Health rating:** Needs attention.
**Risk score:** high — stale collaboration docs can cause future agents and developers to preserve unsafe persistence behavior.
**Change archetypes:** documentation audit, runbook maturity, architecture decision records, protocol governance, source-of-truth contracts.
**Confidence:** high for documentation gaps found in repo docs; medium for full operational maturity because production dashboards/log pipelines were not inspected.
**Coverage note:** This pass audited repo-local collaboration docs/specs and Outline's repo-local service docs/env sample. It did not inspect private production dashboards, hosted PartyKit settings, or external internal docs outside the repo.
**Finding triage:** RC-012 is the new top documentation fix because it contradicts RC-010. RC-013 through RC-015 are contract/runbook hardening items.
**Bug classes / invariants checked:** stale docs driving wrong code, architecture decision drift, env/setup drift, missing protocol contract, missing incident playbook, missing measurement path for abort thresholds.
**Repo totality:** Re-read repo README collaboration setup, `.env.example`, collaboration runbooks, production assessment, scoped-sync design/tasks/requirements, current env resolver, Outline service docs, and Outline env sample.
**Sibling closure:** Checked whether env docs were stale; they are not materially stale because `NEXT_PUBLIC_PARTYKIT_URL` is documented as canonical and runtime still accepts aliases.
**Remediation impact surface:** Docs-only remediation should touch `docs/architecture/collaboration-production-assessment.md`, `docs/architecture/partykit-cloudflare-runbook.md`, `docs/architecture/realtime-collaboration-rollout.md`, `.spec/realtime-collaboration-scoped-sync/design.md`, and probably a new protocol/ADR document.
**Residual risk / unknowns:** Some operational details may already exist in Vercel, Convex, PartyKit, or external team notes; they are not in the repo, so an agent cannot rely on them.

### Documentation comparison

| Area | Outline | Linear | Verdict |
|------|---------|--------|---------|
| Service topology docs | `docs/SERVICES.md` names collaboration as a distinct service and documents `COLLABORATION_URL` for separate hosting. | Runbook names dev/prod PartyKit services and env mapping. | Roughly equivalent for setup. |
| Scaling docs | `.env.sample` documents `REDIS_COLLABORATION_URL` for horizontal collaboration scaling. | PartyKit runbook documents hosted service mapping but not capacity/admission limits or scaling behavior. | Outline is stronger. |
| Protocol compatibility | Code has explicit editor version gate and close codes. | Docs mention deploy coordination but no concrete protocol/version/close-code contract. | Outline is stronger. |
| Operational signals | Code has metrics extension; docs point at services/env. | Docs list prefixes and abort thresholds but not measurement commands, event schemas, or dashboards. | Linear docs are incomplete. |
| Source-of-truth decision | Code and model make Yjs state durable next to content snapshot. | Spec says Yjs is ephemeral and Convex HTML is canonical, but Turn 2 challenges whether that remains sufficient. | Linear needs an updated ADR. |
| Current-risk accuracy | Outline docs do not appear to encode a contradictory unsafe persistence rule. | Production assessment says active saves are authoritative and normal content flushes always apply incoming payload. | Linear has a stale/harmful doc. |

### New findings

#### RC-012 [DOCUMENTATION/SAFETY] High — Production assessment documents the risky manual flush behavior as the intended fix

**Evidence:** `docs/architecture/collaboration-production-assessment.md` says active saves remain authoritative and that normal `content` and `work-item-main` flushes always apply the incoming payload before persisting. Turn 2 identified that exact shape as RC-010: client-snapshot manual flush can overwrite an active server-held room if the client payload is stale.

**Risk:** Future implementation work can follow the doc and preserve the unsafe behavior because it is described as a completed fix. This is especially dangerous for AI-agent work: the stale doc looks authoritative and points to the exact files/tests that currently enshrine the behavior.

**Recommendation:** Update the production assessment immediately. It should mark the active-save/manual-flush behavior as under review, distinguish server-owned room persistence from teardown/client fallback persistence, link RC-010, and remove any language saying incoming client content is always authoritative while other editors are connected.

**Suggested enforcement:** Add a documentation review checklist item for any collaboration save-path change: docs must state which actor owns the content snapshot being persisted and whether a client-supplied snapshot is allowed.

#### RC-013 [ARCHITECTURE/DOCUMENTATION] Medium — Durable collaboration state remains an unresolved decision, but the spec still reads as settled

**Evidence:** `.spec/realtime-collaboration-scoped-sync/design.md` states that `documents.content` remains canonical, PartyKit/Yjs state is ephemeral, and no queue/replay subsystem is required initially. Turn 2 found that Outline's durable Yjs state model is materially stronger for active-room reconciliation, CRDT continuity, and external API update handling.

**Risk:** The repo has no current decision record that explains why HTML-only canonical state is still sufficient after comparing Outline, or what compensating controls are required if durable Yjs state is intentionally deferred. Without this, future work may keep adding tactical patches around an implicit source-of-truth model.

**Recommendation:** Add an ADR or update the design with an explicit choice:

- Option A: persist Yjs state alongside canonical HTML, with size limits, migration, and active-room diff handling.
- Option B: keep HTML-only canonical state, but document replace/conflict semantics, version checks, and reload behavior for active rooms.

**Suggested enforcement:** Every collaboration persistence change should cite the ADR and include a test that matches the chosen model.

#### RC-014 [OPERABILITY/DOCUMENTATION] Medium — Runbooks list thresholds but not how to measure or respond to them

**Evidence:** `docs/architecture/realtime-collaboration-rollout.md` defines abort thresholds such as join/bootstrap failure rate over 1%, scoped refresh failure rate over 1%, p95 invalidation over 3s, durable drift, and mention-send failures. `docs/architecture/partykit-cloudflare-runbook.md` gives deploy/tail commands and a checklist. Neither doc defines event names, metric queries, dashboard locations, close-code meanings, concrete drift diagnosis steps, or incident playbooks.

**Risk:** During an outage or rollout, an operator can know what threshold is bad but not how to measure it, identify root cause, or choose the correct rollback. This also weakens review because the repo cannot prove that operational acceptance criteria are measurable.

**Recommendation:** Extend the runbook with playbooks for:

- collaboration session join/bootstrap failures
- flush failures or suspected drift
- worker restart and cold rehydrate validation
- delete/access-revoke while a room is active
- mention-send failure after collaborative edits
- scoped invalidation lag
- collaboration disabled fallback validation

Each playbook should include exact log prefixes/events, commands, expected healthy output, rollback choice, and verification.

**Suggested enforcement:** Rollout docs should not list numeric abort thresholds unless they also include a measurement path.

#### RC-015 [PROTOCOL/DOCUMENTATION] Medium — Collaboration protocol contracts are spread across code instead of documented as a stable interface

**Evidence:** The docs explain service deployment and broad runtime mode, but there is no dedicated protocol contract for room IDs, token claims, editor/schema version, role semantics, close/error codes, payload size limits, connection limits, flush kinds, and compatibility during mixed Vercel/PartyKit/Convex deploys. Outline's implementation has explicit close events, editor-version checks, throttling, connection limits, and max payload handling.

**Risk:** The protocol can drift because reviewers have to rediscover contract rules from implementation. This is how bugs like unsafe flush semantics, missing version gates, and ambiguous close behavior survive diff review: there is no single contract document to compare against.

**Recommendation:** Add `docs/architecture/realtime-collaboration-protocol.md` or equivalent. It should be treated as the stable interface between Next, PartyKit, Convex, and the editor.

**Suggested enforcement:** Any change to token claims, room naming, flush kinds, editor schema, close reasons, or deployment compatibility must update the protocol doc in the same PR.

### Validation

- `git -C /tmp/outline-inspect fetch origin && git -C /tmp/outline-inspect rev-parse --short HEAD && git -C /tmp/outline-inspect rev-parse --short origin/main` — passed, `f111c88`.
- `git -C /tmp/rme-inspect fetch origin && git -C /tmp/rme-inspect rev-parse --short HEAD && git -C /tmp/rme-inspect rev-parse --short origin/main` — passed, `be1b942`.
- `rg -n "NEXT_PUBLIC_PARTYKIT_URL|NEXT_PUBLIC_COLLABORATION_SERVICE_URL|COLLABORATION_SERVICE_URL|COLLABORATION_TOKEN_SECRET|PARTYKIT" README.md .env.example docs .spec lib services partykit.json package.json` — passed; env docs are aligned with runtime alias support.
- Manual inspection of `README.md`, `.env.example`, `docs/architecture/partykit-cloudflare-runbook.md`, `docs/architecture/realtime-collaboration-rollout.md`, `docs/architecture/collaboration-production-assessment.md`, and `.spec/realtime-collaboration-scoped-sync/**` — completed.
- Manual inspection of Outline `docs/SERVICES.md` and `.env.sample` — completed.

### Repo-totality proof

- **Non-delta files/systems re-read:** repo collaboration docs, scoped-sync spec package, env resolver, security header env resolver, Outline service docs/env sample.
- **Prior open findings rechecked:** RC-010 becomes more urgent because a repo doc currently records the risky behavior as intended. RC-011 becomes a documentation/governance gap because the spec still states the old source-of-truth decision as settled.
- **Prior resolved/adjacent areas revalidated:** README and `.env.example` now document `NEXT_PUBLIC_PARTYKIT_URL` as canonical while the runtime accepts older aliases. No env-doc finding is needed.
- **Hotspots or sibling paths revisited:** deploy runbook, rollout thresholds, production assessment, scoped-sync design/tasks/requirements.
- **Dependency/adjacent surfaces revalidated:** Outline repo refs remain current locally at `origin/main`.
- **Why this is enough:** The pass covers every repo-local collaboration doc linked from the README plus the scoped-sync spec package and the relevant Outline service docs.

### Challenger pass

- `done` — Counterargument: docs can lag behind code and should not block runtime correctness. That is acceptable for minor implementation notes, but not for this subsystem. Collaboration correctness depends on contracts that span Next, PartyKit, Convex, editor schema, and operations. If the docs are stale, future agents and reviewers lose the invariant source.

### Recommendations

1. **Fix first:** RC-012. Remove or rewrite the stale "active saves are authoritative" section before using the production assessment as guidance again.
2. **Then:** RC-015. Create a protocol contract doc so future diff reviews have a concrete reference.
3. **Then:** RC-013. Write the durable Yjs state ADR or update the current design with an explicit HTML-only compensating-control model.
4. **Then:** RC-014. Turn rollout thresholds into operator playbooks with commands, expected signals, and rollback choices.
5. **Do not over-index on:** replacing TipTap or migrating to Hocuspocus first. The immediate gap is contract/operations maturity, not editor package choice.

## Turn 3 — 2026-04-27 08:10:52 BST

| Field | Value |
|-------|-------|
| **Commit** | `23648be8` |
| **IDE / Agent** | `Codex` |

**Summary:** Re-ran the focused collaboration audit pass after the deeper Turn 2 finding. No additional collaboration-risk class was found beyond RC-010/RC-011. Targeted collaboration tests pass. A broad `pnpm test -- ...` invocation unexpectedly ran the wider suite and exposed unrelated failing tests; the direct Vitest command for the intended collaboration files passed.

**Outcome:** blocked by existing open findings; no new findings added in Turn 3.
**Health rating:** Needs attention.
**Risk score:** high — unchanged from Turn 2 because RC-010 remains a High data-consistency risk until fixed.
**Change archetypes:** re-audit, validation, collaboration persistence authority, test-scope verification.
**Confidence:** high for no new finding in the audited collaboration slice; medium for whole-repo health because the broad suite has unrelated failures.
**Coverage note:** Turn 3 rechecked the collaboration slice only. It did not triage the unrelated failing route/Convex/component tests.
**Finding triage:** RC-001 through RC-011 remain open and live. RC-010 remains the first fix.
**Bug classes / invariants checked:** stale client overwrite, server-owned room state, teardown-vs-manual flush distinction, targeted collaboration regression coverage, accidental broad-suite signal.
**Repo totality:** Revalidated the current audit file, collaboration callers, targeted tests, and current working tree.
**Sibling closure:** Rechecked document mention flush, work-item main-section flush, title-only flush, teardown flush, and adapter/server manual flush behavior.
**Remediation impact surface:** No runtime remediation in this turn. Audit artifact only.
**Residual risk / unknowns:** Need a real multi-client stale/disconnect reproduction test after RC-010 remediation is designed.

### Validation

- `pnpm test -- tests/services/partykit-server.test.ts tests/hooks/use-document-collaboration.test.tsx tests/lib/collaboration-partykit-adapter.test.ts` — failed because the package script ran the broader suite; 130 files passed, 6 tests and 1 suite failed in unrelated areas.
- `pnpm exec vitest run tests/services/partykit-server.test.ts tests/hooks/use-document-collaboration.test.tsx tests/lib/collaboration-partykit-adapter.test.ts` — passed; 3 files / 43 tests.

### Repo-totality proof

- **Non-delta files/systems re-read:** `components/app/screens/document-detail-screen.tsx`, `components/app/screens/work-item-detail-screen.tsx`, `hooks/use-document-collaboration.ts`, `lib/collaboration/adapters/partykit.ts`, `services/partykit/server.ts`, targeted collaboration tests.
- **Prior open findings rechecked:** RC-010 still explains the highest-risk difference between Outline and us; RC-001/RC-002 remain next-highest.
- **Prior resolved/adjacent areas revalidated:** Targeted tests prove existing viewer/teardown/bootstrap safeguards still pass.
- **Hotspots or sibling paths revisited:** Manual flush product callers and server endpoint semantics.
- **Dependency/adjacent surfaces revalidated:** No dependency or clone changes since Turn 2.
- **Why this is enough:** The repeat pass specifically attacked whether Turn 2 missed another high-risk collaboration bug class; no additional class was found.

### Challenger pass

- `done` — The likely missed issue would have been another caller sending full content through a bypass. Search and call tracing found the same manual flush path as the shared choke point.

### Carried findings

- RC-010 remains the top fix: stop client-snapshot manual flush from replacing active server room state.
- RC-001 and RC-006 should be paired next: schema/editor versioning and structured error codes.
- RC-002, RC-003, and RC-007 remain the production-hardening follow-up set.

### Recommendations

1. **Fix first:** RC-010.
2. **Then:** RC-001 and RC-006.
3. **Then:** RC-002, RC-003, and RC-007.
4. **Do not do yet:** Hocuspocus migration or editor replacement.

## Turn 2 — 2026-04-27 08:03:43 BST

| Field | Value |
|-------|-------|
| **Commit** | `23648be8` |
| **IDE / Agent** | `Codex` |

**Summary:** A deeper comparison supports the product intuition, with an important caveat: Outline's collaboration subsystem is more mature and safer under production collaboration stress, but that does not mean the whole editor codebase is categorically better or that we should replace TipTap. Their advantage comes from mature collaboration boundaries: durable Yjs state, server-owned persistence, version gates, admission controls, close-code UX, API-update reconciliation, and metrics. Our code is architecturally sound for a newer integration, but it still has a more fragile manual flush model and weaker operational controls.

**Outcome:** blocked by open improvement findings; no immediate code fix was made in this turn.
**Health rating:** Needs attention.
**Risk score:** medium-high — the deeper pass found one higher-risk persistence/concurrency design issue around manual flush accepting client snapshots.
**Change archetypes:** realtime persistence, CRDT state ownership, collaboration server architecture, operational hardening, external reference comparison.
**Confidence:** high for structural comparison, medium for runtime behavior because no multi-client browser/load test was run.
**Coverage note:** Compared current Outline `origin/main` at `f111c88`, `rich-markdown-editor` at `be1b942`, and our `main` at `23648be8`.
**Finding triage:** Turn 1 findings remain live. Turn 2 adds two findings: client-snapshot manual flush risk and unresolved durable collaboration state model.
**Bug classes / invariants checked:** server-owned state persistence, client-supplied snapshot overwrite, active-editor concurrency, CRDT state durability, external-write propagation, version compatibility, admission limits.
**Repo totality:** Re-read Outline document model, collaborative updater, API update hooks, client connection status, presence store, metrics/logger/views extensions, and our store/runtime/manual flush callers.
**Sibling closure:** Checked document detail mention flush, work item main-section flush, title-only flush, legacy rich-text sync queue, PartyKit manual endpoint, and PartyKit adapter payload construction.
**Remediation impact surface:** Any fix to manual flush semantics will touch `lib/collaboration/adapters/partykit.ts`, `services/partykit/server.ts`, `hooks/use-document-collaboration.ts`, document/work-item save flows, and `tests/services/partykit-server.test.ts`.
**Residual risk / unknowns:** We have not reproduced a lost-update race with two real browser clients; the risk is inferred from code shape and confirmed by tests that allow divergent manual content flushes while another editor is connected.

### Deeper comparison

| Area | Outline | Linear | Verdict |
|------|---------|--------|---------|
| Editor stack | Raw ProseMirror editor, in-repo, mature but large. | TipTap 3 editor with custom extensions and Yjs integration. | Do not switch just because Outline's collab is stronger. TipTap remains a good fit. |
| Collaboration server shape | Hocuspocus extensions split auth, limits, version, persistence, API updates, views, logging, metrics. | One PartyKit server module owns most concerns. | Outline is better. We should adopt the boundary pattern. |
| Durable collaboration state | Stores both ProseMirror content snapshot and Yjs `state` blob, with max size validation. | Stores canonical HTML content; reconstructs Yjs doc from HTML on room load. | Outline is better for CRDT-native reconciliation and recovery. Our model is simpler but less capable. |
| Persistence ownership | Server persists from server-held Y.Doc in `documentCollaborativeUpdater`. | Manual flush sends client-derived `contentJson`; server applies it to the room then persists. | Outline is safer. Our flush path should be hardened. |
| External API updates | Model hook notifies collaboration server after `state` changes; active room applies Yjs diff. | No equivalent active-room update path visible. | Outline is better. This maps to RC-002. |
| Stale client protection | Client sends `editorVersion`; server rejects old major versions; UI tells user to reload. | No collaboration editor/schema version in token/provider params. | Outline is better. This maps to RC-001. |
| Admission and payload control | WebSocket max payload, throttle, max clients per document. | Token/auth checks, but no explicit room limits/payload caps found. | Outline is better. This maps to RC-003. |
| User-facing failure modes | Shared close-code taxonomy and `ConnectionStatus` copy. | Mostly string/error-message based degraded state. | Outline is better. This maps to RC-006. |
| Observability | Metrics extension tracks load/connect/disconnect/change and document/connection gauges. | Browser diagnostics and logs exist, fewer server-level metrics visible. | Outline is better. This maps to RC-007. |
| Auth/read-only | Auth extension sets read-only for users without update permission. | PartyKit passes `readOnly: claims.role === "viewer"` and rejects viewer manual flush. | Roughly equivalent. |
| Canonical app integration | Document product is built around collaborative docs. | Collaboration is integrated into broader Convex/scoped-read model and work-item descriptions. | Our product integration is broader; this adds constraints Outline does not have. |

### New findings

#### RC-010 [DATA CONSISTENCY] High — Manual content flush should not overwrite an active room from a client-supplied snapshot

**Evidence:** The adapter serializes the client Y.Doc into `contentJson` for default and work-item flushes. The PartyKit endpoint then calls `applyFlushContentJson(yDoc, flushRequest.contentJson)` before persisting. Existing tests explicitly cover applying and persisting a divergent manual content flush even when another editor is connected. Outline's comparable path persists from the server-held Hocuspocus document in `documentCollaborativeUpdater`, rather than accepting a client snapshot and writing it back into the room.

**Risk:** If a client sends a flush payload that is stale relative to the server-held room state, the endpoint can replace the room's current Yjs content with that stale snapshot before persisting. That is exactly the class of race collaborative editing is supposed to avoid. The current teardown path partially recognizes this by skipping teardown flush when other editors remain, but normal manual content flush does not have the same protection.

**Recommendation:** Make content flush server-owned. For an active room, ignore client `contentJson` and persist the current server-held Y.Doc. Keep client payloads only for metadata such as title or expected updated-at, or for a carefully scoped no-active-room fallback. If a no-active-room fallback remains, gate it with session identity, no other active connections, and a fresh room/canonical version check.

**Suggested enforcement:** Replace the current divergent-manual-flush test with tests that prove a stale client payload cannot overwrite a server-held room with other active editors, that title-only flush still works, and that teardown content is only accepted when no other editor remains.

#### RC-011 [ARCHITECTURE] Medium — Decide whether Yjs state is a durable collaboration artifact or an implementation cache

**Evidence:** Outline's `Document` model has a `state` blob for collaborative Yjs state plus a `content` JSON snapshot, with `DocumentValidation.maxStateLength`. The collaboration service loads/persists the state directly and uses it for API-update diffing. Our Convex documents expose `content` HTML only; PartyKit reconstructs Yjs state from canonical HTML on cold load.

**Risk:** Reconstructing Yjs from HTML is workable for cold rooms, but it weakens active-room reconciliation, local cache validation, CRDT metadata continuity, and future rich wiki features. It also pushes the system toward full replacement semantics when the durable store changes outside the room, instead of Yjs diff semantics.

**Recommendation:** Make an explicit architecture decision. Option A: add a durable `collaborationState`/Yjs update field with size limits and migration/backfill strategy. Option B: keep HTML as the only durable source, but then design active-room reconciliation as versioned replace/conflict handling rather than Yjs diff merging. Do not leave this implicit.

**Suggested enforcement:** Architecture spec update, schema/route contract tests, max-state-size tests if Option A is chosen, or explicit conflict/reload tests if Option B is chosen.

### Refined conclusion

I would not say "their code is better" without qualification. Their collaboration code is better for a production wiki-grade document editor. It is more mature, more decomposed, and more operationally safe.

I would say our architecture direction is still correct. We should keep the app-owned session route, room IDs, Convex authorization, PartyKit adapter boundary, and TipTap integration. The improvement is to move collaboration responsibilities out of "works in the happy path" and into explicit ownership: server-owned state persistence, version gates, admission limits, active-room reconciliation, close codes, and metrics.

### Validation

- `git -C /tmp/outline-inspect fetch origin && git -C /tmp/outline-inspect rev-parse --short HEAD && git -C /tmp/outline-inspect rev-parse --short origin/main` — passed, `f111c88`.
- `git -C /tmp/rme-inspect fetch origin && git -C /tmp/rme-inspect rev-parse --short HEAD && git -C /tmp/rme-inspect rev-parse --short origin/main` — passed, `be1b942`.
- `rg -n "flush\(|\.flush|kind: \"content\"|kind: \"work-item-main\"|kind: \"document-title\"|teardown-content" components hooks lib app tests` — passed.
- Manual inspection of Outline `Document`, `documentCollaborativeUpdater`, `APIUpdateExtension`, `ConnectionStatus`, `MetricsExtension`, `ConnectionLimitExtension`, and client `MultiplayerEditor` — completed.
- Manual inspection of our `services/partykit/server.ts`, `lib/collaboration/adapters/partykit.ts`, `hooks/use-document-collaboration.ts`, document/work-item detail flush callers, and relevant tests — completed.

### Repo-totality proof

- **Non-delta files/systems re-read:** Outline document persistence and model hooks, Outline client collab lifecycle, our adapter/server/manual flush path, our legacy rich-text sync queue, our document and work-item collaboration callers.
- **Prior open findings rechecked:** RC-001 through RC-009 remain live. RC-010 sharpens the persistence ownership risk that was only implicit in RC-002.
- **Prior resolved/adjacent areas revalidated:** Viewer manual flush rejection and no last-close persist for viewer-only rooms remain covered. The new concern is editor-role manual content flush under concurrency.
- **Hotspots or sibling paths revisited:** Mention notification flush, work-item main-section save, document title save, pagehide/unmount teardown flush, and store queued rich-text sync.
- **Dependency/adjacent surfaces revalidated:** Current dependency comparison confirms Outline uses Hocuspocus/ProseMirror and we use TipTap/YPartyKit/Yjs; the recommendation remains pattern adoption, not editor replacement.
- **Why this is enough:** The new finding follows a complete caller-to-server trace and is supported by an existing test that enshrines the risky behavior.

### Challenger pass

- `done` — Counterargument: since the client serializes the same shared Y.Doc, manual flush content should usually match the server room. That is true in the happy path, but it is not an invariant. Network delay, reconnects, stale sessions, or concurrent updates can make the client payload older than server state. Collaborative persistence should not depend on that timing assumption.

### Recommendations

1. **Fix first:** RC-010. Stop applying client-sent content snapshots to active rooms during manual flush.
2. **Then address:** RC-001 and RC-006 together. Versioning and structured close codes create the contract needed for safe rollout and user recovery.
3. **Then decide:** RC-011. Choose whether durable Yjs state belongs in Convex or whether HTML-only canonical state remains intentional with explicit conflict/reload semantics.
4. **Then build maturity:** RC-002, RC-003, and RC-007: active-room update propagation, admission controls, and metrics.
5. **Defer:** Hocuspocus migration. Their Hocuspocus setup is mature, but our current PartyKit boundary can be hardened without a transport rewrite.

## Turn 1 — 2026-04-27 07:58:01 BST

| Field | Value |
|-------|-------|
| **Commit** | `23648be8` |
| **IDE / Agent** | `Codex` |

**Summary:** Our collaboration architecture is directionally sound: app-owned short-lived tokens, room IDs, Convex as canonical store, PartyKit as session transport, scoped read-model bumps, and adapter isolation are all the right shape. Outline is not a reason to replace TipTap or PartyKit. The useful lesson from Outline is operational maturity: their Hocuspocus setup decomposes collaboration into explicit extensions for auth, version gates, connection limits, persistence, API-update reconciliation, views, metrics, and logging. Our main gaps are not basic collaboration mechanics; they are guardrails around version compatibility, active-room reconciliation, admission limits, error taxonomy, observability, and module ownership.

**Outcome:** blocked by open improvement findings, not by an immediate correctness bug found in the current audited flow.
**Health rating:** Needs attention.
**Risk score:** medium — realtime editing is already protected by strong canonical-store and token boundaries, but the missing version/admission/reconciliation controls are the class of issues that can create data drift or poor recovery during deploys, large docs, and external writes.
**Change archetypes:** realtime collaboration, async persistence, vendor transport boundary, canonical-store synchronization, operational controls, architecture boundary review.
**Confidence:** medium-high — core paths were traced in both repos, but this audit did not run multi-client browser tests, production telemetry queries, or hosted PartyKit limit checks.
**Coverage note:** Focused audit only. This is not a whole-repo audit and does not assess chat collaboration beyond shared transport proximity.
**Finding triage:** All findings are improvement findings against the current architecture. No code was changed in this turn.
**Bug classes / invariants checked:** stale client schema writes, active-room canonical drift, websocket overload, durable-vs-session source of truth, auth/read-only split, flush-on-leave, teardown with other editors, hidden fallback state.
**Repo totality:** Traced client session creation, token claims, adapter, PartyKit server load/connect/flush/persist paths, Convex collaboration document reads, existing tests, and the existing realtime collaboration spec.
**Sibling closure:** Compared against Outline server extensions, Outline client multiplayer editor, our PartyKit adapter/server, our document collaboration hook, and our route/session token boundary.
**Remediation impact surface:** Changes would touch `lib/collaboration/transport.ts`, `app/api/collaboration/documents/[documentId]/session/route.ts`, `lib/collaboration/adapters/partykit.ts`, `services/partykit/server.ts`, focused tests under `tests/services` and `tests/hooks`, and possibly Convex-side document update notification contracts.
**Residual risk / unknowns:** Production document sizes, concurrent editor counts, PartyKit deployment constraints, real connection churn, and any current manual/API document update paths were not load-tested.

### Architecture overview

Current target shape is correct: Next mints short-lived collaboration sessions, PartyKit hosts transient Yjs rooms, Convex remains canonical persistence, scoped read-models notify non-collab surfaces, and screens go through `lib/collaboration` instead of importing PartyKit directly.

Outline's active app uses Hocuspocus/Yjs with raw ProseMirror, not TipTap, and its old `rich-markdown-editor` package is archived/stale. Their current production strength is not the editor package. It is the collaboration service shape: a WebSocket endpoint with max payload, Hocuspocus extensions for throttle/connection limits/auth/version/persistence/API-update/views/logging/metrics, local IndexedDB persistence, and client lifecycle handling.

The architecture recommendation is to keep our editor/transport choices, but harden our collaboration capability with the same class of explicit runtime boundaries.

### Validation

- `/Users/declancowen/.codex/skills/repo-audit/scripts/audit-preflight.sh origin/main | sed -n '1,180p'` — passed.
- `/Users/declancowen/.codex/skills/architecture-standards/scripts/architecture-preflight.sh | sed -n '1,160p'` — passed.
- `rg -n "collaboration|PartyKit|Yjs|realtime|scoped" .audits .spec docs tests services lib hooks app | sed -n '1,220p'` — passed.
- Manual code inspection of Outline collaboration service/client from local clone under `/tmp/outline-inspect` — completed.
- No automated tests were run because this turn created an audit artifact and did not change runtime code.

### Repo-totality proof

- **Non-delta files/systems re-read:** `services/partykit/server.ts`, `hooks/use-document-collaboration.ts`, `lib/collaboration/adapters/partykit.ts`, `lib/collaboration/transport.ts`, `app/api/collaboration/documents/[documentId]/session/route.ts`, `.spec/realtime-collaboration-scoped-sync/design.md`, `tests/services/partykit-server.test.ts`, `tests/hooks/use-document-collaboration.test.tsx`.
- **Prior open findings rechecked:** Prior repo audit highlighted scoped reads and collaboration security/scale as architecture risks; this audit focused specifically on the realtime collaboration capability after scoped sync work.
- **Prior resolved/adjacent areas revalidated:** Token/room validation, viewer flush rejection, no-persist-on-clean-room behavior, and dirty-room canonical seeding behavior are already covered by tests in `tests/services/partykit-server.test.ts`.
- **Hotspots or sibling paths revisited:** session minting route, token claim parsing, transport adapter, PartyKit on-connect/on-request/on-close paths, Convex collaboration document read/persist wrappers, and Outline's equivalent auth/version/persistence/API-update/client lifecycle paths.
- **Dependency/adjacent surfaces revalidated:** `package.json` confirms our current TipTap/Yjs/PartyKit stack and Outline's package confirms Hocuspocus/Yjs/raw ProseMirror stack. The standalone `rich-markdown-editor` is not a better replacement candidate.
- **Why this is enough:** The audit is scoped to realtime collab architecture and improvement gaps. It traced the owned boundaries and external reference architecture deeply enough to identify missing invariants and enforcement points.

### Challenger pass

- `done` — The strongest counterargument is that our current scope is smaller than Outline's and does not need all of Outline's operational machinery. That is true for optional items like scroll-follow presence and idle disconnect. It is not true for editor version gates, active-room reconciliation, admission controls, and structured close reasons because those protect correctness and recovery, not just scale polish.

### Resolved / Carried / New findings

#### RC-001 [ARCHITECTURE/RELIABILITY] High — Add an editor/schema version gate to collaboration sessions

**Evidence:** Outline sends `editorVersion` from the client and rejects missing or outdated major versions in `EditorVersionExtension`. Our `DocumentCollaborationSessionTokenClaims` includes document identity, role, session, workspace, and expiry, but no editor/schema version. The PartyKit adapter sends only `token` provider params.

**Risk:** A stale browser tab from before a rich-text schema or extension change can keep joining the same Yjs room and write content with old assumptions. The failure mode is subtle: malformed or downgraded document content can persist through an otherwise valid editor session.

**Recommendation:** Define a shared `RICH_TEXT_COLLABORATION_SCHEMA_VERSION` or editor version, include it in the session bootstrap/token/provider params, validate it in PartyKit before connect/flush, and show a reload-required UI for incompatible clients.

**Suggested enforcement:** Token parser test, session route contract test, PartyKit connect rejection test, adapter params test, client UI test for version-mismatch close reason.

#### RC-002 [DATA CONSISTENCY] High — Add live active-room reconciliation for external canonical updates, deletes, and access revokes

**Evidence:** Outline has `APIUpdateExtension`, which subscribes to API update notifications, loads latest DB Yjs state, computes a Yjs diff, and applies it to active in-memory documents. Our `ensureCanonicalDocumentSeeded` intentionally avoids replacing a non-empty active YDoc while editors remain connected, which is correct for protecting live edits, but there is no equivalent active-room update channel visible in the audited path.

**Risk:** If content changes outside the live collaboration room, or access is revoked/deleted while a room is active, active users may continue from stale room state until reconnect/flush/error. The existing spec says canonical store wins for delete/access revoke, but the enforcement path should be explicit.

**Recommendation:** Add a collaboration invalidation channel from Convex/API updates to active PartyKit rooms. For clean rooms, apply the canonical update. For dirty rooms, avoid blind overwrite and surface a conflict/reload path. For delete/access revocation, close the room with a structured reason.

**Suggested enforcement:** Tests for API document update while room active and clean, update while room dirty, delete while connected, access revoke while connected, and subsequent flush behavior.

#### RC-003 [RELIABILITY/OPERABILITY] Medium — Add per-room connection limits, rate limits, and payload/state size caps

**Evidence:** Outline sets WebSocket `maxPayload`, uses Hocuspocus `Throttle`, and rejects rooms above `COLLABORATION_MAX_CLIENTS_PER_DOCUMENT`. Our audited PartyKit server verifies tokens and permissions, but no explicit per-room client limit, rate limit, or Yjs/document state size limit was found.

**Risk:** A large document, abusive client, runaway reconnect loop, or unexpectedly popular document can degrade a room or worker. Without explicit limits, failure behavior depends on platform defaults.

**Recommendation:** Define app-owned limits for max clients per document, max serialized Yjs/ProseMirror state size, and flush body size. Reject with structured reasons and keep product copy user-readable.

**Suggested enforcement:** PartyKit tests for too many clients, oversized flush body, oversized canonical content, and client mapping of limit errors.

#### RC-004 [ARCHITECTURE] Medium — Split the PartyKit server into owned collaboration modules

**Evidence:** `services/partykit/server.ts` owns token verification, room parsing, bootstrap caching, chat presence, Yjs conversion, dirty-state tracking, canonical persistence, read-model bumps, flush parsing, CORS, and connection lifecycle in one large module. Outline separates equivalent concerns into extensions for auth, connection limit, editor version, persistence, API updates, views, logger, and metrics.

**Risk:** New invariants are likely to be patched into the same large file, increasing the chance of bypasses and making tests less targeted. This is especially risky for version gates, admission controls, and active-room reconciliation.

**Recommendation:** Keep one PartyKit entrypoint, but move concerns under `services/partykit/collaboration/` such as `auth.ts`, `admission.ts`, `bootstrap.ts`, `persistence.ts`, `flush.ts`, `presence.ts`, `errors.ts`, and `observability.ts`.

**Suggested enforcement:** Narrow exported functions with unit tests per module plus integration tests through `collaboration.onConnect` and `collaboration.onRequest`.

#### RC-005 [UX/RESILIENCE] Medium — Consider local Yjs IndexedDB persistence and cached read-only loading for slow joins

**Evidence:** Outline creates an `IndexeddbPersistence` provider for the same Y.Doc and renders a cached read-only editor while remote sync loads. Our hook uses route bootstrap content and waits for remote PartyKit sync; on sync timeout it keeps bootstrapping or degrades depending on state.

**Risk:** On poor networks, users see weaker continuity and recovery than Outline: no local Yjs cache for last known state, and less explicit separation between cached read-only content and confirmed remote-collab content.

**Recommendation:** Add optional `y-indexeddb` for document rooms after version gates exist. Treat local cache as display/recovery only until remote sync confirms; never make it canonical.

**Suggested enforcement:** Tests for cold join, local cache shown read-only before remote sync, cache discarded on version mismatch, and remote canonical content winning after sync.

#### RC-006 [UX/OPERABILITY] Medium — Add a shared collaboration close/error taxonomy

**Evidence:** Outline centralizes close codes such as too large, auth failed, authorization failed, too many connections, editor update required, and timeout. Our current path emits errors and text reasons from several places, and the adapter maps some message snippets to behavior.

**Risk:** String-matching transport errors becomes brittle as more controls are added. Users can receive generic failures for cases that need specific recovery: reload, reconnect, request access, document deleted, too large, or too many editors.

**Recommendation:** Add shared error codes across token/session route, PartyKit server, adapter, and hook state. Use codes for client decisions and copy, with logs carrying the detailed message.

**Suggested enforcement:** Contract tests for each code and a no-raw-string client branch rule in collaboration adapter tests.

#### RC-007 [OBSERVABILITY] Medium — Add alertable collaboration metrics around join, sync, flush, and drift

**Evidence:** Outline has logger and metrics extensions. Our code logs diagnostics and reports some browser diagnostics, but the audited path does not expose a clear server metric set for operational thresholds. The existing spec explicitly calls for join latency, cold rehydrate latency, scoped invalidation lag, metrics, logs, and abort thresholds.

**Risk:** Collaboration failures can be invisible until users report lost edits or stuck rooms. Logs alone are hard to use for SLOs or regression detection.

**Recommendation:** Add counters/histograms for session mint failures, websocket connect rejects by code, bootstrap latency, initial sync timeout, flush latency, flush failure by code, dirty-room last-close persist, active-room close due to persist failure, and read-model bump failure.

**Suggested enforcement:** Unit tests for metric emission around error branches where possible, plus deployment dashboard/runbook entries.

#### RC-008 [PERFORMANCE] Low — Consider hidden/idle tab disconnect to reduce room load

**Evidence:** Outline disconnects the remote provider when the page is idle and hidden, then reconnects when visible/active. Our audited hook disconnects on unmount and flushes editor teardown, but no equivalent idle hidden-tab policy was found.

**Risk:** Many open tabs keep sockets and awareness sessions alive longer than needed, increasing PartyKit room load.

**Recommendation:** Defer until connection count metrics exist. If metrics show meaningful load, add hidden/idle disconnect with careful flush and awareness cleanup semantics.

#### RC-009 [PRODUCT/UX] Low — Presence can be extended later with follow/scroll semantics

**Evidence:** Outline includes scroll awareness and observing/following behavior. Our awareness model carries user/session/name/avatar/color/typing/active block/cursor/selection, which is enough for current collaboration presence.

**Risk:** Not a correctness gap. It is a future product enhancement if collaborative docs become a core wiki surface.

**Recommendation:** Defer until the wiki/document experience needs "follow collaborator" behavior.

### Recommendations

1. **Fix first:** Add collaboration schema/editor versioning and structured close/error codes. These are low-dependency controls that prevent stale-client corruption and make later safeguards easier.
2. **Then address:** Add active-room reconciliation for API writes/deletes/access revokes. This is the highest-value correctness gap relative to Outline.
3. **Patterns noticed:** Our architecture is already stronger than it looks in source-of-truth discipline; the risk is operational maturity around the realtime edge, not the choice of TipTap or PartyKit.
4. **Suggested approach:** Do not replace TipTap with Outline's archived editor. Keep our editor and transport adapter, but adopt Outline's mature boundary pattern: version, admission, persistence, update-reconciliation, observability, and lifecycle concerns as separate modules.
5. **Progress since last turn:** New audit started; no code remediation has begun.
6. **Defer on purpose:** IndexedDB cache, hidden-tab disconnect, scroll-follow presence, and Hocuspocus migration should wait until correctness guardrails and metrics are in place.
