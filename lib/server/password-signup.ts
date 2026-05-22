import { saveSession } from "@workos-inc/authkit-nextjs"

import { getPasswordAuthFormFields } from "@/lib/auth-form"
import { reconcileAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { getRequestMetadata } from "@/lib/server/auth-request"
import {
  getWorkOSAuthErrorCode,
  getWorkOSAuthErrorMessage,
  getWorkOSClient,
  getWorkOSPendingAuthentication,
} from "@/lib/server/workos"

export type SignupFormFields = {
  email: string
  firstName: string
  lastName: string
  nextPath: string
  password: string
}

type SignupAuthenticationResponse = Awaited<
  ReturnType<
    ReturnType<
      typeof getWorkOSClient
    >["userManagement"]["authenticateWithPassword"]
  >
>

export type PendingSignupAuthentication = NonNullable<
  ReturnType<typeof getWorkOSPendingAuthentication>
>

export function mapSignupError(error: unknown) {
  const code = getWorkOSAuthErrorCode(error)
  const message =
    getWorkOSAuthErrorMessage(error) ??
    (typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
      ? error.message
      : null)

  if (code && /already|exists|duplicate|conflict/i.test(code)) {
    return "Account already created. Please sign in."
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 409
  ) {
    return "An account already exists for that email."
  }

  if (
    message &&
    /already exists|already in use|already associated/i.test(message)
  ) {
    return "An account already exists for that email."
  }

  if (message) {
    return message.replace(/\s+/g, " ").trim()
  }

  return "We couldn't create that account."
}

export function isSignupConflict(error: unknown) {
  const code = getWorkOSAuthErrorCode(error)

  if (code && /already|exists|duplicate|conflict/i.test(code)) {
    return true
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 409
  ) {
    return true
  }

  const message =
    getWorkOSAuthErrorMessage(error) ??
    (typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
      ? error.message
      : null)

  return Boolean(
    message && /already exists|already in use|already associated/i.test(message)
  )
}

export async function getSignupFormFields(
  request: Request
): Promise<SignupFormFields> {
  const formData = await request.formData()
  const passwordFields = getPasswordAuthFormFields(formData)

  return {
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    ...passwordFields,
  }
}

export function isSignupFormComplete(fields: SignupFormFields) {
  return Boolean(
    fields.firstName && fields.lastName && fields.email && fields.password
  )
}

export async function createSignupUser(fields: SignupFormFields) {
  await getWorkOSClient().userManagement.createUser({
    email: fields.email,
    password: fields.password,
    firstName: fields.firstName,
    lastName: fields.lastName,
  })
}

async function persistSignupAuthentication(
  request: Request,
  authenticationResponse: SignupAuthenticationResponse
) {
  await saveSession(authenticationResponse, request.url)
  await reconcileAuthenticatedAppContext(
    authenticationResponse.user,
    authenticationResponse.organizationId
  )
}

export async function authenticateSignupPassword(
  request: Request,
  fields: Pick<SignupFormFields, "email" | "password">
) {
  const authenticationResponse =
    await getWorkOSClient().userManagement.authenticateWithPassword({
      clientId: process.env.WORKOS_CLIENT_ID,
      email: fields.email,
      password: fields.password,
      ...getRequestMetadata(request),
    })

  await persistSignupAuthentication(request, authenticationResponse)

  return authenticationResponse
}

export function getPendingSignupEmailVerification(error: unknown) {
  const pendingAuthentication = getWorkOSPendingAuthentication(error)

  if (
    getWorkOSAuthErrorCode(error) !== "email_verification_required" ||
    !pendingAuthentication
  ) {
    return null
  }

  return pendingAuthentication
}

export function getSignupAuthenticationErrorMessage(error: unknown) {
  return getWorkOSAuthErrorCode(error) === "invalid_password"
    ? "That password does not meet the current requirements."
    : mapSignupError(error)
}
