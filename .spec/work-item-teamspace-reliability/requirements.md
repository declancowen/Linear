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

# Requirements Document: Work Item And TeamSpace Reliability

## Source Artifacts
- `.spec/work-item-teamspace-reliability/design.md`

## Scope Statement
- This requirement set governs every product, architecture, quality, and release outcome in the audited plan.

## Upstream Alignment Audit
- Original plan requirements reviewed: all user messages, including invite rotation and detail child ID follow-ups.
- Design decisions reviewed: DES-001 through DES-014.
- Repository evidence and current tests reviewed: architecture/diff preflights and 267-test baseline.
- Architecture standards implications reviewed: authoritative ownership, non-bypassability, compatibility, admission control, and fitness functions.
- Requirements added, changed, or rejected during audit: added detail-only child ID control and permanent old-link invalidation; none rejected.
- Design updates required before continuing: completed.
- Agent judgment or justified architecture-standard deviations: none.
- Post-requirements audit outcome: complete; no new requirement found on final pass.

## Cross-Cutting Coverage
- Security: REQ-SEC-001, REQ-SEC-002.
- Privacy: REQ-PRIV-001.
- Performance: REQ-NFR-001.
- Resilience: REQ-FUNC-001, REQ-DATA-002, REQ-DATA-003.
- Migration: REQ-DATA-001, REQ-DATA-003, REQ-DATA-004.
- Architecture transition: REQ-ARCH-001.
- Observability: REQ-OPS-001.
- Supportability: REQ-OPS-001, REQ-QUAL-001.
- Backward compatibility: REQ-DATA-001, REQ-DATA-003, REQ-DATA-004.

## Requirements

### REQ-FUNC-001: Atomic Bulk Work-Item Actions
Source Design Decisions:
- DES-001
- DES-002

Priority: Critical

Rationale:
- Looped writes partially fail and appear undone.

Requirement:
- THE system SHALL execute bulk built-in property, custom select/multi-select property, and delete actions as bounded, authorized, all-or-none commands over the captured visible selection.

Verification Method:
- Store, API, Convex, component, and failure-injection tests.

Risk if Unmet:
- Partial durable updates and user distrust.

Acceptance Criteria
1. WHEN all targets are valid, THEN one command updates all targets and produces one client outcome.
2. WHEN any target is invalid, stale, unauthorized, hidden, private-incompatible, mixed-scope, or oversized, THEN no target is durably changed.
3. WHEN project cascade confirmation is required, THEN it completes before the command.
4. WHEN a bulk command is pending, THEN the client SHALL retain the last authoritative state until the command succeeds and reconciliation begins.

Negative Cases
1. WHEN a command fails, THEN the client SHALL NOT retain partial optimistic state.
2. WHEN a target was not captured from rendered selection, THEN it SHALL NOT be mutated.

### REQ-DATA-001: Stable Attachment Identity
Source Design Decisions:
- DES-003
- DES-012

Priority: Critical

Rationale:
- Backend lifecycle cannot safely follow rich-text nodes without stable identity.

Requirement:
- THE system SHALL preserve validated attachment ids through upload, TipTap HTML, sanitization, canonicalization, parsing, and rendering while remaining compatible with legacy nodes.

Verification Method:
- Contract, sanitizer, parser, canonicalization, and compatibility tests.

Risk if Unmet:
- Wrong attachment deletion or orphaned data.

Acceptance Criteria
1. WHEN a new attachment is uploaded, THEN its embedded node contains its backend id.
2. WHEN safe content round-trips, THEN the id remains.
3. WHEN legacy content lacks an id, THEN it remains renderable.

Negative Cases
1. WHEN metadata is malformed, THEN it is stripped or rejected.

### REQ-DATA-002: Draft-Safe Reference-Safe Attachment Removal
Source Design Decisions:
- DES-003

Priority: Critical

Rationale:
- Immediate deletion can make Cancel restore broken content and can delete referenced storage.

Requirement:
- THE system SHALL remove embedded nodes locally during editing and reconcile backend attachment records only during authoritative save after checking all remaining work-item-owned references and storage references.

Verification Method:
- Editor, store, Convex, cleanup, failure, and compatibility tests.

Risk if Unmet:
- Data loss.

