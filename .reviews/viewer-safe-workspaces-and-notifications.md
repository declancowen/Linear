# Review: Viewer-Safe Workspaces And Notifications

## Project context (captured on Turn 1 — not re-detected on subsequent turns)

| Field | Value |
|-------|-------|
| **Repository** | `Linear` |
| **Remote** | `https://github.com/declancowen/Linear.git` |
| **Branch** | `cleanup/settings-refactor-and-electron` |
| **Repo type** | `single repo` |
| **Stack** | `Next.js App Router / Convex / Zustand / TypeScript / Electron` |
| **Packages affected** | `n/a` |
| **OS** | `Darwin 25.4.0` |
| **Package manager** | `pnpm 10.32.0` |
| **Node** | `v25.8.0` |
| **Python** | `n/a` |

## Scope (cumulative — updated each turn as new files are touched)

Files and areas reviewed across all turns:
- `components/app/screens.tsx` — viewer-scoped collection layout selection and workspace views/projects directory controls
- `components/app/shell.tsx` — notification modal selection, routing, active-target suppression, archive/open/dismiss actions
- `lib/domain/selectors-internal/work-items.ts` — context-aware empty-group synthesis for unfiltered work surfaces
- `components/app/rich-text-editor.tsx` and rich-text callsites — character-limit enforcement and stats presentation defaults
- `components/app/field-character-limit.tsx` — character-limit interface after hiding count callouts
- `components/app/screens/work-item-detail-screen.tsx` — explicit rich-text stats hiding and work item detail rendering paths
- `components/app/collaboration-screens/channel-ui.tsx` — explicit rich-text stats hiding in constrained composer surfaces
- `app/api/chats/[chatId]/calls/route.ts` and API route tests — typed application-error handling with scoped invalidation side effects
- `components/providers/convex-app-provider.tsx` and retained-value hooks — lint-safe React hook usage
- `components/app/notification-routing.ts` — notification href resolution and active-target suppression helpers
- `.github/workflows/ci.yml` — Convex codegen behavior when CI has no deployment secret
- `hooks/use-scoped-read-model-refresh.ts` — stable scoped key effect dependencies
- `package.json` and `pnpm-lock.yaml` — dependency audit overrides for high-severity transitive vulnerabilities
- `tests/*` impacted suites — viewer config, empty groups, notification routing, document presence, route contracts, collaboration wrappers

## Review status (updated every turn)

| Field | Value |
|-------|-------|
| **Review started** | `2026-04-29 16:16:33 BST` |
| **Last reviewed** | `2026-04-29 17:20:19 BST` |
| **Total turns** | `3` |
| **Open findings** | `0` |
| **Resolved findings** | `25` |
| **Accepted findings** | `9` |

---

## Turn 3 — 2026-04-29 17:20:19 BST

| Field | Value |
|-------|-------|
| **Commit** | `714cbd1f` (working tree updated after this base) |
| **IDE / Agent** | `unknown / Codex` |
| **Risk score** | `High` |

**Summary:** Continued the interrupted review loop from Turn 2, re-imported the supplied PR bugs/flags against the current tree, checked PR #29 review threads, and ran a challenger pass across the viewer override, notification, rich-text, scoped refresh, and Electron runtime surfaces. Most supplied items were already fixed or intentional product/architecture choices. Five low/medium current-tree issues were still worth resolving: the branch carried unused duplicate Electron `.mjs` entrypoints that drifted from the real `.cjs` runtime, notification modal route data still subscribed to the full notifications array, `SavedViewsBoard` still exposed a dead required `editable` type prop, viewer override merge checks used truthiness instead of presence checks, and the rich-text editor had two cheap defensive/performance cleanups around collaboration identity and attachment no-op handling.

