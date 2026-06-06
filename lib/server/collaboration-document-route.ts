import {
  requireAppRouteContext,
  type RequiredAppContext,
} from "@/lib/server/route-auth"
import { isRouteResponse } from "@/lib/server/route-response"

export type DocumentCollaborationRouteContext = {
  appContext: RequiredAppContext
  currentUserId: string
  documentId: string
  request: Request
}

export async function handleDocumentCollaborationRoute(
  request: Request,
  params: Promise<{ documentId: string }>,
  handler: (context: DocumentCollaborationRouteContext) => Promise<Response>
) {
  const routeContext = await requireAppRouteContext()

  if (isRouteResponse(routeContext)) {
    return routeContext
  }

  const { documentId } = await params
  const { appContext } = routeContext

  return handler({
    appContext,
    currentUserId: appContext.ensuredUser.userId,
    documentId,
    request,
  })
}
