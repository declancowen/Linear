import { describe, expect, it } from "vitest"

import {
  getUniqueLabelWorkspaceId,
  inferLabelWorkspaceIds,
} from "@/convex/app/label_workspace"

describe("label workspace inference", () => {
  it("infers a unique workspace for labels used across scoped entities", () => {
    const inferred = inferLabelWorkspaceIds({
      teams: [
        {
          id: "team_1",
          workspaceId: "workspace_1",
        },
      ],
      workItems: [
        {
          teamId: "team_1",
          labelIds: ["label_1"],
        },
      ],
      views: [
        {
          scopeType: "workspace",
          scopeId: "workspace_1",
          filters: {
            labelIds: ["label_1"],
            teamIds: [],
          },
        },
      ],
      projects: [
        {
          scopeType: "team",
          scopeId: "team_1",
          presentation: {
            filters: {
              labelIds: ["label_1"],
            },
          },
        },
      ],
    })

    expect(getUniqueLabelWorkspaceId(inferred.get("label_1"))).toBe(
      "workspace_1"
    )
  })

  it("marks labels referenced from multiple workspaces as non-unique", () => {
    const inferred = inferLabelWorkspaceIds({
      teams: [
        {
          id: "team_1",
          workspaceId: "workspace_1",
        },
        {
          id: "team_2",
          workspaceId: "workspace_2",
        },
      ],
      workItems: [
        {
          teamId: "team_1",
          labelIds: ["label_1"],
        },
        {
          teamId: "team_2",
          labelIds: ["label_1"],
        },
      ],
      views: [],
      projects: [],
    })

    expect(getUniqueLabelWorkspaceId(inferred.get("label_1"))).toBeNull()
  })
})
