import * as React from "react"
import { desc, eq, sql } from "drizzle-orm"
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
import {
  projectSafeSocialIntegrationDto,
  projectSafeWhatsappAccountDto,
} from "@/components/admin/settings/safe-settings-dto"
import { evaluateSystemConfigHealth } from "@/components/admin/settings/config-health"
import type { SocialIntegrationStatus, SocialProviderId } from "@/lib/social/types"

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
    oauth_select?: string
    selectAccount?: string
    integrationId?: string
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

  // 4. Fetch Connected Social Publishing Integrations & project strict secret-free DTOs (`T-038`)
  const socialRows = await db
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
      hasAccessToken: sql<boolean>`length(trim(${socialIntegrations.encryptedAccessToken})) > 0`,
      hasRefreshToken: sql<boolean>`coalesce(length(trim(${socialIntegrations.encryptedRefreshToken})), 0) > 0`,
      lastSyncedAt: socialIntegrations.lastSyncedAt,
      createdAt: socialIntegrations.createdAt,
    })
    .from(socialIntegrations)
    .orderBy(desc(socialIntegrations.createdAt))

  const safeSocialIntegrations: SafeSocialIntegration[] = socialRows.map((row) =>
    projectSafeSocialIntegrationDto({
      ...row,
      provider: row.provider as SocialProviderId,
      status: (row.status as SocialIntegrationStatus) || "ACTIVE",
    })
  )

  // 5. Fetch WhatsApp WABA Accounts & project strict secret-free DTOs (`T-038`)
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
      accountRole: whatsappAccounts.accountRole,
      isOnBizApp: whatsappAccounts.isOnBizApp,
      platformType: whatsappAccounts.platformType,
      intentFilterEnabled: whatsappAccounts.intentFilterEnabled,
      embeddedSignupConfigId: whatsappAccounts.embeddedSignupConfigId,
      hasAccessToken: sql<boolean>`length(trim(${whatsappAccounts.encryptedAccessToken})) > 0`,
      webhookVerifyToken: whatsappAccounts.webhookVerifyToken,
      isActive: whatsappAccounts.isActive,
      isDefault: whatsappAccounts.isDefault,
      createdAt: whatsappAccounts.createdAt,
      updatedAt: whatsappAccounts.updatedAt,
    })
    .from(whatsappAccounts)
    .orderBy(desc(whatsappAccounts.isDefault), desc(whatsappAccounts.createdAt))

  const officialWabaAccounts: SafeWhatsappAccount[] = waAccountRows
    .filter(
      (acc) =>
        acc.platformType !== "LINKED_DEVICE" &&
        !acc.phoneNumberId.startsWith("linked-")
    )
    .map((acc) => projectSafeWhatsappAccountDto(acc))

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

    staffUsers = allUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role === "super_admin" ? "super_admin" : "staff",
      isActive: u.isActive,
      createdAt: u.createdAt,
    }))
  }

  // 8. Safe Boolean Infrastructure Status & 9-Subsystem Config Health (`T-077`)
  const infrastructureStatus: SafeInfrastructureStatus = {
    openRouterConfigured: Boolean(env.OPENROUTER_API_KEY),
    geminiConfigured: Boolean(
      env.GOOGLE_GENERATIVE_AI_API_KEY || env.GEMINI_API_KEY
    ),
    r2Configured: Boolean(
      env.R2_BUCKET_NAME &&
        env.R2_ACCOUNT_ID &&
        env.R2_ACCESS_KEY_ID &&
        env.R2_SECRET_ACCESS_KEY
    ),
    triggerConfigured: Boolean(env.TRIGGER_SECRET_KEY),
    gotenbergConfigured: Boolean(
      env.GOTENBERG_API_URL && env.GOTENBERG_API_KEY
    ),
    appUrl:
      env.NEXT_PUBLIC_APP_URL ||
      env.BETTER_AUTH_URL ||
      "http://localhost:3000",
  }

  const configHealth = evaluateSystemConfigHealth(process.env, {
    activeWabaCount: officialWabaAccounts.filter((a) => a.isActive).length,
    activeSocialCount: safeSocialIntegrations.filter((s) => s.isActive).length,
    ibanVerified: settings?.ibanVerified ?? false,
  })

  const safeAgencySettings: AgencySettingsData | null = settings
    ? {
        agencyName: settings.agencyName,
        legalEntityName: settings.legalEntityName,
        tagline: settings.tagline,
        primaryWhatsapp: settings.primaryWhatsapp,
        secondaryPhone: settings.secondaryPhone,
        supportEmail: settings.supportEmail,
        officeAddress: settings.officeAddress,
        mapsEmbedUrl: settings.mapsEmbedUrl,
        facebookUrl: settings.facebookUrl,
        instagramUrl: settings.instagramUrl,
        youtubeUrl: settings.youtubeUrl,
        tiktokUrl: settings.tiktokUrl,
        workingHours: settings.workingHours,
        slaOverdueHours: settings.slaOverdueHours,
        sarToPkrRate: settings.sarToPkrRate,
        dtsLicense: settings.dtsLicense,
        moraLicense: settings.moraLicense,
        iataCode: settings.iataCode,
        ntnNumber: settings.ntnNumber,
        bankName: settings.bankName,
        accountTitle: settings.accountTitle,
        officialIban: settings.officialIban,
        ibanVerified: settings.ibanVerified,
      }
    : null

  return (
    <ConnectionsSettingsClient
      initialTab={resolvedSearchParams.tab}
      connectedProvider={resolvedSearchParams.connected}
      urlError={resolvedSearchParams.error}
      oauthSelectProvider={
        resolvedSearchParams.oauth_select || resolvedSearchParams.selectAccount
      }
      pendingIntegrationId={resolvedSearchParams.integrationId}
      agencySettings={safeAgencySettings}
      socialIntegrations={safeSocialIntegrations}
      whatsappAccounts={officialWabaAccounts}
      whatsappTemplates={waTemplateRows as SafeWhatsappTemplate[]}
      infrastructureStatus={infrastructureStatus}
      configHealth={configHealth}
      staffUsers={staffUsers}
      currentUserId={currentUser.id}
      currentUserRole={currentUserRole}
    />
  )
}
