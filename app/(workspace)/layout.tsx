import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

import { AuthenticatedWorkspaceClient } from "@/components/app/authenticated-workspace-client"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { buildAuthHref } from "@/lib/auth-routing"
import { getWorkspaceMembershipBootstrapServer } from "@/lib/server/convex"
import { createMinimalWorkspaceShellSeed } from "@/lib/server/workspace-shell-seed"

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

  let initialShellSeed = createMinimalWorkspaceShellSeed({
    authContext,
  })

  try {
    initialShellSeed = {
      data: await getWorkspaceMembershipBootstrapServer({
        workosUserId: auth.user.id,
        email: auth.user.email ?? undefined,
        workspaceId: authContext.currentWorkspace.id,
      }),
      replace: initialShellSeed.replace,
    }
  } catch (error) {
    console.error("Failed to load workspace shell bootstrap", error)
  }

  return (
    <AuthenticatedWorkspaceClient
      authenticatedUser={authenticatedUser}
      initialShellSeed={initialShellSeed}
      initialWorkspaceId={authContext.currentWorkspace.id}
    >
      {children}
    </AuthenticatedWorkspaceClient>
  )
}
