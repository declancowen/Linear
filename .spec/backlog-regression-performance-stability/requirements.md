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

# Requirements: Backlog Regression Performance Stability

## Source Artifacts
- `.spec/backlog-regression-performance-stability/design.md`
- Original backlog prompt from 2026-06-03.
- Slash/reference clarification from 2026-06-03.
- Billing/cost architecture prompt from 2026-06-03.
- User prompt on 2026-06-03 requesting explicit per-slice and final review loops.
- `spec-driven-development` and `architecture-standards` skill contracts.

## Scope Statement
- These requirements govern the combined backlog regression, performance, Convex billing/cost, review-loop, and PR-delivery implementation.
- The double-click property line is intentionally removed per the user's clarification.

## Cross-Cutting Coverage
- Security: REQ-REVIEW-001 and REQ-FINAL-001 require architecture-aware review for future security-sensitive changes.
- Privacy: REQ-DRIFT-001 and REQ-FINAL-001 keep future privacy requirements tied to original asks and live repo facts.
- Performance: REQ-FINAL-001 includes cost/read-model checks and full validation before PR delivery.
- Resilience: REQ-REVIEW-001 and REQ-FINAL-001 require finding fix loops before progressing or publishing.
- Migration: REQ-DRIFT-001 requires upstream spec updates before implementation continues when assumptions change.
- Observability: REQ-RECORD-001 requires review, validation, findings, fixes, and residual risk to be recorded.
- Supportability: REQ-RECORD-001, REQ-KNOWLEDGE-001, and REQ-PR-001 require handoff-ready review, root-cause closure evidence, and PR context.
- Backward compatibility: REQ-FINAL-001 requires full-worktree review before publication.

## Requirements

### REQ-REVIEW-001: Gate every requirement slice with deep review, clean-loop re-review, and architecture assessment
Source Design Decisions:
- DES-001
- DES-002

Priority: Critical

Rationale:
- The future implementation scope is broad and high-risk; slice-local deep review prevents unrelated regressions from being hidden inside a large diff.

Requirement:
- THE implementation process SHALL run a deep `diff-review` with `architecture-standards` after each coherent requirement slice, fix every live finding, run normal `diff-review` passes until the slice/worktree is clean, then run a slice architecture assessment with `architecture-standards` and fix every live architecture finding before continuing to the next slice.

Verification Method:
- Inspect `tasks.md` and `reviews.md` entries for each future slice; confirm deep review occurred before normal review, the architecture assessment occurred after the clean review loop, and both were clean before the next slice began.

Risk if Unmet:
- A future implementation could move between slices with unresolved production, architecture, security, performance, or behavior regressions.

Acceptance Criteria:
1. WHEN a slice is implemented, THEN focused validation SHALL run before review.
2. WHEN focused validation completes, THEN a deep diff review SHALL run before any normal review pass.
3. WHEN the deep review reports live findings, THEN those findings SHALL be fixed before continuing.
4. WHEN fixes are made, THEN normal diff-review passes SHALL rerun until clean.
5. WHEN the normal review loop is clean, THEN a slice architecture assessment SHALL run with `architecture-standards`.
6. WHEN architecture findings are live, THEN they SHALL be fixed and re-reviewed before the next slice starts.
7. WHEN the slice is clean, THEN its review and architecture assessment state SHALL be recorded in `reviews.md`.

Negative Cases:
1. A slice SHALL NOT move to the next slice with unresolved Critical, High, or live Medium findings unless explicitly recorded as blocked.
2. A normal review SHALL NOT replace the first deep review for a slice.
3. A clean diff-review SHALL NOT replace the required slice architecture assessment.

### REQ-RECORD-001: Record all review outcomes in the spec review ledger
Source Design Decisions:
- DES-002

Priority: Critical

Rationale:
- A review loop is not auditable unless outcomes, fixes, decisions, and residual risks are recorded in one stable ledger.

Requirement:
- THE implementation process SHALL record validation, deep-review findings, fixes, normal re-review outcomes, architecture decisions, spec drift decisions, requirement audit status, and residual risk in `.spec/backlog-regression-performance-stability/reviews.md`.

Verification Method:
- Inspect `.spec/backlog-regression-performance-stability/reviews.md` for each future slice and final review entry.

Risk if Unmet:
- Future implementers and reviewers would not know what was reviewed, fixed, left risky, or cleared.

