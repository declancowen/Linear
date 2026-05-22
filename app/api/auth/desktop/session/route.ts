import { z } from "zod"

import { parseJsonBody } from "@/lib/server/route-body"
import { jsonError, jsonOk } from "@/lib/server/route-response"
import {
  createDesktopSessionTokenFromHandoffTicket,
  type DesktopSessionTokenResult,
} from "@/lib/server/desktop-session"

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

  let sessionToken: DesktopSessionTokenResult | null

  try {
    sessionToken = await createDesktopSessionTokenFromHandoffTicket(
      parsed.ticket
    )
  } catch (error) {
    console.error("Failed to exchange desktop authentication ticket", error)

    return jsonError("Desktop authentication is temporarily unavailable", 503, {
      code: "DESKTOP_AUTH_TICKET_EXCHANGE_UNAVAILABLE",
    })
  }

  if (!sessionToken) {
    return jsonError("Invalid desktop authentication ticket", 401, {
      code: "DESKTOP_AUTH_TICKET_INVALID",
    })
  }

  return jsonOk(sessionToken)
}
