import type { MutationCtx } from "../_generated/server"

import { createId, getNow } from "./core"
import {
  requireEditableTeamAccess,
  requireEditableWorkspaceAccess,
  requireReadableTeamAccess,
  requireReadableWorkspaceAccess,
} from "./access"
import {
  getCallDoc,
  getConversationDoc,
  getTeamDoc,
  getWorkspaceDoc,
  type AppCtx,
} from "./data"
import { haveSameIds, normalizeUniqueIds } from "./collaboration_utils"

export async function getTeamMemberIds(ctx: AppCtx, teamId: string) {
  const memberships = await ctx.db
    .query("teamMemberships")
    .withIndex("by_team", (q) => q.eq("teamId", teamId))
    .collect()

  return memberships.map((membership) => membership.userId)
}

export async function getWorkspaceUserIds(ctx: AppCtx, workspaceId: string) {
  const workspace = await getWorkspaceDoc(ctx, workspaceId)
  const teams = (await ctx.db.query("teams").collect()).filter(
    (team) => team.workspaceId === workspaceId
  )
  const userIds = new Set<string>()

  if (workspace?.createdBy) {
    userIds.add(workspace.createdBy)
  }

  for (const team of teams) {
    for (const userId of await getTeamMemberIds(ctx, team.id)) {
      userIds.add(userId)
    }
  }

  return [...userIds]
}

export async function syncConversationParticipants(
  ctx: MutationCtx,
  conversation: Awaited<ReturnType<typeof getConversationDoc>>,
  participantIds: string[]
) {
  if (!conversation) {
    return
  }

  if (haveSameIds(conversation.participantIds, participantIds)) {
    return
  }

  await ctx.db.patch(conversation._id, {
    participantIds: normalizeUniqueIds(participantIds),
    updatedAt: getNow(),
  })
}

export async function findTeamChatConversation(ctx: AppCtx, teamId: string) {
  const conversations = await ctx.db
    .query("conversations")
    .withIndex("by_kind_scope", (q) =>
      q.eq("kind", "chat").eq("scopeType", "team").eq("scopeId", teamId)
    )
    .collect()

  return (
    conversations.find((conversation) => conversation.variant === "team") ??
    null
  )
}

export async function findWorkspaceDirectConversation(
  ctx: AppCtx,
  workspaceId: string,
  participantIds: string[]
) {
  const conversations = await ctx.db
    .query("conversations")
    .withIndex("by_kind_scope", (q) =>
      q
        .eq("kind", "chat")
        .eq("scopeType", "workspace")
        .eq("scopeId", workspaceId)
    )
    .collect()

  return (
    conversations
      .filter(
        (conversation) =>
          conversation.variant === "direct" &&
          haveSameIds(conversation.participantIds, participantIds)
      )
      .sort((left, right) =>
        right.lastActivityAt.localeCompare(left.lastActivityAt)
      )[0] ?? null
  )
}

async function findPrimaryChannelConversation(
  ctx: AppCtx,
  scopeType: "team" | "workspace",
  scopeId: string
) {
  const conversations = await ctx.db
    .query("conversations")
    .withIndex("by_kind_scope", (q) =>
      q.eq("kind", "channel").eq("scopeType", scopeType).eq("scopeId", scopeId)
    )
    .collect()

  return (
    conversations.sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
    )[0] ?? null
  )
}

export async function findPrimaryTeamChannelConversation(
  ctx: AppCtx,
  teamId: string
) {
  return findPrimaryChannelConversation(ctx, "team", teamId)
}

export async function findPrimaryWorkspaceChannelConversation(
  ctx: AppCtx,
  workspaceId: string
) {
  return findPrimaryChannelConversation(ctx, "workspace", workspaceId)
}

export async function ensureTeamChatConversation(
  ctx: MutationCtx,
  input: {
    teamId: string
    currentUserId: string
    teamName: string
    teamSummary: string
    title?: string
    description?: string
  }
) {
  const existing = await findTeamChatConversation(ctx, input.teamId)
  const participantIds = await getTeamMemberIds(ctx, input.teamId)

  if (existing) {
    await syncConversationParticipants(ctx, existing, participantIds)
    return existing.id
  }

  const now = getNow()
  const conversationId = createId("conversation")

  await ctx.db.insert("conversations", {
    id: conversationId,
    kind: "chat",
    scopeType: "team",
    scopeId: input.teamId,
    variant: "team",
    title: input.title?.trim() || input.teamName.trim(),
    description: input.description?.trim() || input.teamSummary.trim(),
    participantIds: normalizeUniqueIds(participantIds),
    roomId: null,
    roomName: null,
    createdBy: input.currentUserId,
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
  })

  return conversationId
}

export async function ensureTeamChannelConversation(
  ctx: MutationCtx,
  input: {
    teamId: string
    currentUserId: string
    teamName: string
    teamSummary: string
    title?: string
    description?: string
  }
) {
  const existing = await findPrimaryTeamChannelConversation(ctx, input.teamId)
  const participantIds = await getTeamMemberIds(ctx, input.teamId)

  if (existing) {
    await syncConversationParticipants(ctx, existing, participantIds)
    return existing.id
  }

  const now = getNow()
  const conversationId = createId("conversation")

  await ctx.db.insert("conversations", {
    id: conversationId,
    kind: "channel",
    scopeType: "team",
    scopeId: input.teamId,
    variant: "team",
    title: input.title?.trim() || input.teamName.trim(),
    description: input.description?.trim() || input.teamSummary.trim(),
    participantIds: normalizeUniqueIds(participantIds),
    roomId: null,
    roomName: null,
    createdBy: input.currentUserId,
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
  })

  return conversationId
}

