import { cookies } from "next/headers"

export const SELECTED_WORKSPACE_COOKIE = "linear_selected_workspace_id"

type WorkspaceSelectableSnapshot = {
  currentWorkspaceId: string
  workspaces: Array<{ id: string }>
}

type WorkspaceAvailabilitySnapshot = {
  workspaces: Array<{ id: string }>
}

type WorkspaceAvailabilityNavigation =
  | { kind: "onboarding"; path: string }
  | { kind: "select"; path: string; workspaceId: string }
  | { kind: "selector"; path: string }
  | { kind: "target"; path: string }

const DEFAULT_WORKSPACE_TARGET_PATH = "/workspace/projects"

export function getSelectedWorkspaceCookieOptions() {
  return {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  }
}

function buildWorkspaceSelectionRedirectPath({
  nextPath = DEFAULT_WORKSPACE_TARGET_PATH,
  workspaceId,
}: {
  nextPath?: string
  workspaceId: string
}) {
  const params = new URLSearchParams({
    next: nextPath,
    workspaceId,
  })

  return `/api/workspace/current/selection?${params.toString()}`
}

export function normalizeWorkspaceSelectionNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return DEFAULT_WORKSPACE_TARGET_PATH
  }

  return nextPath
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

function hasValidSelectedWorkspace(
  snapshot: WorkspaceAvailabilitySnapshot,
  selectedWorkspaceId: string | null
) {
  return snapshot.workspaces.some(
    (workspace) => workspace.id === selectedWorkspaceId
  )
}

export function resolveWorkspaceAvailabilityNavigation({
  onboardingPath = "/onboarding",
  selectSingleWorkspace = true,
  selectedWorkspaceId,
  selectorPath = "/workspaces",
  snapshot,
  targetPath = DEFAULT_WORKSPACE_TARGET_PATH,
}: {
  onboardingPath?: string
  selectSingleWorkspace?: boolean
  selectedWorkspaceId: string | null
  selectorPath?: string
  snapshot: WorkspaceAvailabilitySnapshot
  targetPath?: string
}): WorkspaceAvailabilityNavigation {
  if (snapshot.workspaces.length === 0) {
    return { kind: "onboarding", path: onboardingPath }
  }

  const selectedIsValid = hasValidSelectedWorkspace(
    snapshot,
    selectedWorkspaceId
  )

  if (snapshot.workspaces.length === 1) {
    const [workspace] = snapshot.workspaces

    if (!workspace || selectedIsValid || !selectSingleWorkspace) {
      return { kind: "target", path: targetPath }
    }

    return {
      kind: "select",
      path: buildWorkspaceSelectionRedirectPath({
        nextPath: targetPath,
        workspaceId: workspace.id,
      }),
      workspaceId: workspace.id,
    }
  }

  if (!selectedIsValid) {
    return { kind: "selector", path: selectorPath }
  }

  return { kind: "target", path: targetPath }
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
