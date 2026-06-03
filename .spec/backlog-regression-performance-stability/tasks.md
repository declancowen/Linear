---
title: Backlog Regression Performance Stability
scope: backlog-regression-performance-stability
status: implementation-ready
repo_root: /Users/declancowen/Documents/GitHub/Linear
change_class: audit-remediation
risk_level: high
owner: product-engineering
reviewers: []
approvers: []
implementation_owner: product-engineering
operations_owner: product-engineering
last_updated: 2026-06-03
---

# Tasks: Backlog Regression Performance Stability

## Source Artifacts
- `.spec/backlog-regression-performance-stability/design.md`
- `.spec/backlog-regression-performance-stability/requirements.md`
- `.spec/backlog-regression-performance-stability/reviews.md`
- Original backlog prompt, slash/reference clarification, billing/cost prompt, and later user corrections from 2026-06-03.

## Execution Status Summary
- To do: none.
- In progress: none.
- Completed: 0.1, 1.1, 2.1, 3.1, 4.1, 4.2, 5.1, 6.1, 7.1, 8.1, 9.1, 99.1.
- Deferred: none.
- Blocked: none.

## Gating Status
- Ready for implementation after this pre-implementation coverage gate.
- Blocking design decisions: none.
- Before any application-code slice starts, the implementer must re-read this full spec package, the original thread requirements, relevant recent specs, live repo code, and tests for that slice.

## Sequencing Notes
- Task 0.1 and task 1.1 are artifact-only gates completed before application-code work begins.
- Task 2.1 comes first because it contains Convex cost amplification while broader read-model migration proceeds.
- Task 3.1 follows because broad snapshot-backed reads are the structural cost and loading root cause.
- Tasks 4.1 through 8.1 are product/regression slices grouped by owning surface and shared contracts.
- Task 9.1 adds cost and architecture guardrails after the migration work has concrete owner boundaries to enforce.
- Task 99.1 remains last and must not run until every implementation slice is clean.
- After each implementation slice, complete and record the review loop, then continue to the next requirement slice without pausing unless blocked by a live finding, spec drift, validation failure, or missing external access.

## Implementation Authority And Review Loop
- The original backlog prompt, slash/reference clarification, billing/cost prompt, and later user corrections are authoritative for future feature/cost behavior.
- `architecture-standards` is the design and review lens for ownership, dependency direction, state authority, persistence, privacy, performance, cost, and deployment.
- Live repo evidence and tests are authoritative for current behavior.
- Before each future leaf task, read linked DES entries, REQ entries, task entry, relevant source files, existing tests, recent spec evidence, and review/audit evidence.
- Each future slice must run focused validation, then deep `diff-review` first with `architecture-standards`; fix findings; run normal `diff-review` loops until clean; run a slice architecture assessment with `architecture-standards`; fix any architecture findings; record validation, findings, fixes, architecture decisions, spec drift decisions, requirement audit, and residual risk in `.spec/backlog-regression-performance-stability/reviews.md`.
- If `diff-review` is unavailable, run an equivalent manual deep review using diff-review criteria and record the fallback.
- If code reality diverges from this spec or the user corrects the plan, update design, then requirements, then tasks before continuing implementation.

## No Partial Fixes And Knowledge Fixes
- Every slice must identify the owner of the broken invariant before editing.
- Every slice must audit sibling surfaces, bypass paths, retained-data paths, optimistic paths, backend/read-model paths, and tests where the invariant could also apply.
- A fix is not complete merely because the first visible UI symptom changed.
- Any slice whose symptom could be caused or amplified by backend state, Convex queries/mutations, read-model shape, scoped invalidation, authorization, persistence, or optimistic/backend reconciliation must investigate that backend path before declaring the issue frontend-only.
- If a sibling or bypass path is not changed, the slice review must record evidence that it is not affected or record it as residual risk.
- Do not move to the next slice while a live owner/bypass/sibling finding remains.

## Blocking Work
- None for the pre-implementation coverage gate.
- Product and cost implementation must complete the requested review loop after every slice and continue through the remaining plan unless a blocker requires user input.

