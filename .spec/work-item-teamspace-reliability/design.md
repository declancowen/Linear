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

# Design Document: Work Item And TeamSpace Reliability

## Summary
- Build reliable atomic bulk actions, reference-safe work-item attachments, detail-subitem controls, editor/reset consistency, invite-only onboarding, TeamSpace invite links, reliable edit entry, legacy edit repair, optional privacy-safe dashboards, and a verified production release. Detailed requirements are in `.spec/work-item-teamspace-reliability/requirements.md`.
- Use architecture standards during design and implementation, deep diff-review loops after every coherent slice, Fallow cleanup after the complete feature diff is clean, and one final deep review loop before deployment.

## Scope Statement
- This spec governs frontend, store, API, Convex, domain, migration, testing, review, Fallow, and release work for the audited requirements.

## Original Plan Alignment Audit
- Original plan or prompt excerpts reviewed: all user messages in this thread, including the two-row attachment clarification, invite-code rotation invalidation, and detail child-item ID requirement.
- Explicit requirements confirmed from the original plan: all requirements listed in `.spec/work-item-teamspace-reliability/requirements.md`.
- Plan items excluded or deferred, with reason: none.
- Gaps, contradictions, or stale assumptions found: UI-only workspace hiding was insufficient; looped bulk writes were unsafe; unsaved attachment deletion would cause data loss; “KitGate” is not present and maps to `.github/workflows/desktop-release.yml`.
- Upstream artifact changes required before continuing: this new spec supersedes the relevant incomplete assumptions in `.spec/workspace-surface-editor-stability`.
- Architecture standards reviewed: capability ownership, non-bypassable invariants, admission control, derived-output privacy, compatibility, migration, observability, and release fitness.
- Agent judgment or justified architecture-standard deviations: no new invite-token model; use existing TeamSpace join code.
- Post-design audit outcome: four audit passes found no unrepresented requirement.

## Repository Discovery Summary

### Repo Root
- `/Users/declancowen/Documents/GitHub/Linear`

### Repo-Specific Profile and House Patterns
- Next.js 16, React 19, Convex, Zustand, TipTap, PartyKit/Yjs, Electron, Vitest.
- UI lives under `components/app`; domain rules under `lib/domain`; authoritative writes under `convex/app`; optimistic orchestration under `lib/store/app-store-internal`.

### Entry Points and Execution Path
- Bulk actions: `components/app/screens/work-item-menus.tsx` -> store -> API/client -> `convex/app/work_item_handlers.ts`.
- Work-item detail: `components/app/screens/work-item-detail-screen.tsx`.
- Rich text: `components/app/rich-text-editor.tsx`, `lib/rich-text/extensions.ts`, `lib/content/rich-text-security.ts`.
- Onboarding and joins: `app/onboarding/page.tsx`, `app/(workspace)/invites/page.tsx`, `app/api/teams/join/route.ts`.
- Team settings/dashboard: `components/app/settings-screens`, `components/app/shell.tsx`, `app/(workspace)/team/[teamSlug]/dashboard/page.tsx`.

### Confirmed Code and Runtime Facts
- Bulk property actions currently loop `updateWorkItem`; bulk delete issues parallel single-item deletes; either failure path can reconcile a full snapshot and appear undone.
- Work-item attachments currently use one mixed row and direct deletion is separate from description save.
- Attachment rich-text nodes do not persist backend attachment ids.
- Create Work Item description is a textarea.
- Public workspace creation is reachable through onboarding, API, and Convex.
- TeamSpace join codes already support lookup/join and can be regenerated.
- Right-click Edit currently routes like Open.
- Missing legacy description documents fail version checks.
- Dashboard is not a TeamSpace feature and dashboard selectors do not defensively exclude malformed legacy private items.
- Work-item detail already has a detail-only child/subitem view and property popover; ID rendering can wrap.

