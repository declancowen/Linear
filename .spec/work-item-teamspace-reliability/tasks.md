---
title: Work Item And TeamSpace Reliability
scope: work-item-teamspace-reliability
status: implementation-ready
repo_root: /Users/declancowen/Documents/GitHub/Linear
change_class: audit-remediation
risk_level: critical
owner: product-engineering
reviewers: [diff-review, architecture-standards]
approvers: [user]
implementation_owner: product-engineering
operations_owner: product-engineering
last_updated: 2026-06-14
---

# Task Plan: Work Item And TeamSpace Reliability

## Source Artifacts
- `.spec/work-item-teamspace-reliability/design.md`
- `.spec/work-item-teamspace-reliability/requirements.md`
- `.spec/work-item-teamspace-reliability/reviews.md`

## Gating Status
- Ready for implementation
- Blocking design decisions: none

## Execution Status Summary
- To do: none
- In progress: `10.2`
- Completed: `1.1`, `2.1`, `2.2`, `3.1`, `4.1`, `4.2`, `4.3`, `5.1`, `5.2`, `6.1`, `6.2`, `7.1`, `7.2`, `8.1`, `9.1`, `10.1`
- Deferred: none
- Blocked: none

## Sequencing Notes
- Backend-compatible contracts precede dependent UI. Destructive attachment behavior waits for stable identity and authoritative reconciliation. Whole-tree review precedes Fallow; Fallow remediation precedes the final review and release.

## Implementation Authority And Review Loop
- The original request is authoritative for outcome, live code/tests for current reality, and architecture standards for solution shape.
- Before each leaf task, refresh linked design/requirements, code, tests, bypasses, and compatibility risks.
- After focused validation, run a deep dual-pass diff review with architecture standards, fix findings, then run normal reviews until clean.
- Record every slice, finding, fix, validation result, architecture decision, and spec-drift decision in `.spec/work-item-teamspace-reliability/reviews.md`.
- Do not proceed to the next slice with actionable findings.

## Blocking Work
- None.

## Tasks

- [x] 1. Atomic bulk actions
  - [x] 1.1 Implement one authoritative atomic bulk work-item command
    - Status: completed
    - Depends on: none
    - Likely areas: `app/api/items/bulk/route.ts`, `components/app/screens/use-work-item-project-cascade-confirmation.tsx`, `components/app/screens/work-item-menus.tsx`, `components/app/screens/work-item-selection.tsx`, `lib/store/app-store-internal/slices/work-item-actions.ts`, `lib/store/app-store-internal/runtime.ts`, `lib/domain/work-item-inputs.ts`, `lib/convex/client/work.ts`, `lib/server/convex/work.ts`, `convex/app.ts`, `convex/app/work_item_handlers.ts`, `tests/app/api/work-route-contracts.test.ts`, `tests/components/work-item-menus.test.tsx`, `tests/components/work-item-project-cascade-confirmation.test.tsx`, `tests/convex/work-item-handlers.test.ts`, `tests/lib/store/work-item-actions.test.ts`
    - Validation: built-in/custom property, selection, permission, stale, mixed-scope, project-cascade, oversized, partial-failure, reconciliation, and single-item tests
    - Exit criteria: supported bulk property and delete actions use bounded all-or-none commands and no looped partial-write path remains
    - Rollback impact: UI may disable bulk actions; it must not fall back to unsafe loops
    - Blocking unknowns: none; choose and record the transaction-safe maximum during implementation
    - Pre-implementation context check: review DES-001, DES-002, DES-012, REQ-FUNC-001, REQ-NFR-001, current bulk/delete patterns, and tests
    - Invariant-transfer and candidate-acquisition check: prove every captured id is re-authorized before any write and derived invalidations include only admitted targets
    - Test creation review: prove all-or-none negative paths rather than only helper calls
    - Slice review loop: run focused validation, deep diff-review plus architecture standards, fix findings, rerun normal diff-review until clean, and record Slice 1
    - Post-implementation review: completed; reviewed accumulated branch interaction and one-outcome pessimistic reconciliation
    - Spec drift check: completed; design and requirements now record pessimistic bulk state because speculative grouped rollback could overwrite unrelated concurrent state
    - _Requirements: REQ-FUNC-001, REQ-NFR-001, REQ-ARCH-001_

