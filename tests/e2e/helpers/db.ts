import crypto from "node:crypto"
import { hashPassword } from "better-auth/crypto"
import { eq, sql } from "drizzle-orm"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import pg from "pg"
import * as schema from "../../../db/schema"
import { encryptVaultSecret } from "../../../lib/security/vault"
import { assertAuditSafeEnvironment } from "../../helpers/audit-guard"
import {
  applyHermeticAuditEnvToProcess,
  E2E_META_APP_SECRET,
  E2E_WA_VERIFY_TOKEN,
} from "./env"

export const E2E_SUPER_ADMIN_EMAIL = "e2e-superadmin@alramlahtravels.com"
export const E2E_STAFF_EMAIL = "e2e-staff@alramlahtravels.com"
export const E2E_DEACTIVATED_EMAIL = "e2e-deactivated@alramlahtravels.com"
export const E2E_PASSWORD = "E2eStrongPass!2026"

export const E2E_PRIMARY_PHONE_ID = "e2e_phone_primary_1001"
export const E2E_COEXISTENCE_PHONE_ID = "e2e_phone_coex_1002"
export const E2E_WABA_ID = "e2e_waba_9001"
export const E2E_POST_CODE = "ART-E2E-PKG01"
export const E2E_OPEN_BATCH_CODE = "BATCH-E2E-DEC26"
export const E2E_SOLDOUT_BATCH_CODE = "BATCH-E2E-SOLDOUT"

let sharedPool: pg.Pool | null = null
let sharedDb: NodePgDatabase<typeof schema> | null = null

export function getE2eDb(): {
  pool: pg.Pool
  db: NodePgDatabase<typeof schema>
} {
  applyHermeticAuditEnvToProcess()
  assertAuditSafeEnvironment(process.env)

  if (!sharedPool || !sharedDb) {
    const connString = process.env.DATABASE_URL
    if (!connString) {
      throw new Error("[E2E-DB] DATABASE_URL missing after .env.audit load")
    }
    sharedPool = new pg.Pool({
      connectionString: connString,
      max: 6,
    })
    sharedDb = drizzle(sharedPool, { schema })
  }

  return { pool: sharedPool, db: sharedDb }
}

export async function closeE2eDb(): Promise<void> {
  if (sharedPool) {
    await sharedPool.end()
    sharedPool = null
    sharedDb = null
  }
}

export function signWhatsappWebhookBody(
  rawBody: string,
  secret: string = E2E_META_APP_SECRET
): string {
  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex")
  return `sha256=${digest}`
}

export async function clearAuthRateLimits(): Promise<void> {
  const { db } = getE2eDb()
  await db.execute(sql`DELETE FROM rate_limit`)
  await db.execute(sql`DELETE FROM rate_limit_buckets`)
}

