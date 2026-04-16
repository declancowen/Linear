import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { prepareRichTextForStorage } from "@/lib/content/rich-text-security"
import type { DocumentPresenceViewer } from "@/lib/domain/types"
import { coerceApplicationError } from "@/lib/server/application-errors"

import {
  getConvexServerClient,
  runConvexRequestWithRetry,
  withServerToken,
} from "./core"

const DOCUMENT_MUTATION_ERROR_MAPPINGS = [
  {
    match: "Document not found",
    status: 404,
    code: "DOCUMENT_NOT_FOUND",
  },
  {
    match: (message: string) =>
      message === "You do not have access to this document" ||
      message === "You do not have access to this workspace" ||
      message === "You do not have access to this team",
    status: 403,
    code: "DOCUMENT_ACCESS_DENIED",
  },
  {
    match: "You can only edit your own private documents",
    status: 403,
    code: "DOCUMENT_EDIT_FORBIDDEN",
  },
  {
    match: "Your current role is read-only",
    status: 403,
    code: "DOCUMENT_READ_ONLY",
  },
] as const

const DELETE_DOCUMENT_ERROR_MAPPINGS = [
  ...DOCUMENT_MUTATION_ERROR_MAPPINGS,
  {
    match: "Work item description documents can't be deleted directly",
    status: 400,
    code: "DOCUMENT_DELETE_INVALID_KIND",
  },
] as const

const ITEM_DESCRIPTION_ERROR_MAPPINGS = [
  {
    match: "Work item not found",
    status: 404,
    code: "WORK_ITEM_NOT_FOUND",
  },
  {
    match: (message: string) =>
      message === "You do not have access to this team" ||
      message === "You do not have access to this workspace",
    status: 403,
    code: "ITEM_DESCRIPTION_ACCESS_DENIED",
  },
  {
    match: "Your current role is read-only",
    status: 403,
    code: "ITEM_DESCRIPTION_READ_ONLY",
  },
] as const

const ADD_COMMENT_ERROR_MAPPINGS = [
  {
    match: "Parent comment not found",
    status: 404,
    code: "COMMENT_PARENT_NOT_FOUND",
  },
  {
    match: "Reply must stay on the same thread target",
    status: 400,
    code: "COMMENT_THREAD_TARGET_MISMATCH",
  },
  {
    match: "Work item not found",
    status: 404,
    code: "COMMENT_TARGET_NOT_FOUND",
  },
  {
    match: "Document not found",
    status: 404,
    code: "COMMENT_TARGET_NOT_FOUND",
  },
  {
    match: "Comments are only available on team documents",
    status: 400,
    code: "COMMENT_TARGET_INVALID",
  },
  {
    match: "Your current role is read-only",
    status: 403,
    code: "COMMENT_READ_ONLY",
  },
  {
    match: (message: string) =>
      message === "You do not have access to this team" ||
      message === "You do not have access to this workspace" ||
      message === "You do not have access to this document",
    status: 403,
    code: "COMMENT_ACCESS_DENIED",
  },
] as const

const TOGGLE_COMMENT_REACTION_ERROR_MAPPINGS = [
  {
    match: "Comment not found",
    status: 404,
    code: "COMMENT_NOT_FOUND",
  },
  {
    match: "Work item not found",
    status: 404,
    code: "COMMENT_TARGET_NOT_FOUND",
  },
  {
    match: "Document not found",
    status: 404,
    code: "COMMENT_TARGET_NOT_FOUND",
  },
  {
    match: (message: string) =>
      message === "You do not have access to this team" ||
      message === "You do not have access to this workspace" ||
      message === "You do not have access to this document",
    status: 403,
    code: "COMMENT_ACCESS_DENIED",
  },
] as const

const DOCUMENT_PRESENCE_ERROR_MAPPINGS = [
  {
    match: "Document not found",
    status: 404,
    code: "DOCUMENT_NOT_FOUND",
  },
  {
    match: (message: string) =>
      message === "You do not have access to this document" ||
      message === "You do not have access to this workspace" ||
      message === "You do not have access to this team",
    status: 403,
    code: "DOCUMENT_ACCESS_DENIED",
  },
  {
    match: "Document presence session is already in use",
    status: 409,
    code: "DOCUMENT_PRESENCE_SESSION_CONFLICT",
  },
] as const

const ATTACHMENT_ACCESS_ERROR_MAPPINGS = [
  {
    match: "Work item not found",
    status: 404,
    code: "ATTACHMENT_TARGET_NOT_FOUND",
  },
  {
    match: "Document not found",
    status: 404,
    code: "ATTACHMENT_TARGET_NOT_FOUND",
  },
  {
    match: "Attachments are only available on team documents",
    status: 400,
    code: "ATTACHMENT_TARGET_INVALID",
  },
  {
    match: "Your current role is read-only",
    status: 403,
    code: "ATTACHMENT_ACCESS_DENIED",
  },
  {
    match: (message: string) =>
      message === "You do not have access to this team" ||
      message === "You do not have access to this workspace" ||
      message === "You do not have access to this document",
    status: 403,
    code: "ATTACHMENT_ACCESS_DENIED",
  },
] as const

