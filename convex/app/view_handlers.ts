import type { MutationCtx } from "../_generated/server"
import {
  clearViewFilterSelections,
  type ViewDefinition,
  type ViewFilters,
} from "../../lib/domain/types"

import {
  createViewDefinition,
  isRouteAllowedForViewContext,
  isSystemView,
} from "../../lib/domain/default-views"
import { getCustomPropertyScopeType } from "../../lib/domain/labels"
import { viewNameMaxLength, viewNameMinLength } from "../../lib/domain/types"
import { assertServerToken, createId, getNow } from "./core"
import { getCustomPropertyDefinitionDoc, getTeamDoc } from "./data"
import {
  requireEditableTeamAccess,
  requireEditableWorkspaceAccess,
  requireReadableTeamAccess,
  requireReadableWorkspaceAccess,
} from "./access"
import { normalizeTeam } from "./normalization"
import {
  assertViewLabelIds,
  assertWorkspaceLabelIds,
  requireViewMutationAccess,
  resolveViewWorkspaceId,
} from "./work_helpers"

type ServerAccessArgs = {
  serverToken: string
}

type ViewLayout = "list" | "board" | "timeline" | "calendar"
type ViewItemLevel =
  | "epic"
  | "feature"
  | "requirement"
  | "story"
  | "task"
  | "issue"
  | "sub-task"
  | "sub-issue"
  | null
type ViewGrouping =
  | "project"
  | "status"
  | "assignee"
  | "priority"
  | "label"
  | "team"
  | "type"
  | "parent"
  | "epic"
  | "feature"
  | "kind"
  | "createdBy"
  | "updatedBy"
type ViewOrdering =
  | "priority"
  | "updatedAt"
  | "createdAt"
  | "dueDate"
  | "targetDate"
  | "title"
  | "count"
type ViewDisplayProperty = string
type CustomDisplayPropertyViewContext = {
  scopeType: "personal" | "team" | "workspace"
  scopeId: string
  entityKind: "items" | "projects" | "docs"
  filters?: Pick<ViewDefinition["filters"], "visibility">
  isShared?: boolean
}
type CustomPropertyDefinitionDoc = NonNullable<
  Awaited<ReturnType<typeof getCustomPropertyDefinitionDoc>>
>

type ViewConfigArgs = ServerAccessArgs & {
  currentUserId: string
  viewId: string
  layout?: ViewLayout
  itemLevel?: ViewItemLevel
  showChildItems?: boolean
  grouping?: ViewGrouping
  subGrouping?: ViewGrouping | null
  ordering?: ViewOrdering
  showCompleted?: boolean
  showEmptyGroups?: boolean
  description?: string
  containerType?: "project-items" | null
  containerId?: string | null
  route?: string
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
  layout?: ViewLayout
  itemLevel?: ViewItemLevel
  showChildItems?: boolean
  grouping?: ViewGrouping
  subGrouping?: ViewGrouping | null
  ordering?: ViewOrdering
  filters?: ViewFilters
  displayProps?: ViewDisplayProperty[]
  hiddenState?: {
    groups: string[]
    subgroups: string[]
  }
}

type ViewDisplayPropertyArgs = ServerAccessArgs & {
  currentUserId: string
  viewId: string
  property: ViewDisplayProperty
}

