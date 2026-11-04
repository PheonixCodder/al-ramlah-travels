import * as React from "react"
import { asc, desc, eq, inArray } from "drizzle-orm"
import { db } from "@/db"
import {
  socialIntegrations,
  scheduledPosts,
  scheduledPostTargets,
  postAssets,
  supplierFlyers,
  marketingChannels,
  dailyPostDistributions,
  whatsappAccounts,
  whatsappTemplates,
  whatsappBroadcasts,
  outreachContacts,
  outreachLogs,
} from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import {
  CampaignsHubClient,
  type SafeSocialIntegration,
  type ScheduledPostItem,
  type PostAssetRecord,
  type SupplierFlyerRecord,
  type MarketingChannelRecord,
  type DistributionRecord,
  type SafeWhatsappAccount,
  type WhatsappTemplateRecord,
  type WhatsappBroadcastRecord,
} from "@/components/admin/hubs/campaigns-hub-client"
import type {
  OutreachContactRow,
  OutreachLogRow,
} from "@/components/admin/marketing/outreach-client"

export const metadata = {
  title: "Campaigns & Multi-Channel Outreach | Al Ramlah Travels Admin",
  description:
    "Core 5 social calendar & composer, ban-safe WhatsApp distribution queue, official Meta Cloud API broadcasts, and 14-day VIP outreach CRM.",
}

interface AdminCampaignsPageProps {
  searchParams: Promise<{
    tab?: string
    assetId?: string
  }>
}

/**
 * Resilient query wrapper to catch database exceptions if newly migrated tables
 * are still being provisioned or partially seeded in a local/preview environment.
 */
async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (err: unknown) {
    console.warn(
      "[Campaigns Page] Safe query fallback triggered:",
      err instanceof Error ? err.message : String(err)
    )
    return fallback
  }
}

/**
 * Hub 2: Campaigns & Outreach (/admin/campaigns)
 * Next.js 16 async searchParams Server Component loading all campaign data
 * across social scheduling, WhatsApp distribution, Meta broadcasts, and VIP outreach CRM.
 */
