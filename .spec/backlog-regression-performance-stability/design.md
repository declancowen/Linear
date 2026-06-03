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

# Design: Backlog Regression Performance Stability

## Summary
- This spec package records the implementation plan for the backlog regression, performance, Convex cost, and PR-delivery work.
- The user explicitly requested that the per-slice review loop be written into `tasks.md`, not left implied by the spec process.
- The protocol is intentionally strict because the planned work spans UI behavior, editor state, scoped read models, billing/cost containment, backend mutation invalidation, chat consistency, and deployment delivery.

## Scope Statement
- In scope: audited backlog fixes, slash/reference scoped search, performance and TipTap deep dive, work surface correctness, chat/read receipt redesign, profile/sidebar/comment polish, Convex billing containment, true scoped read models, operational guardrails, and draft PR delivery.
- In scope: making the implementation review loop, spec drift rule, final total-diff review loop, and draft PR delivery protocol explicit and non-negotiable for every slice.
- Out of scope: the ambiguous double-click property requirement, which the user confirmed should be removed completely.
- Future implementation must complete and record each coherent requirement slice review loop before proceeding, then continue through the remaining plan unless a live finding, validation failure, spec drift, or missing external access blocks progress.

## Original Plan Alignment Audit
- Original backlog prompt: covered by DES-006 through DES-014 and REQ-AUDIT-001 through REQ-GUARDRAIL-001.
- Slash/reference clarification: covered by DES-009 and REQ-REFERENCE-001.
- Billing/cost prompt: covered by DES-007, DES-008, DES-014, REQ-COST-001, REQ-SCOPED-001, and REQ-GUARDRAIL-001.
- Review-loop prompt: implemented directly by this package through DES-001 through DES-005, REQ-REVIEW-001 through REQ-PR-001, and the task protocol.
- PR delivery prompt: implemented by DES-005, REQ-PR-001, and task 99.
- Read receipts correction: the pasted original prompt says to ignore the current noisy/duplicated read-receipt behavior; the later plan keeps a compact redesign in scope under DES-012 and REQ-CHAT-001 so the old receipt UI is not patched piecemeal.
- Double-click correction: removed completely and not represented as an implementation requirement.

## Pre-Implementation Three-Pass Coverage Audit
- Pass 1, product backlog: verified slash Reference, performance, TipTap, multi-select including PVT/identity-cluster placement, document pills, inherited project display, parent filter cascade, chat layout/previews/messages/read receipts, sidebar offline status, profile activity, sort, reply semantics, bulk actions/delete, private-task leakage, filtered status flicker, profile hover layering, and label dropdowns are mapped to active requirements and concrete tasks.
- Pass 2, billing/cost architecture: verified polling/reconnect amplification, fake scoped read models, snapshot-backed authorization, mutation scope resolvers, global snapshot version bumps, read-state/presence churn, env targeting, diagnostics, retention cleanup, and static guardrails are mapped to active requirements and concrete tasks.
- Pass 3, execution integrity: verified per-slice deep review, normal clean-loop re-review, per-slice architecture assessment, review-ledger records, spec drift updates, no partial fixes, continue-after-clean-slice behavior, final total-diff review, final full-diff architecture assessment, clean-loop PR gate, branch/commit/push, and draft PR to `main` are explicit and not implied.

## Repository Discovery Summary

### Repo Root
- `/Users/declancowen/Documents/GitHub/Linear`

### Repo-Specific Profile and House Patterns
- Existing specs use frontmatter plus `design.md`, `requirements.md`, `tasks.md`, and `reviews.md`.
- Existing task files encode implementation authority, review loops, traceability, and per-task review criteria.
- App stack is Next.js 16, React 19, Convex, Zustand, TipTap, PartyKit/Yjs, and Vitest.
- Code ownership pattern: UI surfaces live under `components/app`, domain selectors under `lib/domain` and `lib/scoped-sync`, optimistic store work under `lib/store/app-store-internal`, server/API boundaries under `app/api` and `lib/server`, Convex authority under `convex/app`.

