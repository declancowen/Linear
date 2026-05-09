import type { Priority, WorkItemType, WorkStatus } from "@/lib/domain/types"

export type WorkItemMutationPatch = {
  title?: string
  description?: string
  expectedUpdatedAt?: string
  status?: WorkStatus
  priority?: Priority
  assigneeId?: string | null
  parentId?: string | null
  primaryProjectId?: string | null
  labelIds?: string[]
  startDate?: string | null
  dueDate?: string | null
  targetDate?: string | null
}

export type StoreWorkItemPatch = Omit<WorkItemMutationPatch, "description">

export type CreateWorkItemMutationInput = {
  id?: string
  descriptionDocId?: string
  teamId: string
  type: WorkItemType
  title: string
  parentId?: string | null
  primaryProjectId: string | null
  assigneeId: string | null
  status?: WorkStatus
  priority: Priority
  labelIds?: string[]
  startDate?: string | null
  dueDate?: string | null
  targetDate?: string | null
}

export type CreateStoreWorkItemInput = Omit<
  CreateWorkItemMutationInput,
  "descriptionDocId" | "id"
>

export type AuthenticatedCreateWorkItemInput =
  CreateWorkItemMutationInput & {
    currentUserId: string
    origin: string
  }
