# Review: UI Enhancements And Platform Hardening

## Project context (captured on Turn 1 — not re-detected on subsequent turns)

| Field | Value |
|-------|-------|
| **Repository** | `Linear` |
| **Remote** | `https://github.com/declancowen/Linear.git` |
| **Branch** | `ui-enhancements` |
| **Repo type** | `single repo` |
| **Stack** | `Next.js App Router / Convex / WorkOS / TypeScript` |
| **Packages affected** | `n/a` |
| **OS** | `Darwin 25.4.0` |
| **Package manager** | `pnpm 10.32.0` |
| **Node** | `v25.8.0` |
| **Python** | `n/a` |

## Scope (cumulative — updated each turn as new files are touched)

Files and areas reviewed across all turns:
- `components/app/screens/work-surface-view.tsx` — list/board drag, regrouping, reparenting, and grouped patch application
- `components/app/screens/work-item-inline-property-control.tsx` — inline list/board/child property popovers
- `components/app/screens/work-item-detail-screen.tsx` — detail-screen project confirmation flow and comment/reply composers
- `components/app/screens/work-item-menus.tsx` — right-click project reassignment flow
- `components/app/screens/work-item-ui.tsx` — shared work-item comment thread and child-create surfaces
- `components/app/screens/shared.tsx` — shared grouped field patch helper
- `components/app/collaboration-screens/channel-ui.tsx` — new post and post-reply composers
- `components/app/collaboration-screens/chat-thread.tsx` — direct/group chat composer for sibling closure on min-length gating
- `components/app/screens/work-surface-controls.tsx` — filter/dropdown shared controls
- `hooks/use-retained-team-by-slug.ts` — retained team lookup helper introduced on this branch
- `lib/domain/selectors-internal/core.ts` — `getTeamBySlug` selector semantics
- `lib/domain/input-constraints.ts` — centralized text/rich-text limit state helpers
- `lib/domain/types-internal/schemas.ts` — shared bounded string and rich-text schema helpers
- `lib/store/app-store-internal/validation.ts` — hierarchy project-link cascade planning
- `lib/store/app-store-internal/slices/work-item-actions.ts` — project cascade behavior for work-item updates
- `lib/store/app-store-internal/slices/work-comment-actions.ts` — work/document comment validation and optimistic submit path
- `lib/store/app-store-internal/slices/collaboration-channel-actions.ts` — channel post/comment validation and optimistic submit path
- `lib/store/app-store-internal/slices/collaboration-conversation-actions.ts` — chat-message sibling path
- `components/app/screens/project-creation.tsx` — project summary empty-state handling recheck
- `convex/app/auth_bootstrap.ts`, `convex/app/data.ts`, `convex/app/workspace_team_handlers.ts`, `convex/app/core.ts` — slug uniqueness recheck for retained-team routing assumptions
- `app/api/notifications/route.ts`, `lib/server/convex/notifications.ts`, `lib/store/app-store-internal/slices/notifications.ts`, `components/app/screens/inbox-screen.tsx` — notification batch-update recheck
- `tests/components/work-item-detail-screen.test.tsx`, `tests/components/work-surface-view.test.tsx`, `tests/components/chat-thread.test.tsx`, `tests/components/entity-context-menus.test.tsx` — current regression coverage for reviewed surfaces

## Hotspots (cumulative — updated as recurring risk families emerge)

- `hierarchy mutation side-effects` — new UI affordances now hit `updateWorkItem` directly on fields that can cascade across parent/child trees
- `presentation/domain validation drift` — shared input constraints exist, but submit gating still diverges across sibling surfaces

## Review status (updated every turn)

| Field | Value |
|-------|-------|
| **Review started** | `2026-04-24 14:50:14 BST` |
| **Last reviewed** | `2026-04-24 18:58:59 BST` |
| **Total turns** | `6` |
| **Open findings** | `0` |
| **Resolved findings** | `13` |
| **Accepted findings** | `19` |

---

## Turn 1 — 2026-04-24 14:50:14 BST

| Field | Value |
|-------|-------|
| **Commit** | `5f458a11ea1bc9b89bcc259f0096131114d1eeb9` |
| **IDE / Agent** | `Codex / GPT-5` |

**Summary:** Re-reviewed the `ui-enhancements` branch with the highest-risk families in mind: shared work-item mutation paths and the new cross-cutting character-limit infrastructure. The branch is directionally strong, but two real bug families remain open: hierarchy-wide project reassignment is now exposed through several unconfirmed UI paths, and the “global” rich-text limit rollout still leaves multiple min-length submit surfaces gating on non-empty text instead of shared validity.

