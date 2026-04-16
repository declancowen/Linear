import type { MutationCtx } from "../_generated/server"

import { IMAGE_UPLOAD_MAX_SIZE } from "./core"
import { getDocumentDoc, getWorkItemDoc } from "./data"

export async function resolveAttachmentTarget(
  ctx: MutationCtx,
  targetType: "workItem" | "document",
  targetId: string
) {
  if (targetType === "workItem") {
    const item = await getWorkItemDoc(ctx, targetId)

    if (!item) {
      throw new Error("Work item not found")
    }

    return {
      teamId: item.teamId,
      entityType: "workItem" as const,
      recordId: item._id,
    }
  }

  const document = await getDocumentDoc(ctx, targetId)

  if (!document) {
    throw new Error("Document not found")
  }

  if (!document.teamId) {
    throw new Error("Attachments are only available on team documents")
  }

  return {
    teamId: document.teamId,
    entityType: "document" as const,
    recordId: document._id,
  }
}

export async function assertImageUpload(
  ctx: MutationCtx,
  storageId: string | null | undefined
) {
  if (!storageId) {
    return null
  }

  const metadata = await ctx.storage.getMetadata(storageId as never)

  if (!metadata) {
    throw new Error("Uploaded image not found")
  }

  if (!metadata.contentType?.startsWith("image/")) {
    throw new Error("Uploads must be image files")
  }

  if ((metadata.size ?? 0) <= 0) {
    throw new Error("Uploaded image is empty")
  }

  if ((metadata.size ?? 0) > IMAGE_UPLOAD_MAX_SIZE) {
    throw new Error("Images must be 10 MB or smaller")
  }

  return storageId as never
}
