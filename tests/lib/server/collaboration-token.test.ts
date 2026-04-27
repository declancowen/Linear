import { describe, expect, it } from "vitest"

import {
  createSignedCollaborationToken,
  verifySignedCollaborationToken,
} from "@/lib/server/collaboration-token"

describe("collaboration token helpers", () => {
  it("signs and verifies collaboration session tokens", () => {
    process.env.COLLABORATION_TOKEN_SECRET = "test-collaboration-token-secret"

    const token = createSignedCollaborationToken({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_1",
      documentId: "doc_1",
      role: "editor",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      iat: 100,
      exp: 200,
    })

    expect(verifySignedCollaborationToken(token)).toEqual({
      kind: "doc",
      sub: "user_1",
      roomId: "doc:doc_1",
      documentId: "doc_1",
      role: "editor",
      sessionId: "session_1",
      workspaceId: "workspace_1",
      iat: 100,
      exp: 200,
    })
  })
})
