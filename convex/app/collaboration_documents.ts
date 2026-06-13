import type { QueryCtx } from "../_generated/server"

import {
  requireEditableDocumentAccess,
  requireReadableDocumentAccess,
} from "./access"
import { assertServerToken } from "./core"
import {
  getDocumentDoc,
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

function getCollaborationDocumentWorkspaceId(document: CollaborationDocumentDoc) {
  return document.workspaceId ?? null
}

function getCollaborationDocumentTeamId(document: CollaborationDocumentDoc) {
  return document.teamId ?? null
}

function toCollaborationDocumentPayload(input: {
  canEdit: boolean
  document: CollaborationDocumentDoc
}) {
  const { canEdit, document } = input

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
    itemId: null,
    itemUpdatedAt: null,
    searchWorkspaceId: document.workspaceId ?? null,
    teamMemberIds: [],
    projectScopes: [],
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

  if (document.kind === "item-description") {
    throw new Error("Work item descriptions do not support collaboration")
  }

  await requireReadableDocumentAccess(ctx, document, args.currentUserId)

  const canEdit = await canEditCollaborationDocument(
    ctx,
    document,
    args.currentUserId
  )
  return toCollaborationDocumentPayload({
    canEdit,
    document,
  })
}