### Entry Points and Execution Path
- Spec artifacts: `.spec/backlog-regression-performance-stability/design.md`, `requirements.md`, `tasks.md`, and `reviews.md`.
- Reference/editor entry points: `components/app/rich-text-editor.tsx`, `components/app/rich-text-editor/menus.tsx`, document and work item editor callers.
- Work surface entry points: `components/app/screens/work-surface.tsx`, `components/app/screens/work-surface-view.tsx`, `components/app/screens/work-item-selection.tsx`, `components/app/screens/work-item-menus.tsx`, `components/app/screens/work-item-inline-property-control.tsx`.
- Create/document/property entry points: `components/app/screens/create-work-item-dialog.tsx`, `components/app/screens/docs-content.tsx`, `components/app/screens/work-surface-controls.tsx`.
- Chat/comment/profile entry points: `components/app/collaboration-screens/workspace-chats-screen.tsx`, `components/app/collaboration-screens/chat-thread.tsx`, `components/app/collaboration-screens/channel-ui.tsx`, `components/app/collaboration-screens/channel-post-primitives.tsx`, `components/app/screens/work-item-ui.tsx`, `components/app/screens/work-item-detail-screen.tsx`, `components/app/user-presence.tsx`, `components/app/shell.tsx`.
- Cost/read-model entry points: `app/api/events/scoped/route.ts`, `hooks/use-scoped-read-model-refresh.ts`, `lib/server/scoped-read-models.ts`, `lib/server/scoped-read-model-route-handlers.ts`, `app/api/read-models/**`, `convex/app.ts`, `convex/app/chat_read_states.ts`, presence heartbeat routes/components.

### Confirmed Code and Runtime Facts
- The target spec folder did not exist before this work.
- `.spec/workspace-surface-editor-stability/tasks.md` already contains a comparable deep-review-first loop.
- Initial worktree inspection showed unrelated deleted files and an untracked duplicate desktop update policy test; after user confirmation, those deletions were restored and the duplicate test was removed so the intended diff is the spec package.
- `app/api/events/scoped/route.ts` uses `STREAM_POLL_INTERVAL_MS = 1000`, `STREAM_MAX_DURATION_MS = 55000`, and reconnect retry settings.
- `hooks/use-scoped-read-model-refresh.ts` refreshes on mount, invalidation, reconnect `ready`, focus, online, and degraded polling.
- `lib/server/scoped-read-model-route-handlers.ts` loads broad snapshots for collection/snapshot/parameterized read-model handlers.
- `lib/server/scoped-read-models.ts` imports `getSnapshotServer` for authorization and mutation scope-key resolution.
- 13 of 14 read-model routes are snapshot-backed directly or through route handlers; workspace membership is the narrow bootstrap exception.
- `convex/app.ts` wraps normal mutations to bump global `snapshotVersion`.
- Document and work item legacy presence heartbeats run every 15 seconds.
- Read-model route coverage must include channel feed and project detail, not only the most expensive top-five routes.

### Related Code and Pattern Inventory
- `.spec/workspace-surface-editor-stability/tasks.md` is the nearest task-file pattern.
- `.spec/workspace-surface-editor-stability/reviews.md` is the nearest review-ledger pattern.
- Existing reference/activity and workspace-surface specs are stale evidence; their completed status is not trusted without fresh browser/component/runtime proof.
- Existing context-menu label actions exist, but inline list label chips are inert display metadata.
- Existing create modal computes `displayedProject`, but parent/project option scoping can still fall back to generic "Project".

### Adjacent Pattern Comparison
- Existing specs keep the review protocol in both `tasks.md` and `reviews.md`; this package follows the same structure.
- Current "scoped read model" routes are scoped by name/selector but still snapshot-backed; target state must make scope real at the Convex query/access layer.
- Chat has quote behavior that should remain for direct messages; channel/work-item comments currently reuse quote behavior and need reply-only behavior.
- Work surface selection state should remain a generic visible-ID controller while work-surface rendering owns visible-row eligibility.

### Blast Radius Review
- Direct blast radius spans spec artifacts, then future UI, API, Convex, read-model, store, editor, and chat changes.
- Cost blast radius includes Convex function calls, DB I/O, reconnect amplification, mutation invalidation, presence/read-state hot paths, and local/prod environment targeting.
- Product blast radius includes document/work item editors, work surfaces, create modal, document list, chats, channels, work item comments, profile hover/activity, sidebar footer, sort/filter/property controls, and bulk action flows.

