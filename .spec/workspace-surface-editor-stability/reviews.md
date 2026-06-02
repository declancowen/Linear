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

# Reviews

## Review Ledger

This file records per-slice and final implementation review. Each entry must include linked tasks, linked requirements, validation, repo-audit archetypes, architecture decisions, findings/fixes, residual risk, and prompt audit status.

## Required Review Loop

For each implementation slice:

1. Read linked `DES-*`, `REQ-*`, and task entries before editing.
2. Apply architecture-standards while choosing owner boundaries and tests.
3. Run focused validation for the slice.
4. Run a deep diff-review first, scoped to the slice diff, linked requirements, original prompt, follow-ups, architecture-standards, and repo-audit archetypes.
5. Fix findings.
6. Run normal diff-review loops until the slice is clean.
7. Record validation, findings, fixes, residual risk, and requirement audit in this file before moving to the next slice.

At the end:

1. Run final validation across all requirements.
2. Run a final total-diff deep review, then normal diff-review loops until clean.
3. Record the final prompt coverage audit.
4. Commit, push, and create a non-draft PR targeting `main`.

## Initial Planning Review

- Linked tasks: T-001 through T-010
- Linked requirements: REQ-SIDE-001 through REQ-REVIEW-001
- Archetypes: performance, architecture, optimistic-state, fallback-state, contract, shared-ui, background-work, release-safety
- Architecture decisions: persistent viewer UI belongs in the UI store; durable content remains server-owned; bulk work updates reuse existing mutation authority first; broad performance fixes must be measurement-driven.
- Prompt audit: original prompt, TipTap clarification, snapshot/loading follow-up, broad performance follow-up, repo-audit taxonomy follow-up, and chat read/edited metadata follow-up are all represented in design, requirements, and tasks.
- Residual risk: implementation is high blast-radius and must be sliced with targeted validation.
- Review-loop audit: per-slice deep diff-review, normal clean-loop re-review, final total-diff deep review, final requirement audit, and non-draft PR creation are required before delivery.

## Spec Correction: Reference Access, Visibility, And Representation

- Linked tasks: T-004
- Linked requirements: REQ-REF-001, REQ-REF-002
- Trigger: user follow-up on 2026-06-02 requiring the current spec to import the prior reference/backlink review from 2026-06-01.
- Source review: `.reviews/work-item-reference-activity-ui.md`, especially source-owned relationships/backlinks, access-aware insertion/navigation, entity-reference sanitizer/click blocking, no premature normalized reference graph, and private/reference visibility invariants.
- Archetypes: contract, shared-ui, release-safety
- Architecture decisions: target access gates insertion/persistence; containing-surface access gates whether the saved authored reference marker is visible; target route access gates navigation and target-content hydration. Inline, embed/block, and link forms share one typed reference extraction, sanitizer, persistence, backlink, and navigation contract.
- Prompt audit: REQ-REF-002, DES-007, and T-004 now explicitly cover visible saved references for containing-surface viewers, "You do not have access" navigation, no hidden metadata hydration, backlinks, and inline/embed/link representations.
- Residual risk: implementation still needs code-level validation that existing linked arrays can represent direction/source/representation type; if not, DES-007 requires a design update before introducing a normalized reference graph.

## Spec Correction: Chat Read Receipts And Edited Metadata

- Linked tasks: T-008
- Linked requirements: REQ-CHAT-001, REQ-REVIEW-001
- Trigger: user follow-up on 2026-06-02 requiring chat read receipts to record the first time a message is opened/read, render in the actual message canvas next to timestamps rather than the conversation list, and place an edited stamp after the read stamp with another bullet delimiter.
- Archetypes: contract, architecture, shared-ui, release-safety
- Architecture decisions: read receipt authority belongs in durable backend/read-model message state, not transient client render time; the UI must render persisted metadata in a deterministic order of sent timestamp, read stamp, then edited stamp.
- Prompt audit: DES-012, REQ-CHAT-001, and T-008 now explicitly cover first-read-only persistence, access-scoped payloads, message canvas placement, no current-time fallback for unread messages, and read/edited bullet ordering.
- Residual risk: implementation still needs code-level discovery of existing chat/message read receipt schema; if current persistence cannot represent per-viewer first-read timestamps additively, T-008 requires a design update before code changes.

## Slice Review: 1.1 Sidebar State Persistence

