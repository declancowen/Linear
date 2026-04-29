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
- `package.json` and `pnpm-lock.yaml` — dependency audit overrides for high-severity transitive vulnerabilities
- `tests/*` impacted suites — viewer config, empty groups, notification routing, document presence, route contracts, collaboration wrappers

## Review status (updated every turn)

| Field | Value |
|-------|-------|
| **Review started** | `2026-04-29 16:16:33 BST` |
| **Last reviewed** | `2026-04-29 16:29:37 BST` |
| **Total turns** | `1` |
| **Open findings** | `0` |
| **Resolved findings** | `13` |
| **Accepted findings** | `6` |

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
| Accepted / intentional | `6` |
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
