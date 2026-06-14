import { jsonError, isRouteResponse } from "@/lib/server/route-response"
import { requireSession } from "@/lib/server/route-auth"

export async function POST() {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  return jsonError("Public workspace creation is disabled", 403)
}