- Linked tasks: 1.1
- Linked requirements: REQ-SIDE-001, REQ-REVIEW-001
- Review mode: deep diff-review first with architecture-standards, then normal clean-loop review after fixing the finding.
- Archetypes: shared-ui, fallback-state, contract
- Root cause: collaboration details sidebars used component-local `useState(true)`, so every visit reset the desktop sidebar to open.
- Blast radius: channel, team chat, team channel, and workspace chat details sidebars; persisted UI store shape; read-model merge fixtures.
- Fix radius: must fix now.
- Proper fix: added viewer-scoped persisted UI map `collaborationSidebarOpenBySurface`, bounded compaction/migration, store action, and a reusable sidebar state hook used by collaboration surfaces.
- Prevention artifact: store persistence tests plus hook tests for default-open, persisted close, viewer/surface scoping, and null-surface no-write behavior.
- Deep-review finding: initial validation only covered store persistence and compaction; it did not prove hook/default-open behavior. Fixed by adding `tests/components/collaboration-sidebar-state.test.tsx`.
- Architecture decisions: state stays in persisted viewer UI, not collaboration domain data; mobile drawer state remains local and unpersisted; setter writes through the existing viewer-scoped key pattern.
- Validation:
  - `python3 ~/.codex/skills/spec-driven-development/scripts/lint_spec.py --spec-dir .spec/workspace-surface-editor-stability` — passed
  - `python3 ~/.codex/skills/spec-driven-development/scripts/traceability_report.py --spec-dir .spec/workspace-surface-editor-stability --strict` — passed
  - `pnpm exec vitest run tests/lib/store/viewer-view-config.test.ts tests/components/collaboration-sidebar-state.test.tsx` — passed, 2 files / 10 tests
  - `pnpm typecheck` — passed
  - focused `pnpm exec eslint ... --max-warnings 0` for changed T-001 files — passed
  - `git diff --check` — passed
  - `~/.codex/skills/diff-review/scripts/review-preflight.sh` — completed after fix
  - `~/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — completed
- Prompt audit: satisfies the channel/chat sidebar open/closed persistence requirement. First visit still defaults open; subsequent visits use the last saved viewer/surface state.
- Spec drift: none after the T-001 fix; the earlier reference follow-up was already incorporated before this slice continued.
- Residual risk: user-owned manual browser verification remains outside the agent-run validation plan.

## Slice Review: 2.1 Multi-Select Foundation And 3.1 Dynamic Bulk Property Menus

- Linked tasks: 2.1, 3.1
- Linked requirements: REQ-SELECT-001, REQ-MENU-001, REQ-REVIEW-001
- Review mode: deep diff-review first with architecture-standards, then normal clean-loop review after fixing findings.
- Archetypes: shared-ui, optimistic-state, contract, architecture, release-safety
- Root cause: work surfaces only exposed single-row context actions; property actions were hard-coded instead of derived from visible editable `displayProps`.
- Blast radius: list rows, board cards, expanded board child rows, work item detail subitem rows, shared work item menus, project cascade confirmation hook, custom property/label updates, and work-surface tests.
- Fix radius: must fix now.
- Proper fix: added ephemeral visible-row selection state, selection checkboxes/modified-click handling, right-click selected-set targeting, editable-surface scoping, and displayProps-driven bulk menu sections for status, priority, assignee, project, labels, and custom select/multi-select properties.
- Architecture decisions: selection remains ephemeral presentation state; mutation authority stays in existing store actions and custom-property setters; project cascade confirmation remains owned by `useWorkItemProjectCascadeConfirmation`; visible-property policy stays in the shared work item menu boundary.
- Deep-review findings:
  - Bulk project confirmation state was initially menu-local and could unmount when the context menu closed. Fixed by extending the existing project cascade confirmation hook with `requestBulkUpdate` and routing bulk project actions through that wrapper-owned dialog state.
  - Labels initially appeared on legacy menus without an explicit `displayProps` contract. Fixed by requiring explicit `displayProps.includes("labels")` for label actions while preserving legacy built-in status/priority/assignee/project behavior.
  - Selection controls initially appeared on read-only rows even though bulk writes were disabled. Fixed by passing the selection controller only to editable work-surface/detail subitem rows.
- Normal clean-loop review: reran diff-review preflight, spec lint, strict traceability, focused validation, focused eslint, typecheck, and diff whitespace checks after the fixes; no remaining T-002/T-003 findings were identified.
- Remediation radius:
  - Must fix now: project confirmation lifetime, labels compatibility, read-only selection leakage.
  - Should fix if cheap/safe: focused tests for selection target handoff and displayProps-driven menu inclusion; completed.
  - Defer: backend batch mutation; existing mutation fan-out is acceptable until performance measurements prove otherwise.
- Prevention artifacts: component tests for selected target propagation, displayProps inclusion/exclusion, bulk status/labels/custom select updates, bulk project confirmation lifetime, labels hidden on non-view menus, and read-only rows hiding bulk selection controls.
- Validation:
  - `pnpm exec vitest run tests/components/work-item-menus.test.tsx tests/components/work-surface-view.test.tsx tests/components/work-item-project-cascade-confirmation.test.tsx` — passed, 3 files / 98 tests
  - `pnpm exec vitest run tests/components/work-item-menus.test.tsx tests/components/work-item-project-cascade-confirmation.test.tsx` — passed, 2 files / 14 tests after labels compatibility fix
  - `pnpm exec vitest run tests/components/work-item-menus.test.tsx tests/components/work-surface-view.test.tsx` — passed, 2 files / 93 tests before project-confirmation hook hardening
  - `pnpm exec tsc --noEmit --pretty false` — passed
  - focused `pnpm exec eslint ...` for changed T-002/T-003 files — passed
  - `git diff --check` — passed
  - `~/.codex/skills/diff-review/scripts/review-preflight.sh` — completed for deep review context
  - `~/.codex/skills/diff-review/scripts/review-preflight.sh` — completed again after fixes for the normal clean-loop pass
  - `~/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — completed for architecture context
- Prompt audit: satisfies multi-select for visible list/board child/subitem/detail subitem rows and dynamic right-click property menus for visible editable dropdown-like properties, including labels and custom select/multi-select fields with icons.
- Spec drift: none; bulk writes reuse existing mutations and do not add backend batch writes without measurement evidence.
- Residual risk: user-owned manual browser verification remains outside the agent-run validation plan. Bulk writes are sequential fan-out through existing actions, which is acceptable for this slice but remains part of the later performance audit.

## Slice Review: 4.1 Scoped References, Persistence, Backlinks, And Access

- Linked tasks: 4.1
- Linked requirements: REQ-REF-001, REQ-REF-002, REQ-REVIEW-001
- Review mode: deep diff-review first with architecture-standards, then normal clean-loop review after fixing findings.
- Archetypes: contract, shared-ui, release-safety, architecture, fallback-state
- Root cause: the editor treated an empty candidate list as "references disabled", work item/comment reference candidates were scoped too narrowly, the search shell stayed too narrow, and durable relationship metadata did not cover all allowed reference entity types.
- Blast radius: document editor, work item title/description/comment editors, rich-text menu shells, reference candidate selectors, optimistic store persistence, Convex handlers/schema validators, project read models, deletion cleanup, and reference tests.
- Fix radius: must fix now.
- Proper fix: enabled the Reference command whenever the containing editor provides a reference candidate contract, widened the slash command and reference picker shells, expanded scoped candidates to accessible documents/work items/projects/views while excluding people and create actions, persisted source-owned project/view references for work item descriptions, persisted document/project/view/work item references for comments, and kept Convex as the authoritative access revalidation boundary.
- Architecture decisions:
  - Target access gates insertion and persisted relationship updates; containing-surface access gates visibility of the saved authored marker; target route access gates navigation and target content hydration.
  - Source-owned reference arrays remain additive metadata on the source work item/comment. A normalized reference graph is still deferred because the prior review established source-owned arrays as sufficient until measured query pressure proves otherwise.
  - Rich-text project references do not reuse `linkedProjectIds`, because linked projects represent project membership/relations and drive progress/scope semantics. Project detail/read-model visibility can include `referencedProjectIds` as backlink evidence while project progress continues to use only primary/linked project membership.
  - Comment references use the same client selector and Convex resolver shape as document/work item content, so optimistic state and server persistence cannot drift by entity type.