**Outcome:** partial review
**Risk score:** high — the branch changes shared UI primitives, validation helpers, optimistic store flows, hierarchy mutations, and route/server contracts across many surfaces
**Change archetypes:** shared-ui, validation-contract, optimistic-state, hierarchy-mutation — the same shared helpers now drive list/board/detail/chat/inbox behavior and work-item tree updates
**Intended change:** deliver the large UI-enhancement pass plus repo-wide character-limit enforcement without changing backend data models
**Intent vs actual:** most of the requested capabilities landed, but two invariants did not hold across the new surfaces: hierarchy-affecting project changes no longer consistently require user confirmation, and min-length rich-text enforcement still is not applied at submit/disabled-state boundaries on several primary composers
**Confidence:** medium — the confirmed findings are code-evident and traced through sibling paths, but this turn concentrated on hotspot families rather than exhaustively re-reading every lower-risk styling/edit file in the branch
**Coverage note:** reviewed the cumulative branch diff/stat, then traced shared work-item update/cascade logic, detail/menu/list/board project mutation callers, shared input-constraint helpers, rich-text schema plumbing, work/comment/channel/chat optimistic submit flows, and the current regression tests covering those surfaces
**Finding triage:** no inherited external findings for this branch; all findings below were confirmed against the current tree
**Branch totality:** rescanned the full `main...ui-enhancements` file list and then deep-traced the highest-risk families across UI, shared helpers, store slices, schemas, server wrappers, and tests
**Sibling closure:** for project reassignment, checked detail-screen confirm flow, inline property popovers, right-click menus, and list/board regrouping drag paths; for character limits, checked work-item comments, work-item replies, channel posts, channel replies, and chat-message siblings
**Remediation impact surface:** validated how `updateWorkItem` cascades project changes across hierarchy items and linked description docs, and how comment/post/chat stores validate sanitized rich text after UI submit
**Residual risk / unknowns:** this turn did not fully re-review every lower-risk visual polish change in the 90-file branch, so more localized UX issues may still exist beyond the two confirmed families below

| Status | Count |
|--------|-------|
| Findings | 2 |

### Validation

- `git diff --stat main...HEAD -- . ':!.reviews/'` — passed
- `git diff --name-only main...HEAD -- . ':!.reviews/'` — passed
- `pnpm exec vitest run tests/components/work-item-detail-screen.test.tsx tests/components/work-surface-view.test.tsx tests/components/chat-thread.test.tsx tests/components/entity-context-menus.test.tsx` — passed (`4/4` files, `39/39` tests)
- `pnpm exec tsc --noEmit --pretty false` — not run this turn: branch head had already been typechecked earlier, but this review focused on code-evident behavior regressions and targeted surface tests

### Branch-totality proof

- **Non-delta files/systems re-read:** reviewed non-primary dependencies behind the diffed UI, including `lib/store/app-store-internal/validation.ts`, `lib/store/app-store-internal/slices/work-item-actions.ts`, `lib/store/app-store-internal/slices/work-comment-actions.ts`, `lib/store/app-store-internal/slices/collaboration-channel-actions.ts`, and the relevant schema/constraint modules
- **Prior open findings rechecked:** `n/a`
- **Prior resolved/adjacent areas revalidated:** `n/a`
- **Hotspots or sibling paths revisited:** revisited all branch paths that write `primaryProjectId` from the UI and all min-`>1` rich-text submit surfaces that now mount the new editor constraints
- **Dependency/adjacent surfaces revalidated:** checked slug-uniqueness server code to challenge a suspected retained-team routing bug, and checked notification batch update paths to challenge a suspected partial-success drift bug; neither became a confirmed finding on the current tree
- **Why this is enough:** the open findings are both shared-family regressions whose blast radius only became clear after tracing beyond the edited leaves into the underlying mutation and validation layers

### Challenger pass

- `done` — tried to disprove the first-pass concerns by checking three alternate explanations: global team slug uniqueness, notification-batch failure handling, and project-summary optionality. Those rechecks removed one suspected routing bug, removed one suspected project-summary bug, and sharpened the remaining findings into two confirmed, cross-surface bug families.

### Findings

#### B1-01 [BUG] High — `components/app/screens/work-item-inline-property-control.tsx:492` — new project-change affordances bypass the existing hierarchy confirmation contract

**What's happening:**
The detail surface still treats project changes as a hierarchy-wide action that needs confirmation: [work-item-detail-screen.tsx](../components/app/screens/work-item-detail-screen.tsx:1997) opens a confirm dialog when the hierarchy has more than one item, and [work-item-detail-screen.tsx](../components/app/screens/work-item-detail-screen.tsx:2975) explains that the update will affect parent and child items. The new inline/property affordances do not preserve that boundary. The inline project picker in [work-item-inline-property-control.tsx](../components/app/screens/work-item-inline-property-control.tsx:492) and [work-item-inline-property-control.tsx](../components/app/screens/work-item-inline-property-control.tsx:511), the new right-click project submenu in [work-item-menus.tsx](../components/app/screens/work-item-menus.tsx:193), and the new list/board regrouping paths in [work-surface-view.tsx](../components/app/screens/work-surface-view.tsx:667) and [work-surface-view.tsx](../components/app/screens/work-surface-view.tsx:1031) all call `updateWorkItem(..., { primaryProjectId })` directly with no preflight.

**Root cause:**
The “confirm before cascading a project change across a hierarchy” rule lives only in one presentation component (`WorkItemDetailScreen`) instead of living in a shared action/policy boundary. Once the branch added more UI entrypoints that mutate `primaryProjectId`, those new callers bypassed the only confirmation gate.

**Codebase implication:**
Changing the project on a child item from list/board/child-row surfaces, from the new context menu, or by dragging between project-grouped lanes can now silently rewrite `primaryProjectId` for the entire root+descendant hierarchy. Because `updateWorkItem()` recalculates `cascadeItemIds` and updates linked description docs too ([validation.ts](../lib/store/app-store-internal/validation.ts:236), [work-item-actions.ts](../lib/store/app-store-internal/slices/work-item-actions.ts:153)), the side effect is broader than a single-row visual edit.

