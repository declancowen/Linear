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
import { registerPendingWorkItemCreation } from "../pending-work-item-creations"
import {
  effectiveRole,
  getProjectCascadeConfirmationForWorkItemUpdate,
  getProjectsForTeamScope,
  getResolvedProjectLinkForWorkItemUpdate,
  getWorkItemCascadeDeletePlan,
  getWorkItemValidationMessage,
} from "../validation"
import type { AppStore } from "../types"
import type { WorkSlice, WorkSliceFactoryArgs } from "./work-shared"

type CreateWorkItemInput = Parameters<AppStore["createWorkItem"]>[0]
type CreateWorkItemDates = {
  dueDate: string
  startDate: string
  targetDate: string
}
type CreateWorkItemScope = {
  keyPrefix: string
  nextNumber: number
  parent: AppStore["workItems"][number] | null
  resolvedPrimaryProjectId: string | null
  team: AppStore["teams"][number] | null
  workspaceId: string
}
type WorkItemDeletePlan = NonNullable<
  ReturnType<typeof getWorkItemCascadeDeletePlan>
>
type WorkItemDeletePreviousState = Pick<
  AppStore,
  "attachments" | "comments" | "documents" | "notifications" | "workItems"
>

function canDeleteWorkItem(state: AppStore, deletionPlan: WorkItemDeletePlan) {
  const role = effectiveRole(state, deletionPlan.item.teamId)

  if (role === "viewer" || role === "guest" || !role) {
    toast.error("Your current role is read-only")
    return false
  }

  return true
}

function getWorkItemDeletePreviousState(
  state: AppStore
): WorkItemDeletePreviousState {
  return {
    workItems: state.workItems,
    documents: state.documents,
    comments: state.comments,
    attachments: state.attachments,
    notifications: state.notifications,
  }
}

function applyWorkItemCascadeDeletePlan(
  current: AppStore,
  deletionPlan: WorkItemDeletePlan
) {
  return {
    ...current,
    workItems: deletionPlan.nextWorkItems,
    documents: deletionPlan.nextDocuments,
    comments: current.comments.filter(
      (entry) => !deletionPlan.deletedCommentIds.has(entry.id)
    ),
    attachments: current.attachments.filter(
      (entry) => !deletionPlan.deletedAttachmentIds.has(entry.id)
    ),
    notifications: current.notifications.filter(
      (entry) => !deletionPlan.deletedNotificationIds.has(entry.id)
    ),
  }
}

function getWorkItemDeleteSuccessMessage(deletionPlan: WorkItemDeletePlan) {
  return deletionPlan.deletedItemIds.size > 1
    ? `Deleted ${deletionPlan.deletedItemIds.size} items`
    : "Item deleted"
}

function resolveCreateWorkItemDates(
  input: CreateWorkItemInput
): CreateWorkItemDates {
  return {
    startDate: input.startDate ?? formatLocalCalendarDate(),
    dueDate: input.dueDate ?? addLocalCalendarDays(7),
    targetDate: input.targetDate ?? addLocalCalendarDays(10),
  }
}

function resolveCreateWorkItemScope(
  state: AppStore,
  input: CreateWorkItemInput
): CreateWorkItemScope | null {
  const role = effectiveRole(state, input.teamId)

  if (role === "viewer" || role === "guest" || !role) {
    toast.error("Your current role is read-only")
    return null
  }

  const parent = input.parentId
    ? (state.workItems.find((item) => item.id === input.parentId) ?? null)
    : null
  const team = state.teams.find((entry) => entry.id === input.teamId) ?? null
  const teamItems = state.workItems.filter(
    (item) => item.teamId === input.teamId
  )

  return {
    keyPrefix: toTeamKeyPrefix(team?.name, input.teamId),
    nextNumber: 1 + teamItems.length + 100,
    parent,
    resolvedPrimaryProjectId: parent
      ? (parent.primaryProjectId ?? null)
      : input.primaryProjectId,
    team,
    workspaceId: team?.workspaceId ?? "",
  }
}

function buildOptimisticDescriptionDocument(input: {
  currentUserId: string
  descriptionDocId: string
  parsedInput: CreateWorkItemInput
  scope: CreateWorkItemScope
  title: string
}) {
  const now = getNow()

  return {
    id: input.descriptionDocId,
    kind: "item-description" as const,
    workspaceId: input.scope.workspaceId,
    teamId: input.parsedInput.teamId,
    title: `${input.title} description`,
    content: "<p></p>",
    linkedProjectIds: input.scope.resolvedPrimaryProjectId
      ? [input.scope.resolvedPrimaryProjectId]
      : [],
    linkedWorkItemIds: [],
    createdBy: input.currentUserId,
    updatedBy: input.currentUserId,
    createdAt: now,
    updatedAt: now,
  }
}

