export type GroupedSection<T> = {
  key: string
  label: string
  items: T[]
  children: GroupedSection<T>[] | null
}

export function buildGroupedSections<T>({
  items,
  grouping,
  subGrouping,
  getGroupKey,
  getGroupLabel,
  compareGroupKeys,
}: {
  items: T[]
  grouping: string | null
  subGrouping: string | null
  getGroupKey: (item: T, field: string) => string
  getGroupLabel: (field: string, key: string) => string
  compareGroupKeys: (field: string, left: string, right: string) => number
}): GroupedSection<T>[] {
  if (!grouping || grouping === "none") {
    return [
      {
        key: "all",
        label: "All",
        items,
        children: null,
      },
    ]
  }

  const groups = new Map<string, T[]>()

  for (const item of items) {
    const key = getGroupKey(item, grouping)
    const current = groups.get(key)

    if (current) {
      current.push(item)
      continue
    }

    groups.set(key, [item])
  }

  const orderedKeys = [...groups.keys()].sort((left, right) =>
    compareGroupKeys(grouping, left, right)
  )

  return orderedKeys.map((key) => {
    const groupedItems = groups.get(key) ?? []

    if (!subGrouping || subGrouping === "none" || subGrouping === grouping) {
      return {
        key,
        label: getGroupLabel(grouping, key),
        items: groupedItems,
        children: null,
      }
    }

    const subGroups = new Map<string, T[]>()

    for (const item of groupedItems) {
      const subKey = getGroupKey(item, subGrouping)
      const current = subGroups.get(subKey)

      if (current) {
        current.push(item)
        continue
      }

      subGroups.set(subKey, [item])
    }

    const orderedSubKeys = [...subGroups.keys()].sort((left, right) =>
      compareGroupKeys(subGrouping, left, right)
    )

    return {
      key,
      label: getGroupLabel(grouping, key),
      items: groupedItems,
      children: orderedSubKeys.map((subKey) => ({
        key: `${key}:${subKey}`,
        label: getGroupLabel(subGrouping, subKey),
        items: subGroups.get(subKey) ?? [],
        children: null,
      })),
    }
  })
}
