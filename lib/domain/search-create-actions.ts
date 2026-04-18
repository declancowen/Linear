import {
  getDefaultRootWorkItemTypesForTeamExperience,
  getDisplayLabelForWorkItemType,
  type Team,
  type WorkItemType,
} from "@/lib/domain/types"

type ScopeType = "team" | "workspace"

export type GlobalCreateAction =
  | {
      id: string
      kind: "workItem"
      title: string
      subtitle: string
      scopeLabel?: string | null
      icon?: string | null
      workItemType: WorkItemType
      defaultTeamId?: string | null
      keywords?: string[]
    }
  | {
      id: string
      kind: "project"
      title: string
      subtitle: string
      scopeLabel?: string | null
      icon?: string | null
      defaultTeamId?: string | null
      keywords?: string[]
    }
  | {
      id: string
      kind: "view"
      title: string
      subtitle: string
      scopeLabel?: string | null
      defaultScopeType?: ScopeType | null
      defaultScopeId?: string | null
      keywords?: string[]
    }

function orderTeamsForCreateActions(
  teams: Team[],
  activeTeamId?: string | null
) {
  return [
    ...(activeTeamId && teams.some((team) => team.id === activeTeamId)
      ? teams.filter((team) => team.id === activeTeamId)
      : []),
    ...teams.filter((team) => team.id !== activeTeamId),
  ]
}

export function buildGlobalCreateActions({
  activeTeamId,
  workItemCreateTeams,
  projectCreateTeams,
  viewTeams,
  workspaceViewOption,
}: {
  activeTeamId?: string | null
  workItemCreateTeams: Team[]
  projectCreateTeams: Team[]
  viewTeams: Team[]
  workspaceViewOption?: {
    id: string
    name: string
  } | null
}) {
  const actions: GlobalCreateAction[] = []
  const orderedWorkItemTeams = orderTeamsForCreateActions(
    workItemCreateTeams,
    activeTeamId
  )
  const orderedProjectTeams = orderTeamsForCreateActions(
    projectCreateTeams,
    activeTeamId
  )
  const orderedViewTeams = orderTeamsForCreateActions(viewTeams, activeTeamId)

  orderedWorkItemTeams.forEach((team) => {
    getDefaultRootWorkItemTypesForTeamExperience(team.settings.experience).forEach(
      (itemType) => {
        const label = getDisplayLabelForWorkItemType(
          itemType,
          team.settings.experience
        ).toLowerCase()

        actions.push({
          id: `create-${team.id}-${itemType}`,
          kind: "workItem",
          title: `Create ${label}`,
          subtitle: "Team space",
          scopeLabel: team.name,
          icon: team.icon,
          workItemType: itemType,
          defaultTeamId: team.id,
          keywords: [
            "create",
            "new",
            itemType,
            label,
            "team",
            "team space",
            team.name,
          ],
        })
      }
    )
  })

  orderedProjectTeams.forEach((team) => {
    actions.push({
      id: `create-project-${team.id}`,
      kind: "project",
      title: "Create project",
      subtitle: "Team space",
      scopeLabel: team.name,
      icon: team.icon,
      defaultTeamId: team.id,
      keywords: [
        "create",
        "new",
        "project",
        "team",
        "team space",
        team.name,
      ],
    })
  })

  if (workspaceViewOption) {
    actions.push({
      id: `create-view-workspace-${workspaceViewOption.id}`,
      kind: "view",
      title: "Create workspace view",
      subtitle: "Workspace view",
      scopeLabel: workspaceViewOption.name,
      defaultScopeType: "workspace",
      defaultScopeId: workspaceViewOption.id,
      keywords: [
        "create",
        "new",
        "view",
        "workspace",
        "workspace view",
        workspaceViewOption.name,
      ],
    })
  }

  orderedViewTeams.forEach((team) => {
    actions.push({
      id: `create-view-team-${team.id}`,
      kind: "view",
      title: "Create team view",
      subtitle: "Team space view",
      scopeLabel: team.name,
      defaultScopeType: "team",
      defaultScopeId: team.id,
      keywords: [
        "create",
        "new",
        "view",
        "team",
        "team view",
        "team space",
        team.name,
      ],
    })
  })

  return actions
}
