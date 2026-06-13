import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

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
  it("renders file downloads and switches between full-screen image previews", () => {
    render(
      <WorkItemAttachments
        attachments={[
          createAttachment("image_1", "first.png", "image/png"),
          createAttachment("file_1", "site.html", "text/html"),
          createAttachment("image_2", "second.jpg", "image/jpeg"),
        ]}
      />
    )

    expect(screen.getByLabelText("Work item attachments")).toBeInTheDocument()
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
  })
})
