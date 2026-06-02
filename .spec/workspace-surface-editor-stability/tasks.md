---
title: Workspace Surface Stability, Editor Safety, And App Performance
scope: workspace-surface-editor-stability
status: implementation-ready
repo_root: /Users/declancowen/Documents/GitHub/Linear
change_class: audit-remediation
risk_level: high
owner: product-engineering
reviewers: []
approvers: []
implementation_owner: product-engineering
operations_owner: product-engineering
last_updated: 2026-06-02
---

# Task Plan: Workspace Surface Stability, Editor Safety, And App Performance

## Source Artifacts
- `.spec/workspace-surface-editor-stability/design.md`
- `.spec/workspace-surface-editor-stability/requirements.md`
- `.reviews/work-item-reference-activity-ui.md`
- `.audits/full-codebase-audit.md`
- `.audits/realtime-collaboration-outline-comparison.md`

## Gating Status
- Ready for implementation
- Blocking design decisions:
  - None before T-001.
  - T-004 must pause and update design if source-owned linked arrays cannot safely represent reference source/direction/inline-embed-link representation.
  - T-007 must pause and update design if hydration evidence proves HTML cannot remain canonical.
  - T-008 must pause and update design if existing chat/message persistence cannot represent first-read timestamps without a schema contract change.

## Execution Status Summary
- To do: 10.1
- In progress: none
- Completed: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1
- Deferred: none
- Blocked: none

## Sequencing Notes
- Start with sidebar persistence because it is a bounded persisted UI state change already partially implemented in the current branch.
- Multi-select and dynamic property menus are adjacent and may be reviewed as one tightly coupled requirement cluster only if separating them would produce false confidence.
- Reference work must import the June 1 review contract before code changes and must not regress sanitizer/access/backlink behavior.
- Hydration safety must be implemented before broad final performance claims because document data loss has higher severity than loading speed.
- T-006 and T-007 share collaboration bootstrap, presence, active PartyKit room, flush, and teardown assumptions. T-006 may optimize the work item title/description hot path only if T-007 later revalidates those shared hydration/presence contracts across documents and work item description documents.
- Chat read-receipt work must use architecture-standards because it changes backend/read-model message metadata authority.
- Performance audit/remediation is last before final validation because earlier slices add diagnostics and may change render/read-model paths.

## Implementation Authority And Review Loop
- The original prompt and follow-ups are authoritative for target behavior.
- `architecture-standards` is the design and review lens for ownership, dependency direction, state authority, privacy, performance, and proportionality.
- Live repo evidence and tests are authoritative for current behavior.
- Before each leaf task, read the linked DES entries, REQ entries, task entry, relevant source files, existing tests, and any linked review/audit evidence.
- Each material code/test decision must state or follow the relevant architecture-standard boundary before editing.
- After each leaf task or coherent requirement slice, run focused validation, then run a deep `diff-review` first with `architecture-standards`; fix findings; run normal `diff-review` loops until clean; record validation, findings, fixes, architecture decisions, spec drift decisions, requirement audit, and residual risk in `.spec/workspace-surface-editor-stability/reviews.md`.
- If `diff-review` is unavailable, run an equivalent manual deep review using the diff-review criteria and record the fallback.
- If code reality diverges from this spec or the user corrects the plan, update design, then requirements, then tasks before continuing implementation.

## Blocking Work
- None currently.

## Tasks

