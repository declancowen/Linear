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

# Design: Workspace Surface Stability, Editor Safety, And App Performance

## Summary
- This spec defines a high-risk audit-remediation implementation for workspace surface stability, editor safety, reference correctness, and app performance.
- It combines feature fixes with data-loss prevention and measurement-guided performance work, controlled by per-slice diff-review loops and architecture-standards.
- The reference design imports the June 1 reference/backlink review so access-denied navigation and visible saved reference markers are explicit requirements.

## Scope Statement
- Implement the original prompt and follow-ups as one spec-driven change set: persisted chat/channel sidebars, chat message read/edited metadata correctness, work item multi-select and dynamic bulk property menus, fixed scoped rich-text references, view-aware create defaults, work item title/description editor performance, document hydration safety, and deep/wide app performance audit and remediation.
- Use `architecture-standards` for ownership, contract, state, privacy, performance, and review shape.
- Use `repo-audit` archetypes as the audit taxonomy without running the full `.audits` loop unless requested separately.
- Use `diff-review` after each implementation slice and at the final total-diff review.

## Original Plan Alignment Audit
- Original prompt covered: sidebar open/closed persistence; multi-select visible items/subitems; right-click editable property menus from visible `displayProps`; reference insertion/search in documents and work items; wider reference modal; no people/create reference actions; add-item defaults from board/view groups and filters; work item detail TipTap performance; document hydration deletion; broad app performance.
- Chat metadata follow-up covered: message read receipts persist the first-read timestamp in backend/read-model state and render in the message canvas metadata as timestamp, `Read`, then `Edited` stamps separated by bullets.
- TipTap clarification covered: work item editor optimization is scoped to the detail title/description editor area, not the entire work item page unless profiling proves wider fan-out.
- Snapshot/loading follow-up covered: snapshot/bootstrap, scoped read models, loading states, first useful render, and snapshot lag are first-class audit targets.
- Broad app performance follow-up covered: shell/navigation, workspace/team/project/document/work item/inbox/chat/search/people/views, stores, read-models, rendering, collaboration, background work, and Fallow/audit history are all auditable areas.
- Repo-audit taxonomy follow-up covered: every finding/remediation must state root cause, blast radius, fix radius, and prevention artifact.
- Reference review follow-up covered: `.reviews/work-item-reference-activity-ui.md` is imported as the current reference/backlink contract, including access-aware insertion/navigation, source-owned relationships, visible saved references for containing-surface viewers, and no hidden target-content hydration.
- Diff-review loop follow-up covered: each slice must run deep review first, fix findings, then normal review loops until clean, with final total-diff review and non-draft PR to `main`.

## Repository Discovery Summary

### Repo Root
- `/Users/declancowen/Documents/GitHub/Linear`

### Repo-Specific Profile and House Patterns
- Next.js 16, React 19, Convex, Zustand, TipTap, PartyKit/Yjs, Vitest.
- Domain derivation lives under `lib/domain`; UI surfaces live under `components/app`; optimistic local state lives in `lib/store/app-store-internal/slices`; authoritative persistence/access checks live in Convex handlers and API routes.
- Existing specs and reviews show a source-owned linked-array reference model, with normalized reference graph deferred until query pressure requires it.

### Entry Points and Execution Path
- Collaboration screens: `components/app/collaboration-screens.tsx`, `components/app/collaboration-screens/workspace-chats-screen.tsx`.
- Chat/message metadata: collaboration message models, Convex chat/message handlers, read-model payloads, and message canvas components that render timestamps/read/edited stamps.
- Work surfaces: `components/app/screens/work-surface-view.tsx`, `components/app/screens/work-surface-view/*`, `components/app/screens/work-item-menus.tsx`.
- Work item detail: `components/app/screens/work-item-detail-screen.tsx`, `components/app/screens/work-item-ui.tsx`.
- Rich text references/editors: `components/app/rich-text-editor.tsx`, `components/app/rich-text-editor/menus.tsx`, `components/app/rich-text-content.tsx`, document/detail/comment editor callers.
- Create defaults: `components/app/screens/shared.tsx`, `components/app/screens/create-work-item-dialog.tsx`, work-surface group helpers.
- Read models/performance: `hooks/use-scoped-read-model-refresh.ts`, `lib/server/scoped-read-models.ts`, `app/api/read-models/**`, `lib/server/convex/auth.ts`, Zustand store merge/selectors.

