import {
  getDisplayLabelForWorkItemType,
  type GroupField,
  type TeamExperienceType,
  type ViewDefinition,
  type WorkItemType,
} from "@/lib/domain/types"

type WorkGroupingLabelView = Pick<
  ViewDefinition,
  "entityKind" | "filters" | "itemLevel"
>

export type WorkGroupingLabelContext = {
  view?: WorkGroupingLabelView | null
  groupingExperience?: TeamExperienceType | null
}

const parentTypeByChildType: Partial<Record<WorkItemType, WorkItemType>> = {
  feature: "epic",
  requirement: "feature",
  story: "requirement",
  "sub-task": "task",
  "sub-issue": "issue",
}

function isPrivateTaskView(view: WorkGroupingLabelView | null | undefined) {
  return (
    view?.entityKind === "items" && view.filters.visibility?.includes("private")
  )
}

function getFallbackParentTypeForExperience(
  context: WorkGroupingLabelContext | undefined
): WorkItemType | null {
  if (isPrivateTaskView(context?.view)) {
    return "task"
  }

  if (context?.groupingExperience === "issue-analysis") {
    return "issue"
  }

  if (context?.groupingExperience === "project-management") {
    return "task"
  }

  return null
}

export function getParentGroupingType(
  context?: WorkGroupingLabelContext
): WorkItemType | null {
  const itemLevel = context?.view?.itemLevel ?? null

  if (itemLevel && parentTypeByChildType[itemLevel]) {
    return parentTypeByChildType[itemLevel] ?? null
  }

  return getFallbackParentTypeForExperience(context)
}

export function getParentGroupingLabel(
  context?: WorkGroupingLabelContext
): string {
  const parentType = getParentGroupingType(context)

  return parentType
    ? getDisplayLabelForWorkItemType(parentType, context?.groupingExperience)
    : "Parent"
}

export function getEmptyParentGroupingLabel(
  context?: WorkGroupingLabelContext
) {
  return `No ${getParentGroupingLabel(context).toLowerCase()}`
}

export function getGroupFieldOptionLabel(
  field: GroupField,
  context?: WorkGroupingLabelContext
) {
  if (field === "status") {
    return "Status"
  }

  if (field === "assignee") {
    return "Assignee"
  }

  if (field === "priority") {
    return "Priority"
  }

  if (field === "label") {
    return "Label"
  }

  if (field === "project") {
    return "Project"
  }

  if (field === "team") {
    return "Team"
  }

  if (field === "type") {
    return "Type"
  }

  if (field === "parent") {
    return getParentGroupingLabel(context)
  }

  if (field === "epic") {
    return "Epic"
  }

  if (field === "feature") {
    return "Feature"
  }

  if (field === "kind") {
    return "Kind"
  }

  if (field === "createdBy") {
    return "Created by"
  }

  return "Updated by"
}
