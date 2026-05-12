import type { QueryCtx } from "../_generated/server"

import {
  requireEditableDocumentAccess,
  requireReadableDocumentAccess,
} from "./access"
import { assertServerToken } from "./core"
import {
  getDocumentDoc,
  getProjectDoc,
  getTeamDoc,
  getWorkItemByDescriptionDocId,
  listTeamMembershipsByTeam,
} from "./data"

type ServerAccessArgs = {
  serverToken: string
}

type GetCollaborationDocumentArgs = ServerAccessArgs & {
  currentUserId: string
  documentId: string
}

type CollaborationDocumentDoc = NonNullable<
  Awaited<ReturnType<typeof getDocumentDoc>>
>

type CollaborationWorkItemDoc = NonNullable<
  Awaited<ReturnType<typeof getWorkItemByDescriptionDocId>>
>

type CollaborationTeamDoc = NonNullable<Awaited<ReturnType<typeof getTeamDoc>>>

async function canEditCollaborationDocument(
  ctx: QueryCtx,
  document: CollaborationDocumentDoc,
  currentUserId: string
) {
  try {
    await requireEditableDocumentAccess(ctx, document, currentUserId)
    return true
  } catch {
    return false
  }
}

function getWorkItemProjectIds(workItem: CollaborationWorkItemDoc | null) {
  return workItem
    ? [
        ...new Set(
          [workItem.primaryProjectId, ...workItem.linkedProjectIds].filter(
            (value): value is string => Boolean(value)
          )
        ),
      ]
    : []
}

async function listProjectScopes(
  ctx: QueryCtx,
  workItem: CollaborationWorkItemDoc | null
) {
  const projectIds = getWorkItemProjectIds(workItem)
  const projectDocs = (
    await Promise.all(projectIds.map((projectId) => getProjectDoc(ctx, projectId)))
  ).filter((project) => project != null)

  return projectDocs.map((project) => ({
    projectId: project.id,
    scopeType: project.scopeType,
    scopeId: project.scopeId,
  }))
}

export async function getCollaborationWorkItemContext(
  ctx: QueryCtx,
  document: CollaborationDocumentDoc
) {
  const workItem =
    document.kind === "item-description"
      ? await getWorkItemByDescriptionDocId(ctx, document.id)
      : null
  const teamMemberships =
    workItem?.teamId != null
      ? await listTeamMembershipsByTeam(ctx, workItem.teamId)
      : []
  const workItemTeam =
    workItem?.teamId != null ? await getTeamDoc(ctx, workItem.teamId) : null

  return {
    workItem,
    teamMemberships,
    workItemTeam,
    projectScopes: await listProjectScopes(ctx, workItem),
  }
}

function getCollaborationSearchWorkspaceId(input: {
  document: CollaborationDocumentDoc
  workItemTeam: CollaborationTeamDoc | null
}) {
  return input.workItemTeam?.workspaceId ?? input.document.workspaceId ?? null
}

function getCollaborationDocumentWorkspaceId(document: CollaborationDocumentDoc) {
  return document.workspaceId ?? null
}

function getCollaborationDocumentTeamId(document: CollaborationDocumentDoc) {
  return document.teamId ?? null
}

export function getCollaborationWorkItemFields(
  workItem: CollaborationWorkItemDoc | null
) {
  return {
    itemId: workItem?.id ?? null,
    itemUpdatedAt: workItem?.updatedAt ?? null,
  }
}

function toCollaborationDocumentPayload(input: {
  canEdit: boolean
  document: CollaborationDocumentDoc
  projectScopes: Awaited<ReturnType<typeof listProjectScopes>>
  teamMemberships: Awaited<ReturnType<typeof listTeamMembershipsByTeam>>
  workItem: CollaborationWorkItemDoc | null
  workItemTeam: CollaborationTeamDoc | null
}) {
  const { canEdit, document, projectScopes, teamMemberships, workItem } = input

  return {
    documentId: document.id,
    kind: document.kind,
    title: document.title,
    content: document.content,
    workspaceId: getCollaborationDocumentWorkspaceId(document),
    teamId: getCollaborationDocumentTeamId(document),
    updatedAt: document.updatedAt,
    updatedBy: document.updatedBy,
    canEdit,
    ...getCollaborationWorkItemFields(workItem),
    searchWorkspaceId: getCollaborationSearchWorkspaceId(input),
    teamMemberIds: teamMemberships.map((membership) => membership.userId),
    projectScopes,
  }
}

export async function getCollaborationDocumentHandler(
  ctx: QueryCtx,
  args: GetCollaborationDocumentArgs
) {
  assertServerToken(args.serverToken)

  const document = await getDocumentDoc(ctx, args.documentId)

  if (!document) {
    throw new Error("Document not found")
  }

  await requireReadableDocumentAccess(ctx, document, args.currentUserId)

  const canEdit = await canEditCollaborationDocument(
    ctx,
    document,
    args.currentUserId
  )
  const { workItem, teamMemberships, workItemTeam, projectScopes } =
    await getCollaborationWorkItemContext(ctx, document)

  return toCollaborationDocumentPayload({
    canEdit,
    document,
    projectScopes,
    teamMemberships,
    workItem,
    workItemTeam,
  })
}