### Confirmed Code and Runtime Facts
- Collaboration details sidebars currently default open from local state unless already updated by this branch slice.
- Chat read receipt display currently risks using current read/view state instead of durable first-read timestamps and does not place read/edited stamps in the message canvas metadata order requested by the user.
- Persisted UI state already has viewer-scoped maps and compaction patterns.
- Work item context menus are primarily single-item menus and do not yet derive menu entries from visible editable `displayProps`.
- Existing create defaults can derive status/project from group context, but label defaults can fail in empty lanes when no exemplar item exists.
- Reference candidates exist but slash reference behavior is too narrow/broken for the requested scoped modal and work item/document parity.
- Document hydration has multiple content writers: read-model merge, snapshot replacement, editor external sync, collaboration bootstrap/flush, and teardown.
- Several server read paths derive scoped payloads from full snapshots and may trigger unrelated email job processing before read responses.

### Related Code and Pattern Inventory
- `getViewerScopedDirectoryKey` and persisted UI compaction are the established pattern for user-scoped UI preferences.
- Inline property controls already define icon and editor semantics that bulk property menus should reuse.
- Rich text reference parsing/sanitization already treats HTML as untrusted and preserves safe entity-reference metadata.
- Convex handlers are the durable validation point for document/work item/comment persistence and scoped read-model invalidation.
- Existing `.reviews/work-item-reference-activity-ui.md` records access-aware reference/backlink invariants and resolved sanitizer/click-blocking findings.

### Adjacent Pattern Comparison
- Document editors are faster than work item detail editors because they isolate more editor state and avoid some per-keystroke parent/store fan-out.
- Work surface row property rendering already derives from `view.displayProps`; context menus should use the same source so visible editable fields stay aligned.
- Scoped read-model refresh currently favors correctness and freshness but can over-render or show loading when retained data is safe.

### Blast Radius Review
- UI: app shell, sidebars, work surfaces, detail screens, editors, reference modals, create dialogs.
- State: persisted UI maps, ephemeral selection, optimistic mutation reconciliation, read-model merge.
- Backend: Convex write handlers, read-model route handlers, background job trigger separation.
- Privacy/security: private/team-space references, backlinks, target navigation, inaccessible target labels.
- Performance: initial render, route transitions, store selector fan-out, hydration, editor hot paths.

### Recent Related Repository History
- `.reviews/work-item-reference-activity-ui.md` completed 2026-06-01 and verified reference access, source-owned backlinks, sanitizer behavior, and no normalized graph.
- `.audits/full-codebase-audit.md` flags snapshot/store rerender risk.
- `.audits/realtime-collaboration-outline-comparison.md` flags stale client snapshot/manual flush risks.
- `.reviews/realtime-collaboration-hardening.md` records collaboration source-of-truth and flush hardening context.

### Impacted Boundaries and Adjacent Systems
- UI boundaries: presentational components should not own durable permissions or persistence rules.
- Store boundaries: optimistic updates may stage local changes but must not invent durable authority.
- Server boundaries: Convex/API handlers own access checks, persistence validation, and read-model invalidation.
- Collaboration boundaries: active room state is authoritative during collaboration; Convex HTML remains canonical unless durable Yjs state is proven necessary.
- Background-work boundaries: read routes should not perform unrelated email job work on the critical path when avoidable.

### Data, Contracts, and Config Surfaces
- `UiState` persisted shape and versioning/compaction.
- Work item update/custom property mutation payloads.
- Rich text HTML entity-reference attributes and extracted reference payloads.
- Document/work item linked arrays and any additive view/document-to-document reference fields if required.
- Create-default resolver inputs for group/subgroup/filter context.
- Diagnostics event names/payloads for first useful render, read-model refresh, snapshot/bootstrap, and mutation reconciliation.