export default async function AdminCampaignsPage({
  searchParams,
}: AdminCampaignsPageProps) {
  await requireAdmin()

  const params = await searchParams
  const activeTab = params.tab || "social"
  const activeAssetId = params.assetId || ""

  const [
    allSocialIntegrations,
    allScheduledPosts,
    allPostAssets,
    allSupplierFlyers,
    allMarketingChannels,
    allDailyDistributions,
    allWhatsappAccounts,
    allWhatsappTemplates,
    allWhatsappBroadcasts,
    allOutreachContacts,
    allOutreachLogs,
  ] = await Promise.all([
    // 1. Social Integrations (sanitized of encrypted credentials)
    safeQuery(async () => {
      const rows = await db
        .select({
          id: socialIntegrations.id,
          provider: socialIntegrations.provider,
          name: socialIntegrations.name,
          handle: socialIntegrations.handle,
          avatarUrl: socialIntegrations.avatarUrl,
          internalAccountId: socialIntegrations.internalAccountId,
          isActive: socialIntegrations.isActive,
          tokenExpiresAt: socialIntegrations.tokenExpiresAt,
          scopes: socialIntegrations.scopes,
          metadata: socialIntegrations.metadata,
          lastSyncedAt: socialIntegrations.lastSyncedAt,
          createdAt: socialIntegrations.createdAt,
        })
        .from(socialIntegrations)
        .orderBy(desc(socialIntegrations.createdAt))
      return rows as SafeSocialIntegration[]
    }, [] as SafeSocialIntegration[]),

    // 2. Scheduled Posts with Targets & Integration joined
    safeQuery(async () => {
      const posts = await db
        .select()
        .from(scheduledPosts)
        .orderBy(desc(scheduledPosts.scheduledFor))
        .limit(100)

      if (posts.length === 0) return []

      const postIds = posts.map((p) => p.id)

      const targets = await db
        .select({
          target: scheduledPostTargets,
          integration: {
            id: socialIntegrations.id,
            name: socialIntegrations.name,
            provider: socialIntegrations.provider,
            handle: socialIntegrations.handle,
            avatarUrl: socialIntegrations.avatarUrl,
          },
        })
        .from(scheduledPostTargets)
        .innerJoin(
          socialIntegrations,
          eq(scheduledPostTargets.integrationId, socialIntegrations.id)
        )
        .where(inArray(scheduledPostTargets.scheduledPostId, postIds))

      const targetsByPostId = new Map<string, typeof targets>()
      for (const t of targets) {
        const list = targetsByPostId.get(t.target.scheduledPostId) || []
        list.push(t)
        targetsByPostId.set(t.target.scheduledPostId, list)
      }

      // Query linked postAsset minimal previews for thumbnails
      const assetIds = posts
        .map((p) => p.postAssetId)
        .filter((id): id is string => Boolean(id))
      const assetMap = new Map<
        string,
        { id: string; postCode: string; title: string; imageUrl: string; kind: string }
      >()

      if (assetIds.length > 0) {
        const assets = await db
          .select({
            id: postAssets.id,
            postCode: postAssets.postCode,
            title: postAssets.title,
            imageUrl: postAssets.imageUrl,
            kind: postAssets.kind,
          })
          .from(postAssets)
          .where(inArray(postAssets.id, assetIds))

        for (const a of assets) {
          assetMap.set(a.id, a)
        }
      }

      return posts.map((p) => ({
        ...p,
        postAsset: p.postAssetId ? assetMap.get(p.postAssetId) || null : null,
        targets: (targetsByPostId.get(p.id) || []).map((t) => ({
          ...t.target,
          integration: t.integration,
        })),
      })) as ScheduledPostItem[]
    }, [] as ScheduledPostItem[]),

    // 3. Post Assets (4K Sheets and Single Spotlights)
    safeQuery(async () => {
      const rows = await db
        .select()
        .from(postAssets)
        .orderBy(desc(postAssets.createdAt))
      return rows as PostAssetRecord[]
    }, [] as PostAssetRecord[]),

    // 4. Supplier Flyers with Suppliers & Packages
    safeQuery(async () => {
      const rows = await db.query.supplierFlyers.findMany({
        with: {
          supplier: true,
          packages: true,
        },
        orderBy: [desc(supplierFlyers.createdAt)],
      })
      return rows as unknown as SupplierFlyerRecord[]
    }, [] as SupplierFlyerRecord[]),

    // 5. Marketing Channels (WhatsApp Groups, Communities, Status Lines, Socials)
    safeQuery(async () => {
      const rows = await db
        .select()
        .from(marketingChannels)
        .orderBy(
          asc(marketingChannels.sortOrder),
          asc(marketingChannels.name)
        )
      return rows as MarketingChannelRecord[]
    }, [] as MarketingChannelRecord[]),

    // 6. Recent Daily Post Distributions
    safeQuery(async () => {
      const rows = await db.query.dailyPostDistributions.findMany({
        with: {
          channel: true,
          postAsset: true,
          pairedFollowUpAsset: true,
        },
        orderBy: [
          desc(dailyPostDistributions.scheduledDate),
          desc(dailyPostDistributions.createdAt),
        ],
        limit: 150,
      })
      return rows as unknown as DistributionRecord[]
    }, [] as DistributionRecord[]),

    // 7. WhatsApp Accounts (sanitized of access tokens and webhook secrets)
    safeQuery(async () => {
      const rows = await db
        .select({
          id: whatsappAccounts.id,
          name: whatsappAccounts.name,
          phoneNumberId: whatsappAccounts.phoneNumberId,
          wabaId: whatsappAccounts.wabaId,
          displayPhoneNumber: whatsappAccounts.displayPhoneNumber,
          verifiedName: whatsappAccounts.verifiedName,
          qualityRating: whatsappAccounts.qualityRating,
          messagingLimit: whatsappAccounts.messagingLimit,
          isActive: whatsappAccounts.isActive,
          isDefault: whatsappAccounts.isDefault,
        })
        .from(whatsappAccounts)
        .orderBy(
          desc(whatsappAccounts.isDefault),
          desc(whatsappAccounts.createdAt)
        )
      return rows as SafeWhatsappAccount[]
    }, [] as SafeWhatsappAccount[]),

    // 8. WhatsApp Approved Templates
    safeQuery(async () => {
      const rows = await db
        .select({
          id: whatsappTemplates.id,
          accountId: whatsappTemplates.accountId,
          metaTemplateId: whatsappTemplates.metaTemplateId,
          name: whatsappTemplates.name,
          language: whatsappTemplates.language,
          category: whatsappTemplates.category,
          status: whatsappTemplates.status,
          headerType: whatsappTemplates.headerType,
          headerContent: whatsappTemplates.headerContent,
          bodyText: whatsappTemplates.bodyText,
          footerText: whatsappTemplates.footerText,
        })
        .from(whatsappTemplates)
        .orderBy(asc(whatsappTemplates.name))
      return rows as WhatsappTemplateRecord[]
    }, [] as WhatsappTemplateRecord[]),

    // 9. WhatsApp Broadcasts with Template Details
    safeQuery(async () => {
      const rows = await db.query.whatsappBroadcasts.findMany({
        with: {
          template: true,
        },
        orderBy: [desc(whatsappBroadcasts.createdAt)],
        limit: 50,
      })
      return rows as unknown as WhatsappBroadcastRecord[]
    }, [] as WhatsappBroadcastRecord[]),

    // 10. 1-on-1 VIP Outreach Contacts (matching OutreachContactRow shape)
    safeQuery(async () => {
      const rows = await db
        .select({
          id: outreachContacts.id,
          fullName: outreachContacts.fullName,
          whatsappNumber: outreachContacts.whatsappNumber,
          secondaryPhone: outreachContacts.secondaryPhone,
          city: outreachContacts.city,
          areaCommunity: outreachContacts.areaCommunity,
          sourceGroupOrChannel: outreachContacts.sourceGroupOrChannel,
          assignedWhatsappLine: outreachContacts.assignedWhatsappLine,
          interestStatus: outreachContacts.interestStatus,
          lastOutreachAt: outreachContacts.lastOutreachAt,
          cooldownUntil: outreachContacts.cooldownUntil,
          lastInboundReplyAt: outreachContacts.lastInboundReplyAt,
          totalOutreachCount: outreachContacts.totalOutreachCount,
          packagesSharedHistory: outreachContacts.packagesSharedHistory,
          tags: outreachContacts.tags,
          notes: outreachContacts.notes,
        })
        .from(outreachContacts)
        .orderBy(
          desc(outreachContacts.lastOutreachAt),
          asc(outreachContacts.fullName)
        )
      return rows as OutreachContactRow[]
    }, [] as OutreachContactRow[]),

    // 11. Recent 1-on-1 Outreach Logs (matching OutreachLogRow shape)
    safeQuery(async () => {
      const rows = await db.query.outreachLogs.findMany({
        with: {
          contact: {
            columns: {
              fullName: true,
              whatsappNumber: true,
            },
          },
          postAsset: {
            columns: {
              postCode: true,
              title: true,
            },
          },
        },
        orderBy: [desc(outreachLogs.sentAt)],
        limit: 50,
      })
      return rows as unknown as OutreachLogRow[]
    }, [] as OutreachLogRow[]),
  ])

  return (
    <CampaignsHubClient
      initialTab={activeTab}
      initialAssetId={activeAssetId}
      socialIntegrations={allSocialIntegrations}
      scheduledPosts={allScheduledPosts}
      postAssets={allPostAssets}
      supplierFlyers={allSupplierFlyers}
      marketingChannels={allMarketingChannels}
      dailyDistributions={allDailyDistributions}
      whatsappAccounts={allWhatsappAccounts}
      whatsappTemplates={allWhatsappTemplates}
      whatsappBroadcasts={allWhatsappBroadcasts}
      outreachContacts={allOutreachContacts}
      outreachLogs={allOutreachLogs}
    />
  )
}
