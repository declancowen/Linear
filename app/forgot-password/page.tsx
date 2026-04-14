import Link from "next/link"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

import { AuthLogo } from "@/components/app/auth-logo"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  buildSessionResolvePath,
  normalizeAuthNextPath,
} from "@/lib/auth-routing"

type ForgotPasswordPageProps = {
  searchParams: Promise<{
    app?: string
    next?: string
    email?: string
    error?: string
    notice?: string
  }>
}

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const params = await searchParams
  const nextPath = normalizeAuthNextPath(params.next)

  const auth = await withAuth()

  if (auth.user) {
    redirect(
      buildSessionResolvePath({
        mode: "login",
        nextPath,
      })
    )
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <AuthLogo />

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Reset your password</CardTitle>
            <CardDescription>
              Enter the email for your Recipe Room account and we&apos;ll
              send a reset link through WorkOS.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action="/auth/forgot-password" method="post">
              <input type="hidden" name="next" value={nextPath} />
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={params.email ?? ""}
                    placeholder="you@company.com"
                    required
                  />
                </Field>
                {params.notice ? (
                  <FieldDescription className="text-center">
                    {params.notice}
                  </FieldDescription>
                ) : null}
                {params.error ? (
                  <FieldError className="text-center">{params.error}</FieldError>
                ) : null}
                <Button type="submit">Send reset link</Button>
                <FieldDescription className="text-center">
                  <Link
                    href={`/login?${new URLSearchParams({
                      next: nextPath,
                      ...(params.email ? { email: params.email } : {}),
                    }).toString()}`}
                  >
                    Back to sign in
                  </Link>
                </FieldDescription>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
