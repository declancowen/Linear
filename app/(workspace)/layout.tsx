import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

import { AuthenticatedWorkspaceClient } from "@/components/app/authenticated-workspace-client"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { buildAuthHref } from "@/lib/auth-routing"

export default async function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const auth = await withAuth()
  if (!auth.user) {
    redirect(buildAuthHref("login", "/workspace/projects"))
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
