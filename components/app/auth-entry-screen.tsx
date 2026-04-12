import Link from "next/link"

import {
  Aperture,
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
import { type PortalAppId, portalApps } from "@/lib/portal"

type AuthEntryScreenProps = {
  mode: "login" | "signup"
  appId?: PortalAppId | null
  nextPath: string
  error?: string
  notice?: string
  initialEmail?: string
  initialFirstName?: string
  initialLastName?: string
}

export function AuthEntryScreen({
  mode,
  appId,
  nextPath,
  error,
  notice,
  initialEmail,
  initialFirstName,
  initialLastName,
}: AuthEntryScreenProps) {
  const destinationLabel = appId ? portalApps[appId].name : "Portal"
  const isLogin = mode === "login"
  const googleHref = `/auth/google?${new URLSearchParams({
    ...(appId ? { app: appId } : {}),
    next: nextPath,
    mode,
  }).toString()}`
  const alternateMode = isLogin ? "signup" : "login"
  const alternateHref = `/${alternateMode}?${new URLSearchParams({
    ...(appId ? { app: appId } : {}),
    next: nextPath,
  }).toString()}`

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex items-center gap-2 self-center font-medium">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Aperture />
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
                ? `Sign in to continue to ${destinationLabel}.`
                : `Sign up to continue to ${destinationLabel}.`}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form
              action={isLogin ? "/auth/login" : "/auth/signup"}
              method="post"
            >
              <input type="hidden" name="next" value={nextPath} />
              {appId ? <input type="hidden" name="app" value={appId} /> : null}

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
                  <FieldLabel htmlFor="password">Password</FieldLabel>
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
