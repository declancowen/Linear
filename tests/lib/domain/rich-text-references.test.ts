import { describe, expect, it } from "vitest"

import {
  getDocumentRichTextReferenceRelationships,
  getRichTextReferenceCandidates,
  getWorkItemCommentRichTextReferenceRelationships,
  getWorkItemDescriptionRichTextReferenceRelationships,
} from "@/lib/domain/selectors"
import {
  createTestAppData,
  createTestDocument,
  createTestProject,
  createTestTeam,
  createTestTeamMembership,
  createTestViewDefinition,
  createTestWorkItem,
} from "@/tests/lib/fixtures/app-data"

function createReferenceCandidateData() {
  return createTestAppData({
    teams: [
      createTestTeam({
        id: "team_1",
        slug: "platform",
        name: "Platform",
      }),
      createTestTeam({
        id: "team_2",
        slug: "design",
        name: "Design",
      }),
    ],
    teamMemberships: [
      createTestTeamMembership({
        teamId: "team_1",
        userId: "user_1",
      }),
    ],
    documents: [
      createTestDocument({
        id: "doc_current",
        kind: "workspace-document",
        teamId: null,
        title: "Current workspace doc",
      }),
      createTestDocument({
        id: "doc_workspace",
        kind: "workspace-document",
        teamId: null,
        title: "Workspace brief",
      }),
      createTestDocument({
        id: "doc_team",
        kind: "team-document",
        teamId: "team_1",
        title: "Team brief",
      }),
      createTestDocument({
        id: "doc_private",
        kind: "private-document",
        teamId: null,
        title: "Private notes",
      }),
      createTestDocument({
        id: "doc_hidden_team",
        kind: "team-document",
        teamId: "team_2",
        title: "Hidden team notes",
      }),
      createTestDocument({
        id: "doc_item_description",
        kind: "item-description",
        teamId: "team_1",
        title: "Item description",
      }),
    ],
    workItems: [
      createTestWorkItem("item_current", {
        key: "PLA-1",
        title: "Current task",
        descriptionDocId: "doc_item_description",
      }),
      createTestWorkItem("item_visible", {
        key: "PLA-2",
        title: "Visible task",
      }),
      createTestWorkItem("item_hidden_team", {
        key: "DES-1",
        teamId: "team_2",
        title: "Hidden task",
      }),
      createTestWorkItem("item_private", {
        key: "PRI-1",
        teamId: null,
        workspaceId: "workspace_1",
        visibility: "private",
        title: "Private task",
      }),
    ],
    projects: [
      createTestProject({
        id: "project_workspace",
        scopeType: "workspace",
        scopeId: "workspace_1",
        name: "Workspace roadmap",
      }),
      createTestProject({
        id: "project_team",
        scopeType: "team",
        scopeId: "team_1",
        name: "Team roadmap",
      }),
      createTestProject({
        id: "project_hidden_team",
        scopeType: "team",
        scopeId: "team_2",
        name: "Hidden roadmap",
      }),
    ],
    views: [
      createTestViewDefinition({
        id: "view_workspace",
        name: "Workspace view",
        scopeType: "workspace",
        scopeId: "workspace_1",
        route: "/workspace/work",
      }),
      createTestViewDefinition({
        id: "view_team",
        name: "Team view",
        scopeType: "team",
        scopeId: "team_1",
        route: "/team/platform/work",
      }),
      createTestViewDefinition({
        id: "view_hidden_team",
        name: "Hidden team view",
        scopeType: "team",
        scopeId: "team_2",
        route: "/team/design/work",
      }),
    ],
  })
}

function getCandidateKeys(
  candidates: ReturnType<typeof getRichTextReferenceCandidates>
) {
  return candidates.map((candidate) => `${candidate.type}:${candidate.id}`)
}

function referenceAnchor(type: string, id: string) {
  return `<a data-type="entity-reference" data-reference-type="${type}" data-reference-id="${id}" href="#">${id}</a>`
}