**Solution options:**
1. **Quick fix:** route every UI-originated project change that can touch a hierarchy through the existing confirmation flow before calling `updateWorkItem`.
2. **Proper fix:** move cascade preflight into a shared work-item project-change action that reports whether the update would touch multiple items and requires an explicit confirmed branch before applying it.

**Remediation radius:**
- **Must fix now:** inline property control, right-click project menu, and list/board regrouping/reparenting paths that can set `primaryProjectId`
- **Should fix now if cheap/safe:** any other callers that compute grouped patches or otherwise derive `primaryProjectId` outside the detail-screen flow
- **Defer:** broader UX cleanup around how hierarchy-affecting edits are previewed, provided the confirmation invariant is restored first

**Prevention artifact:** add a regression test that exercises project reassignment from a non-detail surface on a multi-item hierarchy and asserts that the mutation does not fire until confirmation

**Investigate:**
Should any hierarchy-wide project change be confirm-gated regardless of surface, or are there explicitly safe cases (for example top-level items with no descendants) that can skip the dialog?

> `useAppStore.getState().updateWorkItem(item.id, { primaryProjectId: project.id })`

#### B1-02 [BUG] Medium — `components/app/screens/work-item-detail-screen.tsx:798` — the “global” rich-text character-limit rollout still leaves several min-length submit paths gated on non-empty text instead of shared validity

**What's happening:**
The branch introduced shared constraint helpers and rich-text min/max props, but several primary submit paths still check only raw truthiness of extracted text. Examples:
- sidebar/main work-item comment composers gate on `!contentText` in [work-item-detail-screen.tsx](../components/app/screens/work-item-detail-screen.tsx:798) and [work-item-detail-screen.tsx](../components/app/screens/work-item-detail-screen.tsx:1226), even though those editors mount `commentContentConstraints.min = 2` at [work-item-detail-screen.tsx](../components/app/screens/work-item-detail-screen.tsx:880) and [work-item-detail-screen.tsx](../components/app/screens/work-item-detail-screen.tsx:1381)
- work-item reply surfaces do the same in [work-item-detail-screen.tsx](../components/app/screens/work-item-detail-screen.tsx:998) / [work-item-detail-screen.tsx](../components/app/screens/work-item-detail-screen.tsx:1175) and [work-item-ui.tsx](../components/app/screens/work-item-ui.tsx:211) / [work-item-ui.tsx](../components/app/screens/work-item-ui.tsx:353)
- the channel post composer allows a one-character body because it gates on `!contentText` in [channel-ui.tsx](../components/app/collaboration-screens/channel-ui.tsx:541) and [channel-ui.tsx](../components/app/collaboration-screens/channel-ui.tsx:642), despite mounting `channelPostContentConstraints.min = 2` at [channel-ui.tsx](../components/app/collaboration-screens/channel-ui.tsx:600)

These submits then fall through to store-level validation, which still rejects them later with generic toasts like “Comment cannot be empty” ([work-comment-actions.ts](../lib/store/app-store-internal/slices/work-comment-actions.ts:31)) or “Post content must include at least 2 characters” ([collaboration-channel-actions.ts](../lib/store/app-store-internal/slices/collaboration-channel-actions.ts:59)).

**Root cause:**
The new constraint system was added at the editor/schema layer, but these composers kept their old leaf-level “non-empty text” guards and disabled-state logic. That duplicates a business rule in presentation code instead of consuming the shared validity contract that the branch just introduced.

**Codebase implication:**
The user-visible promise of this pass — “don’t let me submit invalid over/under-limit content; show the issue in the form” — is still broken on some of the busiest rich-text surfaces. One-character comments and one-character channel posts remain submittable from the UI and only fail later in the optimistic/store path, which is exactly the old failure mode this pass was meant to remove. The current tests passing on these surfaces confirms a coverage gap, not correctness.

**Solution options:**
1. **Quick fix:** wire each affected composer’s submit handler and button disabled state to a shared validity value rather than `getPlainTextContent(...).trim().length > 0`.
2. **Proper fix:** introduce a shared constrained rich-text composer wrapper/hook that owns `onValidityChange`, button gating, footer rendering, and submit eligibility so min/max rules cannot drift per surface.

**Remediation radius:**
- **Must fix now:** all rich-text composers with `minPlainTextCharacters > 1` on this branch: work-item comments, work-item replies, and channel post creation
- **Should fix now if cheap/safe:** any sibling surfaces with hidden stats/footers where submit gating still uses plain truthiness instead of shared validity
- **Defer:** broader UX refinements for counters/messages on min-`1` surfaces like direct/group chat, since those do not currently violate the minimum-length rule

**Prevention artifact:** add regression tests for one-character work-item comments/replies and one-character channel posts asserting that the submit button stays disabled and no store mutation fires

**Investigate:**
Sweep all `RichTextEditor` call sites using `showStats={false}` plus `minPlainTextCharacters` and verify that every submit handler/button reads shared validity rather than raw plain-text truthiness.

> `if (!contentText) { return }`

### Recommendations

1. **Fix first:** `B1-01` because it creates silent hierarchy-wide data mutations from newly added high-frequency UI surfaces.
2. **Then address:** `B1-02` because the branch’s headline “global character-limit enforcement” claim is still false on several core comment/post surfaces.
3. **Patterns noticed:** both open findings come from the same architectural drift: shared policy exists, but new presentation surfaces still call low-level store actions directly and reimplement business rules locally.
4. **Suggested approach:** centralize mutation/validation preflight at the shared action layer, then make the leaf UIs consume that shared contract instead of branching per surface.
5. **Defer on purpose:** lower-risk visual polish and non-hotspot UI nits until the hierarchy-mutation and validation invariants are restored.

