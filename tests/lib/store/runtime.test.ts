import { beforeEach, describe, expect, it, vi } from "vitest"

import { RouteMutationError } from "@/lib/convex/client/shared"

const fetchSnapshotMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
  },
}))

vi.mock("@/lib/browser/snapshot-diagnostics", () => ({
  reportRealtimeFallbackDiagnostic: vi.fn(),
}))

vi.mock("@/lib/convex/client", () => ({
  fetchSnapshot: fetchSnapshotMock,
}))

describe("store runtime rich-text recovery", () => {
  beforeEach(() => {
    fetchSnapshotMock.mockReset()
    toastErrorMock.mockReset()
  })

  it("does not trigger a snapshot refresh for not-found rich-text failures when refreshStrategy is none", async () => {
    const { createStoreRuntime } = await import(
      "@/lib/store/app-store-internal/runtime"
    )

    const replaceDomainDataMock = vi.fn()
    const runtime = createStoreRuntime(
      () =>
        ({
          replaceDomainData: replaceDomainDataMock,
        }) as never
    )

    runtime.queueRichTextSync(
      "document:doc_1",
      () =>
        Promise.reject(
          new RouteMutationError("Document not found", 404, {
            code: "DOCUMENT_NOT_FOUND",
          })
        ),
      "Failed to update document",
      {
        refreshStrategy: "none",
      }
    )

    await runtime.flushRichTextSync("document:doc_1")

    expect(fetchSnapshotMock).not.toHaveBeenCalled()
    expect(replaceDomainDataMock).not.toHaveBeenCalled()
    expect(toastErrorMock).toHaveBeenCalledWith("Failed to update document")
  })

  it("still refreshes from the snapshot path for not-found rich-text failures when refreshStrategy is snapshot", async () => {
    const { createStoreRuntime } = await import(
      "@/lib/store/app-store-internal/runtime"
    )

    const replaceDomainDataMock = vi.fn()
    fetchSnapshotMock.mockResolvedValue({
      documents: [],
    })

    const runtime = createStoreRuntime(
      () =>
        ({
          replaceDomainData: replaceDomainDataMock,
        }) as never
    )

    runtime.queueRichTextSync(
      "document:doc_1",
      () =>
        Promise.reject(
          new RouteMutationError("Document not found", 404, {
            code: "DOCUMENT_NOT_FOUND",
          })
        ),
      "Failed to update document",
      {
        refreshStrategy: "snapshot",
      }
    )

    await runtime.flushRichTextSync("document:doc_1")

    await Promise.resolve()

    expect(fetchSnapshotMock).toHaveBeenCalledTimes(1)
    expect(replaceDomainDataMock).toHaveBeenCalledWith({
      documents: [],
    })
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it("ignores edit conflicts for protected collaboration-owned documents", async () => {
    const { createStoreRuntime } = await import(
      "@/lib/store/app-store-internal/runtime"
    )

    const replaceDomainDataMock = vi.fn()
    const runtime = createStoreRuntime(
      () =>
        ({
          protectedDocumentIds: ["doc_1"],
          replaceDomainData: replaceDomainDataMock,
          workItems: [],
        }) as never
    )

    runtime.queueRichTextSync(
      "document:doc_1",
      () =>
        Promise.reject(
          new RouteMutationError("Document changed while you were editing", 409, {
            code: "DOCUMENT_EDIT_CONFLICT",
          })
        ),
      "Failed to update document",
      {
        refreshStrategy: "none",
      }
    )

    await runtime.flushRichTextSync("document:doc_1")

    expect(fetchSnapshotMock).not.toHaveBeenCalled()
    expect(replaceDomainDataMock).not.toHaveBeenCalled()
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it("ignores stale in-flight rich-text failures after sync invalidation", async () => {
    const { createStoreRuntime } = await import(
      "@/lib/store/app-store-internal/runtime"
    )

    const rejectTaskRef: {
      current: ((error: unknown) => void) | null
    } = { current: null }
    const runtime = createStoreRuntime(
      () =>
        ({
          protectedDocumentIds: [],
          replaceDomainData: vi.fn(),
          workItems: [],
        }) as never
    )

    runtime.queueRichTextSync(
      "document:doc_1",
      () =>
        new Promise<void>((_, reject: (error: unknown) => void) => {
          rejectTaskRef.current = reject
        }),
      "Failed to update document",
      {
        refreshStrategy: "none",
      }
    )

    const flushPromise = runtime.flushRichTextSync("document:doc_1")
    await Promise.resolve()

    runtime.cancelRichTextSync("document:doc_1")
    expect(rejectTaskRef.current).not.toBeNull()

    if (!rejectTaskRef.current) {
      throw new Error("Expected in-flight sync task reject handler")
    }

    rejectTaskRef.current(
      new RouteMutationError("Document changed while you were editing", 409, {
        code: "DOCUMENT_EDIT_CONFLICT",
      })
    )

    await flushPromise

    expect(fetchSnapshotMock).not.toHaveBeenCalled()
    expect(toastErrorMock).not.toHaveBeenCalled()
  })
})
