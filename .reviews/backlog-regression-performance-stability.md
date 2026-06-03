# Review: Backlog Regression Performance Stability

## Project context

| Field | Value |
|-------|-------|
| **Repository** | `/Users/declancowen/Documents/GitHub/Linear` |
| **Remote** | `https://github.com/declancowen/Linear.git` |
| **Branch** | `backlog-regression-performance-stability` |
| **Stack** | Next.js 16, React 19, Convex, TipTap, Zustand, Vitest |

## Scope

- Immediate Convex cost containment for realtime polling, reconnect refresh fan-out, and redundant chat read-state writes - added Turn 1
- Spec package and per-slice review protocol for backlog regression/performance/stability remediation - added Turn 1
- Real scoped read models replacing snapshot-backed read-model routes and mutation scope-key resolvers - added Turn 2
- Slash Reference scoped search from typed slash/rendered slash-command UI in document and work item editors - added Turn 3
- Create modal typing fan-out reduction and performance validation for existing TipTap/read-model diagnostics - added Turn 4
- Work-surface selection UI, parent-filter cascade, private-task grouping protection, filtered status bounce protection, and bulk selected-item delete - added Turn 5
- Property/create/document/sort controls, including project icons, document pills, sort trigger, and editable label dropdowns - added Turn 6
- Chat panel stability, deleted previews, optimistic message preservation, compact metadata/read state, same-sender grouping, and link styling - added Turn 7
- Convex cost/read-model guardrails, environment targeting diagnostics, and bounded operational retention cleanup - added Turn 9

## Hotspots

- Idle Convex function-call amplification from one-second polling and reconnect refresh behavior - added Turn 1
- Broad snapshot-backed read-model I/O, left for the next scoped read-model migration slice - added Turn 1
- Chat read-state hot writes, OCC retries, and stale notification cleanup - added Turn 1
- Client refresh fallback behavior across ready, invalidate, unavailable, focus, and online events - added Turn 1
- Legacy snapshot stream production visibility and accidental enablement - added Turn 1
- Collection-scope authorization and forbidden team/workspace overreads in scoped Convex read models - added Turn 2
- Editor command-launched Reference picker lifetime being cleared by trigger-pattern state sync - added Turn 3
- Create work item title/description draft state forcing property picker/dropdown rerenders on every keystroke - added Turn 4
- Assigned-descendant container lifting bypassing active filters on my-items surfaces - added Turn 5
- Pending optimistic work item status being overwritten by stale read-model merges - added Turn 5
- Bulk menu destructive actions and selected target-set correctness - added Turn 5
- Project icon propagation across create-modal and inline child composer surfaces - added Turn 6
- Document display-property pill dedupe and right-column placement - added Turn 6
- Sort trigger ref/prop forwarding and editable label property assignability - added Turn 6
- Per-slice architecture assessment gate after clean diff-review loops - added Turn 6
- Pending optimistic chat messages being dropped by stale scoped read-model replacement/merge - added Turn 7
- Left workspace conversation-list pane width/collapse behavior - added Turn 7
- Compact right-aligned message metadata/read-state rendering - added Turn 7
- Hydration-safe persisted pane settings without set-state-in-effect - added Turn 7
- Reply-vs-quote separation across chat, channels, and work item comments - added Turn 8
- Profile hover layering and decorative offline status indicators - added Turn 8
- Denser profile activity detail rendering for comments/status/property changes - added Turn 8
- Cost guardrail tests preventing snapshot-backed read-model route relapse - added Turn 9
- Bounded retention cleanup read/delete behavior for notifications, email jobs, and read-model versions - added Turn 9
- Local/prod Convex target visibility for billing investigations - added Turn 9
- Final total-diff route/backend contract fit, read-model authority, scoped invalidation, snapshot removal, and Convex cost bounds - added Turn 10
- External Codex review feedback on scoped document visibility and generated Convex API roster - added Turn 11

## Review status

| Field | Value |
|-------|-------|
| **Review started** | 2026-06-03 10:20:17 BST |
| **Last reviewed** | 2026-06-03 15:07:31 BST |
| **Total turns** | 11 |
| **Open findings** | 0 |
| **Resolved findings** | 13 |
| **Accepted findings** | 0 |

## Turn 11 - 2026-06-03 15:07:31 BST

| Field | Value |
|-------|-------|
| **Commit** | `6e02a9ec` with uncommitted PR-feedback fixes |
| **IDE / Agent** | Codex |

**Summary:** Imported the completed GitHub Codex review feedback for PR #49, triaged it against the current tree, fixed the live scoped document visibility leak, fixed the generated Convex API roster CI failure, and reran the deep/normal review loop with architecture standards.

**Outcome:** all clear for the PR-feedback follow-up. No live Critical, High, or Medium findings remain in the current local diff. The branch is ready for a follow-up commit and push to PR #49.

**Risk score:** high - the feedback touched server-side document visibility, read-model authority, scoped materialization, and generated Convex API contract files.

**Change archetypes:** external finding import, authorization/privacy fix, scoped read-model architecture, CI/generated binding contract, regression tests.

**External finding import:**

| Source | Finding | Current status | Bug class | Missed invariant/variant | Action |
|--------|---------|----------------|-----------|--------------------------|--------|
| GitHub Codex review | Work item detail scoped loader could include linked private/inaccessible-team documents from workspace document scans | live | Authorization/privacy / scoped read-model leak | linked-document visibility must match bootstrap visibility for work item detail, including workspace-linked documents | fixed |
| GitHub Codex review | Project detail scoped loader could include linked private/inaccessible-team documents from workspace document scans | live | Authorization/privacy / scoped read-model leak | linked-document visibility must match bootstrap visibility for project detail, including workspace-linked documents | fixed |
| GitHub Actions CI | Convex generated API roster missing `convex/app/scoped_read_models` import/map entry | live | Generated API contract / CI drift | new Convex module must be represented in committed generated API roster when deployment codegen is unavailable | fixed |

**Intent vs actual:** the Codex findings were live. The old bootstrap path filtered documents through kind/team/private/workspace visibility before selection; the new scoped materializer had copied the scope shape but not that visibility invariant for workspace-linked documents in work item/project detail. The generated API roster drift was also live and explained both current failing CI check runs.

**Confidence:** high. The fix centralizes scoped document visibility in `convex/app/scoped_read_models.ts`, applies it to work item detail, project detail, and workspace people materialization, and adds regression tests for current-user private visibility plus other-user private/inaccessible-team exclusion.

**Coverage note:** reviewed Codex review comments, current scoped loader code, bootstrap document visibility rules, document access rules, document index/search/workspace-people sibling paths, generated API verifier, CI workflow, and focused/full validation.

**Deep-review evidence:** dual pass completed. Correctness/safety checked privacy/authorization leakage, item-description visibility, current-user private document visibility, team-document membership, workspace document readability, and generated API CI contract. Maintainability/structure checked that the fix lives in the scoped Convex materializer rather than selector/UI layers and avoids duplicate visibility predicates.

**Architecture assessment:** clean after fixes. Document visibility is now enforced at the scoped Convex materialization boundary for the affected read models. The UI selectors only shape already-authorized scoped data. The new helper mirrors bootstrap visibility rules without reintroducing `getSnapshotServer`, and the generated API roster fix aligns CI fallback verification with the new Convex module boundary.

**Bug classes / invariants checked:** server-side authorization, tenant/team/private document visibility, scoped read-model authority, snapshot-to-scoped migration parity, generated API drift, and CI fallback contract.

**Branch totality:** reassessed branch-total current state after the external feedback. No additional GitHub review comments were present. The earlier final review remains valid; this turn updates the branch with the external privacy/CI fixes and revalidates the affected architecture.

**Sibling closure:** checked `loadDocumentDetailCollections`, `loadDocumentsForScope`, document index/search-seed loaders, workspace people loader, work item detail loader, project detail loader, bootstrap visibility helpers, document access helpers, and generated API verifier. Workspace people now reuses the same scoped document visibility helper to avoid a second rule copy.

**Remediation impact surface:** changes are limited to `convex/app/scoped_read_models.ts`, `tests/convex/scoped-read-model-handlers.test.ts`, and `convex/_generated/api.d.ts`. No route/client/store behavior changed.

**Residual risk / unknowns:** project/work item detail loaders still read workspace documents before filtering, so the cost profile remains the same as the prior branch for those detail surfaces. The privacy bug is fixed; deeper pagination/indexed lookup for high-cardinality detail-linked documents remains future capacity work if production data warrants it.

### Validation

- `pnpm exec vitest run tests/convex/scoped-read-model-handlers.test.ts` - passed, 1 file / 5 tests
- `node scripts/verify-convex-generated-fallback.mjs` - passed, modules=40
- `pnpm exec tsc --noEmit --pretty false` - passed
- `pnpm lint` - passed
- `pnpm cost:guardrails` - passed, 4 files / 15 tests
- `git diff --check` - passed
- `pnpm test` - passed, 222 files / 1473 tests
- `pnpm build` - passed
- Browser smoke - intentionally not run by Codex; user-owned manual validation per instruction

### Branch-totality proof

- **Non-delta files/systems re-read:** GitHub Codex review comments, CI failed log, bootstrap document visibility helpers, Convex document access helpers, scoped read-model materializer, generated API verifier, CI workflow, and scoped read-model handler tests.
- **Prior open findings rechecked:** no prior open findings existed before the GitHub review. The new external findings are resolved in this turn.
- **Prior resolved/adjacent areas revalidated:** cost guardrails still pass, full tests still pass, build still passes, and the generated API fallback verifier now passes.
- **Hotspots or sibling paths revisited:** work item detail, project detail, document detail, document index, search seed, workspace people, generated API roster, and scoped materialization.
- **Dependency/adjacent surfaces revalidated:** Convex generated API type map, document visibility predicates, read-model selectors, and CI fallback verification.
- **Why this is enough:** the feedback was narrow but privacy-sensitive. The fix addresses the owner boundary, adds direct regression tests for both review comments, centralizes the duplicated sibling rule, and validates both behavior and CI contract.

### Challenger pass

- `done` - assumed the same visibility bug existed in another document materializer. That pass found the workspace people loader had a separate but equivalent local visibility predicate, so it was routed through the new helper. Document detail, document index, and search seed already use access checks or scoped document loaders.

