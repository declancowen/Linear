import { createEmptyState } from "@/lib/domain/empty-state"
import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
  type AppData,
  type TeamExperienceType,
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

type LargeWorkspaceFixtureConfig = Required<LargeWorkspaceFixtureOptions>
type FixtureData = AppData
type FixtureUser = FixtureData["users"][number]
type FixtureTeam = FixtureData["teams"][number]
type FixtureProject = FixtureData["projects"][number]
type FixtureDocument = FixtureData["documents"][number]
type FixtureWorkItem = FixtureData["workItems"][number]
type TeamExperience = TeamExperienceType

const FIXTURE_WORKSPACE_ID = "workspace_1"
const FIXTURE_CURRENT_USER_ID = "user_current"
const FIXTURE_TIMESTAMP = "2026-04-01T09:00:00.000Z"
const FIXTURE_DATE = "2026-04-01"

export function createLargeWorkspaceSearchFixture(
  options: LargeWorkspaceFixtureOptions = {}
): AppData {
  const config = resolveLargeWorkspaceFixtureConfig(options)
  const data = createEmptyState()

  seedLargeWorkspaceIdentity(data)

  for (let index = 0; index < config.teamCount; index += 1) {
    seedTeamBundle(data, config, index)
  }

  seedWorkspaceProjects(data, config.workspaceProjectCount)
  seedWorkspaceDocuments(data, config)
  seedPrivateDocuments(data, config.privateDocumentCount)

  return data
}

function resolveLargeWorkspaceFixtureConfig(
  options: LargeWorkspaceFixtureOptions
): LargeWorkspaceFixtureConfig {
  return {
    teamCount: options.teamCount ?? 24,
    projectsPerTeam: options.projectsPerTeam ?? 8,
    itemsPerTeam: options.itemsPerTeam ?? 60,
    documentsPerTeam: options.documentsPerTeam ?? 5,
    workspaceProjectCount: options.workspaceProjectCount ?? 12,
    workspaceDocumentCount: options.workspaceDocumentCount ?? 16,
    privateDocumentCount: options.privateDocumentCount ?? 12,
  }
}

function seedLargeWorkspaceIdentity(data: FixtureData) {
  data.currentUserId = FIXTURE_CURRENT_USER_ID
  data.currentWorkspaceId = FIXTURE_WORKSPACE_ID
  data.workspaces = [
    {
      id: FIXTURE_WORKSPACE_ID,
      slug: "acme",
      name: "Acme",
      logoUrl: "",
      logoImageUrl: null,
      createdBy: FIXTURE_CURRENT_USER_ID,
      workosOrganizationId: null,
      settings: {
        accent: "emerald",
        description: "Large workspace fixture",
      },
    },
  ]
  data.users = [
    createFixtureUser({
      id: FIXTURE_CURRENT_USER_ID,
      name: "Alex Owner",
      handle: "alex",
      email: "alex@example.com",
      title: "Owner",
    }),
  ]
}

function createFixtureUser(input: {
  id: string
  name: string
  handle: string
  email: string
  title: string
}): FixtureUser {
  return {
    id: input.id,
    name: input.name,
    handle: input.handle,
    email: input.email,
    avatarUrl: "",
    avatarImageUrl: null,
    workosUserId: null,
    title: input.title,
    status: "active",
    statusMessage: "",
    preferences: {
      emailMentions: true,
      emailAssignments: true,
      emailDigest: true,
      theme: "system",
    },
  }
}

