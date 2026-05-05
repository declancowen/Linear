import { afterEach, describe, expect, it, vi } from "vitest"

import {
  fetchSnapshotState,
  RouteMutationError,
  runRouteMutation,
  syncCreateAttachment,
  syncCreateLabel,
  syncCreateTeam,
  syncDeleteCurrentAccount,
  syncDeleteTeam,
  syncGenerateAttachmentUploadUrl,
  syncJoinTeamByCode,
  syncLeaveTeam,
  syncLeaveWorkspace,
  syncRegenerateTeamJoinCode,
  syncStartConversationCall,
  syncUpdateWorkspaceBranding,
} from "@/lib/convex/client"

import {
  attachmentUploadUrlResultFixture,
  createAttachmentResultFixture,
  createLabelResultFixture,
  createTeamResultFixture,
  deleteCurrentAccountResultFixture,
  deleteTeamResultFixture,
  joinTeamByCodeResultFixture,
  leaveTeamResultFixture,
  leaveWorkspaceResultFixture,
  regenerateTeamJoinCodeResultFixture,
  snapshotFixture,
  startConversationCallLegacyFixture,
  startConversationCallStructuredFixture,
} from "./route-contract-fixtures"

describe("route client compatibility contracts", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("accepts both wrapped and legacy snapshot payloads", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            snapshot: snapshotFixture,
            version: 7,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(snapshotFixture), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        })
      )

    await expect(fetchSnapshotState()).resolves.toEqual({
      snapshot: snapshotFixture,
      version: 7,
    })
    await expect(fetchSnapshotState()).resolves.toEqual({
      snapshot: snapshotFixture,
      version: 0,
    })
  })

  it("rejects invalid snapshot payloads", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      })
    )

    await expect(fetchSnapshotState()).rejects.toMatchObject({
      message: "Invalid snapshot payload",
      status: 500,
    })
  })

  it("supports both current and future start-call payload shapes", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(startConversationCallLegacyFixture), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(startConversationCallStructuredFixture), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        })
      )

    await expect(syncStartConversationCall("conversation_1")).resolves.toEqual(
      startConversationCallLegacyFixture
    )
    await expect(syncStartConversationCall("conversation_1")).resolves.toEqual(
      startConversationCallStructuredFixture
    )
  })

  it("rejects invalid lifecycle payloads for compatibility-sensitive routes", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(deleteCurrentAccountResultFixture), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(leaveWorkspaceResultFixture), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ workspaceId: "workspace_1" }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        })
      )

    await expect(syncDeleteCurrentAccount()).resolves.toEqual(
      deleteCurrentAccountResultFixture
    )
    await expect(syncDeleteCurrentAccount()).rejects.toMatchObject({
      message: "Invalid delete-account payload",
      status: 500,
    })

    await expect(syncLeaveWorkspace()).resolves.toEqual(
      leaveWorkspaceResultFixture
    )
    await expect(syncLeaveWorkspace()).rejects.toMatchObject({
      message: "Invalid leave-workspace payload",
      status: 500,
    })
  })

  it("validates work, docs, and team route payloads that the store depends on", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(createLabelResultFixture), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(attachmentUploadUrlResultFixture), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(createAttachmentResultFixture), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(createTeamResultFixture), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(joinTeamByCodeResultFixture), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(deleteTeamResultFixture), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(leaveTeamResultFixture), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(regenerateTeamJoinCodeResultFixture), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        })
      )

    await expect(syncCreateLabel({ name: "Bug" })).resolves.toEqual(
      createLabelResultFixture
    )
    await expect(
      syncGenerateAttachmentUploadUrl("document", "document_1")
    ).resolves.toEqual(attachmentUploadUrlResultFixture)
    await expect(
      syncCreateAttachment({
        targetType: "document",
        targetId: "document_1",
        storageId: "storage_1",
        fileName: "plan.png",
        contentType: "image/png",
        size: 1024,
      })
    ).resolves.toEqual(createAttachmentResultFixture)
    await expect(
      syncCreateTeam({
        name: "Platform",
        icon: "spark",
        summary: "Platform team",
        experience: "software-development",
        features: createTeamResultFixture.features,
      })
    ).resolves.toEqual(createTeamResultFixture)
    await expect(syncJoinTeamByCode("user_1", "ABC123DEF456")).resolves.toEqual(
      joinTeamByCodeResultFixture
    )
    await expect(syncDeleteTeam("team_1")).resolves.toEqual(
      deleteTeamResultFixture
    )
    await expect(syncLeaveTeam("team_1")).resolves.toEqual(
      leaveTeamResultFixture
    )
    await expect(syncRegenerateTeamJoinCode("team_1")).resolves.toEqual(
      regenerateTeamJoinCodeResultFixture
    )
  })

  it("rejects invalid work and membership payloads before they reach the store", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ uploadUrl: 123 }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ attachmentId: "attachment_1" }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ teamId: "team_1" }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ workspaceId: 123 }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ teamId: "team_1", deletedUserIds: [] }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ workspaceId: "workspace_1" }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        })
      )

    await expect(syncCreateLabel({ name: "Bug" })).rejects.toMatchObject({
      message: "Invalid create-label payload",
      status: 500,
    })
    await expect(
      syncGenerateAttachmentUploadUrl("document", "document_1")
    ).rejects.toMatchObject({
      message: "Invalid attachment-upload-url payload",
      status: 500,
    })
    await expect(
      syncCreateAttachment({
        targetType: "document",
        targetId: "document_1",
        storageId: "storage_1",
        fileName: "plan.png",
        contentType: "image/png",
        size: 1024,
      })
    ).rejects.toMatchObject({
      message: "Invalid create-attachment payload",
      status: 500,
    })
    await expect(
      syncCreateTeam({
        name: "Platform",
        icon: "spark",
        summary: "Platform team",
        experience: "software-development",
        features: createTeamResultFixture.features,
      })
    ).rejects.toMatchObject({
      message: "Invalid create-team payload",
      status: 500,
    })
    await expect(syncJoinTeamByCode("user_1", "ABC123DEF456")).rejects.toMatchObject({
      message: "Invalid join-team payload",
      status: 500,
    })
    await expect(syncDeleteTeam("team_1")).rejects.toMatchObject({
      message: "Invalid delete-team payload",
      status: 500,
    })
    await expect(syncLeaveTeam("team_1")).rejects.toMatchObject({
      message: "Invalid leave-team payload",
      status: 500,
    })
    await expect(syncRegenerateTeamJoinCode("team_1")).rejects.toMatchObject({
      message: "Invalid regenerate-team-join-code payload",
      status: 500,
    })
  })

  it("parses future typed error envelopes without breaking current callers", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "team_admin_required",
          message: "Only team admins can perform this action",
          retryable: false,
          details: {
            teamId: "team_1",
          },
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
    )

    await expect(
      runRouteMutation("/api/test", {
        method: "POST",
      })
    ).rejects.toMatchObject({
      message: "Only team admins can perform this action",
      status: 403,
      code: "team_admin_required",
      retryable: false,
      details: {
        teamId: "team_1",
      },
    } satisfies Partial<RouteMutationError>)
  })

  it("sends workspace branding updates with optional logo image actions", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      })
    )

    await syncUpdateWorkspaceBranding(
      "workspace_1",
      "Recipe Room",
      "https://cdn.example.com/logo.png",
      "emerald",
      "Shared work",
      {
        logoImageStorageId: "storage_1",
        clearLogoImage: true,
      }
    )

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/workspace/current",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          name: "Recipe Room",
          logoUrl: "https://cdn.example.com/logo.png",
          logoImageStorageId: "storage_1",
          clearLogoImage: true,
          accent: "emerald",
          description: "Shared work",
        }),
      })
    )
  })
})