const CREATE_ATTACHMENT_ERROR_MAPPINGS = [
  ...ATTACHMENT_ACCESS_ERROR_MAPPINGS,
  {
    match: "Uploaded file not found",
    status: 400,
    code: "ATTACHMENT_UPLOAD_NOT_FOUND",
  },
  {
    match: "File is empty",
    status: 400,
    code: "ATTACHMENT_UPLOAD_EMPTY",
  },
] as const

const DELETE_ATTACHMENT_ERROR_MAPPINGS = [
  {
    match: "Attachment not found",
    status: 404,
    code: "ATTACHMENT_NOT_FOUND",
  },
  ...ATTACHMENT_ACCESS_ERROR_MAPPINGS,
] as const

const CREATE_DOCUMENT_ERROR_MAPPINGS = [
  {
    match: "Team is required",
    status: 400,
    code: "DOCUMENT_TEAM_REQUIRED",
  },
  {
    match: "Workspace is required",
    status: 400,
    code: "DOCUMENT_WORKSPACE_REQUIRED",
  },
  {
    match: "Team not found",
    status: 404,
    code: "TEAM_NOT_FOUND",
  },
  {
    match: "Docs are disabled for this team",
    status: 400,
    code: "TEAM_DOCS_DISABLED",
  },
  {
    match: "Your current role is read-only",
    status: 403,
    code: "DOCUMENT_ACCESS_DENIED",
  },
  {
    match: (message: string) =>
      message === "You do not have access to this team" ||
      message === "You do not have access to this workspace",
    status: 403,
    code: "DOCUMENT_ACCESS_DENIED",
  },
] as const

export async function updateDocumentContentServer(input: {
  currentUserId: string
  documentId: string
  content: string
}) {
  const preparedContent = prepareRichTextForStorage(input.content)

  try {
    return await getConvexServerClient().mutation(
      api.app.updateDocumentContent,
      withServerToken({
        ...input,
        content: preparedContent.sanitized,
      })
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...DOCUMENT_MUTATION_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function updateDocumentServer(input: {
  currentUserId: string
  documentId: string
  title?: string
  content?: string
}) {
  const preparedContent =
    input.content !== undefined
      ? prepareRichTextForStorage(input.content)
      : null

  try {
    return await getConvexServerClient().mutation(
      api.app.updateDocument,
      withServerToken({
        ...input,
        ...(preparedContent ? { content: preparedContent.sanitized } : {}),
      })
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...DOCUMENT_MUTATION_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function renameDocumentServer(input: {
  currentUserId: string
  documentId: string
  title: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.renameDocument,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...DOCUMENT_MUTATION_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function deleteDocumentServer(input: {
  currentUserId: string
  documentId: string
}) {
  try {
    return await runConvexRequestWithRetry("deleteDocumentServer", () =>
      getConvexServerClient().mutation(
        api.app.deleteDocument,
        withServerToken(input)
      )
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...DELETE_DOCUMENT_ERROR_MAPPINGS]) ?? error
    )
  }
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
  try {
    return await getConvexServerClient().mutation(
      api.app.heartbeatDocumentPresence,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...DOCUMENT_PRESENCE_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function clearDocumentPresenceServer(input: {
  currentUserId: string
  documentId: string
  workosUserId: string
  sessionId: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.clearDocumentPresence,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...DOCUMENT_PRESENCE_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function updateItemDescriptionServer(input: {
  currentUserId: string
  itemId: string
  content: string
}) {
  const preparedContent = prepareRichTextForStorage(input.content)

  try {
    return await getConvexServerClient().mutation(
      api.app.updateItemDescription,
      withServerToken({
        ...input,
        content: preparedContent.sanitized,
      })
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...ITEM_DESCRIPTION_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function addCommentServer(input: {
  currentUserId: string
  targetType: "workItem" | "document"
  targetId: string
  parentCommentId?: string | null
  content: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.addComment,
      withServerToken(input)
    )
  } catch (error) {
    throw coerceApplicationError(error, [...ADD_COMMENT_ERROR_MAPPINGS]) ?? error
  }
}

export async function toggleCommentReactionServer(input: {
  currentUserId: string
  commentId: string
  emoji: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.toggleCommentReaction,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...TOGGLE_COMMENT_REACTION_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function generateAttachmentUploadUrlServer(input: {
  currentUserId: string
  targetType: "workItem" | "document"
  targetId: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.generateAttachmentUploadUrl,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...ATTACHMENT_ACCESS_ERROR_MAPPINGS]) ??
      error
    )
  }
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
  try {
    return await getConvexServerClient().mutation(
      api.app.createAttachment,
      withServerToken({
        ...input,
        storageId: input.storageId as Id<"_storage">,
      })
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...CREATE_ATTACHMENT_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function deleteAttachmentServer(input: {
  currentUserId: string
  attachmentId: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.deleteAttachment,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...DELETE_ATTACHMENT_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function createDocumentServer(input: {
  currentUserId: string
  kind: "team-document" | "workspace-document" | "private-document"
  teamId?: string
  workspaceId?: string
  title: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.createDocument,
      withServerToken(input)
    )
  } catch (error) {
    throw coerceApplicationError(error, [...CREATE_DOCUMENT_ERROR_MAPPINGS]) ?? error
  }
}
