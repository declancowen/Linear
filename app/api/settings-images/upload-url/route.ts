import { NextRequest } from "next/server"

import { ApplicationError } from "@/lib/server/application-errors"
import { settingsImageUploadSchema } from "@/lib/domain/types"
import { generateSettingsImageUploadUrlServer } from "@/lib/server/convex"
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
    settingsImageUploadSchema,
    "Invalid image upload request"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    if (
      parsed.kind === "workspace-logo" &&
      !appContext.authContext?.currentWorkspace
    ) {
      return jsonError("Workspace not found", 404)
    }

    if (
      parsed.kind === "workspace-logo" &&
      !appContext.authContext?.isWorkspaceOwner
    ) {
      return jsonError("Only the workspace owner can update workspace settings", 403)
    }

    const result = await generateSettingsImageUploadUrlServer({
      currentUserId: appContext.ensuredUser.userId,
      kind: parsed.kind,
      workspaceId: appContext.authContext?.currentWorkspace?.id,
    })

    return jsonOk(result)
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to prepare image upload", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to prepare image upload"),
      500,
      {
        code: "SETTINGS_IMAGE_UPLOAD_PREPARE_FAILED",
      }
    )
  }
}
