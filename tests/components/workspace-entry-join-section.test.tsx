import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { WorkspaceEntryJoinSection } from "@/components/app/workspace-entry-join-section"

vi.mock("@/components/app/accept-invite-card", () => ({
  AcceptInviteCard: ({
    workspaceName,
    teamNames,
  }: {
    workspaceName: string
    teamNames: string[]
  }) => (
    <div data-testid="accept-invite-card">
      {workspaceName}:{teamNames.join(",")}
    </div>
  ),
}))

vi.mock("@/components/app/join-workspace-panel", () => ({
  JoinWorkspacePanel: () => <div data-testid="join-workspace-panel" />,
}))

describe("WorkspaceEntryJoinSection", () => {
  it("hides stale invite batches that no longer resolve to any teams", () => {
    render(
      <WorkspaceEntryJoinSection
        joinedTeamIds={[]}
        pendingInvites={[
          {
            invite: {
              acceptedAt: null,
              email: "alex@example.com",
              id: "invite_valid",
              role: "member",
              token: "token_valid",
            },
            teamNames: ["Core"],
            workspace: {
              logoUrl: "",
              name: "Recipe Room",
            },
          },
          {
            invite: {
              acceptedAt: null,
              email: "alex@example.com",
              id: "invite_stale",
              role: "admin",
              token: "token_stale",
            },
            teamNames: [],
            workspace: {
              logoUrl: "",
              name: "Deleted Team Workspace",
            },
          },
        ]}
      />
    )

    expect(screen.getAllByTestId("accept-invite-card")).toHaveLength(1)
    expect(screen.getByText("Recipe Room:Core")).toBeInTheDocument()
    expect(
      screen.queryByText("Deleted Team Workspace:")
    ).not.toBeInTheDocument()
  })
})
