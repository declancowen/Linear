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
- `components/app/screens/work-surface-view/calendar-view.tsx`, `components/app/screens/work-surface-view/timeline-bars.tsx`, `components/app/screens/work-surface-view/timeline-view.tsx` — calendar/timeline item menus, hover positioning, all-day layout, and hidden scrollbars
- `components/app/screens/inbox-screen.tsx`, `components/app/screens/inbox-ui.tsx` — inbox split-pane default sizing
- `components/app/shell.tsx`, `electron/main.cjs`, `desktop/renderer/desktop-app.tsx`, `lib/server/desktop-session.ts` — desktop app min-width, auth persistence, notification behavior, and app-download icon
- `app/api/auth/desktop/session/refresh/route.ts`, `app/api/channel-posts/[postId]/comments/[commentId]/route.ts`, `convex/app/collaboration_handlers.ts`, `lib/server/convex/collaboration.ts` — new desktop refresh and channel comment-delete route contracts
- `package.json`, `pnpm-lock.yaml`, `vitest.config.ts` — CI dependency audit remediation and full-suite timeout stability

## Hotspots (cumulative — updated as recurring risk families emerge)

- `hierarchy mutation side-effects` — new UI affordances now hit `updateWorkItem` directly on fields that can cascade across parent/child trees
- `presentation/domain validation drift` — shared input constraints exist, but submit gating still diverges across sibling surfaces
- `context-menu drag initiation parity` — added Turn 9 after Codex PR review caught right-click calendar drags arming move state

## Review status (updated every turn)

| Field | Value |
|-------|-------|
| **Review started** | `2026-04-24 14:50:14 BST` |
| **Last reviewed** | `2026-05-27 18:08:27 BST` |
| **Total turns** | `9` |
| **Open findings** | `0` |
| **Resolved findings** | `16` |
| **Accepted findings** | `19` |

---

## Turn 9 — 2026-05-27 18:08:27 BST

| Field | Value |
|-------|-------|
| **Commit** | `pending Turn 9 commit` |
| **IDE / Agent** | `Codex / GPT-5` |

**Summary:** Imported the CI failure and the first Codex PR review thread for PR #40. Two live issues were fixed: the high-severity `tmp <0.2.6` audit failure from the Electron packaging dependency chain, and right-click/context-menu pointer starts on timed calendar events arming move drag state. I also hardened the sibling timeline resize path and moved the normal Vitest timeout to the same 15s budget already used by coverage runs, because the full suite timed out three otherwise-passing long UI tests under parallel load.

**Outcome:** all clear after fixes
**Risk score:** high — the branch is a broad presentation/platform PR and this turn touched CI dependency policy plus calendar/timeline drag affordances
**Change archetypes:** PR-review import, dependency-security gate, shared interaction affordance, test harness stability
**Intended change:** close CI and Codex review findings without changing product semantics or adding new bypasses
**Intent vs actual:** package-manager overrides now force the vulnerable transitive `tmp` dependency to the patched version; calendar move/resize and timeline resize initiation now ignore non-primary pointer buttons so context menus do not schedule edits
**Confidence:** high — the exact PR-review variant and a sibling timeline resize variant have regression coverage, the audit gate now exits cleanly, and the full `pnpm check` gate passed
**Coverage note:** reviewed the current PR review thread via thread-aware GitHub fetch, the failed CI audit logs, calendar timed drag initiation, calendar resize handles, timeline bar pointer capture/resize handles, package override lockfile shape, Vitest timeout config, and the current branch diff/preflight output
**Finding triage:** one Codex PR review thread remains unresolved on GitHub until this fix is pushed, but the current local tree resolves the behavior; the CI failure is resolved locally and will rerun after push
**Static/analyzer evidence:** `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` passed new-only gates with introduced dead code `0`, introduced complexity `0`, introduced duplication `0`; diff-review/architecture preflights still show inherited advisory Fallow debt outside this turn
**Architecture impact:** interaction rules stay owned by the calendar/timeline presentation components that own drag initiation; dependency remediation is encoded at the package-manager boundary instead of weakening CI
**Bug classes / invariants checked:** Affordance Parity, Preservation, Lifecycle/Transient Containers, third-party dependency exposure; non-primary pointer actions must not mutate schedule state, and high-severity dependency audit failures must be fixed at dependency resolution
**Branch totality:** rechecked the current branch state after the local fixes, including prior context-menu/calendar/timeline hotspots and CI gate parity
**Sibling closure:** calendar timed move, calendar resize start/end, timeline bar drag capture, and timeline resize start/end were checked for non-primary pointer behavior
**Remediation impact surface:** patched `calendar-view.tsx`, `timeline-bars.tsx`, `package.json`, `pnpm-lock.yaml`, `vitest.config.ts`, and added regression coverage in `work-surface-view.test.tsx`
**Residual risk / unknowns:** GitHub CI and the Codex review thread need to refresh after push; Fallow preflight still reports inherited advisory inventory, but the changed-file/new-only gate passed

