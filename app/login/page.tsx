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

type LoginPageProps = {
  searchParams: Promise<{
    app?: string
    next?: string
    error?: string
    notice?: string
    email?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const requestHeaders = await headers()
  const appMode = getAppModeFromHeaders(requestHeaders)
  const selectedAppId = parsePortalAppId(params.app)
  const nextPath = normalizePortalAuthNextPath(params.next, selectedAppId)

  if (!isSingleHostLocalDev() && appMode !== "portal") {
    redirect(buildPortalAuthHref("login", "projects", nextPath))
  }

  const auth = await withAuth()

  if (auth.user) {
    redirect(buildPortalPostAuthPath(selectedAppId, nextPath))
  }

  return (
    <AuthEntryScreen
      mode="login"
      appId={selectedAppId}
      nextPath={nextPath}
      error={params.error}
      notice={params.notice}
      initialEmail={params.email}
    />
  )
}
