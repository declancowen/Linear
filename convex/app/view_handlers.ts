import type { MutationCtx } from "../_generated/server"
import type { ViewFilters } from "../../lib/domain/types"

import {
  createViewDefinition,
  isRouteAllowedForViewContext,
  isSystemView,
} from "../../lib/domain/default-views"
import { viewNameMaxLength, viewNameMinLength } from "../../lib/domain/types"
import { assertServerToken, createId, getNow } from "./core"
import { getTeamDoc } from "./data"
import {
  requireEditableTeamAccess,
  requireEditableWorkspaceAccess,
} from "./access"
import { normalizeTeam } from "./normalization"
import {
  assertWorkspaceLabelIds,
  requireViewMutationAccess,
  resolveViewWorkspaceId,
} from "./work_helpers"

type ServerAccessArgs = {
  serverToken: string
}

type ViewConfigArgs = ServerAccessArgs & {
  currentUserId: string
  viewId: string
  layout?: "list" | "board" | "timeline"
  itemLevel?:
    | "epic"
    | "feature"
    | "requirement"
    | "story"
    | "task"
    | "issue"
    | "sub-task"
    | "sub-issue"
    | null
  showChildItems?: boolean
  grouping?:
    | "project"
    | "status"
    | "assignee"
    | "priority"
    | "label"
    | "team"
    | "type"
    | "epic"
    | "feature"
  subGrouping?:
    | "project"
    | "status"
    | "assignee"
    | "priority"
    | "label"
    | "team"
    | "type"
    | "epic"
    | "feature"
    | null
  ordering?:
    | "priority"
    | "updatedAt"
    | "createdAt"
    | "dueDate"
    | "targetDate"
    | "title"
  showCompleted?: boolean
}

type CreateViewArgs = ServerAccessArgs & {
  currentUserId: string
  id?: string
  scopeType: "team" | "workspace"
  scopeId: string
  entityKind: "items" | "projects" | "docs"
  containerType?: "project-items" | null
  containerId?: string | null
  route: string
  name: string
  description: string
  layout?: "list" | "board" | "timeline"
  itemLevel?:
    | "epic"
    | "feature"
    | "requirement"
    | "story"
    | "task"
    | "issue"
    | "sub-task"
    | "sub-issue"
    | null
  showChildItems?: boolean
  grouping?:
    | "project"
    | "status"
    | "assignee"
    | "priority"
    | "label"
    | "team"
    | "type"
    | "epic"
    | "feature"
  subGrouping?:
    | "project"
    | "status"
    | "assignee"
    | "priority"
    | "label"
    | "team"
    | "type"
    | "epic"
    | "feature"
    | null
  ordering?:
    | "priority"
    | "updatedAt"
    | "createdAt"
    | "dueDate"
    | "targetDate"
    | "title"
  filters?: ViewFilters
  displayProps?: Array<
    | "id"
    | "type"
    | "status"
    | "assignee"
    | "priority"
    | "progress"
    | "project"
    | "dueDate"
    | "milestone"
    | "labels"
    | "created"
    | "updated"
  >
  hiddenState?: {
    groups: string[]
    subgroups: string[]
  }
}

type ViewDisplayPropertyArgs = ServerAccessArgs & {
  currentUserId: string
  viewId: string
  property:
    | "id"
    | "type"
    | "status"
    | "assignee"
    | "priority"
    | "progress"
    | "project"
    | "dueDate"
    | "milestone"
    | "labels"
    | "created"
    | "updated"
}

type ReorderViewDisplayPropertiesArgs = ServerAccessArgs & {
  currentUserId: string
  viewId: string
  displayProps: Array<
    | "id"
    | "type"
    | "status"
    | "assignee"
    | "priority"
    | "progress"
    | "project"
    | "dueDate"
    | "milestone"
    | "labels"
    | "created"
    | "updated"
  >
}

type ViewHiddenValueArgs = ServerAccessArgs & {
  currentUserId: string
  viewId: string
  key: "groups" | "subgroups"
  value: string
}

type ViewFilterValueArgs = ServerAccessArgs & {
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
}

type ClearViewFiltersArgs = ServerAccessArgs & {
  currentUserId: string
  viewId: string
}

type RenameViewArgs = ServerAccessArgs & {
  currentUserId: string
  viewId: string
  name: string
}

type DeleteViewArgs = ServerAccessArgs & {
  currentUserId: string
  viewId: string
}

