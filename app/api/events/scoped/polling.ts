import { ApplicationError } from "@/lib/server/application-errors"
import { getScopedReadModelVersionsServer } from "@/lib/server/convex"

export type ScopedEventStreamContext = {
  sendEvent: (
    event: string,
    payload: unknown,
    options?: {
      retryMs?: number
    }
  ) => void
}

export type ScopedReadModelPollState = {
  currentVersions: Map<string, number>
}

export async function pollScopedReadModelVersions(
  context: ScopedEventStreamContext,
  state: ScopedReadModelPollState,
  scopeKeys: string[],
  unavailableRetryMs: number
) {
  let next

  try {
    next = await getScopedReadModelVersionsServer({
      scopeKeys,
    })
  } catch (error) {
    if (
      error instanceof ApplicationError &&
      error.code === "SCOPED_READ_MODELS_UNAVAILABLE"
    ) {
      context.sendEvent(
        "unavailable",
        {
          code: error.code,
          message: error.message,
        },
        {
          retryMs: unavailableRetryMs,
        }
      )
      return "stop"
    }

    throw error
  }

  const changed = next.versions.filter(
    (entry) => state.currentVersions.get(entry.scopeKey) !== entry.version
  )

  if (changed.length > 0) {
    state.currentVersions = new Map(
      next.versions.map((entry) => [entry.scopeKey, entry.version])
    )
    context.sendEvent("scope", {
      versions: changed,
    })
    return "changed"
  }
}
