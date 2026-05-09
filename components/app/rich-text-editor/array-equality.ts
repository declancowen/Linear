export function areArraysEqual<T>(
  left: T[],
  right: T[],
  isEqual: (leftItem: T, rightItem: T) => boolean
) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((leftItem, index) => {
    const rightItem = right[index]

    return (
      leftItem !== undefined &&
      rightItem !== undefined &&
      isEqual(leftItem, rightItem)
    )
  })
}
