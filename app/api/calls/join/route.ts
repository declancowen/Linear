import { NextResponse } from "next/server"

import { buildAuthHref } from "@/lib/auth-routing"
import {
  getHmsErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import {
  createConversationJoinUrl,
  ensureConversationRoom,
} from "@/lib/server/100ms"
import {
  getSnapshotServer,
  markCallJoinedServer,
  setCallRoomServer,
  setConversationRoomServer,
} from "@/lib/server/convex"
import {
  type RequiredAppContext,
  requireAppContext,
  requireSession,
} from "@/lib/server/route-auth"
import { isRouteResponse, jsonError } from "@/lib/server/route-response"

function toMeetingRole(role: "admin" | "member" | "viewer" | "guest") {
  return role === "admin" || role === "member" ? "host" : "guest"
}

function getWorkspaceMeetingRole(
  authContext: NonNullable<RequiredAppContext["authContext"]>,
  snapshot: NonNullable<Awaited<ReturnType<typeof getSnapshotServer>>>,
  workspaceId: string
) {
  const workspaceTeamIds = snapshot.teams
    .filter((team) => team.workspaceId === workspaceId)
    .map((team) => team.id)
  const workspaceRoles = authContext.memberships
    .filter((entry) => workspaceTeamIds.includes(entry.teamId))
    .map((entry) => entry.role)

  return workspaceRoles.some((role) => role === "admin" || role === "member")
    ? "host"
    : "guest"
}

function renderJoinErrorPage(message: string) {
  const escapedMessage = message
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")

  return new NextResponse(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Video unavailable</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #0b0b0d;
        color: #f3f4f6;
        font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        width: min(32rem, calc(100vw - 2rem));
        padding: 1.5rem;
        border-radius: 1rem;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      h1 {
        margin: 0 0 0.75rem;
        font-size: 1.125rem;
      }
      p {
        margin: 0;
        color: rgba(243, 244, 246, 0.76);
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Video call unavailable</h1>
      <p>${escapedMessage}</p>
    </main>
  </body>
</html>`,
    {
      status: 503,
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    }
  )
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const callId = url.searchParams.get("callId")?.trim()
  const conversationId = url.searchParams.get("conversationId")?.trim()

  if (!callId && !conversationId) {
    return jsonError("callId or conversationId is required", 400)
  }

  const session = await requireSession()

  if (isRouteResponse(session)) {
    return NextResponse.redirect(
      buildAuthHref("login", `${url.pathname}${url.search}`),
      { status: 307 }
    )
  }

  try {
    const appContext = await requireAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const authContext = appContext.authContext

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

    if (callId) {
      const call = snapshot.calls.find((entry) => entry.id === callId) ?? null
      const conversation =
        snapshot.conversations.find(
          (entry) => entry.id === call?.conversationId
        ) ?? null

      if (!call || !conversation || conversation.kind !== "chat") {
        return jsonError("Call not found", 404)
      }

      if (conversation.scopeType === "workspace") {
        if (!conversation.participantIds.includes(authContext.currentUser.id)) {
          return jsonError("You do not have access to this chat", 403)
        }

        const room =
          call.roomId && call.roomName
            ? {
                id: call.roomId,
                name: call.roomName,
              }
            : await ensureConversationRoom({
                roomKey: call.roomKey,
                roomDescription: call.roomDescription,
              })

        if (!call.roomId || !call.roomName) {
          await setCallRoomServer({
            currentUserId: authContext.currentUser.id,
            callId: call.id,
            roomId: room.id,
            roomName: room.name,
          })
        }

        await markCallJoinedServer({
          currentUserId: authContext.currentUser.id,
          callId: call.id,
        })

        const joinUrl = await createConversationJoinUrl({
          roomKey: call.roomKey,
          roomDescription: call.roomDescription,
          roomId: room.id,
          userId: authContext.currentUser.id,
          userName: authContext.currentUser.name,
          role: getWorkspaceMeetingRole(
            authContext,
            snapshot,
            conversation.scopeId
          ),
        })

        return NextResponse.redirect(joinUrl, { status: 307 })
      }

      const membership = authContext.memberships.find(
        (entry) => entry.teamId === conversation.scopeId
      )

      if (!membership) {
        return jsonError("You do not have access to this chat", 403)
      }

      const room =
        call.roomId && call.roomName
          ? {
              id: call.roomId,
              name: call.roomName,
            }
          : await ensureConversationRoom({
              roomKey: call.roomKey,
              roomDescription: call.roomDescription,
            })

      if (!call.roomId || !call.roomName) {
        await setCallRoomServer({
          currentUserId: authContext.currentUser.id,
          callId: call.id,
          roomId: room.id,
          roomName: room.name,
        })
      }

      await markCallJoinedServer({
        currentUserId: authContext.currentUser.id,
        callId: call.id,
      })

      const joinUrl = await createConversationJoinUrl({
        roomKey: call.roomKey,
        roomDescription: call.roomDescription,
        roomId: room.id,
        userId: authContext.currentUser.id,
        userName: authContext.currentUser.name,
        role: toMeetingRole(membership.role),
      })

      return NextResponse.redirect(joinUrl, { status: 307 })
    }

    const conversation =
      snapshot.conversations.find((entry) => entry.id === conversationId) ??
      null

    if (!conversation || conversation.kind !== "chat") {
      return jsonError("Conversation not found", 404)
    }

    if (conversation.scopeType === "workspace") {
      if (!conversation.participantIds.includes(authContext.currentUser.id)) {
        return jsonError("You do not have access to this chat", 403)
      }

      const roomKey = `chat-${conversation.id}`
      const roomDescription = `Persistent video room for workspace chat ${conversation.id}`
      const room =
        conversation.roomId && conversation.roomName
          ? {
              id: conversation.roomId,
              name: conversation.roomName,
            }
          : await ensureConversationRoom({
              roomKey,
              roomDescription,
            })

      if (!conversation.roomId || !conversation.roomName) {
        await setConversationRoomServer({
          currentUserId: authContext.currentUser.id,
          conversationId: conversation.id,
          roomId: room.id,
          roomName: room.name,
        })
      }

      const joinUrl = await createConversationJoinUrl({
        roomKey,
        roomDescription,
        roomId: room.id,
        userId: authContext.currentUser.id,
        userName: authContext.currentUser.name,
        role: getWorkspaceMeetingRole(
          authContext,
          snapshot,
          conversation.scopeId
        ),
      })

      return NextResponse.redirect(joinUrl, { status: 307 })
    }

    const membership = authContext.memberships.find(
      (entry) => entry.teamId === conversation.scopeId
    )

    if (!membership) {
      return jsonError("You do not have access to this chat", 403)
    }

    const roomKey = `chat-${conversation.id}`
    const roomDescription = `Persistent video room for team chat ${conversation.id}`
    const room =
      conversation.roomId && conversation.roomName
        ? {
            id: conversation.roomId,
            name: conversation.roomName,
          }
        : await ensureConversationRoom({
            roomKey,
            roomDescription,
          })

    if (!conversation.roomId || !conversation.roomName) {
      await setConversationRoomServer({
        currentUserId: authContext.currentUser.id,
        conversationId: conversation.id,
        roomId: room.id,
        roomName: room.name,
      })
    }

    const joinUrl = await createConversationJoinUrl({
      roomKey,
      roomDescription,
      roomId: room.id,
      userId: authContext.currentUser.id,
      userName: authContext.currentUser.name,
      role: toMeetingRole(membership.role),
    })

    return NextResponse.redirect(joinUrl, { status: 307 })
  } catch (error) {
    logProviderError("Failed to join call", error)
    return renderJoinErrorPage(
      getHmsErrorMessage(error, "Failed to join the call")
    )
  }
}
