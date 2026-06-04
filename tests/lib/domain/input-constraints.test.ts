import { describe, expect, it } from "vitest"

import {
  commentContentConstraints,
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

  it("counts rich-text image labels as plain text content", () => {
    expect(
      getTextInputLimitState(
        '<p><img src="https://example.com/photo.jpg" alt="photo.jpg" /></p>',
        commentContentConstraints,
        { plainText: true }
      )
    ).toMatchObject({
      displayCount: 9,
      canSubmit: true,
      tooShort: false,
    })

    expect(
      getTextInputLimitState(
        '<p><img src="https://example.com/photo.jpg" /></p>',
        commentContentConstraints,
        { plainText: true }
      )
    ).toMatchObject({
      displayCount: 0,
      canSubmit: false,
      tooShort: true,
    })
  })
})