### Resolved / Carried / New findings

#### BRS-012 [P1] Scoped work item/project detail loaders could leak unreadable linked documents

- **Status:** resolved
- **Bug class:** authorization/privacy / scoped read-model migration parity
- **Invariant:** scoped read models must apply the same document visibility rules as the old bootstrap snapshot before materializing linked document metadata/content.
- **Root cause:** work item and project detail scoped loaders scanned workspace documents and filtered only by link relationship, so other-user private documents and inaccessible-team documents in the same workspace could enter the scoped snapshot.
- **Fix:** added a scoped document visibility helper for item-description, team, private, and workspace documents; applied it to work item detail, project detail, and workspace people; added regression tests covering visible workspace/team/current-user-private docs and excluding other-user private/inaccessible-team docs.
- **Verification:** focused scoped handler tests, typecheck, lint, cost guardrails, full tests, build, and diff check passed.

#### BRS-013 [P2] CI fallback generated API roster was stale for the new scoped read-model module

- **Status:** resolved
- **Bug class:** generated API contract / CI drift
- **Invariant:** a new Convex source module must be represented in committed generated API bindings when CI cannot run deployment-backed codegen.
- **Root cause:** `convex/app/scoped_read_models.ts` was added without the corresponding `convex/_generated/api.d.ts` import/map entry.
- **Fix:** added the scoped read-model module import and API map entry in `convex/_generated/api.d.ts`.
- **Verification:** `node scripts/verify-convex-generated-fallback.mjs` passed locally; typecheck and build passed.

### Architecture assessment

Clean. The privacy invariant now belongs to the scoped Convex materializer, not UI selectors or client routes. The helper is narrow, mirrors existing bootstrap access semantics, and avoids broad snapshot fallback. CI generated-binding drift is fixed at the generated API contract boundary.

### Recommendations

1. **Proceed:** commit and push the follow-up fixes to PR #49.
2. **Watcher:** after push, wait for the next Codex/GitHub review and CI result before making further changes, to avoid duplicate review triggers.

## Turn 10 - 2026-06-03 14:47:38 BST

| Field | Value |
|-------|-------|
| **Commit** | `b820518d` with uncommitted working tree |
| **IDE / Agent** | Codex |

**Summary:** Ran the final total-diff deep review and architecture assessment across every touched file and adjacent read-model/snapshot/invalidation/backend contract path. Fixed final findings around idempotent channel comment deletion, full-suite timing, and conversation-list preview cost bounds.

**Outcome:** all clear after fixes and normal full-worktree re-review. No live Critical, High, or Medium findings remain. Browser smoke was intentionally not run because the user explicitly made smoke testing user-owned manual validation.

**Risk score:** high - the branch changes read-model authority, Convex query shape, scoped invalidation, optimistic store reconciliation, shared chat/work/document UI, schema indexes, retention cleanup, and route contracts.

**Change archetypes:** architecture migration, Convex cost containment, route/backend contract, scoped invalidation, optimistic state reconciliation, shared UI, operational guardrail, regression test hardening.

**Intended change:** complete the full backlog/cost plan, prove the scoped read-model layer is no longer snapshot-backed at the read-model route boundary, verify scoped invalidation and Convex cost policies, and prepare the clean branch for draft PR delivery.

**Intent vs actual:** implementation matches the original backlog prompt, slash/reference clarification, billing/cost plan, later chat/read-receipt/project-icon clarifications, and the explicit review/PR addendum. No requirements were deferred. Legacy snapshot/custom-property routes still exist outside the read-model migration path and are recorded as residual audit risk, not as scoped read-model completion.

**Confidence:** high for code/test/architecture gates. Full validation passed after final fixes. Visual browser smoke remains user-owned by instruction.

**Coverage note:** reviewed read-model routes, scoped route handlers, Convex scoped materializer, scope-key authorization, scoped version polling, client refresh/reconnect behavior, legacy snapshot gate, mutation invalidation helpers, chat read-state suppression, store merge/pruning, Convex schema indexes, retention cleanup, and changed UI slices.

**Deep-review evidence:** dual pass completed. Correctness/safety focused on server-side authorization, route contracts, idempotency, stale optimistic merge protection, invalidation scope keys, deleted/readable message behavior, private/workspace visibility, and destructive cleanup safety. Maintainability/structure focused on ownership placement, route thinness, transitional scoped materializer boundaries, static guard fitness, and avoiding full detail reads from list routes.

**Architecture assessment:** clean after BRS-011. Read-model authority is server/Convex-owned; read-model API routes are thin adapters; `app/api/read-models/**`, `lib/server/scoped-read-model-route-handlers.ts`, and `lib/server/scoped-read-models.ts` do not call `getSnapshotServer`; scoped invalidation authorizes scope keys server-side before SSE streaming; polling/retry/degraded refresh defaults are bounded; client reconnects no longer blindly refresh every subscriber; and cost guardrails now fail on snapshot-backed read-model route relapse and missing key indexes.

**Static/analyzer evidence:** architecture preflight captured current tree at 14:41:18 BST. `rg getSnapshotServer` found no read-model route/scoped-handler offenders. Remaining `getSnapshotServer` users are `app/api/snapshot`, `app/api/custom-properties`, and `lib/server/convex/auth.ts`, which are outside this branch's read-model route migration and stay as residual audit risk if traffic makes them hot.

**Bug classes / invariants checked:** full-snapshot relapse, broad Convex reads in list read models, scope-key authorization bypass, one-second polling relapse, reconnect fan-out, global invalidation drift, redundant chat read-state sync, optimistic message/status disappearance, route idempotency, destructive cleanup safety, private-task/workspace leakage, and shared UI contract regressions.

**Branch totality:** branch-total current state was reassessed after all fixes. No tracked file deletions are present in `git diff --name-status`; Convex changes are modified files plus new scoped/cost files. All intended untracked spec/review/test/helper files are part of the planned branch.

**Sibling closure:** read-model route tree, scoped server helpers, Convex scoped materializer/data helpers, scoped sync mutation/query, SSE route/polling policy, legacy snapshot provider, chat read-state/store path, platform comment routes, work-surface selectors, document/project/create UI, profile/channel/comment/chat surfaces, cost diagnostics, and retention cleanup were checked through source and tests.

**Remediation impact surface:** final fixes add a chat message composite index, a bounded latest-readable-message data helper, route idempotency handling for already-deleted channel post comments, and deterministic waits in two timing-sensitive tests. No new broad snapshot path or polling path was introduced.

**Residual risk / unknowns:** browser smoke is intentionally user-owned. Conversation thread/detail, comments, activities, and documents remain unpaginated where those surfaces own full detail views; this branch removes fake scoped full-app snapshots and bounds conversation-list previews, while future capacity work should paginate high-cardinality detail streams if production data grows. Failed unsent email jobs still use a bounded createdAt retention fallback because the schema lacks a terminal failure timestamp. Legacy snapshot/custom-property snapshot routes remain outside this read-model migration and should be watched in cost diagnostics if they become hot.

### Validation

- `pnpm exec vitest run tests/convex/scoped-read-model-handlers.test.ts tests/app/api/read-model-static-guards.test.ts tests/components/workspace-chats-screen.test.tsx` - passed after BRS-011 fix, 3 files / 12 tests
- `pnpm cost:guardrails` - passed, 4 files / 15 tests
- `pnpm exec tsc --noEmit --pretty false` - passed
- `pnpm lint` - passed
- `pnpm test` - passed, 222 files / 1471 tests
- `pnpm build` - passed
- `python3 ~/.codex/skills/spec-driven-development/scripts/lint_spec.py --spec-dir .spec/backlog-regression-performance-stability` - passed
- `python3 ~/.codex/skills/spec-driven-development/scripts/traceability_report.py --spec-dir .spec/backlog-regression-performance-stability --strict` - passed
- `git diff --check` - passed
- Browser smoke - intentionally not run by Codex; user-owned manual validation per instruction

### Branch-totality proof

- **Non-delta files/systems re-read:** original backlog prompt, slash/reference clarification, billing/cost prompt, later user corrections, full DES/REQ/tasks package, all slice review entries, read-model route tree, scoped Convex materializer/data helpers, scoped invalidation route/polling, store merge/pruning, chat read-state, schema indexes, and static cost guardrails.
- **Prior open findings rechecked:** no prior open findings existed.
- **Prior resolved/adjacent areas revalidated:** all previous slice findings were rechecked through full tests, cost guardrails, typecheck, lint, build, spec lint, traceability, diff check, and targeted architecture grep/source review.
- **Hotspots or sibling paths revisited:** snapshot removal, scoped invalidation authorization, list/detail read boundaries, chat read-state hot path, stale optimistic data preservation, route idempotency, retention cleanup, private-task leakage, and shared reply/quote/link/metadata contracts.
- **Dependency/adjacent surfaces revalidated:** Convex schema/data/scoped handlers, Next API route contracts, Zustand store merge, TipTap slash/reference UI, create modal, work/document/chat/profile components, operations diagnostics, and test helpers.
- **Why this is enough:** the final loop covered the whole intended dirty worktree and the adjacent systems those changes touch, then reran full validation after fixes. Remaining risks are either explicitly user-owned browser validation or capacity/legacy paths outside the read-model route migration.

### Challenger pass

- `done` - assumed the branch still had a hidden fake-scoped read path despite clean route names. That pass found BRS-011: conversation-list scoped reads still loaded all chat messages for previews. The fix added an indexed latest-readable-message helper and tests proving the list route does not call full conversation message history.

### Resolved / Carried / New findings

#### BRS-009 [P2] Idempotent channel post comment delete could still resolve and bump scopes after a no-op delete

- **Status:** resolved
- **Bug class:** route/backend contract / unnecessary invalidation
- **Invariant:** idempotent delete routes must not perform downstream read-model scope resolution or version bumps when the authoritative delete mutation reports that nothing changed.
- **Root cause:** the DELETE route resolved channel post scope keys before knowing whether the comment deletion was a real state transition.
- **Fix:** `deleteChannelPostCommentHandler` now reports `{ deleted: false }` for missing comments, and the route only resolves/bump scope keys when the deletion changed state and the resolved scope key set is non-empty.
- **Verification:** platform route contract tests passed, and full `pnpm test` passed.