- [x] 2. Attachment identity and lifecycle
  - [x] 2.1 Add stable attachment identity across upload and rich-text contracts
    - Status: completed
    - Depends on: none
    - Likely areas: `components/app/rich-text-editor/attachment-insertion.ts`, `components/app/rich-text-editor/attachment-upload-one.ts`, `components/app/rich-text-editor.tsx`, `lib/rich-text/extensions.ts`, `lib/content/rich-text-security.ts`, `lib/collaboration/canonical-content.ts`, `tests/components/rich-text-editor-helpers.test.tsx`, `tests/lib/content/rich-text-security.test.ts`
    - Validation: upload, insertion, sanitizer, canonicalization, parse/render, malformed-id, legacy-content, PartyKit compatibility tests
    - Exit criteria: new embedded attachments carry validated backend ids end to end and legacy nodes remain readable
    - Rollback impact: additive ids may remain inert if dependent UI rolls back
    - Blocking unknowns: none
    - Pre-implementation context check: review DES-003, DES-012, REQ-DATA-001, shared rich-text callers, and tests
    - Invariant-transfer and candidate-acquisition check: validate admitted attachment metadata at sanitizer/parser boundaries
    - Test creation review: prove safe round-trip and malformed metadata rejection
    - Slice review loop: run focused validation, deep diff-review plus architecture standards, fix findings, rerun normal diff-review until clean, and record Slice 2A
    - Post-implementation review: check shared document/chat/comment/PartyKit behavior
    - Spec drift check: update upstream artifacts before changing attachment identity semantics
    - _Requirements: REQ-DATA-001, REQ-ARCH-001_

  - [x] 2.2 Reconcile work-item attachments on authoritative save
    - Status: completed
    - Depends on: 2.1
    - Likely areas: `components/app/screens/work-item-detail-screen.tsx`, `lib/store/app-store-internal/slices/work-document-actions.ts`, `convex/app/work_item_handlers.ts`, `convex/app/document_handlers.ts`, `convex/app/cleanup.ts`, `tests/components/work-item-detail-screen.test.tsx`, `tests/convex/cleanup.test.ts`
    - Validation: Backspace/Delete, Cancel, Save, conflict/failure, direct remove, comments, shared storage, permissions, and legacy ambiguity tests
    - Exit criteria: backend deletion occurs only after successful authoritative reference-safe save
    - Rollback impact: disable reconciliation while retaining ids; never restore immediate destructive deletion
    - Blocking unknowns: none
    - Pre-implementation context check: review DES-003, DES-010, REQ-DATA-002, cleanup/reference ownership, and save/version tests
    - Invariant-transfer and candidate-acquisition check: prove all remaining work-item-owned references and storage-reference candidates are validated before deletion
    - Test creation review: prove Cancel, conflict, comments, shared storage, and ambiguous legacy records cannot lose data
    - Slice review loop: run focused validation, deep diff-review plus architecture standards, fix findings, rerun normal diff-review until clean, and record Slice 2B
    - Post-implementation review: check direct delete bypasses are removed or safely constrained
    - Spec drift check: update upstream artifacts before altering save-time lifecycle authority
    - _Requirements: REQ-DATA-002, REQ-DATA-003, REQ-ARCH-001_

- [x] 3. Attachment presentation
  - [x] 3.1 Implement exact files-first/images-second work-item attachment rows
    - Status: completed
    - Depends on: 2.2
    - Likely areas: `components/app/screens/work-item-attachments.tsx`, `components/app/screens/work-item-detail-screen.tsx`, `components/app/rich-text-content.tsx`, `lib/rich-text/extensions.ts`, `tests/components/work-item-attachments.test.tsx`
    - Validation: file/image/mixed/empty rows, portrait/landscape, overflow, preview, permission/remove, and no-editor-download tests plus browser smoke
    - Exit criteria: exact two-row contract and safe remove wiring are visible in work-item detail
    - Rollback impact: presentation may roll back without changing safe attachment lifecycle
    - Blocking unknowns: none
    - Pre-implementation context check: review DES-003, DES-004, REQ-FUNC-002, current preview patterns, and tests
    - Invariant-transfer and candidate-acquisition check: verify rendered rows derive only from authorized work-item attachments
    - Test creation review: prove exact row order, omission, aspect, and no-download behavior
    - Slice review loop: run focused validation/browser smoke, deep diff-review plus architecture standards, fix findings, rerun normal diff-review until clean, and record Slice 3
    - Post-implementation review: inspect shared rich-text presentation regressions
    - Spec drift check: update upstream artifacts if UX requires changing the exact row contract
    - _Requirements: REQ-FUNC-002, REQ-DATA-002, REQ-ARCH-001_

