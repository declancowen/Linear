"use client"

import { toast } from "sonner"

import {
  syncArchiveCustomPropertyDefinition,
  syncCreateCustomPropertyDefinition,
  syncSetCustomPropertyValue,
  syncUpdateCustomPropertyDefinition,
} from "@/lib/convex/client"
import { customPropertyDefinitionSchema } from "@/lib/domain/types"
import { isCustomPropertyDefinitionForWorkItem } from "@/lib/domain/labels"

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

function canEditCustomProperties(state: AppStore, teamId: string) {
  const role = effectiveRole(state, teamId)

  return role === "admin" || role === "member"
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
        targetType: "workItem",
        options: input.options ?? [],
      })

      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Property is invalid")
        return null
      }

      const state = get()
      const team = state.teams.find((entry) => entry.id === parsed.data.teamId)
      const scopeType = parsed.data.scopeType ?? "team"

      if (!team) {
        toast.error("Team not found")
        return null
      }

      if (!canEditCustomProperties(state, team.id)) {
        toast.error("Your current role is read-only")
        return null
      }

      const duplicate = state.customPropertyDefinitions.find(
        (definition) =>
          !definition.isArchived &&
          definition.teamId === team.id &&
          (definition.scopeType ?? "team") === scopeType &&
          (definition.ownerId ?? null) ===
            (scopeType === "private" ? state.currentUserId : null) &&
          definition.name.trim().toLowerCase() ===
            parsed.data.name.trim().toLowerCase()
      )

      if (duplicate) {
        toast.error("A property with this name already exists")
        return null
      }

      const now = getNow()
      const optimisticDefinition = {
        id: createId("property"),
        workspaceId: team.workspaceId,
        teamId: team.id,
        scopeType,
        ownerId: scopeType === "private" ? state.currentUserId : null,
        targetType: "workItem" as const,
        name: parsed.data.name.trim(),
        icon: parsed.data.icon,
        type: parsed.data.type,
        options: parsed.data.options,
        isArchived: false,
        createdBy: state.currentUserId,
        createdAt: now,
        updatedAt: now,
      }

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
      const state = get()
      const definition = state.customPropertyDefinitions.find(
        (entry) => entry.id === propertyId
      )

      if (!definition) {
        toast.error("Property not found")
        return false
      }

      if (!canEditCustomProperties(state, definition.teamId)) {
        toast.error("Your current role is read-only")
        return false
      }

      set((current) => ({
        customPropertyDefinitions: current.customPropertyDefinitions.map(
          (entry) =>
            entry.id === propertyId
              ? {
                  ...entry,
                  ...patch,
                  updatedAt: getNow(),
                }
              : entry
        ),
      }))

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
      const definition = get().customPropertyDefinitions.find(
        (entry) => entry.id === propertyId
      )

      if (!definition) {
        toast.error("Property not found")
        return false
      }

      set((current) => ({
        customPropertyDefinitions: current.customPropertyDefinitions.map(
          (entry) =>
            entry.id === propertyId
              ? { ...entry, isArchived: true, updatedAt: getNow() }
              : entry
        ),
      }))

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
    setCustomPropertyValue(workItemId, propertyId, value) {
      const state = get()
      const item = state.workItems.find((entry) => entry.id === workItemId)
      const definition = state.customPropertyDefinitions.find(
        (entry) => entry.id === propertyId && !entry.isArchived
      )

      if (
        !item ||
        !definition ||
        !isCustomPropertyDefinitionForWorkItem(
          definition,
          item,
          state.currentUserId
        )
      ) {
        toast.error("Property not found")
        return
      }

      if (!canEditCustomProperties(state, item.teamId)) {
        toast.error("Your current role is read-only")
        return
      }

      set((current) => {
        const existing = current.customPropertyValues.find(
          (entry) =>
            entry.workItemId === workItemId && entry.propertyId === propertyId
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
              workspaceId: definition.workspaceId,
              teamId: definition.teamId,
              workItemId,
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
        syncSetCustomPropertyValue(workItemId, propertyId, value),
        "Failed to update property"
      )
    },
  }
}