## Non-Negotiable Review Protocol

### Per-Slice Review Loop
For each coherent requirement slice:

1. Pick one coherent requirement slice.
2. Re-read the linked `DES-*`, `REQ-*`, task entry, original ask, relevant code, and tests.
3. Implement only that slice.
4. Add or update tests and run focused validation for that slice.
5. Run a deep `diff-review` for that slice using `architecture-standards`.
6. Record the review in `.spec/backlog-regression-performance-stability/reviews.md`.
7. Fix every live finding from the deep review.
8. Re-run normal `diff-review` passes until that slice/worktree is clean.
9. Record each re-review result and fix in `reviews.md`.
10. Run a slice architecture assessment of the clean slice diff using `architecture-standards`, covering ownership, dependency direction, state authority, persistence, privacy, performance, cost, and deployment impact.
11. Fix every live architecture finding and re-run the necessary normal diff-review and architecture assessment passes until clean.
12. Record the clean architecture assessment result in `reviews.md`.
13. Continue to the next requirement slice after the review loop and architecture assessment are clean and recorded, unless blocked by a live finding, spec drift, validation failure, or missing external access.

### Spec Drift Rule
If a review finds that the implementation or task no longer matches the original backlog prompt, slash/reference clarification, billing/cost requirements, architecture standards, or live repo facts, pause implementation and update:

1. `design.md`
2. `requirements.md`
3. `tasks.md`

Then continue the slice review loop.

### Final Review Loop
After all implementation slices are complete:

1. Run the full validation suite: targeted tests, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and cost/read-model checks; record browser smoke as user-owned manual validation per the 2026-06-03 instruction.
2. Run a deep diff review across the entire worktree against:
   - original backlog prompt,
   - slash/reference clarification,
   - billing/cost requirements,
   - full spec package,
   - architecture standards,
   - tests and validation evidence.
3. Record the final deep review in `reviews.md`.
4. Fix every live finding.
5. Re-run normal full-worktree diff reviews until clean.
6. Run a final architecture assessment of the entire diff using `architecture-standards`.
7. Fix every live architecture finding and re-run the necessary full-worktree review and architecture assessment passes until clean.
8. Record the clean final review and architecture assessment state in `reviews.md`.

### PR Delivery
Once the final review loop is clean:

1. Create or use a new branch for the work, targeting `main`.
2. Stage only intended files.
3. Commit intentionally.
4. Push the branch.
5. Open a draft PR to `main`.
6. Ensure the PR body summarizes changes, root causes, validation, review-loop status, and residual risks.

## Tasks

- [x] 0. Review protocol package bootstrap
  - [x] 0.1 Create explicit review and PR delivery protocol artifacts
    - Status: completed
    - Depends on: none
    - Linked requirements: REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001, REQ-FINAL-001, REQ-PR-001
    - Likely areas: `.spec/backlog-regression-performance-stability/design.md`, `.spec/backlog-regression-performance-stability/requirements.md`, `.spec/backlog-regression-performance-stability/tasks.md`, `.spec/backlog-regression-performance-stability/reviews.md`
    - Validation: spec lint and traceability checks where available; manual audit against the user's review-loop addendum
    - Exit criteria: future implementation slices have explicit per-slice, drift, final review, and PR delivery rules in this task file
    - Rollback impact: deleting the spec package removes only process artifacts; no runtime rollback is required
    - Blocking unknowns: none for this artifact slice
    - Pre-implementation context check: inspect existing `.spec` patterns, confirm target spec folder existence, and read `spec-driven-development` / `architecture-standards` guidance
    - Test creation review: no runtime tests required; validation is spec lint, traceability report, and manual prompt audit
    - Slice review loop: artifact-only bootstrap; no application code changed. Future implementation slices must run deep diff-review first with architecture-standards, fix findings, run normal review loops until clean, stop, and record results in `reviews.md`.
    - Post-implementation review: completed; spec lint, strict traceability, and diff whitespace checks passed for the artifact package before the full-scope expansion
    - Spec drift check: completed; this task implements the user's review-loop addendum and does not introduce product/cost implementation scope
    - _Requirements: REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001, REQ-FINAL-001, REQ-PR-001_

