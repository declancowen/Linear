import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"

import { profileSchema } from "@/lib/domain/types"
import { updateCurrentUserProfileServer } from "@/lib/server/convex"
import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { syncUserProfileToWorkOS } from "@/lib/server/workos"

export async function PATCH(request: NextRequest) {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = profileSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid profile payload" },
      { status: 400 }
    )
  }

  try {
    const { authenticatedUser, ensuredUser } =
      await ensureAuthenticatedAppContext(session.user, session.organizationId)

    await updateCurrentUserProfileServer({
      currentUserId: ensuredUser.userId,
      userId: ensuredUser.userId,
      ...parsed.data,
    })
    await syncUserProfileToWorkOS({
      workosUserId: authenticatedUser.workosUserId,
      name: parsed.data.name,
    })

    return NextResponse.json({
      ok: true,
      userId: ensuredUser.userId,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update profile",
      },
      { status: 500 }
    )
  }
}
