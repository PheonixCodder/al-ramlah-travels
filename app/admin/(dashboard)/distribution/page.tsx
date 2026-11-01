import * as React from "react"
import { asc, desc } from "drizzle-orm"
import { db } from "@/db"
import * as schema from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import { DistributionClient } from "@/components/admin/marketing/distribution-client"

export default async function DistributionPage() {
  await requireAdmin()

  const [channels, postAssets, distributions] = await Promise.all([
    db.query.marketingChannels.findMany({
      orderBy: [
        asc(schema.marketingChannels.areaTag),
        asc(schema.marketingChannels.name),
      ],
    }),
    db.query.postAssets.findMany({
      orderBy: [desc(schema.postAssets.createdAt)],
    }),
    db.query.dailyPostDistributions.findMany({
      orderBy: [desc(schema.dailyPostDistributions.postedAt)],
      with: {
        channel: true,
        postAsset: true,
        pairedFollowUpAsset: true,
      },
    }),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-gold">
          Multi-Channel Daily Marketing Matrix
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          30+ WhatsApp Groups, 2 Statuses &amp; Social Media Distribution
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-3xl">
          Orchestrate your 2-Step Attention-Grabber Campaign (Step 1: Single-Package Spotlight Hook → Step 2: All-Packages Sheet) across Askari 10, DHA, Lahore communities, both WhatsApp Status lines (<code className="font-mono">03274029701</code> &amp; <code className="font-mono">03190462638</code>), and Instagram/Facebook/TikTok via the WACRM &amp; Postiz service bridges.
        </p>
      </div>

      <DistributionClient
        initialChannels={channels}
        postAssets={postAssets}
        initialDistributions={distributions}
      />
    </div>
  )
}