- [x] 4. Work-item detail and control consistency
  - [x] 4.1 Add detail-only child ID show/hide and nowrap rendering
    - Status: completed
    - Depends on: none
    - Likely areas: `components/app/screens/work-item-detail-screen.tsx`, `components/app/screens/work-surface-controls.tsx`, `lib/domain/viewer-view-config.ts`, `tests/components/work-item-detail-screen.test.tsx`
    - Validation: main/sidebar child rows, ID enabled/disabled, nowrap class, persistence, and list/board isolation tests plus browser smoke
    - Exit criteria: detail child property menu controls ID visibility and every visible child ID stays on one line
    - Rollback impact: viewer config may retain ignored `id`; other surfaces remain unchanged
    - Blocking unknowns: none
    - Pre-implementation context check: review DES-005, REQ-FUNC-003, detail subitem view keys/defaults, popover behavior, and tests
    - Invariant-transfer and candidate-acquisition check: prove preference is scoped only to work-detail subitems and admitted child rows
    - Test creation review: prove no list/board display-property mutation and both detail locations obey the preference
    - Slice review loop: run focused validation/browser smoke, deep diff-review plus architecture standards, fix findings, rerun normal diff-review until clean, and record Slice 4A
    - Post-implementation review: check narrow sidebar and long identifier behavior
    - Spec drift check: update upstream artifacts before introducing a global display-property change
    - _Requirements: REQ-FUNC-003, REQ-ARCH-001_

  - [x] 4.2 Replace Create Work Item description with compact TipTap
    - Status: completed
    - Depends on: 2.1
    - Likely areas: `components/app/screens/create-work-item-dialog.tsx`, `components/app/rich-text-editor.tsx`, `tests/components/create-dialogs.test.tsx`
    - Validation: formatted/empty submit, validation, keyboard submit, autofocus, reopen/reset, and no-upload tests plus browser smoke
    - Exit criteria: Create Work Item persists sanitized TipTap HTML without modal regressions
    - Rollback impact: textarea can return only if sanitized content compatibility remains
    - Blocking unknowns: none
    - Pre-implementation context check: review DES-006, REQ-FUNC-004, create-dialog state and rich-text patterns
    - Invariant-transfer and candidate-acquisition check: verify sanitized editor output is the only admitted description payload
    - Test creation review: prove behavior and no stale/modal/upload regressions
    - Slice review loop: run focused validation/browser smoke, deep diff-review plus architecture standards, fix findings, rerun normal diff-review until clean, and record Slice 4B
    - Post-implementation review: inspect dialog focus and keyboard interactions
    - Spec drift check: update upstream artifacts before enabling pre-create attachments
    - _Requirements: REQ-FUNC-004, REQ-DATA-001, REQ-ARCH-001_

  - [x] 4.3 Standardize relevant work-view Reset controls
    - Status: completed
    - Depends on: none
    - Likely areas: `components/app/screens/work-surface.tsx`, `components/app/screens.tsx`, `components/app/screens/directory-controls.tsx`, `tests/components/work-surface.test.tsx`, `tests/components/directory-controls.test.tsx`
    - Validation: icon, ghost/borderless class, accessible compact variant, action, and unrelated-reset exclusion tests plus browser smoke
    - Exit criteria: relevant Reset actions use one consistent presentation without behavior changes
    - Rollback impact: presentation-only rollback
    - Blocking unknowns: none
    - Pre-implementation context check: review DES-006, REQ-FUNC-004, actual Reset callers, and shared button patterns
    - Invariant-transfer and candidate-acquisition check: not applicable; presentation-only local controls
    - Test creation review: prove only intended work-view reset actions change
    - Slice review loop: run focused validation/browser smoke, deep diff-review plus architecture standards, fix findings, rerun normal diff-review until clean, and record Slice 4C
    - Post-implementation review: inspect accessibility and unrelated reset concepts
    - Spec drift check: update upstream artifacts if the caller audit changes scope
    - _Requirements: REQ-FUNC-004, REQ-ARCH-001_

