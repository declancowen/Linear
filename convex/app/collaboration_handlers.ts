import type { MutationCtx, QueryCtx } from "../_generated/server"

import {
  buildMentionEmailJobs,
  type MentionEmail,
} from "../../lib/email/builders"
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
  getMentionAudienceContext,
  insertMentionNotifications,
  normalizeUniqueIds,
  toggleReactionUsers,
  type MentionAudienceUser,
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

type WorkspaceChatVariant = "direct" | "group"
type WorkspaceChatUser = Awaited<ReturnType<typeof listUsersByIds>>[number]

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

type ChannelPostDoc = NonNullable<Awaited<ReturnType<typeof getChannelPostDoc>>>
type ChannelConversationDoc = NonNullable<
  Awaited<ReturnType<typeof getConversationDoc>>
>
type CallDoc = NonNullable<Awaited<ReturnType<typeof getCallDoc>>>
type ChannelCommentAudience = {
  actorName: string
  audienceUserIds: string[]
  mentionUserIds: string[]
  usersById: Map<string, MentionAudienceUser>
}

type ChatConversation = NonNullable<
  Awaited<ReturnType<typeof requireConversationAccess>>
>

type ChatUser = MentionAudienceUser

type ChatMessageDraft = {
  messageHtml: string
  messageId: string
  messageText: string
}

type ChatMessageAudience = {
  actorName: string
  audienceUserIds: string[]
  users: ChatUser[]
  usersById: Map<string, ChatUser>
}

type ChatNotificationContext = {
  actorName: string
  entityPath: string
  entityTitle: string
}

type CollaborationTeamFeature = "chat" | "channels"

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

async function requireReadableTeamFeature(
  ctx: MutationCtx,
  input: {
    currentUserId: string
    disabledMessage: string
    feature: CollaborationTeamFeature
    teamId: string
  }
) {
  await requireReadableTeamAccess(ctx, input.teamId, input.currentUserId)
  const team = await getTeamDoc(ctx, input.teamId)

  if (!team) {
    throw new Error("Team not found")
  }

  const normalizedTeam = normalizeTeam(team)

  if (!normalizedTeam.settings.features[input.feature]) {
    throw new Error(input.disabledMessage)
  }

  return team
}

export async function createWorkspaceChatHandler(
  ctx: MutationCtx,
  args: CreateWorkspaceChatArgs
) {
  assertServerToken(args.serverToken)
  const chatContext = await resolveWorkspaceChatCreationContext(ctx, args)
  const existingDirectConversation = await findExistingWorkspaceDirectChat(
    ctx,
    {
      participantIds: chatContext.participantIds,
      variant: chatContext.variant,
      workspaceId: args.workspaceId,
    }
  )

  if (existingDirectConversation) {
    return {
      conversationId: existingDirectConversation.id,
    }
  }

  const conversationId = await insertWorkspaceChatConversation(ctx, {
    args,
    ...chatContext,
  })

  return {
    conversationId,
  }
}

async function resolveWorkspaceChatCreationContext(
  ctx: MutationCtx,
  args: CreateWorkspaceChatArgs
) {
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
  const variant: WorkspaceChatVariant =
    participantIds.length === 2 ? "direct" : "group"

  return {
    participantIds,
    usersById,
    variant,
  }
}

async function findExistingWorkspaceDirectChat(
  ctx: MutationCtx,
  input: {
    participantIds: string[]
    variant: WorkspaceChatVariant
    workspaceId: string
  }
) {
  if (input.variant !== "direct") {
    return null
  }

  return findWorkspaceDirectConversation(
    ctx,
    input.workspaceId,
    input.participantIds
  )
}

async function insertWorkspaceChatConversation(
  ctx: MutationCtx,
  input: {
    args: CreateWorkspaceChatArgs
    participantIds: string[]
    usersById: Map<string, WorkspaceChatUser>
    variant: WorkspaceChatVariant
  }
) {
  const resolvedTitle = resolveWorkspaceChatTitle(input)
  const now = getNow()
  const conversationId = createId("conversation")

  await ctx.db.insert("conversations", {
    id: conversationId,
    kind: "chat",
    scopeType: "workspace",
    scopeId: input.args.workspaceId,
    variant: input.variant,
    title: resolvedTitle,
    description: input.args.description.trim(),
    participantIds: normalizeUniqueIds(input.participantIds),
    roomId: null,
    roomName: null,
    createdBy: input.args.currentUserId,
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
  })

  return conversationId
}

