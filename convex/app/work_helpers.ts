import {
  getCalendarDatePrefix,
  isValidCalendarDateString,
} from "../../lib/calendar-date"
import {
  buildTeamProjectViews,
  buildTeamWorkViews,
  buildWorkspaceProjectViews,
} from "../../lib/domain/default-views"
import {
  canParentWorkItemTypeAcceptChild,
  normalizeStoredWorkItemType,
  type StoredWorkItemType,
  type ViewDefinition,
  type WorkItemType,
} from "../../lib/domain/types"
import { resolveWorkItemProjectLinkUpdate } from "../../lib/domain/work-item-project-links"
import type { MutationCtx } from "../_generated/server"

import {
  requireEditableTeamAccess,
  requireEditableWorkspaceAccess,
} from "./access"
import { getNow } from "./core"
import {
  getTeamDoc,
  getUserAppState,
  getViewDoc,
  getWorkItemDoc,
  listLabelsByWorkspace,
  listViewsByScopeEntity,
  type AppCtx,
} from "./data"
import { normalizeTeam } from "./normalization"

export function projectBelongsToTeamScope(
  team: { id: string; workspaceId: string },
  project: { scopeType: "team" | "workspace"; scopeId: string }
) {
  return (
    (project.scopeType === "team" && project.scopeId === team.id) ||
    (project.scopeType === "workspace" && project.scopeId === team.workspaceId)
  )
}

export function assertScheduleDate(
  value: string | null | undefined,
  label: "Due date" | "Start date" | "Target date"
) {
  if (
    value !== undefined &&
    value !== null &&
    !isValidCalendarDateString(value)
  ) {
    throw new Error(`${label} must be a valid calendar date`)
  }
}

export function assertTargetDateOnOrAfterStartDate(input: {
  startDate?: string | null
  targetDate?: string | null
}) {
  const startDatePrefix = getCalendarDatePrefix(input.startDate)
  const targetDatePrefix = getCalendarDatePrefix(input.targetDate)

  if (
    startDatePrefix &&
    targetDatePrefix &&
    targetDatePrefix < startDatePrefix
  ) {
    throw new Error("Target date must be on or after the start date")
  }
}

type ExistingView = Awaited<ReturnType<typeof listViewsByScopeEntity>>[number]
type TeamDoc = NonNullable<Awaited<ReturnType<typeof getTeamDoc>>>
type WorkItemDoc = NonNullable<Awaited<ReturnType<typeof getWorkItemDoc>>>

function viewJsonFieldsNeedPatch(
  existing: ExistingView,
  canonicalView: ViewDefinition
) {
  return [
    [existing.filters, canonicalView.filters],
    [existing.displayProps, canonicalView.displayProps],
    [existing.hiddenState, canonicalView.hiddenState],
  ].some(([existingValue, canonicalValue]) => {
    return JSON.stringify(existingValue) !== JSON.stringify(canonicalValue)
  })
}

function viewScalarFieldsNeedPatch(
  existing: ExistingView,
  canonicalView: ViewDefinition
) {
  return [
    existing.description !== canonicalView.description,
    existing.layout !== canonicalView.layout,
    existing.grouping !== canonicalView.grouping,
    existing.subGrouping !== canonicalView.subGrouping,
    existing.ordering !== canonicalView.ordering,
    existing.isShared !== canonicalView.isShared,
    existing.route !== canonicalView.route,
  ].some(Boolean)
}

function viewItemFieldsNeedPatch(
  existing: ExistingView,
  canonicalView: ViewDefinition
) {
  return [
    existing.name !== canonicalView.name,
    (existing.itemLevel ?? null) !== (canonicalView.itemLevel ?? null),
    (existing.showChildItems ?? false) !==
      (canonicalView.showChildItems ?? false),
  ].some(Boolean)
}

function canonicalViewNeedsPatch(
  existing: ExistingView,
  canonicalView: ViewDefinition,
  options?: { includeItemFields?: boolean }
) {
  return [
    viewScalarFieldsNeedPatch(existing, canonicalView),
    viewJsonFieldsNeedPatch(existing, canonicalView),
    options?.includeItemFields === true &&
      viewItemFieldsNeedPatch(existing, canonicalView),
  ].some(Boolean)
}

