import type { Metadata } from "next"
import * as React from "react"

export const metadata: Metadata = {
  title: {
    default: "Admin Console | Al Ramlah Travels",
    template: "%s",
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
    nosnippet: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      noarchive: true,
      nosnippet: true,
    },
  },
}

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