- Deep-review finding:
  - Persisted comments could now store work item/document/project references, but server cleanup only removed stale relationships from documents/work items. Fixed by adding comment reference cleanup in `cleanupRemainingLinksAfterDelete` and regression coverage in `tests/convex/cleanup.test.ts`.
- Normal clean-loop finding:
  - The reference picker was widened, but the slash command menu still used the old narrow shell even though the original issue described Reference-row subtext wrapping in the slash modal. Fixed by widening `SlashCommandMenu` to 360px and adding a regression assertion in `tests/components/rich-text-editor-helpers.test.tsx`.
- Remediation radius:
  - Must fix now: command availability, scoped candidates, durable persistence/backlinks, deletion cleanup, menu width.
  - Should fix if cheap/safe: explicit tests for no people/create actions and project membership separation; covered through candidate and persistence tests.
  - Defer: normalized reference graph and separate backlink table until diagnostics show source-owned arrays are insufficient.
- Prevention artifacts: rich-text candidate tests, menu shell tests, optimistic store tests, Convex comment/work item handler tests, cleanup tests, work item/detail editor candidate tests, type/schema validators, spec ledger entry importing `.reviews/work-item-reference-activity-ui.md`.
- Validation:
  - `pnpm exec vitest run tests/lib/domain/rich-text-references.test.ts tests/components/rich-text-editor-helpers.test.tsx tests/lib/store/work-document-actions.test.ts tests/lib/store/work-comment-actions.test.ts tests/convex/comment-handlers.test.ts tests/convex/work-item-handlers.test.ts tests/convex/cleanup.test.ts tests/components/work-item-detail-screen.test.tsx tests/components/document-detail-screen.test.tsx` — passed, 9 files / 141 tests
  - `pnpm exec tsc --noEmit --pretty false` — passed
  - focused `pnpm exec eslint ... --max-warnings 0` for changed T-004 files — passed
  - `python3 ~/.codex/skills/spec-driven-development/scripts/lint_spec.py --spec-dir .spec/workspace-surface-editor-stability` — passed
  - `python3 ~/.codex/skills/spec-driven-development/scripts/traceability_report.py --spec-dir .spec/workspace-surface-editor-stability --strict` — passed
  - `git diff --check` — passed
  - `~/.codex/skills/diff-review/scripts/review-preflight.sh` — completed for deep review context
  - `~/.codex/skills/diff-review/scripts/review-preflight.sh` — completed again after fixes for the normal clean-loop pass
  - `~/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — completed for architecture context
- Prompt audit: satisfies document and work item rich-text reference insertion/search, wider menus, scoped search excluding people/create actions, durable persisted links/backlinks, visible saved references for containing-surface viewers, and access-aware target navigation behavior from the original prompt plus the June 1 review follow-up.
- Spec drift: none after the slice; the implementation intentionally records rich-text project/view references separately from linked project membership to preserve architecture semantics.
- Residual risk: user-owned manual browser verification remains outside the agent-run validation plan. Reference targets using unsupported future embed/block representations will need to flow through the same typed entity-reference extraction contract before gaining new UI affordances.

## Slice Review: 5.1 Add-Item Defaults From View Structure

- Linked tasks: 5.1
- Linked requirements: REQ-CREATE-001, REQ-REVIEW-001
- Review mode: deep diff-review first with architecture-standards, then normal clean-loop review after fixing findings.
- Archetypes: contract, fallback-state, optimistic-state, shared-ui, architecture
- Root cause: create defaults only looked at immediate grouped lane values and exemplar items, so empty filtered lanes and top-level active-view creates lost filter-defined defaults such as labels, project, team, type, priority, and visibility.
- Blast radius: list/board Add item buttons, empty groups, active-view top-level New, create dialog default values, private-task compatibility filtering, grouping labels, and work-surface property/level controls.
- Fix radius: must fix now.
- Proper fix: added create-specific default resolution for labels, team/private destinations, item type, group/subgroup defaults, and active single-value filters; top-level WorkSurface New now resolves active-view defaults before opening the create dialog; private creates clear labels/project/assignees while team creates preserve explicit filter defaults.
- Architecture decisions:
  - Create-default derivation stays in the work-surface application/presentation boundary because it maps current view context into create-dialog seed values, not authoritative persistence.
  - Label validity uses existing domain selectors and `isLabelAssignableToWorkItem`; create dialog and server mutations remain the write authority.
  - Single-value filters prescribe defaults; multi-value filters remain ambiguous and do not become authoritative defaults.
  - "Private task view" is now defined consistently as an items view with exactly one visibility filter, `private`, so mixed `team` + `private` views do not strip team/project/label defaults.
- Deep-review finding:
  - Ambiguous visibility filters were still treated as private in `WorkSurface` compatibility helpers because `isPrivateTaskView` and the resolved create context used `includes("private")`. That cleared project/team filters and could open private creates from mixed-visibility views. Fixed by requiring a single `private` visibility filter, updating sibling grouping/control helpers, and adding a WorkSurface regression test.
- Normal clean-loop review: reran focused validation, diff-review preflight, architecture preflight, and sibling control tests after the fix; no remaining T-005 findings were identified.
- Remediation radius:
  - Must fix now: empty label lane defaults, group/subgroup/filter merge, top-level active-view defaults, ambiguous visibility private leakage.
  - Should fix if cheap/safe: sibling private-view helper consistency; completed in grouping labels and work-surface controls.
  - Defer: backend batch create-default mutation; not needed because defaults are create-dialog seed values and existing mutation validation remains authoritative.
- Prevention artifacts: component tests for empty label lanes, group/subgroup/filter default merge, ambiguous filter negative cases, top-level New defaults, ambiguous visibility regression, private create defaults, and sibling control tests.
- Validation:
  - `pnpm exec vitest run tests/components/work-surface-view.test.tsx tests/components/work-surface.test.tsx tests/components/create-dialogs.test.tsx` — passed, 3 files / 131 tests
  - `pnpm exec vitest run tests/components/group-chip-popover.test.tsx tests/components/properties-chip-popover.test.tsx` — passed, 2 files / 12 tests
  - `pnpm exec tsc --noEmit --pretty false` — passed
  - focused `pnpm exec eslint ... --max-warnings 0` for changed T-005 files and sibling controls — passed
  - `git diff --check` — passed
  - `~/.codex/skills/diff-review/scripts/review-preflight.sh` — completed for deep review context
  - `~/.codex/skills/diff-review/scripts/review-preflight.sh` — completed again after fixes for the normal clean-loop pass
  - `~/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — completed for architecture context