Acceptance Criteria
1. WHEN Backspace/Delete removes an embedded node, THEN backend data remains until Save.
2. WHEN Cancel is used, THEN backend data and original content remain.
3. WHEN Save removes the last valid reference, THEN the attachment record and unreferenced storage are deleted.
4. WHEN comments or other attachment records still reference content/storage, THEN they remain.

Negative Cases
1. WHEN a legacy URL match is ambiguous, THEN the system SHALL retain it rather than guess.
2. WHEN save conflicts or fails, THEN backend attachment deletion SHALL NOT commit.

### REQ-FUNC-002: Exact Work-Item Attachment Presentation
Source Design Decisions:
- DES-004

Priority: High

Rationale:
- The current mixed row does not match the requested workflow.

Requirement:
- THE work-item detail SHALL render optional horizontal files-first and images-second rows, authorized remove controls, equal-height aspect-preserving image previews, and no download controls inside description embeds.

Verification Method:
- Component and browser tests.

Risk if Unmet:
- Inconsistent and unusable attachment experience.

Acceptance Criteria
1. WHEN both types exist, THEN files are row one and images row two.
2. WHEN a row is empty, THEN it is omitted.
3. WHEN an image is portrait or landscape, THEN height is consistent and aspect ratio preserved.

Negative Cases
1. WHEN content renders in the editor/read-only description, THEN no attachment download control appears.

### REQ-FUNC-003: Detail Child ID Visibility And No-Wrap
Source Design Decisions:
- DES-005

Priority: High

Rationale:
- Child IDs wrap and viewers cannot hide them in work-item detail.

Requirement:
- THE work-item-detail child/subitem property menu SHALL provide a detail-only ID show/hide option, and every visible child ID SHALL render on one non-wrapping line.

Verification Method:
- Component, viewer-config persistence, isolation, and browser tests.

Risk if Unmet:
- Poor readability and unwanted identifiers.

Acceptance Criteria
1. WHEN ID is enabled in the detail child property menu, THEN child rows in main detail and sidebar sections show a nowrap ID.
2. WHEN ID is disabled, THEN those child rows omit the ID.
3. WHEN the preference changes, THEN it persists under the work-detail subitems viewer config.

Negative Cases
1. WHEN the detail preference changes, THEN list/board display properties SHALL NOT change.

### REQ-FUNC-004: Create Work Item TipTap And Reset Consistency
Source Design Decisions:
- DES-006

Priority: High

Rationale:
- Create description and Reset controls are inconsistent with established patterns.

Requirement:
- THE Create Work Item description SHALL use compact TipTap without pre-create attachment uploads, and relevant work-view Reset controls SHALL be borderless reset-icon controls with accessible labels.

Verification Method:
- Component and browser tests.

Risk if Unmet:
- Inconsistent editor and control behavior.

Acceptance Criteria
1. WHEN rich text is submitted, THEN sanitized canonical HTML persists.
2. WHEN the create modal reopens, THEN stale description state is absent.
3. WHEN a relevant Reset appears, THEN it uses the standardized visual/accessibility contract.

Negative Cases
1. WHEN in Create Work Item, THEN attachment upload SHALL NOT be available.
2. WHEN a reset is unrelated to work views, THEN it SHALL NOT be restyled by this requirement.

### REQ-SEC-001: Invite-Only Workspace Creation
Source Design Decisions:
- DES-001
- DES-007
- DES-012

Priority: Critical

Rationale:
- Hiding the form alone is bypassable.

Requirement:
- THE system SHALL remove public workspace creation from onboarding and deny public API and Convex creation attempts while retaining controlled bootstrap creation and invite/join flows.

Verification Method:
- UI, API, direct-handler, bootstrap, and browser tests.

Risk if Unmet:
- Unauthorized workspace creation.

Acceptance Criteria
1. WHEN a new user has no workspace, THEN no creation form is shown.
2. WHEN an old client or direct caller attempts public creation, THEN a stable denial is returned.
3. WHEN a valid invite/code is present, THEN onboarding can continue.

Negative Cases
1. WHEN creation is denied publicly, THEN `scripts/bootstrap-app-workspace.mjs` SHALL remain usable by operators.

### REQ-SEC-002: TeamSpace Invite Links And Rotation
Source Design Decisions:
- DES-008

Priority: Critical

Rationale:
- Invite links must reuse current join-code authority and revoke cleanly.

