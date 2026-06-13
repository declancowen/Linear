import type {
  Priority,
  WorkItemType,
  WorkItemVisibility,
  WorkStatus,
} from "@/lib/domain/types"

export type WorkItemMutationPatch = {
  title?: string
  description?: string
  editSessionId?: string
  expectedDescriptionUpdatedAt?: string
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