- [x] 5. Invite-only onboarding and TeamSpace invites
  - [x] 5.1 Disable public workspace creation end to end
    - Status: completed
    - Depends on: none
    - Likely areas: `app/onboarding/page.tsx`, removed public workspace-creation UI, `app/api/workspaces/route.ts`, `convex/app.ts`, `convex/app/workspace_team_handlers.ts`, `scripts/bootstrap-app-workspace.mjs`, `tests/app/root-pages.test.tsx`, `tests/app/api/workspace-profile-route-contracts.test.ts`
    - Validation: UI absence, API/direct-handler denial, invite join, existing workspace, no-code state, bootstrap, and browser tests
    - Exit criteria: public creation is non-bypassably disabled and controlled bootstrap/join flows work
    - Rollback impact: do not accidentally re-enable public creation
    - Blocking unknowns: none
    - Pre-implementation context check: review DES-001, DES-007, DES-012, REQ-SEC-001, auth/onboarding routes, and bootstrap tests
    - Invariant-transfer and candidate-acquisition check: prove every public creation entry is denied while authorized joins/bootstrap remain admitted
    - Test creation review: include old-client/direct-call and redirect-loop negatives
    - Slice review loop: run focused validation/browser smoke, deep diff-review plus architecture standards, fix findings, rerun normal diff-review until clean, and record Slice 5A
    - Post-implementation review: inspect docs and all creation bypasses
    - Spec drift check: update upstream artifacts before changing the invite-only policy
    - _Requirements: REQ-SEC-001, REQ-ARCH-001_

  - [x] 5.2 Add canonical TeamSpace invite links with permanent rotation invalidation
    - Status: completed
    - Depends on: 5.1
    - Likely areas: `components/app/settings-screens/team-editor-fields.tsx`, `components/app/settings-screens/create-team-screen.tsx`, `components/app/settings-screens/team-settings-screen.tsx`, `app/onboarding/page.tsx`, `app/api/teams/lookup/route.ts`, `app/api/teams/join/route.ts`, `tests/app/api/team-join-code-route.test.ts`
    - Validation: origin/encoding, copy, permissions, signed-in/out auth preservation, lookup/join, rotation, stale-client, and browser tests
    - Exit criteria: current-code links work and every old link fails immediately after rotation
    - Rollback impact: raw current code remains usable; never retain historical-code fallback
    - Blocking unknowns: none
    - Pre-implementation context check: review DES-008, REQ-SEC-002, join-code normalization/lookup/cache paths, and tests
    - Invariant-transfer and candidate-acquisition check: validate join candidates only against current normalized code at lookup and join boundaries
    - Test creation review: prove no alias, grace, redirect, cache, or historical lookup can revive old links
    - Slice review loop: run focused validation/browser smoke, deep diff-review plus architecture standards, fix findings, rerun normal diff-review until clean, and record Slice 5B
    - Post-implementation review: inspect unauthorized code/link disclosure and redirect preservation
    - Spec drift check: update upstream artifacts before introducing any alternate invite credential
    - _Requirements: REQ-SEC-002, REQ-ARCH-001_

