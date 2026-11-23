import crypto from "node:crypto"
import type {
  PilgrimDocumentStatus,
  PilgrimDocumentType,
  TravellerCategory,
} from "@/db/schema/applications"
import { isAuditLocalE2eMode } from "@/lib/env"
import { constantTimeEqualStrings, parsePhoneE164 } from "@/lib/phone"
import { decryptVaultSecret, encryptVaultSecret } from "@/lib/security/vault"
import {
  computePassportValidityCutoffDate,
  evaluatePassportExpiryValidity,
  getPilgrimDocumentSlotLabel,
  getTravellerDisplayTitle,
  MAX_PILGRIM_DOCUMENT_BYTES,
  PILGRIM_DOCUMENT_TYPES,
  PORTAL_TOKEN_PATTERN,
  resolveAnchorReturnDateIso,
  shouldResetPassportExpiryOverride,
  type PassportExpiryEvaluation,
  type PilgrimDocSlotType,
} from "@/lib/validations/pilgrim-documents"

export {
  computePassportValidityCutoffDate,
  evaluatePassportExpiryValidity,
  getPilgrimDocumentSlotLabel,
  getTravellerDisplayTitle,
  MAX_PILGRIM_DOCUMENT_BYTES,
  PILGRIM_DOCUMENT_TYPES,
  PORTAL_TOKEN_PATTERN,
  resolveAnchorReturnDateIso,
  shouldResetPassportExpiryOverride,
  type PassportExpiryEvaluation,
  type PilgrimDocSlotType,
}

export const DOC_PORTAL_SESSION_MAX_AGE_SECONDS = 86_400 // 24 hours

const DOC_PORTAL_SESSION_HKDF_INFO = Buffer.from(
  "alramlah:doc-portal-session:v1",
  "utf8"
)
const HEX_64_REGEX = /^[0-9a-fA-F]{64}$/
const SAFE_PATH_ID_REGEX = /^[A-Za-z0-9_-]{1,128}$/
const ALLOWED_STORAGE_EXTENSIONS = new Set(["jpg", "png", "webp", "pdf"])
const SLOT_KEY_SUFFIX_REGEX = /^[A-Za-z0-9_-]{8,128}\.(?:jpg|png|webp|pdf)$/

// ==========================================
// 1. PORTAL UNLOCK GATE (`AC-1`)
// ==========================================

export interface DocumentPortalUnlockGateInput {
  status: string | null | undefined
  source: string | null | undefined
  latestQuotePaymentStatus: string | null | undefined
  verifiedPaidSumPkr: number
}

export type DocumentPortalUnlockDecision =
  | { unlocked: true }
  | {
      unlocked: false
      httpStatus: 403
      reason: "hajj_inquiry" | "unapproved" | "closed" | "awaiting_deposit"
    }

/**
 * Evaluates live booking and verified deposit eligibility for `/documents/[token]`.
 * Never trusts stale stored booleans — always computed from current booking & payment state.
 */
export function evaluateDocumentPortalUnlockGate(
  input: DocumentPortalUnlockGateInput
): DocumentPortalUnlockDecision {
  if (input.source === "hajj_inquiry") {
    return { unlocked: false, httpStatus: 403, reason: "hajj_inquiry" }
  }

  if (input.status === "cancelled" || input.status === "rejected") {
    return { unlocked: false, httpStatus: 403, reason: "closed" }
  }

  if (input.status !== "approved") {
    return { unlocked: false, httpStatus: 403, reason: "unapproved" }
  }

  const hasVerifiedPaymentStatus =
    input.latestQuotePaymentStatus === "deposit_paid" ||
    input.latestQuotePaymentStatus === "paid_in_full"

  if (
    !hasVerifiedPaymentStatus ||
    !Number.isFinite(input.verifiedPaidSumPkr) ||
    input.verifiedPaidSumPkr <= 0
  ) {
    return { unlocked: false, httpStatus: 403, reason: "awaiting_deposit" }
  }

  return { unlocked: true }
}

// ==========================================
// 2. CAPABILITY TOKEN CRYPTO & VAULT (`AC-1`)
// ==========================================

