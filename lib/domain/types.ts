import { z } from "zod"

import { getPlainTextContent } from "@/lib/utils"

export const roles = ["admin", "member", "viewer", "guest"] as const
export type Role = (typeof roles)[number]

export const scopeTypes = ["team", "workspace"] as const
export type ScopeType = (typeof scopeTypes)[number]

export const templateTypes = [
  "software-delivery",
  "bug-tracking",
  "project-management",
] as const
export type TemplateType = (typeof templateTypes)[number]

export const teamExperienceTypes = [
  "software-development",
  "issue-analysis",
  "project-management",
  "community",
] as const
export type TeamExperienceType = (typeof teamExperienceTypes)[number]

export const teamIconTokens = [
  "robot",
  "code",
  "qa",
  "kanban",
  "briefcase",
  "users",
] as const
export type TeamIconToken = (typeof teamIconTokens)[number]

export const workItemTypes = [
  "epic",
  "feature",
  "requirement",
  "story",
  "task",
  "issue",
  "sub-task",
  "sub-issue",
] as const
export type WorkItemType = (typeof workItemTypes)[number]

export const legacyWorkItemTypes = ["bug"] as const
export type LegacyWorkItemType = (typeof legacyWorkItemTypes)[number]
export type StoredWorkItemType = WorkItemType | LegacyWorkItemType

export const workStatuses = [
  "backlog",
  "todo",
  "in-progress",
  "done",
  "cancelled",
  "duplicate",
] as const
export type WorkStatus = (typeof workStatuses)[number]

export const priorities = ["none", "low", "medium", "high", "urgent"] as const
export type Priority = (typeof priorities)[number]

export const projectHealths = [
  "no-update",
  "on-track",
  "at-risk",
  "off-track",
] as const
export type ProjectHealth = (typeof projectHealths)[number]

export const projectStatuses = [
  "planning",
  "active",
  "paused",
  "completed",
] as const
export type ProjectStatus = (typeof projectStatuses)[number]

export const notificationTypes = [
  "mention",
  "assignment",
  "comment",
  "invite",
  "status-change",
] as const
export type NotificationType = (typeof notificationTypes)[number]

export const notificationEntityTypes = [
  "workItem",
  "document",
  "project",
  "invite",
  "channelPost",
  "chat",
] as const
export type NotificationEntityType = (typeof notificationEntityTypes)[number]

export const entityKinds = ["items", "projects", "docs"] as const
export type EntityKind = (typeof entityKinds)[number]

export const viewLayouts = ["list", "board", "timeline"] as const
export type ViewLayout = (typeof viewLayouts)[number]

export const viewScopeTypes = ["personal", "team", "workspace"] as const
export type ViewScopeType = (typeof viewScopeTypes)[number]

export const displayProperties = [
  "id",
  "type",
  "status",
  "assignee",
  "priority",
  "project",
  "dueDate",
  "milestone",
  "labels",
  "created",
  "updated",
] as const
export type DisplayProperty = (typeof displayProperties)[number]

export const groupFields = [
  "project",
  "status",
  "assignee",
  "priority",
  "label",
  "team",
  "type",
  "epic",
  "feature",
] as const
export type GroupField = (typeof groupFields)[number]

export const orderingFields = [
  "priority",
  "updatedAt",
  "createdAt",
  "dueDate",
  "targetDate",
  "title",
] as const
export type OrderingField = (typeof orderingFields)[number]

export const themePreferences = ["light", "dark", "system"] as const
export type ThemePreference = (typeof themePreferences)[number]

export const commentTargetTypes = ["workItem", "document"] as const
export type CommentTargetType = (typeof commentTargetTypes)[number]

export const attachmentTargetTypes = ["workItem", "document"] as const
export type AttachmentTargetType = (typeof attachmentTargetTypes)[number]

export const documentKinds = [
  "team-document",
  "workspace-document",
  "private-document",
  "item-description",
] as const
export type DocumentKind = (typeof documentKinds)[number]

export const conversationKinds = ["chat", "channel"] as const
export type ConversationKind = (typeof conversationKinds)[number]

export const conversationScopeTypes = ["workspace", "team"] as const
export type ConversationScopeType = (typeof conversationScopeTypes)[number]

export const conversationVariants = ["direct", "group", "team"] as const
export type ConversationVariant = (typeof conversationVariants)[number]

export const chatMessageKinds = ["text", "call"] as const
export type ChatMessageKind = (typeof chatMessageKinds)[number]

export interface TeamFeatureSettings {
  issues: boolean
  projects: boolean
  views: boolean
  docs: boolean
  chat: boolean
  channels: boolean
}

export interface TeamTemplateConfig {
  defaultPriority: Priority
  targetWindowDays: number
  defaultViewLayout: ViewLayout
  recommendedItemTypes: WorkItemType[]
  summaryHint: string
}

export interface TeamWorkflowSettings {
  statusOrder: WorkStatus[]
  templateDefaults: Record<TemplateType, TeamTemplateConfig>
}

