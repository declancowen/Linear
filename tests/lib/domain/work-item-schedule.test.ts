import { describe, expect, it } from "vitest"

import {
  getViewerWallTimeForScheduleDate,
  resolveWorkItemSchedule,
} from "@/lib/domain/work-item-schedule"

describe("work item schedule helpers", () => {
  it("renders timed work from the schedule timezone into the viewer timezone", () => {
    const schedule = resolveWorkItemSchedule(
      {
        startDate: "2026-05-19",
        targetDate: "2026-05-19",
        startTime: "15:00",
        endTime: "16:00",
        scheduleTimeZone: "Europe/London",
      },
      "Asia/Kolkata"
    )

    expect(schedule.kind).toBe("timed")
    if (schedule.kind !== "timed") {
      return
    }

    expect(getViewerWallTimeForScheduleDate(schedule.start, "Asia/Kolkata")).toEqual({
      date: "2026-05-19",
      time: "19:30",
    })
    expect(getViewerWallTimeForScheduleDate(schedule.end, "Asia/Kolkata")).toEqual({
      date: "2026-05-19",
      time: "20:30",
    })
  })

  it("keeps date-only and multi-day work in the all-day lane", () => {
    expect(
      resolveWorkItemSchedule(
        {
          startDate: "2026-05-18",
          targetDate: "2026-05-20",
          scheduleTimeZone: "Europe/London",
        },
        "Asia/Kolkata"
      )
    ).toEqual({
      kind: "all-day",
      startDate: "2026-05-18",
      endDate: "2026-05-20",
    })

    expect(
      resolveWorkItemSchedule(
        {
          startDate: "2026-05-19",
          dueDate: "2026-05-19",
          startTime: "09:00",
          scheduleTimeZone: "Europe/London",
        },
        "Asia/Kolkata"
      )
    ).toEqual({
      kind: "all-day",
      startDate: "2026-05-19",
      endDate: "2026-05-19",
    })
  })
})
