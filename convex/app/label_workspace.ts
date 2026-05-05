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

export type LabelWorkspaceInferenceInput = {
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
}

function addLabelIdsForWorkspace(input: {
  labelIds: string[]
  labelWorkspaceIds: Map<string, Set<string>>
  workspaceId: string | null | undefined
}) {
  for (const labelId of input.labelIds) {
    addInferredLabelWorkspaceId(
      input.labelWorkspaceIds,
      labelId,
      input.workspaceId
    )
  }
}

function inferWorkItemLabelWorkspaceIds(
  input: Pick<LabelWorkspaceInferenceInput, "workItems"> & {
    labelWorkspaceIds: Map<string, Set<string>>
    teamWorkspaceIdByTeamId: Map<string, string>
  }
) {
  for (const workItem of input.workItems) {
    addLabelIdsForWorkspace({
      labelIds: workItem.labelIds,
      labelWorkspaceIds: input.labelWorkspaceIds,
      workspaceId: input.teamWorkspaceIdByTeamId.get(workItem.teamId),
    })
  }
}

function getViewLabelWorkspaceIds(
  view: LabelWorkspaceInferenceInput["views"][number],
  teamWorkspaceIdByTeamId: Map<string, string>
) {
  if (view.scopeType === "workspace") {
    return [view.scopeId]
  }

  if (view.scopeType === "team") {
    return [teamWorkspaceIdByTeamId.get(view.scopeId) ?? ""].filter(Boolean)
  }

  return [
    ...new Set(
      view.filters.teamIds
        .map((teamId) => teamWorkspaceIdByTeamId.get(teamId) ?? "")
        .filter(Boolean)
    ),
  ]
}

function inferViewLabelWorkspaceIds(
  input: Pick<LabelWorkspaceInferenceInput, "views"> & {
    labelWorkspaceIds: Map<string, Set<string>>
    teamWorkspaceIdByTeamId: Map<string, string>
  }
) {
  for (const view of input.views) {
    const workspaceIds = getViewLabelWorkspaceIds(
      view,
      input.teamWorkspaceIdByTeamId
    )

    if (workspaceIds.length !== 1) {
      continue
    }

    addLabelIdsForWorkspace({
      labelIds: view.filters.labelIds,
      labelWorkspaceIds: input.labelWorkspaceIds,
      workspaceId: workspaceIds[0],
    })
  }
}

function inferProjectLabelWorkspaceIds(
  input: Pick<LabelWorkspaceInferenceInput, "projects"> & {
    labelWorkspaceIds: Map<string, Set<string>>
    teamWorkspaceIdByTeamId: Map<string, string>
  }
) {
  for (const project of input.projects) {
    const workspaceId =
      project.scopeType === "workspace"
        ? project.scopeId
        : input.teamWorkspaceIdByTeamId.get(project.scopeId)

    addLabelIdsForWorkspace({
      labelIds: project.presentation?.filters.labelIds ?? [],
      labelWorkspaceIds: input.labelWorkspaceIds,
      workspaceId,
    })
  }
}

export function inferLabelWorkspaceIds(input: LabelWorkspaceInferenceInput) {
  const teamWorkspaceIdByTeamId = new Map(
    input.teams.map((team) => [team.id, team.workspaceId])
  )
  const labelWorkspaceIds = new Map<string, Set<string>>()

  inferWorkItemLabelWorkspaceIds({
    workItems: input.workItems,
    labelWorkspaceIds,
    teamWorkspaceIdByTeamId,
  })
  inferViewLabelWorkspaceIds({
    views: input.views,
    labelWorkspaceIds,
    teamWorkspaceIdByTeamId,
  })
  inferProjectLabelWorkspaceIds({
    projects: input.projects,
    labelWorkspaceIds,
    teamWorkspaceIdByTeamId,
  })

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
