"use client"

import { useEffect } from "react"
import { ConvexProvider, useQuery } from "convex/react"
import { useTheme } from "next-themes"

import { api } from "@/convex/_generated/api"
import { convexReactClient } from "@/lib/convex/client"
import { useAppStore } from "@/lib/store/app-store"
import type { AuthenticatedAppUser } from "@/lib/workos/auth"

type ConvexAppProviderProps = {
  children: React.ReactNode
  authenticatedUser?: AuthenticatedAppUser | null
}

function ConvexStateSync({
  children,
  authenticatedUser,
}: ConvexAppProviderProps) {
  const replaceDomainData = useAppStore((state) => state.replaceDomainData)
  const { setTheme } = useTheme()
  const snapshot = useQuery(
    api.app.getSnapshot,
    { email: authenticatedUser?.email }
  )

  useEffect(() => {
    if (!snapshot) {
      return
    }

    replaceDomainData(snapshot)
  }, [replaceDomainData, snapshot])

  useEffect(() => {
    if (!snapshot) {
      return
    }

    const currentUser = snapshot.users.find(
      (user) => user.id === snapshot.currentUserId
    )

    if (currentUser?.preferences.theme) {
      setTheme(currentUser.preferences.theme)
    }
  }, [setTheme, snapshot])

  return <>{children}</>
}

export function ConvexAppProvider({
  children,
  authenticatedUser,
}: ConvexAppProviderProps) {
  if (!convexReactClient) {
    return <>{children}</>
  }

  return (
    <ConvexProvider client={convexReactClient}>
      <ConvexStateSync authenticatedUser={authenticatedUser}>
        {children}
      </ConvexStateSync>
    </ConvexProvider>
  )
}
