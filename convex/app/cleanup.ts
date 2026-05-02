import type { Doc } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"

import { defaultUserStatus, defaultUserStatusMessage, getNow } from "./core"
import {
  findPrimaryWorkspaceChannelConversation,
  getWorkspaceUserIds,
  syncConversationParticipants,
} from "./conversations"
import {
  getTeamDoc,
  getUserDoc,
  listAttachmentsByTargets,
  listCallsByConversations,
  listChannelPostCommentsByPosts,
  listChannelPostsByConversations,
  listChatMessagesByConversations,
  listCommentsByTargets,
  listConversationsByScope,
  listDocumentPresenceByDocuments,
  listDocumentsByIds,
  listDocumentPresenceByUser,
  listLabelsByWorkspace,
  listInvitesByTeam,
  listMilestonesByProjects,
  listNotificationsByEntities,
  listPersonalViewsByUsers,
  listProjectsByScope,
  listProjectsByScopes,
  listProjectUpdatesByProjects,
  listTeamDocuments,
  listTeamsByIds,
  listViewsByScopes,
  listViewsByScope,
  listWorkItemsByTeam,
  listWorkspaceMembershipsByUser,
  listWorkspacesOwnedByUser,
  listWorkspaceTeams,
  resolvePreferredWorkspaceId,
  syncWorkspaceMembershipRoleFromTeams,
} from "./data"

function filterOutUserId(ids: string[], userId: string) {
  return ids.filter((id) => id !== userId)
}

function stripUserFromFilters<
  T extends {
    assigneeIds: string[]
    creatorIds: string[]
    leadIds: string[]
  },
>(filters: T, userId: string) {
  return {
    ...filters,
    assigneeIds: filterOutUserId(filters.assigneeIds, userId),
    creatorIds: filterOutUserId(filters.creatorIds, userId),
    leadIds: filterOutUserId(filters.leadIds, userId),
  }
}

function resolveFallbackUserId(input: {
  existingLeadId: string
  nextMemberIds: string[]
  activeUserIds: Set<string>
  preferredUserId?: string | null
}) {
  if (input.activeUserIds.has(input.existingLeadId)) {
    return input.existingLeadId
  }

  const memberFallback = input.nextMemberIds.find((id) =>
    input.activeUserIds.has(id)
  )

  if (memberFallback) {
    return memberFallback
  }

  if (input.preferredUserId && input.activeUserIds.has(input.preferredUserId)) {
    return input.preferredUserId
  }

  return [...input.activeUserIds][0] ?? input.existingLeadId
}

function filterRemovedIds(ids: string[], removedIds: Set<string>) {
  return ids.filter((id) => !removedIds.has(id))
}

function dedupeById<T extends { id: string }>(entries: T[]) {
  return [
    ...new Map(entries.map((entry) => [entry.id, entry] as const)).values(),
  ]
}

type CleanupLabelDoc = Awaited<ReturnType<typeof listLabelsByWorkspace>>[number]
type CleanupViewDoc = Awaited<ReturnType<typeof listViewsByScopes>>[number]
type CleanupProjectDoc = Awaited<
  ReturnType<typeof listProjectsByScopes>
>[number]
type CleanupWorkItemDoc = Awaited<
  ReturnType<typeof listWorkItemsByTeam>
>[number]
type DeletedLinkIds = {
  deletedDocumentIds: Set<string>
  deletedMilestoneIds: Set<string>
  deletedProjectIds: Set<string>
  deletedWorkItemIds: Set<string>
}

async function getAccessibleWorkspaceIdsForUser(
  ctx: MutationCtx,
  userId: string
) {
  const [workspaceMemberships, memberships, ownedWorkspaces] =
    await Promise.all([
      listWorkspaceMembershipsByUser(ctx, userId),
      ctx.db
        .query("teamMemberships")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      listWorkspacesOwnedByUser(ctx, userId),
    ])
  const teams = await listTeamsByIds(
    ctx,
    memberships.map((membership) => membership.teamId)
  )

  return new Set<string>([
    ...workspaceMemberships.map((membership) => membership.workspaceId),
    ...teams.map((team) => team.workspaceId),
    ...ownedWorkspaces.map((workspace) => workspace.id),
  ])
}

type RemovedAccessProject = Awaited<
  ReturnType<typeof listProjectsByScopes>
>[number]
type RemovedAccessView = Awaited<ReturnType<typeof listViewsByScopes>>[number]
type RemovedAccessWorkItem = Awaited<
  ReturnType<typeof listWorkItemsByTeam>
>[number]
type RemovedAccessPresence = Awaited<
  ReturnType<typeof listDocumentPresenceByUser>
>[number]
type RemovedAccessDocument = Awaited<
  ReturnType<typeof listDocumentsByIds>
>[number]

function isRemovedAccessScope(input: {
  scopeType: "team" | "workspace" | string
  scopeId: string
  removedTeamIdSet: Set<string>
  workspaceId: string
  hasWorkspaceAccess: boolean
}) {
  return (
    (input.scopeType === "team" && input.removedTeamIdSet.has(input.scopeId)) ||
    (!input.hasWorkspaceAccess &&
      input.scopeType === "workspace" &&
      input.scopeId === input.workspaceId)
  )
}

