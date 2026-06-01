"use client"

import { normalizeStartConversationCallResult } from "./contracts"
import { runRouteMutation } from "./shared"

export function syncCreateWorkspaceChat(input: {
  workspaceId: string
  participantIds: string[]
  title: string
  description: string
}) {
  return runRouteMutation<{ conversationId: string }>("/api/chats", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  })
}

export function syncEnsureTeamChat(input: {
  teamId: string
  title: string
  description: string
}) {
  return runRouteMutation<{ conversationId: string }>("/api/chats/team", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  })
}

export function syncStartConversationCall(conversationId: string) {
  return runRouteMutation<unknown>(`/api/chats/${conversationId}/calls`, {
    method: "POST",
  }).then(normalizeStartConversationCallResult)
}

export function syncSendChatMessage(
  conversationId: string,
  content: string,
  messageId?: string
) {
  return runRouteMutation<{ messageId: string }>(
    `/api/chats/${conversationId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
        messageId,
      }),
    }
  )
}

export function syncUpdateChatMessage(messageId: string, content: string) {
  return runRouteMutation<{ ok: true }>(`/api/chat-messages/${messageId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content,
    }),
  })
}

export function syncDeleteChatMessage(messageId: string) {
  return runRouteMutation<{ ok: true }>(`/api/chat-messages/${messageId}`, {
    method: "DELETE",
  })
}

export function syncUpdateChatReadState(
  conversationId: string,
  action: "read" | "unread"
) {
  return runRouteMutation<{ ok: true }>(
    `/api/chats/${conversationId}/read-state`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
      }),
    }
  )
}

export function syncToggleChatMessageReaction(
  messageId: string,
  emoji: string
) {
  return runRouteMutation<{ ok: true }>(
    `/api/chat-messages/${messageId}/reactions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        emoji,
      }),
    }
  )
}

export function syncCreateChannel(input: {
  teamId?: string
  workspaceId?: string
  title: string
  description: string
}) {
  return runRouteMutation<{ conversationId: string }>("/api/channels", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  })
}

export function syncCreateChannelPost(input: {
  conversationId: string
  postId?: string
  title: string
  content: string
}) {
  return runRouteMutation<{ postId: string }>(
    `/api/channels/${input.conversationId}/posts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        postId: input.postId,
        title: input.title,
        content: input.content,
      }),
    }
  )
}

export function syncUpdateChannelPost(input: {
  postId: string
  title: string
  content: string
}) {
  return runRouteMutation<{ ok: true }>(`/api/channel-posts/${input.postId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: input.title,
      content: input.content,
    }),
  })
}

export function syncAddChannelPostComment(
  postId: string,
  content: string,
  commentId?: string
) {
  return runRouteMutation<{ commentId: string }>(
    `/api/channel-posts/${postId}/comments`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        commentId,
        content,
      }),
    }
  )
}

export function syncUpdateChannelPostComment(
  postId: string,
  commentId: string,
  content: string
) {
  return runRouteMutation<{ ok: true }>(
    `/api/channel-posts/${postId}/comments/${commentId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
      }),
    }
  )
}

export function syncDeleteChannelPost(postId: string) {
  return runRouteMutation<{ ok: true }>(`/api/channel-posts/${postId}`, {
    method: "DELETE",
  })
}

export function syncDeleteChannelPostComment(
  postId: string,
  commentId: string
) {
  return runRouteMutation<{ ok: true }>(
    `/api/channel-posts/${postId}/comments/${commentId}`,
    {
      method: "DELETE",
    }
  )
}

export function syncToggleChannelPostReaction(postId: string, emoji: string) {
  return runRouteMutation<{ ok: true }>(
    `/api/channel-posts/${postId}/reactions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        emoji,
      }),
    }
  )
}

export function syncToggleChannelPostCommentReaction(
  postId: string,
  commentId: string,
  emoji: string
) {
  return runRouteMutation<{ ok: true }>(
    `/api/channel-posts/${postId}/comments/${commentId}/reactions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        emoji,
      }),
    }
  )
}
