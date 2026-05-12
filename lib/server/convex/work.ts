import { api } from "@/convex/_generated/api"
import type {
  CreateViewInput,
  DocumentPresenceViewer,
  DisplayProperty,
  GroupField,
  OrderingField,
  WorkItemType,
} from "@/lib/domain/types"
import type {
  CreateWorkItemMutationInput,
  WorkItemMutationPatch,
} from "@/lib/domain/work-item-inputs"
import { coerceApplicationError } from "@/lib/server/application-errors"

import { getConvexServerClient, withServerToken } from "./core"
import type {
  ServerPresenceClearInput,
  ServerPresenceHeartbeatInput,
} from "./presence-inputs"
import { resolveServerOrigin } from "../request-origin"

const WORK_ITEM_MUTATION_ERROR_MAPPINGS = [
  {
    match: "Work item not found",
    status: 404,
    code: "WORK_ITEM_NOT_FOUND",
  },
  {
    match: "Team not found",
    status: 404,
    code: "TEAM_NOT_FOUND",
  },
  {
    match: "Assignee must belong to the selected team",
    status: 400,
    code: "WORK_ITEM_ASSIGNEE_INVALID",
  },
  {
    match: "One or more labels are invalid",
    status: 400,
    code: "WORK_ITEM_LABELS_INVALID",
  },
  {
    match: "Project not found",
    status: 404,
    code: "PROJECT_NOT_FOUND",
  },
  {
    match: "Project must belong to the same team or workspace",
    status: 400,
    code: "WORK_ITEM_PROJECT_SCOPE_INVALID",
  },
  {
    match: "Work item type is not allowed for the selected project template",
    status: 400,
    code: "WORK_ITEM_PROJECT_TEMPLATE_INVALID",
  },
  {
    match:
      "A work item type in this hierarchy is not allowed for the selected project template",
    status: 400,
    code: "WORK_ITEM_PROJECT_TEMPLATE_HIERARCHY_INVALID",
  },
  {
    match: "Parent item not found",
    status: 404,
    code: "WORK_ITEM_PARENT_NOT_FOUND",
  },
  {
    match: "Parent item must belong to the same team",
    status: 400,
    code: "WORK_ITEM_PARENT_SCOPE_INVALID",
  },
  {
    match: "An item cannot be its own parent",
    status: 400,
    code: "WORK_ITEM_PARENT_SELF_REFERENCE",
  },
  {
    match: "Parent item type cannot contain this child type",
    status: 400,
    code: "WORK_ITEM_PARENT_TYPE_INVALID",
  },
  {
    match: "Parent item would create a cycle",
    status: 409,
    code: "WORK_ITEM_PARENT_CYCLE",
  },
  {
    match: "Work item id already exists",
    status: 409,
    code: "WORK_ITEM_ID_CONFLICT",
  },
  {
    match: "Description document id already exists",
    status: 409,
    code: "WORK_ITEM_DESCRIPTION_DOCUMENT_ID_CONFLICT",
  },
  {
    match: "Work item title must be between 2 and 96 characters",
    status: 400,
    code: "WORK_ITEM_TITLE_INVALID",
  },
  {
    match: /^(Start|Due|Target) date must be a valid calendar date$/,
    status: 400,
    code: "WORK_ITEM_SCHEDULE_INVALID",
  },
  {
    match: "Target date must be on or after the start date",
    status: 400,
    code: "WORK_ITEM_SCHEDULE_INVALID",
  },
  {
    match: "Work item changed while you were editing",
    status: 409,
    code: "WORK_ITEM_EDIT_CONFLICT",
  },
  {
    match: (message: string) =>
      message === "Your current role is read-only" ||
      message === "You do not have access to this team" ||
      message === "You do not have access to this workspace",
    status: 403,
    code: "WORK_ITEM_ACCESS_DENIED",
  },
  {
    match: /disabled for this team$/,
    status: 400,
    code: "WORK_ITEM_CREATION_DISABLED",
  },
] as const

const SHIFT_TIMELINE_ITEM_ERROR_MAPPINGS = [
  ...WORK_ITEM_MUTATION_ERROR_MAPPINGS,
  {
    match: "Work item is not scheduled",
    status: 400,
    code: "WORK_ITEM_SCHEDULE_MISSING",
  },
] as const

