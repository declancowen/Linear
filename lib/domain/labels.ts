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
  void userId

  return getLabelScopeType(label) === "workspace"
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
    void userId
    return false
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
  void userId

  return getCustomPropertyScopeType(definition) === "team"
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
  void userId

  if (
    definition.isArchived ||
    definition.teamId !== item.teamId ||
    definition.targetType !== "workItem" ||
    getCustomPropertyScopeType(definition) !== "team" ||
    (item.visibility ?? "team") === "private"
  ) {
    return false
  }

  return true
}