**Outcome:** all clear after fixes
**Risk score:** high — shared Zustand UI state, notification read semantics, rich-text editor behavior, local persistence migration, scoped refresh hooks, CI, and desktop runtime packaging are all in the branch blast radius
**Change archetypes:** shared-ui, optimistic-state, migration, fallback-state, performance, release-safety, infra
**Intended change:** keep viewer-local view preferences isolated from shared saved views, keep notification modal behavior correct and narrow, preserve rich-text constraints, and remove PR hygiene/runtime drift before pushing
**Intent vs actual:** the current tree now matches the intended ownership boundaries: shared saved views remain server-owned templates, viewer overrides are local UI state, notification routing is a pure presentation helper, rich-text constraints stay in the shared editor contract, and Electron packaging continues to use the repo-owned `.cjs` entrypoints only
**Confidence:** high — current-tree behavior was checked against the pasted findings, GitHub review comments, branch diff, and focused/full verification
**Coverage note:** reviewed `.reviews/*` history, PR #29 metadata and review threads, current branch diff vs `origin/main`, current-turn diff, and the specific files behind every supplied finding
**Finding triage:** all supplied findings are now `resolved`, `already fixed`, or `accepted/intentional`; no Critical/High findings remain open
**Bug classes / invariants checked:** Authority (viewer-local overrides vs shared saved views), Preservation (clear/filter/default behavior), Variant State (empty props, null/undefined override values), Performance Hot Path (store selector breadth and editor extension identity), Release Safety (desktop runtime entrypoints)
**Branch totality:** rechecked the latest branch head, not only the current patch, including prior open PR threads and the Turn 1/2 hotspot families
**Sibling closure:** searched for broad `useAppStore((state) => state)` selectors, whole `viewerViewConfigByRoute` subscriptions, duplicate Electron entrypoints, stale rich-text dependency patterns, and scoped refresh dependency drift
**Remediation impact surface:** changes are limited to presentation/domain helper boundaries and desktop file hygiene; no persisted schema or server contract changed in this turn
**Residual risk / unknowns:** several UX choices remain intentional product behavior rather than bugs: clearing filters clears the current viewer filter state, generic message notifications are in-app only, one modal is shown per batch, and child-row optional properties stay hidden when unset/sidebar

| Status | Count |
|--------|-------|
| New findings | `5` |
| Resolved during Turn 3 | `5` |
| Accepted / intentional | `1` |
| Carried open | `0` |

### External finding triage

| Source | Finding | Current status | Bug class | Missed invariant/variant | Action |
|--------|---------|----------------|-----------|--------------------------|--------|
| User / PR notes | `clearViewerViewFilters` stores empty arrays instead of removing override keys | accepted | Preservation | clear current filters vs revert to saved base filters | no code change; matches current clear-filter UX |
| User / PR notes | v3→v4 migration drops unscoped `selectedViewByRoute` entries | accepted | Migration / Scope | old per-route selection vs viewer-scoped isolation | no code change; privacy/isolation tradeoff |
| User / PR notes | `SavedViewsBoard` still required unused `editable` prop | resolved in `F3-03` | Shared UI | dead required prop after component refactor | fixed |
| User / PR notes | Create dialog default priority changed to `"none"` | accepted | Semantic Regression | template defaults vs requested blank create defaults | no code change; explicit priority defaults still work |
| User / PR notes | `message` notifications excluded from digest claims | accepted | Authority | server notification type owns email eligibility | no code change; mentions still use email-capable `mention` type |
| User / PR notes | Rich-text hard limit activates whenever max is supplied | accepted | Shared UI / Contract | max-as-hard-limit vs soft display-only future callers | no code change; current constrained callsites expect hard stop |
| User / PR notes | `handleEditorFiles` lost early `onUploadAttachment` guard | resolved in `F3-05` | Performance Hot Path | no uploader should do zero async per-file work | fixed |
| User / PR notes | Views directory recomputes arrays inline | accepted | Performance Hot Path | large saved-view lists | no code change; selectors were narrowed and this is low risk |
| User / PR notes | notification effect depended on route data containing `notifications` | resolved in `F3-02` | Performance Hot Path | active-target suppression should not carry full notification route data | fixed |
| User / PR notes | `knownNotificationIdsRef` grows for session lifetime | accepted | Lifecycle | session cache bound | no code change; low-volume session state |
| User / PR notes | only first simultaneous notification opens a modal | accepted | Affordance / UX | anti-spam batch behavior | no code change; inbox still retains unread notifications |
| User / PR notes | `applyViewerViewConfig` used truthy override checks | resolved in `F3-04` | Variant State | present override must not depend on truthiness | fixed |
| User / PR notes | child-row optional properties hidden in sidebar / when empty | accepted | Semantic Regression | direct child-row editing vs uncluttered requested UI | no code change; matches branch requirement |
| User / PR notes | `RichTextEditor showStats` default changed to false | already fixed in `F1-05` | Shared UI | shared default should not silently change | no action this turn |
| User / PR notes | `useCollectionLayout` subscribed to broad viewer config object | already fixed in `F2-03` | Performance Hot Path | active collection should subscribe only to active override | no action this turn |
| User / PR notes | `FieldCharacterLimit` still required unused `limit` | already fixed in `F1-06` | Shared UI | dead required interface after display refactor | no action this turn |
| User / PR notes | `collaborationExtensions` depended on whole collaboration object | already fixed in `F2-04`; base extensions tightened in `F3-05` | Performance Hot Path | editor extensions should depend on actual values used | fixed remaining cheap sibling |
| User / PR notes | `scopeKeys` redundant effect dependency | already fixed in `F2-05` | Performance Hot Path | signature is the canonical scope-key dependency | no action this turn |

