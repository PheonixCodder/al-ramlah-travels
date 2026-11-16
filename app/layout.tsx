import type { Metadata, Viewport } from "next"
import {
  Plus_Jakarta_Sans,
  Playfair_Display,
  JetBrains_Mono,
  Amiri,
} from "next/font/google"
import "./globals.css"
import { TooltipProvider } from "@/components/ui/tooltip"
import { CANONICAL_ORIGIN, getCanonicalSiteUrl } from "@/lib/seo/metadata"
import { cn } from "@/lib/utils"

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
})

const fontDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
  display: "swap",
})

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  display: "swap",
  preload: false,
})

const fontArabic = Amiri({
  subsets: ["arabic"],
  variable: "--font-arabic",
  weight: ["400", "700"],
  display: "swap",
  preload: false,
})

const ROOT_DEFAULT_TITLE =
  "Umrah Packages Pakistan & Hajj 2027 | Al Ramlah Travels"
const ROOT_DEFAULT_DESCRIPTION =
  "Book verified Umrah packages from Lahore, Karachi & Islamabad, Saudi e-visas, Haramain courtyard hotels & Hajj 2027 pre-registration by Al Ramlah Travels."

export const metadata: Metadata = {
  metadataBase: getCanonicalSiteUrl(),
  title: {
    default: ROOT_DEFAULT_TITLE,
    template: "%s | Al Ramlah Travels",
  },
  description: ROOT_DEFAULT_DESCRIPTION,
  alternates: {
    canonical: CANONICAL_ORIGIN,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/logo.jpg",
  },
  openGraph: {
    type: "website",
    locale: "en_PK",
    siteName: "Al Ramlah Travels",
    url: CANONICAL_ORIGIN,
    title: ROOT_DEFAULT_TITLE,
    description: ROOT_DEFAULT_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: ROOT_DEFAULT_TITLE,
    description: ROOT_DEFAULT_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
}

export const viewport: Viewport = {
  themeColor: "#0A3622",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      style={{ colorScheme: "light" }}
      suppressHydrationWarning
      className={cn(
        "light antialiased selection:bg-primary/20 selection:text-primary",
        fontSans.variable,
        fontDisplay.variable,
        fontMono.variable,
        fontArabic.variable
      )}
    >
      <body className="min-h-screen bg-background font-sans text-foreground">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  )
}
