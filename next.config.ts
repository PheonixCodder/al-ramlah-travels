import type { NextConfig } from "next"

function getHost(urlString?: string): string | undefined {
  if (!urlString) return undefined
  try {
    return new URL(urlString).host
  } catch {
    return undefined
  }
}

const appUrlHost = getHost(process.env.NEXT_PUBLIC_APP_URL)
const authUrlHost = getHost(process.env.BETTER_AUTH_URL)
const r2PublicHost = getHost(process.env.R2_PUBLIC_URL)

const serverActionOrigins = [
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
  appUrlHost,
  authUrlHost,
].filter((origin): origin is string => Boolean(origin && origin.trim()))

const configuredRemotePatterns = [
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
  {
    protocol: "https" as const,
    hostname: "**.r2.dev",
  },
  {
    protocol: "https" as const,
    hostname: "pub-7f2c533d31cc45bb9eb2669af5a3b5ef.r2.dev",
  },
  {
    protocol: "https" as const,
    hostname: "**.r2.cloudflarestorage.com",
  },
  ...(r2PublicHost
    ? [
        {
          protocol: "https" as const,
          hostname: r2PublicHost,
        },
      ]
    : []),
]

// Deduplicate remotePatterns by protocol and hostname
const remotePatterns = Array.from(
  new Map(
    configuredRemotePatterns.map((pattern) => [
      `${pattern.protocol}://${pattern.hostname}`,
      pattern,
    ])
  ).values()
)

const nextConfig: NextConfig = {
  output: "standalone",
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
  experimental: {
    serverActions: {
      allowedOrigins: Array.from(new Set(serverActionOrigins)),
    },
  },
  images: {
    remotePatterns,
  },
}

export default nextConfig