function createCanonicalViewPatch(
  canonicalView: ViewDefinition,
  options?: { forceShared?: boolean; includeItemFields?: boolean }
) {
  return {
    name: canonicalView.name,
    description: canonicalView.description,
    layout: canonicalView.layout,
    ...getCanonicalViewItemFieldsPatch(canonicalView, options),
    filters: canonicalView.filters,
    grouping: canonicalView.grouping,
    subGrouping: canonicalView.subGrouping,
    ordering: canonicalView.ordering,
    displayProps: canonicalView.displayProps,
    hiddenState: canonicalView.hiddenState,
    isShared: getCanonicalViewSharedValue(canonicalView, options),
    route: canonicalView.route,
  }
}

function getCanonicalViewItemFieldsPatch(
  canonicalView: ViewDefinition,
  options?: { includeItemFields?: boolean }
) {
  if (options?.includeItemFields !== true) {
    return {}
  }

  return {
    itemLevel: canonicalView.itemLevel ?? null,
    showChildItems: canonicalView.showChildItems ?? false,
  }
}

function getCanonicalViewSharedValue(
  canonicalView: ViewDefinition,
  options?: { forceShared?: boolean }
) {
  return options?.forceShared ?? canonicalView.isShared
}

export async function validateWorkItemParent(
  ctx: AppCtx,
  options: {
    teamId: string
    itemType: WorkItemType
    parentId: string | null
    currentItemId?: string
  }
) {
  if (!options.parentId) {
    return null
  }

  const parent = await getWorkItemDoc(ctx, options.parentId)
  const team = await getTeamDoc(ctx, options.teamId)

  assertWorkItemParentExists(parent)
  assertWorkItemParentTeamExists(team)
  assertWorkItemParentBelongsToTeam(parent, options.teamId)
  assertWorkItemParentIsNotCurrentItem(parent, options.currentItemId)
  assertWorkItemParentAcceptsChildType(parent, team, options.itemType)

  if (options.currentItemId) {
    await assertWorkItemParentDoesNotCreateCycle(
      ctx,
      parent,
      options.currentItemId
    )
  }

  return parent
}

function assertWorkItemParentExists(
  parent: WorkItemDoc | null | undefined
): asserts parent is WorkItemDoc {
  if (!parent) {
    throw new Error("Parent item not found")
  }
}

function assertWorkItemParentTeamExists(
  team: TeamDoc | null | undefined
): asserts team is TeamDoc {
  if (!team) {
    throw new Error("Team not found")
  }
}

function assertWorkItemParentBelongsToTeam(
  parent: WorkItemDoc,
  teamId: string
) {
  if (parent.teamId !== teamId) {
    throw new Error("Parent item must belong to the same team")
  }
}

function assertWorkItemParentIsNotCurrentItem(
  parent: WorkItemDoc,
  currentItemId: string | undefined
) {
  if (currentItemId && parent.id === currentItemId) {
    throw new Error("An item cannot be its own parent")
  }
}

function assertWorkItemParentAcceptsChildType(
  parent: WorkItemDoc,
  team: TeamDoc,
  itemType: WorkItemType
) {
  const normalizedParentType = normalizeStoredWorkItemType(
    parent.type as StoredWorkItemType,
    normalizeTeam(team).settings.experience,
    {
      parentId: parent.parentId,
    }
  )

  if (!canParentWorkItemTypeAcceptChild(normalizedParentType, itemType)) {
    throw new Error("Parent item type cannot contain this child type")
  }
}

async function assertWorkItemParentDoesNotCreateCycle(
  ctx: AppCtx,
  parent: WorkItemDoc,
  currentItemId: string
) {
  const visited = new Set<string>([currentItemId])
  let cursor = parent

  while (cursor.parentId) {
    if (visited.has(cursor.parentId)) {
      throw new Error("Parent item would create a cycle")
    }

    visited.add(cursor.parentId)
    const nextParent = await getWorkItemDoc(ctx, cursor.parentId)

    if (!nextParent) {
      break
    }

    cursor = nextParent
  }
}

export async function ensureTeamWorkViews(
  ctx: MutationCtx,
  team: Awaited<ReturnType<typeof getTeamDoc>>
) {
  if (!team) {
    return 0
  }

  const normalizedTeam = normalizeTeam(team)

  if (!teamSupportsDefaultWorkViews(normalizedTeam)) {
    return 0
  }

  const existingViews = await listExistingTeamWorkRouteViews(ctx, team)
  const existingByName = new Map(existingViews.map((view) => [view.name, view]))
  const legacyPrimaryView = getLegacyPrimaryTeamWorkView(existingByName)
  let updatedViewCount = 0

  const canonicalViews = buildTeamWorkViews({
    teamId: team.id,
    teamSlug: team.slug,
    createdAt: getNow(),
    updatedAt: getNow(),
    experience: normalizedTeam.settings.experience,
  })

  for (const canonicalView of canonicalViews) {
    const existing = resolveExistingTeamWorkView({
      canonicalView,
      canonicalViews,
      existingByName,
      legacyPrimaryView,
    })

    updatedViewCount += await upsertCanonicalTeamWorkView(
      ctx,
      existingByName,
      canonicalView,
      existing
    )
  }

  return updatedViewCount
}