Acceptance Criteria:
1. WHEN a deep review runs, THEN `reviews.md` SHALL include the slice, linked requirements, validation, findings, fixes, and residual risk.
2. WHEN normal re-reviews run, THEN `reviews.md` SHALL record whether they are clean or what follow-up they required.
3. WHEN a slice is clean, THEN `reviews.md` SHALL state that the slice is cleared to move forward.

Negative Cases:
1. A slice SHALL NOT be considered complete if its review state is only described in chat or PR text and not recorded in `reviews.md`.

### REQ-DRIFT-001: Pause implementation and update upstream spec artifacts on drift
Source Design Decisions:
- DES-003

Priority: Critical

Rationale:
- The original user request and live repo evidence remain authoritative; stale generated tasks must not overrule them.

Requirement:
- THE implementation process SHALL pause if review finds drift from the original backlog prompt, slash/reference clarification, billing/cost requirements, architecture standards, or live repo facts; it SHALL update `design.md`, then `requirements.md`, then `tasks.md` before continuing.

Verification Method:
- Inspect review entries and spec diffs when drift is identified; confirm upstream artifacts changed in order before implementation resumed.

Risk if Unmet:
- Implementation can become correct relative to stale tasks while failing the user's actual request or current architecture reality.

Acceptance Criteria:
1. WHEN drift is found in design assumptions, THEN `design.md` SHALL be updated first.
2. WHEN design changes affect requirements, THEN `requirements.md` SHALL be updated before tasks.
3. WHEN requirements change, THEN `tasks.md` SHALL be updated before implementation resumes.
4. WHEN drift is intentionally rejected, THEN the reason SHALL be recorded in `reviews.md`.

Negative Cases:
1. A task SHALL NOT be patched alone when the underlying design or requirement changed.
2. Implementation SHALL NOT continue from a known stale task.

### REQ-FINAL-001: Run a final total-diff deep review, architecture assessment, and clean loop
Source Design Decisions:
- DES-004

Priority: Critical

Rationale:
- Passing slice reviews does not prove the integrated branch is safe across product, performance, billing, backend, and UI boundaries.

Requirement:
- THE implementation process SHALL run full validation, a final deep diff review, and a final full-diff architecture assessment across the complete worktree after all slices are complete, then fix findings and rerun normal full-worktree reviews and architecture assessment passes until clean.

Verification Method:
- Inspect the final `reviews.md` entry for full validation, final deep review, final architecture assessment, fix loop, and normal clean-loop evidence.

Risk if Unmet:
- Cross-slice regressions, incomplete validation, or review gaps could ship even if every individual slice looked acceptable.

Acceptance Criteria:
1. WHEN all slices are complete, THEN targeted tests, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and cost/read-model checks SHALL run or be explicitly recorded as unavailable with reason, while browser smoke SHALL be recorded as user-owned manual validation per the 2026-06-03 instruction.
2. WHEN full validation completes, THEN a deep total-diff review SHALL run against the original backlog prompt, slash/reference clarification, billing/cost requirements, full spec package, architecture standards, tests, and validation evidence.
3. WHEN total-diff findings are live, THEN they SHALL be fixed.
4. WHEN fixes are made, THEN normal total-diff reviews SHALL rerun until clean.
5. WHEN normal total-diff reviews are clean, THEN a final architecture assessment SHALL run across the entire diff using `architecture-standards`.
6. WHEN final architecture findings are live, THEN they SHALL be fixed and re-reviewed before PR delivery.
7. WHEN clean, THEN the final review and architecture assessment state SHALL be recorded in `reviews.md`.

Negative Cases:
1. A final normal review SHALL NOT replace the final deep review.
2. A final review SHALL NOT ignore the original backlog prompt, slash/reference clarification, or billing/cost requirements.
3. A clean final diff-review SHALL NOT replace the final full-diff architecture assessment.

### REQ-PR-001: Open a draft PR to main only after clean final review
Source Design Decisions:
- DES-005

Priority: High

Rationale:
- Publishing should happen only after the requested review gates are clean, and the PR must preserve scope safety in a dirty worktree.

Requirement:
- THE implementation process SHALL create or use a new branch targeting `main`, stage only intended files, commit intentionally, push, and open a draft PR to `main` only after the final review loop is clean.

Verification Method:
- Inspect git status/staged files before commit, branch target, pushed branch, and draft PR metadata/body.

Risk if Unmet:
- Unreviewed or unrelated changes could be published, or reviewers could receive a PR without validation and review-loop context.

