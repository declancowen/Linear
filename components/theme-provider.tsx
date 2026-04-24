"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"

import { syncBrowserThemeMetadata } from "@/lib/browser/browser-theme-metadata"

function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
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
    </NextThemesProvider>
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
  const pathname = usePathname()
  const { resolvedTheme } = useTheme()

  React.useLayoutEffect(() => {
    syncBrowserThemeMetadata(resolveActiveBrowserTheme(resolvedTheme))
  }, [pathname, resolvedTheme])

  return null
}

export { ThemeProvider }