| Source | Finding | Current status | Bug class | Missed invariant / variant | Action |
|--------|---------|----------------|-----------|----------------------------|--------|
| GitHub CI | `pnpm audit:deps` failed on `tmp <0.2.6` via `electron-builder > app-builder-lib > @malept/flatpak-bundler > tmp-promise > tmp` | Resolved locally | dependency-security gate | High-severity dependency audit failures must be fixed at resolution, not ignored in CI | Added targeted `tmp-promise>tmp: 0.2.6` pnpm override and regenerated lockfile |
| Codex PR review | Right-clicking a timed calendar event could schedule a move drag while opening the context menu | Resolved locally | Affordance Parity / Preservation | Non-primary pointer actions must not arm schedule mutation paths | Gated calendar move/resize initiation on primary button and added right-click regression test |
| Local sibling sweep | Timeline resize handles also accepted non-primary pointer starts | Hardened | Affordance Parity | Context-menu pointer variants should not start resize behavior | Gated timeline resize handles and added sibling regression check |

### Validation

- `python3 .../gh-address-comments/scripts/fetch_comments.py` — passed; one unresolved Codex PR review thread imported
- `gh run view 26525473909 --log-failed` — passed; CI failure identified as `pnpm audit:deps`
- `pnpm audit:deps` — passed; only low/moderate advisories remain
- `pnpm exec vitest run tests/components/work-surface-view.test.tsx --reporter verbose` — passed (`65` tests)
- `pnpm exec prettier --check components/app/screens/work-surface-view/calendar-view.tsx components/app/screens/work-surface-view/timeline-bars.tsx tests/components/work-surface-view.test.tsx vitest.config.ts package.json pnpm-lock.yaml` — passed
- `git diff --check` — passed
- `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` — passed new-only gate
- `pnpm check` — passed: lint, typecheck, full Vitest (`204` files, `1196` tests), build, desktop smoke
- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh` — completed; no new blocking finding
- `/Users/declancowen/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — completed; no new branch-specific architecture blocker

### Branch-totality proof

- **Non-delta files/systems re-read:** CI workflow gate order, package overrides, PR review thread state, calendar/timeline drag helpers, work-surface regression tests, Vitest config
- **Prior open findings rechecked:** no prior open local findings; PR review thread is resolved in the local tree and pending push
- **Prior resolved/adjacent areas revalidated:** context-menu wrapping for calendar/timeline items remains intact; calendar click, drag, resize, and timeline selection tests still pass
- **Hotspots or sibling paths revisited:** right-click timed event, timed resize handles, timeline resize handles, timeline non-primary bar pointer capture, dependency audit gate
- **Dependency/adjacent surfaces revalidated:** `pnpm why tmp` confirmed `tmp@0.2.6` after local install; `pnpm audit:deps` confirmed the high advisory is gone
- **Why this is enough:** the live review bug was at the pointer-to-drag boundary, and every sibling path that starts the same class of schedule edit now rejects non-primary pointer starts with regression coverage

### Challenger pass

- `done` — assumed the fix only covered the exact reviewed line and searched for sibling drag/resize starts; this found and hardened calendar resize and timeline resize starts as well.

### Resolved / Carried / New findings

#### Resolved

- `T9-01` — CI high dependency audit failure
  - Fingerprint: `package-manager override / tmp-promise>tmp / high audit GHSA-ph9p-34f9-6g65`
  - Evidence: `pnpm audit:deps` exits `0`; lockfile resolves `tmp@0.2.6`
  - Verification: `pnpm audit:deps`, `pnpm check`
- `T9-02` — Codex PR review timed calendar right-click drag
  - Fingerprint: `calendar timed event / non-primary pointer / scheduleTimedMoveDrag`
  - Evidence: `scheduleTimedMoveDrag` and `beginTimedDrag` reject `event.button !== 0`
  - Verification: `tests/components/work-surface-view.test.tsx` right-click timed drag regression
- `T9-03` — sibling timeline resize non-primary pointer start
  - Fingerprint: `timeline resize handle / non-primary pointer / onResizeStart`
  - Evidence: timeline resize handlers reject non-primary pointer starts
  - Verification: `tests/components/work-surface-view.test.tsx` timeline resize sibling check

#### Carried

- None.

#### New

- None.