Acceptance Criteria:
1. WHEN the worktree contains unrelated user-owned changes, THEN only intended files SHALL be staged.
2. WHEN the final review loop is clean, THEN the branch SHALL be pushed.
3. WHEN the branch is pushed, THEN a draft PR SHALL be opened to `main`.
4. WHEN the PR is opened, THEN the PR body SHALL summarize changes, root causes, validation, review-loop status, and residual risks.

Negative Cases:
1. A PR SHALL NOT be opened before the final total-diff review loop is clean.
2. Unrelated dirty worktree files SHALL NOT be staged silently.

### REQ-AUDIT-001: Audit the original backlog, stale specs, and live repo before code slices
Source Design Decisions:
- DES-006

Priority: Critical

Rationale:
- The user reported failures in areas previous specs marked complete, so implementation cannot trust old completion status.

Requirement:
- THE implementation SHALL create a traceability audit of every original backlog item, slash/reference clarification, billing/cost requirement, removed double-click item, and relevant recent spec claim before application code changes begin.

Verification Method:
- Inspect `reviews.md`, `design.md`, and `requirements.md` for a complete prompt/spec audit and drift decisions.

Risk if Unmet:
- Requirements from the first prompt can disappear behind the billing track or stale prior specs can be repeated without fixing current behavior.

Acceptance Criteria:
1. WHEN implementation starts, THEN every original backlog item SHALL map to an active requirement or the explicitly removed double-click decision.
2. WHEN prior specs claim completion, THEN those claims SHALL be revalidated against live code/runtime evidence.
3. WHEN a requirement is ambiguous, THEN implementation SHALL use the latest user clarification or record the assumption in the spec before code changes.

Negative Cases:
1. The implementation SHALL NOT compress the original backlog into a generic "UI fixes" task.
2. The implementation SHALL NOT treat `.spec/work-item-reference-activity-ui/` or `.spec/workspace-surface-editor-stability/` as acceptance evidence by themselves.

### REQ-KNOWLEDGE-001: Complete each fix through the owning invariant and sibling paths
Source Design Decisions:
- DES-015

Priority: Critical

Rationale:
- The user explicitly called out repeated fixes that did not hold across related surfaces, old specs, performance paths, and scoped read-model paths.

Requirement:
- THE implementation SHALL close each root cause through the owning boundary, audit sibling and bypass paths, and record proof that the fix covers all affected surfaces before marking a slice clean.

Verification Method:
- Inspect each slice review entry for owner selection, sibling/bypass path audit, tests, focused validation, and residual risk.

Risk if Unmet:
- The code can look fixed in one screen while the same broken rule remains in another editor, list, board, read-model, optimistic merge, backend mutation, or retained-data path.

Acceptance Criteria:
1. WHEN a slice starts, THEN it SHALL identify the owner of the invariant before editing.
2. WHEN a fix touches shared behavior, THEN sibling surfaces and bypass paths SHALL be searched and either fixed or recorded as not affected with evidence.
3. WHEN a fix changes optimistic state, read models, filters, editor commands, or backend mutations, THEN retained-data and reconciliation paths SHALL be validated.
4. WHEN the slice review runs, THEN `reviews.md` SHALL record why the fix is complete rather than partial.

Negative Cases:
1. A slice SHALL NOT be cleared when it only changes the first visible component and leaves the owner unchanged.
2. A slice SHALL NOT defer a sibling-path fix unless it is explicitly outside the requirement and recorded as residual risk.

### REQ-COST-001: Contain Convex polling, reconnect, snapshot, and high-churn write amplification
Source Design Decisions:
- DES-007

Priority: Critical

Rationale:
- The invoice shows function calls and DB I/O are the primary cost drivers, and live code confirms 1-second scoped polling plus reconnect and refresh amplification.

Requirement:
- THE implementation SHALL reduce idle/reconnect Convex cost by changing scoped polling defaults, reconnect-ready refresh behavior, focus/online refresh staleness, degraded refresh cadence, redundant chat read-state writes, and legacy snapshot stream diagnostics.

Verification Method:
- Unit/static tests for polling defaults and refresh suppression, targeted runtime diagnostics, and cost/read-model checks.

Risk if Unmet:
- Idle clients can continue to produce excessive function calls and DB I/O before real usage.

