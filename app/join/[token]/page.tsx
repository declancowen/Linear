import { redirect } from "next/navigation"

import { buildAppDestination } from "@/lib/auth-routing"

export default async function JoinInvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  redirect(buildAppDestination(`/onboarding?invite=${encodeURIComponent(token)}`))
}