### Related Code and Pattern Inventory
- `deleteWorkItems` was a coordinated client planner but still issued parallel single-item deletes; it must use the authoritative bulk-command pattern.
- `deleteContentReferencedAttachments` is the existing reference-safe cleanup pattern.
- `viewer-view-config` is the existing viewer-scoped display-property persistence pattern.
- Team feature normalization and community defaults already exist in `lib/domain/types-internal/work.ts`.

### Adjacent Pattern Comparison
- Preferred pattern: authoritative Convex command plus typed store/client wrapper and one client reconciliation outcome.
- The design conforms to existing delete, feature-normalization, join-code, and viewer-view-config patterns.

### Blast Radius Review
- Shared rich-text sanitizer/extensions affect documents, chats, comments, PartyKit, and desktop.
- Team feature shape affects fixtures, schemas, read models, navigation, routes, and settings.
- Workspace creation denial affects old clients and bootstrap tooling.
- Bulk commands affect transaction limits and client reconciliation.

### Recent Related Repository History
- HEAD `74e59feea` replaced work-item PartyKit collaboration with Convex edit leases.
- `.spec/workspace-surface-editor-stability` previously assumed no broad backend batch mutation; current errors invalidate that assumption.
- Existing attachment and dashboard reviews provide adjacent test patterns but do not cover these final requirements.

### Impacted Boundaries and Adjacent Systems
- Frontend, Zustand, API routes, Convex handlers, PartyKit rich-text compatibility, Vercel deployment, GitHub desktop release, and user onboarding.

### Data, Contracts, and Config Surfaces
- Bulk operation payload; attachment node HTML; attachment upload result; work-item save contract; TeamFeatureSettings; viewer detail-subitem config; workspace creation policy; invite URL builder; edit-intent URL; legacy repair/backfill.

### Existing Tests and Operational Signals
- Targeted baseline: 11 files, 267 tests passed on 2026-06-14.
- Existing component, store, API, Convex, domain, desktop, and release tests are available under `tests`.
- Package gates include `pnpm check`, desktop smoke, and Fallow scripts.

### Static Analyzer and Audit Evidence
- Architecture preflight and diff-review preflight ran at HEAD `74e59feea` on 2026-06-14.
- `pnpm fallow:gate` is the configured blocking local gate; CI Fallow is advisory because `.github/workflows/ci.yml` uses `continue-on-error`.
- Current Fallow failure is caused by eight unrelated user-owned untracked duplicate files; they must not be altered by this work and are recorded as accepted external worktree debt.

## Problem Statement and Context
- Bulk actions fail and appear undone; attachment removal is not draft-safe or backend-safe; legacy items false-conflict; private data can reach dashboards; and several requested UI/control paths are missing or inconsistent.
- Incorrect implementation can cause partial writes, attachment data loss, privacy leaks, access-policy bypass, or failed production rollout.

## Current-State Analysis
- Authority is fragmented across looped client writes, presentation-only restrictions, and incomplete compatibility handling.
- Attachment identity is not durable in rich-text markup.
- Dashboard admission is based on TeamSpace association without a defensive private-data rule.
- Detail child-item ID visibility is not viewer-configurable and its identifier can wrap.

## Target-State Architecture
- Convex owns atomic mutations, permissions, workspace creation denial, community dashboard enforcement, attachment reconciliation, and legacy repair.
- Domain owns dashboard visibility/private exclusion and detail-view derivation.
- Viewer-scoped UI config owns detail-only child ID visibility.
- Components own presentation and unsaved draft state.
- Fitness functions are authoritative negative tests, compatibility tests, deep reviews, Fallow gates, browser smoke, and post-deploy checks.

## Goals
- Eliminate partial bulk updates and false rollbacks.
- Make attachment editing safe and match the exact two-row presentation.
- Add detail-only child ID show/hide with non-wrapping IDs.
- Complete all onboarding, invite, edit, dashboard, review, cleanup, and release requirements.