async function getActiveTeamUserIds(
  ctx: MutationCtx,
  removedTeamIds: string[]
) {
  const activeTeamUserIds = new Map<string, Set<string>>()

  for (const teamId of removedTeamIds) {
    const memberships = await ctx.db
      .query("teamMemberships")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .collect()

    activeTeamUserIds.set(
      teamId,
      new Set(memberships.map((membership) => membership.userId))
    )
  }

  return activeTeamUserIds
}

function buildRemovedAccessScopes(input: {
  removedTeamIds: string[]
  hasWorkspaceAccess: boolean
  workspaceId: string
}) {
  return [
    ...input.removedTeamIds.map((teamId) => ({
      scopeType: "team" as const,
      scopeId: teamId,
    })),
    ...(!input.hasWorkspaceAccess
      ? [
          {
            scopeType: "workspace" as const,
            scopeId: input.workspaceId,
          },
        ]
      : []),
  ]
}

async function cleanupRemovedUserProjects(
  ctx: MutationCtx,
  input: {
    projects: RemovedAccessProject[]
    removedUserId: string
    currentUserId: string
    workspaceId: string
    hasWorkspaceAccess: boolean
    removedTeamIdSet: Set<string>
    activeTeamUserIds: Map<string, Set<string>>
    activeWorkspaceUserIds: Set<string>
  }
) {
  for (const project of input.projects) {
    if (
      !isRemovedAccessScope({
        scopeType: project.scopeType,
        scopeId: project.scopeId,
        removedTeamIdSet: input.removedTeamIdSet,
        workspaceId: input.workspaceId,
        hasWorkspaceAccess: input.hasWorkspaceAccess,
      })
    ) {
      continue
    }

    const activeUserIds =
      project.scopeType === "team"
        ? (input.activeTeamUserIds.get(project.scopeId) ?? new Set<string>())
        : input.activeWorkspaceUserIds
    const nextMemberIds = filterOutUserId(
      project.memberIds,
      input.removedUserId
    )
    const nextLeadId =
      project.leadId === input.removedUserId
        ? resolveFallbackUserId({
            existingLeadId: project.leadId,
            nextMemberIds,
            activeUserIds,
            preferredUserId: input.currentUserId,
          })
        : project.leadId
    const nextPresentation = project.presentation
      ? {
          ...project.presentation,
          filters: stripUserFromFilters(
            project.presentation.filters,
            input.removedUserId
          ),
        }
      : project.presentation
    const presentationChanged =
      JSON.stringify(nextPresentation) !== JSON.stringify(project.presentation)

    if (
      nextLeadId === project.leadId &&
      nextMemberIds.length === project.memberIds.length &&
      !presentationChanged
    ) {
      continue
    }

    await ctx.db.patch(project._id, {
      leadId: nextLeadId,
      memberIds: nextMemberIds,
      presentation: nextPresentation,
      updatedAt: getNow(),
    })
  }
}

async function cleanupRemovedUserWorkItems(
  ctx: MutationCtx,
  input: {
    workItems: RemovedAccessWorkItem[]
    removedUserId: string
    removedTeamIdSet: Set<string>
  }
) {
  for (const workItem of input.workItems) {
    if (!input.removedTeamIdSet.has(workItem.teamId)) {
      continue
    }

    const nextAssigneeId =
      workItem.assigneeId === input.removedUserId ? null : workItem.assigneeId
    const nextSubscriberIds = filterOutUserId(
      workItem.subscriberIds,
      input.removedUserId
    )

    if (
      nextAssigneeId === workItem.assigneeId &&
      nextSubscriberIds.length === workItem.subscriberIds.length
    ) {
      continue
    }

    await ctx.db.patch(workItem._id, {
      assigneeId: nextAssigneeId,
      subscriberIds: nextSubscriberIds,
      updatedAt: getNow(),
    })
  }
}

async function cleanupRemovedUserViews(
  ctx: MutationCtx,
  input: {
    views: RemovedAccessView[]
    removedUserId: string
    workspaceId: string
    hasWorkspaceAccess: boolean
    removedTeamIdSet: Set<string>
  }
) {
  for (const view of input.views) {
    if (
      !isRemovedAccessScope({
        scopeType: view.scopeType,
        scopeId: view.scopeId,
        removedTeamIdSet: input.removedTeamIdSet,
        workspaceId: input.workspaceId,
        hasWorkspaceAccess: input.hasWorkspaceAccess,
      })
    ) {
      continue
    }

    const nextFilters = stripUserFromFilters(view.filters, input.removedUserId)

    if (
      nextFilters.assigneeIds.length === view.filters.assigneeIds.length &&
      nextFilters.creatorIds.length === view.filters.creatorIds.length &&
      nextFilters.leadIds.length === view.filters.leadIds.length
    ) {
      continue
    }

    await ctx.db.patch(view._id, {
      filters: nextFilters,
      updatedAt: getNow(),
    })
  }
}

