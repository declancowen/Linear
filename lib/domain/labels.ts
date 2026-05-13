import type {
  CustomPropertyDefinition,
  Label,
  WorkItem,
} from "./types-internal/models"
import type {
  CustomPropertyScopeType,
  LabelScopeType,
} from "./types-internal/primitives"

export function sortLabelsByName<TLabel extends { name: string }>(
  labels: readonly TLabel[]
) {
  return [...labels].sort((left, right) => left.name.localeCompare(right.name))
}

export function getLabelScopeType(
  label: Pick<Label, "scopeType">
): LabelScopeType {
  return label.scopeType ?? "workspace"
}

export function isLabelVisibleToUser(
  label: Pick<Label, "ownerId" | "scopeType">,
  userId: string
) {
  return getLabelScopeType(label) === "workspace" || label.ownerId === userId
}

export function isLabelAssignableToWorkItem(
  label: Pick<Label, "ownerId" | "scopeType" | "workspaceId">,
  item: Pick<WorkItem, "visibility">,
  workspaceId: string,
  userId: string
) {
  if (label.workspaceId !== workspaceId) {
    return false
  }

  if ((item.visibility ?? "team") === "private") {
    return getLabelScopeType(label) === "private" && label.ownerId === userId
  }

  return getLabelScopeType(label) === "workspace"
}

export function getCustomPropertyScopeType(
  definition: Pick<CustomPropertyDefinition, "scopeType">
): CustomPropertyScopeType {
  return definition.scopeType ?? "team"
}

export function isCustomPropertyDefinitionVisibleToUser(
  definition: Pick<
    CustomPropertyDefinition,
    "createdBy" | "ownerId" | "scopeType"
  >,
  userId: string
) {
  return (
    getCustomPropertyScopeType(definition) === "team" ||
    (definition.ownerId ?? definition.createdBy) === userId
  )
}

export function isCustomPropertyDefinitionForWorkItem(
  definition: Pick<
    CustomPropertyDefinition,
    | "createdBy"
    | "isArchived"
    | "ownerId"
    | "scopeType"
    | "targetType"
    | "teamId"
  >,
  item: Pick<WorkItem, "teamId" | "visibility">,
  userId: string
) {
  if (
    definition.isArchived ||
    definition.teamId !== item.teamId ||
    definition.targetType !== "workItem"
  ) {
    return false
  }

  if ((item.visibility ?? "team") === "private") {
    return (
      getCustomPropertyScopeType(definition) === "private" &&
      (definition.ownerId ?? definition.createdBy) === userId
    )
  }

  return getCustomPropertyScopeType(definition) === "team"
}
