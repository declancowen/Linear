import type { ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const headersMock = vi.hoisted(() => vi.fn())
const themeProviderMock = vi.hoisted(() =>
  vi.fn(({ children }: { children: ReactNode }) => (
    <div data-testid="theme-provider">{children}</div>
  ))
)

vi.mock("next/font/google", () => ({
  Geist_Mono: () => ({
    variable: "--font-mono",
  }),
  Noto_Sans: () => ({
    variable: "--font-sans",
  }),
}))

vi.mock("next/headers", () => ({
  headers: headersMock,
}))

vi.mock("@workos-inc/authkit-nextjs/components", () => ({
  AuthKitProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/theme-provider", () => ({
  ThemeProvider: themeProviderMock,
}))

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/ui/sonner", () => ({
  Toaster: () => null,
}))

describe("RootLayout", () => {
  beforeEach(() => {
    headersMock.mockReset()
    themeProviderMock.mockClear()
    headersMock.mockResolvedValue(
      new Headers([
        ["x-nonce", "nonce-123"],
      ])
    )
  })

  it("passes the request CSP nonce into the theme provider", async () => {
    const { default: RootLayout } = await import("@/app/layout")

    render(
      await RootLayout({
        children: <div>App content</div>,
      })
    )

    expect(themeProviderMock).toHaveBeenCalled()
    expect(themeProviderMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        nonce: "nonce-123",
      })
    )
    expect(screen.getByText("App content")).toBeInTheDocument()
  })
})
