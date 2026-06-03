import { describe, expect, it, vi } from "vitest"

import { listLatestReadableChatMessageByConversation } from "@/convex/app/data"

function createMessage(overrides: Record<string, unknown> = {}) {
  return {
    _id: "message_doc_1",
    id: "message_1",
    conversationId: "conversation_1",
    kind: "text",
    content: "<p>Hello</p>",
    mentionUserIds: [],
    reactions: [],
    createdBy: "user_1",
    createdAt: "2026-06-03T12:00:00.000Z",
    updatedAt: "2026-06-03T12:00:00.000Z",
    ...overrides,
  }
}

function createPreviewCtx(messages: ReturnType<typeof createMessage>[]) {
  const takeMock = vi.fn(async (count: number) => messages.slice(0, count))
  const orderMock = vi.fn(() => ({ take: takeMock }))
  const withIndexMock = vi.fn(
    (
      _indexName: string,
      build: (query: { eq: (field: string, value: unknown) => unknown }) => void
    ) => {
      const queryApi = {
        eq: vi.fn(() => queryApi),
      }
      build(queryApi)

      return { order: orderMock }
    }
  )
  const queryMock = vi.fn(() => ({ withIndex: withIndexMock }))

  return {
    ctx: {
      db: {
        query: queryMock,
      },
    },
    takeMock,
  }
}

describe("chat conversation preview data helpers", () => {
  it("returns a readable message from the initial bounded page", async () => {
    const { ctx, takeMock } = createPreviewCtx([
      createMessage({ id: "message_visible" }),
    ])

    await expect(
      listLatestReadableChatMessageByConversation(ctx as never, "conversation_1")
    ).resolves.toMatchObject({ id: "message_visible" })

    expect(takeMock).toHaveBeenCalledTimes(1)
    expect(takeMock).toHaveBeenCalledWith(25)
  })

  it("scans beyond deleted preview rows before returning an older message", async () => {
    const deletedMessages = Array.from({ length: 25 }, (_, index) =>
      createMessage({
        _id: `message_deleted_${index}_doc`,
        id: `message_deleted_${index}`,
        createdAt: `2026-06-03T12:${String(59 - index).padStart(2, "0")}:00.000Z`,
        deletedAt: "2026-06-03T13:00:00.000Z",
      })
    )
    const visibleMessage = createMessage({
      _id: "message_visible_doc",
      id: "message_visible",
      createdAt: "2026-06-03T11:00:00.000Z",
    })
    const { ctx, takeMock } = createPreviewCtx([
      ...deletedMessages,
      visibleMessage,
    ])

    await expect(
      listLatestReadableChatMessageByConversation(ctx as never, "conversation_1")
    ).resolves.toMatchObject({ id: "message_visible" })

    expect(takeMock).toHaveBeenCalledTimes(2)
    expect(takeMock).toHaveBeenNthCalledWith(1, 25)
    expect(takeMock).toHaveBeenNthCalledWith(2, 250)
  })

  it("does not run the fallback scan for short all-deleted conversations", async () => {
    const { ctx, takeMock } = createPreviewCtx([
      createMessage({
        id: "message_deleted",
        deletedAt: "2026-06-03T13:00:00.000Z",
      }),
    ])

    await expect(
      listLatestReadableChatMessageByConversation(ctx as never, "conversation_1")
    ).resolves.toBeNull()

    expect(takeMock).toHaveBeenCalledTimes(1)
    expect(takeMock).toHaveBeenCalledWith(25)
  })
})
