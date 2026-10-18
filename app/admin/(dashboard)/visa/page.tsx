import * as React from "react"
import { db } from "@/db"
import { visaRates } from "@/db/schema"
import { asc } from "drizzle-orm"
import { requireAdmin } from "@/lib/auth-guard"
import { VisaClient, VisaRateData } from "@/components/admin/catalog/visa-client"

export const metadata = {
  title: "Visa Pricing & Regulations | Al Ramlah Travels Admin",
}

export default async function AdminVisaPage() {
  await requireAdmin()

  const rates = await db
    .select()
    .from(visaRates)
    .orderBy(asc(visaRates.maxDays))

  return <VisaClient initialRates={rates as unknown as VisaRateData[]} />
}