async function cleanupRemovedUserDocumentPresence(
  ctx: MutationCtx,
  input: {
    documentPresence: RemovedAccessPresence[]
    documentsById: Map<string, RemovedAccessDocument>
    removedUserId: string
    workspaceId: string
    hasWorkspaceAccess: boolean
    removedTeamIdSet: Set<string>
  }
) {
  for (const presence of input.documentPresence) {
    if (presence.userId !== input.removedUserId) {
      continue
    }

    const document = input.documentsById.get(presence.documentId) ?? null

    if (!document) {
      continue
    }

    const isRemovedTeamDocument =
      document.teamId !== null && input.removedTeamIdSet.has(document.teamId)
    const isRemovedWorkspaceDocument =
      !input.hasWorkspaceAccess && document.workspaceId === input.workspaceId

    if (!isRemovedTeamDocument && !isRemovedWorkspaceDocument) {
      continue
    }

    await ctx.db.delete(presence._id)
  }
}

async function cleanupRemovedUserWorkspaceState(
  ctx: MutationCtx,
  input: {
    removedUserId: string
    workspaceId: string
  }
) {
  await cleanupUserAppStateForRemovedWorkspaceAccess(ctx, {
    userId: input.removedUserId,
    workspaceId: input.workspaceId,
  })

  const remainingWorkspaceIds = await getAccessibleWorkspaceIdsForUser(
    ctx,
    input.removedUserId
  )

  if (remainingWorkspaceIds.size > 0) {
    return
  }

  const removedUser = await getUserDoc(ctx, input.removedUserId)

  if (!removedUser) {
    return
  }

  await ctx.db.patch(removedUser._id, {
    status: defaultUserStatus,
    statusMessage: defaultUserStatusMessage,
    hasExplicitStatus: false,
  })
}

export async function deleteDocs(
  ctx: MutationCtx,
  docs: Array<{ _id: Parameters<MutationCtx["db"]["delete"]>[0] }>
) {
  for (const doc of docs) {
    await ctx.db.delete(doc._id)
  }
}

export async function deleteStorageObjects(
  ctx: MutationCtx,
  storageIds: Iterable<string>
) {
  for (const storageId of new Set(storageIds)) {
    await ctx.storage.delete(storageId as never)
  }
}

export async function cleanupViewFiltersForDeletedEntities(
  ctx: MutationCtx,
  input: {
    deletedTeamIds?: Set<string>
    deletedProjectIds?: Set<string>
    deletedMilestoneIds?: Set<string>
  }
) {
  const deletedTeamIds = input.deletedTeamIds ?? new Set<string>()
  const deletedProjectIds = input.deletedProjectIds ?? new Set<string>()
  const deletedMilestoneIds = input.deletedMilestoneIds ?? new Set<string>()
  const views = await ctx.db.query("views").collect()

  for (const view of views) {
    const nextFilters = {
      ...view.filters,
      teamIds: filterRemovedIds(view.filters.teamIds, deletedTeamIds),
      projectIds: filterRemovedIds(view.filters.projectIds, deletedProjectIds),
      milestoneIds: filterRemovedIds(
        view.filters.milestoneIds,
        deletedMilestoneIds
      ),
    }

    if (
      nextFilters.teamIds.length === view.filters.teamIds.length &&
      nextFilters.projectIds.length === view.filters.projectIds.length &&
      nextFilters.milestoneIds.length === view.filters.milestoneIds.length
    ) {
      continue
    }

    await ctx.db.patch(view._id, {
      filters: nextFilters,
      updatedAt: getNow(),
    })
  }
}

function getDeletedLinkIds(input: {
  deletedDocumentIds?: Set<string>
  deletedWorkItemIds?: Set<string>
  deletedProjectIds?: Set<string>
  deletedMilestoneIds?: Set<string>
}): DeletedLinkIds {
  return {
    deletedDocumentIds: input.deletedDocumentIds ?? new Set<string>(),
    deletedMilestoneIds: input.deletedMilestoneIds ?? new Set<string>(),
    deletedProjectIds: input.deletedProjectIds ?? new Set<string>(),
    deletedWorkItemIds: input.deletedWorkItemIds ?? new Set<string>(),
  }
}

function getDocumentLinkCleanupPatch(
  document: Doc<"documents">,
  deletedIds: DeletedLinkIds
) {
  const nextLinkedProjectIds = filterRemovedIds(
    document.linkedProjectIds,
    deletedIds.deletedProjectIds
  )
  const nextLinkedWorkItemIds = filterRemovedIds(
    document.linkedWorkItemIds,
    deletedIds.deletedWorkItemIds
  )

  if (
    nextLinkedProjectIds.length === document.linkedProjectIds.length &&
    nextLinkedWorkItemIds.length === document.linkedWorkItemIds.length
  ) {
    return null
  }

  return {
    linkedProjectIds: nextLinkedProjectIds,
    linkedWorkItemIds: nextLinkedWorkItemIds,
  }
}

