import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import { ChatThread } from "@/components/app/collaboration-screens/chat-thread"
import { createEmptyState } from "@/lib/domain/empty-state"
import { useAppStore } from "@/lib/store/app-store"

vi.mock("@/components/app/rich-text-editor", () => ({
  RichTextEditor: ({ placeholder }: { placeholder?: string }) => (
    <div data-testid="mock-rich-text-editor">{placeholder}</div>
  ),
}))

vi.mock("@/components/app/emoji-picker-popover", () => ({
  EmojiPickerPopover: ({ trigger }: { trigger: ReactNode }) => <>{trigger}</>,
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
  avatarUrl: "",
  avatarImageUrl: null,
  workosUserId: null,
  title: "Product Owner",
  status: "out-of-office" as const,
  statusMessage: "Away",
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
    users: [currentUser, formerUser],
    conversations: [
      {
        id: "conversation_1",
        kind: "chat",
        scopeType: "workspace",
        scopeId: "workspace_1",
        variant: "direct",
        title: "Declan Cowen",
        description: "",
        participantIds: [currentUser.id, formerUser.id],
        roomId: null,
        roomName: null,
        createdBy: currentUser.id,
        createdAt: "2026-04-15T12:00:00.000Z",
        updatedAt: "2026-04-15T12:00:00.000Z",
        lastActivityAt: "2026-04-15T12:00:00.000Z",
      },
    ],
    chatMessages: [],
  })
})

describe("ChatThread", () => {
  it("hides the composer when the other participants have left the workspace", () => {
    render(
      <ChatThread
        conversationId="conversation_1"
        title="Declan Cowen"
        description=""
        members={[currentUser, formerUser]}
      />
    )

    expect(
      screen.getByText(
        "This chat is read-only because the other participants have left the workspace or deleted their account."
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId("mock-rich-text-editor")
    ).not.toBeInTheDocument()
  })
})
