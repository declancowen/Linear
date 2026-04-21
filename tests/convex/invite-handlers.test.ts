import { beforeEach, describe, expect, it, vi } from "vitest"

const assertServerTokenMock = vi.fn()
const createIdMock = vi.fn()
const getNowMock = vi.fn()
const mergeMembershipRoleMock = vi.fn()
const normalizeEmailAddressMock = vi.fn((email: string) => email.toLowerCase())

const requireTeamAdminAccessMock = vi.fn()
const requireWorkspaceAdminAccessMock = vi.fn()

const createNotificationMock = vi.fn(
  (
    userId: string,
    actorId: string,
    message: string,
    entityType: string,
    entityId: string,
    notificationType: string
  ) => ({
    id: `notification_${entityId}`,
    userId,
    actorId,
    message,
    entityType,
    entityId,
    type: notificationType,
  })
)

const insertAuditEventMock = vi.fn()
const archiveInviteNotificationsMock = vi.fn()
const syncTeamConversationMembershipsMock = vi.fn()
const queueEmailJobsMock = vi.fn()
const buildTeamInviteEmailJobsMock = vi.fn()

const getActiveInvitesForTeamAndEmailMock = vi.fn()
const listInvitesByBatchIdMock = vi.fn()
const listInvitesByTokenMock = vi.fn()
const getEffectiveRoleMock = vi.fn()
const getInviteDocMock = vi.fn()
const getTeamByJoinCodeMock = vi.fn()
const getTeamBySlugMock = vi.fn()
const getTeamDocMock = vi.fn()
const getUserByEmailMock = vi.fn()
const getUserDocMock = vi.fn()
const getWorkspaceDocMock = vi.fn()
const setCurrentWorkspaceForUserMock = vi.fn()
const syncWorkspaceMembershipRoleFromTeamsMock = vi.fn()

vi.mock("@/convex/app/core", () => ({
  assertServerToken: assertServerTokenMock,
  createId: createIdMock,
  getNow: getNowMock,
  mergeMembershipRole: mergeMembershipRoleMock,
  normalizeEmailAddress: normalizeEmailAddressMock,
  createSlug: (value: string) => value,
}))

vi.mock("@/convex/app/access", () => ({
  requireTeamAdminAccess: requireTeamAdminAccessMock,
  requireWorkspaceAdminAccess: requireWorkspaceAdminAccessMock,
  WORKSPACE_ADMIN_ACCESS_ERROR: "Only workspace admins can perform this action",
}))

vi.mock("@/convex/app/collaboration_utils", () => ({
  createNotification: createNotificationMock,
}))

vi.mock("@/convex/app/audit", () => ({
  insertAuditEvent: insertAuditEventMock,
}))

vi.mock("@/convex/app/notifications", () => ({
  archiveInviteNotifications: archiveInviteNotificationsMock,
}))

vi.mock("@/convex/app/conversations", () => ({
  syncTeamConversationMemberships: syncTeamConversationMembershipsMock,
}))

vi.mock("@/convex/app/email_job_handlers", () => ({
  queueEmailJobs: queueEmailJobsMock,
}))

vi.mock("@/lib/email/builders", () => ({
  buildTeamInviteEmailJobs: buildTeamInviteEmailJobsMock,
}))

vi.mock("@/convex/app/data", () => ({
  getActiveInvitesForTeamAndEmail: getActiveInvitesForTeamAndEmailMock,
  listInvitesByBatchId: listInvitesByBatchIdMock,
  listInvitesByToken: listInvitesByTokenMock,
  getEffectiveRole: getEffectiveRoleMock,
  getInviteDoc: getInviteDocMock,
  getTeamByJoinCode: getTeamByJoinCodeMock,
  getTeamBySlug: getTeamBySlugMock,
  getTeamDoc: getTeamDocMock,
  getUserByEmail: getUserByEmailMock,
  getUserDoc: getUserDocMock,
  getWorkspaceDoc: getWorkspaceDocMock,
  setCurrentWorkspaceForUser: setCurrentWorkspaceForUserMock,
  syncWorkspaceMembershipRoleFromTeams: syncWorkspaceMembershipRoleFromTeamsMock,
}))

type RecordWithId = {
  _id: string
  [key: string]: unknown
}

