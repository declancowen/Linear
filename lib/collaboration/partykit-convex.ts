import { ConvexHttpClient } from "convex/browser"

import { api } from "@/convex/_generated/api"
import {
  getErrorProperty,
  runConvexRequestWithRetry,
} from "@/lib/convex/retry"

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

const collaborationRetryOptions = {
  getWarningDetails: (error: unknown) => ({
    message: getErrorProperty(error, "message"),
    code: getErrorProperty(error, "code"),
  }),
}

export async function getCollaborationDocumentFromConvex(
  env: CollaborationRuntimeEnv,
  input: {
    currentUserId: string
    documentId: string
  }
) {
  return runConvexRequestWithRetry(
    "getCollaborationDocumentFromConvex",
    () =>
      getConvexClient(env).query(
        api.app.getCollaborationDocument,
        withServerToken(env, input)
      ),
    collaborationRetryOptions
  ) as Promise<CollaborationDocumentFromConvex>
}

export async function persistCollaborationDocumentToConvex(
  env: CollaborationRuntimeEnv,
  input: {
    currentUserId: string
    documentId: string
    title?: string
    content?: string
    expectedUpdatedAt?: string
  }
) {
  return runConvexRequestWithRetry(
    "persistCollaborationDocumentToConvex",
    () =>
      getConvexClient(env).mutation(
        api.app.persistCollaborationDocument,
        withServerToken(env, input)
      ),
    collaborationRetryOptions
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
      ),
    collaborationRetryOptions
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
  return runConvexRequestWithRetry(
    "persistCollaborationWorkItemToConvex",
    () =>
      getConvexClient(env).mutation(
        api.app.persistCollaborationWorkItem,
        withServerToken(env, {
          currentUserId: input.currentUserId,
          itemId: input.itemId,
          patch: input.patch,
        })
      ),
    collaborationRetryOptions
  )
}

export async function bumpScopedReadModelsFromConvex(
  env: CollaborationRuntimeEnv,
  input: {
    scopeKeys: string[]
  }
) {
  return runConvexRequestWithRetry(
    "bumpScopedReadModelsFromConvex",
    () =>
      getConvexClient(env).mutation(
        api.app.bumpScopedReadModelVersions,
        withServerToken(env, input)
      ),
    collaborationRetryOptions
  )
}
