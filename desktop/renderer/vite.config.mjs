import path from "node:path"
import { fileURLToPath } from "node:url"

import { defineConfig, loadEnv } from "vite"
import { readDotenvFile } from "../../scripts/shared/dotenv.mjs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "../..")
const DEFAULT_HOSTED_APP_ORIGIN = "https://teams.reciperoom.io"
const VERCEL_PRODUCTION_ENV_FILE = ".env.vercel.production.local"
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"])

function toPosixPath(value) {
  return value.split(path.sep).join("/")
}

function trimTrailingSlash(value) {
  return value?.replace(/\/+$/, "")
}

function readHttpOrigin(value) {
  const trimmed = trimTrailingSlash(value?.trim())

  if (!trimmed) {
    return null
  }

  try {
    const url = new URL(trimmed)

    return url.protocol === "http:" || url.protocol === "https:"
      ? url.origin
      : null
  } catch {
    return null
  }
}

function isPublicHttpsOrigin(value) {
  try {
    const url = new URL(value)

    return url.protocol === "https:" && !LOCAL_HOSTNAMES.has(url.hostname)
  } catch {
    return false
  }
}

function loadDesktopEnv(mode) {
  const env = loadEnv(mode, repoRoot, "")
  const vercelProductionEnv =
    mode === "production"
      ? readDotenvFile(path.join(repoRoot, VERCEL_PRODUCTION_ENV_FILE))
      : {}

  return {
    ...env,
    ...vercelProductionEnv,
    ...process.env,
  }
}

export function getHostedAppOrigin(env, mode) {
  const candidates = [
    env.DESKTOP_HOSTED_APP_URL,
    env.NEXT_PUBLIC_APP_URL,
    env.APP_URL,
    env.TEAMS_URL,
  ]

  for (const candidate of candidates) {
    const origin = readHttpOrigin(candidate)

    if (!origin) {
      continue
    }

    if (mode !== "production" || isPublicHttpsOrigin(origin)) {
      return origin
    }
  }

  return DEFAULT_HOSTED_APP_ORIGIN
}

function getPublicApiBaseUrl(env, hostedAppOrigin, mode) {
  const apiBaseUrl = readHttpOrigin(env.NEXT_PUBLIC_API_BASE_URL)

  if (
    apiBaseUrl &&
    (mode !== "production" || isPublicHttpsOrigin(apiBaseUrl))
  ) {
    return apiBaseUrl
  }

  return hostedAppOrigin
}

export function getPublicEnv(mode) {
  const env = loadDesktopEnv(mode)
  const hostedAppOrigin = getHostedAppOrigin(env, mode)

  return {
    APP_URL: hostedAppOrigin,
    NEXT_PUBLIC_API_BASE_URL: getPublicApiBaseUrl(env, hostedAppOrigin, mode),
    NEXT_PUBLIC_APP_URL: hostedAppOrigin,
    NEXT_PUBLIC_ENABLE_COLLABORATION:
      env.NEXT_PUBLIC_ENABLE_COLLABORATION ?? "true",
    NEXT_PUBLIC_ENABLE_LEGACY_SNAPSHOT_STREAM:
      env.NEXT_PUBLIC_ENABLE_LEGACY_SNAPSHOT_STREAM ?? "false",
    NEXT_PUBLIC_ENABLE_SCOPED_SYNC:
      env.NEXT_PUBLIC_ENABLE_SCOPED_SYNC ?? "true",
    NODE_ENV: mode === "production" ? "production" : "development",
    TEAMS_URL: hostedAppOrigin,
  }
}