- Prompt audit: satisfies the requested Add Item behavior for filtered/grouped board/view lanes, including default labels such as CX, status/group values, subgroup values, project/team/type filters, and top-level active-view creation.
- Spec drift: none; implementation follows DES-008 and REQ-CREATE-001, and preserves the assumption that default derivation is client-side seed state while persistence validation stays authoritative.
- Residual risk: user-owned manual browser verification remains outside the agent-run validation plan. Duplicate team or label display names in grouping lanes still rely on the existing group-label representation, but stable ID filters and exemplar items cover the main create-default paths.

## Slice Review: 6.1 Work Item Detail Title/Description Editor Performance

- Linked tasks: 6.1
- Linked requirements: REQ-EDITOR-001, REQ-REVIEW-001
- Review mode: deep diff-review first with architecture-standards, then normal clean-loop review after fixing findings.
- Archetypes: performance, architecture, shared-ui, fallback-state, release-safety
- Root cause: the work item detail title/description editor stored draft title and description HTML in the parent detail screen on every local editor change. That pulled expensive detail model derivation, sidebar props, child rows, activity/reference candidates, and attached-collaboration store writes into the synchronous typing path.
- Blast radius: work item detail main title input, description TipTap editor, top-bar save/close/done actions, stale draft guard, mention notification diffing, attached collaboration local content patching, document-body protection, active presence callbacks, and work item detail tests.
- Fix radius: must fix now.
- Proper fix: moved latest draft title/description content into refs for event-time save/mention extraction, changed parent render state to track only dirty/validity transitions, moved the title input value/limit rendering into a local input component, memoized the expensive detail model from stable dependencies, and changed attached-collaboration description store patching from per-keystroke to one-time Done/Close reconciliation.
- Architecture decisions:
  - The work item detail screen remains the owner of save/cancel/reload coordination, stale detection, and mention retry state.
  - The local title input owns per-keystroke display state only; persistence and validation authority remain in existing save/flush/store paths.
  - The shared `RichTextEditor` was not changed in this slice because it is used by documents, comments, chats, and channel surfaces. The optimization stays in the work item title/description owner named by the user clarification.
  - T-007 now explicitly revalidates the shared collaboration bootstrap, presence, active PartyKit room, flush, and teardown assumptions that this slice relies on.
- Deep-review findings:
  - The first optimization pass reduced description churn but left title typing on the parent detail-screen state path. Fixed by introducing `WorkItemMainTitleInput` with local draft value/limit rendering, ref-backed latest title save semantics, and tests for repeated title changes not rerendering the description editor while still saving the latest title.
  - Removing per-keystroke attached-collaboration store patches meant the Close path could leave local read content stale when a user closed without pressing Done. Fixed by applying a single local collaboration content patch on Close using the latest description ref, without flushing or restoring per-keystroke store fan-out.
- Normal clean-loop review: reran diff-review preflight, architecture preflight, spec lint, strict traceability, focused validation, focused eslint, typecheck, and diff whitespace checks after the fixes; no remaining T-006 findings were identified.
- Remediation radius:
  - Must fix now: parent detail-screen title/description typing fan-out, latest non-stale save semantics, attached-collaboration Done/Close reconciliation.
  - Should fix if cheap/safe: explicit task linkage from T-006 to T-007 for hydration/presence/PartyKit assumptions; completed.
  - Defer: shared TipTap core optimization and broader document/collaboration persistence hardening until T-007 and T-009 evidence justifies cross-surface changes.