async function cleanupDocumentLinksAfterDelete(
  ctx: MutationCtx,
  input: {
    currentUserId: string
    deletedIds: DeletedLinkIds
    documents: Doc<"documents">[]
  }
) {
  for (const document of input.documents) {
    if (input.deletedIds.deletedDocumentIds.has(document.id)) {
      continue
    }

    const patch = getDocumentLinkCleanupPatch(document, input.deletedIds)

    if (!patch) {
      continue
    }

    await ctx.db.patch(document._id, {
      ...patch,
      updatedAt: getNow(),
      updatedBy: input.currentUserId,
    })
  }
}

function getWorkItemLinkCleanupPatch(
  workItem: Doc<"workItems">,
  deletedIds: DeletedLinkIds
) {
  const nextLinkedDocumentIds = filterRemovedIds(
    workItem.linkedDocumentIds,
    deletedIds.deletedDocumentIds
  )
  const nextLinkedProjectIds = filterRemovedIds(
    workItem.linkedProjectIds,
    deletedIds.deletedProjectIds
  )
  const nextPrimaryProjectId =
    workItem.primaryProjectId &&
    deletedIds.deletedProjectIds.has(workItem.primaryProjectId)
      ? null
      : workItem.primaryProjectId
  const nextMilestoneId =
    workItem.milestoneId &&
    deletedIds.deletedMilestoneIds.has(workItem.milestoneId)
      ? null
      : workItem.milestoneId

  if (
    nextLinkedDocumentIds.length === workItem.linkedDocumentIds.length &&
    nextLinkedProjectIds.length === workItem.linkedProjectIds.length &&
    nextPrimaryProjectId === workItem.primaryProjectId &&
    nextMilestoneId === workItem.milestoneId
  ) {
    return null
  }

  return {
    linkedDocumentIds: nextLinkedDocumentIds,
    linkedProjectIds: nextLinkedProjectIds,
    primaryProjectId: nextPrimaryProjectId,
    milestoneId: nextMilestoneId,
  }
}

async function cleanupWorkItemLinksAfterDelete(
  ctx: MutationCtx,
  input: {
    deletedIds: DeletedLinkIds
    workItems: Doc<"workItems">[]
  }
) {
  for (const workItem of input.workItems) {
    if (input.deletedIds.deletedWorkItemIds.has(workItem.id)) {
      continue
    }

    const patch = getWorkItemLinkCleanupPatch(workItem, input.deletedIds)

    if (!patch) {
      continue
    }

    await ctx.db.patch(workItem._id, {
      ...patch,
      updatedAt: getNow(),
    })
  }
}

export async function cleanupRemainingLinksAfterDelete(
  ctx: MutationCtx,
  input: {
    currentUserId: string
    deletedDocumentIds?: Set<string>
    deletedWorkItemIds?: Set<string>
    deletedProjectIds?: Set<string>
    deletedMilestoneIds?: Set<string>
  }
) {
  const deletedIds = getDeletedLinkIds(input)
  const [documents, workItems] = await Promise.all([
    ctx.db.query("documents").collect(),
    ctx.db.query("workItems").collect(),
  ])

  await cleanupDocumentLinksAfterDelete(ctx, {
    currentUserId: input.currentUserId,
    deletedIds,
    documents,
  })
  await cleanupWorkItemLinksAfterDelete(ctx, {
    deletedIds,
    workItems,
  })
}

async function getCleanupUnusedLabelDocuments(
  ctx: MutationCtx,
  workspaceId?: string
) {
  return workspaceId
    ? listLabelsByWorkspace(ctx, workspaceId)
    : ctx.db.query("labels").collect()
}

async function getWorkspaceLabelCleanupScope(
  ctx: MutationCtx,
  workspaceId: string
) {
  const [workspaceTeams, workspaceUserIds] = await Promise.all([
    listWorkspaceTeams(ctx, workspaceId),
    getWorkspaceUserIds(ctx, workspaceId),
  ])
  const scopedEntities = [
    {
      scopeType: "workspace" as const,
      scopeId: workspaceId,
    },
    ...workspaceTeams.map((team) => ({
      scopeType: "team" as const,
      scopeId: team.id,
    })),
  ]

  return {
    scopedEntities,
    workspaceTeams,
    workspaceUserIds,
  }
}

async function listWorkspaceLabelReferences(
  ctx: MutationCtx,
  workspaceId: string
): Promise<{
  projects: CleanupProjectDoc[]
  relevantViews: CleanupViewDoc[]
  workItems: CleanupWorkItemDoc[]
}> {
  const { scopedEntities, workspaceTeams, workspaceUserIds } =
    await getWorkspaceLabelCleanupScope(ctx, workspaceId)
  const [workItemsByTeam, views, personalViews, projects] = await Promise.all([
    Promise.all(
      workspaceTeams.map((team) => listWorkItemsByTeam(ctx, team.id))
    ),
    listViewsByScopes(ctx, scopedEntities),
    listPersonalViewsByUsers(ctx, workspaceUserIds),
    listProjectsByScopes(ctx, scopedEntities),
  ])

  return {
    projects,
    relevantViews: [...views, ...personalViews],
    workItems: workItemsByTeam.flat(),
  }
}