Requirement:
- THE system SHALL provide authorized canonical TeamSpace invite URLs tied only to the current join code, preserve that code through auth, and immediately and permanently reject every old URL after code rotation.

Verification Method:
- URL builder, permissions, lookup/join, stale-client, and browser tests.

Risk if Unmet:
- Revoked invite links continue granting access.

Acceptance Criteria
1. WHEN an authorized manager copies an invite URL, THEN it contains the current code through the canonical join route.
2. WHEN the code is rotated, THEN old-link lookup and join fail immediately and the new link works.
3. WHEN signed-out users authenticate, THEN the current code is preserved.

Negative Cases
1. WHEN an old URL is used, THEN no alias, grace period, redirect, cache, or historical-code lookup SHALL resolve it.
2. WHEN a user lacks management permission, THEN invite-management controls SHALL NOT be exposed.

### REQ-FUNC-005: Explicit Right-Click Edit
Source Design Decisions:
- DES-009

Priority: High

Rationale:
- Edit currently behaves like Open.

Requirement:
- THE system SHALL make right-click Edit from list and board consume a one-use edit intent after permission and Convex edit-lease acquisition, while Open remains read-only.

Verification Method:
- Route, component, lease, and browser tests.

Risk if Unmet:
- Users cannot reliably enter edit state or repeatedly claim leases.

Acceptance Criteria
1. WHEN Edit succeeds, THEN detail opens in edit state and the intent is consumed.
2. WHEN Open is used, THEN detail remains read-only.

Negative Cases
1. WHEN permission, repair, or lease acquisition fails, THEN detail remains read-only with feedback.

### REQ-DATA-003: Legacy Work-Item Edit Repair
Source Design Decisions:
- DES-010
- DES-012

Priority: Critical

Rationale:
- Legacy shape causes false conflicts after the lease migration.

Requirement:
- THE system SHALL idempotently repair missing legacy description documents/version metadata before edit/save without weakening genuine CAS conflicts or edit leases.

Verification Method:
- Convex handler, maintenance/backfill, conflict, and retry tests.

Risk if Unmet:
- Legacy items remain uneditable or real concurrent writes overwrite data.

Acceptance Criteria
1. WHEN a legacy item lacks description state, THEN repair creates valid authoritative state and save succeeds.
2. WHEN repair repeats, THEN it remains safe.
3. WHEN a genuine concurrent change exists, THEN a typed conflict is returned.

Negative Cases
1. WHEN another editor owns the lease, THEN repair SHALL NOT grant edit access.

### REQ-DATA-004: Optional TeamSpace Dashboard Feature
Source Design Decisions:
- DES-011
- DES-012

Priority: High

Rationale:
- Dashboards must be configurable and community TeamSpaces must not receive them.

Requirement:
- THE system SHALL normalize `dashboard` across TeamSpace feature contracts, default existing non-community TeamSpaces on, force community TeamSpaces off, hide disabled navigation, and guard direct routes without deleting data.

Verification Method:
- Domain, schema, handler, settings/create, route, desktop, and compatibility tests.

Risk if Unmet:
- Feature bypass and inconsistent routing.

Acceptance Criteria
1. WHEN a non-community TeamSpace is created/edited, THEN dashboard can be toggled.
2. WHEN a community TeamSpace is created/edited, THEN dashboard is forced off and no option appears.
3. WHEN disabled, THEN no sidebar link appears and direct route uses the deterministic fallback/unavailable behavior.

Negative Cases
1. WHEN dashboard is disabled, THEN underlying work data SHALL NOT be deleted.

### REQ-PRIV-001: Dashboard Private-Data Exclusion
Source Design Decisions:
- DES-001
- DES-011

Priority: Critical

Rationale:
- Legacy malformed private tasks can otherwise leak.

Requirement:
- THE dashboard admission rule SHALL exclude every private work item and private-derived activity regardless of malformed TeamSpace association.

Verification Method:
- Domain selector, read-model, component, and negative privacy tests.

Risk if Unmet:
- Privacy incident.

Acceptance Criteria
1. WHEN a private item has an invalid legacy TeamSpace id, THEN it is absent from all dashboard metrics/lists/activity.

Negative Cases
1. WHEN any dashboard output is derived, THEN private source records SHALL NOT contribute secondary ids, counts, or activity.

### REQ-NFR-001: Bounded Performance And Reliability
Source Design Decisions:
- DES-002
- DES-010
- DES-014

Priority: High

