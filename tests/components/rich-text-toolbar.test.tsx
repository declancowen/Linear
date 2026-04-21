import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"

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

describe("RichTextToolbar", () => {
  it("keeps canvas width as the rightmost full-page toolbar action", () => {
    const editor = createEditorMock()
    const { container } = render(
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
})
