import { describe, expect, it } from "vitest"

import { getPendingInvitesForEmail } from "@/convex/app/data"
import {
  createConvexTestQuery,
  type ConvexTestRecord,
} from "@/tests/lib/convex/test-db"

type RecordWithId = ConvexTestRecord

function createCtx(input?: {
  invites?: RecordWithId[]
  teams?: RecordWithId[]
  workspaces?: RecordWithId[]
}) {
  const tables = {
    invites: [...(input?.invites ?? [])],
    teams: [...(input?.teams ?? [])],
    workspaces: [...(input?.workspaces ?? [])],
  }

  return {
    db: {
      query: (table: keyof typeof tables) =>
        createConvexTestQuery(tables[table]),
    },
  }
}

describe("getPendingInvitesForEmail", () => {
  it("recomputes grouped invite role from surviving teams only", async () => {
    const ctx = createCtx({
      invites: [
        {
          _id: "invite_1_doc",
          id: "invite_1",
          batchId: "invite_batch_1",
          token: "token_1",
          normalizedEmail: "alex@example.com",
          email: "alex@example.com",
          workspaceId: "workspace_1",
          teamId: "team_deleted",
          role: "admin",
          expiresAt: "2026-12-31T00:00:00.000Z",
          acceptedAt: null,
          declinedAt: null,
          joinCode: "ABC123",
        },
        {
          _id: "invite_2_doc",
          id: "invite_2",
          batchId: "invite_batch_1",
          token: "token_1",
          normalizedEmail: "alex@example.com",
          email: "alex@example.com",
          workspaceId: "workspace_1",
          teamId: "team_surviving",
          role: "guest",
          expiresAt: "2026-12-31T00:00:00.000Z",
          acceptedAt: null,
          declinedAt: null,
          joinCode: "ABC123",
        },
      ],
      teams: [
        {
          _id: "team_surviving_doc",
          id: "team_surviving",
          workspaceId: "workspace_1",
          name: "Design",
        },
      ],
      workspaces: [
        {
          _id: "workspace_1_doc",
          id: "workspace_1",
          slug: "recipe-room",
          name: "Recipe Room",
          logoUrl: "",
        },
      ],
    })

    await expect(
      getPendingInvitesForEmail(ctx as never, "alex@example.com")
    ).resolves.toEqual([
      {
        invite: {
          id: "invite_1",
          token: "token_1",
          email: "alex@example.com",
          role: "guest",
          expiresAt: "2026-12-31T00:00:00.000Z",
          acceptedAt: null,
          declinedAt: null,
          joinCode: "ABC123",
        },
        teamNames: ["Design"],
        workspace: {
          id: "workspace_1",
          slug: "recipe-room",
          name: "Recipe Room",
          logoUrl: "",
        },
      },
    ])
  })
})
