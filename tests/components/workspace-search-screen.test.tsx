import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { searchResultIcon } from "@/components/app/workspace-search-icon"
import { WorkspaceSearchScreen } from "@/components/app/workspace-search-screen"
import { useAppStore } from "@/lib/store/app-store"
import {
  createTestAppData,
  createTestTeam,
  createTestTeamMembership,
  createTestUser,
  createTestWorkspace,
  createTestWorkspaceMembership,
} from "@/tests/lib/fixtures/app-data"

vi.mock("@/hooks/use-scoped-read-model-refresh", () => ({
  useScopedReadModelRefresh: () => ({
    error: null,
    hasLoadedOnce: true,
    refreshing: false,
  }),
}))

vi.mock("@/components/ui/sidebar", async () =>
  (
    await import("@/tests/lib/fixtures/component-stubs")
  ).createSidebarTriggerStubModule()
)

describe("workspace search result icons", () => {
  it("returns an icon for each search result kind", () => {
    const kinds = [
      "navigation",
      "team",
      "person",
      "project",
      "document",
      "item",
    ] as const

    for (const kind of kinds) {
      const { container, unmount } = render(searchResultIcon(kind))

      expect(container.querySelector("svg")).toBeTruthy()
      unmount()
    }
  })
})

describe("WorkspaceSearchScreen", () => {
  beforeEach(() => {
    const workspace = createTestWorkspace({
      id: "workspace_1",
      createdBy: "user_current",
    })
    const team = createTestTeam({
      id: "team_1",
      workspaceId: workspace.id,
      name: "Design",
    })
    const currentUser = createTestUser({
      id: "user_current",
      name: "Alex Owner",
      email: "alex@example.com",
    })
    const person = createTestUser({
      id: "user_maya",
      name: "Maya Singh",
      handle: "maya",
      email: "maya@example.com",
      title: "Product Designer",
    })

    useAppStore.setState(
      createTestAppData({
        currentUserId: currentUser.id,
        currentWorkspaceId: workspace.id,
        workspaces: [workspace],
        workspaceMemberships: [
          createTestWorkspaceMembership({
            workspaceId: workspace.id,
            userId: currentUser.id,
            role: "admin",
          }),
          createTestWorkspaceMembership({
            workspaceId: workspace.id,
            userId: person.id,
            role: "member",
          }),
        ],
        teams: [team],
        teamMemberships: [
          createTestTeamMembership({
            teamId: team.id,
            userId: currentUser.id,
            role: "admin",
          }),
          createTestTeamMembership({
            teamId: team.id,
            userId: person.id,
            role: "member",
          }),
        ],
        users: [currentUser, person],
      })
    )
  })

  it("includes workspace people in search results and links to profiles", async () => {
    render(<WorkspaceSearchScreen />)

    fireEvent.change(screen.getByPlaceholderText("Search everything…"), {
      target: { value: "maya" },
    })

    expect(await screen.findByText("Maya Singh")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Maya Singh/ })).toHaveAttribute(
      "href",
      "/workspace/people/user_maya"
    )
  })
})
