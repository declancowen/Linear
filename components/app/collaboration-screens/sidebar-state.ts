"use client"

import { useCallback, useState, type SetStateAction } from "react"

import { getViewerScopedDirectoryKey } from "@/lib/domain/viewer-view-config"
import { useAppStore } from "@/lib/store/app-store"

export function createCollaborationSidebarSurfaceKey(
  kind: string,
  id: string | null | undefined
) {
  return id ? `collaboration:${kind}:${id}` : null
}

export function usePersistedCollaborationSidebarState(
  surfaceKey: string | null | undefined
) {
  const currentUserId = useAppStore((state) => state.currentUserId)
  const storageKey = surfaceKey
    ? getViewerScopedDirectoryKey(currentUserId, surfaceKey)
    : null
  const sidebarOpen = useAppStore((state) =>
    storageKey
      ? (state.ui.collaborationSidebarOpenBySurface[storageKey] ?? true)
      : true
  )
  const setCollaborationSidebarOpen = useAppStore(
    (state) => state.setCollaborationSidebarOpen
  )
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const setSidebarOpen = useCallback(
    (nextOpen: SetStateAction<boolean>) => {
      if (!surfaceKey) {
        return
      }

      setCollaborationSidebarOpen(
        surfaceKey,
        typeof nextOpen === "function" ? nextOpen(sidebarOpen) : nextOpen
      )
    },
    [setCollaborationSidebarOpen, sidebarOpen, surfaceKey]
  )

  return {
    mobileSidebarOpen,
    setMobileSidebarOpen,
    setSidebarOpen,
    sidebarOpen,
  }
}
