import { getWorkspaceMembershipBootstrapServer } from "@/lib/server/convex"
import {
  getSelectedWorkspaceIdFromCookies,
  resolveWorkspaceAvailabilityNavigation,
} from "@/lib/server/workspace-selection"

export async function resolveWorkspaceEntryNavigation({
  email,
  workspaceId,
  workosUserId,
}: {
  email?: string
  workspaceId: string
  workosUserId: string
}) {
  const data = await getWorkspaceMembershipBootstrapServer({
    workosUserId,
    email,
    workspaceId,
  })

  return {
    data,
    navigation: resolveWorkspaceAvailabilityNavigation({
      selectedWorkspaceId: await getSelectedWorkspaceIdFromCookies(),
      snapshot: data,
    }),
  }
}
