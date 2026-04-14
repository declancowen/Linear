import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"

import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import {
  getSnapshotServer,
  sendChatMessageServer,
} from "@/lib/server/convex"

function createConversationJoinHref(conversationId: string) {
  const query = new URLSearchParams({
    conversationId,
  })

  return `/api/calls/join?${query.toString()}`
}

function getWorkspaceRolesForConversation(
  authContext: NonNullable<
    Awaited<ReturnType<typeof ensureAuthenticatedAppContext>>["authContext"]
  >,
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
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { chatId } = await params
    const { ensuredUser, authContext } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )

    if (!authContext) {
      return NextResponse.json(
        { error: "User context not found" },
        { status: 404 }
      )
    }

    const snapshot = await getSnapshotServer({
      workosUserId: authContext.currentUser.workosUserId ?? session.user.id,
      email: authContext.currentUser.email,
    })

    if (!snapshot) {
      return NextResponse.json(
        { error: "Snapshot not available" },
        { status: 404 }
      )
    }

    const conversation =
      snapshot.conversations.find((entry) => entry.id === chatId) ?? null

    if (!conversation || conversation.kind !== "chat") {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      )
    }

    if (
      conversation.scopeType === "workspace" &&
      !conversation.participantIds.includes(ensuredUser.userId)
    ) {
      return NextResponse.json(
        { error: "You do not have access to this chat" },
        { status: 403 }
      )
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
        return NextResponse.json(
          { error: "Your current role is read-only" },
          { status: 403 }
        )
      }
    }

    if (conversation.scopeType === "team") {
      const membership = authContext.memberships.find(
        (entry) => entry.teamId === conversation.scopeId
      )

      if (!membership) {
        return NextResponse.json(
          { error: "You do not have access to this chat" },
          { status: 403 }
        )
      }

      if (membership.role === "viewer" || membership.role === "guest") {
        return NextResponse.json(
          { error: "Your current role is read-only" },
          { status: 403 }
        )
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

    return NextResponse.json({
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
    console.error(error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to start call",
      },
      { status: 500 }
    )
  }
}
