import type {
  SocialIntegrationStatus,
  SocialProviderId,
} from "@/lib/social/types"

export type SettingsTabKey =
  | "connections"
  | "whatsapp"
  | "infrastructure"
  | "agency"
  | "staff"
  | "health"

const SETTINGS_TAB_ALIAS_MAP: Record<string, SettingsTabKey> = {
  connections: "connections",
  social: "connections",
  whatsapp: "whatsapp",
  waba: "whatsapp",
  devices: "whatsapp",
  infrastructure: "infrastructure",
  gotenberg: "infrastructure",
  agency: "agency",
  staff: "staff",
  users: "staff",
  health: "health",
}

export function resolveSettingsTab(
  rawTab?: string | null,
  fallbackTab?: string | null
): SettingsTabKey {
  const normalizedPrimary = rawTab?.trim().toLowerCase() ?? ""
  if (normalizedPrimary && SETTINGS_TAB_ALIAS_MAP[normalizedPrimary]) {
    return SETTINGS_TAB_ALIAS_MAP[normalizedPrimary]!
  }

  const normalizedFallback = fallbackTab?.trim().toLowerCase() ?? ""
  if (normalizedFallback && SETTINGS_TAB_ALIAS_MAP[normalizedFallback]) {
    return SETTINGS_TAB_ALIAS_MAP[normalizedFallback]!
  }

  return "connections"
}

const SECRET_KEY_PATTERN =
  /(encrypt|token|secret|password|cred|auth[_-]?key|private[_-]?key|api[_-]?key)/i

export function maskSecretLast4(
  rawValue: string | null | undefined
): string | null {
  if (typeof rawValue !== "string") {
    return null
  }
  const trimmed = rawValue.trim()
  if (!trimmed) {
    return null
  }
  if (trimmed.length < 8) {
    return "••••••••"
  }
  return `••••••••${trimmed.slice(-4)}`
}

export interface SafeMetadataCandidatePreview {
  provider?: string
  internalAccountId?: string
  name?: string
  handle?: string | null
  avatarUrl?: string | null
}

function sanitizeMetadataValue(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || value === undefined) {
    return value ?? null
  }
  if (
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMetadataValue(item, depth + 1))
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY_PATTERN.test(k)) {
        out[`has_${k.replace(/[^a-zA-Z0-9]/g, "_")}`] = Boolean(
          typeof v === "string" ? v.trim().length > 0 : v
        )
        continue
      }
      out[k] = sanitizeMetadataValue(v, depth + 1)
    }
    return out
  }
  return null
}

export function sanitizeSocialIntegrationMetadataForClient(
  rawMeta: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!rawMeta || typeof rawMeta !== "object" || Array.isArray(rawMeta)) {
    return {}
  }

  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(rawMeta)) {
    if (key === "pendingCandidates" && Array.isArray(value)) {
      const safeCandidates: SafeMetadataCandidatePreview[] = value
        .filter(
          (item): item is Record<string, unknown> =>
            Boolean(item) && typeof item === "object" && !Array.isArray(item)
        )
        .map((cand) => ({
          provider:
            typeof cand.provider === "string" ? cand.provider : undefined,
          internalAccountId:
            typeof cand.internalAccountId === "string"
              ? cand.internalAccountId
              : undefined,
          name: typeof cand.name === "string" ? cand.name : undefined,
          handle:
            typeof cand.handle === "string" || cand.handle === null
              ? cand.handle
              : undefined,
          avatarUrl:
            typeof cand.avatarUrl === "string" || cand.avatarUrl === null
              ? cand.avatarUrl
              : undefined,
        }))
      sanitized.pendingCandidates = safeCandidates
      sanitized.pendingCandidatesCount = safeCandidates.length
      continue
    }

    if (key === "encryptedPageAccessToken") {
      sanitized.hasPageAccessToken =
        typeof value === "string" && value.trim().length > 0
      continue
    }

    if (SECRET_KEY_PATTERN.test(key)) {
      sanitized[`has_${key.replace(/[^a-zA-Z0-9]/g, "_")}`] = Boolean(
        typeof value === "string" ? value.trim().length > 0 : value
      )
      continue
    }

    sanitized[key] = sanitizeMetadataValue(value, 1)
  }

  return sanitized
}

export interface RawSocialIntegrationLike {
  id: string
  provider: SocialProviderId
  name: string
  handle: string | null
  avatarUrl: string | null
  internalAccountId: string
  status: SocialIntegrationStatus
  isActive: boolean
  tokenExpiresAt: Date | null
  scopes: string[] | null
  metadata: Record<string, unknown> | null
  lastSyncedAt: Date | null
  createdAt: Date
  encryptedAccessToken?: string | null
  accessTokenEncrypted?: string | null
  encryptedRefreshToken?: string | null
  refreshTokenEncrypted?: string | null
  hasAccessToken?: boolean
  hasRefreshToken?: boolean
}

export interface SafeSocialIntegrationDto {
  id: string
  provider: SocialProviderId
  name: string
  handle: string | null
  avatarUrl: string | null
  internalAccountId: string
  status: SocialIntegrationStatus
  isActive: boolean
  hasAccessToken: boolean
  hasRefreshToken: boolean
  tokenExpiresAt: Date | null
  scopes: string[]
  metadata: Record<string, unknown>
  lastSyncedAt: Date | null
  createdAt: Date
}