/**
 * Computes the SHA-256 hex digest persisted in `applications.document_portal_token_hash`.
 */
export function hashDocumentPortalToken(rawToken: string): string {
  return crypto
    .createHash("sha256")
    .update(`portal:${rawToken.trim()}`, "utf8")
    .digest("hex")
}

/**
 * Compares a raw capability token against a stored SHA-256 hex hash in constant time.
 */
export function verifyDocumentPortalTokenHashConstantTime(
  rawToken: string | null | undefined,
  storedHash: string | null | undefined
): boolean {
  const trimmedToken = typeof rawToken === "string" ? rawToken.trim() : ""
  const trimmedHash =
    typeof storedHash === "string" ? storedHash.trim().toLowerCase() : ""

  const candidateDigest = crypto
    .createHash("sha256")
    .update(`portal:${trimmedToken}`, "utf8")
    .digest()

  const validStoredHex = HEX_64_REGEX.test(trimmedHash)
  const storedBuf = validStoredHex
    ? Buffer.from(trimmedHash, "hex")
    : Buffer.alloc(32)

  const hashesMatch = crypto.timingSafeEqual(candidateDigest, storedBuf)
  const validTokenFormat = PORTAL_TOKEN_PATTERN.test(trimmedToken)

  return validTokenFormat && validStoredHex && hashesMatch
}

/**
 * Generates a 256-bit CSPRNG `base64url` capability token, its SHA-256 lookup hash,
 * and its `v2:` HKDF-AES-256-GCM vault envelope.
 */
export function mintDocumentPortalTokenMaterial(): {
  rawToken: string
  tokenHash: string
  tokenEncrypted: string
} {
  const rawToken = crypto.randomBytes(32).toString("base64url")
  const tokenHash = hashDocumentPortalToken(rawToken)
  const tokenEncrypted = encryptVaultSecret(rawToken)
  return { rawToken, tokenHash, tokenEncrypted }
}

/**
 * Decrypts a `v2:` encrypted portal token back into `/documents/<rawToken>`,
 * returning `null` when empty.
 */
export function decryptDocumentPortalPath(
  tokenEncrypted: string | null | undefined
): string | null {
  if (typeof tokenEncrypted !== "string") return null
  const trimmed = tokenEncrypted.trim()
  if (!trimmed) return null

  const rawToken = decryptVaultSecret(trimmed).trim()
  if (!PORTAL_TOKEN_PATTERN.test(rawToken)) {
    return null
  }
  return `/documents/${rawToken}`
}

// ==========================================
// 3. TWO-FACTOR PHONE SESSION COOKIE (`AC-2`)
// ==========================================

export function getDocumentPortalCookieConfig(): {
  name: "__Host-art_doc_sess" | "art_doc_sess"
  secure: boolean
  httpOnly: true
  sameSite: "lax"
  path: "/"
  maxAge: number
} {
  const isStrictHttpsProd =
    process.env.NODE_ENV === "production" && !isAuditLocalE2eMode()

  return {
    name: isStrictHttpsProd ? "__Host-art_doc_sess" : "art_doc_sess",
    secure: isStrictHttpsProd,
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/" as const,
    maxAge: DOC_PORTAL_SESSION_MAX_AGE_SECONDS,
  }
}

function resolveSessionMasterKeyMaterial(
  rawSecret: string | undefined,
  isProd: boolean,
  allowDevFallback: boolean
): Buffer | null {
  const trimmed = rawSecret?.trim()
  if (trimmed) {
    if (HEX_64_REGEX.test(trimmed)) {
      return Buffer.from(trimmed, "hex")
    }
    if (isProd) {
      throw new Error(
        "ENCRYPTION_KEY must be a 64-character hexadecimal string (32 bytes) in production."
      )
    }
    return crypto.createHash("sha256").update(trimmed, "utf8").digest()
  }

  if (!allowDevFallback) {
    return null
  }

  if (isProd) {
    throw new Error(
      "ENCRYPTION_KEY is strictly required in production for document portal sessions."
    )
  }

  const devFallback =
    process.env.BETTER_AUTH_SECRET?.trim() ||
    "al-ramlah-travels-non-prod-vault-fallback-secret"
  return crypto.createHash("sha256").update(devFallback, "utf8").digest()
}