function createQuery(records: RecordWithId[]) {
  return {
    withIndex: (
      _indexName: string,
      build?: (query: { eq: (field: string, value: unknown) => unknown }) => unknown
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
  notifications?: RecordWithId[]
  teamMemberships?: RecordWithId[]
}) {
  const tables = {
    invites: [...(input?.invites ?? [])],
    notifications: [...(input?.notifications ?? [])],
    teamMemberships: [...(input?.teamMemberships ?? [])],
  }

  return {
    tables,
    db: {
      insert: vi.fn(
        async (table: keyof typeof tables, value: Record<string, unknown>) => {
          const nextId =
            typeof value.id === "string"
              ? `${value.id}_doc`
              : `${table}_${tables[table].length + 1}_doc`

          tables[table].push({
            ...value,
            _id: nextId,
          })
        }
      ),
      patch: vi.fn(async (docId: string, patch: Record<string, unknown>) => {
        for (const table of Object.values(tables)) {
          const record = table.find((entry) => entry._id === docId)

          if (record) {
            Object.assign(record, patch)
            return
          }
        }
      }),
      delete: vi.fn(async (docId: string) => {
        for (const table of Object.values(tables)) {
          const index = table.findIndex((entry) => entry._id === docId)

          if (index >= 0) {
            table.splice(index, 1)
            return
          }
        }
      }),
      query: (table: keyof typeof tables) => createQuery(tables[table]),
    },
  }
}

function mergeRole(
  current: string | null | undefined,
  next: string | null | undefined
) {
  const rank: Record<string, number> = {
    guest: 0,
    viewer: 1,
    member: 2,
    admin: 3,
  }

  if (!current) {
    return next ?? "viewer"
  }

  if (!next) {
    return current
  }

  return rank[next] > rank[current] ? next : current
}

describe("invite handlers", () => {
  beforeEach(() => {
    assertServerTokenMock.mockReset()
    createIdMock.mockReset()
    getNowMock.mockReset()
    mergeMembershipRoleMock.mockReset()
    normalizeEmailAddressMock.mockClear()
    requireTeamAdminAccessMock.mockReset()
    requireWorkspaceAdminAccessMock.mockReset()
    createNotificationMock.mockClear()
    insertAuditEventMock.mockReset()
    archiveInviteNotificationsMock.mockReset()
    syncTeamConversationMembershipsMock.mockReset()
    queueEmailJobsMock.mockReset()
    buildTeamInviteEmailJobsMock.mockReset()
    getActiveInvitesForTeamAndEmailMock.mockReset()
    listInvitesByBatchIdMock.mockReset()
    listInvitesByTokenMock.mockReset()
    getEffectiveRoleMock.mockReset()
    getInviteDocMock.mockReset()
    getTeamByJoinCodeMock.mockReset()
    getTeamBySlugMock.mockReset()
    getTeamDocMock.mockReset()
    getUserByEmailMock.mockReset()
    getUserDocMock.mockReset()
    getWorkspaceDocMock.mockReset()
    setCurrentWorkspaceForUserMock.mockReset()
    syncWorkspaceMembershipRoleFromTeamsMock.mockReset()

    let inviteCounter = 0
    let batchCounter = 0
    let tokenCounter = 0

    createIdMock.mockImplementation((prefix: string) => {
      if (prefix === "invite") {
        inviteCounter += 1
        return `invite_${inviteCounter}`
      }

      if (prefix === "invite_batch") {
        batchCounter += 1
        return `invite_batch_${batchCounter}`
      }

      if (prefix === "token") {
        tokenCounter += 1
        return `token_${tokenCounter}`
      }

      return `${prefix}_1`
    })
    getNowMock.mockReturnValue("2026-04-21T12:00:00.000Z")
    mergeMembershipRoleMock.mockImplementation(mergeRole)
    buildTeamInviteEmailJobsMock.mockReturnValue([
      {
        kind: "invite",
        toEmail: "alex@example.com",
        subject: "Join Recipe Room",
        text: "Invite text",
        html: "<p>Invite html</p>",
      },
    ])
    insertAuditEventMock.mockResolvedValue(undefined)
    archiveInviteNotificationsMock.mockResolvedValue(undefined)
    syncTeamConversationMembershipsMock.mockResolvedValue(undefined)
    queueEmailJobsMock.mockResolvedValue(undefined)
    setCurrentWorkspaceForUserMock.mockResolvedValue(undefined)
    syncWorkspaceMembershipRoleFromTeamsMock.mockResolvedValue(undefined)
    listInvitesByBatchIdMock.mockResolvedValue([])
    listInvitesByTokenMock.mockResolvedValue([])
  })

  it("creates one logical invite batch for multiple teams in the same workspace", async () => {
    const { createInviteHandler } = await import("@/convex/app/invite_handlers")
    const ctx = createCtx()

    getTeamDocMock
      .mockResolvedValueOnce({
        id: "team_1",
        workspaceId: "workspace_1",
        name: "Core",
        settings: { joinCode: "CORE123" },
      })
      .mockResolvedValueOnce({
        id: "team_2",
        workspaceId: "workspace_1",
        name: "Design",
        settings: { joinCode: "DESIGN123" },
      })
    getEffectiveRoleMock.mockResolvedValue("member")
    getUserByEmailMock.mockResolvedValue({
      id: "user_2",
    })
    getWorkspaceDocMock.mockResolvedValue({
      id: "workspace_1",
      name: "Recipe Room",
    })

    const result = await createInviteHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      origin: "https://linear.test",
      teamIds: ["team_1", "team_2"],
      email: "Alex@example.com",
      role: "member",
    })

    expect(result).toMatchObject({
      batchId: "invite_batch_1",
      token: "token_1",
      inviteIds: ["invite_1", "invite_2"],
    })
    expect(ctx.tables.invites).toHaveLength(2)
    expect(ctx.tables.invites[0]).toMatchObject({
      batchId: "invite_batch_1",
      token: "token_1",
      workspaceId: "workspace_1",
      teamId: "team_1",
      normalizedEmail: "alex@example.com",
    })
    expect(ctx.tables.invites[1]).toMatchObject({
      batchId: "invite_batch_1",
      token: "token_1",
      workspaceId: "workspace_1",
      teamId: "team_2",
      normalizedEmail: "alex@example.com",
    })
    expect(buildTeamInviteEmailJobsMock).toHaveBeenCalledWith({
      origin: "https://linear.test",
      invites: [
        {
          email: "Alex@example.com",
          workspaceName: "Recipe Room",
          teamNames: ["Core", "Design"],
          role: "member",
          inviteToken: "token_1",
        },
      ],
    })
    expect(queueEmailJobsMock).toHaveBeenCalledTimes(1)
  })

  it("retries invite batch ids and tokens until they are unique", async () => {
    const { createInviteHandler } = await import("@/convex/app/invite_handlers")
    const ctx = createCtx()

    listInvitesByBatchIdMock
      .mockResolvedValueOnce([{ id: "existing_batch_member" }])
      .mockResolvedValueOnce([])
    listInvitesByTokenMock
      .mockResolvedValueOnce([{ id: "existing_token_member" }])
      .mockResolvedValueOnce([])
    getTeamDocMock.mockResolvedValue({
      id: "team_1",
      workspaceId: "workspace_1",
      name: "Core",
      settings: { joinCode: "CORE123" },
    })
    getEffectiveRoleMock.mockResolvedValue("member")
    getUserByEmailMock.mockResolvedValue({
      id: "user_2",
    })
    getWorkspaceDocMock.mockResolvedValue({
      id: "workspace_1",
      name: "Recipe Room",
    })

    const result = await createInviteHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      origin: "https://linear.test",
      teamIds: ["team_1"],
      email: "Alex@example.com",
      role: "member",
    })

    expect(result).toMatchObject({
      batchId: "invite_batch_2",
      token: "token_2",
      inviteIds: ["invite_1"],
    })
    expect(listInvitesByBatchIdMock).toHaveBeenCalledTimes(2)
    expect(listInvitesByTokenMock).toHaveBeenCalledTimes(2)
  })

  it("rejects invite batches that span multiple workspaces", async () => {
    const { createInviteHandler } = await import("@/convex/app/invite_handlers")
    const ctx = createCtx()

    getTeamDocMock
      .mockResolvedValueOnce({
        id: "team_1",
        workspaceId: "workspace_1",
        name: "Core",
        settings: { joinCode: "CORE123" },
      })
      .mockResolvedValueOnce({
        id: "team_2",
        workspaceId: "workspace_2",
        name: "Design",
        settings: { joinCode: "DESIGN123" },
      })

    await expect(
      createInviteHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        origin: "https://linear.test",
        teamIds: ["team_1", "team_2"],
        email: "alex@example.com",
        role: "member",
      })
    ).rejects.toThrow("Invites must target teams in the same workspace")

    expect(ctx.tables.invites).toHaveLength(0)
    expect(queueEmailJobsMock).not.toHaveBeenCalled()
  })

  it("limits team-admin cancellation to the selected team invite", async () => {
    const { cancelInviteHandler } = await import("@/convex/app/invite_handlers")
    const ctx = createCtx({
      notifications: [
        {
          _id: "notification_1_doc",
          id: "notification_1",
          entityType: "invite",
          entityId: "invite_1",
        },
        {
          _id: "notification_2_doc",
          id: "notification_2",
          entityType: "invite",
          entityId: "invite_2",
        },
      ],
    })

    getInviteDocMock.mockResolvedValue({
      _id: "invite_1_doc",
      id: "invite_1",
      batchId: "invite_batch_1",
      workspaceId: "workspace_1",
      teamId: "team_1",
      email: "alex@example.com",
      role: "member",
      acceptedAt: null,
      declinedAt: null,
    })
    requireWorkspaceAdminAccessMock.mockRejectedValue(
      new Error("Only workspace admins can perform this action")
    )
    requireTeamAdminAccessMock.mockResolvedValue("admin")
    getTeamDocMock.mockResolvedValue({
      id: "team_1",
      name: "Core",
    })
    getWorkspaceDocMock.mockResolvedValue({
      id: "workspace_1",
      name: "Recipe Room",
    })

    const result = await cancelInviteHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      inviteId: "invite_1",
    })

    expect(result.cancelledInviteIds).toEqual(["invite_1"])
    expect(listInvitesByBatchIdMock).not.toHaveBeenCalled()
    expect(ctx.db.delete).toHaveBeenCalledWith("notification_1_doc")
    expect(ctx.db.delete).toHaveBeenCalledWith("invite_1_doc")
    expect(ctx.db.delete).not.toHaveBeenCalledWith("notification_2_doc")
  })

  it("limits workspace-admin batch cancellation to invites in the same workspace", async () => {
    const { cancelInviteHandler } = await import("@/convex/app/invite_handlers")
    const ctx = createCtx({
      notifications: [
        {
          _id: "notification_1_doc",
          id: "notification_1",
          entityType: "invite",
          entityId: "invite_1",
        },
        {
          _id: "notification_2_doc",
          id: "notification_2",
          entityType: "invite",
          entityId: "invite_2",
        },
      ],
    })

    getInviteDocMock.mockResolvedValue({
      _id: "invite_1_doc",
      id: "invite_1",
      batchId: "invite_batch_1",
      workspaceId: "workspace_1",
      teamId: "team_1",
      email: "alex@example.com",
      role: "member",
      acceptedAt: null,
      declinedAt: null,
    })
    requireWorkspaceAdminAccessMock.mockResolvedValue("admin")
    listInvitesByBatchIdMock.mockResolvedValue([
      {
        _id: "invite_1_doc",
        id: "invite_1",
        batchId: "invite_batch_1",
        workspaceId: "workspace_1",
        teamId: "team_1",
        email: "alex@example.com",
        role: "member",
        acceptedAt: null,
        declinedAt: null,
      },
      {
        _id: "invite_2_doc",
        id: "invite_2",
        batchId: "invite_batch_1",
        workspaceId: "workspace_2",
        teamId: "team_2",
        email: "alex@example.com",
        role: "member",
        acceptedAt: null,
        declinedAt: null,
      },
    ])
    getTeamDocMock.mockResolvedValue({
      id: "team_1",
      name: "Core",
    })
    getWorkspaceDocMock.mockResolvedValue({
      id: "workspace_1",
      name: "Recipe Room",
    })

    const result = await cancelInviteHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      inviteId: "invite_1",
    })

    expect(result.cancelledInviteIds).toEqual(["invite_1"])
    expect(ctx.db.delete).toHaveBeenCalledWith("notification_1_doc")
    expect(ctx.db.delete).toHaveBeenCalledWith("invite_1_doc")
    expect(ctx.db.delete).not.toHaveBeenCalledWith("notification_2_doc")
    expect(ctx.db.delete).not.toHaveBeenCalledWith("invite_2_doc")
  })

  it("rethrows unexpected workspace access errors instead of downgrading to team scope", async () => {
    const { cancelInviteHandler } = await import("@/convex/app/invite_handlers")
    const ctx = createCtx()

    getInviteDocMock.mockResolvedValue({
      _id: "invite_1_doc",
      id: "invite_1",
      batchId: "invite_batch_1",
      workspaceId: "workspace_1",
      teamId: "team_1",
      email: "alex@example.com",
      role: "member",
      acceptedAt: null,
      declinedAt: null,
    })
    requireWorkspaceAdminAccessMock.mockRejectedValue(new Error("datastore offline"))

    await expect(
      cancelInviteHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        inviteId: "invite_1",
      })
    ).rejects.toThrow("datastore offline")
    expect(requireTeamAdminAccessMock).not.toHaveBeenCalled()
  })

  it("accepts every pending invite that shares the token", async () => {
    const { acceptInviteHandler } = await import("@/convex/app/invite_handlers")
    const ctx = createCtx()

    listInvitesByTokenMock.mockResolvedValue([
      {
        _id: "invite_1_doc",
        id: "invite_1",
        batchId: "invite_batch_1",
        token: "token_1",
        workspaceId: "workspace_1",
        teamId: "team_1",
        role: "member",
        acceptedAt: null,
        declinedAt: null,
      },
      {
        _id: "invite_2_doc",
        id: "invite_2",
        batchId: "invite_batch_1",
        token: "token_1",
        workspaceId: "workspace_1",
        teamId: "team_2",
        role: "member",
        acceptedAt: null,
        declinedAt: null,
      },
    ])
    getWorkspaceDocMock.mockResolvedValue({
      id: "workspace_1",
      slug: "recipe-room",
      workosOrganizationId: "org_1",
    })

    const result = await acceptInviteHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      token: "token_1",
    })

    expect(result).toMatchObject({
      teamSlug: null,
      workspaceId: "workspace_1",
      workspaceSlug: "recipe-room",
      workosOrganizationId: "org_1",
    })
    expect(ctx.tables.teamMemberships).toHaveLength(2)
    expect(syncTeamConversationMembershipsMock).toHaveBeenCalledTimes(2)
    expect(syncWorkspaceMembershipRoleFromTeamsMock).toHaveBeenCalledWith(
      ctx,
      {
        workspaceId: "workspace_1",
        userId: "user_1",
        fallbackRole: "member",
      }
    )
    expect(archiveInviteNotificationsMock).toHaveBeenCalledWith(ctx, {
      userId: "user_1",
      inviteIds: ["invite_1", "invite_2"],
    })
  })

  it("ignores colliding token invites outside the representative batch", async () => {
    const { acceptInviteHandler } = await import("@/convex/app/invite_handlers")
    const ctx = createCtx()

    listInvitesByTokenMock.mockResolvedValue([
      {
        _id: "invite_1_doc",
        id: "invite_1",
        batchId: "invite_batch_1",
        token: "token_1",
        workspaceId: "workspace_1",
        teamId: "team_1",
        role: "member",
        acceptedAt: null,
        declinedAt: null,
      },
      {
        _id: "invite_2_doc",
        id: "invite_2",
        batchId: "invite_batch_1",
        token: "token_1",
        workspaceId: "workspace_1",
        teamId: "team_2",
        role: "member",
        acceptedAt: null,
        declinedAt: null,
      },
      {
        _id: "invite_3_doc",
        id: "invite_3",
        batchId: "invite_batch_2",
        token: "token_1",
        workspaceId: "workspace_2",
        teamId: "team_3",
        role: "admin",
        acceptedAt: null,
        declinedAt: null,
      },
    ])
    getWorkspaceDocMock.mockResolvedValue({
      id: "workspace_1",
      slug: "recipe-room",
      workosOrganizationId: "org_1",
    })

    await acceptInviteHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      token: "token_1",
    })

    expect(ctx.tables.teamMemberships).toHaveLength(2)
    expect(ctx.tables.teamMemberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ teamId: "team_1", userId: "user_1" }),
        expect.objectContaining({ teamId: "team_2", userId: "user_1" }),
      ])
    )
    expect(ctx.tables.teamMemberships).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ teamId: "team_3", userId: "user_1" }),
      ])
    )
    expect(archiveInviteNotificationsMock).toHaveBeenCalledWith(ctx, {
      userId: "user_1",
      inviteIds: ["invite_1", "invite_2"],
    })
  })
})