### Resolved during Turn 3

#### F3-01 ~~[CONSISTENCY] Medium~~ → RESOLVED — PR added unused Electron `.mjs` entrypoints that drifted from the real desktop runtime
**Where:** [electron/main.mjs](../electron/main.mjs), [electron/preload.mjs](../electron/preload.mjs), [electron/main.cjs](../electron/main.cjs), [package.json](../package.json)

**What was wrong:** The branch added `electron/main.mjs` and `electron/preload.mjs`, but package metadata, `scripts/run-electron.cjs`, `scripts/desktop-smoke.mjs`, and `scripts/package-electron-mac.mjs` all use `electron/main.cjs` / `electron/preload.cjs`. The added `.mjs` main was also weaker than the real entrypoint: it lacked packaged runtime config fallback, trusted WorkOS/identity-provider in-app navigation, single-instance behavior, and the current window/icon policy.

**How it was fixed:** Removed the unused `.mjs` entrypoints so there is one governed desktop source path. The desktop smoke gate continues to assert the `.cjs` runtime path.

#### F3-02 ~~[PERFORMANCE] Low~~ → RESOLVED — Notification modal route data still carried the full notifications array
**Where:** [components/app/shell.tsx](../components/app/shell.tsx)

**What was wrong:** The Turn 2 selector was narrowed from whole-store subscription, but the object used by the notification routing effect still included `notifications` even though `getNotificationHref()` only needs channel posts, conversations, projects, and teams.

**How it was fixed:** Split route data from modal notification lookup. The effect now depends on `notificationRouteData` without the full notification array, while the current modal fallback subscribes only to the selected notification id.

#### F3-03 ~~[HYGIENE] Low~~ → RESOLVED — `SavedViewsBoard` exposed a dead required `editable` prop
**Where:** [components/app/screens/collection-boards.tsx](../components/app/screens/collection-boards.tsx)

**What was wrong:** The component no longer used `editable`, but its public prop type still required callers to provide it.

**How it was fixed:** Removed `editable` from the component prop contract.

#### F3-04 ~~[ROBUSTNESS] Low~~ → RESOLVED — Viewer override merge used truthy checks for explicit override fields
**Where:** [lib/domain/viewer-view-config.ts](../lib/domain/viewer-view-config.ts)

**What was wrong:** `layout`, `grouping`, and `ordering` overrides were applied only when truthy. Current enum values are all truthy, so this was not a live behavior bug, but it made the domain helper depend on an incidental property of the current unions.

**How it was fixed:** Switched those checks to `!== undefined`, matching the existing nullable/presence semantics for sibling override fields.

#### F3-05 ~~[PERFORMANCE] Low~~ → RESOLVED — Rich-text editor kept cheap avoidable extension/no-op churn
**Where:** [components/app/rich-text-editor.tsx](../components/app/rich-text-editor.tsx)

**What was wrong:** `handleEditorFiles()` performed one async no-op per file when no uploader was registered, and base extension memoization depended on the full `collaboration` object even though the base extension only needs the boolean collaboration mode.

**How it was fixed:** Restored the early uploader guard and memoized base extensions on `hasCollaboration` plus the actual constraint/placeholder fields.

### Architecture check

- Viewer override policy stays in the domain/store boundary: `applyViewerViewConfig()` applies explicit overrides defensively, while shared saved views remain unchanged by viewer-local preferences.
- Notification routing is now a pure presentation helper with a narrow data contract; server notification eligibility and digest behavior remain owned by Convex handlers.
- Rich-text hard limits and validity remain shared-editor concerns; constrained callsites opt into hidden stats and enforcement explicitly.
- Desktop runtime ownership is clearer after deleting duplicate `.mjs` entrypoints: packaging, smoke tests, and app metadata all point at the `.cjs` entrypoint family.

### Branch-totality proof

