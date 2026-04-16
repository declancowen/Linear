import { buildTeamWorkViews } from "../../lib/domain/default-views"
import {
  canParentWorkItemTypeAcceptChild,
  normalizeStoredWorkItemType,
  type StoredWorkItemType,
  type ViewDefinition,
  type WorkItemType,
} from "../../lib/domain/types"
import type { MutationCtx } from "../_generated/server"

import {
  requireEditableTeamAccess,
  requireEditableWorkspaceAccess,
} from "./access"
import { getNow } from "./core"
import {
  getLabelDoc,
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

  if (!parent) {
    throw new Error("Parent item not found")
  }

  if (!team) {
    throw new Error("Team not found")
  }

  if (parent.teamId !== options.teamId) {
    throw new Error("Parent item must belong to the same team")
  }

  if (options.currentItemId && parent.id === options.currentItemId) {
    throw new Error("An item cannot be its own parent")
  }

  const normalizedParentType = normalizeStoredWorkItemType(
    parent.type as StoredWorkItemType,
    normalizeTeam(team).settings.experience,
    {
      parentId: parent.parentId,
    }
  )

  if (
    !canParentWorkItemTypeAcceptChild(normalizedParentType, options.itemType)
  ) {
    throw new Error("Parent item type cannot contain this child type")
  }

  if (!options.currentItemId) {
    return parent
  }

  const visited = new Set<string>([options.currentItemId])
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

  return parent
}

export async function ensureTeamWorkViews(
  ctx: MutationCtx,
  team: Awaited<ReturnType<typeof getTeamDoc>>
) {
  if (!team) {
    return 0
  }

  const normalizedTeam = normalizeTeam(team)

  if (
    !normalizedTeam.settings.features.issues ||
    !normalizedTeam.settings.features.views
  ) {
    return 0
  }

  const existingViews = (
    await listViewsByScopeEntity(ctx, "team", team.id, "items")
  ).filter((view) => view.route === `/team/${team.slug}/work`)
  const existingByName = new Map(existingViews.map((view) => [view.name, view]))
  const legacyPrimaryView =
    existingByName.get("All work") ??
    existingByName.get("All issues") ??
    existingByName.get("All tasks") ??
    existingByName.get("Platform Priorities")
  let updatedViewCount = 0
  const needsPatch = (
    existing: (typeof existingViews)[number],
    canonicalView: ViewDefinition
  ) =>
    existing.name !== canonicalView.name ||
    existing.description !== canonicalView.description ||
    existing.layout !== canonicalView.layout ||
    JSON.stringify(existing.filters) !==
      JSON.stringify(canonicalView.filters) ||
    existing.grouping !== canonicalView.grouping ||
    existing.subGrouping !== canonicalView.subGrouping ||
    existing.ordering !== canonicalView.ordering ||
    JSON.stringify(existing.displayProps) !==
      JSON.stringify(canonicalView.displayProps) ||
    JSON.stringify(existing.hiddenState) !==
      JSON.stringify(canonicalView.hiddenState) ||
    existing.isShared !== canonicalView.isShared ||
    existing.route !== canonicalView.route

  const canonicalViews = buildTeamWorkViews({
    teamId: team.id,
    teamSlug: team.slug,
    createdAt: getNow(),
    updatedAt: getNow(),
    experience: normalizedTeam.settings.experience,
  })

  for (const canonicalView of canonicalViews) {
    const existing =
      existingByName.get(canonicalView.name) ??
      (canonicalView.name === canonicalViews[0]?.name
        ? legacyPrimaryView
        : null)

    if (existing) {
      if (needsPatch(existing, canonicalView)) {
        await ctx.db.patch(existing._id, {
          name: canonicalView.name,
          description: canonicalView.description,
          layout: canonicalView.layout,
          filters: canonicalView.filters,
          grouping: canonicalView.grouping,
          subGrouping: canonicalView.subGrouping,
          ordering: canonicalView.ordering,
          displayProps: canonicalView.displayProps,
          hiddenState: canonicalView.hiddenState,
          isShared: true,
          route: canonicalView.route,
          updatedAt: getNow(),
        })
        updatedViewCount += 1
      }
      existingByName.set(canonicalView.name, existing)
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
  parent: { primaryProjectId: string | null } | null,
  itemId: string,
  patch: {
    parentId?: string | null
    primaryProjectId?: string | null
  }
) {
  const existingItem = items.find((item) => item.id === itemId) ?? null
  const projectIds = new Map<string, string | null>(
    items.map((item) => [item.id, item.primaryProjectId])
  )
  const resolvedPrimaryProjectId =
    patch.primaryProjectId !== undefined
      ? patch.primaryProjectId
      : patch.parentId !== undefined
        ? (parent?.primaryProjectId ?? existing.primaryProjectId)
        : existing.primaryProjectId
  const nextParentId =
    patch.parentId === undefined
      ? (existingItem?.parentId ?? null)
      : patch.parentId
  const parentIds = new Map<string, string | null>(
    items.map((item) => [
      item.id,
      item.id === itemId ? (nextParentId ?? null) : item.parentId,
    ])
  )
  let rootItemId = itemId
  const visited = new Set<string>([rootItemId])

  while (true) {
    const currentParentId = parentIds.get(rootItemId) ?? null

    if (!currentParentId || visited.has(currentParentId)) {
      break
    }

    visited.add(currentParentId)
    rootItemId = currentParentId
  }

  const cascadeItemIds = new Set<string>([rootItemId])
  const queue = [rootItemId]

  while (queue.length > 0) {
    const currentId = queue.shift()

    if (!currentId) {
      continue
    }

    for (const [candidateId, candidateParentId] of parentIds) {
      if (candidateParentId !== currentId || cascadeItemIds.has(candidateId)) {
        continue
      }

      cascadeItemIds.add(candidateId)
      queue.push(candidateId)
    }
  }

  const shouldCascadeProjectLink =
    (patch.primaryProjectId !== undefined || patch.parentId !== undefined) &&
    [...cascadeItemIds].some((candidateId) => {
      const currentProjectId =
        candidateId === itemId
          ? existing.primaryProjectId
          : (projectIds.get(candidateId) ?? null)

      return currentProjectId !== resolvedPrimaryProjectId
    })

  return {
    cascadeItemIds,
    resolvedPrimaryProjectId,
    shouldCascadeProjectLink,
  }
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
  const missingLabelIds = uniqueLabelIds.filter(
    (labelId) => !workspaceLabelIds.has(labelId)
  )

  if (missingLabelIds.length === 0) {
    return
  }

  // Allow legacy pre-backfill labels that still exist without a workspaceId.
  const legacyLabels = await Promise.all(
    missingLabelIds.map((labelId) => getLabelDoc(ctx, labelId))
  )
  const hasInvalidLabel = legacyLabels.some(
    (label) => !label || (label.workspaceId != null && label.workspaceId !== workspaceId)
  )

  if (hasInvalidLabel) {
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
    const team = await getTeamDoc(ctx, view.scopeId)

    if (!team) {
      throw new Error("Team not found")
    }

    return team.workspaceId
  }

  const userAppState = await getUserAppState(ctx, userId)

  return userAppState?.currentWorkspaceId ?? null
}
