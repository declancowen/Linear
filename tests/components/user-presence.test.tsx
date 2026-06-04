import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import { SurfaceSidebarContent } from "@/components/app/collaboration-screens/shared-ui"
import { getSurfaceSidebarHeroDisplay } from "@/components/app/collaboration-screens/surface-sidebar-display"
import { UserHoverCard, UserStatusDot } from "@/components/app/user-presence"
import { useAppStore } from "@/lib/store/app-store"
import {
  createTestWorkspaceMembership,
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
  HoverCardContent: ({
    children,
    className,
    portalled,
  }: {
    children: ReactNode
    className?: string
    portalled?: boolean
  }) => (
    <div
      data-testid="hover-card-content"
      data-portalled={String(portalled)}
      className={className}
    >
      {children}
    </div>
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

const longEmailUser = createTestUser({
  id: "user_long_email",
  name: "Long Email User",
  handle: "long-email-user",
  email: "long.email.address.with.multiple.sections@example-very-long-domain-name.com",
  title: "Principal Systems Designer With A Very Long Title",
  hasExplicitStatus: true,
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
      screen.queryByRole("button", { name: "Chat" })
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

  it("renders profile hover cards above app surfaces", () => {
    render(
      <UserHoverCard
        user={formerUser}
        userId={formerUser.id}
        currentUserId={currentUser.id}
        workspaceId="workspace_1"
      >
        <button type="button">Open layered profile</button>
      </UserHoverCard>
    )

    expect(screen.getByTestId("hover-card-content")).toHaveClass("z-[120]")
    expect(screen.getByTestId("hover-card-content")).toHaveAttribute(
      "data-portalled",
      "true"
    )
  })

  it("keeps sidebar member profile hover cards in the top-level portal", () => {
    render(
      <SurfaceSidebarContent
        title="Direct chat"
        description="Chat details"
        members={[formerUser]}
      />
    )

    expect(screen.getByTestId("hover-card-content")).toHaveAttribute(
      "data-portalled",
      "true"
    )
  })

  it("truncates long hero emails without pushing out the copy action", () => {
    useAppStore.setState((state) => ({
      ...state,
      users: [...state.users, longEmailUser],
      workspaceMemberships: [
        createTestWorkspaceMembership({
          workspaceId: "workspace_1",
          userId: longEmailUser.id,
          role: "member",
        }),
      ],
    }))

    render(
      <SurfaceSidebarContent
        title="Direct chat"
        description="Chat details"
        members={[longEmailUser]}
        heroMember={longEmailUser}
      />
    )

    const email = screen.getByTitle(longEmailUser.email)
    const copyButton = email.parentElement?.querySelector(
      'button[aria-label="Copy email"]'
    )

    expect(email).toHaveClass("overflow-hidden", "text-ellipsis")
    expect(email.parentElement).toHaveStyle({
      gridTemplateColumns: "auto minmax(0, 1fr) auto",
    })
    expect(copyButton).toHaveClass("shrink-0")
  })

  it("uses a plain offline indicator without an X glyph", () => {
    const { container } = render(<UserStatusDot status="offline" />)

    const dot = container.firstElementChild

    expect(dot).not.toBeNull()
    expect(dot?.querySelector("svg")).toBeNull()
    expect(dot).not.toHaveClass("ring-1")
  })

  it("opens the workspace profile from the hover card profile action", () => {
    useAppStore.setState((state) => ({
      ...state,
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

    expect(
      screen.queryByRole("button", { name: "Message" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Chat" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Profile" }))

    expect(routerPushMock).toHaveBeenCalledWith(
      `/workspace/people/${formerUser.id}`
    )
  })

  it("opens or creates a direct chat from the hover card chat action", () => {
    const createWorkspaceChat = vi.fn().mockReturnValue("chat_direct")

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

    fireEvent.click(screen.getByRole("button", { name: "Chat" }))

    expect(createWorkspaceChat).toHaveBeenCalledWith({
      participantIds: [formerUser.id],
      workspaceId: "workspace_1",
      title: "",
      description: "",
    })
    expect(routerPushMock).toHaveBeenCalledWith("/chats?chatId=chat_direct")
  })
})