type ReorderViewDisplayPropertiesArgs = ServerAccessArgs & {
  currentUserId: string
  viewId: string
  displayProps: ViewDisplayProperty[]
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
    | "subscriberIds"
    | "updatedByIds"
    | "documentKinds"
    | "linkedWorkItemIds"
    | "leadIds"
    | "health"
    | "milestoneIds"
    | "relationTypes"
    | "projectIds"
    | "parentIds"
    | "itemTypes"
    | "labelIds"
    | "teamIds"
    | "visibility"
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

function throwCustomDisplayPropertyUnavailable(): never {
  throw new Error("Custom property is not available in this view scope")
}

function assertViewSupportsCustomDisplayProperties(
  view: CustomDisplayPropertyViewContext
) {
  if (view.entityKind !== "items" || view.scopeType === "workspace") {
    throw new Error("Custom properties are only available on work views")
  }
}

async function loadAvailableCustomDisplayPropertyDefinition(
  ctx: MutationCtx,
  property: ViewDisplayProperty
) {
  const propertyId = property.slice("custom:".length)
  const definition = await getCustomPropertyDefinitionDoc(ctx, propertyId)

  if (
    !definition ||
    definition.isArchived ||
    definition.targetType !== "workItem"
  ) {
    throwCustomDisplayPropertyUnavailable()
  }

  return definition
}

function isOwnerPrivateTaskView(
  view: CustomDisplayPropertyViewContext,
  currentUserId: string
) {
  return (
    view.scopeId === currentUserId &&
    !view.isShared &&
    view.filters?.visibility?.length === 1 &&
    view.filters.visibility[0] === "private"
  )
}

async function assertTeamCustomDisplayPropertyAllowed(
  ctx: MutationCtx,
  currentUserId: string,
  view: CustomDisplayPropertyViewContext,
  definition: CustomPropertyDefinitionDoc
) {
  if (
    definition.teamId !== view.scopeId ||
    getCustomPropertyScopeType(definition) !== "team"
  ) {
    throwCustomDisplayPropertyUnavailable()
  }

  await requireReadableTeamAccess(ctx, definition.teamId, currentUserId)
}

async function assertPrivateCustomDisplayPropertyAllowed(
  ctx: MutationCtx,
  currentUserId: string,
  privateTaskView: boolean,
  definition: CustomPropertyDefinitionDoc
) {
  if (
    !privateTaskView ||
    (definition.ownerId ?? definition.createdBy) !== currentUserId
  ) {
    throwCustomDisplayPropertyUnavailable()
  }

  await requireReadableWorkspaceAccess(
    ctx,
    definition.workspaceId,
    currentUserId
  )
}

async function assertPersonalCustomDisplayPropertyAllowed(
  ctx: MutationCtx,
  currentUserId: string,
  view: CustomDisplayPropertyViewContext,
  definition: CustomPropertyDefinitionDoc
) {
  const privateTaskView = isOwnerPrivateTaskView(view, currentUserId)

  if (getCustomPropertyScopeType(definition) === "private") {
    await assertPrivateCustomDisplayPropertyAllowed(
      ctx,
      currentUserId,
      privateTaskView,
      definition
    )
    return
  }

  if (privateTaskView || !definition.teamId) {
    throwCustomDisplayPropertyUnavailable()
  }

  await requireReadableTeamAccess(ctx, definition.teamId, currentUserId)
}

async function assertCustomDisplayPropertyAllowed(
  ctx: MutationCtx,
  currentUserId: string,
  view: CustomDisplayPropertyViewContext,
  property: ViewDisplayProperty
) {
  if (!property.startsWith("custom:")) {
    return
  }

  assertViewSupportsCustomDisplayProperties(view)
  const definition = await loadAvailableCustomDisplayPropertyDefinition(
    ctx,
    property
  )

  if (view.scopeType === "team") {
    await assertTeamCustomDisplayPropertyAllowed(
      ctx,
      currentUserId,
      view,
      definition
    )
    return
  }

  if (view.scopeType === "personal") {
    await assertPersonalCustomDisplayPropertyAllowed(
      ctx,
      currentUserId,
      view,
      definition
    )
    return
  }

  throwCustomDisplayPropertyUnavailable()
}

async function assertDisplayPropertiesAllowed(
  ctx: MutationCtx,
  currentUserId: string,
  view: CustomDisplayPropertyViewContext,
  displayProps: ViewDisplayProperty[]
) {
  await Promise.all(
    displayProps.map((property) =>
      assertCustomDisplayPropertyAllowed(ctx, currentUserId, view, property)
    )
  )
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
      displayProps: args.displayProps as
        | ViewDefinition["displayProps"]
        | undefined,
      hiddenState: args.hiddenState,
    },
  })

  if (!view) {
    throw new Error("View route is not valid for the selected scope")
  }

  await assertDisplayPropertiesAllowed(
    ctx,
    args.currentUserId,
    view,
    view.displayProps
  )

  await ctx.db.insert("views", view)

  return view
}

function createViewConfigPatch(
  view: Awaited<ReturnType<typeof requireViewMutationAccess>>,
  args: ViewConfigArgs,
  now: string
) {
  return {
    ...getViewConfigTextPatch(view, args),
    ...getViewConfigContainerPatch(view, args),
    itemLevel: getDefinedViewConfigValue(args.itemLevel, view.itemLevel),
    showChildItems: getDefinedViewConfigValue(
      args.showChildItems,
      view.showChildItems
    ),
    grouping: args.grouping ?? view.grouping,
    subGrouping: getDefinedViewConfigValue(args.subGrouping, view.subGrouping),
    ordering: args.ordering ?? view.ordering,
    filters: getViewConfigFiltersPatch(view, args),
    updatedAt: now,
  }
}