- [x] 6. Edit intent and legacy compatibility
  - [x] 6.1 Add and consume explicit right-click edit intent
    - Status: completed
    - Depends on: none
    - Likely areas: `components/app/screens/work-surface-view.tsx`, `components/app/screens/work-item-menus.tsx`, `components/app/screens/work-item-detail-screen.tsx`, `tests/components/work-surface-view.test.tsx`, `tests/components/work-item-detail-screen.test.tsx`
    - Validation: list/board Edit, Open, intent consumption, permission, lease contention, refresh/back, and browser tests
    - Exit criteria: right-click Edit reliably opens edit state once; Open remains read-only
    - Rollback impact: Edit may be disabled; do not map it silently back to Open
    - Blocking unknowns: none
    - Pre-implementation context check: review DES-009, REQ-FUNC-005, routing/history/lease code, and tests
    - Invariant-transfer and candidate-acquisition check: prove item, permission, repair, and lease are admitted before edit state
    - Test creation review: prove failure remains read-only and intent cannot repeatedly claim
    - Slice review loop: run focused validation/browser smoke, deep diff-review plus architecture standards, fix findings, rerun normal diff-review until clean, and record Slice 6A
    - Post-implementation review: inspect route/hash/history interactions
    - Spec drift check: update upstream artifacts before changing intent semantics
    - _Requirements: REQ-FUNC-005, REQ-ARCH-001_

  - [x] 6.2 Repair legacy description state while preserving real conflicts
    - Status: completed
    - Depends on: 6.1
    - Likely areas: `convex/app/work_item_handlers.ts`, `convex/app/document_handlers.ts`, `convex/app/maintenance.ts`, `lib/store/app-store-internal/slices/work-document-actions.ts`, `tests/convex/work-item-handlers.test.ts`
    - Validation: missing doc/timestamp, repeated repair, repaired save, genuine conflicts, lease ownership, bounded restart, and observability tests
    - Exit criteria: legacy items edit/save normally and genuine CAS/lease conflicts remain enforced
    - Rollback impact: stop backfill/lazy repair without deleting repaired valid data
    - Blocking unknowns: none
    - Pre-implementation context check: review DES-010, DES-012, REQ-DATA-003, current version/lease handlers, and tests
    - Invariant-transfer and candidate-acquisition check: validate authoritative versions after repair before admitting save
    - Test creation review: distinguish legacy compatibility from genuine concurrency
    - Slice review loop: run focused validation, deep diff-review plus architecture standards, fix findings, rerun normal diff-review until clean, and record Slice 6B
    - Post-implementation review: inspect repair access, bounds, retries, and logs
    - Spec drift check: update upstream artifacts before weakening any conflict rule
    - _Requirements: REQ-DATA-003, REQ-FUNC-005, REQ-NFR-001, REQ-ARCH-001_

- [x] 7. Optional privacy-safe TeamSpace dashboards
  - [x] 7.1 Add normalized dashboard feature and force community off
    - Status: completed
    - Depends on: none
    - Likely areas: `lib/domain/types-internal/primitives.ts`, `lib/domain/types-internal/work.ts`, `convex/validators.ts`, `convex/app/normalization.ts`, `convex/app/workspace_team_handlers.ts`, `components/app/settings-screens/create-team-screen.tsx`, `components/app/settings-screens/team-settings-screen.tsx`, `tests/convex/workspace-team-handlers.test.ts`
    - Validation: defaults, old records, create/update, community bypass, forms, fixtures, and read-model tests
    - Exit criteria: dashboard feature propagates everywhere and community TeamSpaces cannot enable it
    - Rollback impact: keep additive feature compatibility and default behavior explicit
    - Blocking unknowns: none
    - Pre-implementation context check: review DES-011, DES-012, REQ-DATA-004, feature normalization/handlers/forms, and tests
    - Invariant-transfer and candidate-acquisition check: normalize and validate every admitted TeamSpace feature payload at authoritative boundaries
    - Test creation review: prove community bypass attempts fail and old records normalize
    - Slice review loop: run focused validation/browser smoke, deep diff-review plus architecture standards, fix findings, rerun normal diff-review until clean, and record Slice 7A
    - Post-implementation review: inspect fixtures/read models/desktop compatibility
    - Spec drift check: update upstream artifacts before changing compatibility defaults
    - _Requirements: REQ-DATA-004, REQ-ARCH-001_

  - [x] 7.2 Guard dashboard routes/navigation and exclude private data
    - Status: completed
    - Depends on: 7.1
    - Likely areas: `components/app/shell.tsx`, `app/(workspace)/team/[teamSlug]/dashboard/page.tsx`, `components/app/screens/team-dashboard-screen.tsx`, `lib/domain/selectors-internal/team-dashboard.ts`, `components/app/settings-screens/utils.ts`, `tests/lib/domain/team-dashboard.test.ts`, `tests/desktop/desktop-route.test.tsx`
    - Validation: enabled/disabled/community links/routes/fallback, private malformed records/activity, desktop, and browser tests
    - Exit criteria: disabled dashboards are inaccessible and no private source contributes to dashboard outputs
    - Rollback impact: hide/deny dashboard while preserving data
    - Blocking unknowns: none; select and record deterministic fallback from existing enabled-surface patterns
    - Pre-implementation context check: review DES-011, REQ-DATA-004, REQ-PRIV-001, navigation/routes/selectors/activity/read models, and tests
    - Invariant-transfer and candidate-acquisition check: validate source records before metrics, secondary ids, counts, lists, or activity derivation
    - Test creation review: prove malformed legacy private data cannot contribute indirectly
    - Slice review loop: run focused validation/browser smoke, deep diff-review plus architecture standards, fix findings, rerun normal diff-review until clean, and record Slice 7B
    - Post-implementation review: inspect direct URLs, desktop, retained read models, and private-derived outputs
    - Spec drift check: update upstream artifacts before changing dashboard admission/fallback semantics
    - _Requirements: REQ-DATA-004, REQ-PRIV-001, REQ-ARCH-001_

