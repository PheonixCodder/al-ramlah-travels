import type { Metadata, Viewport } from "next"
import {
  Plus_Jakarta_Sans,
  Playfair_Display,
  JetBrains_Mono,
  Amiri,
} from "next/font/google"
import "./globals.css"
import { TooltipProvider } from "@/components/ui/tooltip"
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
})

const fontArabic = Amiri({
  subsets: ["arabic"],
  variable: "--font-arabic",
  weight: ["400", "700"],
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "Al Ramlah Travels — Bespoke Umrah, Hajj & Haramain Journeys",
    template: "%s | Al Ramlah Travels",
  },
  description:
    "Pakistan's premier luxury pilgrimage concierge. Ministry of Hajj & Umrah Licensed Operator (#4082) offering customized Umrah packages, transparent live rates, luxury hotels in Makkah and Madinah, and dedicated 24/7 on-ground pilgrim care.",
  keywords: [
    "Umrah Packages Pakistan",
    "Bespoke Umrah",
    "Luxury Umrah Lahore Karachi Islamabad",
    "Hajj 2026",
    "Makkah Clock Tower Hotels",
    "Madinah Oberoi Hotels",
    "Al Ramlah Travels",
    "Custom Umrah Calculator",
  ],
  icons: {
    icon: "/logo-icon.png",
    apple: "/logo-icon.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#0A3622",
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
      suppressHydrationWarning
      className={cn(
        "antialiased selection:bg-primary/20 selection:text-primary",
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
