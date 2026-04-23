# Scoped Read Model Loading Flicker

## Problem

Several side-nav destinations could render a false empty state for a single frame before the scoped read model for the newly selected scope finished loading.

The user-facing symptom was:

- open a scoped collection screen such as docs
- briefly see `No documents yet`
- then see the real collection once the scoped read model landed

The risk existed anywhere a screen combined:

- a scope-filtered selector over the shared app store
- an empty state for `0` results
- a loading state keyed off `useScopedReadModelRefresh().hasLoadedOnce`

## Root Cause

`useScopedReadModelRefresh` tracked readiness with a plain boolean. On a scope change, that boolean was reset inside a passive `useEffect`.

That left a first commit where:

- the component was already rendering for the new scope
- the selector for the new scope could still be empty
- the previous scope's `hasLoadedOnce` value was still `true`

That combination allowed a false empty state to render before the effect reset readiness and before the new scoped fetch completed.

## Architecture Decision

The fix belongs in the shared read-model readiness boundary, not in each screen.

Why:

- the failure mode is cross-cutting and not docs-specific
- screen-level guards would duplicate policy and drift
- the presentation layer should consume a readiness signal that is already correct for the current scope

This keeps the existing architecture shape intact:

- read-model routes define scoped data contracts
- the store merges scoped patches
- screens stay declarative and only decide between loading, empty, and populated states

## Fix

`useScopedReadModelRefresh` now records which scope signature actually completed and only reports `hasLoadedOnce` when that completed signature matches the currently requested scope signature.

That changes the effective contract from:

- `some refresh completed in this hook instance`

to:

- `the currently rendered scope has completed at least one refresh`

## Rejected Option

Adding more local guards to `DocsScreen` was rejected because it would only hide one manifestation of the same bug shape while leaving the rest of the scoped collection screens exposed.

## Impact

This removes false empty-state flicker for scope transitions that reuse the same screen instance, including the docs directory path that triggered this work.

It does not change the separate behavior where detail screens still lazy-load richer detail read models after navigation. If those surfaces should feel instant as well, that needs prefetching or a broader bootstrap change, not another empty-state guard.