## Non-Goals
- No new invite-token system, Yjs canonical migration, Convex lease replacement, broad authorization redesign, or unrelated repository complexity project.

## Confirmed Facts
- TeamSpace invite URLs will wrap existing join codes; rotating a code must invalidate old URLs.
- Attachment rows are exactly files first, image previews second.
- Public workspace creation is disabled, not merely hidden.
- The repository desktop release path is GitHub Actions.

## Assumptions
- Existing Convex transaction limits can support a bounded bulk command selected during implementation.
- Existing viewer-view configuration can represent detail-only child ID visibility without schema expansion.

## Open Questions
- None.

## Decision Needed
- None.

## Proposed Design

### Solution Overview
- Deliver capability-owned slices: atomic bulk mutation; attachment identity/reconciliation; attachment UI; detail-child ID control; TipTap/reset; onboarding/invites; edit/legacy repair; dashboards; review/Fallow/release.

### Transition Plan From Current State
- Add compatible backend contracts before dependent clients.
- Keep old rich-text and TeamSpace records readable through normalization/lazy repair.
- Remove unsafe looped bulk paths and direct destructive attachment removal after replacements are proven.
- Keep unrelated user-owned Fallow findings out of scope and documented.

### End-to-End Flow
- Bulk: capture visible ids -> validate command -> authorize all -> atomically write -> one client success/reconcile.
- Attachments: upload with id -> embed -> draft remove locally -> authoritative save reconciles safe references.
- Invite: copy URL containing current code -> auth preserves code -> lookup/join current code only -> rotation rejects old URL.
- Edit: right-click Edit adds intent -> detail loads/repairs -> lease acquired -> intent consumed -> edit opens.
- Dashboard: normalized feature admits route/link -> selector excludes private data -> surface renders.

### Component and Module Changes

#### UI or Client
- Update work-item menus/detail, attachment rows, Create Work Item, reset controls, onboarding, TeamSpace settings/create, shell, and dashboard screen.

#### API or Application Layer
- Add typed bulk capability; deny public workspace creation; expose compatible attachment/save and join-code behavior.

#### Domain or Business Logic
- Add dashboard feature/private exclusion, detail-subitem ID derivation, and deterministic disabled-dashboard fallback.

#### Data Model and Persistence
- Add attachment id metadata and dashboard feature normalization; add idempotent legacy description repair/backfill.

#### Integrations, Events, or Background Jobs
- PartyKit must preserve new rich-text attachment metadata; production release uses Convex, PartyKit, Vercel, and GitHub Actions.

#### Security and Permissions
- Authorize every bulk target, attachment removal, invite-management control, dashboard read, and edit claim at the owning boundary.

#### Performance and Scalability
- Bound bulk target count and transaction work; avoid per-item network loops; keep carousel thumbnails restrained.

#### Observability and Operations
- Distinguish bulk validation/access/conflict failures, legacy repair vs real conflict, ambiguous attachment retention, and deployment failures.

## Impacted Surfaces Matrix
- UI: work-item list/board/detail/create, onboarding, TeamSpace settings/create/sidebar/dashboard.
- API: work items, attachments, workspaces, teams lookup/join.
- Domain logic: selection, dashboard, TeamFeatureSettings, viewer view config.
- Persistence: work items, description documents, attachments, TeamSpace settings.
- Integrations: PartyKit, Vercel, GitHub Actions desktop release.
- Auth: workspace creation, TeamSpace invite management/join, edit lease.
- Infra: Convex and PartyKit production deploys.
- Telemetry: conflict/repair/reconciliation/deploy evidence.
- Tests: component, store, domain, API, Convex, desktop, browser.
- Docs: workspace creation pattern and review/release ledger.

## Change Impact Map
- Direct impact: paths named in Repository Discovery Summary and tasks.
- Indirect impact: shared rich text, scoped read models, fixtures, desktop routing.
- Unchanged but risk-adjacent areas: document/chat attachment behavior, bootstrap workspace script, single-item actions.

