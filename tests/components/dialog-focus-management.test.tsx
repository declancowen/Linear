import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"

describe("dialog focus management", () => {
  it("blurs the previously focused element when a controlled dialog opens", () => {
    const onOpenChange = vi.fn()
    const { rerender } = render(
      <>
        <input data-testid="outside-input" />
        <Dialog open={false} onOpenChange={onOpenChange}>
          <DialogContent>
            <DialogTitle>Create item</DialogTitle>
            <DialogDescription>
              Choose how to create the item.
            </DialogDescription>
            <button type="button">Continue</button>
          </DialogContent>
        </Dialog>
      </>
    )

    const outsideInput = screen.getByTestId("outside-input")
    outsideInput.focus()
    expect(document.activeElement).toBe(outsideInput)

    rerender(
      <>
        <input data-testid="outside-input" />
        <Dialog open onOpenChange={onOpenChange}>
          <DialogContent>
            <DialogTitle>Create item</DialogTitle>
            <DialogDescription>
              Choose how to create the item.
            </DialogDescription>
            <button type="button">Continue</button>
          </DialogContent>
        </Dialog>
      </>
    )

    expect(document.activeElement).not.toBe(outsideInput)
  })
})
