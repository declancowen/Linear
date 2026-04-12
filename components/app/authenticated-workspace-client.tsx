"use client"

import { ConvexAppProvider } from "@/components/providers/convex-app-provider"
import { AppShell } from "@/components/app/shell"
import type { AuthenticatedAppUser } from "@/lib/workos/auth"

type AuthenticatedWorkspaceClientProps = {
  children: React.ReactNode
  authenticatedUser: AuthenticatedAppUser
}

export function AuthenticatedWorkspaceClient({
  children,
  authenticatedUser,
}: AuthenticatedWorkspaceClientProps) {
  return (
    <ConvexAppProvider authenticatedUser={authenticatedUser}>
      <AppShell>{children}</AppShell>
    </ConvexAppProvider>
  )
}
