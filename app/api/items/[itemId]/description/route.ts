import { NextRequest } from "next/server"
import { z } from "zod"

import { notifyCollaborationDocumentChangedServer } from "@/lib/server/collaboration-refresh"
import {
  bumpScopedReadModelVersionsServer,
  updateItemDescriptionServer,
} from "@/lib/server/convex"
import { handleAppContextJsonRoute } from "@/lib/server/route-handlers"
import { jsonOk } from "@/lib/server/route-response"
import { resolveWorkItemReadModelScopeKeysServer } from "@/lib/server/scoped-read-models"

const itemDescriptionSchema = z.object({
  content: z.string().trim().min(1),
  expectedUpdatedAt: z.string().datetime().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params

  return handleAppContextJsonRoute(request, {
    schema: itemDescriptionSchema,
    invalidMessage: "Invalid item description payload",
    failureLogLabel: "Failed to update description",
    failureMessage: "Failed to update description",
    failureCode: "ITEM_DESCRIPTION_UPDATE_FAILED",
    async handle({ session, appContext, parsed }) {
      const scopeKeys = await resolveWorkItemReadModelScopeKeysServer(
        session,
        itemId
      )
      const result = await updateItemDescriptionServer({
        currentUserId: appContext.ensuredUser.userId,
        itemId,
        content: parsed.content,
        expectedUpdatedAt: parsed.expectedUpdatedAt,
      })

      if (!result || typeof result.updatedAt !== "string") {
        throw new Error(
          "Item description update did not return an updated timestamp"
        )
      }

      await bumpScopedReadModelVersionsServer({
        scopeKeys,
      })
      if (typeof result.documentId === "string") {
        const refreshResult = await notifyCollaborationDocumentChangedServer({
          documentId: result.documentId,
          kind: "canonical-updated",
          reason: "item-description-route-patch",
        })

        if (!refreshResult.ok) {
          console.warn("[collaboration] failed to notify item description room", {
            itemId,
            documentId: result.documentId,
            reason: refreshResult.reason,
          })
        }
      }

      return jsonOk({
        ok: true,
        updatedAt: result.updatedAt,
      })
    },
  })
}
