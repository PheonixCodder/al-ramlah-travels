import type { MetadataRoute } from "next"
import { CANONICAL_ORIGIN } from "@/lib/seo/metadata"

const DISALLOWED_PRIVATE_PATHS = [
  "/admin/",
  "/api/",
  "/voucher/",
  "/quote/",
]

export default function robots(): MetadataRoute.Robots {
  const vercelEnv = process.env.VERCEL_ENV?.trim().toLowerCase()
  if (vercelEnv && vercelEnv !== "production") {
    return {
      rules: [
        {
          userAgent: "*",
          disallow: "/",
        },
      ],
    }
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOWED_PRIVATE_PATHS,
      },
      {
        userAgent: [
          "OAI-SearchBot",
          "GPTBot",
          "ChatGPT-User",
          "PerplexityBot",
          "Perplexity-User",
          "Claude-SearchBot",
          "Claude-User",
          "ClaudeBot",
          "Google-Extended",
          "Applebot-Extended",
        ],
        allow: "/",
        disallow: DISALLOWED_PRIVATE_PATHS,
      },
      {
        userAgent: ["CCBot", "Bytespider"],
        disallow: "/",
      },
    ],
    sitemap: `${CANONICAL_ORIGIN}/sitemap.xml`,
    host: CANONICAL_ORIGIN,
  }
}
