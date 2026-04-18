import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import { SurfaceSidebarContent } from "@/components/app/collaboration-screens/shared-ui"
import { UserHoverCard } from "@/components/app/user-presence"
import { createEmptyState } from "@/lib/domain/empty-state"
import { useAppStore } from "@/lib/store/app-store"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/components/ui/hover-card", () => ({
  HoverCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  HoverCardTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  HoverCardContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}))

const currentUser = {
  id: "user_current",
  name: "Current User",
  handle: "current-user",
  email: "current@example.com",
  avatarUrl: "",
  avatarImageUrl: null,
  workosUserId: null,
  title: "Founder",
  status: "active" as const,
  statusMessage: "",
  hasExplicitStatus: false,
  accountDeletionPendingAt: null,
  accountDeletedAt: null,
  preferences: {
    emailMentions: true,
    emailAssignments: true,
    emailDigest: true,
    theme: "system" as const,
  },
}

const formerUser = {
  id: "user_former",
  name: "Declan Cowen",
  handle: "declan-cowen",
  email: "declan@example.com",
  avatarUrl: "https://example.com/declan.png",
  avatarImageUrl: null,
  workosUserId: null,
  title: "Product Owner",
  status: "out-of-office" as const,
  statusMessage: "No status message",
  hasExplicitStatus: true,
  accountDeletionPendingAt: null,
  accountDeletedAt: null,
  preferences: {
    emailMentions: true,
    emailAssignments: true,
    emailDigest: true,
    theme: "system" as const,
  },
}

const offlineUser = {
  id: "user_offline",
  name: "Offline User",
  handle: "offline-user",
  email: "offline@example.com",
  avatarUrl: "",
  avatarImageUrl: null,
  workosUserId: null,
  title: "Engineer",
  status: "offline" as const,
  statusMessage: "",
  hasExplicitStatus: false,
  accountDeletionPendingAt: null,
  accountDeletedAt: null,
  preferences: {
    emailMentions: true,
    emailAssignments: true,
    emailDigest: true,
    theme: "system" as const,
  },
}

beforeEach(() => {
  useAppStore.setState({
    ...createEmptyState(),
    currentUserId: currentUser.id,
    currentWorkspaceId: "workspace_1",
    workspaces: [
      {
        id: "workspace_1",
        slug: "workspace-1",
        name: "Workspace 1",
        logoUrl: "",
        logoImageUrl: null,
        createdBy: currentUser.id,
        workosOrganizationId: null,
        settings: {
          accent: "#000000",
          description: "",
        },
      },
    ],
    workspaceMemberships: [],
    teams: [],
    teamMemberships: [],
    users: [currentUser, formerUser, offlineUser],
  })
})

describe("workspace former-member presence", () => {
  it("redacts former members in the hover card", () => {
    render(
      <UserHoverCard
        user={formerUser}
        userId={formerUser.id}
        currentUserId={currentUser.id}
        workspaceId="workspace_1"
      >
        <button type="button">Open profile</button>
      </UserHoverCard>
    )

    expect(screen.getByText("Declan Cowen")).toBeInTheDocument()
    expect(screen.getByText("Left workspace")).toBeInTheDocument()
    expect(screen.queryByText("declan@example.com")).not.toBeInTheDocument()
    expect(screen.queryByText("Product Owner")).not.toBeInTheDocument()
    expect(screen.queryByText("Out of office")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "Email" })
    ).not.toBeInTheDocument()
  })

  it("shows a left-workspace label instead of the former title in the sidebar", () => {
    render(
      <SurfaceSidebarContent
        title="Direct chat"
        description="Chat details"
        members={[formerUser]}
      />
    )

    expect(screen.getAllByText("Left workspace").length).toBeGreaterThan(0)
    expect(screen.queryByText("Product Owner")).not.toBeInTheDocument()
    expect(screen.queryByText("Out of office")).not.toBeInTheDocument()
  })

  it("shows no explicit status details for offline-by-default members", () => {
    useAppStore.setState((state) => ({
      ...state,
      workspaceMemberships: [
        {
          workspaceId: "workspace_1",
          userId: offlineUser.id,
          role: "member",
        },
      ],
    }))

    render(
      <UserHoverCard
        user={offlineUser}
        userId={offlineUser.id}
        currentUserId={currentUser.id}
        workspaceId="workspace_1"
      >
        <button type="button">Open offline profile</button>
      </UserHoverCard>
    )

    expect(screen.getByText("No status set")).toBeInTheDocument()
    expect(screen.getByText("No status message")).toBeInTheDocument()
    expect(screen.queryByText("Offline")).not.toBeInTheDocument()
  })
})
