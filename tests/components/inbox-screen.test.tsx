import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import { InboxScreen } from "@/components/app/screens/inbox-screen"
import { createEmptyState } from "@/lib/domain/empty-state"
import { useAppStore } from "@/lib/store/app-store"

const useScopedReadModelRefreshMock = vi.hoisted(() => vi.fn())

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

vi.mock("@/hooks/use-scoped-read-model-refresh", () => ({
  useScopedReadModelRefresh: useScopedReadModelRefreshMock,
}))

vi.mock("@/lib/convex/client", () => ({
  fetchNotificationInboxReadModel: vi.fn(),
  syncAcceptInvite: vi.fn(),
}))

vi.mock("@/components/app/screens/shared", () => ({
  ScreenHeader: ({ title }: { title: string }) => <div>{title}</div>,
}))

vi.mock("@/components/app/screens/inbox-ui", () => ({
  InboxListPane: () => <div>Inbox list</div>,
  InboxDetailPane: () => <div>Inbox detail</div>,
}))

vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: ({
    children,
  }: {
    children?: ReactNode
  }) => <div>{children}</div>,
}))

describe("InboxScreen", () => {
  beforeEach(() => {
    useScopedReadModelRefreshMock.mockReset()
    useAppStore.setState({
      ...createEmptyState(),
      currentUserId: "user_1",
    })
  })

  it("shows a loading state before the first inbox refresh completes", () => {
    useScopedReadModelRefreshMock.mockReturnValue({
      error: null,
      hasLoadedOnce: false,
      refreshing: true,
    })

    render(<InboxScreen />)

    expect(screen.getByText("Loading inbox...")).toBeInTheDocument()
    expect(screen.queryByText("Inbox list")).not.toBeInTheDocument()
    expect(screen.queryByText("Inbox detail")).not.toBeInTheDocument()
  })

  it("renders the inbox panes after the inbox read model has loaded", () => {
    useScopedReadModelRefreshMock.mockReturnValue({
      error: null,
      hasLoadedOnce: true,
      refreshing: false,
    })

    render(<InboxScreen />)

    expect(screen.getByText("Inbox list")).toBeInTheDocument()
    expect(screen.getByText("Inbox detail")).toBeInTheDocument()
    expect(screen.queryByText("Loading inbox...")).not.toBeInTheDocument()
  })
})
