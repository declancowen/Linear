import { getSchema, type JSONContent } from "@tiptap/core"
import { prosemirrorJSONToYDoc } from "@tiptap/y-tiptap"

import {
  COLLABORATION_PROTOCOL_VERSION,
  RICH_TEXT_COLLABORATION_SCHEMA_VERSION,
} from "@/lib/collaboration/protocol"
import { createRichTextBaseExtensions } from "@/lib/rich-text/extensions"
import { createSignedCollaborationToken } from "@/lib/server/collaboration-token"

const richTextSchema = getSchema(
  createRichTextBaseExtensions({
    includeCharacterCount: false,
  })
)

export const currentClientVersionQuery = `protocolVersion=${COLLABORATION_PROTOCOL_VERSION}&schemaVersion=${RICH_TEXT_COLLABORATION_SCHEMA_VERSION}`

type CollaborationDocumentRecord = {
  documentId: string
  kind:
    | "team-document"
    | "workspace-document"
    | "private-document"
    | "item-description"
  title: string
  content: string
  workspaceId: string
  teamId: string | null
  updatedAt: string
  updatedBy: string
  canEdit: boolean
  itemId: string | null
  itemUpdatedAt: string | null
  searchWorkspaceId: string
  teamMemberIds: string[]
  projectScopes: Array<{
    projectId: string
    scopeType: "team" | "workspace"
    scopeId: string
  }>
}

type DocumentTokenOptions = {
  documentId?: string
  roomId?: string
  role?: "editor" | "viewer"
  sessionId?: string
  sub?: string
  workspaceId?: string
  schemaVersion?: number
}

type RefreshTokenOptions = {
  documentId?: string
  roomId?: string
}

type ChatTokenOptions = {
  conversationId?: string
  roomId?: string
  sessionId?: string
  sub?: string
}

type DocumentConnectionRole = "editor" | "viewer"

type DocumentConnectionOptions = {
  documentId?: string
  roomId?: string
  role?: DocumentConnectionRole
  sessionId?: string
  sub?: string
  workspaceId?: string
}

type PartykitRoomOptions = {
  id?: string
  env?: Record<string, string | undefined>
  connections?: unknown[]
  getConnections?: () => unknown[]
  broadcast?: (message: string) => void
}

export function createRichTextJson(text: string): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text,
          },
        ],
      },
    ],
  }
}

export function createEmptyParagraphJson(): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
      },
    ],
  }
}

export function createYDocFromRichText(contentJson: JSONContent) {
  return prosemirrorJSONToYDoc(richTextSchema, contentJson, "default")
}

export function createDocumentConnectUrl(roomId: string) {
  return `http://127.0.0.1:1999/parties/main/${roomId}?${currentClientVersionQuery}`
}

export function createDocumentFlushUrl(roomId: string) {
  return `http://127.0.0.1:1999/parties/main/${roomId}?action=flush&${currentClientVersionQuery}`
}

export function createDocumentRefreshUrl(roomId: string) {
  return `http://127.0.0.1:1999/parties/main/${roomId}?action=refresh`
}

export function createDocumentConnectRequest(roomId: string, token: string) {
  return new Request(createDocumentConnectUrl(roomId), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export function createCollaborationDocumentRecord(
  overrides: Partial<CollaborationDocumentRecord> = {}
): CollaborationDocumentRecord {
  return {
    documentId: "doc_team_1",
    kind: "team-document",
    title: "Doc",
    content: "<p>Canonical content</p>",
    workspaceId: "workspace_1",
    teamId: "team_1",
    updatedAt: "2026-04-22T00:00:00.000Z",
    updatedBy: "user_1",
    canEdit: true,
    itemId: null,
    itemUpdatedAt: null,
    searchWorkspaceId: "workspace_1",
    teamMemberIds: ["user_1"],
    projectScopes: [],
    ...overrides,
  }
}

export function createDocumentToken(options: DocumentTokenOptions = {}) {
  const documentId = options.documentId ?? "doc_team_1"
  const roomId = options.roomId ?? `doc:${documentId}`

  return createSignedCollaborationToken({
    kind: "doc",
    sub: options.sub ?? "user_1",
    roomId,
    documentId,
    role: options.role ?? "editor",
    sessionId: options.sessionId ?? "session_1",
    workspaceId: options.workspaceId ?? "workspace_1",
    schemaVersion: options.schemaVersion,
    exp: Math.floor(Date.now() / 1000) + 60,
  })
}

export function createRefreshToken(options: RefreshTokenOptions = {}) {
  const documentId = options.documentId ?? "doc_team_1"
  const roomId = options.roomId ?? `doc:${documentId}`

  return createSignedCollaborationToken({
    kind: "internal-refresh",
    sub: "server",
    roomId,
    documentId,
    action: "refresh",
    protocolVersion: COLLABORATION_PROTOCOL_VERSION,
    exp: Math.floor(Date.now() / 1000) + 60,
  })
}

export function createChatToken(options: ChatTokenOptions = {}) {
  const conversationId = options.conversationId ?? "conversation_1"
  const roomId = options.roomId ?? `chat:${conversationId}`

  return createSignedCollaborationToken({
    kind: "chat",
    sub: options.sub ?? "user_1",
    roomId,
    conversationId,
    sessionId: options.sessionId ?? "session_1",
    exp: Math.floor(Date.now() / 1000) + 60,
  })
}

export function createFlushRequest(
  roomId: string,
  token: string,
  body: unknown
) {
  return new Request(createDocumentFlushUrl(roomId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

export function createRefreshRequest(
  roomId: string,
  token: string,
  body: unknown
) {
  return new Request(createDocumentRefreshUrl(roomId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

export function createDocumentConnection(
  options: DocumentConnectionOptions = {}
) {
  const documentId = options.documentId ?? "doc_team_1"

  return {
    state: {
      kind: "doc",
      claims: {
        kind: "doc",
        sub: options.sub ?? "user_2",
        roomId: options.roomId ?? `doc:${documentId}`,
        documentId,
        role: options.role ?? "editor",
        sessionId: options.sessionId ?? "session_live",
        workspaceId: options.workspaceId ?? "workspace_1",
        exp: Math.floor(Date.now() / 1000) + 60,
      },
    },
  }
}

export function createAdmissionConnection(role: DocumentConnectionRole) {
  return {
    state: {
      kind: "doc",
      claims: {
        role,
      },
    },
  }
}

export function createPartykitRoom(options: PartykitRoomOptions = {}) {
  return {
    id: options.id ?? "doc:doc_team_1",
    env: {
      COLLABORATION_TOKEN_SECRET: process.env.COLLABORATION_TOKEN_SECRET,
      CONVEX_URL: "https://convex-dev.example",
      CONVEX_SERVER_TOKEN: "server-token",
      ...options.env,
    },
    getConnections: options.getConnections ?? (() => options.connections ?? []),
    broadcast: options.broadcast,
  }
}