Acceptance Criteria:
1. WHEN scoped invalidation has no changes, THEN reconnect `ready` SHALL NOT refresh every subscriber.
2. WHEN the app is idle, THEN scoped polling SHALL use a production-safe configurable interval instead of the 1-second default.
3. WHEN focus/online fires repeatedly, THEN refreshes SHALL be gated by visibility, staleness, and in-flight state.
4. WHEN chat read state is unchanged for a user/conversation/read boundary, THEN redundant mutations SHALL be suppressed.
5. WHEN legacy snapshot stream is enabled in production, THEN diagnostics SHALL make that visible.

Negative Cases:
1. Cost containment SHALL NOT remove realtime invalidation correctness.
2. Cost containment SHALL NOT hide broad snapshot reads from later scoped-read-model migration.

### REQ-SCOPED-001: Replace snapshot-backed read models and mutation scope resolvers with real scoped queries
Source Design Decisions:
- DES-008

Priority: Critical

Rationale:
- Most current read-model routes are scoped by name but still load the full application snapshot through route handlers or helper layers.

Requirement:
- THE implementation SHALL replace snapshot-backed read-model routes, read-model route handlers, snapshot-based read authorization, and mutation-side scope-key resolvers with narrow indexed Convex queries/access checks, preserving compatible response shapes where possible.

Verification Method:
- Static guard tests banning `getSnapshotServer` in read-model routes/server handlers, Convex/API tests for scope access, and route response compatibility tests.

Risk if Unmet:
- Billing and latency remain driven by broad reads even if polling is reduced.

Acceptance Criteria:
1. WHEN notification inbox, conversation list/thread, channel feed, work index, document detail/index, work item detail, project detail/index, view catalog, workspace people, and search seed read models load, THEN they SHALL read only required scope data.
2. WHEN mutation routes resolve read-model scope keys, THEN they SHALL NOT load a broad app snapshot.
3. WHEN unbounded collections are returned, THEN pagination or bounded loading SHALL be used.
4. WHEN access is checked, THEN narrow authorization queries SHALL replace snapshot-derived authorization.
5. WHEN the migration completes, THEN read-model route/server-handler static checks SHALL fail on `getSnapshotServer`.

Negative Cases:
1. Renaming handlers or moving snapshot calls behind another helper SHALL NOT satisfy this requirement.
2. Workspace membership's existing narrow bootstrap path SHALL NOT be regressed.

### REQ-REFERENCE-001: Open scoped Reference search from slash command paths in document and work item editors
Source Design Decisions:
- DES-009

Priority: Critical

Rationale:
- The user clarified the intended behavior: type `/`, select `Reference`, and open scoped search mode for linking/embedding supported work.

Requirement:
- THE implementation SHALL make typed `/` and slash-button command flows open a scoped Reference search mode in document and work item editors, supporting work items, documents, projects, and views while excluding people and create actions.

Verification Method:
- Rich text editor component tests, with browser smoke recorded as user-owned manual validation for document and work item editors.

Risk if Unmet:
- The primary linking/embedding workflow remains broken.

Acceptance Criteria:
1. WHEN a user types `/` in a document editor and selects `Reference`, THEN the scoped search mode SHALL open.
2. WHEN a user types `/` in a work item editor and selects `Reference`, THEN the scoped search mode SHALL open.
3. WHEN a user clicks the slash command button and selects `Reference`, THEN the same scoped search mode SHALL open.
4. WHEN scoped search opens, THEN it SHALL show only work items, documents, projects, and views the user can reference.
5. WHEN the user selects a reference, THEN insertion SHALL restore/preserve the editor selection and insert the intended link/embed reference.

Negative Cases:
1. The scoped Reference search SHALL NOT show people.
2. The scoped Reference search SHALL NOT show create actions.
3. The implementation SHALL NOT depend on fragile transient menu state that closes before the picker opens.

### REQ-PERF-001: Deep-dive and remediate navigation, surface loading, create modal, dropdown, and TipTap lag
Source Design Decisions:
- DES-009

Priority: Critical

Rationale:
- The user reported slow navigation, surface loading, create modal typing, dropdown changes, and insufficient TipTap optimization.

Requirement:
- THE implementation SHALL measure and remediate lag in navigation, surface loading, create modal typing, dropdown changes, work item TipTap typing, snapshot/scoped-read-model refreshes, and store/render fan-out.

Verification Method:
- Baseline/performance notes in `reviews.md`, targeted tests where applicable, diagnostics for first useful render/read-model refresh, and browser smoke recorded as user-owned manual validation.

