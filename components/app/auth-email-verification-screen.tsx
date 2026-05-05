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

type AuthEmailVerificationScreenProps = {
  mode: "login" | "signup"
  nextPath: string
  email: string
  error?: string
  notice?: string
}

type AuthEmailVerificationMode = AuthEmailVerificationScreenProps["mode"]

const AUTH_EMAIL_VERIFICATION_COPY: Record<
  AuthEmailVerificationMode,
  {
    actionLabel: string
    title: string
  }
> = {
  login: {
    actionLabel: "Back to sign in",
    title: "Finish signing in",
  },
  signup: {
    actionLabel: "Start again",
    title: "Verify your email",
  },
}

function getAuthEmailVerificationCopy(mode: AuthEmailVerificationMode) {
  return AUTH_EMAIL_VERIFICATION_COPY[mode]
}

function getAuthEmailVerificationReturnHref(input: {
  email: string
  mode: AuthEmailVerificationMode
  nextPath: string
}) {
  const targetPath = input.mode === "signup" ? "/signup" : "/login"
  const searchParams = new URLSearchParams({
    next: input.nextPath,
    ...(input.email ? { email: input.email } : {}),
  })

  return `${targetPath}?${searchParams.toString()}`
}

function AuthEmailVerificationFeedback({
  error,
  notice,
}: {
  error?: string
  notice?: string
}) {
  return (
    <>
      {notice ? (
        <FieldDescription className="text-center">{notice}</FieldDescription>
      ) : null}

      {error ? <FieldError className="text-center">{error}</FieldError> : null}
    </>
  )
}

export function AuthEmailVerificationScreen({
  mode,
  nextPath,
  email,
  error,
  notice,
}: AuthEmailVerificationScreenProps) {
  const copy = getAuthEmailVerificationCopy(mode)
  const returnHref = getAuthEmailVerificationReturnHref({
    email,
    mode,
    nextPath,
  })

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <AuthLogo />

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{copy.title}</CardTitle>
            <CardDescription>
              Enter the code WorkOS sent to {email || "your email address"}.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form action="/auth/verify-email" method="post">
              <input type="hidden" name="email" value={email} />
              <input type="hidden" name="mode" value={mode} />
              <input type="hidden" name="next" value={nextPath} />

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="code">Verification code</FieldLabel>
                  <Input
                    id="code"
                    name="code"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={12}
                    placeholder="Enter the code"
                    required
                  />
                </Field>

                <AuthEmailVerificationFeedback error={error} notice={notice} />

                <Button type="submit">Continue</Button>

                <FieldDescription className="text-center">
                  Need a different account?{" "}
                  <Link href={returnHref}>{copy.actionLabel}</Link>
                </FieldDescription>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
