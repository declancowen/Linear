import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { RichTextToolbar } from "@/components/app/rich-text-editor/toolbar"

function createEditorMock() {
  const chain = new Proxy(
    {},
    {
      get: (_target, property) => {
        if (property === "run") {
          return () => true
        }

        return () => chain
      },
    }
  )

  return {
    can: () => ({
      chain: () => chain,
    }),
    chain: () => chain,
    getAttributes: () => ({}),
    isActive: () => false,
  }
}

function createTableActiveEditorMock() {
  return {
    ...createEditorMock(),
    isActive: (name?: string) => name === "table",
  }
}

function renderToolbar(editor: ReturnType<typeof createEditorMock>) {
  return render(
    <RichTextToolbar
      editable
      editor={editor as never}
      fullPage
      fullPageCanvasWidth="medium"
      handleFiles={async () => {}}
      hiddenAttachmentInputRef={{ current: null }}
      hiddenImageInputRef={{ current: null }}
      pickerInsertPosition={null}
      requestAttachmentPicker={() => {}}
      requestImagePicker={() => {}}
      setFullPageCanvasWidth={() => {}}
      showStats={false}
      statsCharacters={0}
      statsWords={0}
      toolbarWidthClassName=""
      uploadsEnabled
      uploadingAttachment={false}
    />
  )
}

describe("RichTextToolbar", () => {
  it("keeps canvas width as the rightmost full-page toolbar action", () => {
    const editor = createEditorMock()
    const { container } = renderToolbar(editor)

    const labels = Array.from(container.querySelectorAll("button"))
      .map(
        (button) =>
          button.getAttribute("aria-label") ?? button.getAttribute("title")
      )
      .filter((value): value is string => Boolean(value))

    expect(labels.at(-1)).toBe("Canvas width")
    expect(labels.indexOf("Canvas width")).toBeGreaterThan(
      labels.indexOf("Insert image")
    )
    expect(labels.indexOf("Canvas width")).toBeGreaterThan(
      labels.indexOf("Attach file")
    )
  })

  it("consolidates table delete actions into a single labeled menu", async () => {
    Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
      configurable: true,
      value: () => false,
    })
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: () => {},
    })

    const editor = createTableActiveEditorMock()
    const { container } = renderToolbar(editor)

    // There must be exactly one delete control, not three ambiguous trash buttons.
    const deleteTriggers = Array.from(
      container.querySelectorAll("button")
    ).filter(
      (button) => button.getAttribute("aria-label") === "Delete from table"
    )
    expect(deleteTriggers).toHaveLength(1)

    // The labeled options live inside the menu, not as always-visible buttons.
    expect(screen.queryByText("Delete row")).not.toBeInTheDocument()

    await userEvent.click(deleteTriggers[0]!)

    const menu = await screen.findByRole("menu")
    expect(within(menu).getByText("Delete row")).toBeInTheDocument()
    expect(within(menu).getByText("Delete column")).toBeInTheDocument()
    expect(within(menu).getByText("Delete table")).toBeInTheDocument()
  })
})
