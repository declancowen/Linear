import { redirect } from "next/navigation"

import { buildAppDestination, normalizeNextPath, parsePortalAppId } from "@/lib/portal"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const appId = parsePortalAppId(url.searchParams.get("app")) ?? "projects"
  const nextPath = normalizeNextPath(url.searchParams.get("next"), appId)

  redirect(buildAppDestination(appId, nextPath))
}
