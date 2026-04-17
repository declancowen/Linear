import { v } from "convex/values"

import {
  normalizeTeamIconToken,
  type Role,
  type TeamExperienceType,
} from "../../lib/domain/types"
import { mergeRole } from "../../lib/domain/roles"

export const IMAGE_UPLOAD_MAX_SIZE = 10 * 1024 * 1024
export const defaultUserPreferences = {
  emailMentions: true,
  emailAssignments: true,
  emailDigest: true,
  theme: "light" as const,
}
export const defaultUserStatus = "active" as const
export const defaultUserStatusMessage = ""

const labelColors = [
  "blue",
  "violet",
  "amber",
  "emerald",
  "rose",
  "cyan",
  "orange",
  "indigo",
] as const

export const serverAccessArgs = {
  serverToken: v.string(),
}

export function getNow() {
  return new Date().toISOString()
}

export function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export function getDefaultLabelColor(name: string) {
  const seed = [...name].reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0
  )
  return labelColors[seed % labelColors.length]
}

function getServerToken() {
  const token = process.env.CONVEX_SERVER_TOKEN?.trim()

  if (!token) {
    throw new Error("CONVEX_SERVER_TOKEN is not configured")
  }

  return token
}

function constantTimeEqual(left: string, right: string) {
  const maxLength = Math.max(left.length, right.length)
  let diff = left.length ^ right.length

  for (let index = 0; index < maxLength; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }

  return diff === 0
}

export function assertServerToken(serverToken: string) {
  if (!constantTimeEqual(serverToken, getServerToken())) {
    throw new Error("Unauthorized")
  }
}

export function createHandle(email: string) {
  return email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24)
}

export function createSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)
}

export function normalizeJoinCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 12)
}

export function normalizeTeamIcon(
  icon: string | null | undefined,
  experience: TeamExperienceType | null | undefined
) {
  return normalizeTeamIconToken(icon, experience)
}

export function mergeMembershipRole(
  currentRole: Role | null | undefined,
  requestedRole: Role
) {
  return mergeRole(currentRole, requestedRole)
}

export function createUniqueTeamSlug(
  teams: Array<{ slug: string }>,
  name: string,
  joinCode: string
) {
  const baseSlug = createSlug(name) || createSlug(joinCode) || "team"
  const takenSlugs = new Set(teams.map((team) => team.slug))

  if (!takenSlugs.has(baseSlug)) {
    return baseSlug
  }

  let suffix = 2

  while (suffix < 1000) {
    const suffixText = `-${suffix}`
    const candidate = `${baseSlug.slice(0, 48 - suffixText.length)}${suffixText}`

    if (!takenSlugs.has(candidate)) {
      return candidate
    }

    suffix += 1
  }

  throw new Error("Unable to generate a unique team slug")
}

export function createUniqueWorkspaceSlug(
  workspaces: Array<{ slug: string }>,
  name: string
) {
  const baseSlug = createSlug(name) || "workspace"
  const takenSlugs = new Set(workspaces.map((workspace) => workspace.slug))

  if (!takenSlugs.has(baseSlug)) {
    return baseSlug
  }

  let suffix = 2

  while (suffix < 1000) {
    const suffixText = `-${suffix}`
    const candidate = `${baseSlug.slice(0, 48 - suffixText.length)}${suffixText}`

    if (!takenSlugs.has(candidate)) {
      return candidate
    }

    suffix += 1
  }

  throw new Error("Unable to generate a unique workspace slug")
}

export function ensureJoinCodeAvailable(
  teams: Array<{ id: string; settings: { joinCode: string } }>,
  joinCode: string,
  excludedTeamId?: string
) {
  const duplicate = teams.find(
    (team) => team.settings.joinCode === joinCode && team.id !== excludedTeamId
  )

  if (duplicate) {
    throw new Error("Join code is already in use")
  }
}

export function toKeyPrefix(teamId: string) {
  const alphanumeric = teamId.replace(/[^a-z0-9]+/gi, "").toUpperCase()
  return alphanumeric.slice(0, 3) || "TEA"
}

export function toTeamKeyPrefix(
  teamName: string | null | undefined,
  teamId: string
) {
  const words = (teamName ?? "")
    .split(/[^a-z0-9]+/gi)
    .map((word) => word.trim())
    .filter(Boolean)

  if (words.length >= 2) {
    return words
      .slice(0, 3)
      .map((word) => word[0] ?? "")
      .join("")
      .toUpperCase()
  }

  if (words.length === 1) {
    const compact = words[0].replace(/[^a-z0-9]+/gi, "").toUpperCase()

    if (compact.length > 0) {
      return compact.slice(0, 3)
    }
  }

  return toKeyPrefix(teamId)
}

export function matchesTeamAccessIdentifier(
  team: { id: string; slug: string; settings: { joinCode: string } },
  value: string
) {
  const normalized = value.trim().toLowerCase()

  return (
    team.id.toLowerCase() === normalized ||
    team.slug.toLowerCase() === normalized ||
    team.settings.joinCode.toLowerCase() === normalized
  )
}

export function normalizeEmailAddress(email: string) {
  return email.trim().toLowerCase()
}