### Recent Related Repository History
- Recent specs under `.spec/workspace-surface-editor-stability/` and `.spec/work-item-reference-activity-ui/` were used as process evidence.
- `.spec/work-item-reference-activity-ui/` and `.spec/workspace-surface-editor-stability/` claimed several fixes as complete, but the user reported those behaviors are still failing.
- This spec treats those prior specs as stale regression context, not as completion evidence.

### Impacted Boundaries and Adjacent Systems
- Process boundary: implementation cannot move between slices without review-ledger proof of a clean review loop and clean slice architecture assessment.
- Architecture boundary: `architecture-standards` remains required for each future slice and for the final full-diff architecture assessment.
- Git boundary: PR delivery is gated behind final total-diff review.
- Presentation boundary: UI layout/interaction fixes stay in components.
- Domain boundary: filtering, reference candidates, conversation previews, activity detail derivation, and label/property eligibility belong in selectors/domain modules where reused.
- Server/Convex boundary: access checks, narrow read queries, mutation idempotency, read-model versioning, and durable chat/read receipt authority belong server-side.
- Operations boundary: cost guardrails, env targeting, diagnostics, retention cleanup, and polling defaults need enforceable checks.

### Data, Contracts, and Config Surfaces
- Expected data/API surfaces include scoped read-model response shapes, Convex queries/mutations, read receipt/read-state storage, presence/read-model version rows, and environment flags for scoped sync/polling.
- Next API route shapes should remain compatible while internals move from snapshot-backed selectors to narrow Convex queries.
- New env/config defaults for scoped polling/degraded refresh must be bounded by tests.

### Existing Tests and Operational Signals
- Spec lint and traceability scripts validate this package.
- Future validation must include targeted Vitest/component/store/Convex tests, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and cost/read-model checks as the implementation owner can run them.
- Browser smoke for editor reference picker, create modal typing, dropdowns, multi-select/bulk actions, document list, chat send/delete/collapse/read receipts, and profile hover is user-owned manual validation per the 2026-06-03 instruction; slice reviews and the PR must record that browser smoke was intentionally not run by the implementation agent.

### Static Analyzer and Audit Evidence
- Fallow/static analyzer evidence is advisory for future TypeScript/React architecture and performance slices.
- A static guard must prevent read-model routes/server handlers from reintroducing `getSnapshotServer`.

## Problem Statement and Context
- The app has product regressions in surfaces recently marked fixed and a Convex billing problem caused by repeated calls and broad reads rather than storage.
- The review loop was technically implied by `spec-driven-development`, but the user requested it to be explicit and non-negotiable.
- The broad scope makes implicit process insufficient because skipped reviews could allow regressions across unrelated UI, backend, performance, billing, and deployment surfaces.

## Current-State Analysis
- Current target package was absent, so there was no local `tasks.md` or `reviews.md` to enforce the requested loop.
- Existing neighboring specs prove the repository already accepts explicit review-loop language.
- Product current state includes broken slash Reference modal behavior, UI lag, incomplete TipTap optimization, multi-select visual/behavior gaps, stale create/doc/property controls, chat consistency issues, quote/reply mismatch, profile/sidebar polish gaps, and private-task/work surface leakage.
- Cost current state includes 1-second scoped polling, reconnect refresh amplification, snapshot-backed read models, snapshot-backed mutation scope resolvers, global snapshot version bumps, and high-churn DB read-state/presence writes.

## Target-State Architecture
- The backlog spec owns its implementation protocol in `tasks.md`.
- The backlog spec owns review state in `reviews.md`.
- The protocol requires slice-local deep review, normal re-review clean loops, per-slice architecture assessment after the review loop is clean, upstream spec drift correction, final total-diff review, final full-diff architecture assessment, and draft PR delivery after clean review.
- Product target state is verified behavior across the original backlog surfaces, not just old spec completion claims.
- Cost target state is lower idle call volume, real scoped reads, no snapshot-backed read-model routes/helpers, guarded polling defaults, and operational cost diagnostics.

## Goals
- Make per-slice review order explicit.
- Make spec drift correction explicit.
- Make final total-diff review explicit.
- Make draft PR delivery after clean review explicit.
- Provide a review ledger before future implementation begins.
- Audit every original prompt item and stale recent spec claim.
- Fix the backlog regressions with automated tests and record manual browser-smoke ownership for the user.
- Reduce Convex function call and DB I/O drivers.
- Turn fake scoped read models into real scoped Convex queries.
- Add guardrails that prevent cost regressions.

