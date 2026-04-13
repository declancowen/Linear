import { NextRequest, NextResponse } from "next/server"

import { joinCodeSchema } from "@/lib/domain/types"
import { lookupTeamByJoinCodeServer } from "@/lib/server/convex"

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code") ?? ""
  const parsed = joinCodeSchema.safeParse({ code })

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid join code" }, { status: 400 })
  }

  try {
    const result = await lookupTeamByJoinCodeServer(parsed.data.code)

    if (!result) {
      return NextResponse.json(
        { error: `No team matched ${parsed.data.code}.` },
        { status: 404 }
      )
    }

    return NextResponse.json({
      team: {
        id: result.team.id,
        joinCode: result.team.joinCode,
        name: result.team.name,
        summary: result.team.summary,
      },
      workspace: {
        logoUrl: result.workspace.logoUrl,
        name: result.workspace.name,
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to look up team",
      },
      { status: 500 }
    )
  }
}
