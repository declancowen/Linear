import type {
  CustomPropertyValue,
  Priority,
  WorkItemType,
  WorkItemVisibility,
  WorkStatus,
} from "@/lib/domain/types"

export const MAX_BULK_WORK_ITEM_UPDATES = 100

export type WorkItemMutationPatch = {
  title?: string
  description?: string
  editSessionId?: string
  expectedDescriptionUpdatedAt?: string
  removedAttachmentIds?: string[]
  expectedUpdatedAt?: string
  status?: WorkStatus
  priority?: Priority
  assigneeId?: string | null
  assigneeIds?: string[]
  parentId?: string | null
  primaryProjectId?: string | null
  labelIds?: string[]
  startDate?: string | null
  dueDate?: string | null
  targetDate?: string | null
  startTime?: string | null
  endTime?: string | null
  scheduleTimeZone?: string | null
}

export type StoreWorkItemPatch = Omit<
  WorkItemMutationPatch,
  "description" | "editSessionId"
>

export type BulkWorkItemPatch = Pick<
  StoreWorkItemPatch,
  | "assigneeId"
  | "assigneeIds"
  | "dueDate"
  | "labelIds"
  | "priority"
  | "primaryProjectId"
  | "scheduleTimeZone"
  | "startDate"
  | "startTime"
  | "endTime"
  | "status"
  | "targetDate"
> & {
  expectedUpdatedAt: string
}

export function hasBulkWorkItemPatchMutation(patch: BulkWorkItemPatch) {
  return Object.entries(patch).some(
    ([key, value]) => key !== "expectedUpdatedAt" && value !== undefined
  )
}

export type BulkWorkItemUpdate =
  | {
      itemId: string
      patch: BulkWorkItemPatch
      customProperty?: never
    }
  | {
      expectedUpdatedAt: string
      itemId: string
      patch?: never
      customProperty: {
        propertyId: string
        value: CustomPropertyValue
      }
    }

export type BulkWorkItemDelete = {
  itemId: string
  expectedUpdatedAt: string
}

export type CreateWorkItemMutationInput = {
  id?: string
  descriptionDocId?: string
  description?: string
  teamId?: string | null
  workspaceId?: string | null
  type: WorkItemType
  title: string
  parentId?: string | null
  primaryProjectId: string | null
  assigneeId: string | null
  assigneeIds?: string[]
  status?: WorkStatus
  priority: Priority
  labelIds?: string[]
  visibility?: WorkItemVisibility
  startDate?: string | null
  dueDate?: string | null
  targetDate?: string | null
  startTime?: string | null
  endTime?: string | null
  scheduleTimeZone?: string | null
}

export type CreateStoreWorkItemInput = Omit<
  CreateWorkItemMutationInput,
  "descriptionDocId" | "id"
>

export type AuthenticatedCreateWorkItemInput = CreateWorkItemMutationInput & {
  currentUserId: string
  origin: string
}
