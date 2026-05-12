import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  buildTeamProjectViews,
  buildTeamWorkViews,
  buildWorkspaceProjectViews,
} from "@/lib/domain/default-views"
import { createDefaultTeamFeatureSettings } from "@/lib/domain/types"

const getTeamDocMock = vi.fn()
const getUserAppStateMock = vi.fn()
const getViewDocMock = vi.fn()
const getWorkItemDocMock = vi.fn()
const listLabelsByWorkspaceMock = vi.fn()
const listViewsByScopeEntityMock = vi.fn()
const requireEditableTeamAccessMock = vi.fn()
const requireEditableWorkspaceAccessMock = vi.fn()

vi.mock("@/convex/app/core", () => ({
  getNow: () => "2026-04-20T22:20:00.000Z",
}))

vi.mock("@/convex/app/data", () => ({
  getTeamDoc: getTeamDocMock,
  getUserAppState: getUserAppStateMock,
  getViewDoc: getViewDocMock,
  getWorkItemDoc: getWorkItemDocMock,
  listLabelsByWorkspace: listLabelsByWorkspaceMock,
  listViewsByScopeEntity: listViewsByScopeEntityMock,
}))

vi.mock("@/convex/app/access", () => ({
  requireEditableTeamAccess: requireEditableTeamAccessMock,
  requireEditableWorkspaceAccess: requireEditableWorkspaceAccessMock,
}))

vi.mock("@/convex/app/normalization", () => ({
  normalizeTeam: (team: unknown) => team,
}))

function createCtx() {
  return {
    db: {
      insert: vi.fn(),
      patch: vi.fn(),
    },
  }
}

function createTeam(features = createDefaultTeamFeatureSettings("software-development")) {
  return {
    _id: "team_doc_1" as never,
    _creationTime: 0,
    id: "team_1",
    workspaceId: "workspace_1",
    slug: "platform",
    name: "Platform",
    icon: "robot",
    settings: {
      joinCode: "JOIN1234",
      summary: "Platform",
      guestProjectIds: [],
      guestDocumentIds: [],
      guestWorkItemIds: [],
      experience: "software-development" as const,
      features,
    },
  }
}

