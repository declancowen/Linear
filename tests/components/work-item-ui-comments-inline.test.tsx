import type { ButtonHTMLAttributes, ReactNode } from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CommentsInline } from "@/components/app/screens/work-item-ui"
import { createEmptyState } from "@/lib/domain/empty-state"
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

describe("CommentsInline", () => {
  const consoleErrorSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined)

  beforeEach(() => {
    useAppStore.setState({
      ...createEmptyState(),
      currentUserId: "user_1",
      currentWorkspaceId: "workspace_1",
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
        {
          id: "user_2",
          name: "Taylor",
          handle: "taylor",
          email: "taylor@example.com",
          avatarUrl: "",
          avatarImageUrl: null,
          workosUserId: null,
          title: "Engineer",
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
      teamMemberships: [
        {
          teamId: "team_1",
          userId: "user_1",
          role: "admin",
        },
        {
          teamId: "team_1",
          userId: "user_2",
          role: "member",
        },
      ],
      workItems: [
        {
          id: "item_1",
          key: "TES-1",
          teamId: "team_1",
          type: "task",
          title: "Test item",
          descriptionDocId: "document_1",
          status: "todo",
          priority: "medium",
          assigneeId: null,
          creatorId: "user_1",
          parentId: null,
          primaryProjectId: null,
          linkedProjectIds: [],
          linkedDocumentIds: [],
          labelIds: [],
          milestoneId: null,
          startDate: null,
          dueDate: null,
          targetDate: null,
          subscriberIds: [],
          createdAt: "2026-04-18T10:00:00.000Z",
          updatedAt: "2026-04-18T10:00:00.000Z",
        },
      ],
      documents: [
        {
          id: "document_1",
          kind: "item-description",
          workspaceId: "workspace_1",
          teamId: "team_1",
          title: "Test item",
          content: "<p>Test</p>",
          linkedProjectIds: [],
          linkedWorkItemIds: ["item_1"],
          createdBy: "user_1",
          updatedBy: "user_1",
          createdAt: "2026-04-18T10:00:00.000Z",
          updatedAt: "2026-04-18T10:00:00.000Z",
        },
      ],
    })
    consoleErrorSpy.mockClear()
  })

  afterEach(() => {
    useAppStore.setState(createEmptyState())
  })

  afterAll(() => {
    consoleErrorSpy.mockRestore()
  })

  it("renders without snapshot loop warnings for work item comments", () => {
    const { rerender } = render(
      <CommentsInline targetType="workItem" targetId="item_1" editable />
    )

    expect(
      screen.getByLabelText(
        "Leave a comment or mention a teammate with @handle..."
      )
    ).toBeInTheDocument()

    act(() => {
      useAppStore.setState((state) => ({
        ...state,
        ui: {
          ...state.ui,
          selectedViewByRoute: {
            ...state.ui.selectedViewByRoute,
            "/items/item_1": "details",
          },
        },
      }))
    })

    rerender(<CommentsInline targetType="workItem" targetId="item_1" editable />)

    const errorMessages = consoleErrorSpy.mock.calls
      .flat()
      .map((value) => String(value))
      .join("\n")

    expect(errorMessages).not.toContain(
      "The result of getSnapshot should be cached"
    )
    expect(errorMessages).not.toContain("Maximum update depth exceeded")
  })

  it("disables comment submit until the shared minimum plain-text length is met", () => {
    render(<CommentsInline targetType="workItem" targetId="item_1" editable />)

    const editor = screen.getByLabelText(
      "Leave a comment or mention a teammate with @handle..."
    )
    const button = screen.getByRole("button", { name: "Comment" })

    fireEvent.change(editor, {
      target: {
        value: "a",
      },
    })

    expect(button).toBeDisabled()
    expect(screen.getByText("Enter at least 2 characters")).toBeInTheDocument()

    fireEvent.change(editor, {
      target: {
        value: "ab",
      },
    })

    expect(button).toBeEnabled()
  })
})
