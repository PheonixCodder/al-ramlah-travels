import { eq, or, sql, inArray } from "drizzle-orm"
import { db } from "@/db"
import {
  supplierFlyerPackages,
  postAssets,
  outreachContacts,
} from "@/db/schema/suppliers-and-marketing"
import { applications } from "@/db/schema/applications"

/**
 * Extracts all `ART-...` reference codes from an inbound text string.
 * Example: "Salam, price for ART-AM-21D-01 or ref ART-2026-8812?"
 * Returns: ["ART-AM-21D-01", "ART-2026-8812"]
 */
export function extractPostRefCodes(text: string | null | undefined): string[] {
  if (!text) return []
  const matches = text.match(/\bART-[A-Za-z0-9_-]+\b/gi)
  if (!matches) return []
  const unique = Array.from(new Set(matches.map((c) => c.toUpperCase())))
  return unique
}

export interface ResolvedPostRef {
  type: "supplier_package" | "post_asset" | "application"
  code: string
  packageId?: string
  postAssetId?: string
  flyerId?: string
  applicationId?: string
}

/**
 * Resolves an `ART-...` code against supplier packages, post assets, or pilgrim applications.
 */
export async function resolvePostRefCode(
  code: string
): Promise<ResolvedPostRef | null> {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return null

  // 1. Check supplier flyer packages
  const [flyerPkg] = await db
    .select({
      id: supplierFlyerPackages.id,
      postCode: supplierFlyerPackages.postCode,
      flyerId: supplierFlyerPackages.flyerId,
    })
    .from(supplierFlyerPackages)
    .where(sql`upper(${supplierFlyerPackages.postCode}) = ${normalized}`)
    .limit(1)

  if (flyerPkg) {
    return {
      type: "supplier_package",
      code: flyerPkg.postCode,
      packageId: flyerPkg.id,
      flyerId: flyerPkg.flyerId,
    }
  }

  // 2. Check standalone post assets
  const [asset] = await db
    .select({
      id: postAssets.id,
      postCode: postAssets.postCode,
      flyerId: postAssets.flyerId,
      flyerPackageId: postAssets.flyerPackageId,
    })
    .from(postAssets)
    .where(sql`upper(${postAssets.postCode}) = ${normalized}`)
    .limit(1)

  if (asset) {
    return {
      type: "post_asset",
      code: asset.postCode,
      postAssetId: asset.id,
      flyerId: asset.flyerId,
      packageId: asset.flyerPackageId ?? undefined,
    }
  }

  // 3. Check customer applications
  const [app] = await db
    .select({
      id: applications.id,
      referenceNumber: applications.referenceNumber,
    })
    .from(applications)
    .where(sql`upper(${applications.referenceNumber}) = ${normalized}`)
    .limit(1)

  if (app) {
    return {
      type: "application",
      code: app.referenceNumber,
      applicationId: app.id,
    }
  }

  return null
}

export interface PhoneNormalizationResult {
  raw: string
  digitsOnly: string
  normalizedE164: string
  national03: string
  variants: string[]
}

/**
 * Normalizes phone numbers with special handling for Pakistani mobile format:
 * - `03xx-xxxxxxx` (11 digits)
 * - `923xx-xxxxxxx` (12 digits)
 * - `+923xx-xxxxxxx`
 */
export function normalizePakistaniPhone(
  rawPhone: string | null | undefined
): PhoneNormalizationResult {
  if (!rawPhone) {
    return {
      raw: "",
      digitsOnly: "",
      normalizedE164: "",
      national03: "",
      variants: [],
    }
  }

  const raw = rawPhone.trim()
  let digits = raw.replace(/\D/g, "")

  // Strip international dialing prefix 00
  if (digits.startsWith("00")) {
    digits = digits.slice(2)
  }

  let normalizedE164 = digits
  let national03 = digits

  if (digits.startsWith("92") && digits.length === 12) {
    normalizedE164 = digits
    national03 = "0" + digits.slice(2)
  } else if (digits.startsWith("03") && digits.length === 11) {
    normalizedE164 = "92" + digits.slice(1)
    national03 = digits
  } else if (digits.startsWith("3") && digits.length === 10) {
    normalizedE164 = "92" + digits
    national03 = "0" + digits
  }

  const variants = Array.from(
    new Set([
      digits,
      normalizedE164,
      `+${normalizedE164}`,
      national03,
      raw,
    ].filter(Boolean))
  )

  return {
    raw,
    digitsOnly: digits,
    normalizedE164,
    national03,
    variants,
  }
}

export interface UnlockCooldownResult {
  unlocked: boolean
  contactId: string | null
  contactName: string | null
}

/**
 * Unlocks the 14-day personal outreach cooldown for a contact upon an inbound WhatsApp message.
 * Sets `outreachContacts.lastInboundReplyAt = now` and updates status to `replied_active`.
 */
export async function unlockOutreachCooldownForPhone(
  phone: string
): Promise<UnlockCooldownResult> {
  const norm = normalizePakistaniPhone(phone)
  if (norm.variants.length === 0) {
    return { unlocked: false, contactId: null, contactName: null }
  }

  const [contact] = await db
    .select({
      id: outreachContacts.id,
      fullName: outreachContacts.fullName,
      interestStatus: outreachContacts.interestStatus,
    })
    .from(outreachContacts)
    .where(
      or(
        inArray(outreachContacts.whatsappNumber, norm.variants),
        inArray(outreachContacts.secondaryPhone, norm.variants)
      )
    )
    .limit(1)

  if (!contact) {
    return { unlocked: false, contactId: null, contactName: null }
  }

  const now = new Date()
  const currentStatus = contact.interestStatus
  const shouldUpdateStatus =
    currentStatus === "prospect" ||
    currentStatus === "contacted_cooldown" ||
    currentStatus === "interested"

  await db
    .update(outreachContacts)
    .set({
      lastInboundReplyAt: now,
      ...(shouldUpdateStatus ? { interestStatus: "replied_active" } : {}),
      updatedAt: now,
    })
    .where(eq(outreachContacts.id, contact.id))

  return {
    unlocked: true,
    contactId: contact.id,
    contactName: contact.fullName,
  }
}
