import { NextRequest } from "next/server"

import { ApplicationError } from "@/lib/server/application-errors"
import { attachmentUploadUrlSchema } from "@/lib/domain/types"
import { generateAttachmentUploadUrlServer } from "@/lib/server/convex"
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

export async function POST(request: NextRequest) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsed = await parseJsonBody(
    request,
    attachmentUploadUrlSchema,
    "Invalid attachment upload request"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const result = await generateAttachmentUploadUrlServer({
      currentUserId: appContext.ensuredUser.userId,
      ...parsed,
    })

    return jsonOk(result)
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to prepare attachment upload", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to prepare attachment upload"),
      500,
      {
        code: "ATTACHMENT_UPLOAD_PREPARE_FAILED",
      }
    )
  }
}
