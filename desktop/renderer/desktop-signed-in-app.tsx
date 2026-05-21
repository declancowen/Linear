"use client"

import { AppShell } from "@/components/app/shell"
import { ConvexAppProvider } from "@/components/providers/convex-app-provider"
import type { ReadModelFetchResult } from "@/lib/convex/client/read-models"
import type { AppSnapshot } from "@/lib/domain/types"

import { DesktopRoute } from "./desktop-route"

export function DesktopSignedInApp({
  initialShellSeed,
  initialWorkspaceId,
}: {
  initialShellSeed: ReadModelFetchResult<Partial<AppSnapshot>>
  initialWorkspaceId: string
}) {
  return (
    <ConvexAppProvider
      authenticatedUser={null}
      initialShellSeed={initialShellSeed}
      initialWorkspaceId={initialWorkspaceId}
    >
      <AppShell>
        <DesktopRoute />
      </AppShell>
    </ConvexAppProvider>
  )
}