export type HiddenState = {
  groups: string[]
  subgroups: string[]
}

export type ViewFilters = {
  status: WorkStatus[]
  priority: Priority[]
  assigneeIds: string[]
  creatorIds: string[]
  leadIds: string[]
  health: ProjectHealth[]
  milestoneIds: string[]
  relationTypes: string[]
  projectIds: string[]
  itemTypes: WorkItemType[]
  labelIds: string[]
  teamIds: string[]
  showCompleted: boolean
}

export interface ProjectPresentationConfig {
  layout: ViewLayout
  grouping: GroupField
  ordering: OrderingField
  displayProps: DisplayProperty[]
  filters: ViewFilters
}

export function createDefaultViewFilters(): ViewFilters {
  return {
    status: [],
    priority: [],
    assigneeIds: [],
    creatorIds: [],
    leadIds: [],
    health: [],
    milestoneIds: [],
    relationTypes: [],
    projectIds: [],
    itemTypes: [],
    labelIds: [],
    teamIds: [],
    showCompleted: true,
  }
}

export function createDefaultProjectPresentationConfig(
  templateType: TemplateType,
  options?: {
    layout?: ViewLayout
  }
): ProjectPresentationConfig {
  const layout =
    options?.layout ??
    (templateType === "project-management"
      ? "timeline"
      : templateType === "bug-tracking"
        ? "list"
        : "board")

  return {
    layout,
    grouping: "status",
    ordering: layout === "timeline" ? "targetDate" : "priority",
    displayProps:
      layout === "timeline"
        ? ["id", "status", "assignee", "priority", "dueDate"]
        : ["id", "status", "assignee", "priority", "labels", "updated"],
    filters: createDefaultViewFilters(),
  }
}

export interface Workspace {
  id: string
  slug: string
  name: string
  logoUrl: string
  logoImageUrl?: string | null
  createdBy?: string | null
  workosOrganizationId: string | null
  settings: {
    accent: string
    description: string
  }
}

export interface Team {
  id: string
  workspaceId: string
  slug: string
  name: string
  icon: string
  settings: {
    joinCode: string
    summary: string
    guestProjectIds: string[]
    guestDocumentIds: string[]
    guestWorkItemIds: string[]
    experience: TeamExperienceType
    features: TeamFeatureSettings
    workflow: TeamWorkflowSettings
  }
}

export interface TeamMembership {
  teamId: string
  userId: string
  role: Role
}

export interface UserProfile {
  id: string
  name: string
  handle: string
  email: string
  avatarUrl: string
  avatarImageUrl?: string | null
  workosUserId: string | null
  title: string
  preferences: {
    emailMentions: boolean
    emailAssignments: boolean
    emailDigest: boolean
    theme: ThemePreference
  }
}

export interface Label {
  id: string
  name: string
  color: string
}

export interface Project {
  id: string
  scopeType: ScopeType
  scopeId: string
  templateType: TemplateType
  name: string
  summary: string
  description: string
  leadId: string
  memberIds: string[]
  health: ProjectHealth
  priority: Priority
  status: ProjectStatus
  presentation?: ProjectPresentationConfig
  startDate: string | null
  targetDate: string | null
  createdAt: string
  updatedAt: string
}

export interface Milestone {
  id: string
  projectId: string
  name: string
  targetDate: string | null
  status: WorkStatus
}

export interface WorkItem {
  id: string
  key: string
  teamId: string
  type: WorkItemType
  title: string
  descriptionDocId: string
  status: WorkStatus
  priority: Priority
  assigneeId: string | null
  creatorId: string
  parentId: string | null
  primaryProjectId: string | null
  linkedProjectIds: string[]
  linkedDocumentIds: string[]
  labelIds: string[]
  milestoneId: string | null
  startDate: string | null
  dueDate: string | null
  targetDate: string | null
  subscriberIds: string[]
  createdAt: string
  updatedAt: string
}

export interface Document {
  id: string
  kind: DocumentKind
  workspaceId: string
  teamId: string | null
  title: string
  content: string
  linkedProjectIds: string[]
  linkedWorkItemIds: string[]
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
}

export interface ViewDefinition {
  id: string
  name: string
  description: string
  scopeType: ViewScopeType
  scopeId: string
  entityKind: EntityKind
  layout: ViewLayout
  filters: ViewFilters
  grouping: GroupField
  subGrouping: GroupField | null
  ordering: OrderingField
  displayProps: DisplayProperty[]
  hiddenState: HiddenState
  isShared: boolean
  route: string
  createdAt: string
  updatedAt: string
}

export interface Comment {
  id: string
  targetType: CommentTargetType
  targetId: string
  parentCommentId: string | null
  content: string
  mentionUserIds: string[]
  reactions: CommentReaction[]
  createdBy: string
  createdAt: string
}

