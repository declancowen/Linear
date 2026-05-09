import { AuthEntryScreen } from "@/components/app/auth-entry-screen"
import { getSignedOutAuthPageContext } from "@/lib/server/auth-pages"

type LoginPageProps = {
  searchParams: Promise<{
    app?: string
    next?: string
    error?: string
    notice?: string
    email?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const { nextPath } = await getSignedOutAuthPageContext({
    mode: "login",
    next: params.next,
  })

  return (
    <AuthEntryScreen
      mode="login"
      nextPath={nextPath}
      error={params.error}
      notice={params.notice}
      initialEmail={params.email}
    />
  )
}
