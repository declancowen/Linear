// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const storeMocks = vi.hoisted(() => ({
  openCreateDialog: vi.fn(),
}))

vi.mock("@/lib/store/app-store", () => ({
  useAppStore: {
    getState: () => ({
      openCreateDialog: storeMocks.openCreateDialog,
    }),
  },
}))

import {
  openManagedCreateDialog,
  openTopLevelDialog,
} from "@/lib/browser/dialog-transitions"
import type { CreateDialogState } from "@/lib/domain/types"

describe("dialog transitions", () => {
  let animationFrameCallbacks: FrameRequestCallback[]
  let requestAnimationFrameSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    animationFrameCallbacks = []
    storeMocks.openCreateDialog.mockReset()
    requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        animationFrameCallbacks.push(callback)
        return animationFrameCallbacks.length
      })
  })

  afterEach(() => {
    requestAnimationFrameSpy.mockRestore()
    document.body.innerHTML = ""
  })

  it("blurs the active element and defers opening top-level dialogs", () => {
    const beforeOpen = vi.fn()
    const openDialog = vi.fn()
    const outsideInput = document.createElement("input")

    document.body.appendChild(outsideInput)
    outsideInput.focus()
    expect(document.activeElement).toBe(outsideInput)

    openTopLevelDialog(openDialog, { beforeOpen })

    expect(document.activeElement).not.toBe(outsideInput)
    expect(beforeOpen).toHaveBeenCalledTimes(1)
    expect(openDialog).not.toHaveBeenCalled()
    expect(animationFrameCallbacks).toHaveLength(1)

    animationFrameCallbacks[0]?.(0)

    expect(openDialog).toHaveBeenCalledTimes(1)
  })

  it("routes create-dialog opens through the store on the next frame", () => {
    const dialog = {
      kind: "project",
      defaultTeamId: "team_1",
    } satisfies CreateDialogState

    openManagedCreateDialog(dialog)

    expect(storeMocks.openCreateDialog).not.toHaveBeenCalled()
    expect(animationFrameCallbacks).toHaveLength(1)

    animationFrameCallbacks[0]?.(0)

    expect(storeMocks.openCreateDialog).toHaveBeenCalledWith(dialog)
  })
})