### Recommendations

1. **Fix first:** push this turn so GitHub CI and Codex review refresh against the fixed commit.
2. **Patterns noticed:** adding context-menu wrappers around draggable surfaces needs a pointer-button audit on every drag/resize entrypoint, not only the visible card body.
3. **Suggested approach:** keep drag initiation guards local to the presentation components that own pointer interactions, and keep dependency audit fixes in pnpm overrides until upstream packages ship patched transitive ranges.
4. **Defer on purpose:** inherited Fallow advisory inventory and moderate/low dependency advisories remain outside this PR-review fix loop.

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

---

## Turn 7 — 2026-04-24 19:13:19 BST

| Field | Value |
|-------|-------|
| **Commit** | `0cdf9e87c9a92165011e71382789dedf7915c10f` |
| **IDE / Agent** | `Codex / GPT-5` |

**Summary:** Repeated the loop again because the newly supplied P1 on pending view overrides is real on the current tree. `updateViewConfig` was leaving `pendingViewConfigById` populated after successful mutation completion, so if the server later produced a different final view config than the optimistic patch, `reconcilePendingViews()` would keep re-applying stale local data indefinitely instead of converging. The shared view slice now clears the pending override on success as well as failure, guarded by the same pending token so newer in-flight edits are not disrupted.

**Outcome:** all clear
**Risk score:** medium-high — this turn touched the shared optimistic view-config reconciliation path
**Change archetypes:** optimistic-state, convergence-contract
**Intended change:** close the last confirmed stale-override bug without reopening already accepted UI/legacy observations
**Intent vs actual:** aligned after remediation; optimistic view edits still apply immediately, but they no longer persist as immortal local overrides after a successful sync
**Confidence:** medium-high — the new finding was validated directly against the current tree, fixed in the shared action boundary, and rerun through the existing reconciliation tests plus a new success-path regression
**Coverage note:** re-read `updateViewConfig`, `reconcilePendingViews`, the pending-view tests, and the route/sync path before applying the fix
**Finding triage:** the pending-view override report was confirmed and fixed; the repeated legacy snapshot, fallback badge, team-summary, drag-extraction, sticky-header, and dead-code notes remain previously accepted, stale, or intentional
**Branch totality:** reassessed on the current working tree, not inherited from prior turns
**Hotspot ledger:** revisited this turn; no open hotspot families remain
**Sibling closure:** completed across both mutation outcomes for pending view config (`success` and `failure`) so the pending token lifecycle is now coherent
**Remediation impact surface:** checked the shared view slice, the optimistic merge path, and the read-model reconciliation tests so the fix holds across local updates and incoming server state
**Challenger pass:** completed — challenged the new batch by checking whether the route/sync layer guaranteed exact-match readback; it does not, so the shared store-level fix was necessary
**Weakest-evidence areas:** manual browser QA remains weakest for pointer-driven work-surface changes, but no open code-level findings remain in the current review batch

| Status | Count |
|--------|-------|
| Findings | 0 |

### Validation

- `pnpm exec tsc --noEmit --pretty false` — passed
- `pnpm exec vitest run tests/lib/store/view-slice.test.ts tests/lib/app-store-read-model-merge.test.ts` — passed (`2/2` files, `19/19` tests)

### Resolution ledger

#### Resolved

- `B7-01` — pending optimistic view overrides are now cleared on successful `updateViewConfig` completion as well as on failure. This prevents `reconcilePendingViews()` from reapplying stale local patches forever when the eventual server state differs from the optimistic patch. The existing pending token guard still protects newer edits from older completions. Evidence: `lib/store/app-store-internal/slices/views.ts`, `tests/lib/store/view-slice.test.ts`, `tests/lib/app-store-read-model-merge.test.ts`.

---

## Turn 8 — 2026-05-27 17:46:30 BST

| Field | Value |
|-------|-------|
| **Commit** | `d88d288d326dad7dc7eacc5b6cef476a982bc391` |
| **IDE / Agent** | `Codex / GPT-5` |

**Summary:** Repeated the review loop for the large work-surface, collaboration, desktop-auth, and responsive-layout batch. No live blocking bug remains in the current tree. The implementation now preserves the existing ownership boundaries: work-item context menus still use the shared work-item mutation and project-cascade confirmation path, view/project editing stays in the managed create-dialog boundary, channel comment deletion is enforced at the route/Convex/store layers, desktop session refresh is owned by the desktop-session server helper plus renderer adapter, and responsive calendar/timeline/inbox changes remain presentation-local.

