import { saveSession } from "@workos-inc/authkit-nextjs"

import { reconcileAuthenticatedAppContext } from "@/lib/server/authenticated-app"
import { getRequestMetadata } from "@/lib/server/auth-request"
import { getWorkOSClient } from "@/lib/server/workos"

export async function authenticateWorkOSCallbackCode(
  request: Request,
  code: string
) {
  const authenticationResponse =
    await getWorkOSClient().userManagement.authenticateWithCode({
      clientId: process.env.WORKOS_CLIENT_ID,
      code,
      ...getRequestMetadata(request),
    })

  await saveSession(authenticationResponse, request.url)
  await reconcileAuthenticatedAppContext(
    authenticationResponse.user,
    authenticationResponse.organizationId
  )

  return authenticationResponse
}