- [x] 1. Sidebar state persistence
  - [x] 1.1 Persist collaboration sidebar open/closed state per viewer and surface
    - Status: completed
    - Depends on: none
    - Likely areas: `lib/domain/types-internal/models.ts`, `lib/domain/empty-state.ts`, `lib/store/app-store.ts`, `lib/store/app-store-internal/slices/ui.ts`, `components/app/collaboration-screens.tsx`, `components/app/collaboration-screens/workspace-chats-screen.tsx`, `tests/lib/store/viewer-view-config.test.ts`
    - Validation: targeted store/component tests, `pnpm typecheck` after fixture updates, diff whitespace check
    - Exit criteria: channel, team chat, and workspace chat details sidebars reopen exactly as last left by the current viewer/surface and first visit defaults open
    - Rollback impact: persisted UI field can remain inert if UI hook is reverted
    - Blocking unknowns: none
    - Pre-implementation context check: read DES-003, DES-004, REQ-SIDE-001, current persisted UI store patterns, collaboration sidebar components, and architecture standards for viewer-scoped UI state
    - Test creation review: tests must assert viewer scoping, compaction bounds, default-open fallback, and update action behavior
    - Slice review loop: run deep diff-review first with architecture-standards; fix findings; run normal diff-review loops until clean; record validation, findings/fixes, requirement audit, and residual risk in `reviews.md`
    - Post-implementation review: completed; deep review found a coverage gap for hook/default behavior, which was fixed with `tests/components/collaboration-sidebar-state.test.tsx`; normal review pass then passed focused lint, diff check, focused Vitest, and typecheck
    - Spec drift check: completed; implementation matches REQ-SIDE-001 and keeps state authority in viewer-scoped persisted UI rather than durable collaboration data
    - Audit archetypes: `shared-ui`, `fallback-state`, `contract`
    - _Requirements: REQ-SIDE-001, REQ-REVIEW-001_

- [x] 2. Multi-select foundation
  - [x] 2.1 Add visible-row selection for work items, child rows, subitems, and detail subitems
    - Status: completed
    - Depends on: 1.1
    - Likely areas: `components/app/screens/work-surface-view.tsx`, `components/app/screens/work-surface-view/*`, `components/app/screens/work-item-ui.tsx`, `components/app/screens/work-item-detail-screen.tsx`, selection helper modules, component tests
    - Validation: component tests for click, Cmd/Ctrl-click, Shift range, right-click selected/unselected target behavior, and selection clearing on surface change
    - Exit criteria: bulk target set includes only selected visible rows/subitems/detail subitems intended by the user
    - Rollback impact: ephemeral UI state can revert without persisted migration
    - Blocking unknowns: none
    - Pre-implementation context check: read DES-003, DES-005, REQ-SELECT-001, visible row derivation code, current context-menu code, and architecture standards for ephemeral state
    - Test creation review: tests prove user-visible selection and target calculation rather than private helper shape only
    - Slice review loop: run deep diff-review first with architecture-standards; fix findings; run normal diff-review loops until clean; record validation, findings/fixes, requirement audit, and residual risk in `reviews.md`
    - Post-implementation review: completed together with 3.1; deep review found and fixed read-only selection leakage, then normal clean-loop review passed focused validation and diff checks
    - Spec drift check: completed; selection is ephemeral, visible-row scoped, editable-surface scoped, and covers list rows, board cards, expanded board children, and work item detail subitem rows
    - Audit archetypes: `shared-ui`, `optimistic-state`, `architecture`
    - _Requirements: REQ-SELECT-001, REQ-REVIEW-001_

- [x] 3. Dynamic property bulk menus
  - [x] 3.1 Build bulk context menu model from visible editable display properties
    - Status: completed
    - Depends on: 2.1
    - Likely areas: `components/app/screens/work-item-menus.tsx`, `components/app/screens/work-surface-view.tsx`, `components/app/screens/work-item-inline-property-control.tsx`, `components/app/screens/property-chips.tsx`, `lib/store/app-store-internal/slices/work-item-actions.ts`, custom property store/tests
    - Validation: menu model tests, component tests for visible status/priority/labels/custom select fields, bulk mutation tests, permission/disabled-state tests
    - Exit criteria: right-click menus expose only visible editable dropdown-like properties and apply bulk changes through existing validation/mutation paths
    - Rollback impact: menu model can revert while preserving single-item menu behavior
    - Blocking unknowns: whether backend batch mutation is necessary; defer unless measurements require it
    - Pre-implementation context check: read DES-003, DES-006, REQ-MENU-001, inline property control icon semantics, displayProps rendering, custom property mutations, and architecture standards for shared UI contracts
    - Test creation review: tests assert displayProps-driven inclusion/exclusion and correct icons for built-in/custom properties
    - Slice review loop: run deep diff-review first with architecture-standards; fix findings; run normal diff-review loops until clean; record validation, findings/fixes, requirement audit, and residual risk in `reviews.md`
    - Post-implementation review: completed together with 2.1; deep review found and fixed bulk project confirmation lifetime and label-menu compatibility issues, then normal clean-loop review passed focused validation and diff checks
    - Spec drift check: completed; right-click menus derive bulk editable status, priority, assignee, project, labels, and custom select/multi-select actions from visible display properties while preserving legacy single-item menu behavior where no displayProps contract exists
    - Audit archetypes: `contract`, `optimistic-state`, `shared-ui`
    - _Requirements: REQ-MENU-001, REQ-REVIEW-001_

