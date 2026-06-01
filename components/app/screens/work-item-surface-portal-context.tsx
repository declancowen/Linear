"use client"

import { createContext, useContext } from "react"

export const WorkItemSurfacePortalContainerContext =
  createContext<HTMLElement | null>(null)

export function useWorkItemSurfacePortalContainer() {
  return useContext(WorkItemSurfacePortalContainerContext)
}
