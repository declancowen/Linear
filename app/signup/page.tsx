import { withAuth } from "@workos-inc/authkit-nextjs"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { AuthEntryScreen } from "@/components/app/auth-entry-screen"
import {
  buildPortalAuthHref,
  buildPortalPostAuthPath,
  getAppModeFromHeaders,
  isSingleHostLocalDev,
  normalizePortalAuthNextPath,
  parsePortalAppId,
} from "@/lib/portal"

type SignupPageProps = {
  searchParams: Promise<{
    app?: string
    next?: string
    error?: string
    notice?: string
    email?: string
    firstName?: string
    lastName?: string
  }>
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams
  const requestHeaders = await headers()
  const appMode = getAppModeFromHeaders(requestHeaders)
  const selectedAppId = parsePortalAppId(params.app)
  const nextPath = normalizePortalAuthNextPath(params.next, selectedAppId)

  if (!isSingleHostLocalDev() && appMode !== "portal") {
    redirect(buildPortalAuthHref("signup", "projects", nextPath))
  }

  const auth = await withAuth()

  if (auth.user) {
    redirect(buildPortalPostAuthPath(selectedAppId, nextPath))
  }

  return (
    <AuthEntryScreen
      mode="signup"
      appId={selectedAppId}
      nextPath={nextPath}
      error={params.error}
      notice={params.notice}
      initialEmail={params.email}
      initialFirstName={params.firstName}
      initialLastName={params.lastName}
    />
  )
}
