import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { fetchSnapshotStateMock } = vi.hoisted(() => ({
  fetchSnapshotStateMock: vi.fn(),
}))

vi.mock("@/components/app/shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/providers/convex-app-provider", () => ({
  ConvexAppProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

vi.mock("@/components/theme-provider", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

vi.mock("@/components/ui/sonner", () => ({
  Toaster: () => null,
}))

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

vi.mock("@/desktop/renderer/desktop-route", () => ({
  DesktopRoute: () => <div>Desktop route</div>,
}))

vi.mock("@/lib/browser/app-navigation", async () => {
  return import("@/desktop/renderer/adapters/app-navigation")
})

vi.mock("@/lib/convex/client", () => ({
  fetchSnapshotState: fetchSnapshotStateMock,
  RouteMutationError: class RouteMutationError extends Error {
    status: number

    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  },
}))

import { DesktopApp } from "@/desktop/renderer/desktop-app"

describe("desktop packaged renderer app smoke", () => {
  const originalElectronApp = window.electronApp

  beforeEach(() => {
    fetchSnapshotStateMock.mockReset()
    document.body.innerHTML = ""
    window.history.replaceState(null, "", "/")
    Object.defineProperty(window, "electronApp", {
      configurable: true,
      value: {
        getDesktopAuthToken: vi.fn().mockResolvedValue(null),
        isElectron: true,
        platform: "darwin",
        submitDesktopPasswordLogin: vi.fn().mockResolvedValue({ ok: true }),
        submitDesktopPasswordSignup: vi.fn().mockResolvedValue({ ok: true }),
      },
    })
  })

  afterEach(() => {
    Object.defineProperty(window, "electronApp", {
      configurable: true,
      value: originalElectronApp,
    })
  })

  it("renders the signed-out login screen without a desktop token", async () => {
    render(<DesktopApp />)

    expect(await screen.findByText("Welcome back")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument()
    expect(fetchSnapshotStateMock).not.toHaveBeenCalled()
  })

  it("uses the desktop signup route as auth mode", async () => {
    window.history.replaceState(
      null,
      "",
      "/signup?next=/workspace/docs&email=chef@example.com&firstName=Taylor&lastName=Morgan"
    )

    render(<DesktopApp />)

    expect(await screen.findByText("Create your account")).toBeInTheDocument()
    expect(screen.getByDisplayValue("chef@example.com")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Taylor")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Morgan")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?next=%2Fworkspace%2Fdocs"
    )
    expect(document.querySelector("form")).toHaveAttribute(
      "action",
      "https://teams.reciperoom.io/auth/desktop/signup"
    )
  })

  it("points desktop provider auth at the hosted callback flow", async () => {
    render(<DesktopApp />)

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: "Continue with Google" })
      ).toHaveAttribute(
        "href",
        "https://teams.reciperoom.io/auth/desktop/start?next=%2Fworkspace%2Fprojects&mode=login&provider=google"
      )
    })
  })

  it("posts desktop password login through the hosted desktop handoff route", async () => {
    render(<DesktopApp />)

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Sign in" })
      ).toBeInTheDocument()
    })

    expect(document.querySelector("form")).toHaveAttribute(
      "action",
      "https://teams.reciperoom.io/auth/desktop/login"
    )
  })

  it("submits desktop password login through the Electron bridge", async () => {
    render(<DesktopApp />)

    fireEvent.change(await screen.findByLabelText("Email"), {
      target: { value: "chef@example.com" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password-123" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

    await waitFor(() => {
      expect(
        window.electronApp?.submitDesktopPasswordLogin
      ).toHaveBeenCalledWith({
        email: "chef@example.com",
        nextPath: "/workspace/projects",
        password: "password-123",
      })
    })
  })

  it("submits desktop password signup through the Electron bridge", async () => {
    window.history.replaceState(null, "", "/signup?next=/workspace/docs")
    render(<DesktopApp />)

    fireEvent.change(await screen.findByLabelText("First name"), {
      target: { value: "Taylor" },
    })
    fireEvent.change(screen.getByLabelText("Surname"), {
      target: { value: "Morgan" },
    })
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "chef@example.com" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password-123" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Create account" }))

    await waitFor(() => {
      expect(
        window.electronApp?.submitDesktopPasswordSignup
      ).toHaveBeenCalledWith({
        email: "chef@example.com",
        firstName: "Taylor",
        lastName: "Morgan",
        nextPath: "/workspace/docs",
        password: "password-123",
      })
    })
  })

  it("reacts to desktop auth complete handoff routes after initial render", async () => {
    render(<DesktopApp />)

    expect(await screen.findByText("Welcome back")).toBeInTheDocument()

    act(() => {
      window.history.pushState(
        null,
        "",
        "/auth/desktop/complete?next=/workspace/projects&error=Invalid+email+or+password."
      )
      window.dispatchEvent(new Event("popstate"))
    })

    await waitFor(() => {
      expect(screen.getByText("Invalid email or password.")).toBeInTheDocument()
    })
  })
})