function seedTeamBundle(
  data: FixtureData,
  config: LargeWorkspaceFixtureConfig,
  index: number
) {
  const teamId = getTeamId(index)
  const teamLabel = getTeamLabel(index)
  const leadId = `user_lead_${index + 1}`
  const assigneeId = `user_assignee_${index + 1}`

  data.users.push(
    createFixtureUser({
      id: `user_lead_${index + 1}`,
      name: `Lead ${teamLabel}`,
      handle: `lead-${teamLabel}`,
      email: `lead-${teamLabel}@example.com`,
      title: "Lead",
    }),
    createFixtureUser({
      id: `user_assignee_${index + 1}`,
      name: `Assignee ${teamLabel}`,
      handle: `assignee-${teamLabel}`,
      email: `assignee-${teamLabel}@example.com`,
      title: "Engineer",
    })
  )

  data.teams.push(createFixtureTeam(index))
  data.teamMemberships.push({
    teamId,
    userId: FIXTURE_CURRENT_USER_ID,
    role: index % 3 === 0 ? "admin" : "member",
  })

  for (
    let projectIndex = 0;
    projectIndex < config.projectsPerTeam;
    projectIndex += 1
  ) {
    data.projects.push(
      createTeamProject(teamId, teamLabel, leadId, projectIndex)
    )
  }

  for (
    let documentIndex = 0;
    documentIndex < config.documentsPerTeam;
    documentIndex += 1
  ) {
    data.documents.push(createTeamDocument(teamId, teamLabel, documentIndex))
  }

  for (let itemIndex = 0; itemIndex < config.itemsPerTeam; itemIndex += 1) {
    data.workItems.push(
      createTeamWorkItem(
        teamId,
        teamLabel,
        assigneeId,
        index,
        itemIndex,
        config
      )
    )
  }
}

function getTeamId(index: number): string {
  return `team_${index + 1}`
}

function getTeamLabel(index: number): string {
  return String(index + 1).padStart(2, "0")
}

function getTeamExperience(index: number): TeamExperience {
  return index % 2 === 0 ? "software-development" : "project-management"
}

function createFixtureTeam(index: number): FixtureTeam {
  const teamId = getTeamId(index)
  const teamLabel = getTeamLabel(index)
  const experience = getTeamExperience(index)

  return {
    id: teamId,
    workspaceId: FIXTURE_WORKSPACE_ID,
    slug: `team-${teamLabel}`,
    name: `Team ${teamLabel}`,
    icon: index % 2 === 0 ? "code" : "kanban",
    settings: {
      joinCode: `TEAM${teamLabel}`,
      summary: `Team ${teamLabel} owns workstream ${teamLabel}.`,
      guestProjectIds: [],
      guestDocumentIds: [],
      guestWorkItemIds: [],
      experience,
      features: createDefaultTeamFeatureSettings(experience),
      workflow: createDefaultTeamWorkflowSettings(experience),
    },
  }
}

function createTeamProject(
  teamId: string,
  teamLabel: string,
  leadId: string,
  projectIndex: number
): FixtureProject {
  return {
    id: `project_${teamId}_${projectIndex + 1}`,
    scopeType: "team",
    scopeId: teamId,
    templateType:
      projectIndex % 2 === 0 ? "software-delivery" : "project-management",
    name: `Project ${teamLabel}-${projectIndex + 1}`,
    summary: `Project ${projectIndex + 1} for team ${teamLabel}.`,
    description: `Delivery stream ${projectIndex + 1} for team ${teamLabel}.`,
    leadId,
    memberIds: [FIXTURE_CURRENT_USER_ID, leadId],
    health: projectIndex % 3 === 0 ? "on-track" : "at-risk",
    priority: projectIndex % 4 === 0 ? "high" : "medium",
    status: projectIndex % 3 === 0 ? "in-progress" : "planned",
    startDate: FIXTURE_DATE,
    targetDate: "2026-06-01",
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
  }
}

function createTeamDocument(
  teamId: string,
  teamLabel: string,
  documentIndex: number
): FixtureDocument {
  return {
    id: `document_${teamId}_${documentIndex + 1}`,
    kind: "team-document",
    workspaceId: FIXTURE_WORKSPACE_ID,
    teamId,
    title: `Doc ${teamLabel}-${documentIndex + 1}`,
    content: `Knowledge base document ${documentIndex + 1} for team ${teamLabel}.`,
    linkedProjectIds: [`project_${teamId}_1`],
    linkedWorkItemIds: [],
    createdBy: FIXTURE_CURRENT_USER_ID,
    updatedBy: FIXTURE_CURRENT_USER_ID,
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
  }
}

