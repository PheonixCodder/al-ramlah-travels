import { ImageResponse } from "next/og"
import {
  BRAND_HOTLINE_DISPLAY,
  BRAND_NAME,
  BRAND_TAGLINE,
  BRAND_WEBSITE_DOMAIN,
} from "@/lib/constants/brand"

export const OG_IMAGE_SIZE = {
  width: 1200,
  height: 630,
} as const

export const OG_IMAGE_CONTENT_TYPE = "image/png" as const

export interface OgCardOptions {
  eyebrow?: string
  title: string
  subtitle?: string
  badges?: ReadonlyArray<string>
  footerNote?: string
}

/**
 * Shared Haramain luxury `1200×630` Open Graph card renderer (`SEO-010`).
 * Palette: Deep Haramain Emerald (`#0A3622`), Metallic Gold (`#C5A059`), Warm Ivory (`#FAF7F0`).
 */
export function renderLuxuryOgCard(options: OgCardOptions): ImageResponse {
  const eyebrow = (options.eyebrow || BRAND_TAGLINE).trim().slice(0, 72)
  const title = (options.title || BRAND_NAME).trim().slice(0, 110)
  const subtitle = (
    options.subtitle ||
    "Bespoke Umrah Packages, Saudi E-Visas, Haramain Courtyard Hotels & Hajj 2027 Advisory from Lahore, Pakistan."
  )
    .trim()
    .slice(0, 180)
  const badges = (options.badges ?? [
    "Lahore Cantt HQ",
    "Transparent PKR Rates",
    "Direct Haramain Concierge",
  ])
    .filter((b) => b.trim().length > 0)
    .slice(0, 4)
  const footerNote = (
    options.footerNote || `Askari 10, Lahore Cantt · ${BRAND_HOTLINE_DISPLAY}`
  )
    .trim()
    .slice(0, 90)

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0A3622",
          backgroundImage:
            "radial-gradient(circle at 88% 16%, rgba(197, 160, 89, 0.22) 0%, rgba(10, 54, 34, 0) 54%), linear-gradient(135deg, #0A3622 0%, #0F5132 58%, #072719 100%)",
          padding: "44px 52px",
          fontFamily: "Georgia, serif",
          color: "#FAF7F0",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            border: "2px solid rgba(197, 160, 89, 0.55)",
            borderRadius: "20px",
            padding: "36px 44px",
            backgroundColor: "rgba(7, 39, 25, 0.42)",
          }}
        >
          {/* Top Brand Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "10px",
                  border: "1.5px solid #C5A059",
                  backgroundColor: "rgba(197, 160, 89, 0.16)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#C5A059",
                  fontSize: "22px",
                  fontWeight: 700,
                }}
              >
                AR
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <span
                  style={{
                    fontSize: "22px",
                    fontWeight: 700,
                    color: "#FAF7F0",
                    letterSpacing: "0.04em",
                  }}
                >
                  {BRAND_NAME}
                </span>
                <span
                  style={{
                    fontSize: "13px",
                    color: "#C5A059",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                  }}
                >
                  {eyebrow}
                </span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "8px 18px",
                borderRadius: "999px",
                border: "1px solid rgba(197, 160, 89, 0.5)",
                backgroundColor: "rgba(250, 247, 240, 0.08)",
                color: "#FAF7F0",
                fontSize: "15px",
                letterSpacing: "0.04em",
              }}
            >
              {BRAND_WEBSITE_DOMAIN}
            </div>
          </div>

          {/* Center Headline & Badges */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              maxWidth: "980px",
            }}
          >
            <div
              style={{
                fontSize: title.length > 62 ? "44px" : "52px",
                fontWeight: 700,
                lineHeight: 1.14,
                color: "#FAF7F0",
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: "22px",
                lineHeight: 1.42,
                color: "rgba(250, 247, 240, 0.86)",
                fontFamily: "sans-serif",
              }}
            >
              {subtitle}
            </div>

            {badges.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "12px",
                  marginTop: "6px",
                }}
              >
                {badges.map((badge) => (
                  <div
                    key={badge}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "7px 16px",
                      borderRadius: "999px",
                      backgroundColor: "rgba(197, 160, 89, 0.18)",
                      border: "1px solid rgba(197, 160, 89, 0.6)",
                      color: "#FAF7F0",
                      fontSize: "15px",
                      fontFamily: "sans-serif",
                    }}
                  >
                    {badge}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* FooterNAP Strip */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: "1px solid rgba(197, 160, 89, 0.32)",
              paddingTop: "18px",
              fontFamily: "sans-serif",
              fontSize: "16px",
              color: "#C5A059",
            }}
          >
            <span>{footerNote}</span>
            <span style={{ color: "rgba(250, 247, 240, 0.82)" }}>
              Makkah · Madinah · Jeddah
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...OG_IMAGE_SIZE,
    }
  )
}