### Existing Tests and Operational Signals
- Store/UI tests under `tests/lib/store/*` and `tests/components/*`.
- Convex handler tests under `tests/convex/*`.
- Rich text parser/security tests under `tests/lib/content/*` and `tests/lib/domain/rich-text-references.test.ts`.
- Scoped read-model tests under `tests/lib/scoped-read-models.test.ts` and API route contract tests.
- Validation gates: `pnpm lint`, `pnpm typecheck`, targeted Vitest, broader Vitest, code-level diagnostics evidence, and diff-review loops.

### Static Analyzer and Audit Evidence
- Fallow/static inventories are advisory evidence and must not be treated as all-clear signals.
- Existing audit history highlights snapshot/store fan-out and collaboration persistence as high-risk areas.
- Repo-audit archetypes required here: `performance`, `architecture`, `optimistic-state`, `fallback-state`, `contract`, `shared-ui`, `background-work`, `release-safety`.

## Problem Statement and Context
- The app has several visible stability problems in daily workspace use: sidebars do not remember state, visible work items cannot be bulk-edited efficiently, reference insertion does not open the intended scoped search, add-item defaults do not always inherit view context, document content can hydrate to empty, and surfaces often show unnecessary loading or flicker.
- The performance problem is not isolated to one component. It spans read-model bootstrap, store merge/selectors, route transitions, editor hot paths, and server read paths.
- The reference problem is both UI and contract work: users must be able to create references, see saved links in containing content, and receive access-denied behavior when they cannot open the target.

## Current-State Analysis
- Sidebar state is not durably keyed per viewer and surface.
- Work item selection state is either absent or local to unrelated views, so bulk property changes cannot target visible child/subitem rows consistently.
- Context menus are fixed and single-item focused instead of deriving editable entries from `displayProps`.
- Reference insertion behavior is narrow and not wired to the requested search experience in all rich-text surfaces.
- Create defaults rely on partial group logic and fail when a grouped/filtered lane has no exemplar item.
- Work item detail title/description editor work likely fans out through parent draft state, reference extraction, awareness, and store updates too often.
- Document body protection exists but still allows dangerous empty/stale payload paths through snapshot/read-model/editor/collaboration interactions.
- Loading states can be shown because the app does not always render from retained/seeded data while a scoped refresh is in flight.

## Target-State Architecture
- Persisted UI preferences live in viewer-scoped Zustand UI state with bounded compaction.
- Selection is ephemeral, surface-scoped, and separate from durable item data.
- Bulk property menus derive from the same visible `displayProps` source used by rows and delegate writes to existing mutation authority.
- Reference search is editor-scoped and uses typed candidates for work items/tasks, docs, projects, and views only.
- Reference persistence uses source-owned linked/reference fields first; normalized graph work is deferred until evidence proves arrays are insufficient.
- Create defaults are resolved from group, subgroup, and single-value filters in a deterministic domain helper before opening the create dialog.
- Editor optimizations isolate local draft state and defer expensive parsing/flush work where possible.
- Document hydration guards prevent empty/stale payloads from replacing active or recently typed content.
- Performance diagnostics identify route/read-model/render/mutation timings before broad remediation decisions.

## Goals
- Restore collaboration sidebar state exactly as last left by the current user for each surface.
- Persist first-read chat message timestamps and render read/edited metadata in the message canvas without recomputing read time from the current visit.
- Enable multi-select and bulk property changes for visible rows and detail subitems.
- Make right-click menus match visible editable dropdown-like properties.
- Make reference search, insertion, persistence, backlinks, and access-denied navigation reliable.
- Make Add Item inherit view defaults, including empty label lanes.
- Improve work item detail title/description typing smoothness measurably.
- Stop random document empty hydration/content deletion.
- Reduce unjustified loading/flicker across requested app surfaces.
- Record every slice review and final coverage audit.

