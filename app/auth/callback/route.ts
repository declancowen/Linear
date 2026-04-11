import { handleAuth } from "@workos-inc/authkit-nextjs"

import { ensureAuthenticatedAppContext } from "@/lib/server/authenticated-app"

export const GET = handleAuth({
  returnPathname: "/inbox",
  onSuccess: async ({ user, organizationId }) => {
    await ensureAuthenticatedAppContext(user, organizationId)
  },
})
