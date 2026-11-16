"use client"

import Link from "next/link"
import * as React from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error("[GlobalError] Root layout error:", error.digest ?? error.name)
  }, [error])

  return (
    <html lang="en" data-theme="light" style={{ colorScheme: "light" }}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FAF6EE",
          color: "#0A3622",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: "24px",
        }}
      >
        <main
          id="main-content"
          style={{
            maxWidth: "480px",
            width: "100%",
            backgroundColor: "#FFFFFF",
            border: "1px solid #DDD3BC",
            borderRadius: "16px",
            padding: "32px",
            textAlign: "center",
            boxShadow: "0 10px 30px rgba(10, 54, 34, 0.08)",
          }}
        >
          <p
            style={{
              margin: "0 0 8px 0",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#775700",
            }}
          >
            Al Ramlah Travels
          </p>
          <h1
            style={{
              margin: "0 0 12px 0",
              fontSize: "24px",
              fontWeight: 700,
              color: "#0A3622",
            }}
          >
            System Recovery Required
          </h1>
          <p
            style={{
              margin: "0 0 20px 0",
              fontSize: "14px",
              lineHeight: 1.6,
              color: "#44534B",
            }}
          >
            An unexpected application error interrupted this view. Please reload
            or contact our Askari 10 Lahore concierge at +92 327 4029701.
          </p>
          {error.digest && (
            <p
              style={{
                margin: "0 0 20px 0",
                fontSize: "12px",
                fontFamily: "monospace",
                color: "#44534B",
              }}
            >
              Incident ID: {error.digest}
            </p>
          )}
          <div
            style={{
              display: "flex",
              gap: "12px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                backgroundColor: "#0A3622",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "8px",
                padding: "10px 18px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reload Application
            </button>
            <Link
              href="/"
              style={{
                backgroundColor: "#FAF6EE",
                color: "#0A3622",
                border: "1px solid #C5A059",
                borderRadius: "8px",
                padding: "10px 18px",
                fontSize: "14px",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Home Page
            </Link>
          </div>
        </main>
      </body>
    </html>
  )
}