function deriveDocumentPortalSessionHmacKeys(): Buffer[] {
  const isProd = process.env.NODE_ENV === "production"
  const keys: Buffer[] = []

  const primaryMat = resolveSessionMasterKeyMaterial(
    process.env.ENCRYPTION_KEY,
    isProd,
    true
  )
  if (primaryMat) {
    keys.push(
      Buffer.from(
        crypto.hkdfSync(
          "sha256",
          primaryMat,
          Buffer.alloc(0),
          DOC_PORTAL_SESSION_HKDF_INFO,
          32
        )
      )
    )
  }

  const previousMat = resolveSessionMasterKeyMaterial(
    process.env.ENCRYPTION_KEY_PREVIOUS,
    isProd,
    false
  )
  if (previousMat) {
    keys.push(
      Buffer.from(
        crypto.hkdfSync(
          "sha256",
          previousMat,
          Buffer.alloc(0),
          DOC_PORTAL_SESSION_HKDF_INFO,
          32
        )
      )
    )
  }

  return keys
}

interface DocumentPortalSessionPayload {
  appId: string
  th: string
  exp: number
}

/**
 * Signs an `HttpOnly` pilgrim document session cookie (`<base64urlJsonPayload>.<hmacHex>`)
 * bound to both `applicationId` and `documentPortalTokenHash`.
 */
export function signDocumentPortalSessionCookie(input: {
  applicationId: string
  tokenHash: string
  nowMs?: number
}): string {
  const nowSec = Math.floor((input.nowMs ?? Date.now()) / 1000)
  const payload: DocumentPortalSessionPayload = {
    appId: input.applicationId,
    th: input.tokenHash,
    exp: nowSec + DOC_PORTAL_SESSION_MAX_AGE_SECONDS,
  }
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  )
  const hmacKey = deriveDocumentPortalSessionHmacKeys()[0]!
  const sigHex = crypto
    .createHmac("sha256", hmacKey)
    .update(payloadB64, "utf8")
    .digest("hex")

  return `${payloadB64}.${sigHex}`
}

/**
 * Verifies a signed document portal session cookie in constant time, ensuring:
 * 1. Valid HMAC signature (under current or rotated previous HKDF key)
 * 2. Unexpired (`exp > nowSec`)
 * 3. Exact `applicationId` and `tokenHash` binding (invalidating cookies on rotation)
 */
export function verifyDocumentPortalSessionCookie(
  cookieValue: string | null | undefined,
  expected: {
    applicationId: string
    tokenHash: string
    nowMs?: number
  }
): boolean {
  if (typeof cookieValue !== "string" || !cookieValue.trim()) {
    return false
  }

  const parts = cookieValue.trim().split(".")
  if (parts.length !== 2) {
    return false
  }

  const [payloadB64, rawSigHex] = parts as [string, string]
  if (!/^[A-Za-z0-9_-]+$/.test(payloadB64) || !HEX_64_REGEX.test(rawSigHex)) {
    return false
  }

  const providedSigBuf = Buffer.from(rawSigHex.toLowerCase(), "hex")
  const keys = deriveDocumentPortalSessionHmacKeys()
  let signatureValid = false

  for (const hmacKey of keys) {
    const expectedSigBuf = crypto
      .createHmac("sha256", hmacKey)
      .update(payloadB64, "utf8")
      .digest()
    if (
      providedSigBuf.byteLength === expectedSigBuf.byteLength &&
      crypto.timingSafeEqual(providedSigBuf, expectedSigBuf)
    ) {
      signatureValid = true
      break
    }
  }

  if (!signatureValid) {
    return false
  }

  let parsedUnknown: unknown
  try {
    const jsonText = Buffer.from(payloadB64, "base64url").toString("utf8")
    parsedUnknown = JSON.parse(jsonText) as unknown
  } catch {
    return false
  }

  if (
    !parsedUnknown ||
    typeof parsedUnknown !== "object" ||
    Array.isArray(parsedUnknown)
  ) {
    return false
  }

  const payload = parsedUnknown as Record<string, unknown>
  if (
    typeof payload.appId !== "string" ||
    typeof payload.th !== "string" ||
    typeof payload.exp !== "number" ||
    !Number.isFinite(payload.exp)
  ) {
    return false
  }

  const nowSec = Math.floor((expected.nowMs ?? Date.now()) / 1000)
  if (payload.exp <= nowSec) {
    return false
  }

  if (!expected.applicationId || !expected.tokenHash) {
    return false
  }

  const appIdMatches = constantTimeEqualStrings(
    payload.appId,
    expected.applicationId
  )
  const tokenHashMatches = constantTimeEqualStrings(
    payload.th,
    expected.tokenHash
  )

  return appIdMatches && tokenHashMatches
}