- [x] 1. Pre-implementation thread coverage audit
  - [x] 1.1 Run the three-pass original-plan audit and update spec artifacts
    - Status: completed
    - Depends on: 0.1
    - Linked requirements: REQ-AUDIT-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001
    - Likely areas: `.spec/backlog-regression-performance-stability/design.md`, `.spec/backlog-regression-performance-stability/requirements.md`, `.spec/backlog-regression-performance-stability/tasks.md`, `.spec/backlog-regression-performance-stability/reviews.md`, `.spec/work-item-reference-activity-ui/**`, `.spec/workspace-surface-editor-stability/**`
    - Validation: three explicit coverage passes against the thread, recent spec search, spec lint, strict traceability, and diff whitespace check
    - Exit criteria: design, requirements, tasks, and review instructions contain the full original backlog plus billing plus review-loop/PR scope; the removed double-click item remains out of implementation scope
    - Rollback impact: reverting this task removes pre-implementation planning artifacts only; no runtime rollback is required
    - Blocking unknowns: none for the pre-implementation coverage gate
    - Pre-implementation context check: re-read the original backlog prompt, slash/reference clarification, billing/cost prompt, no-deferral correction, stop-after-slice correction, no-partial-fixes correction, and recent spec evidence
    - Test creation review: no runtime tests required; validation is spec lint, strict traceability, diff whitespace check, and recorded prompt coverage
    - Slice review loop: artifact-only pre-implementation gate; no application code changed. Record the coverage audit in `reviews.md` and stop before product/code slices begin.
    - Post-implementation review: completed as a three-pass coverage audit over product backlog, billing/cost architecture, and execution integrity
    - Spec drift check: completed; task placeholders were replaced with concrete implementation slices because the earlier plan drifted toward cost-only work
    - _Requirements: REQ-AUDIT-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001_

- [x] 2. Immediate Convex cost containment
  - [x] 2.1 Reduce polling, reconnect, focus/online, degraded-refresh, read-state, and legacy snapshot amplification
    - Status: completed
    - Depends on: 1.1
    - Linked requirements: REQ-COST-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001
    - Likely areas: `app/api/events/scoped/route.ts`, `hooks/use-scoped-read-model-refresh.ts`, `convex/app/chat_read_states.ts`, scoped snapshot stream configuration, presence heartbeat callers, cost diagnostics tests
    - Validation: targeted unit/static tests for polling defaults and refresh suppression; focused chat read-state mutation tests; runtime/cost notes in `reviews.md`
    - Exit criteria: idle/reconnect refresh amplification is reduced without losing scoped invalidation correctness, redundant read-state writes are suppressed, and legacy snapshot stream production diagnostics exist
    - Rollback impact: restore prior polling/reconnect/read-state behavior if realtime invalidation correctness regresses; record expected cost increase on rollback
    - Blocking unknowns: exact production-safe interval values require measurement and must be recorded before finalizing the slice
    - Pre-implementation context check: read DES-007, DES-015, REQ-COST-001, REQ-KNOWLEDGE-001, current scoped event stream, refresh hook, read-state mutation, presence heartbeat paths, and related tests
    - Test creation review: tests must assert behavior at the public refresh/read-state boundary, not only helper internals
    - Slice review loop: after focused validation, run deep diff-review with architecture-standards; fix findings; run normal reviews until clean; record cost evidence, owner/bypass audit, fixes, and residual risk; continue to task 3.1 when clean
    - Post-implementation review: completed; deep review found two live issues, both fixed, and normal re-review found no remaining live issue in this slice
    - Spec drift check: completed; broad snapshot-backed read-model migration remains task 3.1, while this slice completed immediate polling/reconnect/read-state containment without expanding scope
    - _Requirements: REQ-COST-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001_

