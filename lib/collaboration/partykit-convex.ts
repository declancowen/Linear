import { ConvexHttpClient } from "convex/browser"

import { api } from "@/convex/_generated/api"

type CollaborationRuntimeEnv = Record<string, unknown>

type CollaborationProjectScope = {
  projectId: string
  scopeType: "team" | "workspace"
  scopeId: string
}

export type CollaborationDocumentFromConvex = {
  documentId: string
  kind: "team-document" | "workspace-document" | "private-document" | "item-description"
  title: string
  content: string
  workspaceId: string | null
  teamId: string | null
  updatedAt: string
  updatedBy: string
  canEdit: boolean
  itemId: string | null
  itemUpdatedAt: string | null
  searchWorkspaceId?: string | null
  teamMemberIds?: string[] | null
  projectScopes?: CollaborationProjectScope[] | null
}

const TRANSIENT_CONVEX_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "ENOTFOUND",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
])
const CONVEX_RETRY_DELAYS_MS = [150, 400]
const convexClients = new Map<string, ConvexHttpClient>()

function readEnvString(env: CollaborationRuntimeEnv, key: string) {
  const value = env[key]

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function getConvexUrl(env: CollaborationRuntimeEnv) {
  const convexUrl =
    readEnvString(env, "CONVEX_URL") ??
    readEnvString(env, "NEXT_PUBLIC_CONVEX_URL")

  if (!convexUrl) {
    throw new Error("CONVEX_URL or NEXT_PUBLIC_CONVEX_URL is not configured")
  }

  return convexUrl
}

function getServerToken(env: CollaborationRuntimeEnv) {
  const serverToken = readEnvString(env, "CONVEX_SERVER_TOKEN")

  if (!serverToken) {
    throw new Error("CONVEX_SERVER_TOKEN is not configured")
  }

  return serverToken
}

function getConvexClient(env: CollaborationRuntimeEnv) {
  const convexUrl = getConvexUrl(env)
  const existingClient = convexClients.get(convexUrl)

  if (existingClient) {
    return existingClient
  }

  const nextClient = new ConvexHttpClient(convexUrl)
  convexClients.set(convexUrl, nextClient)

  return nextClient
}

function withServerToken<T extends Record<string, unknown>>(
  env: CollaborationRuntimeEnv,
  input: T
) {
  return {
    ...input,
    serverToken: getServerToken(env),
  }
}

function sleep(durationMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs)
  })
}

function getErrorProperty(error: unknown, property: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    property in error &&
    typeof error[property as keyof typeof error] === "string"
  ) {
    return error[property as keyof typeof error] as string
  }

  return null
}

function getErrorCause(error: unknown) {
  if (typeof error === "object" && error !== null && "cause" in error) {
    return error.cause
  }

  return null
}

function hasTransientConvexErrorCode(error: unknown): boolean {
  let current: unknown = error
  let depth = 0

  while (current && depth < 4) {
    const code = getErrorProperty(current, "code")

    if (code && TRANSIENT_CONVEX_ERROR_CODES.has(code)) {
      return true
    }

    current = getErrorCause(current)
    depth += 1
  }

  return false
}

function isTransientConvexTransportError(error: unknown) {
  if (hasTransientConvexErrorCode(error)) {
    return true
  }

  let current: unknown = error
  let depth = 0

  while (current && depth < 4) {
    const message = getErrorProperty(current, "message")?.toLowerCase()

    if (
      message?.includes("fetch failed") ||
      message?.includes("network") ||
      message?.includes("socket") ||
      message?.includes("timed out")
    ) {
      return true
    }

    current = getErrorCause(current)
    depth += 1
  }

  return false
}

async function runConvexRequestWithRetry<T>(
  label: string,
  request: () => Promise<T>
) {
  for (
    let attempt = 0;
    attempt <= CONVEX_RETRY_DELAYS_MS.length;
    attempt += 1
  ) {
    try {
      return await request()
    } catch (error) {
      if (
        !isTransientConvexTransportError(error) ||
        attempt === CONVEX_RETRY_DELAYS_MS.length
      ) {
        throw error
      }

      console.warn(`Retrying ${label} after transient Convex failure`, {
        attempt: attempt + 1,
        message: getErrorProperty(error, "message"),
        code: getErrorProperty(error, "code"),
      })

      await sleep(CONVEX_RETRY_DELAYS_MS[attempt]!)
    }
  }

  throw new Error(`Exhausted retries for ${label}`)
}

export async function getCollaborationDocumentFromConvex(
  env: CollaborationRuntimeEnv,
  input: {
    currentUserId: string
    documentId: string
  }
) {
  return runConvexRequestWithRetry("getCollaborationDocumentFromConvex", () =>
    getConvexClient(env).query(
      api.app.getCollaborationDocument,
      withServerToken(env, input)
    )
  ) as Promise<CollaborationDocumentFromConvex>
}

export async function persistCollaborationDocumentToConvex(
  env: CollaborationRuntimeEnv,
  input: {
    currentUserId: string
    documentId: string
    title?: string
    content: string
    expectedUpdatedAt?: string
  }
) {
  return runConvexRequestWithRetry("persistCollaborationDocumentToConvex", () =>
    getConvexClient(env).mutation(
      api.app.persistCollaborationDocument,
      withServerToken(env, input)
    )
  )
}

export async function persistCollaborationItemDescriptionToConvex(
  env: CollaborationRuntimeEnv,
  input: {
    currentUserId: string
    itemId: string
    content: string
    expectedUpdatedAt?: string
  }
) {
  return runConvexRequestWithRetry(
    "persistCollaborationItemDescriptionToConvex",
    () =>
      getConvexClient(env).mutation(
        api.app.persistCollaborationItemDescription,
        withServerToken(env, input)
      )
  )
}

export async function persistCollaborationWorkItemToConvex(
  env: CollaborationRuntimeEnv,
  input: {
    currentUserId: string
    itemId: string
    patch: {
      title?: string
      description?: string
      expectedUpdatedAt?: string
    }
  }
) {
  return runConvexRequestWithRetry("persistCollaborationWorkItemToConvex", () =>
    getConvexClient(env).mutation(
      api.app.persistCollaborationWorkItem,
      withServerToken(env, {
        currentUserId: input.currentUserId,
        itemId: input.itemId,
        patch: input.patch,
      })
    )
  )
}

export async function bumpScopedReadModelsFromConvex(
  env: CollaborationRuntimeEnv,
  input: {
    scopeKeys: string[]
  }
) {
  return runConvexRequestWithRetry("bumpScopedReadModelsFromConvex", () =>
    getConvexClient(env).mutation(
      api.app.bumpScopedReadModelVersions,
      withServerToken(env, input)
    )
  )
}
