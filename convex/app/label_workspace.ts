function addInferredLabelWorkspaceId(
  labelWorkspaceIds: Map<string, Set<string>>,
  labelId: string,
  workspaceId: string | null | undefined
) {
  if (!workspaceId) {
    return
  }

  const existingWorkspaceIds =
    labelWorkspaceIds.get(labelId) ?? new Set<string>()
  existingWorkspaceIds.add(workspaceId)
  labelWorkspaceIds.set(labelId, existingWorkspaceIds)
}

export function inferLabelWorkspaceIds(input: {
  teams: Array<{ id: string; workspaceId: string }>
  workItems: Array<{ teamId: string; labelIds: string[] }>
  views: Array<{
    scopeType: "personal" | "team" | "workspace"
    scopeId: string
    filters: {
      labelIds: string[]
      teamIds: string[]
    }
  }>
  projects: Array<{
    scopeType: "team" | "workspace"
    scopeId: string
    presentation?: {
      filters: {
        labelIds: string[]
      }
    }
  }>
}) {
  const teamWorkspaceIdByTeamId = new Map(
    input.teams.map((team) => [team.id, team.workspaceId])
  )
  const labelWorkspaceIds = new Map<string, Set<string>>()

  for (const workItem of input.workItems) {
    const workspaceId = teamWorkspaceIdByTeamId.get(workItem.teamId) ?? null

    for (const labelId of workItem.labelIds) {
      addInferredLabelWorkspaceId(labelWorkspaceIds, labelId, workspaceId)
    }
  }

  for (const view of input.views) {
    let workspaceIds: string[] = []

    if (view.scopeType === "workspace") {
      workspaceIds = [view.scopeId]
    } else if (view.scopeType === "team") {
      workspaceIds = [teamWorkspaceIdByTeamId.get(view.scopeId) ?? ""].filter(
        Boolean
      )
    } else {
      workspaceIds = [
        ...new Set(
          view.filters.teamIds
            .map((teamId) => teamWorkspaceIdByTeamId.get(teamId) ?? "")
            .filter(Boolean)
        ),
      ]
    }

    if (workspaceIds.length !== 1) {
      continue
    }

    for (const labelId of view.filters.labelIds) {
      addInferredLabelWorkspaceId(labelWorkspaceIds, labelId, workspaceIds[0])
    }
  }

  for (const project of input.projects) {
    const workspaceId =
      project.scopeType === "workspace"
        ? project.scopeId
        : (teamWorkspaceIdByTeamId.get(project.scopeId) ?? null)

    for (const labelId of project.presentation?.filters.labelIds ?? []) {
      addInferredLabelWorkspaceId(labelWorkspaceIds, labelId, workspaceId)
    }
  }

  return labelWorkspaceIds
}

export function getUniqueLabelWorkspaceId(
  workspaceIds: Set<string> | null | undefined
) {
  if (!workspaceIds || workspaceIds.size !== 1) {
    return null
  }

  return [...workspaceIds][0] ?? null
}