#### BRS-010 [P3] Final full-suite timing had two tests asserting before deferred state attached

- **Status:** resolved
- **Bug class:** test reliability / async boundary
- **Invariant:** final validation tests must wait for deferred sidebar/collaboration state before asserting behavior that depends on it.
- **Root cause:** two tests were relying on incidental timing that became unstable under the full suite.
- **Fix:** added deterministic waits for deferred work item sidebar sections and document collaboration attachment before dispatching/asserting.
- **Verification:** focused tests passed before the final loop, and full `pnpm test` passed.

#### BRS-011 [P1] Conversation-list scoped read model still read complete chat histories for previews

- **Status:** resolved
- **Bug class:** Convex cost / fake-scoped list read
- **Invariant:** a list read model must not load full detail histories just to compute preview text.
- **Root cause:** `loadConversationListCollections` avoided `getSnapshotServer` but still called `listChatMessagesByConversation` for each accessible chat conversation and flattened the full message history.
- **Fix:** added `chatMessages.by_conversation_created_at`, `listLatestReadableChatMessagesByConversations`, and a conversation-list handler test proving previews use bounded latest-message reads and do not call full conversation message history.
- **Verification:** focused scoped-read-model/static-guard/workspace-chat tests passed, `pnpm cost:guardrails` passed, full `pnpm test` passed, and `pnpm build` passed.

### Architecture assessment

Clean. The branch now moves the billing-critical architecture from fake scoped read routes to a real scoped server/Convex boundary with explicit authorization, bounded invalidation polling, static relapse checks, and route/backend contracts that distinguish list previews from detail payloads. The transitional `AppSnapshot` materializer remains acceptable because it materializes only scoped collections and is protected by static tests plus targeted handler coverage.

### Recommendations

1. **Proceed:** create/use a new branch, stage intended files, commit, push, and open a draft PR to `main`.
2. **Manual validation:** user-owned browser smoke should cover slash Reference, create modal typing, work surface multi-select, document pills, inherited project icon/name, chats, profile hover layering, and label/sort menus.
3. **Operations watch:** after deploy, compare Convex Insights for `app:getSnapshot`, scoped read-model routes, scoped version polling, conversation-list read I/O, and chat read-state mutations.

## Turn 9 - 2026-06-03 13:02:30 BST

| Field | Value |
|-------|-------|
| **Commit** | `b820518d` with uncommitted working tree |
| **IDE / Agent** | Codex |

**Summary:** Completed slice 9.1 by adding Convex cost diagnostic/env-audit helpers, a `cost:guardrails` validation script, stronger static read-model/snapshot guards, retention timestamp indexes, and a server-token-gated operational retention cleanup mutation for old notifications, email jobs, and stale scoped read-model version rows.

**Outcome:** all clear for slice 9.1 after deep-review findings were fixed and normal re-review plus architecture assessment were clean. Browser smoke is intentionally user-owned manual validation and not relevant to this backend/ops slice.

**Risk score:** high - this slice changes Convex schema indexes, operational deletion behavior, static architecture tests, and cost investigation tooling.

**Change archetypes:** operational guardrail, schema/index change, bounded background cleanup, static architecture fitness test, devex/cost diagnostics.

**Intended change:** satisfy REQ-GUARDRAIL-001 through operations/backend owners: static tests catch snapshot-backed read-model relapse, diagnostics expose per-function/route cost fields and env-target mismatch, and Convex retention cleanup is server-token protected, dry-run by default, and bounded.

**Intent vs actual:** implementation matches task 9.1. It does not reintroduce snapshots, polling, or broad read-model routes. Retention cleanup uses indexed ranges and capped `take()` reads rather than full-table collects.

**Confidence:** high for this slice. Cost guardrail tests, adjacent scoped read-model route tests, typecheck, lint, and diff whitespace checks passed.

**Coverage note:** reviewed static guards, cost diagnostic helper, env deployment parsing/audit behavior, Convex schema indexes, retention cleanup mutation export, cleanup delete policy, test Convex query shim, and package script.

**Finding triage:** one live deep-review finding was found and fixed: the first retention cleanup was delete-bounded but not read-bounded, and bounded scans could get stuck behind old active rows. Fixed with indexed terminal timestamp scans, capped `take()` calls, deduped candidates, and query-operation tests.

**Static/analyzer evidence:** `pnpm cost:guardrails`, adjacent read-model route/Convex handler tests, `pnpm exec tsc --noEmit --pretty false`, `pnpm lint`, and `git diff --check` passed.

**Architecture impact:** strengthens the operations boundary. Cost diagnostics live in `lib/operations`, static architecture fitness stays in tests, Convex cleanup policy stays server-side in the maintenance mutation, and retention queries now use schema-owned indexes with bounded reads/deletes.

**Deep-review evidence:** dual pass completed. Correctness/safety checked dry-run default, server-token gate, active-data preservation, deletion limits, env target findings, static snapshot guards, and schema indexes. Maintainability/structure found and fixed the broad-read cleanup shape and the weak table-index/static-test proof.

**Bug classes / invariants checked:** operational cost regression, broad Convex reads, destructive cleanup safety, active notification/email preservation, wrong-deployment investigation drift, snapshot read-model relapse, static guard superficiality, and test-helper false confidence.

**Branch totality:** this turn reviewed the 9.1 slice within the cumulative dirty worktree. Earlier product/cost slices remain recorded in prior turns and are included in the pending final total-diff review.

**Sibling closure:** read-model routes/server handlers, scoped event guard tests, scoped read-model handler tests, notification/email/read-model-version retention paths, local/prod env audit helper, and cost diagnostics script were checked through code and tests.

**Remediation impact surface:** adds Convex indexes and a new operational mutation. The mutation is dry-run by default, requires the existing server-token mechanism, caps delete count, caps read windows, and avoids deleting unread/unclaimed active notifications or pending/retryable email jobs.

**Residual risk / unknowns:** failed unsent email jobs still use a bounded createdAt fallback because there is no terminal failure timestamp index in the current schema. That is intentionally capped and safe; future email-job schema work could add a last-failed timestamp if cleanup volume shows it is needed.

### Validation

- `pnpm cost:guardrails` - passed, 4 files / 15 tests
- `pnpm exec vitest run tests/app/api/read-model-route-contracts.test.ts tests/app/api/scoped-events-route-contracts.test.ts tests/convex/scoped-read-model-handlers.test.ts` - passed, 3 files / 24 tests
- `pnpm exec tsc --noEmit --pretty false` - passed
- `pnpm lint` - passed
- `git diff --check` - passed
- Browser smoke - intentionally not run by Codex; user-owned manual validation per instruction and not applicable to this ops/static slice

### Branch-totality proof

- **Non-delta files/systems re-read:** DES-014/DES-015, REQ-GUARDRAIL-001/REQ-KNOWLEDGE-001, task 9.1, read-model route/static guards, Convex schema, maintenance mutation patterns, cost policy tests, scoped read-model route contracts, and env/cost helper tests.
- **Prior open findings rechecked:** no open findings existed from Turns 1-8.
- **Prior resolved/adjacent areas revalidated:** static read-model guards still ban `getSnapshotServer`; scoped event/route contract tests still pass; cost polling checks remain part of `pnpm cost:guardrails`.
- **Hotspots or sibling paths revisited:** snapshot relapses, unsafe polling guard tests, retention cleanup broad reads, active-data deletion safety, env targeting, and cost diagnostic row shape.
- **Dependency/adjacent surfaces revalidated:** focused cost guardrail tests, scoped read-model route/handler tests, typecheck, lint, and diff whitespace.
- **Why this is enough:** the slice is operational/static/backend guardrail work with direct tests for the destructive and cost-sensitive invariants. Final total-diff review remains pending for cross-slice interactions.

### Challenger pass

- `done` - assumed the new cleanup guardrail could itself recreate the billing problem or silently fail to make cleanup progress. That pass found the full-table collect shape and bounded-scan blocker cases; both were fixed and covered by tests that assert indexed `take()` reads.

### Resolved / Carried / New findings

#### BRS-008 [P2] Retention cleanup was delete-bounded but not safely read/progress bounded

- **Status:** resolved
- **Bug class:** operational cost guardrail / bounded cleanup regression
- **Invariant:** a cleanup job added to reduce Convex operational cost must not perform full-table reads, and bounded scans must still make progress on terminal rows rather than being blocked by preserved active rows.
- **Root cause:** the initial cleanup collected whole retention tables and filtered in memory; the first bounded-read fix scanned by `createdAt`, which could be blocked by old unread notifications or pending email jobs.
- **Fix:** query retention candidates with indexed timestamp ranges and capped `take()` calls; scan notification terminal indexes (`readAt`, `archivedAt`, `emailedAt`), sent email jobs via `sentAt`, stale read-model versions via `updatedAt`, dedupe candidates, and keep failed email jobs on a capped createdAt fallback.
- **Verification:** cost guardrail tests now assert no collect-based retention reads, expected indexes/counts, active notification blockers do not hide terminal notification cleanup, old pending email jobs do not hide sent email cleanup, active records are preserved, delete limits are honored, typecheck/lint pass.

### Architecture assessment

Clean. The slice puts cost/ops utilities in an operations module, retention policy in the Convex maintenance authority, and relapse prevention in static/contract tests. The cleanup mutation is narrow, token-gated, dry-run first, index-backed, and bounded by both read and delete limits. No UI, route, or client helper now owns retention deletion policy.

### Recommendations

1. **Proceed:** start task 99.1 final validation, total-diff deep review, final architecture assessment, and PR delivery.
2. **Final review focus:** re-check that the cumulative branch still covers every original backlog item plus billing/cost and that no slice-level fix regressed another slice.
3. **Operational follow-up:** if failed unsent email-job retention volume becomes material, add a failure timestamp/index in a future schema slice rather than broadening this cleanup job.

## Turn 8 - 2026-06-03 12:43:03 BST

| Field | Value |
|-------|-------|
| **Commit** | `b820518d` with uncommitted working tree |
| **IDE / Agent** | Codex |

