import type { ReactNode } from "react"
import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { DocsContent } from "@/components/app/screens/docs-content"
import {
  createTestAppData,
  createTestDocument,
  createTestProject,
} from "@/tests/lib/fixtures/app-data"

vi.mock("next/link", async () =>
  (
    await import("@/tests/lib/fixtures/component-stubs")
  ).createNextLinkStubModule()
)

vi.mock("@/components/app/screens/document-ui", () => ({
  DocumentAuthorAvatar: () => <span data-testid="document-author-avatar" />,
  DocumentContextMenu: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}))

describe("DocsContent", () => {
  it("right-aligns document property pills and removes duplicate labels", () => {
    const document = createTestDocument({
      id: "doc_launch",
      title: "Launch notes",
      content: "<p>Readiness checklist</p>",
      linkedProjectIds: ["project_launch"],
    })
    const data = createTestAppData({
      documents: [document],
      projects: [
        createTestProject({
          id: "project_launch",
          name: "Product launch",
        }),
      ],
    })

    render(
      <DocsContent
        data={data}
        displayProps={["linkedProjects", "linkedProjects", "kind", "kind"]}
        documents={[document]}
        emptyTitle="No documents"
        hasLoadedOnce
        layout="list"
      />
    )

    const row = screen.getByText("Launch notes").closest("a")
    expect(row).not.toBeNull()

    const rightColumn = row?.querySelector(
      ".ml-auto.flex.shrink-0.flex-col.items-end"
    )

    expect(rightColumn).not.toBeNull()
    expect(rightColumn).toContainElement(screen.getByText("Product launch"))
    expect(within(row!).getAllByText("Product launch")).toHaveLength(1)
    expect(within(row!).getAllByText("Team")).toHaveLength(1)
  })
})
