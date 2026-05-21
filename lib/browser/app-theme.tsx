"use client"

import type { ThemeProviderProps } from "next-themes"
import * as NextThemes from "next-themes"

const NextThemesProvider =
  ("ThemeProvider" in NextThemes ? NextThemes.ThemeProvider : null) ??
  function PassthroughThemeProvider({ children }: ThemeProviderProps) {
    return <>{children}</>
  }

export const AppThemeProvider = NextThemesProvider

export function useAppTheme() {
  return NextThemes.useTheme()
}

export type AppThemeController = ReturnType<typeof useAppTheme>
