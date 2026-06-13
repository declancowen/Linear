import { beforeEach, describe, expect, it, vi } from "vitest"

const assertServerTokenMock = vi.fn()
const getDocumentDocMock = vi.fn()
const requireReadableDocumentAccessMock = vi.fn()
const requireEditableDocumentAccessMock = vi.fn()

vi.mock("@/convex/app/core", () => ({
  assertServerToken: assertServerTokenMock,
}))

vi.mock("@/convex/app/data", () => ({
  getDocumentDoc: getDocumentDocMock,
}))

vi.mock("@/convex/app/access", () => ({
  requireEditableDocumentAccess: requireEditableDocumentAccessMock,
  requireReadableDocumentAccess: requireReadableDocumentAccessMock,
}))

describe("collaboration documents", () => {
  beforeEach(() => {
    assertServerTokenMock.mockReset()
    getDocumentDocMock.mockReset()
    requireReadableDocumentAccessMock.mockReset()
    requireEditableDocumentAccessMock.mockReset()
  })

  it("rejects work-item description collaboration before access resolution", async () => {
    const { getCollaborationDocumentHandler } =
      await import("@/convex/app/collaboration_documents")

    getDocumentDocMock.mockResolvedValue({
      id: "document_1",
      kind: "item-description",
    })

    await expect(
      getCollaborationDocumentHandler({} as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        documentId: "document_1",
      })
    ).rejects.toThrow("Work item descriptions do not support collaboration")
    expect(requireReadableDocumentAccessMock).not.toHaveBeenCalled()
    expect(requireEditableDocumentAccessMock).not.toHaveBeenCalled()
  })
})