**Outcome:** all clear
**Risk score:** high — this batch touches shared UI actions, calendar/timeline/list/board interaction paths, channel mutation contracts, desktop auth/session persistence, and Electron shell behavior
**Change archetypes:** shared-ui, route-contract, optimistic-state, desktop-auth, presentation-layout, static-fitness
**Intended change:** implement the requested right-click edit/open actions, view editing, channel delete behavior, desktop session persistence, calendar/timeline positioning/layout fixes, private-task defaults, inbox split sizing, sidebar/status icon fixes, and Electron min-width/download/notification polish
**Intent vs actual:** aligned after remediation; the latest right-click clarification is covered with `Open item` and `Edit item`, fixed label icons on menu triggers, actual state/project/user icons in option rows, and edit handlers wired on list, board, timeline, and calendar surfaces
**Confidence:** high for targeted behavior and contracts; medium-high for visual polish because no manual browser screenshot pass was run in this review turn
**Coverage note:** re-read the high-risk implementation paths after fixes: `work-item-menus`, list/board/timeline/calendar context-menu wrappers, channel comment delete route/store/Convex paths, desktop token refresh flow, inbox split pane, work-surface controls, and calendar hover/all-day layout
**Finding triage:** no new live findings after the final loop. Fallow changed-file audit passes with `0` introduced dead-code, duplication, or complexity findings; remaining Fallow complexity findings are inherited Electron findings outside this batch.
**Branch totality:** reviewed the current working tree after all final edits, not just the last icon patch
**Hotspot ledger:** revisited; no open hotspot family remains for this batch
**Sibling closure:** checked list, board, timeline, calendar, private-task, channel post/comment, desktop renderer, app route, and Electron shell siblings for the requested behaviors
**Remediation impact surface:** verified UI action wiring, optimistic store updates, route/server wrappers, Convex handler ownership checks, desktop token lifecycle, and responsive layout classes/tests
**Challenger pass:** completed — challenged likely weak spots around project/view edit regression, private-task hidden project/assignee paths, context-menu edit vs open behavior, app-session persistence failure handling, and route contract/ownership bypasses
**Weakest-evidence areas:** visual layout still deserves manual QA in the running app for all viewport extremes, even though targeted tests/build/static checks pass

| Status | Count |
|--------|-------|
| Findings | 0 |

### Validation

- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh` — passed
- `/Users/declancowen/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — passed
- `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` — passed; introduced findings `0`, duplication clone groups `0`, dead code `0`
- `pnpm lint` — passed
- `pnpm typecheck` — passed
- `git diff --check` — passed
- `pnpm build` — passed
- `pnpm exec vitest run tests/components/work-item-menus.test.tsx tests/components/group-chip-popover.test.tsx tests/components/work-surface-view.test.tsx tests/components/inbox-ui.test.tsx tests/components/work-item-detail-screen.test.tsx tests/components/entity-context-menus.test.tsx tests/components/views-screen.test.tsx tests/components/properties-chip-popover.test.tsx tests/components/create-dialogs.test.tsx tests/lib/domain/default-views.test.ts tests/lib/store/work-item-actions.test.ts tests/lib/store/collaboration-channel-actions.test.ts tests/lib/server/convex-collaboration.test.ts tests/app/api/platform-route-contracts.test.ts tests/app/auth-route-contracts.test.ts tests/electron/desktop-notifications.test.ts tests/electron/desktop-updates.test.ts tests/lib/browser/desktop-notifications.test.ts tests/desktop/renderer-smoke.test.tsx` — passed (`19/19` files, `247/247` tests)

### Resolution ledger

#### Confirmed all-clear requirements

- View editing is wired through the same managed create-dialog path as project editing, and project editing remains covered.
- Work-item context menus expose `Open item` and `Edit item`; edit is available on list, board, timeline, and calendar entries.
- Timeline and calendar views use the shared work-item context menu rather than bespoke one-off actions.
- Private-task views default to board layout and hide project/assignee affordances.
- Channel comments can be deleted by owners through the UI, store, route, and Convex mutation; unauthorized delete attempts are rejected.
- Desktop sessions can be refreshed from bearer tokens so the Electron app can stay signed in across restarts.
- Calendar/timeline popovers and overlays stay within the main surface and hidden-scrollbar/all-day layout behavior is covered by targeted tests.
- Responsive toolbar chips hide overflowing values at narrow widths, and the Electron main window has a minimum width to preserve primary controls.

#### Accepted / non-blocking observations

- Fallow still reports inherited Electron complexity in `electron/main.cjs`, but the changed-file gate has `0` introduced complexity findings.
- No manual browser/screenshot pass was run for this final batch; rely on the focused React/component tests, build, and static checks for this PR, with manual QA recommended for calendar/timeline edge viewports.
