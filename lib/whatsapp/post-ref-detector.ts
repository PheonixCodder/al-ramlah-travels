import { eq, or, sql, inArray } from "drizzle-orm"
import { db } from "@/db"
import {
  supplierFlyerPackages,
  postAssets,
  outreachContacts,
} from "@/db/schema/suppliers-and-marketing"
import { applications } from "@/db/schema/applications"

import {
  extractPostRefCodes,
  normalizePakistaniPhone,
  type PhoneNormalizationResult,
} from "./phone-utils"

export {
  extractPostRefCodes,
  normalizePakistaniPhone,
  type PhoneNormalizationResult,
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
