import type { MutationCtx, QueryCtx } from "../_generated/server"

import { buildMentionEmailJobs } from "../../lib/email/builders"
import { getPlainTextContent } from "../../lib/utils"
import {
  requireEditableTeamAccess,
  requireEditableWorkspaceAccess,
  requireReadableTeamAccess,
  requireReadableWorkspaceAccess,
} from "./access"
import {
  createMentionIds,
  createNotification,
  normalizeUniqueIds,
  toggleReactionUsers,
} from "./collaboration_utils"
import {
  ensureTeamChannelConversation,
  ensureTeamChatConversation,
  ensureWorkspaceChannelConversation,
  findPrimaryTeamChannelConversation,
  findPrimaryWorkspaceChannelConversation,
  findTeamChatConversation,
  findWorkspaceDirectConversation,
  getConversationAudienceUserIds,
  getWorkspaceUserIds,
  requireConversationAccess,
  updateCallRoom,
  updateConversationRoom,
} from "./conversations"
import { assertServerToken, createId, getNow } from "./core"
import {
  getCallDoc,
  getChannelPostDoc,
  getChatMessageDoc,
  getConversationDoc,
  getTeamMembershipDoc,
  getTeamDoc,
  getWorkspaceEditRole,
  listUsersByIds,
  getWorkspaceDoc,
  listNotificationsByEntity,
  type AppCtx,
} from "./data"
import {
  getChannelConversationPath,
  getChatConversationPath,
} from "./notifications"
import { normalizeTeam } from "./normalization"
import { queueEmailJobs } from "./email_job_handlers"

type ServerAccessArgs = {
  serverToken: string
}

type CreateWorkspaceChatArgs = ServerAccessArgs & {
  currentUserId: string
  workspaceId: string
  participantIds: string[]
  title: string
  description: string
}

type EnsureTeamChatArgs = ServerAccessArgs & {
  currentUserId: string
  teamId: string
  title: string
  description: string
}

type CreateChannelArgs = ServerAccessArgs & {
  currentUserId: string
  teamId?: string
  workspaceId?: string
  title: string
  description: string
}

type StartChatCallArgs = ServerAccessArgs & {
  currentUserId: string
  conversationId: string
  roomKey: string
  roomDescription: string
}

type SetCallRoomArgs = ServerAccessArgs & {
  currentUserId: string
  callId: string
  roomId: string
  roomName: string
}

type SetConversationRoomArgs = ServerAccessArgs & {
  currentUserId: string
  conversationId: string
  roomId: string
  roomName: string
}

type MarkCallJoinedArgs = ServerAccessArgs & {
  currentUserId: string
  callId: string
}

type GetCallJoinContextArgs = ServerAccessArgs & {
  currentUserId: string
  callId?: string
  conversationId?: string
}

type FinalizeCallJoinArgs = ServerAccessArgs & {
  currentUserId: string
  callId?: string
  conversationId?: string
  roomId: string
  roomName: string
}

type SendChatMessageArgs = ServerAccessArgs & {
  currentUserId: string
  origin: string
  conversationId: string
  content: string
  messageId?: string
}

type ToggleChatMessageReactionArgs = ServerAccessArgs & {
  currentUserId: string
  messageId: string
  emoji: string
}

type CreateChannelPostArgs = ServerAccessArgs & {
  currentUserId: string
  origin: string
  conversationId: string
  title: string
  content: string
}

type AddChannelPostCommentArgs = ServerAccessArgs & {
  currentUserId: string
  origin: string
  postId: string
  content: string
}

type DeleteChannelPostArgs = ServerAccessArgs & {
  currentUserId: string
  postId: string
}

type ToggleChannelPostReactionArgs = ServerAccessArgs & {
  currentUserId: string
  postId: string
  emoji: string
}

function toMeetingRole(role: "admin" | "member" | "viewer" | "guest" | null) {
  return role === "admin" || role === "member" ? "host" : "guest"
}

async function resolveConversationMeetingRole(
  ctx: AppCtx,
  conversation: Awaited<ReturnType<typeof getConversationDoc>>,
  currentUserId: string
) {
  if (!conversation) {
    throw new Error("Conversation not found")
  }

  if (conversation.scopeType === "workspace") {
    return toMeetingRole(
      await getWorkspaceEditRole(ctx, conversation.scopeId, currentUserId)
    )
  }

  const membership = await getTeamMembershipDoc(
    ctx,
    conversation.scopeId,
    currentUserId
  )

  return toMeetingRole(membership?.role ?? null)
}

