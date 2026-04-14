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

export function AuthEmailVerificationScreen({
  mode,
  nextPath,
  email,
  error,
  notice,
}: AuthEmailVerificationScreenProps) {
  const loginHref = `/login?${new URLSearchParams({
    next: nextPath,
    ...(email ? { email } : {}),
  }).toString()}`
  const signupHref = `/signup?${new URLSearchParams({
    next: nextPath,
    ...(email ? { email } : {}),
  }).toString()}`

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <AuthLogo />

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">
              {mode === "signup"
                ? "Verify your email"
                : "Finish signing in"}
            </CardTitle>
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

                {notice ? (
                  <FieldDescription className="text-center">
                    {notice}
                  </FieldDescription>
                ) : null}

                {error ? (
                  <FieldError className="text-center">{error}</FieldError>
                ) : null}

                <Button type="submit">Continue</Button>

                <FieldDescription className="text-center">
                  Need a different account?{" "}
                  <Link href={mode === "signup" ? signupHref : loginHref}>
                    {mode === "signup" ? "Start again" : "Back to sign in"}
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
