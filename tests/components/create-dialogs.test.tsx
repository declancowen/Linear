import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import { CreateProjectDialog } from "@/components/app/screens/project-creation"
import { CreateWorkItemDialog } from "@/components/app/screens/create-work-item-dialog"
import { createEmptyState } from "@/lib/domain/empty-state"
import {
  createDefaultTeamFeatureSettings,
  createDefaultTeamWorkflowSettings,
} from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"

describe("create dialogs", () => {
  beforeEach(() => {
    useAppStore.setState({
      ...createEmptyState(),
      currentUserId: "user_1",
      currentWorkspaceId: "workspace_1",
      labels: [
        {
          id: "label_1",
          workspaceId: "workspace_1",
          name: "Platform",
          color: "blue",
        },
      ],
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
      teams: [
        {
          id: "team_1",
          workspaceId: "workspace_1",
          slug: "platform",
          name: "Platform",
          icon: "code",
          settings: {
            joinCode: "JOIN1234",
            summary: "",
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
      projects: [],
    })
  })

  afterEach(() => {
    useAppStore.setState(createEmptyState())
  })

  it("renders the work-item create dialog without recursive store updates", () => {
    render(
      <CreateWorkItemDialog
        open
        onOpenChange={vi.fn()}
        defaultTeamId="team_1"
        initialType="epic"
      />
    )

    expect(screen.getAllByText("Platform").length).toBeGreaterThan(0)
    expect(screen.getByPlaceholderText("Epic title")).toBeInTheDocument()
  })

  it("renders the project create dialog without recursive store updates", () => {
    render(
      <CreateProjectDialog
        open
        onOpenChange={vi.fn()}
        defaultTeamId="team_1"
      />
    )

    expect(screen.getAllByText("Platform").length).toBeGreaterThan(0)
    expect(screen.getByPlaceholderText("Project name")).toBeInTheDocument()
  })
})
