import { getInviteByTokenServer } from "@/lib/server/convex"
import type { AuthenticatedSession } from "@/lib/server/route-auth"
import { jsonError } from "@/lib/server/route-response"

type ServerInvite = NonNullable<
  Awaited<ReturnType<typeof getInviteByTokenServer>>
>

export async function requireSessionInviteByToken(input: {
  rejectExpired?: boolean
  session: AuthenticatedSession
  token: string
}): Promise<Response | ServerInvite> {
  const invite = await getInviteByTokenServer(input.token)

  if (!invite) {
    return jsonError("Invite not found", 404)
  }

  if (
    invite.invite.email.toLowerCase() !== input.session.user.email.toLowerCase()
  ) {
    return jsonError("This invite belongs to a different email address", 403)
  }

  if (
    input.rejectExpired === true &&
    new Date(invite.invite.expiresAt).getTime() < Date.now()
  ) {
    return jsonError("Invite has expired", 410)
  }

  return invite
}
