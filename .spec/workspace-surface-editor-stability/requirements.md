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

# Requirements Document: Workspace Surface Stability, Editor Safety, And App Performance

## Source Artifacts
- `.spec/workspace-surface-editor-stability/design.md`
- `.reviews/work-item-reference-activity-ui.md`
- `.audits/full-codebase-audit.md`
- `.audits/realtime-collaboration-outline-comparison.md`

## Scope Statement
- Define implementation requirements for persisted collaboration sidebar state, chat message read/edited metadata correctness, work item multi-select and bulk property menus, scoped rich-text references, create defaults, work item editor performance, document hydration safety, and deep/wide app performance audit/remediation.
- Requirements derive from DES-001 through DES-011 and preserve all user follow-ups through 2026-06-02.

## Upstream Alignment Audit
- Original prompt: covered by REQ-SIDE-001 through REQ-REVIEW-001.
- TipTap clarification: covered by REQ-EDITOR-001, scoped to work item detail title/description editing.
- Snapshot/loading follow-up: covered by REQ-DOC-001 through REQ-DIAG-001.
- Broad performance follow-up: covered by REQ-PERF-001 and REQ-DIAG-001.
- Repo-audit taxonomy follow-up: covered by REQ-REVIEW-001 and all slice review requirements.
- Diff-review loop follow-up: covered by REQ-REVIEW-001 and task leaf review loops.
- Reference access/backlink follow-up: covered by REQ-REF-001 and REQ-REF-002.
- Chat read/edited metadata follow-up: covered by REQ-CHAT-001.
- Architecture standards: applied to state authority, privacy, data ownership, performance, and review loops.

## Cross-Cutting Coverage
- Security: REQ-REF-001, REQ-REF-002, REQ-DOC-001, REQ-REVIEW-001
- Privacy: REQ-REF-001, REQ-REF-002, REQ-CHAT-001, REQ-DOC-001, REQ-PERF-001
- Performance: REQ-EDITOR-001, REQ-PERF-001, REQ-DIAG-001
- Resilience: REQ-SIDE-001, REQ-CHAT-001, REQ-DOC-001, REQ-DIAG-001, REQ-REVIEW-001
- Migration: REQ-SIDE-001, REQ-CHAT-001, REQ-REF-002, REQ-CREATE-001
- Observability: REQ-PERF-001, REQ-DIAG-001, REQ-REVIEW-001
- Supportability: REQ-REF-002, REQ-CHAT-001, REQ-DIAG-001, REQ-REVIEW-001
- Backward compatibility: REQ-SIDE-001, REQ-CHAT-001, REQ-REF-002, REQ-CREATE-001, REQ-DOC-001

## Requirements

### REQ-SIDE-001: Persist collaboration sidebar state per viewer and surface
Source Design Decisions:
- DES-003
- DES-004

Priority: High

Rationale:
- Chat/channel details sidebars currently reopen by default, losing the user's preferred state.

Requirement:
- THE system SHALL persist collaboration details sidebar open/closed state per current user and collaboration surface, defaulting to open only when no saved value exists.

Verification Method:
- Store persistence tests and component tests for channel/team/workspace chat surfaces.

Risk if Unmet:
- Users repeatedly lose their sidebar preference and the original prompt remains unimplemented.

Acceptance Criteria
1. WHEN a user closes a channel details sidebar and revisits that surface, THEN it SHALL remain closed.
2. WHEN a user opens a previously closed chat details sidebar and revisits that surface, THEN it SHALL remain open.
3. WHEN another user visits the same surface, THEN that user's own persisted value or the first-visit open default SHALL apply.
4. WHEN persisted UI state is compacted, THEN old sidebar entries SHALL be bounded without dropping the newest entries.

Negative Cases
1. WHEN no surface key exists, THEN the sidebar SHALL not write malformed persisted state.

### REQ-CHAT-001: Persist first-read message receipts and ordered read/edited stamps
Source Design Decisions:
- DES-003
- DES-012

Priority: High

Rationale:
- Chat message read receipts currently show the wrong time by reflecting current read/view state instead of the first time the message was opened/read, and the receipt belongs in the message canvas metadata rather than the conversation list.

Requirement:
- THE system SHALL persist first-read timestamps for chat messages in authoritative backend/read-model state and render message canvas metadata in the order: sent timestamp, read stamp, edited stamp, separated by bullet delimiters when optional stamps exist.

Verification Method:
- Convex/store/read-model tests for first-write-only read receipt persistence and component tests for message canvas metadata rendering.

Risk if Unmet:
- Read receipts are misleading, can drift on every visit, and the message canvas does not show the requested read/edited audit trail.