---

## Turn 2 — 2026-04-24 15:31:22 BST

| Field | Value |
|-------|-------|
| **Commit** | `5f458a11ea1bc9b89bcc259f0096131114d1eeb9` |
| **IDE / Agent** | `Codex / GPT-5` |

**Summary:** Re-reviewed the current working tree after remediation using the same two hotspot families plus the externally reported contract issues. The fixes now move the hierarchy-confirmation rule into the shared work-item action boundary, close the non-primary reparent bypass, align rich-text submit gating with the shared validity contract, restore required join-code validation on the API contract, make bulk notification updates atomic from the route’s point of view, and allow empty profile titles end-to-end. No new open findings remained after the challenger pass.

**Outcome:** all clear
**Risk score:** high — shared store actions, route/server contracts, and multiple reused UI surfaces changed
**Change archetypes:** shared-policy, validation-contract, optimistic-state, hierarchy-mutation
**Intended change:** finish the UI-enhancement/platform-hardening branch without leaving cross-surface validation or hierarchy-mutation regressions
**Intent vs actual:** aligned on intent after remediation; the reviewed diffs now preserve the branch’s intended UX while restoring the missing invariants
**Confidence:** medium-high — branch-totality, hotspot rechecks, sibling closure, targeted regression reruns, and a final challenger pass all completed this turn; the weakest evidence remains manual browser QA for pointer-driven drag/drop UX
**Coverage note:** re-read the remediated shared boundaries and their primary callers, then reran focused and broader regression slices that cover the touched hierarchy, composer, notification, and route-contract families
**Finding triage:** externally supplied findings were revalidated against the current tree before action. Two were confirmed and fixed (`joinCodeSchema` empty input regression, notification partial-success semantics), one branch-created UX regression was additionally fixed (`profileTitleConstraints` optionality surfaced by the new client gating), and the remaining external observations were either intentional behavior changes or non-blocking notes.
**Branch totality:** reassessed the current working tree this turn, not just inherited review state
**Hotspot ledger:** re-reviewed this turn; both hotspot families are now closed
**Sibling closure:** completed across project reassignment surfaces (detail, inline chip, context menu, board/list drag, and detail parent reassignment) and rich-text min-length surfaces (work-item comments/replies and channel post/reply composers), plus the join-code and notification route siblings
**Remediation impact surface:** checked the store action contract, validation helper, route wrapper, server wrapper, backend mutation, and regression tests so the fixes hold at the boundary instead of only in one UI leaf
**Challenger pass:** completed — searched for remaining raw `updateWorkItem` project/parent mutation paths outside the shared confirmation flow, re-read the remediated diffs, and reran the broader touched-area regression slice
**Weakest-evidence areas:** manual browser QA for drag/drop pointer behavior and modal timing; no code or automated-test evidence currently suggests an open defect there

| Status | Count |
|--------|-------|
| Findings | 0 |

### Validation

- `pnpm exec tsc --noEmit --pretty false` — passed
- `pnpm exec vitest run tests/lib/store/work-item-actions.test.ts tests/components/work-item-project-cascade-confirmation.test.tsx tests/app/api/workspace-profile-route-contracts.test.ts` — passed (`3/3` files, `21/21` tests)
- `pnpm exec vitest run tests/components/chat-thread.test.tsx tests/components/document-ui.test.tsx tests/components/work-surface-view.test.tsx tests/components/work-item-detail-screen.test.tsx tests/components/entity-context-menus.test.tsx tests/components/inbox-screen.test.tsx tests/components/work-item-ui-comments-inline.test.tsx tests/components/work-item-labels-editor.test.tsx tests/components/work-item-project-cascade-confirmation.test.tsx tests/components/channel-ui.test.tsx tests/lib/store/work-item-actions.test.ts tests/lib/store/work-document-actions.test.ts tests/lib/server/convex-notifications.test.ts tests/app/api/asset-notification-invite-route-contracts.test.ts tests/app/api/team-collaboration-route-contracts.test.ts tests/app/api/workspace-profile-route-contracts.test.ts` — passed (`16/16` files, `106/106` tests)

### Resolution ledger

#### Resolved

- `B1-01` — hierarchy-wide project changes now route through a shared store-level confirmation contract, and the non-primary reparent path is covered too. Evidence: `lib/store/app-store-internal/validation.ts`, `lib/store/app-store-internal/slices/work-item-actions.ts`, `components/app/screens/use-work-item-project-cascade-confirmation.tsx`, `components/app/screens/work-item-detail-screen.tsx`, `components/app/screens/work-item-inline-property-control.tsx`, `components/app/screens/work-item-menus.tsx`, `components/app/screens/work-surface-view.tsx`, `tests/lib/store/work-item-actions.test.ts`, `tests/components/work-item-project-cascade-confirmation.test.tsx`.
- `B1-02` — rich-text min-length submit gating now uses shared limit state on the remaining busy composers rather than plain non-empty checks. Evidence: `components/app/screens/work-item-detail-screen.tsx`, `components/app/screens/work-item-ui.tsx`, `components/app/collaboration-screens/channel-ui.tsx`, `tests/components/work-item-detail-screen.test.tsx`, `tests/components/work-item-ui-comments-inline.test.tsx`, `tests/components/channel-ui.test.tsx`.
- `B2-01` — join-code route validation no longer accepts empty strings. Evidence: `lib/domain/input-constraints.ts`, `lib/domain/types-internal/schemas.ts`, `tests/app/api/team-collaboration-route-contracts.test.ts`.
- `B2-02` — bulk notification updates no longer expose partial-success semantics through `Promise.all`; the route now calls one server-side bulk mutation and only bumps read models after a successful batch. Evidence: `app/api/notifications/route.ts`, `convex/app/notification_handlers.ts`, `lib/server/convex/notifications.ts`, `tests/app/api/asset-notification-invite-route-contracts.test.ts`, `tests/lib/server/convex-notifications.test.ts`.
- `B2-03` — empty profile titles are now valid end-to-end, which prevents the new client-side character-limit gating from blocking profile saves for users whose persisted title is blank. Evidence: `lib/domain/input-constraints.ts`, `lib/domain/types-internal/schemas.ts`, `tests/app/api/workspace-profile-route-contracts.test.ts`.

