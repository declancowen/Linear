import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import { WorkspaceUsersList } from "@/components/app/settings-screens/member-management"

vi.mock("@/components/app/user-presence", () => ({
  UserAvatar: ({ name }: { name: string }) => <div>{name}</div>,
}))

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

describe("WorkspaceUsersList", () => {
  it("shows team admins as protected and hides the remove action", () => {
    render(
      <WorkspaceUsersList
        canManage
        onRemove={vi.fn()}
        members={[
          {
            id: "user_team_admin",
            name: "Team Admin",
            email: "team-admin@example.com",
            title: "Lead",
            avatarUrl: "",
            avatarImageUrl: null,
            status: "active",
            isOwner: false,
            isWorkspaceAdmin: false,
            isTeamAdmin: true,
            isCurrentUser: false,
            teamNames: ["Core"],
          },
          {
            id: "user_member",
            name: "Workspace Member",
            email: "member@example.com",
            title: "Engineer",
            avatarUrl: "",
            avatarImageUrl: null,
            status: "active",
            isOwner: false,
            isWorkspaceAdmin: false,
            isTeamAdmin: false,
            isCurrentUser: false,
            teamNames: ["Core"],
          },
        ]}
      />
    )

    expect(screen.getByText("Team admin")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(1)
  })
})
