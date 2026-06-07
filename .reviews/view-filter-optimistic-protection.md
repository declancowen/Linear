# Review: view-filter optimistic clobber protection

Scope: extend `pendingViewConfigById` reconciliation to cover saved-view filter, hidden-state, and display-prop toggles so a racing scoped read-model refresh cannot revert optimistic edits.
Hotspots: `lib/store/app-store-internal/slices/views.ts`, `lib/store/app-store-internal/slices/ui.ts` (`applyPendingViewConfig`/`matchesPendingViewConfig`), `lib/domain/types-internal/models.ts` (`ViewConfigPatch`).
Status: CLEAR.

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