function buildConversationRoomDefaults(
  conversation: NonNullable<Awaited<ReturnType<typeof getConversationDoc>>>
) {
  const roomKey = `chat-${conversation.id}`
  const roomDescription =
    conversation.scopeType === "workspace"
      ? `Persistent video room for workspace chat ${conversation.id}`
      : `Persistent video room for team chat ${conversation.id}`

  return {
    roomKey,
    roomDescription,
  }
}

async function buildConversationJoinContext(
  ctx: AppCtx,
  conversation: Awaited<ReturnType<typeof getConversationDoc>>,
  currentUserId: string
) {
  const accessibleConversation = await requireConversationAccess(
    ctx,
    conversation,
    currentUserId
  )

  if (accessibleConversation.kind !== "chat") {
    throw new Error("Calls can only be joined from chats")
  }

  return {
    callId: null,
    conversationId: accessibleConversation.id,
    roomId: accessibleConversation.roomId ?? null,
    roomName: accessibleConversation.roomName ?? null,
    ...buildConversationRoomDefaults(accessibleConversation),
    role: await resolveConversationMeetingRole(
      ctx,
      accessibleConversation,
      currentUserId
    ),
  }
}

export async function createWorkspaceChatHandler(
  ctx: MutationCtx,
  args: CreateWorkspaceChatArgs
) {
  assertServerToken(args.serverToken)
  await requireEditableWorkspaceAccess(
    ctx,
    args.workspaceId,
    args.currentUserId
  )

  const workspaceUserIds = new Set(
    await getWorkspaceUserIds(ctx, args.workspaceId)
  )
  const participantIds = [
    ...new Set([args.currentUserId, ...args.participantIds]),
  ].filter((userId) => workspaceUserIds.has(userId))

  if (participantIds.length < 2) {
    throw new Error("Chats need at least two workspace members")
  }

  const users = await listUsersByIds(ctx, participantIds)
  const usersById = new Map(users.map((user) => [user.id, user]))
  const variant = participantIds.length === 2 ? "direct" : "group"

  if (variant === "direct") {
    const existingConversation = await findWorkspaceDirectConversation(
      ctx,
      args.workspaceId,
      participantIds
    )

    if (existingConversation) {
      return {
        conversationId: existingConversation.id,
      }
    }
  }

  const otherParticipantIds = participantIds.filter(
    (userId) => userId !== args.currentUserId
  )
  const resolvedTitle =
    args.title.trim() ||
    (variant === "direct"
      ? (usersById.get(otherParticipantIds[0] ?? "")?.name ?? "Direct chat")
      : otherParticipantIds
          .map((userId) => usersById.get(userId)?.name ?? "")
          .filter(Boolean)
          .join(", ")
          .slice(0, 80) || "Group chat")
  const now = getNow()
  const conversationId = createId("conversation")

  await ctx.db.insert("conversations", {
    id: conversationId,
    kind: "chat",
    scopeType: "workspace",
    scopeId: args.workspaceId,
    variant,
    title: resolvedTitle,
    description: args.description.trim(),
    participantIds: normalizeUniqueIds(participantIds),
    roomId: null,
    roomName: null,
    createdBy: args.currentUserId,
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
  })

  return {
    conversationId,
  }
}

export async function ensureTeamChatHandler(
  ctx: MutationCtx,
  args: EnsureTeamChatArgs
) {
  assertServerToken(args.serverToken)
  await requireReadableTeamAccess(ctx, args.teamId, args.currentUserId)
  const team = await getTeamDoc(ctx, args.teamId)

  if (!team) {
    throw new Error("Team not found")
  }

  const normalizedTeam = normalizeTeam(team)

  if (!normalizedTeam.settings.features.chat) {
    throw new Error("Chat is disabled for this team")
  }

  const existing = await findTeamChatConversation(ctx, args.teamId)

  if (existing) {
    return {
      conversationId: existing.id,
    }
  }

  await requireEditableTeamAccess(ctx, args.teamId, args.currentUserId)
  const conversationId = await ensureTeamChatConversation(ctx, {
    teamId: args.teamId,
    currentUserId: args.currentUserId,
    teamName: team.name,
    teamSummary: team.settings.summary,
    title: args.title,
    description: args.description,
  })

  return {
    conversationId,
  }
}

