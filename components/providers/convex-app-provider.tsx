"use client"

import { useEffect, useEffectEvent } from "react"
import { useTheme } from "next-themes"

import {
  fetchSnapshotState,
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

const STREAM_RECONNECT_BASE_DELAY_MS = 1000
const STREAM_RECONNECT_MAX_DELAY_MS = 15000

function ConvexStateSync({
  children,
  authenticatedUser,
}: ConvexAppProviderProps) {
  const replaceDomainData = useAppStore((state) => state.replaceDomainData)
  const { setTheme } = useTheme()
  const applySnapshot = useEffectEvent((snapshot: AppSnapshot) => {
    replaceDomainData(snapshot)
    const currentUser = (snapshot.users ?? []).find(
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
    let stream: EventSource | null = null
    let streamReconnectDelay = STREAM_RECONNECT_BASE_DELAY_MS
    let streamReconnectTimeoutId: number | null = null
    let appliedSnapshotVersion: number | null = null

    function clearStreamReconnectTimeout() {
      if (streamReconnectTimeoutId !== null) {
        window.clearTimeout(streamReconnectTimeoutId)
        streamReconnectTimeoutId = null
      }
    }

    function closeStream() {
      clearStreamReconnectTimeout()

      if (stream) {
        stream.close()
        stream = null
      }
    }

    async function syncSnapshot() {
      if (cancelled) {
        return
      }

      if (syncInFlight) {
        syncQueued = true
        return
      }

      syncInFlight = true

      try {
        const snapshotState = await fetchSnapshotState()

        if (!snapshotState || cancelled) {
          return
        }

        applySnapshot(snapshotState.snapshot)
        appliedSnapshotVersion = snapshotState.version
      } catch (error) {
        if (error instanceof RouteMutationError && error.status === 401) {
          cancelled = true
          closeStream()
          redirectToLogin()
          return
        }

        console.error("Failed to refresh app snapshot", error)
      } finally {
        syncInFlight = false

        if (syncQueued && !cancelled) {
          syncQueued = false
          void syncSnapshot()
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

      void syncSnapshot()
    }

    function openStream() {
      closeStream()

      if (cancelled || document.visibilityState !== "visible") {
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

    void syncSnapshot().then(() => {
      if (!cancelled) {
        openStream()
      }
    })

    const handleFocus = () => {
      void syncSnapshot()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncSnapshot()
        openStream()
        return
      }

      closeStream()
    }
    const handleOnline = () => {
      void syncSnapshot()
      openStream()
    }

    window.addEventListener("focus", handleFocus)
    window.addEventListener("online", handleOnline)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      cancelled = true
      closeStream()
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
