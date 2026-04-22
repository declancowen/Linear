import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: ComponentPropsWithoutRef<"button"> & { children?: ReactNode }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/app/user-presence", () => ({
  UserAvatar: ({ name }: { name: string }) => <div>{name}</div>,
}))

vi.mock("@phosphor-icons/react", () => {
  const Icon = () => null

  return {
    Archive: Icon,
    ArrowCounterClockwise: Icon,
    Bell: Icon,
    Buildings: Icon,
    ChatCircle: Icon,
    CheckCircle: Icon,
    Circle: Icon,
    EnvelopeSimple: Icon,
    FileText: Icon,
    Hash: Icon,
    Kanban: Icon,
    Target: Icon,
    Trash: Icon,
    UsersThree: Icon,
  }
})

import {
  InboxDetailPane,
  type InboxEntry,
} from "@/components/app/screens/inbox-ui"
import { type Notification, type UserProfile } from "@/lib/domain/types"

function createNotification(overrides?: Partial<Notification>): Notification {
  return {
    id: "notification_1",
    userId: "user_1",
    type: "mention",
    entityType: "team",
    entityId: "team_1",
    actorId: "user_2",
    message: "Someone mentioned you",
    readAt: null,
    archivedAt: null,
    emailedAt: null,
    createdAt: "2026-04-21T11:59:30.000Z",
    ...overrides,
  }
}

function createActor(overrides?: Partial<UserProfile>): UserProfile {
  return {
    id: "user_2",
    name: "Alex",
    handle: "alex",
    email: "alex@example.com",
    avatarUrl: "",
    avatarImageUrl: null,
    workosUserId: null,
    title: "Engineer",
    status: "offline",
    statusMessage: "",
    preferences: {
      emailMentions: true,
      emailAssignments: true,
      emailDigest: true,
      theme: "system",
    },
    ...overrides,
  }
}

function renderDetailPane(entry: InboxEntry) {
  render(
    <InboxDetailPane
      activeEntry={entry}
      visibleNotificationCount={1}
      activeProjectHref={null}
      activeChannelPostHref={null}
      activeChatHref={null}
      hasPendingActiveInvite={false}
      acceptingInvite={false}
      onAcceptInvite={() => undefined}
      onToggleArchive={() => undefined}
      onToggleRead={() => undefined}
      onDelete={() => undefined}
    />
  )
}

describe("InboxDetailPane", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders "now" without an "ago" suffix for recent notifications', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-04-21T12:00:00.000Z"))

    renderDetailPane({
      notification: createNotification({
        createdAt: "2026-04-21T11:59:30.000Z",
      }),
      actor: createActor(),
    })

    expect(screen.getByText("now")).toBeInTheDocument()
    expect(screen.queryByText("now ago")).not.toBeInTheDocument()
  })

  it("renders dated timestamps without an extra relative suffix", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-04-28T12:00:00.000Z"))

    renderDetailPane({
      notification: createNotification({
        createdAt: "2026-04-20T10:00:00.000Z",
      }),
      actor: createActor(),
    })

    expect(screen.getByText("Apr 20")).toBeInTheDocument()
    expect(screen.queryByText("Apr 20 ago")).not.toBeInTheDocument()
  })

  it("keeps sub-hour values in minutes until the hour boundary", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-04-21T12:00:00.000Z"))

    renderDetailPane({
      notification: createNotification({
        createdAt: "2026-04-21T11:00:30.000Z",
      }),
      actor: createActor(),
    })

    expect(screen.getByText("59m ago")).toBeInTheDocument()
    expect(screen.queryByText("1h ago")).not.toBeInTheDocument()
  })
})
