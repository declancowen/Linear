function quoteTitle(title: string) {
  const normalizedTitle = title.trim() || "Untitled"

  return `"${normalizedTitle}"`
}

function formatTeamContext(teamName?: string | null) {
  const normalizedTeamName = teamName?.trim()

  return normalizedTeamName ? ` in ${normalizedTeamName}` : ""
}

export function buildWorkItemAssignmentNotificationMessage(
  actorName: string,
  itemTitle: string,
  teamName?: string | null
) {
  return `${actorName} assigned you ${quoteTitle(itemTitle)}${formatTeamContext(teamName)}`
}

export function buildWorkItemStatusChangeNotificationMessage(
  actorName: string,
  itemTitle: string,
  statusLabel: string,
  teamName?: string | null
) {
  return `${actorName} moved ${quoteTitle(itemTitle)} to ${statusLabel}${formatTeamContext(teamName)}`
}

export function buildWorkItemDescriptionMentionNotificationMessage(
  actorName: string,
  itemTitle: string,
  teamName: string | null | undefined,
  mentionCount: number
) {
  const mentionFragment =
    mentionCount > 1
      ? `mentioned you ${mentionCount} times`
      : "mentioned you"

  return `${actorName} ${mentionFragment} in the description of ${quoteTitle(itemTitle)}${formatTeamContext(teamName)}`
}

export function buildWorkItemDescriptionMentionDetailText(
  itemTitle: string,
  teamName: string | null | undefined,
  mentionCount: number
) {
  const mentionFragment =
    mentionCount > 1
      ? `You were mentioned ${mentionCount} times`
      : "You were mentioned"

  return `${mentionFragment} in the description of ${quoteTitle(itemTitle)}${formatTeamContext(teamName)}.`
}
