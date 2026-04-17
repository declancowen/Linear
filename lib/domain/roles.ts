import type { Role } from "@/lib/domain/types"

export const rolePriority: Record<Role, number> = {
  guest: 0,
  viewer: 1,
  member: 2,
  admin: 3,
}

export function mergeRole(
  currentRole: Role | null | undefined,
  requestedRole: Role
) {
  if (!currentRole) {
    return requestedRole
  }

  return rolePriority[currentRole] >= rolePriority[requestedRole]
    ? currentRole
    : requestedRole
}

export function canEditRole(role: Role | null | undefined) {
  return role === "admin" || role === "member"
}
