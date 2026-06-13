"use client"

import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from "react"

import { redirectToExpiredSessionLogin } from "@/lib/browser/session-redirect"
import {
  reportFirstUsefulRenderDiagnostic,
  reportScopedReadModelDiagnostic,
  reportScopedStreamReconnectDiagnostic,
} from "@/lib/browser/snapshot-diagnostics"
import type { ReadModelFetchResult } from "@/lib/convex/client/read-models"
import { RouteMutationError } from "@/lib/convex/client/shared"
import type { AppSnapshot } from "@/lib/domain/types"
import {
  SCOPED_DEGRADED_REFRESH_INTERVAL_MS,
  isForegroundScopedRefreshStale,
} from "@/lib/realtime/cost-policy"
import { isScopedSyncEnabled } from "@/lib/realtime/feature-flags"
import type { ScopedInvalidationEnvelope } from "@/lib/scoped-sync/client"
import { openScopedInvalidationStream } from "@/lib/scoped-sync/client"
import type { ScopedReadModelReplaceInstruction } from "@/lib/scoped-sync/read-models"
import { useAppStore } from "@/lib/store/app-store"

type ScopedReadModelInitialSeed = {
  data: Partial<AppSnapshot>
  replace?: ScopedReadModelReplaceInstruction[]
}

type ScopedReadModelRefreshInput = {
  enabled?: boolean
  scopeKeys: string[]
  fetchLatest: () => Promise<
    Partial<AppSnapshot> | ReadModelFetchResult<Partial<AppSnapshot>>
  >
  diagnostics?: {
    retainedData?: boolean
    surface: string
  }
  notFoundResult?:
    | Partial<AppSnapshot>
    | ReadModelFetchResult<Partial<AppSnapshot>>
  /**
   * Server-side seed for the current scope. When provided on (re)mount or on
   * scope change, the hook applies the seed to the store and treats the scope
   * as already loaded, skipping the redundant initial fetch. The scoped
   * invalidation stream is still opened so subsequent changes are picked up
   * normally. Callers must guarantee the seed matches the current scope; the
   * hook does not validate scope alignment.
   */
  initialSeed?: ScopedReadModelInitialSeed | null
}

function normalizeScopeKeys(scopeKeys: string[]) {
  return [
    ...new Set(scopeKeys.map((scopeKey) => scopeKey.trim()).filter(Boolean)),
  ].sort()
}

function isExpectedScopedReadModelMiss(error: unknown) {
  return error instanceof RouteMutationError && error.status === 404
}

function normalizeReadModelFetchResult(
  value: Partial<AppSnapshot> | ReadModelFetchResult<Partial<AppSnapshot>>
): ReadModelFetchResult<Partial<AppSnapshot>> {
  if ("data" in value) {
    return value
  }

  return {
    data: value,
  }
}