export interface Attachment {
  id: string
  targetType: AttachmentTargetType
  targetId: string
  teamId: string
  storageId: string
  fileName: string
  contentType: string
  size: number
  uploadedBy: string
  createdAt: string
  fileUrl: string | null
}

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  entityType: NotificationEntityType
  entityId: string
  actorId: string
  message: string
  readAt: string | null
  emailedAt: string | null
  createdAt: string
}

export interface Invite {
  id: string
  workspaceId: string
  teamId: string
  email: string
  role: Role
  token: string
  joinCode: string
  invitedBy: string
  expiresAt: string
  acceptedAt: string | null
  declinedAt?: string | null
}

export interface ProjectUpdate {
  id: string
  projectId: string
  content: string
  createdBy: string
  createdAt: string
}

export interface Conversation {
  id: string
  kind: ConversationKind
  scopeType: ConversationScopeType
  scopeId: string
  variant: ConversationVariant
  title: string
  description: string
  participantIds: string[]
  roomId?: string | null
  roomName?: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  lastActivityAt: string
}

export interface ChatMessage {
  id: string
  conversationId: string
  kind: ChatMessageKind
  content: string
  callId?: string | null
  mentionUserIds: string[]
  createdBy: string
  createdAt: string
}

export interface Call {
  id: string
  conversationId: string
  scopeType: ConversationScopeType
  scopeId: string
  roomId: string | null
  roomName: string | null
  roomKey: string
  roomDescription: string
  startedBy: string
  startedAt: string
  updatedAt: string
  endedAt: string | null
  participantUserIds: string[]
  lastJoinedAt: string | null
  lastJoinedBy: string | null
  joinCount: number
}

export interface CommentReaction {
  emoji: string
  userIds: string[]
}

export type ChannelPostReaction = CommentReaction

