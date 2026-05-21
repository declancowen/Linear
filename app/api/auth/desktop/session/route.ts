import { z } from "zod"

import { parseJsonBody } from "@/lib/server/route-body"
import { jsonError, jsonOk } from "@/lib/server/route-response"
import { createDesktopSessionTokenFromHandoffTicket } from "@/lib/server/desktop-session"

const desktopSessionBodySchema = z.object({
  ticket: z.string().min(1),
})

export async function POST(request: Request) {
  const parsed = await parseJsonBody(
    request,
    desktopSessionBodySchema,
    "Invalid desktop session payload"
  )

  if (parsed instanceof Response) {
    return parsed
  }

  const sessionToken = createDesktopSessionTokenFromHandoffTicket(parsed.ticket)

  if (!sessionToken) {
    return jsonError("Invalid desktop authentication ticket", 401, {
      code: "DESKTOP_AUTH_TICKET_INVALID",
    })
  }

  return jsonOk(sessionToken)
}
