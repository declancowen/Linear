import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { pendingEmailVerificationCookieName } from "@/lib/auth-email-verification"

const pageRouteMocks = vi.hoisted(() => ({
  auth: vi.fn(),
  cookies: vi.fn(),
  emailVerificationScreen: vi.fn(),
  ensureAppContext: vi.fn(),
  redirect: vi.fn(),
  workspaceEntryJoinState: vi.fn(),
  workspaceEntryJoinSection: vi.fn(),
  workspaceForm: vi.fn(),
}))

vi.mock("@workos-inc/authkit-nextjs", () => ({
  withAuth: pageRouteMocks.auth,
}))

vi.mock("next/navigation", () => ({
  redirect: pageRouteMocks.redirect,
}))

vi.mock("next/headers", () => ({
  cookies: pageRouteMocks.cookies,
}))

vi.mock("@/lib/server/authenticated-app", () => ({
  ensureAuthenticatedAppContext: pageRouteMocks.ensureAppContext,
  getWorkspaceEntryJoinState: pageRouteMocks.workspaceEntryJoinState,
}))

vi.mock("@/components/app/auth-email-verification-screen", () => ({
  AuthEmailVerificationScreen: (props: Record<string, unknown>) => {
    pageRouteMocks.emailVerificationScreen(props)
    return <div>Email verification screen</div>
  },
}))

vi.mock("@/components/app/onboarding-workspace-form", () => ({
  OnboardingWorkspaceForm: () => {
    pageRouteMocks.workspaceForm()
    return <div>Create workspace form</div>
  },
}))

vi.mock("@/components/app/workspace-entry-join-section", () => ({
  WorkspaceEntryJoinSection: (props: Record<string, unknown>) => {
    pageRouteMocks.workspaceEntryJoinSection(props)
    return <div>Workspace entry join section</div>
  },
}))

function redirectError(path: string) {
  return new Error(`redirect:${path}`)
}

describe("root app pages", () => {
  beforeEach(() => {
    for (const mock of Object.values(pageRouteMocks)) {
      mock.mockReset()
    }

    pageRouteMocks.redirect.mockImplementation((path: string) => {
      throw redirectError(path)
    })
    pageRouteMocks.cookies.mockResolvedValue({
      get: vi.fn(),
    })
    pageRouteMocks.auth.mockResolvedValue({
      user: {
        id: "workos_user_1",
        email: "alex@example.com",
      },
      organizationId: "org_1",
    })
    pageRouteMocks.ensureAppContext.mockResolvedValue({
      authContext: {
        currentWorkspace: {
          id: "workspace_1",
        },
      },
    })
    pageRouteMocks.workspaceEntryJoinState.mockResolvedValue({
      currentWorkspace: null,
      joinedTeamIds: [],
      pendingInvites: [],
    })
  })

  it("routes authenticated root visits through session validation and workspace entry", async () => {
    const { default: HomePage } = await import("@/app/page")

    await expect(
      HomePage({
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow("redirect:/auth/session")

    await expect(
      HomePage({
        searchParams: Promise.resolve({
          validated: "1",
        }),
      })
    ).rejects.toThrow("redirect:/workspace/projects")

    pageRouteMocks.ensureAppContext.mockResolvedValueOnce({
      authContext: {
        currentWorkspace: null,
      },
    })
    await expect(
      HomePage({
        searchParams: Promise.resolve({
          validated: "1",
        }),
      })
    ).rejects.toThrow("redirect:/onboarding")
  })

  it("renders verification pages only with pending verification state", async () => {
    const { serializePendingEmailVerificationState } = await import(
      "@/lib/auth-email-verification"
    )
    const { default: VerifyEmailPage } = await import("@/app/verify-email/page")

    pageRouteMocks.cookies.mockResolvedValueOnce({
      get: (name: string) =>
        name === pendingEmailVerificationCookieName
          ? {
              value: serializePendingEmailVerificationState({
                email: "alex@example.com",
                mode: "login",
                nextPath: "/workspace/docs",
                pendingAuthenticationToken: "pending-token",
              }),
            }
          : undefined,
    })

    render(
      await VerifyEmailPage({
        searchParams: Promise.resolve({
          error: "Try again",
          notice: "Check your inbox",
        }),
      })
    )

    expect(screen.getByText("Email verification screen")).toBeInTheDocument()
    expect(pageRouteMocks.emailVerificationScreen).toHaveBeenCalledWith({
      mode: "login",
      nextPath: "/workspace/docs",
      email: "alex@example.com",
      error: "Try again",
      notice: "Check your inbox",
    })

    pageRouteMocks.auth.mockResolvedValueOnce({
      user: null,
      organizationId: null,
    })
    await expect(
      VerifyEmailPage({
        searchParams: Promise.resolve({
          email: "sam@example.com",
          mode: "signup",
          next: "/workspace/chats",
        }),
      })
    ).rejects.toThrow("redirect:/signup")
  })

  it("renders reset password and onboarding entry states", async () => {
    const { default: ResetPasswordPage } = await import(
      "@/app/reset-password/page"
    )
    const { default: OnboardingPage } = await import("@/app/onboarding/page")

    render(
      await ResetPasswordPage({
        searchParams: Promise.resolve({
          token: "reset-token",
          next: "/workspace/docs",
        }),
      })
    )
    expect(screen.getByText("Choose a new password")).toBeInTheDocument()

    render(
      await OnboardingPage({
        searchParams: Promise.resolve({
          code: " JOIN123 ",
          validated: "1",
        }),
      })
    )
    expect(screen.getByText("Workspace entry join section")).toBeInTheDocument()
    expect(pageRouteMocks.workspaceEntryJoinSection).toHaveBeenCalledWith(
      expect.objectContaining({
        joinCode: "JOIN123",
      })
    )
  })

  it("redirects completed onboarding users to their workspace", async () => {
    const { default: OnboardingPage } = await import("@/app/onboarding/page")

    pageRouteMocks.workspaceEntryJoinState.mockResolvedValueOnce({
      currentWorkspace: {
        name: "Recipe Room",
      },
      joinedTeamIds: [],
      pendingInvites: [],
    })

    await expect(
      OnboardingPage({
        searchParams: Promise.resolve({
          validated: "1",
        }),
      })
    ).rejects.toThrow("redirect:/workspace/projects")
  })
})
