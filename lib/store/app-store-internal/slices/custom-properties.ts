"use client"

import { toast } from "sonner"

import {
  syncArchiveCustomPropertyDefinition,
  syncCreateCustomPropertyDefinition,
  syncSetCustomPropertyValue,
  syncUpdateCustomPropertyDefinition,
} from "@/lib/convex/client"
import {
  customPropertyDefinitionSchema,
  type CustomPropertyDefinition,
} from "@/lib/domain/types"
import {
  isCustomPropertyDefinitionForDocument,
  isCustomPropertyDefinitionForWorkItem,
} from "@/lib/domain/labels"
import { canEditWorkspace, hasWorkspaceAccess } from "@/lib/domain/selectors"

import { createId, getNow } from "../helpers"
import { createStoreRuntime } from "../runtime"
import { effectiveRole } from "../validation"
import type { AppStore, AppStoreGet, AppStoreSet } from "../types"

type CustomPropertySlice = Pick<
  AppStore,
  | "createCustomPropertyDefinition"
  | "updateCustomPropertyDefinition"
  | "archiveCustomPropertyDefinition"
  | "setCustomPropertyValue"
>

type CreateCustomPropertyDefinitionData = {
  icon: string
  name: string
  options: CustomPropertyDefinition["options"]
  targetType?: CustomPropertyDefinition["targetType"]
  type: CustomPropertyDefinition["type"]
} & (
  | {
      scopeType: "private"
      workspaceId: string
    }
  | {
      scopeType: "workspace"
      workspaceId: string
    }
  | {
      scopeType?: "team"
      teamId?: string
    }
)

type CreateCustomPropertyDefinitionScope =
  | {
      ok: true
      duplicateScope: Parameters<
        typeof hasDuplicateCustomPropertyDefinition
      >[0]["scope"]
      ownerId: string | null
      scopeType: "team" | "workspace" | "private"
      teamId: string | null
      workspaceId: string
    }
  | {
      ok: false
      message: string
    }

function canEditCustomProperties(
  state: AppStore,
  teamId: string | null | undefined
) {
  const role = effectiveRole(state, teamId)

  return role === "admin" || role === "member"
}

function canEditPrivateCustomProperties(
  state: AppStore,
  workspaceId: string | null | undefined
) {
  return Boolean(
    workspaceId && hasWorkspaceAccess(state, workspaceId, state.currentUserId)
  )
}

function getEditableCustomPropertyDefinition(
  state: AppStore,
  propertyId: string
) {
  const definition = state.customPropertyDefinitions.find(
    (entry) => entry.id === propertyId
  )

  if (!definition) {
    return { ok: false as const, message: "Property not found" }
  }

  const scopeType = definition.scopeType ?? "team"
  const canEdit =
    scopeType === "private"
      ? (definition.ownerId ?? definition.createdBy) === state.currentUserId &&
        canEditPrivateCustomProperties(state, definition.workspaceId)
      : scopeType === "workspace"
        ? canEditWorkspace(state, definition.workspaceId)
        : canEditCustomProperties(state, definition.teamId)

  if (!canEdit) {
    return { ok: false as const, message: "Your current role is read-only" }
  }

  return { ok: true as const, definition }
}

function updateCustomPropertyDefinitionEntry(
  current: AppStore,
  propertyId: string,
  patch: Partial<CustomPropertyDefinition>
) {
  return {
    customPropertyDefinitions: current.customPropertyDefinitions.map((entry) =>
      entry.id === propertyId ? { ...entry, ...patch, updatedAt: getNow() } : entry
    ),
  }
}

function getActiveCustomPropertyDefinition(state: AppStore, propertyId: string) {
  return state.customPropertyDefinitions.find(
    (entry) => entry.id === propertyId && !entry.isArchived
  )
}

function canEditDocumentCustomPropertyValue(
  state: AppStore,
  definition: CustomPropertyDefinition,
  document: AppStore["documents"][number]
) {
  const scopeType = definition.scopeType ?? "team"

  if (scopeType === "private") {
    return (
      document.createdBy === state.currentUserId &&
      canEditPrivateCustomProperties(state, document.workspaceId)
    )
  }

  if (scopeType === "workspace") {
    return canEditWorkspace(state, document.workspaceId)
  }

  return canEditCustomProperties(state, document.teamId)
}

function canEditWorkItemCustomPropertyValue(
  state: AppStore,
  definition: CustomPropertyDefinition,
  item: AppStore["workItems"][number]
) {
  const scopeType = definition.scopeType ?? "team"

  if (scopeType === "private") {
    return canEditPrivateCustomProperties(state, item.workspaceId)
  }

  if (scopeType === "workspace") {
    return Boolean(item.workspaceId && canEditWorkspace(state, item.workspaceId))
  }

  return canEditCustomProperties(state, item.teamId)
}

