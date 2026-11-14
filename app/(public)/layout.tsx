import * as React from "react"
import { db } from "@/db"
import { eq } from "drizzle-orm"
import * as schema from "@/db/schema"
import { getCompanyInfo } from "@/lib/company-info"
import { PublicHeader } from "@/components/layout/public-header"
import { PublicFooter } from "@/components/layout/public-footer"
import { WhatsAppFab } from "@/components/layout/whatsapp-fab"

export default async function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  let settings: typeof schema.agencySettings.$inferSelect | null = null
  try {
    settings =
      (await db.query.agencySettings.findFirst({
        where: eq(schema.agencySettings.id, "default"),
      })) ?? null
  } catch (err) {
    console.error("Failed to query agencySettings in PublicLayout:", err)
  }

  const info = getCompanyInfo(settings)

  return (
    <div className="flex min-h-screen flex-col bg-background">
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
        supportEmail={info.supportEmail}
        officeAddress={info.officeAddress}
      />
      <WhatsAppFab whatsappNumber={info.primaryWhatsapp} />
    </div>
  )
}
