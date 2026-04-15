import { api } from "@/convex/_generated/api"

import { getConvexServerClient, withServerToken } from "./core"

export async function createWorkspaceChatServer(input: {
  currentUserId: string
  workspaceId: string
  participantIds: string[]
  title: string
  description: string
}) {
  return getConvexServerClient().mutation(
    api.app.createWorkspaceChat,
    withServerToken(input)
  )
}

export async function ensureTeamChatServer(input: {
  currentUserId: string
  teamId: string
  title: string
  description: string
}) {
  return getConvexServerClient().mutation(
    api.app.ensureTeamChat,
    withServerToken(input)
  )
}

export async function createChannelServer(input: {
  currentUserId: string
  teamId?: string
  workspaceId?: string
  title: string
  description: string
}) {
  return getConvexServerClient().mutation(
    api.app.createChannel,
    withServerToken(input)
  )
}

export async function sendChatMessageServer(input: {
  currentUserId: string
  conversationId: string
  content: string
}) {
  return getConvexServerClient().mutation(
    api.app.sendChatMessage,
    withServerToken(input)
  )
}

export async function createChannelPostServer(input: {
  currentUserId: string
  conversationId: string
  title: string
  content: string
}) {
  return getConvexServerClient().mutation(
    api.app.createChannelPost,
    withServerToken(input)
  )
}

export async function addChannelPostCommentServer(input: {
  currentUserId: string
  postId: string
  content: string
}) {
  return getConvexServerClient().mutation(
    api.app.addChannelPostComment,
    withServerToken(input)
  )
}

export async function deleteChannelPostServer(input: {
  currentUserId: string
  postId: string
}) {
  return getConvexServerClient().mutation(
    api.app.deleteChannelPost,
    withServerToken(input)
  )
}

export async function toggleChannelPostReactionServer(input: {
  currentUserId: string
  postId: string
  emoji: string
}) {
  return getConvexServerClient().mutation(
    api.app.toggleChannelPostReaction,
    withServerToken(input)
  )
}

export async function startChatCallServer(input: {
  currentUserId: string
  conversationId: string
  roomKey: string
  roomDescription: string
}) {
  return getConvexServerClient().mutation(
    api.app.startChatCall,
    withServerToken(input)
  )
}

export async function markCallJoinedServer(input: {
  currentUserId: string
  callId: string
}) {
  return getConvexServerClient().mutation(
    api.app.markCallJoined,
    withServerToken(input)
  )
}

export async function setCallRoomServer(input: {
  currentUserId: string
  callId: string
  roomId: string
  roomName: string
}) {
  return getConvexServerClient().mutation(
    api.app.setCallRoom,
    withServerToken(input)
  )
}

export async function setConversationRoomServer(input: {
  currentUserId: string
  conversationId: string
  roomId: string
  roomName: string
}) {
  return getConvexServerClient().mutation(
    api.app.setConversationRoom,
    withServerToken(input)
  )
}
