"use client"

import { toast } from "sonner"

import {
  syncCreateProject,
  syncDeleteProject,
  syncRenameProject,
  syncUpdateProject,
} from "@/lib/convex/client"
import {
  addLocalCalendarDays,
  formatLocalCalendarDate,
} from "@/lib/calendar-date"
import {
  createDefaultProjectPresentationConfig,
  projectNameMaxLength,
  projectNameMinLength,
  projectSchema,
  templateMeta,
} from "@/lib/domain/types"

import { createId, getNow } from "../helpers"
import { getNextStateAfterProjectRemoval } from "../domain-updates"
import { createStoreRuntime } from "../runtime"
import {
  canEditWorkspaceDocuments,
  effectiveRole,
  getProjectCreationValidationMessage,
  getTeamWorkflowSettings,
} from "../validation"
import type { AppStore, AppStoreGet, AppStoreSet } from "../types"

type ProjectSlice = Pick<
  AppStore,
  "createProject" | "renameProject" | "deleteProject" | "updateProject"
>

export function createProjectSlice(
  set: AppStoreSet,
  get: AppStoreGet,
  runtime: ReturnType<typeof createStoreRuntime>
): ProjectSlice {
  return {
    createProject(input) {
      const parsed = projectSchema.safeParse(input)
      if (!parsed.success) {
        toast.error("Project input is invalid")
        return
      }

      const validationMessage = getProjectCreationValidationMessage(
        get(),
        parsed.data
      )

      if (validationMessage) {
        toast.error(validationMessage)
        return
      }

      if (parsed.data.scopeType !== "team") {
        toast.error("Projects must belong to a team space")
        return
      }

      const role = effectiveRole(get(), parsed.data.scopeId)

      if (role === "viewer" || role === "guest" || !role) {
        toast.error("Your current role is read-only")
        return
      }

      const resolvedLeadId = parsed.data.leadId ?? get().currentUserId

      if (!resolvedLeadId) {
        toast.error("Lead is required to create a project")
        return
      }

      const workflowSettings = getTeamWorkflowSettings(get(), parsed.data.scopeId)
      const templateDefaults =
        workflowSettings.templateDefaults[parsed.data.templateType]
      const resolvedStartDate =
        parsed.data.startDate ?? formatLocalCalendarDate()
      const resolvedTargetDate =
        parsed.data.targetDate ??
        addLocalCalendarDays(templateDefaults.targetWindowDays)

      set((state) => {
        const presentation =
          parsed.data.presentation ??
          createDefaultProjectPresentationConfig(parsed.data.templateType, {
            layout: templateDefaults.defaultViewLayout,
          })
        const resolvedMemberIds = [
          ...new Set([...(parsed.data.memberIds ?? []), resolvedLeadId]),
        ]
        const project = {
          id: createId("project"),
          scopeType: parsed.data.scopeType,
          scopeId: parsed.data.scopeId,
          templateType: parsed.data.templateType,
          name: parsed.data.name,
          summary: parsed.data.summary,
          description: `${parsed.data.name} was created from the ${parsed.data.templateType} template with a ${templateMeta[parsed.data.templateType].label.toLowerCase()} setup.`,
          leadId: resolvedLeadId,
          memberIds: resolvedMemberIds,
          health: "no-update" as const,
          priority: parsed.data.priority,
          status: parsed.data.status ?? ("backlog" as const),
          blockingProjectIds: [],
          blockedByProjectIds: [],
          presentation,
          startDate: resolvedStartDate,
          targetDate: resolvedTargetDate,
          labelIds: [...new Set(parsed.data.labelIds ?? [])],
          createdAt: getNow(),
          updatedAt: getNow(),
        }

        return {
          ...state,
          projects: [project, ...state.projects],
        }
      })

      runtime.syncInBackground(
        syncCreateProject(get().currentUserId, {
          ...parsed.data,
          startDate: resolvedStartDate,
          targetDate: resolvedTargetDate,
        }),
        "Failed to create project"
      )

      toast.success("Project created")
    },
    async renameProject(projectId, name) {
      const trimmedName = name.trim()

      if (!trimmedName) {
        toast.error("Project name is required")
        return false
      }

      if (trimmedName.length < projectNameMinLength) {
        toast.error(
          `Project name must be at least ${projectNameMinLength} characters`
        )
        return false
      }

      if (trimmedName.length > projectNameMaxLength) {
        toast.error(
          `Project name must be at most ${projectNameMaxLength} characters`
        )
        return false
      }

      const project = get().projects.find((entry) => entry.id === projectId)

      if (!project) {
        toast.error("Project not found")
        return false
      }

      try {
        await syncRenameProject(get().currentUserId, projectId, trimmedName)
        set((current) => ({
          projects: current.projects.map((entry) =>
            entry.id === projectId
              ? {
                  ...entry,
                  name: trimmedName,
                  updatedAt: getNow(),
                }
              : entry
          ),
        }))
        toast.success("Project renamed")
        return true
      } catch (error) {
        console.error(error)
        toast.error(
          error instanceof Error ? error.message : "Failed to rename project"
        )
        return false
      }
    },
    async deleteProject(projectId) {
      const project = get().projects.find((entry) => entry.id === projectId)

      if (!project) {
        toast.error("Project not found")
        return false
      }

      try {
        await syncDeleteProject(get().currentUserId, projectId)
        set((state) => ({
          ...getNextStateAfterProjectRemoval(state, projectId),
        }))
        toast.success("Project deleted")
        return true
      } catch (error) {
        console.error(error)
        toast.error(
          error instanceof Error ? error.message : "Failed to delete project"
        )
        return false
      }
    },
    updateProject(projectId, patch) {
      const state = get()
      const project = state.projects.find((entry) => entry.id === projectId)

      if (!project) {
        return
      }

      const canEdit =
        project.scopeType === "team"
          ? (() => {
              const role = effectiveRole(state, project.scopeId)
              return role === "admin" || role === "member"
            })()
          : canEditWorkspaceDocuments(state, project.scopeId)

      if (!canEdit) {
        toast.error("Your current role is read-only")
        return
      }

      set((current) => {
        const projects = current.projects.map((entry) =>
          entry.id === projectId
            ? {
                ...entry,
                ...patch,
                updatedAt: getNow(),
              }
            : entry
        ) as AppStore["projects"]

        return { projects }
      })

      runtime.syncInBackground(
        syncUpdateProject(get().currentUserId, projectId, patch),
        "Failed to update project"
      )
    },
  }
}