const vendorChunkRules = [
  {
    chunk: "vendor-react",
    patterns: [
      "/node_modules/react/",
      "/node_modules/react-dom/",
      "/node_modules/scheduler/",
    ],
  },
  {
    chunk: "vendor-rich-text",
    patterns: [
      "/node_modules/@tiptap/",
      "/node_modules/prosemirror-",
      "/node_modules/yjs/",
      "/node_modules/y-protocols/",
    ],
  },
  {
    chunk: "vendor-ui",
    patterns: [
      "/node_modules/@radix-ui/",
      "/node_modules/radix-ui/",
      "/node_modules/cmdk/",
      "/node_modules/vaul/",
    ],
  },
  {
    chunk: "vendor-icons",
    patterns: ["/node_modules/@phosphor-icons/"],
  },
  {
    chunk: "vendor-app-runtime",
    patterns: [
      "/node_modules/date-fns/",
      "/node_modules/zustand/",
      "/node_modules/sonner/",
    ],
  },
]
const appChunkRules = [
  {
    chunk: "app-rich-text",
    patterns: ["/components/app/rich-text-editor"],
  },
  {
    chunk: "app-collaboration",
    patterns: ["/components/app/collaboration-screens"],
  },
  {
    chunk: "app-screens",
    patterns: ["/components/app/screens/", "/components/app/screens.tsx"],
  },
  {
    chunk: "app-store",
    patterns: ["/lib/store/"],
  },
  {
    chunk: "app-api-client",
    patterns: ["/lib/convex/client"],
  },
]

function matchesAnyPattern(normalizedId, patterns) {
  return patterns.some((pattern) => normalizedId.includes(pattern))
}

function findChunkRule(normalizedId, rules) {
  return rules.find((rule) => matchesAnyPattern(normalizedId, rule.patterns))
}

function getDesktopManualChunk(id) {
  const normalizedId = toPosixPath(id)

  if (normalizedId.includes("/node_modules/")) {
    return findChunkRule(normalizedId, vendorChunkRules)?.chunk ?? "vendor-misc"
  }

  return findChunkRule(normalizedId, appChunkRules)?.chunk
}

export default defineConfig(({ mode }) => {
  const publicEnv = getPublicEnv(mode)

  return {
    base: "./",
    root: __dirname,
    resolve: {
      alias: [
        {
          find: "@/lib/browser/app-navigation",
          replacement: path.resolve(__dirname, "adapters/app-navigation.tsx"),
        },
        {
          find: "@/lib/browser/app-image",
          replacement: path.resolve(__dirname, "adapters/app-image.tsx"),
        },
        {
          find: "@/lib/browser/app-theme",
          replacement: path.resolve(__dirname, "adapters/app-theme.tsx"),
        },
        {
          find: "@",
          replacement: repoRoot,
        },
      ],
    },
    define: {
      "process.env": JSON.stringify(publicEnv),
      "process.env.APP_URL": JSON.stringify(publicEnv.APP_URL),
      "process.env.NEXT_PUBLIC_API_BASE_URL": JSON.stringify(
        publicEnv.NEXT_PUBLIC_API_BASE_URL
      ),
      "process.env.NEXT_PUBLIC_APP_URL": JSON.stringify(
        publicEnv.NEXT_PUBLIC_APP_URL
      ),
      "process.env.NEXT_PUBLIC_ENABLE_COLLABORATION": JSON.stringify(
        publicEnv.NEXT_PUBLIC_ENABLE_COLLABORATION
      ),
      "process.env.NEXT_PUBLIC_ENABLE_LEGACY_SNAPSHOT_STREAM": JSON.stringify(
        publicEnv.NEXT_PUBLIC_ENABLE_LEGACY_SNAPSHOT_STREAM
      ),
      "process.env.NEXT_PUBLIC_ENABLE_SCOPED_SYNC": JSON.stringify(
        publicEnv.NEXT_PUBLIC_ENABLE_SCOPED_SYNC
      ),
      "process.env.NODE_ENV": JSON.stringify(publicEnv.NODE_ENV),
      "process.env.TEAMS_URL": JSON.stringify(publicEnv.TEAMS_URL),
    },
    build: {
      chunkSizeWarningLimit: 2048,
      emptyOutDir: true,
      modulePreload: false,
      outDir: path.resolve(repoRoot, "dist/desktop-renderer"),
      rolldownOptions: {
        output: {
          manualChunks: getDesktopManualChunk,
        },
      },
      sourcemap: true,
    },
  }
})
