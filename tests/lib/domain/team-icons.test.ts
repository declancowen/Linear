import { describe, expect, it } from "vitest"

import {
  getDefaultTeamIconForExperience,
  normalizeTeamIconToken,
  teamDetailsSchema,
  teamDetailsUpdateSchema,
} from "@/lib/domain/types"

const validTeamFeatures = {
  issues: true,
  projects: true,
  views: true,
  docs: true,
  chat: true,
  channels: true,
}

describe("team icons", () => {
  it("accepts app-owned Phosphor icon names for team creation and updates", () => {
    const input = {
      name: "Platform",
      icon: "RocketLaunch",
      summary: "Builds the platform.",
      experience: "software-development",
      features: validTeamFeatures,
    }

    expect(teamDetailsSchema.safeParse(input).success).toBe(true)
    expect(teamDetailsUpdateSchema.safeParse(input).success).toBe(true)
  })

  it("keeps legacy icon tokens valid while rejecting unknown icon names", () => {
    expect(normalizeTeamIconToken("robot", "software-development")).toBe(
      "robot"
    )
    expect(
      teamDetailsSchema.safeParse({
        name: "Legacy",
        icon: "robot",
        summary: "Legacy team.",
        experience: "software-development",
        features: validTeamFeatures,
      }).success
    ).toBe(true)
    expect(
      teamDetailsSchema.safeParse({
        name: "Broken",
        icon: "DefinitelyNotAnIcon",
        summary: "Broken team.",
        experience: "software-development",
        features: validTeamFeatures,
      }).success
    ).toBe(false)
  })

  it("does not derive the default team icon from the team type", () => {
    expect(getDefaultTeamIconForExperience("software-development")).toBe(
      "RocketLaunch"
    )
    expect(getDefaultTeamIconForExperience("project-management")).toBe(
      "RocketLaunch"
    )
  })
})
