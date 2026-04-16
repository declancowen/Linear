import { NextRequest } from "next/server"
import { z } from "zod"

import { ApplicationError } from "@/lib/server/application-errors"
import { deleteDocumentServer, updateDocumentServer } from "@/lib/server/convex"
import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import { parseJsonBody } from "@/lib/server/route-body"
import {
  isRouteResponse,
  jsonApplicationError,
  jsonError,
  jsonOk,
} from "@/lib/server/route-response"

const documentUpdateSchema = z
  .object({
    title: z.string().trim().min(2).max(80).optional(),
    content: z.string().trim().min(1).optional(),
  })
  .refine((value) => value.title !== undefined || value.content !== undefined, {
    message: "At least one document field is required",
  })

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const { documentId } = await params
  const parsed = await parseJsonBody(
    request,
    documentUpdateSchema,
    "Invalid document update payload"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    await updateDocumentServer({
      currentUserId: appContext.ensuredUser.userId,
      documentId,
      title: parsed.title,
      content: parsed.content,
    })

    return jsonOk({
      ok: true,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to update document", error)
    return jsonError(getConvexErrorMessage(error, "Failed to update document"), 500, {
      code: "DOCUMENT_UPDATE_FAILED",
    })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const { documentId } = await params

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    await deleteDocumentServer({
      currentUserId: appContext.ensuredUser.userId,
      documentId,
    })

    return jsonOk({
      ok: true,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to delete document", error)
    return jsonError(getConvexErrorMessage(error, "Failed to delete document"), 500, {
      code: "DOCUMENT_DELETE_FAILED",
    })
  }
}
