export function getTeamMemberManagementActionState({
  isBusy,
  isCurrentUser,
  pendingAction,
}: {
  isBusy: boolean
  isCurrentUser: boolean
  pendingAction: "role" | "remove" | null
}) {
  return {
    disabled: isBusy || isCurrentUser,
    removeLabel:
      isBusy && pendingAction === "remove" ? "Removing..." : "Remove",
  }
}
