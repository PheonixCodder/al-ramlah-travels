import * as React from "react"
import { asc, count, desc, eq, inArray, notLike } from "drizzle-orm"
import { db } from "@/db"
import {
  agencySettings,
  dailyPostDistributions,
  marketingChannels,
  outreachContacts,
  outreachLogs,
  postAssets,
  scheduledPosts,
  scheduledPostTargets,
  socialIntegrations,
  supplierFlyers,
  whatsappAccounts,
  whatsappBroadcasts,
  whatsappTemplates,
} from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import { getCompanyInfo } from "@/lib/company-info"
import { logger } from "@/lib/logger"
import {
  isGbpApiApproved,
  isTikTokDirectPostApproved,
} from "@/lib/social/providers"
import {
  CampaignsHubClient,
  type CampaignsSummaryCounts,
  type DistributionRecord,
  type MarketingChannelRecord,
  type PostAssetRecord,
  type SafeSocialIntegration,
  type SafeWhatsappAccount,
  type ScheduledPostItem,
  type SupplierFlyerRecord,
  type WhatsappBroadcastRecord,
  type WhatsappTemplateRecord,
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
    postsPage?: string
    contactsPage?: string
  }>
}

function getServerNowMs(): number {
  return Date.now()
}

function sanitizeIntegrationMetaForClient(
  rawMeta: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!rawMeta || typeof rawMeta !== "object") {
    return {}
  }
  const clone: Record<string, unknown> = { ...rawMeta }
  delete clone.encryptedPageAccessToken
  delete clone.pendingCandidates
  return clone
}

/**
 * Hub 2: Campaigns & Outreach (`/admin/campaigns`) (`T-071`, `T-089`)
 * - Enforces bounded `LIMIT` + page offsets on every query so SSR payload stays crisp
 * - Runs lightweight SQL `count()` aggregations for accurate KPI cards
 * - Scrubs encrypted tokens/candidates from `socialIntegrations.metadata`
 * - Surfaces non-silent `degradedWarnings` banner if any subsystem query fails
 */
