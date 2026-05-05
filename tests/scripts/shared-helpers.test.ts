import { beforeEach, describe, expect, it, vi } from "vitest"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const scriptSharedMocks = vi.hoisted(() => ({
  convexClient: vi.fn(),
  createWorkOS: vi.fn(),
  resend: vi.fn(),
}))

vi.mock("convex/browser", () => ({
  ConvexHttpClient: scriptSharedMocks.convexClient,
}))

vi.mock("@workos-inc/node", () => ({
  createWorkOS: scriptSharedMocks.createWorkOS,
}))

vi.mock("resend", () => ({
  Resend: scriptSharedMocks.resend,
}))

describe("script shared helpers", () => {
  beforeEach(() => {
    scriptSharedMocks.convexClient.mockReset()
    scriptSharedMocks.createWorkOS.mockReset()
    scriptSharedMocks.resend.mockReset()
    scriptSharedMocks.convexClient.mockImplementation(function (
      this: { url: string },
      url: string
    ) {
      this.url = url
    })
    scriptSharedMocks.createWorkOS.mockImplementation((config) => ({
      kind: "workos",
      config,
    }))
    scriptSharedMocks.resend.mockImplementation(function (
      this: { apiKey: string },
      apiKey: string
    ) {
      this.apiKey = apiKey
    })
  })

  it("reads WorkOS Convex config from explicit env fallbacks", async () => {
    const { readWorkosConvexConfig } = await import(
      "../../scripts/shared/workos-convex.mjs"
    )
    const config = readWorkosConvexConfig({
      NEXT_PUBLIC_CONVEX_URL: "https://convex.example.com",
      CONVEX_SERVER_TOKEN: "server-token",
      WORKOS_API_KEY: "workos-key",
      WORKOS_CLIENT_ID: "client-id",
    })

    expect(config).toEqual({
      convex: {
        url: "https://convex.example.com",
      },
      serverToken: "server-token",
      workos: {
        kind: "workos",
        config: {
          apiKey: "workos-key",
          clientId: "client-id",
        },
      },
    })
  })

  it("rejects incomplete WorkOS Convex config", async () => {
    const { readWorkosConvexConfig } = await import(
      "../../scripts/shared/workos-convex.mjs"
    )

    expect(() => readWorkosConvexConfig({})).toThrow(
      "CONVEX_URL or NEXT_PUBLIC_CONVEX_URL is not configured"
    )
    expect(() =>
      readWorkosConvexConfig({
        CONVEX_URL: "https://convex.example.com",
      })
    ).toThrow("CONVEX_SERVER_TOKEN is not configured")
    expect(() =>
      readWorkosConvexConfig({
        CONVEX_URL: "https://convex.example.com",
        CONVEX_SERVER_TOKEN: "server-token",
      })
    ).toThrow("WorkOS is not configured")
  })

  it("reads Convex Resend config and requires provider settings", async () => {
    const { readConvexResendConfig } = await import(
      "../../scripts/shared/convex-resend.mjs"
    )

    expect(() => readConvexResendConfig({})).toThrow(
      "CONVEX_URL or NEXT_PUBLIC_CONVEX_URL is not configured"
    )
    expect(() =>
      readConvexResendConfig({
        CONVEX_URL: "https://convex.example.com",
      })
    ).toThrow("CONVEX_SERVER_TOKEN is not configured")
    expect(() =>
      readConvexResendConfig({
        CONVEX_URL: "https://convex.example.com",
        CONVEX_SERVER_TOKEN: "server-token",
      })
    ).toThrow("Resend is not configured")
    expect(
      readConvexResendConfig({
        CONVEX_URL: "https://convex.example.com",
        CONVEX_SERVER_TOKEN: "server-token",
        RESEND_API_KEY: "resend-key",
        RESEND_FROM_EMAIL: "noreply@example.com",
        RESEND_FROM_NAME: "Recipe Room",
      })
    ).toEqual({
      client: {
        url: "https://convex.example.com",
      },
      resend: {
        apiKey: "resend-key",
      },
      resendFromEmail: "noreply@example.com",
      resendFromName: "Recipe Room",
      serverToken: "server-token",
    })
  })

  it("runs backfill batches until no remaining or patched items remain", async () => {
    const { runBackfillLoop } = await import("../../scripts/shared/backfill.mjs")
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined)
    const originalExitCode = process.exitCode
    const statuses = [
      { remaining: { total: 2 } },
      { remaining: { total: 0 } },
    ]

    process.exitCode = undefined
    await runBackfillLoop({
      beforeLabel: "Before",
      afterLabel: "After",
      totalLabel: "Patched",
      getStatus: vi.fn().mockResolvedValueOnce(statuses[0]).mockResolvedValueOnce(statuses[1]),
      backfill: vi.fn().mockResolvedValueOnce({
        patched: {
          total: 2,
        },
        remaining: {
          total: 0,
        },
      }),
      formatStatus: (label: string, status: { remaining: { total: number } }) =>
        `${label}: ${status.remaining.total}`,
      formatBatch: (iteration: number) => `batch ${iteration}`,
    })

    expect(logSpy).toHaveBeenCalledWith("Patched: 2")
    expect(process.exitCode).toBeUndefined()
    process.exitCode = originalExitCode
    logSpy.mockRestore()
  })

  it("parses bootstrap arguments and treats missing WorkOS organizations as absent", async () => {
    const {
      getOrganizationByExternalId,
      parseBootstrapAppWorkspaceArgs,
    } = await import("../../scripts/shared/bootstrap-app-workspace.mjs")
    const workos = {
      organizations: {
        getOrganizationByExternalId: vi
          .fn()
          .mockRejectedValueOnce({
            status: 404,
          })
          .mockRejectedValueOnce(new Error("provider down")),
      },
    }

    expect(
      parseBootstrapAppWorkspaceArgs([
        "--email",
        "alex@example.com",
        "--dry-run",
        "--workspace-name",
        "Recipe Room",
      ])
    ).toEqual({
      email: "alex@example.com",
      "dry-run": "true",
      "workspace-name": "Recipe Room",
    })
    await expect(
      getOrganizationByExternalId(workos, "workspace_1")
    ).resolves.toBeNull()
    await expect(
      getOrganizationByExternalId(workos, "workspace_2")
    ).rejects.toThrow("provider down")
  })

  it("parses generated Convex API map entries", async () => {
    const { parseGeneratedApiMap } = await import(
      "../../scripts/shared/convex-generated-api.mjs"
    )

    expect(
      parseGeneratedApiMap(
        [
          "declare const fullApi: ApiFromModules<{",
          '  "app/work_items": typeof app_work_items;',
          "  app: typeof app;",
          "}>;",
        ].join("\n")
      )
    ).toEqual(new Set(["convex/app/work_items", "convex/app"]))
    expect(() => parseGeneratedApiMap("declare const fullApi = {}")).toThrow(
      "Could not parse fullApi module map from generated API file."
    )
  })

  it("finds packaged Electron app bundles under mac output directories", async () => {
    const { findBuiltApp } = await import(
      "../../scripts/shared/electron-package.mjs"
    )
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "linear-electron-package-test-")
    )

    try {
      await fs.mkdir(path.join(tempDir, "mac-arm64", "Recipe Room.app"), {
        recursive: true,
      })

      await expect(findBuiltApp(tempDir)).resolves.toEqual({
        appPath: path.join(tempDir, "mac-arm64", "Recipe Room.app"),
        archivePath: path.join(tempDir, "Recipe Room-mac-arm64.zip"),
      })
      await fs.rm(path.join(tempDir, "mac-arm64"), {
        recursive: true,
      })
      await expect(findBuiltApp(tempDir)).rejects.toThrow(
        "Packaged app bundle was not created"
      )
    } finally {
      await fs.rm(tempDir, {
        force: true,
        recursive: true,
      })
    }
  })
})
