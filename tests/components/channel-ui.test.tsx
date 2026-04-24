import type { ButtonHTMLAttributes, ReactNode } from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { NewPostComposer } from "@/components/app/collaboration-screens/channel-ui"
import { createEmptyState } from "@/lib/domain/empty-state"
import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"

vi.mock("@/components/app/rich-text-editor", () => ({
  RichTextEditor: ({
    content,
    onChange,
    placeholder,
  }: {
    content: string
    onChange: (value: string) => void
    placeholder?: string
  }) => (
    <textarea
      aria-label={placeholder ?? "Rich text editor"}
      value={content}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}))

vi.mock("@/components/app/emoji-picker-popover", () => ({
  EmojiPickerPopover: ({ trigger }: { trigger: ReactNode }) => trigger,
}))

vi.mock("@/components/app/shortcut-keys", () => ({
  ShortcutKeys: () => null,
  useShortcutModifierLabel: () => "Cmd",
}))

vi.mock("@/components/app/user-presence", () => ({
  UserAvatar: () => <span>User</span>,
  UserHoverCard: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}))

vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: () => null,
}))

describe("NewPostComposer", () => {
  const createChannelPostMock = vi.fn()

  beforeEach(() => {
    createChannelPostMock.mockReset()
    useAppStore.setState({
      ...createEmptyState(),
      currentUserId: "user_1",
      currentWorkspaceId: "workspace_1",
      createChannelPost: createChannelPostMock as never,
      users: [
        {
          id: "user_1",
          name: "Alex",
          handle: "alex",
          email: "alex@example.com",
          avatarUrl: "",
          avatarImageUrl: null,
          workosUserId: null,
          title: "Founder",
          status: "active",
          statusMessage: "",
          hasExplicitStatus: false,
          preferences: {
            emailMentions: true,
            emailAssignments: true,
            emailDigest: true,
            theme: "system",
          },
        },
      ],
      conversations: [
        {
          id: "channel_1",
          kind: "channel",
          scopeType: "team",
          scopeId: "team_1",
          variant: "group",
          title: "Announcements",
          description: "",
          participantIds: ["user_1"],
          roomId: null,
          roomName: null,
          createdBy: "user_1",
          createdAt: "2026-04-18T10:00:00.000Z",
          updatedAt: "2026-04-18T10:00:00.000Z",
          lastActivityAt: "2026-04-18T10:00:00.000Z",
        },
      ],
      teams: [
        {
          id: "team_1",
          workspaceId: "workspace_1",
          slug: "platform",
          name: "Platform",
          icon: "robot",
          settings: {
            joinCode: "JOIN1234",
            summary: "Platform team",
            guestProjectIds: [],
            guestDocumentIds: [],
            guestWorkItemIds: [],
            experience: "software-development",
            features: createDefaultTeamFeatureSettings("software-development"),
            workflow: createDefaultTeamWorkflowSettings("software-development"),
          },
        },
      ],
      teamMemberships: [
        {
          teamId: "team_1",
          userId: "user_1",
          role: "admin",
        },
      ],
      workspaces: [
        {
          id: "workspace_1",
          slug: "workspace-1",
          name: "Workspace 1",
          logoUrl: "",
          logoImageUrl: null,
          createdBy: "user_1",
          workosOrganizationId: null,
          settings: {
            accent: "#000000",
            description: "",
          },
        },
      ],
      workspaceMemberships: [],
    })
  })

  afterEach(() => {
    useAppStore.setState(createEmptyState())
  })

  it("keeps post submit disabled until the shared minimum plain-text length is met", () => {
    render(<NewPostComposer channelId="channel_1" />)

    act(() => {
      fireEvent.click(
        screen.getByRole("button", {
          name: /Start a new thread/,
        })
      )
    })

    const editor = screen.getByLabelText(
      "Write something the whole channel can read and reply to…"
    )
    const button = screen.getByRole("button", { name: "Post" })

    act(() => {
      fireEvent.change(editor, {
        target: {
          value: "a",
        },
      })
    })

    expect(button).toBeDisabled()
    expect(screen.getByText("Enter at least 2 characters")).toBeInTheDocument()

    act(() => {
      fireEvent.change(editor, {
        target: {
          value: "ab",
        },
      })
    })

    expect(button).toBeEnabled()
  })
})
