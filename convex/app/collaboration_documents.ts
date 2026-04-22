import type { QueryCtx } from "../_generated/server"

import {
  requireEditableDocumentAccess,
  requireReadableDocumentAccess,
} from "./access"
import { assertServerToken } from "./core"
import {
  getDocumentDoc,
  getWorkItemByDescriptionDocId,
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

  await requireReadableDocumentAccess(ctx, document, args.currentUserId)

  if (!document) {
    throw new Error("Document not found")
  }

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
  }
}
