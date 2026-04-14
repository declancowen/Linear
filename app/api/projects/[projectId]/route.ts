import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { updateProjectServer } from "@/lib/server/convex"

const projectPatchSchema = z
  .object({
    status: z.enum(["planning", "active", "paused", "completed"]).optional(),
    priority: z.enum(["none", "low", "medium", "high", "urgent"]).optional(),
  })
  .refine(
    (value) => Object.values(value).some((entry) => entry !== undefined),
    {
      message: "At least one project field is required",
    }
  )

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { projectId } = await params
  const body = await request.json()
  const parsed = projectPatchSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid project update payload" },
      { status: 400 }
    )
  }

  try {
    const { ensuredUser } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )

    await updateProjectServer({
      currentUserId: ensuredUser.userId,
      projectId,
      patch: parsed.data,
    })

    return NextResponse.json({
      ok: true,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update project",
      },
      { status: 500 }
    )
  }
}