- [x] 3. Real scoped read models
  - [x] 3.1 Replace snapshot-backed read models, access checks, and mutation scope-key resolvers
    - Status: completed
    - Depends on: 2.1
    - Linked requirements: REQ-SCOPED-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001
    - Likely areas: `app/api/read-models/**`, `lib/server/scoped-read-model-route-handlers.ts`, `lib/server/scoped-read-models.ts`, `convex/app.ts`, Convex query modules, read-model tests
    - Validation: static guard test banning `getSnapshotServer` in read-model routes/server handlers; route response compatibility tests; Convex/API access tests; pagination or bounded-read tests
    - Exit criteria: notification inbox, conversation list/thread, channel feed, work index, document detail/index, work item detail, project detail/index, view catalog, workspace people, and search seed read only required scoped data
    - Rollback impact: restoring snapshot-backed routes reintroduces Convex DB I/O and latency risk; rollback must also restore cost notes
    - Blocking unknowns: exact Convex indexes and pagination boundaries must be discovered from schema and query usage before editing
    - Pre-implementation context check: read DES-008, DES-015, REQ-SCOPED-001, REQ-KNOWLEDGE-001, all read-model routes, current authorization helpers, mutation scope-key resolvers, Convex schema/indexes, and tests
    - Test creation review: tests must fail if snapshot calls are moved behind a new helper and must assert access boundaries plus response shape compatibility
    - Slice review loop: after focused validation, run deep diff-review with architecture-standards; fix findings; run normal reviews until clean; record route inventory, owner/bypass audit, fixes, and residual risk; continue to task 4.1 when clean
    - Post-implementation review: completed; deep review found one backend authorization/overread issue in collection scope loaders, fixed in Convex and covered by a handler regression test; normal re-review found no remaining live blocker
    - Spec drift check: completed; no read-model route/server handler keeps `getSnapshotServer`, and later user chat-message clarifications were added to the chat slice without changing this scoped-read-model task
    - _Requirements: REQ-SCOPED-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001_

- [x] 4. Editor reference and performance
  - [x] 4.1 Open scoped Reference search from typed slash and slash-button paths
    - Status: completed
    - Depends on: 3.1
    - Linked requirements: REQ-REFERENCE-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001
    - Likely areas: `components/app/rich-text-editor.tsx`, `components/app/rich-text-editor/menus.tsx`, document editor callers, work item editor callers, reference candidate selectors, editor tests
    - Validation: rich text editor component tests for typed `/` and slash-command UI paths; candidate exclusion tests for people/create actions; browser smoke recorded as user-owned manual validation for document and work item editors
    - Exit criteria: selecting `Reference` opens scoped search mode in document and work item editors, preserves editor selection, and inserts accessible work item/document/project/view references
    - Rollback impact: restore prior Reference command behavior if insertion corrupts editor selection or reference access
    - Blocking unknowns: exact safest component split is decided after reading current editor menu ownership
    - Pre-implementation context check: read DES-009, DES-015, REQ-REFERENCE-001, REQ-KNOWLEDGE-001, existing editor command code, recent reference specs, and tests
    - Test creation review: tests must prove command-to-picker opening through public editor behavior, not only internal state setters
    - Slice review loop: after focused validation, run deep diff-review with architecture-standards; fix findings; run normal reviews until clean; record command ownership, sibling editor audit, fixes, and residual risk; continue to task 4.2 when clean
    - Post-implementation review: completed; deep review and normal re-review found no remaining live blocker after focused validation
    - Spec drift check: completed; the current editor exposes a rendered slash-command UI path rather than a separate toolbar slash button, and browser smoke is now user-owned manual validation per the latest instruction
    - _Requirements: REQ-REFERENCE-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001_

  - [x] 4.2 Deep-dive and remediate navigation, surface loading, create modal, dropdown, and TipTap lag
    - Status: completed
    - Depends on: 4.1
    - Linked requirements: REQ-PERF-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001
    - Likely areas: work surface screens, create modal, dropdown/property controls, work item TipTap editor, Zustand selectors/store merges, scoped read-model refresh diagnostics, user-owned browser smoke paths
    - Validation: baseline performance notes before fixes; focused component/store tests; targeted diagnostics for first useful render and read-model refresh; browser smoke recorded as user-owned manual validation for typing/dropdowns/navigation
    - Exit criteria: measured lag sources are reduced without breaking collaboration, references, mentions, sanitization, optimistic updates, or retained-data rendering
    - Rollback impact: rollback restores slower behavior but should not affect schema; record which performance measurement regressed
    - Blocking unknowns: exact latency targets must be set from baseline evidence during the slice
    - Pre-implementation context check: read DES-009, DES-015, REQ-PERF-001, REQ-KNOWLEDGE-001, previous TipTap/performance spec claims, relevant code, and tests
    - Test creation review: tests must protect user-facing behavior and render/store fan-out risks rather than timing-only internals
    - Slice review loop: after focused validation, run deep diff-review with architecture-standards; fix findings; run normal reviews until clean; record baseline, root causes, owner/bypass audit, fixes, and residual risk; continue to task 5.1 when clean
    - Post-implementation review: completed; deep review found and fixed an effect-based reset/cascading-render issue, then normal re-review and validation were clean
    - Spec drift check: completed; browser smoke remains user-owned manual validation, and the work item detail sub-task project icon requirement was added to task 6.1
    - _Requirements: REQ-PERF-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001_

