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

  let canEdit = true

  try {
    await requireEditableDocumentAccess(ctx, document, args.currentUserId)
  } catch {
    canEdit = false
  }

  const workItem =
    document.kind === "item-description"
      ? await getWorkItemByDescriptionDocId(ctx, document.id)
      : null
  const teamMemberships =
    workItem?.teamId != null
      ? await listTeamMembershipsByTeam(ctx, workItem.teamId)
      : []
  const projectIds = workItem
    ? [
        ...new Set(
          [workItem.primaryProjectId, ...workItem.linkedProjectIds].filter(
            (value): value is string => Boolean(value)
          )
        ),
      ]
    : []
  const projectDocs = (
    await Promise.all(projectIds.map((projectId) => getProjectDoc(ctx, projectId)))
  ).filter((project) => project != null)
  const workItemTeam =
    workItem?.teamId != null ? await getTeamDoc(ctx, workItem.teamId) : null

  return {
    documentId: document.id,
    kind: document.kind,
    title: document.title,
    content: document.content,
    workspaceId: document.workspaceId ?? null,
    teamId: document.teamId ?? null,
    updatedAt: document.updatedAt,
    updatedBy: document.updatedBy,
    canEdit,
    itemId: workItem?.id ?? null,
    itemUpdatedAt: workItem?.updatedAt ?? null,
    searchWorkspaceId:
      workItemTeam?.workspaceId ?? document.workspaceId ?? null,
    teamMemberIds: teamMemberships.map((membership) => membership.userId),
    projectScopes: projectDocs.map((project) => ({
      projectId: project.id,
      scopeType: project.scopeType,
      scopeId: project.scopeId,
    })),
  }
}
