"use client"

import { lazy, Suspense, useEffect, useState, type FormEvent } from "react"

import { AuthEntryScreen } from "@/components/app/auth-entry-screen"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  buildAuthPageHref,
  getAppOrigin,
  normalizeAuthNextPath,
  parseAuthMode,
  type AuthMode,
} from "@/lib/auth-routing"
import { completeDesktopAuthFromSearchParams } from "@/lib/browser/desktop-auth-complete"
import {
  useAppPathname,
  useAppRouter,
  useAppSearchParams,
} from "@/lib/browser/app-navigation"
import {
  fetchSnapshotState,
  RouteMutationError,
  runRouteMutation,
} from "@/lib/convex/client"
import type { ReadModelFetchResult } from "@/lib/convex/client/read-models"
import type { AppSnapshot } from "@/lib/domain/types"

const DesktopSignedInApp = lazy(() =>
  import("./desktop-signed-in-app").then((module) => ({
    default: module.DesktopSignedInApp,
  }))
)

const DESKTOP_SESSION_REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000

type DesktopBootstrapState =
  | {
      kind: "checking"
    }
  | {
      message: string
      kind: "error"
    }
  | {
      kind: "signed-out"
    }
  | {
      initialShellSeed: ReadModelFetchResult<Partial<AppSnapshot>>
      initialWorkspaceId: string
      kind: "signed-in"
    }

function createInitialShellSeed(
  snapshot: AppSnapshot
): ReadModelFetchResult<Partial<AppSnapshot>> {
  return {
    data: snapshot,
  }
}

function getSnapshotWorkspaceId(snapshot: AppSnapshot) {
  return snapshot.currentWorkspaceId || snapshot.workspaces[0]?.id || ""
}

function getAuthMode(
  pathname: string,
  searchParams: URLSearchParams
): AuthMode {
  return (
    parseAuthMode(searchParams.get("mode")) ??
    (pathname === "/signup" ? "signup" : "login")
  )
}

function getAuthNextPathFromSearchParams(searchParams: URLSearchParams) {
  return normalizeAuthNextPath(searchParams.get("next"))
}

function getAuthErrorFromSearchParams(searchParams: URLSearchParams) {
  return searchParams.get("error") ?? undefined
}

function getAuthNoticeFromSearchParams(searchParams: URLSearchParams) {
  return searchParams.get("notice") ?? undefined
}

function getAuthEmailFromSearchParams(searchParams: URLSearchParams) {
  return searchParams.get("email") ?? undefined
}

function getAuthFirstNameFromSearchParams(searchParams: URLSearchParams) {
  return searchParams.get("firstName") ?? undefined
}

function getAuthLastNameFromSearchParams(searchParams: URLSearchParams) {
  return searchParams.get("lastName") ?? undefined
}

async function getStoredDesktopToken() {
  try {
    const token = await window.electronApp?.getDesktopAuthToken?.()

    return typeof token === "string" && token.trim().length > 0 ? token : null
  } catch {
    return null
  }
}

async function loadAuthenticatedDesktopState() {
  const snapshotState = await fetchSnapshotState()
  const initialWorkspaceId = getSnapshotWorkspaceId(snapshotState.snapshot)

  if (!initialWorkspaceId) {
    throw new Error("No workspace is available for this account")
  }

  return {
    initialShellSeed: createInitialShellSeed(snapshotState.snapshot),
    initialWorkspaceId,
  }
}

async function refreshStoredDesktopSessionToken() {
  const result = await runRouteMutation<{ expiresAt: number; token: string }>(
    "/api/auth/desktop/session/refresh",
    {
      method: "POST",
    }
  )

  await window.electronApp?.setDesktopAuthToken?.(result.token)

  return result
}

function isUnauthorizedRouteError(error: unknown) {
  return error instanceof RouteMutationError && error.status === 401
}

function buildDesktopBootstrapFailureRedirect(nextPath: string) {
  return buildAuthPageHref("login", {
    error: "Desktop sign-in completed, but we couldn't load your workspace. Try again.",
    nextPath,
  })
}