- [x] 4. Scoped references, persistence, backlinks, and access-denied navigation
  - [x] 4.1 Fix reference search/insertion and preserve durable access-aware reference contract
    - Status: completed
    - Depends on: 1.1
    - Likely areas: `components/app/rich-text-editor.tsx`, `components/app/rich-text-editor/menus.tsx`, `components/app/rich-text-content.tsx`, `components/app/screens/document-detail-screen.tsx`, `components/app/screens/work-item-detail-screen.tsx`, `components/app/screens/work-item-ui.tsx`, `lib/domain/selectors-internal/rich-text-references.ts`, `lib/content/rich-text-references.ts`, Convex document/work item/comment handlers, related tests
    - Validation: rich text parser/security tests, reference candidate tests, component tests for wider scoped dialog/no people/create actions, Convex/store tests for durable links/backlinks, access-denied navigation tests
    - Exit criteria: references can be inserted in documents and work item rich-text areas, persist relationships/backlinks, stay visible in containing content, deny inaccessible target navigation, and support inline/embed/link forms through one typed contract
    - Rollback impact: additive reference fields remain inert; UI insertion can revert independently if parser compatibility remains
    - Blocking unknowns: pause and update design if source-owned arrays cannot represent source/direction/representation type safely
    - Pre-implementation context check: read DES-003, DES-007, REQ-REF-001, REQ-REF-002, `.reviews/work-item-reference-activity-ui.md`, existing rich text sanitizer/click-blocking tests, Convex access helpers, and architecture standards for privacy/contracts
    - Test creation review: tests must prove insertion candidates require target access, saved markers remain visible to containing-surface viewers, inaccessible clicks show access denied, no hidden target metadata hydrates, and backlinks update/remove correctly
    - Slice review loop: run deep diff-review first with architecture-standards; fix findings; run normal diff-review loops until clean; record validation, findings/fixes, requirement audit, and residual risk in `reviews.md`
    - Post-implementation review: completed; deep review found and fixed comment reference cleanup for deleted entities, and the normal clean-loop found and fixed the remaining slash-menu width gap before rerunning focused validation and diff-review/architecture preflights
    - Spec drift check: completed; implementation imports the June 1 reference/backlink contract, keeps references source-owned, widens both slash and reference menus, excludes people/create actions from reference candidates, and preserves access-scoped insertion/persistence/navigation behavior
    - Audit archetypes: `contract`, `shared-ui`, `release-safety`
    - _Requirements: REQ-REF-001, REQ-REF-002, REQ-REVIEW-001_

- [x] 5. Add-item defaults from view structure
  - [x] 5.1 Resolve create defaults from group, subgroup, and active filters
    - Status: completed
    - Depends on: 3.1
    - Likely areas: `components/app/screens/shared.tsx`, `components/app/screens/create-work-item-dialog.tsx`, `components/app/screens/work-surface-view.tsx`, create-default helper tests, create dialog tests
    - Validation: tests for empty label lanes, status lanes, group/subgroup merge, project/team/type/visibility single-value filters, ambiguous filter negative cases
    - Exit criteria: Add Item from grouped/filtered lanes prepopulates labels/status/project/defaults so created items belong in the lane by default
    - Rollback impact: resolver changes can revert without schema migration
    - Blocking unknowns: none
    - Pre-implementation context check: read DES-003, DES-008, REQ-CREATE-001, current create defaults and filter/group code, and architecture standards for domain-owned derivation
    - Test creation review: tests assert defaults shown in create dialog and payload, including empty lanes with no exemplar item
    - Slice review loop: run deep diff-review first with architecture-standards; fix findings; run normal diff-review loops until clean; record validation, findings/fixes, requirement audit, and residual risk in `reviews.md`
    - Post-implementation review: completed; deep review found and fixed ambiguous visibility filters being treated as private create defaults, then normal clean-loop review passed after sibling private-view helper fixes
    - Spec drift check: completed; resolver now derives defaults from group, subgroup, and active single-value filters only, including empty label lanes and top-level New defaults, while ambiguous filters do not prescribe values
    - Audit archetypes: `contract`, `fallback-state`, `optimistic-state`
    - _Requirements: REQ-CREATE-001, REQ-REVIEW-001_

