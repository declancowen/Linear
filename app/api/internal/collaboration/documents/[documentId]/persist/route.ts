import { getSchema, type JSONContent } from "@tiptap/core"
import { DOMSerializer, Node as ProseMirrorNode } from "@tiptap/pm/model"
import { JSDOM } from "jsdom"
import { z } from "zod"

import { extractDocumentTitleFromContent } from "@/lib/content/document-title"
import { createRichTextBaseExtensions } from "@/lib/rich-text/extensions"
import { ApplicationError } from "@/lib/server/application-errors"
import { buildCollaborationDocumentScopeKeys } from "@/lib/scoped-sync/document-scope-keys"
import {
  bumpScopedReadModelVersionsServer,
  getCollaborationDocumentServer,
  persistCollaborationDocumentServer,
  persistCollaborationItemDescriptionServer,
  persistCollaborationWorkItemServer,
} from "@/lib/server/convex"
import { requireInternalBearerAuthorization } from "@/lib/server/internal-route-auth"
import { parseJsonBody } from "@/lib/server/route-body"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import {
  isRouteResponse,
  jsonApplicationError,
  jsonError,
  jsonOk,
} from "@/lib/server/route-response"

export const runtime = "nodejs"

const EMPTY_DOCUMENT_HTML = "<p></p>"
const richTextExtensions = createRichTextBaseExtensions({
  includeCharacterCount: false,
})
const richTextSchema = getSchema(richTextExtensions)
const EMPTY_DOCUMENT_JSON: JSONContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
    },
  ],
}
const collaborationPersistSchema = z
  .object({
    currentUserId: z.string().trim().min(1),
    contentHtml: z.string().trim().min(1).optional(),
    contentJson: z.unknown().optional(),
    title: z.string().trim().min(2).max(80).optional(),
    workItemExpectedUpdatedAt: z.string().datetime().optional(),
    workItemTitle: z.string().trim().min(2).max(96).optional(),
    flushReason: z
      .enum(["periodic", "leave", "mention-send", "manual"])
      .optional(),
    sourceVersion: z.number().int().nonnegative().optional(),
  })
  .superRefine((value, context) => {
    if (!value.contentHtml && typeof value.contentJson === "undefined") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "contentHtml or contentJson is required",
        path: ["contentHtml"],
      })
    }
  })

function serializeCanonicalContentJson(contentJson: JSONContent) {
  const dom = new JSDOM("<body></body>")
  const documentNode = ProseMirrorNode.fromJSON(richTextSchema, contentJson)
  const serializer = DOMSerializer.fromSchema(richTextSchema)
  const fragment = serializer.serializeFragment(documentNode.content, {
    document: dom.window.document,
  })

  dom.window.document.body.appendChild(fragment)

  return dom.window.document.body.innerHTML.trim() || EMPTY_DOCUMENT_HTML
}

function normalizeDocumentJson(value: unknown): JSONContent {
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string"
  ) {
    return value as JSONContent
  }

  return EMPTY_DOCUMENT_JSON
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const authError = requireInternalBearerAuthorization(request)

  if (authError) {
    return authError
  }

  const { documentId } = await params
  const parsed = await parseJsonBody(
    request,
    collaborationPersistSchema,
    "Invalid collaboration persist payload"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const contentHtml =
      parsed.contentHtml ??
      serializeCanonicalContentJson(normalizeDocumentJson(parsed.contentJson))
    const collaborationDocument = await getCollaborationDocumentServer({
      currentUserId: parsed.currentUserId,
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

    const title =
      collaborationDocument.kind === "item-description"
        ? undefined
        : parsed.title ??
          extractDocumentTitleFromContent(contentHtml) ??
          collaborationDocument.title

    if (!collaborationDocument.canEdit) {
      return jsonError("You do not have permission to edit this document", 403, {
        code: "DOCUMENT_EDIT_FORBIDDEN",
      })
    }

    if (collaborationDocument.kind === "item-description") {
      if (!collaborationDocument.itemId) {
        return jsonError("Work item not found", 404, {
          code: "WORK_ITEM_NOT_FOUND",
        })
      }

      if (parsed.workItemTitle) {
        await persistCollaborationWorkItemServer({
          currentUserId: parsed.currentUserId,
          itemId: collaborationDocument.itemId,
          patch: {
            title: parsed.workItemTitle,
            description: contentHtml,
            expectedUpdatedAt:
              parsed.workItemExpectedUpdatedAt ??
              collaborationDocument.itemUpdatedAt ??
              undefined,
          },
        })
      } else {
        await persistCollaborationItemDescriptionServer({
          currentUserId: parsed.currentUserId,
          itemId: collaborationDocument.itemId,
          content: contentHtml,
          expectedUpdatedAt: collaborationDocument.updatedAt,
        })
      }
    } else {
      await persistCollaborationDocumentServer({
        currentUserId: parsed.currentUserId,
        documentId,
        title,
        content: contentHtml,
        expectedUpdatedAt: collaborationDocument.updatedAt,
      })
    }

    const scopeKeys = buildCollaborationDocumentScopeKeys({
      documentId,
      kind: collaborationDocument.kind,
      workspaceId: collaborationDocument.workspaceId,
      teamId: collaborationDocument.teamId,
      itemId: collaborationDocument.itemId,
      searchWorkspaceId: collaborationDocument.searchWorkspaceId,
      teamMemberIds: collaborationDocument.teamMemberIds,
      projectScopes: collaborationDocument.projectScopes,
    }, {
      includeCollectionScopes: parsed.flushReason !== "periodic",
    })

    await bumpScopedReadModelVersionsServer({
      scopeKeys,
    })

    return jsonOk({
      ok: true,
      scopeKeys,
      flushReason: parsed.flushReason ?? null,
      sourceVersion: parsed.sourceVersion ?? null,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to persist collaboration document", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to persist collaboration document"),
      500,
      {
        code: "COLLABORATION_PERSIST_FAILED",
      }
    )
  }
}
