import { describe, expect, it } from "vitest"

describe("electron navigation policy", () => {
  it("trusts the default hosted app for packaged file renderer auth flows", async () => {
    const { getTrustedHostedAppHostnames, isTrustedInAppUrl } =
      await import("@/electron/navigation-policy.cjs")

    expect(
      getTrustedHostedAppHostnames({ NODE_ENV: "test" }).has(
        "teams.reciperoom.io"
      )
    ).toBe(true)
    expect(
      isTrustedInAppUrl(
        "https://teams.reciperoom.io/auth/desktop/start?provider=google",
        "null",
        { env: { NODE_ENV: "test" } }
      )
    ).toBe(true)
  })

  it("keeps WorkOS and Google identity hosts inside the auth window", async () => {
    const { isTrustedInAppUrl } =
      await import("@/electron/navigation-policy.cjs")

    expect(
      isTrustedInAppUrl("https://api.workos.com/sso/authorize", "null", {
        env: { NODE_ENV: "test" },
      })
    ).toBe(true)
    expect(
      isTrustedInAppUrl(
        "https://accounts.google.com/o/oauth2/v2/auth",
        "null",
        {
          env: { NODE_ENV: "test" },
        }
      )
    ).toBe(true)
  })

  it("does not trust arbitrary external https hosts as app navigation", async () => {
    const { isAllowedExternalUrl, isTrustedInAppUrl } =
      await import("@/electron/navigation-policy.cjs")

    expect(
      isTrustedInAppUrl("https://example.com/docs", "null", {
        env: { NODE_ENV: "test" },
      })
    ).toBe(false)
    expect(isAllowedExternalUrl("https://example.com/docs")).toBe(true)
  })

  it("does not trust opaque-origin urls for packaged file renderer navigation", async () => {
    const { isAllowedExternalUrl, isTrustedInAppUrl } =
      await import("@/electron/navigation-policy.cjs")

    for (const url of [
      "data:text/html,<h1>Bad</h1>",
      "javascript:alert(1)",
      "mailto:team@example.com",
    ]) {
      expect(isTrustedInAppUrl(url, "null")).toBe(false)
    }

    expect(isAllowedExternalUrl("mailto:team@example.com")).toBe(true)
  })

  it("restricts privileged bridge senders to the configured renderer document", async () => {
    const { isTrustedDesktopBridgeSenderUrl } =
      await import("@/electron/navigation-policy.cjs")
    const rendererUrl =
      "file:///Applications/Recipe%20Room.app/Contents/Resources/desktop-renderer/index.html"

    expect(
      isTrustedDesktopBridgeSenderUrl(
        `${rendererUrl}#/auth/desktop/complete?ticket=abc`,
        {
          rendererOrigin: "null",
          rendererUrl,
        }
      )
    ).toBe(true)
    expect(
      isTrustedDesktopBridgeSenderUrl("https://api.workos.com/sso/authorize", {
        rendererOrigin: "null",
        rendererUrl,
      })
    ).toBe(false)
    expect(
      isTrustedDesktopBridgeSenderUrl(
        "https://teams.reciperoom.io/workspace/projects",
        {
          rendererOrigin: "https://teams.reciperoom.io",
          rendererUrl: "https://teams.reciperoom.io",
        }
      )
    ).toBe(true)
  })
})
