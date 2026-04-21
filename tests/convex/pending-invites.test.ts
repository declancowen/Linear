import { describe, expect, it } from "vitest"

import { getPendingInvitesForEmail } from "@/convex/app/data"

type RecordWithId = {
  _id: string
  [key: string]: unknown
}

function createQuery(records: RecordWithId[]) {
  return {
    withIndex: (
      _indexName: string,
      build?: (query: {
        eq: (field: string, value: unknown) => unknown
      }) => unknown
    ) => {
      const filters: Array<{ field: string; value: unknown }> = []
      const queryApi = {
        eq(field: string, value: unknown) {
          filters.push({ field, value })
          return queryApi
        },
      }

      build?.(queryApi)

      const applyFilters = () =>
        records.filter((record) =>
          filters.every(({ field, value }) => record[field] === value)
        )

      return {
        collect: async () => applyFilters(),
        unique: async () => applyFilters()[0] ?? null,
      }
    },
  }
}

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
      query: (table: keyof typeof tables) => createQuery(tables[table]),
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
