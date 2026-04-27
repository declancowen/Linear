import { describe, expect, it, vi } from "vitest"

import {
  areCollaborationRangesEqual,
  createCollaborationAwarenessState,
} from "@/lib/collaboration/awareness"
import {
  createChatCollaborationRoomId,
  createDocumentCollaborationRoomId,
  isChatCollaborationRoomId,
  isDocumentCollaborationRoomId,
  parseCollaborationRoomId,
} from "@/lib/collaboration/rooms"
import {
  DEFAULT_COLLABORATION_LIMITS,
} from "@/lib/collaboration/limits"
import {
  COLLABORATION_PROTOCOL_VERSION,
  RICH_TEXT_COLLABORATION_SCHEMA_VERSION,
} from "@/lib/collaboration/protocol"
import { recordCollaborationEvent } from "@/lib/collaboration/observability"
import {
  createDocumentSessionBootstrap,
  parseCollaborationSessionTokenClaims,
  safeParseCollaborationSessionTokenClaims,
} from "@/lib/collaboration/transport"
import {
  createChannelFeedScopeKey,
  createConversationThreadScopeKey,
  createDocumentDetailScopeKey,
  createReadModelScopeKey,
  createShellContextScopeKey,
  createWorkspaceMembershipScopeKey,
  parseReadModelScopeKey,
  READ_MODEL_SCOPE_KINDS,
} from "@/lib/scoped-sync/scope-keys"

