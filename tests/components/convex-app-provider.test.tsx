import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ReadModelFetchResult } from "@/lib/convex/client/read-models"
import type { AppSnapshot, ThemePreference } from "@/lib/domain/types"

const {
  fetchSnapshotStateMock,
  fetchSnapshotVersionMock,
  mergeReadModelDataMock,
  replaceDomainDataMock,
  resolveSnapshotThemePreferenceMock,
  setThemeMock,
  shouldUseLegacySnapshotSyncMock,
} = vi.hoisted(() => ({
  fetchSnapshotStateMock: vi.fn(),
  fetchSnapshotVersionMock: vi.fn(),
  mergeReadModelDataMock: vi.fn(),
  replaceDomainDataMock: vi.fn(),
  resolveSnapshotThemePreferenceMock: vi.fn<
    (value: ThemePreference) => ThemePreference | null
  >(() => null),
  setThemeMock: vi.fn(),
  shouldUseLegacySnapshotSyncMock: vi.fn(() => false),
}))

vi.mock("next-themes", () => ({
  useTheme: () => ({
    setTheme: setThemeMock,
  }),
}))

vi.mock("@/lib/browser/session-redirect", () => ({
  redirectToExpiredSessionLogin: vi.fn(),
}))

vi.mock("@/lib/browser/snapshot-diagnostics", () => ({
  reportBootstrapModeDiagnostic: vi.fn(),
  reportSnapshotApplyDiagnostic: vi.fn(),
  reportSnapshotFetchDiagnostic: vi.fn(),
  reportSnapshotStreamReconnectDiagnostic: vi.fn(),
}))

vi.mock("@/lib/browser/theme-preference-sync", () => ({
  resolveSnapshotThemePreference: resolveSnapshotThemePreferenceMock,
}))

vi.mock("@/lib/convex/client", () => ({
  fetchSnapshotState: fetchSnapshotStateMock,
  fetchSnapshotVersion: fetchSnapshotVersionMock,
  RouteMutationError: class RouteMutationError extends Error {
    status = 500
  },
}))

vi.mock("@/lib/realtime/feature-flags", () => ({
  shouldUseLegacySnapshotSync: shouldUseLegacySnapshotSyncMock,
}))

vi.mock("@/lib/store/app-store", () => ({
  useAppStore: (
    selector: (state: {
      replaceDomainData: typeof replaceDomainDataMock
      mergeReadModelData: typeof mergeReadModelDataMock
    }) => unknown
  ) =>
    selector({
      replaceDomainData: replaceDomainDataMock,
      mergeReadModelData: mergeReadModelDataMock,
    }),
}))

const initialShellSeed: ReadModelFetchResult<Partial<AppSnapshot>> = {
  data: {
    currentUserId: "user_1",
    currentWorkspaceId: "workspace_1",
    users: [
      {
        id: "user_1",
        name: "Recipe Person",
        handle: "recipe",
        email: "recipe@example.com",
        avatarUrl: "RP",
        avatarImageUrl: null,
        workosUserId: "workos_1",
        title: "",
        status: "offline",
        statusMessage: "",
        hasExplicitStatus: false,
        accountDeletionPendingAt: null,
        accountDeletedAt: null,
        preferences: {
          emailMentions: true,
          emailAssignments: true,
          emailDigest: true,
          theme: "light",
        },
      },
    ],
    workspaces: [
      {
        id: "workspace_1",
        name: "Recipe Room",
        slug: "recipe-room",
        logoUrl: "",
        logoImageUrl: null,
        createdBy: null,
        workosOrganizationId: null,
        settings: {
          accent: "#000000",
          description: "",
        },
      },
    ],
  },
  replace: [
    {
      kind: "workspace-membership",
      workspaceId: "workspace_1",
    },
  ],
}

describe("ConvexAppProvider", () => {
  beforeEach(() => {
    fetchSnapshotStateMock.mockReset()
    fetchSnapshotVersionMock.mockReset()
    mergeReadModelDataMock.mockReset()
    replaceDomainDataMock.mockReset()
    resolveSnapshotThemePreferenceMock.mockReset()
    resolveSnapshotThemePreferenceMock.mockReturnValue(null)
    setThemeMock.mockReset()
    shouldUseLegacySnapshotSyncMock.mockReset()
    shouldUseLegacySnapshotSyncMock.mockReturnValue(false)
  })

  it("hydrates the initial shell seed and renders children without a loading overlay", async () => {
    const { ConvexAppProvider } = await import(
      "@/components/providers/convex-app-provider"
    )

    render(
      <ConvexAppProvider
        initialShellSeed={initialShellSeed}
        initialWorkspaceId="workspace_1"
      >
        <div>App content</div>
      </ConvexAppProvider>
    )

    expect(screen.getByText("App content")).toBeInTheDocument()
    expect(screen.queryByText("Loading workspace...")).not.toBeInTheDocument()

    await waitFor(() => {
      expect(mergeReadModelDataMock).toHaveBeenCalledWith(
        initialShellSeed.data,
        {
          replace: initialShellSeed.replace,
        }
      )
    })

    expect(fetchSnapshotStateMock).not.toHaveBeenCalled()
  })

  it("applies theme from the seeded current user preferences", async () => {
    resolveSnapshotThemePreferenceMock.mockReturnValue("dark")

    const { ConvexAppProvider } = await import(
      "@/components/providers/convex-app-provider"
    )

    render(
      <ConvexAppProvider
        initialShellSeed={initialShellSeed}
        initialWorkspaceId="workspace_1"
      >
        <div>App content</div>
      </ConvexAppProvider>
    )

    await waitFor(() => {
      expect(setThemeMock).toHaveBeenCalledWith("dark")
    })
  })

  it("keeps legacy snapshot sync non-blocking when explicitly enabled", async () => {
    shouldUseLegacySnapshotSyncMock.mockReturnValue(true)
    fetchSnapshotStateMock.mockResolvedValue({
      version: 7,
      snapshot: {
        currentUserId: "user_1",
        currentWorkspaceId: "workspace_1",
        workspaces: [],
        workspaceMemberships: [],
        teams: [],
        teamMemberships: [],
        users: [],
        labels: [],
        projects: [],
        milestones: [],
        workItems: [],
        documents: [],
        views: [],
        comments: [],
        attachments: [],
        notifications: [],
        invites: [],
        projectUpdates: [],
        conversations: [],
        calls: [],
        chatMessages: [],
        channelPosts: [],
        channelPostComments: [],
        ui: {
          activeTeamId: "",
          activeInboxNotificationId: null,
          selectedViewByRoute: {},
          activeCreateDialog: null,
        },
      },
    })

    const { ConvexAppProvider } = await import(
      "@/components/providers/convex-app-provider"
    )

    render(
      <ConvexAppProvider
        initialShellSeed={initialShellSeed}
        initialWorkspaceId="workspace_1"
      >
        <div>App content</div>
      </ConvexAppProvider>
    )

    expect(screen.getByText("App content")).toBeInTheDocument()
    expect(screen.queryByText("Loading workspace...")).not.toBeInTheDocument()

    await waitFor(() => {
      expect(replaceDomainDataMock).toHaveBeenCalled()
    })
  })
})
