---
title: Work Item And TeamSpace Reliability
scope: work-item-teamspace-reliability
status: in-progress
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

# Review Ledger

## Mandatory Entry Contract

Every slice entry records:

- linked DES, REQ, and task ids
- refreshed live-code evidence and changed-file scope
- capability owner, invariant owner, bypass-path audit, and architecture decision
- migration, compatibility, privacy, data-loss, and rollback assessment
- focused test plan and test-adequacy review
- commands and results
- deep dual-pass diff-review findings and fixes
- normal diff-review reruns until clean
- Fallow result when required
- spec drift and residual risk

## Spec Audit Slice

- Linked design: DES-001 through DES-014.
- Linked requirements: REQ-001 through REQ-018.
- Architecture preflight: passed on `main` at `74e59feea`.
- Diff-review preflight: passed; no branch diff, with unrelated user-owned untracked files present and excluded from this spec work.
- Baseline focused tests: `11` files and `267` tests passed.
- Audit loops:
  - Pass 1 captured all stated product requirements.
  - Pass 2 added authoritative bulk command, reference-safe attachment reconciliation, public workspace-creation denial, direct dashboard route guards, and legacy repair.
  - Pass 3 added old-client compatibility, comment/reference-safe attachment retention, malformed-private-data exclusion, and repository-owned desktop workflow semantics.
  - Pass 4 found no additional requirement.
  - User follow-up added detail-only child/subitem ID show/hide plus non-wrapping identifiers; design, requirements, tasks, tests, and browser verification were updated before audit closure.
  - User follow-up confirmed join-code rotation must invalidate old invite URLs; lookup/join, stale-client, cache, alias, redirect, and grace-period negative cases are explicit.
- Spec validation:
  - Initial lint found the first draft did not conform to the current skill schema; the package was rebuilt with all required sections, exact requirement/task fields, compatibility matrices, and review loops.
  - Strict spec lint passed with 14 design decisions, 16 requirements, 17 leaf tasks, and zero blocking decisions.
  - Strict traceability passed with every DES mapped to REQ and every REQ mapped to tasks.
  - Code-reference validation passed with 77 concrete repository path references at validation time.
  - Spec drift check reported no code changes to evaluate.
  - `git diff --check -- .spec/work-item-teamspace-reliability` passed.
- Deep spec review findings and fixes:
  - The first draft was not executable under the current spec skill schema; rebuilt rather than accepting structural debt.
  - Invite rotation wording initially allowed an implied implementation-only interpretation; tightened to permanent invalidation at lookup and join with no alias/grace/cache/history fallback.
  - The detail child/subitem ID requirement was absent from the initial audit; added as DES-005, REQ-FUNC-003, Task 4.1, and browser/negative isolation checks.
  - The original broad term “supported bulk actions” was too vague; narrowed to built-in property and custom select/multi-select property actions.
  - A nonexistent properties-popover path was referenced; corrected to `components/app/screens/work-surface-controls.tsx`.
- Normal spec re-review findings: none after fixes.
- Fallow:
  - `pnpm fallow:gate` reached dead-code analysis and reported eight unrelated user-owned untracked duplicate files.
  - Those files predate and are outside this spec diff; they were not modified or suppressed. They remain an explicit external worktree blocker for the final configured Fallow gate.
- Residual risk: implementation has not started; future public-contract discoveries require spec updates before code changes continue.

## Slice Entry Placeholders

### Slice 1: Atomic Bulk Actions

- Linked design, requirements, and task: DES-001, DES-002, DES-012; REQ-FUNC-001, REQ-NFR-001, REQ-ARCH-001; Task 1.1.
- Live-code scope: bulk property callers in `components/app/screens/work-item-menus.tsx` and project-cascade confirmation now call one typed store/client/API/server/Convex command. Single-item behavior remains on the existing path.
- Capability and invariant ownership:
  - Convex owns the bounded `100`-target transaction, duplicate rejection, target existence, per-target edit authorization, captured-version preflight, validation, and all-or-none writes.
  - The API owns public payload validation and read-model invalidation. Post-commit invalidation failure is logged but cannot turn durable success into a client-visible mutation failure.
  - The store owns one client outcome and deliberately remains pessimistic while the command is pending.
- Bypass audit: removed looped bulk writes for built-in fields, assignee toggles, labels, custom select/multi-select values, and confirmed project-cascade actions. Direct API and Convex paths enforce bounds, uniqueness, authorization, and stale versions.
- Architecture decision and spec drift:
  - Initial implementation used one optimistic group with global-array rollback.
  - Deep review found that rollback could overwrite unrelated concurrent local changes and project cascade widened the affected set.
  - Updated `design.md`, then `requirements.md`, then `tasks.md` to prescribe pessimistic pending state and one authoritative reconciliation outcome.
- Deep dual-pass findings and fixes:
  - Fixed missing pending-sync protection in the initial optimistic version.
  - Fixed missing per-target captured-version enforcement.
  - Removed unsafe custom-property optimistic mutation.
  - Preserved durable success when read-model invalidation or follow-up refresh fails.
  - Replaced global optimistic rollback with pessimistic bulk state.
  - Added preauthorization and captured-version preflight for every target before the transactional write loop.
  - Whole-worktree review found bulk delete still issued parallel single-item mutations with optimistic global rollback. Replaced it with one bounded, preauthorized, version-checked Convex transaction and pessimistic reconciliation.
