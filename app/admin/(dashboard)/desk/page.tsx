import * as React from "react"
import { asc, desc, eq } from "drizzle-orm"
import { db } from "@/db"
import * as schema from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import { orderLatestMessagesChronologically } from "@/lib/whatsapp/desk-tabs"
import {
  DeskHubClient,
  type DeskApplicationItem,
  type DeskStaffMember,
  type FlyerPackageRecord,
  type WhatsAppAccountRecord,
  type WhatsAppConversationRecord,
  type WhatsAppQuickReplyRecord,
  type WhatsAppTemplateRecord,
} from "@/components/admin/hubs/desk-hub-client"
import type { AutoReplyRuleItem } from "@/components/admin/desk/whatsapp-auto-reply-studio"
import type { ContactMessageData } from "@/components/admin/catalog/messages-client"

export const metadata = {
  title: "Pilgrim Inbox & Quote Desk | Al Ramlah Travels Admin",
}

function getServerNowMs(): number {
  return Date.now()
}

interface AdminDeskPageProps {
  searchParams: Promise<{
    tab?: string
    lookup?: string
    openLookup?: string
    q?: string
    status?: string
    source?: string
    filter?: string
  }>
}

/**
 * Hub 3: Pilgrim Inbox & Quote Desk (/admin/desk)
 * Next.js 16 async searchParams Server Component loading applications pipeline,
 * real active staff consultants, live Meta WhatsApp Cloud API conversations
 * (newest 50 messages per thread ordered chronologically), templates, quick replies,
 * supplier flyer packages, and website contact inquiries.
 */
