import type { ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ReactionUsersHoverCard } from "@/components/app/reaction-users-hover-card"
import { createTestUser } from "@/tests/lib/fixtures/app-data"

vi.mock("@/components/ui/hover-card", () => ({
  HoverCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  HoverCardTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  HoverCardContent: ({
    children,
    className,
  }: {
    children: ReactNode
    className?: string
  }) => (
    <div className={className} data-testid="reaction-users-popup">
      {children}
    </div>
  ),
}))

describe("ReactionUsersHoverCard", () => {
  it("renders compact avatar and display-name rows for reaction users", () => {
    const taylor = createTestUser({
      id: "user_taylor",
      name: "Taylor Reed",
      avatarUrl: "https://example.com/taylor.png",
    })
    const usersById = new Map([[taylor.id, taylor]])
    const { container } = render(
      <ReactionUsersHoverCard
        userIds={[taylor.id, "user_missing", taylor.id]}
        usersById={usersById}
      >
        <button type="button">👍 2</button>
      </ReactionUsersHoverCard>
    )

    expect(screen.getByRole("button", { name: "👍 2" })).toBeInTheDocument()
    expect(screen.getByTestId("reaction-users-popup")).toHaveClass("w-48")
    expect(screen.getByText("Taylor Reed")).toBeInTheDocument()
    expect(screen.getByText("Unknown user")).toBeInTheDocument()
    expect(container.querySelectorAll('[data-slot="avatar"]')).toHaveLength(2)
  })
})