## Non-Goals
- No unrelated shell redesign or marketing/landing work.
- No new normalized reference graph unless current linked arrays fail a concrete contract.
- No durable Yjs-as-canonical migration unless the hydration audit proves HTML cannot remain canonical.
- No broad backend batch mutation until existing mutations prove insufficient.
- No performance all-clear based solely on static analyzer or Fallow output.

## Confirmed Facts
- Current reference review from 2026-06-01 found no need for a normalized graph yet.
- Private and inaccessible references must not leak hidden target content.
- The work item TipTap optimization scope is the title/description editor area.
- The performance audit must cover all app surfaces named by the user.
- The final delivery must create a non-draft PR targeting `main`.

## Assumptions
- Existing Convex mutations can support bulk updates through repeated calls unless measurement proves batch mutation is needed.
- HTML remains canonical document content unless collaboration persistence evidence proves durable Yjs state is required.
- Auth/access helpers can express workspace, team, document, and private item access for reference navigation.
- Development diagnostics can be gated to avoid production noise.

## Open Questions
- Whether existing linked arrays can safely represent reference representation type and source direction for every inline/embed/link form.
- Whether measurable work item editor lag is mainly editor transaction work or parent detail screen rerender fan-out.
- Whether server read latency is dominated by full snapshot derivation, background job triggers, Convex query shape, or client loading-state policy.

## Decision Needed
- If linked arrays cannot represent reference source, direction, and representation type without ambiguity, pause T-004 and update this design before introducing a normalized reference graph.
- If document hydration loss is caused by active collaboration room state, decide whether the quick fix is guard-only or whether persistence source-of-truth must change.
- If performance measurement identifies unrelated server background work as the largest latency source, move email job triggering off read critical paths.

## Proposed Design

### DES-001: Use Repo-Audit Taxonomy As The Review Model
- Classify findings and remediations with `performance`, `architecture`, `optimistic-state`, `fallback-state`, `contract`, `shared-ui`, `background-work`, and `release-safety`.
- Each material finding/remediation records root cause, blast radius, quick/proper/strategic fix where useful, remediation radius, and prevention artifact.

### DES-002: Audit Performance Deep And Wide
- Cover app shell/sidebar/navigation; workspace, team, project, document, work item, inbox, chat/channel, search, people, and views; snapshot/bootstrap and scoped read models; loading and first useful render; Zustand merge and selector fan-out; Convex/read-model route latency and overfetching; optimistic flicker; TipTap; collaboration flush/hydration/persistence; route transitions; server reads doing unrelated work; browser rendering/layout; and Fallow/audit hotspots.

### DES-003: Keep Durable Authority Explicit
- Convex/server handlers own durable writes, access checks, and read-model invalidation.
- Zustand owns optimistic UI and persisted viewer preferences.
- PartyKit/Yjs owns active collaboration room state while active; Convex HTML remains canonical unless evidence proves otherwise.

### DES-004: Persist Collaboration Details Sidebar State
- Add a bounded persisted UI map keyed by viewer and collaboration surface.
- Channel, team chat, and workspace chat details sidebars default open only when no persisted value exists.

### DES-012: Persist First-Read Message Receipts And Ordered Message Metadata
- Read receipt authority lives in durable chat/message persistence and scoped read-model payloads, not transient client render time.
- The first time a message is opened/read by a viewer is recorded once and never overwritten by later visits.
- Message canvas metadata renders the message timestamp, then `Read` with the persisted first-read timestamp when applicable, then `Edited` with the edit timestamp when applicable, separated by bullet delimiters.
- Conversation-list previews do not need read-time metadata unless separately required; this requirement is for the actual message canvas.

### DES-005: Add Surface-Scoped Work Item Multi-Select
- Selection is ephemeral and scoped to the visible work surface/detail subitem list.
- Visible work items, child rows, subitems, and detail subitem rows are selectable.
- Right-clicking selected rows acts on selection; right-clicking an unselected row acts on that row only.

### DES-006: Build Bulk Menus From Visible Editable Display Properties
- Dynamic menus derive from `displayProps`.
- Eligible properties are editable dropdown-like properties, including built-ins and custom select/multi-select fields.
- Icon semantics and permission behavior reuse inline property controls.