export interface ChannelPost {
  id: string
  conversationId: string
  title: string
  content: string
  reactions: ChannelPostReaction[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface ChannelPostComment {
  id: string
  postId: string
  content: string
  mentionUserIds: string[]
  createdBy: string
  createdAt: string
}

export interface UiState {
  activeTeamId: string
  activeInboxNotificationId: string | null
  selectedViewByRoute: Record<string, string>
}

export interface AppData {
  currentUserId: string
  currentWorkspaceId: string
  workspaces: Workspace[]
  teams: Team[]
  teamMemberships: TeamMembership[]
  users: UserProfile[]
  labels: Label[]
  projects: Project[]
  milestones: Milestone[]
  workItems: WorkItem[]
  documents: Document[]
  views: ViewDefinition[]
  comments: Comment[]
  attachments: Attachment[]
  notifications: Notification[]
  invites: Invite[]
  projectUpdates: ProjectUpdate[]
  conversations: Conversation[]
  calls: Call[]
  chatMessages: ChatMessage[]
  channelPosts: ChannelPost[]
  channelPostComments: ChannelPostComment[]
  ui: UiState
}

export type AppSnapshot = Omit<AppData, "ui">

export const templateMeta: Record<
  TemplateType,
  {
    label: string
    description: string
    icon: TeamIconToken
    itemTypes: WorkItemType[]
  }
> = {
  "software-delivery": {
    label: "Software Development",
    description: "Epics, features, requirements, stories, and issues.",
    icon: "code",
    itemTypes: ["epic", "feature", "requirement", "story", "issue"],
  },
  "bug-tracking": {
    label: "Issue Tracking",
    description: "Issues, sub-issues, triage, and follow-up.",
    icon: "qa",
    itemTypes: ["issue", "sub-issue"],
  },
  "project-management": {
    label: "Project Management",
    description: "Tasks, sub-tasks, plans, and delivery work.",
    icon: "kanban",
    itemTypes: ["task", "sub-task"],
  },
}

export function getAllowedWorkItemTypesForTemplate(
  templateType: TemplateType
): WorkItemType[] {
  return [...templateMeta[templateType].itemTypes]
}

export function getAllowedRootWorkItemTypesForTemplate(
  templateType: TemplateType
): WorkItemType[] {
  return getAllowedWorkItemTypesForTemplate(templateType).filter(
    (itemType) => itemType !== "sub-task" && itemType !== "sub-issue"
  )
}

export function getDefaultWorkItemTypesForTeamExperience(
  experience: TeamExperienceType | null | undefined
): WorkItemType[] {
  const resolvedExperience = experience ?? "software-development"

  if (resolvedExperience === "issue-analysis") {
    return getAllowedWorkItemTypesForTemplate("bug-tracking")
  }

  if (resolvedExperience === "project-management") {
    return getAllowedWorkItemTypesForTemplate("project-management")
  }

  if (resolvedExperience === "community") {
    return []
  }

  return getAllowedWorkItemTypesForTemplate("software-delivery")
}

export function getDefaultRootWorkItemTypesForTeamExperience(
  experience: TeamExperienceType | null | undefined
): WorkItemType[] {
  const resolvedExperience = experience ?? "software-development"

  if (resolvedExperience === "issue-analysis") {
    return getAllowedRootWorkItemTypesForTemplate("bug-tracking")
  }

  if (resolvedExperience === "project-management") {
    return getAllowedRootWorkItemTypesForTemplate("project-management")
  }

  if (resolvedExperience === "community") {
    return []
  }

  return getAllowedRootWorkItemTypesForTemplate("software-delivery")
}

export function getPreferredWorkItemTypeForTeamExperience(
  experience: TeamExperienceType | null | undefined,
  options?: { parent?: boolean }
): WorkItemType {
  const resolvedExperience = experience ?? "software-development"
  const hasParent = Boolean(options?.parent)

  if (resolvedExperience === "issue-analysis") {
    return hasParent ? "sub-issue" : "issue"
  }

  if (resolvedExperience === "project-management") {
    return hasParent ? "sub-task" : "task"
  }

  if (resolvedExperience === "community") {
    return "story"
  }

  return "story"
}

export function getDefaultTemplateTypeForTeamExperience(
  experience: TeamExperienceType | null | undefined
): TemplateType {
  const resolvedExperience = experience ?? "software-development"

  if (resolvedExperience === "issue-analysis") {
    return "bug-tracking"
  }

  if (resolvedExperience === "project-management") {
    return "project-management"
  }

  return "software-delivery"
}

export function getAllowedTemplateTypesForTeamExperience(
  experience: TeamExperienceType | null | undefined
): TemplateType[] {
  const resolvedExperience = experience ?? "software-development"

  if (resolvedExperience === "issue-analysis") {
    return ["bug-tracking"]
  }

  if (resolvedExperience === "project-management") {
    return ["project-management"]
  }

  if (resolvedExperience === "community") {
    return []
  }

  return ["software-delivery"]
}

export const teamIconMeta: Record<
  TeamIconToken,
  {
    label: string
    description: string
  }
> = {
  robot: {
    label: "Product",
    description: "Broad product delivery and cross-functional software work.",
  },
  code: {
    label: "Engineering",
    description: "Platform, implementation, and code-centric delivery.",
  },
  qa: {
    label: "Issue Tracking",
    description: "Issue triage, regression tracking, and follow-up work.",
  },
  kanban: {
    label: "Project Management",
    description: "Planning, coordination, milestones, and follow-through.",
  },
  briefcase: {
    label: "Operations",
    description:
      "Business operations, launch readiness, and execution support.",
  },
  users: {
    label: "Community",
    description: "People, communication, and community-facing collaboration.",
  },
}

export function isTeamIconToken(value: string): value is TeamIconToken {
  return (teamIconTokens as readonly string[]).includes(value)
}

export function getDefaultTeamIconForExperience(
  experience: TeamExperienceType | null | undefined
): TeamIconToken {
  const resolvedExperience = experience ?? "software-development"

  if (resolvedExperience === "issue-analysis") {
    return "qa"
  }

  if (resolvedExperience === "project-management") {
    return "kanban"
  }

  if (resolvedExperience === "community") {
    return "users"
  }

  return "code"
}

export function normalizeTeamIconToken(
  value: string | null | undefined,
  experience: TeamExperienceType | null | undefined
): TeamIconToken {
  const normalized = value?.trim().toLowerCase()

  if (normalized && isTeamIconToken(normalized)) {
    return normalized
  }

  switch (normalized) {
    case "issue-analysis":
    case "quality-assurance":
      return "qa"
    case "project-management":
      return "kanban"
    case "software-development":
      return "code"
    case "community":
      return "users"
    default:
      return getDefaultTeamIconForExperience(experience)
  }
}

export const teamExperienceMeta: Record<
  TeamExperienceType,
  {
    label: string
    description: string
  }
> = {
  "software-development": {
    label: "Software Development",
    description: "Epics, features, requirements, stories, and issues.",
  },
  "issue-analysis": {
    label: "Issue Tracking",
    description: "Issues, sub-issues, triage, and follow-up.",
  },
  "project-management": {
    label: "Project Management",
    description: "Tasks, sub-tasks, plans, and delivery work.",
  },
  community: {
    label: "Community",
    description: "Chat, channels, discussion, and updates.",
  },
}

export const teamFeatureMeta: Record<
  keyof TeamFeatureSettings,
  {
    label: string
    description: string
  }
> = {
  issues: {
    label: "Issues",
    description: "Track work items and operational tasks.",
  },
  projects: {
    label: "Projects",
    description: "Group work and milestones under shared initiatives.",
  },
  views: {
    label: "Views",
    description: "Save list, board, and timeline configurations.",
  },
  docs: {
    label: "Docs",
    description: "Team and workspace documentation.",
  },
  chat: {
    label: "Chat",
    description: "Real-time threaded messaging.",
  },
  channels: {
    label: "Channel",
    description: "Forum-style posts with comments.",
  },
}

export function createDefaultTeamFeatureSettings(
  experience: TeamExperienceType = "software-development"
): TeamFeatureSettings {
  if (experience === "community") {
    return {
      issues: false,
      projects: false,
      views: false,
      docs: false,
      chat: true,
      channels: true,
    }
  }

  return {
    issues: true,
    projects: true,
    views: true,
    docs: true,
    chat: false,
    channels: false,
  }
}

export function getTeamFeatureValidationMessage(
  experience: TeamExperienceType,
  features: TeamFeatureSettings
) {
  if (experience === "community") {
    if (
      features.issues ||
      features.projects ||
      features.views ||
      features.docs
    ) {
      return "Community teams can only enable chat and channel surfaces."
    }

    if (!features.chat && !features.channels) {
      return "Community teams must enable chat, channel, or both."
    }

    return null
  }

  if (!features.issues || !features.projects || !features.views) {
    return "Non-community teams must include the work surface, projects, and views."
  }

  return null
}

export function normalizeTeamFeatureSettings(
  experience: TeamExperienceType | null | undefined,
  features:
    | Partial<TeamFeatureSettings>
    | TeamFeatureSettings
    | null
    | undefined
) {
  const resolvedExperience = experience ?? "software-development"
  const merged = {
    ...createDefaultTeamFeatureSettings(resolvedExperience),
    ...(features ?? {}),
  }
  const validationMessage = getTeamFeatureValidationMessage(
    resolvedExperience,
    merged
  )

  if (validationMessage) {
    return createDefaultTeamFeatureSettings(resolvedExperience)
  }

  return merged
}

export function createDefaultTeamWorkflowSettings(
  experience: TeamExperienceType = "software-development"
): TeamWorkflowSettings {
  const workflow: TeamWorkflowSettings = {
    statusOrder: [...workStatuses],
    templateDefaults: {
      "software-delivery": {
        defaultPriority: "high",
        targetWindowDays: 28,
        defaultViewLayout: "board",
        recommendedItemTypes: [
          "epic",
          "feature",
          "requirement",
          "story",
          "issue",
        ],
        summaryHint:
          "Delivery plan spanning epics, features, requirements, stories, and issues.",
      },
      "bug-tracking": {
        defaultPriority: "high",
        targetWindowDays: 14,
        defaultViewLayout: "list",
        recommendedItemTypes: ["issue", "sub-issue"],
        summaryHint:
          "Issue tracker focused on triage, verification, and regression control.",
      },
      "project-management": {
        defaultPriority: "medium",
        targetWindowDays: 35,
        defaultViewLayout: "timeline",
        recommendedItemTypes: ["task", "sub-task"],
        summaryHint:
          "Cross-functional program plan for milestones, owners, and operational follow-through.",
      },
    },
  }

  if (experience === "issue-analysis") {
    workflow.templateDefaults["bug-tracking"] = {
      ...workflow.templateDefaults["bug-tracking"],
      defaultPriority: "high",
      targetWindowDays: 10,
      defaultViewLayout: "list",
      summaryHint:
        "Issue backlog focused on triage, verification, and regression control.",
    }
  }

  if (experience === "project-management") {
    workflow.templateDefaults["project-management"] = {
      ...workflow.templateDefaults["project-management"],
      defaultPriority: "medium",
      targetWindowDays: 45,
      defaultViewLayout: "timeline",
      summaryHint:
        "Program plan for milestones, risks, owners, and cross-team delivery coordination.",
    }
  }

  return workflow
}

export const statusMeta: Record<WorkStatus, { label: string }> = {
  backlog: { label: "Backlog" },
  todo: { label: "Todo" },
  "in-progress": { label: "In Progress" },
  done: { label: "Done" },
  cancelled: { label: "Cancelled" },
  duplicate: { label: "Duplicate" },
}

export const priorityMeta: Record<Priority, { label: string; weight: number }> =
  {
    urgent: { label: "Urgent", weight: 4 },
    high: { label: "High", weight: 3 },
    medium: { label: "Medium", weight: 2 },
    low: { label: "Low", weight: 1 },
    none: { label: "None", weight: 0 },
  }

export const projectHealthMeta: Record<ProjectHealth, { label: string }> = {
  "no-update": { label: "No updates" },
  "on-track": { label: "On track" },
  "at-risk": { label: "At risk" },
  "off-track": { label: "Off track" },
}

export const projectStatusMeta: Record<ProjectStatus, { label: string }> = {
  planning: { label: "Planning" },
  active: { label: "Active" },
  paused: { label: "Paused" },
  completed: { label: "Completed" },
}

export const workItemTypeMeta: Record<
  WorkItemType,
  { label: string; pluralLabel: string }
> = {
  epic: { label: "Epic", pluralLabel: "Epics" },
  feature: { label: "Feature", pluralLabel: "Features" },
  requirement: { label: "Requirement", pluralLabel: "Requirements" },
  story: { label: "Story", pluralLabel: "Stories" },
  task: { label: "Task", pluralLabel: "Tasks" },
  issue: { label: "Issue", pluralLabel: "Issues" },
  "sub-task": { label: "Sub-task", pluralLabel: "Sub-tasks" },
  "sub-issue": { label: "Sub-issue", pluralLabel: "Sub-issues" },
}

export function getDisplayLabelForWorkItemType(
  itemType: WorkItemType,
  _experience: TeamExperienceType | null | undefined
) {
  return workItemTypeMeta[itemType].label
}

export function getDisplayPluralLabelForWorkItemType(
  itemType: WorkItemType,
  _experience: TeamExperienceType | null | undefined
) {
  return workItemTypeMeta[itemType].pluralLabel
}

export function normalizeStoredWorkItemType(
  itemType: StoredWorkItemType,
  experience: TeamExperienceType | null | undefined,
  options?: { parentId?: string | null }
): WorkItemType {
  const resolvedExperience = experience ?? "software-development"
  const hasParent = Boolean(options?.parentId)

  if (resolvedExperience === "issue-analysis") {
    if (hasParent || itemType === "sub-task" || itemType === "sub-issue") {
      return "sub-issue"
    }

    return "issue"
  }

  if (resolvedExperience === "project-management") {
    if (hasParent || itemType === "sub-task" || itemType === "sub-issue") {
      return "sub-task"
    }

    return "task"
  }

  if (itemType === "bug") {
    return "issue"
  }

  return itemType
}

export function normalizeStoredWorkflowItemTypes(
  itemTypes: readonly StoredWorkItemType[],
  experience: TeamExperienceType | null | undefined,
  templateType: TemplateType
) {
  const allowedItemTypes = new Set(
    getAllowedWorkItemTypesForTemplate(templateType)
  )
  const normalizedItemTypes = new Set<WorkItemType>()

  itemTypes.forEach((itemType) => {
    const normalized = normalizeStoredWorkItemType(itemType, experience, {
      parentId: null,
    })

    if (allowedItemTypes.has(normalized)) {
      normalizedItemTypes.add(normalized)
    }
  })

  return [...normalizedItemTypes]
}

export function normalizeStoredViewItemTypes(
  itemTypes: readonly StoredWorkItemType[],
  experience?: TeamExperienceType | null
) {
  const normalizedItemTypes = new Set<WorkItemType>()

  itemTypes.forEach((itemType) => {
    if (!experience) {
      if (itemType === "bug") {
        normalizedItemTypes.add("issue")
        return
      }

      normalizedItemTypes.add(itemType)
      return
    }

    normalizedItemTypes.add(normalizeStoredWorkItemType(itemType, experience))
  })

  return [...normalizedItemTypes]
}

export function getWorkSurfaceCopy(
  experience: TeamExperienceType | null | undefined
) {
  const resolvedExperience = experience ?? "software-development"

  if (resolvedExperience === "issue-analysis") {
    return {
      surfaceLabel: "Issues",
      emptyLabel: "No issues yet",
      disabledLabel: "Issues are disabled for this team",
      singularLabel: "issue",
      parentLabel: "Parent issue",
      childPluralLabel: "Sub-issues",
      addChildLabel: "Add sub-issue",
      createLabel: "New issue",
      createChildLabel: "New sub-issue",
      titlePlaceholder: "Issue title",
    }
  }

  if (resolvedExperience === "project-management") {
    return {
      surfaceLabel: "Tasks",
      emptyLabel: "No tasks yet",
      disabledLabel: "Tasks are disabled for this team",
      singularLabel: "task",
      parentLabel: "Parent task",
      childPluralLabel: "Sub-tasks",
      addChildLabel: "Add sub-task",
      createLabel: "New task",
      createChildLabel: "New sub-task",
      titlePlaceholder: "Task title",
    }
  }

  return {
    surfaceLabel: "Work",
    emptyLabel: "No work items yet",
    disabledLabel: "Work is disabled for this team",
    singularLabel: "work item",
    parentLabel: "Parent item",
    childPluralLabel: "Child items",
    addChildLabel: "Add child item",
    createLabel: "New work item",
    createChildLabel: "New child item",
    titlePlaceholder: "Work item title",
  }
}

export const workItemChildTypeMeta: Record<WorkItemType, WorkItemType[]> = {
  epic: ["feature"],
  feature: ["requirement"],
  requirement: ["story"],
  story: [],
  task: ["sub-task"],
  issue: ["sub-issue"],
  "sub-task": [],
  "sub-issue": [],
}

export function getAllowedChildWorkItemTypes(parentType: WorkItemType) {
  return [...workItemChildTypeMeta[parentType]]
}

export function getAllowedChildWorkItemTypesForItem(
  item: Pick<WorkItem, "type" | "parentId">
) {
  return getAllowedChildWorkItemTypes(item.type)
}

export function canParentWorkItemTypeAcceptChild(
  parentType: WorkItemType,
  childType: WorkItemType
) {
  return workItemChildTypeMeta[parentType].includes(childType)
}

export function getChildWorkItemCopy(
  parentType: WorkItemType | null | undefined,
  experience: TeamExperienceType | null | undefined
) {
  const workCopy = getWorkSurfaceCopy(experience)

  if (!parentType) {
    return {
      childType: null,
      childLabel: workCopy.singularLabel,
      childPluralLabel: workCopy.childPluralLabel,
      addChildLabel: workCopy.addChildLabel,
      createChildLabel: workCopy.createChildLabel,
      titlePlaceholder: workCopy.titlePlaceholder,
    }
  }

  const allowedChildTypes = getAllowedChildWorkItemTypes(parentType)

  if (allowedChildTypes.length !== 1) {
    return {
      childType: null,
      childLabel: workCopy.singularLabel,
      childPluralLabel: workCopy.childPluralLabel,
      addChildLabel: workCopy.addChildLabel,
      createChildLabel: workCopy.createChildLabel,
      titlePlaceholder: workCopy.titlePlaceholder,
    }
  }

  const childType = allowedChildTypes[0]
  const childLabel = getDisplayLabelForWorkItemType(childType, experience)

  return {
    childType,
    childLabel,
    childPluralLabel: getDisplayPluralLabelForWorkItemType(
      childType,
      experience
    ),
    addChildLabel: `Add ${childLabel.toLowerCase()}`,
    createChildLabel: `New ${childLabel.toLowerCase()}`,
    titlePlaceholder: `${childLabel} title`,
  }
}

export const labelCreateSchema = z.object({
  name: z.string().trim().min(1).max(32),
  color: z.string().trim().min(1).max(24).optional(),
})

export const inviteSchema = z.object({
  teamIds: z.array(z.string().min(1)).min(1).max(12),
  email: z.email(),
  role: z.enum(roles),
})

export const joinCodeSchema = z.object({
  code: z.string().trim().min(4),
})

export const workspaceBrandingSchema = z.object({
  name: z.string().trim().min(2).max(48),
  logoUrl: z.string().trim().min(1),
  logoImageStorageId: z.string().trim().min(1).optional(),
  clearLogoImage: z.boolean().optional(),
  accent: z.string().trim().min(2).max(24),
  description: z.string().trim().min(8).max(220),
})

export const workspaceSetupSchema = z.object({
  name: z.string().trim().min(2).max(64),
  description: z.string().trim().min(8).max(220).optional(),
})

export const teamDetailsSchema = z
  .object({
    name: z.string().trim().min(2).max(48),
    icon: z.enum(teamIconTokens),
    summary: z.string().trim().min(8).max(180),
    joinCode: z.string().trim().min(4).max(24).optional(),
    experience: z.enum(teamExperienceTypes),
    features: z.object({
      issues: z.boolean(),
      projects: z.boolean(),
      views: z.boolean(),
      docs: z.boolean(),
      chat: z.boolean(),
      channels: z.boolean(),
    }),
  })
  .superRefine((value, ctx) => {
    const validationMessage = getTeamFeatureValidationMessage(
      value.experience,
      value.features
    )

    if (validationMessage) {
      ctx.addIssue({
        code: "custom",
        message: validationMessage,
        path: ["features"],
      })
    }
  })

export const appWorkspaceBootstrapSchema = z.object({
  workspaceSlug: z.string().trim().min(2).max(64),
  workspaceName: z.string().trim().min(2).max(64),
  workspaceLogoUrl: z.string().trim().min(1).max(24),
  workspaceAccent: z.string().trim().min(2).max(24),
  workspaceDescription: z.string().trim().min(8).max(220),
  teamSlug: z.string().trim().min(2).max(64),
  teamName: z.string().trim().min(2).max(64),
  teamIcon: z.enum(teamIconTokens),
  teamSummary: z.string().trim().min(8).max(180),
  teamJoinCode: z
    .string()
    .trim()
    .min(4)
    .max(24)
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Join code can only contain letters, numbers, dashes, and underscores"
    ),
  email: z.email(),
  userName: z.string().trim().min(2).max(80),
  avatarUrl: z.string().trim().min(1).max(24),
  workosUserId: z.string().trim().min(1),
  teamExperience: z.enum(teamExperienceTypes).default("software-development"),
  role: z.enum(roles).default("admin"),
})

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(48),
  title: z.string().trim().min(2).max(72),
  avatarUrl: z.string().trim().min(1),
  avatarImageStorageId: z.string().trim().min(1).optional(),
  clearAvatarImage: z.boolean().optional(),
  preferences: z.object({
    emailMentions: z.boolean(),
    emailAssignments: z.boolean(),
    emailDigest: z.boolean(),
    theme: z.enum(themePreferences).default("light"),
  }),
})

