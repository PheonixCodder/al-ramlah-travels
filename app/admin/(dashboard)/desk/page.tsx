import * as React from "react"
import { desc, asc, eq } from "drizzle-orm"
import { db } from "@/db"
import * as schema from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import {
  DeskHubClient,
  type DeskApplicationItem,
  type WhatsAppAccountRecord,
  type WhatsAppConversationRecord,
  type WhatsAppTemplateRecord,
  type WhatsAppQuickReplyRecord,
  type FlyerPackageRecord,
} from "@/components/admin/hubs/desk-hub-client"
import type { ContactMessageData } from "@/components/admin/catalog/messages-client"

export const metadata = {
  title: "Pilgrim Inbox & Quote Desk | Al Ramlah Travels Admin",
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
 * live Meta WhatsApp Cloud API conversations, quick replies, templates, supplier flyer packages,
 * and website contact inquiries.
 */
export default async function AdminDeskPage({
  searchParams,
}: AdminDeskPageProps) {
  await requireAdmin()

  const params = await searchParams
  const activeTab = params.tab || "pipeline"

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

  // 2. Fetch WhatsApp Accounts, Conversations, Messages, Templates, and Quick Replies
  let whatsappAccounts: WhatsAppAccountRecord[] = []
  let whatsappConversations: WhatsAppConversationRecord[] = []
  let whatsappTemplates: WhatsAppTemplateRecord[] = []
  let whatsappQuickReplies: WhatsAppQuickReplyRecord[] = []

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
            isActive: schema.whatsappAccounts.isActive,
            isDefault: schema.whatsappAccounts.isDefault,
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
              orderBy: [asc(schema.whatsappMessages.createdAt)],
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
          .where(eq(schema.whatsappTemplates.status, "APPROVED")),

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
    whatsappConversations =
      rawConversations as unknown as WhatsAppConversationRecord[]
    whatsappTemplates = rawTemplates as WhatsAppTemplateRecord[]
    whatsappQuickReplies = rawQuickReplies
  } catch (err) {
    console.warn("[desk-page] WhatsApp CRM tables query fallback:", err)
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
      applications={applicationsList}
      slaHours={slaHours}
      whatsappAccounts={whatsappAccounts}
      whatsappConversations={whatsappConversations}
      whatsappTemplates={whatsappTemplates}
      whatsappQuickReplies={whatsappQuickReplies}
      flyerPackages={flyerPackages}
      contactMessages={contactMessagesList}
    />
  )
}