function teamSupportsDefaultWorkViews(team: ReturnType<typeof normalizeTeam>) {
  return team.settings.features.issues && team.settings.features.views
}

async function listExistingTeamWorkRouteViews(ctx: MutationCtx, team: TeamDoc) {
  const route = `/team/${team.slug}/work`
  const views = await listViewsByScopeEntity(ctx, "team", team.id, "items")

  return views.filter((view) => view.route === route)
}

function getLegacyPrimaryTeamWorkView(
  existingByName: Map<string, ExistingView>
) {
  return (
    existingByName.get("All work") ??
    existingByName.get("All issues") ??
    existingByName.get("All tasks") ??
    existingByName.get("Platform Priorities") ??
    null
  )
}

function resolveExistingTeamWorkView({
  canonicalView,
  canonicalViews,
  existingByName,
  legacyPrimaryView,
}: {
  canonicalView: ViewDefinition
  canonicalViews: ViewDefinition[]
  existingByName: Map<string, ExistingView>
  legacyPrimaryView: ExistingView | null
}) {
  return (
    existingByName.get(canonicalView.name) ??
    (canonicalView.name === canonicalViews[0]?.name ? legacyPrimaryView : null)
  )
}

async function upsertCanonicalTeamWorkView(
  ctx: MutationCtx,
  existingByName: Map<string, ExistingView>,
  canonicalView: ViewDefinition,
  existing: ExistingView | null
) {
  if (!existing) {
    await ctx.db.insert("views", canonicalView)
    return 1
  }

  existingByName.set(canonicalView.name, existing)

  if (
    !canonicalViewNeedsPatch(existing, canonicalView, {
      includeItemFields: true,
    })
  ) {
    return 0
  }

  await ctx.db.patch(existing._id, {
    ...createCanonicalViewPatch(canonicalView, {
      forceShared: true,
      includeItemFields: true,
    }),
    updatedAt: getNow(),
  })

  return 1
}

export async function ensureTeamProjectViews(
  ctx: MutationCtx,
  team: Awaited<ReturnType<typeof getTeamDoc>>
) {
  if (!canEnsureTeamProjectViews(team)) {
    return 0
  }

  const existingViews = await listExistingTeamProjectViews(ctx, team)
  const existingByName = new Map(existingViews.map((view) => [view.name, view]))
  const now = getNow()
  const canonicalViews = buildTeamProjectViews({
    teamId: team.id,
    teamSlug: team.slug,
    createdAt: now,
    updatedAt: now,
  })

  return upsertCanonicalTeamProjectViews(ctx, {
    canonicalViews,
    existingByName,
    now,
  })
}

function canEnsureTeamProjectViews(
  team: Awaited<ReturnType<typeof getTeamDoc>>
): team is NonNullable<Awaited<ReturnType<typeof getTeamDoc>>> {
  if (!team) {
    return false
  }

  const normalizedTeam = normalizeTeam(team)

  return (
    normalizedTeam.settings.features.projects &&
    normalizedTeam.settings.features.views
  )
}

async function listExistingTeamProjectViews(
  ctx: MutationCtx,
  team: NonNullable<Awaited<ReturnType<typeof getTeamDoc>>>
) {
  return (await listViewsByScopeEntity(ctx, "team", team.id, "projects")).filter(
    (view) => view.route === `/team/${team.slug}/projects`
  )
}

async function upsertCanonicalTeamProjectViews(
  ctx: MutationCtx,
  input: {
    canonicalViews: ViewDefinition[]
    existingByName: Map<string, ExistingView>
    now: string
  }
) {
  let updatedViewCount = 0

  for (const canonicalView of input.canonicalViews) {
    const existing = input.existingByName.get(canonicalView.name) ?? null

    if (existing) {
      if (canonicalViewNeedsPatch(existing, canonicalView)) {
        await ctx.db.patch(existing._id, {
          ...createCanonicalViewPatch(canonicalView),
          updatedAt: input.now,
        })
        updatedViewCount += 1
      }

      continue
    }

    await ctx.db.insert("views", canonicalView)
    updatedViewCount += 1
  }

  return updatedViewCount
}

