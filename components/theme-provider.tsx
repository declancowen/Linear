"use client"

import * as React from "react"

import { useAppPathname } from "@/lib/browser/app-navigation"
import { AppThemeProvider, useAppTheme } from "@/lib/browser/app-theme"
import { syncBrowserThemeMetadata } from "@/lib/browser/browser-theme-metadata"

function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof AppThemeProvider>) {
  return (
    <AppThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      themes={["light", "dark"]}
      storageKey="reciperoom-theme"
      disableTransitionOnChange
      {...props}
    >
      <ThemeBrowserChromeSync />
      {children}
    </AppThemeProvider>
  )
}

function resolveActiveBrowserTheme(
  resolvedTheme: string | undefined
): "light" | "dark" {
  if (resolvedTheme === "dark") {
    return "dark"
  }

  return "light"
}

function ThemeBrowserChromeSync() {
  const pathname = useAppPathname()
  const { resolvedTheme } = useAppTheme()

  React.useLayoutEffect(() => {
    syncBrowserThemeMetadata(resolveActiveBrowserTheme(resolvedTheme))
  }, [pathname, resolvedTheme])

  return null
}

export { ThemeProvider }