type CreateViewAccess = {
  experience: ReturnType<typeof normalizeTeam>["settings"]["experience"] | null
  teamSlug: string | null
  workspaceId: string
}

function assertTeamViewFeatures(
  team: ReturnType<typeof normalizeTeam>,
  entityKind: CreateViewArgs["entityKind"]
) {
  if (!team.settings.features.views) {
    throw new Error("Views are disabled for this team")
  }

  if (entityKind === "items" && !team.settings.features.issues) {
    throw new Error("Work views are disabled for this team")
  }

  if (entityKind === "projects" && !team.settings.features.projects) {
    throw new Error("Project views are disabled for this team")
  }

  if (entityKind === "docs" && !team.settings.features.docs) {
    throw new Error("Document views are disabled for this team")
  }
}

async function requireTeamViewCreateAccess(
  ctx: MutationCtx,
  args: CreateViewArgs
): Promise<CreateViewAccess> {
  await requireEditableTeamAccess(ctx, args.scopeId, args.currentUserId)
  const team = await getTeamDoc(ctx, args.scopeId)

  if (!team) {
    throw new Error("Team not found")
  }

  const normalizedTeam = normalizeTeam(team)
  assertTeamViewFeatures(normalizedTeam, args.entityKind)

  return {
    experience: normalizedTeam.settings.experience,
    teamSlug: normalizedTeam.slug,
    workspaceId: normalizedTeam.workspaceId,
  }
}

async function requireViewCreateAccess(
  ctx: MutationCtx,
  args: CreateViewArgs
): Promise<CreateViewAccess> {
  if (args.scopeType === "team") {
    return requireTeamViewCreateAccess(ctx, args)
  }

  await requireEditableWorkspaceAccess(ctx, args.scopeId, args.currentUserId)

  return {
    experience: null,
    teamSlug: null,
    workspaceId: args.scopeId,
  }
}

function assertCreateViewRoute(args: CreateViewArgs, teamSlug: string | null) {
  if (
    !isRouteAllowedForViewContext({
      scopeType: args.scopeType,
      entityKind: args.entityKind,
      route: args.route,
      teamSlug,
    })
  ) {
    throw new Error("View route is not valid for the selected scope")
  }
}

export async function createViewHandler(
  ctx: MutationCtx,
  args: CreateViewArgs
) {
  assertServerToken(args.serverToken)
  const { experience, teamSlug, workspaceId } = await requireViewCreateAccess(
    ctx,
    args
  )

  assertCreateViewRoute(args, teamSlug)
  await assertWorkspaceLabelIds(ctx, workspaceId, args.filters?.labelIds)

  const view = createViewDefinition({
    id: args.id ?? createId("view"),
    name: args.name,
    description: args.description,
    scopeType: args.scopeType,
    scopeId: args.scopeId,
    entityKind: args.entityKind,
    containerType: args.containerType,
    containerId: args.containerId,
    route: args.route,
    teamSlug,
    defaultItemLevelExperience: experience,
    createdAt: getNow(),
    overrides: {
      layout: args.layout,
      itemLevel: args.itemLevel,
      showChildItems: args.showChildItems,
      grouping: args.grouping,
      subGrouping: args.subGrouping,
      ordering: args.ordering,
      filters: args.filters,
      displayProps: args.displayProps,
      hiddenState: args.hiddenState,
    },
  })

  if (!view) {
    throw new Error("View route is not valid for the selected scope")
  }

  await ctx.db.insert("views", view)

  return view
}

export async function updateViewConfigHandler(
  ctx: MutationCtx,
  args: ViewConfigArgs
) {
  assertServerToken(args.serverToken)
  const view = await requireViewMutationAccess(
    ctx,
    args.viewId,
    args.currentUserId
  )

  await ctx.db.patch(view._id, {
    layout: args.layout ?? view.layout,
    itemLevel: args.itemLevel === undefined ? view.itemLevel : args.itemLevel,
    showChildItems:
      args.showChildItems === undefined
        ? view.showChildItems
        : args.showChildItems,
    grouping: args.grouping ?? view.grouping,
    subGrouping:
      args.subGrouping === undefined ? view.subGrouping : args.subGrouping,
    ordering: args.ordering ?? view.ordering,
    filters:
      args.showCompleted === undefined
        ? view.filters
        : {
            ...view.filters,
            showCompleted: args.showCompleted,
          },
    updatedAt: getNow(),
  })
}