function buildOptimisticWorkItem(input: {
  currentUserId: string
  dates: CreateWorkItemDates
  descriptionDocId: string
  itemId: string
  parsedInput: CreateWorkItemInput
  scope: CreateWorkItemScope
}) {
  const now = getNow()

  return {
    id: input.itemId,
    key: `${input.scope.keyPrefix}-${input.scope.nextNumber}`,
    teamId: input.parsedInput.teamId,
    type: input.parsedInput.type,
    title: input.parsedInput.title,
    descriptionDocId: input.descriptionDocId,
    status: input.parsedInput.status ?? ("backlog" as const),
    priority: input.parsedInput.priority,
    assigneeId: input.parsedInput.assigneeId,
    creatorId: input.currentUserId,
    parentId: input.scope.parent?.id ?? null,
    primaryProjectId: input.scope.resolvedPrimaryProjectId,
    linkedProjectIds: [],
    linkedDocumentIds: [],
    labelIds: input.parsedInput.labelIds ?? [],
    milestoneId: null,
    startDate: input.dates.startDate,
    dueDate: input.dates.dueDate,
    targetDate: input.dates.targetDate,
    subscriberIds: [input.currentUserId],
    createdAt: now,
    updatedAt: now,
  }
}

function buildCreateWorkItemNotifications(
  state: AppStore,
  input: {
    parsedInput: CreateWorkItemInput
    scope: CreateWorkItemScope
    workItemId: string
  }
) {
  if (!input.parsedInput.assigneeId) {
    return state.notifications
  }

  const actor = state.users.find((user) => user.id === state.currentUserId)

  return [
    createNotification(
      input.parsedInput.assigneeId,
      state.currentUserId,
      buildWorkItemAssignmentNotificationMessage(
        actor?.name ?? "Someone",
        input.parsedInput.title,
        input.scope.team?.name
      ),
      "workItem",
      input.workItemId,
      "assignment"
    ),
    ...state.notifications,
  ]
}

function buildOptimisticWorkItemCreationState(
  state: AppStore,
  input: {
    dates: CreateWorkItemDates
    parsedInput: CreateWorkItemInput
  }
) {
  const scope = resolveCreateWorkItemScope(state, input.parsedInput)

  if (!scope) {
    return null
  }

  const descriptionDocId = createId("doc")
  const workItem = buildOptimisticWorkItem({
    currentUserId: state.currentUserId,
    dates: input.dates,
    descriptionDocId,
    itemId: createId("item"),
    parsedInput: input.parsedInput,
    scope,
  })
  const descriptionDoc = buildOptimisticDescriptionDocument({
    currentUserId: state.currentUserId,
    descriptionDocId,
    parsedInput: input.parsedInput,
    scope,
    title: input.parsedInput.title,
  })

  return {
    createdDescriptionDocId: descriptionDocId,
    createdItemId: workItem.id,
    state: {
      ...state,
      documents: [descriptionDoc, ...state.documents],
      notifications: buildCreateWorkItemNotifications(state, {
        parsedInput: input.parsedInput,
        scope,
        workItemId: workItem.id,
      }),
      workItems: [workItem, ...state.workItems],
    },
  }
}

