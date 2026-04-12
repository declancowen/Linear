import { z } from "zod"

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
  "community",
] as const
export type TeamExperienceType = (typeof teamExperienceTypes)[number]

export const workItemTypes = [
  "epic",
  "feature",
  "requirement",
  "task",
  "bug",
  "sub-task",
  "qa-task",
  "test-case",
] as const
export type WorkItemType = (typeof workItemTypes)[number]

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
  "team",
  "type",
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

export interface Workspace {
  id: string
  slug: string
  name: string
  logoUrl: string
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
  workosUserId: string | null
  title: string
  preferences: {
    emailMentions: boolean
    emailAssignments: boolean
    emailDigest: boolean
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
  entityType: "workItem" | "document" | "project" | "invite"
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
  createdBy: string
  createdAt: string
  updatedAt: string
  lastActivityAt: string
}

export interface ChatMessage {
  id: string
  conversationId: string
  content: string
  mentionUserIds: string[]
  createdBy: string
  createdAt: string
}

export interface ChannelPost {
  id: string
  conversationId: string
  title: string
  content: string
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
  rolePreview: Role | null
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
    itemTypes: WorkItemType[]
  }
> = {
  "software-delivery": {
    label: "Software Delivery",
    description: "Epics, features, requirements, tasks, and bugs.",
    itemTypes: ["epic", "feature", "requirement", "task", "bug", "sub-task"],
  },
  "bug-tracking": {
    label: "Bug Tracking / QA",
    description: "Bugs, QA tasks, and test cases.",
    itemTypes: ["bug", "qa-task", "test-case", "sub-task"],
  },
  "project-management": {
    label: "Project Management",
    description: "Tasks and sub-tasks with milestones.",
    itemTypes: ["task", "sub-task"],
  },
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
    description:
      "Issues, projects, and views are always enabled. Docs, chat, and channels are optional.",
  },
  "issue-analysis": {
    label: "Issue Analysis",
    description:
      "Operational triage and analysis. Issues, projects, and views stay on; docs, chat, and channels are optional.",
  },
  community: {
    label: "Community",
    description:
      "A lighter collaboration space that supports either chat or channels, but never both at once.",
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
    label: "Channels",
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
      channels: false,
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
    if (features.issues || features.projects || features.views || features.docs) {
      return "Community teams can only enable chat or channels."
    }

    if (Number(features.chat) + Number(features.channels) !== 1) {
      return "Community teams must enable exactly one of chat or channels."
    }

    return null
  }

  if (!features.issues || !features.projects || !features.views) {
    return "Software development and issue analysis teams must include issues, projects, and views."
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

export function createDefaultTeamWorkflowSettings(): TeamWorkflowSettings {
  return {
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
          "task",
          "bug",
          "sub-task",
        ],
        summaryHint:
          "Delivery plan spanning epics, features, requirements, and execution work.",
      },
      "bug-tracking": {
        defaultPriority: "high",
        targetWindowDays: 14,
        defaultViewLayout: "list",
        recommendedItemTypes: ["bug", "qa-task", "test-case", "sub-task"],
        summaryHint:
          "QA-driven stabilization plan focused on defects, verification, and regression control.",
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
}

export const statusMeta: Record<WorkStatus, { label: string }> = {
  backlog: { label: "Backlog" },
  todo: { label: "Todo" },
  "in-progress": { label: "In Progress" },
  done: { label: "Done" },
  cancelled: { label: "Cancelled" },
  duplicate: { label: "Duplicate" },
}

export const priorityMeta: Record<Priority, { label: string; weight: number }> = {
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

export const workItemTypeMeta: Record<WorkItemType, { label: string }> = {
  epic: { label: "Epic" },
  feature: { label: "Feature" },
  requirement: { label: "Requirement" },
  task: { label: "Task" },
  bug: { label: "Bug" },
  "sub-task": { label: "Sub-task" },
  "qa-task": { label: "QA Task" },
  "test-case": { label: "Test Case" },
}

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
  accent: z.string().trim().min(2).max(24),
  description: z.string().trim().min(8).max(220),
})

export const teamDetailsSchema = z.object({
  name: z.string().trim().min(2).max(48),
  icon: z.string().trim().min(1).max(32),
  summary: z.string().trim().min(8).max(180),
  joinCode: z
    .string()
    .trim()
    .min(4)
    .max(24)
    .regex(/^[a-zA-Z0-9_-]+$/, "Join code can only contain letters, numbers, dashes, and underscores"),
  experience: z.enum(teamExperienceTypes),
  features: z.object({
    issues: z.boolean(),
    projects: z.boolean(),
    views: z.boolean(),
    docs: z.boolean(),
    chat: z.boolean(),
    channels: z.boolean(),
  }),
}).superRefine((value, ctx) => {
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
  teamIcon: z.string().trim().min(1).max(32),
  teamSummary: z.string().trim().min(8).max(180),
  teamJoinCode: z
    .string()
    .trim()
    .min(4)
    .max(24)
    .regex(/^[a-zA-Z0-9_-]+$/, "Join code can only contain letters, numbers, dashes, and underscores"),
  email: z.email(),
  userName: z.string().trim().min(2).max(80),
  avatarUrl: z.string().trim().min(1).max(24),
  workosUserId: z.string().trim().min(1),
  role: z.enum(roles).default("admin"),
})

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(48),
  title: z.string().trim().min(2).max(72),
  avatarUrl: z.string().trim().min(1),
  preferences: z.object({
    emailMentions: z.boolean(),
    emailAssignments: z.boolean(),
    emailDigest: z.boolean(),
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
})

export const workItemSchema = z.object({
  teamId: z.string().min(1),
  type: z.enum(workItemTypes),
  title: z.string().trim().min(2).max(96),
  primaryProjectId: z.string().nullable(),
  assigneeId: z.string().nullable(),
  priority: z.enum(priorities),
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
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().max(180).default(""),
})

export const channelSchema = z.object({
  teamId: z.string().min(1),
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().min(2).max(180),
})

export const chatMessageSchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().trim().min(1).max(4000),
})

export const channelPostSchema = z.object({
  conversationId: z.string().min(1),
  title: z.string().trim().min(2).max(120),
  content: z.string().trim().min(2).max(8000),
})

export const channelPostCommentSchema = z.object({
  postId: z.string().min(1),
  content: z.string().trim().min(1).max(4000),
})

export const attachmentUploadUrlSchema = z.object({
  targetType: z.enum(attachmentTargetTypes),
  targetId: z.string().min(1),
})

export const attachmentSchema = z.object({
  targetType: z.enum(attachmentTargetTypes),
  targetId: z.string().min(1),
  storageId: z.string().min(1),
  fileName: z.string().trim().min(1).max(180),
  contentType: z.string().trim().min(1).max(120),
  size: z.number().int().min(1).max(25 * 1024 * 1024),
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