## Non-Goals
- Do not implement the removed double-click property requirement.
- Do not treat read receipts as ignored; full redesign is in scope.
- Do not create a PR before the final review loop is clean.
- Do not touch unrelated dirty worktree files.

## Confirmed Facts
- The requested spec folder was missing.
- The worktree initially contained unrelated deleted files and an untracked duplicate test file; those were reconciled after the user confirmed they were not intended.
- Existing spec tooling is available under `~/.codex/skills/spec-driven-development/scripts`.
- Convex docs favor reactive indexed queries and pagination over broad app-managed polling/snapshot reads.
- The user confirmed bulk delete means selected work items, not workspace deletion.
- The user confirmed the double-click property line should be removed completely.

## Assumptions
- The user wants the review protocol committed as spec text, not merely restated in chat.
- Future implementation should keep the worktree to intended files only; unexpected deleted tracked files or duplicate untracked tests must be audited before proceeding.

## Open Questions
- None for the audited scope currently captured.

## Decision Needed
- None before implementation begins.

## Proposed Design
- Encode the protocol as stable design decisions and requirements.
- Add product/cost design decisions and requirements from the original backlog, slash/reference clarification, billing prompt, and later corrections.
- Implement in coherent slices, completing and recording each slice review loop before continuing to the next slice.
- Put the step-by-step execution rules in `tasks.md`.
- Put the review-ledger instructions and slice entries in `reviews.md`.

## Impacted Surfaces Matrix
- UI: document/work item editors, work surfaces, create modal, document list, chat/channel/work item comments, profile hover/activity, sidebar footer.
- API: read-model routes, scoped event stream, snapshot routes/legacy boundary, mutation routes that bump scopes.
- Domain logic: reference candidates, filters/children cascade, selection visibility, conversation previews, activity details, label/property eligibility.
- Persistence: Convex read receipts/read state, scoped read-model versions, snapshot version, presence, retention cleanup.
- Integrations: Convex, PartyKit/Yjs collaboration, GitHub PR delivery.
- Auth: narrow scoped read authorization and access checks replacing snapshot-based authorization.
- Infra: env separation, polling defaults, production feature flags.
- Telemetry: cost diagnostics, read-model timing/bytes/calls, first useful render.
- Tests: unit/component/store/Convex/browser/spec/static guard tests.
- Docs: spec artifacts and PR body.

## Change Impact Map
- Direct impact: implementation protocol plus future product/cost code slices.
- Indirect impact: PR readiness, review traceability, spec drift handling, Convex bill run-rate, and user-perceived latency.
- Unchanged but risk-adjacent areas: unrelated dirty worktree files, auth/session flows, global app bootstrap, existing collaboration rooms.

## Invariants and Forbidden Outcomes
- Future slices must run deep diff-review before normal re-review.
- Future slices must record review outcomes before moving on.
- Future drift must update design, then requirements, then tasks before implementation resumes.
- PR delivery must not happen before a clean final total-diff review loop.
- Unrelated dirty worktree files must not be staged silently.
- No read-model route/helper may remain snapshot-backed after the scoped-read-model migration slice.
- Reconnects must not trigger broad refreshes when versions are unchanged.
- Slash Reference must open the scoped search mode from typed `/` and slash command UI in document and work item editors.
- Chat quote behavior must remain in messaging and be removed from channel/work item comments.
- Double-click property behavior must not be implemented.
- No slice may claim completion by patching only the visible symptom; the owning invariant, sibling surfaces, bypass paths, retained-data paths, optimistic paths, and tests must be audited before the slice is cleared.

## Compatibility Matrix
- Public API: Next route response shapes should remain compatible while internals narrow.
- Internal API: read-model handlers, selectors, and Convex clients may change by slice.
- Data schema: read receipt/read-state and retention changes may require careful compatibility.
- Events: scoped SSE polling/reconnect behavior changes must remain client-compatible.
- Cache keys: scoped keys must remain stable unless explicitly migrated.
- Config: new polling/legacy env defaults must be bounded and documented.
- External consumers: browser clients and Vercel production deployment.
- Rollback compatibility: containment settings should be reversible; schema changes need backward-compatible reads.

