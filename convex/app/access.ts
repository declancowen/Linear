import {
  getDocumentDoc,
  getEffectiveRole,
  getTeamDoc,
  getWorkItemByDescriptionDocId,
  getWorkspaceMembershipDoc,
  getWorkspaceEditRole,
  getWorkspaceRoleMapForUser,
  isWorkspaceOwner,
  type AppCtx,
} from "./data"

export const WORKSPACE_ADMIN_ACCESS_ERROR =
  "Only workspace admins can perform this action"

function isReadOnlyRole(role: Awaited<ReturnType<typeof getEffectiveRole>>) {
  return role === "viewer" || role === "guest" || !role
}

export async function requireEditableTeamAccess(
  ctx: AppCtx,
  teamId: string,
  userId: string
) {
  const role = await getEffectiveRole(ctx, teamId, userId)

  if (isReadOnlyRole(role)) {
    throw new Error("Your current role is read-only")
  }

  return role
}

export async function requireEditableTeamDoc(
  ctx: AppCtx,
  teamId: string,
  userId: string
) {
  await requireEditableTeamAccess(ctx, teamId, userId)
  const team = await getTeamDoc(ctx, teamId)

  if (!team) {
    throw new Error("Team not found")
  }

  return team
}

export async function requireReadableTeamAccess(
  ctx: AppCtx,
  teamId: string,
  userId: string
) {
  const role = await getEffectiveRole(ctx, teamId, userId)

  if (!role) {
    throw new Error("You do not have access to this team")
  }

  return role
}

export type WorkItemAccessTarget = {
  assigneeId?: string | null
  creatorId?: string | null
  teamId: string
  workspaceId?: string | null
  visibility?: "team" | "private" | null
}

function getPrivateWorkItemAccessUserIds(item: WorkItemAccessTarget) {
  return [item.creatorId].filter((userId): userId is string =>
    Boolean(userId)
  )
}

export function getWorkItemAudienceUserIds(
  item: WorkItemAccessTarget,
  teamMemberIds: Iterable<string>
) {
  const teamMemberIdSet = new Set(teamMemberIds)

  if ((item.visibility ?? "team") !== "private") {
    return [...teamMemberIdSet]
  }

  return getPrivateWorkItemAccessUserIds(item)
}

function canUserAccessPrivateWorkItem(
  item: WorkItemAccessTarget,
  userId: string
) {
  return item.creatorId === userId
}

function assertPrivateWorkItemAccess(
  item: WorkItemAccessTarget,
  userId: string
) {
  if (
    (item.visibility ?? "team") === "private" &&
    !canUserAccessPrivateWorkItem(item, userId)
  ) {
    throw new Error("Work item not found")
  }
}

async function requirePrivateWorkItemAccessIfNeeded(
  ctx: AppCtx,
  item: WorkItemAccessTarget,
  userId: string
) {
  if ((item.visibility ?? "team") !== "private") {
    return false
  }

  assertPrivateWorkItemAccess(item, userId)
  if (item.workspaceId) {
    await requireReadableWorkspaceAccess(ctx, item.workspaceId, userId)
  }

  return true
}

export async function requireReadableWorkItemAccess(
  ctx: AppCtx,
  item: WorkItemAccessTarget,
  userId: string
) {
  if (await requirePrivateWorkItemAccessIfNeeded(ctx, item, userId)) {
    return
  }

  await requireReadableTeamAccess(ctx, item.teamId, userId)
}

export async function requireEditableWorkItemAccess(
  ctx: AppCtx,
  item: WorkItemAccessTarget,
  userId: string
) {
  if (await requirePrivateWorkItemAccessIfNeeded(ctx, item, userId)) {
    return
  }

  await requireEditableTeamAccess(ctx, item.teamId, userId)
}

export async function requireTeamAdminAccess(
  ctx: AppCtx,
  teamId: string,
  userId: string,
  errorMessage = "Only team admins can perform this action"
) {
  const role = await getEffectiveRole(ctx, teamId, userId)

  if (role !== "admin") {
    throw new Error(errorMessage)
  }

  return role
}

export async function requireEditableWorkspaceAccess(
  ctx: AppCtx,
  workspaceId: string,
  userId: string
) {
  const role = await getWorkspaceEditRole(ctx, workspaceId, userId)

  if (role !== "admin" && role !== "member") {
    throw new Error("Your current role is read-only")
  }
}

export async function requireReadableWorkspaceAccess(
  ctx: AppCtx,
  workspaceId: string,
  userId: string
) {
  if (await isWorkspaceOwner(ctx, workspaceId, userId)) {
    return
  }

  const workspaceRoles =
    (await getWorkspaceRoleMapForUser(ctx, userId))[workspaceId] ?? []

  if (workspaceRoles.length === 0) {
    throw new Error("You do not have access to this workspace")
  }
}

