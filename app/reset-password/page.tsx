import Link from "next/link"

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
  normalizeAuthNextPath,
} from "@/lib/auth-routing"

type ResetPasswordPageProps = {
  searchParams: Promise<{
    token?: string
    app?: string
    next?: string
    error?: string
    notice?: string
  }>
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const params = await searchParams
  const nextPath = normalizeAuthNextPath(params.next)

  const token = params.token ?? ""

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <AuthLogo />

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Choose a new password</CardTitle>
            <CardDescription>
              Set a new password for your account and then sign back in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action="/auth/reset-password" method="post">
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="next" value={nextPath} />
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="password">New password</FieldLabel>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Create a new password"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="Repeat your new password"
                    required
                  />
                </Field>
                {!token ? (
                  <FieldError className="text-center">
                    That password reset link is missing its token.
                  </FieldError>
                ) : null}
                {params.notice ? (
                  <FieldDescription className="text-center">
                    {params.notice}
                  </FieldDescription>
                ) : null}
                {params.error ? (
                  <FieldError className="text-center">{params.error}</FieldError>
                ) : null}
                <Button type="submit" disabled={!token}>
                  Save new password
                </Button>
                <FieldDescription className="text-center">
                  <Link
                    href={`/login?${new URLSearchParams({
                      next: nextPath,
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
