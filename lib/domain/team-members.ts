import type { AppData } from "@/lib/domain/types"

export function getUsersForTeamMemberships({
  teamId,
  teamMemberships,
  users,
}: {
  teamId: string
  teamMemberships: AppData["teamMemberships"]
  users: AppData["users"]
}) {
  const memberIds = new Set(
    teamMemberships
      .filter((membership) => membership.teamId === teamId)
      .map((membership) => membership.userId)
  )

  return users.filter((user) => memberIds.has(user.id))
}
