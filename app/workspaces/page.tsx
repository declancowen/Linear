import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

import { WorkspaceSelectorPage } from "@/components/app/workspace-selector-page"
import { buildAuthHref, buildSessionResolvePath } from "@/lib/auth-routing"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { resolveWorkspaceEntryNavigation } from "@/lib/server/workspace-entry-navigation"

type WorkspacesPageProps = {
  searchParams: Promise<{
    validated?: string
  }>
}

type WorkspacesAuth = Awaited<ReturnType<typeof withAuth>>
type AuthenticatedWorkspacesAuth = WorkspacesAuth & {
  user: NonNullable<WorkspacesAuth["user"]>
}

async function requireValidatedWorkspacesAuth(
  validated?: string
): Promise<AuthenticatedWorkspacesAuth> {
  const auth = await withAuth()

  if (auth.user && validated !== "1") {
    redirect(
      buildSessionResolvePath({
        mode: "login",
        nextPath: "/workspaces?validated=1",
      })
    )
  }

  if (!auth.user) {
    redirect(buildAuthHref("login", "/workspaces"))
  }

  return auth as AuthenticatedWorkspacesAuth
}

async function requireCurrentWorkspace(auth: AuthenticatedWorkspacesAuth) {
  const { authContext } = await ensureAuthenticatedAppContext(
    auth.user,
    auth.organizationId
  )

  if (!authContext?.currentWorkspace) {
    redirect("/onboarding")
  }

  return authContext.currentWorkspace
}

export default async function WorkspacesPage({
  searchParams,
}: WorkspacesPageProps) {
  const params = await searchParams
  const auth = await requireValidatedWorkspacesAuth(params.validated)
  const currentWorkspace = await requireCurrentWorkspace(auth)

  const { data, navigation } = await resolveWorkspaceEntryNavigation({
    workosUserId: auth.user.id,
    email: auth.user.email ?? undefined,
    workspaceId: currentWorkspace.id,
  })

  if (navigation.kind !== "selector") {
    redirect(navigation.path)
  }

  return (
    <WorkspaceSelectorPage
      workspaces={data.workspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        logoUrl: workspace.logoUrl,
      }))}
    />
  )
}
