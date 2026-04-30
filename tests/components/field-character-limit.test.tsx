import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { FieldCharacterLimit } from "@/components/app/field-character-limit"
import type { TextInputLimitState } from "@/lib/domain/input-constraints"

function createLimitState(
  overrides: Partial<TextInputLimitState>
): TextInputLimitState {
  return {
    displayCount: 0,
    remaining: 10,
    tooShort: false,
    tooLong: false,
    isAtLimit: false,
    canSubmit: true,
    error: null,
    ...overrides,
  }
}

describe("FieldCharacterLimit", () => {
  it("hides minimum feedback before any characters are typed", () => {
    render(
      <FieldCharacterLimit
        state={createLimitState({
          tooShort: true,
          canSubmit: false,
          error: "Enter at least 2 characters",
        })}
      />
    )

    expect(
      screen.queryByText("Enter at least 2 characters")
    ).not.toBeInTheDocument()
  })

  it("shows minimum feedback after typing a value below the minimum", () => {
    render(
      <FieldCharacterLimit
        state={createLimitState({
          displayCount: 1,
          tooShort: true,
          canSubmit: false,
          error: "Enter at least 2 characters",
        })}
      />
    )

    expect(screen.getByText("Enter at least 2 characters")).toBeInTheDocument()
  })

  it("still shows maximum feedback", () => {
    render(
      <FieldCharacterLimit
        state={createLimitState({
          displayCount: 11,
          remaining: -1,
          tooLong: true,
          canSubmit: false,
          error: "Limit is 10 characters",
        })}
      />
    )

    expect(screen.getByText("Limit is 10 characters")).toBeInTheDocument()
  })
})
