import { withAuth } from "@workos-inc/authkit-nextjs"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { PortalHubScreen } from "@/components/app/portal-hub-screen"
import { getAppModeFromHeaders } from "@/lib/portal"

export default async function Page() {
  const requestHeaders = await headers()

  if (getAppModeFromHeaders(requestHeaders) !== "portal") {
    redirect("/inbox")
  }

  const auth = await withAuth()

  if (!auth.user) {
    redirect("/login")
  }

  return <PortalHubScreen />
}
