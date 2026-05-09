import { describe, expect, it } from "vitest"

import {
  applyViewConfigPatch,
  canEditDocumentInUi,
  getContainerItemsForDisplay,
  isPersistedViewFilterKey,
} from "@/components/app/screens/helpers"
import { getNextFallbackPresenceSessionState } from "@/components/app/screens/presence-session"
import {
  buildTimelineResizePatch,
  buildTimelineWeeks,
  getTimelineMovePatchForDrag,
  getTimelineRange,
} from "@/components/app/screens/work-surface-view/timeline-state"
import { createDefaultViewFilters } from "@/lib/domain/types"
import {
  createTestAppData,
  createTestDocument,
  createTestWorkItem,
} from "@/tests/lib/fixtures/app-data"

describe("screen helpers", () => {
  it("treats all persisted view filter keys as persistable", () => {
    expect(isPersistedViewFilterKey("status")).toBe(true)
    expect(isPersistedViewFilterKey("priority")).toBe(true)
    expect(isPersistedViewFilterKey("assigneeIds")).toBe(true)
    expect(isPersistedViewFilterKey("creatorIds")).toBe(true)
    expect(isPersistedViewFilterKey("leadIds")).toBe(true)
    expect(isPersistedViewFilterKey("health")).toBe(true)
    expect(isPersistedViewFilterKey("milestoneIds")).toBe(true)
    expect(isPersistedViewFilterKey("relationTypes")).toBe(true)
    expect(isPersistedViewFilterKey("projectIds")).toBe(true)
    expect(isPersistedViewFilterKey("parentIds")).toBe(true)
    expect(isPersistedViewFilterKey("itemTypes")).toBe(true)
    expect(isPersistedViewFilterKey("labelIds")).toBe(true)
    expect(isPersistedViewFilterKey("teamIds")).toBe(true)
  })

  it("collapses subgroup child containers against the full visible item set", () => {
    const parent = createTestWorkItem("parent", {
      type: "feature",
      status: "todo",
      subscriberIds: [],
    })
    const child = createTestWorkItem("child", {
      type: "requirement",
      parentId: parent.id,
      status: "in-progress",
      subscriberIds: [],
    })

    expect(getContainerItemsForDisplay([child], [parent, child], true)).toEqual(
      []
    )
    expect(getContainerItemsForDisplay([child], [child], true)).toEqual([child])
  })

  it("keeps fallback presence sessions stable until the user identity changes", () => {
    const initial = getNextFallbackPresenceSessionState(null, null)
    const claimed = getNextFallbackPresenceSessionState(initial, "user_1")
    const unchanged = getNextFallbackPresenceSessionState(claimed, "user_1")
    const replaced = getNextFallbackPresenceSessionState(claimed, "user_2")

    expect(initial.userId).toBeNull()
    expect(claimed).toEqual({
      ...initial,
      userId: "user_1",
    })
    expect(unchanged).toBe(claimed)
    expect(replaced).toMatchObject({
      userId: "user_2",
    })
    expect(replaced.sessionId).not.toBe(claimed.sessionId)
  })

  it("applies view config patches without dropping existing filters", () => {
    const current = {
      layout: "list" as const,
      grouping: "status" as const,
      subGrouping: null,
      filters: {
        ...createDefaultViewFilters(),
        showCompleted: false,
        status: ["todo" as const],
      },
    }

    expect(
      applyViewConfigPatch(current, {
        layout: "board",
        grouping: "priority",
        subGrouping: "assignee",
        ordering: "updatedAt",
        itemLevel: "feature",
        showChildItems: true,
        showCompleted: true,
      })
    ).toMatchObject({
      layout: "board",
      grouping: "priority",
      subGrouping: "assignee",
      ordering: "updatedAt",
      itemLevel: "feature",
      showChildItems: true,
      filters: {
        status: ["todo"],
        showCompleted: true,
      },
    })
  })

  it("keeps document editability owned by document kind and membership", () => {
    const data = createTestAppData()

    expect(
      canEditDocumentInUi(
        data,
        createTestDocument({ kind: "item-description" })
      )
    ).toBe(false)
    expect(
      canEditDocumentInUi(
        data,
        createTestDocument({ kind: "team-document", teamId: "team_1" })
      )
    ).toBe(true)
    expect(
      canEditDocumentInUi(
        data,
        createTestDocument({ kind: "team-document", teamId: null })
      )
    ).toBe(false)
    expect(
      canEditDocumentInUi(
        data,
        createTestDocument({ kind: "private-document", createdBy: "user_1" })
      )
    ).toBe(true)
    expect(
      canEditDocumentInUi(
        data,
        createTestDocument({ kind: "private-document", createdBy: "other" })
      )
    ).toBe(false)
    expect(
      canEditDocumentInUi(
        data,
        createTestDocument({
          kind: "workspace-document",
          workspaceId: "workspace_1",
        })
      )
    ).toBe(true)
    expect(
      canEditDocumentInUi(
        data,
        createTestDocument({
          kind: "workspace-document",
          workspaceId: "",
        })
      )
    ).toBe(false)
  })

  it("builds timeline date ranges and update patches in calendar-day space", () => {
    const fallback = new Date("2026-05-05T12:00:00.000Z")
    const item = createTestWorkItem("scheduled", {
      startDate: "2026-05-01T00:00:00.000Z",
      dueDate: "2026-05-03T00:00:00.000Z",
      targetDate: "2026-05-04T00:00:00.000Z",
    })

    expect(getTimelineRange(item, fallback)).toMatchObject({
      startDate: new Date("2026-05-01T00:00:00.000"),
      endDate: new Date("2026-05-04T00:00:00.000"),
    })
    expect(
      getTimelineRange(
        createTestWorkItem("inverted", {
          startDate: "2026-05-04T00:00:00.000Z",
          dueDate: "2026-05-02T00:00:00.000Z",
          targetDate: null,
        }),
        fallback
      )
    ).toMatchObject({
      startDate: new Date("2026-05-04T00:00:00.000"),
      endDate: new Date("2026-05-04T00:00:00.000"),
    })
    expect(
      getTimelineMovePatchForDrag({
        activeId: item.id,
        data: createTestAppData({ workItems: [item] }),
        dragOffset: null,
        editable: true,
        overId: `timeline::${item.id}::2026-05-06T00:00:00.000Z`,
        timelineStart: fallback,
      })
    ).toEqual({
      itemId: item.id,
      patch: {
        startDate: "2026-05-06T00:00:00.000Z",
        dueDate: "2026-05-08T00:00:00.000Z",
        targetDate: "2026-05-09T00:00:00.000Z",
      },
    })
    expect(
      buildTimelineResizePatch(
        createTestWorkItem("target-only", {
          dueDate: null,
          targetDate: null,
        }),
        new Date("2026-05-02T00:00:00.000"),
        new Date("2026-05-07T00:00:00.000")
      )
    ).toEqual({
      startDate: "2026-05-02T00:00:00.000Z",
      dueDate: undefined,
      targetDate: "2026-05-07T00:00:00.000Z",
    })
  })

  it("groups timeline header days into week spans", () => {
    expect(
      buildTimelineWeeks([
        new Date("2026-05-05T00:00:00.000"),
        new Date("2026-05-06T00:00:00.000"),
      ])
    ).toEqual([{ label: "May 5 – May 6", span: 2 }])
    expect(
      buildTimelineWeeks([
        new Date("2026-05-09T00:00:00.000"),
        new Date("2026-05-10T00:00:00.000"),
      ])
    ).toEqual([
      { label: "May 9 – May 9", span: 1 },
      { label: "May 10 – May 10", span: 1 },
    ])
  })
})
