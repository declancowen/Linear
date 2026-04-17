import { api } from "@/convex/_generated/api"
import { prepareRichTextForStorage } from "@/lib/content/rich-text-security"
import { ApplicationError, coerceApplicationError } from "@/lib/server/application-errors"

import { getConvexServerClient, withServerToken } from "./core"
import { resolveServerOrigin } from "../request-origin"

function isCollaborationAccessDeniedMessage(message: string) {
  return (
    message === "You do not have access to this conversation" ||
    message === "You do not have access to this workspace" ||
    message === "You do not have access to this team"
  )
}

const START_CHAT_CALL_ERROR_MAPPINGS = [
  {
    match: "Conversation not found",
    status: 404,
    code: "CHAT_CONVERSATION_NOT_FOUND",
  },
  {
    match: "Calls can only be started from chats",
    status: 400,
    code: "CHAT_CALL_INVALID_CONVERSATION_KIND",
  },
  {
    match: isCollaborationAccessDeniedMessage,
    status: 403,
    code: "CHAT_ACCESS_DENIED",
  },
  {
    match: "Your current role is read-only",
    status: 403,
    code: "CHAT_READ_ONLY",
  },
] as const

const SEND_CHAT_MESSAGE_ERROR_MAPPINGS = [
  {
    match: "Conversation not found",
    status: 404,
    code: "CHAT_CONVERSATION_NOT_FOUND",
  },
  {
    match: "Messages can only be sent to chats",
    status: 400,
    code: "CHAT_MESSAGE_INVALID_CONVERSATION_KIND",
  },
  {
    match: isCollaborationAccessDeniedMessage,
    status: 403,
    code: "CHAT_ACCESS_DENIED",
  },
  {
    match: "Your current role is read-only",
    status: 403,
    code: "CHAT_READ_ONLY",
  },
  {
    match: (message: string) =>
      message.startsWith("This chat is read-only because "),
    status: 403,
    code: "CHAT_AUDIENCE_READ_ONLY",
  },
] as const

const CREATE_CHANNEL_POST_ERROR_MAPPINGS = [
  {
    match: "Conversation not found",
    status: 404,
    code: "CHANNEL_CONVERSATION_NOT_FOUND",
  },
  {
    match: "Posts can only be created in channels",
    status: 400,
    code: "CHANNEL_POST_INVALID_CONVERSATION_KIND",
  },
  {
    match: isCollaborationAccessDeniedMessage,
    status: 403,
    code: "CHANNEL_ACCESS_DENIED",
  },
  {
    match: "Your current role is read-only",
    status: 403,
    code: "CHANNEL_READ_ONLY",
  },
] as const

const ADD_CHANNEL_POST_COMMENT_ERROR_MAPPINGS = [
  {
    match: "Post not found",
    status: 404,
    code: "CHANNEL_POST_NOT_FOUND",
  },
  {
    match: "Conversation not found",
    status: 404,
    code: "CHANNEL_CONVERSATION_NOT_FOUND",
  },
  {
    match: "Comments can only be added to channels",
    status: 400,
    code: "CHANNEL_POST_COMMENT_INVALID_CONVERSATION_KIND",
  },
  {
    match: isCollaborationAccessDeniedMessage,
    status: 403,
    code: "CHANNEL_ACCESS_DENIED",
  },
  {
    match: "Your current role is read-only",
    status: 403,
    code: "CHANNEL_READ_ONLY",
  },
] as const

const CREATE_WORKSPACE_CHAT_ERROR_MAPPINGS = [
  {
    match: "Chats need at least two workspace members",
    status: 400,
    code: "CHAT_PARTICIPANTS_INVALID",
  },
  {
    match: (message: string) =>
      message === "Your current role is read-only" ||
      message === "You do not have access to this workspace",
    status: 403,
    code: "CHAT_ACCESS_DENIED",
  },
] as const

const ENSURE_TEAM_CHAT_ERROR_MAPPINGS = [
  {
    match: "Team not found",
    status: 404,
    code: "TEAM_NOT_FOUND",
  },
  {
    match: "Chat is disabled for this team",
    status: 400,
    code: "TEAM_CHAT_DISABLED",
  },
  {
    match: (message: string) =>
      message === "Your current role is read-only" ||
      message === "You do not have access to this team" ||
      message === "You do not have access to this workspace",
    status: 403,
    code: "TEAM_CHAT_ACCESS_DENIED",
  },
] as const