## Contract Examples and Before/After Payloads
- Request examples: existing read-model request paths remain but query internals become narrow.
- Response examples: scoped read-model responses preserve current partial `AppSnapshot`/read-model result shapes unless a requirement slice updates them with compatibility tests.
- Event or message examples: scoped invalidation events continue to emit `ready`, `scope`, and `unavailable` semantics while avoiding refresh-on-unchanged ready.
- Before/after comparisons: before, many "scoped" reads were snapshot-backed and reconnect-heavy; after, routes use narrow queries and guarded refresh logic.

## Cross-Cutting Applicability Matrix
- Security: narrow scoped read authorization must replace snapshot-based authorization without overexposing data.
- Privacy: private tasks, inaccessible references, profile hover, chat read receipts, and read models must respect user/workspace/team access.
- Performance: navigation, editor typing, dropdowns, read-model calls, Convex DB I/O, and reconnect behavior are explicit targets.
- Resilience: optimistic chat/work item updates, filtered row flicker, and read-model reconciliation must avoid bounce/disappearance loops.
- Migration: read receipts/read-state and snapshot-removal work require compatibility paths.
- Observability: cost dashboard/table, diagnostics, review ledger, and PR context are required.
- Supportability: static guardrails and env targeting reduce repeated investigation errors.
- Backward compatibility: route response shapes and client behavior must remain compatible unless a slice explicitly changes them.

## Success Metrics and Numeric NFR Targets
- Latency targets: create modal typing, dropdown changes, and work item editor typing must be measurably responsive after focused baselines; exact thresholds should be recorded during the performance slice.
- Throughput or concurrency targets: idle client Convex call volume reduced by at least an order of magnitude from 1-second polling baseline.
- Error-rate or availability targets: read-model refresh and mutation reconciliation must not introduce user-visible data loss or unauthorized access errors.
- Timeout, retry, or queue-depth limits: scoped polling, degraded refresh, SSE retry, and reconnect settings must have production-safe bounded defaults.
- Process target: every future implementation slice under this scope has one deep review entry and clean-loop evidence before the next slice starts, and the plan continues end to end after each clean slice review.

## Design Decisions

### DES-001: Per-slice review is a delivery gate
Each coherent requirement slice must complete implementation, focused validation, deep diff review, finding fixes, normal clean-loop re-reviews, slice architecture assessment with `architecture-standards`, and review-ledger recording before the next slice starts. The implementer then continues to the next slice unless the clean-loop or architecture gate is not met.

Rationale:
- The planned backlog is broad enough that batching reviews until the end would hide regressions across unrelated surfaces.

### DES-002: The review ledger is authoritative for implementation review state
`.spec/backlog-regression-performance-stability/reviews.md` is the destination for per-slice review entries, re-review outcomes, slice architecture assessments, final total-diff review state, final full-diff architecture assessment, validation, findings, fixes, architecture decisions, spec drift, and residual risk.

Rationale:
- The implementer needs a single local source of truth for review progress and remaining risk.

### DES-003: Spec drift must be corrected upstream before continuing
If a review finds drift from the original backlog prompt, slash/reference clarification, billing/cost requirements, architecture standards, or live repo facts, implementation must pause and update `design.md`, then `requirements.md`, then `tasks.md`.

Rationale:
- The original user request and live repo evidence are authoritative; stale tasks cannot overrule either.

### DES-004: Final review must cover the entire worktree and plan
After all slices complete, the implementer must run full validation, a deep diff review, and a full-diff architecture assessment across the complete worktree against the original asks, full spec package, architecture standards, tests, and validation evidence. Normal full-worktree reviews and architecture assessment passes repeat until clean.

Rationale:
- Slice-local correctness does not prove the integrated branch is safe.

### DES-005: PR delivery happens only after a clean final loop
Only after the final review loop is clean may the implementer create or use a branch targeting `main`, stage intended files, commit, push, and open a draft PR.

Rationale:
- Publishing before the total-diff review loop is clean would bypass the delivery gate the user requested.

### DES-006: Original prompt and stale specs are audit inputs
The implementation must start by auditing every original prompt item, slash/reference clarification, billing requirement, and recent related spec claim. Prior completed specs are evidence only, not acceptance proof.

Rationale:
- The user reports failures in areas previous specs marked complete.

### DES-007: Immediate Convex cost containment comes before broad rewrites
The first code remediation should reduce idle and reconnect amplification by changing scoped polling, reconnect refresh behavior, focus/online refresh staleness, degraded refresh cadence, redundant chat read-state writes, and legacy snapshot stream diagnostics.