export async function createChannelHandler(
  ctx: MutationCtx,
  args: CreateChannelArgs
) {
  assertServerToken(args.serverToken)
  const targets =
    Number(Boolean(args.teamId)) + Number(Boolean(args.workspaceId))

  if (targets !== 1) {
    throw new Error("Channel must target exactly one team or workspace")
  }

  if (args.teamId) {
    await requireReadableTeamAccess(ctx, args.teamId, args.currentUserId)
    const team = await getTeamDoc(ctx, args.teamId)

    if (!team) {
      throw new Error("Team not found")
    }

    const normalizedTeam = normalizeTeam(team)

    if (!normalizedTeam.settings.features.channels) {
      throw new Error("Channel is disabled for this team")
    }

    const existing = await findPrimaryTeamChannelConversation(ctx, args.teamId)

    if (existing) {
      return {
        conversationId: existing.id,
      }
    }

    await requireEditableTeamAccess(ctx, args.teamId, args.currentUserId)
    const conversationId = await ensureTeamChannelConversation(ctx, {
      teamId: args.teamId,
      currentUserId: args.currentUserId,
      teamName: team.name,
      teamSummary: team.settings.summary,
      title: args.title,
      description: args.description,
    })

    return {
      conversationId,
    }
  }

  const workspaceId = args.workspaceId

  if (!workspaceId) {
    throw new Error("Workspace not found")
  }

  await requireReadableWorkspaceAccess(ctx, workspaceId, args.currentUserId)
  const workspace = await getWorkspaceDoc(ctx, workspaceId)

  if (!workspace) {
    throw new Error("Workspace not found")
  }

  const existing = await findPrimaryWorkspaceChannelConversation(
    ctx,
    workspaceId
  )

  if (existing) {
    return {
      conversationId: existing.id,
    }
  }

  await requireEditableWorkspaceAccess(ctx, workspaceId, args.currentUserId)
  const conversationId = await ensureWorkspaceChannelConversation(ctx, {
    workspaceId,
    currentUserId: args.currentUserId,
    workspaceName: workspace.name,
    workspaceDescription: workspace.settings.description,
    title: args.title,
    description: args.description,
  })

  return {
    conversationId,
  }
}

export async function startChatCallHandler(
  ctx: MutationCtx,
  args: StartChatCallArgs
) {
  assertServerToken(args.serverToken)
  const conversation = await requireConversationAccess(
    ctx,
    await getConversationDoc(ctx, args.conversationId),
    args.currentUserId,
    "write"
  )

  if (conversation.kind !== "chat") {
    throw new Error("Calls can only be started from chats")
  }

  const now = getNow()
  const call = {
    id: createId("call"),
    conversationId: conversation.id,
    scopeType: conversation.scopeType,
    scopeId: conversation.scopeId,
    roomId: null,
    roomName: null,
    roomKey: args.roomKey,
    roomDescription: args.roomDescription,
    startedBy: args.currentUserId,
    startedAt: now,
    updatedAt: now,
    endedAt: null,
    participantUserIds: [],
    lastJoinedAt: null,
    lastJoinedBy: null,
    joinCount: 0,
  }
  const message = {
    id: createId("chat_message"),
    conversationId: conversation.id,
    kind: "call" as const,
    content: "Started a call",
    callId: call.id,
    mentionUserIds: [],
    reactions: [],
    createdBy: args.currentUserId,
    createdAt: now,
  }

  await ctx.db.insert("calls", call)
  await ctx.db.insert("chatMessages", message)
  await ctx.db.patch(conversation._id, {
    updatedAt: now,
    lastActivityAt: now,
  })

  return {
    call,
    message,
  }
}

export async function setCallRoomHandler(
  ctx: MutationCtx,
  args: SetCallRoomArgs
) {
  assertServerToken(args.serverToken)

  return updateCallRoom(ctx, {
    currentUserId: args.currentUserId,
    callId: args.callId,
    roomId: args.roomId,
    roomName: args.roomName,
  })
}

