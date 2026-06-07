# Review: view-filter optimistic clobber protection

Scope: extend `pendingViewConfigById` reconciliation to cover saved-view filter, hidden-state, and display-prop toggles so a racing scoped read-model refresh cannot revert optimistic edits.
Hotspots: `lib/store/app-store-internal/slices/views.ts`, `lib/store/app-store-internal/slices/ui.ts` (`applyPendingViewConfig`/`matchesPendingViewConfig`), `lib/domain/types-internal/models.ts` (`ViewConfigPatch`).
Status: CLEAR.

## Turn 2

- Outcome: clean. Risk: Medium (API route contract + state-owner change).
- Trigger: user reported On Hold status update still reverts on Vercel prod, and view filters not applying / label leak — after Convex deploy. Root-caused below.
- Findings fixed:
  - **F-ROUTE-STATUS (High):** `app/api/items/[itemId]/route.ts` `workItemPatchSchema.status` hardcoded a 6-value enum missing `on-hold`, so `PATCH { status: "on-hold" }` was rejected at the Next.js route layer (400) before reaching Convex. This is why deploying Convex had no effect: the route is the failing owner. Fixed by deriving `status`/`priority` from canonical `workStatuses`/`priorities` (single source of truth). Contract test added (route accepts `on-hold`).
  - **F-VIEWCONFIG-FILTERS (Medium):** store `updateViewConfig` dropped `patch.filters` optimistically (only applied `showCompleted`/`showEmptyGroups`), inconsistent with `applyPendingViewConfig` which applies them. Any surface routing filter changes through the config-patch path would show filters not applying. Fixed to mirror `applyPendingViewConfig`.
  - **F-STALE-FIXTURES (Low):** `tests/lib/fixtures/{app-data,scoped-read-models}.ts` `statusOrder` arrays were 6-element (pre-on-hold), failing `teamWorkflowSettingsSchema.length(workStatuses.length)` in team route contract tests. Updated to canonical 7 (on-hold first). These were pre-existing failures surfaced by running `tests/app`.
- Invariant/ownership: work-status set is a domain invariant owned by `workStatuses` (primitives). Confirmed all other status enums (Convex `workStatusValidator`, `viewFiltersSchema`, `teamWorkflowSettingsSchema`, `workItemSchema`) already derive from canonical constants; the items PATCH route was the only scattered copy. Grep for `"cancelled"`/`"duplicate"` enum literals confirms no remaining production duplication.
- Label-leak trace (no code change): traced the full My Items/teamspace work-surface filter pipeline — `toggleViewerViewFilterValue` (viewer config) → `applyViewerViewConfig` merge → `getCompatibleActiveView`/`getCompatibleWorkSurfaceFilters` (preserves `labelIds`) → `getVisibleItemsForView` → `itemMatchesView` (`matchesAnyOptionalFilter` on `item.labelIds`). All correct; read-model merge preserves `ui.viewerViewConfigByRoute`. The viewer-config label-filter path is correct in code; the most likely cause of the user's observation was the stale Vercel build (status route never fixed until now). The `updateViewConfig` fix covers the config-patch filter surfaces.
- Validation: `pnpm typecheck`, `pnpm lint` clean; `pnpm vitest run tests/lib tests/convex tests/app` = 1015 passed; `pnpm build` clean.
- Residual risk: if the label leak persists after this deploy, the exact surface (saved/shared view vs My Items, list vs board grouping) is needed to reproduce — the traced paths are correct.

## Turn 1

- Outcome: clean. Risk: Medium (optimistic-state reconciliation, shared store owner).
- Archetypes: optimistic-state, state-reconciliation.
- Intended change: reuse the existing pending-view-config owner boundary (previously only `updateViewConfig`) for `toggleViewFilterValue`/`clearViewFilters`/`toggleViewHiddenValue`/`toggleViewDisplayProperty`/`reorderViewDisplayProperties`.
- Coverage: read all changed files fully; traced reconcile (`reconcilePendingViews`), apply (`applyPendingViewConfig`), match (`matchesPendingViewConfig`), merge (`mergePendingViewConfigPatch`), and the saved-view action callers. Confirmed viewer-config (My Items personal override) path is separate `ui` state and unaffected.
- Invariant/variant proof:
  - In-flight clobber prevented: `applyPendingViewConfig` re-applies `filters` (explicit block) and `displayProps`/`hiddenState` (via `...viewPatch`). Verified for patches containing only one of the three.
  - Pending entry always cleared: `runPendingViewConfigSync` clears on token-matched settle (then+catch), backstopping the early `matchesPendingViewConfig` clear. No lingering-entry path, including the unguarded `reorderViewDisplayProperties`.
  - Sequential edits preserved: `mergePendingViewConfigPatch` deep-merges `filters`; token overwrite matches existing `updateViewConfig` semantics.
  - `clearViewFilters` boolean fields (`showCompleted`/`showEmptyGroups`) confirmed by `matchesPendingFilterSelections` `===` branch; arrays by set-equality.
- Branch interaction: prior turn deployed `on-hold` to Convex dev+prod; this turn is client-only (plus additive `displayProps` on `ViewConfigPatch`), compatible with deployed backend. No backend/contract change.
- Validation: `pnpm typecheck` clean; `pnpm lint` clean (`--max-warnings 0`); `pnpm vitest run tests/lib tests/convex` 822 passed, including new regression test asserting filter+display-prop edits survive a racing refresh and clear when the server catches up.
- Residual risk: none material. Low note: `reorderViewDisplayProperties` lacks the view-existence guard its siblings use, but the settle backstop makes this benign.
