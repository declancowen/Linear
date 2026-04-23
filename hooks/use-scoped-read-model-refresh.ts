"use client"

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react"

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
}

function normalizeScopeKeys(scopeKeys: string[]) {
  return [...new Set(scopeKeys.map((scopeKey) => scopeKey.trim()).filter(Boolean))].sort()
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
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const inFlightRef = useRef(false)
  const queuedRef = useRef(false)
  const runGenerationRef = useRef(0)
  const scopedSyncEnabled = isScopedSyncEnabled()
  const scopeKeySignature = normalizeScopeKeys(input.scopeKeys).join("|")
  const scopeKeys = useMemo(
    () => (scopeKeySignature.length > 0 ? scopeKeySignature.split("|") : []),
    [scopeKeySignature]
  )

  const refresh = useEffectEvent(async () => {
    const refreshGeneration = runGenerationRef.current

    if (inFlightRef.current) {
      queuedRef.current = true
      return
    }

    inFlightRef.current = true
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
        setError(null)
      } else {
        console.error("Failed to refresh scoped read model", nextError)
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to refresh scoped read model"
        )
      }
    } finally {
      inFlightRef.current = false
      if (runGenerationRef.current === refreshGeneration) {
        setHasLoadedOnce(true)
        setRefreshing(false)
      }

      if (queuedRef.current) {
        queuedRef.current = false
        void refresh()
      }
    }
  })

  useEffect(() => {
    if (!scopedSyncEnabled) {
      runGenerationRef.current += 1
      inFlightRef.current = false
      queuedRef.current = false
      setRefreshing(false)
      setError(null)
      setHasLoadedOnce(true)
      return
    }

    if (!input.enabled || scopeKeys.length === 0) {
      runGenerationRef.current += 1
      inFlightRef.current = false
      queuedRef.current = false
      setRefreshing(false)
      setError(null)
      setHasLoadedOnce(false)
      return
    }

    runGenerationRef.current += 1
    setHasLoadedOnce(false)
    void refresh()
    let hasSeenReady = false

    const closeStream = openScopedInvalidationStream({
      scopeKeys,
      onReady() {
        if (hasSeenReady) {
          void refresh()
          return
        }

        hasSeenReady = true
      },
      onInvalidate() {
        void refresh()
      },
      onError() {
        // The scoped SSE route intentionally rolls connections periodically.
        // Refresh failures are surfaced by `fetchLatest`; routine reconnects are not actionable.
        reportScopedStreamReconnectDiagnostic(scopeKeys)
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
      inFlightRef.current = false
      queuedRef.current = false
      setRefreshing(false)
      closeStream()
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("online", handleOnline)
    }
  }, [input.enabled, scopeKeySignature, scopedSyncEnabled])

  return {
    error,
    hasLoadedOnce,
    refreshing,
  }
}
