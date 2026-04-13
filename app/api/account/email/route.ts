import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import {
  mapWorkOSAccountError,
  updateWorkOSUserEmail,
} from "@/lib/server/workos"

const emailChangeSchema = z.object({
  email: z.string().trim().email(),
})

export async function POST(request: NextRequest) {
  const session = await withAuth()

  if (!session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = emailChangeSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 })
  }

  if (parsed.data.email.toLowerCase() === session.user.email.toLowerCase()) {
    return NextResponse.json(
      { error: "Enter a different email address" },
      { status: 400 }
    )
  }

  try {
    const { authenticatedUser } = await ensureAuthenticatedAppContext(
      session.user,
      session.organizationId
    )

    await updateWorkOSUserEmail({
      workosUserId: authenticatedUser.workosUserId,
      email: parsed.data.email,
    })

    return NextResponse.json({
      ok: true,
      logoutRequired: true,
      notice:
        "Email updated. Verify the new address from WorkOS and then sign back in.",
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error: mapWorkOSAccountError(
          error,
          "Failed to update your email address."
        ),
      },
      { status: 500 }
    )
  }
}
