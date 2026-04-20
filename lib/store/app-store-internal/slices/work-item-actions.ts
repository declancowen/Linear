"use client"

import { differenceInCalendarDays } from "date-fns"
import { toast } from "sonner"

import {
  syncCreateLabel,
  syncCreateWorkItem,
  syncDeleteWorkItem,
  syncShiftTimelineItem,
  syncUpdateWorkItem,
} from "@/lib/convex/client"
import {
  addLocalCalendarDays,
  formatLocalCalendarDate,
  shiftCalendarDate,
} from "@/lib/calendar-date"
import { getLabelsForWorkspace } from "@/lib/domain/selectors"
import {
  buildWorkItemAssignmentNotificationMessage,
  buildWorkItemStatusChangeNotificationMessage,
} from "@/lib/domain/notification-copy"
import {
  getAllowedWorkItemTypesForTemplate,
  statusMeta,
  workItemSchema,
} from "@/lib/domain/types"

import {
  createId,
  createNotification,
  getNow,
  toTeamKeyPrefix,
} from "../helpers"
import {
  effectiveRole,
  getProjectsForTeamScope,
  getResolvedProjectLinkForWorkItemUpdate,
  getWorkItemCascadeDeletePlan,
  getWorkItemValidationMessage,
} from "../validation"
import type { WorkSlice, WorkSliceFactoryArgs } from "./work-shared"

export function createWorkItemActions({
  get,
  runtime,
  set,
}: WorkSliceFactoryArgs): Pick<
  WorkSlice,
  | "createLabel"
  | "updateWorkItem"
  | "deleteWorkItem"
  | "shiftTimelineItem"
  | "createWorkItem"
