import { NextRequest } from "next/server"

import { ApplicationError } from "@/lib/server/application-errors"
import { workspaceChatSchema } from "@/lib/domain/types"
import {
  bumpScopedReadModelVersionsServer,
  createWorkspaceChatServer,
} from "@/lib/server/convex"
import { resolveConversationReadModelScopeKeysServer } from "@/lib/server/scoped-read-models"
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
    workspaceChatSchema,
    "Invalid chat payload"
  )

  if (isRouteResponse(parsed)) {
    return parsed
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const result = await createWorkspaceChatServer({
      currentUserId: appContext.ensuredUser.userId,
      ...parsed,
    })
    if (result?.conversationId) {
      await bumpScopedReadModelVersionsServer({
        scopeKeys: await resolveConversationReadModelScopeKeysServer(
          session,
          result.conversationId
        ),
      })
    }

    return jsonOk({
      ok: true,
      conversationId: result?.conversationId ?? null,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to create chat", error)
    return jsonError(
      getConvexErrorMessage(error, "Failed to create chat"),
      500,
      {
        code: "CHAT_CREATE_FAILED",
      }
    )
  }
}