function normalizePortalPhoneDigits(
  rawPhone: string | null | undefined
): string | null {
  const parsed = parsePhoneE164(rawPhone)
  if (
    !parsed.valid ||
    parsed.nationalDigits.length < 9 ||
    /^(\d)\1{8,}$/.test(parsed.e164Digits)
  ) {
    return null
  }
  return parsed.e164Digits
}

function sha256Digest(value: string): Buffer {
  return crypto.createHash("sha256").update(value, "utf8").digest()
}

/**
 * Constant-time booking phone check comparing normalized E.164 digits (`>= 9` national digits)
 * against either `customerPhone` or `customerWhatsapp`.
 */
export function verifyPilgrimPortalPhoneConstantTime(
  submittedPhone: string | null | undefined,
  customerPhone: string | null | undefined,
  customerWhatsapp: string | null | undefined
): boolean {
  const submittedDigits = normalizePortalPhoneDigits(submittedPhone)
  const storedPhoneDigits = normalizePortalPhoneDigits(customerPhone)
  const storedWaDigits = normalizePortalPhoneDigits(customerWhatsapp)

  const submittedDigest = sha256Digest(
    submittedDigits ? `valid:${submittedDigits}` : "invalid:submitted"
  )
  const phoneDigest = sha256Digest(
    storedPhoneDigits ? `valid:${storedPhoneDigits}` : "empty:phone"
  )
  const waDigest = sha256Digest(
    storedWaDigits ? `valid:${storedWaDigits}` : "empty:whatsapp"
  )

  const matchPhone = crypto.timingSafeEqual(submittedDigest, phoneDigest)
  const matchWa = crypto.timingSafeEqual(submittedDigest, waDigest)

  if (!submittedDigits) {
    return false
  }

  return (
    Boolean(storedPhoneDigits && matchPhone) ||
    Boolean(storedWaDigits && matchWa)
  )
}

// ==========================================
// 4. TRAVELLER SLOT PLANNER (`AC-3`)
// ==========================================

export interface ExistingTravellerDocumentSnapshot {
  id: string
  docType: PilgrimDocumentType
  status: PilgrimDocumentStatus
  storageKey: string | null
}

export interface ExistingTravellerSlotSnapshot {
  id: string
  slotIndex: number
  category: TravellerCategory
  categoryOrdinal: number
  fullName: string | null
  passportNumber: string | null
  documents: readonly ExistingTravellerDocumentSnapshot[]
}

export interface TargetTravellerCounts {
  adults: number
  children: number
  infants: number
}

export interface DesiredTravellerSlot {
  slotIndex: number
  category: TravellerCategory
  categoryOrdinal: number
}

export interface TravellerSlotInsertPlan extends DesiredTravellerSlot {
  docTypesToInsert: readonly PilgrimDocumentType[]
}

export interface TravellerSlotUpdatePlan {
  travellerId: string
  category: TravellerCategory
  categoryOrdinal: number
  fromSlotIndex: number
  toSlotIndex: number
}

export interface MissingDocumentSlotInsertPlan {
  travellerId: string
  docType: PilgrimDocumentType
}

