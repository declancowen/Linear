# Review: Work Properties, Document Views, Workspace Routing

## Project context

| Field          | Value                                       |
| -------------- | ------------------------------------------- |
| **Repository** | `Linear`                                    |
| **Remote**     | `https://github.com/declancowen/Linear.git` |
| **Branch**     | `main`                                      |
| **Stack**      | Next.js, React, Convex, PartyKit, Zustand   |

## Scope

- `app/**`, `components/app/**`, `convex/**`, `lib/**`, `services/partykit/**`, `tests/**` — added Turn 1
- Duplicate numeric-suffix local files — added Turn 1
- Workspace selector route, custom work properties, document views/taskbar, project/view edit flows, inbox/chat layout fixes, drag/drop reset, notification routing, chat reactions, PartyKit persistence guard — added Turn 1
- Calendar day/week drag performance, all-day to timed conversion preview, inline detail anchoring, shared select dropdown padding, desktop packaging gate cleanup — added Turn 35

## Hotspots

- Tenancy and team-scoped custom property validation — added Turn 1
- Workspace selection and selected-workspace cookie routing — added Turn 1
- Notification optimistic read mutations during route navigation — added Turn 1
- Live document teardown persistence and destructive flush prevention — added Turn 1
- Static analyzer drift from broad UI/data-model changes — added Turn 1

## Review status

| Field                 | Value                |
| --------------------- | -------------------- |
| **Review started**    | 2026-05-12 18:06 BST |
| **Last reviewed**     | 2026-05-29 17:25 BST |
| **Total turns**       | 36                   |
| **Open findings**     | 0                    |
| **Resolved findings** | 70                   |
| **Accepted findings** | 0                    |

## Turn 36 — 2026-05-29 17:25 BST

| Field           | Value                                                                 |
| --------------- | --------------------------------------------------------------------- |
| **Scope**       | Workboard filtering/group visibility, count ordering, parent display property, desktop update feedback dialog |
| **Review type** | Local diff review + architecture standards                            |
| **Reviewer**    | Codex CLI                                                             |
| **Outcome**     | 1 review finding fixed during review; no local open findings          |

### Commands run

- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh` — completed; current-turn delta, review history, and analyzer policy signals recorded
- `/Users/declancowen/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — completed; no branch-specific architecture blocker identified
- `pnpm vitest run tests/components/desktop-update-controller.test.tsx` — passed, 1 file / 5 tests
- `pnpm vitest run tests/lib/domain/view-item-level.test.ts` — passed, 1 file / 19 tests
- `pnpm typecheck` — passed
- `pnpm lint` — passed
- `git diff --check` — passed
- `pnpm vitest run tests/lib/domain/view-item-level.test.ts tests/components/work-surface-view.test.tsx tests/components/screen-helpers.test.ts tests/lib/store/viewer-view-config.test.ts tests/lib/store/view-slice.test.ts tests/lib/domain/default-views.test.ts tests/lib/domain/project-views.test.ts tests/convex/view-handlers.test.ts tests/convex/work-helpers.test.ts tests/lib/app-store-read-model-merge.test.ts tests/components/desktop-update-controller.test.tsx` — passed, 11 files / 173 tests

### Branch-totality proof

- **Bug classes / invariants checked:** saved-view filter schema compatibility, viewer/draft/server persistence parity, legacy parent-filter removal, empty-group synthesis, group/subgroup count ordering, parent display-property lookup, and desktop update dialog close affordances.
- **Sibling closure:** the new `showEmptyGroups` filter is accepted by UI draft views, viewer overrides, saved views, Convex mutation args, server helpers, normalization, and store pending-sync paths. `count` ordering is total across item, project, docs-label, and Convex validators. `parent` display is registered in the shared display-property primitive and rendered by the work-item view owner.
- **Architecture rule applied:** filtering and ordering semantics stay in domain selectors; persisted view config shape stays in the shared type/schema/Convex/store boundary; work-surface controls only dispatch view patches. Desktop update feedback remains local to `DesktopUpdateController` and the shared dialog primitive is not changed.
- **Static analyzer caveat:** preflight still reports the repo's existing Fallow/boundary baseline caveats. No suppressions, threshold changes, or CI gate loosening were introduced in this turn.
- **Visual smoke note:** no browser smoke was run because the changed workboard and desktop-update surfaces need authenticated workspace/desktop IPC state locally. Component and domain tests cover the changed state transitions and rendered affordances directly.

### Resolved during Turn 36

#### WPDV-70 — resolved — legacy empty-parent filter token still affected empty group synthesis

- **Severity:** medium
- **Evidence:** `matchesParentFilter` and the filter popover ignored the legacy `__empty__` parent value, but `hasActiveViewFilters` still treated any `parentIds` entry as active. A saved view containing the removed token could therefore stop normal empty-group synthesis even though the filter no longer appeared or matched items.
- **Fix:** `hasActiveViewFilters` now ignores `EMPTY_PARENT_FILTER_VALUE` and treats `showEmptyGroups: false` as the explicit empty-group visibility filter.
- **Prevention:** Added regression coverage proving legacy empty-parent filters do not prevent empty status groups from being synthesized.

### Residual risk

- The subjective desktop update dialog spacing was validated through component assertions for the shared width and single Close button, not a manual desktop IPC smoke.

## Turn 35 — 2026-05-28 15:18 BST

| Field           | Value                                                                 |
| --------------- | --------------------------------------------------------------------- |
| **Scope**       | Calendar drag smoothness, inline detail anchoring, shared select UI, release gates |
| **Review type** | Local diff review + architecture/static gate cleanup                  |
| **Reviewer**    | Codex CLI                                                             |
| **Outcome**     | 3 analyzer findings fixed during review; no local open findings       |

### Commands run

- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh` — completed; current-turn delta and review history recorded
- `pnpm exec vitest run tests/components/work-surface-view.test.tsx` — passed, 1 file / 72 tests
- `pnpm exec vitest run tests/components/work-surface-view.test.tsx tests/app/api/platform-route-contracts.test.ts tests/components/desktop-update-controller.test.tsx tests/electron/desktop-auth-store.test.ts` — passed, 4 files / 90 tests
- `pnpm lint` — passed
- `pnpm typecheck` — passed
- `pnpm build` — passed
- `pnpm fallow:gate` — initially caught dead export, production-health, and duplication findings; passed after local cleanup
- `git diff --check` — passed

### Branch-totality proof

- **Bug classes / invariants checked:** all-day native drag lifecycle, all-day-to-timed conversion, timed-to-all-day preservation, drag-preview rendering, calendar width changes while the inline detail sidebar opens, day/header/all-day horizontal scroll sync, and shared select item spacing.
- **Sibling closure:** timed drag and resize still use the existing pointer-owned `CalendarDragState`; native all-day drag now has a small calendar-owned state/ref bridge instead of a second drag framework. Shared dropdown padding was fixed in `components/ui/select.tsx`, covering calendar time zone and settings selects through the existing primitive.
- **Architecture rule applied:** calendar interaction policy remains inside `CalendarView`; rendering components receive explicit handlers and do not persist schedule changes directly. The desktop packaging cleanup was kept local to `scripts/package-electron-mac.mjs` with no release contract changes.
- **Visual smoke note:** no browser smoke was run because the changed calendar surface requires authenticated workspace data locally. Component tests cover the changed interaction/state transitions directly, and the production build validates the Next.js render path.

### Resolved during Turn 35

#### WPDV-67 — resolved — all-day native drag had no timed preview or all-day lane shrink while dragging out

- **Severity:** medium
- **Evidence:** The previous all-day native drag only set `dataTransfer` and converted on drop, so the timed grid had no live preview and the all-day lane kept the dragged item until the final mutation.
- **Fix:** Added a calendar-owned all-day drag state/ref, timed-grid drag-over preview, and layout filtering while the native drag target is timed. The existing schedule update path still owns persistence.
- **Prevention:** Added regression coverage proving all-day drag shows a timed preview, shrinks the all-day lane, and saves timed schedule fields on drop.

#### WPDV-68 — resolved — opening inline calendar details could preserve stale horizontal pixels after the calendar width changed

- **Severity:** medium
- **Evidence:** The inline detail sidebar reduces the calendar surface width; preserving old `scrollLeft` pixels could shift the visible day range.
- **Fix:** Added anchor-day scroll recentering through memoized calendar scroll helpers and a width `ResizeObserver`, keeping header, all-day, body, and time rail synced.
- **Prevention:** Added regression coverage proving the anchored day scroll position is recalculated when the detail sidebar opens.

#### WPDV-69 — resolved — static analyzer gates had local cleanup findings

- **Severity:** low
- **Evidence:** `pnpm fallow:gate` surfaced an unused export, a production-health finding in the desktop packaging script, and duplicate test/script blocks.
- **Fix:** Made `ProjectTemplateGlyph` private, split desktop packaging responsibilities into local helpers, and extracted repeated test setup/assertion helpers.
- **Prevention:** `pnpm fallow:gate` now passes with dead code `0`, production health findings `0`, and duplication `0`.

### Residual risk

- Calendar drag smoothness still depends on browser-native drag event cadence for all-day items; the diff now minimizes React state churn and direct layout jumps, but a manual authenticated browser pass remains useful before treating subjective feel as final.

## Turn 34 — 2026-05-20 15:03 BST

| Field           | Value                                                                 |
| --------------- | --------------------------------------------------------------------- |
| **Scope**       | PR #37 Codex/repo-agnostic feedback for calendar timezone and drag    |
| **Review type** | External PR feedback triage + calendar timezone/drag fixes + gates    |
| **Reviewer**    | Codex CLI                                                             |
| **Outcome**     | 3 live PR findings fixed locally; no local open findings              |

### Commands run

- GitHub connector `fetch_pr_comments` for PR #37 — fetched the latest Codex and repo-agnostic PR review feedback
- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh` — completed; current-turn delta and analyzer policy signals recorded
- `pnpm vitest run tests/components/work-surface-view.test.tsx` — passed, 1 file / 58 tests
- `pnpm exec eslint components/app/screens/work-surface-view/calendar-view.tsx tests/components/work-surface-view.test.tsx --max-warnings 0` — passed
- `pnpm typecheck` — passed
- `pnpm fallow:gate` — initially caught duplicated prop typing in the calendar patch, then passed after extracting `CalendarTimedInteractionProps`: dead code `0`, production health findings `0`, duplication `0`
- `pnpm lint` — passed
- `git diff --check` — passed

### Branch-totality proof

- **External findings triaged:** latest feedback had two live Codex P2 issues on timezone-aware initial anchors/current-day highlighting and one repo-agnostic Medium issue for hidden-weekend timed drags.
- **Bug classes / invariants checked:** selected-timezone initial render, timezone-derived today styling, hidden-weekend visible target dates, and Friday-to-Monday timed drag persistence.
- **Sibling closure:** the same timezone-derived `todayDate` now feeds both the day header and timed-grid background; timed drag persistence now uses the resolved slot date instead of recomputing from visible column deltas.
- **Architecture rule applied:** timezone and drag-date policy stays in the calendar control/drag owner, with tests at the component boundary rather than scattered offset or date math in callers.
- **Why this is enough:** component coverage now proves a Los Angeles calendar opens/highlights May 20 when browser time is May 21 UTC, and a hidden-weekend Friday timed drag persists Monday rather than Saturday.

### Resolved / Carried / New findings

#### WPDV-64 — resolved — initial calendar anchor used the browser-local date

- **Severity:** medium
- **Evidence:** `useCalendarViewControls` initialized `anchorDate` with browser-local `startOfDay(new Date())`, so a selected calendar timezone could open on the wrong date around midnight.
- **Fix:** initial anchor creation now derives today from the selected/default viewer timezone.
- **Prevention:** Added a timezone-boundary initial-render regression test.

#### WPDV-65 — resolved — current-day styling used the browser-local date

- **Severity:** medium
- **Evidence:** `getCalendarDayDisplayState` compared day cells to `new Date()`, which could disagree with timezone-aware Today navigation and the now marker.
- **Fix:** `CalendarView` computes a timezone-derived `todayDate` and passes it into day-header and timed-grid display state.
- **Prevention:** Added a timezone-boundary highlighted-day regression test and kept Fallow duplication at zero.

#### WPDV-66 — resolved — hidden-weekend timed drags could save the wrong date

- **Severity:** medium
- **Evidence:** timed drag preview date math added the visible column delta as calendar days; Friday-to-next-visible-Monday with weekends hidden could save Saturday.
- **Fix:** timed drag preview now uses the target slot's resolved visible date.
- **Prevention:** Added a hidden-weekend Friday-to-Monday timed drag regression test.

### Residual risk

- I did not resolve or reply to GitHub review threads; the branch will be pushed for Codex and repo-agnostic automation to re-review the new head.

## Turn 33 — 2026-05-20 14:47 BST

| Field           | Value                                                                  |
| --------------- | ---------------------------------------------------------------------- |
| **Scope**       | PR #37 Codex feedback for timezone-aware Today anchors                 |
| **Review type** | External PR feedback triage + calendar timezone fix + gate rerun       |
| **Reviewer**    | Codex CLI                                                              |
| **Outcome**     | 1 live PR finding fixed locally; no local open findings                |

### Commands run

- GitHub connector `fetch_pr_comments` for PR #37 — fetched the latest Codex review feedback
- `pnpm vitest run tests/components/work-surface-view.test.tsx` — passed, 1 file / 55 tests
- `pnpm exec eslint components/app/screens/work-surface-view/calendar-view.tsx tests/components/work-surface-view.test.tsx --max-warnings 0` — passed
- `pnpm typecheck` — passed
- `pnpm fallow:gate` — passed: dead code `0`, production health findings `0`, duplication `0`
- `pnpm lint` — passed
- `git diff --check` — passed

### Branch-totality proof

- **External findings triaged:** current PR feedback had one live P2 issue: the Today button used browser-local `startOfDay(new Date())` instead of the selected calendar timezone.
- **Bug classes / invariants checked:** timezone-aware Today navigation, date-boundary behavior, stale render-time clocks, and existing hidden-weekend Today normalization.
- **Sibling closure:** the date picker Jump to today path now uses the same timezone-aware date source as the toolbar Today button.
- **Architecture rule applied:** timezone date derivation stays inside the calendar controls owner and reuses the existing timezone wall-time adapter instead of hand-rolling offsets in UI code.
- **Why this is enough:** component coverage now asserts a Los Angeles calendar at `2026-05-21T02:00:00.000Z` anchors Today to `2026-05-20`, not the browser/UTC date.

### Resolved / Carried / New findings

#### WPDV-63 — resolved — Today used the browser timezone instead of the selected calendar timezone

- **Severity:** medium
- **Evidence:** the toolbar Today handler used `startOfDay(new Date())`, which can be a different date than the selected calendar timezone around midnight boundaries.
- **Fix:** Today now derives the current date from the selected calendar timezone at click time, and the date picker uses the same timezone-aware Today source.
- **Prevention:** Added a timezone-boundary Today regression test and reran calendar tests, lint, typecheck, and Fallow.

### Residual risk

- I did not resolve or reply to the GitHub review thread; the branch will be pushed with the fix for Codex to re-review.

## Turn 32 — 2026-05-20 14:29 BST

| Field           | Value                                                                  |
| --------------- | ---------------------------------------------------------------------- |
| **Scope**       | PR #37 Codex feedback for hidden-weekend day-mode entry anchors        |
| **Review type** | External PR feedback triage + calendar mode-switch fix + gate rerun    |
| **Reviewer**    | Codex CLI                                                              |
| **Outcome**     | 1 live PR finding fixed locally; no local open findings                |

### Commands run

- GitHub connector `fetch_pr_comments` for PR #37 — fetched the latest Codex review feedback
- `pnpm vitest run tests/components/work-surface-view.test.tsx` — passed, 1 file / 54 tests
- `pnpm exec eslint components/app/screens/work-surface-view/calendar-view.tsx tests/components/work-surface-view.test.tsx --max-warnings 0` — passed
- `pnpm typecheck` — passed
- `pnpm fallow:gate` — passed: dead code `0`, production health findings `0`, duplication `0`
- `pnpm lint` — passed
- `git diff --check` — passed

### Branch-totality proof

- **External findings triaged:** current PR feedback had one live P2 issue: entering day mode while weekends were hidden could keep a Saturday/Sunday anchor even though day rendering skipped to the next weekday.
- **Bug classes / invariants checked:** mode-switch anchor normalization, weekend initial load, hidden-weekend day rendering, and next/previous anchor consistency.
- **Sibling closure:** Turns 30 and 31 covered weekend-toggle and manual anchor writes; this pass covers the remaining mode transition into day view.
- **Architecture rule applied:** day-mode entry uses the same calendar-owned weekend visibility helper, keeping hidden-weekend policy centralized inside the calendar controls owner.
- **Why this is enough:** component coverage now asserts that switching from week to day on Saturday with weekends hidden lands on Monday `2026-05-25`.

### Resolved / Carried / New findings

#### WPDV-62 — resolved — entering day mode could preserve a hidden weekend anchor

- **Severity:** medium
- **Evidence:** `handleCalendarModeChange("day")` reset expansion and changed mode without normalizing the current anchor; a weekend anchor could remain while `getScrollAnchorDay` rendered Monday.
- **Fix:** mode changes now normalize the current anchor through the weekend visibility helper before applying the next mode.
- **Prevention:** Added a hidden-weekend mode-switch regression test and reran calendar tests, lint, typecheck, and Fallow.

### Residual risk

- I did not resolve or reply to the GitHub review thread; the branch will be pushed with the fix for Codex to re-review.

## Turn 31 — 2026-05-20 14:19 BST

| Field           | Value                                                                  |
| --------------- | ---------------------------------------------------------------------- |
| **Scope**       | PR #37 Codex feedback for manual hidden-weekend day anchors            |
| **Review type** | External PR feedback triage + calendar anchor fix + gate rerun         |
| **Reviewer**    | Codex CLI                                                              |
| **Outcome**     | 1 live PR finding fixed locally; no local open findings                |

### Commands run

- GitHub connector `fetch_pr_comments` for PR #37 — fetched the latest Codex review feedback
- `pnpm vitest run tests/components/work-surface-view.test.tsx` — passed, 1 file / 53 tests
- `pnpm exec eslint components/app/screens/work-surface-view/calendar-view.tsx tests/components/work-surface-view.test.tsx --max-warnings 0` — passed
- `pnpm typecheck` — passed
- `pnpm fallow:gate` — passed: dead code `0`, production health findings `0`, duplication `0`
- `pnpm lint` — passed
- `git diff --check` — passed

### Branch-totality proof

- **External findings triaged:** current PR feedback had one live P2 issue: manual anchor updates from the date picker or Today button could set a hidden-weekend day anchor while day rendering skipped to Monday.
- **Bug classes / invariants checked:** date picker anchor normalization, Today button anchor normalization, hidden-weekend day mode, and preserved weekday/weekend-visible behavior.
- **Sibling closure:** Turn 30 fixed the weekend toggle path; this pass applies the same calendar-owned normalization to every manual anchor write.
- **Architecture rule applied:** manual anchor writes now reuse the same pure weekend visibility helper instead of duplicating visibility policy in toolbar/date-picker code.
- **Why this is enough:** component coverage now asserts that clicking Today while the clock is on Saturday with weekends hidden lands the day view on Monday `2026-05-25`.

### Resolved / Carried / New findings

#### WPDV-61 — resolved — manual day anchors could stay on hidden weekends

- **Severity:** medium
- **Evidence:** `setCalendarAnchorDate` reset expansion and wrote the selected date directly; with hidden weekends in day mode, a Saturday/Sunday selected through the date picker or Today button diverged from the visible rendered day.
- **Fix:** `setCalendarAnchorDate` now normalizes all manual day anchors through the weekend visibility helper before storing them.
- **Prevention:** Added a Today-button regression test for hidden-weekend day mode and reran calendar tests, lint, typecheck, and Fallow.