export function projectSafeSocialIntegrationDto(
  row: RawSocialIntegrationLike
): SafeSocialIntegrationDto {
  const accessToken = row.encryptedAccessToken ?? row.accessTokenEncrypted
  const refreshToken = row.encryptedRefreshToken ?? row.refreshTokenEncrypted

  return {
    id: row.id,
    provider: row.provider,
    name: row.name,
    handle: row.handle,
    avatarUrl: row.avatarUrl,
    internalAccountId: row.internalAccountId,
    status: row.status,
    isActive: row.isActive,
    hasAccessToken:
      typeof row.hasAccessToken === "boolean"
        ? row.hasAccessToken
        : typeof accessToken === "string"
          ? accessToken.trim().length > 0
          : false,
    hasRefreshToken:
      typeof row.hasRefreshToken === "boolean"
        ? row.hasRefreshToken
        : typeof refreshToken === "string" && refreshToken.trim().length > 0,
    tokenExpiresAt: row.tokenExpiresAt,
    scopes: Array.isArray(row.scopes) ? [...row.scopes] : [],
    metadata: sanitizeSocialIntegrationMetadataForClient(row.metadata),
    lastSyncedAt: row.lastSyncedAt,
    createdAt: row.createdAt,
  }
}

export interface RawWhatsappAccountLike {
  id: string
  name: string
  phoneNumberId: string
  wabaId: string
  displayPhoneNumber: string
  verifiedName: string | null
  qualityRating: string | null
  messagingLimit: string | null
  encryptedAccessToken?: string | null
  accessTokenEncrypted?: string | null
  webhookVerifyToken?: string | null
  hasAccessToken?: boolean
  isActive: boolean
  isDefault: boolean
  accountRole?: string | null
  isOnBizApp?: boolean | null
  platformType?: string | null
  intentFilterEnabled?: boolean | null
  embeddedSignupConfigId?: string | null
  createdAt: Date | string
  updatedAt: Date | string
}

export interface SafeWhatsappAccountDto {
  id: string
  name: string
  phoneNumberId: string
  wabaId: string
  displayPhoneNumber: string
  verifiedName: string | null
  qualityRating: string | null
  messagingLimit: string | null
  hasAccessToken: boolean
  hasVerifyToken: boolean
  verifyTokenPreview: string | null
  isActive: boolean
  isDefault: boolean
  accountRole?: string | null
  isOnBizApp?: boolean | null
  platformType?: string | null
  intentFilterEnabled?: boolean | null
  embeddedSignupConfigId?: string | null
  createdAt: Date | string
  updatedAt: Date | string
}

export function projectSafeWhatsappAccountDto(
  row: RawWhatsappAccountLike
): SafeWhatsappAccountDto {
  const accessToken = row.encryptedAccessToken ?? row.accessTokenEncrypted
  const verifyToken = row.webhookVerifyToken

  return {
    id: row.id,
    name: row.name,
    phoneNumberId: row.phoneNumberId,
    wabaId: row.wabaId,
    displayPhoneNumber: row.displayPhoneNumber,
    verifiedName: row.verifiedName,
    qualityRating: row.qualityRating,
    messagingLimit: row.messagingLimit,
    hasAccessToken:
      typeof row.hasAccessToken === "boolean"
        ? row.hasAccessToken
        : typeof accessToken === "string"
          ? accessToken.trim().length > 0
          : false,
    hasVerifyToken:
      typeof verifyToken === "string" && verifyToken.trim().length > 0,
    verifyTokenPreview: maskSecretLast4(verifyToken),
    isActive: row.isActive,
    isDefault: row.isDefault,
    accountRole: row.accountRole ?? null,
    isOnBizApp: row.isOnBizApp ?? null,
    platformType: row.platformType ?? null,
    intentFilterEnabled: row.intentFilterEnabled ?? null,
    embeddedSignupConfigId: row.embeddedSignupConfigId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export interface RawLinkedDeviceLike {
  id: string
  sessionKey: string
  label: string
  phoneNumber: string | null
  pushName: string | null
  status: string
  groupsSyncedCount: number
  lastError: string | null
  lastConnectedAt: Date | string | null
  lastSyncedAt: Date | string | null
  encryptedAuthCreds?: string | null
  encryptedAuthKeys?: string | null
}

export interface SafeLinkedDeviceDto {
  id: string
  sessionKey: string
  label: string
  phoneNumber: string | null
  pushName: string | null
  status: string
  groupsSyncedCount: number
  lastError: string | null
  lastConnectedAt: Date | string | null
  lastSyncedAt: Date | string | null
  hasAuthCreds: boolean
  hasAuthKeys: boolean
}

export function projectSafeLinkedDeviceDto(
  row: RawLinkedDeviceLike
): SafeLinkedDeviceDto {
  return {
    id: row.id,
    sessionKey: row.sessionKey,
    label: row.label,
    phoneNumber: row.phoneNumber,
    pushName: row.pushName,
    status: row.status,
    groupsSyncedCount: row.groupsSyncedCount,
    lastError: row.lastError,
    lastConnectedAt: row.lastConnectedAt,
    lastSyncedAt: row.lastSyncedAt,
    hasAuthCreds:
      typeof row.encryptedAuthCreds === "string" &&
      row.encryptedAuthCreds.trim().length > 0,
    hasAuthKeys:
      typeof row.encryptedAuthKeys === "string" &&
      row.encryptedAuthKeys.trim().length > 0,
  }
}