- **Non-delta files/systems re-read:** PR #29 metadata/review threads, `package.json`, Electron runtime scripts, notification routing/shell, viewer config domain helper, rich-text editor, scoped refresh hook, and relevant tests.
- **Prior open findings rechecked:** GitHub review threads for broad store selector, notification whole-store selector, chat target suppression, and rich-text overflow text were all current-tree triaged; no live Critical/High issue remained.
- **Prior resolved/adjacent areas revalidated:** Turn 1/2 fixes for `useCollectionLayout`, notification route suppression, `showStats`, `FieldCharacterLimit`, `collaborationExtensions`, and `scopeKeys` were rechecked.
- **Hotspots or sibling paths revisited:** searched for `useAppStore((state) => state)`, broad `viewerViewConfigByRoute` subscription, duplicate Electron `.mjs` entrypoints, full-notification route-data coupling, and stale rich-text dependency patterns.
- **Dependency/adjacent surfaces revalidated:** desktop smoke still validates the real `.cjs` runtime, and the GitHub PR checks were green before this local patch.
- **Why this is enough:** the remaining changes are small boundary/hygiene fixes in already-reviewed hotspot files, and the full verification stack passed after the final patch.

### Challenger pass

- `done` — assumed one serious issue still existed after the supplied findings. The live issue found was the duplicate Electron `.mjs` runtime surface, which was not in the pasted list. After deletion, the challenger pass did not find another current-tree bug in the viewer override, notification modal, rich-text, scoped refresh, or desktop smoke paths.

### Validation

