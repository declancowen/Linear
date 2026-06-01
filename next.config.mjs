import path from "node:path"

const isProduction = process.env.NODE_ENV === "production"
const linkedomCanvasShimAlias = "./lib/server/linkedom-canvas-shim.cjs"
const linkedomCanvasShimPath = path.join(
  process.cwd(),
  "lib/server/linkedom-canvas-shim.cjs",
)

const securityHeaders = [
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Permissions-Policy",
    value: "geolocation=(), payment=(), usb=()",
  },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  turbopack: {
    resolveAlias: {
      canvas: linkedomCanvasShimAlias,
    },
  },
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: linkedomCanvasShimPath,
    }

    return config
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