Acceptance Criteria
1. WHEN a viewer opens/reads a message for the first time, THEN the durable read receipt timestamp SHALL be recorded once.
2. WHEN the same viewer later opens/reads the same message again, THEN the original read receipt timestamp SHALL remain unchanged.
3. WHEN a message is rendered in the message canvas with a read receipt, THEN the read stamp SHALL appear next to the message timestamp as a bullet-separated metadata item.
4. WHEN a message is edited and also has a read receipt, THEN the edited stamp SHALL render after the read stamp with another bullet delimiter between them.
5. WHEN a conversation appears in a chat list, THEN read receipt times SHALL not be required there by this requirement.

Negative Cases
1. WHEN a viewer lacks access to a chat, THEN read receipt metadata SHALL NOT be exposed through read-model payloads or message rendering.
2. WHEN a message is unread by a viewer, THEN the message canvas SHALL not invent a read timestamp from current time.

### REQ-SELECT-001: Support multi-select for visible work item rows and subitems
Source Design Decisions:
- DES-003
- DES-005

Priority: High

Rationale:
- Users need to select multiple visible parent rows, child rows, subitems, and detail subitem rows for bulk changes.

Requirement:
- THE system SHALL provide ephemeral surface-scoped selection for visible work items, child rows, subitems, and work item detail subitem rows.

Verification Method:
- Component tests for visible row selection, range selection, and context-menu target selection.

Risk if Unmet:
- Bulk editing remains impossible or applies to unintended hidden items.

Acceptance Criteria
1. WHEN a user selects multiple visible rows, THEN a bulk action target set SHALL include only selected visible item IDs.
2. WHEN a user right-clicks a selected row, THEN the context menu SHALL act on the selected set.
3. WHEN a user right-clicks an unselected row, THEN the context menu SHALL act only on that row.
4. WHEN a user navigates away or changes surfaces, THEN ephemeral selection SHALL clear or rescope safely.

Negative Cases
1. WHEN filtered-out items exist in the store, THEN bulk actions SHALL NOT apply to them unless they are visible and selected.

### REQ-MENU-001: Build dynamic bulk property menus from visible editable display properties
Source Design Decisions:
- DES-006
- DES-003

Priority: High

Rationale:
- Right-click property options must match visible editable dropdown-like properties rather than a fixed menu.

Requirement:
- THE system SHALL derive work item context-menu property actions from visible editable `displayProps`, including built-in dropdown-like properties and custom select/multi-select fields, with appropriate icons and permission handling.

Verification Method:
- Menu model unit tests, component tests, and bulk mutation tests.

Risk if Unmet:
- Newly visible properties such as labels or custom select fields do not appear in bulk menus.

Acceptance Criteria
1. WHEN `status`, `priority`, or `labels` are visible and editable, THEN the context menu SHALL include matching bulk property actions.
2. WHEN a custom select or multi-select property is visible and editable, THEN the context menu SHALL include that property with the correct property icon.
3. WHEN a property is not visible, not dropdown-like, or not editable, THEN the context menu SHALL not expose it for bulk editing.
4. WHEN a bulk property update is applied, THEN existing validation and optimistic mutation behavior SHALL be preserved.

Negative Cases
1. WHEN selected items have mixed current values, THEN the menu SHALL not imply a single false current value.

### REQ-REF-001: Open scoped reference search in documents and work item rich-text areas
Source Design Decisions:
- DES-007
- DES-003

Priority: High

Rationale:
- The current `Reference` command is too narrow and can be inert; it must open the intended scoped search across rich-text surfaces.

Requirement:
- THE system SHALL make the rich-text `Reference` command open a wider editor-scoped search dialog for work items/tasks, documents, projects, and views in documents and work item rich-text areas, excluding people and create actions.

Verification Method:
- Rich text editor component tests and candidate selector tests.

Risk if Unmet:
- Users cannot insert the requested references, and the slash command remains broken.

Acceptance Criteria
1. WHEN a user chooses `Reference` in a document editor, THEN a scoped search for docs, work items/tasks, projects, and views SHALL open.
2. WHEN a user chooses `Reference` in a work item description or comment editor, THEN the same allowed entity types SHALL be searchable where access permits.
3. WHEN the reference search opens, THEN its width SHALL prevent premature reference subtext wrapping compared with the previous narrow picker.
4. WHEN candidates are shown, THEN people and create actions SHALL be absent.

Negative Cases
1. WHEN an entity is not accessible to the author, THEN it SHALL not appear as an insertion candidate.

### REQ-REF-002: Persist references, backlinks, and access-denied navigation safely
Source Design Decisions:
- DES-007
- DES-003

Priority: Critical

Rationale:
- References must be durable relationships/backlinks, but viewers without target access must still be protected from hidden content.

Requirement:
- THE system SHALL persist inserted references/backlinks through authoritative parsing and server validation paths, keep saved reference markers visible to viewers who can read the containing document/work item, and deny target navigation/content hydration when the viewer lacks workspace/team/document access to the target.

