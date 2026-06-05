import { describe, expect, it } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"

import { ConversationFilesPanel } from "@/components/app/collaboration-screens/conversation-files-panel"

describe("ConversationFilesPanel", () => {
  it("opens shared images in an in-app preview", () => {
    render(
      <ConversationFilesPanel
        entries={[
          {
            content:
              '<p><img src="https://files.example.com/photo.jpg" alt="photo.jpg" title="photo.jpg" class="editor-image" /></p>',
            createdAt: "2026-06-05T10:00:00.000Z",
          },
        ]}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Open photo.jpg" }))

    const dialog = screen.getByRole("dialog", { name: "photo.jpg" })
    expect(
      within(dialog).getByRole("img", { name: "photo.jpg" })
    ).toHaveAttribute("src", "https://files.example.com/photo.jpg")
  })

  it("opens non-image attachments in-app and keeps download direct", () => {
    render(
      <ConversationFilesPanel
        entries={[
          {
            content:
              '<p><a href="https://files.example.com/spec.pdf" data-type="attachment" data-attachment-kind="pdf" data-file-name="spec.pdf">spec.pdf</a></p>',
            createdAt: "2026-06-05T10:00:00.000Z",
          },
        ]}
      />
    )

    expect(
      screen.queryByRole("link", { name: "Open spec.pdf" })
    ).not.toBeInTheDocument()

    const directDownload = screen.getByRole("link", {
      name: "Download spec.pdf",
    })
    expect(directDownload).toHaveAttribute(
      "href",
      "https://files.example.com/spec.pdf"
    )
    expect(directDownload).toHaveAttribute("download", "spec.pdf")

    fireEvent.click(screen.getByRole("button", { name: "Open spec.pdf" }))

    const dialog = screen.getByRole("dialog", { name: "spec.pdf" })
    expect(within(dialog).getByText(/PDF shared/)).toBeInTheDocument()
    expect(
      within(dialog).getByRole("link", { name: "Download" })
    ).toHaveAttribute("href", "https://files.example.com/spec.pdf")
  })
})
