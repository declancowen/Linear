import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"

import { workspaceBrandingSchema } from "@/lib/domain/types"
import {
  setWorkspaceWorkosOrganizationServer,
  updateWorkspaceBrandingServer,
} from "@/lib/server/convex"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { ensureWorkspaceOrganization } from "@/lib/server/workos"

export async function PATCH(request: NextRequest) {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = workspaceBrandingSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid workspace details payload" },
      { status: 400 }
    )
  }

  try {
    const { authContext } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )

    if (!authContext?.currentWorkspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    if (!authContext.isWorkspaceAdmin) {
      return NextResponse.json(
        { error: "Only workspace admins can update workspace details" },
        { status: 403 }
      )
    }

    await updateWorkspaceBrandingServer({
      currentUserId: authContext.currentUser.id,
      workspaceId: authContext.currentWorkspace.id,
      ...parsed.data,
    })

    const organization = await ensureWorkspaceOrganization({
      workspaceId: authContext.currentWorkspace.id,
      slug: authContext.currentWorkspace.slug,
      name: parsed.data.name,
      existingOrganizationId: authContext.currentWorkspace.workosOrganizationId,
    })

    await setWorkspaceWorkosOrganizationServer({
      workspaceId: authContext.currentWorkspace.id,
      workosOrganizationId: organization.id,
    })

    return NextResponse.json({
      ok: true,
      workspace: {
        ...authContext.currentWorkspace,
        name: parsed.data.name,
        logoUrl: parsed.data.logoUrl,
        settings: {
          accent: parsed.data.accent,
          description: parsed.data.description,
        },
        workosOrganizationId: organization.id,
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update workspace",
      },
      { status: 500 }
    )
  }
}