**Summary:** Completed slice 8.1 by changing non-chat comment actions to Reply/reply-icon behavior without quote insertion, preserving direct chat Quote behavior, raising profile hover-card layering, replacing the offline X glyph with a plain decorative status dot, and adding denser profile activity details for comment previews, status transitions, label changes, assignee changes, and project updates.

**Outcome:** all clear for slice 8.1 after deep-review findings were fixed and normal re-review/architecture assessment were clean. Browser smoke is intentionally user-owned manual validation.

**Risk score:** medium-high - this slice changes shared message action rendering, channel/work item comment interactions, profile hover layering, and profile activity presentation.

**Change archetypes:** shared UI primitive, interaction contract, presentation view model, accessibility layering/status polish, regression tests.

**Intended change:** satisfy REQ-POLISH-001 through existing owners: shared hover action primitive for icon/label semantics, channel/work-item comment surfaces for reply composer behavior, direct chat thread for quote preservation, user-presence for hover/status rendering, and people profile UI for activity detail density.

**Intent vs actual:** implementation matches task 8.1. No backend write or read-model path was added; backend relevance was checked and the needed activity data already exists in the current app snapshot/read model.

**Confidence:** medium-high for this slice. Focused component tests, typecheck, lint, spec checks, and diff whitespace checks passed. Manual browser smoke remains user-owned for visual layering/fit.

**Coverage note:** reviewed channel post/comment actions, work-item inline comments, work-item detail activity comments/replies, direct chat quote availability, user hover-card portal class, status dot rendering, and people profile activity detail.

**Finding triage:** one live deep-review finding was found and fixed: initial reply open handlers cleared existing draft content and the offline dot used an aria label that could pollute parent accessible names.

**Static/analyzer evidence:** focused Vitest, `pnpm exec tsc --noEmit --pretty false`, `pnpm lint`, spec lint, strict traceability, and `git diff --check` passed.

**Architecture impact:** keeps the reply-vs-quote rule in the shared action primitive plus owning surface handlers; keeps profile activity detail in profile presentation/view-model helpers using domain-selected records; keeps status/hover layering in the user-presence primitive; no new shared business helper or backend bypass was introduced.

**Deep-review evidence:** dual pass completed. Correctness/safety checked quote removal in non-chat surfaces, chat quote preservation, no quote content insertion, draft preservation, accessible-name side effects, and profile hover layering. Maintainability/structure accepted the narrow shared primitive option and owner-local activity helpers.

**Bug classes / invariants checked:** shared action semantic drift, draft preservation, non-chat quote insertion, direct chat quote retention, hover layering/z-index, decorative status indicators, activity detail completeness, and existing domain/read-model data availability.

**Branch totality:** this turn reviewed the 8.1 slice within the cumulative dirty worktree. Earlier slices remain recorded in prior turns.

**Sibling closure:** channel posts/comments, work item inline comments, work item detail main/reply comments, chat messages, profile hover cards, sidebar/avatar status dots, and people profile activity were checked through code and tests.

**Remediation impact surface:** changes are presentation/UI interaction only. No schema/API/storage changes. Activity detail uses existing comments, work item activities, labels, users, and project updates in the current data model.

**Residual risk / unknowns:** manual browser smoke should confirm hover cards render above real chat/channel/work surfaces and that activity row density fits in production content.

### Validation

- `pnpm exec vitest run tests/components/channel-ui.test.tsx tests/components/work-item-ui-comments-inline.test.tsx tests/components/chat-thread.test.tsx tests/components/user-presence.test.tsx tests/components/people-screen.test.tsx` - passed, 5 files / 41 tests
- `pnpm exec tsc --noEmit --pretty false` - passed
- `pnpm lint` - passed
- `python3 ~/.codex/skills/spec-driven-development/scripts/lint_spec.py --spec-dir .spec/backlog-regression-performance-stability` - passed
- `python3 ~/.codex/skills/spec-driven-development/scripts/traceability_report.py --spec-dir .spec/backlog-regression-performance-stability --strict` - passed
- `git diff --check` - passed
- Browser smoke - intentionally not run by Codex; user-owned manual validation per instruction

### Branch-totality proof

- **Non-delta files/systems re-read:** DES-013/DES-015, REQ-POLISH-001/REQ-KNOWLEDGE-001, task 8.1, channel UI/primitives, work-item comments/detail comments, chat thread, user presence, people profile, and related tests.
- **Prior open findings rechecked:** no open findings existed from Turns 1-7.
- **Prior resolved/adjacent areas revalidated:** direct chat metadata/link/grouping tests still pass; project icon test in the touched work-item inline test remains passing.
- **Hotspots or sibling paths revisited:** non-chat reply semantics, direct chat quote, hover-card z-index, offline status glyph, and profile activity detail.
- **Dependency/adjacent surfaces revalidated:** focused component tests, typecheck, lint, spec lint, strict traceability, and diff whitespace.
- **Why this is enough:** the slice is presentation/interaction focused and backend data already contains the needed comment/activity fields. Browser visual proof remains user-owned.

### Challenger pass

- `done` - assumed the reply change could still cause user-visible draft loss or accessibility regression. That pass found both the draft-clearing behavior and the aria-label status-dot issue; both were fixed and revalidated.

### Resolved / Carried / New findings

#### BRS-007 [P2] Reply opening could wipe drafts and offline dots could pollute accessible names

- **Status:** resolved
- **Bug class:** shared UI interaction / accessibility regression
- **Invariant:** opening a reply affordance must not insert quoted content or destroy an existing draft; decorative status dots must not change parent control names.
- **Root cause:** the first implementation cleared reply composer state while opening it and added an `aria-label` to a decorative offline dot for testability.
- **Fix:** reply open handlers now only open/show the composer, preserving any existing draft; the offline status dot is `aria-hidden` and renders no SVG/X glyph.
- **Verification:** focused component tests, typecheck, lint, and diff check passed.

### Architecture assessment

- Clean. The shared action primitive now supports a reply icon variant without moving surface behavior out of its owner. Channel/work-item comment surfaces own reply composer state. Chat remains the only quote insertion owner. Profile activity detail is a profile presentation view model over existing domain-selected data. User hover/status polish stays in the user-presence primitive.

### Recommendations

1. **Fix next:** start task 9.1 for static read-model/cost guardrails, polling default checks, diagnostics, retention cleanup, and Convex env targeting checks.
2. **Backend check:** for 9.1, trace Convex schema/functions, cleanup conventions, env usage, and static route guards before editing.
3. **Validation note:** continue recording browser smoke as user-owned manual validation.

## Turn 7 - 2026-06-03 12:32:00 BST

| Field | Value |
|-------|-------|
| **Commit** | `b820518d` with uncommitted working tree |
| **IDE / Agent** | Codex |

**Summary:** Completed slice 7.1 by stabilizing the left workspace chat conversation-list pane, adding left-pane collapse/expand, excluding deleted messages from previews, preserving pending sent chat messages through stale scoped read-model replacement/merge, compacting message metadata/read state, grouping same-sender messages across long gaps, and scoping chat link styling to anchors.

**Outcome:** all clear for slice 7.1 after one deep-review architecture/lint finding was fixed and re-reviewed. Browser smoke is intentionally user-owned manual validation.

**Risk score:** high - this slice changes shared chat UI, read-state presentation, optimistic send reconciliation, and scoped read-model merge behavior.

**Change archetypes:** optimistic-state reconciliation, scoped read-model merge, shared chat UI, persisted UI setting, preview selector, compact metadata, regression tests.

**Intended change:** satisfy REQ-CHAT-001 through the owning boundaries: pane layout in workspace chat UI, previews in the preview selector, disappearing messages in the store/read-model merge boundary, and metadata/link/grouping in chat thread rendering.

**Intent vs actual:** implementation matches task 7.1. The fix did not add backend writes or new read-model polling; it reuses existing Convex read-state filtering, existing `RichTextContent`, and existing send/read-state mutation paths.

**Confidence:** medium-high for this slice. Focused component/store/read-model tests, Convex/read-model tests, typecheck, lint, spec checks, and diff whitespace checks passed. Manual browser smoke remains user-owned.

**Coverage note:** reviewed left conversation-list pane sizing/collapse, details sidebar separation, preview latest-readable selection, send optimistic state, read-model pruning/merge/replace, read-state mutation guard, metadata rendering, sender grouping, and link rendering.

**Finding triage:** one live architecture/lint finding was found: persisted pane settings initially used a localStorage initial-state/layout-effect shape that could create hydration mismatch or set-state-in-effect render cascades. Fixed with `useSyncExternalStore` server snapshots plus local override state.

**Static/analyzer evidence:** targeted Vitest, Convex/read-model tests, `pnpm exec tsc --noEmit --pretty false`, `pnpm lint`, spec lint, strict traceability, and `git diff --check` passed.

**Architecture impact:** improves state ownership by protecting pending chat messages at the read-model merge boundary, keeps UI-only layout in chat components, avoids per-render read-state writes, and keeps Convex as the backend read-state authority.

**Deep-review evidence:** dual pass completed. Correctness/safety checked stale read-model replacement, deleted previews, read-state write suppression, collapse scope, and metadata behavior. Maintainability/structure found and fixed the pane persistence initialization issue.

**Bug classes / invariants checked:** optimistic message preservation, scoped replacement pruning, latest-readable preview, deleted-message readability, read-state write suppression, metadata non-duplication, sender grouping reset, anchor-only link styling, hydration-safe persisted UI settings.

**Branch totality:** this turn reviewed the 7.1 slice within the cumulative dirty worktree. Earlier cost/scoped/reference/performance/work-surface/property slices remain recorded in prior turns.

**Sibling closure:** workspace chat list pane, chat thread, conversation preview selector, app-store read-model merge, app-store conversation send/read-state actions, Convex read-state handler, and read-model route contracts were checked through code and tests.

**Remediation impact surface:** changes touch shared chat UI and app-store reconciliation. No schema/API changes. Pending chat markers are ephemeral store state and clear by sync token when send tasks settle.

**Residual risk / unknowns:** manual browser smoke should confirm real pane collapse ergonomics and metadata fit. Existing failed-send rollback behavior is unchanged; this slice prevents stale refresh disappearance while a send is pending.