export async function ensureWorkspaceChannelConversation(
  ctx: MutationCtx,
  input: {
    workspaceId: string
    currentUserId: string
    workspaceName: string
    workspaceDescription: string
    title?: string
    description?: string
  }
) {
  const existing = await findPrimaryWorkspaceChannelConversation(
    ctx,
    input.workspaceId
  )
  const participantIds = await getWorkspaceUserIds(ctx, input.workspaceId)

  if (existing) {
    await syncConversationParticipants(ctx, existing, participantIds)
    return existing.id
  }

  const now = getNow()
  const conversationId = createId("conversation")

  await ctx.db.insert("conversations", {
    id: conversationId,
    kind: "channel",
    scopeType: "workspace",
    scopeId: input.workspaceId,
    variant: "team",
    title: input.title?.trim() || input.workspaceName.trim(),
    description:
      input.description?.trim() ||
      input.workspaceDescription.trim() ||
      "Shared updates and threaded decisions for the whole workspace.",
    participantIds: normalizeUniqueIds(participantIds),
    roomId: null,
    roomName: null,
    createdBy: input.currentUserId,
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
  })

  return conversationId
}

export async function requireConversationAccess(
  ctx: AppCtx,
  conversation: Awaited<ReturnType<typeof getConversationDoc>>,
  userId: string,
  mode: "read" | "write" = "read"
) {
  if (!conversation) {
    throw new Error("Conversation not found")
  }

  if (conversation.scopeType === "workspace") {
    if (mode === "write") {
      await requireEditableWorkspaceAccess(ctx, conversation.scopeId, userId)
    } else {
      await requireReadableWorkspaceAccess(ctx, conversation.scopeId, userId)
    }

    if (
      conversation.kind === "chat" &&
      !conversation.participantIds.includes(userId)
    ) {
      throw new Error("You do not have access to this conversation")
    }

    return conversation
  }

  if (mode === "write") {
    await requireEditableTeamAccess(ctx, conversation.scopeId, userId)
  } else {
    await requireReadableTeamAccess(ctx, conversation.scopeId, userId)
  }

  return conversation
}

export async function getConversationAudienceUserIds(
  ctx: AppCtx,
  conversation: Awaited<ReturnType<typeof getConversationDoc>>
) {
  if (!conversation) {
    return []
  }

  if (conversation.scopeType === "team") {
    return getTeamMemberIds(ctx, conversation.scopeId)
  }

  const workspaceUserIds = new Set(
    await getWorkspaceUserIds(ctx, conversation.scopeId)
  )

  if (conversation.kind === "channel") {
    return [...workspaceUserIds]
  }

  return conversation.participantIds.filter((userId) =>
    workspaceUserIds.has(userId)
  )
}

export async function syncTeamConversationMemberships(
  ctx: MutationCtx,
  teamId: string
) {
  const participantIds = await getTeamMemberIds(ctx, teamId)
  const teamChat = await findTeamChatConversation(ctx, teamId)
  const teamChannel = await findPrimaryTeamChannelConversation(ctx, teamId)
  const team = await getTeamDoc(ctx, teamId)

  await syncConversationParticipants(ctx, teamChat, participantIds)
  await syncConversationParticipants(ctx, teamChannel, participantIds)

  if (!team) {
    return
  }

  const workspaceChannel = await findPrimaryWorkspaceChannelConversation(
    ctx,
    team.workspaceId
  )
  const workspaceParticipantIds = await getWorkspaceUserIds(
    ctx,
    team.workspaceId
  )

  await syncConversationParticipants(
    ctx,
    workspaceChannel,
    workspaceParticipantIds
  )
}

export async function updateConversationRoom(
  ctx: MutationCtx,
  input: {
    currentUserId: string
    conversationId: string
    roomId: string
    roomName: string
  }
) {
  const conversation = await requireConversationAccess(
    ctx,
    await getConversationDoc(ctx, input.conversationId),
    input.currentUserId
  )

  if (conversation.kind !== "chat") {
    throw new Error("Rooms can only be attached to chats")
  }

  await ctx.db.patch(conversation._id, {
    roomId: input.roomId,
    roomName: input.roomName,
    updatedAt: getNow(),
  })

  return {
    conversationId: conversation.id,
    roomId: input.roomId,
    roomName: input.roomName,
  }
}

export async function updateCallRoom(
  ctx: MutationCtx,
  input: {
    currentUserId: string
    callId: string
    roomId: string
    roomName: string
  }
) {
  const call = await getCallDoc(ctx, input.callId)

  if (!call) {
    throw new Error("Call not found")
  }

  await requireConversationAccess(
    ctx,
    await getConversationDoc(ctx, call.conversationId),
    input.currentUserId
  )

  await ctx.db.patch(call._id, {
    roomId: input.roomId,
    roomName: input.roomName,
    updatedAt: getNow(),
  })

  return {
    callId: call.id,
    roomId: input.roomId,
    roomName: input.roomName,
  }
}
