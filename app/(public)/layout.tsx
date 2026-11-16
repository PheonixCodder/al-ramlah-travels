import * as React from "react"
import { getCachedCompanyInfo } from "@/lib/company-info"
import { PublicHeader } from "@/components/layout/public-header"
import { PublicFooter } from "@/components/layout/public-footer"
import { WhatsAppFab } from "@/components/layout/whatsapp-fab"
import { UtmTracker } from "@/components/seo/utm-tracker"

export default async function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const info = await getCachedCompanyInfo()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <React.Suspense fallback={null}>
        <UtmTracker />
      </React.Suspense>
      <PublicHeader
        agencyPhone={info.primaryWhatsapp}
        secondaryPhone={info.secondaryPhone}
        whatsappNumber={info.primaryWhatsapp}
        officeAddress={info.officeAddress}
      />
      <main className="flex-1">{children}</main>
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
