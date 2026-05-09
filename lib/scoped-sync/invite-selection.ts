import type { AppSnapshot } from "@/lib/domain/types"

export function isWorkspaceMembershipInvite(
  invite: AppSnapshot["invites"][number],
  resolvedWorkspaceId: string,
  normalizedCurrentUserEmail: string
) {
  const isPendingCurrentUserInvite =
    normalizedCurrentUserEmail.length > 0 &&
    invite.email.toLowerCase() === normalizedCurrentUserEmail &&
    !invite.acceptedAt &&
    !invite.declinedAt

  return invite.workspaceId === resolvedWorkspaceId || isPendingCurrentUserInvite
}
