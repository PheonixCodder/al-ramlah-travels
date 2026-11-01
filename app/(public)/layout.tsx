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

  const agencyPhone = settings?.primaryWhatsapp || "03274029701"
  const secondaryPhone = settings?.secondaryPhone || "03190462638"
  const whatsappNumber = settings?.primaryWhatsapp || "03274029701"
  const agencyName = settings?.agencyName || "Al Ramlah Travels"
  const supportEmail = settings?.supportEmail || "alramlahtravels@gmail.com"
  const officeAddress =
    settings?.officeAddress ||
    "House no 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt"

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader
        agencyPhone={agencyPhone}
        secondaryPhone={secondaryPhone}
        whatsappNumber={whatsappNumber}
        officeAddress={officeAddress}
      />
      <main className="flex-1">{children}</main>
      <PublicFooter
        agencyPhone={agencyPhone}
        secondaryPhone={secondaryPhone}
        whatsappNumber={whatsappNumber}
        agencyName={agencyName}
        supportEmail={supportEmail}
        officeAddress={officeAddress}
      />
      <WhatsAppFab whatsappNumber={whatsappNumber} />
    </div>
  )
}
