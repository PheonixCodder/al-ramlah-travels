import * as React from "react"
import { asc, desc } from "drizzle-orm"
import { db } from "@/db"
import * as schema from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import { OutreachClient } from "@/components/admin/marketing/outreach-client"

export default async function OutreachPage() {
  await requireAdmin()

  const [contacts, postAssets, logs] = await Promise.all([
    db.query.outreachContacts.findMany({
      orderBy: [asc(schema.outreachContacts.fullName)],
    }),
    db.query.postAssets.findMany({
      orderBy: [desc(schema.postAssets.createdAt)],
    }),
    db.query.outreachLogs.findMany({
      orderBy: [desc(schema.outreachLogs.sentAt)],
      limit: 50,
      with: {
        contact: true,
        postAsset: true,
      },
    }),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-gold">
          Anti-Spam Personal Outreach CRM
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          1-on-1 Personal Outreach &amp; 14-Day Cooldown Guard
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-3xl">
          Reach out to prospective pilgrims from Askari 10, DHA, and Lahore with strict 14-day cooldown protection: once a person is contacted, they are automatically locked for 14 days so you never spam them, while active inbound replies automatically unlock the conversation.
        </p>
      </div>

      <OutreachClient
        initialContacts={contacts}
        postAssets={postAssets}
        recentLogs={logs}
      />
    </div>
  )
}
