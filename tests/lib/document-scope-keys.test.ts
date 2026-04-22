import { describe, expect, it } from "vitest"

import { buildCollaborationDocumentScopeKeys } from "@/lib/scoped-sync/document-scope-keys"

describe("buildCollaborationDocumentScopeKeys", () => {
  it("uses work, project, and search scopes for item-description collaboration scopes", () => {
    expect(
      buildCollaborationDocumentScopeKeys({
        documentId: "doc_desc_1",
        kind: "item-description",
        itemId: "item_1",
        teamId: "team_1",
        searchWorkspaceId: "workspace_1",
        teamMemberIds: ["user_1", "user_2"],
        projectScopes: [
          {
            projectId: "project_1",
            scopeType: "team",
            scopeId: "team_1",
          },
          {
            projectId: "project_2",
            scopeType: "workspace",
            scopeId: "workspace_1",
          },
        ],
      })
    ).toEqual([
      "document-detail:doc_desc_1",
      "work-item-detail:item_1",
      "work-index:team_team_1",
      "work-index:personal_user_1",
      "work-index:personal_user_2",
      "project-detail:project_1",
      "project-index:team_team_1",
      "project-detail:project_2",
      "project-index:workspace_workspace_1",
      "search-seed:workspace_1",
    ])
  })

  it("uses prefixed team document-index keys for team documents", () => {
    expect(
      buildCollaborationDocumentScopeKeys({
        documentId: "doc_1",
        kind: "team-document",
        teamId: "team_1",
        workspaceId: "workspace_1",
      })
    ).toEqual([
      "document-detail:doc_1",
      "document-index:team_team_1",
      "search-seed:workspace_1",
    ])
  })

  it("uses prefixed workspace document-index keys for workspace documents", () => {
    expect(
      buildCollaborationDocumentScopeKeys({
        documentId: "doc_1",
        kind: "workspace-document",
        workspaceId: "workspace_1",
      })
    ).toEqual([
      "document-detail:doc_1",
      "document-index:workspace_workspace_1",
      "search-seed:workspace_1",
    ])
  })

  it("uses prefixed workspace document-index keys for private documents", () => {
    expect(
      buildCollaborationDocumentScopeKeys({
        documentId: "doc_1",
        kind: "private-document",
        workspaceId: "workspace_1",
      })
    ).toEqual([
      "document-detail:doc_1",
      "document-index:workspace_workspace_1",
      "search-seed:workspace_1",
    ])
  })

  it("keeps periodic collaboration invalidations on the detail scope only", () => {
    expect(
      buildCollaborationDocumentScopeKeys(
        {
          documentId: "doc_desc_1",
          kind: "item-description",
          itemId: "item_1",
          teamId: "team_1",
          searchWorkspaceId: "workspace_1",
          teamMemberIds: ["user_1"],
          projectScopes: [
            {
              projectId: "project_1",
              scopeType: "team",
              scopeId: "team_1",
            },
          ],
        },
        {
          includeCollectionScopes: false,
        }
      )
    ).toEqual([
      "document-detail:doc_desc_1",
      "work-item-detail:item_1",
    ])
  })
})
