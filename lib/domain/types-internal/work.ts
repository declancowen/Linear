import type { WorkItem } from "./models"
import type {
  Priority,
  ProjectHealth,
  ProjectStatus,
  StoredWorkItemType,
  TeamExperienceType,
  TeamFeatureSettings,
  TeamIconToken,
  TeamWorkflowSettings,
  TemplateType,
  WorkItemType,
  WorkStatus,
} from "./primitives"
import {
  workStatuses,
  teamIconTokens,
} from "./primitives"

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
    description: "Epics, features, requirements, and stories.",
    icon: "code",
    itemTypes: ["epic", "feature", "requirement", "story"],
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

export function getDefaultViewItemLevelForTeamExperience(
  experience: TeamExperienceType | null | undefined
): WorkItemType | null {
  return getDefaultRootWorkItemTypesForTeamExperience(experience)[0] ?? null
}

export function getDefaultViewItemLevelForProjectTemplate(
  templateType: TemplateType | null | undefined
): WorkItemType | null {
  if (!templateType) {
    return null
  }

  return getAllowedRootWorkItemTypesForTemplate(templateType)[0] ?? null
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
    description: "Epics, features, requirements, and stories.",
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
    if (features.issues || features.projects || features.views) {
      return "Community teams can only enable docs, chat, and channel surfaces."
    }

    if (!features.docs && !features.chat && !features.channels) {
      return "Community teams must enable docs, chat, channel, or a combination."
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
        recommendedItemTypes: ["epic", "feature", "requirement", "story"],
        summaryHint:
          "Delivery plan spanning epics, features, requirements, and stories.",
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

export function isCompletedWorkStatus(status: WorkStatus) {
  return status === "done"
}

export function isExcludedFromWorkStatusRollup(status: WorkStatus) {
  return status === "cancelled" || status === "duplicate"
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
  experience: TeamExperienceType | null | undefined
) {
  void experience
  return workItemTypeMeta[itemType].label
}

export function getDisplayPluralLabelForWorkItemType(
  itemType: WorkItemType,
  experience: TeamExperienceType | null | undefined
) {
  void experience
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

export function normalizeStoredViewItemLevel(
  itemLevel: StoredWorkItemType | WorkItemType | null | undefined,
  experience?: TeamExperienceType | null
) {
  if (!itemLevel) {
    return null
  }

  if (!experience) {
    return itemLevel === "bug" ? "issue" : itemLevel
  }

  return normalizeStoredWorkItemType(itemLevel, experience, {
    parentId: null,
  })
}

export function getSingleChildWorkItemType(
  parentType: WorkItemType | null | undefined
) {
  if (!parentType) {
    return null
  }

  const allowedChildTypes = getAllowedChildWorkItemTypes(parentType)

  return allowedChildTypes.length === 1 ? allowedChildTypes[0] : null
}

export function getDefaultShowChildItemsForItemLevel(
  itemLevel: WorkItemType | null | undefined
) {
  return getSingleChildWorkItemType(itemLevel) !== null
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

  const childType = getSingleChildWorkItemType(parentType)

  if (!childType) {
    return {
      childType: null,
      childLabel: workCopy.singularLabel,
      childPluralLabel: workCopy.childPluralLabel,
      addChildLabel: workCopy.addChildLabel,
      createChildLabel: workCopy.createChildLabel,
      titlePlaceholder: workCopy.titlePlaceholder,
    }
  }

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
