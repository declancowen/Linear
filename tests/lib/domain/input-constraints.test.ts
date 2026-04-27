import { describe, expect, it } from "vitest"

import {
  getTextInputLimitState,
  profileAvatarFallbackConstraints,
  workspaceFallbackBadgeConstraints,
} from "@/lib/domain/input-constraints"

describe("input constraints legacy image compatibility", () => {
  it("allows empty avatar fallback values so unchanged profiles remain savable", () => {
    expect(
      getTextInputLimitState("", profileAvatarFallbackConstraints)
    ).toMatchObject({
      canSubmit: true,
      tooShort: false,
      tooLong: false,
    })
  })

  it("allows legacy image URLs for avatar fallback values", () => {
    expect(
      getTextInputLimitState(
        "https://example.com/avatar.png",
        profileAvatarFallbackConstraints
      )
    ).toMatchObject({
      canSubmit: true,
      tooShort: false,
      tooLong: false,
    })
  })

  it("allows legacy image URLs for workspace logo fallback values", () => {
    expect(
      getTextInputLimitState(
        "https://example.com/logo.png",
        workspaceFallbackBadgeConstraints
      )
    ).toMatchObject({
      canSubmit: true,
      tooShort: false,
      tooLong: false,
    })
  })
})
