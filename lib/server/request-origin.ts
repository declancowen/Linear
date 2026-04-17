import { getAppOrigin } from "@/lib/auth-routing"

export async function resolveServerOrigin() {
  return getAppOrigin()
}