async function upsertE2eCredentialUser(params: {
  id: string
  email: string
  name: string
  role: "super_admin" | "staff"
  isActive: boolean
  passwordHash: string
}): Promise<void> {
  const { db } = getE2eDb()

  const existing = await db.query.user.findFirst({
    where: eq(schema.user.email, params.email),
  })

  const userId = existing?.id ?? params.id

  if (existing) {
    await db
      .update(schema.user)
      .set({
        name: params.name,
        role: params.role,
        isActive: params.isActive,
        mustChangePassword: false,
        emailVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(schema.user.id, userId))
  } else {
    await db.insert(schema.user).values({
      id: userId,
      email: params.email,
      name: params.name,
      role: params.role,
      isActive: params.isActive,
      mustChangePassword: false,
      emailVerified: true,
    })
  }

  const existingAcc = await db.query.account.findFirst({
    where: eq(schema.account.userId, userId),
  })

  if (existingAcc) {
    await db
      .update(schema.account)
      .set({
        providerId: "credential",
        accountId: userId,
        password: params.passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(schema.account.id, existingAcc.id))
  } else {
    await db.insert(schema.account).values({
      id: `acc_${userId}`,
      userId,
      accountId: userId,
      providerId: "credential",
      password: params.passwordHash,
    })
  }
}

export interface E2eSeedFixturesSummary {
  primaryWaAccountId: string
  coexistenceWaAccountId: string
  openGroupPackageId: string
  otherGroupPackageId: string
  openDepartureId: string
  soldOutDepartureId: string
  supplierFlyerPackageId: string
  instagramIntegrationId: string
}

export async function ensureE2eBaselineFixtures(): Promise<E2eSeedFixturesSummary> {
  const { db } = getE2eDb()
  const passwordHash = await hashPassword(E2E_PASSWORD)

  await clearAuthRateLimits()

  await upsertE2eCredentialUser({
    id: "usr_e2e_superadmin",
    email: E2E_SUPER_ADMIN_EMAIL,
    name: "E2E Super Admin",
    role: "super_admin",
    isActive: true,
    passwordHash,
  })

  await upsertE2eCredentialUser({
    id: "usr_e2e_staff",
    email: E2E_STAFF_EMAIL,
    name: "E2E Staff Consultant",
    role: "staff",
    isActive: true,
    passwordHash,
  })

  await upsertE2eCredentialUser({
    id: "usr_e2e_deactivated",
    email: E2E_DEACTIVATED_EMAIL,
    name: "E2E Revocable Staff",
    role: "staff",
    isActive: true,
    passwordHash,
  })

  const encryptedWaToken = encryptVaultSecret("EAAMockWhatsappCloudTokenE2e")

  // Ensure Primary CUSTOMER_CARE WhatsApp Cloud API account
  let primaryWa = await db.query.whatsappAccounts.findFirst({
    where: eq(schema.whatsappAccounts.phoneNumberId, E2E_PRIMARY_PHONE_ID),
  })

  // Unset isDefault on any other account first if inserting default
  await db.execute(
    sql`UPDATE whatsapp_accounts SET is_default = false WHERE phone_number_id <> ${E2E_PRIMARY_PHONE_ID}`
  )

  if (primaryWa) {
    await db
      .update(schema.whatsappAccounts)
      .set({
        wabaId: E2E_WABA_ID,
        encryptedAccessToken: encryptedWaToken,
        webhookVerifyToken: E2E_WA_VERIFY_TOKEN,
        isActive: true,
        isDefault: true,
        autoReplyEnabled: true,
        welcomeGreetingEnabled: true,
        welcomeGreetingText:
          "Assalamu Alaikum! Welcome to Al Ramlah Travels Askari 10 Concierge.",
        accountRole: "CUSTOMER_CARE",
        platformType: "CLOUD_API",
        intentFilterEnabled: false,
      })
      .where(eq(schema.whatsappAccounts.id, primaryWa.id))
  } else {
    const [inserted] = await db
      .insert(schema.whatsappAccounts)
      .values({
        name: "Al Ramlah E2E Primary Care",
        phoneNumberId: E2E_PRIMARY_PHONE_ID,
        wabaId: E2E_WABA_ID,
        displayPhoneNumber: "+92 300 0001001",
        verifiedName: "Al Ramlah Travels Official",
        encryptedAccessToken: encryptedWaToken,
        webhookVerifyToken: E2E_WA_VERIFY_TOKEN,
        isActive: true,
        isDefault: true,
        autoReplyEnabled: true,
        welcomeGreetingEnabled: true,
        welcomeGreetingText:
          "Assalamu Alaikum! Welcome to Al Ramlah Travels Askari 10 Concierge.",
        accountRole: "CUSTOMER_CARE",
        platformType: "CLOUD_API",
        intentFilterEnabled: false,
      })
      .returning()
    primaryWa = inserted!
  }

  // Ensure Coexistence Founder line (`J16` personal chat suppression)
  let coexWa = await db.query.whatsappAccounts.findFirst({
    where: eq(schema.whatsappAccounts.phoneNumberId, E2E_COEXISTENCE_PHONE_ID),
  })
  if (coexWa) {
    await db
      .update(schema.whatsappAccounts)
      .set({
        wabaId: E2E_WABA_ID,
        encryptedAccessToken: encryptedWaToken,
        webhookVerifyToken: E2E_WA_VERIFY_TOKEN,
        isActive: true,
        isDefault: false,
        autoReplyEnabled: true,
        welcomeGreetingEnabled: true,
        accountRole: "COEXISTENCE_FOUNDER",
        isOnBizApp: true,
        platformType: "CLOUD_API",
        intentFilterEnabled: true,
      })
      .where(eq(schema.whatsappAccounts.id, coexWa.id))
  } else {
    const [insertedCoex] = await db
      .insert(schema.whatsappAccounts)
      .values({
        name: "Founder Coexistence Line E2E",
        phoneNumberId: E2E_COEXISTENCE_PHONE_ID,
        wabaId: E2E_WABA_ID,
        displayPhoneNumber: "+92 321 0001002",
        verifiedName: "Founder Personal & Business",
        encryptedAccessToken: encryptedWaToken,
        webhookVerifyToken: E2E_WA_VERIFY_TOKEN,
        isActive: true,
        isDefault: false,
        autoReplyEnabled: true,
        welcomeGreetingEnabled: true,
        accountRole: "COEXISTENCE_FOUNDER",
        isOnBizApp: true,
        platformType: "CLOUD_API",
        intentFilterEnabled: true,
      })
      .returning()
    coexWa = insertedCoex!
  }

  // Ensure baseline Transport Sectors (`JED_MAK`, `MAK_MED`, `MED_AIR`, `AIR_MED`, `MED_MAK`, `MAK_JED`, `MED_JED`) exist & are active
  const baselineSectors: Array<{
    code: string
    label: string
    originCity: string
    destinationCity: string
    originType: "airport" | "hotel"
    destinationType: "airport" | "hotel"
    sortOrder: number
  }> = [
    {
      code: "JED_MAK",
      label: "Jeddah Airport (JED) -> Makkah Hotel",
      originCity: "Jeddah",
      destinationCity: "Makkah",
      originType: "airport",
      destinationType: "hotel",
      sortOrder: 1,
    },
    {
      code: "MAK_MED",
      label: "Makkah Hotel -> Madinah Hotel",
      originCity: "Makkah",
      destinationCity: "Madinah",
      originType: "hotel",
      destinationType: "hotel",
      sortOrder: 2,
    },
    {
      code: "MED_AIR",
      label: "Madinah Hotel -> Madinah Airport (MED)",
      originCity: "Madinah",
      destinationCity: "Madinah",
      originType: "hotel",
      destinationType: "airport",
      sortOrder: 3,
    },
    {
      code: "AIR_MED",
      label: "Madinah Airport (MED) -> Madinah Hotel",
      originCity: "Madinah",
      destinationCity: "Madinah",
      originType: "airport",
      destinationType: "hotel",
      sortOrder: 4,
    },
    {
      code: "MED_MAK",
      label: "Madinah Hotel -> Makkah Hotel",
      originCity: "Madinah",
      destinationCity: "Makkah",
      originType: "hotel",
      destinationType: "hotel",
      sortOrder: 5,
    },
    {
      code: "MAK_JED",
      label: "Makkah Hotel -> Jeddah Airport (JED)",
      originCity: "Makkah",
      destinationCity: "Jeddah",
      originType: "hotel",
      destinationType: "airport",
      sortOrder: 6,
    },
    {
      code: "MED_JED",
      label: "Madinah Hotel -> Jeddah Airport (JED)",
      originCity: "Madinah",
      destinationCity: "Jeddah",
      originType: "hotel",
      destinationType: "airport",
      sortOrder: 7,
    },
  ]

  for (const sec of baselineSectors) {
    const existingSec = await db.query.transportSectors.findFirst({
      where: eq(schema.transportSectors.code, sec.code),
    })
    if (existingSec) {
      if (!existingSec.isActive) {
        await db
          .update(schema.transportSectors)
          .set({ isActive: true })
          .where(eq(schema.transportSectors.id, existingSec.id))
      }
    } else {
      await db.insert(schema.transportSectors).values({
        ...sec,
        isActive: true,
      })
    }
  }

  // Ensure Departure City (`LHE`) and Hotels exist from seed
  let lheCity = await db.query.departureCities.findFirst({
    where: eq(schema.departureCities.airportCode, "LHE"),
  })
  if (!lheCity) {
    const [createdCity] = await db
      .insert(schema.departureCities)
      .values({
        cityName: "Lahore",
        airportCode: "LHE",
        airportName: "Allama Iqbal International Airport",
        isActive: true,
      })
      .returning()
    lheCity = createdCity!
  }

  const existingOpenPkg = await db.query.groupPackages.findFirst({
    where: eq(schema.groupPackages.slug, "e2e-december-gold-umrah"),
  })

  let openPkg = existingOpenPkg
  if (openPkg) {
    const [updatedPkg] = await db
      .update(schema.groupPackages)
      .set({
        title: "December Signature 14-Day Gold Umrah",
        isFeatured: true,
        isActive: true,
        sortOrder: 0,
      })
      .where(eq(schema.groupPackages.id, openPkg.id))
      .returning()
    openPkg = updatedPkg!
  } else {
    const [createdPkg] = await db
      .insert(schema.groupPackages)
      .values({
        title: "December Signature 14-Day Gold Umrah",
        slug: "e2e-december-gold-umrah",
        tier: "gold",
        durationDays: 14,
        makkahNights: 7,
        madinahNights: 7,
        quadPricePkr: 315000,
        triplePricePkr: 340000,
        doublePricePkr: 385000,
        sharingPricePkr: 290000,
        infantPricePkr: 68000,
        isFeatured: true,
        isActive: true,
        sortOrder: 0,
      })
      .returning()
    openPkg = createdPkg!
  }

  const existingSecond = await db.query.groupPackages.findFirst({
    where: eq(schema.groupPackages.slug, "e2e-secondary-silver-umrah"),
  })

  let otherPkg = existingSecond
  if (otherPkg) {
    const [updatedSecond] = await db
      .update(schema.groupPackages)
      .set({
        title: "January Silver Haramain Group",
        isFeatured: true,
        isActive: true,
        sortOrder: 1,
      })
      .where(eq(schema.groupPackages.id, otherPkg.id))
      .returning()
    otherPkg = updatedSecond!
  } else {
    const [createdSecond] = await db
      .insert(schema.groupPackages)
      .values({
        title: "January Silver Haramain Group",
        slug: "e2e-secondary-silver-umrah",
        tier: "silver",
        durationDays: 14,
        makkahNights: 7,
        madinahNights: 7,
        quadPricePkr: 275000,
        triplePricePkr: 295000,
        doublePricePkr: 330000,
        sharingPricePkr: 255000,
        infantPricePkr: 65000,
        isFeatured: true,
        isActive: true,
        sortOrder: 1,
      })
      .returning()
    otherPkg = createdSecond!
  }

  // Upcoming open departure batch (`2026-12-18` -> `2027-01-01`, future relative to 2026-11-15!)
  let openDep = await db.query.groupDepartures.findFirst({
    where: eq(schema.groupDepartures.batchCode, E2E_OPEN_BATCH_CODE),
  })
  if (openDep) {
    await db
      .update(schema.groupDepartures)
      .set({
        packageId: openPkg.id,
        departureCityId: lheCity.id,
        departureDate: "2026-12-18",
        returnDate: "2027-01-01",
        totalSeats: 40,
        bookedSeats: 10,
        status: "open",
      })
      .where(eq(schema.groupDepartures.id, openDep.id))
  } else {
    const [insertedDep] = await db
      .insert(schema.groupDepartures)
      .values({
        packageId: openPkg.id,
        batchCode: E2E_OPEN_BATCH_CODE,
        departureCityId: lheCity.id,
        departureDate: "2026-12-18",
        returnDate: "2027-01-01",
        totalSeats: 40,
        bookedSeats: 10,
        status: "open",
        outboundFlightNumber: "SV-739",
        returnFlightNumber: "SV-738",
      })
      .returning()
    openDep = insertedDep!
  }

  // Sold-out departure batch (`J3` sold-out guard)
  let soldOutDep = await db.query.groupDepartures.findFirst({
    where: eq(schema.groupDepartures.batchCode, E2E_SOLDOUT_BATCH_CODE),
  })
  if (soldOutDep) {
    await db
      .update(schema.groupDepartures)
      .set({
        packageId: otherPkg.id,
        departureCityId: lheCity.id,
        departureDate: "2026-12-22",
        returnDate: "2027-01-05",
        totalSeats: 30,
        bookedSeats: 30,
        status: "sold_out",
      })
      .where(eq(schema.groupDepartures.id, soldOutDep.id))
  } else {
    const [insertedSoldOut] = await db
      .insert(schema.groupDepartures)
      .values({
        packageId: otherPkg.id,
        batchCode: E2E_SOLDOUT_BATCH_CODE,
        departureCityId: lheCity.id,
        departureDate: "2026-12-22",
        returnDate: "2027-01-05",
        totalSeats: 30,
        bookedSeats: 30,
        status: "sold_out",
      })
      .returning()
    soldOutDep = insertedSoldOut!
  }

  // Ensure Supplier + Flyer + Active `supplier_flyer_packages` row (`ART-E2E-PKG01` for `J12` & `J13`)
  let supplier = await db.query.suppliers.findFirst({
    where: eq(schema.suppliers.slug, "e2e-upsky-supplier"),
  })
  if (!supplier) {
    const [createdSupplier] = await db
      .insert(schema.suppliers)
      .values({
        name: "E2E Haramain Consolidator",
        slug: "e2e-upsky-supplier",
        codePrefix: "E2E",
        defaultCommissionMode: "included_in_flyer",
        defaultCommissionPkr: 20000,
        isActive: true,
      })
      .returning()
    supplier = createdSupplier!
  }

  let flyerPkg = await db.query.supplierFlyerPackages.findFirst({
    where: eq(schema.supplierFlyerPackages.postCode, E2E_POST_CODE),
  })

  if (!flyerPkg) {
    const [flyer] = await db
      .insert(schema.supplierFlyers)
      .values({
        flyerCode: "FLY-E2E-01",
        supplierId: supplier.id,
        title: "E2E December Luxury Flyer",
        rawFlyerImageUrl: "https://assets.alramlahtravels.com/e2e-flyer.png",
        airlineName: "Saudia",
        airlineIataCode: "SV",
        durationDays: 14,
        daysTitle: "14 DAYS",
        routePill: "LHE - JED / MED - LHE",
        commissionMode: "included_in_flyer",
        commissionPkr: 20000,
        status: "verified",
        receivedDate: "2026-11-15",
      })
      .returning()

    const [createdFlyerPkg] = await db
      .insert(schema.supplierFlyerPackages)
      .values({
        flyerId: flyer!.id,
        supplierId: supplier.id,
        postCode: E2E_POST_CODE,
        cardNumber: "01",
        outboundFlightNo: "SV 739",
        outboundDateLabel: "20 DEC 2026",
        outboundRoute: "LHE - JED",
        outboundDepTime: "04:15",
        outboundArrTime: "08:10",
        returnFlightNo: "SV 738",
        returnDateLabel: "03 JAN 2027",
        returnRoute: "MED - LHE",
        returnDepTime: "21:30",
        returnArrTime: "04:05",
        makkahNights: "07N",
        makkahHotelName: "Swissotel Makkah Clock Tower",
        makkahDistanceLabel: "100M",
        madinahNights: "07N",
        madinahHotelName: "Pullman Zamzam Madinah",
        madinahDistanceLabel: "150M",
        mealPlanLabel: "Breakfast Included",
        rawSharingPkr: 270000,
        rawQuadPkr: 290000,
        rawTriplePkr: 315000,
        rawDoublePkr: 355000,
        netSharingPkr: 250000,
        netQuadPkr: 270000,
        netTriplePkr: 295000,
        netDoublePkr: 335000,
        commissionPkr: 20000,
        retailSharingPkr: 270000,
        retailQuadPkr: 290000,
        retailTriplePkr: 315000,
        retailDoublePkr: 355000,
      })
      .returning()
    flyerPkg = createdFlyerPkg!
  }

  // Ensure Active Instagram Integration (`J20`)
  const encryptedIgToken = encryptVaultSecret("IGMockAccessTokenE2e_201")
  let igIntegration = await db.query.socialIntegrations.findFirst({
    where: eq(schema.socialIntegrations.internalAccountId, "ig_biz_e2e_201"),
  })
  if (igIntegration) {
    await db
      .update(schema.socialIntegrations)
      .set({
        encryptedAccessToken: encryptedIgToken,
        status: "ACTIVE",
        isActive: true,
        tokenExpiresAt: new Date(Date.now() + 30 * 86_400_000),
      })
      .where(eq(schema.socialIntegrations.id, igIntegration.id))
  } else {
    const [insertedIg] = await db
      .insert(schema.socialIntegrations)
      .values({
        provider: "instagram",
        name: "Al Ramlah Travels Instagram",
        handle: "@alramlahtravels",
        internalAccountId: "ig_biz_e2e_201",
        encryptedAccessToken: encryptedIgToken,
        status: "ACTIVE",
        isActive: true,
        tokenExpiresAt: new Date(Date.now() + 30 * 86_400_000),
        scopes: ["instagram_basic", "instagram_content_publish"],
        metadata: { pageId: "fb_page_e2e_101" },
      })
      .returning()
    igIntegration = insertedIg!
  }

  // Ensure an approved Meta WhatsApp template exists on primary account (`J15`, `J17`)
  const existingTpl = await db.query.whatsappTemplates.findFirst({
    where: eq(schema.whatsappTemplates.name, "umrah_followup_e2e"),
  })
  if (!existingTpl) {
    await db.insert(schema.whatsappTemplates).values({
      accountId: primaryWa.id,
      metaTemplateId: "meta_tpl_e2e_101",
      name: "umrah_followup_e2e",
      language: "en_US",
      category: "UTILITY",
      status: "APPROVED",
      bodyText:
        "Assalamu Alaikum {{1}}, your Al Ramlah Travels Umrah consultation {{2}} is ready.",
    })
  }

  return {
    primaryWaAccountId: primaryWa.id,
    coexistenceWaAccountId: coexWa.id,
    openGroupPackageId: openPkg.id,
    otherGroupPackageId: otherPkg.id,
    openDepartureId: openDep.id,
    soldOutDepartureId: soldOutDep.id,
    supplierFlyerPackageId: flyerPkg.id,
    instagramIntegrationId: igIntegration.id,
  }
}
