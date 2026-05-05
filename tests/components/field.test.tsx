import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { FieldError } from "@/components/ui/field"

describe("FieldError", () => {
  it("renders direct children as the error content", () => {
    render(<FieldError>Required</FieldError>)

    expect(screen.getByRole("alert")).toHaveTextContent("Required")
  })

  it("renders a single unique validation message", () => {
    render(
      <FieldError
        errors={[
          { message: "Name is required" },
          { message: "Name is required" },
        ]}
      />
    )

    expect(screen.getByRole("alert")).toHaveTextContent("Name is required")
  })

  it("renders multiple unique validation messages as a list", () => {
    render(
      <FieldError
        errors={[
          { message: "Name is required" },
          undefined,
          { message: "Email is invalid" },
        ]}
      />
    )

    const alert = screen.getByRole("alert")
    expect(within(alert).getAllByRole("listitem")).toHaveLength(2)
    expect(alert).toHaveTextContent("Name is required")
    expect(alert).toHaveTextContent("Email is invalid")
  })

  it("omits the alert when no content is available", () => {
    render(<FieldError errors={[]} />)

    expect(screen.queryByRole("alert")).toBeNull()
  })
})
