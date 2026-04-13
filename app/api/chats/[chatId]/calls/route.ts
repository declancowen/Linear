import { withAuth } from "@workos-inc/authkit-nextjs"
import { ConvexHttpClient } from "convex/browser"
import { NextRequest, NextResponse } from "next/server"

import { api } from "@/convex/_generated/api"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { ensureConversationRoom } from "@/lib/server/100ms"

function getConvexServerClient() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL

  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured")
  }

  return new ConvexHttpClient(convexUrl)
}

function createConversationRoomConfig(conversation: {
  id: string
  scopeType: "workspace" | "team"
}) {
  const startedAt = new Date().toISOString()
  const uniqueSuffix = Date.now().toString(36)

  if (conversation.scopeType === "workspace") {
    return {
      roomKey: `call-${conversation.id}-${uniqueSuffix}`,
      roomDescription: `Video call for workspace chat ${conversation.id} started at ${startedAt}`,
    }
  }

  return {
    roomKey: `call-${conversation.id}-${uniqueSuffix}`,
    roomDescription: `Video call for team chat ${conversation.id} started at ${startedAt}`,
  }
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

    const convex = getConvexServerClient()
    const snapshot = await convex.query(api.app.getSnapshot, {
      email: authContext.currentUser.email,
    })
    const conversation =
      snapshot?.conversations.find((entry) => entry.id === chatId) ?? null

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

    const roomConfig = createConversationRoomConfig(conversation)
    const room = await ensureConversationRoom(roomConfig)
    const result = await convex.mutation(api.app.startChatCall, {
      currentUserId: ensuredUser.userId,
      conversationId: conversation.id,
      roomId: room.id,
      roomName: room.name,
      ...roomConfig,
    })

    if (!result?.call || !result.message) {
      throw new Error("Failed to create call")
    }

    const joinUrl = new URL("/api/calls/join", request.url)
    joinUrl.searchParams.set("callId", result.call.id)

    return NextResponse.json({
      ok: true,
      call: result.call,
      message: result.message,
      joinHref: joinUrl.toString(),
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