function getViewConfigTextPatch(
  view: Awaited<ReturnType<typeof requireViewMutationAccess>>,
  args: ViewConfigArgs
) {
  return {
    description: getDefinedViewConfigValue(args.description, view.description),
    route: getDefinedViewConfigValue(args.route, view.route),
    layout: getDefinedViewConfigValue(args.layout, view.layout),
  }
}

function getViewConfigContainerPatch(
  view: Awaited<ReturnType<typeof requireViewMutationAccess>>,
  args: ViewConfigArgs
) {
  const container = {
    containerType: getDefinedViewConfigValue(
      args.containerType,
      getDefinedViewConfigValue(view.containerType, null)
    ),
    containerId: getDefinedViewConfigValue(
      args.containerId,
      getDefinedViewConfigValue(view.containerId, null)
    ),
  }

  if (Boolean(container.containerType) !== Boolean(container.containerId)) {
    throw new Error("View container is not valid")
  }

  return container
}

function getDefinedViewConfigValue<T>(
  nextValue: T | undefined,
  currentValue: T
) {
  return nextValue === undefined ? currentValue : nextValue
}

function getViewConfigFiltersPatch(
  view: Awaited<ReturnType<typeof requireViewMutationAccess>>,
  args: ViewConfigArgs
) {
  const filters = { ...view.filters }

  if (args.showCompleted !== undefined) {
    filters.showCompleted = args.showCompleted
  }

  if (args.showEmptyGroups !== undefined) {
    filters.showEmptyGroups = args.showEmptyGroups
  }

  return filters
}

async function assertUpdateViewRoute(
  ctx: MutationCtx,
  view: Awaited<ReturnType<typeof requireViewMutationAccess>>,
  route: string | undefined
) {
  if (route === undefined) {
    return
  }

  const team =
    view.scopeType === "team" ? await getTeamDoc(ctx, view.scopeId) : null
  const teamSlug = team ? normalizeTeam(team).slug : null

  if (
    !isRouteAllowedForViewContext({
      scopeType: view.scopeType,
      entityKind: view.entityKind,
      route,
      teamSlug,
    })
  ) {
    throw new Error("View route is not valid for the selected scope")
  }
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

  await assertUpdateViewRoute(ctx, view, args.route)
  await ctx.db.patch(view._id, createViewConfigPatch(view, args, getNow()))
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

  await assertDisplayPropertiesAllowed(
    ctx,
    args.currentUserId,
    view,
    nextDisplayProps
  )

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

  await assertDisplayPropertiesAllowed(
    ctx,
    args.currentUserId,
    view,
    nextDisplayProps
  )

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
  const nextFilters = {
    ...view.filters,
    [args.key]: next,
  }

  if (
    (args.key === "labelIds" || args.key === "visibility") &&
    (nextFilters.labelIds ?? []).length > 0
  ) {
    const workspaceId = await resolveViewWorkspaceId(
      ctx,
      view,
      args.currentUserId
    )

    if (!workspaceId) {
      throw new Error("Workspace not found")
    }

    await assertViewLabelIds(ctx, {
      currentUserId: args.currentUserId,
      labelIds: nextFilters.labelIds ?? [],
      view: {
        ...view,
        filters: nextFilters,
      },
      workspaceId,
    })
  }

  if (
    args.key === "visibility" &&
    (view.displayProps ?? []).some((property) => property.startsWith("custom:"))
  ) {
    await assertDisplayPropertiesAllowed(
      ctx,
      args.currentUserId,
      {
        ...view,
        filters: nextFilters,
      },
      view.displayProps
    )
  }

  await ctx.db.patch(view._id, {
    filters: nextFilters,
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
  const nextFilters = clearViewFilterSelections(view.filters as ViewFilters)

  if (
    (view.displayProps ?? []).some((property) => property.startsWith("custom:"))
  ) {
    await assertDisplayPropertiesAllowed(
      ctx,
      args.currentUserId,
      {
        ...view,
        filters: nextFilters,
      },
      view.displayProps
    )
  }

  await ctx.db.patch(view._id, {
    filters: nextFilters,
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
