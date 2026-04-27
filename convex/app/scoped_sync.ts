import type { MutationCtx, QueryCtx } from "../_generated/server"

import { assertServerToken, getNow } from "./core"
import { getReadModelVersionDoc } from "./data"

type ServerAccessArgs = {
  serverToken: string
}

type GetScopedReadModelVersionsArgs = ServerAccessArgs & {
  scopeKeys: string[]
}

type BumpScopedReadModelVersionsArgs = ServerAccessArgs & {
  scopeKeys: string[]
}

function normalizeScopeKeys(scopeKeys: string[]) {
  return [...new Set(scopeKeys.map((scopeKey) => scopeKey.trim()).filter(Boolean))]
}

export async function getScopedReadModelVersionsHandler(
  ctx: QueryCtx,
  args: GetScopedReadModelVersionsArgs
) {
  assertServerToken(args.serverToken)

  const normalizedScopeKeys = normalizeScopeKeys(args.scopeKeys)
  const versions = await Promise.all(
    normalizedScopeKeys.map(async (scopeKey) => {
      const version = await getReadModelVersionDoc(ctx, scopeKey)

      return {
        scopeKey,
        version: version?.version ?? 0,
      }
    })
  )

  return {
    versions,
  }
}

export async function bumpScopedReadModelVersionsHandler(
  ctx: MutationCtx,
  args: BumpScopedReadModelVersionsArgs
) {
  assertServerToken(args.serverToken)

  const normalizedScopeKeys = normalizeScopeKeys(args.scopeKeys)
  const updatedAt = getNow()
  const versions: Array<{ scopeKey: string; version: number }> = []

  for (const scopeKey of normalizedScopeKeys) {
    const existing = await getReadModelVersionDoc(ctx, scopeKey)
    const version = (existing?.version ?? 0) + 1

    if (existing) {
      await ctx.db.patch(existing._id, {
        version,
        updatedAt,
      })
    } else {
      await ctx.db.insert("readModelVersions", {
        scopeKey,
        version,
        updatedAt,
      })
    }

    versions.push({
      scopeKey,
      version,
    })
  }

  return {
    versions,
  }
}
