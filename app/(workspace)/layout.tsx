import { withAuth } from "@workos-inc/authkit-nextjs"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { AuthenticatedWorkspaceClient } from "@/components/app/authenticated-workspace-client"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import {
  buildAppDestination,
  buildPortalAuthHref,
  getAppModeFromHeaders,
  isSingleHostLocalDev,
} from "@/lib/portal"

export default async function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const requestHeaders = await headers()

  if (
    !isSingleHostLocalDev() &&
    getAppModeFromHeaders(requestHeaders) === "portal"
  ) {
    redirect(buildAppDestination("projects", "/inbox"))
  }

  const auth = await withAuth()
  if (!auth.user) {
    redirect(buildPortalAuthHref("login", "projects", "/inbox"))
  }

  const { authenticatedUser, authContext } = await ensureAuthenticatedAppContext(
    auth.user,
    auth.organizationId
  )

  if (!authContext?.currentWorkspace) {
    redirect("/onboarding")
  }

  return (
    <AuthenticatedWorkspaceClient authenticatedUser={authenticatedUser}>
      {children}
    </AuthenticatedWorkspaceClient>
  )
}
