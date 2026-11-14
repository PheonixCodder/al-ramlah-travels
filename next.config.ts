import path from "node:path"
import type { NextConfig } from "next"

function getHost(urlString?: string): string | undefined {
  if (!urlString) return undefined
  try {
    return new URL(urlString).host
  } catch {
    return undefined
  }
}

function getHostname(urlString?: string): string | undefined {
  if (!urlString) return undefined
  try {
    const parsed = new URL(urlString)
    if (parsed.protocol !== "https:") return undefined
    return parsed.hostname
  } catch {
    return undefined
  }
}

const DEV_TUNNEL_ORIGINS = [
  "localhost:3000",
  "localhost",
  "127.0.0.1:3000",
  "127.0.0.1",
  "*.ngrok-free.app",
  "*.ngrok-free.dev",
  "*.ngrok.app",
  "*.ngrok.io",
  "*.trycloudflare.com",
  "*.devtunnels.ms",
  "*.asse.devtunnels.ms",
]

export function buildNextConfig(
  env: NodeJS.ProcessEnv = process.env
): NextConfig {
  const isProduction = env.NODE_ENV === "production"
  const appUrlHost = getHost(env.NEXT_PUBLIC_APP_URL)
  const authUrlHost = getHost(env.BETTER_AUTH_URL)
  const r2PublicHostname = getHostname(env.R2_PUBLIC_URL)

  const prodOrigins = [appUrlHost, authUrlHost].filter(
    (origin): origin is string =>
      Boolean(
        origin &&
        origin.trim() &&
        !origin.includes("localhost") &&
        !origin.includes("127.0.0.1")
      )
  )

  const serverActionOrigins = isProduction
    ? Array.from(new Set(prodOrigins))
    : Array.from(
        new Set(
          [...DEV_TUNNEL_ORIGINS, appUrlHost, authUrlHost].filter(
            (origin): origin is string => Boolean(origin && origin.trim())
          )
        )
      )

  const configuredRemotePatterns = [
    {
      protocol: "https" as const,
      hostname: "r2.alramlahtravels.com",
    },
    {
      protocol: "https" as const,
      hostname: "assets.alramlahtravels.com",
    },
    {
      protocol: "https" as const,
      hostname: "*.r2.dev",
    },
    {
      protocol: "https" as const,
      hostname: "*.r2.cloudflarestorage.com",
    },
    {
      protocol: "https" as const,
      hostname: "images.unsplash.com",
    },
    {
      protocol: "https" as const,
      hostname: "plus.unsplash.com",
    },
    {
      protocol: "https" as const,
      hostname: "*.public.blob.vercel-storage.com",
    },
    {
      protocol: "https" as const,
      hostname: "lh3.googleusercontent.com",
    },
    {
      protocol: "https" as const,
      hostname: "avatars.githubusercontent.com",
    },
    ...(r2PublicHostname
      ? [
          {
            protocol: "https" as const,
            hostname: r2PublicHostname,
          },
        ]
      : []),
  ]

  const remotePatterns = Array.from(
    new Map(
      configuredRemotePatterns.map((pattern) => [
        `${pattern.protocol}://${pattern.hostname}`,
        pattern,
      ])
    ).values()
  )

  const excludedTraceGlobs = [
    "./.env*",
    "./public/uploads/**/*",
    "./tests/**/*",
    "./scripts/**/*",
    "./docs/**/*",
    "./.trigger/**/*",
  ]

  return {
    output: "standalone",
    poweredByHeader: false,
    turbopack: {
      resolveAlias: {
        cn: "./lib/utils.ts",
      },
    },
    webpack: (config) => {
      config.resolve = config.resolve || {}
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        cn: path.resolve(process.cwd(), "lib/utils.ts"),
      }
      return config
    },
    serverExternalPackages: [
      "@whiskeysockets/baileys",
      "pino",
      "pg",
      "sharp",
    ],
    outputFileTracingExcludes: {
      "/*": excludedTraceGlobs,
      "*": excludedTraceGlobs,
    },
    ...(isProduction
      ? {}
      : {
          allowedDevOrigins: [
            "*.ngrok-free.app",
            "*.ngrok-free.dev",
            "*.ngrok.app",
            "*.ngrok.io",
            "*.trycloudflare.com",
            "*.devtunnels.ms",
            "*.asse.devtunnels.ms",
            "localhost",
            "127.0.0.1",
          ],
        }),
    experimental: {
      optimizePackageImports: [
        "lucide-react",
        "recharts",
        "@base-ui/react",
        "date-fns",
      ],
      serverActions: {
        bodySizeLimit: (
          env.SERVER_ACTIONS_BODY_SIZE_LIMIT?.trim() ||
          (isProduction ? "4mb" : "20mb")
        ) as "4mb" | "20mb",
        allowedOrigins: serverActionOrigins,
      },
    },
    images: {
      remotePatterns,
    },
    async redirects() {
      return [
        {
          source: "/admin/hotels",
          destination: "/admin/catalog?tab=hotels",
          permanent: true,
        },
        {
          source: "/admin/flights",
          destination: "/admin/catalog?tab=flights",
          permanent: true,
        },
        {
          source: "/admin/groups",
          destination: "/admin/catalog?tab=groups",
          permanent: true,
        },
        {
          source: "/admin/visa",
          destination: "/admin/catalog?tab=visa",
          permanent: true,
        },
        {
          source: "/admin/transport",
          destination: "/admin/catalog?tab=transport",
          permanent: true,
        },
        {
          source: "/admin/ziyarat",
          destination: "/admin/catalog?tab=ziyarat",
          permanent: true,
        },
        {
          source: "/admin/content",
          destination: "/admin/catalog?tab=content",
          permanent: true,
        },
        {
          source: "/admin/messages",
          destination: "/admin/catalog?tab=messages",
          permanent: true,
        },
        {
          source: "/admin/users",
          destination: "/admin/settings?tab=users",
          permanent: true,
        },
        {
          source: "/admin/post-lookup",
          destination: "/admin/studio",
          permanent: true,
        },
        {
          source: "/admin/supplier-flyers",
          destination: "/admin/studio",
          permanent: true,
        },
        {
          source: "/admin/distribution",
          destination: "/admin/campaigns?tab=whatsapp",
          permanent: true,
        },
        {
          source: "/admin/outreach",
          destination: "/admin/campaigns?tab=outreach",
          permanent: true,
        },
      ]
    },
  }
}

const nextConfig: NextConfig = buildNextConfig()

export default nextConfig
