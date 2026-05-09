export function isProjectAvailableGroupKey(
  project: {
    scopeId: string
    scopeType: "personal" | "team" | "workspace"
  },
  context: {
    teamIds: Set<string>
    workspaceIds: Set<string>
  }
) {
  return (
    (project.scopeType === "team" && context.teamIds.has(project.scopeId)) ||
    (project.scopeType === "workspace" &&
      context.workspaceIds.has(project.scopeId))
  )
}
