import type { AppData, UserProfile } from "@/lib/domain/types"

const INVITE_WORKSPACE_MATCH_LIMIT = 6

export type InviteWorkspaceUserMatch = Pick<
  UserProfile,
  | "id"
  | "name"
  | "email"
  | "handle"
  | "title"
  | "avatarUrl"
  | "avatarImageUrl"
  | "status"
> & {
  alreadyIncludedInSelectedTeams: boolean
}

function getInviteWorkspaceMatchScore(
  user: Pick<UserProfile, "name" | "email" | "handle" | "title">,
  query: string
) {
  const normalizedName = user.name.toLowerCase()
  const normalizedEmail = user.email.toLowerCase()
  const normalizedHandle = user.handle.toLowerCase()
  const normalizedTitle = user.title.toLowerCase()

  if (normalizedEmail === query) {
    return 0
  }

  if (normalizedName === query) {
    return 1
  }

  if (normalizedHandle === query) {
    return 2
  }

  if (normalizedName.startsWith(query)) {
    return 3
  }

  if (normalizedEmail.startsWith(query)) {
    return 4
  }

  if (normalizedHandle.startsWith(query)) {
    return 5
  }

  if (normalizedName.includes(query)) {
    return 6
  }

  if (normalizedEmail.includes(query)) {
    return 7
  }

  if (normalizedHandle.includes(query)) {
    return 8
  }

  if (normalizedTitle.includes(query)) {
    return 9
  }

  return Number.POSITIVE_INFINITY
}

export function getInviteWorkspaceUserMatches({
  currentUserId,
  query,
  selectedTeamIds,
  teamMemberships,
  workspaceUsers,
}: {
  currentUserId: string | null
  query: string
  selectedTeamIds: string[]
  teamMemberships: AppData["teamMemberships"]
  workspaceUsers: Array<
    Pick<
      UserProfile,
      | "id"
      | "name"
      | "email"
      | "handle"
      | "title"
      | "avatarUrl"
      | "avatarImageUrl"
      | "status"
    >
  >
}) {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return [] satisfies InviteWorkspaceUserMatch[]
  }

  const membershipKeys = new Set(
    teamMemberships.map(
      (membership) => `${membership.teamId}:${membership.userId}`
    )
  )

  return workspaceUsers
    .filter((user) => user.id !== currentUserId)
    .map((user) => ({
      ...user,
      alreadyIncludedInSelectedTeams:
        selectedTeamIds.length > 0 &&
        selectedTeamIds.every((teamId) =>
          membershipKeys.has(`${teamId}:${user.id}`)
        ),
    }))
    .filter(
      (user) =>
        !user.alreadyIncludedInSelectedTeams &&
        getInviteWorkspaceMatchScore(user, normalizedQuery) !==
          Number.POSITIVE_INFINITY
    )
    .sort((left, right) => {
      const leftScore = getInviteWorkspaceMatchScore(left, normalizedQuery)
      const rightScore = getInviteWorkspaceMatchScore(right, normalizedQuery)

      if (leftScore !== rightScore) {
        return leftScore - rightScore
      }

      return left.name.localeCompare(right.name)
    })
    .slice(0, INVITE_WORKSPACE_MATCH_LIMIT)
}