export interface TravellerSlotDeletePlan {
  travellerId: string
  slotIndex: number
  category: TravellerCategory
  categoryOrdinal: number
  isDestructive: boolean
  storageKeys: string[]
}

export interface TravellerSlotReconciliationPlan {
  orderedDesiredSlots: DesiredTravellerSlot[]
  slotsToInsert: TravellerSlotInsertPlan[]
  slotsToUpdate: TravellerSlotUpdatePlan[]
  missingDocSlotsToInsert: MissingDocumentSlotInsertPlan[]
  slotsToDelete: TravellerSlotDeletePlan[]
  hasDestructiveRemovals: boolean
  storageKeysToDelete: string[]
  needsMutation: boolean
  totalTargetSlots: number
}

/**
 * Pure slot reconciliation planner preserving existing `(category, categoryOrdinal)` rows
 * when counts grow, updating `slotIndex` sequentially (`adults` -> `children` -> `infants`),
 * and flagging excess rows that contain traveller PII or non-missing document uploads.
 */
export function planTravellerSlotReconciliation(
  existingTravellers: readonly ExistingTravellerSlotSnapshot[],
  targetCounts: TargetTravellerCounts
): TravellerSlotReconciliationPlan {
  const adults = Math.max(0, Math.floor(targetCounts.adults))
  const children = Math.max(0, Math.floor(targetCounts.children))
  const infants = Math.max(0, Math.floor(targetCounts.infants))

  const orderedDesiredSlots: DesiredTravellerSlot[] = []
  let nextSlotIndex = 1

  for (let i = 1; i <= adults; i++) {
    orderedDesiredSlots.push({
      slotIndex: nextSlotIndex++,
      category: "adult",
      categoryOrdinal: i,
    })
  }
  for (let i = 1; i <= children; i++) {
    orderedDesiredSlots.push({
      slotIndex: nextSlotIndex++,
      category: "child",
      categoryOrdinal: i,
    })
  }
  for (let i = 1; i <= infants; i++) {
    orderedDesiredSlots.push({
      slotIndex: nextSlotIndex++,
      category: "infant",
      categoryOrdinal: i,
    })
  }

  const existingByCatOrd = new Map<string, ExistingTravellerSlotSnapshot>()

  for (const row of existingTravellers) {
    const key = `${row.category}:${row.categoryOrdinal}`
    if (!existingByCatOrd.has(key)) {
      existingByCatOrd.set(key, row)
    }
  }

  const matchedIds = new Set<string>()
  const slotsToInsert: TravellerSlotInsertPlan[] = []
  const slotsToUpdate: TravellerSlotUpdatePlan[] = []
  const missingDocSlotsToInsert: MissingDocumentSlotInsertPlan[] = []

  for (const desired of orderedDesiredSlots) {
    const key = `${desired.category}:${desired.categoryOrdinal}`
    const existing = existingByCatOrd.get(key)

    if (!existing) {
      slotsToInsert.push({
        ...desired,
        docTypesToInsert: [...PILGRIM_DOCUMENT_TYPES],
      })
      continue
    }

    matchedIds.add(existing.id)

    if (existing.slotIndex !== desired.slotIndex) {
      slotsToUpdate.push({
        travellerId: existing.id,
        category: desired.category,
        categoryOrdinal: desired.categoryOrdinal,
        fromSlotIndex: existing.slotIndex,
        toSlotIndex: desired.slotIndex,
      })
    }

    const existingDocTypes = new Set(existing.documents.map((d) => d.docType))
    for (const docType of PILGRIM_DOCUMENT_TYPES) {
      if (!existingDocTypes.has(docType)) {
        missingDocSlotsToInsert.push({
          travellerId: existing.id,
          docType,
        })
      }
    }
  }

  const slotsToDelete: TravellerSlotDeletePlan[] = []
  for (const row of existingTravellers) {
    if (matchedIds.has(row.id)) {
      continue
    }

    const hasName = Boolean(row.fullName && row.fullName.trim().length > 0)
    const hasPassport = Boolean(
      row.passportNumber && row.passportNumber.trim().length > 0
    )
    const hasNonMissingDoc = row.documents.some(
      (doc) => doc.status !== "missing"
    )
    const storageKeys = row.documents
      .map((doc) => doc.storageKey?.trim() ?? "")
      .filter((key) => key.length > 0)

    slotsToDelete.push({
      travellerId: row.id,
      slotIndex: row.slotIndex,
      category: row.category,
      categoryOrdinal: row.categoryOrdinal,
      isDestructive: hasName || hasPassport || hasNonMissingDoc,
      storageKeys,
    })
  }

  const hasDestructiveRemovals = slotsToDelete.some(
    (slot) => slot.isDestructive
  )
  const storageKeysToDelete = Array.from(
    new Set(slotsToDelete.flatMap((slot) => slot.storageKeys))
  )
  const needsMutation =
    slotsToInsert.length > 0 ||
    slotsToUpdate.length > 0 ||
    missingDocSlotsToInsert.length > 0 ||
    slotsToDelete.length > 0

  return {
    orderedDesiredSlots,
    slotsToInsert,
    slotsToUpdate,
    missingDocSlotsToInsert,
    slotsToDelete,
    hasDestructiveRemovals,
    storageKeysToDelete,
    needsMutation,
    totalTargetSlots: orderedDesiredSlots.length,
  }
}

