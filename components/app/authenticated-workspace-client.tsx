"use client"

import { ConvexAppProvider } from "@/components/providers/convex-app-provider"
import { AppShell } from "@/components/app/shell"
import type { ReadModelFetchResult } from "@/lib/convex/client/read-models"
import type { AppSnapshot } from "@/lib/domain/types"
import type { AuthenticatedAppUser } from "@/lib/workos/auth"

type AuthenticatedWorkspaceClientProps = {
  children: React.ReactNode
  authenticatedUser: AuthenticatedAppUser
  initialShellSeed: ReadModelFetchResult<Partial<AppSnapshot>>
  initialWorkspaceId: string
}

export function AuthenticatedWorkspaceClient({
  children,
  authenticatedUser,
  initialShellSeed,
  initialWorkspaceId,
}: AuthenticatedWorkspaceClientProps) {
  return (
    <ConvexAppProvider
      authenticatedUser={authenticatedUser}
      initialShellSeed={initialShellSeed}
      initialWorkspaceId={initialWorkspaceId}
    >
      <AppShell>{children}</AppShell>
    </ConvexAppProvider>
  )
}