### DES-007: Replace Broken Reference Action With Scoped Reference Search
- The slash `Reference` command opens a wider editor-scoped search dialog for work items/tasks, docs, projects, and views.
- People and create actions are excluded.
- Insertion candidates require author access to the target.
- Saved references remain visible as authored markers/backlinks to viewers who can read the containing document/work item, even when they cannot open the target.
- Target navigation without workspace/team/document access shows access denied and does not hydrate hidden target content.
- Inline, embed/block, and plain-link forms share one typed reference extraction, sanitizer, persistence, backlink, and navigation contract.
- Source-owned linked arrays remain first path; a normalized reference graph is deferred until evidence proves necessary.

### DES-008: Resolve Add-Item Defaults From Group, Subgroup, And Filters
- Create defaults merge explicit group, subgroup, and active single-value filter constraints.
- Empty label-filtered lanes must populate the implied label without needing an exemplar item.
- Defaults stay deterministic for status, project, labels, team, type, parent/subitem, and visibility.

### DES-009: Optimize Work Item Detail Title/Description Hot Paths
- Profile the title/description editor path by inspection and targeted measurement.
- Reduce parent state fan-out, expensive reference extraction, unstable props, and collaboration flush work on each keystroke.
- Reuse faster document editor patterns when compatible.

### DES-010: Harden Document Hydration And Persistence
- Protect active/recently edited document bodies from empty preview payloads, stale snapshots, external editor sync drift, collaboration bootstrap races, stale manual flushes, and teardown overwrites.
- Server-held active room state must not be overwritten by stale client snapshots.

### DES-011: Add Diagnostics And Measurement-Guided Performance Remediation
- Add development diagnostics for scoped read-model refresh, snapshot/bootstrap, first useful render, and mutation reconciliation.
- Use measurements to decide whether fixes belong in rendering, store merge, read-model selection, server read paths, collaboration persistence, or background-work separation.

## Impacted Surfaces Matrix
- UI: collaboration sidebars, chat message canvases, work surfaces, work item detail, documents, comments, reference modals, create dialogs, loading states.
- API: read-model routes, chat/message read receipt routes or Convex handlers, document/work item/comment persistence routes if reference payloads change.
- Domain logic: visible item selection, display property menu models, create-default resolver, reference candidate/access selectors.
- Persistence: persisted UI maps, chat read receipt/edit metadata fields, document/work item linked fields, custom property values, optional additive reference metadata.
- Integrations: PartyKit/Yjs collaboration lifecycle, Convex read/write handlers.
- Auth: workspace/team/document/private item access checks for references and backlinks.
- Infra: no deployment infrastructure change expected; diagnostics should be development-safe.
- Telemetry: development diagnostics for first useful render, read-model refresh, snapshot/bootstrap, mutation reconciliation.
- Tests: store, component, domain, Convex, route, rich text, collaboration, performance smoke.
- Docs: this spec and `.spec/<scope>/reviews.md`.

## Change Impact Map
- Direct impact: requested UI behaviors, editor persistence, read-model/loading performance, reference/search workflows.
- Indirect impact: snapshot freshness, optimistic mutation reconciliation, sidebar/backlink visibility, message read-model freshness, route transitions.
- Unchanged but risk-adjacent areas: unrelated global search actions, people records, unrelated background jobs, private artifact access policy, existing saved views.

## Invariants and Forbidden Outcomes
- A closed sidebar must not reopen by default on the next visit for the same viewer/surface.
- A message read receipt must record the first-read time only and must not be updated to "now" on subsequent reads.
- Message metadata must render in the message canvas as timestamp, read stamp, edited stamp, separated by bullet delimiters when optional stamps exist.
- Bulk updates must only apply to visible selected targets intended by the user.
- Context menus must not expose non-visible or non-editable properties as bulk editable.
- Reference rendering must not hydrate hidden target content for inaccessible targets.
- People/create actions must not appear in reference search.
- Add Item from empty filtered/grouped lanes must not drop implied defaults.
- Work item editor optimization must not break collaboration, mentions, references, or saves.
- Document hydration must not replace typed content with empty/stale content.
- Performance fixes must not hide stale data behind unjustified retained renders.
- No implementation slice may skip the required deep-first diff-review loop.

