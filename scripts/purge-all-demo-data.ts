import { eq, ilike, inArray, or, sql } from "drizzle-orm"
import * as schema from "../db/schema"
import { resolveGuardedScriptDatabaseUrl } from "./_guard"

async function purge(): Promise<void> {
  // Enforce safe non-production / --confirm-env guard BEFORE importing ../db
  resolveGuardedScriptDatabaseUrl()
  const { db, closeDatabasePool } = await import("../db")

  try {
    console.log("🚀 Starting database purge of demo and mock data...")

    const adilApps = await db.query.applications.findMany({
      where: or(
        eq(schema.applications.referenceNumber, "ART-2026-ADIL"),
        ilike(schema.applications.customerName, "%Barrister Adil%")
      ),
    })

    if (adilApps.length > 0) {
      const appIds = adilApps.map((a) => a.id)
      console.log(`Deleting ${appIds.length} demo application(s)...`)
      await db
        .delete(schema.applicationPayments)
        .where(inArray(schema.applicationPayments.applicationId, appIds))
      await db
        .delete(schema.applicationQuotes)
        .where(inArray(schema.applicationQuotes.applicationId, appIds))
      await db
        .delete(schema.applicationHotelStays)
        .where(inArray(schema.applicationHotelStays.applicationId, appIds))
      await db
        .delete(schema.applicationTransportSegments)
        .where(inArray(schema.applicationTransportSegments.applicationId, appIds))
      await db
        .delete(schema.applications)
        .where(inArray(schema.applications.id, appIds))
      console.log("   ✅ Demo applications & child records deleted.")
    } else {
      console.log("   ℹ️ No demo applications found.")
    }

    const demoPhones = [
      "03004112233",
      "03214223344",
      "03334334455",
      "03014445566",
    ]
    const deletedContacts = await db
      .delete(schema.outreachContacts)
      .where(inArray(schema.outreachContacts.whatsappNumber, demoPhones))
      .returning()
    console.log(
      `   ✅ Deleted ${deletedContacts.length} demo outreach contacts.`
    )

    const deletedPostAssets = await db.delete(schema.postAssets).returning()
    console.log(`   ✅ Deleted ${deletedPostAssets.length} demo post assets.`)

    const deletedFlyerPkgs = await db
      .delete(schema.supplierFlyerPackages)
      .returning()
    console.log(
      `   ✅ Deleted ${deletedFlyerPkgs.length} supplier flyer packages.`
    )

    const deletedFlyers = await db.delete(schema.supplierFlyers).returning()
    console.log(`   ✅ Deleted ${deletedFlyers.length} supplier flyers.`)

    const deletedSuppliers = await db.delete(schema.suppliers).returning()
    console.log(`   ✅ Deleted ${deletedSuppliers.length} demo suppliers.`)

    const deletedRules = await db
      .delete(schema.whatsappAutoReplyRules)
      .returning()
    console.log(`   ✅ Deleted ${deletedRules.length} demo auto-reply rules.`)

    const deletedQuickReplies = await db
      .delete(schema.whatsappQuickReplies)
      .returning()
    console.log(
      `   ✅ Deleted ${deletedQuickReplies.length} demo quick replies.`
    )

    const fakeWaAccounts = await db.query.whatsappAccounts.findMany({
      where: or(
        sql`${schema.whatsappAccounts.phoneNumberId} LIKE 'linked-%'`,
        eq(schema.whatsappAccounts.phoneNumberId, "1438405009255195"),
        eq(
          schema.whatsappAccounts.webhookVerifyToken,
          "linked_device_default_token"
        ),
        eq(
          schema.whatsappAccounts.webhookVerifyToken,
          "linked_device_secondary_token"
        )
      ),
    })

    if (fakeWaAccounts.length > 0) {
      const fakeWaIds = fakeWaAccounts.map((a) => a.id)
      await db
        .delete(schema.whatsappAccounts)
        .where(inArray(schema.whatsappAccounts.id, fakeWaIds))
      console.log(
        `   ✅ Deleted ${fakeWaIds.length} fake WhatsApp account rows.`
      )
    }

    const deletedSessions = await db
      .delete(schema.whatsappLinkedDeviceSessions)
      .where(sql`${schema.whatsappLinkedDeviceSessions.status} != 'connected'`)
      .returning()
    console.log(
      `   ✅ Deleted ${deletedSessions.length} unlinked WhatsApp linked-device session slots.`
    )

    const fakePilgrims = [
      "Dr. Farooq Malik",
      "Saima & Tariq Abbasi",
      "Salman Siddiqui",
    ]
    const deletedTestimonials = await db
      .delete(schema.testimonials)
      .where(inArray(schema.testimonials.pilgrimName, fakePilgrims))
      .returning()
    console.log(
      `   ✅ Deleted ${deletedTestimonials.length} fake testimonials.`
    )

    console.log("🎉 Database purge completed successfully!")
  } finally {
    await closeDatabasePool()
  }
}

purge()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error("Purge error:", err)
    process.exit(1)
  })
