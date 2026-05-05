import { describe, expect, it } from "vitest"

import {
  formatWorkItemKey,
  normalizeWorkItemKeyNumberPadding,
} from "@/lib/domain/work-item-key"

describe("work item keys", () => {
  it("formats generated work item keys with at least three digits", () => {
    expect(formatWorkItemKey("PL", 4)).toBe("PL-004")
    expect(formatWorkItemKey("PL", 42)).toBe("PL-042")
    expect(formatWorkItemKey("PL", 400)).toBe("PL-400")
    expect(formatWorkItemKey("PL", 4000)).toBe("PL-4000")
  })

  it("normalizes existing work item keys with short numeric suffixes", () => {
    expect(normalizeWorkItemKeyNumberPadding("PL-4")).toBe("PL-004")
    expect(normalizeWorkItemKeyNumberPadding("PL-04")).toBe("PL-004")
    expect(normalizeWorkItemKeyNumberPadding("PL-004")).toBe("PL-004")
    expect(normalizeWorkItemKeyNumberPadding("PLATFORM")).toBe("PLATFORM")
  })
})