export const projectSchema = z.object({
  scopeType: z.enum(scopeTypes),
  scopeId: z.string().min(1),
  templateType: z.enum(templateTypes),
  name: z.string().trim().min(2).max(64),
  summary: z.string().trim().min(2).max(140),
  priority: z.enum(priorities),
  settingsTeamId: z.string().nullable().optional(),
  presentation: z
    .object({
      layout: z.enum(viewLayouts),
      grouping: z.enum(groupFields),
      ordering: z.enum(orderingFields),
      displayProps: z.array(z.enum(displayProperties)),
      filters: z.object({
        status: z.array(z.enum(workStatuses)),
        priority: z.array(z.enum(priorities)),
        assigneeIds: z.array(z.string()),
        creatorIds: z.array(z.string()),
        leadIds: z.array(z.string()),
        health: z.array(z.enum(projectHealths)),
        milestoneIds: z.array(z.string()),
        relationTypes: z.array(z.string()),
        projectIds: z.array(z.string()),
        itemTypes: z.array(z.enum(workItemTypes)),
        labelIds: z.array(z.string()),
        teamIds: z.array(z.string()),
        showCompleted: z.boolean(),
      }),
    })
    .optional(),
})

export const workItemSchema = z.object({
  teamId: z.string().min(1),
  type: z.enum(workItemTypes),
  title: z.string().trim().min(2).max(96),
  parentId: z.string().nullable().optional(),
  primaryProjectId: z.string().nullable(),
  assigneeId: z.string().nullable(),
  status: z.enum(workStatuses).optional(),
  priority: z.enum(priorities),
  labelIds: z.array(z.string()).optional(),
})