export function useScopedReadModelRefresh(input: ScopedReadModelRefreshInput) {
  const mergeReadModelData = useAppStore((state) => state.mergeReadModelData)
  const [error, setError] = useState<string | null>(null)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(() =>
    Boolean(input.initialSeed) &&
    input.enabled !== false &&
    isScopedSyncEnabled() &&
    normalizeScopeKeys(input.scopeKeys).length > 0
  )
  const [loadedScopeKeySignature, setLoadedScopeKeySignature] = useState(() =>
    Boolean(input.initialSeed) &&
    input.enabled !== false &&
    isScopedSyncEnabled()
      ? normalizeScopeKeys(input.scopeKeys).join("|")
      : ""
  )
  const [refreshing, setRefreshing] = useState(false)
  const inFlightGenerationRef = useRef<number | null>(null)
  const queuedRef = useRef(false)
  const runGenerationRef = useRef(0)
  const lastRefreshRequestedAtRef = useRef(0)
  const lastRefreshFailedRef = useRef(false)
  const scopedVersionByKeyRef = useRef(new Map<string, number>())
  const firstUsefulRenderStartedAtRef = useRef(0)
  const firstUsefulRenderSignatureRef = useRef("")
  const reportedFirstUsefulRenderSignatureRef = useRef("")
  const degradedIntervalIdRef = useRef<number | null>(null)
  const seedAppliedScopeRef = useRef("")
  const scopedSyncEnabled = isScopedSyncEnabled()
  const scopeKeySignature = normalizeScopeKeys(input.scopeKeys).join("|")
  const scopeKeys = useMemo(
    () => (scopeKeySignature.length > 0 ? scopeKeySignature.split("|") : []),
    [scopeKeySignature]
  )
  const activeScopeKeySignature =
    scopedSyncEnabled && input.enabled && scopeKeySignature.length > 0
      ? scopeKeySignature
      : ""
  const isLoaded =
    !scopedSyncEnabled ||
    (hasLoadedOnce && loadedScopeKeySignature === activeScopeKeySignature)
  const firstUsefulRenderSignature = [
    input.diagnostics?.surface ?? "",
    activeScopeKeySignature,
  ].join("|")

  const handleRefreshSuccess = useEffectEvent(
    (result: ReadModelFetchResult<Partial<AppSnapshot>>, startedAt: number) => {
      mergeReadModelData(result.data, {
        replace: result.replace,
      })
      lastRefreshFailedRef.current = false
      reportScopedReadModelDiagnostic({
        durationMs: window.performance.now() - startedAt,
        scopeKeys,
        status: "success",
      })
      setError(null)
    }
  )

  const handleRefreshFailure = useEffectEvent(
    (nextError: unknown, startedAt: number) => {
      reportScopedReadModelDiagnostic({
        durationMs: window.performance.now() - startedAt,
        scopeKeys,
        status: "failure",
        errorMessage:
          nextError instanceof Error
            ? nextError.message
            : "Failed to refresh scoped read model",
      })

      if (isExpectedScopedReadModelMiss(nextError)) {
        lastRefreshFailedRef.current = false

        if (input.notFoundResult) {
          const missingResult = normalizeReadModelFetchResult(
            input.notFoundResult
          )
          mergeReadModelData(missingResult.data, {
            replace: missingResult.replace,
          })
        }

        setError(null)
        return false
      }

      if (nextError instanceof RouteMutationError && nextError.status === 401) {
        lastRefreshFailedRef.current = false
        redirectToExpiredSessionLogin()
        return true
      }

      lastRefreshFailedRef.current = true
      console.error("Failed to refresh scoped read model", nextError)
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to refresh scoped read model"
      )

      return false
    }
  )

  const refresh = useEffectEvent(async () => {
    const refreshGeneration = runGenerationRef.current
    let didRedirectToLogin = false

    if (inFlightGenerationRef.current !== null) {
      queuedRef.current = true
      return
    }

    inFlightGenerationRef.current = refreshGeneration
    lastRefreshRequestedAtRef.current = Date.now()
    setRefreshing(true)
    const startedAt = window.performance.now()

    try {
      const result = normalizeReadModelFetchResult(await input.fetchLatest())
      if (runGenerationRef.current !== refreshGeneration) {
        return
      }
      handleRefreshSuccess(result, startedAt)
    } catch (nextError) {
      if (runGenerationRef.current !== refreshGeneration) {
        return
      }
      didRedirectToLogin = handleRefreshFailure(nextError, startedAt)
    } finally {
      if (inFlightGenerationRef.current === refreshGeneration) {
        inFlightGenerationRef.current = null
      }

      if (runGenerationRef.current === refreshGeneration) {
        setRefreshing(false)

        if (!didRedirectToLogin) {
          setLoadedScopeKeySignature(activeScopeKeySignature)
          setHasLoadedOnce(true)
        }
      }

      if (inFlightGenerationRef.current === null && queuedRef.current) {
        queuedRef.current = false
        void refresh()
      }
    }
  })

  const stopDegradedRefresh = useEffectEvent(() => {
    if (degradedIntervalIdRef.current === null) {
      return
    }

    window.clearInterval(degradedIntervalIdRef.current)
    degradedIntervalIdRef.current = null
  })

  const startDegradedRefresh = useEffectEvent(() => {
    if (degradedIntervalIdRef.current !== null) {
      return
    }

    void refresh()
    degradedIntervalIdRef.current = window.setInterval(() => {
      void refresh()
    }, SCOPED_DEGRADED_REFRESH_INTERVAL_MS)
  })

  const refreshFromForegroundEvent = useEffectEvent(() => {
    if (
      typeof document !== "undefined" &&
      document.visibilityState !== "visible"
    ) {
      return
    }

    if (inFlightGenerationRef.current !== null) {
      return
    }

    if (
      !isForegroundScopedRefreshStale({
        lastRefreshRequestedAt: lastRefreshRequestedAtRef.current,
        now: Date.now(),
      })
    ) {
      return
    }

    void refresh()
  })

  const commitScopedVersions = useEffectEvent(
    (envelope: ScopedInvalidationEnvelope | undefined) => {
      if (!envelope?.versions.length) {
        return false
      }

      let hasChanges = false
      const nextVersions = new Map(scopedVersionByKeyRef.current)

      for (const entry of envelope.versions) {
        if (nextVersions.get(entry.scopeKey) !== entry.version) {
          hasChanges = true
        }

        nextVersions.set(entry.scopeKey, entry.version)
      }

      scopedVersionByKeyRef.current = nextVersions
      return hasChanges
    }
  )

  const resetInactiveRefreshState = useEffectEvent((loaded: boolean) => {
    runGenerationRef.current += 1
    inFlightGenerationRef.current = null
    queuedRef.current = false
    lastRefreshFailedRef.current = false
    scopedVersionByKeyRef.current = new Map()
    stopDegradedRefresh()
    setRefreshing(false)
    setError(null)
    setLoadedScopeKeySignature("")
    setHasLoadedOnce(loaded)
  })

  // Apply the SSR-provided seed synchronously, before the browser paints, so
  // surfaces that depend on the read model render with data on first paint
  // instead of flashing an empty/loading state. Tracks the applied scope via
  // a ref so the main effect (below) knows to skip its initial fetch.
  useLayoutEffect(() => {
    if (!scopedSyncEnabled || !input.enabled) {
      seedAppliedScopeRef.current = ""
      return
    }

    if (activeScopeKeySignature.length === 0) {
      seedAppliedScopeRef.current = ""
      return
    }

    if (!input.initialSeed) {
      seedAppliedScopeRef.current = ""
      return
    }

    if (seedAppliedScopeRef.current === activeScopeKeySignature) {
      return
    }

    seedAppliedScopeRef.current = activeScopeKeySignature
    mergeReadModelData(input.initialSeed.data, {
      replace: input.initialSeed.replace,
    })
    // Flip the loaded-state synchronously inside the same commit cycle so
    // the very next render (still pre-paint) reflects the seed. If we left
    // this to the main useEffect below, it would only run post-paint and
    // surfaces whose scope keys depend on store-hydrated identifiers (e.g.
    // notification-inbox keyed by currentUserId) would briefly render the
    // Loading state between the parent layout's shell-seed apply and our
    // own seed apply.
    lastRefreshFailedRef.current = false
    setError(null)
    setRefreshing(false)
    setLoadedScopeKeySignature(activeScopeKeySignature)
    setHasLoadedOnce(true)
  }, [
    activeScopeKeySignature,
    input.enabled,
    input.initialSeed,
    mergeReadModelData,
    scopedSyncEnabled,
  ])

  useEffect(() => {
    const effectScopeKeys =
      scopeKeySignature.length > 0 ? scopeKeySignature.split("|") : []

    if (!scopedSyncEnabled) {
      resetInactiveRefreshState(true)
      return
    }

    if (!input.enabled || effectScopeKeys.length === 0) {
      resetInactiveRefreshState(false)
      return
    }

    runGenerationRef.current += 1
    scopedVersionByKeyRef.current = new Map()
    stopDegradedRefresh()

    if (seedAppliedScopeRef.current === activeScopeKeySignature) {
      // The seed was applied synchronously in the useLayoutEffect above; mark
      // the scope as loaded and skip the redundant initial fetch. The scoped
      // invalidation stream below still opens so subsequent versions are
      // picked up.
      lastRefreshFailedRef.current = false
      setError(null)
      setRefreshing(false)
      setLoadedScopeKeySignature(activeScopeKeySignature)
      setHasLoadedOnce(true)
    } else {
      setHasLoadedOnce(false)
      void refresh()
    }
    let hasSeenReady = false
    let hasEnteredDegradedMode = false

    const closeStream = openScopedInvalidationStream({
      scopeKeys: effectScopeKeys,
      onReady(envelope) {
        stopDegradedRefresh()
        const hasVersionChanges = commitScopedVersions(envelope)

        if (hasSeenReady) {
          hasEnteredDegradedMode = false
          if (hasVersionChanges || lastRefreshFailedRef.current) {
            void refresh()
          }
          return
        }

        hasSeenReady = true

        if (
          lastRefreshFailedRef.current ||
          (hasEnteredDegradedMode && hasVersionChanges)
        ) {
          hasEnteredDegradedMode = false
          void refresh()
          return
        }

        hasEnteredDegradedMode = false
      },
      onInvalidate(envelope) {
        commitScopedVersions(envelope)
        void refresh()
      },
      onUnavailable() {
        hasEnteredDegradedMode = true
        startDegradedRefresh()
      },
      onError() {
        // The scoped SSE route intentionally rolls connections periodically.
        // Refresh failures are surfaced by `fetchLatest`; routine reconnects are not actionable.
        reportScopedStreamReconnectDiagnostic(effectScopeKeys)
      },
    })

    const handleFocus = refreshFromForegroundEvent
    const handleOnline = refreshFromForegroundEvent

    window.addEventListener("focus", handleFocus)
    window.addEventListener("online", handleOnline)

    return () => {
      runGenerationRef.current += 1
      inFlightGenerationRef.current = null
      queuedRef.current = false
      lastRefreshFailedRef.current = false
      scopedVersionByKeyRef.current = new Map()
      stopDegradedRefresh()
      setRefreshing(false)
      closeStream()
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("online", handleOnline)
    }
  }, [
    activeScopeKeySignature,
    input.enabled,
    scopeKeySignature,
    scopedSyncEnabled,
  ])

  useEffect(() => {
    if (!input.diagnostics?.surface) {
      return
    }

    if (firstUsefulRenderSignatureRef.current !== firstUsefulRenderSignature) {
      firstUsefulRenderSignatureRef.current = firstUsefulRenderSignature
      firstUsefulRenderStartedAtRef.current = window.performance.now()
      reportedFirstUsefulRenderSignatureRef.current = ""
    }

    const retainedData = input.diagnostics.retainedData ?? false
    const hasUsefulRender = retainedData || isLoaded

    if (
      !hasUsefulRender ||
      reportedFirstUsefulRenderSignatureRef.current ===
        firstUsefulRenderSignature
    ) {
      return
    }

    reportedFirstUsefulRenderSignatureRef.current = firstUsefulRenderSignature
    reportFirstUsefulRenderDiagnostic({
      durationMs:
        window.performance.now() - firstUsefulRenderStartedAtRef.current,
      readModelLoaded: isLoaded,
      refreshing,
      retainedData,
      scopeKeys,
      surface: input.diagnostics.surface,
    })
  }, [
    firstUsefulRenderSignature,
    input.diagnostics?.retainedData,
    input.diagnostics?.surface,
    isLoaded,
    refreshing,
    scopeKeys,
  ])

  return {
    error,
    hasLoadedOnce: isLoaded,
    refreshing,
  }
}
