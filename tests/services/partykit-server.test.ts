import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getSchema, type JSONContent } from "@tiptap/core"
import { prosemirrorJSONToYDoc } from "@tiptap/y-tiptap"

import { encodeDocumentStateVector } from "@/lib/collaboration/state-vectors"
import { createSignedCollaborationToken } from "@/lib/server/collaboration-token"
import { createRichTextBaseExtensions } from "@/lib/rich-text/extensions"

const unstableGetYDocMock = vi.hoisted(() => vi.fn())
const onConnectMock = vi.hoisted(() => vi.fn())
const clearRangeMock = vi.hoisted(() => vi.fn())
const getLevelKeyRangeAsEncodedMock = vi.hoisted(() => vi.fn())

vi.mock("y-partykit", () => ({
  onConnect: onConnectMock,
  unstable_getYDoc: unstableGetYDocMock,
}))

vi.mock("y-partykit/storage", () => ({
  clearRange: clearRangeMock,
  getLevelKeyRangeAsEncoded: getLevelKeyRangeAsEncodedMock,
  YPartyKitStorage: class {},
}))

const richTextSchema = getSchema(
  createRichTextBaseExtensions({
    includeCharacterCount: false,
  })
)

function createDoc(contentJson: JSONContent) {
  return prosemirrorJSONToYDoc(
    richTextSchema,
    contentJson,
    "default"
  )
}

describe("PartyKit collaboration server", () => {
  beforeEach(() => {
    unstableGetYDocMock.mockReset()
    onConnectMock.mockReset()
    clearRangeMock.mockReset()
    getLevelKeyRangeAsEncodedMock.mockReset()

    process.env.COLLABORATION_APP_ORIGIN = "http://localhost:3000"
    process.env.COLLABORATION_INTERNAL_SECRET =
      "test-collaboration-internal-secret"
    process.env.COLLABORATION_TOKEN_SECRET = "test-collaboration-token-secret"
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it("forwards work-item title metadata during manual collaboration flush", async () => {
    const contentJson: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Updated",
            },
          ],
        },
      ],
    }
    const yDoc = createDoc(contentJson)
    unstableGetYDocMock.mockResolvedValue(yDoc)

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.includes("/bootstrap")) {
        return new Response(
          JSON.stringify({
            documentId: "doc_desc_1",
            kind: "item-description",
            itemId: "item_1",
            title: "Item description",
            contentHtml: "<p>Updated</p>",
            contentJson,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          }
        )
      }

      if (url.includes("/persist")) {
        return new Response(
          JSON.stringify({
            ok: true,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          }
        )
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal("fetch", fetchMock)

    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_desc_1",
      documentId: "doc_desc_1",
      role: "editor",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    const response = await collaboration.onRequest(
      new Request(
        "http://127.0.0.1:1999/parties/main/doc:doc_desc_1?action=flush",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stateVector: encodeDocumentStateVector(yDoc),
            workItemExpectedUpdatedAt: "2026-04-22T00:00:00.000Z",
            workItemTitle: "Updated title",
          }),
        }
      ) as never,
      {
        id: "doc:doc_desc_1",
        env: process.env,
      } as never
    )

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/api/internal/collaboration/documents/doc_desc_1/persist",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          currentUserId: "user_1",
          contentJson,
          flushReason: "manual",
          workItemExpectedUpdatedAt: "2026-04-22T00:00:00.000Z",
          workItemTitle: "Updated title",
        }),
      })
    )
  })

  it("rejects viewer-role manual flush requests before persisting", async () => {
    const yDoc = createDoc({
      type: "doc",
      content: [
        {
          type: "paragraph",
        },
      ],
    })
    unstableGetYDocMock.mockResolvedValue(yDoc)

    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_2",
      roomId: "doc:doc_desc_1",
      documentId: "doc_desc_1",
      role: "viewer",
      sessionId: "session_2",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    const response = await collaboration.onRequest(
      new Request(
        "http://127.0.0.1:1999/parties/main/doc:doc_desc_1?action=flush",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stateVector: encodeDocumentStateVector(yDoc),
          }),
        }
      ) as never,
      {
        id: "doc:doc_desc_1",
        env: process.env,
      } as never
    )

    expect(response.status).toBe(403)
    await expect(response.text()).resolves.toBe(
      "Collaboration flush requires editor access"
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("does not attempt a last-close persist for viewer-only rooms", async () => {
    const contentJson: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
        },
      ],
    }
    const yDoc = createDoc(contentJson)
    unstableGetYDocMock.mockResolvedValue(yDoc)
    onConnectMock.mockResolvedValue(undefined)
    getLevelKeyRangeAsEncodedMock.mockResolvedValue([new Uint8Array([1])])

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes("/bootstrap")) {
        return new Response(
          JSON.stringify({
            documentId: "doc_desc_1",
            kind: "item-description",
            itemId: "item_1",
            title: "Item description",
            contentHtml: "<p></p>",
            contentJson,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          }
        )
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal("fetch", fetchMock)

    const { collaboration } = await import("@/services/partykit/server")

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_2",
      roomId: "doc:doc_desc_1",
      documentId: "doc_desc_1",
      role: "viewer",
      sessionId: "session_2",
      workspaceId: "workspace_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    })

    await collaboration.onConnect(
      {} as never,
      {
        id: "doc:doc_desc_1",
        env: process.env,
      } as never,
      {
        request: new Request("http://127.0.0.1:1999/parties/main/doc:doc_desc_1", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }) as never,
      }
    )

    await collaboration.onClose(
      {} as never,
      {
        id: "doc:doc_desc_1",
        env: process.env,
      } as never
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(getLevelKeyRangeAsEncodedMock).not.toHaveBeenCalled()
    expect(clearRangeMock).not.toHaveBeenCalled()
  })

  it("returns 401 for invalid collaboration flush tokens", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const { collaboration } = await import("@/services/partykit/server")

    const response = await collaboration.onRequest(
      new Request(
        "http://127.0.0.1:1999/parties/main/doc:doc_desc_1?action=flush",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer invalid-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stateVector: "AQID",
          }),
        }
      ) as never,
      {
        id: "doc:doc_desc_1",
        env: process.env,
      } as never
    )

    expect(response.status).toBe(401)
    await expect(response.text()).resolves.toBe(
      "Invalid collaboration token"
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
