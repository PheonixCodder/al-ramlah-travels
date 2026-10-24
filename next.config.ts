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
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "plus.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
}

export default nextConfig