export async function toggleViewDisplayPropertyHandler(
  ctx: MutationCtx,
  args: ViewDisplayPropertyArgs
) {
  assertServerToken(args.serverToken)
  const view = await requireViewMutationAccess(
    ctx,
    args.viewId,
    args.currentUserId
  )

  const nextDisplayProps = view.displayProps.includes(args.property)
    ? view.displayProps.filter((value: string) => value !== args.property)
    : [...view.displayProps, args.property]

  await ctx.db.patch(view._id, {
    displayProps: nextDisplayProps,
    updatedAt: getNow(),
  })
}

export async function reorderViewDisplayPropertiesHandler(
  ctx: MutationCtx,
  args: ReorderViewDisplayPropertiesArgs
) {
  assertServerToken(args.serverToken)
  const view = await requireViewMutationAccess(
    ctx,
    args.viewId,
    args.currentUserId
  )

  const nextDisplayProps = Array.from(new Set(args.displayProps))

  await ctx.db.patch(view._id, {
    displayProps: nextDisplayProps,
    updatedAt: getNow(),
  })
}

export async function toggleViewHiddenValueHandler(
  ctx: MutationCtx,
  args: ViewHiddenValueArgs
) {
  assertServerToken(args.serverToken)
  const view = await requireViewMutationAccess(
    ctx,
    args.viewId,
    args.currentUserId
  )

  const current = view.hiddenState[args.key]
  const nextValues = current.includes(args.value)
    ? current.filter((entry: string) => entry !== args.value)
    : [...current, args.value]

  await ctx.db.patch(view._id, {
    hiddenState: {
      ...view.hiddenState,
      [args.key]: nextValues,
    },
    updatedAt: getNow(),
  })
}

export async function toggleViewFilterValueHandler(
  ctx: MutationCtx,
  args: ViewFilterValueArgs
) {
  assertServerToken(args.serverToken)
  const view = await requireViewMutationAccess(
    ctx,
    args.viewId,
    args.currentUserId
  )

  const current = [...((view.filters[args.key] as string[] | undefined) ?? [])]
  const next = current.includes(args.value)
    ? current.filter((entry) => entry !== args.value)
    : [...current, args.value]

  if (args.key === "labelIds" && next.length > 0) {
    const workspaceId = await resolveViewWorkspaceId(
      ctx,
      view,
      args.currentUserId
    )

    if (!workspaceId) {
      throw new Error("Workspace not found")
    }

    await assertWorkspaceLabelIds(ctx, workspaceId, next)
  }

  await ctx.db.patch(view._id, {
    filters: {
      ...view.filters,
      [args.key]: next,
    },
    updatedAt: getNow(),
  })
}

export async function clearViewFiltersHandler(
  ctx: MutationCtx,
  args: ClearViewFiltersArgs
) {
  assertServerToken(args.serverToken)
  const view = await requireViewMutationAccess(
    ctx,
    args.viewId,
    args.currentUserId
  )

  await ctx.db.patch(view._id, {
    filters: {
      ...view.filters,
      status: [],
      priority: [],
      assigneeIds: [],
      creatorIds: [],
      leadIds: [],
      health: [],
      milestoneIds: [],
      relationTypes: [],
      projectIds: [],
      parentIds: [],
      itemTypes: [],
      labelIds: [],
      teamIds: [],
    },
    updatedAt: getNow(),
  })
}

export async function renameViewHandler(
  ctx: MutationCtx,
  args: RenameViewArgs
) {
  assertServerToken(args.serverToken)
  const view = await requireViewMutationAccess(
    ctx,
    args.viewId,
    args.currentUserId
  )

  if (isSystemView(view)) {
    throw new Error("System views cannot be renamed")
  }

  const trimmedName = args.name.trim()

  if (trimmedName.length < viewNameMinLength) {
    throw new Error(
      `View name must be at least ${viewNameMinLength} characters`
    )
  }

  if (trimmedName.length > viewNameMaxLength) {
    throw new Error(`View name must be at most ${viewNameMaxLength} characters`)
  }

  await ctx.db.patch(view._id, {
    name: trimmedName,
    updatedAt: getNow(),
  })
}

export async function deleteViewHandler(
  ctx: MutationCtx,
  args: DeleteViewArgs
) {
  assertServerToken(args.serverToken)
  const view = await requireViewMutationAccess(
    ctx,
    args.viewId,
    args.currentUserId
  )

  if (isSystemView(view)) {
    throw new Error("System views cannot be deleted")
  }

  await ctx.db.delete(view._id)
}