async function listGlobalLabelReferences(ctx: MutationCtx): Promise<{
  projects: CleanupProjectDoc[]
  relevantViews: CleanupViewDoc[]
  workItems: CleanupWorkItemDoc[]
}> {
  const [relevantViews, projects, workItems] = await Promise.all([
    ctx.db.query("views").collect(),
    ctx.db.query("projects").collect(),
    ctx.db.query("workItems").collect(),
  ])

  return {
    projects,
    relevantViews,
    workItems,
  }
}

function getUsedCleanupLabelIds(input: {
  projects: CleanupProjectDoc[]
  relevantViews: CleanupViewDoc[]
  workItems: CleanupWorkItemDoc[]
}) {
  return new Set([
    ...input.workItems.flatMap((workItem) => workItem.labelIds),
    ...input.relevantViews.flatMap((view) => view.filters.labelIds),
    ...input.projects.flatMap(
      (project) => project.presentation?.filters.labelIds ?? []
    ),
  ])
}

function getUnusedCleanupLabelIds(
  labels: CleanupLabelDoc[],
  usedLabelIds: Set<string>
) {
  return labels
    .filter((label) => !usedLabelIds.has(label.id))
    .map((label) => label.id)
}

async function cleanupDeletedLabelViewFilters(
  ctx: MutationCtx,
  input: {
    deletedLabelIds: Set<string>
    views: CleanupViewDoc[]
  }
) {
  for (const view of input.views) {
    const nextLabelIds = filterRemovedIds(
      view.filters.labelIds,
      input.deletedLabelIds
    )

    if (nextLabelIds.length === view.filters.labelIds.length) {
      continue
    }

    await ctx.db.patch(view._id, {
      filters: {
        ...view.filters,
        labelIds: nextLabelIds,
      },
      updatedAt: getNow(),
    })
  }
}

async function deleteCleanupLabels(
  ctx: MutationCtx,
  input: {
    deletedLabelIds: Set<string>
    labels: CleanupLabelDoc[]
  }
) {
  for (const label of input.labels) {
    if (!input.deletedLabelIds.has(label.id)) {
      continue
    }

    await ctx.db.delete(label._id)
  }
}

export async function cleanupUnusedLabels(
  ctx: MutationCtx,
  workspaceId?: string
) {
  const labels = await getCleanupUnusedLabelDocuments(ctx, workspaceId)

  if (labels.length === 0) {
    return []
  }

  const references = workspaceId
    ? await listWorkspaceLabelReferences(ctx, workspaceId)
    : await listGlobalLabelReferences(ctx)
  const deletedLabelIds = getUnusedCleanupLabelIds(
    labels,
    getUsedCleanupLabelIds(references)
  )

  if (deletedLabelIds.length === 0) {
    return deletedLabelIds
  }

  const deletedLabelIdSet = new Set(deletedLabelIds)

  await cleanupDeletedLabelViewFilters(ctx, {
    deletedLabelIds: deletedLabelIdSet,
    views: references.relevantViews,
  })
  await deleteCleanupLabels(ctx, {
    deletedLabelIds: deletedLabelIdSet,
    labels,
  })

  return deletedLabelIds
}

export async function cleanupUserAppStateForRemovedWorkspaceAccess(
  ctx: MutationCtx,
  input: {
    userId: string
    workspaceId: string
  }
) {
  const userAppState = await ctx.db
    .query("userAppStates")
    .withIndex("by_user", (q) => q.eq("userId", input.userId))
    .unique()

  if (!userAppState || userAppState.currentWorkspaceId !== input.workspaceId) {
    return
  }

  const accessibleWorkspaceIds = await getAccessibleWorkspaceIdsForUser(
    ctx,
    input.userId
  )
  const nextWorkspaceId = resolvePreferredWorkspaceId({
    selectedWorkspaceId: null,
    accessibleWorkspaceIds,
    fallbackWorkspaceIds: [...accessibleWorkspaceIds],
  })

  if (nextWorkspaceId) {
    await ctx.db.patch(userAppState._id, {
      currentWorkspaceId: nextWorkspaceId,
    })
    return
  }

  await ctx.db.delete(userAppState._id)
}

