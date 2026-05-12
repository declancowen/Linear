import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { InboxDetailPane } from "@/components/app/screens/inbox-ui"
import { InboxRowAvatar } from "@/components/app/screens/inbox-display"
import { InboxRow } from "@/components/app/screens/inbox-row"
import { TooltipProvider } from "@/components/ui/tooltip"
import { createTestUser } from "@/tests/lib/fixtures/app-data"

vi.mock("@/components/app/user-presence", () => ({
  UserAvatar: ({ name }: { name?: string }) => <span>{name ?? "Someone"}</span>,
}))

function createNotification(overrides = {}) {
  return {
    id: "notification_1",
    userId: "user_1",
    type: "comment",
    entityType: "workItem",
    entityId: "item_1",
    actorId: "user_2",
    message: "Maya commented on Test item",
    readAt: null,
    archivedAt: null,
    emailedAt: null,
    createdAt: "2026-04-18T10:00:00.000Z",
    ...overrides,
  } as never
}

describe("Inbox row primitives", () => {
  it("renders unread rows and routes row actions through callbacks", () => {
    const onSelect = vi.fn()
    const onToggleArchive = vi.fn()
    const actor = createTestUser({
      id: "user_2",
      name: "Maya",
    })

    render(
      <TooltipProvider>
        <InboxRow
          active
          entry={{
            actor,
            notification: createNotification(),
          }}
          onSelect={onSelect}
          onToggleArchive={onToggleArchive}
        />
      </TooltipProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: /Maya/ }))
    fireEvent.click(screen.getByRole("button", { name: "Archive notification" }))

    expect(screen.getAllByText("Maya")).toHaveLength(2)
    expect(screen.getByText("Commented on Test item")).toBeInTheDocument()
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onToggleArchive).toHaveBeenCalledTimes(1)
  })

  it("renders fallback avatars for archived notifications without actors", () => {
    render(
      <InboxRowAvatar
        actor={null}
        actorName="Someone"
        notification={createNotification({
          archivedAt: "2026-04-19T10:00:00.000Z",
          entityType: "chat",
          readAt: "2026-04-19T10:00:00.000Z",
        })}
      />
    )

    expect(screen.getByText("Someone")).toBeInTheDocument()
  })

  it("renders active detail panes and routes toolbar actions", () => {
    const onToggleArchive = vi.fn()
    const onToggleRead = vi.fn()
    const onDelete = vi.fn()
    const actor = createTestUser({
      id: "user_2",
      name: "Maya",
    })

    render(
      <TooltipProvider>
        <InboxDetailPane
          acceptingInvite={false}
          activeChannelPostHref={null}
          activeChatHref={null}
          activeEntry={{
            actor,
            notification: createNotification(),
          }}
          activeProjectHref={null}
          hasPendingActiveInvite={false}
          visibleNotificationCount={1}
          onAcceptInvite={vi.fn()}
          onDelete={onDelete}
          onToggleArchive={onToggleArchive}
          onToggleRead={onToggleRead}
        />
      </TooltipProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "Mark as read" }))
    fireEvent.click(screen.getByRole("button", { name: "Archive notification" }))
    fireEvent.click(screen.getByRole("button", { name: "Delete notification" }))

    expect(screen.getByText("Work item")).toBeInTheDocument()
    expect(screen.getByText("Unread")).toBeInTheDocument()
    expect(screen.getAllByText("Maya")).toHaveLength(2)
    expect(screen.getByText("Maya commented on Test item")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open work item" })).toHaveAttribute(
      "href",
      "/items/item_1"
    )
    expect(onToggleRead).toHaveBeenCalledWith(
      expect.objectContaining({ id: "notification_1" })
    )
    expect(onToggleArchive).toHaveBeenCalledWith(
      expect.objectContaining({ id: "notification_1" })
    )
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it("renders invite detail actions for read notifications without actors", () => {
    const onAcceptInvite = vi.fn()
    const onToggleRead = vi.fn()

    render(
      <TooltipProvider>
        <InboxDetailPane
          acceptingInvite={false}
          activeChannelPostHref={null}
          activeChatHref={null}
          activeEntry={{
            actor: null,
            notification: createNotification({
              archivedAt: "2026-04-19T10:00:00.000Z",
              entityId: "invite_1",
              entityType: "invite",
              message: "Maya invited you to Ops",
              readAt: "2026-04-19T10:00:00.000Z",
            }),
          }}
          activeProjectHref={null}
          hasPendingActiveInvite
          visibleNotificationCount={1}
          onAcceptInvite={onAcceptInvite}
          onDelete={vi.fn()}
          onToggleArchive={vi.fn()}
          onToggleRead={onToggleRead}
        />
      </TooltipProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "Mark as unread" }))
    fireEvent.click(screen.getByRole("button", { name: "Accept invite" }))

    expect(screen.getByText("Invite")).toBeInTheDocument()
    expect(screen.getAllByText("Someone")).toHaveLength(2)
    expect(screen.queryByText("Unread")).not.toBeInTheDocument()
    expect(onToggleRead).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: "invite" })
    )
    expect(onAcceptInvite).toHaveBeenCalledTimes(1)
  })
})