Risk if Unmet:
- The app remains slow even if individual UI bugs are fixed.

Acceptance Criteria:
1. WHEN performance work begins, THEN baseline evidence SHALL be captured before fixes.
2. WHEN editor typing changes are made, THEN synchronous keypress work SHALL be reduced without breaking collaboration, mentions, references, or sanitization.
3. WHEN create modal typing is tested, THEN typing SHALL not trigger unnecessary broad store/read-model work.
4. WHEN dropdown changes are made, THEN optimistic updates and read-model refreshes SHALL avoid visible bounce/flicker.
5. WHEN navigation/surface loading is tested, THEN retained data and scoped refreshes SHALL avoid unnecessary loading states.

Negative Cases:
1. The implementation SHALL NOT claim performance success without code/runtime diagnostic or test evidence; browser confirmation SHALL remain user-owned manual validation.
2. The implementation SHALL NOT repeat old fixes without checking why they failed.

### REQ-WORKSURFACE-001: Fix work surface selection, filters, private-task scoping, status flicker, and bulk actions
Source Design Decisions:
- DES-010

Priority: Critical

Rationale:
- The user reported multi-select visual issues, bulk action failures, missing parent filter cascade, private-task leakage, and filtered status bounce.

Requirement:
- THE implementation SHALL fix multi-select UI/targeting, bulk updates, bulk selected-item delete, parent filter cascade across all listed surfaces, private-task workspace/group leakage, and filtered status-change flicker.

Verification Method:
- Work-surface component/store tests, bulk mutation tests, and browser smoke recorded as user-owned manual validation across team space and my-items surfaces.

Risk if Unmet:
- Users can mutate hidden/off-scope items, see incorrect private-task properties, or experience broken filtered workflows.

Acceptance Criteria:
1. WHEN multi-select checkboxes render, THEN they SHALL align with the item identity/group content next to the PVT/identity cluster, not the far-left gutter.
2. WHEN unchecked, THEN selection boxes SHALL be gray, borderless, and subtle.
3. WHEN selected, THEN selection boxes SHALL show a black tick and remain visible.
4. WHEN hovering selected rows, THEN text SHALL remain visible and layout SHALL not shift.
5. WHEN bulk actions run, THEN they SHALL apply to every selected eligible item with no silent small-batch limit.
6. WHEN bulk delete runs, THEN it SHALL delete all selected work items after confirmation.
7. WHEN parent filters apply, THEN child cascade SHALL work in team space board, my items board/list, team spaces, and my items surfaces.
8. WHEN private tasks render, THEN workspace/team-only grouping and properties SHALL NOT leak in.
9. WHEN a filtered my-list item status changes out of the filter, THEN it SHALL disappear once and not bounce back.

Negative Cases:
1. Selection ranges SHALL NOT include hidden, collapsed, retained, or off-scope rows.
2. Bulk actions SHALL NOT mutate invisible items.

### REQ-PROPERTY-001: Fix create-modal inherited project, project icons, document pills, sort, label dropdowns, and property controls
Source Design Decisions:
- DES-011

Priority: High

Rationale:
- The user reported generic inherited project labels, missing project-specific icons in the create-modal project dropdown and work item detail sub-task creation surface, misplaced/duplicate document pills, broken sort, and visible labels without dropdown behavior.

Requirement:
- THE implementation SHALL fix create modal inherited project display, create-modal project icons, work item detail sub-task composer project icons, document list property pills, sort dropdown behavior, visible/editable label dropdowns, and property-control consistency.

Verification Method:
- Component tests for create dialog/document list/property controls, sort popover tests, and manual browser smoke by the user.

Risk if Unmet:
- Configured view and create workflows continue to show stale, generic, duplicate, or inert property UI.

Acceptance Criteria:
1. WHEN creating a child item whose parent belongs to a project, THEN the disabled project field SHALL show the actual inherited project name.
2. WHEN the parent project is outside the immediate project option list but accessible, THEN the display SHALL still resolve the actual project name.
3. WHEN create-modal project dropdown options render, THEN they SHALL show each project's configured icon.
4. WHEN the inherited project field is disabled because the parent supplies the project, THEN it SHALL show the inherited project's configured icon as well as its real name.
5. WHEN creating a sub-task from the work item detail surface, THEN the inline sub-task composer project chip SHALL show the inherited project's configured icon and real name.
6. WHEN document list rows show configured property pills, THEN the pills SHALL appear at the right end on desktop, use a compact mobile fallback, and dedupe by property/value.
7. WHEN sort is clicked, THEN the sort dropdown SHALL open and update ordering.
8. WHEN labels are visible and editable in lists, THEN a label dropdown SHALL be enabled using assignability rules.

