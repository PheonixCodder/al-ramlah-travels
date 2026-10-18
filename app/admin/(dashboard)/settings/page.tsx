import * as React from "react"
import { db } from "@/db"
import { agencySettings } from "@/db/schema"
import { eq } from "drizzle-orm"
import { requireAdmin } from "@/lib/auth-guard"
import {
  SettingsClient,
  AgencySettingsData,
} from "@/components/admin/catalog/settings-client"

export const metadata = {
  title: "Agency Settings | Al Ramlah Travels Admin",
}

export default async function AdminSettingsPage() {
  await requireAdmin()

  const [settings] = await db
    .select()
    .from(agencySettings)
    .where(eq(agencySettings.id, "default"))
    .limit(1)

  return (
    <SettingsClient
      initialSettings={settings as unknown as AgencySettingsData | null}
    />
  )
}
