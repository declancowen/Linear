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
  "backlog",
  "planned",
  "in-progress",
  "completed",
  "cancelled",
] as const
export type ProjectStatus = (typeof projectStatuses)[number]

export const viewFilterStatuses = [
  "backlog",
  "todo",
  "in-progress",
  "done",
  "cancelled",
  "duplicate",
  "planned",
  "completed",
] as const
export type ViewFilterStatus = (typeof viewFilterStatuses)[number]

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
  "team",
  "workspace",
] as const
export type NotificationEntityType = (typeof notificationEntityTypes)[number]

export const entityKinds = ["items", "projects", "docs"] as const
export type EntityKind = (typeof entityKinds)[number]

export const viewContainerTypes = ["project-items"] as const
export type ViewContainerType = (typeof viewContainerTypes)[number]

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
  "progress",
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

export const userStatuses = [
  "offline",
  "active",
  "away",
  "busy",
  "out-of-office",
] as const
export type UserStatus = (typeof userStatuses)[number]
export const userStatusMessageMaxLength = 80
export const userStatusMeta: Record<
  UserStatus,
  {
    label: string
    description: string
    colorClassName: string
  }
> = {
  offline: {
    label: "Offline",
    description: "Not currently active in the workspace.",
    colorClassName: "bg-zinc-400",
  },
  active: {
    label: "Online",
    description: "Available and following along.",
    colorClassName: "bg-emerald-500",
  },
  away: {
    label: "Away",
    description: "Stepped away for a bit.",
    colorClassName: "bg-amber-400",
  },
  busy: {
    label: "Busy",
    description: "Heads down and minimizing interruptions.",
    colorClassName: "bg-rose-500",
  },
  "out-of-office": {
    label: "Out of office",
    description: "Offline for the day or longer.",
    colorClassName: "bg-purple-500",
  },
}

export function resolveUserStatus(
  status: UserStatus | null | undefined
): UserStatus {
  return userStatuses.includes(status as UserStatus)
    ? (status as UserStatus)
    : "offline"
}

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

export const EMPTY_PARENT_FILTER_VALUE = "__empty__"

export type ViewFilters = {
  status: ViewFilterStatus[]
  priority: Priority[]
  assigneeIds: string[]
  creatorIds: string[]
  leadIds: string[]
  health: ProjectHealth[]
  milestoneIds: string[]
  relationTypes: string[]
  projectIds: string[]
  parentIds?: string[]
  itemTypes: WorkItemType[]
  labelIds: string[]
  teamIds: string[]
  showCompleted: boolean
}

export interface ProjectPresentationConfig {
  itemLevel?: WorkItemType | null
  showChildItems?: boolean
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
    parentIds: [],
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
    showChildItems: false,
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