- [x] 5. Work surface correctness
  - [x] 5.1 Fix selection UI, parent cascade, private scoping, filtered flicker, and bulk actions/delete
    - Status: completed
    - Depends on: 4.2
    - Linked requirements: REQ-WORKSURFACE-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001
    - Likely areas: `components/app/screens/work-surface.tsx`, `components/app/screens/work-surface-view.tsx`, `components/app/screens/work-item-selection.tsx`, `components/app/screens/work-item-menus.tsx`, surface selectors, store mutations, bulk action tests
    - Validation: component/store tests for selection placement and selected target sets; parent cascade tests across named surfaces; private leakage tests; bulk update/delete tests; browser smoke recorded as user-owned manual validation on team space and my-items board/list
    - Exit criteria: visible eligible rows drive selection and bulk targets, selected styling matches the requested gray/black treatment next to the PVT/identity cluster, parent filters cascade to children, private tasks do not leak workspace groups, and filtered status changes do not bounce
    - Rollback impact: rollback may restore broken bulk and private-scope behavior; record any data mutations performed during testing
    - Blocking unknowns: whether bulk write limits are UI batching, store fan-out, or backend mutation constraints must be verified before code changes
    - Pre-implementation context check: read DES-010, DES-015, REQ-WORKSURFACE-001, REQ-KNOWLEDGE-001, previous surface spec/reviews, current work surface code, and tests
    - Test creation review: tests must assert target identity sets and private/filtered negative cases, not only checkbox rendering
    - Slice review loop: after focused validation, run deep diff-review with architecture-standards; fix findings; run normal reviews until clean; record surface inventory, owner/bypass audit, fixes, and residual risk; continue to task 6.1 when clean
    - Post-implementation review: completed; deep review found assigned-descendant container lifting bypassed active filters, fixed and re-reviewed clean
    - Spec drift check: if surface naming or scope differs from the thread, update design, requirements, and tasks before continuing
    - _Requirements: REQ-WORKSURFACE-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001_