- [x] 6. Work item detail editor performance
  - [x] 6.1 Optimize title/description TipTap hot paths
    - Status: completed
    - Depends on: 4.1
    - Likely areas: `components/app/screens/work-item-detail-screen.tsx`, `components/app/rich-text-editor.tsx`, work item collaboration helpers, document editor comparison paths, editor tests
    - Validation: focused tests for non-stale title/description saves, mentions/references/collaboration behavior, and hot-path evidence showing reduced synchronous fan-out
    - Exit criteria: typing in the work item detail title/description editor is measurably smoother without breaking collaboration, mentions, references, or saves
    - Rollback impact: optimization helpers can revert if behavior regresses
    - Blocking unknowns: whether lag is editor transaction work or wider detail-screen rerender fan-out
    - Pre-implementation context check: read DES-003, DES-009, REQ-EDITOR-001, document editor patterns, current work item title/description state flow, collaboration bootstrap/presence/active PartyKit assumptions shared with T-007, and architecture standards for performance ownership
    - Test creation review: tests prove behavior remains correct while hot-path extraction/store fan-out is reduced
    - Slice review loop: run deep diff-review first with architecture-standards; fix findings; run normal diff-review loops until clean; record validation, findings/fixes, requirement audit, and residual risk in `reviews.md`
    - Post-implementation review: completed; deep review found and fixed two gaps: title typing still used parent detail-screen state on every local keystroke, and attached-collaboration Close needed a one-time local content patch after removing per-keystroke store writes. Normal clean-loop review then passed focused validation and preflights.
    - Spec drift check: completed; T-006 remains scoped to the work item detail title/description editor only, and T-007 is explicitly responsible for revalidating the shared hydration, presence, active PartyKit, flush, and teardown assumptions that this optimization relies on.
    - Audit archetypes: `performance`, `architecture`, `shared-ui`
    - _Requirements: REQ-EDITOR-001, REQ-REVIEW-001_

- [x] 7. Document hydration safety
  - [x] 7.1 Guard document content against empty/stale hydration and collaboration overwrites
    - Status: completed
    - Depends on: 4.1
    - Likely areas: `components/app/screens/document-detail-screen.tsx`, `hooks/use-document-collaboration.ts`, `lib/store/app-store-internal/*`, `services/partykit/server.ts`, read-model merge helpers, collaboration tests
    - Validation: create/type/navigate/return regression tests, store merge tests, collaboration bootstrap/flush/teardown tests, intentional empty-save negative test
    - Exit criteria: documents do not randomly hydrate to empty after create/type/navigate/return, and stale client flushes cannot overwrite newer active room/server state
    - Rollback impact: guards can revert, but only after restoring data-loss protection
    - Blocking unknowns: whether durable Yjs state is required; update design before changing canonical content source
    - Pre-implementation context check: read DES-003, DES-009, DES-010, REQ-EDITOR-001, REQ-DOC-001, T-006 implementation/review notes, collaboration hardening reviews/audits, document body protection code, active PartyKit room presence/bootstrap/flush paths, and architecture standards for data-loss prevention
    - Test creation review: tests distinguish intentional empty saves from stale empty payloads and prove no infinite loading loop
    - Slice review loop: run deep diff-review first with architecture-standards; fix findings; run normal diff-review loops until clean; record validation, findings/fixes, requirement audit, and residual risk in `reviews.md`
    - Post-implementation review: completed; deep review found and fixed pending-body protection being cleared after a failed document content mutation, then the normal clean-loop review passed focused validation, static gates, and review preflights.
    - Spec drift check: completed; implementation keeps HTML as canonical content, relies on collaboration runtime attachment/sync before teardown-content flush, protects pending local body syncs through read-model/snapshot replacement, and cross-validates T-006 work item description assumptions without broadening T-006 beyond the detail title/description editor.
    - Audit archetypes: `contract`, `fallback-state`, `release-safety`
    - _Requirements: REQ-DOC-001, REQ-REVIEW-001_