- [x] 8. Whole-worktree review
  - [x] 8.1 Run and remediate complete local-worktree deep review until clean
    - Status: completed
    - Depends on: 1.1, 2.1, 2.2, 3.1, 4.1, 4.2, 4.3, 5.1, 5.2, 6.1, 6.2, 7.1, 7.2
    - Likely areas: `.spec/work-item-teamspace-reliability/reviews.md`, `.reviews`, complete local git diff
    - Validation: deep correctness/security/privacy/data-loss pass, deep architecture/maintainability pass, focused reruns after fixes, normal reviews until clean
    - Exit criteria: no actionable whole-worktree finding remains
    - Rollback impact: release is blocked until clean
    - Blocking unknowns: none
    - Pre-implementation context check: review original request, all DES/REQ/tasks/reviews, complete diff, and unrelated user-owned files
    - Invariant-transfer and candidate-acquisition check: re-audit every moved owner, admitted candidate, and derived output across slice interactions
    - Test creation review: audit that tests prove all positive/negative/compatibility/rollback requirements
    - Slice review loop: deep-review whole tree, fix by coherent owner group, normal-review until clean, rerun deep review, and repeat
    - Post-implementation review: record final whole-tree findings/fixes and residual risks
    - Spec drift check: update upstream artifacts before accepting any implementation deviation
    - _Requirements: REQ-ARCH-001, REQ-QUAL-001_

- [x] 9. Fallow remediation
  - [x] 9.1 Run Fallow inventories and remediate change-set findings
    - Status: completed
    - Depends on: 8.1
    - Likely areas: `.fallowrc.json`, `package.json`, `.github/workflows/ci.yml`, `.spec/work-item-teamspace-reliability/reviews.md`, changed source/tests
    - Validation: `pnpm test:coverage`, `pnpm fallow:gate`, full dead-code/duplication and production/full coverage-aware health inventories, CI parity, stale-evidence review
    - Exit criteria: configured gates pass except documented unrelated user-owned blockers; no change-set dead code/duplication/health regression remains
    - Rollback impact: no policy loosening; revert unsafe cleanup instead
    - Blocking unknowns: unrelated user-owned untracked duplicate files currently block the local dead-code gate
    - Pre-implementation context check: review DES-013, REQ-QUAL-001, Fallow skill/config/audit history, and current worktree ownership
    - Invariant-transfer and candidate-acquisition check: ensure cleanup preserves capability owners and behavior; no generic extraction bypass
    - Test creation review: refresh coverage and focused tests for every cleanup grouping
    - Slice review loop: remediate by owner group, focused validate, deep-review plus architecture standards, fix, and normal-review until clean before next group
    - Post-implementation review: record gate/advisory modes, commands, HEAD/date, results, accepted debt, owner, and revisit trigger
    - Spec drift check: update upstream artifacts before accepting analyzer debt caused by this work
    - _Requirements: REQ-QUAL-001, REQ-ARCH-001_

