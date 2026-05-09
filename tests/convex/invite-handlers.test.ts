import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  createMutableConvexTestCtx,
  type ConvexTestRecord,
} from "@/tests/lib/convex/test-db"

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
const getTeamMembershipDocMock = vi.fn()
const getUserByEmailMock = vi.fn()
const getUserDocMock = vi.fn()
const getWorkspaceDocMock = vi.fn()
const resolveTeamByCodeSlugOrJoinCodeMock = vi.fn()
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
  getTeamMembershipDoc: getTeamMembershipDocMock,
  getUserByEmail: getUserByEmailMock,
  getUserDoc: getUserDocMock,
  getWorkspaceDoc: getWorkspaceDocMock,
  resolveTeamByCodeSlugOrJoinCode: resolveTeamByCodeSlugOrJoinCodeMock,
  setCurrentWorkspaceForUser: setCurrentWorkspaceForUserMock,
  syncWorkspaceMembershipRoleFromTeams:
    syncWorkspaceMembershipRoleFromTeamsMock,
}))

type RecordWithId = ConvexTestRecord

function createCtx(input?: {
  invites?: RecordWithId[]
  notifications?: RecordWithId[]
  teamMemberships?: RecordWithId[]
}) {
  return createMutableConvexTestCtx({
    invites: input?.invites ?? [],
    notifications: input?.notifications ?? [],
    teamMemberships: input?.teamMemberships ?? [],
  })
}

function mockInviteCancellationTarget() {
  getInviteDocMock.mockResolvedValue(
    createInviteRecord({
      id: "invite_1",
      teamId: "team_1",
    })
  )
  getTeamDocMock.mockResolvedValue({
    id: "team_1",
    name: "Core",
  })
  getWorkspaceDocMock.mockResolvedValue({
    id: "workspace_1",
    name: "Recipe Room",
  })
}

async function cancelInvite(ctx: ReturnType<typeof createCtx>) {
  const { cancelInviteHandler } = await import("@/convex/app/invite_handlers")

  return cancelInviteHandler(ctx as never, {
    serverToken: "server_token",
    currentUserId: "user_1",
    inviteId: "invite_1",
  })
}

async function createMemberInvite(
  ctx: ReturnType<typeof createCtx>,
  teamIds: string[]
) {
  const { createInviteHandler } = await import("@/convex/app/invite_handlers")

  return createInviteHandler(ctx as never, {
    serverToken: "server_token",
    currentUserId: "user_1",
    origin: "https://linear.test",
    teamIds,
    email: "Alex@example.com",
    role: "member",
  })
}