## Compatibility Matrix
- Public API: no external public API expected; if route payloads gain reference or read-receipt metadata, fields must be additive and optional.
- Internal API: store actions and helper types may expand additively.
- Data schema: persisted UI version may bump; read receipt and reference fields must be additive if needed.
- Events: read-model invalidation and diagnostic events may expand.
- Cache keys: scoped read-model and retained-data keys may change only with compatibility safeguards.
- Config: diagnostics should be gated by dev/runtime flags if noisy.
- External consumers: none known beyond app/runtime routes.
- Rollback compatibility: additive fields remain inert; UI hooks/actions can revert without destructive migration.

## Contract Examples and Before/After Payloads
- Request examples: `setCollaborationSidebarOpen("collaboration:workspace-chat:chat_1", false)`; create defaults include `{ group: { field: "labels", value: "label_cx" }, filters: [...] }`; reference extraction emits `{ targetType: "document", targetId: "doc_1", representation: "inline" }`.
- Response examples: inaccessible reference click surfaces `You do not have access` and does not open the target detail route.
- Event or message examples: read-model invalidation includes affected source and target detail scopes after a durable reference changes; chat read-model payload includes first-read and edited timestamps for message canvas metadata; diagnostics emit `first-useful-render` and `scoped-read-model-refresh`.
- Before/after comparisons: before, empty label lanes create items without the label; after, the label is prepopulated from group/filter context. Before, stale empty read-model payload can replace document content; after, empty/stale payloads are rejected or deferred when active typed content exists.

## Cross-Cutting Applicability Matrix
- Security: access checks for reference insertion, navigation, backlinks, and hidden metadata.
- Privacy: private/team/document content cannot leak through references, profiles, loading fallbacks, backlinks, or message read receipt payloads outside authorized chat viewers.
- Performance: editor hot paths, route loading, read-model overfetch, store selector fan-out.
- Resilience: hydration guards, stale flush guards, fallback-state correctness.
- Migration: persisted UI version/additive fields only; no destructive migration.
- Observability: development diagnostics for render/read/mutation/collaboration timing.
- Supportability: review ledger, diagnostics, targeted tests, access-denied states.
- Backward compatibility: existing documents/work items render safely; unsupported new fields default inert.

## Success Metrics and Numeric NFR Targets
- Latency targets: first useful render should occur from retained/seeded safe data before network refresh on repeat route visits; work item title/description keystroke handling should avoid synchronous broad store/reference extraction work.
- Throughput or concurrency targets: bulk property changes must handle at least 50 selected visible items through existing mutations or justify batch mutation with measurements.
- Error-rate or availability targets: document create/type/navigate/return regression must not produce empty content in targeted tests.
- Timeout, retry, or queue-depth limits: read-model refresh diagnostics should expose slow routes above 1s in development; mutation reconciliation diagnostics should expose stale optimistic state lasting above 1s.

## Decision Register
- DES-001: repo-audit taxonomy is the audit model for this spec.
- DES-002: performance audit is app-wide.
- DES-003: durable authority stays server-owned.
- DES-004: sidebar state is persisted viewer UI state.
- DES-012: chat read receipt authority is durable first-read backend/read-model state and message canvas metadata renders timestamp, read, then edited stamps.
- DES-005: selection is ephemeral and surface-scoped.
- DES-006: bulk menus derive from visible editable display properties.
- DES-007: references use scoped search and source-owned persistence first.
- DES-008: create defaults derive from view context, not exemplar items.
- DES-009: work item editor optimization is scoped to title/description.
- DES-010: document hydration requires multi-source stale/empty guards.
- DES-011: performance remediation is measurement-guided.

