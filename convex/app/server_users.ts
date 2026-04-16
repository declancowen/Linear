import { assertServerToken } from "./core"
import { resolveActiveUserByIdentity, type AppCtx } from "./data"

export async function resolveUserFromServerArgs(
  ctx: AppCtx,
  args: {
    serverToken: string
    workosUserId?: string
    email?: string
  }
  ) {
  assertServerToken(args.serverToken)
  return resolveActiveUserByIdentity(ctx, args)
}