export async function setConversationRoomHandler(
  ctx: MutationCtx,
  args: SetConversationRoomArgs
) {
  assertServerToken(args.serverToken)

  return updateConversationRoom(ctx, {
    currentUserId: args.currentUserId,
    conversationId: args.conversationId,
    roomId: args.roomId,
    roomName: args.roomName,
  })
}

export async function markCallJoinedHandler(
  ctx: MutationCtx,
  args: MarkCallJoinedArgs
) {
  assertServerToken(args.serverToken)
  const call = await getCallDoc(ctx, args.callId)

  if (!call) {
    throw new Error("Call not found")
  }

  await requireConversationAccess(
    ctx,
    await getConversationDoc(ctx, call.conversationId),
    args.currentUserId
  )

  if (call.endedAt) {
    throw new Error("Call has already ended")
  }

  const now = getNow()
  const participantUserIds = [
    ...new Set([...(call.participantUserIds ?? []), args.currentUserId]),
  ]

  await ctx.db.patch(call._id, {
    participantUserIds,
    lastJoinedAt: now,
    lastJoinedBy: args.currentUserId,
    joinCount: (call.joinCount ?? 0) + 1,
    updatedAt: now,
  })

  return {
    ok: true,
    callId: call.id,
  }
}

export async function getCallJoinContextHandler(
  ctx: QueryCtx,
  args: GetCallJoinContextArgs
) {
  assertServerToken(args.serverToken)

  if (!args.callId && !args.conversationId) {
    throw new Error("callId or conversationId is required")
  }

  if (args.callId) {
    const call = await getCallDoc(ctx, args.callId)

    if (!call) {
      throw new Error("Call not found")
    }

    const conversationContext = await buildConversationJoinContext(
      ctx,
      await getConversationDoc(ctx, call.conversationId),
      args.currentUserId
    )

    return {
      ...conversationContext,
      callId: call.id,
      roomId: call.roomId ?? null,
      roomName: call.roomName ?? null,
      roomKey: call.roomKey,
      roomDescription: call.roomDescription,
    }
  }

  return buildConversationJoinContext(
    ctx,
    await getConversationDoc(ctx, args.conversationId ?? ""),
    args.currentUserId
  )
}

export async function finalizeCallJoinHandler(
  ctx: MutationCtx,
  args: FinalizeCallJoinArgs
) {
  assertServerToken(args.serverToken)

  if (!args.callId && !args.conversationId) {
    throw new Error("callId or conversationId is required")
  }

  if (args.callId) {
    const call = await getCallDoc(ctx, args.callId)

    if (!call) {
      throw new Error("Call not found")
    }

    const conversation = await requireConversationAccess(
      ctx,
      await getConversationDoc(ctx, call.conversationId),
      args.currentUserId
    )

    if (conversation.kind !== "chat") {
      throw new Error("Calls can only be joined from chats")
    }

    if (call.endedAt) {
      throw new Error("Call has already ended")
    }

    const now = getNow()
    const shouldUseProvisionedRoom = !call.roomId || !call.roomName
    const roomId = shouldUseProvisionedRoom ? args.roomId : call.roomId
    const roomName = shouldUseProvisionedRoom ? args.roomName : call.roomName
    const participantUserIds = [
      ...new Set([...(call.participantUserIds ?? []), args.currentUserId]),
    ]

    await ctx.db.patch(call._id, {
      roomId,
      roomName,
      participantUserIds,
      lastJoinedAt: now,
      lastJoinedBy: args.currentUserId,
      joinCount: (call.joinCount ?? 0) + 1,
      updatedAt: now,
    })

    return {
      callId: call.id,
      conversationId: call.conversationId,
      roomId,
      roomName,
    }
  }

  const conversation = await requireConversationAccess(
    ctx,
    await getConversationDoc(ctx, args.conversationId ?? ""),
    args.currentUserId
  )

  if (conversation.kind !== "chat") {
    throw new Error("Calls can only be joined from chats")
  }

  const shouldUseProvisionedRoom = !conversation.roomId || !conversation.roomName
  const roomId = shouldUseProvisionedRoom ? args.roomId : conversation.roomId
  const roomName = shouldUseProvisionedRoom ? args.roomName : conversation.roomName

  if (shouldUseProvisionedRoom) {
    await ctx.db.patch(conversation._id, {
      roomId,
      roomName,
      updatedAt: getNow(),
    })
  }

  return {
    callId: null,
    conversationId: conversation.id,
    roomId,
    roomName,
  }
}

