export function compareOptionalDescendingValues(
  leftValue: string | null | undefined,
  rightValue: string | null | undefined
) {
  if (!leftValue && !rightValue) {
    return 0
  }

  if (!leftValue) {
    return 1
  }

  if (!rightValue) {
    return -1
  }

  return rightValue.localeCompare(leftValue)
}
