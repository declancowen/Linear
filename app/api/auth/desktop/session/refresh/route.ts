import { jsonError, jsonOk } from "@/lib/server/route-response"
import {
  getDesktopSessionTokenFromRequestHeaders,
  refreshDesktopSessionToken,
} from "@/lib/server/desktop-session"

export async function POST(request: Request) {
  const token = await getDesktopSessionTokenFromRequestHeaders(request.headers)
  const refreshedSession = token ? refreshDesktopSessionToken(token) : null

  if (!refreshedSession) {
    return jsonError("Invalid desktop session", 401, {
      code: "DESKTOP_SESSION_INVALID",
    })
  }

  return jsonOk(refreshedSession)
}
