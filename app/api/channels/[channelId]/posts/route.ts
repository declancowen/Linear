import { NextRequest } from "next/server"
import { z } from "zod"

import { ApplicationError } from "@/lib/server/application-errors"
import { channelPostSchema } from "@/lib/domain/types"
import {
  bumpScopedReadModelVersionsServer,
  createChannelPostServer,
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

const channelPostBodySchema = z.object({
  title: channelPostSchema.shape.title,
  content: channelPostSchema.shape.content,
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  const parsedBody = await parseJsonBody(
    request,
    channelPostBodySchema,
    "Invalid post payload"
  )

  if (isRouteResponse(parsedBody)) {
    return parsedBody
  }

  const { channelId } = await params
  const parsed = channelPostSchema.safeParse({
    conversationId: channelId,
    title: parsedBody.title,
    content: parsedBody.content,
  })

  if (!parsed.success) {
    return jsonError("Invalid post payload", 400)
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const result = await createChannelPostServer({
      currentUserId: appContext.ensuredUser.userId,
      ...parsed.data,
    })
    await bumpScopedReadModelVersionsServer({
      scopeKeys: await resolveConversationReadModelScopeKeysServer(
        session,
        channelId
      ),
    })

    return jsonOk({
      ok: true,
      postId: result?.postId ?? null,
    })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return jsonApplicationError(error)
    }

    logProviderError("Failed to create post", error)
    return jsonError(getConvexErrorMessage(error, "Failed to create post"), 500, {
      code: "CHANNEL_POST_CREATE_FAILED",
    })
  }
}