function expectOnlyInviteOneCancelled(ctx: ReturnType<typeof createCtx>) {
  expect(ctx.db.delete).toHaveBeenCalledWith("notification_1_doc")
  expect(ctx.db.delete).toHaveBeenCalledWith("invite_1_doc")
  expect(ctx.db.delete).not.toHaveBeenCalledWith("notification_2_doc")
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

function createInviteRecord(
  overrides: Partial<RecordWithId> & {
    id: string
    role?: string
    teamId: string
  }
): RecordWithId {
  return {
    _id: `${overrides.id}_doc`,
    batchId: "invite_batch_1",
    token: "token_1",
    workspaceId: "workspace_1",
    acceptedAt: null,
    declinedAt: null,
    email: "alex@example.com",
    role: "member",
    ...overrides,
  }
}

function createInviteRecords(
  ...records: Array<
    Partial<RecordWithId> & {
      id: string
      role?: string
      teamId: string
    }
  >
): RecordWithId[] {
  return records.map(createInviteRecord)
}

function createInviteNotification(inviteId: string): RecordWithId {
  return {
    _id: `${inviteId.replace("invite", "notification")}_doc`,
    id: inviteId.replace("invite", "notification"),
    entityType: "invite",
    entityId: inviteId,
  }
}

function createInviteNotifications(...inviteIds: string[]): RecordWithId[] {
  return inviteIds.map(createInviteNotification)
}

function seedDeletedTeamInviteBatch(role = "admin") {
  const invites = createInviteRecords({
    id: "invite_1",
    teamId: "team_missing",
    role,
  })
  const ctx = createCtx({
    invites,
    notifications: createInviteNotifications("invite_1"),
  })

  listInvitesByTokenMock.mockResolvedValue(invites)
  getTeamDocMock.mockResolvedValue(null)

  return ctx
}

function seedMixedDeletedTeamInviteBatch(survivingTeamReadCount: number) {
  const invites = createInviteRecords(
    {
      id: "invite_1",
      teamId: "team_missing",
      role: "admin",
    },
    {
      id: "invite_2",
      teamId: "team_2",
      role: "guest",
    }
  )
  const ctx = createCtx({
    invites,
    notifications: createInviteNotifications("invite_1", "invite_2"),
  })

  listInvitesByTokenMock.mockResolvedValue(invites)
  getTeamDocMock.mockResolvedValueOnce(null)
  for (let index = 0; index < survivingTeamReadCount; index += 1) {
    getTeamDocMock.mockResolvedValueOnce({
      id: "team_2",
      slug: "design",
    })
  }

  return ctx
}

function createInviteTokenArgs() {
  return {
    serverToken: "server_token",
    currentUserId: "user_1",
    token: "token_1",
  }
}

async function acceptInviteToken(ctx: ReturnType<typeof createCtx>) {
  const { acceptInviteHandler } = await import("@/convex/app/invite_handlers")

  return acceptInviteHandler(ctx as never, createInviteTokenArgs())
}

async function declineInviteToken(ctx: ReturnType<typeof createCtx>) {
  const { declineInviteHandler } = await import("@/convex/app/invite_handlers")

  return declineInviteHandler(ctx as never, createInviteTokenArgs())
}

async function expectInviteTokenNotFound(result: Promise<unknown>) {
  await expect(result).resolves.toEqual({
    error: "Invite not found",
    status: 404,
    code: "INVITE_NOT_FOUND",
  })
}

function expectDeletedInviteBatchRetired(ctx: ReturnType<typeof createCtx>) {
  expect(ctx.tables.invites).toHaveLength(0)
  expect(ctx.tables.notifications).toHaveLength(0)
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
    getTeamMembershipDocMock.mockReset()
    getUserByEmailMock.mockReset()
    getUserDocMock.mockReset()
    getWorkspaceDocMock.mockReset()
    resolveTeamByCodeSlugOrJoinCodeMock.mockReset()
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

    const result = await createMemberInvite(ctx, ["team_1", "team_2"])

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

    const result = await createMemberInvite(ctx, ["team_1"])

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
    const ctx = createCtx({
      notifications: createInviteNotifications("invite_1", "invite_2"),
    })

    mockInviteCancellationTarget()
    requireWorkspaceAdminAccessMock.mockRejectedValue(
      new Error("Only workspace admins can perform this action")
    )
    requireTeamAdminAccessMock.mockResolvedValue("admin")

    const result = await cancelInvite(ctx)

    expect(result.cancelledInviteIds).toEqual(["invite_1"])
    expect(listInvitesByBatchIdMock).not.toHaveBeenCalled()
    expectOnlyInviteOneCancelled(ctx)
  })

  it("limits workspace-admin batch cancellation to invites in the same workspace", async () => {
    const ctx = createCtx({
      notifications: createInviteNotifications("invite_1", "invite_2"),
    })

    mockInviteCancellationTarget()
    requireWorkspaceAdminAccessMock.mockResolvedValue("admin")
    listInvitesByBatchIdMock.mockResolvedValue(
      createInviteRecords(
        {
          id: "invite_1",
          teamId: "team_1",
        },
        {
          id: "invite_2",
          workspaceId: "workspace_2",
          teamId: "team_2",
        }
      )
    )

    const result = await cancelInvite(ctx)

    expect(result.cancelledInviteIds).toEqual(["invite_1"])
    expectOnlyInviteOneCancelled(ctx)
    expect(ctx.db.delete).not.toHaveBeenCalledWith("invite_2_doc")
  })

  it("rethrows unexpected workspace access errors instead of downgrading to team scope", async () => {
    const { cancelInviteHandler } = await import("@/convex/app/invite_handlers")
    const ctx = createCtx()

    getInviteDocMock.mockResolvedValue(
      createInviteRecord({
        id: "invite_1",
        teamId: "team_1",
      })
    )
    requireWorkspaceAdminAccessMock.mockRejectedValue(
      new Error("datastore offline")
    )

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

    listInvitesByTokenMock.mockResolvedValue(
      createInviteRecords(
        {
          id: "invite_1",
          teamId: "team_1",
        },
        {
          id: "invite_2",
          teamId: "team_2",
        }
      )
    )
    getTeamDocMock
      .mockResolvedValueOnce({
        id: "team_1",
        slug: "core",
      })
      .mockResolvedValueOnce({
        id: "team_2",
        slug: "design",
      })
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
    expect(syncWorkspaceMembershipRoleFromTeamsMock).toHaveBeenCalledWith(ctx, {
      workspaceId: "workspace_1",
      userId: "user_1",
      fallbackRole: "member",
    })
    expect(archiveInviteNotificationsMock).toHaveBeenCalledWith(ctx, {
      userId: "user_1",
      inviteIds: ["invite_1", "invite_2"],
    })
  })

  it("retires stale invite batches when every invited team has been deleted", async () => {
    const ctx = seedDeletedTeamInviteBatch()

    await expectInviteTokenNotFound(acceptInviteToken(ctx))

    expectDeletedInviteBatchRetired(ctx)
    expect(ctx.tables.teamMemberships).toHaveLength(0)
    expect(syncTeamConversationMembershipsMock).not.toHaveBeenCalled()
    expect(syncWorkspaceMembershipRoleFromTeamsMock).not.toHaveBeenCalled()
    expect(setCurrentWorkspaceForUserMock).not.toHaveBeenCalled()
    expect(archiveInviteNotificationsMock).not.toHaveBeenCalled()
  })

  it("accepts surviving teams and drops deleted teams from mixed invite batches", async () => {
    const { acceptInviteHandler } = await import("@/convex/app/invite_handlers")
    const ctx = seedMixedDeletedTeamInviteBatch(2)
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
      teamSlug: "design",
      workspaceId: "workspace_1",
      workspaceSlug: "recipe-room",
    })
    expect(ctx.tables.invites).toEqual([
      expect.objectContaining({
        id: "invite_2",
        acceptedAt: "2026-04-21T12:00:00.000Z",
      }),
    ])
    expect(ctx.tables.notifications).toEqual([
      expect.objectContaining({
        id: "notification_2",
        entityId: "invite_2",
      }),
    ])
    expect(ctx.tables.teamMemberships).toEqual([
      expect.objectContaining({
        teamId: "team_2",
        userId: "user_1",
        role: "guest",
      }),
    ])
    expect(syncWorkspaceMembershipRoleFromTeamsMock).toHaveBeenCalledWith(ctx, {
      workspaceId: "workspace_1",
      userId: "user_1",
      fallbackRole: "guest",
    })
    expect(archiveInviteNotificationsMock).toHaveBeenCalledWith(ctx, {
      userId: "user_1",
      inviteIds: ["invite_2"],
    })
  })

  it("retires stale invite batches when every declined team has been deleted", async () => {
    const ctx = seedDeletedTeamInviteBatch()

    await expectInviteTokenNotFound(declineInviteToken(ctx))

    expectDeletedInviteBatchRetired(ctx)
    expect(archiveInviteNotificationsMock).not.toHaveBeenCalled()
    expect(insertAuditEventMock).not.toHaveBeenCalled()
  })

  it("declines surviving teams and drops deleted teams from mixed invite batches", async () => {
    const { declineInviteHandler } = await import("@/convex/app/invite_handlers")
    const ctx = seedMixedDeletedTeamInviteBatch(1)

    const result = await declineInviteHandler(ctx as never, {
      serverToken: "server_token",
      currentUserId: "user_1",
      token: "token_1",
    })

    expect(result).toEqual({
      inviteId: "invite_2",
      declinedAt: "2026-04-21T12:00:00.000Z",
    })
    expect(ctx.tables.invites).toEqual([
      expect.objectContaining({
        id: "invite_2",
        declinedAt: "2026-04-21T12:00:00.000Z",
      }),
    ])
    expect(ctx.tables.notifications).toEqual([
      expect.objectContaining({
        id: "notification_2",
        entityId: "invite_2",
      }),
    ])
    expect(archiveInviteNotificationsMock).toHaveBeenCalledWith(ctx, {
      userId: "user_1",
      inviteIds: ["invite_2"],
    })
  })

  it("returns the declined conflict for already-declined invite batches", async () => {
    const { declineInviteHandler } = await import("@/convex/app/invite_handlers")
    const ctx = createCtx()

    listInvitesByTokenMock.mockResolvedValue(
      createInviteRecords({
        id: "invite_1",
        teamId: "team_1",
        declinedAt: "2026-04-20T12:00:00.000Z",
      })
    )

    await expect(
      declineInviteHandler(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        token: "token_1",
      })
    ).rejects.toThrow("Invite has been declined")
  })

  it("ignores colliding token invites outside the representative batch", async () => {
    const { acceptInviteHandler } = await import("@/convex/app/invite_handlers")
    const ctx = createCtx()

    listInvitesByTokenMock.mockResolvedValue(
      createInviteRecords(
        {
          id: "invite_1",
          teamId: "team_1",
        },
        {
          id: "invite_2",
          teamId: "team_2",
        },
        {
          id: "invite_3",
          batchId: "invite_batch_2",
          workspaceId: "workspace_2",
          teamId: "team_3",
          role: "admin",
        }
      )
    )
    getTeamDocMock
      .mockResolvedValueOnce({
        id: "team_1",
        slug: "core",
      })
      .mockResolvedValueOnce({
        id: "team_2",
        slug: "design",
      })
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

  it("resolves join-by-code context from team, user, invites, and membership", async () => {
    const { requireJoinTeamByCodeContext } = await import(
      "@/convex/app/invite_handlers"
    )
    const ctx = createCtx()

    await expect(
      requireJoinTeamByCodeContext(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        code: "missing",
      })
    ).rejects.toThrow("Join code not found")

    resolveTeamByCodeSlugOrJoinCodeMock.mockResolvedValue({
      id: "team_1",
      workspaceId: "workspace_1",
    })
    getUserDocMock.mockResolvedValue({
      id: "user_1",
      email: "alex@example.com",
    })
    getTeamMembershipDocMock.mockResolvedValue({
      role: "viewer",
    })
    getActiveInvitesForTeamAndEmailMock.mockResolvedValue([
      createInviteRecord({
        id: "invite_1",
        teamId: "team_1",
        role: "member",
      }),
    ])

    await expect(
      requireJoinTeamByCodeContext(ctx as never, {
        serverToken: "server_token",
        currentUserId: "user_1",
        code: "JOIN1234",
      })
    ).resolves.toMatchObject({
      existingMembership: {
        role: "viewer",
      },
      matchingInvites: [expect.objectContaining({ id: "invite_1" })],
      resolvedRole: "member",
      team: {
        id: "team_1",
      },
    })
    expect(getActiveInvitesForTeamAndEmailMock).toHaveBeenCalledWith(ctx, {
      email: "alex@example.com",
      teamId: "team_1",
    })
  })
})