const CREATE_CHANNEL_ERROR_MAPPINGS = [
  {
    match: "Channel must target exactly one team or workspace",
    status: 400,
    code: "CHANNEL_TARGET_INVALID",
  },
  {
    match: "Team not found",
    status: 404,
    code: "TEAM_NOT_FOUND",
  },
  {
    match: "Workspace not found",
    status: 404,
    code: "WORKSPACE_NOT_FOUND",
  },
  {
    match: "Channel is disabled for this team",
    status: 400,
    code: "TEAM_CHANNEL_DISABLED",
  },
  {
    match: (message: string) =>
      message === "Your current role is read-only" ||
      message === "You do not have access to this team" ||
      message === "You do not have access to this workspace",
    status: 403,
    code: "CHANNEL_ACCESS_DENIED",
  },
] as const

const DELETE_CHANNEL_POST_ERROR_MAPPINGS = [
  {
    match: "Post not found",
    status: 404,
    code: "CHANNEL_POST_NOT_FOUND",
  },
  {
    match: isCollaborationAccessDeniedMessage,
    status: 403,
    code: "CHANNEL_ACCESS_DENIED",
  },
  {
    match: "Your current role is read-only",
    status: 403,
    code: "CHANNEL_READ_ONLY",
  },
  {
    match: "You can only delete your own posts",
    status: 403,
    code: "CHANNEL_POST_DELETE_FORBIDDEN",
  },
] as const

const TOGGLE_CHANNEL_POST_REACTION_ERROR_MAPPINGS = [
  {
    match: "Post not found",
    status: 404,
    code: "CHANNEL_POST_NOT_FOUND",
  },
  {
    match: isCollaborationAccessDeniedMessage,
    status: 403,
    code: "CHANNEL_ACCESS_DENIED",
  },
  {
    match: "Your current role is read-only",
    status: 403,
    code: "CHANNEL_READ_ONLY",
  },
] as const

const SET_CONVERSATION_ROOM_ERROR_MAPPINGS = [
  {
    match: "Conversation not found",
    status: 404,
    code: "CHAT_CONVERSATION_NOT_FOUND",
  },
  {
    match: isCollaborationAccessDeniedMessage,
    status: 403,
    code: "CHAT_ACCESS_DENIED",
  },
  {
    match: "Rooms can only be attached to chats",
    status: 400,
    code: "CHAT_ROOM_INVALID_CONVERSATION_KIND",
  },
] as const

const SET_CALL_ROOM_ERROR_MAPPINGS = [
  {
    match: "Call not found",
    status: 404,
    code: "CHAT_CALL_NOT_FOUND",
  },
  {
    match: "Conversation not found",
    status: 404,
    code: "CHAT_CONVERSATION_NOT_FOUND",
  },
  {
    match: isCollaborationAccessDeniedMessage,
    status: 403,
    code: "CHAT_ACCESS_DENIED",
  },
] as const

const MARK_CALL_JOINED_ERROR_MAPPINGS = [
  {
    match: "Call not found",
    status: 404,
    code: "CHAT_CALL_NOT_FOUND",
  },
  {
    match: "Conversation not found",
    status: 404,
    code: "CHAT_CONVERSATION_NOT_FOUND",
  },
  {
    match: isCollaborationAccessDeniedMessage,
    status: 403,
    code: "CHAT_ACCESS_DENIED",
  },
  {
    match: "Call has already ended",
    status: 409,
    code: "CHAT_CALL_ENDED",
  },
] as const

const GET_CALL_JOIN_CONTEXT_ERROR_MAPPINGS = [
  {
    match: "callId or conversationId is required",
    status: 400,
    code: "CHAT_CALL_JOIN_TARGET_REQUIRED",
  },
  {
    match: "Call not found",
    status: 404,
    code: "CHAT_CALL_NOT_FOUND",
  },
  {
    match: "Conversation not found",
    status: 404,
    code: "CHAT_CONVERSATION_NOT_FOUND",
  },
  {
    match: isCollaborationAccessDeniedMessage,
    status: 403,
    code: "CHAT_ACCESS_DENIED",
  },
  {
    match: "Calls can only be joined from chats",
    status: 400,
    code: "CHAT_CALL_JOIN_INVALID_CONVERSATION_KIND",
  },
] as const

const FINALIZE_CALL_JOIN_ERROR_MAPPINGS = [
  ...GET_CALL_JOIN_CONTEXT_ERROR_MAPPINGS,
  {
    match: "Call has already ended",
    status: 409,
    code: "CHAT_CALL_ENDED",
  },
] as const

export async function createWorkspaceChatServer(input: {
  currentUserId: string
  workspaceId: string
  participantIds: string[]
  title: string
  description: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.createWorkspaceChat,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...CREATE_WORKSPACE_CHAT_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function ensureTeamChatServer(input: {
  currentUserId: string
  teamId: string
  title: string
  description: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.ensureTeamChat,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...ENSURE_TEAM_CHAT_ERROR_MAPPINGS]) ?? error
    )
  }
}

export async function createChannelServer(input: {
  currentUserId: string
  teamId?: string
  workspaceId?: string
  title: string
  description: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.createChannel,
      withServerToken(input)
    )
  } catch (error) {
    throw coerceApplicationError(error, [...CREATE_CHANNEL_ERROR_MAPPINGS]) ?? error
  }
}