- Prevention artifacts: work item detail component tests for description keystroke fan-out, title keystroke fan-out, latest title/description save, attached-collaboration Done patching, attached-collaboration Close patching, mention retry behavior, collaboration boot preview, stale draft reload, and access-filtered reference candidates.
- Validation:
  - `pnpm exec vitest run tests/components/work-item-detail-screen.test.tsx` — passed, 1 file / 42 tests
  - focused `pnpm exec eslint components/app/screens/work-item-detail-screen.tsx tests/components/work-item-detail-screen.test.tsx --max-warnings=0` — passed
  - `pnpm exec tsc --noEmit --pretty false` — passed
  - `git diff --check` — passed
  - `python3 ~/.codex/skills/spec-driven-development/scripts/lint_spec.py --spec-dir .spec/workspace-surface-editor-stability` — passed
  - `python3 ~/.codex/skills/spec-driven-development/scripts/traceability_report.py --spec-dir .spec/workspace-surface-editor-stability --strict` — passed
  - `~/.codex/skills/diff-review/scripts/review-preflight.sh` — completed for deep review context
  - `~/.codex/skills/diff-review/scripts/review-preflight.sh` — completed again after fixes for the normal clean-loop pass
  - `~/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — completed for architecture context
- Prompt audit: satisfies the TipTap clarification that this slice is only for the work item detail editor area where title and description are edited. It preserves mentions, references, collaboration attachment, save, Done, Close, stale reload, and latest-content persistence semantics while reducing synchronous parent/store fan-out during typing.
- Spec drift: T-007 was cross-linked after the user follow-up because document hydration safety and work item description documents share collaboration bootstrap, presence, active PartyKit, flush, and teardown assumptions. Browser smoke remains user-owned per the latest validation instruction.
- Residual risk: no browser smoke was run by request. T-007 must still prove that the shared hydration/collaboration layer cannot empty documents or work item description documents during create/type/navigate/return, room bootstrap, flush, or teardown.

## Slice Review: 7.1 Document Hydration Safety

- Linked tasks: 7.1
- Linked requirements: REQ-DOC-001, REQ-EDITOR-001, REQ-REVIEW-001
- Review mode: deep diff-review first with architecture-standards, then normal clean-loop review after fixing the finding.
- Archetypes: contract, fallback-state, optimistic-state, release-safety, architecture
- Root cause: document body safety only covered active collaboration body protection. Legacy/private document autosaves and the debounce window before a body mutation persisted could still accept stale scoped read-model or snapshot bodies, and collaboration teardown could flush content before a session had actually attached/synced.
- Blast radius: document detail screen, document autosave queue, scoped read-model merge/replacement, snapshot/bootstrap replacement, collaboration runtime open/teardown/pagehide, active PartyKit room persistence, and T-006 work item description assumptions.
- Fix radius: must fix now.
- Proper fix: added `pendingDocumentContentSyncs` as store-owned body protection for unsynced local document edits, preserved those bodies across scoped read-model merge and snapshot replacement, moved document body persistence to the combined document update mutation when needed, rotated pending tokens when a rename joins a pending body sync, and gated teardown-content flush until the collaboration session has attached/synced.
- Architecture decisions:
  - Store/read-model reconciliation owns stale-body preservation because empty hydration can arrive from snapshots, scoped read models, or collaboration bootstrap, not only from the editor component.
  - Collaboration runtime owns teardown flush authority and now requires an attached/synced editor session before flushing document content on unmount or pagehide.
  - HTML remains the canonical persisted document content for this slice; durable Yjs canonical state remains deferred because the current evidence did not require changing the persistence source of truth.
  - T-006 remains a work item detail hot-path optimization; T-007 validates the shared collaboration bootstrap, presence, active PartyKit room, flush, and teardown assumptions that both documents and work item description documents rely on.
- Deep-review finding:
  - Pending document body protection was initially cleared in a `finally`, so a failed document body mutation could leave a locally typed draft unprotected from a later stale snapshot/read-model. Fixed by clearing the pending token only after successful/current persistence or explicit cancellation/ownership transfer, and added a failure-path regression.
- Normal clean-loop review: reran diff-review preflight, architecture preflight, focused validation, focused eslint, typecheck, spec lint/traceability, and diff whitespace checks after the fix; no remaining T-007 findings were identified.
- Remediation radius:
  - Must fix now: stale read-model/snapshot body replacement during pending local edits, bootstrapping teardown-content flush, rename/body queue token race, failed mutation clearing pending protection.
  - Should fix if cheap/safe: component-level stale-empty bootstrapping regression and hook inverse tests for pre-attach pagehide/unmount; completed.
  - Defer: durable Yjs state as canonical content and broader collaboration transport cleanup until measurements or persistence evidence require it.
- Prevention artifacts: store merge tests for pending local bodies, work document action tests for combined update/race/failure paths, collaboration hook tests for pre-attach teardown guards and attached teardown flushing, document detail component test for stale empty bootstrapping refresh, and PartyKit server tests for active-room/teardown safeguards.
- Validation:
  - `pnpm exec vitest run tests/hooks/use-document-collaboration.test.tsx tests/lib/store/work-document-actions.test.ts tests/lib/app-store-read-model-merge.test.ts tests/components/document-detail-screen.test.tsx tests/services/partykit-server.test.ts` — passed, 5 files / 106 tests
  - focused `pnpm exec eslint hooks/use-document-collaboration.ts lib/store/app-store-internal/types.ts lib/store/app-store-internal/slices/ui.ts lib/store/app-store-internal/slices/work-document-actions.ts tests/hooks/use-document-collaboration.test.tsx tests/lib/store/work-document-actions.test.ts tests/lib/app-store-read-model-merge.test.ts tests/components/document-detail-screen.test.tsx --max-warnings=0` — passed
  - `pnpm exec tsc --noEmit --pretty false` — passed
  - `git diff --check` — passed
  - `python3 ~/.codex/skills/spec-driven-development/scripts/lint_spec.py --spec-dir .spec/workspace-surface-editor-stability` — passed
  - `python3 ~/.codex/skills/spec-driven-development/scripts/traceability_report.py --spec-dir .spec/workspace-surface-editor-stability --strict` — passed
  - `~/.codex/skills/diff-review/scripts/review-preflight.sh` — completed for deep review context and again for the normal clean-loop pass after the fix
  - `~/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — completed for architecture context and again for the normal clean-loop pass after the fix
- Prompt audit: satisfies the document hydration requirement from the original prompt and the snapshot/loading follow-up for document content safety. It also satisfies the latest T-006/T-007 follow-up by explicitly relying on and validating shared hydration, presence, active PartyKit, flush, and teardown assumptions.
- Spec drift: none; browser smoke remains user-owned per instruction, and the implementation does not change canonical document content away from HTML.
- Residual risk: if a document body mutation fails, the local draft remains protected from stale merges but there is still no automatic retry beyond the existing rich-text queue behavior. That is safer than data loss and remains a candidate for the broad T-009 performance/reliability audit.

## Slice Review: 8.1 Chat Message Read/Edited Metadata

- Linked tasks: 8.1
- Linked requirements: REQ-CHAT-001, REQ-REVIEW-001
- Review mode: deep diff-review first with architecture-standards, then normal clean-loop review after fixing findings.
- Archetypes: contract, architecture, shared-ui, release-safety, optimistic-state, performance
- Root cause: chat read state was conversation-level and could reflect the current visit/read action rather than a durable per-message first-open timestamp, while the conversation list displayed read time even though the requested placement was the message canvas beside the message timestamp.
- Blast radius: chat read-state schema, Convex read-state mutation, chat message send path, API route contract, read-model invalidation and selection, Zustand optimistic read-state merge, chat thread rendering, conversation list display, and focused route/store/component/read-model tests.
- Fix radius: must fix now.
- Proper fix: added additive per-user `messageReadAtById` receipt maps to chat read states, merged first-read timestamps without overwriting existing values, propagated visible unread message ids from the chat thread, filtered receipt ids on the server to messages readable in the authorized conversation, removed read time from chat list rows, and rendered message metadata as timestamp -> `Read ...` -> `Edited ...`.
- Architecture decisions:
  - Durable first-read authority lives in Convex chat read state and scoped read models, not in UI render time.
  - The client may hint which message ids were opened, but Convex revalidates conversation access and filters ids to messages in that conversation that are visible to the current user.
  - Conversation-list read models intentionally omit per-message receipt maps; thread read models include them. Store merge preserves existing receipt maps when a list patch omits the optional field.
  - Chat list unread semantics continue to use conversation-level `readAt`/`unreadAt`; per-message receipts are only for message canvas metadata.
