import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

import { ConvexAppProvider } from "@/components/providers/convex-app-provider"
import { AppShell } from "@/components/app/shell"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"

export default async function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const auth = await withAuth()
  if (!auth.user) {
    redirect("/login?next=%2Finbox")
  }

  const { authenticatedUser, authContext } = await ensureAuthenticatedAppContext(
    auth.user,
    auth.organizationId
  )

  if (!authContext?.currentWorkspace) {
    redirect("/onboarding")
  }

  return (
    <ConvexAppProvider authenticatedUser={authenticatedUser}>
      <AppShell>{children}</AppShell>
    </ConvexAppProvider>
  )
}
