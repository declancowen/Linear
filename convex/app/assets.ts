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

  assertImageUploadMetadata(metadata)

  return storageId as never
}

type ImageUploadMetadata = Awaited<
  ReturnType<MutationCtx["storage"]["getMetadata"]>
>

function assertImageUploadMetadata(metadata: ImageUploadMetadata) {
  if (!metadata) {
    throw new Error("Uploaded image not found")
  }

  assertImageUploadContentType(metadata.contentType)
  assertImageUploadSize(metadata.size ?? 0)
}

function assertImageUploadContentType(contentType: string | null | undefined) {
  if (!contentType?.startsWith("image/")) {
    throw new Error("Uploads must be image files")
  }
}

function assertImageUploadSize(size: number) {
  if (size <= 0) {
    throw new Error("Uploaded image is empty")
  }

  if (size > IMAGE_UPLOAD_MAX_SIZE) {
    throw new Error("Images must be 10 MB or smaller")
  }
}
