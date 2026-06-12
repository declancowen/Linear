import { describe, expect, it } from "vitest"

import {
  getTeamDashboardCompletion,
  getTeamDashboardProjectProgress,
  getTeamDashboardStatusBreakdown,
} from "@/lib/domain/selectors-internal/team-dashboard"
import type { WorkItem, WorkItemType, WorkStatus } from "@/lib/domain/types"

function item(type: WorkItemType, status: WorkStatus): WorkItem {
  return { type, status } as WorkItem
}

function projectItem(
  primaryProjectId: string | null,
  status: WorkStatus
): WorkItem {
  return { type: "task", status, primaryProjectId } as WorkItem
}

describe("getTeamDashboardCompletion", () => {
  it("excludes cancelled and duplicate from the denominator", () => {
    const completion = getTeamDashboardCompletion([
      item("task", "done"),
      item("task", "in-progress"),
      item("task", "cancelled"),
      item("task", "duplicate"),
    ])

    // 2 actionable (done + in-progress), 1 done => 50%, 2 excluded.
    expect(completion.overall).toEqual({
      total: 2,
      completed: 1,
      excluded: 2,
      percent: 50,
    })
  })

  it("reports completion per type in canonical order and omits empty types", () => {
    const completion = getTeamDashboardCompletion([
      item("epic", "done"),
      item("task", "done"),
      item("task", "todo"),
    ])

    expect(completion.byType.map((entry) => entry.type)).toEqual([
      "epic",
      "task",
    ])
    expect(completion.byType[0]).toMatchObject({ percent: 100 })
    expect(completion.byType[1]).toMatchObject({ percent: 50 })
  })

  it("returns 0 percent when there is nothing actionable", () => {
    expect(
      getTeamDashboardCompletion([item("task", "cancelled")]).overall.percent
    ).toBe(0)
  })
})

describe("getTeamDashboardStatusBreakdown", () => {
  it("counts items per status in canonical order, omitting empty statuses", () => {
    const breakdown = getTeamDashboardStatusBreakdown([
      item("task", "in-progress"),
      item("task", "in-progress"),
      item("issue", "backlog"),
    ])

    expect(breakdown).toEqual([
      { status: "backlog", count: 1 },
      { status: "in-progress", count: 2 },
    ])
  })
})

describe("getTeamDashboardProjectProgress", () => {
  it("computes completion per project from primary-project items, in project order", () => {
    const progress = getTeamDashboardProjectProgress(
      [
        { id: "project_a", name: "Alpha" },
        { id: "project_b", name: "Beta" },
      ],
      [
        projectItem("project_a", "done"),
        projectItem("project_a", "todo"),
        projectItem("project_a", "cancelled"),
        projectItem("project_b", "todo"),
        projectItem(null, "done"),
      ]
    )

    expect(progress.map((entry) => entry.name)).toEqual(["Alpha", "Beta"])
    // Alpha: 2 actionable, 1 done => 50% (cancelled excluded).
    expect(progress[0]?.completion).toMatchObject({ percent: 50, excluded: 1 })
    // Beta: 1 actionable, 0 done => 0%.
    expect(progress[1]?.completion).toMatchObject({ percent: 0, total: 1 })
  })
})