function resolveWorkspaceChatTitle(input: {
  args: CreateWorkspaceChatArgs
  participantIds: string[]
  usersById: Map<string, WorkspaceChatUser>
  variant: WorkspaceChatVariant
}) {
  const trimmedTitle = input.args.title.trim()

  if (trimmedTitle) {
    return trimmedTitle
  }

  const otherParticipantIds = input.participantIds.filter(
    (userId) => userId !== input.args.currentUserId
  )

  return getDefaultWorkspaceChatTitle({
    otherParticipantIds,
    usersById: input.usersById,
    variant: input.variant,
  })
}

function getDefaultWorkspaceChatTitle(input: {
  otherParticipantIds: string[]
  usersById: Map<string, WorkspaceChatUser>
  variant: WorkspaceChatVariant
}) {
  if (input.variant === "direct") {
    return getDefaultDirectWorkspaceChatTitle(input)
  }

  return getDefaultGroupWorkspaceChatTitle(input)
}

function getDefaultDirectWorkspaceChatTitle(input: {
  otherParticipantIds: string[]
  usersById: Map<string, WorkspaceChatUser>
}) {
  return input.usersById.get(input.otherParticipantIds[0] ?? "")?.name ?? "Direct chat"
}

function getDefaultGroupWorkspaceChatTitle(input: {
  otherParticipantIds: string[]
  usersById: Map<string, WorkspaceChatUser>
}) {
  const title = input.otherParticipantIds
    .map((userId) => input.usersById.get(userId)?.name ?? "")
    .filter(Boolean)
    .join(", ")
    .slice(0, 80)

  return title || "Group chat"
}

