import {
  getDocumentDoc,
  getEffectiveRole,
  getWorkspaceRoleMapForUser,
  isWorkspaceOwner,
  type AppCtx,
} from "./data"

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

export async function requireEditableWorkspaceAccess(
  ctx: AppCtx,
  workspaceId: string,
  userId: string
) {
  if (await isWorkspaceOwner(ctx, workspaceId, userId)) {
    return
  }

  const workspaceRoles =
    (await getWorkspaceRoleMapForUser(ctx, userId))[workspaceId] ?? []
  const canEdit = workspaceRoles.some(
    (role) => role === "admin" || role === "member"
  )

  if (!canEdit) {
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

export async function requireReadableDocumentAccess(
  ctx: AppCtx,
  document: Awaited<ReturnType<typeof getDocumentDoc>>,
  userId: string
) {
  if (!document) {
    throw new Error("Document not found")
  }

  if (
    document.kind === "team-document" ||
    document.kind === "item-description"
  ) {
    if (!document.teamId) {
      throw new Error("Document is missing a team")
    }

    await requireReadableTeamAccess(ctx, document.teamId, userId)
    return
  }

  if (!document.workspaceId) {
    throw new Error("Document is missing a workspace")
  }

  if (document.kind === "private-document" && document.createdBy !== userId) {
    throw new Error("You do not have access to this document")
  }

  await requireReadableWorkspaceAccess(ctx, document.workspaceId, userId)
}

export async function requireEditableDocumentAccess(
  ctx: AppCtx,
  document: Awaited<ReturnType<typeof getDocumentDoc>>,
  userId: string
) {
  if (!document) {
    throw new Error("Document not found")
  }

  if (
    document.kind === "team-document" ||
    document.kind === "item-description"
  ) {
    if (!document.teamId) {
      throw new Error("Document is missing a team")
    }

    await requireEditableTeamAccess(ctx, document.teamId, userId)
    return
  }

  if (!document.workspaceId) {
    throw new Error("Document is missing a workspace")
  }

  if (document.kind === "private-document" && document.createdBy !== userId) {
    throw new Error("You can only edit your own private documents")
  }

  if (document.kind === "private-document") {
    await requireReadableWorkspaceAccess(ctx, document.workspaceId, userId)
    return
  }

  await requireEditableWorkspaceAccess(ctx, document.workspaceId, userId)
}

export async function requireWorkspaceAdminAccess(
  ctx: AppCtx,
  workspaceId: string,
  userId: string
) {
  if (await isWorkspaceOwner(ctx, workspaceId, userId)) {
    return
  }

  const workspaceRoles =
    (await getWorkspaceRoleMapForUser(ctx, userId))[workspaceId] ?? []

  if (!workspaceRoles.includes("admin")) {
    throw new Error("Only workspace admins can perform this action")
  }
}
