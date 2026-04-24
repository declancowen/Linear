import { describe, expect, it } from "vitest"

import { createMissingScopedReadModelResult } from "@/lib/convex/client/read-models"

describe("scoped read model client helpers", () => {
  it("narrows missing document detail results to the requested document", () => {
    expect(
      createMissingScopedReadModelResult([
        {
          kind: "document-detail",
          documentId: "doc_1",
        },
      ])
    ).toEqual({
      data: {
        documents: [],
      },
      replace: [
        {
          kind: "missing-document-detail",
          documentId: "doc_1",
        },
      ],
    })
  })

  it("narrows missing work item detail results to the requested item", () => {
    expect(
      createMissingScopedReadModelResult([
        {
          kind: "work-item-detail",
          itemId: "item_1",
        },
      ])
    ).toEqual({
      data: {
        workItems: [],
      },
      replace: [
        {
          kind: "missing-work-item-detail",
          itemId: "item_1",
        },
      ],
    })
  })

  it("narrows missing project detail results to the requested project", () => {
    expect(
      createMissingScopedReadModelResult([
        {
          kind: "project-detail",
          projectId: "project_1",
        },
      ])
    ).toEqual({
      data: {
        projects: [],
      },
      replace: [
        {
          kind: "missing-project-detail",
          projectId: "project_1",
        },
      ],
    })
  })
})