- Deep-review findings:
  - Client-provided `messageIds` were initially persisted without server-side conversation/message visibility filtering. Fixed by filtering through `listChatMessagesByConversation` after `requireConversationAccess`, allowing deleted messages only for their creator, and adding a Convex regression.
  - Stripping receipt maps from conversation-list read models would have let generic store merge replace an existing thread receipt map with an omitted optional field. Fixed with `mergeChatReadStates` and a store merge regression.
  - Conversation-list read models initially would have carried full per-message receipt maps despite the list not rendering read times. Fixed by stripping receipts from list read models and preserving them only in thread read models, with scoped selector coverage.
- Normal clean-loop review: reran focused validation, focused eslint, typecheck, diff whitespace checks, diff-review preflight, and architecture preflight after the fixes; no remaining T-008 findings were identified.
- Remediation radius:
  - Must fix now: first-read-only persistence, no current-time fallback in message canvas, message metadata ordering, server-side id filtering, list read-model overfetch/merge safety.
  - Should fix if cheap/safe: route contract tests for thread/list invalidation and scoped read-model tests for receipt inclusion/exclusion; completed.
  - Defer: channel post/comment read receipts. The user follow-up and live repo path were chat-message specific; T-009 still audits chat/channel performance as app surfaces.
- Prevention artifacts: Convex tests for first-read preservation and receipt id filtering, store tests for optimistic first-read merge and list-patch preservation, route contract test for `messageIds` and list/thread invalidation, scoped read-model test for list/thread receipt payload separation, and chat thread component tests for opened message ids, persisted metadata order, and no synthetic read timestamp.
- Validation:
  - `pnpm exec vitest run tests/components/chat-thread.test.tsx tests/lib/store/collaboration-conversation-actions.test.ts tests/convex/chat-message-notifications.test.ts tests/app/api/chat-collaboration-route-contracts.test.ts tests/lib/scoped-read-models.test.ts tests/lib/app-store-read-model-merge.test.ts` — passed, 6 files / 69 tests
  - focused `pnpm exec eslint 'app/api/chats/[chatId]/read-state/route.ts' components/app/collaboration-screens/chat-thread.tsx components/app/collaboration-screens/workspace-chat-ui.tsx components/app/collaboration-screens/workspace-chats-screen.tsx components/app/collaboration-screens/workspace-conversation-list-pane.tsx convex/app.ts convex/app/chat_read_states.ts convex/app/collaboration_handlers.ts convex/validators.ts lib/convex/client/collaboration.ts lib/domain/chat-read-state.ts lib/domain/types-internal/models.ts lib/scoped-sync/read-models.ts lib/server/convex/collaboration.ts lib/store/app-store-internal/slices/collaboration-conversation-actions.ts lib/store/app-store-internal/slices/ui.ts lib/store/app-store-internal/types.ts tests/app/api/chat-collaboration-route-contracts.test.ts tests/components/chat-thread.test.tsx tests/convex/chat-message-notifications.test.ts tests/lib/app-store-read-model-merge.test.ts tests/lib/scoped-read-models.test.ts tests/lib/store/collaboration-conversation-actions.test.ts --max-warnings=0` — passed
  - `pnpm exec tsc --noEmit --pretty false` — passed
  - `git diff --check` — passed
  - `~/.codex/skills/diff-review/scripts/review-preflight.sh` — completed for deep review context
  - `~/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — completed for architecture context
- Prompt audit: satisfies the chat read/edited metadata follow-up: read timestamps are persisted on first open/read, not recomputed from current time; read time is removed from the chat conversation list; the message canvas renders timestamp, bullet-separated `Read`, then bullet-separated `Edited`.
- Spec drift: corrected overbroad chat/channel wording to chat-message metadata because the follow-up and implementation evidence are chat-specific. Browser smoke remains user-owned per instruction.
- Residual risk: per-message read receipts are stored as an additive map on each user/conversation read-state. Very large long-lived chats may eventually justify a separate receipt table or compaction strategy, which belongs in T-009 performance/data-shape audit if measurements show map size or read-model payload pressure.

## Slice Review: 9.1 Deep/Wide App Performance Audit And Remediation

- Linked tasks: 9.1
- Linked requirements: REQ-PERF-001, REQ-DIAG-001, REQ-REVIEW-001
- Review mode: repo-audit taxonomy without the full `.audits` turn loop, architecture-standards as the ownership lens, then deep diff-review first and normal clean-loop review after fixes.
- Archetypes: performance, architecture, optimistic-state, fallback-state, contract, shared-ui, background-work, release-safety.
- Auditable areas covered:
  - App shell/sidebar/navigation: shell membership, sidebar/navigation, chat-list, and inbox read models now emit first-useful-render diagnostics.
  - Workspace, team, project, document, work item, inbox, chat/channel, search, people, views: representative read-model surfaces now emit diagnostics for retained-data vs first-refresh rendering.
  - Snapshot/bootstrap and scoped read-model architecture: existing snapshot fetch/apply diagnostics were retained; scoped refresh diagnostics were extended with first-useful-render evidence.
  - Loading-state logic and first useful render: retained-data diagnostics now distinguish instant useful render from blank initial loading.
  - Zustand/store merge and selector fan-out: scoped pruning now honors pending work-item updates; document and chat merge protections from T-007/T-008 remain intact.
  - Convex/read-model route latency and overfetching: read helpers no longer trigger unrelated email job processing; chat list receipt overfetch was fixed in T-008 and carried into this audit.
  - Optimistic updates and flicker/disappear/reappear behavior: pending work-item sync guards prevent stale scoped replacements from pruning optimistically moved items.
  - TipTap/editor hot paths: T-006 work item title/description editor optimizations remain coupled to T-007 hydration/presence/active PartyKit/flush/teardown safety, and mutation diagnostics now cover rich-text reconciliation latency.
  - Collaboration flush/hydration/persistence: T-007 protections remain the authority for stale body replacement; mutation diagnostics cover queued rich-text sync outcomes.
  - Route transitions and detail-to-subtask navigation: document/work-item/project detail diagnostics report retained data during route changes.
  - Server read paths doing unrelated work: snapshot/auth/workspace-membership read helpers no longer schedule email job processing.
  - Browser rendering/layout bottlenecks: no browser smoke was run by request; diagnostics are code-level dev instrumentation for future measured browser passes.
  - Static hotspots from Fallow/audit history: `.audits/full-codebase-audit.md`, `.audits/realtime-collaboration-outline-comparison.md`, `.audits/fallow-static-audit-2026-05-01.md`, and `.reviews/realtime-collaboration-hardening.md` were used as context; changed-file Fallow evidence is recorded below.
- Finding 1: server read helpers triggered queued email job processing.
  - Root cause: `getAuthContextServer`, `getSnapshotServer`, and `getWorkspaceMembershipBootstrapServer` scheduled background email processing from read/bootstrap wrappers, even though Convex email queue insertion already schedules processing.
  - Blast radius: snapshot route, snapshot version/auth checks, scoped read-model routes, workspace shell bootstrap, route latency, and background queue scheduling.
  - Fixes: quick/proper fix completed by removing the email trigger from read helpers; strategic fix is to keep queue wakeups in write/queue-owned paths and operational/manual processing routes.
  - Remediation radius: must fix now.
  - Prevention artifact: server wrapper regression asserts auth/snapshot/scoped-read reads do not call mutations for email processing.
- Finding 2: stale scoped read-model replacement could prune optimistically updated work items.
  - Root cause: scoped replacement pruning compared current scoped items to incoming items without knowing that a local status/property update was still reconciling.
  - Blast radius: board/list lane moves, status/property bulk updates, detail-to-subtask navigation, and any scoped work-index/detail refresh that lands before the mutation settles.
  - Fixes: quick fix would be component-side retained rows; proper fix completed by adding store-owned `pendingWorkItemSyncsById` and protecting those IDs during scoped pruning; strategic fix is to extend this pending-entity guard only when future measured mutations show the same stale-prune class.
  - Remediation radius: must fix now.
  - Prevention artifact: store merge regression for pending work-item scoped pruning and action regression for token set/clear after mutation settle.
- Finding 3: performance work lacked first-useful-render and mutation reconciliation diagnostics.
  - Root cause: existing diagnostics measured snapshot fetch/apply and scoped refresh duration, but not whether a surface rendered useful retained data or how long optimistic mutations took to reconcile.
  - Blast radius: app shell, workspace/team/project/document/work item/inbox/chat/channel/search/people/views, rich-text queues, and background mutation UX.
  - Fixes: quick fix completed by adding dev-only diagnostics for first useful render and mutation reconciliation; proper fix wired representative surfaces and rich-text/background sync paths; strategic fix is to feed these events into dashboard/trace tooling when production observability is ready.
  - Remediation radius: must fix now for diagnostics; production dashboards defer.
  - Prevention artifact: hook/runtime tests assert retained-data first useful render and success/failure reconciliation events.
- Finding 4: introduced Fallow dead-code signal from chat read-state helpers.
  - Root cause: T-008 added exported helper functions that were not consumed.
  - Blast radius: public module surface and changed-file static audit clarity.
  - Fixes: removed the unused exports; no suppression was added.
  - Remediation radius: should fix if cheap/safe; completed.
  - Prevention artifact: Fallow changed-file rerun shows `dead_code_introduced: 0`.
- Static/Fallow evidence:
  - `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` still exits nonzero with the local `node_modules directory not found` warnings and advisory branch findings.
  - After removing introduced unused exports: `dead_code_introduced: 0`; remaining changed-file attribution is `dead_code_inherited: 5`, `complexity_introduced: 12`, `complexity_inherited: 3`, `duplication_introduced: 14`, `duplication_inherited: 17`.
  - Introduced complexity/duplication hotspots are mostly from earlier slices and broad UI/backend edits (`WorkItemDetailScreen`, work-item menus, workspace chat UI, selection rows, reference relationship handlers, comment handlers). They are recorded as static audit evidence, not hidden as clean Fallow.
  - T-009-specific runtime complexity was reduced by extracting reconciliation diagnostic reporting from `flushQueuedRichTextSync`.
- Deep/normal diff-review loop:
  - Deep review completed against the T-009 diff, architecture-standards prompts, repo-audit archetypes, scoped read-model/read-path ownership, store merge invariants, optimistic reconciliation, and diagnostic noise risks.
  - No new code findings remained after the earlier runtime diagnostic extraction and unused-export cleanup.
  - Normal clean-loop review completed after the deep pass by rerunning diff-review preflight and architecture preflight; both completed with no T-009-specific blocker beyond the already-recorded advisory Fallow/static history.
- Validation:
  - `pnpm exec vitest run tests/lib/use-scoped-read-model-refresh.test.tsx tests/lib/store/runtime.test.ts tests/lib/server/convex-auth.test.ts tests/lib/app-store-read-model-merge.test.ts tests/lib/store/work-item-actions.test.ts tests/components/convex-app-provider.test.tsx tests/app/api/read-model-route-contracts.test.ts tests/components/collaboration-screens-loading.test.tsx` — passed, 8 files / 75 tests
  - `pnpm exec vitest run tests/lib/store/runtime.test.ts` — passed after runtime diagnostic helper extraction
  - focused eslint over T-009 source/test files — passed
  - `pnpm exec tsc --noEmit --pretty false` — passed before the final runtime helper extraction and will be rerun in the formal review loop
  - Fallow changed-file audit — nonzero advisory result as classified above
- Prompt audit: satisfies the broad performance follow-up and the final checklist sentence by covering shell/sidebar/navigation; workspace/team/project/document/work item/inbox/chat/channel/search/people/views; snapshot/bootstrap/read models; loading and first useful render; store merge and selector fan-out; Convex/read-model route latency and overfetching; optimistic flicker; TipTap/editor hot paths; collaboration flush/hydration/persistence; route transitions; server read paths doing unrelated work; browser rendering constraints; and static Fallow/audit history.
- Spec drift: none. Browser smoke tests remain excluded because the user said they will do them.
- Residual risk: remaining loading-state decisions now have code-level diagnostics but no browser trace/screenshots in this slice by request. Fallow complexity/duplication remains advisory branch debt; broad component decomposition should be a separate owner-local refactor unless final review finds a release-blocking regression.

## Final Total-Diff Review And Coverage Audit

- Linked tasks: 10.1
- Linked requirements: REQ-REVIEW-001 plus final coverage of REQ-SIDE-001, REQ-CHAT-001, REQ-SELECT-001, REQ-MENU-001, REQ-REF-001, REQ-REF-002, REQ-CREATE-001, REQ-EDITOR-001, REQ-DOC-001, REQ-PERF-001, and REQ-DIAG-001.
- Review mode: final total-diff deep review using diff-review, architecture-standards, the spec package, original prompt/follow-ups, repo-audit taxonomy, validation output, Fallow/static evidence, and live code sampling; normal clean-loop review followed because no final code finding remained.
- Archetypes: release-safety, architecture, performance, contract, optimistic-state, fallback-state, shared-ui, background-work.
- Coverage audit:
  - Sidebar persistence: implemented by viewer/surface-scoped persisted UI state and collaboration sidebar hook tests.
  - Multi-select visible rows/subitems/detail subitems: implemented through surface-scoped visible selection controllers and work surface/detail tests.
  - Dynamic right-click property menus: implemented from visible editable `displayProps`, including labels and custom select/multi-select fields, with menu tests.
  - Reference search/persistence/backlinks/access: implemented for documents, work item descriptions, and comment rich-text paths with scoped candidates excluding people/create actions, widened menus, durable relationship extraction, cleanup, and access-denied navigation contracts.
  - Add Item defaults: implemented for group, subgroup, and single-value filters including empty label lanes and private/visibility guardrails.
  - Work item detail TipTap hot paths: optimized only in the requested title/description editor area and reviewed against document editor patterns without broadening scope.
  - Document hydration/content deletion: protected pending/active document bodies across scoped read-models, snapshots, editor sync, collaboration bootstrap, flush, and teardown, while preserving intentional empty saves.
  - Chat read/edited metadata: first-read message receipts are persisted in backend/read-model state and rendered in the message canvas as timestamp, `Read`, then `Edited`; chat list read-time display is not required.
  - Deep/wide performance audit: covered shell/sidebar/navigation; workspace/team/project/document/work item/inbox/chat/channel/search/people/views; snapshot/bootstrap/read-models; loading/first useful render; Zustand merge and selector fan-out; Convex/read-model latency and overfetching; optimistic flicker; TipTap; collaboration hydration/persistence; route transitions; read paths doing unrelated work; browser rendering constraints; and Fallow/audit history.
  - T-006/T-007 dependency follow-up: recorded and validated that work item description editor optimization relies on the same collaboration bootstrap, presence, active PartyKit, flush, and teardown assumptions hardened by document hydration safety.
- Final deep-review findings: no new release-blocking issue remained in the final total-diff pass. Earlier per-slice findings were already fixed and recorded in slice reviews.
- Normal clean-loop review: final diff-review preflight and architecture preflight completed after validation; no final blocker was found.
- Validation:
  - `pnpm lint` — passed.
  - `pnpm typecheck` — passed.
  - `pnpm exec vitest run tests/components/collaboration-sidebar-state.test.tsx tests/components/work-surface-view.test.tsx tests/components/work-surface.test.tsx tests/components/work-item-menus.test.tsx tests/lib/store/viewer-view-config.test.ts tests/components/rich-text-editor-helpers.test.tsx tests/lib/domain/rich-text-references.test.ts tests/lib/store/work-document-actions.test.ts tests/lib/store/work-comment-actions.test.ts tests/lib/store/work-item-actions.test.ts tests/convex/comment-handlers.test.ts tests/convex/work-item-handlers.test.ts tests/convex/cleanup.test.ts tests/lib/scoped-read-models.test.ts tests/components/work-item-detail-screen.test.tsx tests/hooks/use-document-collaboration.test.tsx tests/lib/app-store-read-model-merge.test.ts tests/components/document-detail-screen.test.tsx tests/services/partykit-server.test.ts tests/components/chat-thread.test.tsx tests/lib/store/collaboration-conversation-actions.test.ts tests/convex/chat-message-notifications.test.ts tests/app/api/chat-collaboration-route-contracts.test.ts tests/lib/use-scoped-read-model-refresh.test.tsx tests/lib/store/runtime.test.ts tests/lib/server/convex-auth.test.ts tests/components/convex-app-provider.test.tsx tests/app/api/read-model-route-contracts.test.ts tests/components/collaboration-screens-loading.test.tsx tests/components/group-chip-popover.test.tsx tests/components/properties-chip-popover.test.tsx` — passed, 31 files / 472 tests.
  - `pnpm build` — passed.
  - `python3 ~/.codex/skills/spec-driven-development/scripts/lint_spec.py --spec-dir .spec/workspace-surface-editor-stability` — passed.
  - `python3 ~/.codex/skills/spec-driven-development/scripts/traceability_report.py --spec-dir .spec/workspace-surface-editor-stability --strict` — passed.
  - `git diff --check` — passed.
  - `~/.codex/skills/diff-review/scripts/review-preflight.sh` — completed for final deep/normal review context.
  - `~/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — completed for final architecture context.
  - `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` — nonzero advisory result with local `node_modules directory not found` warnings; dead-code issues are marked inherited, and complexity/duplication findings remain recorded static audit evidence.
