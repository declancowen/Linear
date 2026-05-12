function toKeyPrefix(teamId: string) {
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