export async function ensureWorkspaceProjectViews(
  ctx: MutationCtx,
  workspaceId: string
) {
  const existingViews = (
    await listViewsByScopeEntity(ctx, "workspace", workspaceId, "projects")
  ).filter((view) => view.route === "/workspace/projects")
  const existingByName = new Map(existingViews.map((view) => [view.name, view]))
  let updatedViewCount = 0
  const now = getNow()
  const canonicalViews = buildWorkspaceProjectViews({
    workspaceId,
    createdAt: now,
    updatedAt: now,
  })

  for (const canonicalView of canonicalViews) {
    const existing = existingByName.get(canonicalView.name) ?? null

    if (existing) {
      if (canonicalViewNeedsPatch(existing, canonicalView)) {
        await ctx.db.patch(existing._id, {
          ...createCanonicalViewPatch(canonicalView),
          updatedAt: now,
        })
        updatedViewCount += 1
      }

      continue
    }

    await ctx.db.insert("views", canonicalView)
    updatedViewCount += 1
  }

  return updatedViewCount
}

export function collectWorkItemCascadeIds(
  items: Array<{ id: string; parentId: string | null }>,
  rootItemId: string
) {
  const deletedItemIds = new Set<string>([rootItemId])
  const queue = [rootItemId]

  while (queue.length > 0) {
    const currentId = queue.shift()

    if (!currentId) {
      continue
    }

    for (const item of items) {
      if (item.parentId !== currentId || deletedItemIds.has(item.id)) {
        continue
      }

      deletedItemIds.add(item.id)
      queue.push(item.id)
    }
  }

  return deletedItemIds
}

export function getResolvedProjectLinkForWorkItemUpdate(
  items: Array<{
    id: string
    parentId: string | null
    primaryProjectId: string | null
  }>,
  existing: { primaryProjectId: string | null },
  itemId: string,
  patch: {
    parentId?: string | null
    primaryProjectId?: string | null
  }
) {
  return resolveWorkItemProjectLinkUpdate({
    items,
    itemId,
    existingPrimaryProjectId: existing.primaryProjectId,
    patch,
  })
}

export async function requireViewMutationAccess(
  ctx: AppCtx,
  viewId: string,
  userId: string
) {
  const view = await getViewDoc(ctx, viewId)

  if (!view) {
    throw new Error("View not found")
  }

  if (view.scopeType === "personal") {
    if (view.scopeId !== userId) {
      throw new Error("You do not have access to this view")
    }

    return view
  }

  if (view.scopeType === "team") {
    await requireEditableTeamAccess(ctx, view.scopeId, userId)
    return view
  }

  await requireEditableWorkspaceAccess(ctx, view.scopeId, userId)
  return view
}

export async function assertWorkspaceLabelIds(
  ctx: AppCtx,
  workspaceId: string,
  labelIds: Iterable<string> | null | undefined
) {
  const uniqueLabelIds = [...new Set(labelIds ?? [])]

  if (uniqueLabelIds.length === 0) {
    return
  }

  const workspaceLabels = await listLabelsByWorkspace(ctx, workspaceId)
  const workspaceLabelIds = new Set(workspaceLabels.map((label) => label.id))

  if (uniqueLabelIds.some((labelId) => !workspaceLabelIds.has(labelId))) {
    throw new Error("One or more labels are invalid")
  }
}

export async function resolveViewWorkspaceId(
  ctx: AppCtx,
  view: Awaited<ReturnType<typeof getViewDoc>>,
  userId: string
) {
  if (!view) {
    return null
  }

  if (view.scopeType === "workspace") {
    return view.scopeId
  }

  if (view.scopeType === "team") {
    return resolveTeamViewWorkspaceId(ctx, view.scopeId)
  }

  return resolvePersonalViewWorkspaceId(ctx, userId)
}

async function resolveTeamViewWorkspaceId(ctx: AppCtx, teamId: string) {
  const team = await getTeamDoc(ctx, teamId)

  if (!team) {
    throw new Error("Team not found")
  }

  return team.workspaceId
}

async function resolvePersonalViewWorkspaceId(ctx: AppCtx, userId: string) {
  const userAppState = await getUserAppState(ctx, userId)

  return userAppState?.currentWorkspaceId ?? null
}