Rationale:
- The invoice drivers are function calls and DB I/O; containment reduces burn while larger read-model migration proceeds.

### DES-008: Scoped read models must become real scoped Convex queries
Snapshot-backed read-model routes, read-model route handlers, authorization helpers, and mutation scope resolvers must be replaced with narrow indexed Convex queries/access checks and pagination for unbounded collections.

Rationale:
- Calling a route "scoped" while loading the full app snapshot preserves the billing and latency failure mode.

### DES-009: Reference and editor work must decouple UI commands from expensive editor hot paths
Slash Reference must open a safe scoped search mode from typed `/` and slash button paths in document and work item editors, while TipTap/editor optimizations remove unnecessary synchronous work from keypress paths.

Rationale:
- The user reports both broken Reference opening and persistent editor/create/dropdown lag.

### DES-010: Work surfaces own visible row eligibility and bulk action target correctness
Work surface selection, filters, parent-child cascade, private-task scoping, status flicker, bulk actions, and bulk delete must derive from rendered/eligible scoped items rather than retained broad app data.

Rationale:
- Bulk updates and filtered surfaces are high-risk because hidden/off-scope items can be mutated silently.

### DES-011: Property and create/document UI must use source-of-truth property data
Create modal inherited project display, work item detail sub-task composer project chips, document property pills, sort, labels, and property dropdowns must derive from actual scoped property/entity data and visible display configuration.

Rationale:
- Generic labels, duplicate pills, inert labels, and broken sort/property controls undermine trust in configured views.

### DES-012: Chat data consistency and message metadata must be redesigned together
Conversation list stability, message disappearance, deleted-message previews, collapse affordance, message grouping, link rendering, and message metadata/read receipts must be handled through authoritative backend/read-model state plus local optimistic reconciliation. Message metadata should be compact, right-anchored in line with the thread content, and avoid noisy left-side receipt clutter. Read state should use an eye/read icon with a read timestamp where needed, while edited state should render as the text `Edited` without an edited timestamp. Consecutive messages from the same sender should remain visually grouped without repeating avatar/name, even across long gaps, and grouping should reset when another sender posts. Links inside message content should render blue and underlined, but link styling must apply only to the linked text and never leak across the entire thread message.

Rationale:
- Chat issues span UI layout, optimistic state, backend read state, message metadata, and read-model merging; treating them separately risks another partial fix.

### DES-013: Comments, profile, and sidebar polish are shared interaction contract fixes
Reply-vs-quote behavior, profile hover layering, activity detail density, and offline status icon fixes must be implemented in their owning shared primitives or surface-specific components without breaking chat quote behavior.

Rationale:
- These are visible regressions across repeated surfaces and need consistent interaction semantics.

### DES-014: Cost guardrails must prevent architectural relapse
Static tests, diagnostics, retention cleanup, and environment-target checks must make snapshot-backed read models, unsafe polling defaults, and wrong Convex deployment targeting detectable.

Rationale:
- Without enforcement, the same billing architecture can regress after the immediate fix.

### DES-015: Knowledge fixes must close the owner and bypass paths
Every implementation slice must fix the underlying owner of the broken behavior, audit sibling surfaces and bypass paths, and record why the fix is complete. A narrow visual patch is acceptable only when the owning invariant is truly presentation-local and that conclusion is recorded.

Rationale:
- The backlog contains repeated regressions where old fixes treated a symptom but missed related flows, retained data, backend reads, or shared component entry points.

## Decision Register
- DES-001: Per-slice review is a delivery gate.
- DES-002: The review ledger is authoritative for implementation review state.
- DES-003: Spec drift must be corrected upstream before continuing.
- DES-004: Final review must cover the entire worktree and plan.
- DES-005: PR delivery happens only after a clean final loop.
- DES-006: Original prompt and stale specs are audit inputs.
- DES-007: Immediate Convex cost containment comes before broad rewrites.
- DES-008: Scoped read models must become real scoped Convex queries.
- DES-009: Reference and editor work must decouple UI commands from expensive editor hot paths.
- DES-010: Work surfaces own visible row eligibility and bulk action target correctness.
- DES-011: Property and create/document UI must use source-of-truth property data.
- DES-012: Chat data consistency and message metadata must be redesigned together.
- DES-013: Comments, profile, and sidebar polish are shared interaction contract fixes.
- DES-014: Cost guardrails must prevent architectural relapse.
- DES-015: Knowledge fixes must close the owner and bypass paths.