#### Accepted / non-blocking observations

- Empty-group synthesis suppression when filters are active remains an intentional UX behavior change on this branch, not a correctness bug proven by the current code/tests.
- Dragging to a group lane clears `parentId` intentionally; that matches the requested “extract from parent” behavior for list/board surfaces.
- The `chat-thread.tsx` `typeof liveContent === "string"` ternary is dead-code cleanup only and not a correctness issue.
- The Convex bootstrap simplification note is architectural context, not a branch blocker.
- Blank project summaries/descriptions remaining blank is intentional and matches the explicit product request for this branch.

---

## Turn 3 — 2026-04-24 15:50:45 BST

| Field | Value |
|-------|-------|
| **Commit** | `5fbbcd89a4b5d7080c4b4bf63a1821260ec7a0ec` |
| **IDE / Agent** | `Codex / GPT-5` |

**Summary:** Repeated the review loop against the newly supplied findings. Three additional regressions were confirmed and fixed: retained team state now expires instead of persisting indefinitely after the live team disappears, same-workspace shell seed payload changes now rehydrate instead of being skipped by an overly coarse signature, and the new character-limit enforcement no longer bricks workspace/profile settings when legacy `logoUrl` / `avatarUrl` values are empty or URL-shaped. The remaining notes in this batch were either intentional UX changes, architectural observations, or false positives on the current tree.

**Outcome:** all clear
**Risk score:** high — this turn touched shared hydration, shared constraints, and route/schema compatibility
**Change archetypes:** hydration-contract, legacy-compatibility, transient-retention
**Intended change:** close the final shared-state and compatibility regressions without reopening the earlier UI-enhancement fixes
**Intent vs actual:** aligned on intent after remediation; the shared boundaries now behave coherently under route transitions, deleted-team scenarios, and legacy profile/workspace data
**Confidence:** medium-high — current branch state was reassessed this turn, the hotspot ledger was revisited, sibling closure was completed for the new bug families, targeted verification was rerun, and the challenger pass did not find a remaining blocker
**Coverage note:** re-read the provider/hook/constraint/schema diffs, validated the external findings against the current tree, and reran both the new focused proof set and a broader cross-surface regression slice
**Finding triage:** the “create group chat button disabled state” report is not a live bug on the current tree because the CTA footer is only rendered once participants exist; the remaining accepted notes below were likewise confirmed as intentional or non-blocking
**Branch totality:** reassessed on the current working tree, not inherited from Turn 2
**Hotspot ledger:** revisited this turn; no open hotspot families remain
**Sibling closure:** completed across retained-team callers, shell-seed hydration callers, and profile/workspace avatar/logo compatibility paths
**Remediation impact surface:** checked the client limit-state helper, shared schemas, provider hydrator, retained-team hook, and route-contract tests so the fixes hold across UI and API boundaries
**Challenger pass:** completed — challenged the batch for false positives, then reran the broader touched-area regression slice after the confirmed fixes landed
**Weakest-evidence areas:** manual browser QA for drag/drop pointer behavior remains the weakest evidence area, but no new code or test evidence indicates an open issue there

| Status | Count |
|--------|-------|
| Findings | 0 |

### Validation

- `pnpm exec tsc --noEmit --pretty false` — passed
- `pnpm exec vitest run tests/lib/use-retained-team-by-slug.test.tsx tests/components/convex-app-provider.test.tsx tests/app/api/workspace-profile-route-contracts.test.ts tests/lib/domain/input-constraints.test.ts` — passed (`4/4` files, `17/17` tests)
- `pnpm exec vitest run tests/components/chat-thread.test.tsx tests/components/document-ui.test.tsx tests/components/work-surface-view.test.tsx tests/components/work-item-detail-screen.test.tsx tests/components/entity-context-menus.test.tsx tests/components/inbox-screen.test.tsx tests/components/work-item-ui-comments-inline.test.tsx tests/components/work-item-labels-editor.test.tsx tests/components/work-item-project-cascade-confirmation.test.tsx tests/components/channel-ui.test.tsx tests/components/convex-app-provider.test.tsx tests/lib/store/work-item-actions.test.ts tests/lib/store/work-document-actions.test.ts tests/lib/server/convex-notifications.test.ts tests/lib/use-retained-team-by-slug.test.tsx tests/lib/domain/input-constraints.test.ts tests/app/api/asset-notification-invite-route-contracts.test.ts tests/app/api/team-collaboration-route-contracts.test.ts tests/app/api/workspace-profile-route-contracts.test.ts` — passed (`19/19` files, `116/116` tests)