const createDocumentBaseSchema = {
  title: z.string().trim().min(2).max(80),
}

export const documentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("team-document"),
    teamId: z.string().min(1),
    ...createDocumentBaseSchema,
  }),
  z.object({
    kind: z.literal("workspace-document"),
    workspaceId: z.string().min(1),
    ...createDocumentBaseSchema,
  }),
  z.object({
    kind: z.literal("private-document"),
    workspaceId: z.string().min(1),
    ...createDocumentBaseSchema,
  }),
])

export const commentSchema = z.object({
  targetType: z.enum(commentTargetTypes),
  targetId: z.string().min(1),
  parentCommentId: z.string().min(1).nullable().optional(),
  content: z.string().trim().min(2).max(4000),
})

export const workspaceChatSchema = z.object({
  workspaceId: z.string().min(1),
  participantIds: z.array(z.string().min(1)).min(1).max(24),
  title: z.string().trim().max(80).default(""),
  description: z.string().trim().max(180).default(""),
})

export const teamChatSchema = z.object({
  teamId: z.string().min(1),
  title: z.string().trim().max(80).default(""),
  description: z.string().trim().max(180).default(""),
})

export const channelSchema = z
  .object({
    teamId: z.string().min(1).optional(),
    workspaceId: z.string().min(1).optional(),
    title: z.string().trim().max(80).default(""),
    description: z.string().trim().max(180).default(""),
  })
  .superRefine((value, ctx) => {
    const targets =
      Number(Boolean(value.teamId)) + Number(Boolean(value.workspaceId))

    if (targets !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "Channel must target exactly one team or workspace",
      })
    }
  })

