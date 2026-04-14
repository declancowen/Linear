"use client"

import { ProjectsScreen } from "@/components/app/screens"
import { getCurrentWorkspace } from "@/lib/domain/selectors"
import { useAppStore } from "@/lib/store/app-store"

export default function WorkspaceProjectsPage() {
  const data = useAppStore()
  const workspace = getCurrentWorkspace(data)

  if (!workspace) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">
        Loading workspace projects...
      </div>
    )
  }

  return (
    <ProjectsScreen
      scopeId={workspace.id}
      scopeType="workspace"
      title="Workspace projects"
      description="Projects across the teams you belong to, aggregated into a single workspace view."
    />
  )
}
