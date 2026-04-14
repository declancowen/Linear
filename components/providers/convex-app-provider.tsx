"use client"

import { useEffect, useEffectEvent } from "react"
import { useTheme } from "next-themes"

import {
  fetchSnapshot,
  fetchSnapshotVersion,
  RouteMutationError,
} from "@/lib/convex/client"
import { buildAuthPageHref, normalizeAuthNextPath } from "@/lib/auth-routing"
import type { AppSnapshot } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import type { AuthenticatedAppUser } from "@/lib/workos/auth"

type ConvexAppProviderProps = {
  children: React.ReactNode
  authenticatedUser?: AuthenticatedAppUser | null
}

const SNAPSHOT_POLL_INTERVAL_MS = 5000
const SNAPSHOT_POLL_MAX_BACKOFF_MS = 60000

function ConvexStateSync({
  children,
  authenticatedUser,
}: ConvexAppProviderProps) {
  const replaceDomainData = useAppStore((state) => state.replaceDomainData)
  const { setTheme } = useTheme()
  const applySnapshot = useEffectEvent((snapshot: AppSnapshot) => {
    replaceDomainData(snapshot)
    const currentUser = snapshot.users.find(
      (user) => user.id === snapshot.currentUserId
    )

    if (currentUser?.preferences.theme) {
      setTheme(currentUser.preferences.theme)
    }
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
    let consecutiveFailureCount = 0
    let pollTimeoutId: number | null = null
    let snapshotVersion: number | null = null

    function clearPollTimeout() {
      if (pollTimeoutId !== null) {
        window.clearTimeout(pollTimeoutId)
        pollTimeoutId = null
      }
    }

    function scheduleNextPoll(delay: number) {
      clearPollTimeout()

      if (cancelled) {
        return
      }

      pollTimeoutId = window.setTimeout(() => {
        if (document.visibilityState === "visible") {
          void syncSnapshot()
          return
        }

        scheduleNextPoll(SNAPSHOT_POLL_INTERVAL_MS)
      }, delay)
    }

    function getBackoffDelay() {
      if (consecutiveFailureCount <= 0) {
        return SNAPSHOT_POLL_INTERVAL_MS
      }

      return Math.min(
        SNAPSHOT_POLL_INTERVAL_MS * 2 ** (consecutiveFailureCount - 1),
        SNAPSHOT_POLL_MAX_BACKOFF_MS
      )
    }

    async function syncSnapshot(options?: { forceFull?: boolean }) {
      if (cancelled) {
        return
      }

      if (syncInFlight) {
        syncQueued = true
        return
      }

      clearPollTimeout()
      syncInFlight = true

      try {
        let nextSnapshotVersion = snapshotVersion

        if (!options?.forceFull) {
          const versionPayload = await fetchSnapshotVersion()

          if (!versionPayload || cancelled) {
            return
          }

          nextSnapshotVersion = versionPayload.version

          if (
            snapshotVersion !== null &&
            nextSnapshotVersion === snapshotVersion
          ) {
            consecutiveFailureCount = 0
            return
          }
        }

        const snapshot = await fetchSnapshot()

        if (!snapshot || cancelled) {
          return
        }

        consecutiveFailureCount = 0
        snapshotVersion =
          nextSnapshotVersion ??
          (await fetchSnapshotVersion())?.version ??
          snapshotVersion
        applySnapshot(snapshot)
      } catch (error) {
        if (error instanceof RouteMutationError && error.status === 401) {
          cancelled = true
          clearPollTimeout()
          redirectToLogin()
          return
        }

        consecutiveFailureCount += 1
        console.error("Failed to refresh app snapshot", error)
      } finally {
        syncInFlight = false

        if (syncQueued && !cancelled) {
          syncQueued = false
          void syncSnapshot()
          return
        }

        if (!cancelled) {
          scheduleNextPoll(getBackoffDelay())
        }
      }
    }

    void syncSnapshot({ forceFull: true })

    const handleFocus = () => {
      void syncSnapshot()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncSnapshot()
      }
    }
    const handleOnline = () => {
      consecutiveFailureCount = 0
      void syncSnapshot()
    }

    window.addEventListener("focus", handleFocus)
    window.addEventListener("online", handleOnline)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      cancelled = true
      clearPollTimeout()
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("online", handleOnline)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [authenticatedUser?.email])

  return <>{children}</>
}

export function ConvexAppProvider({
  children,
  authenticatedUser,
}: ConvexAppProviderProps) {
  return (
    <ConvexStateSync authenticatedUser={authenticatedUser}>
      {children}
    </ConvexStateSync>
  )
}
