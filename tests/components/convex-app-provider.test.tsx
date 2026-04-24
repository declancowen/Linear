import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  fetchWorkspaceMembershipReadModelMock,
  mergeReadModelDataMock,
  replaceDomainDataMock,
  setThemeMock,
} = vi.hoisted(() => ({
  fetchWorkspaceMembershipReadModelMock: vi.fn(),
  mergeReadModelDataMock: vi.fn(),
  replaceDomainDataMock: vi.fn(),
  setThemeMock: vi.fn(),
}))

vi.mock("next-themes", () => ({
  useTheme: () => ({
    setTheme: setThemeMock,
  }),
}))

vi.mock("@/lib/auth-routing", () => ({
  buildAuthPageHref: () => "/login",
  normalizeAuthNextPath: (value: string) => value,
}))

vi.mock("@/lib/browser/snapshot-diagnostics", () => ({
  reportBootstrapModeDiagnostic: vi.fn(),
  reportRealtimeFallbackDiagnostic: vi.fn(),
  reportScopedReadModelDiagnostic: vi.fn(),
  reportSnapshotApplyDiagnostic: vi.fn(),
  reportSnapshotFetchDiagnostic: vi.fn(),
  reportSnapshotStreamReconnectDiagnostic: vi.fn(),
}))

vi.mock("@/lib/browser/theme-preference-sync", () => ({
  resolveSnapshotThemePreference: vi.fn(() => null),
}))

vi.mock("@/lib/convex/client", () => ({
  fetchSnapshotState: vi.fn(),
  fetchSnapshotVersion: vi.fn(),
  RouteMutationError: class RouteMutationError extends Error {
    status = 500
  },
}))

vi.mock("@/lib/convex/client/read-models", () => ({
  fetchWorkspaceMembershipReadModel: fetchWorkspaceMembershipReadModelMock,
}))

vi.mock("@/lib/realtime/feature-flags", () => ({
  shouldUseLegacySnapshotSync: () => false,
}))

vi.mock("@/lib/scoped-sync/scope-keys", () => ({
  createShellContextScopeKey: () => "shell-context",
  createWorkspaceMembershipScopeKey: (workspaceId: string) =>
    `workspace-membership:${workspaceId}`,
}))

vi.mock("@/lib/store/app-store", () => ({
  useAppStore: (
    selector: (state: {
      replaceDomainData: typeof replaceDomainDataMock
      mergeReadModelData: typeof mergeReadModelDataMock
      currentWorkspaceId: string
    }) => unknown
  ) =>
    selector({
      replaceDomainData: replaceDomainDataMock,
      mergeReadModelData: mergeReadModelDataMock,
      currentWorkspaceId: "",
    }),
}))

describe("ConvexAppProvider", () => {
  beforeEach(() => {
    fetchWorkspaceMembershipReadModelMock.mockReset()
    mergeReadModelDataMock.mockReset()
    replaceDomainDataMock.mockReset()
    setThemeMock.mockReset()

    fetchWorkspaceMembershipReadModelMock.mockResolvedValue({
      data: {
        workspaces: [
          {
            id: "workspace_1",
            name: "Recipe Room",
            slug: "recipe-room",
            description: "",
            logoUrl: "",
            logoImageStorageId: null,
            accent: "#000000",
            createdAt: "2026-04-23T12:00:00.000Z",
            updatedAt: "2026-04-23T12:00:00.000Z",
          },
        ],
      },
      replace: [
        {
          kind: "workspace-membership",
          workspaceId: "workspace_1",
        },
      ],
    })
  })

  it("forwards scoped bootstrap replace instructions into store merges", async () => {
    const { ConvexAppProvider } = await import(
      "@/components/providers/convex-app-provider"
    )

    render(
      <ConvexAppProvider initialWorkspaceId="workspace_1">
        <div>App content</div>
      </ConvexAppProvider>
    )

    await waitFor(() => {
      expect(screen.getByText("App content")).toBeInTheDocument()
    })

    expect(fetchWorkspaceMembershipReadModelMock).toHaveBeenCalledWith(
      "workspace_1"
    )
    expect(mergeReadModelDataMock).toHaveBeenCalledWith(
      {
        workspaces: [
          expect.objectContaining({
            id: "workspace_1",
          }),
        ],
      },
      {
        replace: [
          {
            kind: "workspace-membership",
            workspaceId: "workspace_1",
          },
        ],
      }
    )
  })
})