### Resolution ledger

#### Resolved

- `B3-01` — retained team state now expires after a bounded grace window when the live team does not come back, which preserves transient-gap UX without letting stale team data persist indefinitely. Evidence: `hooks/use-retained-team-by-slug.ts`, `tests/lib/use-retained-team-by-slug.test.tsx`.
- `B3-02` — initial shell seed hydration now reapplies when same-workspace payload data changes, not just when workspace/user identity changes. Evidence: `components/providers/convex-app-provider.tsx`, `tests/components/convex-app-provider.test.tsx`.
- `B3-03` — the new character-limit enforcement now preserves backward compatibility for empty and URL-shaped `logoUrl` / `avatarUrl` values while still enforcing badge-length limits for real fallback text. Evidence: `lib/domain/input-constraints.ts`, `lib/domain/types-internal/schemas.ts`, `tests/lib/domain/input-constraints.test.ts`, `tests/app/api/workspace-profile-route-contracts.test.ts`.

#### Accepted / non-blocking observations

- `workspace-chat-ui.tsx` create-chat CTA gating report is not a live bug on the current tree because the footer button is not rendered until at least one participant is selected.
- Empty-group synthesis suppression when filters are active remains an intentional UX tradeoff rather than a proven correctness bug.
- Item-drop and lane-drop extraction behavior on the work surface remains intentional and should be validated in manual QA, but it is not a code defect relative to the requested behavior.
- The `chat-thread.tsx` dead-code ternary is cleanup-only.
- The `ConvexAppProvider` loading-contract observations are architectural notes, not blockers.
- The `pending-work-item-creations.ts` and `pending view config reconciliation` notes are positive findings, not defects.
- Top-level items still not becoming children via drag is intentional on this branch.

---

## Turn 4 — 2026-04-24 16:11:31 BST

| Field | Value |
|-------|-------|
| **Commit** | `acab9af2d14f1c19ee7235dbb9eb78c3e5588be0` |
| **IDE / Agent** | `Codex / GPT-5` |

**Summary:** Repeated the review loop on the new batch of findings and confirmed two real regressions. First, optimistic work-item creation was accepting caller-supplied work-item and description-document IDs without any server-side collision check, which could create duplicate domain IDs and break downstream `.unique()` reads. That family is now fixed end-to-end: the Convex handler rejects collisions, and the server wrapper maps those rejects to typed `409` application errors. Second, grouped `Add item` flows were discarding hierarchy-derived `parentId` defaults, so lanes grouped by epic/feature opened the create dialog detached from the selected parent. That is now fixed for both board and list entrypoints. The rest of the batch was either stale against the current tree, intentional product behavior, or architectural commentary rather than a live defect.

**Outcome:** all clear
**Risk score:** high — this turn touched the work-item creation contract and grouped create defaults in the main work-surface flow
**Change archetypes:** optimistic-id-contract, grouped-create-defaults
**Intended change:** close the remaining server-side collision and grouped-create regressions without widening scope into already triaged intentional UX behavior
**Intent vs actual:** aligned after remediation; optimistic IDs remain supported for local reconciliation, but the server now rejects collisions instead of trusting them blindly, and grouped create flows preserve hierarchy-derived defaults
**Confidence:** medium-high — current branch state was reassessed this turn, the new findings were validated against the live tree, sibling closure was completed for both bug families, and targeted verification was rerun across the handler, route, and UI entrypoints
**Coverage note:** re-read `createWorkItemHandler`, the `/api/items` route contract, grouped create defaults in `work-surface-view`, and the current create-dialog defaulting behavior before applying fixes
**Finding triage:** the repeated group-chat CTA report is still a false positive on the current tree because the CTA only renders once participants exist; the avatar/logo constraint regression is already fixed on this branch; the remaining repeated notes below remain intentional or non-blocking
**Branch totality:** reassessed on the current working tree, not inherited from prior turns
**Hotspot ledger:** revisited this turn; no open hotspot families remain
**Sibling closure:** completed across both client-supplied ID surfaces inside work-item creation (`id` and `descriptionDocId`) and both grouped create entrypoints (`BoardView` and `ListView`)
**Remediation impact surface:** checked the optimistic store path, Convex mutation handler, server wrapper error mapping, route-facing contract tests, and create-dialog default handling so the fix holds across UI and backend boundaries
**Challenger pass:** completed — challenged the batch for stale/false-positive findings, then reran the creation path and grouped-create tests after the confirmed fixes landed
**Weakest-evidence areas:** manual browser QA for drag/drop intent on extraction behavior remains the weakest evidence area, but no new code or test evidence indicates a correctness bug there

| Status | Count |
|--------|-------|
| Findings | 0 |

### Validation

- `pnpm exec tsc --noEmit --pretty false` — passed
- `pnpm exec vitest run tests/convex/work-item-handlers.test.ts tests/components/work-surface-view.test.tsx` — passed (`2/2` files, `20/20` tests)
- `pnpm exec vitest run tests/convex/work-item-handlers.test.ts tests/lib/server/convex-work.test.ts tests/components/work-surface-view.test.tsx tests/app/api/work-route-contracts.test.ts` — passed (`4/4` files, `44/44` tests)

### Resolution ledger

#### Resolved

