"use client"

import { ConvexAppProvider } from "@/components/providers/convex-app-provider"
import { AppShell } from "@/components/app/shell"
import type { AuthenticatedAppUser } from "@/lib/workos/auth"

type AuthenticatedWorkspaceClientProps = {
  children: React.ReactNode
  authenticatedUser: AuthenticatedAppUser
  initialWorkspaceId: string
}

export function AuthenticatedWorkspaceClient({
  children,
  authenticatedUser,
  initialWorkspaceId,
}: AuthenticatedWorkspaceClientProps) {
  return (
    <ConvexAppProvider
      authenticatedUser={authenticatedUser}
      initialWorkspaceId={initialWorkspaceId}
    >
      <AppShell>{children}</AppShell>
    </ConvexAppProvider>
  )
}