### Validation

- `pnpm exec vitest run tests/components/chat-thread.test.tsx tests/components/workspace-chats-screen.test.tsx tests/lib/store/collaboration-conversation-actions.test.ts tests/lib/store/ui-slice.test.ts tests/lib/app-store-read-model-merge.test.ts` - passed, 5 files / 58 tests
- `pnpm exec vitest run tests/convex/chat-message-notifications.test.ts tests/convex/scoped-read-model-handlers.test.ts tests/app/api/read-model-route-contracts.test.ts` - passed, 3 files / 29 tests
- `pnpm exec tsc --noEmit --pretty false` - passed
- `pnpm lint` - passed
- `python3 ~/.codex/skills/spec-driven-development/scripts/lint_spec.py --spec-dir .spec/backlog-regression-performance-stability` - passed
- `python3 ~/.codex/skills/spec-driven-development/scripts/traceability_report.py --spec-dir .spec/backlog-regression-performance-stability --strict` - passed
- `git diff --check` - passed
- Browser smoke - intentionally not run by Codex; user-owned manual validation per instruction

### Branch-totality proof

- **Non-delta files/systems re-read:** DES-012/REQ-CHAT-001/task 7.1, chat thread, workspace chats screen, conversation list pane, preview selector, store conversation actions, UI read-model merge, Convex read states, read-model route contracts, and tests.
- **Prior open findings rechecked:** no open findings existed from Turns 1-6.
- **Prior resolved/adjacent areas revalidated:** cost read-state write suppression remains active; scoped read-model route contracts still pass; pending work item preservation pattern remains compatible with pending chat preservation.
- **Hotspots or sibling paths revisited:** optimistic send, stale scoped replacement, deleted previews, left-pane collapse only, read metadata, same-sender grouping, link styling, and read-state mutations.
- **Dependency/adjacent surfaces revalidated:** focused component/store tests, Convex tests, read-model route contracts, typecheck, lint, spec lint, traceability, and whitespace diff check.
- **Why this is enough:** the slice covers the reported chat root causes through the relevant UI and store/read-model owners. Manual browser smoke remains user-owned for visual/interaction feel.

### Challenger pass

- `done` - assumed the pane persistence fix still hid a render/hydration regression. That pass found the initial-state/layout-effect localStorage approach; it was fixed with `useSyncExternalStore` and revalidated by lint/typecheck/tests.

### Resolved / Carried / New findings

#### BRS-006 [P2] Persisted chat pane settings risked hydration drift or set-state-in-effect cascades

- **Status:** resolved
- **Bug class:** persisted UI setting / hydration-performance drift
- **Invariant:** persisted pane width/collapse state must not cause server/client hydration mismatch or synchronous effect state cascades.
- **Root cause:** the first implementation read `localStorage` in initial state, then attempted to fix hydration risk with layout-effect state updates, which lint correctly rejected as a cascading render risk.
- **Fix:** use `useSyncExternalStore` with server snapshots for persisted pane settings and separate local override state for user changes.
- **Verification:** focused chat tests, typecheck, lint, and diff check passed.

### Architecture assessment

- Clean. UI layout stays in chat presentation components, preview selection stays in the preview selector, pending message reconciliation stays in app-store read-model merge, read-state authority remains Convex-backed, and no new broad snapshot/polling/write amplification path was introduced.

### Recommendations

1. **Fix next:** start task 8.1 for reply-vs-quote semantics, profile hover layering, activity density, and the sidebar offline icon.
2. **Backend check:** continue checking backend/store owners where activity/profile/comment symptoms depend on persisted data or shared primitives.
3. **Validation note:** continue recording browser smoke as user-owned manual validation.

## Turn 6 - 2026-06-03 12:12:00 BST

| Field | Value |
|-------|-------|
| **Commit** | `b820518d` with uncommitted working tree |
| **IDE / Agent** | Codex |

**Summary:** Completed slice 6.1 by fixing project icon propagation, inherited inline child project display, document property pill placement/dedupe, sort popover trigger composition, and editable label property dropdowns. Also made the per-slice and final architecture assessment gates explicit in the spec.

**Outcome:** all clear for slice 6.1 after deep review, normal re-review, and slice architecture assessment. Browser smoke is intentionally user-owned manual validation.

**Risk score:** medium-high - this slice changes shared property UI, sort controls, document meta layout, and work-surface label editing behavior.

**Change archetypes:** shared UI control, property editor, display-property rendering, component composition/ref forwarding, private-scope negative guard, process/spec governance.

**Intended change:** satisfy REQ-PROPERTY-001 without creating new property authority: inherited project names/icons render where users create children, document pills move to the right and dedupe, sort opens, visible labels become editable where assignable, and private task rows do not expose workspace labels.

**Intent vs actual:** implementation matches task 6.1. The changes reuse `ProjectIconGlyph`, existing document display properties, the shared sort popover trigger, `useWorkItemLabelEditorState`, and the existing `updateWorkItem` mutation path.

**Confidence:** medium-high for this slice. Focused component tests, `pnpm typecheck`, `pnpm lint`, spec lint, strict traceability, and `git diff --check` passed. Manual browser smoke remains user-owned.

**Coverage note:** reviewed create-modal project trigger/options/footer, inline child composer inherited project chip, document display property rendering, sort chip trigger composition, label assignability/editing, private task negative behavior, and spec protocol changes.

**Finding triage:** no live Critical, High, or Medium findings were found in the slice review. During architecture assessment, private-task negative coverage was added to prove labels stay non-editable in private rows.

**Static/analyzer evidence:** targeted Vitest, `pnpm typecheck`, `pnpm lint`, spec lint, strict traceability, and `git diff --check` passed.

**Architecture impact:** keeps project icon/document/sort behavior in presentation owners, keeps label assignability in the existing label editor state hook, uses the store update authority for label persistence, and explicitly records architecture assessment as a per-slice/final review gate.

**Deep-review evidence:** dual pass completed. Correctness/safety checked project identity propagation, sort trigger opening, label persistence/assignability, and private task leakage. Maintainability/structure accepted the owner-local helpers and avoided a new property-control abstraction.

**Bug classes / invariants checked:** project identity propagation, configured display-property dedupe, popover trigger contract, label assignability, private task property leakage, and review-protocol enforcement.

**Branch totality:** this turn reviewed the 6.1 slice within the cumulative dirty worktree. Earlier cost/scoped/reference/performance/work-surface slices remain recorded in prior turns.

**Sibling closure:** create modal, inline child composer, document content row/meta, work-surface list rows/cards, private task rows, and sort popover trigger paths were checked through code and tests.

**Remediation impact surface:** changes touch shared UI/property components and tests; no schema/API changes. Label updates use the existing work item store mutation path.

**Residual risk / unknowns:** manual browser smoke should confirm exact visual placement and subjective interaction feel. Project option icon coverage is mostly through selected/inherited chip assertions because the same glyph component renders project options.

### Validation

- `pnpm exec vitest run tests/components/create-dialogs.test.tsx tests/components/work-item-ui-comments-inline.test.tsx tests/components/docs-content.test.tsx tests/components/group-chip-popover.test.tsx tests/components/work-surface-view.test.tsx` - passed, 5 files / 140 tests
- `pnpm exec vitest run tests/components/work-surface-view.test.tsx` - passed, 1 file / 94 tests after adding the private-task negative case
- `pnpm typecheck` - passed
- `pnpm lint` - passed
- `python3 ~/.codex/skills/spec-driven-development/scripts/lint_spec.py --spec-dir .spec/backlog-regression-performance-stability` - passed
- `python3 ~/.codex/skills/spec-driven-development/scripts/traceability_report.py --spec-dir .spec/backlog-regression-performance-stability --strict` - passed
- `git diff --check` - passed
- Browser smoke - intentionally not run by Codex; user-owned manual validation per instruction

### Branch-totality proof

- **Non-delta files/systems re-read:** REQ-PROPERTY-001/task 6.1, create dialog, inline child composer, document content, work-surface controls, work-surface label property display, private task display-property behavior, and spec protocol artifacts.
- **Prior open findings rechecked:** no open findings existed from Turns 1-5.
- **Prior resolved/adjacent areas revalidated:** work-surface private task protection remains compatible with editable label properties; create-modal performance changes remain compatible with project icon rendering.
- **Hotspots or sibling paths revisited:** project icon propagation, document property dedupe, sort trigger composition, label assignability, and private task leakage.
- **Dependency/adjacent surfaces revalidated:** component tests, typecheck, lint, spec lint, strict traceability, and diff whitespace.
- **Why this is enough:** the slice is UI/property-control focused and uses existing store/read-model data. Browser interaction proof is intentionally user-owned.

### Challenger pass

- `done` - assumed one private-scope path could still expose a workspace label dropdown. Added a negative private-task test and re-ran the work-surface suite; no live code finding remained.

### Resolved / Carried / New findings

- No new live findings.

### Architecture assessment

- Clean. Presentation changes are owner-local, label persistence stays in the existing store/domain path, private task protection is tested, no new backend/read-model bypass was added, and the spec now requires architecture assessment after each clean slice review loop plus at final full-diff review.

### Recommendations

1. **Fix next:** start task 7.1 for chat panel stability/collapse, deleted previews, disappearing message reconciliation, compact message metadata/read receipts, same-sender grouping, and link styling.
2. **Backend check:** trace conversation read-model, Convex chat messages/read states, and optimistic store merge before treating disappearing messages as a frontend-only symptom.
3. **Validation note:** continue recording browser smoke as user-owned manual validation.

## Turn 5 - 2026-06-03 11:44:00 BST

| Field | Value |
|-------|-------|
| **Commit** | `b820518d` with uncommitted working tree |
| **IDE / Agent** | Codex |

**Summary:** Completed slice 5.1 by fixing work-surface selection placement/visual treatment, parent-filter descendant cascade, my-items assigned-descendant filter lifting, private-task team grouping leakage, selected-item bulk delete, and stale read-model overwrites of pending optimistic work item status.

**Outcome:** all clear for slice 5.1 after the deep review found one live assigned-descendant bypass and that finding was fixed and re-reviewed. Browser smoke is intentionally user-owned manual validation.