describe("rich text reference selectors", () => {
  it("builds access-filtered document editor candidates across allowed entity types", () => {
    const data = createReferenceCandidateData()

    expect(
      getCandidateKeys(
        getRichTextReferenceCandidates(data, {
          type: "document",
          documentId: "doc_current",
        })
      )
    ).toEqual([
      "document:doc_team",
      "document:doc_workspace",
      "project:project_team",
      "project:project_workspace",
      "view:view_team",
      "view:view_workspace",
      "workItem:item_current",
      "workItem:item_visible",
    ])
  })

  it("scopes work item descriptions to accessible docs, work items, projects, and views", () => {
    const data = createReferenceCandidateData()

    expect(
      getCandidateKeys(
        getRichTextReferenceCandidates(data, {
          type: "workItemDescription",
          itemId: "item_current",
        })
      )
    ).toEqual([
      "document:doc_current",
      "document:doc_team",
      "document:doc_workspace",
      "project:project_team",
      "project:project_workspace",
      "view:view_team",
      "view:view_workspace",
      "workItem:item_visible",
    ])
  })

  it("scopes work item comments to accessible docs, work items, projects, and views", () => {
    const data = createReferenceCandidateData()

    expect(
      getCandidateKeys(
        getRichTextReferenceCandidates(data, {
          type: "workItemComment",
          itemId: "item_current",
        })
      )
    ).toEqual([
      "document:doc_current",
      "document:doc_team",
      "document:doc_workspace",
      "project:project_team",
      "project:project_workspace",
      "view:view_team",
      "view:view_workspace",
      "workItem:item_current",
      "workItem:item_visible",
    ])
  })

  it("does not offer shared references from private source artifacts", () => {
    const data = createReferenceCandidateData()

    expect(
      getRichTextReferenceCandidates(data, {
        type: "document",
        documentId: "doc_private",
      })
    ).toEqual([])
    expect(
      getRichTextReferenceCandidates(data, {
        type: "workItemDescription",
        itemId: "item_private",
      })
    ).toEqual([])
  })

  it("derives document relationship ids from allowed inline references only", () => {
    const data = createReferenceCandidateData()
    const document = data.documents.find((entry) => entry.id === "doc_current")!

    expect(
      getDocumentRichTextReferenceRelationships(
        data,
        document,
        [
          referenceAnchor("workItem", "item_visible"),
          referenceAnchor("workItem", "item_hidden_team"),
          referenceAnchor("document", "doc_workspace"),
          referenceAnchor("project", "project_team"),
          referenceAnchor("view", "view_workspace"),
        ].join("")
      )
    ).toEqual({
      documentIds: ["doc_workspace"],
      projectIds: ["project_team"],
      viewIds: ["view_workspace"],
      workItemIds: ["item_visible"],
    })
  })

  it("derives work item description links without private or self references", () => {
    const data = createReferenceCandidateData()
    const item = data.workItems.find((entry) => entry.id === "item_current")!

    expect(
      getWorkItemDescriptionRichTextReferenceRelationships(
        data,
        item,
        [
          referenceAnchor("workItem", "item_visible"),
          referenceAnchor("workItem", "item_current"),
          referenceAnchor("document", "doc_team"),
          referenceAnchor("document", "doc_private"),
          referenceAnchor("project", "project_workspace"),
          referenceAnchor("view", "view_team"),
        ].join("")
      )
    ).toEqual({
      documentIds: ["doc_team"],
      projectIds: ["project_workspace"],
      viewIds: ["view_team"],
      workItemIds: ["item_visible"],
    })
  })

  it("derives work item comment links across allowed reference types", () => {
    const data = createReferenceCandidateData()
    const item = data.workItems.find((entry) => entry.id === "item_current")!

    expect(
      getWorkItemCommentRichTextReferenceRelationships(
        data,
        item,
        [
          referenceAnchor("workItem", "item_current"),
          referenceAnchor("document", "doc_workspace"),
          referenceAnchor("project", "project_team"),
          referenceAnchor("view", "view_workspace"),
        ].join("")
      )
    ).toEqual({
      documentIds: ["doc_workspace"],
      projectIds: ["project_team"],
      viewIds: ["view_workspace"],
      workItemIds: ["item_current"],
    })
  })
})
