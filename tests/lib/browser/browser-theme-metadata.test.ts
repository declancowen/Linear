import { beforeEach, describe, expect, it } from "vitest"

import {
  resolveBrowserThemeColor,
  syncBrowserThemeMetadata,
} from "@/lib/browser/browser-theme-metadata"

describe("browser theme metadata", () => {
  beforeEach(() => {
    document.head.innerHTML = ""
    document.documentElement.removeAttribute("style")
    document.body.removeAttribute("style")
  })

  it("uses the computed body background for the theme color", () => {
    document.body.style.backgroundColor = "rgb(252, 252, 252)"

    const themeColor = syncBrowserThemeMetadata("light")

    expect(themeColor).toBe("rgb(252, 252, 252)")
    expect(
      document.head.querySelector('meta[name="theme-color"]')?.getAttribute(
        "content"
      )
    ).toBe("rgb(252, 252, 252)")
    expect(
      document.head.querySelector('meta[name="color-scheme"]')?.getAttribute(
        "content"
      )
    ).toBe("light")
    expect(document.documentElement.style.colorScheme).toBe("light")
  })

  it("falls back to the dark baseline color when the body is transparent", () => {
    document.body.style.backgroundColor = "transparent"

    expect(resolveBrowserThemeColor("dark")).toBe("#161616")
  })

  it("updates existing theme metadata tags in place", () => {
    document.head.innerHTML = [
      '<meta name="theme-color" content="#000000">',
      '<meta name="color-scheme" content="dark">',
      '<meta name="supported-color-schemes" content="dark">',
    ].join("")
    document.body.style.backgroundColor = "rgb(24, 24, 24)"

    syncBrowserThemeMetadata("dark")

    expect(document.head.querySelectorAll('meta[name="theme-color"]')).toHaveLength(
      1
    )
    expect(
      document.head.querySelector('meta[name="theme-color"]')?.getAttribute(
        "content"
      )
    ).toBe("rgb(24, 24, 24)")
    expect(
      document.head.querySelector('meta[name="supported-color-schemes"]')?.getAttribute(
        "content"
      )
    ).toBe("dark")
  })
})