## Risk Register
- Risk: future implementer skips the protocol. Mitigation: protocol is duplicated in `tasks.md` and `reviews.md`.
- Risk: future product/cost tasks are added without traceability. Mitigation: spec lint and traceability checks remain required before implementation-ready updates.
- Risk: unrelated dirty worktree files are included in a future PR. Mitigation: PR delivery task requires staging intended files only.
- Risk: cost containment masks, but does not fix, broad snapshot reads. Mitigation: separate immediate containment from real scoped read-model migration.
- Risk: UI fixes regress prior completed specs. Mitigation: stale spec audit and browser/component verification are required.
- Risk: schema/read receipt redesign breaks old reads. Mitigation: compatibility tests and backend-first authority.
- Risk: a slice lands a partial fix for one screen while sibling surfaces remain broken. Mitigation: DES-015, REQ-KNOWLEDGE-001, and every task's pre-implementation context check require owner, sibling, bypass, retained-data, and optimistic-path audits.

## Test Impact Matrix
- Existing tests to update: work-surface, rich-text editor, chat-thread, document/detail screens, Convex/read-model tests as affected by slices.
- New tests required: static guardrails for snapshot-backed read models and polling defaults; component/store/Convex tests for every changed behavior.
- Compatibility tests: route response shapes, read receipt/read-state compatibility, private-task scope behavior, reference access behavior.
- Rollback-safety tests: env default containment, old read-model consumers, and migration-safe reads where schema changes occur.

## Validation Strategy
- Run `lint_spec.py` for section/frontmatter/schema compliance after spec updates.
- Run `traceability_report.py --strict` for DES -> REQ -> TASK coverage after spec updates.
- Run `git diff --check` for whitespace safety.
- Future code slices run focused tests, typecheck/lint/build as risk warrants, and cost/read-model checks for billing work; browser smoke is recorded as user-owned manual validation rather than agent-run validation.

## Post-Design Review
- The design maps the user-requested review addendum plus the full backlog/cost scope to stable decisions.
- No runtime code change is introduced by the spec-expansion slice.
- The package is ready for code implementation one slice at a time.

## Rollout, Abort, and Reversal
- Rollout: implement slices in task order, completing each slice review loop before continuing.
- Abort: stop only when a live finding, validation failure, spec drift, missing external access, or user direction blocks progress; preserve the review ledger and leave remaining tasks todo if blocked.
- Reversal: artifact-only updates can be reverted by deleting/editing spec files; future code slices need their own rollback notes.

## Forbidden Shortcuts and Guardrails
- Do not treat the review loop as optional because it is also implied by the spec skill.
- Do not open a PR before the final total-diff review loop is clean.
- Do not stage unrelated dirty worktree files.
- Do not continue implementation after spec drift without updating design, requirements, and tasks in order.
- Do not "fix" cost by only renaming routes while retaining snapshot-backed reads.
- Do not implement the removed double-click property requirement.
- Do not remove chat quote behavior from direct messages.
- Do not trust old spec completion claims without current verification.
- Do not patch only the first broken surface if the rule is owned by shared selectors, backend read models, editor command plumbing, store reconciliation, or shared UI primitives.

## Alternatives Considered
- Chat-only instruction: rejected because the user asked to implement the plan in the spec.
- Add only `tasks.md`: rejected because repo-local spec tooling expects design, requirements, tasks, and reviews.
- Modify an unrelated existing spec: rejected because the requested scope is `backlog-regression-performance-stability`.
- Only tune polling: rejected because it would not remove broad snapshot DB I/O.
- Rewrite directly to Convex native subscriptions first: deferred behind Next-route-compatible narrow query migration to reduce blast radius.

## Residual Risks
- Some implementation details may change as each slice re-reads live code; spec drift rules cover updates.
- Future dirty worktree changes must be reconciled carefully before validation or PR staging.
- Exact latency thresholds need baseline measurement in the performance slice.

## Review Of This Artifact Slice
- This package is an artifact-only implementation of the review protocol addendum.
- No application code, tests, or runtime behavior are intentionally changed by this slice.
- The previous unrelated deleted files and duplicate untracked test were restored/removed after user confirmation; this artifact slice now leaves only the intended spec package in the worktree.
