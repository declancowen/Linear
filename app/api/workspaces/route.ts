import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"

import { workspaceSetupSchema } from "@/lib/domain/types"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { createWorkspaceServer } from "@/lib/server/convex"

function getWorkspaceLogo(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2) || "RR"
  )
}

export async function POST(request: NextRequest) {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = workspaceSetupSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid workspace payload" },
      { status: 400 }
    )
  }

  try {
    const { ensuredUser, authContext } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )

    if (authContext?.currentWorkspace) {
      return NextResponse.json(
        { error: "You already have an active workspace" },
        { status: 400 }
      )
    }

    if (authContext?.pendingWorkspace) {
      return NextResponse.json(
        { error: "Finish creating your first team in the pending workspace" },
        { status: 400 }
      )
    }

    const name = parsed.data.name.trim()
    const result = await createWorkspaceServer({
      currentUserId: ensuredUser.userId,
      name,
      logoUrl: getWorkspaceLogo(name),
      accent: "emerald",
      description:
        parsed.data.description?.trim() || `${name} workspace`,
    })

    return NextResponse.json({
      ok: true,
      workspaceId: result.workspaceId,
      workspaceSlug: result.workspaceSlug,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create workspace",
      },
      { status: 500 }
    )
  }
}