## Invariants and Forbidden Outcomes
- No bulk partial success, unauthorized mutation, or hidden-row mutation.
- No unsaved draft deletion of backend attachments or deletion of referenced storage.
- No old invite URL works after join-code rotation.
- No public workspace creation bypass.
- No community dashboard or private dashboard data.
- No legacy repair suppresses genuine conflicts.
- Child IDs never wrap when visible; detail-only ID visibility does not alter list/board views.

## Compatibility Matrix
- Public API: old workspace-create calls receive stable denial; additive bulk/save contracts.
- Internal API: typed store/client/server wrappers migrate callers.
- Data schema: additive/normalized attachment id and dashboard feature; lazy legacy repair.
- Events: Not applicable; no new event bus contract.
- Cache keys: invite lookup must not retain rotated codes; viewer detail config uses existing keying.
- Config: public app origin and production CLI credentials.
- External consumers: old web/desktop clients and GitHub desktop release workflow.
- Rollback compatibility: preserve additive fields and deny unsafe fallback behavior.

## Contract Examples and Before/After Payloads
- Request examples: bulk `{ targetIds, operation }`; attachment node includes `data-attachment-id`; TeamSpace features include `dashboard`.
- Response examples: one bulk result; upload returns `{ attachmentId, fileName, fileUrl }`; disabled workspace creation returns stable forbidden response.
- Event or message examples: Not applicable.
- Before/after comparisons: repeated per-item mutations become one command; invite raw code gains canonical URL; detail child ID becomes optional and nowrap.

## Cross-Cutting Applicability Matrix
- Security: covered by authoritative access and creation/invite controls.
- Privacy: covered by dashboard private-data exclusion.
- Performance: covered by bounded bulk command and restrained previews.
- Resilience: covered by atomicity, compatibility repair, rollback, and deploy aborts.
- Migration: covered by additive normalization and idempotent repair.
- Observability: covered by classified failures and review/deploy evidence.
- Supportability: covered by stable errors and review ledger.
- Backward compatibility: covered for old clients/content/TeamSpaces.

## Success Metrics and Numeric NFR Targets
- Latency targets: one bulk network command; no per-target client network loop.
- Throughput or concurrency targets: bulk target maximum must be explicit and transaction-safe before release.
- Error-rate or availability targets: zero partial bulk successes; zero private dashboard records; zero old-link joins after rotation.
- Timeout, retry, or queue-depth limits: bounded repair/backfill batches; no unbounded retries.

## Decision Register

### DES-001: Non-Bypassable Capability Ownership
- Context: current behavior relies on scattered client/UI rules.
- Current-state gap: direct and old-client bypasses exist.
- Decision: Convex/domain owners enforce durable invariants.
- Rationale: one authoritative rule per capability.
- Tradeoffs: broader backend contract work.
- Affected surfaces: all slices.
- Fitness signal: negative boundary tests and deep review.

### DES-002: Atomic Bulk Command
- Context: looped updates partially fail and reconcile badly.
- Current-state gap: no all-or-none group.
- Decision: bounded coordinated command with pessimistic client state and one authoritative reconciliation outcome.
- Rationale: removes partial durable state.
- Tradeoffs: transaction-size limit and no speculative bulk UI update while the command is pending.
- Affected surfaces: work-item menus/store/API/Convex.
- Fitness signal: partial-failure tests.

### DES-003: Draft-Safe Attachment Reconciliation
- Context: node and backend deletion are disconnected.
- Current-state gap: Cancel/data-loss and reference risks.
- Decision: stable ids and save-time reference-safe reconciliation.
- Rationale: authoritative content determines lifecycle.
- Tradeoffs: legacy ambiguity must retain data.
- Affected surfaces: rich text, attachments, work-item save.
- Fitness signal: cancel/reference/storage tests.