function reconcileCreatedWorkItem(input: {
  createdDescriptionDocId: string | null
  createdItemId: string
  result: Awaited<ReturnType<typeof syncCreateWorkItem>>
  set: WorkSliceFactoryArgs["set"]
}) {
  input.set((state) => {
    const nextDescriptionDocId =
      input.result?.descriptionDocId ?? input.createdDescriptionDocId ?? null

    return {
      ...state,
      documents: state.documents.map((document) =>
        document.id === input.createdDescriptionDocId ||
        document.id === nextDescriptionDocId
          ? {
              ...document,
              id: nextDescriptionDocId ?? document.id,
              updatedAt:
                input.result?.descriptionUpdatedAt ?? document.updatedAt,
              updatedBy: state.currentUserId,
            }
          : document
      ),
      workItems: state.workItems.map((item) =>
        item.id === input.createdItemId
          ? {
              ...item,
              descriptionDocId: nextDescriptionDocId ?? item.descriptionDocId,
              updatedAt: input.result?.itemUpdatedAt ?? item.updatedAt,
            }
          : item
      ),
    }
  })
}

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

      const existing = getLabelsForWorkspace(get(), resolvedWorkspaceId).find(
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
    updateWorkItem(itemId, patch, options) {
      const state = get()
      const existing = state.workItems.find((item) => item.id === itemId)

      if (!existing) {
        return {
          status: "missing-item",
        }
      }

      const { expectedUpdatedAt, ...localPatch } = patch

      const {
        cascadeItemIds,
        resolvedPrimaryProjectId,
        shouldCascadeProjectLink,
      } = getResolvedProjectLinkForWorkItemUpdate(state, existing, localPatch)

      const validationMessage = getWorkItemValidationMessage(state, {
        teamId: existing.teamId,
        type: existing.type,
        title: localPatch.title ?? existing.title,
        priority: localPatch.priority ?? existing.priority,
        assigneeId:
          localPatch.assigneeId === undefined
            ? existing.assigneeId
            : localPatch.assigneeId,
        parentId:
          localPatch.parentId === undefined
            ? existing.parentId
            : localPatch.parentId,
        primaryProjectId: resolvedPrimaryProjectId,
        labelIds:
          localPatch.labelIds === undefined
            ? existing.labelIds
            : localPatch.labelIds,
        currentItemId: existing.id,
      })

      if (validationMessage) {
        toast.error(validationMessage)
        return {
          status: "validation-error",
          message: validationMessage,
        }
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
                !getAllowedWorkItemTypesForTemplate(
                  project.templateType
                ).includes(item.type)
            )
        ) {
          toast.error(
            "A work item type in this hierarchy is not allowed for the selected project template"
          )
          return {
            status: "validation-error",
            message:
              "A work item type in this hierarchy is not allowed for the selected project template",
          }
        }
      }

      const projectCascadeConfirmation =
        getProjectCascadeConfirmationForWorkItemUpdate(
          state,
          existing,
          localPatch
        )

      if (
        projectCascadeConfirmation.requiresConfirmation &&
        !options?.confirmProjectCascade
      ) {
        return {
          status: "project-confirmation-required",
          cascadeItemCount: projectCascadeConfirmation.cascadeItemCount,
        }
      }

      set((currentState) => {
        const currentItem = currentState.workItems.find(
          (item) => item.id === itemId
        )
        if (!currentItem) {
          return currentState
        }

        const now = getNow()
        const nextTitle = patch.title?.trim() || currentItem.title
        const {
          cascadeItemIds,
          resolvedPrimaryProjectId,
          shouldCascadeProjectLink,
        } = getResolvedProjectLinkForWorkItemUpdate(
          currentState,
          currentItem,
          localPatch
        )
        const nextItems = currentState.workItems.map((item) => {
          if (item.id === itemId) {
            return {
              ...item,
              ...localPatch,
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
          localPatch.title !== undefined
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
          localPatch.assigneeId !== undefined &&
          localPatch.assigneeId &&
          localPatch.assigneeId !== currentItem.assigneeId
        ) {
          notifications.unshift(
            createNotification(
              localPatch.assigneeId,
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
          localPatch.assigneeId === undefined
            ? currentItem.assigneeId
            : localPatch.assigneeId

        if (
          localPatch.status &&
          localPatch.status !== currentItem.status &&
          resolvedAssigneeId
        ) {
          notifications.unshift(
            createNotification(
              resolvedAssigneeId,
              currentState.currentUserId,
              buildWorkItemStatusChangeNotificationMessage(
                actor?.name ?? "Someone",
                nextTitle,
                statusMeta[localPatch.status].label,
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
        syncUpdateWorkItem(get().currentUserId, itemId, {
          ...localPatch,
          ...(expectedUpdatedAt !== undefined ? { expectedUpdatedAt } : {}),
        }),
        "Failed to update work item"
      )

      return {
        status: "updated",
      }
    },
    async deleteWorkItem(itemId) {
      const state = get()
      const deletionPlan = getWorkItemCascadeDeletePlan(state, itemId)

      if (!deletionPlan) {
        return false
      }

      if (!canDeleteWorkItem(state, deletionPlan)) {
        return false
      }

      const previousState = getWorkItemDeletePreviousState(state)

      set((current) => {
        const nextPlan = getWorkItemCascadeDeletePlan(current, itemId)

        if (!nextPlan) {
          return current
        }

        return applyWorkItemCascadeDeletePlan(current, nextPlan)
      })

      try {
        await syncDeleteWorkItem(itemId)
        toast.success(getWorkItemDeleteSuccessMessage(deletionPlan))
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
      let createdDescriptionDocId: string | null = null
      const dates = resolveCreateWorkItemDates(parsed.data)

      set((state) => {
        const optimisticCreation = buildOptimisticWorkItemCreationState(state, {
          dates,
          parsedInput: parsed.data,
        })

        if (!optimisticCreation) {
          return state
        }

        createdItemId = optimisticCreation.createdItemId
        createdDescriptionDocId = optimisticCreation.createdDescriptionDocId
        return optimisticCreation.state
      })

      if (!createdItemId) {
        return null
      }

      const createTask = syncCreateWorkItem(get().currentUserId, {
        ...parsed.data,
        id: createdItemId,
        descriptionDocId: createdDescriptionDocId ?? undefined,
        startDate: dates.startDate,
        dueDate: dates.dueDate,
        targetDate: dates.targetDate,
      }).then((result) => {
        if (!createdItemId) {
          return result
        }

        reconcileCreatedWorkItem({
          createdDescriptionDocId,
          createdItemId,
          result,
          set,
        })

        return result
      })

      registerPendingWorkItemCreation(createdItemId, createTask)
      runtime.syncInBackground(createTask, "Failed to create work item")

      toast.success("Work item created")
      return createdItemId
    },
  }
}