- Fallow/static evidence:
  - Final summary: `dead_code_issues: 5`, `complexity_findings: 15`, `duplication_clone_groups: 31`.
  - Dead-code detail: 4 unused exports and 1 duplicate export are marked `introduced: false` by Fallow, including inherited chat-read-state helpers and grouping-label duplicate export history.
  - Complexity/duplication findings include broad UI/store/editor hotspot pressure from this large branch and earlier existing hotspots; these remain advisory architecture debt, not hidden all-clear evidence.
- Browser smoke: intentionally not run because the user said they will do it themselves.
- Prompt audit: the original prompt and every follow-up through chat read/edited metadata, T-006/T-007 collaboration dependency, broad performance audit scope, repo-audit taxonomy, architecture-standards use, per-slice diff-review loops, and no-browser-smoke instruction are covered.
- Spec drift: none found in the final total-diff review. Any future normalized reference graph, durable Yjs canonical migration, production observability dashboard, backend batch mutation, or broad component decomposition remains deferred until separate evidence justifies it.
- Residual risk: manual browser verification is user-owned; Fallow complexity/duplication is advisory branch debt; per-message chat receipt maps may need future compaction for very large chats if measured payload pressure appears.
- PR: non-draft PR #48 created against `main`: https://github.com/declancowen/Linear/pull/48
