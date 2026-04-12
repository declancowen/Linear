"use client"

import { DocsScreen } from "@/components/app/screens"
import { getCurrentWorkspace } from "@/lib/domain/selectors"
import { useAppStore } from "@/lib/store/app-store"

export default function WorkspaceDocsPage() {
  const data = useAppStore()
  const workspace = getCurrentWorkspace(data)

  if (!workspace) {
    return null
  }

  return (
    <DocsScreen
      scopeId={workspace.id}
      scopeType="workspace"
      title="Docs"
      description="Aggregate team-owned documents visible from the workspace."
    />
  )
}
