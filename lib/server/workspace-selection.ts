import { cookies } from "next/headers"

export const SELECTED_WORKSPACE_COOKIE = "linear_selected_workspace_id"

type WorkspaceSelectableSnapshot = {
  currentWorkspaceId: string
  workspaces: Array<{ id: string }>
}

export function getSelectedWorkspaceCookieOptions() {
  return {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  }
}

export async function getSelectedWorkspaceIdFromCookies() {
  try {
    const cookieStore = await cookies()
    const selectedWorkspaceId = cookieStore
      .get(SELECTED_WORKSPACE_COOKIE)
      ?.value.trim()

    return selectedWorkspaceId && selectedWorkspaceId.length > 0
      ? selectedWorkspaceId
      : null
  } catch {
    return null
  }
}

export function applySelectedWorkspaceIdToSnapshot<
  TSnapshot extends WorkspaceSelectableSnapshot,
>(snapshot: TSnapshot, selectedWorkspaceId: string | null) {
  if (
    !selectedWorkspaceId ||
    selectedWorkspaceId === snapshot.currentWorkspaceId ||
    !snapshot.workspaces.some(
      (workspace) => workspace.id === selectedWorkspaceId
    )
  ) {
    return snapshot
  }

  return {
    ...snapshot,
    currentWorkspaceId: selectedWorkspaceId,
  }
}
