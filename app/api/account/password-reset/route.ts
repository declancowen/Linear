import { withAuth } from "@workos-inc/authkit-nextjs"
import { NextResponse } from "next/server"

import { requestWorkOSPasswordReset } from "@/lib/server/workos"

export async function POST() {
  const session = await withAuth()

  if (!session.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await requestWorkOSPasswordReset(session.user.email)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to start password reset",
      },
      { status: 500 }
    )
  }
}
