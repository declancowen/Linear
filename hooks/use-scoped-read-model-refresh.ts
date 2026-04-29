"use client"

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react"

import { redirectToExpiredSessionLogin } from "@/lib/browser/session-redirect"
import {
  reportScopedReadModelDiagnostic,
  reportScopedStreamReconnectDiagnostic,
} from "@/lib/browser/snapshot-diagnostics"
import type { ReadModelFetchResult } from "@/lib/convex/client/read-models"
import { RouteMutationError } from "@/lib/convex/client/shared"
import type { AppSnapshot } from "@/lib/domain/types"
import { isScopedSyncEnabled } from "@/lib/realtime/feature-flags"
import { openScopedInvalidationStream } from "@/lib/scoped-sync/client"
import { useAppStore } from "@/lib/store/app-store"

type ScopedReadModelRefreshInput = {
  enabled?: boolean
  scopeKeys: string[]
  fetchLatest: () => Promise<
    Partial<AppSnapshot> | ReadModelFetchResult<Partial<AppSnapshot>>
  >
  notFoundResult?:
    | Partial<AppSnapshot>
    | ReadModelFetchResult<Partial<AppSnapshot>>
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

const SCOPED_DEGRADED_REFRESH_INTERVAL_MS = 5000

export function useScopedReadModelRefresh(input: ScopedReadModelRefreshInput) {
  const mergeReadModelData = useAppStore((state) => state.mergeReadModelData)
  const [error, setError] = useState<string | null>(null)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [loadedScopeKeySignature, setLoadedScopeKeySignature] = useState("")
  const [refreshing, setRefreshing] = useState(false)
  const inFlightGenerationRef = useRef<number | null>(null)
  const queuedRef = useRef(false)
  const runGenerationRef = useRef(0)
  const degradedIntervalIdRef = useRef<number | null>(null)
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

  const refresh = useEffectEvent(async () => {
    const refreshGeneration = runGenerationRef.current
    let didRedirectToLogin = false

    if (inFlightGenerationRef.current !== null) {
      queuedRef.current = true
      return
    }

    inFlightGenerationRef.current = refreshGeneration
    setRefreshing(true)
    const startedAt = window.performance.now()

    try {
      const result = normalizeReadModelFetchResult(await input.fetchLatest())
      if (runGenerationRef.current !== refreshGeneration) {
        return
      }
      mergeReadModelData(result.data, {
        replace: result.replace,
      })
      reportScopedReadModelDiagnostic({
        durationMs: window.performance.now() - startedAt,
        scopeKeys,
        status: "success",
      })
      setError(null)
    } catch (nextError) {
      if (runGenerationRef.current !== refreshGeneration) {
        return
      }
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
        if (input.notFoundResult) {
          const missingResult = normalizeReadModelFetchResult(
            input.notFoundResult
          )
          mergeReadModelData(missingResult.data, {
            replace: missingResult.replace,
          })
        }
        setError(null)
      } else if (
        nextError instanceof RouteMutationError &&
        nextError.status === 401
      ) {
        didRedirectToLogin = true
        redirectToExpiredSessionLogin()
      } else {
        console.error("Failed to refresh scoped read model", nextError)
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to refresh scoped read model"
        )
      }
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

  useEffect(() => {
    const effectScopeKeys =
      scopeKeySignature.length > 0 ? scopeKeySignature.split("|") : []

    if (!scopedSyncEnabled) {
      runGenerationRef.current += 1
      inFlightGenerationRef.current = null
      queuedRef.current = false
      stopDegradedRefresh()
      setRefreshing(false)
      setError(null)
      setLoadedScopeKeySignature("")
      setHasLoadedOnce(true)
      return
    }

    if (!input.enabled || effectScopeKeys.length === 0) {
      runGenerationRef.current += 1
      inFlightGenerationRef.current = null
      queuedRef.current = false
      stopDegradedRefresh()
      setRefreshing(false)
      setError(null)
      setLoadedScopeKeySignature("")
      setHasLoadedOnce(false)
      return
    }

    runGenerationRef.current += 1
    stopDegradedRefresh()
    setHasLoadedOnce(false)
    void refresh()
    let hasSeenReady = false
    let hasEnteredDegradedMode = false

    const closeStream = openScopedInvalidationStream({
      scopeKeys: effectScopeKeys,
      onReady() {
        stopDegradedRefresh()

        if (hasSeenReady) {
          hasEnteredDegradedMode = false
          void refresh()
          return
        }

        hasSeenReady = true

        if (hasEnteredDegradedMode) {
          hasEnteredDegradedMode = false
          void refresh()
        }
      },
      onInvalidate() {
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

    const handleFocus = () => {
      void refresh()
    }
    const handleOnline = () => {
      void refresh()
    }

    window.addEventListener("focus", handleFocus)
    window.addEventListener("online", handleOnline)

    return () => {
      runGenerationRef.current += 1
      inFlightGenerationRef.current = null
      queuedRef.current = false
      stopDegradedRefresh()
      setRefreshing(false)
      closeStream()
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("online", handleOnline)
    }
  }, [input.enabled, scopeKeySignature, scopedSyncEnabled])

  return {
    error,
    hasLoadedOnce:
      !scopedSyncEnabled ||
      (hasLoadedOnce && loadedScopeKeySignature === activeScopeKeySignature),
    refreshing,
  }
}
