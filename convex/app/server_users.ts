import { assertServerToken } from "./core"
import {
  getUserByEmail,
  getUserByWorkOSUserId,
  type AppCtx,
} from "./data"

export async function resolveUserFromServerArgs(
  ctx: AppCtx,
  args: {
    serverToken: string
    workosUserId?: string
    email?: string
  }
) {
  assertServerToken(args.serverToken)

  if (args.workosUserId) {
    const byWorkosId = await getUserByWorkOSUserId(ctx, args.workosUserId)

    if (byWorkosId) {
      return byWorkosId
    }
  }

  if (args.email) {
    return getUserByEmail(ctx, args.email)
  }

  return null
}