- [x] 6. Property, create, document, and sort controls
  - [x] 6.1 Fix inherited project display/icons, document pills, sort menu, label dropdowns, and property-control consistency
    - Status: completed
    - Depends on: 5.1
    - Linked requirements: REQ-PROPERTY-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001
    - Likely areas: `components/app/screens/create-work-item-dialog.tsx`, `components/app/screens/work-item-ui.tsx`, `components/app/screens/work-item-detail-screen.tsx`, `components/app/screens/docs-content.tsx`, `components/app/screens/work-surface-controls.tsx`, `components/app/screens/work-item-inline-property-control.tsx`, property selectors, sort tests
    - Validation: create dialog tests for inherited project name and project icons; work item detail inline sub-task composer project icon tests; document row pill tests for placement/dedupe/configured properties; sort popover tests; label dropdown assignability tests; manual browser smoke by the user
    - Exit criteria: disabled inherited project field shows the real project name and project-specific icon, create-modal project options show configured project icons, work item detail sub-task creation shows the inherited project's icon and name in the inline project chip, document pills sit at the right end without duplicates, sort opens/updates, and visible editable labels have a working dropdown only when assignable
    - Rollback impact: rollback restores generic/duplicate/inert property UI; no schema rollback expected
    - Blocking unknowns: property visibility and assignability source of truth must be confirmed from current selectors before editing
    - Pre-implementation context check: read DES-011, DES-015, REQ-PROPERTY-001, REQ-KNOWLEDGE-001, previous create/property spec claims, current property code, and tests
    - Test creation review: tests must assert source-of-truth property resolution and negative private/assignability cases
    - Slice review loop: completed; focused validation passed, deep diff-review/manual architecture-standard review found no live findings, normal re-review and slice architecture assessment were clean, and results were recorded
    - Post-implementation review: completed; private-task negative coverage was added during the architecture assessment
    - Spec drift check: completed; no drift remains after the user-requested per-slice/final architecture assessment gate was made explicit
    - _Requirements: REQ-PROPERTY-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001_

- [x] 7. Chat consistency and message metadata redesign
  - [x] 7.1 Fix chat panel stability, collapse, deleted previews, disappearing messages, and compact message metadata/read receipts
    - Status: completed
    - Depends on: 6.1
    - Linked requirements: REQ-CHAT-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001
    - Likely areas: `components/app/collaboration-screens/workspace-chats-screen.tsx`, `components/app/collaboration-screens/chat-thread.tsx`, conversation selectors, Convex chat queries/mutations, store merge/reconciliation code, read receipt tests
    - Validation: conversation preview tests; optimistic send/merge tests; deleted preview tests; message metadata/read receipt non-duplication tests; same-sender grouping tests; message link rendering tests; browser smoke recorded as user-owned manual validation for send/delete/collapse/read-state/link flows
    - Exit criteria: the left conversation-list panel width is stable, collapse affordance works beside the username/user area and collapses/restores only that left conversation panel, deleted previews select latest readable messages, sent messages do not disappear/reappear, same-sender consecutive messages do not repeat avatar/name unless another sender posts between them, message links are blue/underlined only on linked text without styling the full message, and message metadata is right-anchored in line with the thread, read state uses an eye/read icon with read timestamp where needed, edited state says `Edited` without an edited timestamp, and read receipts are compact and non-duplicated
    - Rollback impact: rollback may restore message consistency defects; read receipt schema or storage changes need compatibility notes
    - Blocking unknowns: current message disappearance root cause must be established from backend/read-model/store merge behavior before editing
    - Pre-implementation context check: read DES-012, DES-015, REQ-CHAT-001, REQ-KNOWLEDGE-001, current chat components/selectors/Convex handlers, read-state schema, and tests
    - Test creation review: tests must cover optimistic/backend/read-model reconciliation and deleted/unreadable preview negatives
    - Slice review loop: completed; focused validation passed, deep review found one pane-initialization architecture/lint finding, fix was revalidated, normal re-review and slice architecture assessment were clean
    - Post-implementation review: completed; backend/read-model owner audit and optimistic path audit recorded
    - Spec drift check: completed; no spec drift found
    - _Requirements: REQ-CHAT-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001_