function getEditableDocumentCustomPropertyValueTarget(
  state: AppStore,
  definition: CustomPropertyDefinition,
  targetId: string
) {
  const document = state.documents.find((entry) => entry.id === targetId)
  if (
    !document ||
    !isCustomPropertyDefinitionForDocument(
      definition,
      document,
      state.currentUserId
    )
  ) {
    return { ok: false as const, message: "Property not found" }
  }

  if (!canEditDocumentCustomPropertyValue(state, definition, document)) {
    return { ok: false as const, message: "Your current role is read-only" }
  }

  return { ok: true as const, definition, targetId, targetType: "document" }
}

function getEditableWorkItemCustomPropertyValueTarget(
  state: AppStore,
  definition: CustomPropertyDefinition,
  targetId: string
) {
  const item = state.workItems.find((entry) => entry.id === targetId)

  if (
    !item ||
    !isCustomPropertyDefinitionForWorkItem(
      definition,
      item,
      state.currentUserId
    )
  ) {
    return { ok: false as const, message: "Property not found" }
  }

  if (!canEditWorkItemCustomPropertyValue(state, definition, item)) {
    return { ok: false as const, message: "Your current role is read-only" }
  }

  return {
    ok: true as const,
    definition,
    targetId: item.id,
    targetType: "workItem",
  }
}

function getEditableCustomPropertyValueTarget(
  state: AppStore,
  targetType: "workItem" | "document",
  targetId: string,
  propertyId: string
) {
  const definition = getActiveCustomPropertyDefinition(state, propertyId)

  if (!definition) {
    return { ok: false as const, message: "Property not found" }
  }

  return targetType === "document"
    ? getEditableDocumentCustomPropertyValueTarget(state, definition, targetId)
    : getEditableWorkItemCustomPropertyValueTarget(state, definition, targetId)
}

function hasDuplicateCustomPropertyDefinition(input: {
  state: AppStore
  scope:
    | {
        type: "team"
        teamId: string
      }
    | {
        type: "workspace"
        workspaceId: string
      }
    | {
        type: "private"
        ownerId: string
        workspaceId: string
      }
  name: string
  targetType: CustomPropertyDefinition["targetType"]
}) {
  const normalizedName = input.name.trim().toLowerCase()

  return input.state.customPropertyDefinitions.some(
    (definition) =>
      !definition.isArchived &&
      (definition.targetType ?? "workItem") === input.targetType &&
      (definition.scopeType ?? "team") === input.scope.type &&
      (input.scope.type === "team"
        ? definition.teamId === input.scope.teamId
        : input.scope.type === "workspace"
          ? definition.workspaceId === input.scope.workspaceId
          : definition.workspaceId === input.scope.workspaceId &&
            (definition.ownerId ?? definition.createdBy) ===
              input.scope.ownerId) &&
      definition.name.trim().toLowerCase() === normalizedName
  )
}

function resolveCreateCustomPropertyDefinitionScope(
  state: AppStore,
  input: CreateCustomPropertyDefinitionData
): CreateCustomPropertyDefinitionScope {
  if (input.scopeType === "private") {
    if (!canEditPrivateCustomProperties(state, input.workspaceId)) {
      return { ok: false, message: "Your current role is read-only" }
    }

    return {
      ok: true,
      duplicateScope: {
        type: "private",
        ownerId: state.currentUserId,
        workspaceId: input.workspaceId,
      },
      ownerId: state.currentUserId,
      scopeType: "private",
      teamId: null,
      workspaceId: input.workspaceId,
    }
  }

  if (input.scopeType === "workspace") {
    if (!canEditWorkspace(state, input.workspaceId)) {
      return { ok: false, message: "Your current role is read-only" }
    }

    return {
      ok: true,
      duplicateScope: {
        type: "workspace",
        workspaceId: input.workspaceId,
      },
      ownerId: null,
      scopeType: "workspace",
      teamId: null,
      workspaceId: input.workspaceId,
    }
  }

  const teamIdInput = input.teamId

  if (!teamIdInput) {
    return { ok: false, message: "Property scope is invalid" }
  }

  const team = state.teams.find((entry) => entry.id === teamIdInput)

  if (!team) {
    return { ok: false, message: "Team not found" }
  }

  if (!canEditCustomProperties(state, team.id)) {
    return { ok: false, message: "Your current role is read-only" }
  }

  return {
    ok: true,
    duplicateScope: {
      type: "team",
      teamId: team.id,
    },
    ownerId: null,
    scopeType: "team",
    teamId: team.id,
    workspaceId: team.workspaceId,
  }
}

function createOptimisticCustomPropertyDefinition(input: {
  data: CreateCustomPropertyDefinitionData
  scope: Extract<CreateCustomPropertyDefinitionScope, { ok: true }>
  state: AppStore
}): CustomPropertyDefinition {
  const now = getNow()

  return {
    id: createId("property"),
    workspaceId: input.scope.workspaceId,
    teamId: input.scope.teamId,
    scopeType: input.scope.scopeType,
    ownerId: input.scope.ownerId,
    targetType: input.data.targetType ?? "workItem",
    name: input.data.name.trim(),
    icon: input.data.icon,
    type: input.data.type,
    options: input.data.options,
    isArchived: false,
    createdBy: input.state.currentUserId,
    createdAt: now,
    updatedAt: now,
  }
}

