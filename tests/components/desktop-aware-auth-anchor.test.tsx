import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { DesktopAwareAuthAnchor } from "@/components/app/desktop-aware-auth-anchor"

describe("DesktopAwareAuthAnchor", () => {
  const originalElectronApp = window.electronApp

  afterEach(() => {
    Object.defineProperty(window, "electronApp", {
      configurable: true,
      value: originalElectronApp,
    })
  })

  it("keeps the web auth href in a normal browser", () => {
    render(
      <DesktopAwareAuthAnchor
        desktopHref="/auth/desktop/start?provider=google"
        webHref="/auth/google"
      >
        Continue with Google
      </DesktopAwareAuthAnchor>
    )

    expect(screen.getByRole("link")).toHaveAttribute("href", "/auth/google")
  })

  it("switches to the desktop auth href in Electron", async () => {
    Object.defineProperty(window, "electronApp", {
      configurable: true,
      value: {
        isElectron: true,
        platform: "darwin",
      },
    })

    render(
      <DesktopAwareAuthAnchor
        desktopHref="/auth/desktop/start?provider=google"
        webHref="/auth/google"
      >
        Continue with Google
      </DesktopAwareAuthAnchor>
    )

    await waitFor(() => {
      expect(screen.getByRole("link")).toHaveAttribute(
        "href",
        "https://teams.reciperoom.io/auth/desktop/start?provider=google"
      )
    })
  })
})
