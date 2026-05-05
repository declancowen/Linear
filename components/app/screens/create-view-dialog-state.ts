import type { DisplayProperty } from "@/lib/domain/types"

export function toggleCreateViewDisplayProperty(
  displayProps: DisplayProperty[],
  property: DisplayProperty
) {
  return displayProps.includes(property)
    ? displayProps.filter((value) => value !== property)
    : [...displayProps, property]
}
