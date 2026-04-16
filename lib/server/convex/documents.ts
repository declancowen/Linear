import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { DocumentPresenceViewer } from "@/lib/domain/types"

import {
  getConvexServerClient,
  runConvexRequestWithRetry,
  withServerToken,
} from "./core"

export async function updateDocumentContentServer(input: {
  currentUserId: string
  documentId: string
  content: string
}) {
  return getConvexServerClient().mutation(
    api.app.updateDocumentContent,
    withServerToken(input)
  )
}

export async function updateDocumentServer(input: {
  currentUserId: string
  documentId: string
  title?: string
  content?: string
}) {
  if (input.title !== undefined) {
    await renameDocumentServer({
      currentUserId: input.currentUserId,
      documentId: input.documentId,
      title: input.title,
    })
  }

  if (input.content !== undefined) {
    await updateDocumentContentServer({
      currentUserId: input.currentUserId,
      documentId: input.documentId,
      content: input.content,
    })
  }

  return null
}

export async function renameDocumentServer(input: {
  currentUserId: string
  documentId: string
  title: string
}) {
  return getConvexServerClient().mutation(
    api.app.renameDocument,
    withServerToken(input)
  )
}

export async function deleteDocumentServer(input: {
  currentUserId: string
  documentId: string
}) {
  return runConvexRequestWithRetry("deleteDocumentServer", () =>
    getConvexServerClient().mutation(
      api.app.deleteDocument,
      withServerToken(input)
    )
  )
}

export async function heartbeatDocumentPresenceServer(input: {
  currentUserId: string
  documentId: string
  workosUserId: string
  email: string
  name: string
  avatarUrl: string
  sessionId: string
}): Promise<DocumentPresenceViewer[]> {
  return getConvexServerClient().mutation(
    api.app.heartbeatDocumentPresence,
    withServerToken(input)
  )
}

export async function clearDocumentPresenceServer(input: {
  currentUserId: string
  documentId: string
  workosUserId: string
  sessionId: string
}) {
  return getConvexServerClient().mutation(
    api.app.clearDocumentPresence,
    withServerToken(input)
  )
}

export async function updateItemDescriptionServer(input: {
  currentUserId: string
  itemId: string
  content: string
}) {
  return getConvexServerClient().mutation(
    api.app.updateItemDescription,
    withServerToken(input)
  )
}

export async function addCommentServer(input: {
  currentUserId: string
  targetType: "workItem" | "document"
  targetId: string
  parentCommentId?: string | null
  content: string
}) {
  return getConvexServerClient().mutation(
    api.app.addComment,
    withServerToken(input)
  )
}

export async function toggleCommentReactionServer(input: {
  currentUserId: string
  commentId: string
  emoji: string
}) {
  return getConvexServerClient().mutation(
    api.app.toggleCommentReaction,
    withServerToken(input)
  )
}

export async function generateAttachmentUploadUrlServer(input: {
  currentUserId: string
  targetType: "workItem" | "document"
  targetId: string
}) {
  return getConvexServerClient().mutation(
    api.app.generateAttachmentUploadUrl,
    withServerToken(input)
  )
}

export async function createAttachmentServer(input: {
  currentUserId: string
  targetType: "workItem" | "document"
  targetId: string
  storageId: string
  fileName: string
  contentType: string
  size: number
}) {
  return getConvexServerClient().mutation(
    api.app.createAttachment,
    withServerToken({
      ...input,
      storageId: input.storageId as Id<"_storage">,
    })
  )
}

export async function deleteAttachmentServer(input: {
  currentUserId: string
  attachmentId: string
}) {
  return getConvexServerClient().mutation(
    api.app.deleteAttachment,
    withServerToken(input)
  )
}

export async function createDocumentServer(input: {
  currentUserId: string
  kind: "team-document" | "workspace-document" | "private-document"
  teamId?: string
  workspaceId?: string
  title: string
}) {
  return getConvexServerClient().mutation(
    api.app.createDocument,
    withServerToken(input)
  )
}