export default async function AdminCampaignsPage({
  searchParams,
}: AdminCampaignsPageProps) {
  const session = await requireAdmin()

  const params = await searchParams
  const activeTab = params.tab || "social"
  const activeAssetId = params.assetId || ""
  const postsPage = Math.max(
    1,
    Number.parseInt(params.postsPage || "1", 10) || 1
  )
  const contactsPage = Math.max(
    1,
    Number.parseInt(params.contactsPage || "1", 10) || 1
  )
  const postsPageSize = 100
  const contactsPageSize = 200

  const degradedWarnings: string[] = []

  async function safeQuery<T>(
    label: string,
    fn: () => Promise<T>,
    fallback: T
  ): Promise<T> {
    try {
      return await fn()
    } catch (err: unknown) {
      logger.warn("Campaigns Hub SSR query degraded", { label, error: err })
      degradedWarnings.push(label)
      return fallback
    }
  }

  const [
    agencySettingsRow,
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
    totalScheduledPostsCount,
    totalPostAssetsCount,
    totalOutreachContactsCount,
    totalBroadcastsCount,
  ] = await Promise.all([
    safeQuery(
      "Agency Settings",
      async () => {
        const [row] = await db.select().from(agencySettings).limit(1)
        return row ?? null
      },
      null
    ),

    // 1. Social Integrations (sanitized of encrypted credentials & pending staging rows)
    safeQuery(
      "Social Integrations",
      async () => {
        const rows = await db
          .select({
            id: socialIntegrations.id,
            provider: socialIntegrations.provider,
            name: socialIntegrations.name,
            handle: socialIntegrations.handle,
            avatarUrl: socialIntegrations.avatarUrl,
            internalAccountId: socialIntegrations.internalAccountId,
            status: socialIntegrations.status,
            isActive: socialIntegrations.isActive,
            tokenExpiresAt: socialIntegrations.tokenExpiresAt,
            scopes: socialIntegrations.scopes,
            metadata: socialIntegrations.metadata,
            lastSyncedAt: socialIntegrations.lastSyncedAt,
            createdAt: socialIntegrations.createdAt,
          })
          .from(socialIntegrations)
          .where(notLike(socialIntegrations.internalAccountId, "pending:%"))
          .orderBy(desc(socialIntegrations.createdAt))
          .limit(50)

        return rows.map((row) => ({
          ...row,
          metadata: sanitizeIntegrationMetaForClient(row.metadata),
        })) as SafeSocialIntegration[]
      },
      [] as SafeSocialIntegration[]
    ),

    // 2. Scheduled Posts with Targets & Integration joined (bounded pagination)
    safeQuery(
      "Scheduled Social Posts",
      async () => {
        const posts = await db
          .select()
          .from(scheduledPosts)
          .orderBy(desc(scheduledPosts.scheduledFor))
          .limit(postsPageSize)
          .offset((postsPage - 1) * postsPageSize)

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

        const assetIds = posts
          .map((p) => p.postAssetId)
          .filter((id): id is string => Boolean(id))
        const assetMap = new Map<
          string,
          {
            id: string
            postCode: string
            title: string
            imageUrl: string
            kind: string
          }
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
      },
      [] as ScheduledPostItem[]
    ),

    // 3. Post Assets (bounded LIMIT 100)
    safeQuery(
      "Studio Post Assets",
      async () => {
        const rows = await db
          .select()
          .from(postAssets)
          .orderBy(desc(postAssets.createdAt))
          .limit(100)
        return rows as PostAssetRecord[]
      },
      [] as PostAssetRecord[]
    ),

    // 4. Supplier Flyers with Suppliers & Packages (bounded LIMIT 50)
    safeQuery(
      "Supplier Flyers",
      async () => {
        const rows = await db.query.supplierFlyers.findMany({
          with: {
            supplier: true,
            packages: true,
          },
          orderBy: [desc(supplierFlyers.createdAt)],
          limit: 50,
        })
        return rows as unknown as SupplierFlyerRecord[]
      },
      [] as SupplierFlyerRecord[]
    ),

    // 5. Marketing Channels (bounded LIMIT 200)
    safeQuery(
      "Marketing Channels",
      async () => {
        const rows = await db
          .select()
          .from(marketingChannels)
          .orderBy(
            asc(marketingChannels.sortOrder),
            asc(marketingChannels.name)
          )
          .limit(200)
        return rows as MarketingChannelRecord[]
      },
      [] as MarketingChannelRecord[]
    ),

    // 6. Recent Daily Post Distributions (bounded LIMIT 150)
    safeQuery(
      "Daily Distributions",
      async () => {
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
      },
      [] as DistributionRecord[]
    ),

    // 7. WhatsApp Accounts (sanitized of access tokens and webhook secrets)
    safeQuery(
      "WhatsApp Accounts",
      async () => {
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
          .limit(25)
        return rows as SafeWhatsappAccount[]
      },
      [] as SafeWhatsappAccount[]
    ),

    // 8. WhatsApp Approved Templates (bounded LIMIT 200)
    safeQuery(
      "WhatsApp Templates",
      async () => {
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
          .limit(200)
        return rows as WhatsappTemplateRecord[]
      },
      [] as WhatsappTemplateRecord[]
    ),

    // 9. WhatsApp Broadcasts with Template Details (bounded LIMIT 50)
    safeQuery(
      "WhatsApp Broadcasts",
      async () => {
        const rows = await db.query.whatsappBroadcasts.findMany({
          with: {
            template: true,
          },
          orderBy: [desc(whatsappBroadcasts.createdAt)],
          limit: 50,
        })
        return rows as unknown as WhatsappBroadcastRecord[]
      },
      [] as WhatsappBroadcastRecord[]
    ),

    // 10. 1-on-1 VIP Outreach Contacts (bounded pagination)
    safeQuery(
      "VIP Outreach Contacts",
      async () => {
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
          .limit(contactsPageSize)
          .offset((contactsPage - 1) * contactsPageSize)
        return rows as OutreachContactRow[]
      },
      [] as OutreachContactRow[]
    ),

    // 11. Recent 1-on-1 Outreach Logs (bounded LIMIT 50)
    safeQuery(
      "VIP Outreach Logs",
      async () => {
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
      },
      [] as OutreachLogRow[]
    ),

    // 12-15. SQL summary counts (`T-071`)
    safeQuery(
      "Scheduled Posts Count",
      async () => {
        const [res] = await db.select({ value: count() }).from(scheduledPosts)
        return Number(res?.value ?? 0)
      },
      0
    ),

    safeQuery(
      "Post Assets Count",
      async () => {
        const [res] = await db.select({ value: count() }).from(postAssets)
        return Number(res?.value ?? 0)
      },
      0
    ),

    safeQuery(
      "Outreach Contacts Count",
      async () => {
        const [res] = await db.select({ value: count() }).from(outreachContacts)
        return Number(res?.value ?? 0)
      },
      0
    ),

    safeQuery(
      "WhatsApp Broadcasts Count",
      async () => {
        const [res] = await db
          .select({ value: count() })
          .from(whatsappBroadcasts)
        return Number(res?.value ?? 0)
      },
      0
    ),
  ])

  const companyInfo = getCompanyInfo(agencySettingsRow)
  const summaryCounts: CampaignsSummaryCounts = {
    totalScheduledPosts: totalScheduledPostsCount,
    totalPostAssets: totalPostAssetsCount,
    totalOutreachContacts: totalOutreachContactsCount,
    totalBroadcasts: totalBroadcastsCount,
    postsPage,
    postsPageSize,
    contactsPage,
    contactsPageSize,
  }

  return (
    <CampaignsHubClient
      initialTab={activeTab}
      initialAssetId={activeAssetId}
      initialNowMs={getServerNowMs()}
      userRole={session.user.role === "super_admin" ? "super_admin" : "staff"}
      companyInfo={{
        officeAddress: companyInfo.officeAddress,
        primaryWhatsapp: companyInfo.primaryWhatsapp,
        normalizedWhatsapp: companyInfo.normalizedWhatsapp,
        hotlineDisplay: companyInfo.hotlineDisplay,
      }}
      tiktokDirectPostApproved={isTikTokDirectPostApproved()}
      gbpApiApproved={isGbpApiApproved()}
      summaryCounts={summaryCounts}
      degradedWarnings={degradedWarnings}
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