export const chatMessageSchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().trim().min(1).max(4000),
})

export const channelPostSchema = z.object({
  conversationId: z.string().min(1),
  title: z.string().trim().max(120).default(""),
  content: z
    .string()
    .trim()
    .max(8000)
    .refine((value) => getPlainTextContent(value).length >= 2, {
      message: "Post content must include at least 2 characters",
    }),
})

export const channelPostCommentSchema = z.object({
  postId: z.string().min(1),
  content: z
    .string()
    .trim()
    .max(4000)
    .refine((value) => getPlainTextContent(value).length >= 1, {
      message: "Comment content must include at least 1 character",
    }),
})

export const attachmentUploadUrlSchema = z.object({
  targetType: z.enum(attachmentTargetTypes),
  targetId: z.string().min(1),
})

export const settingsImageUploadKinds = [
  "user-avatar",
  "workspace-logo",
] as const
export type SettingsImageUploadKind = (typeof settingsImageUploadKinds)[number]

export const settingsImageUploadSchema = z.object({
  kind: z.enum(settingsImageUploadKinds),
})

export const attachmentSchema = z.object({
  targetType: z.enum(attachmentTargetTypes),
  targetId: z.string().min(1),
  storageId: z.string().min(1),
  fileName: z.string().trim().min(1).max(180),
  contentType: z.string().trim().min(1).max(120),
  size: z
    .number()
    .int()
    .min(1)
    .max(25 * 1024 * 1024),
})

const teamTemplateConfigSchema = z.object({
  defaultPriority: z.enum(priorities),
  targetWindowDays: z.number().int().min(3).max(180),
  defaultViewLayout: z.enum(viewLayouts),
  recommendedItemTypes: z.array(z.enum(workItemTypes)).min(1),
  summaryHint: z.string().trim().min(8).max(180),
})

export const teamWorkflowSettingsSchema = z.object({
  statusOrder: z
    .array(z.enum(workStatuses))
    .length(workStatuses.length)
    .refine(
      (values) => new Set(values).size === workStatuses.length,
      "Status order must include each status exactly once"
    ),
  templateDefaults: z.object({
    "software-delivery": teamTemplateConfigSchema,
    "bug-tracking": teamTemplateConfigSchema,
    "project-management": teamTemplateConfigSchema,
  }),
})
