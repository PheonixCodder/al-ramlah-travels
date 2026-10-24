import * as React from "react"
import { db } from "@/db"
import { eq } from "drizzle-orm"
import * as schema from "@/db/schema"
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
    settings = (await db.query.agencySettings.findFirst({
      where: eq(schema.agencySettings.id, "default"),
    })) ?? null
  } catch (err) {
    console.error("Failed to query agencySettings in PublicLayout:", err)
  }

  const agencyPhone = settings?.secondaryPhone || settings?.primaryWhatsapp || "+92 300 1234567"
  const whatsappNumber = settings?.primaryWhatsapp || "+923001234567"
  const agencyName = settings?.agencyName || "Al Ramlah Travels"
  const supportEmail = settings?.supportEmail || "info@alramlahtravels.com"
  const officeAddress = settings?.officeAddress || "Suite 402, Al-Hafeez Heights, Gulberg III, Lahore, Pakistan"

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader
        agencyPhone={agencyPhone}
        whatsappNumber={whatsappNumber}
        officeAddress={officeAddress}
      />
      <main className="flex-1">{children}</main>
      <PublicFooter
        agencyPhone={agencyPhone}
        whatsappNumber={whatsappNumber}
        agencyName={agencyName}
        supportEmail={supportEmail}
        officeAddress={officeAddress}
      />
      <WhatsAppFab whatsappNumber={whatsappNumber} />
    </div>
  )
}
