import { createElement } from "react"
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const userSettingsMocks = vi.hoisted(() => ({
  clearPendingThemePreference: vi.fn(),
  router: {
    refresh: vi.fn(),
    replace: vi.fn(),
  },
  setPendingThemePreference: vi.fn(),
  setTheme: vi.fn(),
  submitLogoutForm: vi.fn(),
  syncDeleteCurrentAccount: vi.fn(),
  syncRequestAccountEmailChange: vi.fn(),
  syncRequestCurrentAccountPasswordReset: vi.fn(),
  syncUpdateCurrentUserProfile: vi.fn(),
  syncUpdateWorkspaceBranding: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => userSettingsMocks.router,
}))

vi.mock("next-themes", () => ({
  useTheme: () => ({ setTheme: userSettingsMocks.setTheme }),
}))

vi.mock("sonner", () => ({
  toast: {
    error: userSettingsMocks.toastError,
    success: userSettingsMocks.toastSuccess,
  },
}))

vi.mock("@/lib/browser/logout", () => ({
  submitLogoutForm: userSettingsMocks.submitLogoutForm,
}))

vi.mock("@/lib/browser/theme-preference-sync", () => ({
  clearPendingThemePreference: userSettingsMocks.clearPendingThemePreference,
  setPendingThemePreference: userSettingsMocks.setPendingThemePreference,
}))

vi.mock("@/lib/convex/client", () => ({
  syncDeleteCurrentAccount: userSettingsMocks.syncDeleteCurrentAccount,
  syncRequestAccountEmailChange:
    userSettingsMocks.syncRequestAccountEmailChange,
  syncRequestCurrentAccountPasswordReset:
    userSettingsMocks.syncRequestCurrentAccountPasswordReset,
  syncUpdateCurrentUserProfile: userSettingsMocks.syncUpdateCurrentUserProfile,
  syncUpdateWorkspaceBranding: userSettingsMocks.syncUpdateWorkspaceBranding,
}))

vi.mock("@/components/ui/confirm-dialog", async () => {
  const { createElement: createReactElement } = await import("react")

  return {
    ConfirmDialog: ({
      confirmLabel,
      loading,
      onConfirm,
      open,
    }: {
      confirmLabel: string
      loading?: boolean
      onConfirm: () => void
      open: boolean
    }) =>
      open
        ? createReactElement(
            "button",
            {
              disabled: loading,
              onClick: onConfirm,
              type: "button",
            },
            confirmLabel
          )
        : null,
  }
})

vi.mock("@/components/ui/sidebar", async () => {
  const { createElement: createReactElement } = await import("react")

  return {
    SidebarTrigger: () =>
      createReactElement("button", { type: "button" }, "Menu"),
  }
})

import {
  ImageUploadControl,
  SettingsHero,
} from "@/components/app/settings-screens/shared"
import { TeamEditorFields } from "@/components/app/settings-screens/team-editor-fields"
import { CreateTeamScreen } from "@/components/app/settings-screens/create-team-screen"
import { getTeamMemberManagementActionState } from "@/components/app/settings-screens/member-management-actions"
import {
  TeamSettingsScreen,
} from "@/components/app/settings-screens/team-settings-screen"
import {
  TeamSettingsFooter,
  useTeamSettingsDraft,
} from "@/components/app/settings-screens/team-settings-draft"
import {
  WorkspaceSettingsScreen,
} from "@/components/app/settings-screens/workspace-settings-screen"
import {
  getWorkspaceBrandingSnapshot,
  upsertGroupedPendingInvite,
} from "@/components/app/settings-screens/workspace-settings-state"
import {
  UserSettingsScreen,
} from "@/components/app/settings-screens/user-settings-screen"
import { getUserProfileDraftSource } from "@/components/app/settings-screens/user-profile-draft"
import { createEmptyState } from "@/lib/domain/empty-state"
import { createDefaultTeamFeatureSettings } from "@/lib/domain/types"
import { useAppStore } from "@/lib/store/app-store"
import {
  createTestAppData,
  createTestTeam,
  createTestTeamMembership,
  createTestUser,
  createTestWorkspace,
} from "@/tests/lib/fixtures/app-data"

function createTeamEditorProps(
  overrides: Partial<Parameters<typeof TeamEditorFields>[0]> = {}
): Parameters<typeof TeamEditorFields>[0] {
  const features = createDefaultTeamFeatureSettings("software-development")

  return {
    name: "Platform",
    icon: "robot",
    summary: "Builds core product surfaces.",
    joinCode: "JOIN1234",
    experience: "software-development",
    features,
    savedFeatures: features,
    surfaceDisableReasons: {
      docs: null,
      chat: null,
      channels: null,
    },
    setName: vi.fn(),
    setIcon: vi.fn(),
    setSummary: vi.fn(),
    setFeatures: vi.fn(),
    ...overrides,
  }
}

