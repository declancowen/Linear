import { NextRequest } from "next/server"

import {
  bumpScopedReadModelVersionsServer,
  toggleChannelPostReactionServer,
} from "@/lib/server/convex"
import {
  handleAppContextJsonRoute,
  reactionPayloadSchema,
} from "@/lib/server/route-handlers"
import { jsonOk } from "@/lib/server/route-response"
import { resolveChannelPostReadModelScopeKeysServer } from "@/lib/server/scoped-read-models"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params

  return handleAppContextJsonRoute(request, {
    schema: reactionPayloadSchema,
    invalidMessage: "Invalid reaction payload",
    failureLogLabel: "Failed to update reaction",
    failureMessage: "Failed to update reaction",
    async handle({ session, appContext, parsed }) {
      await toggleChannelPostReactionServer({
        currentUserId: appContext.ensuredUser.userId,
        postId,
        emoji: parsed.emoji,
      })
      await bumpScopedReadModelVersionsServer({
        scopeKeys: await resolveChannelPostReadModelScopeKeysServer(
          session,
          postId
        ),
      })

      return jsonOk({
        ok: true,
      })
    },
  })
}
