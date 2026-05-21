"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

type AppTheme = "dark" | "light" | "system"

type AppThemeContextValue = {
  resolvedTheme: "dark" | "light"
  setTheme: (theme: AppTheme) => void
  theme: AppTheme
}

type AppThemeProviderProps = {
  children: ReactNode
  defaultTheme?: AppTheme
  storageKey?: string
}

const ThemeContext = createContext<AppThemeContextValue | null>(null)

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

function getStoredTheme(storageKey: string, defaultTheme: AppTheme) {
  try {
    const storedTheme = window.localStorage.getItem(storageKey)

    return storedTheme === "dark" ||
      storedTheme === "light" ||
      storedTheme === "system"
      ? storedTheme
      : defaultTheme
  } catch {
    return defaultTheme
  }
}

function resolveTheme(theme: AppTheme) {
  if (theme === "system") {
    return getSystemTheme()
  }

  return theme
}

function applyTheme(theme: "dark" | "light") {
  document.documentElement.classList.toggle("dark", theme === "dark")
  document.documentElement.style.colorScheme = theme
}

export function AppThemeProvider({
  children,
  defaultTheme = "light",
  storageKey = "reciperoom-theme",
}: AppThemeProviderProps) {
  const [theme, setThemeState] = useState<AppTheme>(() =>
    getStoredTheme(storageKey, defaultTheme)
  )
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">(() =>
    resolveTheme(theme)
  )

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")

    function syncResolvedTheme() {
      const nextResolvedTheme = resolveTheme(theme)

      setResolvedTheme(nextResolvedTheme)
      applyTheme(nextResolvedTheme)
    }

    syncResolvedTheme()
    media.addEventListener("change", syncResolvedTheme)

    return () => {
      media.removeEventListener("change", syncResolvedTheme)
    }
  }, [theme])

  const value = useMemo<AppThemeContextValue>(
    () => ({
      resolvedTheme,
      setTheme(nextTheme) {
        try {
          window.localStorage.setItem(storageKey, nextTheme)
        } catch {}

        setThemeState(nextTheme)
      },
      theme,
    }),
    [resolvedTheme, storageKey, theme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useAppTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error("useAppTheme must be used inside AppThemeProvider")
  }

  return context
}

export type AppThemeController = ReturnType<typeof useAppTheme>