export async function sendChatMessageHandler(
  ctx: MutationCtx,
  args: SendChatMessageArgs
) {
  assertServerToken(args.serverToken)
  const conversation = await requireConversationAccess(
    ctx,
    await getConversationDoc(ctx, args.conversationId),
    args.currentUserId,
    "write"
  )

  if (conversation.kind !== "chat") {
    throw new Error("Messages can only be sent to chats")
  }

  const audienceUserIds = await getConversationAudienceUserIds(
    ctx,
    conversation
  )
  const users = await listUsersByIds(ctx, [
    args.currentUserId,
    ...audienceUserIds,
  ])
  const usersById = new Map(users.map((user) => [user.id, user]))
  const now = getNow()
  const messageId = args.messageId?.trim() || createId("chat_message")
  const actor = usersById.get(args.currentUserId)
  const messageHtml = args.content.trim()
  const messageText = getPlainTextContent(messageHtml)

  if (!messageText) {
    throw new Error("Message content must include at least 1 character")
  }
  if (!audienceUserIds.some((userId) => userId !== args.currentUserId)) {
    throw new Error(
      conversation.scopeType === "team"
        ? "This chat is read-only because the other participants have left the team or deleted their account"
        : "This chat is read-only because the other participants have left the workspace or deleted their account"
    )
  }

  const mentionUserIds = createMentionIds(messageHtml, users, audienceUserIds)
  const mentionEmails: Array<{
    notificationId: string
    email: string
    name: string
    entityTitle: string
    entityType: "chat"
    entityId: string
    entityPath: string
    entityLabel: string
    actorName: string
    commentText: string
  }> = []
  const entityTitle = conversation.title.trim() || "a chat"
  const entityPath = await getChatConversationPath(ctx, conversation)
  const notifiedUserIds = new Set<string>()

  await ctx.db.insert("chatMessages", {
    id: messageId,
    conversationId: conversation.id,
    kind: "text",
    content: messageHtml,
    callId: null,
    mentionUserIds,
    reactions: [],
    createdBy: args.currentUserId,
    createdAt: now,
  })

  for (const mentionedUserId of mentionUserIds) {
    if (
      mentionedUserId === args.currentUserId ||
      notifiedUserIds.has(mentionedUserId)
    ) {
      continue
    }

    const mentionedUser = usersById.get(mentionedUserId)
    const notification = createNotification(
      mentionedUserId,
      args.currentUserId,
      `${actor?.name ?? "Someone"} mentioned you in ${entityTitle}`,
      "chat",
      conversation.id,
      "mention"
    )

    await ctx.db.insert("notifications", notification)

    if (mentionedUser?.preferences.emailMentions) {
      mentionEmails.push({
        notificationId: notification.id,
        email: mentionedUser.email,
        name: mentionedUser.name,
        entityTitle,
        entityType: "chat",
        entityId: conversation.id,
        entityPath,
        entityLabel: "chat",
        actorName: actor?.name ?? "Someone",
        commentText: messageText,
      })
    }

    notifiedUserIds.add(mentionedUserId)
  }

  await ctx.db.patch(conversation._id, {
    updatedAt: now,
    lastActivityAt: now,
  })

  await queueEmailJobs(
    ctx,
    buildMentionEmailJobs({
      origin: args.origin,
      emails: mentionEmails,
    })
  )

  return {
    messageId,
    mentionEmails,
  }
}

export async function toggleChatMessageReactionHandler(
  ctx: MutationCtx,
  args: ToggleChatMessageReactionArgs
) {
  assertServerToken(args.serverToken)
  const message = await getChatMessageDoc(ctx, args.messageId)

  if (!message) {
    throw new Error("Message not found")
  }

  await requireConversationAccess(
    ctx,
    await getConversationDoc(ctx, message.conversationId),
    args.currentUserId,
    "write"
  )

  await ctx.db.patch(message._id, {
    reactions: toggleReactionUsers(
      message.reactions,
      args.emoji.trim(),
      args.currentUserId
    ),
  })

  return {
    ok: true,
  }
}

