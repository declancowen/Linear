"use client"

import { useEffect, useEffectEvent, useLayoutEffect, useRef } from "react"
import { useTheme } from "next-themes"

import {
  reportBootstrapModeDiagnostic,
  reportSnapshotApplyDiagnostic,
  reportSnapshotFetchDiagnostic,
  reportSnapshotStreamReconnectDiagnostic,
} from "@/lib/browser/snapshot-diagnostics"
import { redirectToExpiredSessionLogin } from "@/lib/browser/session-redirect"
import { resolveSnapshotThemePreference } from "@/lib/browser/theme-preference-sync"
import {
  fetchSnapshotState,
  fetchSnapshotVersion,
  RouteMutationError,
} from "@/lib/convex/client"
import type { ReadModelFetchResult } from "@/lib/convex/client/read-models"
import type { AppSnapshot } from "@/lib/domain/types"
import { shouldUseLegacySnapshotSync } from "@/lib/realtime/feature-flags"
import { useAppStore } from "@/lib/store/app-store"
import type { AuthenticatedAppUser } from "@/lib/workos/auth"

type ConvexAppProviderProps = {
  children: React.ReactNode
  authenticatedUser?: AuthenticatedAppUser | null
  initialShellSeed: ReadModelFetchResult<Partial<AppSnapshot>>
  initialWorkspaceId: string
}

const STREAM_RECONNECT_BASE_DELAY_MS = 1000
const STREAM_RECONNECT_MAX_DELAY_MS = 15000
const INITIAL_BOOTSTRAP_RETRY_BASE_DELAY_MS = 2000
const INITIAL_BOOTSTRAP_RETRY_MAX_DELAY_MS = 15000

function getInitialShellSeedSignature(
  initialShellSeed: ReadModelFetchResult<Partial<AppSnapshot>>,
  initialWorkspaceId: string
) {
  return JSON.stringify({
    initialWorkspaceId,
    currentUserId: initialShellSeed.data.currentUserId ?? "",
    currentWorkspaceId:
      initialShellSeed.data.currentWorkspaceId ?? initialWorkspaceId,
    replace: initialShellSeed.replace ?? [],
    data: initialShellSeed.data,
  })
}

