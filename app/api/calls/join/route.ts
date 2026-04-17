import { NextResponse } from "next/server"

import { buildAuthHref } from "@/lib/auth-routing"
import { ApplicationError } from "@/lib/server/application-errors"
import {
  getHmsErrorMessage,
  logProviderError,
} from "@/lib/server/provider-errors"
import {
  createConversationJoinUrl,
  ensureConversationRoom,
} from "@/lib/server/100ms"
import {
  finalizeCallJoinServer,
  getCallJoinContextServer,
} from "@/lib/server/convex"
import {
  requireAppContext,
  requireSession,
} from "@/lib/server/route-auth"
import { isRouteResponse, jsonError } from "@/lib/server/route-response"

function renderJoinErrorPage(message: string, status = 503) {
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
      status,
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

    const currentUserId = appContext.ensuredUser.userId
    const joinContext = await getCallJoinContextServer({
      currentUserId,
      callId: callId ?? undefined,
      conversationId: conversationId ?? undefined,
    })
    const provisionedRoom =
      joinContext.roomId && joinContext.roomName
        ? null
        : await ensureConversationRoom({
            roomKey: joinContext.roomKey,
            roomDescription: joinContext.roomDescription,
          })
    const finalJoinState =
      joinContext.callId || provisionedRoom
        ? await finalizeCallJoinServer({
            currentUserId,
            callId: joinContext.callId ?? undefined,
            conversationId: joinContext.conversationId,
            roomId: provisionedRoom?.id ?? joinContext.roomId ?? "",
            roomName: provisionedRoom?.name ?? joinContext.roomName ?? "",
          })
        : {
            roomId: joinContext.roomId,
            roomName: joinContext.roomName,
          }

    const joinUrl = await createConversationJoinUrl({
      roomKey: joinContext.roomKey,
      roomDescription: joinContext.roomDescription,
      roomId: finalJoinState.roomId,
      userId: currentUserId,
      userName: authContext.currentUser.name,
      role: joinContext.role,
    })

    return NextResponse.redirect(joinUrl, { status: 307 })
  } catch (error) {
    if (error instanceof ApplicationError) {
      return renderJoinErrorPage(error.message, error.status)
    }

    logProviderError("Failed to join call", error)
    return renderJoinErrorPage(
      getHmsErrorMessage(error, "Failed to join the call")
    )
  }
}