### Residual risk

- I did not resolve or reply to the GitHub review thread; the branch will be pushed with the fix for Codex to re-review.

## Turn 30 — 2026-05-20 14:06 BST

| Field           | Value                                                              |
| --------------- | ------------------------------------------------------------------ |
| **Scope**       | PR #37 Codex feedback for day-view weekend visibility anchoring    |
| **Review type** | External PR feedback triage + calendar anchor fix + gate rerun     |
| **Reviewer**    | Codex CLI                                                          |
| **Outcome**     | 1 live PR finding fixed locally; no local open findings            |

### Commands run

- GitHub connector `fetch_pr_comments` for PR #37 — fetched the latest Codex review feedback
- `pnpm vitest run tests/components/work-surface-view.test.tsx` — passed, 1 file / 52 tests
- `pnpm exec eslint components/app/screens/work-surface-view/calendar-view.tsx tests/components/work-surface-view.test.tsx --max-warnings 0` — passed
- `pnpm typecheck` — passed
- `pnpm fallow:gate` — passed: dead code `0`, production health findings `0`, duplication `0`
- `pnpm lint` — passed
- `git diff --check` — passed

### Branch-totality proof

- **External findings triaged:** current PR feedback had one live P2 issue: hiding weekends in day mode left a Saturday/Sunday anchor active while rendering skipped to the next visible weekday.
- **Bug classes / invariants checked:** weekend-hide settings, day-mode anchor consistency, visible-day fallback behavior, and keeping visible-weekend anchors unchanged.
- **Sibling closure:** week navigation was already fixed in Turn 29; this pass covers the adjacent day-mode weekend-toggle path so hidden-weekend rendering and navigation use the same anchor.
- **Architecture rule applied:** weekend visibility anchoring lives as a pure calendar-owned helper next to visible-day navigation logic, keeping the settings handler thin and testable.
- **Why this is enough:** component coverage now asserts a hidden-weekend Saturday anchor moves to Monday `2026-05-25`, while enabling weekends keeps the Saturday date unchanged.

### Resolved / Carried / New findings

#### WPDV-60 — resolved — day view stayed anchored on a hidden weekend

- **Severity:** medium
- **Evidence:** `handleShowWeekendsChange(false)` only reset all-day expansion and toggled the setting; if the current day anchor was Saturday/Sunday, the header/navigation date could diverge from the rendered visible weekday.
- **Fix:** hiding weekends now re-anchors day mode from a weekend to the next visible weekday before applying the setting.
- **Prevention:** Added weekend visibility anchor regression coverage and reran calendar tests, lint, typecheck, and Fallow.

### Residual risk

- I did not resolve or reply to the GitHub review thread; the branch will be pushed with the fix for Codex to re-review.

## Turn 29 — 2026-05-20 13:55 BST

| Field           | Value                                                                  |
| --------------- | ---------------------------------------------------------------------- |
| **Scope**       | PR #37 Codex feedback for hidden-weekend week navigation               |
| **Review type** | External PR feedback triage + calendar navigation fix + gate rerun     |
| **Reviewer**    | Codex CLI                                                              |
| **Outcome**     | 1 live PR finding fixed locally; no local open findings                |

### Commands run

- GitHub connector `fetch_pr_comments` for PR #37 — fetched the latest Codex review feedback
- `pnpm vitest run tests/components/work-surface-view.test.tsx` — passed, 1 file / 50 tests
- `pnpm exec eslint components/app/screens/work-surface-view/calendar-view.tsx tests/components/work-surface-view.test.tsx --max-warnings 0` — passed
- `pnpm typecheck` — passed
- `pnpm fallow:gate` — passed: dead code `0`, production health findings `0`, duplication `0`
- `pnpm lint` — passed
- `git diff --check` — passed before the review-log update

### Branch-totality proof

- **External findings triaged:** current PR feedback had one live P2 issue: week navigation advanced by raw calendar days, causing overlap when weekends were hidden and the selected day count spans more calendar days than visible days.
- **Bug classes / invariants checked:** hidden-weekend navigation, visible-day page boundaries, backward/forward symmetry, and five-day workweek alignment.
- **Sibling closure:** day navigation now also steps by visible days when weekends are hidden; month navigation remains calendar-month based. Five-day hidden-weekend weeks still jump to the next workweek, while seven/fourteen-day hidden-weekend ranges advance to the next non-overlapping visible range.
- **Architecture rule applied:** visible-day navigation lives in the calendar view owner as a pure helper, separate from schedule interpretation and rendering.
- **Why this is enough:** component coverage now asserts seven-visible-day hidden-weekend navigation advances from `2026-05-18` to `2026-05-27` and back without overlap, and five-day hidden-weekend navigation advances to the next workweek.

### Resolved / Carried / New findings

#### WPDV-59 — resolved — hidden-weekend week navigation overlapped already visible days

- **Severity:** medium
- **Evidence:** `moveAnchor` used `addDays(current, weekDayCount)` in week mode; with weekends hidden, `weekDayCount` visible days can span more than `weekDayCount` calendar days.
- **Fix:** calendar navigation now advances by visible days for day/week modes and keeps month navigation on calendar months.
- **Prevention:** Added hidden-weekend navigation regression coverage and reran calendar tests, lint, typecheck, and Fallow.

### Residual risk

- I did not resolve or reply to the GitHub review thread; the branch was pushed with the fix for Codex to re-review.

## Turn 28 — 2026-05-20 13:40 BST

| Field           | Value                                                                 |
| --------------- | --------------------------------------------------------------------- |
| **Scope**       | PR #37 Codex feedback for notification toast read-state behavior      |
| **Review type** | External PR feedback triage + targeted shell fix + gate rerun         |
| **Reviewer**    | Codex CLI                                                             |
| **Outcome**     | 1 live PR finding fixed locally; no local open findings               |

### Commands run

- GitHub connector `fetch_pr_comments` for PR #37 — fetched the current Codex review feedback
- `pnpm vitest run tests/components/notification-routing.test.ts` — passed, 1 file / 9 tests
- `pnpm exec eslint components/app/shell.tsx --max-warnings 0` — passed
- `pnpm typecheck` — passed
- `pnpm fallow:gate` — passed: dead code `0`, production health findings `0`, duplication `0`
- `git diff --check` — passed before the review-log update

### Branch-totality proof

- **External findings triaged:** current PR feedback had one live P1 issue: toast dismissal could mark notifications read even when the user never saw or opened the target.
- **Bug classes / invariants checked:** notification unread-state preservation, explicit user-open read acknowledgement, already-viewing suppression path, and inbox badge integrity.
- **Sibling closure:** the already-viewing path still marks the notification read immediately because the target is visible; the toast action still marks read before routing to the target. Passive toast timeout and close no longer mark read.
- **Architecture rule applied:** notification read state remains tied to explicit viewing/opening behavior, not passive presentation lifecycle callbacks.
- **Why this is enough:** the only new read mutation introduced by the toast presentation rewrite was the `onDismiss` callback; removing it restores the prior read-state boundary while leaving intentional open/viewed read paths intact.

### Resolved / Carried / New findings

#### WPDV-58 — resolved — notification toast auto-dismiss marked unseen notifications as read

- **Severity:** high
- **Evidence:** the Sonner toast had an `onDismiss` handler that called `markNotificationRead`, and that dismissal path includes automatic timeout.
- **Fix:** removed the toast dismissal read mutation. Notifications are now marked read only when the current route is already viewing the target or when the user clicks the toast action to open it.
- **Prevention:** Re-ran shell lint, notification routing tests, typecheck, and Fallow gate.

### Residual risk

- I did not resolve or reply to the GitHub review thread because the user asked to continue with fixes, not to write back on GitHub.

## Turn 27 — 2026-05-20 13:28 BST

| Field           | Value                                                                                  |
| --------------- | -------------------------------------------------------------------------------------- |
| **Scope**       | Fallow/architecture cleanup for calendar work surfaces and final local review loop     |
| **Review type** | Static-analysis remediation + diff-review + calendar drag correctness challenger pass |
| **Reviewer**    | Codex CLI                                                                              |
| **Outcome**     | 1 local bug fixed; Fallow, lint, typecheck, and targeted tests clean; no open findings |

### Commands run

- `/Users/declancowen/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — completed; production health findings `0`, production duplication `0`, dead code `0`; boundary config remains not configured
- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh` — completed; static analyzer signals clean, `changed-file-audit` reported a tool/config error
- `pnpm exec eslint components/app/screens/work-surface-view/calendar-view.tsx tests/components/work-surface-view.test.tsx --max-warnings 0` — passed
- `pnpm vitest run tests/components/work-surface-view.test.tsx` — passed, 1 file / 48 tests
- `pnpm vitest run tests/components/work-surface-view.test.tsx tests/components/work-surface.test.tsx tests/components/views-screen.test.tsx` — passed, 3 files / 67 tests
- `pnpm typecheck` — passed
- `pnpm lint` — passed
- `pnpm fallow:gate` — passed: dead code `0`, production health findings `0`, duplication `0`
- `git diff --check` — passed
- `pnpm audit:deps` — blocked by sandbox DNS/network: `ENOTFOUND registry.npmjs.org`
- `pnpm build` — blocked by sandbox network while fetching Google Fonts: `Geist Mono` and `Noto Sans`

### Branch-totality proof

- **Fallow cleanup applied:** split the large calendar surface into owner-local render/state helpers and extracted shared event accent resolution for calendar/timeline instead of adding a new cross-app abstraction.
- **Bug classes / invariants checked:** timed-to-all-day drag semantics, explicit nullable schedule clearing, calendar hover/detail ownership, smooth day/week/month scrolling structure, all-day row expansion reset, shared accent coloring parity across calendar and timeline, and docs/view modal routing regressions covered by existing targeted tests.
- **Challenger pass:** traced the timed event drag-back-to-all-day path through `CalendarView` and the store update boundary. The first local implementation used `undefined` to clear schedule fields, but the store treats `undefined` as "unchanged"; this was fixed to send explicit `null`.
- **Architecture rule applied:** schedule interpretation remains in domain helpers, calendar interaction state remains inside the calendar owner, and timeline/calendar styling share only the small presentation-owned accent resolver.
- **Why this is enough:** the fixed weak variant now has component coverage asserting `startTime`, `endTime`, and `scheduleTimeZone` are cleared with `null`, and the static analyzer gates stayed clean after the refactor.

### Resolved / Carried / New findings

#### WPDV-57 — resolved — dragging timed calendar work into the all-day lane did not actually clear the stored time

- **Severity:** medium
- **Evidence:** the calendar patch sent `startTime: undefined`, `endTime: undefined`, and `scheduleTimeZone: undefined`; the store update path preserves existing values when patch fields are `undefined`.
- **Fix:** timed-to-all-day conversion now sends explicit `null` values for all schedule time fields.
- **Prevention:** Updated the drag-back-to-all-day component test to assert `null` clearing semantics.

### Residual risk

- Local production build and dependency audit could not complete in this sandbox because outbound network/DNS is blocked. CI should rerun those with normal network access.

## Turn 26 — 2026-05-20 08:47 BST

| Field           | Value                                                                       |
| --------------- | --------------------------------------------------------------------------- |
| **Scope**       | Current-head Codex review feedback for terminal-midnight timed event splits |
| **Review type** | External finding triage + calendar fix + gate rerun                         |
| **Reviewer**    | Codex CLI                                                                   |
| **Outcome**     | 1 live current-head Codex finding fixed locally; no local open findings     |

### Commands run

- `gh api graphql ... reviewThreads(first: 100)` — fetched current-head inline review threads for `959849a1`
- `pnpm exec vitest run tests/components/work-surface-view.test.tsx tests/lib/domain/work-item-schedule.test.ts` — passed, 2 files / 37 tests
- `pnpm typecheck` — passed
- `pnpm lint` — passed
- `pnpm fallow:gate` — passed after splitting the timed calendar entry resolver and extracting duplicated UTC test setup; dead code `0`, production health findings `0`, duplication `0`
- `pnpm audit:deps` — passed at `high` threshold; remaining advisories are low/moderate
- `git diff --check` — passed
- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh` — completed for the current working-tree delta

### Branch-totality proof

- **External findings triaged:** latest current-head Codex review found one live Medium issue: cross-day timed work ending exactly at `00:00` emitted a zero-length terminal-day segment that rendered as a visible minimum-height block.
- **Bug classes / invariants checked:** cross-day hourly segmentation, terminal-exclusive midnight boundary, visible timed entry stability, static-analysis health/duplication fitness.
- **Sibling closure:** `CalendarView` now skips zero-length timed segments while preserving the visible prior-day segment. Timed calendar entry shaping was split into owner-local helpers so the schedule display rule remains reviewable and under Fallow health thresholds.
- **Architecture rule applied:** terminal-midnight display behavior stays in the calendar presentation segmentation layer; schedule interpretation remains in the domain resolver.
- **Why this is enough:** the regression test covers a `23:30` to `00:00` cross-day item and proves no `00:00 - 00:00` phantom block renders.

### Resolved / Carried / New findings

#### WPDV-56 — resolved — cross-day timed work ending at midnight rendered a phantom terminal-day block

- **Severity:** medium
- **Evidence:** the split loop emitted a terminal entry with `startMinutes=0` and `endMinutes=0`; the timed-card minimum height made that zero-length segment visible.
- **Fix:** cross-day timed segmentation now only emits a segment when `endMinutes > startMinutes`.
- **Prevention:** Added component coverage for an overnight item ending at midnight and kept Fallow health/duplication gates clean.

### Residual risk

- Cross-midnight partial-day segments remain display-only for drag/resize; the sidebar remains the explicit edit path for those multi-segment timed items.

## Turn 25 — 2026-05-20 06:07 BST

| Field           | Value                                                                                  |
| --------------- | -------------------------------------------------------------------------------------- |
| **Scope**       | Current-head Codex review feedback for moved view selection and cross-midnight timing |
| **Review type** | External finding triage + store/domain/calendar fixes + gate rerun                    |
| **Reviewer**    | Codex CLI                                                                              |
| **Outcome**     | 2 live current-head Codex findings fixed locally; no local open findings              |

### Commands run

- `gh pr view 36 --json latestReviews` — confirmed Codex reviewed pushed head `32682756`
- `gh api graphql ... reviewThreads(first: 100)` — fetched current-head inline review threads
- `pnpm exec vitest run tests/components/work-surface-view.test.tsx tests/lib/store/view-slice.test.ts tests/lib/domain/work-item-schedule.test.ts` — passed, 3 files / 50 tests
- `pnpm typecheck` — passed
- `pnpm lint` — passed
- `pnpm fallow:gate` — passed: dead code `0`, production health findings `0`, duplication `0`
- `pnpm audit:deps` — passed at `high` threshold; remaining advisories are low/moderate
- `git diff --check` — passed
- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh` — passed; changed-file audit, production dead-code, production health, and duplication gates remained clean

### Branch-totality proof

- **External findings triaged:** current-head Codex review found two live Medium issues: updating an existing view's route did not move selected-view state from the old route to the new route, and timed items crossing midnight were represented as all-day calendar spans.
- **Bug classes / invariants checked:** per-route selected-view identity, optimistic UI state preservation, timed schedule classification, cross-day hourly rendering.
- **Sibling closure:** `updateViewConfig` now rebinds selected-view state only when the edited view was selected on the old route; unselected moved views do not steal selection. Schedule resolution now treats date ranges with both start/end times as timed even across dates, and `CalendarView` renders cross-midnight timed items as partial-day hourly segments instead of all-day bars. The segment render key includes item/date/time so multi-segment timed work reconciles stably.
- **Architecture rule applied:** selected-view rebinding lives in the view store slice that owns route selection state; timed-vs-all-day classification is fixed in the domain schedule resolver, with calendar rendering handling only display segmentation.
- **Why this is enough:** both fixes are at the owning boundary and have regression coverage: store state movement for route edits, domain resolution for later-day timed ranges, and calendar rendering for cross-midnight hourly segments.

### Resolved / Carried / New findings

#### WPDV-54 — resolved — edited view route changes left selected-view state on the old route

- **Severity:** medium
- **Evidence:** `updateExistingViewFromDraft` patched `route` through `updateViewConfig`, but the store kept `ui.selectedViewByRoute` keyed to the previous route.
- **Fix:** `updateViewConfig` now removes the moved view from the previous route selection and selects it on the new viewer-scoped route key when it was selected before the move.
- **Prevention:** Added a view-slice regression test that moves a selected view from `/workspace/items` to a project route and verifies the selection key is rebound.

#### WPDV-55 — resolved — cross-midnight timed work was converted into all-day calendar spans

- **Severity:** medium
- **Evidence:** `resolveWorkItemSchedule` only returned `timed` for same-day ranges, and `CalendarView` converted timed cross-day ranges into all-day entries.
- **Fix:** schedule resolution now treats any item with valid start/end times as timed, including later-day end dates; calendar rendering splits cross-midnight timed work into hourly partial-day segments and keeps them out of the all-day lane.
- **Prevention:** Added domain coverage for later-day timed schedule resolution and component coverage proving a `23:30`-`00:30` item renders as two hourly segments rather than an all-day button.

### Residual risk

- Cross-midnight partial-day segments are display-only for drag/resize to avoid corrupting the full schedule from a single segment. The item detail sidebar remains available for explicit edits.

## Turn 24 — 2026-05-20 05:47 BST

| Field           | Value                                                                             |
| --------------- | --------------------------------------------------------------------------------- |
| **Scope**       | Current-head Codex review feedback for timed calendar drag click suppression      |
| **Review type** | External finding triage + calendar interaction fix + targeted gate rerun          |
| **Reviewer**    | Codex CLI                                                                         |
| **Outcome**     | 1 live current-head Codex finding fixed locally; no local open findings           |

### Commands run

- `gh pr view 36 --json latestReviews` — confirmed Codex reviewed pushed head `26e89ed9`
- `gh api graphql ... reviewThreads(first: 100)` — fetched current-head inline review threads
- `pnpm exec vitest run tests/components/work-surface-view.test.tsx` — passed, 1 file / 32 tests
- `pnpm typecheck` — passed
- `pnpm lint` — passed
- `pnpm fallow:gate` — passed: dead code `0`, production health findings `0`, duplication `0`
- `pnpm audit:deps` — passed at `high` threshold; remaining advisories are low/moderate
- `git diff --check` — passed

### Branch-totality proof

- **External findings triaged:** current-head Codex review found one live Medium issue: moved/resized timed calendar events could still receive the subsequent click event and open the detail sidebar.
- **Bug classes / invariants checked:** pointer gesture lifecycle, click-vs-drag classification, transient interaction state handoff after drag commit.
- **Sibling closure:** timed move and resize paths share the same `commitDrag` path, so moved drags now suppress the next emitted click regardless of which timed action triggered the commit. Non-moved pointer clicks still open details normally.
- **Architecture rule applied:** drag/click coordination remains local to `CalendarView`, the owner of the calendar interaction state; no store or sidebar API change was needed.
- **Why this is enough:** the exact pointer-down, pointer-move, pointer-up, click sequence is covered by a component regression test, and the focused test file plus type/lint/static gates are clean.

### Resolved / Carried / New findings

#### WPDV-53 — resolved — timed drag click events could still open item detail

- **Severity:** medium
- **Evidence:** `commitDrag` nulled `dragStateRef` before React's click handler ran, so the click guard saw no moved drag and opened the docked detail sidebar after a drag.
- **Fix:** moved timed drags now set a one-click suppression flag before clearing drag state; the next emitted click clears that flag and does not open detail.
- **Prevention:** Added a regression test that performs pointer-down, pointer-move, pointer-up on the event card, emits click, and verifies the item updates without opening the detail sidebar.