function ConvexStateSync({
  children,
  authenticatedUser,
  initialShellSeed,
  initialWorkspaceId,
}: ConvexAppProviderProps) {
  const replaceDomainData = useAppStore((state) => state.replaceDomainData)
  const mergeReadModelData = useAppStore((state) => state.mergeReadModelData)
  const { setTheme } = useTheme()
  const applyThemeFromSnapshotData = useEffectEvent(
    (data: Partial<AppSnapshot>) => {
      const currentUserId = data.currentUserId ?? null
      const currentUser =
        currentUserId && data.users
          ? (data.users.find((user) => user.id === currentUserId) ?? null)
          : null

      if (currentUser?.preferences.theme) {
        const nextThemePreference = resolveSnapshotThemePreference(
          currentUser.preferences.theme
        )

        if (nextThemePreference) {
          setTheme(nextThemePreference)
        }
      }
    }
  )
  const applySnapshotData = useEffectEvent((data: AppSnapshot) => {
    replaceDomainData(data)
    applyThemeFromSnapshotData(data)
  })
  const applyReadModelData = useEffectEvent(
    (patch: ReadModelFetchResult<Partial<AppSnapshot>>) => {
      mergeReadModelData(patch.data, {
        replace: patch.replace,
      })
      applyThemeFromSnapshotData(patch.data)
    }
  )
  const redirectToLogin = useEffectEvent(() => {
    redirectToExpiredSessionLogin()
  })
  const appliedSeedSignatureRef = useRef("")
  const seedSignature = getInitialShellSeedSignature(
    initialShellSeed,
    initialWorkspaceId
  )

  useLayoutEffect(() => {
    if (appliedSeedSignatureRef.current === seedSignature) {
      return
    }

    applyReadModelData(initialShellSeed)
    appliedSeedSignatureRef.current = seedSignature
  }, [initialShellSeed, seedSignature])

  useEffect(() => {
    let cancelled = false
    let syncInFlight = false
    let syncQueued = false
    let stream: EventSource | null = null
    let streamReconnectDelay = STREAM_RECONNECT_BASE_DELAY_MS
    let streamReconnectTimeoutId: number | null = null
    let bootstrapRetryDelay = INITIAL_BOOTSTRAP_RETRY_BASE_DELAY_MS
    let bootstrapRetryTimeoutId: number | null = null
    let appliedSnapshotVersion: number | null = null
    let hasLoadedInitialState = false

    if (!shouldUseLegacySnapshotSync()) {
      reportBootstrapModeDiagnostic("server-seeded-shell")
      return () => {
        cancelled = true
      }
    }

    reportBootstrapModeDiagnostic("legacy-snapshot-stream")

    function clearStreamReconnectTimeout() {
      if (streamReconnectTimeoutId !== null) {
        window.clearTimeout(streamReconnectTimeoutId)
        streamReconnectTimeoutId = null
      }
    }

    function clearBootstrapRetryTimeout() {
      if (bootstrapRetryTimeoutId !== null) {
        window.clearTimeout(bootstrapRetryTimeoutId)
        bootstrapRetryTimeoutId = null
      }
    }

    function closeStream() {
      clearStreamReconnectTimeout()

      if (stream) {
        stream.close()
        stream = null
      }
    }

    function scheduleBootstrapRetry() {
      clearBootstrapRetryTimeout()

      if (
        cancelled ||
        hasLoadedInitialState ||
        document.visibilityState !== "visible"
      ) {
        return
      }

      bootstrapRetryTimeoutId = window.setTimeout(() => {
        if (!cancelled && !hasLoadedInitialState) {
          void syncState()
        }
      }, bootstrapRetryDelay)

      bootstrapRetryDelay = Math.min(
        bootstrapRetryDelay * 2,
        INITIAL_BOOTSTRAP_RETRY_MAX_DELAY_MS
      )
    }

    async function syncSnapshotState() {
      const fetchStartedAt = window.performance.now()
      const snapshotState = await fetchSnapshotState()
      const fetchDurationMs = window.performance.now() - fetchStartedAt

      if (cancelled) {
        return true
      }

      reportSnapshotFetchDiagnostic({
        durationMs: fetchDurationMs,
        version: snapshotState.version,
        snapshot: snapshotState.snapshot,
      })

      const applyStartedAt = window.performance.now()
      applySnapshotData(snapshotState.snapshot)
      reportSnapshotApplyDiagnostic({
        durationMs: window.performance.now() - applyStartedAt,
        version: snapshotState.version,
      })
      appliedSnapshotVersion = snapshotState.version
      hasLoadedInitialState = true
      bootstrapRetryDelay = INITIAL_BOOTSTRAP_RETRY_BASE_DELAY_MS
      clearBootstrapRetryTimeout()
      return true
    }

    async function syncState() {
      if (cancelled) {
        return
      }

      if (syncInFlight) {
        syncQueued = true
        return
      }

      syncInFlight = true

      try {
        await syncSnapshotState()
      } catch (error) {
        if (error instanceof RouteMutationError && error.status === 401) {
          cancelled = true
          closeStream()
          redirectToLogin()
          return
        }

        console.error("Failed to refresh app snapshot", error)
        scheduleBootstrapRetry()
      } finally {
        syncInFlight = false

        if (syncQueued && !cancelled) {
          syncQueued = false
          void syncState()
        }
      }
    }

    async function probeStreamSession() {
      try {
        await fetchSnapshotVersion()
      } catch (error) {
        if (error instanceof RouteMutationError && error.status === 401) {
          cancelled = true
          closeStream()
          redirectToLogin()
        }
      }
    }

    function scheduleStreamReconnect() {
      clearStreamReconnectTimeout()

      if (cancelled || document.visibilityState !== "visible") {
        return
      }

      streamReconnectTimeoutId = window.setTimeout(() => {
        if (!cancelled && document.visibilityState === "visible") {
          openStream()
        }
      }, streamReconnectDelay)
      reportSnapshotStreamReconnectDiagnostic(streamReconnectDelay)

      streamReconnectDelay = Math.min(
        streamReconnectDelay * 2,
        STREAM_RECONNECT_MAX_DELAY_MS
      )
    }

    function handleSnapshotVersion(version: number) {
      if (
        appliedSnapshotVersion !== null &&
        version <= appliedSnapshotVersion
      ) {
        return
      }

      void syncState()
    }

    function openStream() {
      closeStream()

      if (cancelled || document.visibilityState !== "visible") {
        return
      }

      if (typeof EventSource !== "function") {
        return
      }

      const nextStream = new EventSource("/api/snapshot/events")
      stream = nextStream

      const handleVersionEvent = (event: MessageEvent<string>) => {
        if (stream !== nextStream) {
          return
        }

        streamReconnectDelay = STREAM_RECONNECT_BASE_DELAY_MS

        try {
          const payload = JSON.parse(event.data) as {
            version?: number
          }

          if (typeof payload.version === "number") {
            handleSnapshotVersion(payload.version)
          }
        } catch (error) {
          console.error("Failed to parse snapshot stream event", error)
        }
      }

      nextStream.addEventListener("ready", handleVersionEvent)
      nextStream.addEventListener("snapshot", handleVersionEvent)
      nextStream.onerror = () => {
        if (stream !== nextStream) {
          return
        }

        closeStream()
        void probeStreamSession()
        scheduleStreamReconnect()
      }
    }

    void syncState().then(() => {
      if (!cancelled) {
        openStream()
      }
    })

    const handleFocus = () => {
      void syncState()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncState()
        openStream()
        return
      }

      clearBootstrapRetryTimeout()
      closeStream()
    }
    const handleOnline = () => {
      void syncState()
      openStream()
    }

    window.addEventListener("focus", handleFocus)
    window.addEventListener("online", handleOnline)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      cancelled = true
      clearBootstrapRetryTimeout()
      closeStream()
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("online", handleOnline)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [authenticatedUser?.email, initialWorkspaceId])

  return <>{children}</>
}

export function ConvexAppProvider({
  children,
  authenticatedUser,
  initialShellSeed,
  initialWorkspaceId,
}: ConvexAppProviderProps) {
  return (
    <ConvexStateSync
      authenticatedUser={authenticatedUser}
      initialShellSeed={initialShellSeed}
      initialWorkspaceId={initialWorkspaceId}
    >
      {children}
    </ConvexStateSync>
  )
}