- [x] 8. Chat message read/edited metadata
  - [x] 8.1 Persist first-read receipts and render ordered message metadata
    - Status: completed
    - Depends on: 1.1
    - Likely areas: chat message models, Convex chat/message handlers, scoped read-model payloads, collaboration message store/actions, message canvas rendering components, chat tests
    - Validation: backend/store/read-model tests for first-write-only read timestamps, component tests for timestamp/read/edited ordering, access negative tests, typecheck after any schema/read-model changes
    - Exit criteria: message canvas renders sent timestamp, bullet-separated persisted read time, and bullet-separated edited time in that order; read time records only the first read/open event and does not update on subsequent visits
    - Rollback impact: additive read-receipt metadata can remain inert if UI rendering is reverted
    - Blocking unknowns: whether existing message persistence has per-viewer read receipt fields; update design before introducing a non-additive schema contract
    - Pre-implementation context check: read DES-003, DES-012, REQ-CHAT-001, current chat message persistence/read-model code, message canvas timestamp rendering, access helpers, and architecture standards for backend/read-model state authority
    - Test creation review: tests must prove first-read-only persistence, no current-time fallback for unread messages, authorized scoped payloads only, and metadata order timestamp -> read -> edited
    - Slice review loop: run deep diff-review first with architecture-standards; fix findings; run normal diff-review loops until clean; record validation, findings/fixes, requirement audit, and residual risk in `reviews.md`
    - Post-implementation review: completed; deep review found and fixed two gaps: client-provided receipt ids needed server-side conversation/visibility filtering, and stripped conversation-list read models could otherwise erase thread receipt maps during generic store merge. Normal clean-loop review then passed focused validation, focused eslint, typecheck, and diff checks.
    - Spec drift check: completed; the follow-up and live repo evidence are chat-message specific, so the metadata requirement was narrowed from overbroad chat/channel wording to chat messages while the later performance audit still covers chat/channel as app surfaces.
    - Audit archetypes: `contract`, `architecture`, `shared-ui`, `release-safety`
    - _Requirements: REQ-CHAT-001, REQ-REVIEW-001_

- [x] 9. Deep/wide performance audit and remediation
  - [x] 9.1 Instrument and fix measured app performance root causes
    - Status: completed
    - Depends on: 6.1, 7.1, 8.1
    - Likely areas: `hooks/use-scoped-read-model-refresh.ts`, `lib/server/scoped-read-models.ts`, `app/api/read-models/**`, `lib/server/convex/auth.ts`, Zustand store merge/selectors, route components, editor/loading tests, diagnostics helpers
    - Validation: diagnostics tests/evidence, targeted tests for loading/retained-data behavior, read-model route tests, code-level route/render evidence for representative shell/workspace/team/project/document/work item/inbox/chat/search/people/views flows
    - Exit criteria: all requested auditable areas have classified findings/remediations, unnecessary loading/flicker root causes are fixed where evidence supports it, and remaining loading states have measured justification
    - Rollback impact: diagnostics can be gated or removed; data-flow fixes must preserve stale-data safety
    - Blocking unknowns: which root causes measurement identifies as highest leverage
    - Pre-implementation context check: read DES-001, DES-002, DES-011, REQ-PERF-001, REQ-DIAG-001, existing audits/Fallow history, scoped read-model routes, loading-state components, and architecture standards for performance/data-flow
    - Test creation review: tests and diagnostics prove first useful render/read-model/mutation behavior rather than only helper output
    - Slice review loop: run deep diff-review first with architecture-standards; fix findings; run normal diff-review loops until clean; record validation, findings/fixes, requirement audit, and residual risk in `reviews.md`
    - Post-implementation review: completed; fixes were applied for read-path background work, optimistic work-item flicker, first-useful-render diagnostics, mutation reconciliation diagnostics, and Fallow-introduced dead exports
    - Spec drift check: completed; all requested performance audit areas were covered in the T-009 review ledger, browser smoke remains user-owned per instruction, and broader Fallow complexity/duplication findings are recorded as residual static audit evidence rather than hidden
    - Audit archetypes: `performance`, `architecture`, `background-work`, `release-safety`
    - _Requirements: REQ-PERF-001, REQ-DIAG-001, REQ-REVIEW-001_

