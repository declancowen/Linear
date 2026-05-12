import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useRetainedTeamBySlug } from "@/hooks/use-retained-team-by-slug"
import { useAppStore } from "@/lib/store/app-store"
import {
  createTestAppData,
  createTestTeam,
  createTestWorkspace,
} from "@/tests/lib/fixtures/app-data"

function seedTeamState() {
  useAppStore.setState(createTestAppData({
    workspaces: [
      createTestWorkspace({
        slug: "workspace-1",
        name: "Workspace 1",
        workosOrganizationId: null,
        settings: {
          accent: "#000000",
          description: "",
        },
      }),
    ],
    teams: [
      createTestTeam({
        icon: "rocket",
        settings: {
          joinCode: "JOIN123",
          summary: "",
        },
      }),
    ],
  }))
}

function removeLiveTeams() {
  useAppStore.setState((state) => ({
    ...state,
    teams: [],
  }))
}

function expectRetainedTeam(
  result: { current: ReturnType<typeof useRetainedTeamBySlug> }
) {
  expect(result.current.liveTeam).toBeNull()
  expect(result.current.team?.id).toBe("team_1")
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

    act(removeLiveTeams)

    expectRetainedTeam(result)
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

    act(removeLiveTeams)

    expectRetainedTeam(result)

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(result.current.liveTeam).toBeNull()
    expect(result.current.team).toBeNull()
  })
})
