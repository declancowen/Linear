import { NextRequest } from "next/server"
import { z } from "zod"

import { shiftTimelineItemServer } from "@/lib/server/convex"
import { handleAppContextJsonRoute } from "@/lib/server/route-handlers"
import { jsonOk } from "@/lib/server/route-response"

const timelineShiftSchema = z.object({
  nextStartDate: z.string().min(1),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params

  return handleAppContextJsonRoute(request, {
    schema: timelineShiftSchema,
    invalidMessage: "Invalid timeline payload",
    failureLogLabel: "Failed to move timeline item",
    failureMessage: "Failed to move timeline item",
    failureCode: "WORK_ITEM_SCHEDULE_UPDATE_FAILED",
    async handle({ appContext, parsed }) {
      await shiftTimelineItemServer({
        currentUserId: appContext.ensuredUser.userId,
        itemId,
        nextStartDate: parsed.nextStartDate,
      })

      return jsonOk({
        ok: true,
      })
    },
  })
}
