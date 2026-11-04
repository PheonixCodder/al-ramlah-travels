import * as React from "react"
import { desc, eq } from "drizzle-orm"
import { db } from "@/db"
import {
  agencySettings,
  socialIntegrations,
  whatsappAccounts,
  whatsappTemplates,
  user,
} from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import { env } from "@/lib/env"
import {
  ConnectionsSettingsClient,
  type SafeInfrastructureStatus,
  type SafeWhatsappAccount,
  type SafeWhatsappTemplate,
} from "@/components/admin/hubs/connections-settings-client"
import type { SafeSocialIntegration } from "@/app/actions/social-scheduler"
import type { AgencySettingsData } from "@/components/admin/catalog/settings-client"
import type { UserAccountData } from "@/components/admin/catalog/users-client"

export const metadata = {
  title: "Settings & Connections Center | Al Ramlah Travels Admin",
  description:
    "Manage social publishing OAuth integrations, Meta WhatsApp Cloud API credentials, Oracle Gotenberg PDF microservice, agency branding and staff RBAC.",
}

interface AdminSettingsPageProps {
  searchParams: Promise<{
    tab?: string
    connected?: string
    error?: string
  }>
}

export default async function AdminSettingsPage({
  searchParams,
}: AdminSettingsPageProps) {
  // 1. Assert administrative privilege
  const session = await requireAdmin()
  const currentUser = session.user as {
    id: string
    role?: string
    name?: string
    email?: string
  }
  const currentUserRole = currentUser.role ?? "staff"
  const isSuperAdmin = currentUserRole === "super_admin"

  // 2. Next.js 16: dynamic searchParams are asynchronous Promises
  const resolvedSearchParams = await searchParams

  // 3. Fetch Agency Settings
  const [settings] = await db
    .select()
    .from(agencySettings)
    .where(eq(agencySettings.id, "default"))
    .limit(1)

  // 4. Fetch Connected Social Publishing Integrations
  const socialRows = await db
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

  // 5. Fetch WhatsApp WABA Accounts (exclude secret encrypted tokens)
  const waAccountRows = await db
    .select({
      id: whatsappAccounts.id,
      name: whatsappAccounts.name,
      phoneNumberId: whatsappAccounts.phoneNumberId,
      wabaId: whatsappAccounts.wabaId,
      displayPhoneNumber: whatsappAccounts.displayPhoneNumber,
      verifiedName: whatsappAccounts.verifiedName,
      qualityRating: whatsappAccounts.qualityRating,
      messagingLimit: whatsappAccounts.messagingLimit,
      webhookVerifyToken: whatsappAccounts.webhookVerifyToken,
      isActive: whatsappAccounts.isActive,
      isDefault: whatsappAccounts.isDefault,
      createdAt: whatsappAccounts.createdAt,
      updatedAt: whatsappAccounts.updatedAt,
    })
    .from(whatsappAccounts)
    .orderBy(desc(whatsappAccounts.isDefault), desc(whatsappAccounts.createdAt))

  // 6. Fetch Synced WhatsApp Message Templates
  const waTemplateRows = await db
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
      syncedAt: whatsappTemplates.syncedAt,
    })
    .from(whatsappTemplates)
    .orderBy(desc(whatsappTemplates.syncedAt))

  // 7. Fetch Staff Accounts if Super Admin
  let staffUsers: UserAccountData[] = []
  if (isSuperAdmin) {
    const allUsers = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      })
      .from(user)
      .orderBy(desc(user.createdAt))

    staffUsers = allUsers as unknown as UserAccountData[]
  }

  // 8. Safe Boolean Infrastructure Status (Never leak raw API keys to client)
  const infrastructureStatus: SafeInfrastructureStatus = {
    openRouterConfigured: Boolean(env.OPENROUTER_API_KEY),
    geminiConfigured: Boolean(
      env.GOOGLE_GENERATIVE_AI_API_KEY || env.GEMINI_API_KEY
    ),
    r2Configured: Boolean(
      env.R2_BUCKET_NAME && env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID
    ),
    triggerConfigured: Boolean(env.TRIGGER_SECRET_KEY),
    gotenbergConfigured: Boolean(env.GOTENBERG_API_URL),
    appUrl:
      env.NEXT_PUBLIC_APP_URL ||
      env.BETTER_AUTH_URL ||
      "http://localhost:3000",
  }

  return (
    <ConnectionsSettingsClient
      initialTab={resolvedSearchParams.tab}
      connectedProvider={resolvedSearchParams.connected}
      urlError={resolvedSearchParams.error}
      agencySettings={settings as unknown as AgencySettingsData | null}
      socialIntegrations={socialRows as SafeSocialIntegration[]}
      whatsappAccounts={waAccountRows as SafeWhatsappAccount[]}
      whatsappTemplates={waTemplateRows as SafeWhatsappTemplate[]}
      infrastructureStatus={infrastructureStatus}
      staffUsers={staffUsers}
      currentUserId={currentUser.id}
      currentUserRole={currentUserRole}
    />
  )
}