export async function cleanupUserAccessRemoval(
  ctx: MutationCtx,
  input: {
    currentUserId: string
    removedUserId: string
    workspaceId: string
    removedTeamIds: string[]
  }
) {
  const removedTeamIds = [...new Set(input.removedTeamIds)]
  const removedTeamIdSet = new Set(removedTeamIds)
  const activeWorkspaceUserIds = new Set(
    await getWorkspaceUserIds(ctx, input.workspaceId)
  )
  const hasWorkspaceAccess = activeWorkspaceUserIds.has(input.removedUserId)
  const activeTeamUserIds = await getActiveTeamUserIds(ctx, removedTeamIds)

  const documentPresence = await listDocumentPresenceByUser(
    ctx,
    input.removedUserId
  )
  const scopedEntities = buildRemovedAccessScopes({
    removedTeamIds,
    hasWorkspaceAccess,
    workspaceId: input.workspaceId,
  })
  const [projects, views, workItemsByTeam, documents] = await Promise.all([
    listProjectsByScopes(ctx, scopedEntities),
    listViewsByScopes(ctx, scopedEntities),
    Promise.all(
      removedTeamIds.map((teamId) => listWorkItemsByTeam(ctx, teamId))
    ),
    listDocumentsByIds(
      ctx,
      documentPresence.map((presence) => presence.documentId)
    ),
  ])
  const workItems = workItemsByTeam.flat()
  const documentsById = new Map(
    documents.map((document) => [document.id, document])
  )

  await cleanupRemovedUserProjects(ctx, {
    projects,
    removedUserId: input.removedUserId,
    currentUserId: input.currentUserId,
    workspaceId: input.workspaceId,
    hasWorkspaceAccess,
    removedTeamIdSet,
    activeTeamUserIds,
    activeWorkspaceUserIds,
  })
  await cleanupRemovedUserWorkItems(ctx, {
    workItems,
    removedUserId: input.removedUserId,
    removedTeamIdSet,
  })
  await cleanupRemovedUserViews(ctx, {
    views,
    removedUserId: input.removedUserId,
    workspaceId: input.workspaceId,
    hasWorkspaceAccess,
    removedTeamIdSet,
  })
  await cleanupRemovedUserDocumentPresence(ctx, {
    documentPresence,
    documentsById,
    removedUserId: input.removedUserId,
    workspaceId: input.workspaceId,
    hasWorkspaceAccess,
    removedTeamIdSet,
  })

  if (!hasWorkspaceAccess) {
    await cleanupRemovedUserWorkspaceState(ctx, {
      removedUserId: input.removedUserId,
      workspaceId: input.workspaceId,
    })
  }

  return {
    workspaceId: input.workspaceId,
    removedTeamIds,
    hasWorkspaceAccess,
  }
}

export async function cleanupUserAppStatesForDeletedWorkspace(
  ctx: MutationCtx,
  deletedWorkspaceId: string
) {
  const userAppStates = await ctx.db.query("userAppStates").collect()

  for (const userAppState of userAppStates) {
    if (userAppState.currentWorkspaceId !== deletedWorkspaceId) {
      continue
    }

    const accessibleWorkspaceIds = await getAccessibleWorkspaceIdsForUser(
      ctx,
      userAppState.userId
    )

    const nextWorkspaceId = resolvePreferredWorkspaceId({
      selectedWorkspaceId: null,
      accessibleWorkspaceIds,
      fallbackWorkspaceIds: [...accessibleWorkspaceIds],
    })

    if (nextWorkspaceId) {
      await ctx.db.patch(userAppState._id, {
        currentWorkspaceId: nextWorkspaceId,
      })
      continue
    }

    await ctx.db.delete(userAppState._id)
  }
}

async function getUnreferencedUserReferenceSnapshot(ctx: MutationCtx) {
  const [
    workspaces,
    workspaceMemberships,
    teamMemberships,
    userAppStates,
    projects,
    workItems,
    documents,
    views,
    comments,
    attachments,
    notifications,
    invites,
    projectUpdates,
    conversations,
    calls,
    chatMessages,
    channelPosts,
    channelPostComments,
  ] = await Promise.all([
    ctx.db.query("workspaces").collect(),
    ctx.db.query("workspaceMemberships").collect(),
    ctx.db.query("teamMemberships").collect(),
    ctx.db.query("userAppStates").collect(),
    ctx.db.query("projects").collect(),
    ctx.db.query("workItems").collect(),
    ctx.db.query("documents").collect(),
    ctx.db.query("views").collect(),
    ctx.db.query("comments").collect(),
    ctx.db.query("attachments").collect(),
    ctx.db.query("notifications").collect(),
    ctx.db.query("invites").collect(),
    ctx.db.query("projectUpdates").collect(),
    ctx.db.query("conversations").collect(),
    ctx.db.query("calls").collect(),
    ctx.db.query("chatMessages").collect(),
    ctx.db.query("channelPosts").collect(),
    ctx.db.query("channelPostComments").collect(),
  ])

  return {
    attachments,
    calls,
    channelPostComments,
    channelPosts,
    chatMessages,
    comments,
    conversations,
    documents,
    invites,
    notifications,
    projectUpdates,
    projects,
    teamMemberships,
    userAppStates,
    views,
    workItems,
    workspaceMemberships,
    workspaces,
  }
}

