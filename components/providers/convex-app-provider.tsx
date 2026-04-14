"use client"

import { useEffect, useEffectEvent } from "react"
import { useTheme } from "next-themes"

import { fetchSnapshot } from "@/lib/convex/client"
import type { AppSnapshot } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import type { AuthenticatedAppUser } from "@/lib/workos/auth"

type ConvexAppProviderProps = {
  children: React.ReactNode
  authenticatedUser?: AuthenticatedAppUser | null
}

const SNAPSHOT_POLL_INTERVAL_MS = 5000

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

  useEffect(() => {
    let cancelled = false
    let syncInFlight = false
    let syncQueued = false

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
        const snapshot = await fetchSnapshot()

        if (!snapshot || cancelled) {
          return
        }

        applySnapshot(snapshot)
      } catch (error) {
        console.error("Failed to refresh app snapshot", error)
      } finally {
        syncInFlight = false

        if (syncQueued && !cancelled) {
          syncQueued = false
          void syncSnapshot()
        }
      }
    }

    void syncSnapshot()

    const handleFocus = () => {
      void syncSnapshot()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncSnapshot()
      }
    }
    const handleOnline = () => {
      void syncSnapshot()
    }
    const pollIntervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void syncSnapshot()
      }
    }, SNAPSHOT_POLL_INTERVAL_MS)

    window.addEventListener("focus", handleFocus)
    window.addEventListener("online", handleOnline)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      cancelled = true
      window.clearInterval(pollIntervalId)
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