- [x] 8. Collaboration polish and shared interaction contracts
  - [x] 8.1 Fix reply semantics, profile hover/activity detail, and sidebar offline status
    - Status: completed
    - Depends on: 7.1
    - Linked requirements: REQ-POLISH-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001
    - Likely areas: channel/comment primitives, work item comment UI, direct message quote UI, `components/app/user-presence.tsx`, profile activity selectors/components, `components/app/shell.tsx`, hover-card/portal primitives
    - Validation: component tests for reply-vs-quote availability; profile activity detail tests; sidebar footer status test; browser smoke recorded as user-owned manual validation for profile hover layering
    - Exit criteria: comments/channels/work item comments show Reply with reply icon and no quote insertion, direct chat quote remains, avatar hover cards render above surfaces, activity detail is denser in the left column, and offline status no longer uses the incorrect X icon treatment
    - Rollback impact: rollback restores visible polish regressions; direct chat quote behavior must be checked after rollback
    - Blocking unknowns: exact shared primitive ownership for quote/reply actions and hover layering must be confirmed before editing
    - Pre-implementation context check: read DES-013, DES-015, REQ-POLISH-001, REQ-KNOWLEDGE-001, current channel/comment/chat/profile/sidebar code, recent activity spec claims, and tests
    - Test creation review: tests must prove chat quote remains while non-chat comments only reply, and hover cards portal above clipping surfaces
    - Slice review loop: completed; focused validation passed, deep review found one draft/accessibility finding, fix was revalidated, normal re-review and slice architecture assessment were clean
    - Post-implementation review: completed; interaction owner audit, sibling surface audit, backend-data relevance check, and residual risk recorded
    - Spec drift check: completed; no spec drift found
    - _Requirements: REQ-POLISH-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001_

- [x] 9. Cost guardrails and operational cleanup
  - [x] 9.1 Add static read-model guards, polling default checks, diagnostics, retention cleanup, and Convex env targeting checks
    - Status: completed
    - Depends on: 3.1, 8.1
    - Linked requirements: REQ-GUARDRAIL-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001
    - Likely areas: static tests, spec/cost scripts, Convex diagnostics, retention cleanup functions/jobs, env target checks, CI/test config
    - Validation: static guard tests; polling minimum tests; diagnostics output tests; retention cleanup tests; env audit check; cost/read-model check recorded in `reviews.md`
    - Exit criteria: route/server-handler snapshot imports fail tests, unsafe scoped polling defaults fail tests, diagnostics expose function/route cost fields, retention cleanup is bounded, and local/prod Convex target confusion is visible
    - Rollback impact: rollback removes architecture/cost prevention and may allow billing regressions; retention cleanup rollback must preserve active data
    - Blocking unknowns: retention policy thresholds must be discovered from existing data lifecycle conventions before enabling deletion
    - Pre-implementation context check: read DES-014, DES-015, REQ-GUARDRAIL-001, REQ-KNOWLEDGE-001, cost/read-model code, env files, Convex schema, and tests
    - Test creation review: tests must enforce rules through code/static checks, not comments or documentation-only guidance
    - Slice review loop: completed; focused validation passed, deep review found one bounded-retention-read/progress finding, fixes were revalidated, normal re-review and slice architecture assessment were clean
    - Post-implementation review: completed; guardrail owner audit, bypass audit, retention cleanup safety audit, and residual risk recorded
    - Spec drift check: completed; no remaining snapshot-backed read-model route/server-handler relapse was found
    - _Requirements: REQ-GUARDRAIL-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001_

- [x] 99. Final total-diff review and draft PR delivery
  - [x] 99.1 Run full validation, total-diff review loop, branch/commit/push, and draft PR to main
    - Status: completed
    - Depends on: 2.1, 3.1, 4.1, 4.2, 5.1, 6.1, 7.1, 8.1, 9.1
    - Linked requirements: REQ-FINAL-001, REQ-PR-001, REQ-KNOWLEDGE-001, REQ-RECORD-001, REQ-DRIFT-001
    - Likely areas: entire intended worktree diff, `.spec/backlog-regression-performance-stability/reviews.md`, git branch/staging/commit/push, draft PR body
    - Validation: targeted tests, `pnpm typecheck`, `pnpm lint`, `pnpm build`, cost/read-model checks, final deep diff-review, normal full-worktree reviews until clean, and final full-diff architecture assessment with `architecture-standards`; browser smoke recorded as user-owned manual validation
    - Exit criteria: full validation, final total-diff review loop, and final full-diff architecture assessment are clean; intended files only are staged, branch is pushed, and draft PR to `main` summarizes changes/root causes/validation/review status/residual risks
    - Rollback impact: no production rollback from PR creation; revert commit or close draft PR if final delivery is rejected
    - Blocking unknowns: remote/branch naming and GitHub auth must be verified at PR-delivery time
    - Pre-implementation context check: re-read the full original thread, DES/REQ/task package, every slice review, validation evidence, and current git status before staging
    - Test creation review: no new feature tests expected in final delivery unless total-diff review finds a coverage gap
    - Slice review loop: completed; final deep total-diff review found three findings, fixes were revalidated, normal full-worktree re-review and final architecture assessment with `architecture-standards` were clean, and outcomes were recorded in `reviews.md`
    - Post-implementation review: completed as the final clean review entry in `reviews.md`
    - Spec drift check: completed; no drift remains from the original prompt, billing plan, architecture standards, or live repo facts
    - _Requirements: REQ-FINAL-001, REQ-PR-001, REQ-KNOWLEDGE-001, REQ-RECORD-001, REQ-DRIFT-001_