Negative Cases:
1. Document pills SHALL NOT duplicate values or ignore configured display properties.
2. Private tasks SHALL NOT expose team/workspace label controls when not assignable.
3. Create-modal and work item detail sub-task project controls SHALL NOT use a generic placeholder icon when project-specific icon data is available.

### REQ-CHAT-001: Fix chat layout, previews, disappearing messages, and compact message metadata
Source Design Decisions:
- DES-012

Priority: Critical

Rationale:
- The user reported the left chat conversation-list panel width jumping, missing collapse affordance, deleted-message preview bugs, disappearing messages, and noisy duplicated read receipts. The pasted original prompt says to ignore the current read-receipt requirement; the later plan keeps a compact message-metadata redesign in scope so the old per-message duplicate receipt UI is not patched piecemeal.

Requirement:
- THE implementation SHALL stabilize the left chat conversation-list panel layout, add collapse behavior for that left conversation panel, fix latest readable preview selection after deletion, fix optimistic/backend/read-model message disappearance, group consecutive same-sender messages without repeated identity chrome, render message links correctly, and redesign message metadata/read receipts into a compact non-duplicated model.

Verification Method:
- Chat component/store/Convex tests, conversation preview tests, read receipt tests, and browser smoke recorded as user-owned manual validation for send/delete/collapse/read-state flows.

Risk if Unmet:
- Chat remains unreliable and noisy, with messages disappearing and read receipt UI overwhelming the conversation.

Acceptance Criteria:
1. WHEN chat loads, THEN the left conversation-list panel width SHALL not jump.
2. WHEN the user needs more space, THEN a collapse button SHALL appear next to the username/user area and collapse/restore the left conversation-list panel.
3. WHEN a message is deleted, THEN conversation preview SHALL use the latest readable message.
4. WHEN a message is sent, THEN it SHALL remain visible through optimistic state, backend sync, and read-model refresh.
5. WHEN message metadata renders, THEN it SHALL be anchored to the right of the thread while staying in line with the message row/content.
6. WHEN a message has read state, THEN the UI SHALL use an eye/read icon plus read timestamp where a read timestamp is shown, rather than verbose left-side receipt text.
7. WHEN a message has edited state, THEN the UI SHALL render `Edited` without showing an edited timestamp.
8. WHEN read receipts render, THEN they SHALL avoid duplicates and avoid noisy receipt-after-every-message UI.
9. WHEN the same sender posts consecutive messages, THEN avatar/name identity chrome SHALL NOT repeat just because time elapsed.
10. WHEN a different sender posts between messages, THEN the next message from the original sender SHALL show identity chrome again.
11. WHEN message content contains a link, THEN only the linked text SHALL render blue and underlined.
12. WHEN a link is inserted into a thread message, THEN underline/link styling SHALL NOT leak to non-link text or the entire message.

Negative Cases:
1. Deleted unreadable messages SHALL NOT become conversation previews.
2. Read receipt redesign SHALL NOT create extra writes for every render/read pass.
3. Message metadata SHALL NOT add left-side clutter or duplicate edited/read timestamp labels.
4. Message grouping SHALL NOT hide identity when authorship changes between adjacent messages.
5. Link styling SHALL NOT be applied at the message container level.

### REQ-POLISH-001: Fix reply semantics, profile hover/activity detail, and sidebar offline status
Source Design Decisions:
- DES-013

Priority: High

Rationale:
- The user reported quote/reply mismatch, covered profile hover cards, overly simple activity, and an incorrect offline X icon.

Requirement:
- THE implementation SHALL remove quote behavior from channels/comments/work-item comments, keep quote behavior in direct messaging, fix profile hover layering, expand profile activity detail/density, and replace the bottom-left sidebar offline X icon with a cleaner status indicator.

Verification Method:
- Component tests for reply/quote availability, activity rendering tests, sidebar footer snapshot/component tests, and browser smoke recorded as user-owned manual validation for hover layering.

Risk if Unmet:
- Shared collaboration surfaces remain visually inconsistent and interaction semantics remain wrong.