// ==========================================
// 5. STORAGE KEY PREFIX BUILDER & VALIDATOR (`AC-5`)
// ==========================================

/**
 * Builds the deterministic slot-scoped private R2 storage key:
 * `passports/<applicationId>/<travellerId>/<docType>-<uuid>.<ext>`.
 */
export function buildPilgrimDocumentStorageKey(input: {
  applicationId: string
  travellerId: string
  docType: PilgrimDocumentType
  uuid?: string
  extension: string
}): string {
  const appId = input.applicationId.trim()
  const travId = input.travellerId.trim()
  if (!SAFE_PATH_ID_REGEX.test(appId) || !SAFE_PATH_ID_REGEX.test(travId)) {
    throw new Error("Invalid applicationId or travellerId for storage key")
  }

  const rawUuid = (input.uuid ?? crypto.randomUUID()).trim()
  if (!SAFE_PATH_ID_REGEX.test(rawUuid) || rawUuid.length < 8) {
    throw new Error("Invalid uuid segment for pilgrim document storage key")
  }

  const rawExt = input.extension.trim().replace(/^\./, "").toLowerCase()
  const normalizedExt = rawExt === "jpeg" ? "jpg" : rawExt
  if (!ALLOWED_STORAGE_EXTENSIONS.has(normalizedExt)) {
    throw new Error(
      `Unsupported pilgrim document extension: ${input.extension}`
    )
  }

  return `passports/${appId}/${travId}/${input.docType}-${rawUuid}.${normalizedExt}`
}

/**
 * Verifies that a caller-supplied `storageKey` on commit strictly matches the expected
 * `passports/<applicationId>/<travellerId>/<docType>-<filename>.<ext>` slot prefix
 * without traversal or cross-booking substitution (`IDOR`).
 */
export function isValidPilgrimDocumentStorageKeyForSlot(
  storageKey: string,
  expected: {
    applicationId: string
    travellerId: string
    docType: PilgrimDocumentType
  }
): boolean {
  if (typeof storageKey !== "string" || !storageKey) {
    return false
  }
  if (
    storageKey.includes("\0") ||
    storageKey.includes("\\") ||
    storageKey.includes("..")
  ) {
    return false
  }
  if (
    !SAFE_PATH_ID_REGEX.test(expected.applicationId) ||
    !SAFE_PATH_ID_REGEX.test(expected.travellerId)
  ) {
    return false
  }

  const requiredPrefix = `passports/${expected.applicationId}/${expected.travellerId}/${expected.docType}-`
  if (!storageKey.startsWith(requiredPrefix)) {
    return false
  }

  const remainder = storageKey.slice(requiredPrefix.length)
  if (!remainder || remainder.includes("/")) {
    return false
  }

  return SLOT_KEY_SUFFIX_REGEX.test(remainder)
}