- `B4-01` — optimistic work-item creation no longer trusts caller-supplied IDs blindly. The server now rejects collisions for both `args.id` and `args.descriptionDocId` before inserting, and the server wrapper maps those failures to typed `409` application errors. This preserves the optimistic reconciliation contract without allowing duplicate domain IDs to corrupt `.unique()` reads later. Evidence: `convex/app/work_item_handlers.ts`, `lib/server/convex/work.ts`, `tests/convex/work-item-handlers.test.ts`, `tests/lib/server/convex-work.test.ts`.
- `B4-02` — grouped `Add item` flows now preserve hierarchy-derived `parentId` defaults, so lanes grouped by epic/feature open the create dialog scoped to the selected parent instead of dropping the new item outside the group. Evidence: `components/app/screens/work-surface-view.tsx`, `tests/components/work-surface-view.test.tsx`.

#### Accepted / non-blocking observations

- `workspace-chat-ui.tsx` create-chat CTA gating report remains a false positive on the current tree because the footer CTA is not rendered until at least one participant is selected.
- `team-settings-screen.tsx` summary min-length gating is stricter UX, but it matches the existing backend contract and now provides inline feedback instead of a save-time failure.
- Empty-group synthesis suppression when filters are active remains an intentional UX tradeoff rather than a proven correctness bug.
- Item-drop and lane-drop extraction behavior on the work surface remains intentional and should be validated in manual QA, but it is not a code defect relative to the requested behavior.
- The `chat-thread.tsx` dead-code ternary is cleanup-only.
- The Convex bootstrap/loading-contract notes are architectural observations, not blockers.
- The `pending-work-item-creations.ts` and pending view reconciliation notes are positive findings, not defects.
- The retained-team grace timeout behavior is intentional and now bounded.
- Top-level items still not becoming children via drag is intentional on this branch.

---

## Turn 5 — 2026-04-24 16:31:16 BST

| Field | Value |
|-------|-------|
| **Commit** | `d441d75fd9acbd5700ce2d55df73d255b127da71` |
| **IDE / Agent** | `Codex / GPT-5` |

**Summary:** Repeated the review loop on the latest batch and found one real shell-state regression plus one cheap contract drift worth closing while the code was open. The shell was retaining stale workspace context indefinitely when the live workspace disappeared; that is now fixed with a bounded retention hook that expires retained values after a short grace period and clears immediately when the retention key changes. I also aligned the create-work-item dialog with the existing dialog-state model by honoring `defaultValues.dueDate` instead of silently dropping it. The rest of the batch was either already fixed on the current branch, intentional product behavior, or architectural commentary rather than a live defect.

**Outcome:** all clear
**Risk score:** medium-high — this turn touched shared shell retention behavior and the work-item create-dialog contract
**Change archetypes:** shell-retention, dialog-contract-alignment
**Intended change:** close the remaining stale shell-context bug and eliminate a small create-dialog contract mismatch without widening back into already triaged intentional behavior
**Intent vs actual:** aligned after remediation; transient shell retention remains in place to avoid flicker, but stale workspace/user context can no longer persist indefinitely, and dialog defaults now match the typed contract they advertise
**Confidence:** medium-high — current branch state was reassessed this turn, the live shell finding was validated against the code, sibling closure was completed for both workspace and current-user shell retention, and targeted verification was rerun on the new hook and dialog path
**Coverage note:** re-read `AppShell`, the retained shell-context usage, the create-dialog state model, and the `CreateWorkItemDialog` submit path before applying fixes
**Finding triage:** the repeated avatar/logo compatibility issue and the repeated empty-profile-title issue are already fixed on the current branch; the remaining drag/bootstrap/empty-group notes below remain intentional or non-blocking
**Branch totality:** reassessed on the current working tree, not inherited from prior turns
**Hotspot ledger:** revisited this turn; no open hotspot families remain
**Sibling closure:** completed across both shell-retained values (`currentUser` and `workspace`) and the create-dialog default-value contract (`CreateDialogState` and `CreateWorkItemDialog`)
**Remediation impact surface:** checked the shell fallback rendering path, the new retained-value hook behavior, the dialog-state model, and the work-item create submit path so the fixes hold across UI state and dialog boundaries
**Challenger pass:** completed — challenged the new batch for already-fixed and non-live reports, then reran the focused proof set after the confirmed fixes landed
**Weakest-evidence areas:** there is still no dedicated `AppShell` component test harness, so the shell fix is verified through the extracted retention hook rather than a full shell integration test

| Status | Count |
|--------|-------|
| Findings | 0 |

### Validation

- `pnpm exec tsc --noEmit --pretty false` — passed
- `pnpm exec vitest run tests/lib/use-expiring-retained-value.test.tsx tests/components/create-dialogs.test.tsx` — passed (`2/2` files, `21/21` tests)

### Resolution ledger

#### Resolved

- `B5-01` — stale shell context can no longer persist indefinitely when the live workspace or current user disappears. `AppShell` now uses a bounded retained-value hook that preserves transient values briefly for flicker resistance, expires them after a grace window, and clears immediately when the active workspace/user key changes. Evidence: `hooks/use-expiring-retained-value.ts`, `components/app/shell.tsx`, `tests/lib/use-expiring-retained-value.test.tsx`.
- `B5-02` — the create-work-item dialog now honors `defaultValues.dueDate`, so its runtime behavior matches the wider `CreateDialogState` contract instead of silently dropping the field. Evidence: `components/app/screens/create-work-item-dialog.tsx`, `lib/store/app-store-internal/types.ts`, `tests/components/create-dialogs.test.tsx`.