### Residual risk

- Browser smoke was not rerun for this narrow pointer-event delta; the interaction is covered by focused component tests and CI will rerun after push.

## Turn 23 — 2026-05-20 05:34 BST

| Field           | Value                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------- |
| **Scope**       | Current-head Codex review feedback for personal calendar editability and timed drag bounds  |
| **Review type** | External finding triage + calendar interaction fix + static analyzer gate rerun             |
| **Reviewer**    | Codex CLI                                                                                   |
| **Outcome**     | 2 live current-head Codex findings fixed locally; no local open findings after gate rerun   |

### Commands run

- `gh pr view 36 --json latestReviews` — confirmed Codex reviewed pushed head `e1b698cf`
- `gh api graphql ... reviewThreads(first: 100)` — fetched current-head inline review threads
- `pnpm exec vitest run tests/components/work-surface-view.test.tsx` — passed, 1 file / 31 tests
- `pnpm typecheck` — passed
- `pnpm lint` — passed
- `pnpm fallow:gate` — initially failed on duplicated test setup from the new calendar drag tests, then passed after extracting test-local helpers: dead code `0`, production health findings `0`, duplication `0`
- `pnpm audit:deps` — passed at `high` threshold; remaining advisories are low/moderate
- `git diff --check` — passed

### Branch-totality proof

- **External findings triaged:** current-head Codex review found two live Medium issues: personal calendar drag/resize allowed optimistic updates for assigned items from read-only teams, and timed event moves near midnight could shorten duration by clamping only at serialization.
- **Bug classes / invariants checked:** authorization/UI editability parity for personal calendar items; drag/drop preservation for timed event duration under late-day clamping.
- **Sibling closure:** item-level calendar editability now gates timed move/resize, all-day moves, all-day-to-timed drops, all-day dragging, and docked/floating detail sidebar edit state. Timed move clamping now moves start and end together rather than clamping end only.
- **Architecture rule applied:** edit authority stays with the personal calendar screen and is passed as an item-level predicate into the shared `CalendarView`; the view owns interaction math but not team-role policy.
- **Why this is enough:** the fixes are at the shared calendar boundary and have regression coverage for denied item edits and the exact late-day 90-minute move variant that previously lost duration.

### Resolved / Carried / New findings

#### WPDV-51 — resolved — personal calendar allowed drag edits for read-only team items

- **Severity:** medium
- **Evidence:** `UserCalendarScreen` passed `editable` unconditionally to `CalendarView`, so assigned items from teams the current user cannot edit could still run optimistic `updateWorkItem` schedule mutations.
- **Fix:** personal calendar now supplies `canEditItem` using `canEditTeam(data, item.teamId)`, and `CalendarView` applies item-level editability to drag/drop/resize and detail sidebar edit state.
- **Prevention:** Added a calendar regression test that renders an editable calendar with a non-editable item predicate, attempts a timed drag, opens the detail surface, and verifies no update is attempted and the detail is read-only.

#### WPDV-52 — resolved — moving timed events late in the day could shorten their duration

- **Severity:** medium
- **Evidence:** timed move set `endMinutes = slot.minutes + duration` and relied on final time formatting to clamp to `23:59`, shortening long events moved near midnight.
- **Fix:** move now clamps the start minute to the latest value that can preserve the event's original duration within the same-day time range, then derives the end from that clamped start.
- **Prevention:** Added a timed drag regression test that moves a 90-minute event to a late-day slot and verifies it lands at `22:29`-`23:59` instead of being shortened from `23:30`.

### Residual risk

- Browser smoke was not rerun for this narrow interaction delta; the changed paths are covered by focused component tests, type/lint/static gates, and CI will rerun after push.

## Turn 22 — 2026-05-20 05:10 BST

| Field           | Value                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------ |
| **Scope**       | Current-head Codex review feedback for project presentation layouts and timeline date roll |
| **Review type** | External finding triage + domain validation fix + targeted presentation lifecycle fix       |
| **Reviewer**    | Codex CLI                                                                                  |
| **Outcome**     | 2 live current-head Codex findings fixed locally; prior unresolved PR threads rechecked    |

### Commands run

