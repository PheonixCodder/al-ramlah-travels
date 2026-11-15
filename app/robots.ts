import type { MetadataRoute } from "next"
import { CANONICAL_ORIGIN } from "@/lib/seo/metadata"

const DISALLOWED_PRIVATE_PATHS = [
  "/admin/",
  "/api/",
  "/voucher/",
  "/quote/",
]

export default function robots(): MetadataRoute.Robots {
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
          "Claude-SearchBot",
          "ClaudeBot",
          "Google-Extended",
          "Applebot-Extended",
        ],
        allow: "/",
        disallow: DISALLOWED_PRIVATE_PATHS,
      },
    ],
    sitemap: `${CANONICAL_ORIGIN}/sitemap.xml`,
    host: CANONICAL_ORIGIN,
  }
}
