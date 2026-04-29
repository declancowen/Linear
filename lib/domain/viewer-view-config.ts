import type {
  ViewDefinition,
  ViewerDirectoryConfig,
  ViewerViewConfigOverride,
} from "@/lib/domain/types"

function encodeKeyPart(value: string) {
  return encodeURIComponent(value)
}

export function getViewerScopedViewKey(
  userId: string,
  surfaceKey: string,
  viewId: string
) {
  return [
    encodeKeyPart(userId || "anonymous"),
    encodeKeyPart(surfaceKey),
    encodeKeyPart(viewId),
  ].join("::")
}

export function getViewerScopedDirectoryKey(
  userId: string,
  surfaceKey: string
) {
  return [encodeKeyPart(userId || "anonymous"), encodeKeyPart(surfaceKey)].join(
    "::"
  )
}

export function applyViewerViewConfig(
  view: ViewDefinition,
  override?: ViewerViewConfigOverride | null
): ViewDefinition {
  if (!override) {
    return view
  }

  return {
    ...view,
    ...(override.layout !== undefined ? { layout: override.layout } : {}),
    ...(override.grouping !== undefined ? { grouping: override.grouping } : {}),
    ...(override.subGrouping !== undefined
      ? { subGrouping: override.subGrouping }
      : {}),
    ...(override.ordering !== undefined ? { ordering: override.ordering } : {}),
    ...(override.itemLevel !== undefined
      ? { itemLevel: override.itemLevel }
      : {}),
    ...(override.showChildItems !== undefined
      ? { showChildItems: override.showChildItems }
      : {}),
    ...(override.filters
      ? {
          filters: {
            ...view.filters,
            ...override.filters,
          },
        }
      : {}),
    ...(override.displayProps
      ? { displayProps: [...override.displayProps] }
      : {}),
    ...(override.hiddenState
      ? {
          hiddenState: {
            groups: [...override.hiddenState.groups],
            subgroups: [...override.hiddenState.subgroups],
          },
        }
      : {}),
  }
}

export function applyViewerDirectoryConfig<T extends ViewerDirectoryConfig>(
  defaults: T,
  override?: ViewerDirectoryConfig | null
): T {
  if (!override) {
    return defaults
  }

  return {
    ...defaults,
    ...override,
    filters: {
      ...defaults.filters,
      ...override.filters,
    },
    displayProps: override.displayProps
      ? [...override.displayProps]
      : defaults.displayProps,
  }
}