function DesktopAuthScreen() {
  const pathname = useAppPathname()
  const searchParams = useAppSearchParams()
  const mode = getAuthMode(pathname, searchParams)
  const nextPath = getAuthNextPathFromSearchParams(searchParams)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const routeError = getAuthErrorFromSearchParams(searchParams)

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    const submitPasswordLogin = window.electronApp?.submitDesktopPasswordLogin
    const submitPasswordSignup = window.electronApp?.submitDesktopPasswordSignup

    if (
      (mode === "login" && !submitPasswordLogin) ||
      (mode === "signup" && !submitPasswordSignup)
    ) {
      return
    }

    event.preventDefault()
    setSubmitError(null)

    const formData = new FormData(event.currentTarget)
    const sharedPayload = {
      email: String(formData.get("email") ?? ""),
      nextPath,
      password: String(formData.get("password") ?? ""),
    }
    const result =
      mode === "login"
        ? await submitPasswordLogin?.(sharedPayload)
        : await submitPasswordSignup?.({
            ...sharedPayload,
            firstName: String(formData.get("firstName") ?? ""),
            lastName: String(formData.get("lastName") ?? ""),
          })

    if (result && !result.ok) {
      setSubmitError(
        result.error ??
          (mode === "login"
            ? "Desktop sign-in failed."
            : "Desktop sign-up failed.")
      )
    }
  }

  return (
    <AuthEntryScreen
      mode={mode}
      nextPath={nextPath}
      error={submitError ?? routeError}
      notice={getAuthNoticeFromSearchParams(searchParams)}
      initialEmail={getAuthEmailFromSearchParams(searchParams)}
      initialFirstName={getAuthFirstNameFromSearchParams(searchParams)}
      initialLastName={getAuthLastNameFromSearchParams(searchParams)}
      formActionBaseUrl={getAppOrigin()}
      formActionPath={
        mode === "login" ? "/auth/desktop/login" : "/auth/desktop/signup"
      }
      onPasswordSubmit={handlePasswordSubmit}
    />
  )
}

function DesktopAuthCompleteScreen({
  onAuthenticated,
}: {
  onAuthenticated: (nextPath: string) => Promise<void>
}) {
  const router = useAppRouter()
  const searchParams = useAppSearchParams()
  const [message, setMessage] = useState("Completing sign-in...")

  useEffect(() => {
    let cancelled = false

    async function completeAuth() {
      const result = await completeDesktopAuthFromSearchParams(searchParams, {
        setDesktopAuthToken: (token) =>
          window.electronApp?.setDesktopAuthToken?.(token),
      })

      if (cancelled) {
        return
      }

      if (result.kind === "authenticated") {
        try {
          await onAuthenticated(result.nextPath)

          if (!cancelled) {
            router.replace(result.nextPath)
          }
        } catch {
          if (!cancelled) {
            setMessage("Sign-in failed. Redirecting...")
            router.replace(buildDesktopBootstrapFailureRedirect(result.nextPath))
          }
        }
      } else {
        setMessage("Sign-in failed. Redirecting...")
        router.replace(result.href)
      }
    }

    void completeAuth()

    return () => {
      cancelled = true
    }
  }, [onAuthenticated, router, searchParams])

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-sm text-muted-foreground">
      {message}
    </main>
  )
}

function DesktopAppBody() {
  const [state, setState] = useState<DesktopBootstrapState>({
    kind: "checking",
  })
  const pathname = useAppPathname()

  async function completeAuthentication() {
    const authenticatedState = await loadAuthenticatedDesktopState()

    setState({
      kind: "signed-in",
      ...authenticatedState,
    })
  }

  useEffect(() => {
    let cancelled = false

    async function authenticateFromStoredToken() {
      const token = await getStoredDesktopToken()

      if (cancelled) {
        return
      }

      if (!token) {
        setState({ kind: "signed-out" })
        return
      }

      try {
        await refreshStoredDesktopSessionToken()
        const authenticatedState = await loadAuthenticatedDesktopState()

        if (!cancelled) {
          setState({
            kind: "signed-in",
            ...authenticatedState,
          })
        }
      } catch (error) {
        if (isUnauthorizedRouteError(error)) {
          await window.electronApp?.clearDesktopAuthToken?.()

          if (!cancelled) {
            setState({ kind: "signed-out" })
          }
          return
        }

        if (!cancelled) {
          setState({
            kind: "error",
            message:
              error instanceof Error
                ? error.message
                : "Failed to load workspace",
          })
        }
      }
    }

    void authenticateFromStoredToken()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (state.kind !== "signed-in") {
      return
    }

    let cancelled = false
    const intervalId = window.setInterval(() => {
      void refreshStoredDesktopSessionToken().catch(async (error) => {
        if (!isUnauthorizedRouteError(error) || cancelled) {
          return
        }

        await window.electronApp?.clearDesktopAuthToken?.()

        if (!cancelled) {
          setState({ kind: "signed-out" })
        }
      })
    }, DESKTOP_SESSION_REFRESH_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [state.kind])

  if (pathname === "/auth/desktop/complete") {
    return (
      <DesktopAuthCompleteScreen onAuthenticated={completeAuthentication} />
    )
  }

  if (state.kind === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-sm text-muted-foreground">
        Loading Recipe Room...
      </main>
    )
  }

  if (state.kind === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-sm text-muted-foreground">
        {state.message}
      </main>
    )
  }

  if (state.kind === "signed-out") {
    return <DesktopAuthScreen />
  }

  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background px-6 text-sm text-muted-foreground">
          Loading workspace...
        </main>
      }
    >
      <DesktopSignedInApp
        initialShellSeed={state.initialShellSeed}
        initialWorkspaceId={state.initialWorkspaceId}
      />
    </Suspense>
  )
}

export function DesktopApp() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <DesktopAppBody />
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  )
}
