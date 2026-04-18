import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { PropertySelect } from "@/components/app/screens/shared"

describe("PropertySelect", () => {
  it("opens a property menu and applies the selected value", async () => {
    const onValueChange = vi.fn()

    render(
      <PropertySelect
        label="Status"
        value="todo"
        options={[
          { value: "todo", label: "To do" },
          { value: "in-progress", label: "In progress" },
          { value: "done", label: "Done" },
        ]}
        onValueChange={onValueChange}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Status" }))
    fireEvent.click(await screen.findByRole("button", { name: "Done" }))

    expect(onValueChange).toHaveBeenCalledWith("done")
  })

  it("does not open when disabled", () => {
    const onValueChange = vi.fn()

    render(
      <PropertySelect
        label="Status"
        value="todo"
        disabled
        options={[
          { value: "todo", label: "To do" },
          { value: "done", label: "Done" },
        ]}
        onValueChange={onValueChange}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Status" }))

    expect(screen.queryByRole("button", { name: "Done" })).toBeNull()
    expect(onValueChange).not.toHaveBeenCalled()
  })
})