- [ ] 10. Final validation, total review, and PR
  - [ ] 10.1 Run final gates, coverage audit, total-diff review loop, and create PR
    - Status: todo
    - Depends on: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1
    - Likely areas: full working tree, `.spec/workspace-surface-editor-stability/*`, validation commands, GitHub PR flow
    - Validation: targeted Vitest suites for each slice, broader checks `pnpm lint`, `pnpm typecheck`, focused component/store/read-model/collaboration tests, Fallow/static evidence review where relevant, and code-level diagnostics evidence for representative app surfaces and editor flows
    - Exit criteria: every original prompt and follow-up requirement is implemented or explicitly deferred with rationale, final total-diff deep review and normal clean-loop reviews pass, reviews ledger is complete, and a non-draft PR targeting `main` is created
    - Rollback impact: final validation blocks PR if release-safety findings remain
    - Blocking unknowns: hosted PR feedback after creation
    - Pre-implementation context check: read all DES/REQ/task entries, all slice reviews, current diff, validation evidence, and architecture standards
    - Test creation review: final audit verifies tests cover behavior, negative cases, persistence, access, performance, hydration, and rollback-safety
    - Slice review loop: run final total-diff deep diff-review against original prompt, all follow-ups, spec artifacts, architecture-standards, repo-audit taxonomy, live repo evidence, and validation; fix findings; run normal diff-review loops until clean; record final prompt coverage audit; commit; push; create a non-draft PR targeting `main`
    - Post-implementation review: record final validation, total-diff findings/fixes, PR details, and any residual risk after PR creation
    - Spec drift check: record final prompt and follow-up coverage audit before commit/PR
    - Audit archetypes: `release-safety`, `architecture`, `performance`, `contract`
    - _Requirements: REQ-REVIEW-001_

## Post-Deploy Verification
- After PR creation, poll GitHub/Codex/CI feedback if available and import actionable findings into `reviews.md`.
- User-owned manual browser verification: sidebar persistence, work surface bulk menu, reference search/access-denied navigation, add-item defaults, document create/type/navigate/return, chat read/edited metadata, and route loading behavior.
- Confirm no remaining loading state lacks a measured or recorded justification.

## Traceability Matrix
- REQ-SIDE-001 -> 1.1
- REQ-CHAT-001 -> 8.1
- REQ-SELECT-001 -> 2.1
- REQ-MENU-001 -> 3.1
- REQ-REF-001 -> 4.1
- REQ-REF-002 -> 4.1
- REQ-CREATE-001 -> 5.1
- REQ-EDITOR-001 -> 6.1
- REQ-DOC-001 -> 7.1
- REQ-PERF-001 -> 9.1
- REQ-DIAG-001 -> 9.1
- REQ-REVIEW-001 -> 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1, 10.1

## Coverage Checklist
- Sidebar persistence: 1.1
- Chat message read/edited metadata: 8.1
- Multi-select visible work items/subitems/detail subitems: 2.1
- Dynamic visible editable property menus: 3.1
- Reference search/persistence/backlinks/access/link forms: 4.1
- Add-item group/subgroup/filter defaults: 5.1
- Work item title/description editor performance: 6.1
- Document hydration/content deletion: 7.1
- Deep/wide performance audit and diagnostics: 9.1
- Per-slice and final diff-review loops plus PR: 1.1 through 10.1