#### Accepted / non-blocking observations

- The repeated `workspaceFallbackBadgeConstraints` / `profileTitleConstraints` reports are stale; both were fixed in earlier turns and remain covered by tests on the current branch.
- `team-settings-screen.tsx` summary min-length gating is stricter UX, but it matches the existing backend contract and now provides inline feedback instead of a save-time failure.
- Empty-group synthesis suppression when filters are active remains an intentional UX tradeoff rather than a proven correctness bug.
- Item-drop and lane-drop extraction behavior on the work surface remains intentional and should be validated in manual QA, but it is not a code defect relative to the requested behavior.
- The `chat-thread.tsx` dead-code ternary is cleanup-only.
- `getInitialShellSeedSignature` serializing the full seed is a potential performance footgun to watch, but it is not a proven blocker on the current branch and the broader stale-seed correctness bug was already fixed.
- The Convex bootstrap/loading-contract and legacy-sync notes are architectural observations, not blockers.
- Empty epic/feature lanes still cannot derive `parentId` defaults without a child-type context; that remains a known design limitation rather than a correctness bug.
- The `pending-work-item-creations.ts` and pending view reconciliation notes are positive findings, not defects.
- The retained-team grace timeout behavior is intentional and bounded.
- Top-level items still not becoming children via drag is intentional on this branch.

---

## Turn 6 — 2026-04-24 18:58:59 BST

| Field | Value |
|-------|-------|
| **Commit** | `653aa3a3aaf07e87e0d5dfb8859c779c3155f235` |
| **IDE / Agent** | `Codex / GPT-5` |

**Summary:** Repeated the review loop on the newest batch and confirmed one real create-dialog regression. `CreateWorkItemDialog` was accepting `defaultValues.assigneeId` whenever the user existed globally, even if that user was not a member of the selected team, which turned some grouped “Add item” flows into server-side failures with a hidden invalid assignee. That path is now fixed by validating prefilled assignees against the selected team membership set and clearing stale assignee state whenever the selected team changes. The other new high-signal report in this batch — duplicate dnd-kit IDs when child items are visible both top-level and inside disclosures — was a false positive on the current tree once traced through `getContainerItemsForDisplay`, which already suppresses top-level child rendering whenever the parent is visible.

**Outcome:** all clear
**Risk score:** medium-high — this turn touched the main work-item create dialog and revalidated the work-surface child-rendering path
**Change archetypes:** dialog-default-validation, sibling-closure
**Intended change:** close the latest create-flow regression without widening into already accepted work-surface UX tradeoffs
**Intent vs actual:** aligned after remediation; grouped create flows still preserve useful defaults, but they no longer carry hidden invalid assignee IDs across team boundaries
**Confidence:** medium-high — current branch state was reassessed this turn, the reported finding was validated against the live tree, the DnD report was disproved by tracing the actual render path, and targeted verification was rerun
**Coverage note:** re-read `CreateWorkItemDialog` team/assignee defaulting, team-member option derivation, grouped create entrypoints, and the work-surface child-rendering helper before applying fixes
**Finding triage:** the assignee/team-membership issue was confirmed and fixed; the duplicate DnD ID report was not live on the current tree because children with visible parents are already removed from the top-level render path; the remaining repeated notes in the external batch remain previously accepted, stale, or intentional
**Branch totality:** reassessed on the current working tree, not inherited from prior turns
**Hotspot ledger:** revisited this turn; no open hotspot families remain
**Sibling closure:** completed across the create-dialog’s initial defaulting path and the runtime team-change path so hidden invalid assignees cannot survive either entrypoint
**Remediation impact surface:** checked the grouped create entrypoints, the create dialog’s selected-team state, assignee option derivation, and submit payload so the fix holds across UI prefill and mutation boundaries
**Challenger pass:** completed — challenged the batch by tracing the alleged duplicate-DnD family through the actual list/board container filtering logic before deciding not to keep that patch
**Weakest-evidence areas:** manual browser QA for drag/drop intent and sticky-header presentation remains the weakest evidence area, but this turn did not surface a correctness bug there

| Status | Count |
|--------|-------|
| Findings | 0 |

### Validation

- `pnpm exec tsc --noEmit --pretty false` — passed
- `pnpm exec vitest run tests/components/create-dialogs.test.tsx tests/components/work-surface-view.test.tsx` — passed (`2/2` files, `32/32` tests)

### Resolution ledger

#### Resolved

- `B6-01` — `CreateWorkItemDialog` now validates `defaultValues.assigneeId` against the selected team’s membership set, not global user existence, and it clears stale assignee state if the current team no longer contains the selected user. This prevents grouped “Add item” flows from submitting a hidden cross-team assignee and failing server-side with “Assignee must belong to the selected team.” Evidence: `components/app/screens/create-work-item-dialog.tsx`, `tests/components/create-dialogs.test.tsx`.

#### Accepted / non-blocking observations

- The duplicate dnd-kit ID report for child items rendered both top-level and in disclosures is a false positive on the current tree. `getContainerItemsForDisplay()` already removes a child from the top-level render path whenever its parent is also visible, so the branch does not register the same draggable/droppable IDs twice in one `DndContext`. Evidence: `components/app/screens/helpers.ts`, `components/app/screens/work-surface-view.tsx`.
