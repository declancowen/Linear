import type { User } from "@workos-inc/node"

export type AuthenticatedAppUser = {
  email: string
  name: string
  avatarUrl: string
  workosUserId: string
  organizationId: string | null
}

export function getWorkOSUserName(user: User) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim()
  return fullName || user.email.split("@")[0] || "User"
}

export function getAvatarInitials(name: string, email: string) {
  const source = name.trim() || email
  const words = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)

  if (words.length === 0) {
    return "U"
  }

  return words
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2)
}

export function splitName(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) {
    return {
      firstName: "User",
      lastName: undefined,
    }
  }

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: undefined,
    }
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  }
}

export function toAuthenticatedAppUser(
  user: User,
  organizationId?: string
): AuthenticatedAppUser {
  const name = getWorkOSUserName(user)

  return {
    email: user.email,
    name,
    avatarUrl: getAvatarInitials(name, user.email),
    workosUserId: user.id,
    organizationId: organizationId ?? null,
  }
}