export function createCustomPropertySlice(
  set: AppStoreSet,
  get: AppStoreGet,
  runtime: ReturnType<typeof createStoreRuntime>
): CustomPropertySlice {
  return {
    async createCustomPropertyDefinition(input) {
      const parsed = customPropertyDefinitionSchema.safeParse({
        ...input,
        targetType: input.targetType ?? "workItem",
        options: input.options ?? [],
      })

      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Property is invalid")
        return null
      }

      const state = get()
      const scope = resolveCreateCustomPropertyDefinitionScope(
        state,
        parsed.data
      )

      if (!scope.ok) {
        toast.error(scope.message)
        return null
      }

      if (
        hasDuplicateCustomPropertyDefinition({
          state,
          scope: scope.duplicateScope,
          name: parsed.data.name,
          targetType: parsed.data.targetType,
        })
      ) {
        toast.error("A property with this name already exists")
        return null
      }

      const optimisticDefinition = createOptimisticCustomPropertyDefinition({
        data: parsed.data,
        scope,
        state,
      })

      set((current) => ({
        customPropertyDefinitions: [
          optimisticDefinition,
          ...current.customPropertyDefinitions,
        ],
      }))

      try {
        const result = await syncCreateCustomPropertyDefinition(parsed.data)

        if (result?.property && typeof result.property === "object") {
          await runtime.refreshFromServer()
        }

        toast.success("Property created")
        return optimisticDefinition
      } catch (error) {
        set((current) => ({
          customPropertyDefinitions: current.customPropertyDefinitions.filter(
            (definition) => definition.id !== optimisticDefinition.id
          ),
        }))
        console.error(error)
        toast.error(
          error instanceof Error ? error.message : "Failed to create property"
        )
        return null
      }
    },
    async updateCustomPropertyDefinition(propertyId, patch) {
      const validation = getEditableCustomPropertyDefinition(get(), propertyId)

      if (!validation.ok) {
        toast.error(validation.message)
        return false
      }

      set((current) =>
        updateCustomPropertyDefinitionEntry(current, propertyId, patch)
      )

      try {
        await syncUpdateCustomPropertyDefinition(propertyId, patch)
        toast.success("Property updated")
        return true
      } catch (error) {
        console.error(error)
        await runtime.refreshFromServer()
        toast.error(
          error instanceof Error ? error.message : "Failed to update property"
        )
        return false
      }
    },
    async archiveCustomPropertyDefinition(propertyId) {
      const validation = getEditableCustomPropertyDefinition(get(), propertyId)

      if (!validation.ok) {
        toast.error(validation.message)
        return false
      }

      set((current) =>
        updateCustomPropertyDefinitionEntry(current, propertyId, {
          isArchived: true,
        })
      )

      try {
        await syncArchiveCustomPropertyDefinition(propertyId)
        toast.success("Property removed")
        return true
      } catch (error) {
        console.error(error)
        await runtime.refreshFromServer()
        toast.error(
          error instanceof Error ? error.message : "Failed to remove property"
        )
        return false
      }
    },
    setCustomPropertyValue(targetType, targetId, propertyId, value) {
      const target = getEditableCustomPropertyValueTarget(
        get(),
        targetType,
        targetId,
        propertyId
      )

      if (!target.ok) {
        toast.error(target.message)
        return
      }

      set((current) => {
        const existing = current.customPropertyValues.find(
          (entry) =>
            (entry.targetType ?? "workItem") === targetType &&
            (entry.targetId ?? entry.workItemId) === targetId &&
            entry.propertyId === propertyId
        )

        if (value === null) {
          return {
            customPropertyValues: current.customPropertyValues.filter(
              (entry) => entry !== existing
            ),
          }
        }

        if (existing) {
          return {
            customPropertyValues: current.customPropertyValues.map((entry) =>
              entry === existing
                ? {
                    ...entry,
                    value,
                    updatedBy: current.currentUserId,
                    updatedAt: getNow(),
                  }
                : entry
            ),
          }
        }

        const now = getNow()
        return {
          customPropertyValues: [
            {
              id: createId("property_value"),
              workspaceId: target.definition.workspaceId,
              teamId: target.definition.teamId,
              targetType,
              targetId,
              ...(targetType === "workItem" ? { workItemId: targetId } : {}),
              propertyId,
              value,
              createdBy: current.currentUserId,
              updatedBy: current.currentUserId,
              createdAt: now,
              updatedAt: now,
            },
            ...current.customPropertyValues,
          ],
        }
      })

      runtime.syncInBackground(
        syncSetCustomPropertyValue(targetType, targetId, propertyId, value),
        "Failed to update property"
      )
    },
  }
}
