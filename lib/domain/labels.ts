import type {
  CustomPropertyDefinition,
  Document,
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
  const scopeType = getLabelScopeType(label)

  return (
    scopeType === "workspace" ||
    (scopeType === "private" && label.ownerId === userId)
  )
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
  const scopeType = getCustomPropertyScopeType(definition)

  return (
    scopeType === "team" ||
    (scopeType === "private" &&
      (definition.ownerId ?? definition.createdBy) === userId)
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
    | "workspaceId"
  >,
  item: Pick<WorkItem, "creatorId" | "teamId" | "visibility" | "workspaceId">,
  userId: string
) {
  if (definition.isArchived || definition.targetType !== "workItem") {
    return false
  }

  if ((item.visibility ?? "team") === "private") {
    return (
      getCustomPropertyScopeType(definition) === "private" &&
      definition.workspaceId === item.workspaceId &&
      (definition.ownerId ?? definition.createdBy) === userId &&
      item.creatorId === userId
    )
  }

  return (
    getCustomPropertyScopeType(definition) === "team" &&
    definition.teamId === item.teamId
  )
}

export function isCustomPropertyDefinitionForDocument(
  definition: Pick<
    CustomPropertyDefinition,
    | "createdBy"
    | "isArchived"
    | "ownerId"
    | "scopeType"
    | "targetType"
    | "teamId"
    | "workspaceId"
  >,
  document: Pick<Document, "createdBy" | "kind" | "teamId" | "workspaceId">,
  userId: string
) {
  if (definition.isArchived || definition.targetType !== "document") {
    return false
  }

  if (document.kind === "item-description") {
    return false
  }

  if (document.kind === "private-document") {
    return (
      getCustomPropertyScopeType(definition) === "private" &&
      definition.workspaceId === document.workspaceId &&
      (definition.ownerId ?? definition.createdBy) === userId &&
      document.createdBy === userId
    )
  }

  if (document.kind === "team-document") {
    return (
      getCustomPropertyScopeType(definition) === "team" &&
      definition.teamId === document.teamId
    )
  }

  return (
    getCustomPropertyScopeType(definition) === "workspace" &&
    definition.workspaceId === document.workspaceId
  )
}
