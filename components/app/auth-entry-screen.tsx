import { GoogleLogo } from "@phosphor-icons/react/dist/ssr"
import type { FormEventHandler } from "react"

import { AuthLogo } from "@/components/app/auth-logo"
import { DesktopAwareAuthAnchor } from "@/components/app/desktop-aware-auth-anchor"
import { AppLink } from "@/lib/browser/app-navigation"
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
  formActionBaseUrl?: string | null
  formActionPath?: string | null
  onPasswordSubmit?: FormEventHandler<HTMLFormElement>
  notice?: string
  initialEmail?: string
  initialFirstName?: string
  initialLastName?: string
}

type AuthEntryMode = AuthEntryScreenProps["mode"]

const AUTH_MODE_COPY: Record<
  AuthEntryMode,
  {
    title: string
    description: string
    action: string
    passwordPlaceholder: string
    alternatePrompt: string
    alternateLabel: string
  }
> = {
  login: {
    title: "Welcome back",
    description: "Sign in to continue to Recipe Room.",
    action: "Sign in",
    passwordPlaceholder: "Enter your password",
    alternatePrompt: "Don’t have an account?",
    alternateLabel: "Sign up",
  },
  signup: {
    title: "Create your account",
    description: "Sign up to continue to Recipe Room.",
    action: "Create account",
    passwordPlaceholder: "Create a password",
    alternatePrompt: "Already have an account?",
    alternateLabel: "Sign in",
  },
}

function getAuthModeCopy(mode: AuthEntryMode) {
  return AUTH_MODE_COPY[mode]
}

function AuthEntryHeader({ mode }: { mode: AuthEntryMode }) {
  const copy = getAuthModeCopy(mode)

  return (
    <CardHeader className="text-center">
      <CardTitle className="text-xl">{copy.title}</CardTitle>
      <CardDescription>{copy.description}</CardDescription>
    </CardHeader>
  )
}

function SignupNameFields({
  initialFirstName,
  initialLastName,
  isLogin,
}: {
  initialFirstName?: string
  initialLastName?: string
  isLogin: boolean
}) {
  if (isLogin) {
    return null
  }

  return (
    <>
      <Field>
        <FieldLabel htmlFor="firstName">First name</FieldLabel>
        <Input
          id="firstName"
          name="firstName"
          defaultValue={initialFirstName ?? ""}
          placeholder="Taylor"
          required
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="lastName">Surname</FieldLabel>
        <Input
          id="lastName"
          name="lastName"
          defaultValue={initialLastName ?? ""}
          placeholder="Morgan"
          required
        />
      </Field>
    </>
  )
}

function AuthPasswordField({
  initialEmail,
  mode,
  nextPath,
}: {
  initialEmail?: string
  mode: AuthEntryMode
  nextPath: string
}) {
  const copy = getAuthModeCopy(mode)
  const isLogin = mode === "login"

  return (
    <Field>
      <div className="flex items-center justify-between gap-3">
        <FieldLabel htmlFor="password">Password</FieldLabel>
        {isLogin ? (
          <AppLink
            href={`/forgot-password?${new URLSearchParams({
              next: nextPath,
              ...(initialEmail ? { email: initialEmail } : {}),
            }).toString()}`}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Forgot password?
          </AppLink>
        ) : null}
      </div>
      <Input
        id="password"
        name="password"
        type="password"
        placeholder={copy.passwordPlaceholder}
        required
      />
      {!isLogin ? (
        <FieldDescription>
          Use a strong password. WorkOS requires a minimum length and rejects
          weak or breached passwords.
        </FieldDescription>
      ) : null}
    </Field>
  )
}

function AuthFeedback({ error, notice }: { error?: string; notice?: string }) {
  return (
    <>
      {notice ? (
        <FieldDescription className="text-center">{notice}</FieldDescription>
      ) : null}

      {error ? <FieldError className="text-center">{error}</FieldError> : null}
    </>
  )
}

function GoogleAuthButton({
  desktopGoogleHref,
  googleHref,
}: {
  desktopGoogleHref: string
  googleHref: string
}) {
  return (
    <Button asChild variant="outline" type="button">
      <DesktopAwareAuthAnchor
        desktopHref={desktopGoogleHref}
        webHref={googleHref}
      >
        <GoogleLogo data-icon="inline-start" />
        Continue with Google
      </DesktopAwareAuthAnchor>
    </Button>
  )
}

function AlternateAuthLink({
  alternateHref,
  mode,
}: {
  alternateHref: string
  mode: AuthEntryMode
}) {
  const copy = getAuthModeCopy(mode)

  return (
    <FieldDescription className="text-center">
      {copy.alternatePrompt}{" "}
      <AppLink href={alternateHref}>{copy.alternateLabel}</AppLink>
    </FieldDescription>
  )
}

function buildAuthFormAction(path: string, baseUrl?: string | null) {
  const trimmedBaseUrl = baseUrl?.trim().replace(/\/+$/, "")

  return trimmedBaseUrl ? `${trimmedBaseUrl}${path}` : path
}

export function AuthEntryScreen({
  mode,
  nextPath,
  error,
  formActionBaseUrl,
  formActionPath,
  onPasswordSubmit,
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
  const desktopGoogleHref = `/auth/desktop/start?${new URLSearchParams({
    next: nextPath,
    mode,
    provider: "google",
  }).toString()}`
  const alternateMode = isLogin ? "signup" : "login"
  const alternateHref = `/${alternateMode}?${new URLSearchParams({
    next: nextPath,
  }).toString()}`
  const copy = getAuthModeCopy(mode)
  const formAction = buildAuthFormAction(
    formActionPath ?? (isLogin ? "/auth/login" : "/auth/signup"),
    formActionBaseUrl
  )

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <AuthLogo />

        <Card>
          <AuthEntryHeader mode={mode} />

          <CardContent>
            <form action={formAction} method="post" onSubmit={onPasswordSubmit}>
              <input type="hidden" name="next" value={nextPath} />

              <FieldGroup>
                <SignupNameFields
                  initialFirstName={initialFirstName}
                  initialLastName={initialLastName}
                  isLogin={isLogin}
                />

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

                <AuthPasswordField
                  initialEmail={initialEmail}
                  mode={mode}
                  nextPath={nextPath}
                />

                <AuthFeedback error={error} notice={notice} />

                <Button type="submit">{copy.action}</Button>

                <FieldSeparator>Or continue with</FieldSeparator>

                <GoogleAuthButton
                  desktopGoogleHref={desktopGoogleHref}
                  googleHref={googleHref}
                />

                <AlternateAuthLink alternateHref={alternateHref} mode={mode} />
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
