import { redirect } from "next/navigation"

import { buildAppDestination } from "@/lib/portal"

export default async function JoinInvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  redirect(buildAppDestination("projects", `/onboarding?invite=${encodeURIComponent(token)}`))
}
