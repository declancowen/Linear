import { describe, expect, it } from "vitest"

import {
  formatWorkItemDetailDate,
  formatWorkSurfaceDueDate,
  formatWorkSurfaceTimestamp,
} from "@/components/app/screens/date-presentation"

describe("screen date presentation helpers", () => {
  const now = new Date("2026-04-21T09:00:00.000Z")

  it("formats work-surface due dates without the year in the current year", () => {
    expect(formatWorkSurfaceDueDate("2026-04-23T00:00:00.000Z", now)).toBe(
      "Due 23 April"
    )
  })

  it("adds the year to work-surface due dates outside the current year", () => {
    expect(formatWorkSurfaceDueDate("2027-04-23T00:00:00.000Z", now)).toBe(
      "Due 23 April 2027"
    )
  })

  it("adds the year to created and updated labels only for earlier years", () => {
    expect(
      formatWorkSurfaceTimestamp("2026-04-20T12:00:00.000Z", "Created", now)
    ).toBe("Created 20 April")
    expect(
      formatWorkSurfaceTimestamp("2025-04-20T12:00:00.000Z", "Updated", now)
    ).toBe("Updated 20 April 2025")
  })

  it("formats detail dates with the weekday, month name, and year", () => {
    expect(formatWorkItemDetailDate("2026-04-26T00:00:00.000Z")).toBe(
      "Sunday, 26 April 2026"
    )
  })
})
