"use client"

import { useEffect, useEffectEvent, useState } from "react"
import { useTheme } from "next-themes"

import { buildAuthPageHref, normalizeAuthNextPath } from "@/lib/auth-routing"
import {
  reportBootstrapModeDiagnostic,
  reportRealtimeFallbackDiagnostic,
  reportScopedReadModelDiagnostic,
  reportSnapshotApplyDiagnostic,
  reportSnapshotFetchDiagnostic,
  reportSnapshotStreamReconnectDiagnostic,
} from "@/lib/browser/snapshot-diagnostics"
import { resolveSnapshotThemePreference } from "@/lib/browser/theme-preference-sync"
import {
  fetchSnapshotState,
  fetchSnapshotVersion,
  RouteMutationError,
} from "@/lib/convex/client"
import { fetchWorkspaceMembershipReadModel } from "@/lib/convex/client/read-models"
import type { AppSnapshot } from "@/lib/domain/types"
import { shouldUseLegacySnapshotSync } from "@/lib/realtime/feature-flags"
import {
  createShellContextScopeKey,
  createWorkspaceMembershipScopeKey,
} from "@/lib/scoped-sync/scope-keys"
import { useAppStore } from "@/lib/store/app-store"
import type { AuthenticatedAppUser } from "@/lib/workos/auth"

type ConvexAppProviderProps = {
  children: React.ReactNode
  authenticatedUser?: AuthenticatedAppUser | null
  initialWorkspaceId: string
}

const STREAM_RECONNECT_BASE_DELAY_MS = 1000
const STREAM_RECONNECT_MAX_DELAY_MS = 15000
const INITIAL_BOOTSTRAP_RETRY_BASE_DELAY_MS = 2000
const INITIAL_BOOTSTRAP_RETRY_MAX_DELAY_MS = 15000
const LEGACY_SNAPSHOT_SYNC_ENABLED = shouldUseLegacySnapshotSync()

function ConvexStateSync({
  children,
  authenticatedUser,
  initialWorkspaceId,
}: ConvexAppProviderProps) {
  const replaceDomainData = useAppStore((state) => state.replaceDomainData)
  const mergeReadModelData = useAppStore((state) => state.mergeReadModelData)
  const currentWorkspaceId = useAppStore((state) => state.currentWorkspaceId)
  const { setTheme } = useTheme()
  const [ready, setReady] = useState(false)
  const bootstrapWorkspaceId = currentWorkspaceId || initialWorkspaceId
  const applyThemeFromSnapshotData = useEffectEvent(
    (data: Partial<AppSnapshot>) => {
      const currentUserId = data.currentUserId ?? null
      const currentUser =
        currentUserId && data.users
          ? data.users.find((user) => user.id === currentUserId) ?? null
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
  const applyReadModelData = useEffectEvent((data: Partial<AppSnapshot>) => {
    mergeReadModelData(data)
    applyThemeFromSnapshotData(data)
  })
  const redirectToLogin = useEffectEvent(() => {
    const nextPath = normalizeAuthNextPath(
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    )

    window.location.assign(
      buildAuthPageHref("login", {
        nextPath,
        notice: "Your session expired. Sign in again to continue.",
      })
    )
  })

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
    let syncMode: "scoped" | "legacy" = LEGACY_SNAPSHOT_SYNC_ENABLED
      ? "legacy"
      : "scoped"

    reportBootstrapModeDiagnostic(
      syncMode === "legacy"
        ? "legacy-snapshot-stream"
        : "scoped-membership-bootstrap"
    )

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
      setReady(true)
      return true
    }

    async function syncScopedBootstrap() {
      if (!bootstrapWorkspaceId) {
        setReady(true)
        return true
      }

      const scopeKeys = [
        createShellContextScopeKey(),
        createWorkspaceMembershipScopeKey(bootstrapWorkspaceId),
      ]
      const startedAt = window.performance.now()

      try {
        const patch = await fetchWorkspaceMembershipReadModel(
          bootstrapWorkspaceId
        )

        if (cancelled) {
          return true
        }

        reportScopedReadModelDiagnostic({
          durationMs: window.performance.now() - startedAt,
          scopeKeys,
          status: "success",
        })
        applyReadModelData(patch.data)
        hasLoadedInitialState = true
        bootstrapRetryDelay = INITIAL_BOOTSTRAP_RETRY_BASE_DELAY_MS
        clearBootstrapRetryTimeout()
        setReady(true)
        return true
      } catch (error) {
        reportScopedReadModelDiagnostic({
          durationMs: window.performance.now() - startedAt,
          scopeKeys,
          status: "failure",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Failed to refresh scoped bootstrap read model",
        })
        throw error
      }
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
        if (syncMode === "scoped") {
          await syncScopedBootstrap()
        } else {
          await syncSnapshotState()
        }
      } catch (error) {
        if (error instanceof RouteMutationError && error.status === 401) {
          cancelled = true
          closeStream()
          redirectToLogin()
          return
        }

        if (syncMode === "scoped") {
          reportRealtimeFallbackDiagnostic({
            reason: "scoped-bootstrap-refresh-failed",
            target: "legacy-snapshot-sync",
          })
          syncMode = "legacy"
          reportBootstrapModeDiagnostic("legacy-snapshot-fallback")

          try {
            await syncSnapshotState()
          } catch (fallbackError) {
            if (
              fallbackError instanceof RouteMutationError &&
              fallbackError.status === 401
            ) {
              cancelled = true
              closeStream()
              redirectToLogin()
              return
            }

            console.error(
              "Failed to refresh scoped bootstrap read model and legacy snapshot fallback",
              fallbackError
            )
            scheduleBootstrapRetry()
          }
        } else {
          console.error("Failed to refresh app snapshot", error)
          scheduleBootstrapRetry()
        }
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

      if (
        cancelled ||
        syncMode !== "legacy" ||
        document.visibilityState !== "visible"
      ) {
        return
      }

      streamReconnectTimeoutId = window.setTimeout(() => {
        if (
          !cancelled &&
          syncMode === "legacy" &&
          document.visibilityState === "visible"
        ) {
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

      if (
        cancelled ||
        syncMode !== "legacy" ||
        document.visibilityState !== "visible"
      ) {
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
      if (!cancelled && syncMode === "legacy") {
        openStream()
      }
    })

    const handleFocus = () => {
      void syncState()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncState()

        if (syncMode === "legacy") {
          openStream()
        }

        return
      }

      clearBootstrapRetryTimeout()
      closeStream()
    }
    const handleOnline = () => {
      void syncState()

      if (syncMode === "legacy") {
        openStream()
      }
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
  }, [authenticatedUser?.email, bootstrapWorkspaceId])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading workspace...
      </div>
    )
  }

  return <>{children}</>
}

export function ConvexAppProvider({
  children,
  authenticatedUser,
  initialWorkspaceId,
}: ConvexAppProviderProps) {
  return (
    <ConvexStateSync
      authenticatedUser={authenticatedUser}
      initialWorkspaceId={initialWorkspaceId}
    >
      {children}
    </ConvexStateSync>
  )
}
