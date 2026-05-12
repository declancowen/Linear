export function sortLabelsByName<TLabel extends { name: string }>(
  labels: readonly TLabel[]
) {
  return [...labels].sort((left, right) => left.name.localeCompare(right.name))
}