**Risk score:** high - this slice changes shared work item selectors, selection UI primitives, bulk destructive actions, private-view compatibility, and optimistic read-model reconciliation.

**Change archetypes:** shared selector, shared UI primitive, batch/destructive action, private-scope filtering, optimistic-state reconciliation, regression tests.

**Intended change:** satisfy REQ-WORKSURFACE-001 across the shared owner paths rather than one screen: selection boxes sit with the item identity/PVT cluster and use gray/black styling; parent filters cascade to descendants; my-items assigned-descendant views honor active filters; private tasks do not expose team/workspace grouping; selected bulk delete works; stale read models do not bounce pending status updates.

**Intent vs actual:** implementation matches task 5.1. The fixes landed in canonical owners: `work-item-selection`, `work-surface-view`, `work-item-menus`, `work-surface`, domain work-item selectors, and UI read-model merge reconciliation.

**Confidence:** medium-high for this slice. Focused selector/component/menu/store tests, `pnpm typecheck`, `pnpm lint`, and `git diff --check` passed. Manual browser smoke remains user-owned.

**Coverage note:** reviewed list/board/child selection target sets, context-menu bulk targets, parent filter selectors, assigned-descendant my-items lifting, private task view compatibility, bulk delete confirmation, work-item update/delete store behavior, and stale read-model merge paths.

**Finding triage:** one live P1/P2 hybrid finding was found in deep review: assigned-descendant container lifting could ignore active filters before lifting my-items containers. It was fixed and regression-tested. No Critical, High, or Medium finding remains after normal re-review.

**Static/analyzer evidence:** targeted Vitest, `pnpm typecheck`, `pnpm lint`, and `git diff --check` passed. Browser smoke intentionally not run by Codex.

**Architecture impact:** improves ownership by putting descendant filter semantics in the domain selector, optimistic overwrite protection in the UI-store merge boundary, private task group exclusion in work-surface view compatibility, and selection visuals in the shared selection primitive.

**Deep-review evidence:** dual pass completed. Correctness/safety found the assigned-descendant filter bypass and checked bulk delete, optimistic merge, private scoping, and selector variants. Maintainability/structure accepted the small owner-local helpers and rejected screen-specific patches.

**Bug classes / invariants checked:** visible target-set authority, parent/descendant filter cascade, assigned-descendant container lifting, private task grouping/display property leakage, pending optimistic status preservation, selected-item destructive action fan-out, and row layout stability.

**Branch totality:** this turn reviewed the 5.1 slice within the cumulative dirty worktree. Earlier cost/scoped/reference/performance slices remain recorded in prior turns.

**Sibling closure:** board cards, list rows, expanded board children, assigned my-items board/list, private task fallback views, context/dropdown menus, and scoped/full read-model merge paths were checked through code and tests.

**Remediation impact surface:** changes touch shared UI and domain/store owners; no schema/API changes. Bulk delete reuses the existing `deleteWorkItem` authority for each selected item.

**Residual risk / unknowns:** manual browser smoke should confirm visual alignment and subjective hover behavior in real board/list surfaces. Bulk delete is sequential and each item still relies on existing per-item delete validation/toasts; no backend batch mutation was added because no measured backend batch limit was found in this slice.

### Validation

- `pnpm exec vitest run tests/lib/domain/view-item-level.test.ts tests/components/work-surface-view.test.tsx tests/components/work-surface.test.tsx` - passed, 3 files / 129 tests
- `pnpm exec vitest run tests/components/work-item-menus.test.tsx tests/lib/store/ui-slice.test.ts tests/lib/store/work-item-actions.test.ts` - passed, 3 files / 37 tests
- `pnpm typecheck` - passed
- `pnpm lint` - passed
- `git diff --check` - passed
- Browser smoke - intentionally not run by Codex; user-owned manual validation per instruction

### Branch-totality proof

- **Non-delta files/systems re-read:** REQ-WORKSURFACE-001/task 5.1, prior surface-editor review notes, work-surface selectors, work-surface rendering, selection controller, menu bulk actions, private view compatibility, UI read-model merge, and work-item update/delete store paths.
- **Prior open findings rechecked:** no open findings existed from Turns 1-4.
- **Prior resolved/adjacent areas revalidated:** prior visible-row selection tests still pass; scoped read-model changes remain separate but the UI merge path now protects pending work item updates.
- **Hotspots or sibling paths revisited:** list rows, board cards, expanded board child rows, assigned-descendant my-items surfaces, private task views, context-menu target sets, and stale read-model reconciliation.
- **Dependency/adjacent surfaces revalidated:** selector tests, component tests, menu tests, UI-store merge tests, work-item action tests, typecheck, lint, and diff whitespace.
- **Why this is enough:** the slice changes shared owners with direct regression tests for the reported behaviors and the deep-review-found bypass. Full manual UX/browser smoke is intentionally owned by the user.

### Challenger pass

- `done` - assumed one sibling surface still bypassed the parent-filter fix. That pass found assigned-descendant container lifting did not filter descendants before lifting containers. Fixed by applying `itemMatchesView(..., ignoreItemLevel: true)` before resolving the container and adding a regression test.

### Resolved / Carried / New findings

#### BRS-005 [P1] Assigned-descendant my-items containers could ignore active filters before lifting

- **Status:** resolved
- **Bug class:** selector bypass / filtered-container drift
- **Invariant:** my-items assigned-descendant surfaces must filter the assigned row against the active view before lifting an ancestor/container row into the rendered surface.
- **Root cause:** `getAssignedDescendantContainerIds` lifted each `matchItems` entry to its container without first checking `itemMatchesView`, so filters such as parent/status could be bypassed on my-items board/list variants.
- **Fix:** filter each candidate descendant with `itemMatchesView(data, item, view, { ignoreItemLevel: true })` before resolving the visible container.
- **Verification:** `tests/lib/domain/view-item-level.test.ts` now covers the negative parent-filter case; full focused surface and store/menu suites passed.

### Recommendations

1. **Fix next:** start task 6.1 for inherited project display/icons, document pills, sort, labels, and property controls, including the work item detail sub-task project icon path.
2. **Then address:** keep checking backend/store owners for every remaining UI symptom where read models, optimistic updates, or persistence can contribute.
3. **Validation note:** continue recording browser smoke as user-owned manual validation.

## Turn 4 - 2026-06-03 11:25:29 BST

| Field | Value |
|-------|-------|
| **Commit** | `b820518d` with uncommitted working tree |
| **IDE / Agent** | Codex |

**Summary:** Completed slice 4.2 by moving create-modal title/description typing out of the root dialog render path while revalidating existing work item detail TipTap and retained read-model diagnostics.

**Outcome:** all clear for slice 4.2 after one deep-review finding was fixed and re-reviewed. Browser smoke is intentionally user-owned manual validation.

**Risk score:** medium-high - this slice changes create dialog draft ownership and submit-time behavior, and audits adjacent editor/read-model performance paths.

**Change archetypes:** performance, shared modal state, input hot path, validation contract, retained-data diagnostics, regression test.

**Intended change:** reduce create-modal typing lag and avoid repeating old TipTap/read-model fixes blindly by checking current work item editor and scoped refresh evidence.

**Intent vs actual:** implementation matches task 4.2. Title/description drafts now live in the field component and refs; the root dialog only tracks title submit eligibility transitions. The latest draft is still used for create and description persistence.

**Confidence:** medium-high for this slice. Focused component/runtime tests, typecheck, lint, spec checks, and diff whitespace checks passed. Subjective browser feel remains user-owned manual validation.

**Coverage note:** reviewed create dialog draft ownership, submit/close/reset paths, work item detail editor rerender tests, scoped read-model first-useful-render diagnostics, prior performance specs, and backend/read-model ownership from the preceding slices.

**Finding triage:** one live performance/lint finding was found in deep review and fixed. No Critical, High, or Medium finding remains after normal re-review.

**Static/analyzer evidence:** targeted Vitest, `pnpm typecheck`, `pnpm lint`, spec lint, strict traceability, and `git diff --check` passed.

**Architecture impact:** keeps per-keystroke draft display local to the field component, keeps validation transitions in the root dialog, and keeps persistence at the existing create/update store boundary.

**Deep-review evidence:** dual pass completed. Correctness/safety checked latest submit data, close/reset behavior, command-submit path, and description persistence. Maintainability/structure rejected effect-based reset because it caused cascading render lint failures and contradicted the performance goal.

**Bug classes / invariants checked:** input hot-path render fan-out, latest draft submit correctness, dialog close reset, title validation transitions, existing TipTap detail rerender protection, and retained read-model first useful render diagnostics.

**Branch totality:** this turn reviewed the 4.2 slice within the cumulative dirty worktree. Earlier cost/scoped/reference changes remain recorded in prior turns.

**Sibling closure:** work item detail title/description editor protections were revalidated; scoped read-model first-useful-render diagnostics were revalidated; backend changes were not needed for this create-modal local render root cause after tasks 2.1 and 3.1.

**Remediation impact surface:** fixes are limited to create work item dialog draft ownership and focused tests; no schema/API changes.

**Residual risk / unknowns:** manual browser smoke should confirm perceived typing, dropdown, and navigation feel. Work-surface status bounce/private leakage/bulk behavior remain task 5.1.

### Validation

- `pnpm exec vitest run tests/components/create-dialogs.test.tsx` - passed, 1 file / 33 tests
- `pnpm exec vitest run tests/components/work-item-detail-screen.test.tsx -t "does not rerender the description editor"` - passed, 1 file / 2 selected tests
- `pnpm exec vitest run tests/lib/use-scoped-read-model-refresh.test.tsx -t "first useful render"` - passed, 1 file / 1 selected test
- `pnpm typecheck` - passed
- `pnpm lint` - passed
- `python3 ~/.codex/skills/spec-driven-development/scripts/lint_spec.py --spec-dir .spec/backlog-regression-performance-stability` - passed
- `python3 ~/.codex/skills/spec-driven-development/scripts/traceability_report.py --spec-dir .spec/backlog-regression-performance-stability --strict` - passed
- `git diff --check` - passed
- Browser smoke - intentionally not run by Codex; user-owned manual validation per instruction

### Branch-totality proof

