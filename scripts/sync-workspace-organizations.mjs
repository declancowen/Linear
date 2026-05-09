import { api } from "../convex/_generated/api.js"
import { readWorkosConvexConfig } from "./shared/workos-convex.mjs"

const { convex, serverToken, workos } = readWorkosConvexConfig()

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
