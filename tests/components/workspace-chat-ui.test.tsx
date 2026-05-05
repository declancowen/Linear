import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CreateWorkspaceChatDialog } from "@/components/app/collaboration-screens/workspace-chat-ui"
import {
  shouldRemoveLastWorkspaceChatRecipient,
  WorkspaceChatCreateFooter,
} from "@/components/app/collaboration-screens/workspace-chat-create-footer"
import { getTextInputLimitState } from "@/lib/domain/input-constraints"
import { useAppStore } from "@/lib/store/app-store"
import {
  createTestAppData,
  createTestTeamMembership,
  createTestUser,
} from "@/tests/lib/fixtures/app-data"

vi.mock("@/components/app/shortcut-keys", () => ({
  ShortcutKeys: () => null,
  useCommandEnterSubmit: vi.fn(),
  useShortcutModifierLabel: () => "Cmd",
}))

vi.mock("@/components/app/user-presence", () => ({
  UserAvatar: ({ name }: { name?: string }) => <span>{name ?? "Unknown"}</span>,
}))

vi.mock("@/components/ui/button", async () =>
  (await import("@/tests/lib/fixtures/component-stubs")).createButtonStubModule()
)

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: ReactNode
    open: boolean
    onOpenChange: (open: boolean) => void
  }) =>
    open ? (
      <div>
        {children}
        <button type="button" onClick={() => onOpenChange(false)}>
          Close dialog
        </button>
      </div>
    ) : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}))

vi.mock("@/components/ui/scroll-area", async () =>
  (
    await import("@/tests/lib/fixtures/component-stubs")
  ).createScrollAreaStubModule()
)

describe("Workspace chat creation UI", () => {
  const createWorkspaceChatMock = vi.fn()
  const currentUser = createTestUser({
    id: "user_current",
    name: "Current User",
  })
  const mayaUser = createTestUser({
    id: "user_maya",
    name: "Maya Patel",
    handle: "maya",
    email: "maya@example.com",
  })

  beforeEach(() => {
    createWorkspaceChatMock.mockReset()
    useAppStore.setState({
      ...createTestAppData({
        currentUserId: currentUser.id,
        users: [currentUser, mayaUser],
        teamMemberships: [
          createTestTeamMembership({ userId: currentUser.id }),
          createTestTeamMembership({ userId: mayaUser.id }),
        ],
      }),
      createWorkspaceChat: createWorkspaceChatMock as never,
    })
  })

  it("renders no footer until a participant is selected and then creates a direct chat", () => {
    const onCreated = vi.fn()
    const onOpenChange = vi.fn()
    createWorkspaceChatMock.mockReturnValue("chat_created")

    render(
      <CreateWorkspaceChatDialog
        open
        onOpenChange={onOpenChange}
        onCreated={onCreated}
      />
    )

    expect(screen.queryByRole("button", { name: /Start chat/ })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: /Maya Patel/ }))
    fireEvent.click(screen.getByRole("button", { name: /Start chat/ }))

    expect(createWorkspaceChatMock).toHaveBeenCalledWith({
      workspaceId: "workspace_1",
      participantIds: ["user_maya"],
      title: "",
      description: "",
    })
    expect(onCreated).toHaveBeenCalledWith("chat_created")
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("removes the selected recipient from explicit and keyboard actions", () => {
    render(
      <CreateWorkspaceChatDialog
        open
        onOpenChange={vi.fn()}
        onCreated={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /Maya Patel/ }))
    fireEvent.click(screen.getByRole("button", { name: "Remove Maya Patel" }))

    expect(screen.queryByRole("button", { name: /Start chat/ })).toBeNull()
    expect(
      shouldRemoveLastWorkspaceChatRecipient("Backspace", "", ["user_maya"])
    ).toBe(true)
    expect(
      shouldRemoveLastWorkspaceChatRecipient("Backspace", "m", ["user_maya"])
    ).toBe(false)
  })

  it("guards creation when the footer is disabled or the store returns no id", () => {
    const onCreated = vi.fn()
    const groupNameLimitState = getTextInputLimitState("Valid group", {
      min: 0,
      max: 4,
    })

    render(
      <>
        <WorkspaceChatCreateFooter
          groupNameLimitState={groupNameLimitState}
          isGroup
          participantCount={2}
          shortcutModifierLabel="Cmd"
          onCreate={vi.fn()}
        />
        <CreateWorkspaceChatDialog
          open
          onOpenChange={vi.fn()}
          onCreated={onCreated}
        />
      </>
    )

    expect(screen.getByRole("button", { name: /Create group/ })).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: /Maya Patel/ }))
    fireEvent.click(screen.getByRole("button", { name: /Start chat/ }))

    expect(createWorkspaceChatMock).toHaveBeenCalledTimes(1)
    expect(onCreated).not.toHaveBeenCalled()
  })
})
