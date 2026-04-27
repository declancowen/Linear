import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useRetainedTeamBySlug } from "@/hooks/use-retained-team-by-slug"
import { createEmptyState } from "@/lib/domain/empty-state"
import { createDefaultTeamWorkflowSettings } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"

function seedTeamState() {
  useAppStore.setState({
    ...createEmptyState(),
    currentWorkspaceId: "workspace_1",
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
    teams: [
      {
        id: "team_1",
        workspaceId: "workspace_1",
        slug: "platform",
        name: "Platform",
        icon: "rocket",
        settings: {
          joinCode: "JOIN123",
          summary: "",
          guestProjectIds: [],
          guestDocumentIds: [],
          guestWorkItemIds: [],
          experience: "software-development",
          features: {
            issues: true,
            projects: true,
            docs: true,
            chat: true,
            channels: true,
            views: true,
          },
          workflow: createDefaultTeamWorkflowSettings("software-development"),
        },
      },
    ],
  })
}

describe("useRetainedTeamBySlug", () => {
  beforeEach(() => {
    seedTeamState()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("retains the last resolved team while the live team entry is temporarily missing", () => {
    const { result } = renderHook(() => useRetainedTeamBySlug("platform"))

    expect(result.current.liveTeam?.id).toBe("team_1")
    expect(result.current.team?.id).toBe("team_1")

    act(() => {
      useAppStore.setState((state) => ({
        ...state,
        teams: [],
      }))
    })

    expect(result.current.liveTeam).toBeNull()
    expect(result.current.team?.id).toBe("team_1")
  })

  it("does not reuse a retained team for a different slug", () => {
    const { result, rerender } = renderHook(
      ({ teamSlug }: { teamSlug: string }) => useRetainedTeamBySlug(teamSlug),
      {
        initialProps: {
          teamSlug: "platform",
        },
      }
    )

    expect(result.current.team?.id).toBe("team_1")

    rerender({
      teamSlug: "other-team",
    })

    expect(result.current.liveTeam).toBeNull()
    expect(result.current.team).toBeNull()
  })

  it("expires a retained team after the grace window when the live team does not return", () => {
    vi.useFakeTimers()

    const { result } = renderHook(() => useRetainedTeamBySlug("platform"))

    expect(result.current.team?.id).toBe("team_1")

    act(() => {
      useAppStore.setState((state) => ({
        ...state,
        teams: [],
      }))
    })

    expect(result.current.liveTeam).toBeNull()
    expect(result.current.team?.id).toBe("team_1")

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(result.current.liveTeam).toBeNull()
    expect(result.current.team).toBeNull()
  })
})
