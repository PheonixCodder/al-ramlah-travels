import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "*.ngrok-free.app",
    "*.ngrok-free.dev",
    "*.ngrok.app",
    "*.ngrok.io",
    "*.trycloudflare.com",
    "localhost",
    "127.0.0.1",
  ],
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "localhost",
        "*.ngrok-free.app",
        "*.ngrok-free.dev",
        "*.ngrok.app",
        "*.ngrok.io",
        "*.trycloudflare.com",
      ],
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
        hostname: "**",
      },
    ],
  },
}

export default nextConfig