const WORK_ITEM_PRESENCE_ERROR_MAPPINGS = [
  {
    match: "Work item not found",
    status: 404,
    code: "WORK_ITEM_NOT_FOUND",
  },
  {
    match: /Could not find public function for 'app:(heartbeatWorkItemPresence|clearWorkItemPresence)'/i,
    status: 503,
    code: "WORK_ITEM_PRESENCE_UNAVAILABLE",
    message: "Work item presence is unavailable",
  },
  {
    match: "Document presence session is already in use",
    status: 409,
    code: "WORK_ITEM_PRESENCE_SESSION_CONFLICT",
  },
  {
    match: (message: string) =>
      message === "Your current role is read-only" ||
      message === "You do not have access to this team" ||
      message === "You do not have access to this workspace",
    status: 403,
    code: "WORK_ITEM_ACCESS_DENIED",
  },
] as const

const VIEW_MUTATION_ERROR_MAPPINGS = [
  {
    match: "View not found",
    status: 404,
    code: "VIEW_NOT_FOUND",
  },
  {
    match: "Workspace not found",
    status: 404,
    code: "WORKSPACE_NOT_FOUND",
  },
  {
    match: "Team not found",
    status: 404,
    code: "TEAM_NOT_FOUND",
  },
  {
    match: "One or more labels are invalid",
    status: 400,
    code: "VIEW_LABELS_INVALID",
  },
  {
    match: (message: string) =>
      message === "Views are disabled for this team" ||
      message === "Work views are disabled for this team" ||
      message === "Project views are disabled for this team" ||
      message === "Document views are disabled for this team" ||
      message === "View route is not valid for the selected scope",
    status: 400,
    code: "VIEW_CONFIGURATION_INVALID",
  },
  {
    match: (message: string) =>
      message === "You do not have access to this view" ||
      message === "Your current role is read-only" ||
      message === "You do not have access to this team" ||
      message === "You do not have access to this workspace",
    status: 403,
    code: "VIEW_ACCESS_DENIED",
  },
] as const

const LABEL_MUTATION_ERROR_MAPPINGS = [
  {
    match: "User not found",
    status: 404,
    code: "ACCOUNT_NOT_FOUND",
  },
  {
    match: "Workspace not found",
    status: 404,
    code: "WORKSPACE_NOT_FOUND",
  },
  {
    match: (message: string) =>
      message === "Your current role is read-only" ||
      message === "You do not have access to this workspace",
    status: 403,
    code: "LABEL_ACCESS_DENIED",
  },
  {
    match: "Label name is required",
    status: 400,
    code: "LABEL_NAME_REQUIRED",
  },
] as const

