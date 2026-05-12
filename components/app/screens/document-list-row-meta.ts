import { format } from "date-fns"

import { getUser } from "@/lib/domain/selectors"
import type { AppData, Document as AppDocument } from "@/lib/domain/types"

import { getDocumentPreview } from "./shared"

export type DocumentListRowMeta = {
  authorAvatarImageUrl?: string | null
  authorAvatarUrl?: string | null
  authorName: string
  preview: string
  updated: string
}

export function getDocumentListRowMeta(
  data: AppData,
  document: AppDocument
): DocumentListRowMeta {
  const author = getUser(data, document.updatedBy ?? document.createdBy)

  return {
    authorAvatarImageUrl: author?.avatarImageUrl,
    authorAvatarUrl: author?.avatarUrl,
    authorName: author?.name ?? "Unknown",
    preview: getDocumentPreview(document),
    updated: format(new Date(document.updatedAt), "MMM d"),
  }
}