- [ ] 10. Final gates and release
  - [x] 10.1 Run final whole-worktree deep review and release gates
    - Status: completed
    - Depends on: 9.1
    - Likely areas: `.spec/work-item-teamspace-reliability`, complete local git diff, changed tests, release scripts
    - Validation: final deep review loop, targeted tests, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm desktop:smoke`, `pnpm fallow:gate`, spec lint/refs/traceability/drift, `git diff --check`, browser smoke
    - Exit criteria: no actionable finding or failing release gate remains
    - Rollback impact: block release
    - Blocking unknowns: unrelated user-owned Fallow blockers must be resolved by owner or explicitly accepted before release
    - Pre-implementation context check: review all spec/review artifacts, complete diff, and deployment prerequisites
    - Invariant-transfer and candidate-acquisition check: final audit of every boundary, candidate, derived output, compatibility path, and bypass
    - Test creation review: confirm complete requirement and negative-case coverage
    - Slice review loop: run final deep whole-tree review, fix, normal-review until clean, rerun deep review until clean
    - Post-implementation review: record final all-clear evidence and residual risk
    - Spec drift check: no release with unrecorded drift
    - _Requirements: REQ-ARCH-001, REQ-QUAL-001, REQ-OPS-001_

  - [ ] 10.2 Deploy Convex, PartyKit, Vercel, then trigger desktop release
    - Status: in-progress
    - Depends on: 10.1
    - Likely areas: `package.json`, `.github/workflows/desktop-release.yml`, `scripts/desktop-release-preflight.mjs`, `.spec/work-item-teamspace-reliability/reviews.md`
    - Validation: `pnpm convex:deploy:prod`, bounded repair/backfill verification, `pnpm partykit:deploy:prod`, `vercel --prod`, production smoke/logs, `gh workflow run desktop-release.yml -f version=<package-version>`, `gh run watch`, signed artifact/release verification
    - Exit criteria: all production services verify healthy and stable macOS/Windows desktop release publishes
    - Rollback impact: stop sequence on failure and use service-specific rollback while preserving compatible data
    - Blocking unknowns: authenticated CLIs, required production credentials, and selected stable release version
    - Pre-implementation context check: review DES-014, REQ-OPS-001, release commit/version, mixed-version compatibility, migration readiness, and rollback points
    - Invariant-transfer and candidate-acquisition check: verify deployed backend contracts before admitting dependent web/desktop clients
    - Test creation review: not applicable; release uses completed gates and operational verification
    - Slice review loop: review deployment evidence after each stage and stop/fix/re-review on any finding
    - Post-implementation review: record URLs, deploy ids, logs, workflow run, artifacts, and release result
    - Spec drift check: update release plan before deviating from ordered deployment
    - _Requirements: REQ-NFR-001, REQ-OPS-001, REQ-ARCH-001_

## Post-Deploy Verification
- Verify bulk actions, attachments including Cancel/remove, child ID show/hide/nowrap, Create Work Item TipTap, Reset controls, onboarding, invite rotation, right-click Edit, legacy item save, dashboard toggle/direct route/private exclusion.
- Watch Convex and PartyKit errors, Vercel deployment health, and desktop workflow/release artifacts.
- Abort or roll back on partial bulk writes, attachment loss, private data, old invite link success, false legacy conflicts, or runtime incompatibility.

## Traceability Matrix
- REQ-FUNC-001 -> 1.1
- REQ-DATA-001 -> 2.1, 4.2
- REQ-DATA-002 -> 2.2, 3.1
- REQ-FUNC-002 -> 3.1
- REQ-FUNC-003 -> 4.1
- REQ-FUNC-004 -> 4.2, 4.3
- REQ-SEC-001 -> 5.1
- REQ-SEC-002 -> 5.2
- REQ-FUNC-005 -> 6.1, 6.2
- REQ-DATA-003 -> 2.2, 6.2
- REQ-DATA-004 -> 7.1, 7.2
- REQ-PRIV-001 -> 7.2
- REQ-NFR-001 -> 1.1, 6.2, 10.2
- REQ-ARCH-001 -> 1.1 through 10.2
- REQ-QUAL-001 -> 8.1, 9.1, 10.1
- REQ-OPS-001 -> 10.1, 10.2

## Coverage Checklist
- Every requirement maps to a leaf task.
- Every leaf task includes exact skill-required review fields and an architecture-aware deep review loop.
- Risky changes include positive, negative, permission, compatibility, rollback, and browser/operational verification.
- Fallow gate/advisory distinction and unrelated accepted debt are explicit.