export default async function AdminDeskPage({
  searchParams,
}: AdminDeskPageProps) {
  const session = await requireAdmin()

  const params = await searchParams
  const activeTab = params.tab || "pipeline"

  // 0. Fetch Real Active Staff Members for Consultant Assignment (T-068)
  let staffMembersList: DeskStaffMember[] = []
  try {
    const rawStaff = await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        email: schema.user.email,
        role: schema.user.role,
      })
      .from(schema.user)
      .where(eq(schema.user.isActive, true))
      .orderBy(asc(schema.user.name))

    staffMembersList = rawStaff.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
    }))
  } catch (err) {
    console.warn("[desk-page] Active staff query fallback:", err)
  }

  // 1. Fetch Applications with Quotes & Departure City
  let applicationsList: DeskApplicationItem[] = []
  try {
    const rawApplications = await db.query.applications.findMany({
      orderBy: [desc(schema.applications.createdAt)],
      with: {
        quotes: {
          orderBy: [desc(schema.applicationQuotes.version)],
        },
        departureCity: true,
        groupPackage: true,
      },
      limit: 200,
    })

    applicationsList = rawApplications.map((app) => ({
      id: app.id,
      referenceNumber: app.referenceNumber,
      source: app.source,
      status: app.status,
      presetMode: app.presetMode,
      sourcePostCode: app.sourcePostCode,
      customerName: app.customerName,
      customerPhone: app.customerPhone,
      customerWhatsapp: app.customerWhatsapp,
      customerCity: app.customerCity,
      adults: app.adults,
      children: app.children,
      infants: app.infants,
      totalPassportCount: app.totalPassportCount,
      bedAndSeatCount: app.bedAndSeatCount,
      includeVisa: app.includeVisa,
      includeFlights: app.includeFlights,
      includeHotels: app.includeHotels,
      includeTransport: app.includeTransport,
      includeZiyarat: app.includeZiyarat,
      ksaArrivalDate: app.ksaArrivalDate,
      ksaDepartureDate: app.ksaDepartureDate,
      totalKsaDays: app.totalKsaDays,
      calculatedVisaTotalPkr: app.calculatedVisaTotalPkr,
      createdAt: app.createdAt,
      quotes: app.quotes.map((q) => ({
        id: q.id,
        grandTotalPkr: q.grandTotalPkr,
        paymentStatus: q.paymentStatus,
        quotedAt: q.quotedAt,
      })),
      departureCity: app.departureCity
        ? {
            cityName: app.departureCity.cityName,
            airportCode: app.departureCity.airportCode,
          }
        : null,
      groupPackage: app.groupPackage
        ? {
            title: app.groupPackage.title,
          }
        : null,
    }))
  } catch (err) {
    console.warn("[desk-page] Applications query fallback:", err)
  }

  // 2. Fetch WhatsApp Accounts, Conversations, Messages (newest 50 DESC -> reversed ASC), Templates & Quick Replies
  let whatsappAccounts: WhatsAppAccountRecord[] = []
  let whatsappConversations: WhatsAppConversationRecord[] = []
  let whatsappTemplates: WhatsAppTemplateRecord[] = []
  let whatsappQuickReplies: WhatsAppQuickReplyRecord[] = []
  let whatsappAutoReplyRules: AutoReplyRuleItem[] = []

  try {
    const [rawAccounts, rawConversations, rawTemplates, rawQuickReplies] =
      await Promise.all([
        db
          .select({
            id: schema.whatsappAccounts.id,
            name: schema.whatsappAccounts.name,
            phoneNumberId: schema.whatsappAccounts.phoneNumberId,
            wabaId: schema.whatsappAccounts.wabaId,
            displayPhoneNumber: schema.whatsappAccounts.displayPhoneNumber,
            verifiedName: schema.whatsappAccounts.verifiedName,
            qualityRating: schema.whatsappAccounts.qualityRating,
            messagingLimit: schema.whatsappAccounts.messagingLimit,
            accountRole: schema.whatsappAccounts.accountRole,
            isOnBizApp: schema.whatsappAccounts.isOnBizApp,
            platformType: schema.whatsappAccounts.platformType,
            intentFilterEnabled: schema.whatsappAccounts.intentFilterEnabled,
            isActive: schema.whatsappAccounts.isActive,
            isDefault: schema.whatsappAccounts.isDefault,
            autoReplyEnabled: schema.whatsappAccounts.autoReplyEnabled,
            autoReplyCooldownMinutes:
              schema.whatsappAccounts.autoReplyCooldownMinutes,
            welcomeGreetingEnabled:
              schema.whatsappAccounts.welcomeGreetingEnabled,
            welcomeGreetingText: schema.whatsappAccounts.welcomeGreetingText,
            awayGreetingEnabled: schema.whatsappAccounts.awayGreetingEnabled,
            awayGreetingText: schema.whatsappAccounts.awayGreetingText,
            businessHoursStart: schema.whatsappAccounts.businessHoursStart,
            businessHoursEnd: schema.whatsappAccounts.businessHoursEnd,
          })
          .from(schema.whatsappAccounts)
          .where(eq(schema.whatsappAccounts.isActive, true)),

        db.query.whatsappConversations.findMany({
          orderBy: [
            desc(schema.whatsappConversations.isPinned),
            desc(schema.whatsappConversations.lastMessageAt),
          ],
          with: {
            account: {
              columns: {
                id: true,
                name: true,
                displayPhoneNumber: true,
                phoneNumberId: true,
                platformType: true,
                accountRole: true,
                isOnBizApp: true,
                intentFilterEnabled: true,
                autoReplyEnabled: true,
                autoReplyCooldownMinutes: true,
              },
            },
            application: {
              columns: {
                id: true,
                referenceNumber: true,
                customerName: true,
                status: true,
                totalPassportCount: true,
                bedAndSeatCount: true,
              },
            },
            messages: {
              orderBy: [desc(schema.whatsappMessages.createdAt)],
              limit: 50,
            },
          },
          limit: 100,
        }),

        db
          .select({
            id: schema.whatsappTemplates.id,
            accountId: schema.whatsappTemplates.accountId,
            metaTemplateId: schema.whatsappTemplates.metaTemplateId,
            name: schema.whatsappTemplates.name,
            language: schema.whatsappTemplates.language,
            category: schema.whatsappTemplates.category,
            status: schema.whatsappTemplates.status,
            headerType: schema.whatsappTemplates.headerType,
            headerContent: schema.whatsappTemplates.headerContent,
            bodyText: schema.whatsappTemplates.bodyText,
            footerText: schema.whatsappTemplates.footerText,
            buttons: schema.whatsappTemplates.buttons,
          })
          .from(schema.whatsappTemplates)
          .orderBy(desc(schema.whatsappTemplates.createdAt)),

        db
          .select({
            id: schema.whatsappQuickReplies.id,
            accountId: schema.whatsappQuickReplies.accountId,
            shortcut: schema.whatsappQuickReplies.shortcut,
            title: schema.whatsappQuickReplies.title,
            category: schema.whatsappQuickReplies.category,
            bodyText: schema.whatsappQuickReplies.bodyText,
            sortOrder: schema.whatsappQuickReplies.sortOrder,
            isActive: schema.whatsappQuickReplies.isActive,
          })
          .from(schema.whatsappQuickReplies)
          .where(eq(schema.whatsappQuickReplies.isActive, true))
          .orderBy(asc(schema.whatsappQuickReplies.sortOrder)),
      ])

    whatsappAccounts = rawAccounts
    whatsappConversations = (
      rawConversations as unknown as WhatsAppConversationRecord[]
    ).map((conv) => ({
      ...conv,
      messages: conv.messages
        ? orderLatestMessagesChronologically(conv.messages)
        : [],
    }))
    whatsappTemplates = rawTemplates as WhatsAppTemplateRecord[]
    whatsappQuickReplies = rawQuickReplies
  } catch (err) {
    console.warn("[desk-page] WhatsApp CRM tables query fallback:", err)
  }

  // 2B. Fetch Keyword Auto-Reply Rules with graceful fallback
  try {
    const rawRules = await db
      .select()
      .from(schema.whatsappAutoReplyRules)
      .orderBy(
        desc(schema.whatsappAutoReplyRules.priority),
        desc(schema.whatsappAutoReplyRules.createdAt)
      )
    whatsappAutoReplyRules = rawRules as unknown as AutoReplyRuleItem[]
  } catch (err) {
    console.warn("[desk-page] WhatsApp auto-reply rules query fallback:", err)
  }

  // 3. Fetch Supplier Flyer Packages for Detected Post Code Preview
  let flyerPackages: FlyerPackageRecord[] = []
  try {
    const rawPackages = await db.query.supplierFlyerPackages.findMany({
      with: {
        flyer: {
          columns: {
            airlineName: true,
            title: true,
          },
        },
        supplier: {
          columns: {
            name: true,
          },
        },
      },
      limit: 150,
    })
    flyerPackages = rawPackages as unknown as FlyerPackageRecord[]
  } catch (err) {
    console.warn("[desk-page] Supplier flyer packages query fallback:", err)
  }

  // 4. Fetch Website Contact Messages
  let contactMessagesList: ContactMessageData[] = []
  try {
    const rawMessages = await db
      .select({
        id: schema.contactMessages.id,
        name: schema.contactMessages.name,
        email: schema.contactMessages.email,
        phone: schema.contactMessages.phone,
        whatsapp: schema.contactMessages.whatsapp,
        subject: schema.contactMessages.subject,
        message: schema.contactMessages.message,
        status: schema.contactMessages.status,
        adminNotes: schema.contactMessages.adminNotes,
        utmSource: schema.contactMessages.utmSource,
        utmMedium: schema.contactMessages.utmMedium,
        utmCampaign: schema.contactMessages.utmCampaign,
        utmContent: schema.contactMessages.utmContent,
        utmTerm: schema.contactMessages.utmTerm,
        landingPage: schema.contactMessages.landingPage,
        httpReferrer: schema.contactMessages.httpReferrer,
        createdAt: schema.contactMessages.createdAt,
      })
      .from(schema.contactMessages)
      .orderBy(desc(schema.contactMessages.createdAt))
      .limit(100)

    contactMessagesList = rawMessages
  } catch (err) {
    console.warn("[desk-page] Contact messages query fallback:", err)
  }

  // 5. Agency Settings for SLA Overdue Threshold (hours)
  let slaHours = 24
  try {
    const settings = await db
      .select({
        slaOverdueHours: schema.agencySettings.slaOverdueHours,
      })
      .from(schema.agencySettings)
      .limit(1)

    if (settings[0]?.slaOverdueHours) {
      slaHours = settings[0].slaOverdueHours
    }
  } catch (err) {
    console.warn("[desk-page] Agency settings query fallback:", err)
  }

  return (
    <DeskHubClient
      initialTab={activeTab}
      initialNowMs={getServerNowMs()}
      applications={applicationsList}
      slaHours={slaHours}
      whatsappAccounts={whatsappAccounts}
      whatsappConversations={whatsappConversations}
      whatsappTemplates={whatsappTemplates}
      whatsappQuickReplies={whatsappQuickReplies}
      whatsappAutoReplyRules={whatsappAutoReplyRules}
      flyerPackages={flyerPackages}
      contactMessages={contactMessagesList}
      staffMembers={staffMembersList}
      currentUserId={session.user.id}
      currentUserRole={session.user.role}
    />
  )
}