export async function sendChatMessageServer(input: {
  currentUserId: string
  conversationId: string
  content: string
}) {
  const preparedContent = prepareRichTextForStorage(input.content, {
    minPlainTextCharacters: 1,
  })

  if (!preparedContent.isMeaningful) {
    throw new ApplicationError(
      "Message content must include at least 1 character",
      400,
      {
        code: "CHAT_MESSAGE_CONTENT_REQUIRED",
      }
    )
  }

  try {
    const origin = await resolveServerOrigin()

    return await getConvexServerClient().mutation(
      api.app.sendChatMessage,
      withServerToken({
        ...input,
        origin,
        content: preparedContent.sanitized,
      })
    )
  } catch (error) {
    throw coerceApplicationError(error, [...SEND_CHAT_MESSAGE_ERROR_MAPPINGS]) ?? error
  }
}

export async function createChannelPostServer(input: {
  currentUserId: string
  conversationId: string
  title: string
  content: string
}) {
  const preparedContent = prepareRichTextForStorage(input.content, {
    minPlainTextCharacters: 2,
  })

  if (!preparedContent.isMeaningful) {
    throw new ApplicationError(
      "Post content must include at least 2 characters",
      400,
      {
        code: "CHANNEL_POST_CONTENT_REQUIRED",
      }
    )
  }

  try {
    const origin = await resolveServerOrigin()

    return await getConvexServerClient().mutation(
      api.app.createChannelPost,
      withServerToken({
        ...input,
        origin,
        content: preparedContent.sanitized,
      })
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...CREATE_CHANNEL_POST_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function addChannelPostCommentServer(input: {
  currentUserId: string
  postId: string
  content: string
}) {
  const preparedContent = prepareRichTextForStorage(input.content, {
    minPlainTextCharacters: 1,
  })

  if (!preparedContent.isMeaningful) {
    throw new ApplicationError(
      "Comment content must include at least 1 character",
      400,
      {
        code: "CHANNEL_POST_COMMENT_CONTENT_REQUIRED",
      }
    )
  }

  try {
    const origin = await resolveServerOrigin()

    return await getConvexServerClient().mutation(
      api.app.addChannelPostComment,
      withServerToken({
        ...input,
        origin,
        content: preparedContent.sanitized,
      })
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...ADD_CHANNEL_POST_COMMENT_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function deleteChannelPostServer(input: {
  currentUserId: string
  postId: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.deleteChannelPost,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...DELETE_CHANNEL_POST_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function toggleChannelPostReactionServer(input: {
  currentUserId: string
  postId: string
  emoji: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.toggleChannelPostReaction,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(
        error,
        [...TOGGLE_CHANNEL_POST_REACTION_ERROR_MAPPINGS]
      ) ?? error
    )
  }
}

export async function startChatCallServer(input: {
  currentUserId: string
  conversationId: string
  roomKey: string
  roomDescription: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.startChatCall,
      withServerToken(input)
    )
  } catch (error) {
    throw coerceApplicationError(error, [...START_CHAT_CALL_ERROR_MAPPINGS]) ?? error
  }
}

export async function getCallJoinContextServer(input: {
  currentUserId: string
  callId?: string
  conversationId?: string
}) {
  try {
    return await getConvexServerClient().query(
      api.app.getCallJoinContext,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...GET_CALL_JOIN_CONTEXT_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function finalizeCallJoinServer(input: {
  currentUserId: string
  callId?: string
  conversationId?: string
  roomId: string
  roomName: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.finalizeCallJoin,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...FINALIZE_CALL_JOIN_ERROR_MAPPINGS]) ??
      error
    )
  }
}

export async function markCallJoinedServer(input: {
  currentUserId: string
  callId: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.markCallJoined,
      withServerToken(input)
    )
  } catch (error) {
    throw coerceApplicationError(error, [...MARK_CALL_JOINED_ERROR_MAPPINGS]) ?? error
  }
}

export async function setCallRoomServer(input: {
  currentUserId: string
  callId: string
  roomId: string
  roomName: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.setCallRoom,
      withServerToken(input)
    )
  } catch (error) {
    throw coerceApplicationError(error, [...SET_CALL_ROOM_ERROR_MAPPINGS]) ?? error
  }
}

export async function setConversationRoomServer(input: {
  currentUserId: string
  conversationId: string
  roomId: string
  roomName: string
}) {
  try {
    return await getConvexServerClient().mutation(
      api.app.setConversationRoom,
      withServerToken(input)
    )
  } catch (error) {
    throw (
      coerceApplicationError(error, [...SET_CONVERSATION_ROOM_ERROR_MAPPINGS]) ??
      error
    )
  }
}
