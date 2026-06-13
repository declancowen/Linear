import { describe, expect, it, vi } from "vitest"

import {
  assertDocumentEditLeaseAvailable,
  assertDocumentEditLeaseOwned,
  DOCUMENT_PRESENCE_ACTIVE_WINDOW_MS,
} from "@/convex/app/presence_helpers"

const NOW = "2026-06-13T12:00:00.000Z"

function createCtx(entries: Record<string, unknown>[]) {
  return {
    db: {
      query: vi.fn(() => ({
        withIndex: vi.fn(() => ({
          collect: vi.fn().mockResolvedValue(entries),
        })),
      })),
    },
  }
}

function createPresence(overrides: Record<string, unknown> = {}) {
  return {
    documentId: "document_1",
    userId: "user_2",
    workosUserId: "workos_2",
    sessionId: "session_2",
    editing: true,
    lastSeenAt: NOW,
    ...overrides,
  }
}

describe("document edit leases", () => {
  it("rejects a second active editor session", async () => {
    const ctx = createCtx([createPresence()])

    await expect(
      assertDocumentEditLeaseAvailable(
        ctx as never,
        "document_1",
        {
          currentUserId: "user_1",
          workosUserId: "workos_1",
          email: "alex@example.com",
          name: "Alex",
          avatarUrl: "",
          sessionId: "session_1",
          editing: true,
        },
        NOW
      )
    ).rejects.toThrow("Work item is already being edited")
  })

  it("allows a claim after the previous editor lease expires", async () => {
    const ctx = createCtx([
      createPresence({
        lastSeenAt: new Date(
          Date.parse(NOW) - DOCUMENT_PRESENCE_ACTIVE_WINDOW_MS - 1
        ).toISOString(),
      }),
    ])

    await expect(
      assertDocumentEditLeaseAvailable(
        ctx as never,
        "document_1",
        {
          currentUserId: "user_1",
          workosUserId: "workos_1",
          email: "alex@example.com",
          name: "Alex",
          avatarUrl: "",
          sessionId: "session_1",
          editing: true,
        },
        NOW
      )
    ).resolves.toBeUndefined()
  })

  it("requires the active lease owner when saving", async () => {
    const ownedCtx = createCtx([
      createPresence({
        userId: "user_1",
        sessionId: "session_1",
      }),
    ])
    const missingCtx = createCtx([createPresence({ editing: false })])

    await expect(
      assertDocumentEditLeaseOwned(
        ownedCtx as never,
        "document_1",
        {
          currentUserId: "user_1",
          sessionId: "session_1",
        },
        NOW
      )
    ).resolves.toBeUndefined()

    await expect(
      assertDocumentEditLeaseOwned(
        missingCtx as never,
        "document_1",
        {
          currentUserId: "user_1",
          sessionId: "session_1",
        },
        NOW
      )
    ).rejects.toThrow("Work item edit session is no longer active")
  })
})
