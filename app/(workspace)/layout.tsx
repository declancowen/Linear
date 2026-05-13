import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

import { AuthenticatedWorkspaceClient } from "@/components/app/authenticated-workspace-client"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { buildAuthHref } from "@/lib/auth-routing"
import { getWorkspaceMembershipBootstrapServer } from "@/lib/server/convex"
import {
  getSelectedWorkspaceIdFromCookies,
  resolveWorkspaceAvailabilityNavigation,
} from "@/lib/server/workspace-selection"
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

  const { authenticatedUser, authContext } =
    await ensureAuthenticatedAppContext(auth.user, auth.organizationId)

  if (!authContext?.currentWorkspace) {
    redirect("/onboarding")
  }

  let initialShellSeed = createMinimalWorkspaceShellSeed({
    authContext,
  })
  let workspaceMembershipData: Awaited<
    ReturnType<typeof getWorkspaceMembershipBootstrapServer>
  > | null = null

  try {
    workspaceMembershipData = await getWorkspaceMembershipBootstrapServer({
      workosUserId: auth.user.id,
      email: auth.user.email ?? undefined,
      workspaceId: authContext.currentWorkspace.id,
    })
    initialShellSeed = {
      data: workspaceMembershipData,
      replace: initialShellSeed.replace,
    }
  } catch (error) {
    console.error("Failed to load workspace shell bootstrap", error)
  }

  if (workspaceMembershipData) {
    const navigation = resolveWorkspaceAvailabilityNavigation({
      selectSingleWorkspace: false,
      selectedWorkspaceId: await getSelectedWorkspaceIdFromCookies(),
      snapshot: workspaceMembershipData,
    })

    if (navigation.kind !== "target") {
      redirect(navigation.path)
    }
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
