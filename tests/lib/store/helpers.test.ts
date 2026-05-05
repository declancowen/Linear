import { describe, expect, it } from "vitest"

import {
  buildWorkspaceChatTitle,
  findWorkspaceDirectConversation,
  normalizeChatMessages,
  normalizeUsers,
} from "@/lib/store/app-store-internal/helpers"
import {
  createTestAppData,
  createTestUser,
} from "@/tests/lib/fixtures/app-data"

describe("store helpers", () => {
  it("normalizes optional chat message and user fields at the store boundary", () => {
    expect(normalizeChatMessages(undefined)).toEqual([])
    expect(
      normalizeChatMessages([
        {
          id: "message_1",
        } as never,
      ])
    ).toEqual([
      {
        id: "message_1",
        kind: "text",
        callId: null,
        mentionUserIds: [],
        reactions: [],
      },
    ])

    expect(
      normalizeUsers([
        {
          id: "user_1",
          status: "invalid",
          statusMessage: null,
          hasExplicitStatus: null,
        },
        {
          id: "user_2",
          status: "away",
          statusMessage: "In focus",
          hasExplicitStatus: false,
        },
      ])
    ).toEqual([
      {
        id: "user_1",
        status: "offline",
        statusMessage: "",
        hasExplicitStatus: true,
      },
      {
        id: "user_2",
        status: "away",
        statusMessage: "In focus",
        hasExplicitStatus: false,
      },
    ])
  })

  it("builds workspace chat titles from explicit titles or participant names", () => {
    const data = createTestAppData({
      users: [
        createTestUser({ id: "user_1", name: "Alex" }),
        createTestUser({ id: "user_2", name: "Sam" }),
        createTestUser({ id: "user_3", name: "Taylor" }),
      ],
    })

    expect(
      buildWorkspaceChatTitle(data, "user_1", ["user_1", "user_2"], "  Ops  ")
    ).toBe("Ops")
    expect(
      buildWorkspaceChatTitle(data, "user_1", ["user_1", "user_2"], "")
    ).toBe("Sam")
    expect(
      buildWorkspaceChatTitle(data, "user_1", ["user_1", "missing"], "")
    ).toBe("Direct chat")
    expect(
      buildWorkspaceChatTitle(
        data,
        "user_1",
        ["user_1", "user_2", "user_3"],
        ""
      )
    ).toBe("Sam, Taylor")
  })

  it("finds the latest matching workspace direct conversation only", () => {
    const data = createTestAppData({
      conversations: [
        {
          id: "older",
          kind: "chat",
          scopeType: "workspace",
          scopeId: "workspace_1",
          variant: "direct",
          title: "Older",
          description: "",
          participantIds: ["user_1", "user_2"],
          roomId: null,
          roomName: null,
          createdBy: "user_1",
          createdAt: "2026-04-21T10:00:00.000Z",
          updatedAt: "2026-04-21T10:00:00.000Z",
          lastActivityAt: "2026-04-21T10:00:00.000Z",
        },
        {
          id: "channel",
          kind: "channel",
          scopeType: "workspace",
          scopeId: "workspace_1",
          variant: "team",
          title: "Channel",
          description: "",
          participantIds: ["user_1", "user_2"],
          roomId: null,
          roomName: null,
          createdBy: "user_1",
          createdAt: "2026-04-21T11:00:00.000Z",
          updatedAt: "2026-04-21T11:00:00.000Z",
          lastActivityAt: "2026-04-21T11:00:00.000Z",
        },
        {
          id: "latest",
          kind: "chat",
          scopeType: "workspace",
          scopeId: "workspace_1",
          variant: "direct",
          title: "Latest",
          description: "",
          participantIds: ["user_2", "user_1"],
          roomId: null,
          roomName: null,
          createdBy: "user_2",
          createdAt: "2026-04-21T12:00:00.000Z",
          updatedAt: "2026-04-21T12:00:00.000Z",
          lastActivityAt: "2026-04-21T12:00:00.000Z",
        },
      ],
    })

    expect(
      findWorkspaceDirectConversation(data, "workspace_1", [
        "user_1",
        "user_2",
      ])?.id
    ).toBe("latest")
    expect(
      findWorkspaceDirectConversation(data, "workspace_2", [
        "user_1",
        "user_2",
      ])
    ).toBeNull()
  })
})