function hasUserReferenceInSnapshot(
  snapshot: Awaited<ReturnType<typeof getUnreferencedUserReferenceSnapshot>>,
  userId: string
) {
  return (
    snapshot.workspaces.some((workspace) => workspace.createdBy === userId) ||
    snapshot.workspaceMemberships.some(
      (membership) => membership.userId === userId
    ) ||
    snapshot.teamMemberships.some(
      (membership) => membership.userId === userId
    ) ||
    snapshot.projects.some(
      (project) =>
        project.leadId === userId || project.memberIds.includes(userId)
    ) ||
    snapshot.workItems.some(
      (workItem) =>
        workItem.assigneeId === userId ||
        workItem.creatorId === userId ||
        workItem.subscriberIds.includes(userId)
    ) ||
    snapshot.documents.some(
      (document) =>
        document.createdBy === userId || document.updatedBy === userId
    ) ||
    snapshot.views.some(
      (view) =>
        (view.scopeType === "personal" && view.scopeId === userId) ||
        view.filters.assigneeIds.includes(userId) ||
        view.filters.creatorIds.includes(userId) ||
        view.filters.leadIds.includes(userId)
    ) ||
    snapshot.comments.some(
      (comment) =>
        comment.createdBy === userId ||
        (comment.mentionUserIds ?? []).includes(userId)
    ) ||
    snapshot.attachments.some(
      (attachment) => attachment.uploadedBy === userId
    ) ||
    snapshot.notifications.some(
      (notification) =>
        notification.userId === userId || notification.actorId === userId
    ) ||
    snapshot.invites.some((invite) => invite.invitedBy === userId) ||
    snapshot.projectUpdates.some((update) => update.createdBy === userId) ||
    snapshot.conversations.some(
      (conversation) =>
        conversation.createdBy === userId ||
        conversation.participantIds.includes(userId)
    ) ||
    snapshot.calls.some(
      (call) =>
        call.startedBy === userId ||
        (call.participantUserIds ?? []).includes(userId) ||
        call.lastJoinedBy === userId
    ) ||
    snapshot.chatMessages.some(
      (message) =>
        message.createdBy === userId ||
        (message.mentionUserIds ?? []).includes(userId)
    ) ||
    snapshot.channelPosts.some(
      (post) =>
        post.createdBy === userId ||
        (post.reactions ?? []).some((reaction) =>
          reaction.userIds.includes(userId)
        )
    ) ||
    snapshot.channelPostComments.some(
      (comment) =>
        comment.createdBy === userId ||
        (comment.mentionUserIds ?? []).includes(userId)
    )
  )
}

async function deleteUnreferencedUser(
  ctx: MutationCtx,
  input: {
    snapshot: Awaited<ReturnType<typeof getUnreferencedUserReferenceSnapshot>>
    user: NonNullable<Awaited<ReturnType<typeof getUserDoc>>>
    userId: string
  }
) {
  const userAppState =
    input.snapshot.userAppStates.find(
      (entry) => entry.userId === input.userId
    ) ?? null

  if (userAppState) {
    await ctx.db.delete(userAppState._id)
  }

  if (input.user.avatarImageStorageId) {
    await ctx.storage.delete(input.user.avatarImageStorageId as never)
  }

  await ctx.db.delete(input.user._id)
}

export async function cleanupUnreferencedUsers(
  ctx: MutationCtx,
  candidateUserIds: Iterable<string>
) {
  const userIds = [...new Set(candidateUserIds)]

  if (userIds.length === 0) {
    return []
  }

  const referenceSnapshot = await getUnreferencedUserReferenceSnapshot(ctx)
  const deletedUserIds: string[] = []

  for (const userId of userIds) {
    const user = await getUserDoc(ctx, userId)

    if (!user) {
      continue
    }

    if (hasUserReferenceInSnapshot(referenceSnapshot, userId)) {
      continue
    }

    await deleteUnreferencedUser(ctx, {
      snapshot: referenceSnapshot,
      user,
      userId,
    })
    deletedUserIds.push(userId)
  }

  return deletedUserIds
}