export async function createChannelPostHandler(
  ctx: MutationCtx,
  args: CreateChannelPostArgs
) {
  assertServerToken(args.serverToken)
  const conversation = await requireConversationAccess(
    ctx,
    await getConversationDoc(ctx, args.conversationId),
    args.currentUserId,
    "write"
  )

  if (conversation.kind !== "channel") {
    throw new Error("Posts can only be created in channels")
  }

  const audienceUserIds = await getConversationAudienceUserIds(
    ctx,
    conversation
  )
  const users = await listUsersByIds(ctx, [
    args.currentUserId,
    ...audienceUserIds,
  ])
  const usersById = new Map(users.map((user) => [user.id, user]))
  const now = getNow()
  const postId = createId("channel_post")
  const actor = usersById.get(args.currentUserId)
  const mentionUserIds = createMentionIds(
    args.content,
    users,
    audienceUserIds
  ).filter((userId) => userId !== args.currentUserId)
  const mentionEmails: Array<{
    notificationId: string
    email: string
    name: string
    entityTitle: string
    entityType: "channelPost"
    entityId: string
    entityPath: string
    entityLabel: string
    actorName: string
    commentText: string
  }> = []
  const notifiedUserIds = new Set<string>()
  const entityTitle = args.title.trim() || "a channel post"
  const entityPath = await getChannelConversationPath(ctx, conversation, postId)
  const commentText = getPlainTextContent(args.content)

  await ctx.db.insert("channelPosts", {
    id: postId,
    conversationId: conversation.id,
    title: args.title.trim(),
    content: args.content.trim(),
    mentionUserIds,
    reactions: [],
    createdBy: args.currentUserId,
    createdAt: now,
    updatedAt: now,
  })

  for (const mentionedUserId of mentionUserIds) {
    if (
      mentionedUserId === args.currentUserId ||
      notifiedUserIds.has(mentionedUserId)
    ) {
      continue
    }

    const mentionedUser = usersById.get(mentionedUserId)
    const notification = createNotification(
      mentionedUserId,
      args.currentUserId,
      `${actor?.name ?? "Someone"} mentioned you in ${entityTitle}`,
      "channelPost",
      postId,
      "mention"
    )

    await ctx.db.insert("notifications", notification)

    if (mentionedUser?.preferences.emailMentions) {
      mentionEmails.push({
        notificationId: notification.id,
        email: mentionedUser.email,
        name: mentionedUser.name,
        entityTitle,
        entityType: "channelPost",
        entityId: postId,
        entityPath,
        entityLabel: "channel post",
        actorName: actor?.name ?? "Someone",
        commentText,
      })
    }

    notifiedUserIds.add(mentionedUserId)
  }

  await ctx.db.patch(conversation._id, {
    updatedAt: now,
    lastActivityAt: now,
  })

  await queueEmailJobs(
    ctx,
    buildMentionEmailJobs({
      origin: args.origin,
      emails: mentionEmails,
    })
  )

  return {
    postId,
    mentionEmails,
  }
}

