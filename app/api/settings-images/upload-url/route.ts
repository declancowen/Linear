import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"

import { settingsImageUploadSchema } from "@/lib/domain/types"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { generateSettingsImageUploadUrlServer } from "@/lib/server/convex"

export async function POST(request: NextRequest) {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = settingsImageUploadSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid image upload request" },
      { status: 400 }
    )
  }

  try {
    const { ensuredUser, authContext } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )

    if (
      parsed.data.kind === "workspace-logo" &&
      !authContext?.currentWorkspace
    ) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      )
    }

    if (
      parsed.data.kind === "workspace-logo" &&
      !authContext?.isWorkspaceAdmin
    ) {
      return NextResponse.json(
        { error: "Only workspace admins can update workspace settings" },
        { status: 403 }
      )
    }

    const result = await generateSettingsImageUploadUrlServer({
      currentUserId: ensuredUser.userId,
      kind: parsed.data.kind,
      workspaceId: authContext?.currentWorkspace?.id,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to prepare image upload",
      },
      { status: 500 }
    )
  }
}
