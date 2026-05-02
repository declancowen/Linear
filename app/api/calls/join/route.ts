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
  type AuthenticatedSession,
} from "@/lib/server/route-auth"
import { isRouteResponse, jsonError } from "@/lib/server/route-response"

type CallJoinIdentifiers = {
  callId: string | undefined
  conversationId: string | undefined
}

type CallJoinContext = Awaited<ReturnType<typeof getCallJoinContextServer>>

function getCallJoinIdentifiers(url: URL): CallJoinIdentifiers | null {
  const callId = url.searchParams.get("callId")?.trim() || undefined
  const conversationId =
    url.searchParams.get("conversationId")?.trim() || undefined

  if (!callId && !conversationId) {
    return null
  }

  return {
    callId,
    conversationId,
  }
}

async function requireCallJoinAppContext(session: AuthenticatedSession) {
  const appContext = await requireAppContext(session)

  if (isRouteResponse(appContext)) {
    return appContext
  }

  const authContext = appContext.authContext

  if (!authContext) {
    return jsonError("User context not found", 404)
  }

  return {
    authContext,
    currentUserId: appContext.ensuredUser.userId,
  }
}

function shouldProvisionConversationRoom(joinContext: CallJoinContext) {
  return !joinContext.roomId || !joinContext.roomName
}

async function getFinalCallJoinState(input: {
  currentUserId: string
  joinContext: CallJoinContext
}) {
  const provisionedRoom = shouldProvisionConversationRoom(input.joinContext)
    ? await ensureConversationRoom({
        roomKey: input.joinContext.roomKey,
        roomDescription: input.joinContext.roomDescription,
      })
    : null

  if (!input.joinContext.callId && !provisionedRoom) {
    return {
      roomId: input.joinContext.roomId,
      roomName: input.joinContext.roomName,
    }
  }

  return finalizeCallJoinServer({
    currentUserId: input.currentUserId,
    callId: input.joinContext.callId ?? undefined,
    conversationId: input.joinContext.conversationId,
    roomId: provisionedRoom?.id ?? input.joinContext.roomId ?? "",
    roomName: provisionedRoom?.name ?? input.joinContext.roomName ?? "",
  })
}

async function createCallJoinRedirectUrl(input: {
  currentUserId: string
  finalJoinState: {
    roomId?: string | null
    roomName?: string | null
  }
  joinContext: CallJoinContext
  userName: string
}) {
  return createConversationJoinUrl({
    roomKey: input.joinContext.roomKey,
    roomDescription: input.joinContext.roomDescription,
    roomId: input.finalJoinState.roomId,
    userId: input.currentUserId,
    userName: input.userName,
    role: input.joinContext.role,
  })
}

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
  const identifiers = getCallJoinIdentifiers(url)

  if (!identifiers) {
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
    const appContext = await requireCallJoinAppContext(session)

    if (isRouteResponse(appContext)) {
      return appContext
    }

    const { authContext, currentUserId } = appContext
    const joinContext = await getCallJoinContextServer({
      currentUserId,
      callId: identifiers.callId,
      conversationId: identifiers.conversationId,
    })
    const finalJoinState = await getFinalCallJoinState({
      currentUserId,
      joinContext,
    })
    const joinUrl = await createCallJoinRedirectUrl({
      currentUserId,
      finalJoinState,
      joinContext,
      userName: authContext.currentUser.name,
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