export async function ensureTeamChatHandler(
  ctx: MutationCtx,
  args: EnsureTeamChatArgs
) {
  assertServerToken(args.serverToken)
  const team = await requireReadableTeamFeature(ctx, {
    currentUserId: args.currentUserId,
    disabledMessage: "Chat is disabled for this team",
    feature: "chat",
    teamId: args.teamId,
  })

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

function assertChannelTarget(args: Pick<CreateChannelArgs, "teamId" | "workspaceId">) {
  const targets = Number(Boolean(args.teamId)) + Number(Boolean(args.workspaceId))

  if (targets !== 1) {
    throw new Error("Channel must target exactly one team or workspace")
  }
}

async function createTeamChannel(
  ctx: MutationCtx,
  args: CreateChannelArgs
) {
  const teamId = args.teamId

  if (!teamId) {
    return null
  }

  const team = await requireReadableTeamFeature(ctx, {
    currentUserId: args.currentUserId,
    disabledMessage: "Channel is disabled for this team",
    feature: "channels",
    teamId,
  })

  const existing = await findPrimaryTeamChannelConversation(ctx, teamId)

  if (existing) {
    return {
      conversationId: existing.id,
    }
  }

  await requireEditableTeamAccess(ctx, teamId, args.currentUserId)
  const conversationId = await ensureTeamChannelConversation(ctx, {
    teamId,
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

async function createWorkspaceChannel(
  ctx: MutationCtx,
  args: CreateChannelArgs
) {
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

export async function createChannelHandler(
  ctx: MutationCtx,
  args: CreateChannelArgs
) {
  assertServerToken(args.serverToken)
  assertChannelTarget(args)

  return (await createTeamChannel(ctx, args)) ?? createWorkspaceChannel(ctx, args)
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

async function getCallJoinContextByCall(
  ctx: QueryCtx,
  args: GetCallJoinContextArgs & {
    callId: string
  }
) {
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

async function getCallJoinContextByConversation(
  ctx: QueryCtx,
  args: GetCallJoinContextArgs & {
    conversationId: string
  }
) {
  return buildConversationJoinContext(
    ctx,
    await getConversationDoc(ctx, args.conversationId),
    args.currentUserId
  )
}

export async function getCallJoinContextHandler(
  ctx: QueryCtx,
  args: GetCallJoinContextArgs
) {
  assertServerToken(args.serverToken)
  assertCallJoinTarget(args)

  if (args.callId) {
    return getCallJoinContextByCall(ctx, {
      ...args,
      callId: args.callId,
    })
  }

  return getCallJoinContextByConversation(ctx, {
    ...args,
    conversationId: args.conversationId ?? "",
  })
}

function assertCallJoinTarget(args: {
  callId?: string
  conversationId?: string
}) {
  if (!args.callId && !args.conversationId) {
    throw new Error("callId or conversationId is required")
  }
}

function assertChatCallConversation(conversation: ChatConversation) {
  if (conversation.kind !== "chat") {
    throw new Error("Calls can only be joined from chats")
  }
}

async function requireChatCallConversation(
  ctx: MutationCtx,
  conversationId: string,
  currentUserId: string
) {
  const conversation = await requireConversationAccess(
    ctx,
    await getConversationDoc(ctx, conversationId),
    currentUserId
  )

  assertChatCallConversation(conversation)

  return conversation
}

async function requireCallJoinCall(ctx: MutationCtx, callId: string) {
  const call = await getCallDoc(ctx, callId)

  if (!call) {
    throw new Error("Call not found")
  }

  return call
}

function getResolvedCallRoom(
  source: {
    roomId?: string | null
    roomName?: string | null
  },
  args: FinalizeCallJoinArgs
) {
  if (source.roomId && source.roomName) {
    return {
      roomId: source.roomId,
      roomName: source.roomName,
      shouldUseProvisionedRoom: false,
    }
  }

  return {
    roomId: args.roomId,
    roomName: args.roomName,
    shouldUseProvisionedRoom: true,
  }
}

function getCallParticipantUserIds(call: CallDoc, currentUserId: string) {
  return [...new Set([...(call.participantUserIds ?? []), currentUserId])]
}

async function finalizeExistingCallJoin(
  ctx: MutationCtx,
  args: FinalizeCallJoinArgs,
  call: CallDoc
) {
  await requireChatCallConversation(
    ctx,
    call.conversationId,
    args.currentUserId
  )

  if (call.endedAt) {
    throw new Error("Call has already ended")
  }

  const now = getNow()
  const { roomId, roomName } = getResolvedCallRoom(call, args)

  await ctx.db.patch(call._id, {
    roomId,
    roomName,
    participantUserIds: getCallParticipantUserIds(call, args.currentUserId),
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

async function finalizeConversationCallJoin(
  ctx: MutationCtx,
  args: FinalizeCallJoinArgs
) {
  const conversation = await requireChatCallConversation(
    ctx,
    args.conversationId ?? "",
    args.currentUserId
  )
  const { roomId, roomName, shouldUseProvisionedRoom } = getResolvedCallRoom(
    conversation,
    args
  )

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

export async function finalizeCallJoinHandler(
  ctx: MutationCtx,
  args: FinalizeCallJoinArgs
) {
  assertServerToken(args.serverToken)
  assertCallJoinTarget(args)

  if (args.callId) {
    return finalizeExistingCallJoin(
      ctx,
      args,
      await requireCallJoinCall(ctx, args.callId)
    )
  }

  return finalizeConversationCallJoin(ctx, args)
}

async function resolveWritableChatConversation(
  ctx: MutationCtx,
  args: SendChatMessageArgs
): Promise<ChatConversation> {
  const conversation = await requireConversationAccess(
    ctx,
    await getConversationDoc(ctx, args.conversationId),
    args.currentUserId,
    "write"
  )

  if (conversation.kind !== "chat") {
    throw new Error("Messages can only be sent to chats")
  }

  return conversation
}

async function getChatMessageAudience(
  ctx: MutationCtx,
  conversation: ChatConversation,
  args: SendChatMessageArgs
): Promise<ChatMessageAudience> {
  const audienceUserIds = await getConversationAudienceUserIds(
    ctx,
    conversation
  )
  const audience = await getMentionAudienceContext(ctx, {
    actorUserId: args.currentUserId,
    audienceUserIds,
  })

  return audience
}

function getChatMessageDraft(args: SendChatMessageArgs): ChatMessageDraft {
  const messageHtml = args.content.trim()

  return {
    messageHtml,
    messageId: args.messageId?.trim() || createId("chat_message"),
    messageText: getPlainTextContent(messageHtml),
  }
}

async function getExistingChatMessage(
  ctx: MutationCtx,
  args: SendChatMessageArgs,
  messageId: string
) {
  return args.messageId?.trim() ? getChatMessageDoc(ctx, messageId) : null
}

function assertExistingChatMessageReusable(
  existingMessage: NonNullable<Awaited<ReturnType<typeof getChatMessageDoc>>>,
  conversation: ChatConversation,
  args: SendChatMessageArgs,
  messageHtml: string
) {
  if (
    existingMessage.conversationId !== conversation.id ||
    existingMessage.createdBy !== args.currentUserId ||
    existingMessage.content !== messageHtml
  ) {
    throw new Error("Message id is already in use")
  }
}

function assertChatHasOtherParticipants(
  conversation: ChatConversation,
  audienceUserIds: string[],
  args: SendChatMessageArgs
) {
  if (audienceUserIds.some((userId) => userId !== args.currentUserId)) {
    return
  }

  throw new Error(
    conversation.scopeType === "team"
      ? "This chat is read-only because the other participants have left the team or deleted their account"
      : "This chat is read-only because the other participants have left the workspace or deleted their account"
  )
}

async function getChatNotificationContext(
  ctx: MutationCtx,
  conversation: ChatConversation,
  actorName: string
): Promise<ChatNotificationContext> {
  return {
    actorName,
    entityPath: await getChatConversationPath(ctx, conversation),
    entityTitle: conversation.title.trim() || "a chat",
  }
}

async function insertChatMentionNotifications({
  args,
  context,
  conversation,
  ctx,
  mentionUserIds,
  messageText,
  usersById,
}: {
  args: SendChatMessageArgs
  context: ChatNotificationContext
  conversation: ChatConversation
  ctx: MutationCtx
  mentionUserIds: string[]
  messageText: string
  usersById: Map<string, ChatUser>
}) {
  const mentionEmails: MentionEmail[] = []
  const notifiedUserIds = new Set<string>()

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
      `${context.actorName} mentioned you in ${context.entityTitle}`,
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
        entityTitle: context.entityTitle,
        entityType: "chat",
        entityId: conversation.id,
        entityPath: context.entityPath,
        entityLabel: "chat",
        actorName: context.actorName,
        commentText: messageText,
      })
    }

    notifiedUserIds.add(mentionedUserId)
  }

  return {
    mentionEmails,
    notifiedUserIds,
  }
}

async function insertChatMessageNotifications({
  args,
  audienceUserIds,
  context,
  conversation,
  ctx,
  notifiedUserIds,
}: {
  args: SendChatMessageArgs
  audienceUserIds: string[]
  context: ChatNotificationContext
  conversation: ChatConversation
  ctx: MutationCtx
  notifiedUserIds: Set<string>
}) {
  for (const audienceUserId of audienceUserIds) {
    if (
      audienceUserId === args.currentUserId ||
      notifiedUserIds.has(audienceUserId)
    ) {
      continue
    }

    const notification = createNotification(
      audienceUserId,
      args.currentUserId,
      `${context.actorName} sent you a message in ${context.entityTitle}`,
      "chat",
      conversation.id,
      "message"
    )

    await ctx.db.insert("notifications", notification)
    notifiedUserIds.add(audienceUserId)
  }
}

export async function sendChatMessageHandler(
  ctx: MutationCtx,
  args: SendChatMessageArgs
) {
  assertServerToken(args.serverToken)
  const conversation = await resolveWritableChatConversation(ctx, args)
  const audience = await getChatMessageAudience(ctx, conversation, args)
  const now = getNow()
  const draft = getChatMessageDraft(args)
  const existingMessage = await getExistingChatMessage(
    ctx,
    args,
    draft.messageId
  )

  if (!draft.messageText) {
    throw new Error("Message content must include at least 1 character")
  }

  if (existingMessage) {
    assertExistingChatMessageReusable(
      existingMessage,
      conversation,
      args,
      draft.messageHtml
    )

    return {
      messageId: existingMessage.id,
      mentionEmails: [],
    }
  }

  assertChatHasOtherParticipants(conversation, audience.audienceUserIds, args)

  const mentionUserIds = createMentionIds(
    draft.messageHtml,
    audience.users,
    audience.audienceUserIds
  )
  const notificationContext = await getChatNotificationContext(
    ctx,
    conversation,
    audience.actorName
  )

  await ctx.db.insert("chatMessages", {
    id: draft.messageId,
    conversationId: conversation.id,
    kind: "text",
    content: draft.messageHtml,
    callId: null,
    mentionUserIds,
    reactions: [],
    createdBy: args.currentUserId,
    createdAt: now,
  })

  const mentionDelivery = await insertChatMentionNotifications({
    args,
    context: notificationContext,
    conversation,
    ctx,
    mentionUserIds,
    messageText: draft.messageText,
    usersById: audience.usersById,
  })

  await insertChatMessageNotifications({
    args,
    audienceUserIds: audience.audienceUserIds,
    context: notificationContext,
    conversation,
    ctx,
    notifiedUserIds: mentionDelivery.notifiedUserIds,
  })

  await ctx.db.patch(conversation._id, {
    updatedAt: now,
    lastActivityAt: now,
  })

  await queueEmailJobs(
    ctx,
    buildMentionEmailJobs({
      origin: args.origin,
      emails: mentionDelivery.mentionEmails,
    })
  )

  return {
    messageId: draft.messageId,
    mentionEmails: mentionDelivery.mentionEmails,
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

  const audience = await getMentionAudienceContext(ctx, {
    actorUserId: args.currentUserId,
    audienceUserIds: await getConversationAudienceUserIds(ctx, conversation),
  })
  const now = getNow()
  const postId = createId("channel_post")
  const mentionUserIds = createMentionIds(
    args.content,
    audience.users,
    audience.audienceUserIds
  ).filter((userId) => userId !== args.currentUserId)
  const entityTitle = args.title.trim() || "a channel post"
  const entityPath = await getChannelConversationPath(ctx, conversation, postId)

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

  const { mentionEmails } = await insertMentionNotifications({
    actorId: args.currentUserId,
    actorName: audience.actorName,
    commentText: getPlainTextContent(args.content),
    ctx,
    entityId: postId,
    entityLabel: "channel post",
    entityPath,
    entityTitle,
    entityType: "channelPost",
    mentionUserIds,
    usersById: audience.usersById,
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
    postId,
    mentionEmails,
  }
}

async function requireChannelPostWriteScope(
  ctx: MutationCtx,
  input: {
    channelKindErrorMessage?: string
    currentUserId: string
    postId: string
  }
) {
  const post = await getChannelPostDoc(ctx, input.postId)

  if (!post) {
    throw new Error("Post not found")
  }

  const conversation = await requireConversationAccess(
    ctx,
    await getConversationDoc(ctx, post.conversationId),
    input.currentUserId,
    "write"
  )

  if (input.channelKindErrorMessage && conversation.kind !== "channel") {
    throw new Error(input.channelKindErrorMessage)
  }

  return {
    conversation,
    post,
  }
}

async function getChannelCommentAudience(
  ctx: MutationCtx,
  input: {
    content: string
    conversation: ChannelConversationDoc
    currentUserId: string
  }
): Promise<ChannelCommentAudience> {
  const audience = await getMentionAudienceContext(ctx, {
    actorUserId: input.currentUserId,
    audienceUserIds: await getConversationAudienceUserIds(
      ctx,
      input.conversation
    ),
  })
  const mentionUserIds = createMentionIds(
    input.content,
    audience.users,
    audience.audienceUserIds
  ).filter((userId) => userId !== input.currentUserId)

  return {
    actorName: audience.actorName,
    audienceUserIds: audience.audienceUserIds,
    mentionUserIds,
    usersById: audience.usersById,
  }
}

async function insertChannelPostComment(
  ctx: MutationCtx,
  input: {
    commentId: string
    content: string
    currentUserId: string
    mentionUserIds: string[]
    now: string
    postId: string
  }
) {
  await ctx.db.insert("channelPostComments", {
    id: input.commentId,
    postId: input.postId,
    content: input.content.trim(),
    mentionUserIds: input.mentionUserIds,
    createdBy: input.currentUserId,
    createdAt: input.now,
  })
}

async function insertChannelPostMentionNotifications(
  ctx: MutationCtx,
  input: {
    actorName: string
    commentText: string
    currentUserId: string
    entityPath: string
    entityTitle: string
    mentionUserIds: string[]
    notifiedUserIds: Set<string>
    postId: string
    usersById: ChannelCommentAudience["usersById"]
  }
) {
  const mentionEmails: MentionEmail[] = []

  for (const mentionedUserId of input.mentionUserIds) {
    if (
      mentionedUserId === input.currentUserId ||
      input.notifiedUserIds.has(mentionedUserId)
    ) {
      continue
    }

    const mentionedUser = input.usersById.get(mentionedUserId)
    const notification = createNotification(
      mentionedUserId,
      input.currentUserId,
      `${input.actorName} mentioned you in ${input.entityTitle}`,
      "channelPost",
      input.postId,
      "mention"
    )

    await ctx.db.insert("notifications", notification)

    if (mentionedUser?.preferences.emailMentions) {
      mentionEmails.push({
        notificationId: notification.id,
        email: mentionedUser.email,
        name: mentionedUser.name,
        entityTitle: input.entityTitle,
        entityType: "channelPost",
        entityId: input.postId,
        entityPath: input.entityPath,
        entityLabel: "channel post",
        actorName: input.actorName,
        commentText: input.commentText,
      })
    }

    input.notifiedUserIds.add(mentionedUserId)
  }

  return mentionEmails
}

async function insertChannelPostFollowerNotifications(
  ctx: MutationCtx,
  input: {
    actorName: string
    audienceUserIds: string[]
    currentUserId: string
    entityTitle: string
    existingComments: Array<{ createdBy: string }>
    notifiedUserIds: Set<string>
    post: ChannelPostDoc
  }
) {
  const followerIds = [
    input.post.createdBy,
    ...input.existingComments.map((comment) => comment.createdBy),
  ]

  for (const followerId of followerIds) {
    if (
      !followerId ||
      !input.audienceUserIds.includes(followerId) ||
      followerId === input.currentUserId ||
      input.notifiedUserIds.has(followerId)
    ) {
      continue
    }

    await ctx.db.insert(
      "notifications",
      createNotification(
        followerId,
        input.currentUserId,
        `${input.actorName} commented on ${input.entityTitle}`,
        "channelPost",
        input.post.id,
        "comment"
      )
    )

    input.notifiedUserIds.add(followerId)
  }
}

async function touchChannelPostCommentThread(
  ctx: MutationCtx,
  input: {
    conversation: ChannelConversationDoc
    now: string
    post: ChannelPostDoc
  }
) {
  await ctx.db.patch(input.post._id, {
    updatedAt: input.now,
  })

  await ctx.db.patch(input.conversation._id, {
    updatedAt: input.now,
    lastActivityAt: input.now,
  })
}

export async function addChannelPostCommentHandler(
  ctx: MutationCtx,
  args: AddChannelPostCommentArgs
) {
  assertServerToken(args.serverToken)
  const { conversation, post } = await requireChannelPostWriteScope(ctx, {
    channelKindErrorMessage: "Comments can only be added to channels",
    currentUserId: args.currentUserId,
    postId: args.postId,
  })

  const existingComments = await ctx.db
    .query("channelPostComments")
    .withIndex("by_post", (q) => q.eq("postId", post.id))
    .collect()
  const now = getNow()
  const commentId = createId("channel_comment")
  const audience = await getChannelCommentAudience(ctx, {
    content: args.content,
    conversation,
    currentUserId: args.currentUserId,
  })
  const notifiedUserIds = new Set<string>()
  const entityTitle = post.title.trim() || "a channel post"
  const entityPath = await getChannelConversationPath(
    ctx,
    conversation,
    post.id
  )
  const commentText = getPlainTextContent(args.content)

  await insertChannelPostComment(ctx, {
    commentId,
    content: args.content,
    currentUserId: args.currentUserId,
    mentionUserIds: audience.mentionUserIds,
    now,
    postId: post.id,
  })
  const mentionEmails = await insertChannelPostMentionNotifications(ctx, {
    actorName: audience.actorName,
    commentText,
    currentUserId: args.currentUserId,
    entityPath,
    entityTitle,
    mentionUserIds: audience.mentionUserIds,
    notifiedUserIds,
    postId: post.id,
    usersById: audience.usersById,
  })
  await insertChannelPostFollowerNotifications(ctx, {
    actorName: audience.actorName,
    audienceUserIds: audience.audienceUserIds,
    currentUserId: args.currentUserId,
    entityTitle,
    existingComments,
    notifiedUserIds,
    post,
  })
  await touchChannelPostCommentThread(ctx, {
    conversation,
    now,
    post,
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
  const { conversation, post } = await requireChannelPostWriteScope(ctx, args)

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