Acceptance Criteria:
1. WHEN interacting with channels, channel comments, work item comments, or work item activity comments, THEN the action SHALL be Reply with a reply icon and SHALL NOT insert quoted content.
2. WHEN interacting with direct chat messages, THEN quote behavior SHALL remain available.
3. WHEN hovering avatars in chat/channel/work surfaces, THEN profile hover cards SHALL render above the surface and not be clipped.
4. WHEN profile activity shows comments/status/property changes, THEN it SHALL include enough detail such as comment preview, status from/to, and changed property/value, using denser left-column typography where needed to fit the information.
5. WHEN the sidebar footer shows offline status, THEN it SHALL use a cleaner offline indicator instead of the current X icon treatment.

Negative Cases:
1. Removing quote from comments SHALL NOT remove chat message quote.
2. Hover card layering SHALL NOT break menus/dialogs that already portal correctly.

### REQ-GUARDRAIL-001: Add Convex cost guardrails, retention cleanup, env targeting, and diagnostics
Source Design Decisions:
- DES-014

Priority: Critical

Rationale:
- Without guardrails, snapshot-backed read models, unsafe polling defaults, stale rows, and wrong deployment targeting can reappear.

Requirement:
- THE implementation SHALL add static tests, diagnostics, retention cleanup, and environment-target checks that prevent or expose Convex cost regressions.

Verification Method:
- Static tests, route/helper import checks, diagnostics output tests, retention cleanup tests, and env audit checks.

Risk if Unmet:
- The same billing architecture can regress after the immediate remediation.

Acceptance Criteria:
1. WHEN read-model routes or server handlers import/call `getSnapshotServer`, THEN a static test SHALL fail.
2. WHEN scoped polling defaults fall below the approved production minimum, THEN a test SHALL fail.
3. WHEN diagnostics run, THEN they SHALL identify function/route name, calls/day, DB I/O/day, return bytes, and source where available.
4. WHEN retention cleanup runs, THEN old notifications, stale read-model version rows, and `emailJobs` SHALL be cleaned according to configured policy.
5. WHEN local/prod Convex envs differ, THEN the investigation tooling/docs SHALL make the target deployment explicit.

Negative Cases:
1. Guardrails SHALL NOT rely only on comments or documentation.
2. Retention cleanup SHALL NOT delete active/current user data.

## Upstream Alignment Audit
- The user's requested per-slice review loop is covered by REQ-REVIEW-001 and REQ-RECORD-001.
- The user's requested spec drift rule is covered by REQ-DRIFT-001.
- The user's requested final review loop is covered by REQ-FINAL-001.
- The user's requested branch, commit, push, and draft PR flow is covered by REQ-PR-001.
- The user's no-partial-fixing correction is covered by REQ-KNOWLEDGE-001.
- The original backlog prompt is covered by REQ-AUDIT-001 and REQ-REFERENCE-001 through REQ-POLISH-001.
- The billing/cost prompt is covered by REQ-COST-001, REQ-SCOPED-001, and REQ-GUARDRAIL-001.
- The double-click property item is removed per clarification and intentionally has no implementation requirement.

## Traceability Matrix
| Requirement | Design Decisions | Tasks |
| --- | --- | --- |
| REQ-REVIEW-001 | DES-001, DES-002 | 0.1, future slices, 99 |
| REQ-RECORD-001 | DES-002 | 0.1, future slices, 99 |
| REQ-DRIFT-001 | DES-003 | 0.1, future slices |
| REQ-FINAL-001 | DES-004 | 0.1, 99 |
| REQ-PR-001 | DES-005 | 0.1, 99 |
| REQ-AUDIT-001 | DES-006 | 1.1 |
| REQ-KNOWLEDGE-001 | DES-015 | 1.1, all implementation slices, 99 |
| REQ-COST-001 | DES-007 | 2.1 |
| REQ-SCOPED-001 | DES-008 | 3.1 |
| REQ-REFERENCE-001 | DES-009 | 4.1 |
| REQ-PERF-001 | DES-009 | 4.2 |
| REQ-WORKSURFACE-001 | DES-010 | 5.1 |
| REQ-PROPERTY-001 | DES-011 | 6.1 |
| REQ-CHAT-001 | DES-012 | 7.1 |
| REQ-POLISH-001 | DES-013 | 8.1 |
| REQ-GUARDRAIL-001 | DES-014 | 9.1 |
