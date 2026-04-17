import type { MutationCtx } from "../_generated/server"

import {
  cleanupRemainingLinksAfterDelete,
  cleanupUserAccessRemoval,
  deleteDocs,
  deleteStorageObjects,
} from "./cleanup"
import {
  defaultUserPreferences,
  defaultUserStatus,
  defaultUserStatusMessage,
  getNow,
} from "./core"
import {
  getUserAppState,
  getWorkspaceDoc,
  listCommentsByTarget,
  listDocumentPresenceByUser,
  listDocumentsByCreator,
  listNotificationsByEntity,
  listNotificationsByUser,
} from "./data"

const DELETED_USER_NAME = "Deleted User"
const DELETED_USER_AVATAR = "DU"

export type ProviderMembershipCleanup = {
  workspaceId: string
  organizationId: string
  workosUserId: string
}

export function buildDeletedUserEmail(userId: string) {
  return `deleted+${userId.toLowerCase()}@linear.invalid`
}

export function buildDeletedUserHandle(userId: string) {
  return `deleted-${userId
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(-12)}`
}

function resolveProviderMembershipCleanup(input: {
  workspaceId: string
  workosOrganizationId?: string | null
  workosUserId?: string | null
  hasWorkspaceAccess: boolean
}) {
  if (
    input.hasWorkspaceAccess ||
    !input.workosOrganizationId ||
    !input.workosUserId
  ) {
    return null
  }

  return {
    workspaceId: input.workspaceId,
    organizationId: input.workosOrganizationId,
    workosUserId: input.workosUserId,
  } satisfies ProviderMembershipCleanup
}

export async function applyWorkspaceAccessRemovalPolicy(
  ctx: MutationCtx,
  input: {
    currentUserId: string
    removedUserId: string
    removedUserWorkosUserId?: string | null
    workspaceId: string
    removedTeamIds: string[]
  }
) {
  const workspace = await getWorkspaceDoc(ctx, input.workspaceId)

  if (!workspace) {
    throw new Error("Workspace not found")
  }

  const accessRemoval = await cleanupUserAccessRemoval(ctx, {
    currentUserId: input.currentUserId,
    removedUserId: input.removedUserId,
    workspaceId: input.workspaceId,
    removedTeamIds: input.removedTeamIds,
  })

  return {
    ...accessRemoval,
    providerMembershipCleanup: resolveProviderMembershipCleanup({
      workspaceId: workspace.id,
      workosOrganizationId: workspace.workosOrganizationId,
      workosUserId: input.removedUserWorkosUserId,
      hasWorkspaceAccess: accessRemoval.hasWorkspaceAccess,
    }),
  }
}

export async function deleteDocumentCascade(
  ctx: MutationCtx,
  input: {
    currentUserId: string
    document: {
      _id: Parameters<MutationCtx["db"]["delete"]>[0]
      id: string
    }
  }
) {
  const deletedDocumentIds = new Set([input.document.id])
  const comments = await listCommentsByTarget(
    ctx,
    "document",
    input.document.id
  )
  const attachments = await ctx.db
    .query("attachments")
    .withIndex("by_target", (q) =>
      q.eq("targetType", "document").eq("targetId", input.document.id)
    )
    .collect()
  const notifications = await listNotificationsByEntity(
    ctx,
    "document",
    input.document.id
  )

  await cleanupRemainingLinksAfterDelete(ctx, {
    currentUserId: input.currentUserId,
    deletedDocumentIds,
  })
  await deleteStorageObjects(
    ctx,
    attachments.map((attachment) => attachment.storageId as string)
  )
  await deleteDocs(ctx, comments)
  await deleteDocs(ctx, attachments)
  await deleteDocs(ctx, notifications)
  await ctx.db.delete(input.document._id)
}

async function deletePrivateDocumentsForUser(
  ctx: MutationCtx,
  input: {
    currentUserId: string
    userId: string
  }
) {
  const privateDocuments = (
    await listDocumentsByCreator(ctx, input.userId)
  ).filter((document) => document.kind === "private-document")

  for (const document of privateDocuments) {
    await deleteDocumentCascade(ctx, {
      currentUserId: input.currentUserId,
      document,
    })
  }

  return privateDocuments.map((document) => document.id)
}

async function deleteUserPersonalState(ctx: MutationCtx, userId: string) {
  await deleteDocs(ctx, await listNotificationsByUser(ctx, userId))
  await deleteDocs(ctx, await listDocumentPresenceByUser(ctx, userId))

  const userAppState = await getUserAppState(ctx, userId)

  if (userAppState) {
    await ctx.db.delete(userAppState._id)
  }
}

async function tombstoneDeletedUser(
  ctx: MutationCtx,
  user: {
    _id: Parameters<MutationCtx["db"]["patch"]>[0]
    id: string
    avatarImageStorageId?: string | null
  }
) {
  if (user.avatarImageStorageId) {
    await ctx.storage.delete(user.avatarImageStorageId as never)
  }

  const deletedAt = getNow()

  await ctx.db.patch(user._id, {
    name: DELETED_USER_NAME,
    title: "",
    avatarUrl: DELETED_USER_AVATAR,
    avatarImageStorageId: null,
    email: buildDeletedUserEmail(user.id),
    emailNormalized: buildDeletedUserEmail(user.id),
    handle: buildDeletedUserHandle(user.id),
    accountDeletionPendingAt: null,
    accountDeletedAt: deletedAt,
    hasExplicitStatus: false,
    status: defaultUserStatus,
    statusMessage: defaultUserStatusMessage,
    preferences: defaultUserPreferences,
  })

  return deletedAt
}

export async function finalizeCurrentAccountDeletionPolicy(
  ctx: MutationCtx,
  input: {
    currentUserId: string
    user: {
      _id: Parameters<MutationCtx["db"]["patch"]>[0]
      id: string
      workosUserId?: string | null
      avatarImageStorageId?: string | null
    }
    removedTeamIdsByWorkspace: Record<string, string[]>
  }
) {
  const providerMemberships: ProviderMembershipCleanup[] = []

  for (const [workspaceId, removedTeamIds] of Object.entries(
    input.removedTeamIdsByWorkspace
  )) {
    const accessRemoval = await applyWorkspaceAccessRemovalPolicy(ctx, {
      currentUserId: input.currentUserId,
      removedUserId: input.user.id,
      removedUserWorkosUserId: input.user.workosUserId ?? null,
      workspaceId,
      removedTeamIds,
    })

    if (accessRemoval.providerMembershipCleanup) {
      providerMemberships.push(accessRemoval.providerMembershipCleanup)
    }
  }

  const deletedPrivateDocumentIds = await deletePrivateDocumentsForUser(ctx, {
    currentUserId: input.currentUserId,
    userId: input.user.id,
  })

  await deleteUserPersonalState(ctx, input.user.id)
  await tombstoneDeletedUser(ctx, input.user)

  return {
    deletedPrivateDocumentIds,
    providerMemberships,
    removedWorkspaceIds: Object.keys(input.removedTeamIdsByWorkspace),
  }
}