describe("collaboration foundation contracts", () => {
  it("records collaboration events without content or token payloads", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {})

    recordCollaborationEvent({
      event: "flush_succeeded",
      roomId: "doc:doc_123",
      documentId: "doc_123",
      sessionId: "session_1",
      userId: "user_1",
      durationMs: 12,
    })

    expect(infoSpy).toHaveBeenCalledWith("[collaboration]", {
      event: "flush_succeeded",
      roomId: "doc:doc_123",
      documentId: "doc_123",
      sessionId: "session_1",
      userId: "user_1",
      durationMs: 12,
    })
    expect(JSON.stringify(infoSpy.mock.calls[0])).not.toContain("token")
    expect(JSON.stringify(infoSpy.mock.calls[0])).not.toContain("content")

    infoSpy.mockRestore()
  })

  it("creates and parses document collaboration room ids", () => {
    const roomId = createDocumentCollaborationRoomId("doc_123")
    const chatRoomId = createChatCollaborationRoomId("conversation_123")

    expect(roomId).toBe("doc:doc_123")
    expect(parseCollaborationRoomId(roomId)).toEqual({
      kind: "doc",
      roomId: "doc:doc_123",
      entityId: "doc_123",
    })
    expect(chatRoomId).toBe("chat:conversation_123")
    expect(parseCollaborationRoomId(chatRoomId)).toEqual({
      kind: "chat",
      roomId: "chat:conversation_123",
      entityId: "conversation_123",
    })
    expect(isDocumentCollaborationRoomId(roomId, "doc_123")).toBe(true)
    expect(isDocumentCollaborationRoomId(roomId, "doc_456")).toBe(false)
    expect(isChatCollaborationRoomId(chatRoomId, "conversation_123")).toBe(true)
    expect(isChatCollaborationRoomId(chatRoomId, "conversation_456")).toBe(false)
    expect(parseCollaborationRoomId("doc:bad:id")).toBeNull()
  })

  it("validates collaboration session claims against the app-owned room contract", () => {
    const parsed = safeParseCollaborationSessionTokenClaims({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_123",
      documentId: "doc_123",
      role: "editor",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      protocolVersion: COLLABORATION_PROTOCOL_VERSION,
      schemaVersion: RICH_TEXT_COLLABORATION_SCHEMA_VERSION,
      iat: 100,
      exp: 200,
    })

    expect(parsed).toEqual({
      success: true,
      data: {
        kind: "doc",
        sub: "user_1",
        roomId: "doc:doc_123",
        documentId: "doc_123",
        role: "editor",
        sessionId: "session_1",
        workspaceId: "workspace_1",
        protocolVersion: COLLABORATION_PROTOCOL_VERSION,
        schemaVersion: RICH_TEXT_COLLABORATION_SCHEMA_VERSION,
        iat: 100,
        exp: 200,
      },
    })

    expect(
      safeParseCollaborationSessionTokenClaims({
        kind: "doc",
        sub: "user_1",
        roomId: "doc:doc_456",
        documentId: "doc_123",
        role: "editor",
        sessionId: "session_1",
        protocolVersion: COLLABORATION_PROTOCOL_VERSION,
        schemaVersion: RICH_TEXT_COLLABORATION_SCHEMA_VERSION,
        exp: 200,
      })
    ).toEqual({
      success: false,
      error: "roomId must match the document collaboration room",
    })

    expect(() =>
      parseCollaborationSessionTokenClaims({
        kind: "doc",
        sub: "user_1",
        roomId: "doc:doc_123",
        documentId: "doc_123",
        role: "author",
        sessionId: "session_1",
        protocolVersion: COLLABORATION_PROTOCOL_VERSION,
        schemaVersion: RICH_TEXT_COLLABORATION_SCHEMA_VERSION,
        exp: 200,
      })
    ).toThrow("role must be viewer or editor")

    expect(
      safeParseCollaborationSessionTokenClaims({
        kind: "doc",
        sub: "user_1",
        roomId: "doc:doc_123",
        documentId: "doc_123",
        role: "editor",
        sessionId: "session_1",
        exp: 200,
      })
    ).toEqual({
      success: false,
      error: "protocolVersion is required",
    })

    expect(
      safeParseCollaborationSessionTokenClaims({
        kind: "doc",
        sub: "user_1",
        roomId: "doc:doc_123",
        documentId: "doc_123",
        role: "editor",
        sessionId: "session_1",
        protocolVersion: COLLABORATION_PROTOCOL_VERSION,
        schemaVersion: 0,
        exp: 200,
      })
    ).toEqual({
      success: false,
      error: "schemaVersion is unsupported",
    })

    expect(
      safeParseCollaborationSessionTokenClaims({
        kind: "chat",
        sub: "user_1",
        roomId: "chat:conversation_123",
        conversationId: "conversation_123",
        sessionId: "session_2",
        exp: 200,
      })
    ).toEqual({
      success: true,
      data: {
        kind: "chat",
        sub: "user_1",
        roomId: "chat:conversation_123",
        conversationId: "conversation_123",
        sessionId: "session_2",
        exp: 200,
      },
    })

    expect(
      safeParseCollaborationSessionTokenClaims({
        kind: "chat",
        sub: "user_1",
        roomId: "chat:conversation_999",
        conversationId: "conversation_123",
        sessionId: "session_2",
        exp: 200,
      })
    ).toEqual({
      success: false,
      error: "roomId must match the chat collaboration room",
    })
  })

  it("builds collaboration awareness state with sanitized optional fields", () => {
    expect(
      createCollaborationAwarenessState({
        userId: "user_1",
        sessionId: "session_1",
        name: " Alex ",
        avatarUrl: " ",
        color: " blue ",
        typing: true,
        activeBlockId: " block_2 ",
        cursor: {
          anchor: 3,
          head: 3,
        },
        selection: {
          anchor: -1,
          head: 4,
        },
      })
    ).toEqual({
      userId: "user_1",
      sessionId: "session_1",
      name: "Alex",
      avatarUrl: null,
      color: "blue",
      typing: true,
      activeBlockId: "block_2",
      cursor: {
        anchor: 3,
        head: 3,
      },
      cursorSide: null,
      selection: null,
    })

    expect(
      areCollaborationRangesEqual(
        {
          anchor: 1,
          head: 5,
        },
        {
          anchor: 1,
          head: 5,
        }
      )
    ).toBe(true)
  })

  it("creates bootstrap payloads from the app-owned document contract", () => {
    expect(
      createDocumentSessionBootstrap({
        documentId: "doc_123",
        token: "token_1",
        serviceUrl: "https://realtime.example.com",
        role: "viewer",
        limits: DEFAULT_COLLABORATION_LIMITS,
      })
    ).toEqual({
      roomId: "doc:doc_123",
      documentId: "doc_123",
      token: "token_1",
      serviceUrl: "https://realtime.example.com",
      role: "viewer",
      protocolVersion: COLLABORATION_PROTOCOL_VERSION,
      schemaVersion: RICH_TEXT_COLLABORATION_SCHEMA_VERSION,
      limits: DEFAULT_COLLABORATION_LIMITS,
    })
  })

  it("creates and parses scoped read-model keys", () => {
    expect(createShellContextScopeKey()).toBe("shell-context")
    expect(createWorkspaceMembershipScopeKey("workspace_1")).toBe(
      "workspace-membership:workspace_1"
    )
    expect(createDocumentDetailScopeKey("doc_123")).toBe(
      "document-detail:doc_123"
    )
    expect(createConversationThreadScopeKey("conversation_1")).toBe(
      "conversation-thread:conversation_1"
    )
    expect(createChannelFeedScopeKey("channel_1")).toBe("channel-feed:channel_1")
    expect(
      parseReadModelScopeKey("document-detail:doc_123")
    ).toEqual({
      kind: READ_MODEL_SCOPE_KINDS.documentDetail,
      parts: ["doc_123"],
      scopeKey: "document-detail:doc_123",
    })
    expect(parseReadModelScopeKey("shell-context:workspace_1")).toBeNull()
    expect(parseReadModelScopeKey("unsupported:thing")).toBeNull()
    expect(() =>
      createReadModelScopeKey(READ_MODEL_SCOPE_KINDS.shellContext, "workspace_1")
    ).toThrow("shell-context does not accept scope parts")
    expect(() =>
      createReadModelScopeKey(READ_MODEL_SCOPE_KINDS.documentDetail, "bad:id")
    ).toThrow("scope part 1 must use only letters, numbers, underscores, or hyphens")
  })
})
