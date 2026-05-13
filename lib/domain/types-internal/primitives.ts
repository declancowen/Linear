import {
  profileStatusMessageConstraints,
  projectNameConstraints,
  viewNameConstraints,
} from "../input-constraints"

export const roles = ["admin", "member", "viewer", "guest"] as const
export type Role = (typeof roles)[number]

export const scopeTypes = ["team", "workspace"] as const
export type ScopeType = (typeof scopeTypes)[number]

export type TemplateType =
  | "software-delivery"
  | "bug-tracking"
  | "project-management"

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

export const workItemVisibilities = ["team", "private"] as const
export type WorkItemVisibility = (typeof workItemVisibilities)[number]

export const labelScopeTypes = ["workspace", "private"] as const
export type LabelScopeType = (typeof labelScopeTypes)[number]

export type LegacyWorkItemType = "bug"
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

export const projectNameMinLength = projectNameConstraints.min ?? 0
export const projectNameMaxLength = projectNameConstraints.max

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

export type NotificationType =
  | "mention"
  | "assignment"
  | "comment"
  | "message"
  | "invite"
  | "status-change"

export type NotificationEntityType =
  | "workItem"
  | "document"
  | "project"
  | "invite"
  | "channelPost"
  | "chat"
  | "team"
  | "workspace"

export const entityKinds = ["items", "projects", "docs"] as const
export type EntityKind = (typeof entityKinds)[number]

export const viewNameMinLength = viewNameConstraints.min ?? 0
export const viewNameMaxLength = viewNameConstraints.max

export const viewContainerTypes = ["project-items"] as const
export type ViewContainerType = (typeof viewContainerTypes)[number]

export const viewLayouts = ["list", "board", "timeline"] as const
export type ViewLayout = (typeof viewLayouts)[number]

export type ViewScopeType = "personal" | "team" | "workspace"

export const displayProperties = [
  "id",
  "type",
  "status",
  "assignee",
  "priority",
  "progress",
  "project",
  "team",
  "dueDate",
  "milestone",
  "labels",
  "created",
  "createdBy",
  "updated",
  "updatedBy",
  "kind",
  "linkedProjects",
  "linkedItems",
] as const
export type BuiltinDisplayProperty = (typeof displayProperties)[number]
export type CustomPropertyDisplayReference = `custom:${string}`
export type DisplayProperty =
  | BuiltinDisplayProperty
  | CustomPropertyDisplayReference

function isCustomPropertyDisplayReference(
  property: DisplayProperty | string
): property is CustomPropertyDisplayReference {
  return property.startsWith("custom:")
}

export function getCustomPropertyIdFromDisplayReference(
  property: DisplayProperty | string
) {
  return isCustomPropertyDisplayReference(property)
    ? property.slice("custom:".length)
    : null
}

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
  "kind",
  "createdBy",
  "updatedBy",
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
export const userStatusMessageMaxLength = profileStatusMessageConstraints.max
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

export type DocumentKind =
  | "team-document"
  | "workspace-document"
  | "private-document"
  | "item-description"

export type ConversationKind = "chat" | "channel"

export type ConversationScopeType = "workspace" | "team"

export type ConversationVariant = "direct" | "group" | "team"

export type ChatMessageKind = "text" | "call"

export const customPropertyTargetTypes = ["workItem"] as const
export type CustomPropertyTargetType =
  (typeof customPropertyTargetTypes)[number]

export const customPropertyScopeTypes = ["team", "private"] as const
export type CustomPropertyScopeType = (typeof customPropertyScopeTypes)[number]

export const customPropertyTypes = [
  "text",
  "integer",
  "date",
  "checkbox",
  "url",
  "email",
  "phone",
  "person",
  "select",
  "multiSelect",
] as const
export type CustomPropertyType = (typeof customPropertyTypes)[number]

export type CustomPropertyOption = {
  id: string
  label: string
  color: string
}

export type CustomPropertyValue = string | number | boolean | string[] | null

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
  updatedByIds?: string[]
  documentKinds?: DocumentKind[]
  linkedWorkItemIds?: string[]
  leadIds: string[]
  health: ProjectHealth[]
  milestoneIds: string[]
  relationTypes: string[]
  projectIds: string[]
  parentIds?: string[]
  itemTypes: WorkItemType[]
  labelIds: string[]
  teamIds: string[]
  visibility?: WorkItemVisibility[]
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

function createEmptyViewFilterSelections() {
  return {
    status: [],
    priority: [],
    assigneeIds: [],
    creatorIds: [],
    updatedByIds: [],
    documentKinds: [],
    linkedWorkItemIds: [],
    leadIds: [],
    health: [],
    milestoneIds: [],
    relationTypes: [],
    projectIds: [],
    parentIds: [],
    itemTypes: [],
    labelIds: [],
    teamIds: [],
    visibility: [],
  }
}

export function createDefaultViewFilters(): ViewFilters {
  return {
    ...createEmptyViewFilterSelections(),
    showCompleted: true,
  }
}

export function clearViewFilterSelections(filters: ViewFilters): ViewFilters {
  return {
    ...filters,
    ...createEmptyViewFilterSelections(),
  }
}

export function cloneViewFilters(
  filters: ViewFilters | undefined
): ViewFilters {
  if (!filters) {
    return createDefaultViewFilters()
  }

  return {
    ...filters,
    status: [...filters.status],
    priority: [...filters.priority],
    assigneeIds: [...filters.assigneeIds],
    creatorIds: [...filters.creatorIds],
    updatedByIds: [...(filters.updatedByIds ?? [])],
    documentKinds: [...(filters.documentKinds ?? [])],
    linkedWorkItemIds: [...(filters.linkedWorkItemIds ?? [])],
    leadIds: [...filters.leadIds],
    health: [...filters.health],
    milestoneIds: [...filters.milestoneIds],
    relationTypes: [...filters.relationTypes],
    projectIds: [...filters.projectIds],
    parentIds: [...(filters.parentIds ?? [])],
    itemTypes: [...filters.itemTypes],
    labelIds: [...filters.labelIds],
    teamIds: [...filters.teamIds],
    visibility: [...(filters.visibility ?? [])],
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
