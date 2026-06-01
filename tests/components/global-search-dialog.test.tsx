import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"

import { GlobalSearchDialog } from "@/components/app/global-search-dialog"
import { useAppStore } from "@/lib/store/app-store"
import {
  createTestAppData,
  createTestUser,
  createTestWorkspace,
  createTestWorkspaceMembership,
} from "@/tests/lib/fixtures/app-data"

const routerPushMock = vi.hoisted(() => vi.fn())

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    push: routerPushMock,
  }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@/hooks/use-scoped-read-model-refresh", () => ({
  useScopedReadModelRefresh: () => ({
    error: null,
    hasLoadedOnce: true,
    refreshing: false,
  }),
}))

const currentUser = createTestUser({
  id: "user_1",
  name: "Alex",
})
const workspace = createTestWorkspace({
  id: "workspace_1",
  name: "Acme",
})

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  routerPushMock.mockReset()
  useAppStore.setState(
    createTestAppData({
      currentUserId: currentUser.id,
      currentWorkspaceId: workspace.id,
      users: [currentUser],
      workspaces: [workspace],
      workspaceMemberships: [
        createTestWorkspaceMembership({
          userId: currentUser.id,
          workspaceId: workspace.id,
        }),
      ],
    })
  )
})

describe("GlobalSearchDialog", () => {
  it("centers result icons against the first-line label", () => {
    render(
      <GlobalSearchDialog
        open
        onOpenChange={vi.fn()}
        onQueryChange={vi.fn()}
        onOpenFullSearch={vi.fn()}
        onSelectCreateAction={vi.fn()}
        fullSearchShortcutKeys={["Meta", "K"]}
        createActions={[
          {
            id: "create-workspace-view",
            kind: "view",
            title: "Create workspace view",
            subtitle: "Workspace view",
            scopeLabel: "Acme",
          },
        ]}
      />
    )

    const resultItem = screen
      .getByText("Create workspace view")
      .closest('[data-slot="command-item"]')

    expect(resultItem).not.toBeNull()

    const icon = within(resultItem as HTMLElement).getByTestId(
      "global-search-result-icon"
    )

    expect(icon).toHaveClass("flex", "h-5", "items-center")
    expect(icon).not.toHaveClass("mt-0.5", "self-start")
  })
})