- **Non-delta files/systems re-read:** prior performance specs/reviews, create dialog, work item detail editor hot path tests, scoped refresh diagnostics, and spec requirements/tasks.
- **Prior open findings rechecked:** no open findings existed from Turns 1-3.
- **Prior resolved/adjacent areas revalidated:** scoped read-model migration and polling containment remain separate; their diagnostics are used as supporting performance evidence.
- **Hotspots or sibling paths revisited:** create modal title/description typing, create dropdown/property rows, work item detail title/description editor, retained first useful render hook.
- **Dependency/adjacent surfaces revalidated:** create item store call, description update call, command submit hook, close/cancel reset path, typecheck, lint, and focused tests.
- **Why this is enough:** the live edited code is local UI hot-path state; broader subjective browser performance is intentionally user-owned and later work-surface behavioral issues have their own slice.

### Challenger pass

- `done` - assumed the reset implementation could reintroduce render churn. That pass found synchronous state resets in effects, fixed by resetting on dialog close/create/cancel and keying the local field subtree.

### Resolved / Carried / New findings

#### BRS-004 [P2] Effect-based create-dialog draft reset reintroduced cascading renders

- **Status:** resolved
- **Bug class:** performance / render cascade
- **Invariant:** a performance slice must not reset create-modal draft state through synchronous effects that add extra render passes.
- **Fix:** moved reset to the dialog close/create/cancel boundary and removed the effect-based local reset.
- **Verification:** `pnpm lint`, `pnpm typecheck`, and create-dialog regression tests passed.

### Recommendations

1. **Fix next:** start task 5.1 for work-surface correctness: selection placement, parent cascade, private leakage, filtered bounce, and bulk action behavior.
2. **Then address:** task 6.1 must include the new work item detail sub-task project icon path, specifically `InlineChildIssueComposer`.
3. **Validation note:** keep recording browser smoke as user-owned manual validation.

## Turn 3 - 2026-06-03 11:11:06 BST

| Field | Value |
|-------|-------|
| **Commit** | `b820518d` with uncommitted working tree |
| **IDE / Agent** | Codex |

**Summary:** Completed slice 4.1 by making the slash-command Reference picker a durable explicit picker state instead of a transient state that editor selection sync could immediately collapse.

**Outcome:** all clear for slice 4.1 after deep review and normal re-review. Browser smoke is intentionally user-owned manual validation per the latest instruction.

**Risk score:** medium-high - this slice changes shared TipTap menu state and command/menu behavior used by document and work item editors.

**Change archetypes:** shared UI state, editor command behavior, focus/selection preservation, scoped candidate access, regression test.

**Intended change:** selecting `Reference` from typed `/` or the rendered slash-command UI opens the scoped Reference search mode for document and work item editors without being closed by the `#` trigger state detector.

**Intent vs actual:** implementation matches task 4.1. `buildReferencePickerState` now marks command-launched reference search as `mode: "picker"`, editor menu sync preserves that picker state, and tests cover rendered slash-command selection plus explicit picker tagging.

**Confidence:** medium-high for this slice. Focused editor/reference tests, typecheck, lint, and prior spec checks passed; manual browser smoke remains user-owned.

**Coverage note:** reviewed rich-text menu helpers, editor menu state orchestration, Reference menu insertion, rendered slash command tests, document/work item caller candidate paths, and the domain reference candidate selector.

**Finding triage:** no live Critical, High, or Medium findings found. No new unresolved findings were introduced.

**Static/analyzer evidence:** targeted Vitest, `pnpm typecheck`, `pnpm lint`, spec lint, strict traceability, and diff whitespace checks passed.

**Architecture impact:** keeps command and picker lifetime in the existing editor presentation/state boundary while leaving access and scope filtering in the domain selector/read-model data path.

**Deep-review evidence:** dual pass completed. Correctness/safety checked picker lifetime, selection/insertion path, scoped candidate exclusions, and document/work item callers. Maintainability/structure accepted the small explicit mode flag over a new component/state system.

**Bug classes / invariants checked:** command-launched modal lifetime, editor selection preservation, typed slash/rendered slash UI parity, reference candidate access scope, people/create action exclusion, and sibling editor caller coverage.

**Branch totality:** this turn reviewed the current 4.1 slice in the cumulative dirty worktree. Prior 2.1 and 3.1 changes remain recorded separately and were not re-cleared as part of this slice.

**Sibling closure:** toolbar code was checked and no separate Reference slash button exists; the current slash-button equivalent is the rendered slash-command menu. Document detail and work item/comment editors already pass scoped reference candidates.

**Remediation impact surface:** fixes are limited to shared rich-text editor menu state/helpers and focused editor helper tests.

**Residual risk / unknowns:** user-owned manual browser smoke should confirm real document and work item editor focus/selection behavior in the running app.

### Validation

- `pnpm exec vitest run tests/components/rich-text-editor-helpers.test.tsx tests/lib/domain/rich-text-references.test.ts tests/lib/content/rich-text-references.test.ts` - passed, 3 files / 28 tests
- `pnpm typecheck` - passed
- `pnpm lint` - passed
- `python3 ~/.codex/skills/spec-driven-development/scripts/lint_spec.py --spec-dir .spec/backlog-regression-performance-stability` - passed
- `python3 ~/.codex/skills/spec-driven-development/scripts/traceability_report.py --spec-dir .spec/backlog-regression-performance-stability --strict` - passed
- `git diff --check` - passed
- Browser smoke - intentionally not run by Codex; user-owned manual validation per instruction

### Branch-totality proof

- **Non-delta files/systems re-read:** diff-review gates, architecture standards, rich-text editor state orchestration, menu helpers, Reference menu insertion, toolbar actions, document detail caller, work item caller, and reference selector tests.
- **Prior open findings rechecked:** no open findings existed from Turns 1-2.
- **Prior resolved/adjacent areas revalidated:** scoped read-model migration remains separate; this slice checked that reference candidates are still scoped by the existing selector/data path.
- **Hotspots or sibling paths revisited:** typed slash, rendered slash-command UI, `#` trigger reference state, document editor callers, work item editor/comment callers, and candidate kind filtering.
- **Dependency/adjacent surfaces revalidated:** targeted editor/reference tests, lint, typecheck, and manual review of sibling editor entry points.
- **Why this is enough:** the bug root cause was local editor state lifetime; backend and read-model candidate paths were checked but did not require code changes.

### Challenger pass

- `done` - assumed the command-launched picker could still be cleared by the next editor update. The pass confirmed picker state is now synchronously reflected in `referenceStateRef` before React state settles, so `syncCommandMenus` preserves it.

### Resolved / Carried / New findings

- No new findings.

### Recommendations

1. **Fix next:** start task 4.2 performance/TipTap deep dive with baseline notes and backend/read-model/store fan-out checks.
2. **Then address:** use the 4.2 performance findings to avoid regurgitating previous TipTap/surface fixes that did not hold.
3. **Validation note:** record manual browser-smoke ownership in every UI slice review and PR body.

## Turn 2 - 2026-06-03 10:56:40 BST

| Field | Value |
|-------|-------|
| **Commit** | `b820518d` with uncommitted working tree |
| **IDE / Agent** | Codex |

**Summary:** Completed slice 3.1 by moving read-model routes and mutation scope-key resolution off broad app snapshots and into Convex scoped read queries.

**Outcome:** all clear for slice 3.1 after one deep-review finding was fixed and re-reviewed.

**Risk score:** high - this slice changes API read-model internals, backend authorization, mutation invalidation scope-key resolution, and cost-critical Convex query shape.

**Change archetypes:** API contract preservation, auth/tenancy, data-access refactor, cost/performance, backend read-model migration, static guardrail.

**Intended change:** remove snapshot-backed reads from read-model routes/server helpers, preserve route response contracts, move scoped read-model authority to Convex, and prevent reintroduction of `getSnapshotServer` in read-model paths.

**Intent vs actual:** implementation matches task 3.1. Read-model routes now pass typed instructions to `getScopedReadModelServer`; server mutation helpers resolve/authorize scope keys through Convex; channel-post routes no longer load a full snapshot for invalidations; static tests fail if snapshot helpers return to read-model route/server-handler paths.

**Confidence:** medium-high for this slice. Focused route/server/Convex handler tests, lint, typecheck, spec checks, and snapshot static guard passed. Production cost impact still needs Convex Insights verification after deploy.

**Coverage note:** reviewed the Convex scoped-read-model handler, read-model route handlers, all migrated read-model routes, server invalidation helpers, channel-post mutation routes, access behavior, scope-key parsing, selectors, and focused tests.

**Finding triage:** one live backend authorization/overread finding was found in deep review and fixed. No Critical, High, or Medium finding remains after normal re-review.

**Static/analyzer evidence:** targeted Vitest, `pnpm typecheck`, `pnpm lint`, spec lint, strict traceability, `git diff --check`, and the static snapshot guard passed.

**Architecture impact:** moves the cost and auth invariant to the Convex data boundary, keeps Next routes thin, and adds a static prevention rule for fake-scoped snapshot reads.

**Deep-review evidence:** dual pass completed. Correctness/safety found collection-scope authorization/overread drift. Maintainability/structure accepted the Convex-owned scoped query module as the narrowest durable boundary for this migration, with pagination/bounds carried as follow-up guardrail work where UX requires it.

**Bug classes / invariants checked:** tenant/team/workspace scope authorization, missing-target behavior, detail route 404 compatibility, route response shape compatibility, mutation invalidation key resolution, forbidden snapshot import guard, and collection-scope proof.

**Branch totality:** this turn reviewed the current 3.1 slice in the cumulative dirty worktree. Prior 2.1 changes remain recorded separately and were not re-cleared as part of this slice.

**Sibling closure:** document/work/project/view/workspace/search/notification/conversation/channel read-model routes and mutation scope-key resolvers were swept; workspace membership bootstrap remains on an existing narrow helper.

**Remediation impact surface:** fixes are limited to Convex scoped read-model queries, Next read-model route handlers, server invalidation helpers, channel-post invalidation routes, and focused tests.

**Residual risk / unknowns:** large lists still need pagination/bounded-read enforcement in later guardrail/performance work. Browser smoke is deferred to UI slices and the final full validation loop.

### Validation

