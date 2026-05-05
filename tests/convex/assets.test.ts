import { beforeEach, describe, expect, it, vi } from "vitest"

const assetDataMocks = vi.hoisted(() => ({
  getDocumentDoc: vi.fn(),
  getWorkItemDoc: vi.fn(),
}))

vi.mock("@/convex/app/data", () => ({
  getDocumentDoc: assetDataMocks.getDocumentDoc,
  getWorkItemDoc: assetDataMocks.getWorkItemDoc,
}))

describe("asset helpers", () => {
  beforeEach(() => {
    assetDataMocks.getDocumentDoc.mockReset()
    assetDataMocks.getWorkItemDoc.mockReset()
  })

  it("resolves work item and team document attachment targets", async () => {
    const { resolveAttachmentTarget } = await import("@/convex/app/assets")

    assetDataMocks.getWorkItemDoc.mockResolvedValue({
      _id: "item_doc_1",
      teamId: "team_1",
    })
    await expect(
      resolveAttachmentTarget({} as never, "workItem", "item_1")
    ).resolves.toEqual({
      teamId: "team_1",
      entityType: "workItem",
      recordId: "item_doc_1",
    })

    assetDataMocks.getDocumentDoc.mockResolvedValue({
      _id: "document_doc_1",
      teamId: "team_2",
    })
    await expect(
      resolveAttachmentTarget({} as never, "document", "doc_1")
    ).resolves.toEqual({
      teamId: "team_2",
      entityType: "document",
      recordId: "document_doc_1",
    })
  })

  it("rejects missing targets and workspace documents", async () => {
    const { resolveAttachmentTarget } = await import("@/convex/app/assets")

    assetDataMocks.getWorkItemDoc.mockResolvedValue(null)
    await expect(
      resolveAttachmentTarget({} as never, "workItem", "item_missing")
    ).rejects.toThrow("Work item not found")

    assetDataMocks.getDocumentDoc.mockResolvedValue({
      _id: "document_doc_1",
      teamId: null,
    })
    await expect(
      resolveAttachmentTarget({} as never, "document", "doc_1")
    ).rejects.toThrow("Attachments are only available on team documents")
  })
})
