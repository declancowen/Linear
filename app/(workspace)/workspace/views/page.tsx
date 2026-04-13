"use client"

import { ViewsScreen } from "@/components/app/screens"
import { getCurrentWorkspace } from "@/lib/domain/selectors"
import { useAppStore } from "@/lib/store/app-store"

export default function WorkspaceViewsPage() {
  const data = useAppStore()
  const workspace = getCurrentWorkspace(data)

  if (!workspace) {
    return null
  }

  return (
    <ViewsScreen
      scopeId={workspace.id}
      scopeType="workspace"
      title="Workspace views"
      description="Your personal workspace project and document views across the teams you belong to."
    />
  )
}