### DES-004: Exact Two-Row Attachment Presentation
- Context: current mixed row does not match requirement.
- Current-state gap: no remove and oversized/inconsistent previews.
- Decision: file row then image row with equal-height previews.
- Rationale: explicit user contract.
- Tradeoffs: horizontal overflow.
- Affected surfaces: work-item detail.
- Fitness signal: component/browser tests.

### DES-005: Detail-Only Child ID Control
- Context: child IDs wrap and cannot be hidden.
- Current-state gap: detail child presentation is not configurable.
- Decision: add `id` to the detail-subitem property menu and render visible IDs nowrap.
- Rationale: reuse viewer detail configuration without affecting list/board.
- Tradeoffs: one more detail property option.
- Affected surfaces: work-item detail child rows/sidebar section.
- Fitness signal: persistence, isolation, and nowrap tests.

### DES-006: TipTap And Reset Consistency
- Context: create description and reset styles are inconsistent.
- Current-state gap: textarea and bordered reset variants.
- Decision: compact TipTap and borderless reset contract.
- Rationale: reuse established UI patterns.
- Tradeoffs: richer create component.
- Affected surfaces: create dialog and view controls.
- Fitness signal: component/browser tests.

### DES-007: Invite-Only Workspace Policy
- Context: workspace creation must be disabled.
- Current-state gap: UI/API/Convex creation paths remain.
- Decision: remove onboarding form and deny public API/handler calls while retaining bootstrap.
- Rationale: non-bypassable policy.
- Tradeoffs: users without invite need empty guidance.
- Affected surfaces: onboarding/workspaces/bootstrap.
- Fitness signal: direct-call denial tests.

### DES-008: Join-Code TeamSpace Invite URLs
- Context: codes exist but links are needed.
- Current-state gap: no canonical shareable URL.
- Decision: URL wraps current code only; rotation permanently invalidates old URLs.
- Rationale: no parallel credential model.
- Tradeoffs: bearer-code semantics remain.
- Affected surfaces: TeamSpace create/settings/onboarding/join.
- Fitness signal: lookup/join rejection after rotation.

### DES-009: Explicit Edit Intent
- Context: Edit behaves like Open.
- Current-state gap: no route intent consumption.
- Decision: one-use edit intent followed by lease acquisition.
- Rationale: preserves read-only Open.
- Tradeoffs: query/history handling.
- Affected surfaces: list/board/detail.
- Fitness signal: edit/open/lease tests.

### DES-010: Legacy Description Repair
- Context: legacy records false-conflict after lease migration.
- Current-state gap: missing document/version is treated as stale edit.
- Decision: idempotent repair before CAS.
- Rationale: compatibility without weakening concurrency.
- Tradeoffs: maintenance/lazy repair complexity.
- Affected surfaces: work-item handlers/edit leases.
- Fitness signal: legacy and genuine-conflict tests.

### DES-011: Optional Privacy-Safe Dashboard
- Context: dashboard always on and can admit bad private records.
- Current-state gap: no feature flag or defensive privacy filter.
- Decision: normalized dashboard feature, community forced off, private exclusion.
- Rationale: requested control and privacy.
- Tradeoffs: feature propagation across contracts.
- Affected surfaces: TeamSpace types/settings/routes/selectors.
- Fitness signal: direct-route and privacy tests.

### DES-012: Additive Compatibility
- Context: old records/clients/content exist.
- Current-state gap: new requirements can break them.
- Decision: additive fields, normalization, lazy repair, backend-first deploy.
- Rationale: safe rollout.
- Tradeoffs: temporary compatibility branches.
- Affected surfaces: all data contracts.
- Fitness signal: compatibility/rollback tests.

### DES-013: Deep Review And Fallow Loops
- Context: user requires repeated deep review and cleanup.
- Current-state gap: ordinary final review is insufficient.
- Decision: deep slice reviews, whole-tree review, Fallow remediation, final deep review.
- Rationale: reduce cross-slice and architecture regressions.
- Tradeoffs: longer implementation.
- Affected surfaces: complete worktree.
- Fitness signal: `.spec/work-item-teamspace-reliability/reviews.md` clean-loop evidence.