export async function addChannelPostCommentHandler(
  ctx: MutationCtx,
  args: AddChannelPostCommentArgs
) {
  assertServerToken(args.serverToken)
  const post = await getChannelPostDoc(ctx, args.postId)

  if (!post) {
    throw new Error("Post not found")
  }

  const conversation = await requireConversationAccess(
    ctx,
    await getConversationDoc(ctx, post.conversationId),
    args.currentUserId,
    "write"
  )

  if (conversation.kind !== "channel") {
    throw new Error("Comments can only be added to channels")
  }

  const existingComments = await ctx.db
    .query("channelPostComments")
    .withIndex("by_post", (q) => q.eq("postId", post.id))
    .collect()
  const now = getNow()
  const commentId = createId("channel_comment")
  const audienceUserIds = await getConversationAudienceUserIds(
    ctx,
    conversation
  )
  const users = await listUsersByIds(ctx, [
    args.currentUserId,
    ...audienceUserIds,
  ])
  const usersById = new Map(users.map((user) => [user.id, user]))
  const actor = usersById.get(args.currentUserId)
  const mentionUserIds = createMentionIds(
    args.content,
    users,
    audienceUserIds
  ).filter((userId) => userId !== args.currentUserId)
  const notifiedUserIds = new Set<string>()
  const entityTitle = post.title.trim() || "a channel post"
  const entityPath = await getChannelConversationPath(
    ctx,
    conversation,
    post.id
  )
  const commentText = getPlainTextContent(args.content)
  const mentionEmails: Array<{
    notificationId: string
    email: string
    name: string
    entityTitle: string
    entityType: "channelPost"
    entityId: string
    entityPath: string
    entityLabel: string
    actorName: string
    commentText: string
  }> = []

  await ctx.db.insert("channelPostComments", {
    id: commentId,
    postId: post.id,
    content: args.content.trim(),
    mentionUserIds,
    createdBy: args.currentUserId,
    createdAt: now,
  })

  for (const mentionedUserId of mentionUserIds) {
    if (
      mentionedUserId === args.currentUserId ||
      notifiedUserIds.has(mentionedUserId)
    ) {
      continue
    }

    const mentionedUser = usersById.get(mentionedUserId)
    const notification = createNotification(
      mentionedUserId,
      args.currentUserId,
      `${actor?.name ?? "Someone"} mentioned you in ${entityTitle}`,
      "channelPost",
      post.id,
      "mention"
    )

    await ctx.db.insert("notifications", notification)

    if (mentionedUser?.preferences.emailMentions) {
      mentionEmails.push({
        notificationId: notification.id,
        email: mentionedUser.email,
        name: mentionedUser.name,
        entityTitle,
        entityType: "channelPost",
        entityId: post.id,
        entityPath,
        entityLabel: "channel post",
        actorName: actor?.name ?? "Someone",
        commentText,
      })
    }

    notifiedUserIds.add(mentionedUserId)
  }

  const followerIds = [
    post.createdBy,
    ...existingComments.map((comment) => comment.createdBy),
  ]

  for (const followerId of followerIds) {
    if (
      !followerId ||
      !audienceUserIds.includes(followerId) ||
      followerId === args.currentUserId ||
      notifiedUserIds.has(followerId)
    ) {
      continue
    }

    await ctx.db.insert(
      "notifications",
      createNotification(
        followerId,
        args.currentUserId,
        `${actor?.name ?? "Someone"} commented on ${entityTitle}`,
        "channelPost",
        post.id,
        "comment"
      )
    )

    notifiedUserIds.add(followerId)
  }

  await ctx.db.patch(post._id, {
    updatedAt: now,
  })

  await ctx.db.patch(conversation._id, {
    updatedAt: now,
    lastActivityAt: now,
  })

  await queueEmailJobs(
    ctx,
    buildMentionEmailJobs({
      origin: args.origin,
      emails: mentionEmails,
    })
  )

  return {
    commentId,
    mentionEmails,
  }
}

export async function deleteChannelPostHandler(
  ctx: MutationCtx,
  args: DeleteChannelPostArgs
) {
  assertServerToken(args.serverToken)
  const post = await getChannelPostDoc(ctx, args.postId)

  if (!post) {
    throw new Error("Post not found")
  }

  const conversation = await requireConversationAccess(
    ctx,
    await getConversationDoc(ctx, post.conversationId),
    args.currentUserId,
    "write"
  )

  if (post.createdBy !== args.currentUserId) {
    throw new Error("You can only delete your own posts")
  }

  const comments = await ctx.db
    .query("channelPostComments")
    .withIndex("by_post", (q) => q.eq("postId", post.id))
    .collect()
  const notifications = await listNotificationsByEntity(
    ctx,
    "channelPost",
    post.id
  )

  for (const comment of comments) {
    await ctx.db.delete(comment._id)
  }

  for (const notification of notifications) {
    await ctx.db.delete(notification._id)
  }

  await ctx.db.delete(post._id)

  await ctx.db.patch(conversation._id, {
    updatedAt: getNow(),
    lastActivityAt: getNow(),
  })

  return {
    ok: true,
  }
}

export async function toggleChannelPostReactionHandler(
  ctx: MutationCtx,
  args: ToggleChannelPostReactionArgs
) {
  assertServerToken(args.serverToken)
  const post = await getChannelPostDoc(ctx, args.postId)

  if (!post) {
    throw new Error("Post not found")
  }

  await requireConversationAccess(
    ctx,
    await getConversationDoc(ctx, post.conversationId),
    args.currentUserId,
    "write"
  )

  await ctx.db.patch(post._id, {
    reactions: toggleReactionUsers(
      post.reactions,
      args.emoji.trim(),
      args.currentUserId
    ),
  })

  return {
    ok: true,
  }
}