describe("settings screen helpers", () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    useAppStore.setState(createEmptyState())
  })

  it("renders create-team and team-settings screens from workspace-owned state", () => {
    const { rerender } = render(createElement(CreateTeamScreen))
    expect(
      screen.getAllByText("Workspace unavailable").length
    ).toBeGreaterThan(0)

    useAppStore.setState(createTestAppData())
    rerender(createElement(CreateTeamScreen))
    expect(screen.getAllByText("Create team").length).toBeGreaterThan(0)

    render(createElement(TeamSettingsScreen, { teamSlug: "platform" }))
    expect(screen.getAllByText("Platform").length).toBeGreaterThan(0)
  })

  it("saves team settings drafts and renders footer state", async () => {
    const updateTeamDetails = vi.fn().mockResolvedValue(true)
    const team = createTestTeam({
      name: "Platform",
      settings: {
        summary: "Builds core product surfaces.",
      },
    })
    useAppStore.setState({
      ...createTestAppData({
        teams: [team],
      }),
      updateTeamDetails: updateTeamDetails as never,
    })

    const { result } = renderHook(() =>
      useTeamSettingsDraft({
        experience: "software-development",
        router: userSettingsMocks.router as never,
        team,
      })
    )

    await act(async () => {
      await result.current.handleSaveTeam()
    })

    expect(updateTeamDetails).toHaveBeenCalledWith(
      "team_1",
      expect.objectContaining({
        name: "Platform",
        summary: "Builds core product surfaces.",
      })
    )
    expect(userSettingsMocks.router.refresh).toHaveBeenCalled()

    const onSave = vi.fn()
    const { rerender } = render(
      createElement(TeamSettingsFooter, {
        activeTab: "members" as never,
        canManageTeam: true,
        canSaveTeam: true,
        saving: false,
        onSave,
      })
    )
    expect(screen.queryByText("Save changes")).toBeNull()

    rerender(
      createElement(TeamSettingsFooter, {
        activeTab: "team" as never,
        canManageTeam: true,
        canSaveTeam: true,
        saving: false,
        onSave,
      })
    )
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it("derives member-management action disabled and label state", () => {
    expect(
      getTeamMemberManagementActionState({
        isBusy: false,
        isCurrentUser: false,
        pendingAction: null,
      })
    ).toEqual({
      disabled: false,
      removeLabel: "Remove",
    })
    expect(
      getTeamMemberManagementActionState({
        isBusy: true,
        isCurrentUser: false,
        pendingAction: "remove",
      })
    ).toEqual({
      disabled: true,
      removeLabel: "Removing...",
    })
  })

  it("groups pending workspace invites by batch and accumulates team names", () => {
    const groupedInvites = new Map()
    const baseInvite = {
      id: "invite_1",
      batchId: "batch_1",
      workspaceId: "workspace_1",
      teamId: "team_1",
      email: "alex@example.com",
      role: "member",
      invitedBy: "owner_1",
      acceptedAt: null,
      declinedAt: null,
    }
    const users = [{ id: "owner_1", name: "Owner" }]

    upsertGroupedPendingInvite({
      groupedInvites,
      invite: baseInvite as never,
      teamName: "Product",
      users: users as never,
    })
    upsertGroupedPendingInvite({
      groupedInvites,
      invite: {
        ...baseInvite,
        id: "invite_2",
        teamId: "team_2",
      } as never,
      teamName: "Design",
      users: users as never,
    })

    expect(groupedInvites.get("batch_1")).toMatchObject({
      id: "invite_1",
      email: "alex@example.com",
      invitedByName: "Owner",
      role: "member",
    })
    expect([...groupedInvites.get("batch_1").teamNames]).toEqual([
      "Product",
      "Design",
    ])

    upsertGroupedPendingInvite({
      groupedInvites,
      invite: {
        ...baseInvite,
        id: "invite_3",
        batchId: null,
        invitedBy: "missing_user",
      } as never,
      teamName: undefined,
      users: users as never,
    })

    expect(groupedInvites.get("invite_3")).toMatchObject({
      invitedByName: "Unknown sender",
    })
  })

  it("creates workspace branding snapshots for missing and persisted workspaces", () => {
    expect(getWorkspaceBrandingSnapshot(undefined)).toEqual({
      workspaceId: null,
      name: "",
      logoUrl: "",
      logoImageSrc: null,
      accent: "emerald",
      description: "",
    })
    expect(
      getWorkspaceBrandingSnapshot({
        id: "workspace_1",
        name: "Acme",
        logoUrl: "https://cdn.example.com/legacy.png",
        logoImageUrl: "https://cdn.example.com/logo.png",
        settings: {
          accent: "blue",
          description: "Workspace description",
        },
      } as never)
    ).toEqual({
      workspaceId: "workspace_1",
      name: "Acme",
      logoUrl: "https://cdn.example.com/legacy.png",
      logoImageSrc: "https://cdn.example.com/logo.png",
      accent: "blue",
      description: "Workspace description",
    })
  })

  it("creates user profile draft sources from empty and persisted profiles", () => {
    expect(getUserProfileDraftSource(null)).toMatchObject({
      id: null,
      name: "",
      title: "",
      avatarUrl: "",
      avatarImageSrc: null,
      email: "",
      emailMentions: false,
      emailAssignments: false,
      emailDigest: false,
    })
    expect(
      getUserProfileDraftSource({
        id: "user_1",
        email: "alex@example.com",
        name: "Alex",
        title: "Designer",
        avatarUrl: "https://cdn.example.com/avatar-fallback.png",
        avatarImageUrl: "https://cdn.example.com/avatar.png",
        preferences: {
          emailMentions: true,
          emailAssignments: false,
          emailDigest: true,
          theme: "dark",
        },
      } as never)
    ).toMatchObject({
      id: "user_1",
      name: "Alex",
      title: "Designer",
      avatarUrl: "https://cdn.example.com/avatar-fallback.png",
      avatarImageSrc: "https://cdn.example.com/avatar.png",
      email: "alex@example.com",
      emailMentions: true,
      emailAssignments: false,
      emailDigest: true,
    })
  })

  it("renders settings hero optional regions only when supplied", () => {
    const { rerender } = render(
      createElement(SettingsHero, {
        leading: createElement("span", null, "Icon"),
        title: "Workspace",
        description: "Manage workspace defaults",
        meta: [
          { key: "plan", label: "Pro" },
          { key: "members", label: "12 members" },
        ],
        action: createElement("button", { type: "button" }, "Save"),
      })
    )

    expect(screen.getByText("Icon")).toBeInTheDocument()
    expect(screen.getAllByText("Workspace").length).toBeGreaterThan(0)
    expect(screen.getByText("Manage workspace defaults")).toBeInTheDocument()
    expect(screen.getByText("Pro")).toBeInTheDocument()
    expect(screen.getByText("12 members")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument()

    rerender(createElement(SettingsHero, { title: "Profile" }))

    expect(screen.getByText("Profile")).toBeInTheDocument()
    expect(screen.queryByText("Icon")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument()
  })

  it("handles image upload preview, file selection, and clear states", () => {
    const onClear = vi.fn()
    const onSelect = vi.fn()
    const preview = createElement("span", null, "Preview")

    const { container, rerender } = render(
      createElement(ImageUploadControl, {
        title: "Avatar",
        imageSrc: null,
        preview,
        shape: "circle",
        onClear,
        onSelect,
      })
    )
    const input = container.querySelector<HTMLInputElement>("input[type='file']")
    const file = new File(["avatar"], "avatar.png", { type: "image/png" })

    expect(screen.getByText("Preview")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove image" })).toBeDisabled()

    fireEvent.change(input!, { target: { files: [file] } })

    expect(onSelect).toHaveBeenCalledWith(file)

    rerender(
      createElement(ImageUploadControl, {
        title: "Avatar",
        description: "Use a team avatar.",
        imageSrc: "https://cdn.example.com/avatar.png",
        preview,
        shape: "square",
        onClear,
        onSelect,
      })
    )

    expect(screen.getByAltText("Avatar")).toHaveAttribute(
      "src",
      "https://cdn.example.com/avatar.png"
    )
    expect(screen.getByText("Use a team avatar.")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Remove image" }))
    expect(onClear).toHaveBeenCalledTimes(1)

    rerender(
      createElement(ImageUploadControl, {
        title: "Avatar",
        imageSrc: "https://cdn.example.com/avatar.png",
        preview,
        shape: "square",
        uploading: true,
        onClear,
        onSelect,
      })
    )

    expect(screen.getByRole("button", { name: "Uploading..." })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Remove image" })).toBeEnabled()
  })

  it("renders team editor identity and surface branches without changing owners", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const onRegenerateJoinCode = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: {
        writeText,
      },
    })

    const { rerender } = render(
      createElement(TeamEditorFields, {
        ...createTeamEditorProps({
          canChangeExperience: true,
          onRegenerateJoinCode,
        }),
      })
    )

    fireEvent.click(screen.getByRole("button", { name: "Copy" }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("JOIN1234"))

    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }))
    expect(onRegenerateJoinCode).toHaveBeenCalledTimes(1)

    expect(screen.getByRole("button", { name: /Community/ })).toBeInTheDocument()
    expect(screen.queryByText("Enable at least one surface for community teams.")).not.toBeInTheDocument()

    const communityFeatures = createDefaultTeamFeatureSettings("community")
    rerender(
      createElement(TeamEditorFields, {
        ...createTeamEditorProps({
          experience: "community",
          features: {
            ...communityFeatures,
            docs: false,
            chat: false,
            channels: false,
          },
          savedFeatures: communityFeatures,
          joinCode: "",
          showJoinCode: true,
          onRegenerateJoinCode: null,
        }),
      })
    )

    expect(screen.getByText("Generated on create")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Copy" })).not.toBeInTheDocument()
    expect(screen.getByText("Enable at least one surface for community teams.")).toBeInTheDocument()
    expect(screen.queryByText("Core model:")).not.toBeInTheDocument()
  })

  it("drives user settings account and profile persistence branches", async () => {
    userSettingsMocks.syncRequestAccountEmailChange.mockResolvedValue({
      logoutRequired: true,
      notice: "Check your inbox",
    })
    userSettingsMocks.syncRequestCurrentAccountPasswordReset.mockResolvedValue(
      undefined
    )
    userSettingsMocks.syncUpdateCurrentUserProfile.mockResolvedValue(undefined)
    userSettingsMocks.syncDeleteCurrentAccount.mockResolvedValue({
      logoutRequired: false,
      notice: "Deleted",
    })
    useAppStore.setState(
      createTestAppData({
        teamMemberships: [createTestTeamMembership({ role: "member" })],
        users: [createTestUser({ email: "alex@example.com" })],
        workspaces: [createTestWorkspace({ createdBy: "owner_1" })],
      })
    )

    render(createElement(UserSettingsScreen))

    fireEvent.click(screen.getByRole("button", { name: "Change email" }))
    expect(userSettingsMocks.toastError).toHaveBeenCalledWith(
      "Enter a different email address"
    )

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "alex.new@example.com" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Change email" }))

    await waitFor(() =>
      expect(userSettingsMocks.submitLogoutForm).toHaveBeenCalledWith(
        "/login?notice=Check%20your%20inbox"
      )
    )

    fireEvent.click(screen.getByRole("button", { name: "Send password reset" }))
    await waitFor(() =>
      expect(userSettingsMocks.toastSuccess).toHaveBeenCalledWith(
        "Password reset email sent"
      )
    )

    fireEvent.click(screen.getByLabelText("Dark"))
    await waitFor(() =>
      expect(userSettingsMocks.syncUpdateCurrentUserProfile).toHaveBeenCalled()
    )
    expect(userSettingsMocks.setPendingThemePreference).toHaveBeenCalledWith(
      "dark"
    )
    expect(userSettingsMocks.setTheme).toHaveBeenCalledWith("dark")

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Alex Updated" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }))

    await waitFor(() =>
      expect(userSettingsMocks.router.refresh).toHaveBeenCalled()
    )

    fireEvent.click(screen.getByRole("button", { name: "Delete account" }))
    fireEvent.click(
      screen.getAllByRole("button", { name: "Delete account" }).at(-1)!
    )

    await waitFor(() =>
      expect(userSettingsMocks.router.replace).toHaveBeenCalledWith("/")
    )
  })

  it("saves workspace settings through the workspace settings owner", async () => {
    userSettingsMocks.syncUpdateWorkspaceBranding.mockResolvedValue(undefined)
    useAppStore.setState(
      createTestAppData({
        workspaces: [
          createTestWorkspace({
            settings: {
              accent: "blue",
              description: "Workspace description",
            },
          }),
        ],
      })
    )

    const { container } = render(createElement(WorkspaceSettingsScreen))

    expect(screen.getAllByText("Workspace").length).toBeGreaterThan(0)
    expect(screen.getByText("1 member")).toBeInTheDocument()
    expect(screen.getByText("1 team")).toBeInTheDocument()

    fireEvent.change(container.querySelector("#workspace-name")!, {
      target: { value: "Workspace Updated" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() =>
      expect(userSettingsMocks.syncUpdateWorkspaceBranding).toHaveBeenCalledWith(
        "workspace_1",
        "Workspace Updated",
        "",
        "blue",
        "Workspace description",
        {}
      )
    )
    expect(userSettingsMocks.toastSuccess).toHaveBeenCalledWith(
      "Workspace updated"
    )
    expect(userSettingsMocks.router.refresh).toHaveBeenCalled()
  })
})