function createTeamWorkItem(
  teamId: string,
  teamLabel: string,
  assigneeId: string,
  teamIndex: number,
  itemIndex: number,
  config: LargeWorkspaceFixtureConfig
): FixtureWorkItem {
  const documentId = `document_${teamId}_${(itemIndex % config.documentsPerTeam) + 1}`
  const projectId = `project_${teamId}_${(itemIndex % config.projectsPerTeam) + 1}`

  return {
    id: `item_${teamId}_${itemIndex + 1}`,
    key: `T${teamLabel}-${itemIndex + 1}`,
    teamId,
    type: teamIndex % 2 === 0 ? "feature" : "task",
    title: isNeedleSearchItem(teamIndex, itemIndex)
      ? "Needle Search Item"
      : `Work item ${itemIndex + 1} for team ${teamLabel}`,
    descriptionDocId: documentId,
    status: itemIndex % 5 === 0 ? "done" : "in-progress",
    priority: itemIndex % 4 === 0 ? "high" : "medium",
    assigneeId,
    creatorId: FIXTURE_CURRENT_USER_ID,
    parentId: null,
    primaryProjectId: projectId,
    linkedProjectIds: [projectId],
    linkedDocumentIds: [documentId],
    labelIds: [],
    milestoneId: null,
    startDate: FIXTURE_DATE,
    dueDate: null,
    targetDate: null,
    subscriberIds: [FIXTURE_CURRENT_USER_ID],
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
  }
}

function isNeedleSearchItem(teamIndex: number, itemIndex: number): boolean {
  return teamIndex === 11 && itemIndex === 17
}

function seedWorkspaceProjects(data: FixtureData, projectCount: number) {
  for (let projectIndex = 0; projectIndex < projectCount; projectIndex += 1) {
    data.projects.push(createWorkspaceProject(projectIndex))
  }
}

function createWorkspaceProject(projectIndex: number): FixtureProject {
  return {
    id: `project_workspace_${projectIndex + 1}`,
    scopeType: "workspace",
    scopeId: FIXTURE_WORKSPACE_ID,
    templateType: "project-management",
    name: `Workspace Project ${projectIndex + 1}`,
    summary: `Workspace initiative ${projectIndex + 1}.`,
    description: `Shared workspace initiative ${projectIndex + 1}.`,
    leadId: FIXTURE_CURRENT_USER_ID,
    memberIds: [FIXTURE_CURRENT_USER_ID],
    health: "on-track",
    priority: "medium",
    status: "planned",
    startDate: FIXTURE_DATE,
    targetDate: "2026-06-01",
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
  }
}

function seedWorkspaceDocuments(
  data: FixtureData,
  config: LargeWorkspaceFixtureConfig
) {
  for (
    let documentIndex = 0;
    documentIndex < config.workspaceDocumentCount;
    documentIndex += 1
  ) {
    data.documents.push(
      createWorkspaceDocument(documentIndex, config.workspaceProjectCount)
    )
  }
}

function createWorkspaceDocument(
  documentIndex: number,
  projectCount: number
): FixtureDocument {
  return {
    id: `document_workspace_${documentIndex + 1}`,
    kind: "workspace-document",
    workspaceId: FIXTURE_WORKSPACE_ID,
    teamId: null,
    title: `Workspace Doc ${documentIndex + 1}`,
    content: `Workspace knowledge document ${documentIndex + 1}.`,
    linkedProjectIds: [
      `project_workspace_${(documentIndex % projectCount) + 1}`,
    ],
    linkedWorkItemIds: [],
    createdBy: FIXTURE_CURRENT_USER_ID,
    updatedBy: FIXTURE_CURRENT_USER_ID,
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
  }
}

function seedPrivateDocuments(data: FixtureData, documentCount: number) {
  for (
    let documentIndex = 0;
    documentIndex < documentCount;
    documentIndex += 1
  ) {
    data.documents.push(createPrivateDocument(documentIndex))
  }
}

function createPrivateDocument(documentIndex: number): FixtureDocument {
  return {
    id: `document_private_${documentIndex + 1}`,
    kind: "private-document",
    workspaceId: FIXTURE_WORKSPACE_ID,
    teamId: null,
    title: `Private Doc ${documentIndex + 1}`,
    content: `Private planning note ${documentIndex + 1}.`,
    linkedProjectIds: [],
    linkedWorkItemIds: [],
    createdBy: FIXTURE_CURRENT_USER_ID,
    updatedBy: FIXTURE_CURRENT_USER_ID,
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
  }
}
