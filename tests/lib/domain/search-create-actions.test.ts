import { describe, expect, it } from "vitest"

import { buildGlobalCreateActions } from "@/lib/domain/search-create-actions"
import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
  type Team,
} from "@/lib/domain/types"

function createTeam(
  id: string,
  name: string,
  experience: Team["settings"]["experience"]
): Team {
  const icon =
    experience === "project-management"
      ? "kanban"
      : experience === "issue-analysis"
        ? "qa"
        : "code"

  return {
    id,
    workspaceId: "workspace_1",
    slug: id,
    name,
    icon,
    settings: {
      joinCode: `${id}-join`,
      summary: "",
      guestProjectIds: [],
      guestDocumentIds: [],
      guestWorkItemIds: [],
      experience,
      features: createDefaultTeamFeatureSettings(experience),
      workflow: createDefaultTeamWorkflowSettings(experience),
    },
  }
}

describe("buildGlobalCreateActions", () => {
  it("builds team-aware create actions with the active team first", () => {
    const platformTeam = createTeam(
      "team_platform",
      "Platform",
      "software-development"
    )
    const opsTeam = createTeam("team_ops", "Ops", "project-management")

    const actions = buildGlobalCreateActions({
      activeTeamId: opsTeam.id,
      workItemCreateTeams: [platformTeam, opsTeam],
      projectCreateTeams: [platformTeam, opsTeam],
      viewTeams: [platformTeam, opsTeam],
      workspaceViewOption: {
        id: "workspace_1",
        name: "Acme",
      },
    })

    const workItemActions = actions.filter(
      (action) => action.kind === "workItem"
    )
    const projectActions = actions.filter((action) => action.kind === "project")
    const viewActions = actions.filter((action) => action.kind === "view")

    expect(workItemActions[0]).toMatchObject({
      title: "Create task",
      defaultTeamId: "team_ops",
      scopeLabel: "Ops",
      icon: "kanban",
    })
    expect(
      workItemActions.some(
        (action) =>
          action.kind === "workItem" &&
          action.workItemType === "epic" &&
          action.defaultTeamId === "team_platform" &&
          action.scopeLabel === "Platform" &&
          action.icon === "code"
      )
    ).toBe(true)

    expect(
      projectActions.map((action) => ({
        teamId: action.defaultTeamId,
        icon: action.icon,
      }))
    ).toEqual([
      { teamId: "team_ops", icon: "kanban" },
      { teamId: "team_platform", icon: "code" },
    ])

    expect(viewActions.map((action) => action.id)).toEqual([
      "create-view-workspace-workspace_1",
      "create-view-team-team_ops",
      "create-view-team-team_platform",
    ])
  })

  it("omits workspace view actions when workspace scope is not editable", () => {
    const platformTeam = createTeam(
      "team_platform",
      "Platform",
      "software-development"
    )

    const actions = buildGlobalCreateActions({
      activeTeamId: platformTeam.id,
      workItemCreateTeams: [platformTeam],
      projectCreateTeams: [],
      viewTeams: [platformTeam],
      workspaceViewOption: null,
    })

    expect(
      actions.filter((action) => action.kind === "view").map((action) => action.id)
    ).toEqual(["create-view-team-team_platform"])
  })
})