- `~/.codex/skills/diff-review/scripts/review-preflight.sh` — passed; PR #29 open and CI checks green at captured head.
- `~/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — completed; desktop runtime and store/domain hotspots reviewed.
- `gh pr view 29 ...` / `gh api repos/declancowen/Linear/pulls/29/comments` / GraphQL review threads — completed; only outdated fixed threads remained.
- `pnpm exec vitest run tests/components/notification-routing.test.ts tests/lib/store/viewer-view-config.test.ts tests/lib/use-scoped-read-model-refresh.test.tsx tests/components/views-screen.test.tsx` — passed, 4 files / 17 tests.
- `pnpm exec vitest run tests/components/notification-routing.test.ts tests/components/views-screen.test.tsx` — passed after the final shell selector split, 2 files / 8 tests.
- `pnpm exec eslint components/app/shell.tsx components/app/notification-routing.ts components/app/rich-text-editor.tsx components/app/screens/collection-boards.tsx lib/domain/viewer-view-config.ts --max-warnings 0` — passed.
- `pnpm audit:deps` — passed at high threshold; 5 moderate advisories remain below threshold.
- `pnpm check` — passed after final patch: lint, typecheck, 140 test files / 726 tests, production build, desktop smoke.
- `git diff --check -- . ':!.reviews/'` — passed.

### Recommendations

1. **Fix first:** none remaining.
2. **Then address:** if product wants “clear filters” to mean “revert to saved view filters,” change that deliberately across both project and viewer filter paths rather than only in `clearViewerViewFilters()`.
3. **Patterns noticed:** avoid adding parallel runtime entrypoints unless the package metadata, smoke tests, and packaging scripts are switched in the same patch.
4. **Suggested approach:** keep future viewer-local preference work behind `lib/domain/viewer-view-config.ts` and the UI slice actions so shared saved-view templates cannot become a second source of truth.
5. **Defer on purpose:** pruning `knownNotificationIdsRef` and changing one-modal-per-batch behavior are product/performance follow-ups, not blockers for this PR.

## Turn 2 — 2026-04-29 16:52:55 BST

| Field | Value |
|-------|-------|
| **Commit** | `0040e6be` (working tree updated after this base) |
| **IDE / Agent** | `unknown / Codex` |
| **Risk score** | `High` |

**Summary:** Imported the second external finding batch and re-reviewed the current diff for the same performance, notification, rich-text, and CI failure classes. The new live P1 notification finding was valid: workspace chat notifications were suppressed by pathname alone on `/chats`, so a user viewing a different conversation could have a new notification silently marked read. The follow-up pass also found valid smaller regressions around rich-text overflow text, over-broad viewer override subscriptions, collaboration extension memo dependencies, a redundant scoped-key effect dependency, and GitHub CI codegen running without Convex deployment configuration. All live issues from this pass were fixed, covered where useful, and re-verified.

| Status | Count |
|--------|-------|
| New findings | `7` |
| Resolved during Turn 2 | `7` |
| Accepted / intentional | `1` |
| Carried open | `0` |

### Resolved during Turn 2

#### F2-01 ~~[BUG] High~~ → RESOLVED — Workspace chat target suppression marked different chats read
**Where:** [components/app/notification-routing.ts](../components/app/notification-routing.ts), [components/app/shell.tsx](../components/app/shell.tsx), [tests/components/notification-routing.test.ts](../tests/components/notification-routing.test.ts)

**What was wrong:** Chat notification suppression treated any `/chats` pathname match as already viewing the target, even when `chatId` was different or absent.

**How it was fixed:** Moved notification routing into a pure helper and changed chat suppression so workspace chat hrefs with `chatId` suppress only when both pathname and `chatId` match. Team chat routes, which have no `chatId`, still suppress by exact route. Added focused coverage for matching, mismatched, and team chat cases.

#### F2-02 ~~[UI] Low~~ → RESOLVED — Rich-text block presence overflow rendered `+ 3`
**Where:** [components/app/rich-text-editor.tsx](../components/app/rich-text-editor.tsx)

**What was wrong:** JSX line wrapping split the plus sign and count expression into separate text nodes, producing a visible space.

**How it was fixed:** Rendered the overflow label as a single template-string expression, e.g. `+3`.

#### F2-03 ~~[PERFORMANCE] Medium~~ → RESOLVED — Collection layout still subscribed to every viewer override
**Where:** [components/app/screens.tsx](../components/app/screens.tsx)

**What was wrong:** The first fix narrowed `useCollectionLayout()` away from the full store, but still selected the whole `viewerViewConfigByRoute` object.

**How it was fixed:** The hook now selects only the active route/view override entry after resolving the active base view, so unrelated viewer override changes do not re-render every collection screen. The same re-review also replaced two remaining broad project/docs screen selectors with the existing domain snapshot selector.

#### F2-04 ~~[PERFORMANCE] Low~~ → RESOLVED — Collaboration extension memo depended on the whole collaboration object
**Where:** [components/app/rich-text-editor.tsx](../components/app/rich-text-editor.tsx)

**What was wrong:** The lint-safe follow-up widened the memo dependency to `collaboration`, recreating extensions if a parent passed an equivalent object with a new identity.

**How it was fixed:** The memo now depends on the actual `doc` and `provider` values used to configure the extension.

#### F2-05 ~~[PERFORMANCE] Low~~ → RESOLVED — Scoped read-model effect depended on the memoized key array
**Where:** [hooks/use-scoped-read-model-refresh.ts](../hooks/use-scoped-read-model-refresh.ts)

**What was wrong:** The effect included `scopeKeys` in its dependency array even though `scopeKeySignature` is the canonical change signal.

**How it was fixed:** The effect now derives its local stream key array from `scopeKeySignature`, keeping the dependency on the stable signature only.

#### F2-06 ~~[CI] High~~ → RESOLVED — GitHub CI failed Convex codegen without deployment env
**Where:** [.github/workflows/ci.yml](../.github/workflows/ci.yml)

**What was wrong:** GitHub Actions ran `pnpm convex:codegen` even when no `CONVEX_DEPLOYMENT` was configured, failing before `pnpm check`.

**How it was fixed:** The workflow now exposes optional Convex deployment secrets and only runs codegen when `CONVEX_DEPLOYMENT` is present. The generated-file drift check still runs on every CI pass.

#### F2-07 ~~[PERFORMANCE] Medium~~ → RESOLVED — Project/docs screens retained broad store subscriptions
**Where:** [components/app/screens.tsx](../components/app/screens.tsx)

**What was wrong:** A same-family grep pass found two additional `useAppStore((state) => state)` selectors in project and docs collection screens.

**How it was fixed:** Replaced them with `useAppStore(useShallow(selectAppDataSnapshot))` and adjusted local project-rendering helper types to consume `AppData`.

### Accepted / intentional in Turn 2

| External finding | Status | Reason |
|------------------|--------|--------|
| `message` notifications excluded from email digest claims | Accepted | This is intentional: generic chat messages are in-app only, while mentions keep the existing `mention` type and email preference behavior. |

### Re-review pass

- Searched the touched diff for `useAppStore((state) => state)`, whole `viewerViewConfigByRoute` selection, chat suppression path/query mismatches, split JSX plus text, and scoped-key dependency churn.
- Re-checked that stale findings from the external list were already fixed in Turn 1: `notificationModalData` whole-store subscription, `FieldCharacterLimit` required `limit`, and `RichTextEditor showStats = false`.
- Re-confirmed intentional changes from the architecture plan: hard rich-text limit enforcement, `"none"` create-work default priority, user-scoped selected-view migration, in-app-only generic message notifications, one modal per notification batch, and sidebar subtask property hiding.

### Verification

- `pnpm audit --audit-level high` — passed; 5 moderate advisories remain below the configured threshold.
- `pnpm convex:codegen && git diff --exit-code -- convex/_generated` — passed locally with Convex env present.
- `pnpm exec vitest run tests/components/notification-routing.test.ts tests/components/views-screen.test.tsx tests/lib/store/viewer-view-config.test.ts tests/components/work-surface-view.test.tsx tests/lib/use-scoped-read-model-refresh.test.tsx` — passed, 5 files / 34 tests.
- `pnpm check` — passed, including lint, typecheck, 140 test files / 726 tests, build, and desktop smoke.
- `git diff --check` — passed.

---

## Turn 1 — 2026-04-29 16:29:37 BST

| Field | Value |
|-------|-------|
| **Commit** | `1543eb09` (working tree updated after this base) |
| **IDE / Agent** | `unknown / Codex` |
| **Risk score** | `High` |

**Summary:** Ran `diff-review` with `architecture-standards` over the viewer-safe workspace and notification changes, imported the user-supplied external PR findings, and re-reviewed the branch after each fix. The live issues were concentrated in store-subscription breadth, notification modal lifecycle semantics, context-aware empty groups, shared rich-text defaults, dependency audit drift, and stale CI test harnesses around scoped read-model invalidation and document presence shape. All confirmed live findings were fixed and the branch now passes the CI-equivalent local checks.

| Status | Count |
|--------|-------|
| New findings | `13` |
| Resolved during Turn 1 | `13` |
| Accepted / intentional | `7` |
| Carried open | `0` |

### Original requirements check

- Character limits now hide count callouts while constrained inputs/editors hard-stop at configured max limits.
- Empty, unfiltered work-surface groups can still render editable bodies and `Add item`, including status, priority, and context-aware type groups.
- Create-work item modal defaults to `"none"` priority while explicit caller defaults, such as priority lanes, remain supported.
- Message, mention, and tag notification handling remains owned by server/application rules, while the shell modal is presentation-only.
- Work item details hide the requested empty/sidebar properties and keep label color rendering centralized.
- Project, views, project views, workspace views, and workspace projects use viewer-local view config rather than mutating shared saved-view templates for ordinary layout/filter/property changes.

### Resolved during Turn 1

#### F1-01 ~~[PERFORMANCE] High~~ → RESOLVED — Collection screens subscribed to the entire Zustand store
**Where:** [components/app/screens.tsx](../components/app/screens.tsx)

**What was wrong:** `useCollectionLayout()` used `useAppStore((state) => state)`, so unrelated store changes, including chat, notifications, typing, and presence, re-rendered top-level collection surfaces.

**How it was fixed:** Replaced the broad selector with a shallow selector over only `currentUserId`, scoped selected view id, viewer overrides, and views before applying `applyViewerViewConfig()`.

#### F1-02 ~~[PERFORMANCE] High~~ → RESOLVED — Notification modal data subscribed to all top-level store slices
**Where:** [components/app/shell.tsx](../components/app/shell.tsx)

**What was wrong:** The modal effect used a shallow whole-store selector, causing notification checks to rerun on unrelated store mutations.

**How it was fixed:** Narrowed the selector to `channelPosts`, `conversations`, `notifications`, `projects`, and `teams`, and changed notification href resolution to operate on that explicit route-data contract.

#### F1-03 ~~[BUG] Medium~~ → RESOLVED — Notification modal marked items read on display instead of on action
**Where:** [components/app/shell.tsx](../components/app/shell.tsx)

**What was wrong:** Newly displayed modal notifications were marked read immediately, which conflicted with the product default that dismissing only closes the modal.

**How it was fixed:** The modal now marks read only when opening the target or when active-target suppression applies. `Dismiss` only closes; `Archive` archives and closes.

#### F1-04 ~~[BUG] Medium~~ → RESOLVED — Empty type groups ignored active team/project template context
**Where:** [lib/domain/selectors-internal/work-items.ts](../lib/domain/selectors-internal/work-items.ts), [tests/lib/domain/view-item-level.test.ts](../tests/lib/domain/view-item-level.test.ts)

**What was wrong:** Unfiltered empty type groups synthesized every work item type even when the current project/team template allowed a narrower set.

**How it was fixed:** Type group synthesis now derives allowed item types from active project template and/or active team experience, falling back to all item types only when no context exists. Added selector coverage for project-management templates.

#### F1-05 ~~[REGRESSION] Medium~~ → RESOLVED — Shared rich-text stats default was changed globally
**Where:** [components/app/rich-text-editor.tsx](../components/app/rich-text-editor.tsx), [components/app/collaboration-screens/channel-ui.tsx](../components/app/collaboration-screens/channel-ui.tsx), [components/app/screens/work-item-detail-screen.tsx](../components/app/screens/work-item-detail-screen.tsx)

**What was wrong:** The shared `RichTextEditor` default changed from showing stats to hiding stats, which could silently affect unrelated editor callsites.

**How it was fixed:** Restored `showStats = true` at the shared component boundary and made constrained callsites opt out explicitly with `showStats={false}`.

#### F1-06 ~~[HYGIENE] Low~~ → RESOLVED — `FieldCharacterLimit` still required an unused `limit` prop
**Where:** [components/app/field-character-limit.tsx](../components/app/field-character-limit.tsx)

**What was wrong:** The component no longer renders counts, but the type still forced callers to pass `limit`.

**How it was fixed:** Made `limit` optional for compatibility while removing it from the component's required interface.

#### F1-07 ~~[SECURITY] High~~ → RESOLVED — Dependency audit failed on high-severity transitive advisories
**Where:** [package.json](../package.json), [pnpm-lock.yaml](../pnpm-lock.yaml)

**What was wrong:** CI failed `pnpm audit:deps` due high advisories in transitive `undici` and `@xmldom/xmldom`.

**How it was fixed:** Added targeted `pnpm.overrides` for `miniflare>undici@6.24.0` and `plist>@xmldom/xmldom@0.8.13`, regenerated the lockfile, and verified high-severity audit passes.

#### F1-08 ~~[CI] Medium~~ → RESOLVED — Full lint was blocked by React hook and unused-symbol issues
**Where:** [components/providers/convex-app-provider.tsx](../components/providers/convex-app-provider.tsx), [hooks/use-expiring-retained-value.ts](../hooks/use-expiring-retained-value.ts), [hooks/use-retained-team-by-slug.ts](../hooks/use-retained-team-by-slug.ts), [hooks/use-scoped-read-model-refresh.ts](../hooks/use-scoped-read-model-refresh.ts), plus cleanup-only imports/constants

**What was wrong:** `pnpm lint` failed after the branch moved past audit, which would have failed CI even after dependency fixes.

**How it was fixed:** Moved seed hydration back into the owning component, added narrow retained-ref hook suppressions where the ref read is intentional, fixed missing dependencies, and removed unused imports/constants/parameters.

#### F1-09 ~~[CI] Medium~~ → RESOLVED — Project-create dialog reset state synchronously in an effect
**Where:** [components/app/screens/project-creation.tsx](../components/app/screens/project-creation.tsx)

**What was wrong:** React hook lint rejected the modal reset effect for synchronous state updates.

**How it was fixed:** Split the dialog into a keyed content component so opening with a new default team remounts fresh state without an effect reset.

#### F1-10 ~~[CI] Medium~~ → RESOLVED — Document presence tests were stale for normalized fields
**Where:** [tests/convex/document-handlers.test.ts](../tests/convex/document-handlers.test.ts), [tests/convex/document-presence-normalization.test.ts](../tests/convex/document-presence-normalization.test.ts)

**What was wrong:** Full tests expected older presence/document return payloads without `activeBlockId` or `workspaceId`.

**How it was fixed:** Updated expectations to match the current payload contract.

#### F1-11 ~~[CI] Medium~~ → RESOLVED — API route contract tests missed scoped read-model invalidation mocks
**Where:** [tests/app/api/chat-call-route.test.ts](../tests/app/api/chat-call-route.test.ts), [tests/app/api/platform-route-contracts.test.ts](../tests/app/api/platform-route-contracts.test.ts), [app/api/chats/[chatId]/calls/route.ts](../app/api/chats/%5BchatId%5D/calls/route.ts)

**What was wrong:** Tests mocked only the primary Convex operation, but the routes now also resolve and bump scoped read-model versions. That produced 500s before the intended typed application-error assertions.

**How it was fixed:** Added scoped read-model and bump mocks to the route tests, and standardized chat-call route error handling on `isApplicationError()`.

#### F1-12 ~~[CI] Low~~ → RESOLVED — Collaboration wrapper assertion compared Convex generated proxy objects
**Where:** [tests/lib/server/convex-collaboration.test.ts](../tests/lib/server/convex-collaboration.test.ts)

**What was wrong:** `toHaveBeenNthCalledWith(expect.anything(), ...)` could trigger Vitest pretty-format failures on Convex generated API proxy objects.

**How it was fixed:** Asserted the second mutation argument directly and updated the expected sanitized image markup to the current sanitizer output.

#### F1-13 ~~[ARCHITECTURE] Medium~~ → RESOLVED — Route/application error checks were inconsistent
**Where:** [app/api/chats/[chatId]/calls/route.ts](../app/api/chats/%5BchatId%5D/calls/route.ts)

**What was wrong:** The chat-call route still used raw `instanceof ApplicationError` while sibling routes use the shared `isApplicationError()` helper.

**How it was fixed:** Switched the route to the helper to keep route error classification behind the shared boundary.

### Accepted / intentional findings

| External finding | Status | Reason |
|------------------|--------|--------|
| Rich-text limit now enforces when `maxPlainTextCharacters` is set | Accepted | Matches the original requirement to hard-stop typing at limits; current constrained callsites are expected to enforce. |
| v3→v4 migration drops unscoped `selectedViewByRoute` entries | Accepted | Intentional privacy/isolation tradeoff to prevent same-browser cross-user view leakage; data loss is limited to selected-view preference. |
| Create work item priority defaults to `"none"` | Accepted | Directly required by the original request; explicit priority-lane defaults remain preserved. |
| Views directory inline recomputation without `useMemo` | Accepted | Performance consideration only; not a correctness issue after store selectors were narrowed. |
| `knownNotificationIdsRef` grows for the session | Accepted | Low-volume in-memory session cache; bounded by notifications received during a browser session and can be pruned later if needed. |
| Notification modal shows only the first notification in a simultaneous batch | Accepted | Deliberate anti-spam behavior; other notifications remain unread in the inbox. |
| Sidebar/main child-row property hiding | Accepted | Matches the explicit requirement to hide sidebar subtask properties and hide empty optional main-row properties while keeping status visible. |

### Architecture check

- Shared `views` remain server-owned templates. Ordinary board/list/filter/property changes now use viewer-local store overrides keyed by user and route/view.
- Notification recipient and dedupe policy stays in Convex/application handlers; the shell modal only consumes notification records and controls presentation/actions.
- Domain selectors own work-surface grouping defaults; board/list renderers consume the result and no longer infer group universe locally.
- Character constraints remain in `lib/domain/input-constraints.ts`; UI components enforce and present those constraints explicitly.
- Scoped read-model invalidation remains a route/server concern, and route tests now mock those side effects explicitly instead of bypassing them.

### Challenger pass

- Rechecked the user-supplied external findings against the current tree and split them into live bugs, intentional changes, and low-risk observations before editing.
- Re-reviewed after fixes for same-family regressions: broad store subscriptions, notification read state, shared rich-text defaults, empty group defaults, and CI route/test mocks.
- Confirmed ordinary viewer-local layout/filter/property changes do not require shared Convex view mutations; shared view lifecycle remains create/rename/delete.
- Re-ran full verification after the second pass to catch new lint/test/build issues introduced by the fixes.

### Verification

- `pnpm audit --audit-level high` — passed; 5 moderate advisories remain below the configured threshold.
- `pnpm convex:codegen && git diff --exit-code -- convex/_generated` — passed.
- `pnpm lint` — passed.
- `pnpm typecheck` — passed.
- `pnpm exec vitest run tests/convex/chat-message-notifications.test.ts tests/convex/notification-digest-claims.test.ts tests/lib/store/collaboration-conversation-actions.test.ts tests/components/create-dialogs.test.tsx tests/components/work-item-detail-screen.test.tsx tests/components/work-item-labels-editor.test.tsx tests/components/work-surface-view.test.tsx tests/components/views-screen.test.tsx tests/lib/store/viewer-view-config.test.ts tests/lib/domain/view-item-level.test.ts` — passed, 10 files / 86 tests.
- `pnpm exec vitest run tests/convex/document-handlers.test.ts tests/convex/document-presence-normalization.test.ts tests/app/api/chat-call-route.test.ts tests/app/api/platform-route-contracts.test.ts tests/lib/server/convex-collaboration.test.ts` — passed, 5 files / 24 tests.
- `pnpm test` — passed, 139 files / 722 tests.
- `pnpm build` — passed.
- `pnpm desktop:smoke` — passed.

### Follow-up notes

- A future cross-device preference sync should use `userAppStates`, not shared `views`.
- If notification volume grows materially, prune `knownNotificationIdsRef` by retaining only recent unread/known IDs for the active session.
- The modal still intentionally surfaces one new notification per batch; changing that should be a product decision, not an incidental implementation change.