## Post-Deploy Verification
- For artifact tasks 0.1 and 1.1: no deploy verification is required.
- For future implementation: after deployment or preview, verify the relevant backlog/product behavior, Convex cost/read-model diagnostics, and any PR/CI checks required by the completed slices.

## Traceability Matrix
| Task | Requirements |
| --- | --- |
| 0.1 | REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001, REQ-FINAL-001, REQ-PR-001 |
| 1.1 | REQ-AUDIT-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001 |
| 2.1 | REQ-COST-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001 |
| 3.1 | REQ-SCOPED-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001 |
| 4.1 | REQ-REFERENCE-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001 |
| 4.2 | REQ-PERF-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001 |
| 5.1 | REQ-WORKSURFACE-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001 |
| 6.1 | REQ-PROPERTY-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001 |
| 7.1 | REQ-CHAT-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001 |
| 8.1 | REQ-POLISH-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001 |
| 9.1 | REQ-GUARDRAIL-001, REQ-KNOWLEDGE-001, REQ-REVIEW-001, REQ-RECORD-001, REQ-DRIFT-001 |
| 99.1 | REQ-FINAL-001, REQ-PR-001, REQ-KNOWLEDGE-001, REQ-RECORD-001, REQ-DRIFT-001 |

## Coverage Checklist
- [x] Original backlog prompt retained as active implementation scope.
- [x] Slash Reference clarification retained exactly: typed `/` then `Reference` opens scoped search mode.
- [x] Billing/cost prompt retained as active implementation scope.
- [x] Review loop and PR delivery protocol are explicit, not implied.
- [x] No partial fixing / knowledge-fix rule is explicit.
- [x] Per-slice deep review first.
- [x] Per-slice finding fix loop.
- [x] Per-slice normal re-review until clean.
- [x] Review outcomes recorded in `reviews.md`.
- [x] Spec drift update order documented.
- [x] Continue-after-clean-slice behavior documented.
- [x] Final total-diff deep review first.
- [x] Final normal re-review until clean.
- [x] Draft PR to `main` after clean final loop.
- [x] Stage only intended files in a dirty worktree.

## Task Audit
- REQ-REVIEW-001 is implemented as the Per-Slice Review Loop and each future slice review requirement.
- REQ-RECORD-001 is implemented through the mandated `reviews.md` recording steps and slice task fields.
- REQ-DRIFT-001 is implemented as the Spec Drift Rule and every task's spec drift check.
- REQ-FINAL-001 is implemented as the Final Review Loop and task 99.1.
- REQ-PR-001 is implemented as PR Delivery and task 99.1.
- REQ-AUDIT-001 is implemented by task 1.1.
- REQ-KNOWLEDGE-001 is implemented by the No Partial Fixes section and each implementation slice.
- REQ-COST-001 is implemented by task 2.1.
- REQ-SCOPED-001 is implemented by task 3.1.
- REQ-REFERENCE-001 is implemented by task 4.1.
- REQ-PERF-001 is implemented by task 4.2.
- REQ-WORKSURFACE-001 is implemented by task 5.1.
- REQ-PROPERTY-001 is implemented by task 6.1.
- REQ-CHAT-001 is implemented by task 7.1.
- REQ-POLISH-001 is implemented by task 8.1.
- REQ-GUARDRAIL-001 is implemented by task 9.1.