export async function updateWorkItemServer(input: {
  currentUserId: string
  itemId: string
  patch: WorkItemMutationPatch
}) {
  try {
    const origin = await resolveServerOrigin()

    return await getConvexServerClient().mutation(
      api.app.updateWorkItem,
      withServerToken({
        ...input,
        origin,
      })
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...WORK_ITEM_MUTATION_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function createLabelServer(input: {
  currentUserId: string
  workspaceId: string
  name: string
  color?: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.createLabel,
      withServerToken(input)
    )
  } catch (error) {
    throw coerceApplicationError(error, [...LABEL_MUTATION_ERROR_MAPPINGS]) ?? error
  }
}

export async function deleteWorkItemServer(input: {
  currentUserId: string
  itemId: string
}) {
  try {
    return (await getConvexServerClient().mutation(
      api.app.deleteWorkItem,
      withServerToken(input)
    )) as {
      deletedItemIds: string[]
      deletedDescriptionDocIds?: string[]
    }
  } catch (error) {
    throw (
      coerceApplicationError(error, [...WORK_ITEM_MUTATION_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function updateViewConfigServer(input: {
  currentUserId: string
  viewId: string
  layout?: "list" | "board" | "timeline"
  grouping?: GroupField
  subGrouping?: GroupField | null
  ordering?: OrderingField
  itemLevel?: WorkItemType | null
  showChildItems?: boolean
  showCompleted?: boolean
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.updateViewConfig,
      withServerToken(input)
    )
  } catch (error) {
    throw coerceApplicationError(error, [...VIEW_MUTATION_ERROR_MAPPINGS]) ?? error
  }
}

export async function renameViewServer(input: {
  currentUserId: string
  viewId: string
  name: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.renameView,
      withServerToken(input)
    )
  } catch (error) {
    throw coerceApplicationError(error, [...VIEW_MUTATION_ERROR_MAPPINGS]) ?? error
  }
}

export async function deleteViewServer(input: {
  currentUserId: string
  viewId: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.deleteView,
      withServerToken(input)
    )
  } catch (error) {
    throw coerceApplicationError(error, [...VIEW_MUTATION_ERROR_MAPPINGS]) ?? error
  }
}

export async function createViewServer(input: CreateViewInput & {
  currentUserId: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.createView,
      withServerToken(input)
    )
  } catch (error) {
    throw coerceApplicationError(error, [...VIEW_MUTATION_ERROR_MAPPINGS]) ?? error
  }
}

export async function toggleViewDisplayPropertyServer(input: {
  currentUserId: string
  viewId: string
  property: DisplayProperty
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.toggleViewDisplayProperty,
      withServerToken(input)
    )
  } catch (error) {
    throw coerceApplicationError(error, [...VIEW_MUTATION_ERROR_MAPPINGS]) ?? error
  }
}

export async function reorderViewDisplayPropertiesServer(input: {
  currentUserId: string
  viewId: string
  displayProps: DisplayProperty[]
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.reorderViewDisplayProperties,
      withServerToken(input)
    )
  } catch (error) {
    throw coerceApplicationError(error, [...VIEW_MUTATION_ERROR_MAPPINGS]) ?? error
  }
}

export async function toggleViewHiddenValueServer(input: {
  currentUserId: string
  viewId: string
  key: "groups" | "subgroups"
  value: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.toggleViewHiddenValue,
      withServerToken(input)
    )
  } catch (error) {
    throw coerceApplicationError(error, [...VIEW_MUTATION_ERROR_MAPPINGS]) ?? error
  }
}

export async function toggleViewFilterValueServer(input: {
  currentUserId: string
  viewId: string
  key:
    | "status"
    | "priority"
    | "assigneeIds"
    | "creatorIds"
    | "leadIds"
    | "health"
    | "milestoneIds"
    | "relationTypes"
    | "projectIds"
    | "parentIds"
    | "itemTypes"
    | "labelIds"
    | "teamIds"
  value: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.toggleViewFilterValue,
      withServerToken(input)
    )
  } catch (error) {
    throw coerceApplicationError(error, [...VIEW_MUTATION_ERROR_MAPPINGS]) ?? error
  }
}

export async function clearViewFiltersServer(input: {
  currentUserId: string
  viewId: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.clearViewFilters,
      withServerToken(input)
    )
  } catch (error) {
    throw coerceApplicationError(error, [...VIEW_MUTATION_ERROR_MAPPINGS]) ?? error
  }
}

export async function shiftTimelineItemServer(input: {
  currentUserId: string
  itemId: string
  nextStartDate: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.shiftTimelineItem,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...SHIFT_TIMELINE_ITEM_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function heartbeatWorkItemPresenceServer(
  input: ServerPresenceHeartbeatInput<"itemId">
): Promise<DocumentPresenceViewer[]> {
  try {
    return await getConvexServerClient().mutation(
      api.app.heartbeatWorkItemPresence,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...WORK_ITEM_PRESENCE_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function clearWorkItemPresenceServer(
  input: ServerPresenceClearInput<"itemId">
) {
  try {
    return await getConvexServerClient().mutation(
      api.app.clearWorkItemPresence,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...WORK_ITEM_PRESENCE_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function createWorkItemServer(input: {
  currentUserId: string
} & CreateWorkItemMutationInput) {
  try {
    const origin = await resolveServerOrigin()

    return await getConvexServerClient().mutation(
      api.app.createWorkItem,
      withServerToken({
        ...input,
        origin,
      })
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...WORK_ITEM_MUTATION_ERROR_MAPPINGS]) ??
      error
    )
  }
}
