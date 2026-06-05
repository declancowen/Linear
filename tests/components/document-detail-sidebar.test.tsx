import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import { DocumentDetailSidebarSurface } from "@/components/app/screens/document-detail-sidebar"
import {
  createTestAppData,
  createTestDocument,
} from "@/tests/lib/fixtures/app-data"

describe("DocumentDetailSidebarSurface", () => {
  it("does not offer document properties for item description documents", () => {
    const document = createTestDocument({
      id: "doc_item_description",
      kind: "item-description",
      title: "Task description",
    })
    const data = createTestAppData({
      documents: [document],
    })

    render(
      <DocumentDetailSidebarSurface
        data={data}
        document={document}
        editable
      />
    )

    expect(
      screen.queryByRole("button", { name: "Add property" })
    ).not.toBeInTheDocument()
  })
})