- `gh pr view 36 --json number,title,url,headRefName,headRefOid,baseRefName,baseRefOid,state,reviewDecision,latestReviews,comments` — confirmed PR #36 current head `95de17ea`
- `gh api graphql ... reviewThreads(first: 100)` — fetched inline review threads and separated stale/fixed older threads from current live findings
- `pnpm exec vitest run tests/lib/domain/project-views.test.ts tests/components/work-surface-view.test.tsx` — passed, 2 files / 40 tests
- `pnpm typecheck` — initially exposed an over-narrowed team template layout type; passed after keeping team defaults broad and narrowing only project presentation
- `pnpm lint` — passed
- `pnpm fallow:gate` — passed: dead code `0`, production health findings `0`, duplication `0`
- `pnpm audit:deps` — passed at `high` threshold; remaining advisories are low/moderate
- `git diff --check` — passed
- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh` — completed; current-turn delta, branch-total diff, PR context, and analyzer evidence recorded

### Branch-totality proof

- **External findings triaged:** unresolved PR threads for month timed entries, month navigation, UTC timezone options, private optimistic IDs, edited view metadata/project routing, fallback view defaults, timezone persistence, hover detail clearing, and pointer cancellation were rechecked against the current tree and are already fixed by Turns 18-21.
- **Live current-head findings:** Codex review found two remaining live issues: project presentation schemas could accept the global `calendar` layout even though project rendering supports only list/board/timeline, and timeline anchors froze to mount-time dates.
- **Bug classes / invariants checked:** domain validation/presentation renderer compatibility for project layouts; long-lived session date-boundary lifecycle for timeline today/window anchors.
- **Sibling closure:** project presentation now has its own supported layout union and schema while team/work views continue to use the full global layout set; timeline recalculates all date anchors from the same `today` state after the local day boundary.
- **Architecture rule applied:** the supported project-layout invariant is enforced in the domain type and Zod schema rather than patched in the renderer; the timeline date lifecycle stays inside the presentation component with behavior-level coverage.
- **Why this is enough:** both findings are fixed at their owning boundary, older current-head threads have current-tree proof, and focused tests plus type/lint/static gates cover the changed contract and lifecycle paths.

### Resolved / Carried / New findings

#### WPDV-49 — resolved — project presentation configs accepted unsupported calendar layouts

- **Severity:** medium
- **Evidence:** the global `viewLayouts` union now includes `calendar`, and `projectSchema.presentation.layout` reused that union even though `ProjectItemsBody` renders only list, board, and timeline.
- **Fix:** added a project-specific presentation layout union/schema for list, board, and timeline; unsupported calendar defaults normalize back to the template's supported default layout.
- **Prevention:** Added domain tests proving `projectSchema` rejects `presentation.layout: "calendar"` and default project presentation creation normalizes an unsupported calendar option.

#### WPDV-50 — resolved — timeline today/window anchors became stale in long-lived sessions

- **Severity:** low
- **Evidence:** timeline `today`, `timelineStart`, and `timelineEnd` were memoized with an empty dependency array, so tabs left open across midnight could show stale today markers and date ranges.
- **Fix:** timeline now stores `today` in state, schedules a local date-boundary refresh, and derives `timelineStart`/`timelineEnd` from that refreshed state.
- **Prevention:** Added a fake-timer regression test that mounts just before midnight, advances through the date boundary, and verifies the today marker moves to the new local date.

### Residual risk

- Browser smoke was not rerun for this narrow validation/lifecycle delta; the broader calendar/work-surface browser risk was covered earlier, and this pass is covered by focused component/domain tests plus CI after push.

## Turn 21 — 2026-05-20 04:48 BST

| Field           | Value                                                                 |
| --------------- | --------------------------------------------------------------------- |
| **Scope**       | Current-head Codex review feedback for calendar hover and drag cancel |
| **Review type** | External finding triage + targeted interaction fix + gate rerun       |
| **Reviewer**    | Codex CLI                                                             |
| **Outcome**     | 2 live current-head Codex review findings fixed locally               |

### Commands run

- `gh pr view 36 --json headRefOid,reviews,comments` — confirmed current-head review on `9060a63f`
- `gh api repos/declancowen/Linear/pulls/36/comments --paginate` — fetched current-head inline findings
- `pnpm exec vitest run tests/components/work-surface-view.test.tsx` — passed, 1 file / 28 tests
- `pnpm typecheck` — initially failed on ignored duplicate `.next/types/* 2.ts` / `* 3.ts` generated files; passed after removing only those generated duplicates
- `pnpm lint` — passed
- `pnpm fallow:gate` — passed: dead code `0`, production health findings `0`, duplication `0`
- `pnpm audit:deps` — passed at `high` threshold; remaining advisories are low/moderate
- `git diff --check` — passed
- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh` — completed; current-turn delta, branch-total diff, and analyzer evidence recorded

### Branch-totality proof

- **External findings triaged:** current-head Codex review found two live Medium issues in `CalendarView`: hover detail could remain stuck after leaving an event, and pointer cancellation could leave timed drag state live.
- **Bug classes / invariants checked:** lifecycle/transient container for hover detail, atomicity/transient input cancellation for drag state, pointer identity for active drag commits.
- **Sibling closure:** all calendar item hover paths now use the same delayed detail clear; timed move, resize-start, and resize-end share pointer-id guarded movement, commit, and cancellation through the timed grid.
- **Architecture rule applied:** the interaction state remains owned by `CalendarView`; tests assert user-observable behavior instead of exposing drag state internals.
- **Why this is enough:** the weak variants from the review are directly covered: leaving an item after the floating detail opens clears it, and `pointercancel` prevents a later `pointerup` from committing a stale drag.

### Resolved / Carried / New findings

#### WPDV-47 — resolved — floating calendar detail could remain stuck after pointer leaves an item

- **Severity:** medium
- **Evidence:** item `onMouseLeave` only cleared the open timer and did not clear an already-open `hoveredItemId`.
- **Fix:** calendar item mouse-leave now schedules a short delayed detail clear, while the floating detail itself still cancels that timer on entry so users can hover into it.
- **Prevention:** Added a fake-timer regression test that opens the floating detail, leaves the item, advances the clear delay, and verifies the floating detail is gone.

#### WPDV-48 — resolved — cancelled timed drags could commit on a later pointer-up

- **Severity:** medium
- **Evidence:** timed drag state was cleared on `pointerup` only; `pointercancel` left `dragStateRef` populated, and movement/commit did not check `pointerId`.
- **Fix:** timed drag movement, cancellation, and commit now guard on the active `pointerId`; `pointercancel` clears the drag state.
- **Prevention:** Added a timed calendar drag regression test that starts a drag, dispatches `pointercancel`, then dispatches `pointerup` and asserts no work item update is requested.

### Residual risk

- Browser smoke was not rerun for this narrow interaction delta; the calendar interaction paths are covered by focused component tests and will be rechecked by CI after push.

## Turn 20 — 2026-05-20 04:25 BST

| Field           | Value                                                                                 |
| --------------- | ------------------------------------------------------------------------------------- |
| **Scope**       | PR review loop for fallback view edits and timezone persistence in detail time edits  |
| **Review type** | External finding triage + targeted implementation review + static analyzer gate rerun |
| **Reviewer**    | Codex CLI                                                                             |
| **Outcome**     | 2 live current-head Codex review findings fixed locally; no local open findings       |

### Commands run

- `gh pr checks 36 --watch=false` — passed on pushed `3af970bb` before this local PR-feedback delta
- `gh pr view 36 --json headRefOid,headRefName,baseRefName,url,reviewDecision,comments,reviews` — confirmed latest reviewed head `3af970bb` and current PR context
- `pnpm exec vitest run tests/components/work-surface.test.tsx` — passed, 1 file / 8 tests
- `pnpm exec vitest run tests/components/work-item-detail-screen.test.tsx` — passed, 1 file / 19 tests
- `pnpm exec vitest run tests/components/work-surface.test.tsx tests/components/work-item-detail-screen.test.tsx` — passed, 2 files / 27 tests
- `pnpm typecheck` — passed
- `pnpm lint` — passed
- `pnpm fallow:gate` — passed: dead code `0`, production health findings `0`, duplication `0`
- `pnpm audit:deps` — passed at `high` threshold; remaining advisories are low/moderate
- `git diff --check` — passed
- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh` — completed; current-turn delta, PR context, branch-total diff, and analyzer evidence recorded

### Branch-totality proof

- **External findings triaged:** current-head Codex review found two live Medium issues: fallback viewbar edits used persisted-view actions without a base view, and start/end time edits could leave legacy items without `scheduleTimeZone`.
- **Bug classes / invariants checked:** preservation and fallback state ownership for view defaults; compatibility/legacy-data and optimistic-persisted payload parity for timezone-bearing time edits.
- **Sibling closure:** filter toggles, property toggles/reorder/clear, hidden-state toggles, and view-config patches now share the same local fallback owner; both start and due time handlers use the resolved schedule timezone when a timed value is set.
- **Architecture rule applied:** fallback views remain local fallback state instead of becoming malformed persisted viewer overrides; work item schedule timezone resolution is a shared detail-screen helper reused by display and edit handlers.
- **Why this is enough:** the fixes are at the owning UI/store boundary, have focused regression coverage for the weak `null scheduleTimeZone` and fallback-view variants, and all configured static gates are clean.

### Resolved / Carried / New findings

#### WPDV-45 — resolved — fallback viewbar edits could discard default filters/properties

- **Severity:** medium
- **Evidence:** `WorkSurface` passed fallback view IDs into persisted viewer action helpers; those helpers resolve their base view from `state.views`, where fallback views do not exist.
- **Fix:** fallback surfaces skip persisted viewer overrides and apply viewbar mutations directly to `localFallbackViews`, preserving the cloned fallback defaults.
- **Prevention:** Added a fallback surface regression test that toggles a filter and display property, verifies previous fallback defaults remain present, and confirms no persisted viewer override is written.

#### WPDV-46 — resolved — editing start/end times did not persist a schedule timezone for legacy items

- **Severity:** medium
- **Evidence:** `onStartTimeChange` and `onEndTimeChange` patched only `startTime`/`endTime`, so items with `scheduleTimeZone: null` could remain viewer-timezone-relative.
- **Fix:** detail time edit handlers now include the resolved schedule timezone when a timed value is set and the item lacks that resolved timezone.
- **Prevention:** Added sidebar-surface coverage for both Start and Due time edits on an item with `scheduleTimeZone: null`, asserting local optimistic state and sync payload include `Europe/London`.

### Residual risk

- Browser smoke was not rerun for this narrow PR-feedback delta; the touched UI paths are covered by focused component tests and the broader PR already has calendar/detail surface coverage.

## Turn 19 — 2026-05-19 22:46 BST

| Field           | Value                                                                          |
| --------------- | ------------------------------------------------------------------------------ |
| **Scope**       | PR review loop for timezone options, private optimistic IDs, and edited views  |
| **Review type** | External finding triage + targeted diff-review + static analyzer gate rerun    |
| **Reviewer**    | Codex CLI                                                                      |
| **Outcome**     | 3 live PR findings fixed locally; no local open findings; ready to push        |

### Commands run

- `python3 .../gh-address-comments/scripts/fetch_comments.py` — fetched unresolved PR review threads for #36
- `pnpm exec vitest run tests/lib/time-zone.test.ts tests/lib/store/work-item-actions.test.ts tests/lib/store/view-slice.test.ts tests/components/create-dialogs.test.tsx tests/app/api/work-route-contracts.test.ts` — passed, 5 files / 83 tests
- `pnpm typecheck` — passed
- `pnpm lint` — passed
- `pnpm fallow:gate` — passed: dead code `0`, production health findings `0`, duplication `0`
- `pnpm audit:deps` — passed at `high` threshold; remaining advisories are low/moderate
- `git diff --check` — passed
- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh` — completed; PR context, branch-total diff, and analyzer evidence recorded
- `gh run view 26127327310 --log-failed` / `gh run view 26127330138 --log-failed` — CI failed in the same detail-screen retry test timeout
- `pnpm exec vitest run tests/components/work-item-detail-screen.test.tsx` — passed locally after increasing the slow integration-style test timeout, 1 file / 17 tests

### Branch-totality proof

- **External findings triaged:** `CDR-002`, `CDR-003`, and `CDR-004` were live against pushed `e63501db`; the old month-calendar threads are stale or already resolved in the current tree.
- **Hotspots revalidated:** shared timezone option contract, optimistic private work-item numbering, create/edit view modal state, store/API/Convex view update contracts, and route schema validation.
- **Architecture rule applied:** view metadata edits now flow through the same view-config domain/API/Convex update path instead of a dialog-local bypass; the repeated patch type is owned by the domain contract.
- **Why this is enough:** each PR finding has a focused regression test at the layer that owns the invariant, and the broad static/type/lint gates are clean after the fix.

### Resolved / Carried / New findings

#### WPDV-41 — resolved — timezone pickers could not select UTC on runtimes where `Intl.supportedValuesOf("timeZone")` omits it

- **Severity:** medium
- **Evidence:** PR automation confirmed the runtime timezone list can omit `UTC` while the app default/fallback is `UTC`.
- **Fix:** `getSupportedTimeZones()` now prepends the fallback timezone and deduplicates the runtime list.
- **Prevention:** Added a timezone utility regression test that mocks a runtime list without `UTC`.

#### WPDV-42 — resolved — optimistic private work-item keys counted private items from other teams

- **Severity:** medium
- **Evidence:** client optimistic numbering filtered by private visibility and creator but not by `teamId`, while the server numbering is team-scoped.
- **Fix:** the private optimistic count now includes `item.teamId === input.teamId`.
- **Prevention:** Added a store regression test where another team's private item must not advance the current team's `PRIVATE-002` key.

#### WPDV-43 — resolved — edited view descriptions and project route/container selections were discarded

- **Severity:** medium
- **Evidence:** the edit path returned after updating name/config only, ignoring the dialog's visible description and selected project route/container state.
- **Fix:** edited views now send description, route, `containerType`, and `containerId` through `updateViewConfig`; the shared patch contract, API schema, server wrapper, and Convex mutation all accept and validate those fields.
- **Prevention:** Added dialog, store, and route-contract coverage, including rejection for incomplete container patches.

#### WPDV-44 — resolved — CI timed out on the cross-item mention retry test

- **Severity:** medium
- **Evidence:** both GitHub Actions jobs timed out on `tests/components/work-item-detail-screen.test.tsx` while running the full suite, while the test file passed locally but spent over 10 seconds across 17 tests.
- **Fix:** the specific cross-item retry scenario now has a 10 second timeout because it exercises multiple editor open/save/rerender cycles under the full-suite runner.
- **Prevention:** Reran the detail-screen test file and lint locally before pushing the stabilization.

### Residual risk

- Full `pnpm test` and `pnpm build` were not rerun locally for this small PR-feedback delta; the pushed branch is relying on GitHub CI for the full check after the timeout stabilization.

## Turn 18 — 2026-05-19 20:34 BST

| Field           | Value                                                                         |
| --------------- | ----------------------------------------------------------------------------- |
| **Scope**       | Calendar multi-day spans, PR review feedback, and CI dependency audit failure |
| **Review type** | PR feedback triage + targeted diff-review + architecture/security check       |
| **Reviewer**    | Codex CLI                                                                     |
| **Outcome**     | 4 issues fixed locally; no local open findings; changes intentionally unpushed |

### Commands run

- `gh pr checks 36 --repo declancowen/Linear` — PR still failed on pushed commit `153bc2f6`; current local fixes are unpushed
- `python3 .../gh-fix-ci/scripts/inspect_pr_checks.py --repo . --pr 36 --json` — CI root cause was `pnpm audit:deps` failing on critical `sanitize-html@2.17.3`
- `pnpm exec vitest run tests/lib/content/rich-text-security.test.ts tests/components/work-surface-view.test.tsx` — passed, 2 files / 30 tests
- `pnpm exec vitest run tests/components/work-surface-view.test.tsx` — passed after month-span adjustment, 1 file / 26 tests
- `pnpm typecheck` — passed
- `pnpm lint` — passed
- `pnpm fallow:gate` — passed: dead code `0`, production health findings `0`, duplication `0`
- `pnpm audit:deps` — passed at `high` threshold; remaining advisories are low/moderate
- `pnpm test` — passed, 182 files / 1021 tests
- `pnpm build` — passed
- `git diff --check` — passed
- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh` — completed; current-turn delta and PR context recorded
- `/Users/declancowen/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — completed; production health and duplication clean, no branch-specific architecture blocker identified

### Branch-totality proof

- **Non-delta files/systems re-read:** calendar view day/week/month rendering, work-surface component tests, rich-text sanitization boundary, package dependency audit path, PR review comments, and CI logs.
- **External findings triaged:** Codex PR comments for month-mode timed items and month navigation were live against pushed `153bc2f6`; both are fixed in the local tree. CI audit failure was live and caused by a direct vulnerable dependency.
- **Prior resolved/adjacent areas revalidated:** calendar hover/sidebar behavior remains on the shared `WorkItemDetailSidebarSurface`; timed drag/resize and all-day-to-timed drop paths remain intact; rich-text storage still preserves allowed editor markup and trims message display whitespace.
- **Hotspots or sibling paths revisited:** all-day calendar rendering in day/week and month, timed month entries, navigation controls, sanitizer raw-text container handling, unsafe URL filtering, package lock integrity, and dependency audit gate.
- **Dependency/adjacent surfaces revalidated:** removing `sanitize-html` keeps sanitization inside `lib/content/rich-text-security.ts` using existing `linkedom`; no new dependency or audit suppression was added.
- **Why this is enough:** the user-visible calendar span behavior is now covered in both week and month modes, the PR feedback has direct regression tests, and the CI failure class is removed by deleting the vulnerable package rather than weakening the gate.

### Challenger pass

- done — Checked whether merged all-day spans only needed day/week support. Month view had the same repeated-per-day failure mode, so it now splits merged spans by visible calendar week instead of rendering one copy in each day cell.
- done — Checked whether the audit failure could be muted because the local sanitizer options excluded `xmp`. CI would still fail on the vulnerable direct dependency, so the safer fix removes `sanitize-html` and covers the advisory payload with a regression test.
- done — Checked whether month cells should continue deriving entries only from all-day records. Timed work is real scheduled work in month mode too, so same-day timed entries are now included with a time label.

### Resolved / Carried / New findings

#### WPDV-37 — resolved — multi-day all-day calendar items repeated instead of spanning

- **Severity:** medium
- **Evidence:** user reported multi-day all-day events should render as merged events rather than one event per day.
- **Fix:** Day/week all-day lanes now place a single absolute span across visible day columns, and month mode splits all-day spans per visible calendar week rather than per day cell.
- **Prevention:** Added calendar regression coverage asserting a multi-day all-day work item appears once in week mode and once in month mode.

#### WPDV-38 — resolved — month mode hid same-day timed work

- **Severity:** high
- **Evidence:** Codex PR comment noted month mode derived entries only from all-day records while same-day scheduled work lived in `timedEntries`.
- **Fix:** Month cells now include same-day timed entries with a compact time label.
- **Prevention:** Added a focused calendar test that switches to month mode and verifies timed work remains visible.

#### WPDV-39 — resolved — month navigation advanced by 28 days instead of one calendar month

- **Severity:** medium
- **Evidence:** Codex PR comment noted previous/next month controls used a fixed 28-day jump.
- **Fix:** Month navigation now uses `addMonths`, while week/day keep their existing 7-day and 1-day movement.
- **Prevention:** Added a focused calendar test that switches to month mode and verifies the next period lands on the next calendar month.

#### WPDV-40 — resolved — CI dependency audit failed on vulnerable `sanitize-html`

- **Severity:** high
- **Evidence:** GitHub Actions failed in `pnpm audit:deps` on critical advisory `GHSA-rpr9-rxv7-x643` for direct dependency `sanitize-html@2.17.3`.
- **Fix:** Replaced the direct package with an owner-local DOM sanitizer using the existing `linkedom` dependency, removed `sanitize-html` and its types from the manifest/lockfile, and preserved the existing allowed rich-text tags, attributes, class, style, URL, and message-trimming behavior.
- **Prevention:** Added a raw-text container regression test for the `xmp` bypass shape; dependency audit now passes at the CI threshold.

### Residual risk

- PR #36 still shows failed checks until these local fixes are pushed. No browser screenshot smoke was rerun in this turn; the current proof is component tests, full Vitest, build, lint, typecheck, Fallow, audit, and code review.

## Turn 17 — 2026-05-19 19:31 BST

| Field           | Value                                                                 |
| --------------- | --------------------------------------------------------------------- |
| **Scope**       | Calendar hover detail, workspace item-view routing, and create-view UX |
| **Review type** | Targeted diff-review + architecture UI/routing boundary check          |
| **Reviewer**    | Codex CLI                                                              |
| **Outcome**     | 1 user-reported issue family fixed locally; no local open findings     |

### Commands run

- `pnpm exec vitest run tests/lib/domain/default-views.test.ts tests/components/create-dialogs.test.tsx tests/components/work-item-detail-screen.test.tsx tests/components/work-surface.test.tsx tests/components/work-surface-view.test.tsx` — passed, 5 files / 87 tests
- `pnpm typecheck` — passed
- `pnpm lint` — passed
- `pnpm test` — passed, 182 files / 1017 tests
- `pnpm build` — passed and included `/workspace/items`
- `pnpm fallow:gate` — passed: dead code `0`, production health findings `0`, duplication `0`
- `git diff --check` — passed
- `/Users/declancowen/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — completed; production health and duplication clean, no branch-specific architecture blocker identified
- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh` — completed; reported `changed-file-audit: tool/config error (exit 2)` because the worktree is still on `main` with no PR branch, while direct Fallow gates passed cleanly
- `pnpm exec vitest run tests/components/work-item-detail-screen.test.tsx` — passed on rerun after a parallel focused run timed out in an existing mention-retry test under concurrent lint/typecheck load

### Branch-totality proof

- **Non-delta files/systems re-read:** create-view route selection, workspace item default view routing, work surface topbar create-view launch, calendar hover/detail rendering, work-item detail sidebar variant rendering, and the current review/static-analysis history.
- **Prior open findings rechecked:** no open findings were recorded from Turn 16; the current user report mapped to the calendar floating detail using the full docked sidebar content and workspace item views still acting project-required.
- **Prior resolved/adjacent areas revalidated:** document/project/item create-view modal switching still uses the relevant taskbar controls; project-specific item views still save to project detail routes when a project is intentionally selected; docked work-item sidebars still keep Relations and Activity.
- **Hotspots or sibling paths revisited:** calendar month/all-day/timed hover entry points, workspace item route availability, workspace/team create-view scope locking, default route validation, and detail sidebar floating/docked variants.
- **Dependency/adjacent surfaces revalidated:** Fallow duplication caught the duplicated calendar hover handler introduced by the month/all-day hover parity change; that was extracted and the Fallow gate reran clean.
- **Why this is enough:** the optional-project behavior is now owned by the default view-route contract, the actual `/workspace/items` route exists, and the calendar hover remains the same work-item detail surface with variant-specific section visibility rather than a separate detail implementation.

### Challenger pass

- done — Checked whether the floating calendar detail should be a bespoke lightweight card. That would drift from the requested Work Details sidebar behavior, so the fix keeps `WorkItemDetailSidebarSurface` as the single surface and gates only the expensive sections by `variant === "floating"`.
- done — Checked whether workspace item views should continue requiring a project route. That preserved the old broken modal behavior, so the default route contract now allows `/workspace/items` while project-selected item views still route to their project detail.

### Resolved / Carried / New findings

#### WPDV-36 — resolved — calendar hover detail used full sidebar sections and workspace item views still behaved project-required

- **Severity:** medium
- **Evidence:** user reported the calendar hover popup should match the Work Details sidebar but omit Relations and Activity, remain visible in sidebar calendar contexts, and the view modal should not force a project before creating a workspace item view.
- **Fix:** Floating work-item detail sidebars now hide Relations and Activity, the calendar hover anchor centers on the hovered event and clamps to the viewport, month entries now use the same delayed hover behavior, workspace item views default to `/workspace/items`, and a real workspace item surface route was added.
- **Prevention:** Added regression coverage for workspace item default routes, creating workspace item views without a project, and floating detail sidebars omitting the heavy sections.

### Residual risk

- Browser smoke was not rerun in this turn. Earlier local dev-server smoke was blocked by stale unkillable local processes, so the current presentation proof is build, component coverage, and route generation rather than an interactive screenshot pass.

## Turn 16 — 2026-05-13 17:00 BST

| Field           | Value                                                                           |
| --------------- | ------------------------------------------------------------------------------- |
| **Scope**       | Private task ownership, assignee visibility, and private task notification flow |
| **Review type** | Targeted diff-review + architecture state/persistence boundary check            |
| **Reviewer**    | Codex CLI                                                                       |
| **Outcome**     | 1 user-reported issue family fixed locally; no local open findings              |

### Commands run

- `pnpm test tests/lib/domain/view-item-level.test.ts tests/lib/domain/default-views.test.ts tests/components/properties-chip-popover.test.tsx tests/components/work-item-detail-screen.test.tsx tests/lib/store/work-item-actions.test.ts tests/convex/work-item-handlers.test.ts tests/components/create-dialogs.test.tsx tests/components/work-surface-view.test.tsx` — passed, 8 files / 127 tests
- `pnpm test tests/lib/store/work-item-actions.test.ts` — passed after the final notification-order preservation tweak, 1 file / 14 tests
- `pnpm typecheck` — passed
- `pnpm lint` — passed
- `pnpm build` — passed
- `git diff --check` — passed
- `pnpm fallow:gate` — dead-code and production health passed; full duplication still fails on the known full-repo baseline (`12` clone groups), with `0` clone groups touching changed files after rerun
- `pnpm exec fallow dupes --ignore-imports --format json --quiet --explain` — rerun confirmed `0` changed-file clone groups
- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh` — completed; changed-file audit passed with dead code `0`, complexity `0`, clone groups `0`
- `/Users/declancowen/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — completed; no branch-specific architecture blocker

### Branch-totality proof

- **Non-delta files/systems re-read:** personal work index read-model selection, private work item create dialog defaults, work surface grouped create context, work item detail sidebar, inline property controls, optimistic store update flow, and Convex work item update/notification handlers.
- **Prior open findings rechecked:** no open findings were recorded from Turn 15; the current user-reported issue mapped to private tasks still using visible assignee semantics in My Items and update paths.
- **Prior resolved/adjacent areas revalidated:** private create dialogs still submit `visibility: "private"`, `assigneeId: null`, and `primaryProjectId: null`; grouped Add item flows still inherit the private create context; personal read models already include private items by creator or legacy assignee.
- **Hotspots or sibling paths revisited:** default personal views, persisted display props, properties popover, group options, inline row/card controls, child rows, detail sidebar, optimistic notifications, Convex persistence, assignment emails, and status notifications.
- **Dependency/adjacent surfaces revalidated:** team/workspace My Items views still use assignee for team-visible work; private work uses `visibility: "private"` plus creator/legacy assignee association and does not expose assignee as a configurable private-board property.
- **Why this is enough:** ownership is now enforced at the selector/read layer, hidden at every edited UI surface, and protected at both optimistic store and Convex mutation boundaries so client bypasses cannot persist private-task assignee/project changes or emit assignment/status notifications.

### Challenger pass

- done — Checked the tempting alternative of keeping private tasks assigned to the current user. That would keep the board working but preserve the exact notification/configuration coupling the user wants removed. The implemented owner is private visibility plus creator id, with legacy assignee support only for old records.

### Resolved / Carried / New findings

#### WPDV-35 — resolved — private task boards depended on visible assignee state and still exposed assignee controls

- **Severity:** medium
- **Evidence:** user reported private tasks disappeared after assignee was removed, while My Items properties still showed assignee. Current code selected My Items by `assigneeId` and allowed assignee display/update paths to survive on private tasks.
- **Fix:** Personal work selectors now include private work created by the current user, private task views remove assignee from default/persisted display props and grouping options, private inline/detail/child surfaces hide assignee controls, and store/Convex update paths strip private assignee/project patches.
- **Prevention:** Added domain, component, store, and Convex regression tests for private creator selection, no assignee properties, hidden detail assignee controls, stripped optimistic updates, and server-side notification suppression.

### Residual risk

- Full-repo Fallow duplication remains at the known baseline (`12` groups). Changed-file audit and changed-file duplicate inspection are clean, production health is clean, and no branch-specific Fallow blocker remains.

## Turn 15 — 2026-05-13 13:59 BST

| Field           | Value                                                                          |
| --------------- | ------------------------------------------------------------------------------ |
| **Scope**       | GitHub Codex review follow-up for private labels in personal item view filters |
| **Review type** | Targeted diff-review + architecture validation-boundary check                  |
| **Reviewer**    | Codex CLI                                                                      |
| **Outcome**     | 1 current-head Codex finding fixed locally; no local open findings             |

### Commands run

- `gh pr view 34 --json headRefOid,latestReviews,reviewDecision,statusCheckRollup,url` — confirmed current PR context before triage
- `gh api graphql ... reviewThreads` — found current-head P2 thread `PRRT_kwDOR_9-1s6BwWR5` for private labels being offered by personal item views but rejected by workspace-only label validation
- `pnpm install --frozen-lockfile` — restored the package/toolchain state after removing accidental local runtime/package changes
- `pnpm test tests/convex/work-helpers.test.ts tests/convex/view-handlers.test.ts` — passed, 2 files / 11 tests
- `pnpm exec eslint convex/app/work_helpers.ts convex/app/view_handlers.ts tests/convex/work-helpers.test.ts tests/convex/view-handlers.test.ts --max-warnings 0` — passed
- `pnpm typecheck` — passed
- `pnpm build` — passed
- `git diff --check` — passed
- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh` — completed; no dead code or health finding, with one low-risk duplicate test-setup clone group
- `/Users/declancowen/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — completed; no branch-specific architecture blocker, with the same limited test duplication signal

### Branch-totality proof

- **Non-delta files/systems re-read:** label domain helpers, workspace label validation, work-item label assignment validation, view filter mutation handling, and create-view scope limits.
- **Prior open findings rechecked:** The current-head Codex thread was live and mapped to `toggleViewFilterValueHandler` using `assertWorkspaceLabelIds` for every label filter mutation.
- **Prior resolved/adjacent areas revalidated:** Team/workspace view creation still uses workspace-only labels because the create-view handler only supports team and workspace scopes.
- **Hotspots or sibling paths revisited:** Private task label assignment remains owned by the work-item label validator, while personal item view filters now validate visible labels through the view-aware validator.
- **Dependency/adjacent surfaces revalidated:** Team/workspace and non-item views still reject private labels; owned personal item views can use workspace labels and the current user's private labels but reject another user's private labels.
- **Why this is enough:** The authoritative Convex mutation boundary now matches the UI/read-model behavior that can surface private labels inside personal item views without weakening shared view validation.

### Challenger pass

- done — Rechecked whether changing `assertWorkspaceLabelIds` globally would be simpler. That would allow private labels in shared project/workspace contexts, so the fix is a narrower view-aware validator used only by label filter toggles.

### Resolved / Carried / New findings

#### WPDV-34 — resolved — private labels in personal item view filters were rejected by workspace-only validation

- **Severity:** medium
- **Evidence:** current-head Codex review thread `PRRT_kwDOR_9-1s6BwWR5` flagged that personal item views can display private label filter options from visible items, but saving/toggling the filter rejected every non-workspace label.
- **Fix:** Added `assertViewLabelIds`, which permits visible labels for the current user's owned personal item views and preserves workspace-only validation everywhere else; `toggleViewFilterValueHandler` now uses that view-aware validator.
- **Prevention:** Added Convex helper coverage for allowed/rejected private labels and a view-handler test proving label filter toggles call the view-aware validator with the full view scope.

### Residual risk

- Diff-review and architecture preflight both reported one duplicate clone group from focused test setup/branch variants. This is accepted for this turn because the duplication is confined to tests and no production dead-code, health, or architecture blocker was found.

## Turn 14 — 2026-05-13 13:42 BST

| Field           | Value                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------- |
| **Scope**       | GitHub Codex review follow-up for `/workspaces`, plus local team-icon and live-doc awareness fixes |
| **Review type** | Targeted diff-review + architecture routing/state boundary check                                   |
| **Reviewer**    | Codex CLI                                                                                          |
| **Outcome**     | 1 current-head Codex finding fixed locally; no local open findings                                 |

### Commands run

- `gh pr view 34 --json headRefOid,latestReviews,reviewDecision,statusCheckRollup,url` — confirmed latest pushed head `d1aed497` had green CI and a new Codex review
- `gh api graphql ... reviewThreads` — found one current-head P2 thread for `/workspaces` redirecting away when a valid selected-workspace cookie exists
- `pnpm test tests/app/root-pages.test.tsx tests/hooks/use-document-collaboration.test.tsx tests/components/settings-screen-helpers.test.ts tests/lib/store/workspace-slice.test.ts` — passed, 4 files / 36 tests
- `pnpm typecheck` — passed
- `pnpm exec eslint app/workspaces/page.tsx components/app/settings-screens/team-settings-draft.tsx hooks/use-document-collaboration.ts tests/app/root-pages.test.tsx tests/hooks/use-document-collaboration.test.tsx tests/components/settings-screen-helpers.test.ts tests/lib/store/workspace-slice.test.ts --max-warnings 0` — passed
- `git diff --check` — passed
- `pnpm build` — passed
- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh` — completed; changed-file audit passed with dead code `0`, complexity `0`, clone groups `0`
- `/Users/declancowen/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — completed; production health and production duplication clean, no branch-specific architecture blocker

### Branch-totality proof

- **Non-delta files/systems re-read:** workspace entry routing, `/workspaces` route rendering, workspace selector component contract, team settings save path, app-store team detail update path, and document collaboration awareness event handling.
- **Prior open findings rechecked:** The latest current-head Codex thread was live and mapped to the current `/workspaces` route. It is fixed locally in this turn.
- **Prior resolved/adjacent areas revalidated:** Team icon persistence remains covered by store tests, and the team settings helper now avoids a stale server refresh that could overwrite the optimistic sidebar update.
- **Hotspots or sibling paths revisited:** Single/zero workspace entry behavior still redirects through the existing navigation resolver; multiple workspace users can manually open the selector route even when their selected cookie is valid.
- **Dependency/adjacent surfaces revalidated:** Live document awareness updates now no-op when duplicate same-user sessions emit unchanged presence heartbeats, avoiding a React update loop while preserving real position changes.
- **Why this is enough:** The selector-route decision now depends on available workspace count rather than only the resolver navigation kind, so manual workspace switching remains reachable without weakening first-entry routing.

### Challenger pass

- done — Rechecked whether `navigation.kind === "selector"` alone was the correct render gate. It was not, because the same resolver also returns `target` for multi-workspace users with a valid cookie, even when they explicitly navigate to `/workspaces`.

### Resolved / Carried / New findings

#### WPDV-33 — resolved — workspace selector route redirected away for multi-workspace users with a valid cookie

- **Severity:** medium
- **Evidence:** current-head Codex review thread `PRRT_kwDOR_9-1s6BwEz5` flagged `/workspaces` as unusable for manual switching when `resolveWorkspaceEntryNavigation` returned `kind: "target"` due to an already-selected workspace.
- **Fix:** `/workspaces` now renders the selector whenever at least two workspaces are available, while zero/one workspace users still follow the existing redirect path.
- **Prevention:** Added root-page coverage proving the selector route renders for two workspaces even when the resolver reports a valid selected workspace target.

### Additional local fixes

- Team settings no longer calls `router.refresh()` after `updateTeamDetails()`, so the sidebar uses the optimistic store update immediately instead of being clobbered by a stale server seed.
- Document collaboration viewer state now ignores unchanged awareness heartbeats, which prevents duplicate same-user browser sessions from causing maximum-update-depth loops while still updating when active block presence changes.

## Turn 13 — 2026-05-13 13:30 BST

| Field           | Value                                                                      |
| --------------- | -------------------------------------------------------------------------- |
| **Scope**       | GitHub Codex review follow-up for private custom property value visibility |
| **Review type** | Targeted diff-review + architecture read-model boundary check              |
| **Reviewer**    | Codex CLI                                                                  |
| **Outcome**     | 1 current-head Codex finding fixed locally; no local open findings         |

### Commands run

- `gh pr view 34 --json headRefOid,latestReviews,reviewDecision,statusCheckRollup,url` — confirmed latest Codex top-level review was on current pushed head `c2be7040` and both CI runs were green
- `gh api graphql ... reviewThreads` — found one current-head P1 inline thread for private custom property value leakage despite the top-level review body not summarizing it
- `pnpm test tests/lib/scoped-read-models.test.ts tests/convex/auth-bootstrap-health.test.ts tests/convex/access.test.ts tests/convex/document-handlers.test.ts tests/convex/comment-handlers.test.ts tests/lib/display-initials.test.ts tests/convex/work-item-handlers.test.ts tests/convex/custom-property-handlers.test.ts tests/convex/view-handlers.test.ts` — passed, 9 files / 63 tests
- `pnpm typecheck` — passed
- `pnpm exec eslint convex/app/auth_bootstrap.ts lib/scoped-sync/read-models.ts tests/lib/scoped-read-models.test.ts tests/convex/auth-bootstrap-health.test.ts convex/app/access.ts convex/app/comment_handlers.ts convex/app/document_handlers.ts tests/convex/access.test.ts tests/convex/comment-handlers.test.ts tests/convex/document-handlers.test.ts lib/display-initials.ts tests/lib/display-initials.test.ts components/app/shell.tsx --max-warnings 0` — passed
- `git diff --check` — passed
- `pnpm exec convex dev --once` — passed, Convex functions ready
- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh` — completed; changed-file audit passed with dead code `0`, complexity `0`, clone groups `0`
- `pnpm build` — passed
- `/Users/declancowen/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — completed; production analyzer signals clean, no new branch-specific architecture blocker

### Branch-totality proof

- **Non-delta files/systems re-read:** scoped read-model custom property definition/value selection, auth bootstrap full snapshot filtering, personal work index scopes, work item detail scopes, project detail scopes, and project index scopes.
- **Prior open findings rechecked:** The top-level Codex review body looked clean, but current-head review threads exposed one live P1 thread. That thread is fixed locally in this turn.
- **Prior resolved/adjacent areas revalidated:** Private work item snapshot, mutation, collaboration, and avatar fallback tests still pass with the custom property value visibility change.
- **Hotspots or sibling paths revisited:** Initial bootstrap snapshots and scoped read-model refreshes now both apply the same visible-definition gate to custom property values.
- **Dependency/adjacent surfaces revalidated:** Team-scoped and user-private custom property definitions remain visible where intended, while values without a visible definition are removed from the returned payload.
- **Why this is enough:** Raw private property values can no longer be returned merely because their work item is visible; the corresponding property definition must also be visible to the requesting user.

### Challenger pass

- done — Rechecked whether filtering by visible work item id was enough. It was not, because user-private properties can exist on team-visible items and their values would otherwise leak without the definition.

### Resolved / Carried / New findings

#### WPDV-32 — resolved — private custom property values leaked without visible definitions

- **Severity:** high
- **Evidence:** current-head Codex review thread `PRRT_kwDOR_9-1s6BvxtU` flagged scoped read models and initial bootstrap as filtering custom property values by visible work item id only, while definitions were filtered by team/private ownership.
- **Fix:** Filtered custom property values through the visible/returned property definition ids in both scoped read-model selectors and Convex auth bootstrap.
- **Prevention:** Added regression coverage for scoped read models and full bootstrap snapshots where a visible team work item has another user's private property value.

## Turn 12 — 2026-05-13 13:16 BST

| Field           | Value                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| **Scope**       | GitHub Codex review follow-up for private work item collaboration routes |
| **Review type** | Targeted diff-review + architecture authorization boundary check         |
| **Reviewer**    | Codex CLI                                                                |
| **Outcome**     | 1 current-head Codex finding fixed locally; no local open findings       |

### Commands run

- `gh pr view 34 --json headRefOid,latestReviews,reviewDecision,url` — confirmed latest Codex review was on current pushed head `6bad035f`
- `gh api graphql ... reviewThreads` — found one new current-head P1 inline thread for private work item collaboration route access
- `pnpm test tests/convex/access.test.ts tests/convex/document-handlers.test.ts tests/convex/comment-handlers.test.ts tests/lib/display-initials.test.ts tests/convex/work-item-handlers.test.ts tests/convex/custom-property-handlers.test.ts tests/convex/view-handlers.test.ts` — passed, 7 files / 45 tests
- `pnpm typecheck` — passed
- `pnpm exec eslint convex/app/access.ts convex/app/comment_handlers.ts convex/app/document_handlers.ts tests/convex/access.test.ts tests/convex/comment-handlers.test.ts tests/convex/document-handlers.test.ts lib/display-initials.ts tests/lib/display-initials.test.ts components/app/shell.tsx --max-warnings 0` — passed
- `pnpm build` — passed
- `git diff --check` — passed
- `pnpm exec convex dev --once` — passed, Convex functions ready
- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh` — completed; changed-file audit passed with dead code `0`, complexity `0`, clone groups `0`
- `/Users/declancowen/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — completed; production analyzer signals clean, no new branch-specific architecture blocker

### Branch-totality proof

- **Non-delta files/systems re-read:** item document access, comment add/reaction handlers, attachment upload/create/delete handlers, item-description mention delivery, and private work item access helpers.
- **Prior open findings rechecked:** The latest top-level Codex review body had no summary bug text, but one current-head inline P1 thread remained live. That thread is fixed locally in this turn.
- **Prior resolved/adjacent areas revalidated:** Existing private work item mutation tests still pass, and the avatar fallback follow-up remains covered.
- **Hotspots or sibling paths revisited:** Work item comments, comment reactions, item-description documents, attachment upload URL issuance, attachment creation/deletion, and mention notification audiences.
- **Dependency/adjacent surfaces revalidated:** `requireReadableDocumentAccess` and `requireEditableDocumentAccess` now route item-description documents through the parent work item access rule, so direct document routes cannot bypass private item scope.
- **Why this is enough:** Private work item collaboration writes and reactions now authorize against the same creator/assignee predicate as the item itself before any db or storage mutation, and mention audiences for private item descriptions are reduced to the private item audience.

### Challenger pass

- done — Rechecked whether document/team access alone was enough for item-description documents and attachments. It was not, because retained document, comment, or attachment ids could bypass the private item read model.

### Resolved / Carried / New findings

#### WPDV-31 — resolved — private item collaboration routes were still authorized by team/document access only

- **Severity:** high
- **Evidence:** current-head Codex review thread `PRRT_kwDOR_9-1s6BvXSI` flagged comments, item-description updates/mentions, attachment create/delete, and item-description document access as bypassing the private item creator/assignee rule.
- **Fix:** Routed item-description document access through `getWorkItemByDescriptionDocId` plus `requireReadableWorkItemAccess`/`requireEditableWorkItemAccess`; updated comments, comment reactions, item-description mentions, attachment upload URL creation, attachment creation, and attachment deletion to enforce item-level private access before writes.
- **Prevention:** Added focused Convex tests for item-description document access, comment/reaction rejection, private mention audience filtering, item-description update rejection, and attachment upload/create/delete rejection before storage/db mutation.

## Turn 11 — 2026-05-13 12:50 BST

| Field           | Value                                                               |
| --------------- | ------------------------------------------------------------------- |
| **Scope**       | GitHub Codex review follow-up for private work item mutation access |
| **Review type** | Targeted diff-review + architecture boundary check                  |
| **Reviewer**    | Codex CLI                                                           |
| **Outcome**     | 1 live finding fixed locally; no local open findings                |

### Commands run

- `gh pr view 34 --json headRefOid,latestReviews,reviewDecision,statusCheckRollup,url` — confirmed visible Codex review body was still for `7f6af440`, while PR head was `800beafe`
- `gh api graphql ... reviewThreads` — enumerated unresolved review threads and confirmed the private work-item mutation thread was still relevant to current tree
- `pnpm test tests/convex/access.test.ts tests/convex/work-item-handlers.test.ts tests/convex/custom-property-handlers.test.ts tests/convex/view-handlers.test.ts` — passed
- `pnpm typecheck` — passed
- `pnpm exec eslint convex/app/access.ts convex/app/work_item_handlers.ts convex/app/custom_property_handlers.ts tests/convex/access.test.ts tests/convex/work-item-handlers.test.ts tests/convex/custom-property-handlers.test.ts --max-warnings 0` — passed
- `pnpm build` — passed
- `git diff --check` — passed
- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh` — completed; changed-file audit passed with dead code `0`, complexity `0`, clone groups `0`
- `/Users/declancowen/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — completed; production analyzer signals clean, no new branch-specific architecture blocker
- `pnpm exec convex dev --once` — passed, Convex functions ready
- `pnpm test tests/lib/display-initials.test.ts tests/convex/access.test.ts tests/convex/work-item-handlers.test.ts tests/convex/custom-property-handlers.test.ts tests/convex/view-handlers.test.ts` — passed after avatar fallback follow-up
- `pnpm exec eslint lib/display-initials.ts tests/lib/display-initials.test.ts components/app/shell.tsx convex/app/access.ts convex/app/work_item_handlers.ts convex/app/custom_property_handlers.ts tests/convex/access.test.ts tests/convex/work-item-handlers.test.ts tests/convex/custom-property-handlers.test.ts --max-warnings 0` — passed after avatar fallback follow-up
- `pnpm typecheck` — passed after avatar fallback follow-up
- `pnpm build` — passed after avatar fallback follow-up

### Branch-totality proof

- **Non-delta files/systems re-read:** `auth_bootstrap` private visibility filter, `work_item_handlers` mutation authorization, `custom_property_handlers` value mutation path, and access helpers.
- **Prior open findings rechecked:** The latest visible Codex review was stale by reviewed commit, but its review threads still mapped onto current lines. Previously documented threads remain code-fixed; the private mutation thread was a true remaining issue.
- **Prior resolved/adjacent areas revalidated:** Personal-view team property validation tests still pass after the access change. The shell avatar fallback thread was also rechecked and fixed because the footer still displayed raw image URLs as fallback text.
- **Hotspots or sibling paths revisited:** Work item update, collaboration persistence, presence, delete, timeline shift, and custom property value mutations now share the same item-level access helper.
- **Dependency/adjacent surfaces revalidated:** The authoritative read rule from `auth_bootstrap` is now mirrored at the Convex mutation boundary.
- **Why this is enough:** Private work items are hidden from non-creator/non-assignee users in snapshots, and the same predicate now protects all touched item mutation surfaces.

### Challenger pass

- done — Rechecked whether team edit access was sufficient; it was not, because hidden private item ids could still be retained and submitted to mutation routes.

### Resolved / Carried / New findings

#### WPDV-29 — resolved — private work item mutations were authorized by team edit access only

- **Severity:** high
- **Evidence:** `auth_bootstrap` filters private work items to creator/assignee, but `updateWorkItemHandler`, delete, collaboration persistence, presence, schedule shift, and custom-property value writes authorized with team edit access only.
- **Fix:** Added `requireEditableWorkItemAccess`/`requireReadableWorkItemAccess` helpers that enforce team access plus creator/assignee access for private items, then routed item mutation handlers through the editable helper.
- **Prevention:** Added access and handler tests for private item creator/assignee access and rejection before writes.

#### WPDV-30 — resolved — shell footer avatar fallback could display raw legacy image URLs

- **Severity:** medium
- **Evidence:** `ShellUserFooter` rendered `user.avatarUrl || initials` inside `AvatarFallback`, while `avatarUrl` may be a legacy image URL.
- **Fix:** Added `getDisplayAvatarFallback` so image-like fallback values fall back to initials, while text/initial fallback values still render.
- **Prevention:** Added `tests/lib/display-initials.test.ts` coverage for legacy image URL fallback handling.

## Turn 10 — 2026-05-13 12:26 BST

| Field           | Value                              |
| --------------- | ---------------------------------- |
| **Commit**      | `6ccb84ff` plus local diff         |
| **IDE / Agent** | Codex                              |
| **Review type** | Local fix review + regression pass |

**Summary:** Re-reviewed the chat reaction and chat creation race fixes after the user-reported workspace/team chat failures, then imported the latest Codex PR comment on personal work view custom properties. Three live issues were fixed: the chat-message reaction route was missing from the AuthKit proxy matcher even though channel reactions were covered, the optimistic team/workspace chat flow could send the first message against a temporary client conversation id before the server returned the canonical id, and personal/My Items views rejected readable team-scoped custom properties even though the UI exposes them.
**Outcome:** local review clean for the touched chat/auth proxy scope. No open Critical/High/Medium findings remain in this local delta.
**Risk score:** high — this touches an auth boundary and optimistic collaboration persistence.
**Change archetypes:** route/auth contract, optimistic state reconciliation, async race, view/custom-property authorization, regression coverage.
**Architecture impact:** The route auth matcher remains a static inline Next proxy config so Next can compile it, with source-level contract coverage that avoids loading AuthKit in Vitest. Conversation id reconciliation stays inside the collaboration store slice, where optimistic chat creation and first-message sync are already owned. Personal-view custom-property validation now mirrors the read model/UI visibility rule while still enforcing readable team access at the Convex mutation boundary.
**Branch totality:** Rechecked the channel reaction route pattern, chat-message reaction route, proxy matcher, chat creation routes, client sync wrappers, collaboration store send/create paths, personal view display-property validation, and current review hotspots.
**Residual risk / unknowns:** Browser/manual verification should be rerun after restarting the dev server because Next proxy matcher changes require a server restart to take effect.

### Validation

- `pnpm test tests/convex/view-handlers.test.ts tests/lib/store/collaboration-conversation-actions.test.ts tests/app/proxy-config.test.ts tests/app/api/platform-route-contracts.test.ts` — passed, 4 files / 16 tests
- `pnpm typecheck` — passed
- `pnpm exec eslint convex/app/view_handlers.ts tests/convex/view-handlers.test.ts proxy.ts lib/store/app-store-internal/slices/collaboration-conversation-actions.ts tests/lib/store/collaboration-conversation-actions.test.ts tests/app/proxy-config.test.ts --max-warnings 0` — passed
- `pnpm build` — passed after preserving Next's static inline proxy matcher contract
- `pnpm exec convex dev --once` — passed; Convex functions ready on dev
- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh` — completed; changed-file Fallow audit passed with dead code `0`, complexity `0`, clone groups `0`

### Resolved / Carried / New findings

#### WPDV-26 — resolved locally — chat-message reaction route was outside the AuthKit proxy matcher

- **Severity:** high
- **Evidence:** Local dev logs showed `withAuth` failing because `/api/chat-messages/[messageId]/reactions` was not covered by middleware. Channel reactions worked because `/api/channel-posts/:path*` was already matched.
- **Fix:** Added `/api/chat-messages/:path*` to the same AuthKit proxy matcher set while preserving Next's required static inline matcher shape.
- **Prevention:** Added `tests/app/proxy-config.test.ts` to assert chat-message reactions stay covered alongside channel-post reactions without importing the proxy module.

#### WPDV-27 — resolved locally — first chat message could sync before optimistic chat creation resolved to the server id

- **Severity:** high
- **Evidence:** User-reported `Conversation not found` on first message after opening a team/workspace chat whose backing conversation had just been recreated. Current store sent `/api/chats/<optimistic-id>/messages` immediately after `ensureTeamChat()`/`createWorkspaceChat()`.
- **Fix:** Added pending conversation sync tracking and canonical id remapping for conversations, chat messages, calls, and chat notifications. First-message sync now waits for the server conversation id when creation is pending, and stale optimistic ids are resolved before later sends.
- **Prevention:** Added store coverage proving an immediate first team-chat message waits for the canonical id and remaps local state before syncing.

#### WPDV-28 — resolved locally — personal work views rejected team-scoped custom properties

- **Severity:** medium
- **Evidence:** Codex PR comment on `convex/app/view_handlers.ts`; current-tree inspection confirmed personal views only accepted private owner properties, while the My Items UI/read model exposes readable team properties for team work items.
- **Fix:** Personal view custom display-property validation now allows team-scoped properties only after `requireReadableTeamAccess()` succeeds, while private-scoped properties remain owner-only.
- **Prevention:** Added `tests/convex/view-handlers.test.ts` coverage for allowing readable team properties in personal views and rejecting another user's private property.

## Turn 9 — 2026-05-13 11:49 BST

| Field           | Value                             |
| --------------- | --------------------------------- |
| **Commit**      | `79c0c536` plus local diff        |
| **IDE / Agent** | Codex                             |
| **Review type** | PR feedback import + local review |

**Summary:** Imported the latest Codex PR feedback on `79c0c536`, triaged the user-reported navigation console logs, and reran the local diff-review loop with architecture standards. The live P1 finding was valid: the full bootstrap snapshot still returned other users' private work items. That is fixed locally before the next push, including dependent comments, attachments, custom property values, and item-description documents. The repeated WorkOS CDN 404s were traced to stale external avatar/logo URLs and are now handled by app-owned fallbacks instead of repeatedly rendering broken images.
**Outcome:** local review clean; ready for one batched commit/push and PR automation rerun. No open Critical/High/Medium findings remain in the current local diff.
**Risk score:** high — this turn touches auth bootstrap tenancy, full snapshot payload privacy, shared avatar fallback behavior, and workspace logo rendering.
**Change archetypes:** external PR feedback, privacy/tenancy, scoped snapshot filtering, stale image fallback, shared UI primitive.
**Architecture impact:** Bootstrap snapshot filtering now applies the same private work invariant as personal work indexes before derived collections are loaded. Image fallback behavior is kept at rendering boundaries, preserving stored legacy URLs while preventing broken external media from degrading navigation.
**Branch totality:** Rechecked current PR comments, custom property route/schema/handler duplicate-ID guards, custom property invalidation scope helpers, document index linked entity payload/invalidation, project detail memberships, avatar/sidebar/workspace selector image paths, and the cumulative branch gates.
**Residual risk / unknowns:** The `vendor.js No Listener: tabs:outgoing.message.ready` console line appears to be browser extension/content-script noise rather than app code. Browser smoke was not rerun after this final local diff; build and UI/component coverage passed.

### Validation

- `pnpm exec vitest run tests/convex/auth-bootstrap-health.test.ts tests/lib/scoped-read-models.test.ts tests/app/api/custom-properties-route-contracts.test.ts tests/components/user-presence.test.tsx tests/components/workspace-chats-screen.test.tsx tests/components/channel-ui.test.tsx tests/app/workspace-layout.test.tsx` — passed, 7 files / 36 tests
- `pnpm exec tsc --noEmit --pretty false` — passed
- `pnpm lint` — passed
- `pnpm exec fallow --ci --production --format json --quiet --explain` — passed configured production check with `total_issues=0`; duplication `clone_groups=0`; advisory health inventory still reports pre-existing complexity hotspots
- `pnpm test` — passed, 178 files / 975 tests
- `pnpm build` — passed
- `git diff --check` — passed

### External finding import

| Source              | Finding                                                           | Current status                | Bug class                            | Missed invariant/variant                                                                                                          | Action                                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------- | ----------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codex inline review | Full bootstrap returns other users' private tasks                 | Resolved locally              | tenancy / payload privacy            | private work visibility must filter before derived collections and returned snapshot data                                         | Filtered `visibleWorkItems` before IDs, comments, attachments, custom property values, item-description docs, and return payload; added regression coverage |
| Codex inline review | Property definition changes only invalidate team work index       | Already fixed in current tree | read-model invalidation              | custom property definitions are consumed by item details, project details/indexes, view catalogs, workspace/personal work indexes | Current `getCustomPropertyDefinitionScopeKeys` includes those scopes and selector tests assert them                                                         |
| Codex inline review | Custom property changes omit project read models                  | Already fixed in current tree | read-model invalidation              | project pages depend on custom property definitions/values                                                                        | Current helper adds project detail and project index scopes for affected item projects                                                                      |
| Codex / DR-001      | Duplicate select option IDs allowed                               | Already fixed in current tree | identity / persistence contract      | option IDs must be unique independent of labels                                                                                   | Route schema and Convex handler both reject duplicate normalized IDs; contract tests cover create                                                           |
| Codex inline review | Document index linked project/item/team payloads and invalidation | Already fixed in current tree | payload completeness / stale index   | docs display properties must carry and invalidate referenced entities                                                             | Current selectors and invalidation tests cover linked entities                                                                                              |
| User console logs   | Repeated 404s for stale WorkOS/avatar/logo image URLs             | Resolved locally              | fallback / legacy data compatibility | broken external media must fall back without corrupting stored data                                                               | Shared avatar image failure cache and workspace logo `onError` fallbacks added                                                                              |

### Resolved / Carried / New findings

#### WPDV-24 — resolved locally — full bootstrap snapshot leaked other users' private work items

- **Severity:** high
- **Evidence:** Codex P1 review on `convex/app/auth_bootstrap.ts`; current-tree inspection confirmed `listWorkItemsByTeams` fed `visibleWorkItemIds` before private visibility filtering.
- **Fix:** Added `canCurrentUserSeeBootstrapWorkItem()` and applied it before deriving work item IDs, custom property values, work-item comments/attachments, item-description documents, visible user IDs, and returned `workItems`.
- **Prevention:** Added `tests/convex/auth-bootstrap-health.test.ts` coverage for team work, current-user private work, another user's private work, and dependent hidden comments/attachments/custom property values/documents.

#### WPDV-25 — resolved locally — stale external image URLs rendered broken workspace/user media

- **Severity:** medium
- **Evidence:** User-reported navigation logs showed repeated `workoscdn.com/images/v1/... 404` from avatar/logo rendering paths.
- **Fix:** Added failed-source caching to `AvatarImage`, moved shell user footer to the shared avatar primitive, and added `onError` fallbacks for workspace logos in the sidebar and workspace selector. Stored legacy URLs are preserved; only rendering falls back.
- **Prevention:** Existing avatar/chat component tests plus full build/test/lint/typecheck cover the changed paths.

## Turn 8 — 2026-05-13 11:32 BST

| Field           | Value                           |
| --------------- | ------------------------------- |
| **Commit**      | `df88bed8` plus local diff      |
| **IDE / Agent** | Codex                           |
| **Review type** | Local diff-review + Fallow pass |

**Summary:** Re-reviewed the current local diff after the follow-up fixes for docs/work taskbars, team/project icon selection, private task scope isolation, custom property display, workspace selector, and the read-model route crash reported as `Cannot read properties of undefined (reading 'filter')`.
**Outcome:** local review clean; no open Critical/High/Medium findings remain in the reviewed scope. Convex dev was pushed with `pnpm exec convex dev --once` after backend/domain changes.
**Risk score:** high — the diff changes persisted Convex schema/validators, API route contracts, scoped read models, optimistic store behavior, personal/team tenancy boundaries, broad work/docs UI, and generated Convex API types.
**Change archetypes:** tenancy/data model, scoped read model compatibility, route contract, custom properties, private work views, shared UI controls, static analyzer cleanup, generated API update.
**Architecture impact:** Scope authority now lives at the data/domain boundary: Convex handlers validate private/team label and property assignment, read models filter private definitions/labels by owner, route schemas preserve serialized `visibility` filters, and UI selectors only expose assignable properties for the active work item/view scope.
**Branch totality:** Rechecked the cumulative local branch against `origin/main`, prior review hotspots, route/client/server view filter paths, custom property definition/value paths, label creation and assignment paths, My Items private task defaults, and Fallow changed-file dead-code/duplication signals.
**Residual risk / unknowns:** Browser smoke was not rerun in this turn; the production build passed, but visual verification of the docs taskbar, private task board, icon picker, and workspace selector remains useful before release.

### Validation

- `pnpm exec convex dev --once` — passed twice; Convex functions ready on dev
- `pnpm exec vitest run tests/convex/view-handlers.test.ts tests/convex/workspace-team-handlers.test.ts tests/convex/work-item-handlers.test.ts tests/convex/custom-property-handlers.test.ts tests/lib/domain/labels.test.ts tests/lib/store/work-item-actions.test.ts tests/lib/store/workspace-slice.test.ts tests/app/api/team-collaboration-route-contracts.test.ts tests/app/api/work-route-contracts.test.ts tests/lib/server/convex-work.test.ts` — passed, 10 files / 90 tests
- `pnpm exec vitest run tests/components/create-dialogs.test.tsx tests/components/views-screen.test.tsx tests/components/work-item-detail-screen.test.tsx tests/lib/domain/default-views.test.ts` — passed, 4 files / 59 tests
- `pnpm test` — passed, 178 files / 974 tests
- `pnpm exec tsc --noEmit --pretty false` — passed
- `pnpm lint` — passed
- `pnpm exec fallow --ci --production --format json --quiet --explain` — passed for changed-file dead code and duplication: `total_issues=0`, `clone_groups=0`
- `pnpm build` — passed

### Resolved / Carried / New findings

#### WPDV-21 — resolved locally — stale scoped snapshots could crash custom-property route/read-model refresh

- **Severity:** medium
- **Evidence:** User-reported route mutation error: `Cannot read properties of undefined (reading 'filter')` during scoped read-model refresh.
- **Fix:** Added compatibility fallbacks for missing `customPropertyDefinitions`, `customPropertyValues`, and related snapshot arrays at route/read-model boundaries while keeping schema-owned defaults intact.
- **Prevention:** Full route/read-model tests and TypeScript/build now cover the normalized snapshot path.

#### WPDV-22 — resolved locally — private labels and custom properties could leak into team/workspace surfaces

- **Severity:** high
- **Evidence:** Private task board labels/properties needed to be contained to private tasks and not appear in team/workspace views.
- **Fix:** Added explicit label/custom-property scope fields and owner checks; Convex handlers validate assignment by work item visibility; read models expose private labels/properties only to the owner; UI label/property pickers filter through the same domain helpers.
- **Prevention:** Added `tests/lib/domain/labels.test.ts` and expanded handler/store tests for private task and team-icon persistence variants.

#### WPDV-23 — resolved locally — changed-file static analysis reported unused public exports and duplicate UI/filter literals

- **Severity:** low
- **Evidence:** Fallow changed-file audit reported unused `teamIconMeta`/`isTeamIconToken` exports and duplicate layout/filter fragments.
- **Fix:** Removed accidental public exports, reused `ViewsDirectoryLayoutTabs` for docs layout toggling, and centralized empty view-filter selection literals inside the domain primitives owner.
- **Prevention:** Fallow changed-file dead-code and duplication gate now reports zero issues.

## Turn 7 — 2026-05-12 20:38 BST

| Field           | Value                      |
| --------------- | -------------------------- |
| **Commit**      | `59398d56` plus local diff |
| **IDE / Agent** | Codex                      |

### Automation context

| Field                          | Value                                                          |
| ------------------------------ | -------------------------------------------------------------- |
| **Trigger**                    | PR feedback import after pushed `59398d56`                     |
| **PR**                         | `declancowen/Linear#34`                                        |
| **Base ref**                   | `main`                                                         |
| **Base SHA**                   | `19e92e2dd82e447ff65af210892937c5aa589ab9`                     |
| **Head SHA**                   | `59398d56c0639437cc7f8b4c3480d9f0bba604e5`                     |
| **Previous reviewed head SHA** | `25f64b891d2b09bd61c9393109661524109ff60f`                     |
| **Diff reviewed**              | `19e92e2d...59398d56` plus local PR-feedback fix               |
| **Review comment/check**       | Codex inline review on linked document index invalidation      |
| **Trusted state source**       | GitHub checks, GraphQL review thread fetch                     |
| **Verification policy**        | Fix live PR finding, rerun diff-review/static/test/build gates |

**Summary:** Imported the latest Codex review on `59398d56` and reran the diff-review loop with architecture standards. The new live finding was valid: document indexes now include linked projects and work items for labels/filter display, so project and work-item updates also need to invalidate document index scopes for documents that link to those entities.
**Outcome:** local fix complete; ready for one batched commit/push and new PR automation run.
**Risk score:** medium — stale linked entity labels are user-visible but contained to scoped read-model invalidation.
**Change archetypes:** external PR feedback, read-model invalidation, document index dependency closure.
**Architecture impact:** Scoped invalidation now follows the read-model dependency graph: when document indexes depend on linked project/item records, project/item updates bump the relevant team/workspace/private document indexes.
**Branch totality:** Rechecked latest PR threads, patched the invalidation helper, added regression coverage, reran Fallow, type/lint, dependency audit, full tests, build, diff whitespace check, and duplicate-file sweep.
**Residual risk / unknowns:** GitHub CI and Codex review must rerun after this batch is pushed.

### Validation

- `pnpm exec vitest run tests/lib/scoped-read-models.test.ts` — passed, 1 file / 8 tests
- `pnpm typecheck` — passed
- `pnpm lint` — passed
- `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` — passed with `node_modules` advisory warning
- `pnpm audit:deps` — passed high-severity gate; reported 1 low and 9 moderate vulnerabilities
- `pnpm fallow:gate` — passed
- `pnpm test` — passed, 176 files / 965 tests
- `pnpm build` — passed
- `git diff --check` — passed
- duplicate numeric-suffix file sweep — passed

### Resolved / Carried / New findings

#### WPDV-20 — resolved locally — document indexes were not invalidated when linked project/item labels changed

- **Severity:** medium
- **Evidence:** Codex review on `59398d56` noted `selectDocumentIndexReadModel` now includes linked `projects` and `workItems`, but `getProjectRelatedScopeKeys` and `getWorkItemDetailScopeKeys` did not bump document indexes for documents that reference those entities.
- **Fix:** Added linked-document index invalidation helpers in `lib/scoped-sync/read-models.ts`; project updates now bump document indexes for documents with matching `linkedProjectIds`, and work item updates now bump document indexes for documents with matching `linkedWorkItemIds`.
- **Prevention:** Added regression coverage in `tests/lib/scoped-read-models.test.ts`.

## Turn 6 — 2026-05-12 20:04 BST

| Field           | Value                      |
| --------------- | -------------------------- |
| **Commit**      | `25f64b89` plus local diff |
| **IDE / Agent** | Codex                      |

### Automation context

| Field                          | Value                                                                 |
| ------------------------------ | --------------------------------------------------------------------- |
| **Trigger**                    | PR feedback import after pushed `25f64b89`                            |
| **PR**                         | `declancowen/Linear#34`                                               |
| **Base ref**                   | `main`                                                                |
| **Base SHA**                   | `19e92e2dd82e447ff65af210892937c5aa589ab9`                            |
| **Head SHA**                   | `25f64b891d2b09bd61c9393109661524109ff60f`                            |
| **Previous reviewed head SHA** | `0f0d61836051ed7bc4412e04a8e0a0680a3e0ee4`                            |
| **Diff reviewed**              | `19e92e2d...25f64b89` plus local PR-feedback fixes                    |
| **Workflow run**               | `25755279356`, `25755281667`                                          |
| **Review comment/check**       | Codex inline review on document/project read-model payloads           |
| **Trusted state source**       | GitHub checks, GraphQL review thread fetch                            |
| **Verification policy**        | Fix live PR findings, rerun local diff-review/static/test/build gates |

**Summary:** Imported the latest Codex review on `25f64b89` and reran the diff-review loop with architecture standards. Two live read-model omissions were fixed: document index read models now include linked projects, linked work items, and teams needed by document property labels/filters; project detail read models now include team memberships and membership users so person-typed custom properties work from a cold scoped fetch. A late DR-001 automation thread was also imported and classified as already fixed in the current tree.
**Outcome:** local fixes complete; ready for one batched commit/push and new PR automation run.
**Risk score:** high — scoped read-model payload completeness affects cold navigation, refresh, filters, display properties, and custom property editors.
**Change archetypes:** external PR feedback, scoped read-model payload contract, cold-fetch completeness, custom property person options, branch-total re-review.
**Intended change:** Close all current PR review findings without pushing partial fixes or creating parallel reviews.
**Intent vs actual:** Document indexes now carry the entity records consumed by document labels and filter UI. Project details now carry the same membership option data that work item details already provide for person properties.
**Confidence:** high for the imported findings after direct selector tests, Fallow, type/lint/audit, full tests, and production build all passed.
**Coverage note:** Browser smoke was not rerun because this turn only changed read-model payload contents and selector tests, not presentation layout or interactions.
**Finding triage:** The two Codex connector findings were live. The late DR-001 automation review thread was stale against the current tree because Convex and route duplicate option-ID validation already existed and was covered by tests.
**Static/analyzer evidence:** `pnpm fallow:gate` passes with dead-code `0`, production health findings `0`, and duplication `0/0`. `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` passes with dead code `0`, complexity `0`, clone groups `0`; it warns that `node_modules` is not present for maximum analyzer precision.
**Architecture impact:** The read-model selector layer now owns the payload dependencies for display-property consumers instead of relying on a prior full workspace snapshot.
**Bug classes / invariants checked:** payload completeness, cold-fetch state, scope/tenancy, person-option availability, stale external finding triage, branch-total feedback loop.
**Branch totality:** Rechecked the latest PR review threads, stale/later automation thread, cumulative branch diff, read-model selectors, Fallow gates, full test suite, build, and duplicate-file sweep after the fixes.
**Sibling closure:** Checked document index linked project/item/team dependencies, project detail custom property definitions/values/users/team memberships, work item detail parity, and duplicate option-ID validation.
**Remediation impact surface:** `lib/scoped-sync/read-models.ts` and `tests/lib/scoped-read-models.test.ts`.
**Residual risk / unknowns:** GitHub CI and Codex review must rerun after this batch is pushed.

### Validation

- `pnpm exec vitest run tests/lib/scoped-read-models.test.ts` — passed, 1 file / 7 tests
- `pnpm typecheck` — passed
- `pnpm lint` — passed
- `pnpm audit:deps` — passed high-severity gate; remaining audit output is 1 low / 9 moderate
- `pnpm fallow:gate` — passed
- `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` — passed; dead code `0`, complexity `0`, clone groups `0`, with node_modules precision warning
- `pnpm test` — passed, 176 files / 964 tests
- `pnpm build` — passed
- `git diff --check` — passed
- duplicate-file sweep for `* 2` / `* 3` paths excluding `.git`, `node_modules`, `.next`, and `.fallow` — passed; no matches

### Branch-totality proof

- **Non-delta files/systems re-read:** latest Codex review threads, stale DR-001 automation thread, document property label consumers, project detail custom property consumers, read-model selector tests.
- **Prior open findings rechecked:** no prior open findings remained; WPDV-14 duplicate option-ID validation was verified in current tree after the late stale thread.
- **Prior resolved/adjacent areas revalidated:** custom property definition/value payloads, project read-model invalidation, document index views, Fallow zero-finding gates.
- **Hotspots or sibling paths revisited:** document index cold scoped refresh, project detail cold scoped refresh, person custom property editor option construction, linked project/item labels.
- **Dependency/adjacent surfaces revalidated:** no package changes in this turn; dependency audit still passes the configured high-severity gate.
- **Why this is enough:** both live findings were read-model payload omissions fixed at the selector boundary and covered by direct selector assertions plus full branch validation.

### Challenger pass

- done — Assumed document labels might need only project/work item records; the fix also includes teams for document team labels and linked entity context.
- done — Assumed project person properties might need only users; the fix adds team memberships as the actual option source and includes membership users.
- done — Assumed the late DR-001 thread might still be live because it points to a current line; current-tree inspection confirmed Convex and route duplicate-ID guards plus regression tests.

### External finding import

| Source                    | Finding                                                                                                         | Current status                | Bug class                                         | Missed invariant/variant                                                                   | Action                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Codex inline review       | Document index read model omits linked projects/work items/teams needed by document property labels and filters | Resolved locally              | payload completeness / cold-fetch state           | display-property consumers must receive referenced entity records in scoped index payloads | Added linked project/work item/team selection and selector regression test                          |
| Codex inline review       | Project detail read model omits team memberships needed by person custom property editors                       | Resolved locally              | payload completeness / person option availability | person property options come from team memberships, not only users and values              | Added team memberships and membership users to project detail payload with selector regression test |
| Late PR automation thread | DR-001 duplicate custom property option IDs                                                                     | Already fixed in current tree | identity/uniqueness / persistence contract        | persisted option IDs must be unique independent of labels                                  | No new code; current Convex/route guards and tests already cover it                                 |

### Resolved / Carried / New findings

#### WPDV-18 — resolved locally — document index payload omitted linked entity label dependencies

- **Severity:** medium
- **Evidence:** Codex review on `components/app/screens/docs-content.tsx` noted direct document-index hydration could not resolve linked project/item/team labels.
- **Fix:** `selectDocumentIndexReadModel()` now includes linked projects, linked work items, and relevant teams.
- **Prevention:** Added selector coverage proving a team document index returns the linked project, linked work item, and team.

#### WPDV-19 — resolved locally — project detail payload omitted memberships for person custom properties

- **Severity:** medium
- **Evidence:** Codex review on `lib/scoped-sync/read-models.ts` noted project detail includes custom property definitions/values but not team memberships, so person editors lack options on cold scoped fetches.
- **Fix:** `selectProjectDetailReadModel()` now includes team memberships for the project item teams and includes those membership users.
- **Prevention:** Added selector coverage proving project detail includes team memberships.

### Recommendations

1. **Fix first:** Commit this local batch and push once.
2. **Then address:** Wait for the next GitHub CI/Codex feedback before making another commit or push.
3. **Patterns noticed:** Any read model that introduces display properties must include the referenced records those display properties resolve, not depend on previous broad snapshots.
4. **Suggested approach:** Treat read-model selector tests as the contract for cold navigation and scoped refresh payload completeness.
5. **Architecture transition:** No new exception; this strengthens the selector boundary as the owner of read-side payload completeness.
6. **Defer on purpose:** Browser smoke remains deferred for this read-model-only feedback batch.

## Turn 5 — 2026-05-12 19:46 BST

| Field           | Value                      |
| --------------- | -------------------------- |
| **Commit**      | `0f0d6183` plus local diff |
| **IDE / Agent** | Codex                      |

### Automation context

| Field                          | Value                                                                |
| ------------------------------ | -------------------------------------------------------------------- |
| **Trigger**                    | PR feedback import after pushed `0f0d6183`                           |
| **PR**                         | `declancowen/Linear#34`                                              |
| **Base ref**                   | `main`                                                               |
| **Base SHA**                   | `19e92e2dd82e447ff65af210892937c5aa589ab9`                           |
| **Head SHA**                   | `0f0d61836051ed7bc4412e04a8e0a0680a3e0ee4`                           |
| **Previous reviewed head SHA** | `709b83ba7c23e5eb2db06326cd018aba63eb06d6`                           |
| **Diff reviewed**              | `19e92e2d...0f0d6183` plus local PR-feedback fix                     |
| **Workflow run**               | `25754053400`, `25754050481`                                         |
| **Review comment/check**       | Codex inline review on project read-model invalidation               |
| **Trusted state source**       | GitHub checks, GraphQL review thread fetch                           |
| **Verification policy**        | Fix live PR finding, rerun local diff-review/static/test/build gates |

**Summary:** Imported the new Codex PR review on `0f0d6183` and reran the diff-review loop with architecture standards. One live issue was fixed: custom property definition changes now invalidate project detail and project index read models that render work item custom property definitions/values. The Fallow changed-file audit then found the read-model scope helper shape too complex, so the scope fan-out was split into small owner-local helpers and the adjacent work-item detail scope collector was simplified.
**Outcome:** local fixes complete; ready for one batched commit/push and new PR automation run.
**Risk score:** high — scoped read-model freshness for custom property metadata across work item and project surfaces.
**Change archetypes:** external PR feedback, scoped read-model invalidation, static analyzer follow-up, state freshness, branch-total re-review.
**Intended change:** Address the latest Codex PR finding without triggering another push until the full local review/validation loop is clean.
**Intent vs actual:** Project detail read models and team/workspace project indexes now receive version bumps when a team custom property definition changes and those properties can be rendered through project-contained work items. Scope collection remains centralized in `lib/scoped-sync/read-models.ts` and is factored into helper functions that keep Fallow's changed-file audit clean.
**Confidence:** high for the imported finding and adjacent read-model scope family after targeted tests, Fallow, full test, and build all passed.
**Coverage note:** Browser smoke was not rerun because this turn only changed read-model scope-key calculation and a selector test. The previous broad presentation changes remain covered by the earlier branch validation.
**Finding triage:** The Codex project invalidation finding was live. The Fallow complexity signal was live after the first local fix and is now resolved.
**Static/analyzer evidence:** `pnpm fallow:gate` passes with dead-code `0`, production health findings `0`, and duplication `0/0`. `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` passes with dead code `0`, complexity `0`, clone groups `0`; it warns that `node_modules` is not present for maximum analyzer precision.
**Architecture impact:** Read-model invalidation remains owned by scoped-sync helpers rather than route-local arrays. The custom property definition invalidation helper now covers work item details, work indexes, view catalogs, project details, and project indexes from the same source of truth.
**Bug classes / invariants checked:** state freshness, scope/tenancy, derived read-model invalidation, analyzer complexity drift, branch-total feedback loop.
**Branch totality:** Rechecked the cumulative branch diff, latest Codex review thread, previous resolved feedback, Fallow gates, full tests, build, and duplicate-file sweep after the fix.
**Sibling closure:** Checked work item detail scope keys, project detail scope keys, team project indexes, workspace project indexes, personal/team/workspace work indexes, and custom property definition create/update/archive route invalidation.
**Remediation impact surface:** `lib/scoped-sync/read-models.ts` and `tests/lib/scoped-read-models.test.ts`.
**Residual risk / unknowns:** GitHub CI and Codex review must rerun after this batch is pushed.

### Validation

- `pnpm exec vitest run tests/lib/scoped-read-models.test.ts tests/app/api/custom-properties-route-contracts.test.ts` — passed, 2 files / 10 tests
- `pnpm typecheck` — passed
- `pnpm lint` — passed
- `pnpm audit:deps` — passed high-severity gate; remaining audit output is 1 low / 9 moderate
- `pnpm fallow:gate` — passed
- `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` — passed; dead code `0`, complexity `0`, clone groups `0`, with node_modules precision warning
- `DIFF_BASE=19e92e2dd82e447ff65af210892937c5aa589ab9 DIFF_HEAD=HEAD DEFAULT_BRANCH=main node scripts/verify-convex-generated-fallback.mjs` — passed; schema-change fallback warns and verifies generated API roster
- `DIFF_BASE=b8e90c3acff541d6246ba21e00911c71e368dd2a DIFF_HEAD=709b83ba7c23e5eb2db06326cd018aba63eb06d6 DEFAULT_BRANCH=main node scripts/verify-convex-generated-fallback.mjs` — passed; dependency-only diff verifies generated API roster
- `pnpm test` — passed, 176 files / 963 tests
- `pnpm build` — passed
- `git diff --check` — passed
- duplicate-file sweep for `* 2` / `* 3` paths excluding `.git`, `node_modules`, `.next`, and `.fallow` — passed; no matches

### Branch-totality proof

- **Non-delta files/systems re-read:** GitHub PR reviews/checks, custom property routes, server scoped-read-model resolver, project/work item read-model scope helpers, existing review ledger.
- **Prior open findings rechecked:** no prior open findings remained; WPDV-12 through WPDV-15 were revalidated by CI status plus local Convex fallback, route, Fallow, test, and build checks.
- **Prior resolved/adjacent areas revalidated:** property definition create/update/archive invalidation, work item detail scope keys, project detail/project index scope keys, Fallow complexity/duplication gates.
- **Hotspots or sibling paths revisited:** project-contained work items, linked projects, workspace project index containing team projects, team membership personal work indexes, view catalogs.
- **Dependency/adjacent surfaces revalidated:** no package changes in this turn; dependency audit still passes the high-severity gate.
- **Why this is enough:** the live finding was a deterministic scope-key omission, fixed at the shared read-model invalidation boundary and protected by selector coverage plus branch-wide static/test/build gates.

### Challenger pass

- done — Assumed project detail invalidation alone was insufficient; the fix also bumps the team project index for team projects and the workspace project index that can include team-scoped projects.
- done — Assumed the new scope fan-out could degrade maintainability; the helper extraction brings both configured Fallow and changed-file Fallow audit back to zero findings.
- done — Assumed the same scope-helper family could still carry a complexity finding; `getWorkItemDetailScopeKeys` was simplified using the same helper pattern and its existing test stayed green.

### External finding import

| Source                          | Finding                                                                                                                                | Current status   | Bug class                                        | Missed invariant/variant                                                                                              | Action                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Codex inline review             | Custom-property definition changes did not invalidate project detail/index read models that include custom property definitions/values | Resolved locally | state freshness / scoped read-model invalidation | property metadata changes affect every read model rendering team work item properties, not only work/item/view scopes | Added project detail, team project index, and workspace project index invalidation plus selector coverage |
| Local Fallow changed-file audit | Read-model scope-key helpers introduced complexity findings in the changed-file audit                                                  | Resolved locally | analyzer drift / maintainability                 | shared invalidation helpers should stay small enough for configured and changed-file Fallow modes                     | Split scope fan-out into owner-local helpers and reran both Fallow modes                                  |

### Resolved / Carried / New findings

#### WPDV-16 — resolved locally — custom-property definition changes missed project read models

- **Severity:** medium
- **Evidence:** Codex inline review on `lib/scoped-sync/read-models.ts` correctly noted project detail and project index read models include custom property definitions/values but were not invalidated when definitions changed.
- **Fix:** `getCustomPropertyDefinitionScopeKeys()` now collects project IDs from the team's work items and adds project detail plus project index scope keys, including the workspace project index for the owning workspace.
- **Prevention:** Updated the scoped read-model test to assert project detail, team project index, and workspace project index keys are included.

#### WPDV-17 — resolved locally — read-model scope helper complexity regressed Fallow changed-file audit

- **Severity:** medium
- **Evidence:** `pnpm fallow:gate` initially failed on `getCustomPropertyDefinitionScopeKeys`, then the stricter changed-file audit flagged `getWorkItemDetailScopeKeys`.
- **Fix:** Extracted custom-property and work-item scope fan-out into small shared helper functions while keeping the invalidation owner in `lib/scoped-sync/read-models.ts`.
- **Prevention:** Both `pnpm fallow:gate` and `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` now pass with zero findings.

### Recommendations

1. **Fix first:** Commit this local batch and push once.
2. **Then address:** Wait for the next GitHub CI/Codex feedback before making another commit or push.
3. **Patterns noticed:** Read-model invalidation must be reviewed by consumer family, not only by the route that mutates the source data.
4. **Suggested approach:** Keep future custom-property read-model consumers wired through `getCustomPropertyDefinitionScopeKeys()` rather than route-local scope arrays.
5. **Architecture transition:** No new exception; this strengthens the scoped-sync boundary as the source of truth for read-model fan-out.
6. **Defer on purpose:** Browser smoke remains deferred for this read-model-only feedback batch.

## Turn 4 — 2026-05-12 19:23 BST

| Field           | Value                      |
| --------------- | -------------------------- |
| **Commit**      | `709b83ba` plus local diff |
| **IDE / Agent** | Codex                      |

### Automation context

| Field                          | Value                                                                 |
| ------------------------------ | --------------------------------------------------------------------- |
| **Trigger**                    | PR feedback import after pushed `709b83ba`                            |
| **PR**                         | `declancowen/Linear#34`                                               |
| **Base ref**                   | `main`                                                                |
| **Base SHA**                   | `19e92e2dd82e447ff65af210892937c5aa589ab9`                            |
| **Head SHA**                   | `709b83ba7c23e5eb2db06326cd018aba63eb06d6`                            |
| **Previous reviewed head SHA** | `b8e90c3acff541d6246ba21e00911c71e368dd2a`                            |
| **Diff reviewed**              | `19e92e2d...709b83ba` plus local PR-feedback fixes                    |
| **Workflow run**               | `25751678939`, `25751681656`                                          |
| **Review comment/check**       | GitHub CI `check` failures, Codex inline review, diff-review comment  |
| **Trusted state source**       | GitHub checks, GraphQL review thread fetch, PR automation comment     |
| **Verification policy**        | Fix all imported live findings, rerun local diff-review/static/checks |

**Summary:** Imported the current PR feedback and reran the local diff-review loop with architecture standards. Four live issues were fixed: the Convex fallback checker failed schema-change PRs when no deployment secret was available, the generated API parser assumed semicolon formatting, custom-property definition mutations did not invalidate item detail/view catalog read models, and select option IDs were not guaranteed unique. The route PATCH schema also had a live preservation bug found during the targeted route test: name-only updates defaulted `options` to `[]`, which could clear select options.
**Outcome:** local fixes complete; ready for one batched commit/push and new PR automation run.
**Risk score:** high — data model/read-model invalidation, CI release gate, and custom property persistence contracts.
**Change archetypes:** external PR feedback, CI fallback contract, scoped read-model invalidation, route/schema compatibility, Convex validation, static analyzer zero-clone enforcement.
**Intended change:** Address all current GitHub/Codex/local automation findings without triggering parallel PR reviews.
**Intent vs actual:** The custom property read-model owner now computes the full definition invalidation scope; Convex remains the authoritative option-ID validation boundary; route schemas catch invalid payloads earlier and preserve omitted PATCH fields; the fallback CI checker verifies generated API roster locally and relies on typecheck for schema-imported data model bindings when deployment codegen is unavailable.
**Confidence:** high for targeted fixes and local validation; PR CI/Codex must rerun after the next push.
**Coverage note:** Added route, read-model, Convex handler, and script parser coverage. Browser smoke was not rerun because this turn touched server/read-model/script contracts and tests, not presentation layout.
**Finding triage:** All imported findings were live in the current tree. The schema PATCH preservation bug was a local review find discovered by the new route contract test.
**Static/analyzer evidence:** `pnpm fallow:gate` passes with dead-code `0`, production health findings `0`, and duplication `0/0`. `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` passes with dead code `0`, complexity `0`, clone groups `0`; it warns that `node_modules` is not present for maximum analyzer precision.
**Architecture impact:** Read-model invalidation logic is centralized in `lib/scoped-sync/read-models.ts` and exposed through `lib/server/scoped-read-models.ts`; route handlers no longer hard-code a partial team index scope. Custom property option identity is enforced at the Convex/domain boundary, with route schemas as an edge guard.
**Bug classes / invariants checked:** state freshness, preservation, contract encoding, compatibility, identity/uniqueness, CI fallback/release safety, analyzer zero-new-clone policy.
**Branch totality:** Rechecked the cumulative branch diff, latest GitHub review thread state, PR automation comment, CI check logs, and local static/test/build gates after the fixes.
**Sibling closure:** Checked create/update/archive property definition paths, route schema create/update variants, generated API map/import parsing, schema-change fallback behavior, work index/item detail/view catalog scopes, and select/multi-select option validation.
**Remediation impact surface:** `app/api/custom-properties/**`, `lib/scoped-sync/read-models.ts`, `lib/server/scoped-read-models.ts`, `convex/app/custom_property_handlers.ts`, `lib/domain/types-internal/schemas.ts`, Convex fallback scripts, and focused tests.
**Residual risk / unknowns:** GitHub CI and Codex review are still on the previous pushed commit until this batch is committed and pushed.

### Validation

- `pnpm exec vitest run tests/convex/custom-property-handlers.test.ts tests/app/api/custom-properties-route-contracts.test.ts tests/lib/scoped-read-models.test.ts tests/scripts/shared-helpers.test.ts` — passed, 4 files / 19 tests
- `DIFF_BASE=19e92e2dd82e447ff65af210892937c5aa589ab9 DIFF_HEAD=HEAD DEFAULT_BRANCH=main node scripts/verify-convex-generated-fallback.mjs` — passed; schema-change fallback warns and verifies generated API roster
- `DIFF_BASE=b8e90c3acff541d6246ba21e00911c71e368dd2a DIFF_HEAD=709b83ba7c23e5eb2db06326cd018aba63eb06d6 DEFAULT_BRANCH=main node scripts/verify-convex-generated-fallback.mjs` — passed; dependency-only diff verifies generated API roster
- `pnpm audit:deps` — passed high-severity gate; remaining audit output is 1 low / 9 moderate
- `pnpm typecheck` — passed
- `pnpm lint` — passed
- `pnpm fallow:gate` — passed
- `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` — passed; dead code `0`, complexity `0`, clone groups `0`, with node_modules precision warning
- `pnpm test` — passed, 176 files / 963 tests
- `pnpm build` — passed
- `git diff --check` — passed
- duplicate-file sweep for `* 2` / `* 3` paths excluding `.git`, `node_modules`, `.next`, and `.fallow` — passed; no matches

### Branch-totality proof

- **Non-delta files/systems re-read:** GitHub PR checks, Codex review thread, PR automation comment, custom property Convex handler, route schemas, scoped read-model selectors/scope keys, Convex fallback scripts.
- **Prior open findings rechecked:** none remained open before this import; WPDV-11 dependency audit fix still passes `pnpm audit:deps`.
- **Prior resolved/adjacent areas revalidated:** custom property create/update/value route surfaces, work item detail read models, view catalogs, generated Convex API roster, and zero-duplication Fallow policy.
- **Hotspots or sibling paths revisited:** create/update/archive property definitions, item detail subscriptions, team/workspace/personal work indexes, view catalog scopes, route PATCH preservation, duplicate option ID/label variants.
- **Dependency/adjacent surfaces revalidated:** no package changes in this turn; existing dependency audit remains below the configured high-severity fail threshold.
- **Why this is enough:** every imported finding now has an owner-boundary fix plus regression coverage for the failed variant and a sibling path.

### Challenger pass

- done — Assumed the read-model fix could still miss a definition consumer; this added item detail, team/workspace/personal work indexes, and team/workspace view catalog scopes to the invalidation helper.
- done — Assumed the option-ID fix could be route-only; this added Convex-side validation and route-side schema rejection.
- done — Assumed the parser fix might only cover the API map, not imports; the generated import parser now also accepts semicolonless Convex output and both fallback CI diff shapes pass locally.

### External finding import

| Source                    | Finding                                                                                                                    | Current status   | Bug class                                        | Missed invariant/variant                                                                                            | Action                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| GitHub CI                 | Convex fallback blocks schema-change PRs without `CONVEX_DEPLOYMENT` and parser rejects semicolonless generated API output | Resolved locally | CI fallback / release safety / contract encoding | no-deployment fallback must still verify source-committed generated API roster across generated formatting variants | Fallback now warns on schema changes, verifies roster, and parser accepts semicolonless imports/API maps |
| Codex inline review       | Custom-property definition create/update/archive only bumped team work index, leaving item detail subscribers stale        | Resolved locally | state freshness / scoped read-model invalidation | definition changes affect item detail, view catalog, and broader work index scopes, not only team index             | Added shared property-definition scope helper and route contract coverage                                |
| PR diff-review automation | Select option IDs can collide and make persisted values ambiguous                                                          | Resolved locally | identity/uniqueness / persistence contract       | option IDs are persisted values and must be unique, independent of labels                                           | Added Convex validation, route schema guard, and create/update regression tests                          |
| Local re-review           | PATCH schema defaulted omitted `options` to `[]`, so name-only property edits could clear select options                   | Resolved locally | preservation / compatibility                     | update schemas must preserve omitted fields and differ from create defaults                                         | Split patch schema from create schema and asserted route PATCH payload shape                             |

### Resolved / Carried / New findings

#### WPDV-12 — resolved locally — Convex generated fallback failed valid no-deployment CI paths

- **Severity:** high
- **Evidence:** PR CI failed in both schema-change and dependency-only checks: schema changes hard-failed without `CONVEX_DEPLOYMENT`, and generated API parsing rejected the committed semicolonless output.
- **Fix:** Changed schema-change fallback from hard failure to warning, retained reliable diff-base and generated API roster checks, and made generated import/API map parsing semicolon-tolerant.
- **Prevention:** Script parser test plus both failed CI diff-shape simulations now pass locally.

#### WPDV-13 — resolved locally — custom-property definition mutations left detail read models stale

- **Severity:** medium
- **Evidence:** Codex inline review on `app/api/custom-properties/[propertyId]/route.ts` correctly noted item detail read models include `customPropertyDefinitions` but were not invalidated.
- **Fix:** Added `getCustomPropertyDefinitionScopeKeys()` covering team/workspace/personal work indexes, item detail keys for team items, and team/workspace view catalogs; create/update/archive routes now use the resolver.
- **Prevention:** Added read-model scope test and route contract tests for create/update/archive invalidation.

#### WPDV-14 — resolved locally — select option IDs were not unique

- **Severity:** medium
- **Evidence:** PR automation found duplicate option IDs could map one persisted select value to multiple labels.
- **Fix:** Convex option normalization now trims and enforces unique non-empty option IDs; route schemas reject duplicate option IDs.
- **Prevention:** Added Convex create/update handler tests and a route invalid-payload test.

#### WPDV-15 — resolved locally — PATCH schema could clear select options on unrelated edits

- **Severity:** medium
- **Evidence:** The new route contract test showed a name-only PATCH parsed to `{ name, options: [] }`.
- **Fix:** Split custom property create and patch schemas so update payloads do not inherit create-time defaults.
- **Prevention:** Route update test asserts the forwarded patch omits `options` for a name-only update.

### Recommendations

1. **Fix first:** Commit this local batch and push once.
2. **Then address:** Wait for the next GitHub CI/Codex/diff-review feedback before making another push.
3. **Patterns noticed:** Generated fallback tools need to tolerate formatter differences in generated files; update schemas should not reuse create defaults when omitted fields have preservation semantics.
4. **Suggested approach:** Keep read-model scope fan-out in shared scoped-sync helpers, not route-local arrays.
5. **Architecture transition:** No new long-lived exception; the no-deployment Convex fallback is explicitly a source-committed roster check plus TypeScript validation, not a replacement for deployment codegen.
6. **Defer on purpose:** Browser smoke remains deferred for this contract-only feedback batch.

## Turn 3 — 2026-05-12 18:39 BST

| Field           | Value      |
| --------------- | ---------- |
| **Commit**      | `b8e90c3a` |
| **IDE / Agent** | Codex      |

### Automation context

| Field                          | Value                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------- |
| **Trigger**                    | `pull_request.opened` / CI check                                             |
| **PR**                         | `declancowen/Linear#34`                                                      |
| **Base ref**                   | `main`                                                                       |
| **Base SHA**                   | `19e92e2dd82e447ff65af210892937c5aa589ab9`                                   |
| **Head SHA**                   | `b8e90c3acff541d6246ba21e00911c71e368dd2a`                                   |
| **Previous reviewed head SHA** | none                                                                         |
| **Diff reviewed**              | `19e92e2d...b8e90c3a` plus dependency fix delta                              |
| **Workflow run**               | `25751359758`                                                                |
| **Review comment/check**       | CI `check` failed at `pnpm audit:deps`                                       |
| **Trusted state source**       | GitHub check run                                                             |
| **Verification policy**        | Fix live CI dependency audit failure and rerun local audit/static/test/build |

**Summary:** Imported GitHub CI feedback for PR #34. CI failed before Convex generation and `pnpm check` because `pnpm audit:deps` found high-severity advisories in `next@16.2.4` and transitive `fast-uri@3.1.0`. The branch now upgrades Next and its ESLint config to `16.2.6` and pins `fast-uri` to patched `3.1.2` via pnpm override.
**Outcome:** local fix complete; waiting for new PR check run
**Risk score:** high — framework/security dependency update on top of a broad feature branch.
**Change archetypes:** external CI finding, dependency security, framework patch update, lockfile update.
**Intended change:** Clear the PR CI security audit failure without widening dependency changes beyond the vulnerable packages.
**Intent vs actual:** The fix is narrow: no unrelated dependencies changed, `pnpm audit:deps` now passes the high threshold, and framework validation still passes locally.
**Confidence:** medium-high — local validation is clean; GitHub CI still needs to rerun on the pushed fix.
**Coverage note:** Full test and build passed on Next `16.2.6`.
**Finding triage:** Live CI finding. Not stale: current branch had vulnerable versions in `package.json`/`pnpm-lock.yaml`.
**Static/analyzer evidence:** `pnpm fallow:gate` still passes after the dependency update with dead-code `0`, health findings `0`, duplication `0/0`.
**Architecture impact:** Dependency patch only; no application boundary moved. The `fast-uri` override is narrow and records an explicit security floor for the transitive dependency.
**Bug classes / invariants checked:** dependency security gate, framework compatibility, lockfile/package consistency, CI parity.
**Branch totality:** Rechecked current PR head and local diff after importing the CI finding.
**Sibling closure:** Checked both vulnerable dependency families reported by audit: direct `next` and transitive `fast-uri`.
**Remediation impact surface:** `package.json` and `pnpm-lock.yaml`.
**Residual risk / unknowns:** GitHub CI and any Codex/Convex review comments are still pending after push.

### Validation

- `pnpm audit:deps` — passed; high advisories cleared
- `pnpm typecheck` — passed
- `pnpm lint` — passed
- `pnpm fallow:gate` — passed
- `pnpm test` — passed, 174 files / 956 tests
- `pnpm build` — passed on Next `16.2.6`

### Branch-totality proof

- **Non-delta files/systems re-read:** CI check log, `package.json`, `pnpm-lock.yaml`, PR check rollup.
- **Prior open findings rechecked:** none in the local review file.
- **Prior resolved/adjacent areas revalidated:** full validation from Turn 2 still passes after the dependency update.
- **Hotspots or sibling paths revisited:** direct Next runtime package and matching `eslint-config-next`; transitive `fast-uri` through `shadcn>@modelcontextprotocol/sdk>ajv`.
- **Dependency/adjacent surfaces revalidated:** install lockfile, audit gate, typecheck/lint/test/build.
- **Why this is enough:** the CI failure was solely the dependency audit step, and the exact vulnerable packages now resolve to patched versions with local audit proof.

### Challenger pass

- done — Checked whether the fix should be a broad dependency upgrade. It should not: the audit only required `next >=16.2.6` and `fast-uri >=3.1.2`, so the patch stays narrow.

### Resolved / Carried / New findings

#### WPDV-11 — resolved locally — CI dependency audit failed on high-severity advisories

- **Severity:** high
- **Evidence:** GitHub CI run `25751359758` failed at `pnpm audit:deps`, reporting `next@16.2.4` and `fast-uri@3.1.0` high-severity advisories.
- **Fix:** Upgraded `next` and `eslint-config-next` to `16.2.6`; added `pnpm.overrides.fast-uri = 3.1.2`; regenerated `pnpm-lock.yaml`.
- **Prevention:** `pnpm audit:deps` now passes locally and remains part of CI.

### Recommendations

1. **Fix first:** Commit and push this dependency audit fix.
2. **Then address:** Wait for the new GitHub CI/Codex/Convex feedback and import any live findings into the next turn.
3. **Patterns noticed:** CI has a stricter dependency-audit step than the first local loop ran; keep `pnpm audit:deps` in the publish validation set.
4. **Suggested approach:** Keep dependency overrides narrow and remove `fast-uri` override later only when the upstream chain resolves to `>=3.1.2`.
5. **Architecture transition:** None.
6. **Defer on purpose:** Low/moderate audit advisories remain below this repo's configured `--audit-level high` gate.

## Turn 2 — 2026-05-12 18:28 BST

| Field           | Value                      |
| --------------- | -------------------------- |
| **Commit**      | `19e92e2d` plus local diff |
| **IDE / Agent** | Codex                      |

**Summary:** Re-ran the diff-review loop after static cleanup and full validation. One new test-fixture regression was found and fixed: the shared dialog stub changed the controlled dialog root shape used by `RenameDialog` tests. Architecture preflight also surfaced remaining empty/generated duplicate `* 2` / `* 3` artifacts, which were removed. Current Fallow changed-file, full duplication, lint, typecheck, build, and full Vitest validation are clean.
**Outcome:** all clear pending PR automation feedback
**Risk score:** high — this remains a broad auth, tenancy, data model, realtime persistence, and presentation branch.
**Change archetypes:** shared contract, auth/tenancy, optimistic state, realtime persistence, shared UI, analyzer-backed refactor, test fixture extraction.
**Intended change:** Complete the requested work-properties/document-views/workspace-routing feature set and close review-found regressions before publishing.
**Intent vs actual:** The branch now matches the requested scope locally. The dialog fixture fix preserves the previous controlled-root behavior for menu tests while still centralizing shared dialog primitives.
**Confidence:** high for local static and automated coverage; medium-high overall until GitHub/Codex/Convex PR feedback is imported.
**Coverage note:** Full Vitest suite passed after the fixture fix. Browser smoke has not been run in this local loop.
**Finding triage:** No open local findings remain. The new test-stub regression was live, fixed, and verified. Remaining duplicate-style directories/cache files were empty or generated artifacts and are removed. Prior Fallow clone caveats are resolved: full duplication now reports zero clone groups.
**Static/analyzer evidence:** `pnpm fallow:gate` passes with dead-code `0`, health findings `0`, and duplication `0/0`. `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` exits `0` with verdict `pass`, dead code `0`, complexity `0`, clone groups `0`.
**Architecture impact:** Shared validation remains at the Convex/data boundary; route helpers hold route-specific error translation; test fixture sharing is limited to UI primitive stubs rather than product behavior.
**Bug classes / invariants checked:** tenant/team scope, typed persisted values, destructive flush guard, route/cookie selection matrix, optimistic background failure UX, display-property scope, parent-filtered child rows, controlled dialog container behavior.
**Branch totality:** Rechecked the whole local diff via review preflight and current `git status`, not just the last fixture edit.
**Sibling closure:** Revisited workspace routing, custom property API/Convex/store/UI, notification mutation UX, PartyKit persistence, and test fixture consumers after static cleanup.
**Remediation impact surface:** Fixed test fixture ownership in `tests/lib/fixtures/component-stubs.tsx` and updated dialog consumers without changing production dialog behavior.
**Residual risk / unknowns:** PR automation and Convex review have not run yet. Browser smoke remains a manual follow-up risk for the broad UI surfaces.

### Validation

- `/Users/declancowen/.codex/skills/diff-review/scripts/review-preflight.sh` — passed; no PR detected yet
- `/Users/declancowen/.codex/skills/architecture-standards/scripts/architecture-preflight.sh` — passed; surfaced duplicate artifacts that were removed
- `find . ... \( -name '* 2' -o -name '* 2.*' -o -name '* 3' -o -name '* 3.*' \) -print` — passed after cleanup; no duplicate-style paths remain
- `git diff --check` — passed
- `pnpm typecheck` — passed
- `pnpm lint` — passed
- `pnpm fallow:gate` — passed
- `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` — passed; changed-file clone groups `0`
- `pnpm exec vitest run tests/convex/work-item-handlers.test.ts` — passed
- `pnpm exec vitest run tests/components/entity-context-menus.test.tsx` — passed
- `pnpm test` — passed, 174 files / 956 tests
- `pnpm build` — passed

### Branch-totality proof

- **Non-delta files/systems re-read:** review history, diff-review gates, static-analysis rules, workspace entry helpers, custom property route helpers, Convex access helpers, notification runtime, PartyKit teardown guard.
- **Prior open findings rechecked:** none remain open in this review file.
- **Prior resolved/adjacent areas revalidated:** WPDV-1 through WPDV-8 remain fixed under typecheck, lint, full tests, build, and Fallow gates.
- **Hotspots or sibling paths revisited:** custom property definitions/values, project/view edit dialogs, document taskbar/viewbars, filter/group display selectors, workspace selector route, notification read background sync, chat reaction access, DnD completion state, live document teardown persistence.
- **Dependency/adjacent surfaces revalidated:** proxy matchers, generated Convex API typing, route contract fixtures, component stubs, store slice registration, read-model bootstrap collections.
- **Why this is enough:** the branch has no current static/test/build failures, the analyzer modes no longer carry clone/dead-code findings, and the new regression was in test harness behavior with direct focused coverage.

### Challenger pass

- done — Assumed one serious issue remained in the latest shared-fixture refactor. Full Vitest exposed the controlled-dialog root mismatch; the fixture now supports the two prior root shapes explicitly and the focused menu test passes.

### Resolved / Carried / New findings

#### WPDV-9 — resolved — shared dialog test stub changed controlled menu-dialog behavior

- **Severity:** low
- **Evidence:** `pnpm test` failed in `tests/components/entity-context-menus.test.tsx`; the extracted dialog stub wrapped the dialog in an extra root `<div>`, so the test sent Enter to the wrong node and `onConfirm` was not called.
- **Fix:** Added a configurable `rootAsFragment` mode to `createDialogStubModule()` and filtered `showCloseButton` out of DOM props.
- **Prevention:** Focused `entity-context-menus` test and full Vitest suite now pass.

#### WPDV-10 — resolved — empty/generated duplicate-style directories remained after source duplicate cleanup

- **Severity:** low
- **Evidence:** Architecture preflight and broad `find` sweep found empty duplicate API route directories such as `app/api/read-models/projects 2`, an empty `services/partykit 2`, and ignored generated `.next` cache files with ` 2`/` 3` suffixes.
- **Fix:** Removed the empty duplicate directories and generated duplicate cache files.
- **Prevention:** Re-ran the duplicate-style path sweep and confirmed no matching paths remain.

### Recommendations

1. **Fix first:** Push the current local branch and wait for GitHub/Codex/Convex automation feedback.
2. **Then address:** Import any automation findings into Turn 3, classify current-tree behavior, fix live issues, and rerun the local loop.
3. **Patterns noticed:** Broad UI fixture extraction needs focused tests plus full-suite confirmation because root/container shape affects keyboard handlers.
4. **Suggested approach:** Keep custom property and workspace-routing invariants enforced server-side; keep UI helpers limited to convenience/state rendering.
5. **Architecture transition:** No new transition item from this turn; current helpers have clear route, Convex, domain, store, or test-fixture ownership.
6. **Defer on purpose:** Browser smoke remains deferred until after PR automation unless automation flags a presentation issue.

## Turn 1 — 2026-05-12 18:06 BST

| Field           | Value                      |
| --------------- | -------------------------- |
| **Commit**      | `19e92e2d` plus local diff |
| **IDE / Agent** | Codex                      |

**Summary:** Reviewed the large local diff with architecture-standards and Fallow signals, removed duplicate/stale numeric-suffix files, fixed real contract and UX regressions, and reran focused validation after each batch.
**Outcome:** all clear with low-risk unknowns
**Risk score:** high — broad auth, tenancy, data model, realtime persistence, and presentation changes.
**Change archetypes:** shared contract, auth/tenancy, optimistic state, realtime persistence, shared UI, analyzer-backed refactor.
**Intended change:** Implement custom work properties, document views/taskbar, project/view editing, workspace selector routing, UI fixes, PartyKit wipe guard, DnD hardening, notification and chat reaction fixes.
**Intent vs actual:** Implementation matches the requested capability set after review fixes. The selected-workspace and notification-read follow-ups were corrected during review.
**Confidence:** medium-high — focused checks and changed-file Fallow gate are clean for dead code/complexity; full-suite validation still needs to run before commit.
**Coverage note:** Focused workspace selection route contract test passed. Full test/type/lint/build are pending in final validation.
**Finding triage:** All live review findings found in this turn were fixed. Fallow clone groups remain advisory under the configured production duplication gate; no duplicate files remain.
**Static/analyzer evidence:** `fallow audit --changed-since origin/main` now exits `0` with no dead-code or complexity findings and `warn` only for clone groups. Production dead-code exits `0`; production dupes exits `0`.
**Architecture impact:** Improved ownership by moving workspace entry routing into server helpers, keeping custom property validation in Convex handlers, and avoiding UI-only validation for persisted property shape.
**Bug classes / invariants checked:** tenancy boundary, cookie/session routing, destructive persistence guard, optimistic mutation failure UX, typed custom property validation, display property scope, drag-state reset.
**Branch totality:** Reviewed cumulative local diff, not only the latest edits; duplicate file candidates were compared against canonical paths and removed where stale/duplicate.
**Sibling closure:** Checked workspace root/layout/selector paths together, custom property UI/API/Convex/read model paths together, and notification toast/store/API paths together.
**Remediation impact surface:** Changed workspace selection route, server helpers, custom property controls/handlers/routes, notification runtime handling, and static-analysis hotspot refactors.
**Residual risk / unknowns:** Browser smoke and full validation are still required before PR. PR automation/Convex review has not run yet.

### Validation

- `pnpm exec tsc --noEmit --pretty false` — passed
- `pnpm exec eslint ...changed files... --max-warnings 0` — passed
- `pnpm exec vitest run tests/app/api/workspace-selection-route-contracts.test.ts` — passed
- `pnpm exec fallow audit --changed-since origin/main --format json --quiet --explain` — passed with advisory clone warning only
- `pnpm exec fallow dead-code --production --format json --quiet --summary` — passed
- `pnpm exec fallow dupes --production --ignore-imports --format json --quiet` — passed

### Branch-totality proof

- **Non-delta files/systems re-read:** workspace auth helpers, workspace selection API, shell notification toast routing, store runtime, custom property API/Convex/read model surfaces.
- **Prior open findings rechecked:** none in this review file; existing `.reviews/` history was checked during preflight.
- **Prior resolved/adjacent areas revalidated:** duplicate numeric-suffix files were removed; Fallow dead-code went from failing to clean.
- **Hotspots or sibling paths revisited:** workspace root/layout/selector route matrix; custom property UI and server validators; notification read mutation failure path.
- **Dependency/adjacent surfaces revalidated:** proxy matchers include `/workspaces`, `/api/custom-properties`, and `/api/work-items`; route smoke had already verified auth redirects/statuses after matcher changes.
- **Why this is enough:** The fixes address authoritative boundaries and the current analyzer gate is no longer failing on dead code or complexity.

### Challenger pass

- done — Rechecked whether analyzer findings were merely cosmetic; fixed the ones tied to exported API drift, validation bypasses, routing contracts, or user-visible failure UX.

### Resolved / Carried / New findings

#### WPDV-1 — resolved — single-workspace users were redirected without selecting the workspace

- **Severity:** medium
- **Evidence:** `/workspaces` redirected directly to `/workspace/projects` for one workspace, but only the POST selection API set `linear_selected_workspace_id`.
- **Fix:** Added a GET selection bridge and shared workspace navigation helper so one-workspace entry redirects through a cookie-setting selection route.
- **Prevention:** Added GET route contract coverage in `tests/app/api/workspace-selection-route-contracts.test.ts`.

#### WPDV-2 — resolved — custom select values could not be cleared from the UI

- **Severity:** medium
- **Evidence:** `CustomPropertyValueControl` allowed selecting options but no `null` clear path for select/multi-select.
- **Fix:** Added `No selection`/`Clear values` options that persist `null`.

#### WPDV-3 — resolved — integer custom property input truncated decimal values

- **Severity:** medium
- **Evidence:** `Number.parseInt("1.5", 10)` committed `1`.
- **Fix:** Switched to `Number(rawValue)` plus `Number.isInteger`.

#### WPDV-4 — resolved — Convex accepted blank custom select option labels

- **Severity:** medium
- **Evidence:** UI prevented blank labels, but direct API/Convex mutations could submit empty trimmed labels.
- **Fix:** Added authoritative option label validation in `convex/app/custom_property_handlers.ts`.

#### WPDV-5 — resolved — custom property type/option edits could invalidate existing values

- **Severity:** medium
- **Evidence:** PATCH could change a property type or remove used choice option ids while historical values existed.
- **Fix:** Reject type changes when values exist and reject removal of option ids currently used by select/multi-select values.

#### WPDV-6 — resolved — notification toast click could show a stale “Failed to update notification” error

- **Severity:** medium
- **Evidence:** Toast click marks notifications read optimistically while navigating; background read failures surfaced a user-visible error despite the navigation succeeding.
- **Fix:** Added runtime support for silent background sync failures and made idempotent mark-read use `refreshStrategy: "none"` with no toast.

#### WPDV-7 — resolved — introduced production-only exports and complexity drift

- **Severity:** low
- **Evidence:** Fallow reported unused exports and changed-file complexity findings.
- **Fix:** Removed unused exports and split complex route/UI/Convex functions into owner-local helpers.

#### WPDV-8 — resolved — duplicate/stale numeric-suffix files polluted the worktree

- **Severity:** low
- **Evidence:** Numeric-suffix files such as `route 2.ts`, `project-inputs 2.ts`, and `server 2.ts` duplicated or lagged canonical files.
- **Fix:** Removed exact duplicates and stale non-canonical copies after comparing with canonical paths.

### Recommendations

1. **Fix first:** Run full lint, typecheck, tests, build, and focused browser smoke before PR.
2. **Then address:** Poll PR/Convex review feedback after opening the PR and import any live findings into a new turn.
3. **Patterns noticed:** Broad feature diffs need static-analysis passes before PR because unused exports and complexity drift appear easily in shared UI/data paths.
4. **Suggested approach:** Keep custom property rules authoritative in Convex; keep UI controls as convenience only.
5. **Architecture transition:** Consider extracting shared route error/auth helpers if custom property route surface grows further.
6. **Defer on purpose:** Remaining Fallow clone groups are advisory and below configured production duplication budget.
