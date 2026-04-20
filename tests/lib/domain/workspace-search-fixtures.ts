import { createEmptyState } from "@/lib/domain/empty-state"
import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
  type AppData,
} from "@/lib/domain/types"

type LargeWorkspaceFixtureOptions = {
  teamCount?: number
  projectsPerTeam?: number
  itemsPerTeam?: number
  documentsPerTeam?: number
  workspaceProjectCount?: number
  workspaceDocumentCount?: number
  privateDocumentCount?: number
}

export function createLargeWorkspaceSearchFixture(
  options: LargeWorkspaceFixtureOptions = {}
): AppData {
  const config = {
    teamCount: options.teamCount ?? 24,
    projectsPerTeam: options.projectsPerTeam ?? 8,
    itemsPerTeam: options.itemsPerTeam ?? 60,
    documentsPerTeam: options.documentsPerTeam ?? 5,
    workspaceProjectCount: options.workspaceProjectCount ?? 12,
    workspaceDocumentCount: options.workspaceDocumentCount ?? 16,
    privateDocumentCount: options.privateDocumentCount ?? 12,
  }
  const data = createEmptyState()

  data.currentUserId = "user_current"
  data.currentWorkspaceId = "workspace_1"
  data.workspaces = [
    {
      id: "workspace_1",
      slug: "acme",
      name: "Acme",
      logoUrl: "",
      logoImageUrl: null,
      createdBy: "user_current",
      workosOrganizationId: null,
      settings: {
        accent: "emerald",
        description: "Large workspace fixture",
      },
    },
  ]
  data.users = [
    {
      id: "user_current",
      name: "Alex Owner",
      handle: "alex",
      email: "alex@example.com",
      avatarUrl: "",
      avatarImageUrl: null,
      workosUserId: null,
      title: "Owner",
      status: "in-progress",
      statusMessage: "",
      preferences: {
        emailMentions: true,
        emailAssignments: true,
        emailDigest: true,
        theme: "system",
      },
    },
  ]

  for (let index = 0; index < config.teamCount; index += 1) {
    const teamId = `team_${index + 1}`
    const teamLabel = String(index + 1).padStart(2, "0")

    data.users.push({
      id: `user_lead_${index + 1}`,
      name: `Lead ${teamLabel}`,
      handle: `lead-${teamLabel}`,
      email: `lead-${teamLabel}@example.com`,
      avatarUrl: "",
      avatarImageUrl: null,
      workosUserId: null,
      title: "Lead",
      status: "active",
      statusMessage: "",
      preferences: {
        emailMentions: true,
        emailAssignments: true,
        emailDigest: true,
        theme: "system",
      },
    })
    data.users.push({
      id: `user_assignee_${index + 1}`,
      name: `Assignee ${teamLabel}`,
      handle: `assignee-${teamLabel}`,
      email: `assignee-${teamLabel}@example.com`,
      avatarUrl: "",
      avatarImageUrl: null,
      workosUserId: null,
      title: "Engineer",
      status: "active",
      statusMessage: "",
      preferences: {
        emailMentions: true,
        emailAssignments: true,
        emailDigest: true,
        theme: "system",
      },
    })

    data.teams.push({
      id: teamId,
      workspaceId: "workspace_1",
      slug: `team-${teamLabel}`,
      name: `Team ${teamLabel}`,
      icon: index % 2 === 0 ? "code" : "kanban",
      settings: {
        joinCode: `TEAM${teamLabel}`,
        summary: `Team ${teamLabel} owns workstream ${teamLabel}.`,
        guestProjectIds: [],
        guestDocumentIds: [],
        guestWorkItemIds: [],
        experience:
          index % 2 === 0 ? "software-development" : "project-management",
        features: createDefaultTeamFeatureSettings(
          index % 2 === 0 ? "software-development" : "project-management"
        ),
        workflow: createDefaultTeamWorkflowSettings(
          index % 2 === 0 ? "software-development" : "project-management"
        ),
      },
    })
    data.teamMemberships.push({
      teamId,
      userId: "user_current",
      role: index % 3 === 0 ? "admin" : "member",
    })

    for (
      let projectIndex = 0;
      projectIndex < config.projectsPerTeam;
      projectIndex += 1
    ) {
      const projectId = `project_${teamId}_${projectIndex + 1}`

      data.projects.push({
        id: projectId,
        scopeType: "team",
        scopeId: teamId,
        templateType:
          projectIndex % 2 === 0 ? "software-delivery" : "project-management",
        name: `Project ${teamLabel}-${projectIndex + 1}`,
        summary: `Project ${projectIndex + 1} for team ${teamLabel}.`,
        description: `Delivery stream ${projectIndex + 1} for team ${teamLabel}.`,
        leadId: `user_lead_${index + 1}`,
        memberIds: ["user_current", `user_lead_${index + 1}`],
        health: projectIndex % 3 === 0 ? "on-track" : "at-risk",
        priority: projectIndex % 4 === 0 ? "high" : "medium",
        status: projectIndex % 3 === 0 ? "in-progress" : "planned",
        startDate: "2026-04-01",
        targetDate: "2026-06-01",
        createdAt: "2026-04-01T09:00:00.000Z",
        updatedAt: "2026-04-01T09:00:00.000Z",
      })
    }

    for (
      let documentIndex = 0;
      documentIndex < config.documentsPerTeam;
      documentIndex += 1
    ) {
      data.documents.push({
        id: `document_${teamId}_${documentIndex + 1}`,
        kind: "team-document",
        workspaceId: "workspace_1",
        teamId,
        title: `Doc ${teamLabel}-${documentIndex + 1}`,
        content: `Knowledge base document ${documentIndex + 1} for team ${teamLabel}.`,
        linkedProjectIds: [`project_${teamId}_1`],
        linkedWorkItemIds: [],
        createdBy: "user_current",
        updatedBy: "user_current",
        createdAt: "2026-04-01T09:00:00.000Z",
        updatedAt: "2026-04-01T09:00:00.000Z",
      })
    }

    for (let itemIndex = 0; itemIndex < config.itemsPerTeam; itemIndex += 1) {
      const isNeedle = index === 11 && itemIndex === 17

      data.workItems.push({
        id: `item_${teamId}_${itemIndex + 1}`,
        key: `T${teamLabel}-${itemIndex + 1}`,
        teamId,
        type: index % 2 === 0 ? "feature" : "task",
        title: isNeedle
          ? "Needle Search Item"
          : `Work item ${itemIndex + 1} for team ${teamLabel}`,
        descriptionDocId: `document_${teamId}_${(itemIndex % config.documentsPerTeam) + 1}`,
        status: itemIndex % 5 === 0 ? "done" : "in-progress",
        priority: itemIndex % 4 === 0 ? "high" : "medium",
        assigneeId: `user_assignee_${index + 1}`,
        creatorId: "user_current",
        parentId: null,
        primaryProjectId: `project_${teamId}_${(itemIndex % config.projectsPerTeam) + 1}`,
        linkedProjectIds: [
          `project_${teamId}_${(itemIndex % config.projectsPerTeam) + 1}`,
        ],
        linkedDocumentIds: [
          `document_${teamId}_${(itemIndex % config.documentsPerTeam) + 1}`,
        ],
        labelIds: [],
        milestoneId: null,
        startDate: "2026-04-01",
        dueDate: null,
        targetDate: null,
        subscriberIds: ["user_current"],
        createdAt: "2026-04-01T09:00:00.000Z",
        updatedAt: "2026-04-01T09:00:00.000Z",
      })
    }
  }

  for (
    let projectIndex = 0;
    projectIndex < config.workspaceProjectCount;
    projectIndex += 1
  ) {
    data.projects.push({
      id: `project_workspace_${projectIndex + 1}`,
      scopeType: "workspace",
      scopeId: "workspace_1",
      templateType: "project-management",
      name: `Workspace Project ${projectIndex + 1}`,
      summary: `Workspace initiative ${projectIndex + 1}.`,
      description: `Shared workspace initiative ${projectIndex + 1}.`,
      leadId: "user_current",
      memberIds: ["user_current"],
      health: "on-track",
      priority: "medium",
      status: "active",
      startDate: "2026-04-01",
      targetDate: "2026-06-01",
      createdAt: "2026-04-01T09:00:00.000Z",
      updatedAt: "2026-04-01T09:00:00.000Z",
    })
  }

  for (
    let documentIndex = 0;
    documentIndex < config.workspaceDocumentCount;
    documentIndex += 1
  ) {
    data.documents.push({
      id: `document_workspace_${documentIndex + 1}`,
      kind: "workspace-document",
      workspaceId: "workspace_1",
      teamId: null,
      title: `Workspace Doc ${documentIndex + 1}`,
      content: `Workspace knowledge document ${documentIndex + 1}.`,
      linkedProjectIds: [
        `project_workspace_${(documentIndex % config.workspaceProjectCount) + 1}`,
      ],
      linkedWorkItemIds: [],
      createdBy: "user_current",
      updatedBy: "user_current",
      createdAt: "2026-04-01T09:00:00.000Z",
      updatedAt: "2026-04-01T09:00:00.000Z",
    })
  }

  for (
    let documentIndex = 0;
    documentIndex < config.privateDocumentCount;
    documentIndex += 1
  ) {
    data.documents.push({
      id: `document_private_${documentIndex + 1}`,
      kind: "private-document",
      workspaceId: "workspace_1",
      teamId: null,
      title: `Private Doc ${documentIndex + 1}`,
      content: `Private planning note ${documentIndex + 1}.`,
      linkedProjectIds: [],
      linkedWorkItemIds: [],
      createdBy: "user_current",
      updatedBy: "user_current",
      createdAt: "2026-04-01T09:00:00.000Z",
      updatedAt: "2026-04-01T09:00:00.000Z",
    })
  }

  return data
}
