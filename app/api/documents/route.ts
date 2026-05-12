import { NextRequest } from "next/server"
import type { z } from "zod"

import { ApplicationError } from "@/lib/server/application-errors"
import { documentSchema } from "@/lib/domain/types"
import { createDocumentServer } from "@/lib/server/convex"
import {
  bumpDocumentIndexReadModelScopesServer,
  bumpPrivateDocumentIndexReadModelScopesServer,
  bumpPrivateSearchSeedReadModelScopesServer,
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

type CreateDocumentPayload = z.infer<typeof documentSchema>
type DocumentRouteAppContext = {
  authContext?: {
    currentWorkspace?: {
      id: string
    } | null
  } | null
  ensuredUser: {
    userId: string
  }
}

function getCreatedDocumentScope(input: {
  appContext: DocumentRouteAppContext
  parsed: CreateDocumentPayload
  result: Awaited<ReturnType<typeof createDocumentServer>>
}) {
  const documentScopeType: "team" | "workspace" =
    input.parsed.kind === "team-document" ? "team" : "workspace"
  const documentScopeId =
    input.parsed.kind === "team-document"
      ? input.parsed.teamId
      : input.parsed.workspaceId
  const searchWorkspaceId =
    input.result?.workspaceId ??
    (input.parsed.kind === "team-document"
      ? (input.appContext.authContext?.currentWorkspace?.id ?? null)
      : input.parsed.workspaceId)

  return {
    documentScopeId,
    documentScopeType,
    isPrivateDocument: input.parsed.kind === "private-document",
    searchWorkspaceId,
  }
}

async function bumpCreatedDocumentReadModels(input: {
  appContext: DocumentRouteAppContext
  parsed: CreateDocumentPayload
  result: Awaited<ReturnType<typeof createDocumentServer>>
}) {
  const scope = getCreatedDocumentScope(input)

  if (scope.isPrivateDocument) {
    await bumpPrivateDocumentIndexReadModelScopesServer(
      scope.documentScopeId,
      input.appContext.ensuredUser.userId
    )
  } else {
    await bumpDocumentIndexReadModelScopesServer(
      scope.documentScopeType,
      scope.documentScopeId
    )
  }

  if (!scope.searchWorkspaceId) {
    return
  }

  if (scope.isPrivateDocument) {
    await bumpPrivateSearchSeedReadModelScopesServer(
      scope.searchWorkspaceId,
      input.appContext.ensuredUser.userId
    )
    return
  }

  await bumpSearchSeedReadModelScopesServer(scope.searchWorkspaceId)
}

async function createDocumentForRoute(
  parsed: CreateDocumentPayload,
  appContext: DocumentRouteAppContext
) {
  const result = await createDocumentServer({
    currentUserId: appContext.ensuredUser.userId,
    ...parsed,
  })

  await bumpCreatedDocumentReadModels({
    appContext,
    parsed,
    result,
  })

  return result
}

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

    const result = await createDocumentForRoute(parsed, appContext)

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
