import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useState } from "react"

import { CollapsibleRightSidebar } from "@/components/ui/collapsible-right-sidebar"

function SidebarHarness() {
  const [open, setOpen] = useState(true)
  const [value, setValue] = useState("")

  return (
    <div>
      <button type="button" onClick={() => setOpen((current) => !current)}>
        Toggle
      </button>
      <CollapsibleRightSidebar open={open}>
        <label>
          Draft
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
      </CollapsibleRightSidebar>
    </div>
  )
}

describe("CollapsibleRightSidebar", () => {
  it("preserves mounted child state while the sidebar is closed", () => {
    render(<SidebarHarness />)

    fireEvent.change(screen.getByLabelText("Draft"), {
      target: { value: "Keep this draft" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Toggle" }))
    fireEvent.click(screen.getByRole("button", { name: "Toggle" }))

    expect(screen.getByLabelText("Draft")).toHaveValue("Keep this draft")
  })
})
