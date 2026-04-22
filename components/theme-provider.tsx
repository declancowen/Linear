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
      <ThemeHotkey />
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

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  )
}

function ThemeHotkey() {
  const { resolvedTheme, setTheme } = useTheme()

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) {
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      if (event.key.toLowerCase() !== "d") {
        return
      }

      if (isTypingTarget(event.target)) {
        return
      }

      setTheme(resolvedTheme === "dark" ? "light" : "dark")
    }

    window.addEventListener("keydown", onKeyDown)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [resolvedTheme, setTheme])

  return null
}

export { ThemeProvider }
