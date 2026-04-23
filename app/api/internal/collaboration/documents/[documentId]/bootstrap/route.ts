import { getSchema, type JSONContent } from "@tiptap/core"
import { DOMParser as ProseMirrorDOMParser } from "@tiptap/pm/model"
import { JSDOM } from "jsdom"

import { createRichTextBaseExtensions } from "@/lib/rich-text/extensions"
import { ApplicationError } from "@/lib/server/application-errors"
import { getCollaborationDocumentServer } from "@/lib/server/convex"
import { requireInternalBearerAuthorization } from "@/lib/server/internal-route-auth"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { jsonApplicationError, jsonError, jsonOk } from "@/lib/server/route-response"

export const runtime = "nodejs"

const EMPTY_DOCUMENT_HTML = "<p></p>"
const richTextExtensions = createRichTextBaseExtensions({
  includeCharacterCount: false,
})
const richTextSchema = getSchema(richTextExtensions)

function createCanonicalContentJson(contentHtml: string): JSONContent {
  const normalizedHtml = contentHtml.trim() || EMPTY_DOCUMENT_HTML
  const dom = new JSDOM(`<body>${normalizedHtml}</body>`)
  const parsedDocument = ProseMirrorDOMParser.fromSchema(richTextSchema).parse(
    dom.window.document.body
  )

  return parsedDocument.toJSON()
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const authError = requireInternalBearerAuthorization(request)

  if (authError) {
    return authError
  }

  const { documentId } = await params
  const url = new URL(request.url)
  const currentUserId = url.searchParams.get("currentUserId")?.trim()

  if (!currentUserId) {
    return jsonError("currentUserId is required", 400, {
      code: "ROUTE_INVALID_QUERY",
    })
  }

  try {
    const collaborationDocument = await getCollaborationDocumentServer({
      currentUserId,
      documentId,
    })

    if (collaborationDocument.kind === "private-document") {
      throw new ApplicationError(
        "Private documents do not support collaboration sessions",
        503,
        {
          code: "COLLABORATION_UNAVAILABLE",
        }
      )
    }

    return jsonOk({
      documentId: collaborationDocument.documentId,
      kind: collaborationDocument.kind,
      itemId: collaborationDocument.itemId,
      title: collaborationDocument.title,
      contentHtml: collaborationDocument.content,
      contentJson: createCanonicalContentJson(collaborationDocument.content),
      updatedAt: collaborationDocument.updatedAt,
      updatedBy: collaborationDocument.updatedBy,
      workspaceId: collaborationDocument.workspaceId,
      teamId: collaborationDocument.teamId,
      editable: collaborationDocument.canEdit,
      deleted: false,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to bootstrap collaboration document", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to bootstrap collaboration document"),
      500,
      {
        code: "COLLABORATION_BOOTSTRAP_FAILED",
      }
    )
  }
}