Verification Method:
- Rich text parser/security tests, store tests, Convex handler tests, route/navigation tests, and sidebar/backlink component tests.

Risk if Unmet:
- References become visual-only links, or inaccessible target content leaks through references/backlinks.

Acceptance Criteria
1. WHEN an author inserts an accessible reference, THEN the saved content SHALL update durable linked/reference fields and scoped read-model invalidations.
2. WHEN a viewer can read the containing document/work item but cannot access the target, THEN the authored reference marker/backlink SHALL remain visible without target-content hydration.
3. WHEN the viewer clicks an inaccessible target, THEN the app SHALL show "You do not have access" or the existing typed access-denied equivalent.
4. WHEN inline, embed/block, or plain-link reference forms are used, THEN all forms SHALL share the same typed extraction, sanitizer, persistence, backlink, and navigation contract.
5. WHEN the final saved reference to a target is removed, THEN the durable relationship/backlink SHALL be removed unless another source still references it.

Negative Cases
1. WHEN target access is denied, THEN the app SHALL NOT fetch or reveal hidden target metadata beyond the authored label already present in containing content.
2. WHEN a private artifact is referenced, THEN shared backlinks SHALL NOT expose it to unauthorized viewers.

### REQ-CREATE-001: Prepopulate Add Item defaults from group, subgroup, and filters
Source Design Decisions:
- DES-008
- DES-003

Priority: High

Rationale:
- Adding an item from a grouped or filtered view should prescribe the same defaults that define the lane.

Requirement:
- THE system SHALL derive create defaults from group, subgroup, and active single-value filters, including labels in empty lanes.

Verification Method:
- Create-default resolver tests and work surface create-dialog tests.

Risk if Unmet:
- Items created from board/view lanes do not appear where the user created them or miss required labels/status/project defaults.

Acceptance Criteria
1. WHEN a user adds an item in a status lane, THEN the new item default status SHALL match the lane.
2. WHEN a user adds an item in an empty label-filtered lane, THEN the new item default labels SHALL include the lane/filter label.
3. WHEN group and subgroup both imply defaults, THEN the create dialog SHALL merge them deterministically.
4. WHEN active filters imply single values for labels/status/project/team/type/visibility, THEN safe defaults SHALL be applied.

Negative Cases
1. WHEN a filter is multi-value or ambiguous, THEN the resolver SHALL not invent an unsafe default.

### REQ-EDITOR-001: Improve work item detail title/description editor performance
Source Design Decisions:
- DES-009
- DES-003

Priority: High

Rationale:
- Work item title/description editing is visibly slow and supports collaboration, mentions, references, and saves.

Requirement:
- THE system SHALL reduce keystroke-time fan-out and expensive work in the work item detail title/description editor area without breaking collaboration, mentions, references, or persistence.

Verification Method:
- Component tests, code-level hot-path evidence, and targeted performance/typing smoke.

Risk if Unmet:
- Typing remains laggy or optimization breaks collaboration/persistence.

Acceptance Criteria
1. WHEN typing in the work item title/description, THEN unrelated app-wide derivations and reference extraction SHALL not run synchronously on each keypress unless required.
2. WHEN collaboration awareness, mentions, references, and saves are used, THEN behavior SHALL remain correct after optimization.
3. WHEN comparing against document editor patterns, THEN compatible faster patterns SHALL be reused or a reason recorded.

Negative Cases
1. WHEN editor performance is optimized, THEN draft content SHALL NOT become stale or unsaved.

### REQ-DOC-001: Prevent document hydration from deleting content
Source Design Decisions:
- DES-010
- DES-003

Priority: Critical

Rationale:
- Random document empty hydration is a data-loss class bug.

Requirement:
- THE system SHALL prevent empty/stale read-model, snapshot, editor sync, collaboration bootstrap, flush, and teardown paths from replacing active or recently typed document content.

Verification Method:
- Document editor regression tests, collaboration helper tests, store merge tests, and route/read-model tests.

Risk if Unmet:
- Users can lose newly typed document content after navigation or hydration.

Acceptance Criteria
1. WHEN a document is created, typed into, navigated away from, and returned to, THEN its content SHALL not hydrate to empty.
2. WHEN an empty preview/read-model payload arrives while active typed content exists, THEN it SHALL not replace the active body.
3. WHEN collaboration teardown/manual flush runs with stale client content, THEN it SHALL not overwrite newer active server-held room state.
4. WHEN a user intentionally saves an empty document, THEN the guard SHALL allow the intentional write through an explicit durable path.

Negative Cases
1. WHEN stale content is rejected, THEN the app SHALL not create an infinite loading or save retry loop.

### REQ-PERF-001: Audit and remediate deep/wide app performance
Source Design Decisions:
- DES-001
- DES-002
- DES-011

Priority: High

Rationale:
- The user explicitly asked for a broad and deep audit, not lowest-hanging-fruit fixes.

