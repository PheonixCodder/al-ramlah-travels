import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  Building2,
  Compass,
  FileCheck,
  Home,
  Layers,
  MapPin,
  MessageCircle,
  Package,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { PublicHeader } from "@/components/layout/public-header"
import { PublicFooter } from "@/components/layout/public-footer"
import { WhatsAppFab } from "@/components/layout/whatsapp-fab"
import { getCachedCompanyInfo } from "@/lib/company-info"
import { toWaMeUrl } from "@/components/public/public-utils"

export const metadata: Metadata = {
  title: {
    absolute: "Page Not Found (404) | Al Ramlah Travels",
  },
  description:
    "The destination you requested could not be found. Explore Al Ramlah Travels Umrah packages, Saudi visas, Haramain hotels, Hajj 2027 guides, or our Lahore desk.",
  robots: {
    index: false,
    follow: true,
  },
}

const RECOVERY_HUBS = [
  {
    title: "Group Umrah Packages",
    description: "Fixed PKR departures from Lahore, Karachi & Islamabad",
    href: "/umrah-packages",
    icon: Package,
  },
  {
    title: "Saudi Umrah Visa Rates",
    description: "Short-term & long-term PKR tariffs and Nusuk Masar rules",
    href: "/umrah-visa",
    icon: FileCheck,
  },
  {
    title: "Hajj 2027 Pre-Registration",
    description: "Indicative Maktab A+, A, B & C tiers and readiness guide",
    href: "/hajj-2027",
    icon: Layers,
  },
  {
    title: "Makkah Haram Hotels",
    description: "Clock Tower, courtyard & 24/7 shuttle properties",
    href: "/hotels/makkah",
    icon: Building2,
  },
  {
    title: "Sacred Ziyarat Guide",
    description: "Historical Makkah, Madinah, Badr & Taif landmarks",
    href: "/ziyarat",
    icon: Compass,
  },
  {
    title: "Contact Lahore Cantt Desk",
    description: "Askari 10 concierge office, directions & phone hotlines",
    href: "/contact",
    icon: MapPin,
  },
] as const

export default async function RootNotFoundPage() {
  const info = await getCachedCompanyInfo()
  const whatsappHref = toWaMeUrl(
    info.primaryWhatsapp,
    "Assalam o Alaikum Al Ramlah Travels! I reached a 404 link and would like guidance on Umrah / Hajj packages."
  )

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <PublicHeader
        agencyPhone={info.primaryWhatsapp}
        secondaryPhone={info.secondaryPhone}
        whatsappNumber={info.primaryWhatsapp}
        officeAddress={info.officeAddress}
      />

      <main
        id="main-content"
        className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6 lg:px-8"
      >
        <div className="flex w-full max-w-4xl flex-col items-center gap-8 rounded-3xl border border-border bg-card p-6 text-center shadow-lg sm:p-10">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-gold/40 bg-primary/5 text-primary">
            <Compass className="size-7" aria-hidden="true" />
          </div>

          <div className="flex max-w-xl flex-col gap-2">
            <p className="font-mono text-xs font-semibold tracking-widest text-gold-text uppercase tabular-nums">
              404 · Page Not Found
            </p>
            <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
              This destination could not be found
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              The link you followed may have moved or expired. Continue directly
              to one of our verified Haramain pilgrimage hubs below or message
              our Askari 10 Lahore concierge on WhatsApp.
            </p>
          </div>

          <div className="grid w-full grid-cols-1 gap-3 text-left sm:grid-cols-2 lg:grid-cols-3">
            {RECOVERY_HUBS.map((hub) => (
              <Link
                key={hub.href}
                href={hub.href}
                className="group flex min-h-6 flex-col justify-between rounded-2xl border border-border bg-background/70 p-4 transition-all hover:border-gold hover:bg-background hover:shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex size-9 items-center justify-center rounded-xl border border-gold/30 bg-primary/5 text-primary">
                    <hub.icon className="size-4" aria-hidden="true" />
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
                <div className="mt-3">
                  <h2 className="text-sm font-bold text-foreground group-hover:text-primary">
                    {hub.title}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {hub.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              nativeButton={false}
              render={<Link href="/" />}
              className="min-h-10 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Home className="size-4" />
              <span>Return to Custom Journey Planner</span>
            </Button>

            <Button
              variant="outline"
              nativeButton={false}
              render={
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
              className="min-h-10"
            >
              <MessageCircle className="size-4 text-emerald-600" />
              <span>WhatsApp Lahore Desk</span>
            </Button>
          </div>
        </div>
      </main>

      <PublicFooter
        agencyPhone={info.primaryWhatsapp}
        secondaryPhone={info.secondaryPhone}
        whatsappNumber={info.primaryWhatsapp}
        agencyName={info.agencyName}
        legalEntityName={info.legalEntityName}
        supportEmail={info.supportEmail}
        officeAddress={info.officeAddress}
        dtsLicense={info.dtsLicense}
        moraLicense={info.moraLicense}
        iataCode={info.iataCode}
        ntnNumber={info.ntnNumber}
        facebookUrl={info.facebookUrl}
        instagramUrl={info.instagramUrl}
        youtubeUrl={info.youtubeUrl}
        tiktokUrl={info.tiktokUrl}
      />
      <WhatsAppFab whatsappNumber={info.primaryWhatsapp} />
    </div>
  )
}
