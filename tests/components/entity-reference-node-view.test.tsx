import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

const { pushMock, toastErrorMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  toastErrorMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
  },
}))

vi.mock("@tiptap/react", () => ({
  NodeViewWrapper: (input: { as?: string; children: ReactNode }) => {
    const { as, children, ...props } = input
    void as
    return <span {...props}>{children}</span>
  },
}))

vi.mock("@/components/app/entity-icons", () => ({
  ProjectIconGlyph: ({ project }: { project: { icon?: string | null } }) => (
    <span data-testid="project-icon" data-icon={project.icon ?? ""} />
  ),
}))

vi.mock("@/components/app/phosphor-icon-picker", () => ({
  PhosphorIconGlyph: ({ icon }: { icon?: string | null }) => (
    <span data-testid="view-icon" data-icon={icon ?? ""} />
  ),
}))

import { EntityReferenceNodeView } from "@/components/app/rich-text-editor/entity-reference-node-view"
import { useAppStore } from "@/lib/store/app-store"
import {
  createTestAppData,
  createTestProject,
  createTestViewDefinition,
} from "@/tests/lib/fixtures/app-data"

function renderReference(
  attrs: Record<string, unknown>,
  updateAttributes = vi.fn()
) {
  const props = {
    node: { attrs },
    editor: { isEditable: true },
    updateAttributes,
  } as unknown as Parameters<typeof EntityReferenceNodeView>[0]

  render(<EntityReferenceNodeView {...props} />)

  return updateAttributes
}

describe("EntityReferenceNodeView", () => {
  beforeEach(() => {
    pushMock.mockReset()
    toastErrorMock.mockReset()
    useAppStore.setState(
      createTestAppData({
        projects: [
          createTestProject({
            id: "project_1",
            icon: "RocketLaunch",
          }),
        ],
        views: [
          createTestViewDefinition({
            id: "view_1",
            icon: "Kanban",
          }),
        ],
      })
    )
  })

  afterEach(() => {
    cleanup()
    useAppStore.setState(createTestAppData())
  })

  it("navigates project references and renders the project's icon", () => {
    renderReference({
      referenceType: "project",
      referenceId: "project_1",
      label: "Platform roadmap",
      display: "inline",
    })

    expect(screen.getByTestId("project-icon")).toHaveAttribute(
      "data-icon",
      "RocketLaunch"
    )
    fireEvent.click(screen.getByRole("button", { name: /Platform roadmap/ }))
    expect(pushMock).toHaveBeenCalledWith("/team/platform/projects/project_1")
  })

  it("renders view icons and places the display switcher above the reference", () => {
    const updateAttributes = renderReference({
      referenceType: "view",
      referenceId: "view_1",
      label: "Delivery view",
      display: "preview",
    })

    expect(screen.getByTestId("view-icon")).toHaveAttribute(
      "data-icon",
      "Kanban"
    )

    fireEvent.mouseEnter(
      screen.getByRole("button", { name: /Delivery viewitems view/ })
        .parentElement as HTMLElement
    )
    const switcher = screen.getByRole("button", {
      name: "Show as inline reference",
    }).parentElement
    expect(switcher).toHaveClass("bottom-full")

    fireEvent.click(
      screen.getByRole("button", { name: "Show as inline reference" })
    )
    expect(updateAttributes).toHaveBeenCalledWith({ display: "inline" })
  })

  it("reports inaccessible references instead of navigating", () => {
    renderReference({
      referenceType: "document",
      referenceId: "missing_doc",
      label: "Missing document",
      display: "inline",
    })

    fireEvent.click(screen.getByRole("button", { name: /Missing document/ }))
    expect(pushMock).not.toHaveBeenCalled()
    expect(toastErrorMock).toHaveBeenCalledWith(
      "You do not have access to this reference"
    )
  })
})
