import * as React from "react"
import { desc, asc } from "drizzle-orm"
import { db } from "@/db"
import * as schema from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import { PostLookupClient } from "@/components/admin/marketing/post-lookup-client"

export default async function PostLookupPage() {
  await requireAdmin()

  const [packages, distributions, channels] = await Promise.all([
    db.query.supplierFlyerPackages.findMany({
      orderBy: [desc(schema.supplierFlyerPackages.createdAt)],
      with: {
        flyer: true,
        supplier: true,
      },
    }),
    db.query.dailyPostDistributions.findMany({
      orderBy: [desc(schema.dailyPostDistributions.postedAt)],
      with: {
        channel: true,
        postAsset: true,
      },
    }),
    db.query.marketingChannels.findMany({
      orderBy: [asc(schema.marketingChannels.name)],
    }),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-gold">
          Instant Customer Inquiry Resolution
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Post Reverse-Lookup &amp; 1-Click Quote Converter
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-3xl">
          When a customer messages from Askari 10, DHA, WhatsApp Status, or Instagram asking about a post, search by Post Reference Code (e.g. <code className="font-mono font-bold text-primary">ART-AM-21D-04</code>), price (<code className="font-mono">269,899</code>), hotel name, flight date, or channel to see the exact supplier, net cost, commission, and convert to an official quote in 1 click.
        </p>
      </div>

      <PostLookupClient
        packages={packages}
        distributions={distributions}
        channels={channels}
      />
    </div>
  )
}