- Verification:
  - Focused and adjacent suite passed: `9` files, `267` tests before final hardening; final focused suite passed `6` files, `116` tests; final broader adjacent suite passed after hardening.
  - `pnpm typecheck`, focused ESLint, `pnpm convex:codegen`, and `git diff --check` passed.
  - Diff-review and architecture preflights completed; unrelated user-owned untracked duplicate files remain excluded.
- Test adequacy: covers one grouped command, no speculative partial state, failure behavior, menu callers, project confirmation, duplicate rejection, stale built-in/custom-property targets, all-target preauthorization, multiple writes, route forwarding, and post-commit invalidation failure.
- Normal re-review: no actionable Slice 1 finding remains after the final stale-version preflight hardening.
- Residual risk: Convex transaction cost is bounded at `100`; production smoke remains part of the final release slice.

### Slice 2: Attachment Contract And Reconciliation

- Linked: DES-003, DES-012; REQ-DATA-001, REQ-DATA-002, REQ-DATA-003, REQ-ARCH-001; Tasks 2.1 and 2.2.
- Stable identity: upload results now carry backend ids into image/file TipTap nodes; sanitizer, parser/rendering, and collaboration canonicalization preserve only validated ids while legacy URL-only nodes remain readable.
- Lifecycle authority: the work-item edit session records attachment ids seen in the draft and submits only removed ids on Save. Cancel submits nothing. Convex requires the description CAS token, updates content first, then reconciles removed/previously referenced attachments at the end of the mutation.
- Reference safety: current description and comments veto attachment deletion; sibling attachment records veto storage deletion; legacy URL matching remains supported and ambiguous unreferenced legacy records are retained unless explicitly removed by id.
- Deep-review findings fixed:
  - Added upload-then-Backspace tracking because old-vs-new saved HTML alone misses never-saved embeds.
  - Kept removal state out of immediate upload/delete paths so Cancel cannot destroy backend data.
  - Added direct-client description CAS enforcement for explicit removal ids.
  - Moved cleanup to the end of the authoritative mutation path.
- Validation: focused shared editor/store/API/Convex/detail suite passed `9` files and `183` tests; typecheck, focused ESLint, Convex codegen, and diff check passed before final CAS hardening and were rerun afterward.
- Architecture: identity validation is shared content-boundary policy; Convex cleanup remains lifecycle owner; work-item detail owns ephemeral edit-session removal intent.
- Normal re-review: no actionable Slice 2 finding remains.
- Residual risk: browser interaction smoke and exact attachment row/remove presentation are owned by Slice 3.

### Slice 3: Attachment Rows And Editor Presentation

- Implemented files-first and images-second rows, equal-height aspect-preserving image previews, carousel preview, and authorized remove controls.
- Removed download controls from editable and read-only work-item description embeds.
- Deep review found the first remove control bypassed draft safety through immediate deletion. It now removes the embedded node from the active draft, hides the pending row immediately, and reconciles only after Save. Direct backend deletion of work-item attachments is rejected.
- Additional hardening requires attachment-only removal to own an active edit lease and preserves shared/comment references through Convex cleanup.
- Focused component/editor/cleanup suites, typecheck, lint, codegen, and diff checks passed during the slice loop.

### Slice 4: TipTap Create Description And Reset Controls

- Added detail-scoped child ID display property with nowrap rendering in main and sidebar child rows while preserving all prior property options.
- Replaced Create Work Item description textarea with compact TipTap, disabled pre-create uploads, and stores only prepared sanitized rich text.
- Standardized relevant work-view Reset controls to ghost/borderless controls with the reset icon and accessible labels.
- Deep review fixed an initial property-option narrowing regression and retained detail-only viewer-config ownership.
- Focused detail/create/work-view tests and static gates passed during the slice loop.

### Slice 5: Invite-Only Onboarding And TeamSpace Invite Links

- Removed public workspace creation from onboarding, made the HTTP route deny authenticated public creation, and made the direct Convex creation mutation deny it while preserving the separate bootstrap command.
- TeamSpace settings now copy a canonical origin-relative onboarding invite URL containing the current normalized join code.
- Existing current-code-only lookup/join and code replacement semantics permanently invalidate prior links after rotation.
- Deep review checked UI, route, direct handler, bootstrap separation, current-code disclosure, and old-code bypass paths.
- Focused route/settings/team handler tests and static gates passed during the slice loop.

### Slice 6: Right-Click Edit And Legacy Repair

- List and board context-menu Edit now navigates with a one-use explicit edit intent; Open remains read-only.
- Detail consumes the intent once, removes it from history, checks editability, and enters edit state only after lease acquisition.
- Missing legacy description documents are repaired transactionally before strict version validation; real lease and CAS conflicts remain enforced.
- Deep review added lease enforcement for attachment-only removal and kept failed intent acquisition read-only.
- Focused detail/work-surface/Convex tests and static gates passed during the slice loop.

