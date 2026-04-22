const COLLABORATION_USER_COLORS = [
  "#1d4ed8",
  "#0891b2",
  "#0f766e",
  "#15803d",
  "#b45309",
  "#b91c1c",
  "#be185d",
  "#7c3aed",
] as const

export function getCollaborationUserColor(seed: string) {
  let hash = 0

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index)
    hash |= 0
  }

  return COLLABORATION_USER_COLORS[
    Math.abs(hash) % COLLABORATION_USER_COLORS.length
  ]
}
