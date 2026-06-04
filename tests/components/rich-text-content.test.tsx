import { describe, expect, it } from "vitest"
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { RichTextContent } from "@/components/app/rich-text-content"

function expectPreviewDialogImage({
  content,
  name,
  source,
  triggerRole,
}: {
  content: string
  name: string
  source: string
  triggerRole: "img" | "link"
}) {
  render(<RichTextContent content={content} />)

  fireEvent.click(screen.getByRole(triggerRole, { name }))

  const dialog = screen.getByRole("dialog", { name })
  expect(within(dialog).getByRole("img", { name })).toHaveAttribute(
    "src",
    source
  )
}

describe("RichTextContent", () => {
  it("opens a full-screen preview from rendered image previews", () => {
    expectPreviewDialogImage({
      content:
        '<p><img src="https://example.com/photo.jpg" alt="photo.jpg" title="photo.jpg" class="editor-image" /></p>',
      name: "photo.jpg",
      source: "https://example.com/photo.jpg",
      triggerRole: "img",
    })
  })

  it("opens a full-screen preview from inline image references", () => {
    expectPreviewDialogImage({
      content:
        '<p><a href="https://files.example.com/storage/abc123" target="_blank" rel="noreferrer">camera.heic</a></p>',
      name: "camera.heic",
      source: "https://files.example.com/storage/abc123",
      triggerRole: "link",
    })
  })

  it("renders image previews as inline image references in inline attachment mode", async () => {
    render(
      <RichTextContent
        attachmentDisplay="inline"
        content='<p><img src="https://files.example.com/storage/abc123" alt="camera.heic" title="camera.heic" class="editor-image" /></p>'
      />
    )

    await waitFor(() => {
      expect(
        screen.queryByRole("img", { name: "camera.heic" })
      ).not.toBeInTheDocument()
    })

    const link = screen.getByRole("link", { name: "camera.heic" })
    expect(link).toHaveAttribute(
      "href",
      "https://files.example.com/storage/abc123"
    )
    expect(link).toHaveAttribute("data-attachment-kind", "image")

    fireEvent.click(link)

    const dialog = screen.getByRole("dialog", { name: "camera.heic" })
    expect(
      within(dialog).getByRole("img", { name: "camera.heic" })
    ).toHaveAttribute("src", "https://files.example.com/storage/abc123")
  })

  it("adds file-type icons to inline attachment references", async () => {
    render(
      <RichTextContent
        content={[
          '<p><a href="https://files.example.com/camera.heic">camera.heic</a></p>',
          '<p><a href="https://files.example.com/spec.pdf">spec.pdf</a></p>',
          '<p><a href="https://files.example.com/doc.docx">doc.docx</a></p>',
          '<p><a href="https://files.example.com/sheet.xlsx">sheet.xlsx</a></p>',
          '<p><a href="https://files.example.com/deck.pptx">deck.pptx</a></p>',
          '<p><a href="https://files.example.com/archive.zip">archive.zip</a></p>',
        ].join("")}
      />
    )

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: "camera.heic" })
      ).toHaveAttribute("data-attachment-kind", "image")
    })
    expect(screen.getByRole("link", { name: "spec.pdf" })).toHaveAttribute(
      "data-attachment-kind",
      "pdf"
    )
    expect(screen.getByRole("link", { name: "doc.docx" })).toHaveAttribute(
      "data-attachment-kind",
      "word"
    )
    expect(screen.getByRole("link", { name: "sheet.xlsx" })).toHaveAttribute(
      "data-attachment-kind",
      "excel"
    )
    expect(screen.getByRole("link", { name: "deck.pptx" })).toHaveAttribute(
      "data-attachment-kind",
      "powerpoint"
    )
    expect(screen.getByRole("link", { name: "archive.zip" })).toHaveAttribute(
      "data-attachment-kind",
      "file"
    )
  })
})
