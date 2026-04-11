import { ConvexHttpClient } from "convex/browser"
import { createWorkOS } from "@workos-inc/node"

import { api } from "../convex/_generated/api.js"

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
const apiKey = process.env.WORKOS_API_KEY
const clientId = process.env.WORKOS_CLIENT_ID

if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured")
}

if (!apiKey || !clientId) {
  throw new Error("WorkOS is not configured")
}

function parseArgs(argv) {
  const parsed = {}

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]

    if (!value?.startsWith("--")) {
      continue
    }

    const key = value.slice(2)
    const next = argv[index + 1]

    if (!next || next.startsWith("--")) {
      parsed[key] = "true"
      continue
    }

    parsed[key] = next
    index += 1
  }

  return parsed
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function normalizeJoinCode(value) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
}

function toInitials(name, email) {
  const source = name.trim() || email

  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2)
}

function getName(user) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email
}

async function getOrganizationByExternalId(workos, externalId) {
  try {
    return await workos.organizations.getOrganizationByExternalId(externalId)
  } catch (error) {
    if (typeof error === "object" && error !== null && "status" in error && error.status === 404) {
      return null
    }

    throw error
  }
}

const args = parseArgs(process.argv.slice(2))
const email = args.email

if (!email) {
  throw new Error("Pass --email <address>")
}

const workspaceName = args["workspace-name"] ?? "Recipe Room"
const workspaceSlug = args["workspace-slug"] ?? slugify(workspaceName)
const workspaceLogoUrl = args["workspace-logo"] ?? "RR"
const workspaceAccent = args["workspace-accent"] ?? "emerald"
const workspaceDescription =
  args["workspace-description"] ??
  "A Linear-style workspace that combines product delivery, QA, and operational docs."
const teamName = args["team-name"] ?? workspaceName
const teamSlug = args["team-slug"] ?? slugify(teamName)
const teamIcon = args["team-icon"] ?? "robot"
const teamSummary =
  args["team-summary"] ?? "Customer-facing product work and bug triage."
const teamJoinCode =
  normalizeJoinCode(args["team-join-code"] ?? workspaceName.replace(/\s+/g, "").slice(0, 8)) ||
  "TEAMJOIN"
const role = args.role ?? "admin"

const convex = new ConvexHttpClient(convexUrl)
const workos = createWorkOS({
  apiKey,
  clientId,
})

const users = await workos.userManagement.listUsers({
  email,
})
const workosUser = users.data[0]

if (!workosUser) {
  throw new Error(`No WorkOS user found for ${email}`)
}

const userName = args["user-name"] ?? getName(workosUser)
const avatarUrl = args["avatar-url"] ?? toInitials(userName, email)

const bootstrap = await convex.mutation(api.app.bootstrapAppWorkspace, {
  workspaceSlug,
  workspaceName,
  workspaceLogoUrl,
  workspaceAccent,
  workspaceDescription,
  teamSlug,
  teamName,
  teamIcon,
  teamSummary,
  teamJoinCode,
  email,
  userName,
  avatarUrl,
  workosUserId: workosUser.id,
  role,
})

let organizationId = bootstrap.workosOrganizationId

if (!organizationId) {
  const existingOrganization = await getOrganizationByExternalId(
    workos,
    bootstrap.workspaceId
  )
  const organization = existingOrganization
    ? await workos.organizations.updateOrganization({
        organization: existingOrganization.id,
        name: workspaceName,
        externalId: bootstrap.workspaceId,
        metadata: {
          slug: workspaceSlug,
          workspaceId: bootstrap.workspaceId,
        },
      })
    : await workos.organizations.createOrganization({
        name: workspaceName,
        externalId: bootstrap.workspaceId,
        metadata: {
          slug: workspaceSlug,
          workspaceId: bootstrap.workspaceId,
        },
      })

  organizationId = organization.id

  await convex.mutation(api.app.setWorkspaceWorkosOrganization, {
    workspaceId: bootstrap.workspaceId,
    workosOrganizationId: organization.id,
  })
}

const memberships = await workos.userManagement.listOrganizationMemberships({
  organizationId,
  userId: workosUser.id,
})
const membership = memberships.data[0]

if (!membership) {
  await workos.userManagement.createOrganizationMembership({
    organizationId,
    userId: workosUser.id,
  })
} else if (membership.status === "inactive") {
  await workos.userManagement.reactivateOrganizationMembership(membership.id)
}

console.log(
  JSON.stringify(
    {
      workspaceId: bootstrap.workspaceId,
      workspaceSlug,
      teamId: bootstrap.teamId,
      teamSlug,
      userId: bootstrap.userId,
      email,
      workosUserId: workosUser.id,
      organizationId,
      role,
    },
    null,
    2
  )
)