- `pnpm exec vitest run tests/app/api/read-model-route-contracts.test.ts tests/app/api/read-model-static-guards.test.ts tests/lib/server/scoped-read-models.test.ts tests/convex/scoped-read-model-handlers.test.ts` - passed, 4 files / 25 tests
- `pnpm typecheck` - passed
- `pnpm lint` - passed
- `python3 ~/.codex/skills/spec-driven-development/scripts/lint_spec.py --spec-dir .spec/backlog-regression-performance-stability` - passed
- `python3 ~/.codex/skills/spec-driven-development/scripts/traceability_report.py --spec-dir .spec/backlog-regression-performance-stability --strict` - passed
- `git diff --check` - passed
- `rg -n "getSnapshotServer|loadScopedReadModelSnapshotForSession" app/api/read-models lib/server/scoped-read-models.ts lib/server/scoped-read-model-route-handlers.ts` - no matches

### Branch-totality proof

- **Non-delta files/systems re-read:** diff-review gates, architecture standards, read-model routes, Convex scoped-read handlers, server Convex wrappers, scope-key helpers, scoped-sync selectors, channel-post routes, and tests.
- **Prior open findings rechecked:** no open findings existed from Turn 1.
- **Prior resolved/adjacent areas revalidated:** the static guard confirms the prior broad snapshot read concern is now closed for read-model routes/server handlers.
- **Hotspots or sibling paths revisited:** every read-model route family and mutation invalidation resolver targeted by REQ-SCOPED-001.
- **Dependency/adjacent surfaces revalidated:** route response compatibility tests, server helper tests, Convex handler test, static guard, lint, typecheck, and spec traceability.
- **Why this is enough:** the slice is backend/API migration work; UI browser smoke is not required until presentation slices and final validation.

### Challenger pass

- `done` - assumed one backend authorization issue remained. That pass found that forbidden collection scopes could be treated as empty and some team collection loaders could read before proving scope access; the guard was fixed and regression-tested.

### Resolved / Carried / New findings

#### BRS-003 [P1] Unauthorized collection scopes could read or authorize through empty scoped data

- **Status:** resolved
- **Bug class:** auth/tenancy boundary / backend overread
- **Invariant:** team/workspace/personal collection read models must prove the requested scope is accessible before reading scoped data and before authorizing a scope key.
- **Fix:** added `isAccessibleCollectionScope` to guard collection loaders, and added collection-scope proof in `readModelDataAuthorizesScope` using the canonical scoped collection scope id.
- **Verification:** Convex handler regression test proves forbidden team work-index scope fails without reading that team, while an accessible team scope succeeds.

### Recommendations

1. **Fix next:** start task 4.1 for slash Reference scoped search, checking both document and work item editor command paths.
2. **Then address:** task 4.2 should use the now-narrower read-model behavior as part of performance root-cause analysis.
3. **Patterns noticed:** backend scope ownership is necessary even when the visible bug looks like a route/UI issue.
4. **Suggested approach:** keep using static guardrails for architecture rules that already regressed once.

## Turn 1 - 2026-06-03 10:20:17 BST

| Field | Value |
|-------|-------|
| **Commit** | `b820518d` with uncommitted working tree |
| **IDE / Agent** | Codex |

**Summary:** Completed slice 2.1 for immediate Convex cost containment, then ran the required deep diff-review with architecture-standards and a normal re-review after fixing live findings.

**Outcome:** all clear for slice 2.1 only. Stop here per the user instruction to stop after each slice/requirement.

**Risk score:** high - this slice changes realtime polling cadence, client refresh semantics, and Convex read-state write suppression.

**Change archetypes:** performance, realtime fallback, optimistic-state, persistence contracts, idempotent mutation, feature flag/legacy containment, spec-guided delivery.

**Intended change:** reduce idle/reconnect Convex call amplification and redundant chat read-state writes without prematurely replacing every snapshot-backed read model in the same slice.

**Intent vs actual:** implementation matches task 2.1. Scoped and legacy event streams no longer poll at one second, ready/unavailable retries are less aggressive, unchanged reconnect-ready events no longer refresh every subscriber, foreground refreshes are staleness gated, and chat read/unread mutations are suppressed when state is already current. Full scoped read-model replacement remains task 3.1.

**Confidence:** medium-high for this slice because focused tests, typecheck, lint, spec lint, traceability, and review passes cover the changed contracts. Production cost reduction still needs Convex Insights/log confirmation after deployment.

**Coverage note:** reviewed the slice diff and owner paths for stream route cadence, hook refresh behavior, legacy snapshot diagnostics, client store read-state suppression, Convex mutation idempotency, domain receipt helpers, and focused regression tests.

**Finding triage:** two live correctness findings were found during deep review and both are fixed with regression coverage. No Critical, High, or Medium finding remains for this slice after normal re-review.

**Static/analyzer evidence:** focused Vitest, `pnpm typecheck`, `pnpm lint`, spec lint, strict traceability, and `git diff --check` passed. No Fallow or browser smoke was used for this backend/hook/store slice.

**Architecture impact:** improves current-state architecture by centralizing realtime cost policy, keeping refresh ownership in the scoped hook, and making Convex idempotency a backstop for older clients or retries. The fake-scoped read-model migration is intentionally left to its own owner-local slice.

**Deep-review evidence:** dual pass completed. Correctness/safety found and fixed failed-refresh retry drift and legacy notification cleanup drift. Maintainability/structure found no remaining blocker after the shared policy module, scoped hook authority, and server idempotency boundaries were rechecked.

**Bug classes / invariants checked:** polling interval clamps, retry cadence, reconnect-ready refresh fan-out, failed refresh recovery, degraded fallback cadence, foreground staleness gating, duplicate receipt filtering, unchanged read/unread mutation no-ops, and legacy notification cleanup.

**Branch totality:** this turn reviewed the whole current slice worktree, including untracked new files for realtime cost policy and its focused test, plus the updated spec package records.

**Sibling closure:** scoped stream and legacy snapshot stream were both updated; client suppression and Convex idempotency were both updated; ready, invalidate, unavailable, focus, and online refresh paths were all rechecked.

**Remediation impact surface:** fixes are limited to realtime stream cadence, scoped refresh orchestration, snapshot diagnostics, chat read-state domain/store/Convex handling, and focused tests.

**Residual risk / unknowns:** broad snapshot-backed read-model routes and global snapshot invalidation remain expensive until the next cost slice. Browser smoke was not run because this slice is backend/hook/store behavior with targeted contract coverage.

### Validation

- `pnpm exec vitest run tests/lib/realtime-cost-policy.test.ts tests/app/api/scoped-events-route-contracts.test.ts tests/lib/use-scoped-read-model-refresh.test.tsx tests/lib/store/collaboration-conversation-actions.test.ts tests/convex/chat-message-notifications.test.ts tests/components/convex-app-provider.test.tsx` - passed, 6 files / 49 tests
- `pnpm typecheck` - passed
- `pnpm lint` - passed
- `python3 ~/.codex/skills/spec-driven-development/scripts/lint_spec.py --spec-dir .spec/backlog-regression-performance-stability` - passed
- `python3 ~/.codex/skills/spec-driven-development/scripts/traceability_report.py --spec-dir .spec/backlog-regression-performance-stability --strict` - passed
- `git diff --check` - passed

### Branch-totality proof

- **Non-delta files/systems re-read:** diff-review gates, architecture review rules, spec tasks/reviews, scoped event stream route, snapshot event stream route, scoped refresh hook, snapshot diagnostics, Convex read-state mutation, store conversation actions, domain read-state helpers, and focused tests.
- **Prior open findings rechecked:** no prior repo-level open findings existed for this content area.
- **Prior resolved/adjacent areas revalidated:** review-protocol bootstrap and three-pass pre-plan coverage audit remain recorded in the spec ledger.
- **Hotspots or sibling paths revisited:** scoped and legacy streams, client reconnect/focus/online refresh triggers, degraded fallback loop, store and Convex read-state suppression, and legacy notification cleanup.
- **Dependency/adjacent surfaces revalidated:** production diagnostics provider, route contract tests, hook tests, store tests, Convex tests, lint, typecheck, and spec traceability.
- **Why this is enough:** the slice intentionally contains immediate containment only; the remaining cost architecture work has a separate task and should not be mixed into this review clearance.

### Challenger pass

- `done` - assumed one reconnect/read-state correctness issue remained after the initial implementation. That pass found the failed-refresh retry bug and legacy notification cleanup bug; both were fixed and rechecked.

### Resolved / Carried / New findings

#### BRS-001 [P1] Failed scoped refresh could stop retrying on unchanged ready events

- **Status:** resolved
- **Bug class:** fallback-state / realtime recovery
- **Invariant:** a failed scoped read-model refresh must retry on a later ready event even if the server version envelope has not changed again.
- **Fix:** added `lastRefreshFailedRef` so unchanged ready events retry after a failed refresh while still suppressing ordinary unchanged reconnect fan-out.
- **Verification:** hook regression test covers a failed refresh followed by a same-version ready event.

#### BRS-002 [P1] Server read-state no-op skipped legacy notification cleanup

- **Status:** resolved
- **Bug class:** idempotent mutation / stale notification cleanup
- **Invariant:** suppressing an unchanged chat read-state patch must not leave legacy unread chat notifications visible.
- **Fix:** `markChatConversationRead` still runs legacy notification cleanup before returning the unchanged existing read-state document.
- **Verification:** Convex regression test covers unchanged read-state with legacy notification cleanup.

### Recommendations

1. **Fix first:** start task 3.1 next, replacing the highest-cost snapshot-backed read-model routes with real scoped Convex queries.
2. **Then address:** confirm deployed call and DB I/O reduction in Convex Insights after this containment slice lands.
3. **Patterns noticed:** cost problems were caused by repeated reads and write invalidations more than stored data size.
4. **Suggested approach:** keep the next slice route-by-route and add static guardrails against `getSnapshotServer` in read-model routes.
5. **Architecture transition:** continue moving from fake scoped API routes to true narrow Convex read models rather than layering more local filtering on snapshots.
6. **Defer on purpose:** browser smoke and full build are final-loop gates and later UI/performance-slice gates, not blockers for this immediate backend/hook/store slice.
