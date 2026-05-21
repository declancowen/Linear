import { normalizeAuthNextPath, parseAuthMode } from "@/lib/auth-routing"

export function getAuthStartContext(request: Request) {
  const url = new URL(request.url)

  return {
    mode: parseAuthMode(url.searchParams.get("mode")) ?? "login",
    nextPath: normalizeAuthNextPath(url.searchParams.get("next")),
    url,
  }
}
