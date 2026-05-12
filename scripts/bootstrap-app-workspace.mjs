import { api } from "../convex/_generated/api.js"
import {
  getOrganizationByExternalId,
  parseBootstrapAppWorkspaceArgs,
} from "./shared/bootstrap-app-workspace.mjs"
import { readWorkosConvexConfig } from "./shared/workos-convex.mjs"

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
  const [first = "", second = ""] = (name.trim() || email).split(/\s+/, 2)
  return `${first[0] ?? ""}${second[0] ?? ""}`.toUpperCase().slice(0, 2)
}

function getName(user) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email
}

function getDefaultTeamIcon(experience) {
  switch (experience) {
    case "issue-analysis":
      return "qa"
    case "project-management":
      return "kanban"
    case "community":
      return "users"
    default:
      return "code"
  }
}

const args = parseBootstrapAppWorkspaceArgs(process.argv.slice(2))
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
  "A Linear-style workspace that combines product delivery, issue tracking, and operational docs."
const teamName = args["team-name"] ?? workspaceName
const teamSlug = args["team-slug"] ?? slugify(teamName)
const teamExperience = args["team-experience"] ?? "software-development"
const teamIcon = args["team-icon"] ?? getDefaultTeamIcon(teamExperience)
const teamSummary =
  args["team-summary"] ?? "Customer-facing product work and issue triage."
const teamJoinCode =
  normalizeJoinCode(args["team-join-code"] ?? workspaceName.replace(/\s+/g, "").slice(0, 8)) ||
  "TEAMJOIN"
const role = args.role ?? "admin"

const { convex, serverToken, workos } = readWorkosConvexConfig()

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
  serverToken,
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
  teamExperience,
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
    serverToken,
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
