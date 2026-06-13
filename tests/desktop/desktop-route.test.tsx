import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const pathnameMock = vi.hoisted(() => vi.fn(() => "/workspace/projects"))

vi.mock("@/components/app/screens", () => ({
  AssignedScreen: () => <div>Assigned screen</div>,
  DocsScreen: () => <div>Docs screen</div>,
  DocumentDetailScreen: ({ documentId }: { documentId: string }) => (
    <div>Document detail {documentId}</div>
  ),
  InboxScreen: () => <div>Inbox screen</div>,
  ProjectDetailScreen: ({ projectId }: { projectId: string }) => (
    <div>Project detail {projectId}</div>
  ),
  ProjectsScreen: ({
    scopeId,
    scopeType,
    title,
  }: {
    scopeId: string
    scopeType: string
    title: string
  }) => (
    <div>
      {title} {scopeType}:{scopeId}
    </div>
  ),
  TeamWorkScreen: ({ teamSlug }: { teamSlug: string }) => (
    <div>Team work {teamSlug}</div>
  ),
  UserCalendarScreen: () => <div>Calendar screen</div>,
  ViewsScreen: () => <div>Views screen</div>,
  WorkItemDetailScreen: ({ itemId }: { itemId: string }) => (
    <div>Item detail {itemId}</div>
  ),
  WorkspaceItemsScreen: () => <div>Workspace items screen</div>,
}))

vi.mock("@/components/app/collaboration-screens", () => ({
  TeamChannelsScreen: () => <div>Team channel screen</div>,
  TeamChatScreen: () => <div>Team chat screen</div>,
  WorkspaceChannelsScreen: () => <div>Workspace channel screen</div>,
  WorkspaceChatsScreen: () => <div>Workspace chats screen</div>,
}))

vi.mock("@/components/app/screens/team-dashboard-screen", () => ({
  TeamDashboardScreen: ({ teamSlug }: { teamSlug: string }) => (
    <div>Team dashboard {teamSlug}</div>
  ),
}))

vi.mock("@/components/app/settings-screens/create-team-screen", () => ({
  CreateTeamScreen: () => <div>Create team screen</div>,
}))

vi.mock("@/components/app/settings-screens/team-settings-screen", () => ({
  TeamSettingsScreen: () => <div>Team settings screen</div>,
}))

vi.mock("@/components/app/settings-screens/user-settings-screen", () => ({
  UserSettingsScreen: () => <div>User settings screen</div>,
}))

vi.mock("@/components/app/settings-screens/workspace-settings-screen", () => ({
  WorkspaceSettingsScreen: () => <div>Workspace settings screen</div>,
}))

vi.mock("@/components/app/workspace-search-screen", () => ({
  WorkspaceSearchScreen: () => <div>Workspace search screen</div>,
}))

vi.mock("@/components/app/people-screen", () => ({
  PeopleProfileScreen: ({ userId }: { userId: string }) => (
    <div>People profile {userId}</div>
  ),
  PeopleScreen: () => <div>People screen</div>,
}))

vi.mock("@/lib/browser/app-navigation", () => ({
  useAppPathname: () => pathnameMock(),
  useAppSearchParams: () => new URLSearchParams(),
}))

vi.mock("@/lib/domain/selectors", () => ({
  getCurrentWorkspace: () => ({
    id: "workspace_1",
    name: "Recipe Room",
  }),
  getProjectHref: (_state: unknown, projectId: string) =>
    `/workspace/projects/${projectId}`,
  getTeamBySlug: () => ({
    id: "team_1",
    name: "MVP",
    slug: "mvp",
  }),
  teamHasFeature: () => true,
}))

vi.mock("@/lib/store/app-store", () => ({
  useAppStore: (selector: (state: unknown) => unknown) => selector({}),
}))

import { DesktopRoute } from "@/desktop/renderer/desktop-route"

describe("DesktopRoute", () => {
  it("keeps the workspace projects collection route out of project detail", () => {
    pathnameMock.mockReturnValue("/workspace/projects")

    render(<DesktopRoute />)

    expect(
      screen.getByText("Workspace projects workspace:workspace_1")
    ).toBeInTheDocument()
    expect(screen.queryByText(/Project detail/u)).not.toBeInTheDocument()
  })

  it("routes workspace project detail paths to the project detail screen", () => {
    pathnameMock.mockReturnValue("/workspace/projects/project_1")

    render(<DesktopRoute />)

    expect(screen.getByText("Project detail project_1")).toBeInTheDocument()
  })

  it("routes team project detail paths to the project detail screen", () => {
    pathnameMock.mockReturnValue("/team/mvp/projects/project_1")

    render(<DesktopRoute />)

    expect(screen.getByText("Project detail project_1")).toBeInTheDocument()
    expect(screen.queryByText("Team work mvp")).not.toBeInTheDocument()
  })

  it("routes team dashboard paths to the team dashboard screen", () => {
    pathnameMock.mockReturnValue("/team/mvp/dashboard")

    render(<DesktopRoute />)

    expect(screen.getByText("Team dashboard mvp")).toBeInTheDocument()
    expect(screen.queryByText("Team work mvp")).not.toBeInTheDocument()
  })

  it("routes workspace people to the people directory screen", async () => {
    pathnameMock.mockReturnValue("/workspace/people")

    render(<DesktopRoute />)

    expect(await screen.findByText("People screen")).toBeInTheDocument()
  })

  it("routes workspace people detail paths to the profile screen", async () => {
    pathnameMock.mockReturnValue("/workspace/people/user_maya")

    render(<DesktopRoute />)

    expect(
      await screen.findByText("People profile user_maya")
    ).toBeInTheDocument()
  })
})
