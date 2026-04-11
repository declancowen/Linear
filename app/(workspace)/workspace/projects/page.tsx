"use client"

import { ProjectsScreen } from "@/components/app/screens"
import { getCurrentWorkspace } from "@/lib/domain/selectors"
import { useAppStore } from "@/lib/store/app-store"

export default function WorkspaceProjectsPage() {
  const data = useAppStore()
  const workspace = getCurrentWorkspace(data)

  if (!workspace) {
    return null
  }

  return (
    <ProjectsScreen
      scopeId={workspace.id}
      scopeType="workspace"
      title="Workspace projects"
      description="Projects created at the workspace layer plus aggregate visibility across joined teams."
    />
  )
}
