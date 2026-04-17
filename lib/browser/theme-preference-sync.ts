"use client"

import { type ThemePreference } from "@/lib/domain/types"

const PENDING_THEME_TTL_MS = 10000

let pendingThemePreference: {
  value: ThemePreference
  expiresAt: number
} | null = null

function getActivePendingThemePreference() {
  if (!pendingThemePreference) {
    return null
  }

  if (pendingThemePreference.expiresAt <= Date.now()) {
    pendingThemePreference = null
    return null
  }

  return pendingThemePreference
}

export function setPendingThemePreference(value: ThemePreference) {
  pendingThemePreference = {
    value,
    expiresAt: Date.now() + PENDING_THEME_TTL_MS,
  }
}

export function clearPendingThemePreference(value?: ThemePreference) {
  const activePendingThemePreference = getActivePendingThemePreference()

  if (!activePendingThemePreference) {
    return
  }

  if (value && activePendingThemePreference.value !== value) {
    return
  }

  pendingThemePreference = null
}

export function resolveSnapshotThemePreference(value: ThemePreference) {
  const activePendingThemePreference = getActivePendingThemePreference()

  if (!activePendingThemePreference) {
    return value
  }

  if (activePendingThemePreference.value === value) {
    pendingThemePreference = null
    return value
  }

  return null
}
