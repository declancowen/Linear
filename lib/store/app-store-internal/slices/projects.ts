"use client"

import { addDays } from "date-fns"
import { toast } from "sonner"

import {
  syncCreateProject,
  syncUpdateProject,
} from "@/lib/convex/client"
import {
  createDefaultProjectPresentationConfig,
  projectSchema,
  templateMeta,
} from "@/lib/domain/types"

import { createId, getNow } from "../helpers"
import { createStoreRuntime } from "../runtime"
import {
  canEditWorkspaceDocuments,
  effectiveRole,
  getProjectCreationValidationMessage,
  getTeamWorkflowSettings,
} from "../validation"
import type { AppStore, AppStoreGet, AppStoreSet } from "../types"

type ProjectSlice = Pick<AppStore, "createProject" | "updateProject">

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

      set((state) => {
        const workflowSettings = getTeamWorkflowSettings(
          state,
          parsed.data.scopeId
        )
        const templateDefaults =
          workflowSettings.templateDefaults[parsed.data.templateType]
        const presentation =
          parsed.data.presentation ??
          createDefaultProjectPresentationConfig(parsed.data.templateType, {
            layout: templateDefaults.defaultViewLayout,
          })
        const project = {
          id: createId("project"),
          scopeType: parsed.data.scopeType,
          scopeId: parsed.data.scopeId,
          templateType: parsed.data.templateType,
          name: parsed.data.name,
          summary: parsed.data.summary,
          description: `${parsed.data.name} was created from the ${parsed.data.templateType} template with a ${templateMeta[parsed.data.templateType].label.toLowerCase()} setup.`,
          leadId: state.currentUserId,
          memberIds: [state.currentUserId],
          health: "no-update" as const,
          priority: parsed.data.priority,
          status: "planning" as const,
          presentation,
          startDate: getNow(),
          targetDate: addDays(
            new Date(),
            templateDefaults.targetWindowDays
          ).toISOString(),
          createdAt: getNow(),
          updatedAt: getNow(),
        }

        return {
          ...state,
          projects: [project, ...state.projects],
        }
      })

      runtime.syncInBackground(
        syncCreateProject(get().currentUserId, parsed.data),
        "Failed to create project"
      )

      toast.success("Project created")
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

      set((current) => ({
        projects: current.projects.map((entry) =>
          entry.id === projectId
            ? {
                ...entry,
                ...patch,
                updatedAt: getNow(),
              }
            : entry
        ),
      }))

      runtime.syncInBackground(
        syncUpdateProject(get().currentUserId, projectId, patch),
        "Failed to update project"
      )
    },
  }
}
