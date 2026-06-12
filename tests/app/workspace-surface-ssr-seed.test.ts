import { describe, expect, it } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, resolve } from "node:path"

const REPO_ROOT = resolve(__dirname, "..", "..")
const WORKSPACE_ROUTES_ROOT = join(REPO_ROOT, "app", "(workspace)")

/**
 * Routes that do not own a scoped read-model surface and are intentionally
 * exempt from the SSR seed requirement. Each entry must include a reason
 * so the exemption stays auditable. New entries must come with a real
 * justification (settings page, search warmup, etc.) — not "I forgot to
 * seed it".
 */
const SEEDLESS_ROUTE_ALLOWLIST: Array<{
  route: string
  reason: string
}> = [
  {
    route: "settings/profile/page.tsx",
    reason:
      "Profile settings reads identity from the workspace-membership seed loaded by the workspace layout; no surface read model.",
  },
  {
    route: "workspace/settings/page.tsx",
    reason:
      "Workspace settings reads workspace + memberships already seeded by the workspace layout.",
  },
  {
    route: "team/[teamSlug]/settings/page.tsx",
    reason:
      "Team settings reads team + memberships already seeded by the workspace layout.",
  },
  {
    route: "workspace/create-team/page.tsx",
    reason: "Create-team form has no read model.",
  },
  {
    route: "workspace/search/page.tsx",
    reason:
      "Search seed is intentionally client-only — it is a global-search dialog warmup, not a per-surface gate. Documented in the architecture decision for Phase 2.",
  },
  {
    route: "invites/page.tsx",
    reason:
      "Invites surface reads from the workspace-membership seed already loaded by the workspace layout.",
  },
  {
    route: "team/[teamSlug]/dashboard/page.tsx",
    reason:
      "Team dashboard does not subscribe to its own scoped read model — it composes data already in the store from sibling surfaces. Seeding it is residual work tracked separately and is non-blocking because users typically reach the dashboard from other (already seeded) surfaces.",
  },
]

const SEED_BUILDER_IMPORT = "@/lib/server/scoped-read-model-seeds"
const RSC_AUTH_IMPORTS = [
  "@/lib/server/route-auth",
  "@/lib/server/page-seed-context",
]

function* walkPageFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      yield* walkPageFiles(fullPath)
    } else if (entry === "page.tsx") {
      yield fullPath
    }
  }
}

function getRelativeRoute(absolutePath: string): string {
  return relative(WORKSPACE_ROUTES_ROOT, absolutePath)
}

function isAllowlistedSeedless(relativeRoute: string): boolean {
  return SEEDLESS_ROUTE_ALLOWLIST.some((entry) => entry.route === relativeRoute)
}

describe("workspace surface SSR seed fitness function", () => {
  it("every workspace surface page either builds an SSR seed or is explicitly allowlisted", () => {
    const offenders: Array<{ route: string; reason: string }> = []

    for (const pagePath of walkPageFiles(WORKSPACE_ROUTES_ROOT)) {
      const relativeRoute = getRelativeRoute(pagePath)

      if (isAllowlistedSeedless(relativeRoute)) {
        continue
      }

      // Skip the route group's layout — it's the parent of the rule, not a
      // surface page.
      if (relativeRoute === "layout.tsx") {
        continue
      }

      const source = readFileSync(pagePath, "utf-8")

      // A "use client" page bypasses SSR entirely; it cannot build a server
      // seed. Surface pages must be RSC.
      const isClientPage = /^"use client"/m.test(source)
      if (isClientPage) {
        offenders.push({
          route: relativeRoute,
          reason:
            'Surface pages must be server components (no "use client" at the top of page.tsx) so they can pre-build the read-model seed before the client renders.',
        })
        continue
      }

      const importsSeedBuilder = source.includes(SEED_BUILDER_IMPORT)
      const importsRouteAuth = RSC_AUTH_IMPORTS.some((path) =>
        source.includes(path)
      )

      if (!importsSeedBuilder || !importsRouteAuth) {
        offenders.push({
          route: relativeRoute,
          reason: `Surface pages must import a per-kind builder from \`${SEED_BUILDER_IMPORT}\` and an auth helper from one of [${RSC_AUTH_IMPORTS.map((path) => `\`${path}\``).join(", ")}]. If this route legitimately has no scoped read-model surface, add it to SEEDLESS_ROUTE_ALLOWLIST with a justification.`,
        })
      }
    }

    if (offenders.length > 0) {
      const message = offenders
        .map(({ route, reason }) => `  - ${route}: ${reason}`)
        .join("\n")
      throw new Error(
        `Found ${offenders.length} workspace surface page(s) that violate the SSR seed pattern:\n${message}`
      )
    }

    expect(offenders).toEqual([])
  })

  it("the allowlist itself is non-empty and well-formed", () => {
    expect(SEEDLESS_ROUTE_ALLOWLIST.length).toBeGreaterThan(0)

    for (const entry of SEEDLESS_ROUTE_ALLOWLIST) {
      expect(entry.route, "every allowlist entry must name a route").toMatch(
        /\.tsx$/
      )
      expect(
        entry.reason.trim().length,
        "every allowlist entry must include a non-empty justification"
      ).toBeGreaterThan(20)
    }
  })

  it("allowlist routes actually exist on disk", () => {
    for (const entry of SEEDLESS_ROUTE_ALLOWLIST) {
      const absolute = join(WORKSPACE_ROUTES_ROOT, entry.route)
      expect(
        statSync(absolute).isFile(),
        `allowlist entry ${entry.route} should reference a real page.tsx`
      ).toBe(true)
    }
  })
})