Rationale:
- New commands and repair work must remain bounded.

Requirement:
- THE system SHALL use one bulk network command, an explicit transaction-safe target maximum, bounded restartable repair batches, and sequential verified deployment.

Target Metrics:
- Zero per-target bulk network loops; zero partial bulk success; explicit finite bulk and repair batch limits.

Verification Method:
- Static contract tests, integration tests, and operational verification.

Risk if Unmet:
- Timeouts, partial behavior, or unsafe rollout.

Acceptance Criteria
1. WHEN bulk or repair exceeds its bound, THEN it fails before partial writes.

Negative Cases
1. WHEN deployment verification fails, THEN later release stages SHALL NOT run.

### REQ-ARCH-001: Architecture And Deep Review Enforcement
Source Design Decisions:
- DES-001
- DES-013

Priority: Critical

Rationale:
- Cross-boundary changes need repeated architecture-aware review.

Requirement:
- THE implementation SHALL apply architecture standards before each slice, deep dual-pass diff review after each slice, fix and normal-review loops until clean, a whole-worktree deep review, Fallow remediation, and a final whole-worktree deep review.

Verification Method:
- `.spec/work-item-teamspace-reliability/reviews.md` and review preflight evidence.

Risk if Unmet:
- Boundary bypasses and cross-slice regressions survive.

Acceptance Criteria
1. WHEN a slice completes, THEN its review ledger records evidence and no actionable findings.
2. WHEN the feature diff completes, THEN whole-tree review and Fallow loops complete before release.

Negative Cases
1. WHEN actionable findings remain, THEN the next slice or release SHALL NOT proceed.

### REQ-QUAL-001: Fallow Quality Gate
Source Design Decisions:
- DES-013

Priority: High

Rationale:
- Dead code, duplication, and complexity must not be introduced or hidden.

Requirement:
- THE implementation SHALL distinguish the configured blocking Fallow gate from full advisory inventories, fix change-set findings without suppression/threshold loosening, and document unrelated accepted debt.

Verification Method:
- Fallow commands, CI parity review, and review ledger.

Risk if Unmet:
- False clean conclusions and permanent transition debt.

Acceptance Criteria
1. WHEN Fallow evidence is used, THEN command, HEAD, date, mode, result, gate/advisory status, and accepted debt are recorded.
2. WHEN this change introduces a finding, THEN it is fixed and deep-reviewed.

Negative Cases
1. WHEN unrelated user-owned files cause findings, THEN they SHALL NOT be silently modified or described as this change's debt.

### REQ-OPS-001: Production Deployment And Desktop Release
Source Design Decisions:
- DES-014

Priority: Critical

Rationale:
- Compatible backend, collaboration, web, and desktop releases must be coordinated.

Requirement:
- THE release SHALL pass all final gates, then deploy Convex production, PartyKit production, Vercel production, and finally trigger/monitor `.github/workflows/desktop-release.yml`.

Verification Method:
- CLI output, production smoke, logs, GitHub workflow and release artifacts.

Risk if Unmet:
- Production incompatibility or broken desktop release.

Acceptance Criteria
1. WHEN each service verifies healthy, THEN the next stage may begin.
2. WHEN desktop release runs, THEN stable package version matches and signed macOS/Windows artifacts publish.

Negative Cases
1. WHEN any stage fails verification, THEN release SHALL stop before the next stage.

## Traceability Matrix
- DES-001 -> REQ-FUNC-001, REQ-SEC-001, REQ-PRIV-001, REQ-ARCH-001
- DES-002 -> REQ-FUNC-001, REQ-NFR-001
- DES-003 -> REQ-DATA-001, REQ-DATA-002
- DES-004 -> REQ-FUNC-002
- DES-005 -> REQ-FUNC-003
- DES-006 -> REQ-FUNC-004
- DES-007 -> REQ-SEC-001
- DES-008 -> REQ-SEC-002
- DES-009 -> REQ-FUNC-005
- DES-010 -> REQ-DATA-003, REQ-NFR-001
- DES-011 -> REQ-DATA-004, REQ-PRIV-001
- DES-012 -> REQ-DATA-001, REQ-DATA-003, REQ-DATA-004, REQ-SEC-001
- DES-013 -> REQ-ARCH-001, REQ-QUAL-001
- DES-014 -> REQ-NFR-001, REQ-OPS-001
