import { redirect } from "next/navigation"

export default async function JoinInvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  redirect(`/onboarding?invite=${encodeURIComponent(token)}`)
}
