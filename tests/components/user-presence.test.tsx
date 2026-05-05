import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import {
  SurfaceSidebarContent,
} from "@/components/app/collaboration-screens/shared-ui"
import { getSurfaceSidebarHeroDisplay } from "@/components/app/collaboration-screens/surface-sidebar-display"
import { UserHoverCard } from "@/components/app/user-presence"
import { useAppStore } from "@/lib/store/app-store"
import {
  createTestUser,
  createTestWorkspaceShellData,
} from "@/tests/lib/fixtures/app-data"

const routerPushMock = vi.hoisted(() => vi.fn())

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
  }),
}))

vi.mock("sonner", async () =>
  (await import("@/tests/lib/fixtures/component-stubs")).createToastStubModule()
)

vi.mock("@/components/ui/hover-card", () => ({
  HoverCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  HoverCardTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  HoverCardContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}))

const currentUser = createTestUser({
  id: "user_current",
  name: "Current User",
  handle: "current-user",
  email: "current@example.com",
  title: "Founder",
  hasExplicitStatus: false,
})

const formerUser = createTestUser({
  id: "user_former",
  name: "Declan Cowen",
  handle: "declan-cowen",
  email: "declan@example.com",
  avatarUrl: "https://example.com/declan.png",
  title: "Product Owner",
  status: "out-of-office",
  statusMessage: "No status message",
  hasExplicitStatus: true,
})

const offlineUser = createTestUser({
  id: "user_offline",
  name: "Offline User",
  handle: "offline-user",
  email: "offline@example.com",
  title: "Engineer",
  status: "offline",
  statusMessage: "",
  hasExplicitStatus: false,
})

beforeEach(() => {
  routerPushMock.mockReset()
  useAppStore.setState(
    createTestWorkspaceShellData({
      currentUserId: currentUser.id,
      users: [currentUser, formerUser, offlineUser],
    })
  )
})

describe("workspace former-member presence", () => {
  it("resolves sidebar hero display fallback and former-member state", () => {
    expect(
      getSurfaceSidebarHeroDisplay({
        heroMember: formerUser,
        heroView: null,
        title: "Direct chat",
      })
    ).toMatchObject({
      name: "Declan Cowen",
      showStatus: true,
      title: "Declan Cowen",
    })

    expect(
      getSurfaceSidebarHeroDisplay({
        heroMember: formerUser,
        heroView: {
          avatarImageUrl: "https://example.com/declan-image.png",
          avatarUrl: "https://example.com/declan-avatar.png",
          id: formerUser.id,
          isFormerMember: true,
          name: "Former teammate",
          status: "offline",
        } as never,
        title: "Direct chat",
      })
    ).toMatchObject({
      avatarImageUrl: "https://example.com/declan-image.png",
      avatarUrl: "https://example.com/declan-avatar.png",
      name: "Former teammate",
      showStatus: false,
      title: "Former teammate",
    })
  })

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

  it("starts a direct workspace chat from the hover card message action", () => {
    const createWorkspaceChat = vi.fn().mockReturnValue("chat_1")
    useAppStore.setState((state) => ({
      ...state,
      createWorkspaceChat: createWorkspaceChat as never,
      workspaceMemberships: [
        {
          workspaceId: "workspace_1",
          userId: formerUser.id,
          role: "member",
        },
      ],
    }))

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

    fireEvent.click(screen.getByRole("button", { name: "Message" }))

    expect(createWorkspaceChat).toHaveBeenCalledWith({
      participantIds: [formerUser.id],
      workspaceId: "workspace_1",
      title: "",
      description: "",
    })
    expect(routerPushMock).toHaveBeenCalledWith("/chats?chatId=chat_1")
  })
})