> {
  return {
    async createLabel(name, workspaceId) {
      const normalizedName = name.trim()
      const resolvedWorkspaceId = workspaceId ?? get().currentWorkspaceId

      if (normalizedName.length === 0) {
        toast.error("Label name is required")
        return null
      }

      if (!resolvedWorkspaceId) {
        toast.error("Workspace not found")
        return null
      }

      const existing = getLabelsForWorkspace(
        get(),
        resolvedWorkspaceId
      ).find(
        (label) => label.name.toLowerCase() === normalizedName.toLowerCase()
      )

      if (existing) {
        return existing
      }

      try {
        const result = await syncCreateLabel({
          workspaceId: resolvedWorkspaceId,
          name: normalizedName,
        })

        if (!result?.label) {
          throw new Error("Failed to create label")
        }

        set((state) => ({
          labels: [...state.labels, result.label].sort((left, right) =>
            left.name.localeCompare(right.name)
          ),
        }))

        return result.label
      } catch (error) {
        console.error(error)
        toast.error(
          error instanceof Error ? error.message : "Failed to create label"
        )
        return null
      }
    },
    updateWorkItem(itemId, patch) {
      const state = get()
      const existing = state.workItems.find((item) => item.id === itemId)

      if (!existing) {
        return
      }

      const {
        cascadeItemIds,
        resolvedPrimaryProjectId,
        shouldCascadeProjectLink,
      } = getResolvedProjectLinkForWorkItemUpdate(state, existing, patch)

      const validationMessage = getWorkItemValidationMessage(state, {
        teamId: existing.teamId,
        type: existing.type,
        title: patch.title ?? existing.title,
        priority: patch.priority ?? existing.priority,
        assigneeId:
          patch.assigneeId === undefined
            ? existing.assigneeId
            : patch.assigneeId,
        parentId:
          patch.parentId === undefined ? existing.parentId : patch.parentId,
        primaryProjectId: resolvedPrimaryProjectId,
        labelIds: patch.labelIds === undefined ? existing.labelIds : patch.labelIds,
        currentItemId: existing.id,
      })

      if (validationMessage) {
        toast.error(validationMessage)
        return
      }

      if (resolvedPrimaryProjectId && shouldCascadeProjectLink) {
        const project = getProjectsForTeamScope(state, existing.teamId).find(
          (entry) => entry.id === resolvedPrimaryProjectId
        )

        if (
          project &&
          state.workItems
            .filter((item) => cascadeItemIds.has(item.id))
            .some(
              (item) =>
                !getAllowedWorkItemTypesForTemplate(project.templateType).includes(
                  item.type
                )
            )
        ) {
          toast.error(
            "A work item type in this hierarchy is not allowed for the selected project template"
          )
          return
        }
      }

      set((currentState) => {
        const currentItem = currentState.workItems.find((item) => item.id === itemId)
        if (!currentItem) {
          return currentState
        }

        const now = getNow()
        const nextTitle = patch.title?.trim() || currentItem.title
        const {
          cascadeItemIds,
          resolvedPrimaryProjectId,
          shouldCascadeProjectLink,
        } = getResolvedProjectLinkForWorkItemUpdate(currentState, currentItem, patch)
        const nextItems = currentState.workItems.map((item) => {
          if (item.id === itemId) {
            return {
              ...item,
              ...patch,
              primaryProjectId: resolvedPrimaryProjectId,
              updatedAt: now,
            }
          }

          if (!shouldCascadeProjectLink || !cascadeItemIds.has(item.id)) {
            return item
          }

          return {
            ...item,
            primaryProjectId: resolvedPrimaryProjectId,
            updatedAt: now,
          }
        })
        const cascadeDescriptionDocIds = shouldCascadeProjectLink
          ? new Set(
              currentState.workItems
                .filter((item) => cascadeItemIds.has(item.id))
                .map((item) => item.descriptionDocId)
            )
          : null
        const nextDocuments = cascadeDescriptionDocIds
          ? currentState.documents.map((document) => {
              if (!cascadeDescriptionDocIds.has(document.id)) {
                return document
              }

              return {
                ...document,
                linkedProjectIds: resolvedPrimaryProjectId
                  ? [resolvedPrimaryProjectId]
                  : [],
                updatedBy: currentState.currentUserId,
                updatedAt: now,
              }
            })
          : currentState.documents
        const finalDocuments =
          patch.title !== undefined
            ? nextDocuments.map((document) =>
                document.id === currentItem.descriptionDocId
                  ? {
                      ...document,
                      title: `${nextTitle} description`,
                      updatedBy: currentState.currentUserId,
                      updatedAt: now,
                    }
                  : document
              )
            : nextDocuments

        const notifications = [...currentState.notifications]
        const actor = currentState.users.find(
          (user) => user.id === currentState.currentUserId
        )
        const team = currentState.teams.find(
          (entry) => entry.id === currentItem.teamId
        )

        if (
          patch.assigneeId !== undefined &&
          patch.assigneeId &&
          patch.assigneeId !== currentItem.assigneeId
        ) {
          notifications.unshift(
            createNotification(
              patch.assigneeId,
              currentState.currentUserId,
              buildWorkItemAssignmentNotificationMessage(
                actor?.name ?? "Someone",
                nextTitle,
                team?.name
              ),
              "workItem",
              currentItem.id,
              "assignment"
            )
          )
        }

        const resolvedAssigneeId =
          patch.assigneeId === undefined ? currentItem.assigneeId : patch.assigneeId

        if (
          patch.status &&
          patch.status !== currentItem.status &&
          resolvedAssigneeId
        ) {
          notifications.unshift(
            createNotification(
              resolvedAssigneeId,
              currentState.currentUserId,
              buildWorkItemStatusChangeNotificationMessage(
                actor?.name ?? "Someone",
                nextTitle,
                statusMeta[patch.status].label,
                team?.name
              ),
              "workItem",
              currentItem.id,
              "status-change"
            )
          )
        }

        return {
          ...currentState,
          documents: finalDocuments,
          workItems: nextItems,
          notifications,
        }
      })

      runtime.syncInBackground(
        syncUpdateWorkItem(get().currentUserId, itemId, patch),
        "Failed to update work item"
      )
    },
    async deleteWorkItem(itemId) {
      const state = get()
      const deletionPlan = getWorkItemCascadeDeletePlan(state, itemId)

      if (!deletionPlan) {
        return false
      }

      const role = effectiveRole(state, deletionPlan.item.teamId)

      if (role === "viewer" || role === "guest" || !role) {
        toast.error("Your current role is read-only")
        return false
      }

      const previousState = {
        workItems: state.workItems,
        documents: state.documents,
        comments: state.comments,
        attachments: state.attachments,
        notifications: state.notifications,
      }

      set((current) => {
        const nextPlan = getWorkItemCascadeDeletePlan(current, itemId)

        if (!nextPlan) {
          return current
        }

        return {
          ...current,
          workItems: nextPlan.nextWorkItems,
          documents: nextPlan.nextDocuments,
          comments: current.comments.filter(
            (entry) => !nextPlan.deletedCommentIds.has(entry.id)
          ),
          attachments: current.attachments.filter(
            (entry) => !nextPlan.deletedAttachmentIds.has(entry.id)
          ),
          notifications: current.notifications.filter(
            (entry) => !nextPlan.deletedNotificationIds.has(entry.id)
          ),
        }
      })

      try {
        await syncDeleteWorkItem(itemId)
        toast.success(
          deletionPlan.deletedItemIds.size > 1
            ? `Deleted ${deletionPlan.deletedItemIds.size} items`
            : "Item deleted"
        )
        return true
      } catch (error) {
        console.error(error)
        set((current) => ({
          ...current,
          ...previousState,
        }))
        void runtime.refreshFromServer().catch((refreshError) => {
          console.error(
            "Failed to reconcile work item state after delete failure",
            refreshError
          )
        })
        toast.error("Failed to delete item")
        return false
      }
    },
    shiftTimelineItem(itemId, nextStartDate) {
      set((state) => {
        const item = state.workItems.find((entry) => entry.id === itemId)
        if (!item || !item.startDate) {
          return state
        }

        const delta = differenceInCalendarDays(
          new Date(nextStartDate),
          new Date(item.startDate)
        )

        return {
          ...state,
          workItems: state.workItems.map((entry) => {
            if (entry.id !== itemId) {
              return entry
            }

            return {
              ...entry,
              startDate: nextStartDate,
              dueDate: entry.dueDate
                ? shiftCalendarDate(entry.dueDate, delta)
                : entry.dueDate,
              targetDate: entry.targetDate
                ? shiftCalendarDate(entry.targetDate, delta)
                : entry.targetDate,
              updatedAt: getNow(),
            }
          }),
        }
      })

      runtime.syncInBackground(
        syncShiftTimelineItem(itemId, nextStartDate),
        "Failed to move timeline item"
      )
    },
    createWorkItem(input) {
      const parsed = workItemSchema.safeParse(input)
      if (!parsed.success) {
        toast.error("Work item input is invalid")
        return null
      }

      const validationMessage = getWorkItemValidationMessage(get(), parsed.data)

      if (validationMessage) {
        toast.error(validationMessage)
        return null
      }

      let createdItemId: string | null = null
      const resolvedStartDate =
        parsed.data.startDate ?? formatLocalCalendarDate()
      const resolvedDueDate = parsed.data.dueDate ?? addLocalCalendarDays(7)
      const resolvedTargetDate =
        parsed.data.targetDate ?? addLocalCalendarDays(10)

      set((state) => {
        const role = effectiveRole(state, parsed.data.teamId)
        if (role === "viewer" || role === "guest" || !role) {
          toast.error("Your current role is read-only")
          return state
        }

        const parent = parsed.data.parentId
          ? (state.workItems.find((item) => item.id === parsed.data.parentId) ??
              null)
          : null
        const team =
          state.teams.find((entry) => entry.id === parsed.data.teamId) ?? null
        const teamItems = state.workItems.filter(
          (item) => item.teamId === parsed.data.teamId
        )
        const keyPrefix = toTeamKeyPrefix(team?.name, parsed.data.teamId)
        const nextNumber = 1 + teamItems.length + 100
        const descriptionDocId = createId("doc")
        const resolvedPrimaryProjectId = parent
          ? (parent.primaryProjectId ?? null)
          : parsed.data.primaryProjectId

        const descriptionDoc = {
          id: descriptionDocId,
          kind: "item-description" as const,
          workspaceId:
            state.teams.find((teamEntry) => teamEntry.id === parsed.data.teamId)
              ?.workspaceId ?? "",
          teamId: parsed.data.teamId,
          title: `${parsed.data.title} description`,
          content: `<p>Add a fuller description for ${parsed.data.title}.</p>`,
          linkedProjectIds: resolvedPrimaryProjectId
            ? [resolvedPrimaryProjectId]
            : [],
          linkedWorkItemIds: [],
          createdBy: state.currentUserId,
          updatedBy: state.currentUserId,
          createdAt: getNow(),
          updatedAt: getNow(),
        }

        const workItem = {
          id: createId("item"),
          key: `${keyPrefix}-${nextNumber}`,
          teamId: parsed.data.teamId,
          type: parsed.data.type,
          title: parsed.data.title,
          descriptionDocId,
          status: parsed.data.status ?? ("backlog" as const),
          priority: parsed.data.priority,
          assigneeId: parsed.data.assigneeId,
          creatorId: state.currentUserId,
          parentId: parent?.id ?? null,
          primaryProjectId: resolvedPrimaryProjectId,
          linkedProjectIds: [],
          linkedDocumentIds: [],
          labelIds: parsed.data.labelIds ?? [],
          milestoneId: null,
          startDate: resolvedStartDate,
          dueDate: resolvedDueDate,
          targetDate: resolvedTargetDate,
          subscriberIds: [state.currentUserId],
          createdAt: getNow(),
          updatedAt: getNow(),
        }

        const actor = state.users.find((user) => user.id === state.currentUserId)
        const notifications =
          parsed.data.assigneeId
            ? [
                createNotification(
                  parsed.data.assigneeId,
                  state.currentUserId,
                  buildWorkItemAssignmentNotificationMessage(
                    actor?.name ?? "Someone",
                    parsed.data.title,
                    team?.name
                  ),
                  "workItem",
                  workItem.id,
                  "assignment"
                ),
                ...state.notifications,
              ]
            : state.notifications

        createdItemId = workItem.id

        return {
          ...state,
          documents: [descriptionDoc, ...state.documents],
          notifications,
          workItems: [workItem, ...state.workItems],
        }
      })

      if (!createdItemId) {
        return null
      }

      runtime.syncInBackground(
        syncCreateWorkItem(get().currentUserId, {
          ...parsed.data,
          startDate: resolvedStartDate,
          dueDate: resolvedDueDate,
          targetDate: resolvedTargetDate,
        }),
        "Failed to create work item"
      )

      toast.success("Work item created")
      return createdItemId
    },
  }
}
