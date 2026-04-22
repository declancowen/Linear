import { NextRequest } from "next/server"

import { ApplicationError } from "@/lib/server/application-errors"
import { documentSchema } from "@/lib/domain/types"
import { createDocumentServer } from "@/lib/server/convex"
import {
  bumpDocumentIndexReadModelScopesServer,
  bumpSearchSeedReadModelScopesServer,
} from "@/lib/server/scoped-read-models"
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
    documentSchema,
    "Invalid document payload"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const result = await createDocumentServer({
      currentUserId: appContext.ensuredUser.userId,
      ...parsed,
    })
    const documentScopeType =
      parsed.kind === "team-document" ? "team" : "workspace"
    const documentScopeId =
      parsed.kind === "team-document" ? parsed.teamId : parsed.workspaceId
    const searchWorkspaceId =
      result?.workspaceId ??
      (parsed.kind === "team-document"
        ? appContext.authContext?.currentWorkspace?.id ?? null
        : parsed.workspaceId)
    await bumpDocumentIndexReadModelScopesServer(
      documentScopeType,
      documentScopeId
    )
    if (searchWorkspaceId) {
      await bumpSearchSeedReadModelScopesServer(searchWorkspaceId)
    }

    return jsonOk({
      ok: true,
      documentId: result?.documentId ?? null,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to create document", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to create document"),
      500,
      {
        code: "DOCUMENT_CREATE_FAILED",
      }
    )
  }
}