### Slice 7: Optional Privacy-Safe Dashboards

- Added normalized `dashboard` TeamSpace feature with old-record defaults, non-community toggle support, and forced-off community normalization.
- Dashboard navigation is hidden when disabled; direct routes redirect to a deterministic enabled TeamSpace surface and render no dashboard data while redirecting.
- Private tasks are excluded defensively in dashboard selectors, screen acquisition, and TeamSpace activity derivation, including malformed legacy private records carrying a team id.
- Deep review fixed the old always-dashboard create-team landing assumption and moved privacy enforcement into derivation owners.
- Focused TeamSpace settings/dashboard/activity/backend tests and static gates passed during the slice loop.

### Slice 8: Whole-Worktree Review

- Correctness/security/privacy and maintainability/structure passes completed against the complete local diff.
- Findings fixed:
  - Bulk delete still allowed partial durable success and apparent rollback; moved it to the authoritative atomic bulk command path.
  - Bulk update accepted a concurrency-token-only no-op; route and Convex handler now reject it.
  - Additive TeamSpace dashboard input broke old clients before normalization; schemas now accept and normalize the missing field.
  - Attachment removal bookkeeping rerendered the description editor on every keystroke; state now changes only when the removed-id set changes.
  - Image records without a temporary preview URL disappeared from both attachment rows; they remain visible in the files row.
  - Rich-text removal could reserialize unrelated content when an id appeared on a non-attachment node; unchanged content now remains byte-stable.
- Added direct regression proofs for public Convex workspace-creation denial, missing legacy description repair, explicit edit intent, atomic bulk delete, compatibility normalization, and the presentation/removal edge cases.
- Focused rerun after fixes: `8` files and `165` tests passed; `pnpm convex:codegen`, `pnpm typecheck`, `pnpm lint`, and `git diff --check` passed.
- Normal re-review found no remaining actionable whole-worktree issue. Full suite and analyzer verification continue in Slice 9.

### Slice 9: Fallow Remediation

- Removed dead public workspace-creation UI and client/server wrappers after invite-only onboarding made them unreachable.
- Removed the stale workspace-creation document and unused setup constraints that described the retired public flow.
- Consolidated duplicated work-item route schemas, made local settings helpers private, and simplified the reported high-complexity control flow.
- `pnpm fallow:health` passed with `findings=0`, `functions_above_threshold=0`, score `94.0`, grade `A`.
- `pnpm fallow:dead-code` now reports only eight unrelated user-owned duplicate files already present in the worktree; no attributable dead-code finding remains and no suppression or policy relaxation was added.
- `pnpm fallow:dupes` remains blocked by the same unrelated duplicate-file worktree state and the repository's zero-duplicate budget; introduced route duplication was removed.
- Focused regression suite passed `6` files and `128` tests after cleanup. Full-suite and final static/build verification continue in Slice 10.

### Slice 10: Final Review And Production Release

- Final whole-worktree deep dual-pass review completed.
  - Correctness/safety pass re-traced bulk authorization/version/atomicity, attachment identity and save-time cleanup, public workspace-creation bypasses, join-code rotation semantics, legacy edit repair, and private dashboard acquisition/derivation.
  - Maintainability/structure pass rechecked shared route schemas, capability ownership, deleted public-creation remnants, introduced exports, file pressure, and analyzer evidence.
  - Challenger pass attacked direct mutation/API bypasses, stale and legacy variants, partial failure, missing preview URLs, malformed private records, and old TeamSpace payload compatibility. No actionable feature finding remains.
- Release-gate findings fixed:
  - Strict spec lint found stale execution-summary bookkeeping; corrected it and reran lint, strict traceability, and code-reference checks.
  - Dependency audit found critical `shell-quote` and high `esbuild` advisories in release tooling. Added narrow patched-version overrides, regenerated the lockfile, and verified Convex codegen, Vite/Vitest, build, desktop smoke, and the audit.
- Validation:
  - `pnpm check` passed: lint, typecheck, `243` test files / `1735` tests, production build, and desktop packaged-runtime smoke.
  - `pnpm test:coverage` passed: `243` files / `1735` tests.
  - `pnpm convex:codegen`, `pnpm audit:deps`, `git diff --check`, strict spec lint, strict traceability, and code-reference validation passed.
  - `pnpm fallow:health` passed with zero findings, score `94.0`, grade `A`.
  - `pnpm fallow:dead-code` remains blocked only by eight unrelated user-owned duplicate files; `pnpm fallow:dupes` remains blocked by the repository-wide zero-duplicate budget. No attributable finding or policy relaxation remains.
  - In-app Browser was unavailable; local HTTP smoke confirmed onboarding redirects through auth and unauthenticated workspace creation is denied. Production smoke remains in the ordered deployment step.
  - Local desktop release preflight passed renderer, endpoint, CORS, secret-scan, and environment checks; signed installer/artifact checks correctly remain pending until the GitHub release workflow.
- Release version advanced from already-published `0.0.52` to available `0.0.53`.
- Final review outcome: clean with documented external analyzer blockers and browser-tool limitation; ordered production deployment is in progress.
