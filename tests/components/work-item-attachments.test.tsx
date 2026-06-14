import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { WorkItemAttachments } from "@/components/app/screens/work-item-attachments"
import type { Attachment } from "@/lib/domain/types"

function createAttachment(
  id: string,
  fileName: string,
  contentType: string
): Attachment {
  return {
    id,
    targetType: "workItem",
    targetId: "item_1",
    teamId: "team_1",
    storageId: `storage_${id}`,
    fileName,
    contentType,
    size: 100,
    uploadedBy: "user_1",
    createdAt: "2026-06-13T12:00:00.000Z",
    fileUrl: `https://example.com/${fileName}`,
  }
}

describe("WorkItemAttachments", () => {
  it("renders files before images and switches between full-screen image previews", () => {
    const onRemove = vi.fn()
    render(
      <WorkItemAttachments
        editable
        onRemove={onRemove}
        attachments={[
          createAttachment("image_1", "first.png", "image/png"),
          createAttachment("file_1", "site.html", "text/html"),
          createAttachment("image_2", "second.jpg", "image/jpeg"),
        ]}
      />
    )

    const files = screen.getByLabelText("Work item files")
    const images = screen.getByLabelText("Work item images")
    expect(
      files.compareDocumentPosition(images) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(screen.getByLabelText("Download site.html")).toHaveAttribute(
      "download",
      "site.html"
    )

    fireEvent.click(screen.getByRole("button", { name: "first.png" }))

    expect(screen.getByRole("img", { name: "first.png" })).toBeInTheDocument()
    expect(screen.getByText("1 / 2")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Next image" }))

    expect(screen.getByRole("img", { name: "second.jpg" })).toBeInTheDocument()
    expect(screen.getByText("2 / 2")).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText("Remove site.html"))
    expect(onRemove).toHaveBeenCalledWith("file_1")
  })

  it("keeps image records without a preview URL visible in the files row", () => {
    const image = createAttachment("image_1", "first.png", "image/png")
    image.fileUrl = null

    render(<WorkItemAttachments attachments={[image]} />)

    expect(screen.getByLabelText("Work item files")).toHaveTextContent(
      "first.png"
    )
    expect(screen.queryByLabelText("Work item images")).toBeNull()
  })
})