export async function cascadeDeleteTeamData(
  ctx: MutationCtx,
  input: {
    currentUserId: string
    teamId: string
    syncWorkspaceChannel?: boolean
    cleanupGlobalState?: boolean
  }
) {
  const team = await getTeamDoc(ctx, input.teamId)

  if (!team) {
    throw new Error("Team not found")
  }

  const teamMemberships = await ctx.db
    .query("teamMemberships")
    .withIndex("by_team", (q) => q.eq("teamId", team.id))
    .collect()
  const membershipUserIds = teamMemberships.map(
    (membership) => membership.userId
  )
  const projects = await listProjectsByScope(ctx, "team", team.id)
  const deletedProjectIds = new Set(projects.map((project) => project.id))
  const milestones = await listMilestonesByProjects(ctx, deletedProjectIds)
  const deletedMilestoneIds = new Set(
    milestones.map((milestone) => milestone.id)
  )
  const projectUpdates = await listProjectUpdatesByProjects(
    ctx,
    deletedProjectIds
  )
  const workItems = await listWorkItemsByTeam(ctx, team.id)
  const deletedWorkItemIds = new Set(workItems.map((workItem) => workItem.id))
  const deletedDescriptionDocIds = new Set(
    workItems.map((workItem) => workItem.descriptionDocId)
  )
  const [teamDocuments, descriptionDocuments] = await Promise.all([
    listTeamDocuments(ctx, team.id),
    listDocumentsByIds(ctx, deletedDescriptionDocIds),
  ])
  const documents = dedupeById([...teamDocuments, ...descriptionDocuments])
  const deletedDocumentIds = new Set(documents.map((document) => document.id))
  const views = await listViewsByScope(ctx, "team", team.id)
  const conversations = await listConversationsByScope(ctx, "team", team.id)
  const deletedConversationIds = new Set(
    conversations.map((conversation) => conversation.id)
  )
  const [calls, chatMessages, channelPosts] = await Promise.all([
    listCallsByConversations(ctx, deletedConversationIds),
    listChatMessagesByConversations(ctx, deletedConversationIds),
    listChannelPostsByConversations(ctx, deletedConversationIds),
  ])
  const deletedChatMessageIds = new Set(
    chatMessages.map((message) => message.id)
  )
  const deletedChannelPostIds = new Set(channelPosts.map((post) => post.id))
  const [
    channelPostComments,
    workItemAttachments,
    documentAttachments,
    workItemComments,
    documentComments,
    documentPresence,
    invites,
  ] = await Promise.all([
    listChannelPostCommentsByPosts(ctx, deletedChannelPostIds),
    listAttachmentsByTargets(ctx, {
      targetType: "workItem",
      targetIds: deletedWorkItemIds,
    }),
    listAttachmentsByTargets(ctx, {
      targetType: "document",
      targetIds: deletedDocumentIds,
    }),
    listCommentsByTargets(ctx, {
      targetType: "workItem",
      targetIds: deletedWorkItemIds,
    }),
    listCommentsByTargets(ctx, {
      targetType: "document",
      targetIds: deletedDocumentIds,
    }),
    listDocumentPresenceByDocuments(ctx, deletedDocumentIds),
    listInvitesByTeam(ctx, team.id),
  ])
  const attachments = [...workItemAttachments, ...documentAttachments]
  const comments = [...workItemComments, ...documentComments]
  const deletedInviteIds = new Set(invites.map((invite) => invite.id))
  const notifications = dedupeById(
    await listNotificationsByEntities(ctx, [
      ...[...deletedWorkItemIds].map((entityId) => ({
        entityType: "workItem" as const,
        entityId,
      })),
      ...[...deletedDocumentIds].map((entityId) => ({
        entityType: "document" as const,
        entityId,
      })),
      ...[...deletedProjectIds].map((entityId) => ({
        entityType: "project" as const,
        entityId,
      })),
      ...[...deletedInviteIds].map((entityId) => ({
        entityType: "invite" as const,
        entityId,
      })),
      ...[...deletedChatMessageIds].map((entityId) => ({
        entityType: "chat" as const,
        entityId,
      })),
      ...[...deletedChannelPostIds].map((entityId) => ({
        entityType: "channelPost" as const,
        entityId,
      })),
    ])
  )

  await cleanupRemainingLinksAfterDelete(ctx, {
    currentUserId: input.currentUserId,
    deletedDocumentIds,
    deletedWorkItemIds,
    deletedProjectIds,
    deletedMilestoneIds,
  })
  await cleanupViewFiltersForDeletedEntities(ctx, {
    deletedTeamIds: new Set([team.id]),
    deletedProjectIds,
    deletedMilestoneIds,
  })
  await deleteStorageObjects(
    ctx,
    attachments.map((attachment) => attachment.storageId as string)
  )
  await deleteDocs(ctx, channelPostComments)
  await deleteDocs(ctx, channelPosts)
  await deleteDocs(ctx, chatMessages)
  await deleteDocs(ctx, calls)
  await deleteDocs(ctx, comments)
  await deleteDocs(ctx, attachments)
  await deleteDocs(ctx, documentPresence)
  await deleteDocs(ctx, notifications)
  await deleteDocs(ctx, projectUpdates)
  await deleteDocs(ctx, invites)
  await deleteDocs(ctx, views)
  await deleteDocs(ctx, documents)
  await deleteDocs(ctx, workItems)
  await deleteDocs(ctx, milestones)
  await deleteDocs(ctx, projects)
  await deleteDocs(ctx, conversations)
  await deleteDocs(ctx, teamMemberships)
  await ctx.db.delete(team._id)

  if (input.syncWorkspaceChannel !== false) {
    const workspaceChannel = await findPrimaryWorkspaceChannelConversation(
      ctx,
      team.workspaceId
    )
    const workspaceParticipantIds = await getWorkspaceUserIds(
      ctx,
      team.workspaceId
    )

    await syncConversationParticipants(
      ctx,
      workspaceChannel,
      workspaceParticipantIds
    )
  }

  if (input.cleanupGlobalState !== false) {
    for (const userId of membershipUserIds) {
      await syncWorkspaceMembershipRoleFromTeams(ctx, {
        workspaceId: team.workspaceId,
        userId,
        fallbackRole: "viewer",
      })
    }
  }

  const deletedLabelIds =
    input.cleanupGlobalState === false
      ? []
      : await cleanupUnusedLabels(ctx, team.workspaceId)
  const deletedUserIds =
    input.cleanupGlobalState === false
      ? []
      : await cleanupUnreferencedUsers(ctx, membershipUserIds)

  return {
    teamId: team.id,
    workspaceId: team.workspaceId,
    membershipUserIds,
    deletedLabelIds,
    deletedUserIds,
  }
}