## Risk Register
- Risk: reference access leaks hidden target metadata. Impact: high. Mitigation: typed access-denied rendering, sanitizer tests, Convex revalidation. Residual risk: medium.
- Risk: document hydration guard rejects legitimate empty document edits. Impact: high. Mitigation: distinguish intentional empty saves from stale empty payloads with active/edit revision context. Residual risk: medium.
- Risk: bulk updates generate excessive network churn. Impact: medium. Mitigation: reuse existing mutations first, measure, then add batch mutation if needed. Residual risk: medium.
- Risk: retained data masks stale route state. Impact: medium. Mitigation: diagnostics and explicit loading-state justification. Residual risk: medium.
- Risk: read receipts expose viewer activity outside authorized chat surfaces or overwrite original first-read time. Impact: medium. Mitigation: durable first-write-only server contract, scoped read-model payloads, and message canvas tests. Residual risk: medium.
- Risk: broad performance work balloons scope. Impact: high. Mitigation: findings must include root cause, blast radius, and remediation radius. Residual risk: medium.

## Test Impact Matrix
- Existing tests to update: store UI persistence fixtures, chat/message read-model and canvas metadata tests, work surface rows/menus, document/work item editor tests, Convex document/work item/comment handlers, scoped read-model tests.
- New tests required: sidebar persistence, chat first-read receipt and ordered read/edited stamp rendering, multi-select visible targets, dynamic property menu model, reference modal/access/backlinks, empty lane create defaults, document hydration regression, diagnostics/render behavior.
- Compatibility tests: persisted UI migration/compaction, existing rich text rendering, private/access-denied reference behavior, saved view defaults.
- Rollback-safety tests: additive state defaults, no hidden target hydration, no lost document content after navigation.

## Validation Strategy
- Run targeted Vitest suites after each slice.
- Run `pnpm typecheck` when shared types change.
- Run `pnpm lint` after broad UI or helper changes.
- Do not run agent-owned browser smoke tests for this plan; the user will perform manual browser verification. Use automated tests, code-level diagnostics evidence, and diff-review gates instead.
- Run deep diff-review after each slice, fix findings, then normal diff-review loops until clean.
- Run final total-diff deep review, final prompt coverage audit, and broad validation before PR.

## Post-Design Review
- Architecture standards applied: state ownership, server authority, privacy boundary, performance measurement, and proportionality are explicit in design decisions.
- Original prompt audit: all original and follow-up prompts map to DES-001 through DES-011 plus DES-012.
- Repo evidence audit: design names concrete files, tests, and prior reviews/audits.
- Spec drift audit: reference follow-up from 2026-06-02 updated DES-007 before implementation continued.

## Rollout, Abort, and Reversal
- Rollout in slices matching tasks: sidebar state, selection/menu, references, create defaults, editor performance, hydration safety, chat read/edited metadata, performance remediation, final validation.
- Abort a slice if diff-review finds unresolved privacy/data-loss issues or if validation fails without a safe fix.
- Reversal: UI/state additions are additive and can revert locally; schema additions must remain optional/inert; hydration guards can be disabled only after restoring previous content safety.

## Forbidden Shortcuts and Guardrails
- Do not skip per-slice deep diff-review.
- Do not implement reference links that bypass access checks.
- Do not use people or create actions in reference search.
- Do not add a normalized reference graph without updating this design after evidence.
- Do not solve document deletion by blindly ignoring all empty content writes.
- Do not claim performance is fixed without measurement or targeted evidence.
- Do not run unrelated destructive git commands.

## Alternatives Considered
- Normalized reference graph immediately: rejected as premature because the June 1 review found source-owned arrays sufficient for current behavior.
- Backend batch mutation immediately for bulk edits: deferred until measurements prove repeated existing mutations are insufficient.
- Make Yjs durable canonical content immediately: deferred unless hydration audit proves HTML cannot remain canonical.
- One final giant review only: rejected by user; per-slice deep-first review is required.

## Residual Risks
- Some performance findings may require architecture/data-flow changes beyond the first measured fixes.
- User-run manual browser verification may reveal layout issues not covered by component tests.
- Reference representation type may require additive metadata once inline/embed/link forms are fully wired.
- Document hydration deletion is random by report, so tests must model likely races even if reproduction is not deterministic.