describe("work helpers", () => {
  beforeEach(() => {
    getTeamDocMock.mockReset()
    getUserAppStateMock.mockReset()
    getViewDocMock.mockReset()
    getWorkItemDocMock.mockReset()
    listLabelsByWorkspaceMock.mockReset()
    listViewsByScopeEntityMock.mockReset()
    requireEditableTeamAccessMock.mockReset()
    requireEditableWorkspaceAccessMock.mockReset()
  })

  it("skips team work views when the team is missing or disabled", async () => {
    const { ensureTeamWorkViews } = await import("@/convex/app/work_helpers")
    const ctx = createCtx()

    await expect(ensureTeamWorkViews(ctx as never, null)).resolves.toBe(0)
    await expect(
      ensureTeamWorkViews(
        ctx as never,
        createTeam({
          ...createDefaultTeamFeatureSettings("software-development"),
          issues: false,
        })
      )
    ).resolves.toBe(0)

    expect(listViewsByScopeEntityMock).not.toHaveBeenCalled()
    expect(ctx.db.insert).not.toHaveBeenCalled()
  })

  it("inserts and patches canonical team work views", async () => {
    const { ensureTeamWorkViews } = await import("@/convex/app/work_helpers")
    const ctx = createCtx()
    const team = createTeam()
    const canonicalViews = buildTeamWorkViews({
      teamId: "team_1",
      teamSlug: "platform",
      createdAt: "2026-04-20T22:20:00.000Z",
      updatedAt: "2026-04-20T22:20:00.000Z",
      experience: "software-development",
    })
    const stalePrimaryView = {
      ...canonicalViews[0],
      _id: "view_doc_1",
      name: "All issues",
      itemLevel: "story",
      showChildItems: false,
      filters: {
        ...canonicalViews[0].filters,
        priority: ["urgent"],
      },
    }

    listViewsByScopeEntityMock.mockResolvedValue([stalePrimaryView])

    await expect(ensureTeamWorkViews(ctx as never, team)).resolves.toBe(
      canonicalViews.length
    )

    expect(ctx.db.patch).toHaveBeenCalledWith(
      "view_doc_1",
      expect.objectContaining({
        name: canonicalViews[0].name,
        itemLevel: canonicalViews[0].itemLevel,
        showChildItems: canonicalViews[0].showChildItems,
        filters: canonicalViews[0].filters,
      })
    )
    expect(ctx.db.insert).toHaveBeenCalledTimes(canonicalViews.length - 1)
  })

  it("patches existing team and workspace project views", async () => {
    const {
      ensureTeamProjectViews,
      ensureWorkspaceProjectViews,
    } = await import("@/convex/app/work_helpers")
    const ctx = createCtx()
    const team = createTeam()
    const teamProjectViews = buildTeamProjectViews({
      teamId: "team_1",
      teamSlug: "platform",
      createdAt: "2026-04-20T22:20:00.000Z",
      updatedAt: "2026-04-20T22:20:00.000Z",
    })
    const workspaceProjectViews = buildWorkspaceProjectViews({
      workspaceId: "workspace_1",
      createdAt: "2026-04-20T22:20:00.000Z",
      updatedAt: "2026-04-20T22:20:00.000Z",
    })

    listViewsByScopeEntityMock
      .mockResolvedValueOnce([
        {
          ...teamProjectViews[0],
          _id: "team_project_view_doc_1",
          description: "Stale",
        },
      ])
      .mockResolvedValueOnce([
        {
          ...workspaceProjectViews[0],
          _id: "workspace_project_view_doc_1",
          description: "Stale",
        },
      ])

    await expect(ensureTeamProjectViews(ctx as never, team)).resolves.toBe(
      teamProjectViews.length
    )
    await expect(
      ensureWorkspaceProjectViews(ctx as never, "workspace_1")
    ).resolves.toBe(workspaceProjectViews.length)

    expect(ctx.db.patch).toHaveBeenCalledWith(
      "team_project_view_doc_1",
      expect.objectContaining({
        description: teamProjectViews[0].description,
      })
    )
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "workspace_project_view_doc_1",
      expect.objectContaining({
        description: workspaceProjectViews[0].description,
      })
    )
  })

  it("collects a work item cascade without revisiting already queued children", async () => {
    const { collectWorkItemCascadeIds } = await import(
      "@/convex/app/work_helpers"
    )

    expect(
      [...collectWorkItemCascadeIds(
        [
          { id: "root", parentId: null },
          { id: "child_1", parentId: "root" },
          { id: "child_2", parentId: "root" },
          { id: "grandchild", parentId: "child_1" },
          { id: "unrelated", parentId: null },
          { id: "root", parentId: "grandchild" },
        ],
        "root"
      )].sort()
    ).toEqual(["child_1", "child_2", "grandchild", "root"])
  })

  it("routes view mutation access through the owning scope", async () => {
    const { requireViewMutationAccess } = await import("@/convex/app/work_helpers")
    const ctx = createCtx()

    getViewDocMock.mockResolvedValueOnce(null)
    await expect(
      requireViewMutationAccess(ctx as never, "missing_view", "user_1")
    ).rejects.toThrow("View not found")

    getViewDocMock.mockResolvedValueOnce({
      id: "personal_view",
      scopeType: "personal",
      scopeId: "user_2",
    })
    await expect(
      requireViewMutationAccess(ctx as never, "personal_view", "user_1")
    ).rejects.toThrow("You do not have access to this view")

    const ownedPersonalView = {
      id: "personal_view",
      scopeType: "personal",
      scopeId: "user_1",
    }
    getViewDocMock.mockResolvedValueOnce(ownedPersonalView)
    await expect(
      requireViewMutationAccess(ctx as never, "personal_view", "user_1")
    ).resolves.toBe(ownedPersonalView)

    const teamView = {
      id: "team_view",
      scopeType: "team",
      scopeId: "team_1",
    }
    getViewDocMock.mockResolvedValueOnce(teamView)
    await expect(
      requireViewMutationAccess(ctx as never, "team_view", "user_1")
    ).resolves.toBe(teamView)
    expect(requireEditableTeamAccessMock).toHaveBeenCalledWith(
      ctx,
      "team_1",
      "user_1"
    )

    const workspaceView = {
      id: "workspace_view",
      scopeType: "workspace",
      scopeId: "workspace_1",
    }
    getViewDocMock.mockResolvedValueOnce(workspaceView)
    await expect(
      requireViewMutationAccess(ctx as never, "workspace_view", "user_1")
    ).resolves.toBe(workspaceView)
    expect(requireEditableWorkspaceAccessMock).toHaveBeenCalledWith(
      ctx,
      "workspace_1",
      "user_1"
    )
  })
})