Requirement:
- THE system SHALL audit performance across the full requested app surface list and implement root-cause fixes where evidence shows architecture or data-flow problems.

Verification Method:
- Audit findings in `reviews.md`, diagnostics evidence, targeted tests, code-level route/render evidence, and static/audit history review.

Risk if Unmet:
- Loading, flicker, route lag, and editor lag persist despite local fixes.

Acceptance Criteria
1. WHEN shell/sidebar/navigation surfaces are audited, THEN root causes and remediation radius SHALL be recorded.
2. WHEN workspace/team/project/document/work item/inbox/chat/search/people/views are audited, THEN loading and first useful render behavior SHALL be classified.
3. WHEN status changes flicker or disappear/reappear, THEN optimistic and read-model reconciliation root cause SHALL be identified and fixed where practical.
4. WHEN server read paths do unrelated work such as email job triggering, THEN critical-path impact SHALL be measured or removed where safe.

Negative Cases
1. WHEN a finding is only speculative, THEN it SHALL not be presented as fixed without measurement or concrete code evidence.

### REQ-DIAG-001: Add diagnostics for first useful render and reconciliation
Source Design Decisions:
- DES-011
- DES-002

Priority: High

Rationale:
- Remaining loading states need measured justification.

Requirement:
- THE system SHALL add development diagnostics for scoped read-model refresh, snapshot/bootstrap, first useful render, and mutation reconciliation.

Verification Method:
- Unit tests for diagnostic helpers where applicable, development console/event evidence, and code-level diagnostics review.

Risk if Unmet:
- Performance work remains guesswork and regressions are hard to prevent.

Acceptance Criteria
1. WHEN a scoped read-model route refreshes, THEN diagnostics SHALL expose surface, duration, and retained-data/loading decisions in development.
2. WHEN bootstrap/snapshot work runs, THEN diagnostics SHALL expose timing and source path.
3. WHEN first useful render occurs, THEN diagnostics SHALL record whether it used seeded, retained, or fetched data.
4. WHEN optimistic mutation reconciliation resolves or rolls back, THEN diagnostics SHALL expose stale duration and flicker risk.

Negative Cases
1. WHEN diagnostics are enabled, THEN they SHALL not leak private data or materially slow production.

### REQ-REVIEW-001: Enforce spec, architecture, audit, diff-review, and PR discipline
Source Design Decisions:
- DES-001
- DES-003

Priority: Critical

Rationale:
- The user required spec-driven implementation with per-slice deep diff-review loops and a final non-draft PR.

Requirement:
- THE implementation SHALL run each slice through architecture-standards, focused validation, deep diff-review first, fixes, normal diff-review loops until clean, review-ledger recording, final total-diff review, final coverage audit, and non-draft PR creation to `main`.

Verification Method:
- `.spec/workspace-surface-editor-stability/reviews.md`, validation logs, git status, and PR metadata.

Risk if Unmet:
- Broad changes can miss requirements or ship without the requested review rigor.

Acceptance Criteria
1. WHEN a slice starts, THEN linked DES/REQ/task entries, relevant code, and tests SHALL be read first.
2. WHEN a slice completes, THEN focused validation SHALL pass or residual risk SHALL be recorded.
3. WHEN deep diff-review finds issues, THEN they SHALL be fixed before moving to the next slice.
4. WHEN normal diff-review loops are complete, THEN the slice SHALL be recorded in `reviews.md`.
5. WHEN all slices complete, THEN final total-diff review, final prompt coverage audit, commit, push, and non-draft PR to `main` SHALL happen.

Negative Cases
1. WHEN a generated spec/task conflicts with the original user request or live repo evidence, THEN the spec SHALL be corrected before implementation continues.

## Traceability Matrix
- DES-001 -> REQ-PERF-001, REQ-REVIEW-001
- DES-002 -> REQ-PERF-001, REQ-DIAG-001
- DES-003 -> REQ-SIDE-001, REQ-SELECT-001, REQ-MENU-001, REQ-REF-001, REQ-REF-002, REQ-CREATE-001, REQ-EDITOR-001, REQ-DOC-001, REQ-REVIEW-001
- DES-004 -> REQ-SIDE-001
- DES-005 -> REQ-SELECT-001
- DES-006 -> REQ-MENU-001
- DES-007 -> REQ-REF-001, REQ-REF-002
- DES-008 -> REQ-CREATE-001
- DES-009 -> REQ-EDITOR-001
- DES-010 -> REQ-DOC-001
- DES-011 -> REQ-PERF-001, REQ-DIAG-001

## Authoring Notes
- Every requirement cites one or more design decisions.
- Reference requirements explicitly distinguish insertion access, containing-surface visibility, target navigation permission, and hidden content hydration.
- Performance requirements remain broad and auditable rather than editor-only.
