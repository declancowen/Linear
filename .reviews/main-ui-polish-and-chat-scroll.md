# Review: main — document UI alignment + chat refresh scroll

scope: components/app/screens/document-detail-screen.tsx, components/app/screens/document-detail-sidebar.tsx, components/app/collaboration-screens/chat-thread.tsx
branch: main
status: review-clean (code-only; no visual smoke)
skills: architecture-standards (Build Mode) + diff-review (deep dual-pass)

## Diff-review turn — 2026-06-07

Risk: Low. Archetypes: shared-UI/presentation + chat optimistic-scroll. Ported three already-validated UI fixes from the collaboration branch plus a new chat-scroll fix, directly on main.

### Changes

- C1 — Editor canvas overflow: `document-detail-screen.tsx` editor flex column `flex min-h-0 flex-1 flex-col` → added `min-w-0`. A flex child without `min-w-0` can't shrink below its content's intrinsic width, so a wide/wrapping editor line expanded the column and pushed the properties sidebar/parent out of bounds. `min-w-0` only permits shrinking.
- C2 — Document topbar + breadcrumb alignment: detail topbar `min-h-10 … px-4 py-2 border-b` → `min-h-11 … px-3.5 border-b border-line`, and the breadcrumb left group `gap-1.5` → `gap-2`. Matches the shared `Topbar` primitive (h-11 / px-3.5 / gap-2 / border-line) used by the Docs collection heading, so the `SidebarTrigger` + "Docs / title" and the bottom divider line up. Resting height is 44px (min-h-11 governs h-7 content); editing-title growth still works via min-h (not fixed).
- C3 — Properties sidebar divider: `document-detail-sidebar.tsx` header `h-9 border-line-soft` → `h-11 border-line`, plus a `showClose`/`showHeaderClose` prop (default true). The "Document" divider now sits on the same 44px baseline as the editor topbar divider. The detail screen passes `showHeaderClose={false}` because it already has a topbar properties toggle (`onToggleProperties`, document-detail-screen.tsx:496–500); the Docs **list** properties panel keeps the in-sidebar close (default true) as its only close affordance.
- C4 — Chat doesn't open at the latest message on refresh: `chat-thread.tsx` `useChatMessagesAutoScroll`. The existing one-shot scroll + rAF + 50/150/300ms timeouts close before late content (markdown/fonts/images) settles on a cold reload, and nothing re-pins afterward. Added a `MutationObserver` on the scroll container that re-pins to the bottom as content mutates, **gated on near-bottom** (`scrollHeight − scrollTop − clientHeight < 120`) so a user scrolling history is never yanked down; rAF-debounced; disconnected in cleanup.

### Architecture-standard notes

- C1–C3 are presentation-only at the owning components; no contract/data/state change. C2/C3 deliberately reuse the existing `Topbar` geometry instead of introducing new spacing constants.
- C4 keeps the auto-scroll owned by the existing hook; no new state surface. The near-bottom gate is the invariant that prevents fighting user scroll. `scrollTop`/`scrollIntoView` don't trigger MutationObserver, so there's no re-pin loop.

### Invariant/variant checks

- Sidebar consumers: only the detail screen (showHeaderClose=false) and the Docs-list properties panel (default true) — verified; docs-list close affordance preserved.
- Chat re-pin: when scrolled up (distance ≥ 120) the observer no-ops; new messages still scroll via the existing `latestMessageKey` effect re-run; observer disconnects on unmount/dep change.

### Validation

- `pnpm exec eslint document-detail-screen.tsx document-detail-sidebar.tsx chat-thread.tsx --max-warnings 0` — clean.
- `pnpm exec vitest run tests/components/chat-thread.test.tsx tests/components/document-detail-sidebar.test.tsx tests/components/conversation-files-panel.test.tsx` — 3 files / 38 tests pass.
- `pnpm typecheck` — clean (after clearing stale `.next/dev/types` left by an overnight branch switch; the stale file referenced a cloudflare-branch-only route absent on main).

### Files tab — verified working, no change needed

Chat "files tab doesn't show shared files" was investigated and then **confirmed working** by the user in both the chat thread and the files tab, so no change was made. The detection chain is correct: non-image files insert an `attachmentReference` node (lib/rich-text/extensions.ts:175) that renders `a[data-type="attachment"]`, and `ConversationFilesPanel` (used by both chat and the conversation/channel shell) collects that plus `img.editor-image` and already renders a download link. (Note for future: `removeLocalBlobUrlsFromStorageContent` in lib/content/rich-text-security.ts strips attachment anchors whose `href` is still a `blob:` URL, so a file sent before its upload finalizes would be dropped — not currently occurring.)

### C5 — New work status "On Hold" (ordered before backlog)

Added a new `WorkStatus` value `on-hold` (label "On Hold") as the first status, applied to all teams/items/views (parents + children) with its own icon + amber color.

- Source enum: `workStatuses` and `viewFilterStatuses` (primitives.ts) — `on-hold` prepended. The team default `statusOrder` is `[...workStatuses]` (work.ts:533), so order propagates everywhere via `getStatusOrderForTeam`.
- Universal application: `normalization.ts` resolves a team's `statusOrder` to the defaults whenever its length differs from the default, so teams with the old 6-entry order auto-adopt the new 7-entry default (On Hold first) — no data migration; existing items keep their status, `on-hold` is selectable everywhere.
- Label: `statusMeta` (work.ts) `"on-hold": { label: "On Hold" }`. `isCompletedWorkStatus`/`isExcludedFromWorkStatusRollup` unchanged (On Hold is incomplete, counts in rollups).
- Validators: `workStatusLiterals` + `viewFilterStatusLiterals` (convex/validators.ts) include `on-hold`.
- Icon/color: `StatusIconRingStatus` + `STATUS_ICON_STATUS_BY_LABEL` (shared.tsx) and a new `StatusRing` `on-hold` branch (dashed ring in `--status-hold`); new `--status-hold` token (light/dark + @theme) in globals.css; `event-accent.ts` (exhaustive `Record<WorkStatus>`) and the board group-accent map updated.
- Exhaustiveness: typecheck surfaced and confirmed all `Record<WorkStatus>` owners handled (only `event-accent.ts` required a fix beyond the source edits).

Validation: `pnpm typecheck` clean; `pnpm exec eslint` clean on all changed TS/TSX; status suites pass (default-views, view-item-level, work-item-handlers, people-activity, work-item-actions = 75 + 31 tests); `pnpm build` succeeded.

### Residual risk
- No authenticated browser visual smoke in this environment; C1–C3 are mechanism-based CSS/prop changes and C4 is covered by chat-thread component tests.
- These changes are uncommitted on `main`; the cloudflare-yjs WIP remains safely stashed (GitHub Desktop auto-stash on `codex/cloudflare-yjs-source-of-truth`).