### DES-014: Coordinated Production Release
- Context: backend/web/desktop contracts must remain compatible.
- Current-state gap: multi-runtime release risk.
- Decision: Convex -> PartyKit -> Vercel -> desktop workflow with verification/abort.
- Rationale: backend-first compatibility.
- Tradeoffs: sequential release.
- Affected surfaces: production.
- Fitness signal: deployment and desktop release success.

## Risk Register
- Risk: destructive attachment cleanup.
  - Impact: data loss.
  - Mitigation: draft-safe save reconciliation and retain ambiguity.
  - Residual risk: legacy content may retain orphan records.
- Risk: bulk transaction too large.
  - Impact: command failure.
  - Mitigation: explicit bounded maximum and all-or-none rejection.
  - Residual risk: users may split very large selections.
- Risk: private dashboard leak.
  - Impact: privacy incident.
  - Mitigation: domain admission rule plus negative tests.
  - Residual risk: none accepted.
- Risk: unrelated Fallow findings.
  - Impact: gate noise.
  - Mitigation: preserve user files and document accepted external debt.
  - Residual risk: local gate remains blocked until those files are removed by their owner.

## Test Impact Matrix
- Existing tests to update: work-item menus/detail/attachments/create, settings, onboarding, routes, store, domain, Convex, desktop.
- New tests required: atomic bulk, attachment reconciliation, invite rotation invalidation, legacy repair, dashboard privacy, detail child ID isolation/nowrap.
- Compatibility tests: old rich-text, old TeamSpace settings, old clients, legacy work items.
- Rollback-safety tests: attachment retention, dashboard data preservation, genuine conflict preservation.

## Validation Strategy
- Unit validation: domain helpers, serializers, URL builder, view config.
- Integration validation: store/API/Convex commands and compatibility.
- End-to-end validation: browser smoke for all changed user flows.
- Migration or rollback validation: bounded repair/backfill and additive contract checks.

## Post-Design Review
- Original plan coverage review: complete, including latest child-ID requirement.
- Repository evidence review: complete with targeted baseline.
- Architecture standards review: capability owners and forbidden bypasses recorded.
- Requirements readiness: ready.
- Required upstream changes before requirements authoring: none.
- Performance validation: bounded bulk and no per-item network loop required.
- Operational validation: release sequence and abort points required.

## Rollout, Abort, and Reversal
- Rollout strategy: backend-compatible contracts first, then UI, then sequential production release.
- Feature flags or progressive exposure: TeamSpace dashboard setting is the product feature switch; no temporary hidden unsafe fallback.
- Abort thresholds: any partial bulk behavior, attachment loss, private data, old-link join, failed gate, or failed deploy verification.
- Rollback preconditions: preserve additive schema and policy denials.
- Reversal mechanics: revert UI/capability callers while retaining compatible fields; stop release sequence on failure.
- Post-deploy checks: onboarding, invites/rotation, bulk, attachments, edit, dashboards, logs, desktop release.

## Forbidden Shortcuts and Guardrails
- No looped per-item bulk fallback, UI-only security/privacy rule, immediate draft attachment deletion, ambiguous legacy destructive match, historical invite-code lookup, weakened CAS, Fallow suppression/threshold loosening, blind auto-fix, or deployment before clean reviews.

## Alternatives Considered
- Alternative: keep repeated single-item bulk writes.
  - Why rejected: partial failure and undo behavior.
- Alternative: delete attachments immediately on Backspace.
  - Why rejected: Cancel/data-loss risk.
- Alternative: create separate invite tokens.
  - Why rejected: unnecessary parallel credential system.

## Residual Risks
- Unrelated user-owned untracked duplicate files currently block the local Fallow gate.
- Legacy ambiguous attachment references may be retained for manual cleanup rather than deleted.
