import Link from "next/link"

import {
  CardsThree,
  GoogleLogo,
} from "@phosphor-icons/react/dist/ssr"

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
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type AuthEntryScreenProps = {
  mode: "login" | "signup"
  nextPath: string
  error?: string
  notice?: string
  initialEmail?: string
  initialFirstName?: string
  initialLastName?: string
}

export function AuthEntryScreen({
  mode,
  nextPath,
  error,
  notice,
  initialEmail,
  initialFirstName,
  initialLastName,
}: AuthEntryScreenProps) {
  const isLogin = mode === "login"
  const googleHref = `/auth/google?${new URLSearchParams({
    next: nextPath,
    mode,
  }).toString()}`
  const alternateMode = isLogin ? "signup" : "login"
  const alternateHref = `/${alternateMode}?${new URLSearchParams({
    next: nextPath,
  }).toString()}`

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex items-center gap-2 self-center font-medium">
          <div className="flex size-8 items-center justify-center rounded-md bg-black text-white">
            <CardsThree weight="fill" size={20} />
          </div>
          Recipe Room
        </Link>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">
              {isLogin ? "Welcome back" : "Create your account"}
            </CardTitle>
            <CardDescription>
              {isLogin
                ? "Sign in to continue to Recipe Room."
                : "Sign up to continue to Recipe Room."}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form
              action={isLogin ? "/auth/login" : "/auth/signup"}
              method="post"
            >
              <input type="hidden" name="next" value={nextPath} />

              <FieldGroup>
                {!isLogin ? (
                  <>
                    <Field>
                      <FieldLabel htmlFor="firstName">First name</FieldLabel>
                      <Input
                        id="firstName"
                        name="firstName"
                        defaultValue={initialFirstName ?? ""}
                        placeholder="Declan"
                        required
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="lastName">Surname</FieldLabel>
                      <Input
                        id="lastName"
                        name="lastName"
                        defaultValue={initialLastName ?? ""}
                        placeholder="Cowen"
                        required
                      />
                    </Field>
                  </>
                ) : null}

                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={initialEmail ?? ""}
                    placeholder="you@company.com"
                    required
                  />
                </Field>

                <Field>
                  <div className="flex items-center justify-between gap-3">
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    {isLogin ? (
                      <Link
                        href={`/forgot-password?${new URLSearchParams({
                          next: nextPath,
                          ...(initialEmail ? { email: initialEmail } : {}),
                        }).toString()}`}
                        className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Forgot password?
                      </Link>
                    ) : null}
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder={
                      isLogin ? "Enter your password" : "Create a password"
                    }
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

                <Button type="submit">
                  {isLogin ? "Sign in" : "Create account"}
                </Button>

                <FieldSeparator>Or continue with</FieldSeparator>

                <Button asChild variant="outline" type="button">
                  <a href={googleHref}>
                    <GoogleLogo data-icon="inline-start" />
                    Continue with Google
                  </a>
                </Button>

                <FieldDescription className="text-center">
                  {isLogin
                    ? "Don’t have an account?"
                    : "Already have an account?"}{" "}
                  <Link href={alternateHref}>
                    {isLogin ? "Sign up" : "Sign in"}
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
