import { ConvexHttpClient } from "convex/browser"
import { createWorkOS } from "@workos-inc/node"

import { api } from "../convex/_generated/api.js"

const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL
const serverToken = process.env.CONVEX_SERVER_TOKEN
const apiKey = process.env.WORKOS_API_KEY
const clientId = process.env.WORKOS_CLIENT_ID

if (!convexUrl) {
  throw new Error("CONVEX_URL or NEXT_PUBLIC_CONVEX_URL is not configured")
}

if (!serverToken) {
  throw new Error("CONVEX_SERVER_TOKEN is not configured")
}

if (!apiKey || !clientId) {
  throw new Error("WorkOS is not configured")
}

const convex = new ConvexHttpClient(convexUrl)
const workos = createWorkOS({
  apiKey,
  clientId,
})

function isNotFoundError(error) {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 404
  )
}

async function ensureOrganization(workspace) {
  const metadata = {
    slug: workspace.slug,
    workspaceId: workspace.id,
  }

  if (workspace.workosOrganizationId) {
    return workos.organizations.updateOrganization({
      organization: workspace.workosOrganizationId,
      name: workspace.name,
      externalId: workspace.id,
      metadata,
    })
  }

  try {
    const existing = await workos.organizations.getOrganizationByExternalId(
      workspace.id
    )

    return workos.organizations.updateOrganization({
      organization: existing.id,
      name: workspace.name,
      externalId: workspace.id,
      metadata,
    })
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error
    }
  }

  return workos.organizations.createOrganization({
    name: workspace.name,
    externalId: workspace.id,
    metadata,
  })
}

const workspaces = await convex.query(api.app.listWorkspacesForSync, {
  serverToken,
})

for (const workspace of workspaces) {
  const organization = await ensureOrganization(workspace)

  await convex.mutation(api.app.setWorkspaceWorkosOrganization, {
    serverToken,
    workspaceId: workspace.id,
    workosOrganizationId: organization.id,
  })

  console.log(
    `synced workspace ${workspace.slug} -> ${organization.id} (${organization.name})`
  )
}
