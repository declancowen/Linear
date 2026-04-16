import { NextRequest } from "next/server"

import {
  getConvexErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import type { RequiredAppContext } from "@/lib/server/route-auth"
import { requireAppContext, requireSession } from "@/lib/server/route-auth"
import { isRouteResponse, jsonError, jsonOk } from "@/lib/server/route-response"
import { getSnapshotServer, sendChatMessageServer } from "@/lib/server/convex"

function createConversationJoinHref(conversationId: string) {
  const query = new URLSearchParams({
    conversationId,
  })

  return `/api/calls/join?${query.toString()}`
}

function getWorkspaceRolesForConversation(
  authContext: NonNullable<RequiredAppContext["authContext"]>,
  snapshot: NonNullable<Awaited<ReturnType<typeof getSnapshotServer>>>,
  workspaceId: string
) {
  const workspaceTeamIds = snapshot.teams
    .filter((team) => team.workspaceId === workspaceId)
    .map((team) => team.id)

  return authContext.memberships
    .filter((entry) => workspaceTeamIds.includes(entry.teamId))
    .map((entry) => entry.role)
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const session = await requireSession()

  if (isRouteResponse(session)) {
    return session
  }

  try {
    const { chatId } = await params
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const { ensuredUser, authContext } = appContext

    if (!authContext) {
      return jsonError("User context not found", 404)
    }

    const snapshot = await getSnapshotServer({
      workosUserId: authContext.currentUser.workosUserId ?? session.user.id,
      email: authContext.currentUser.email,
    })

    if (!snapshot) {
      return jsonError("Snapshot not available", 404)
    }

    const conversation =
      snapshot.conversations.find((entry) => entry.id === chatId) ?? null

    if (!conversation || conversation.kind !== "chat") {
      return jsonError("Conversation not found", 404)
    }

    if (
      conversation.scopeType === "workspace" &&
      !conversation.participantIds.includes(ensuredUser.userId)
    ) {
      return jsonError("You do not have access to this chat", 403)
    }

    if (conversation.scopeType === "workspace") {
      const workspaceRoles = getWorkspaceRolesForConversation(
        authContext,
        snapshot,
        conversation.scopeId
      )
      const canWrite = workspaceRoles.some(
        (role) => role === "admin" || role === "member"
      )

      if (!canWrite) {
        return jsonError("Your current role is read-only", 403)
      }
    }

    if (conversation.scopeType === "team") {
      const membership = authContext.memberships.find(
        (entry) => entry.teamId === conversation.scopeId
      )

      if (!membership) {
        return jsonError("You do not have access to this chat", 403)
      }

      if (membership.role === "viewer" || membership.role === "guest") {
        return jsonError("Your current role is read-only", 403)
      }
    }

    const joinHref = createConversationJoinHref(conversation.id)
    const createdAt = new Date().toISOString()
    const messageContent = `Started a call\nJoin call: ${joinHref}`

    const result = await sendChatMessageServer({
      currentUserId: ensuredUser.userId,
      conversationId: conversation.id,
      content: messageContent,
    })

    if (!result?.messageId) {
      throw new Error("Failed to create call")
    }

    return jsonOk({
      ok: true,
      call: null,
      message: {
        id: result.messageId,
        conversationId: conversation.id,
        kind: "text",
        content: messageContent,
        callId: null,
        mentionUserIds: [],
        createdBy: ensuredUser.userId,
        createdAt,
      },
      joinHref,
    })
  } catch (error) {
    logProviderError("Failed to start chat call", error)
    return jsonError(getConvexErrorMessage(error, "Failed to start call"), 500)
  }
}
