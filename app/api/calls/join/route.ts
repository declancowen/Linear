import { withAuth } from "@workos-inc/authkit-nextjs"
import { ConvexHttpClient } from "convex/browser"
import { NextResponse } from "next/server"

import { api } from "@/convex/_generated/api"
import { buildAuthHref } from "@/lib/auth-routing"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { createConversationJoinUrl } from "@/lib/server/100ms"

function getConvexServerClient() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL

  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured")
  }

  return new ConvexHttpClient(convexUrl)
}

function toMeetingRole(role: "admin" | "member" | "viewer" | "guest") {
  return role === "admin" || role === "member" ? "host" : "guest"
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const callId = url.searchParams.get("callId")?.trim()
  const conversationId = url.searchParams.get("conversationId")?.trim()
  const session = await withAuth()

  if (!callId && !conversationId) {
    return NextResponse.json(
      { error: "callId or conversationId is required" },
      { status: 400 }
    )
  }

  if (!session.user) {
    return NextResponse.redirect(
      buildAuthHref("login", `${url.pathname}${url.search}`),
      { status: 307 }
    )
  }

  try {
    const { authContext } = await ensureAuthenticatedAppContext(
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

    if (callId) {
      const call = snapshot?.calls.find((entry) => entry.id === callId) ?? null
      const conversation =
        snapshot?.conversations.find(
          (entry) => entry.id === call?.conversationId
        ) ?? null

      if (!call || !conversation || conversation.kind !== "chat") {
        return NextResponse.json({ error: "Call not found" }, { status: 404 })
      }

      if (conversation.scopeType === "workspace") {
        if (!conversation.participantIds.includes(authContext.currentUser.id)) {
          return NextResponse.json(
            { error: "You do not have access to this chat" },
            { status: 403 }
          )
        }

        await convex.mutation(api.app.markCallJoined, {
          currentUserId: authContext.currentUser.id,
          callId: call.id,
        })

        const joinUrl = await createConversationJoinUrl({
          roomKey: call.roomKey,
          roomDescription: call.roomDescription,
          roomId: call.roomId,
          userId: authContext.currentUser.id,
          userName: authContext.currentUser.name,
          role: "host",
        })

        return NextResponse.redirect(joinUrl, { status: 307 })
      }

      const membership = authContext.memberships.find(
        (entry) => entry.teamId === conversation.scopeId
      )

      if (!membership) {
        return NextResponse.json(
          { error: "You do not have access to this chat" },
          { status: 403 }
        )
      }

      await convex.mutation(api.app.markCallJoined, {
        currentUserId: authContext.currentUser.id,
        callId: call.id,
      })

      const joinUrl = await createConversationJoinUrl({
        roomKey: call.roomKey,
        roomDescription: call.roomDescription,
        roomId: call.roomId,
        userId: authContext.currentUser.id,
        userName: authContext.currentUser.name,
        role: toMeetingRole(membership.role),
      })

      return NextResponse.redirect(joinUrl, { status: 307 })
    }

    const conversation =
      snapshot?.conversations.find((entry) => entry.id === conversationId) ??
      null

    if (!conversation || conversation.kind !== "chat") {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      )
    }

    if (conversation.scopeType === "workspace") {
      if (!conversation.participantIds.includes(authContext.currentUser.id)) {
        return NextResponse.json(
          { error: "You do not have access to this chat" },
          { status: 403 }
        )
      }

      const joinUrl = await createConversationJoinUrl({
        roomKey: `chat-${conversation.id}`,
        roomDescription: `Persistent video room for workspace chat ${conversation.id}`,
        userId: authContext.currentUser.id,
        userName: authContext.currentUser.name,
        role: "host",
      })

      return NextResponse.redirect(joinUrl, { status: 307 })
    }

    const membership = authContext.memberships.find(
      (entry) => entry.teamId === conversation.scopeId
    )

    if (!membership) {
      return NextResponse.json(
        { error: "You do not have access to this chat" },
        { status: 403 }
      )
    }

    const joinUrl = await createConversationJoinUrl({
      roomKey: `team-${conversation.scopeId}`,
      roomDescription: `Persistent video room for team ${conversation.scopeId}`,
      userId: authContext.currentUser.id,
      userName: authContext.currentUser.name,
      role: toMeetingRole(membership.role),
    })

    return NextResponse.redirect(joinUrl, { status: 307 })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to join the call",
      },
      { status: 500 }
    )
  }
}