export async function requireWorkspaceOwnerAccess(
  ctx: AppCtx,
  workspaceId: string,
  userId: string,
  errorMessage = "Only the workspace owner can perform this action"
) {
  if (await isWorkspaceOwner(ctx, workspaceId, userId)) {
    return
  }

  throw new Error(errorMessage)
}

async function requireDocumentAccess(
  ctx: AppCtx,
  document: Awaited<ReturnType<typeof getDocumentDoc>>,
  userId: string,
  options: {
    privateDocumentError: string
    requireTeamAccess: (
      ctx: AppCtx,
      teamId: string,
      userId: string
    ) => Promise<unknown>
    requireWorkspaceAccess: (
      ctx: AppCtx,
      workspaceId: string,
      userId: string
    ) => Promise<unknown>
    requireWorkItemAccess: (
      ctx: AppCtx,
      item: WorkItemAccessTarget,
      userId: string
    ) => Promise<unknown>
  }
) {
  if (!document) {
    throw new Error("Document not found")
  }

  if (document.kind === "item-description") {
    await requireItemDescriptionDocumentAccess(ctx, document, userId, options)
    return
  }

  if (isTeamScopedDocument(document)) {
    await requireTeamScopedDocumentAccess(ctx, document, userId, options)
    return
  }

  if (document.kind === "private-document") {
    await requirePrivateDocumentAccess(ctx, document, userId, options)
    return
  }

  const workspaceId = requireDocumentWorkspaceId(document)

  await options.requireWorkspaceAccess(ctx, workspaceId, userId)
}

type DocumentAccessOptions = Parameters<typeof requireDocumentAccess>[3]
type DocumentDoc = NonNullable<Awaited<ReturnType<typeof getDocumentDoc>>>

function isTeamScopedDocument(document: DocumentDoc) {
  return document.kind === "team-document"
}

function requireDocumentWorkspaceId(document: DocumentDoc) {
  if (!document.workspaceId) {
    throw new Error("Document is missing a workspace")
  }

  return document.workspaceId
}

function requireDocumentTeamId(document: DocumentDoc) {
  if (!document.teamId) {
    throw new Error("Document is missing a team")
  }

  return document.teamId
}

async function requireTeamScopedDocumentAccess(
  ctx: AppCtx,
  document: DocumentDoc,
  userId: string,
  options: DocumentAccessOptions
) {
  await options.requireTeamAccess(ctx, requireDocumentTeamId(document), userId)
}

async function requireItemDescriptionDocumentAccess(
  ctx: AppCtx,
  document: DocumentDoc,
  userId: string,
  options: DocumentAccessOptions
) {
  const item = await getWorkItemByDescriptionDocId(ctx, document.id)

  if (!item) {
    throw new Error("Work item not found")
  }

  await options.requireWorkItemAccess(ctx, item, userId)
}

async function requirePrivateDocumentAccess(
  ctx: AppCtx,
  document: DocumentDoc,
  userId: string,
  options: DocumentAccessOptions
) {
  const workspaceId = requireDocumentWorkspaceId(document)

  if (document.createdBy !== userId) {
    throw new Error(options.privateDocumentError)
  }

  await requireReadableWorkspaceAccess(ctx, workspaceId, userId)
}

export async function requireReadableDocumentAccess(
  ctx: AppCtx,
  document: Awaited<ReturnType<typeof getDocumentDoc>>,
  userId: string
) {
  await requireDocumentAccess(ctx, document, userId, {
    privateDocumentError: "You do not have access to this document",
    requireTeamAccess: requireReadableTeamAccess,
    requireWorkspaceAccess: requireReadableWorkspaceAccess,
    requireWorkItemAccess: requireReadableWorkItemAccess,
  })
}

export async function requireEditableDocumentAccess(
  ctx: AppCtx,
  document: Awaited<ReturnType<typeof getDocumentDoc>>,
  userId: string
) {
  await requireDocumentAccess(ctx, document, userId, {
    privateDocumentError: "You can only edit your own private documents",
    requireTeamAccess: requireEditableTeamAccess,
    requireWorkspaceAccess: requireEditableWorkspaceAccess,
    requireWorkItemAccess: requireEditableWorkItemAccess,
  })
}

export async function requireWorkspaceAdminAccess(
  ctx: AppCtx,
  workspaceId: string,
  userId: string
) {
  if (await isWorkspaceOwner(ctx, workspaceId, userId)) {
    return
  }

  const workspaceMembership = await getWorkspaceMembershipDoc(
    ctx,
    workspaceId,
    userId
  )

  if (workspaceMembership?.role !== "admin") {
    throw new Error(WORKSPACE_ADMIN_ACCESS_ERROR)
  }
}
