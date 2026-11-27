import crypto from "node:crypto"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { eq, or, sql } from "drizzle-orm"
import { closeDatabasePool, db } from "./index"
import * as schema from "./schema"
import { provisionStaffAccountInternal } from "../lib/auth"
import { resolveGuardedScriptDatabaseUrl } from "../scripts/_guard"

export interface RunSeedOptions {
  closePool?: boolean
  argv?: readonly string[]
}

function resolveBootstrapPassword(): string {
  const configured = process.env.ADMIN_BOOTSTRAP_PASSWORD?.trim() ?? ""
  const isProd = process.env.NODE_ENV === "production"

  if (isProd && configured.length < 12) {
    throw new Error(
      "ADMIN_BOOTSTRAP_PASSWORD (>= 12 chars) is required when running db/seed.ts in NODE_ENV=production."
    )
  }

  if (configured.length >= 12) {
    return configured
  }

  return `Art!${crypto.randomBytes(16).toString("base64url")}`
}

function getTodayPktIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function addPktDaysIso(baseIso: string, daysOffset: number): string {
  const [y, m, d] = baseIso.split("-").map((part) => Number(part))
  const utcNoon = Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0)
  const shifted = new Date(utcNoon + daysOffset * 86_400_000)
  const year = shifted.getUTCFullYear()
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0")
  const day = String(shifted.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export async function runSeed(options?: RunSeedOptions): Promise<void> {
  resolveGuardedScriptDatabaseUrl(options?.argv ?? process.argv)
  console.log("🌱 Starting Al Ramlah Travels database seed...")
  const todayPktIso = getTodayPktIso()
  const hotelValidFrom = addPktDaysIso(todayPktIso, -30)
  const hotelValidUntil = addPktDaysIso(todayPktIso, 400)

  // ==========================================
  // 1. ADMIN & STAFF ACCOUNTS (BETTER AUTH)
  // ==========================================
  console.log("👤 Seeding admin & staff accounts...")
  const bootstrapPassword = resolveBootstrapPassword()

  const adminProvisioned = await provisionStaffAccountInternal({
    email: "admin@alramlahtravels.com",
    password: bootstrapPassword,
    name: "Muhammad Tariq (Super Admin)",
    role: "super_admin",
    mustChangePassword: true,
  })
  const adminUserId = adminProvisioned.id

  if (adminProvisioned.created) {
    console.log(
      "   ✅ Provisioned Super Admin (admin@alramlahtravels.com) with mustChangePassword=true."
    )
  } else {
    console.log("   ✅ Super Admin exists (existing credentials preserved).")
  }

  const staffProvisioned = await provisionStaffAccountInternal({
    email: "staff@alramlahtravels.com",
    password: bootstrapPassword,
    name: "Bilal Khan (Senior Quoting Agent)",
    role: "staff",
    mustChangePassword: true,
  })

  if (staffProvisioned.created) {
    console.log(
      "   ✅ Provisioned Staff (staff@alramlahtravels.com) with mustChangePassword=true."
    )
  } else {
    console.log("   ✅ Staff exists (existing credentials preserved).")
  }

  // ==========================================
  // 2. AGENCY SETTINGS (SINGLETON — OD-10)
  // ==========================================
  console.log("🏢 Seeding agency settings...")
  const verifiedOfficeAddress =
    "Office No. 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt, Pakistan"

  await db
    .insert(schema.agencySettings)
    .values({
      id: "default",
      agencyName: "Al Ramlah Travels",
      legalEntityName: "Al Ramlah Travels",
      tagline: "Where Purpose Meets Excellence",
      primaryWhatsapp: "03274029701",
      secondaryPhone: "03190462638",
      supportEmail: "alramlahtravels@gmail.com",
      officeAddress: verifiedOfficeAddress,
      mapsEmbedUrl:
        "https://maps.google.com/?q=Sector+C+Askari+10+Airport+Road+Lahore+Cantt",
      facebookUrl: "https://facebook.com/alramlahtravels",
      instagramUrl: "https://instagram.com/alramlahtravels",
      youtubeUrl: "https://youtube.com/@alramlahtravels",
      tiktokUrl: "https://tiktok.com/@alramlahtravels",
      workingHours: "Monday to Saturday: 9:00 AM to 8:00 PM PKT",
      slaOverdueHours: 24,
      sarToPkrRate: 75,
      officialIban: null,
      ibanVerified: false,
      updatedByUserId: adminUserId,
    })
    .onConflictDoUpdate({
      target: schema.agencySettings.id,
      set: {
        agencyName: "Al Ramlah Travels",
        legalEntityName: "Al Ramlah Travels",
        tagline: "Where Purpose Meets Excellence",
        primaryWhatsapp: "03274029701",
        secondaryPhone: "03190462638",
        supportEmail: "alramlahtravels@gmail.com",
        officeAddress: verifiedOfficeAddress,
        mapsEmbedUrl:
          "https://maps.google.com/?q=Sector+C+Askari+10+Airport+Road+Lahore+Cantt",
        facebookUrl: sql`COALESCE(${schema.agencySettings.facebookUrl}, excluded.facebook_url)`,
        instagramUrl: sql`COALESCE(${schema.agencySettings.instagramUrl}, excluded.instagram_url)`,
        youtubeUrl: sql`COALESCE(${schema.agencySettings.youtubeUrl}, excluded.youtube_url)`,
        tiktokUrl: sql`COALESCE(${schema.agencySettings.tiktokUrl}, excluded.tiktok_url)`,
        workingHours: "Monday to Saturday: 9:00 AM to 8:00 PM PKT",
      },
    })
  console.log(
    "   ✅ Agency settings configured (Askari 10 Lahore HQ, ibanVerified=false)."
  )

  // ==========================================
  // 3. DYNAMIC VISA RATES (T-007 excluded.* upsert)
  // ==========================================
  console.log("🛂 Seeding visa rates...")
  await db
    .insert(schema.visaRates)
    .values([
      {
        tier: "short_term",
        label: "Standard Tourist / Umrah Visa (30 Days or Fewer)",
        maxDays: 30,
        pricePkr: 42500,
        priceSar: 470,
        withoutMasarPriceSar: 470,
        withMasar10DaysSar: 500,
        withMasar15DaysSar: 515,
        withMasar21DaysSar: 530,
        withMasar28DaysSar: 545,
        notes:
          "Valid for single or multiple entry within 30 days of arrival. Includes mandatory Saudi health insurance.",
        updatedByUserId: adminUserId,
      },
      {
        tier: "long_term",
        label: "Extended Tourist / Umrah Visa (Up to 90 Days)",
        maxDays: 90,
        pricePkr: 68000,
        priceSar: 750,
        withoutMasarPriceSar: 750,
        withMasar10DaysSar: 750,
        withMasar15DaysSar: 750,
        withMasar21DaysSar: 750,
        withMasar28DaysSar: 750,
        notes:
          "Valid for comprehensive pilgrimage and tourism stays up to 90 days. Includes full medical insurance coverage.",
        updatedByUserId: adminUserId,
      },
    ])
    .onConflictDoUpdate({
      target: schema.visaRates.tier,
      set: {
        label: sql`excluded.label`,
        maxDays: sql`excluded.max_days`,
        pricePkr: sql`excluded.price_pkr`,
        priceSar: sql`excluded.price_sar`,
        withoutMasarPriceSar: sql`excluded.without_masar_price_sar`,
        withMasar10DaysSar: sql`excluded.with_masar_10_days_sar`,
        withMasar15DaysSar: sql`excluded.with_masar_15_days_sar`,
        withMasar21DaysSar: sql`excluded.with_masar_21_days_sar`,
        withMasar28DaysSar: sql`excluded.with_masar_28_days_sar`,
        notes: sql`excluded.notes`,
        updatedAt: new Date(),
      },
    })
  console.log(
    "   ✅ Visa rates configured idempotently (Short: 30d / 470 SAR / PKR 42,500, Long: 90d / 750 SAR / PKR 68,000)."
  )

  // ==========================================
  // 4. DEPARTURE CITIES (8 PAKISTANI HUBS)
  // ==========================================
  console.log("🛫 Seeding departure cities...")
  const citiesData = [
    {
      cityName: "Islamabad / Rawalpindi",
      airportCode: "ISB",
      airportName: "Islamabad International Airport",
      sortOrder: 1,
    },
    {
      cityName: "Lahore",
      airportCode: "LHE",
      airportName: "Allama Iqbal International Airport",
      sortOrder: 2,
    },
    {
      cityName: "Karachi",
      airportCode: "KHI",
      airportName: "Jinnah International Airport",
      sortOrder: 3,
    },
    {
      cityName: "Peshawar",
      airportCode: "PEW",
      airportName: "Bacha Khan International Airport",
      sortOrder: 4,
    },
    {
      cityName: "Multan",
      airportCode: "MUX",
      airportName: "Multan International Airport",
      sortOrder: 5,
    },
    {
      cityName: "Sialkot",
      airportCode: "SKT",
      airportName: "Sialkot International Airport",
      sortOrder: 6,
    },
    {
      cityName: "Faisalabad",
      airportCode: "LYP",
      airportName: "Faisalabad International Airport",
      sortOrder: 7,
    },
    {
      cityName: "Quetta",
      airportCode: "UET",
      airportName: "Quetta International Airport",
      sortOrder: 8,
    },
  ]

  for (const c of citiesData) {
    await db
      .insert(schema.departureCities)
      .values(c)
      .onConflictDoUpdate({
        target: schema.departureCities.airportCode,
        set: { cityName: c.cityName, airportName: c.airportName },
      })
  }
  console.log("   ✅ 8 Pakistani departure gateways seeded.")

  // ==========================================
  // 5. AIRLINES (6 MAJOR CARRIERS)
  // ==========================================
  console.log("✈️ Seeding airlines...")
  const airlinesData = [
    {
      name: "Saudia (Saudi Arabian Airlines)",
      iataCode: "SV",
      logoUrl:
        "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=128",
      isDirectAvailable: true,
      isConnectingAvailable: false,
      sortOrder: 1,
    },
    {
      name: "Pakistan International Airlines (PIA)",
      iataCode: "PK",
      logoUrl:
        "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=128",
      isDirectAvailable: true,
      isConnectingAvailable: true,
      sortOrder: 2,
    },
    {
      name: "Emirates",
      iataCode: "EK",
      logoUrl:
        "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=128",
      isDirectAvailable: false,
      isConnectingAvailable: true,
      sortOrder: 3,
    },
    {
      name: "Qatar Airways",
      iataCode: "QR",
      logoUrl:
        "https://images.unsplash.com/photo-1520437358207-323b43b50729?w=128",
      isDirectAvailable: false,
      isConnectingAvailable: true,
      sortOrder: 4,
    },
    {
      name: "Airblue",
      iataCode: "PA",
      logoUrl:
        "https://images.unsplash.com/photo-1506015391300-4802dc74de2e?w=128",
      isDirectAvailable: true,
      isConnectingAvailable: false,
      sortOrder: 5,
    },
    {
      name: "SereneAir",
      iataCode: "ER",
      logoUrl:
        "https://images.unsplash.com/photo-1474302770737-173ee21bab63?w=128",
      isDirectAvailable: true,
      isConnectingAvailable: false,
      sortOrder: 6,
    },
  ]

  for (const a of airlinesData) {
    await db
      .insert(schema.airlines)
      .values(a)
      .onConflictDoUpdate({
        target: schema.airlines.iataCode,
        set: { name: a.name, isDirectAvailable: a.isDirectAvailable },
      })
  }
  console.log("   ✅ 6 major carriers seeded.")

  // ==========================================
  // 6. HOTELS (MAKKAH & MADINAH 1★, 2★, 3★, 4★, 5★)
  // ==========================================
  console.log("🏨 Seeding hotels...")
  const hotelsData = [
    // Makkah 5-Star
    {
      name: "Fairmont Makkah Clock Royal Tower",
      city: "makkah" as const,
      starRating: 5,
      distanceMeters: 0,
      distanceLabel: "0m Courtyard Access (Direct Haram / Clock Tower)",
      accessType: "walking" as const,
      imageUrl:
        "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?w=800",
      galleryUrls: [
        "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800",
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800",
      ],
      amenities: [
        "Kaaba View Suites",
        "Private Elevators to Haram",
        "Executive Lounge",
        "24/7 Butler Service",
      ],
      allowsSharedRooms: true,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"] as (
        | "double"
        | "triple"
        | "quad"
      )[],
      sharingPriceSar: 450,
      roomPriceSar: 1250,
      quadPriceSar: 1650,
      triplePriceSar: 1450,
      doublePriceSar: 1250,
      validFrom: hotelValidFrom,
      validUntil: hotelValidUntil,
      locationNotes: "Direct Clock Tower Courtyard (Ajyad Gate)",
      isFeatured: true,
      sortOrder: 1,
    },
    {
      name: "Swissôtel Al Maqam Makkah",
      city: "makkah" as const,
      starRating: 5,
      distanceMeters: 50,
      distanceLabel: "50m Direct Courtyard (Abraj Al Bait Complex)",
      accessType: "walking" as const,
      imageUrl:
        "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800",
      galleryUrls: [
        "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800",
      ],
      amenities: [
        "Direct Mall & Haram Access",
        "Al Khairat Executive Lounge",
        "Soundproof Rooms",
      ],
      allowsSharedRooms: true,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"] as (
        | "double"
        | "triple"
        | "quad"
      )[],
      sharingPriceSar: 380,
      roomPriceSar: 980,
      quadPriceSar: 1350,
      triplePriceSar: 1150,
      doublePriceSar: 980,
      validFrom: hotelValidFrom,
      validUntil: hotelValidUntil,
      locationNotes: "Abraj Al Bait Complex - Direct Mall & Courtyard Access",
      isFeatured: true,
      sortOrder: 2,
    },
    {
      name: "Jabal Omar Hyatt Regency Makkah",
      city: "makkah" as const,
      starRating: 5,
      distanceMeters: 100,
      distanceLabel: "100m from King Fahad Gate (Ibrahim Al Khalil Rd)",
      accessType: "walking" as const,
      imageUrl:
        "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800",
      galleryUrls: [
        "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800",
      ],
      amenities: [
        "Direct Prayer Audio Feed",
        "Spacious Family Suites",
        "Tea Lounge",
      ],
      allowsSharedRooms: true,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"] as (
        | "double"
        | "triple"
        | "quad"
      )[],
      sharingPriceSar: 350,
      roomPriceSar: 900,
      quadPriceSar: 1200,
      triplePriceSar: 1050,
      doublePriceSar: 900,
      validFrom: hotelValidFrom,
      validUntil: hotelValidUntil,
      locationNotes: "Ibrahim Al Khalil Rd, King Fahad Gate Facing",
      isFeatured: true,
      sortOrder: 3,
    },
    // Makkah 4-Star
    {
      name: "Mövenpick Hotel & Residences Hajar Tower Makkah",
      city: "makkah" as const,
      starRating: 4,
      distanceMeters: 80,
      distanceLabel: "80m from Haram Courtyard",
      accessType: "walking" as const,
      imageUrl:
        "https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800",
      galleryUrls: [],
      amenities: ["Swiss Hospitality", "International Buffet", "Family Rooms"],
      allowsSharedRooms: true,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"] as (
        | "double"
        | "triple"
        | "quad"
      )[],
      sharingPriceSar: 260,
      roomPriceSar: 680,
      quadPriceSar: 960,
      triplePriceSar: 820,
      doublePriceSar: 680,
      validFrom: hotelValidFrom,
      validUntil: hotelValidUntil,
      locationNotes: "Hajar Tower - Haram Courtyard Frontage",
      isFeatured: false,
      sortOrder: 4,
    },
    {
      name: "Voco Makkah (an IHG Hotel)",
      city: "makkah" as const,
      starRating: 4,
      distanceMeters: 1200,
      distanceLabel: "1.2 km (24/7 Dedicated Luxury Air-Conditioned Shuttle)",
      accessType: "shuttle" as const,
      imageUrl:
        "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800",
      galleryUrls: [],
      amenities: [
        "Continuous Shuttle to Kudai & Haram",
        "Complimentary High-Speed WiFi",
        "Spacious Prayer & Assembly Halls",
      ],
      allowsSharedRooms: true,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"] as (
        | "double"
        | "triple"
        | "quad"
      )[],
      sharingPriceSar: 95,
      roomPriceSar: 260,
      quadPriceSar: 360,
      triplePriceSar: 310,
      doublePriceSar: 260,
      validFrom: hotelValidFrom,
      validUntil: hotelValidUntil,
      locationNotes: "Kudai Side - 24/7 Dedicated Luxury Shuttle to Haram",
      isFeatured: false,
      sortOrder: 5,
    },
    // Makkah 3-Star, 2-Star & Economy Allotments
    {
      name: "Al Kiswah Towers Hotel",
      city: "makkah" as const,
      starRating: 2,
      distanceMeters: 1500,
      distanceLabel: "1.5 km (Continuous 24-Hour Shuttle Service)",
      accessType: "shuttle" as const,
      imageUrl:
        "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800",
      galleryUrls: [],
      amenities: [
        "Clean Budget Economy Rooms",
        "24/7 Front Desk",
        "Shuttle Bus Terminal",
      ],
      allowsSharedRooms: true,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"] as (
        | "double"
        | "triple"
        | "quad"
      )[],
      sharingPriceSar: 42,
      roomPriceSar: 140,
      quadPriceSar: 170,
      triplePriceSar: 155,
      doublePriceSar: 140,
      validFrom: hotelValidFrom,
      validUntil: hotelValidUntil,
      locationNotes: "At-Taysir Sector - 24/7 Continuous Shuttle Terminal",
      isFeatured: false,
      sortOrder: 6,
    },
    {
      name: "Emaar Grand Hotel Makkah",
      city: "makkah" as const,
      starRating: 3,
      distanceMeters: 750,
      distanceLabel: "750m Walk via Ibrahim Al Khalil Road",
      accessType: "walking" as const,
      imageUrl:
        "https://images.unsplash.com/photo-1568495248636-6432b97bd949?w=800",
      galleryUrls: [],
      amenities: [
        "Direct Road Walkway",
        "Air Conditioned",
        "Convenience Shops Nearby",
      ],
      allowsSharedRooms: true,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"] as (
        | "double"
        | "triple"
        | "quad"
      )[],
      sharingPriceSar: 55,
      roomPriceSar: 180,
      quadPriceSar: 220,
      triplePriceSar: 200,
      doublePriceSar: 180,
      validFrom: hotelValidFrom,
      validUntil: hotelValidUntil,
      locationNotes: "Ibrahim Al Khalil Road - 750m Direct Walkway",
      isFeatured: false,
      sortOrder: 7,
    },
    {
      name: "Nada Al Deafah",
      city: "makkah" as const,
      starRating: 3,
      distanceMeters: 450,
      distanceLabel: "450m Walk to Outer Courtyard (Ajyad Sector)",
      accessType: "walking" as const,
      imageUrl:
        "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800",
      galleryUrls: [],
      amenities: ["Ajyad Walkway", "Air Conditioned", "Lift Access"],
      allowsSharedRooms: true,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"] as (
        | "double"
        | "triple"
        | "quad"
      )[],
      sharingPriceSar: 47,
      roomPriceSar: 140,
      quadPriceSar: 190,
      triplePriceSar: 165,
      doublePriceSar: 140,
      validFrom: hotelValidFrom,
      validUntil: hotelValidUntil,
      locationNotes: "Top 10 Side - Ajyad Sector - 450m Walk",
      isFeatured: false,
      sortOrder: 8,
    },
    {
      name: "Emaar Al Khalil",
      city: "makkah" as const,
      starRating: 2,
      distanceMeters: 650,
      distanceLabel: "650m Walk via Ibrahim Al Khalil Road",
      accessType: "walking" as const,
      imageUrl:
        "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=800",
      galleryUrls: [],
      amenities: ["Ibrahim Al Khalil Walkway", "Elevator Access"],
      allowsSharedRooms: true,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"] as (
        | "double"
        | "triple"
        | "quad"
      )[],
      sharingPriceSar: 42,
      roomPriceSar: 130,
      quadPriceSar: 170,
      triplePriceSar: 150,
      doublePriceSar: 130,
      validFrom: hotelValidFrom,
      validUntil: hotelValidUntil,
      locationNotes: "Ibrahim Al Khalil Road - 650m Walk",
      isFeatured: false,
      sortOrder: 9,
    },
    {
      name: "Fundaqiba",
      city: "makkah" as const,
      starRating: 1,
      distanceMeters: 900,
      distanceLabel: "900m Walk via Misfalah Street",
      accessType: "walking" as const,
      imageUrl:
        "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800",
      galleryUrls: [],
      amenities: ["Misfalah Commercial Strip", "Clean Economy Rooms"],
      allowsSharedRooms: true,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"] as (
        | "double"
        | "triple"
        | "quad"
      )[],
      sharingPriceSar: 34,
      roomPriceSar: 110,
      quadPriceSar: 140,
      triplePriceSar: 120,
      doublePriceSar: 110,
      validFrom: hotelValidFrom,
      validUntil: hotelValidUntil,
      locationNotes: "Misfalah Sector - 900m Walk",
      isFeatured: false,
      sortOrder: 10,
    },

    // Madinah 5-Star
    {
      name: "The Oberoi Madina",
      city: "madinah" as const,
      starRating: 5,
      distanceMeters: 50,
      distanceLabel: "50m from Prophet's Mosque Northern Courtyard",
      accessType: "walking" as const,
      imageUrl:
        "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800",
      galleryUrls: [
        "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800",
      ],
      amenities: [
        "Unobstructed Green Dome Views",
        "Mughal & Al-Ansar Restaurants",
        "Private Transport",
      ],
      allowsSharedRooms: true,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"] as (
        | "double"
        | "triple"
        | "quad"
      )[],
      sharingPriceSar: 490,
      roomPriceSar: 1400,
      quadPriceSar: 1900,
      triplePriceSar: 1650,
      doublePriceSar: 1400,
      validFrom: hotelValidFrom,
      validUntil: hotelValidUntil,
      locationNotes: "Northern Courtyard - Direct Facing Green Dome",
      isFeatured: true,
      sortOrder: 11,
    },
    {
      name: "Dar Al Taqwa Hotel Madinah",
      city: "madinah" as const,
      starRating: 5,
      distanceMeters: 30,
      distanceLabel: "30m Facing Ladies Courtyard Gate",
      accessType: "walking" as const,
      imageUrl:
        "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800",
      galleryUrls: [],
      amenities: [
        "Direct Gate Entrance",
        "Al Marwa Executive Lounge",
        "Courtyard Views",
      ],
      allowsSharedRooms: true,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"] as (
        | "double"
        | "triple"
        | "quad"
      )[],
      sharingPriceSar: 420,
      roomPriceSar: 1200,
      quadPriceSar: 1600,
      triplePriceSar: 1400,
      doublePriceSar: 1200,
      validFrom: hotelValidFrom,
      validUntil: hotelValidUntil,
      locationNotes: "Direct Ladies Gate 25 Entrance",
      isFeatured: true,
      sortOrder: 12,
    },
    {
      name: "Madinah Hilton Hotel",
      city: "madinah" as const,
      starRating: 5,
      distanceMeters: 100,
      distanceLabel: "100m from Masjid Nabawi Main Entrance",
      accessType: "walking" as const,
      imageUrl:
        "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800",
      galleryUrls: [],
      amenities: [
        "Madinah Dates Lounge",
        "Traditional Hospitality",
        "Basement Parking",
      ],
      allowsSharedRooms: true,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"] as (
        | "double"
        | "triple"
        | "quad"
      )[],
      sharingPriceSar: 360,
      roomPriceSar: 950,
      quadPriceSar: 1280,
      triplePriceSar: 1100,
      doublePriceSar: 950,
      validFrom: hotelValidFrom,
      validUntil: hotelValidUntil,
      locationNotes: "King Fahad Gate - Southern Courtyard",
      isFeatured: true,
      sortOrder: 13,
    },
    // Madinah 4-Star
    {
      name: "Crowne Plaza Madinah",
      city: "madinah" as const,
      starRating: 4,
      distanceMeters: 200,
      distanceLabel: "200m from Southern Courtyard",
      accessType: "walking" as const,
      imageUrl:
        "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800",
      galleryUrls: [],
      amenities: [
        "IHG Clean Promise",
        "Executive Club Floor",
        "Concierge Desk",
      ],
      allowsSharedRooms: true,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"] as (
        | "double"
        | "triple"
        | "quad"
      )[],
      sharingPriceSar: 180,
      roomPriceSar: 480,
      quadPriceSar: 650,
      triplePriceSar: 560,
      doublePriceSar: 480,
      validFrom: hotelValidFrom,
      validUntil: hotelValidUntil,
      locationNotes: "Southern Courtyard - Central Area",
      isFeatured: false,
      sortOrder: 14,
    },
    {
      name: "Leader Al Muna Kareem Hotel",
      city: "madinah" as const,
      starRating: 4,
      distanceMeters: 150,
      distanceLabel: "150m from Prophet's Mosque",
      accessType: "walking" as const,
      imageUrl:
        "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800",
      galleryUrls: [],
      amenities: [
        "Central Location",
        "Pakistani & Arabic Buffet",
        "High-Speed Elevators",
      ],
      allowsSharedRooms: true,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"] as (
        | "double"
        | "triple"
        | "quad"
      )[],
      sharingPriceSar: 170,
      roomPriceSar: 450,
      quadPriceSar: 620,
      triplePriceSar: 530,
      doublePriceSar: 450,
      validFrom: hotelValidFrom,
      validUntil: hotelValidUntil,
      locationNotes: "Central Area Northern Side - 150m Walk",
      isFeatured: false,
      sortOrder: 15,
    },
    // Madinah 3-Star, 2-Star & Economy Allotments
    {
      name: "Emaar Elite Hotel Madinah",
      city: "madinah" as const,
      starRating: 3,
      distanceMeters: 450,
      distanceLabel: "450m Walk to Southern Courtyard",
      accessType: "walking" as const,
      imageUrl:
        "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800",
      galleryUrls: [],
      amenities: [
        "Budget Economy Pilgrimage Rooms",
        "24/7 Reception",
        "Direct Street Access",
      ],
      allowsSharedRooms: true,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"] as (
        | "double"
        | "triple"
        | "quad"
      )[],
      sharingPriceSar: 60,
      roomPriceSar: 190,
      quadPriceSar: 240,
      triplePriceSar: 215,
      doublePriceSar: 190,
      validFrom: hotelValidFrom,
      validUntil: hotelValidUntil,
      locationNotes: "Markaziyah Shamaliyah (Northern Central Area)",
      isFeatured: false,
      sortOrder: 16,
    },
    {
      name: "Markaz Al Eiman",
      city: "madinah" as const,
      starRating: 1,
      distanceMeters: 300,
      distanceLabel: "300m Walk (Masjid Bilal Side)",
      accessType: "walking" as const,
      imageUrl:
        "https://images.unsplash.com/photo-1595576508898-0ad5c879a061?w=800",
      galleryUrls: [],
      amenities: ["Masjid Bilal Proximity", "Clean Allotment Rooms"],
      allowsSharedRooms: true,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"] as (
        | "double"
        | "triple"
        | "quad"
      )[],
      sharingPriceSar: 45,
      roomPriceSar: 140,
      quadPriceSar: 180,
      triplePriceSar: 160,
      doublePriceSar: 140,
      validFrom: hotelValidFrom,
      validUntil: hotelValidUntil,
      locationNotes: "Markaziyah Janubiyah (Masjid Bilal Side) - 300m Walk",
      isFeatured: false,
      sortOrder: 17,
    },
    {
      name: "Worth Elite",
      city: "madinah" as const,
      starRating: 2,
      distanceMeters: 250,
      distanceLabel: "250m Walk behind Bilal Market",
      accessType: "walking" as const,
      imageUrl:
        "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800",
      galleryUrls: [],
      amenities: ["Bilal Market Strip", "Air Conditioned", "24/7 Desk"],
      allowsSharedRooms: true,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"] as (
        | "double"
        | "triple"
        | "quad"
      )[],
      sharingPriceSar: 50,
      roomPriceSar: 150,
      quadPriceSar: 200,
      triplePriceSar: 175,
      doublePriceSar: 150,
      validFrom: hotelValidFrom,
      validUntil: hotelValidUntil,
      locationNotes: "Behind Bilal Market - 250m Walk",
      isFeatured: false,
      sortOrder: 18,
    },
  ]

  for (const h of hotelsData) {
    const existing = await db.query.hotels.findFirst({
      where: eq(schema.hotels.name, h.name),
    })
    if (!existing) {
      await db.insert(schema.hotels).values(h)
    } else {
      await db
        .update(schema.hotels)
        .set({
          distanceMeters: h.distanceMeters,
          distanceLabel: h.distanceLabel,
          starRating: h.starRating,
          imageUrl: h.imageUrl,
          sharingPriceSar: h.sharingPriceSar,
          roomPriceSar: h.roomPriceSar,
          quadPriceSar: h.quadPriceSar,
          triplePriceSar: h.triplePriceSar,
          doublePriceSar: h.doublePriceSar,
          validFrom: h.validFrom,
          validUntil: h.validUntil,
          locationNotes: h.locationNotes,
          amenities: h.amenities,
        })
        .where(eq(schema.hotels.id, existing.id))
    }
  }
  console.log(
    "   ✅ 18 named hotels seeded across 1★, 2★, 3★, 4★, 5★ and real-world allotment tiers."
  )

  // ==========================================
  // 7. VEHICLES (10 ROAD MODELS + HARAMAIN TRAIN)
  // ==========================================
  console.log("🚐 Seeding vehicles fleet...")
  const vehiclesData = [
    // Private Sedans
    {
      name: "Toyota Camry",
      category: "sedan" as const,
      bookingMode: "private_only" as const,
      seatCapacity: 4,
      luggageCapacity: 3,
      allowsCustomPickupTime: true,
      defaultRateSar: 230,
      ziyaratRateSar: 200,
      imageUrl:
        "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800",
      description:
        "Standard luxury executive sedan for up to 4 pilgrims. Includes air conditioning and chilled mineral water.",
      sortOrder: 1,
    },
    {
      name: "Ford Taurus",
      category: "sedan" as const,
      bookingMode: "private_only" as const,
      seatCapacity: 4,
      luggageCapacity: 3,
      allowsCustomPickupTime: true,
      defaultRateSar: 230,
      ziyaratRateSar: 200,
      imageUrl:
        "https://images.unsplash.com/photo-1550355291-bbee04a92027?w=800",
      description:
        "Comfortable executive sedan for solo pilgrims and couples. Includes chilled mineral water.",
      sortOrder: 2,
    },
    {
      name: "Hyundai Sonata",
      category: "sedan" as const,
      bookingMode: "private_only" as const,
      seatCapacity: 4,
      luggageCapacity: 3,
      allowsCustomPickupTime: true,
      defaultRateSar: 230,
      ziyaratRateSar: 200,
      imageUrl:
        "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800",
      description:
        "Modern private sedan with air conditioning, optimal for airport transfers and intimate travel.",
      sortOrder: 3,
    },
    // Private SUVs
    {
      name: "GMC Yukon XL",
      category: "suv" as const,
      bookingMode: "private_only" as const,
      seatCapacity: 7,
      luggageCapacity: 7,
      allowsCustomPickupTime: true,
      defaultRateSar: 400,
      ziyaratRateSar: 350,
      imageUrl:
        "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800",
      description:
        "Luxury VIP large-body SUV with leather seating and 7-passenger capacity with ample luggage.",
      sortOrder: 4,
    },
    {
      name: "Chevrolet Suburban",
      category: "suv" as const,
      bookingMode: "private_only" as const,
      seatCapacity: 7,
      luggageCapacity: 7,
      allowsCustomPickupTime: true,
      defaultRateSar: 400,
      ziyaratRateSar: 350,
      imageUrl:
        "https://images.unsplash.com/photo-1563720223185-11003d516935?w=800",
      description:
        "Executive 7-seater American SUV with massive luggage compartment for family comfort.",
      sortOrder: 5,
    },
    // Private Vans
    {
      name: "Hyundai Staria",
      category: "van" as const,
      bookingMode: "private_only" as const,
      seatCapacity: 7,
      luggageCapacity: 6,
      allowsCustomPickupTime: true,
      defaultRateSar: 280,
      ziyaratRateSar: 250,
      imageUrl:
        "https://images.unsplash.com/photo-1559297434-fae8a1916a79?w=800",
      description:
        "Futuristic VIP 7-seater family van with captain chairs, climate control, and ample luggage space.",
      sortOrder: 6,
    },
    {
      name: "Hyundai Starex",
      category: "van" as const,
      bookingMode: "private_only" as const,
      seatCapacity: 7,
      luggageCapacity: 5,
      allowsCustomPickupTime: true,
      defaultRateSar: 280,
      ziyaratRateSar: 250,
      imageUrl:
        "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=800",
      description:
        "Reliable medium-size family van designed for intercity transfers between holy cities.",
      sortOrder: 7,
    },
    // Shared and Private Minibuses & Coaches
    {
      name: "Toyota HiAce",
      category: "minibus" as const,
      bookingMode: "shared_and_private" as const,
      seatCapacity: 11,
      luggageCapacity: 15,
      allowsCustomPickupTime: true,
      defaultRateSar: 350,
      ziyaratRateSar: 300,
      imageUrl:
        "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=800",
      description:
        "Spacious 11-seater minibus popular for extended family groups and custom travel parties with 15 luggage capacity.",
      sortOrder: 8,
    },
    {
      name: "Toyota Coaster",
      category: "minibus" as const,
      bookingMode: "shared_and_private" as const,
      seatCapacity: 17,
      luggageCapacity: 25,
      allowsCustomPickupTime: true,
      defaultRateSar: 550,
      ziyaratRateSar: 450,
      imageUrl:
        "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800",
      description:
        "17-seater mid-size luxury coach ideal for medium groups, ziyarat tours, and group arrivals.",
      sortOrder: 9,
    },
    {
      name: "Bus Service (Full-size Coach Bus)",
      category: "bus" as const,
      bookingMode: "shared_and_private" as const,
      seatCapacity: 49,
      luggageCapacity: 50,
      allowsCustomPickupTime: false,
      defaultRateSar: 850,
      ziyaratRateSar: 650,
      imageUrl:
        "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800",
      description:
        "49-passenger luxury touring coach with undercarriage cargo, PA system, and air conditioning.",
      sortOrder: 10,
    },
    // Train (shared only)
    {
      name: "Haramain High-Speed Train",
      category: "train" as const,
      bookingMode: "shared_only" as const,
      seatCapacity: 1,
      luggageCapacity: 1,
      allowsCustomPickupTime: false,
      defaultRateSar: 75,
      ziyaratRateSar: 0,
      imageUrl:
        "https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=800",
      description:
        "300 km/h high-speed rail transit connecting Makkah, Jeddah Airport, and Madinah in comfort.",
      sortOrder: 11,
    },
  ]

  for (const v of vehiclesData) {
    const existing = await db.query.vehicles.findFirst({
      where: or(
        eq(schema.vehicles.name, v.name),
        v.name === "GMC Yukon XL"
          ? eq(schema.vehicles.name, "GMC Yukon")
          : undefined,
        v.name === "Toyota Coaster"
          ? eq(schema.vehicles.name, "Coaster (Toyota Coaster Minibus)")
          : undefined
      ),
    })
    if (!existing) {
      await db.insert(schema.vehicles).values(v)
    } else {
      await db
        .update(schema.vehicles)
        .set({
          name: v.name,
          category: v.category,
          bookingMode: v.bookingMode,
          seatCapacity: v.seatCapacity,
          luggageCapacity: v.luggageCapacity,
          defaultRateSar: v.defaultRateSar,
          ziyaratRateSar: v.ziyaratRateSar,
          description: v.description,
        })
        .where(eq(schema.vehicles.id, existing.id))
    }
  }
  console.log(
    "   ✅ 10 locked road vehicles + Haramain High-Speed Train seeded."
  )

  // ==========================================
  // 8. TRANSPORT SECTORS (12 LOCKED SECTORS)
  // ==========================================
  console.log("🛣️ Seeding transport sectors...")
  const sectorsData = [
    {
      code: "JED_MAK",
      label: "Jeddah Airport (JED) to Makkah Hotel",
      originCity: "Jeddah",
      destinationCity: "Makkah",
      originType: "airport" as const,
      destinationType: "hotel" as const,
      supportsTrain: true,
      isSharedBusEligible: true,
      sharedBusRateSarPerPax: 20,
      terminalParkingFeeSar: 90,
      approxDistanceKm: 95,
      approxDurationMinutes: 75,
      sortOrder: 1,
    },
    {
      code: "MAK_MED",
      label: "Makkah Hotel to Madinah Hotel",
      originCity: "Makkah",
      destinationCity: "Madinah",
      originType: "hotel" as const,
      destinationType: "hotel" as const,
      supportsTrain: true,
      isSharedBusEligible: true,
      sharedBusRateSarPerPax: 20,
      terminalParkingFeeSar: 0,
      approxDistanceKm: 440,
      approxDurationMinutes: 270,
      sortOrder: 2,
    },
    {
      code: "MED_MAK",
      label: "Madinah Hotel to Makkah Hotel",
      originCity: "Madinah",
      destinationCity: "Makkah",
      originType: "hotel" as const,
      destinationType: "hotel" as const,
      supportsTrain: true,
      isSharedBusEligible: true,
      sharedBusRateSarPerPax: 20,
      terminalParkingFeeSar: 0,
      approxDistanceKm: 440,
      approxDurationMinutes: 270,
      sortOrder: 3,
    },
    {
      code: "MAK_JED",
      label: "Makkah Hotel to Jeddah Airport (JED)",
      originCity: "Makkah",
      destinationCity: "Jeddah",
      originType: "hotel" as const,
      destinationType: "airport" as const,
      supportsTrain: true,
      isSharedBusEligible: true,
      sharedBusRateSarPerPax: 20,
      terminalParkingFeeSar: 0,
      approxDistanceKm: 95,
      approxDurationMinutes: 75,
      sortOrder: 4,
    },
    {
      code: "MED_AIR",
      label: "Madinah Hotel to Madinah Airport (MED)",
      originCity: "Madinah",
      destinationCity: "Madinah",
      originType: "hotel" as const,
      destinationType: "airport" as const,
      supportsTrain: false,
      isSharedBusEligible: false,
      sharedBusRateSarPerPax: 20,
      terminalParkingFeeSar: 0,
      approxDistanceKm: 25,
      approxDurationMinutes: 30,
      sortOrder: 5,
    },
    {
      code: "AIR_MED",
      label: "Madinah Airport (MED) to Madinah Hotel",
      originCity: "Madinah",
      destinationCity: "Madinah",
      originType: "airport" as const,
      destinationType: "hotel" as const,
      supportsTrain: false,
      isSharedBusEligible: false,
      sharedBusRateSarPerPax: 20,
      terminalParkingFeeSar: 0,
      approxDistanceKm: 25,
      approxDurationMinutes: 30,
      sortOrder: 6,
    },
    {
      code: "JED_MED",
      label: "Jeddah Airport (JED) to Madinah Hotel",
      originCity: "Jeddah",
      destinationCity: "Madinah",
      originType: "airport" as const,
      destinationType: "hotel" as const,
      supportsTrain: true,
      isSharedBusEligible: false,
      sharedBusRateSarPerPax: 30,
      terminalParkingFeeSar: 90,
      approxDistanceKm: 410,
      approxDurationMinutes: 260,
      sortOrder: 7,
    },
    {
      code: "MED_JED",
      label: "Madinah Hotel to Jeddah Airport (JED)",
      originCity: "Madinah",
      destinationCity: "Jeddah",
      originType: "hotel" as const,
      destinationType: "airport" as const,
      supportsTrain: true,
      isSharedBusEligible: false,
      sharedBusRateSarPerPax: 30,
      terminalParkingFeeSar: 0,
      approxDistanceKm: 410,
      approxDurationMinutes: 260,
      sortOrder: 8,
    },
    {
      code: "MAK_BADR_MED",
      label: "Makkah to Madinah via Badr Ziyarat",
      originCity: "Makkah",
      destinationCity: "Madinah",
      originType: "hotel" as const,
      destinationType: "hotel" as const,
      supportsTrain: false,
      isSharedBusEligible: false,
      sharedBusRateSarPerPax: 40,
      terminalParkingFeeSar: 0,
      approxDistanceKm: 490,
      approxDurationMinutes: 360,
      sortOrder: 9,
    },
    {
      code: "MAK_TAIF_MAK",
      label: "Makkah ↔ Taif Ziyarat & Return",
      originCity: "Makkah",
      destinationCity: "Makkah",
      originType: "hotel" as const,
      destinationType: "hotel" as const,
      supportsTrain: false,
      isSharedBusEligible: false,
      sharedBusRateSarPerPax: 40,
      terminalParkingFeeSar: 0,
      approxDistanceKm: 180,
      approxDurationMinutes: 180,
      sortOrder: 10,
    },
    {
      code: "MAK_TRN",
      label: "Makkah Hotel ↔ Makkah Haramain Train Station",
      originCity: "Makkah",
      destinationCity: "Makkah",
      originType: "hotel" as const,
      destinationType: "hotel" as const,
      supportsTrain: false,
      isSharedBusEligible: false,
      sharedBusRateSarPerPax: 15,
      terminalParkingFeeSar: 0,
      approxDistanceKm: 10,
      approxDurationMinutes: 20,
      sortOrder: 11,
    },
    {
      code: "MED_TRN",
      label: "Madinah Hotel ↔ Madinah Haramain Train Station",
      originCity: "Madinah",
      destinationCity: "Madinah",
      originType: "hotel" as const,
      destinationType: "hotel" as const,
      supportsTrain: false,
      isSharedBusEligible: false,
      sharedBusRateSarPerPax: 15,
      terminalParkingFeeSar: 0,
      approxDistanceKm: 10,
      approxDurationMinutes: 20,
      sortOrder: 12,
    },
  ]

  for (const s of sectorsData) {
    await db
      .insert(schema.transportSectors)
      .values(s)
      .onConflictDoUpdate({
        target: schema.transportSectors.code,
        set: {
          label: s.label,
          supportsTrain: s.supportsTrain,
          approxDistanceKm: s.approxDistanceKm,
          approxDurationMinutes: s.approxDurationMinutes,
          sharedBusRateSarPerPax: s.sharedBusRateSarPerPax,
          isSharedBusEligible: s.isSharedBusEligible,
          terminalParkingFeeSar: s.terminalParkingFeeSar,
        },
      })
  }
  console.log("   ✅ 12 locked transport sectors seeded.")

  // ==========================================
  // 8b. TRANSPORT RATES 2D MATRIX (SECTOR × VEHICLE)
  // ==========================================
  console.log("📊 Seeding 2D Sector × Vehicle transport rate matrix...")
  const allSectors = await db.query.transportSectors.findMany()
  const allVehicles = await db.query.vehicles.findMany()

  const sectorMap = new Map(allSectors.map((s) => [s.code, s.id]))
  const vehicleMap = new Map(allVehicles.map((v) => [v.name, v.id]))

  // Real world rate sheets from Basma Emaar, Zain Travel 2026, and Zahoor Tours 1448
  const matrixDefs: Array<{
    sectorCode: string
    rates: Record<string, number>
  }> = [
    {
      sectorCode: "JED_MAK",
      rates: {
        "Toyota Camry": 230,
        "Ford Taurus": 230,
        "Hyundai Sonata": 230,
        "Hyundai Staria": 280,
        "Hyundai Starex": 280,
        "Toyota HiAce": 350,
        "GMC Yukon XL": 400,
        "Chevrolet Suburban": 400,
        "Toyota Coaster": 550,
        "Bus Service (Full-size Coach Bus)": 850,
        "Haramain High-Speed Train": 75,
      },
    },
    {
      sectorCode: "MAK_MED",
      rates: {
        "Toyota Camry": 450,
        "Ford Taurus": 450,
        "Hyundai Sonata": 450,
        "Hyundai Staria": 550,
        "Hyundai Starex": 550,
        "Toyota HiAce": 620,
        "GMC Yukon XL": 700,
        "Chevrolet Suburban": 700,
        "Toyota Coaster": 850,
        "Bus Service (Full-size Coach Bus)": 1150,
        "Haramain High-Speed Train": 175,
      },
    },
    {
      sectorCode: "MED_MAK",
      rates: {
        "Toyota Camry": 450,
        "Ford Taurus": 450,
        "Hyundai Sonata": 450,
        "Hyundai Staria": 550,
        "Hyundai Starex": 550,
        "Toyota HiAce": 620,
        "GMC Yukon XL": 700,
        "Chevrolet Suburban": 700,
        "Toyota Coaster": 850,
        "Bus Service (Full-size Coach Bus)": 1150,
        "Haramain High-Speed Train": 175,
      },
    },
    {
      sectorCode: "MAK_JED",
      rates: {
        "Toyota Camry": 200,
        "Ford Taurus": 200,
        "Hyundai Sonata": 200,
        "Hyundai Staria": 220,
        "Hyundai Starex": 220,
        "Toyota HiAce": 320,
        "GMC Yukon XL": 330,
        "Chevrolet Suburban": 330,
        "Toyota Coaster": 500,
        "Bus Service (Full-size Coach Bus)": 750,
        "Haramain High-Speed Train": 75,
      },
    },
    {
      sectorCode: "MED_AIR",
      rates: {
        "Toyota Camry": 150,
        "Ford Taurus": 150,
        "Hyundai Sonata": 150,
        "Hyundai Staria": 200,
        "Hyundai Starex": 200,
        "Toyota HiAce": 270,
        "GMC Yukon XL": 300,
        "Chevrolet Suburban": 300,
        "Toyota Coaster": 400,
        "Bus Service (Full-size Coach Bus)": 650,
        "Haramain High-Speed Train": 50,
      },
    },
    {
      sectorCode: "AIR_MED",
      rates: {
        "Toyota Camry": 150,
        "Ford Taurus": 150,
        "Hyundai Sonata": 150,
        "Hyundai Staria": 200,
        "Hyundai Starex": 200,
        "Toyota HiAce": 270,
        "GMC Yukon XL": 300,
        "Chevrolet Suburban": 300,
        "Toyota Coaster": 400,
        "Bus Service (Full-size Coach Bus)": 650,
        "Haramain High-Speed Train": 50,
      },
    },
    {
      sectorCode: "JED_MED",
      rates: {
        "Toyota Camry": 500,
        "Ford Taurus": 500,
        "Hyundai Sonata": 500,
        "Hyundai Staria": 600,
        "Hyundai Starex": 600,
        "Toyota HiAce": 700,
        "GMC Yukon XL": 800,
        "Chevrolet Suburban": 800,
        "Toyota Coaster": 1000,
        "Bus Service (Full-size Coach Bus)": 1300,
        "Haramain High-Speed Train": 225,
      },
    },
    {
      sectorCode: "MED_JED",
      rates: {
        "Toyota Camry": 500,
        "Ford Taurus": 500,
        "Hyundai Sonata": 500,
        "Hyundai Staria": 600,
        "Hyundai Starex": 600,
        "Toyota HiAce": 700,
        "GMC Yukon XL": 800,
        "Chevrolet Suburban": 800,
        "Toyota Coaster": 1000,
        "Bus Service (Full-size Coach Bus)": 1300,
        "Haramain High-Speed Train": 225,
      },
    },
    {
      sectorCode: "MAK_BADR_MED",
      rates: {
        "Toyota Camry": 600,
        "Ford Taurus": 600,
        "Hyundai Sonata": 600,
        "Hyundai Staria": 750,
        "Hyundai Starex": 750,
        "Toyota HiAce": 900,
        "GMC Yukon XL": 1000,
        "Chevrolet Suburban": 1000,
        "Toyota Coaster": 1150,
        "Bus Service (Full-size Coach Bus)": 1500,
      },
    },
    {
      sectorCode: "MAK_TAIF_MAK",
      rates: {
        "Toyota Camry": 400,
        "Ford Taurus": 400,
        "Hyundai Sonata": 400,
        "Hyundai Staria": 550,
        "Hyundai Starex": 550,
        "Toyota HiAce": 650,
        "GMC Yukon XL": 750,
        "Chevrolet Suburban": 750,
        "Toyota Coaster": 850,
        "Bus Service (Full-size Coach Bus)": 1200,
      },
    },
    {
      sectorCode: "MAK_TRN",
      rates: {
        "Toyota Camry": 100,
        "Ford Taurus": 100,
        "Hyundai Sonata": 100,
        "Hyundai Staria": 150,
        "Hyundai Starex": 150,
        "Toyota HiAce": 200,
        "GMC Yukon XL": 250,
        "Chevrolet Suburban": 250,
        "Toyota Coaster": 350,
        "Bus Service (Full-size Coach Bus)": 500,
      },
    },
    {
      sectorCode: "MED_TRN",
      rates: {
        "Toyota Camry": 100,
        "Ford Taurus": 100,
        "Hyundai Sonata": 100,
        "Hyundai Staria": 150,
        "Hyundai Starex": 150,
        "Toyota HiAce": 200,
        "GMC Yukon XL": 250,
        "Chevrolet Suburban": 250,
        "Toyota Coaster": 350,
        "Bus Service (Full-size Coach Bus)": 500,
      },
    },
  ]

  let rateMatrixCount = 0
  for (const def of matrixDefs) {
    const sectorId = sectorMap.get(def.sectorCode)
    if (!sectorId) continue

    for (const [vehicleName, rateSar] of Object.entries(def.rates)) {
      const vehicleId = vehicleMap.get(vehicleName)
      if (!vehicleId) continue

      await db
        .insert(schema.transportRates)
        .values({
          sectorId,
          vehicleId,
          rateSar,
          ratePkrOverride: null,
          notes: `${def.sectorCode} rate for ${vehicleName}`,
        })
        .onConflictDoUpdate({
          target: [
            schema.transportRates.sectorId,
            schema.transportRates.vehicleId,
          ],
          set: {
            rateSar,
            updatedAt: new Date(),
          },
        })
      rateMatrixCount++
    }
  }
  console.log(
    `   ✅ ${rateMatrixCount} transport rate cells seeded across 12 sectors and 11 vehicle models.`
  )

  // ==========================================
  // 9. SACRED ZIYARAT SITES
  // ==========================================
  console.log("🕋 Seeding sacred ziyarat places...")
  const ziyaratData = [
    // Makkah Sites
    {
      city: "makkah" as const,
      name: "Jabal al-Nour & Cave of Hira",
      arabicName: "جبل النور وغار حراء",
      description:
        "The Mountain of Light northeast of Masjid al-Haram where the first divine revelation of Surah Al-Alaq descended upon Prophet Muhammad (PBUH). Guided early-morning visits include lower base orientation and scholar commentary.",
      imageUrl:
        "https://images.unsplash.com/photo-1565552645632-d725f8bfc19a?w=800",
      sortOrder: 1,
    },
    {
      city: "makkah" as const,
      name: "Jabal Thawr & Cave of Thawr",
      arabicName: "جبل ثور وغار ثور",
      description:
        "The rugged southern mountain sanctuary where the Prophet (PBUH) and Abu Bakr As-Siddiq (RA) sheltered for three nights during the sacred Hijrah from Makkah to Madinah.",
      imageUrl:
        "https://images.unsplash.com/photo-1519817650390-64a93db51149?w=800",
      sortOrder: 2,
    },
    {
      city: "makkah" as const,
      name: "Sacred Sites of Hajj: Mina, Muzdalifah & Arafat",
      arabicName: "المشاعر المقدسة: منى ومزدلفة وعرفات",
      description:
        "Panoramic scholar-led circuit through the Mashair plains of Hajj, viewing the Mina tent valley, Muzdalifah open sanctuary, Masjid Namirah, and Jabal al-Rahmah on the Plain of Arafat.",
      imageUrl:
        "https://images.unsplash.com/photo-1580418827493-f2b22c0a76cb?w=800",
      sortOrder: 3,
    },
    {
      city: "makkah" as const,
      name: "Jannat al-Mu'alla Cemetery",
      arabicName: "مقبرة المعلاة",
      description:
        "The historic burial ground north of Masjid al-Haram holding the resting place of Umm al-Mu'minin Sayyidah Khadijah al-Kubra (RA) and early companions.",
      imageUrl:
        "https://images.unsplash.com/photo-1537181534458-45dcee76ae90?w=800",
      sortOrder: 4,
    },
    {
      city: "makkah" as const,
      name: "Masjid al-Jinn & Masjid ash-Shajarah",
      arabicName: "مسجد الجن ومسجد الشجرة",
      description:
        "Historic mosques along the northern Haram corridor commemorating the pledge of the Jinn upon hearing the Holy Quran and the miracle of the obedient tree.",
      imageUrl:
        "https://images.unsplash.com/photo-1542816417-0983c9c9ad53?w=800",
      sortOrder: 5,
    },

    // Madinah Sites
    {
      city: "madinah" as const,
      name: "Masjid Quba",
      arabicName: "مسجد قباء",
      description:
        "The first mosque founded upon piety in Islamic history; departing one's Madinah hotel in wudu and praying two rak'ats nafl at Masjid Quba carries the reward of an accepted Umrah.",
      imageUrl:
        "https://images.unsplash.com/photo-1564769625905-50e93615e769?w=800",
      sortOrder: 6,
    },
    {
      city: "madinah" as const,
      name: "Mount Uhud & Martyrs Cemetery",
      arabicName: "جبل أحد ومقبرة الشهداء",
      description:
        "The beloved mountain ridge north of Madinah, visiting Jabal al-Rumat (Archers' Hill) and paying salam at the enclosure of Sayyid ash-Shuhada Hamza ibn Abdul-Muttalib (RA) and the seventy martyrs of Uhud.",
      imageUrl:
        "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=800",
      sortOrder: 7,
    },
    {
      city: "madinah" as const,
      name: "Masjid al-Qiblatayn",
      arabicName: "مسجد القبلتين",
      description:
        "The Mosque of the Two Qiblahs in northwestern Madinah where divine revelation commanded the prayer direction to shift toward the Holy Kaaba in Makkah.",
      imageUrl:
        "https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?w=800",
      sortOrder: 8,
    },
    {
      city: "madinah" as const,
      name: "The Seven Mosques & Battle of the Trench (Khandaq)",
      arabicName: "المساجد السبعة وموقع غزوة الخندق",
      description:
        "Historic pavilion mosques along the western Sela' foothills marking the defensive trench dug by the Prophet (PBUH) and Sahabah during the Battle of Ahzab.",
      imageUrl:
        "https://images.unsplash.com/photo-1512632578888-169bbbc64f33?w=800",
      sortOrder: 9,
    },
    {
      city: "madinah" as const,
      name: "Jannat al-Baqi Cemetery",
      arabicName: "مقبرة بقيع الغرقد",
      description:
        "Located immediately east of Masjid an-Nabawi's courtyard, the blessed resting ground of Ahl al-Bayt, the Mothers of the Believers, Uthman ibn Affan (RA), and ten thousand noble Sahabah.",
      imageUrl:
        "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?w=800",
      sortOrder: 10,
    },
    {
      city: "madinah" as const,
      name: "Bir Uthman (Well of Uthman RA)",
      arabicName: "بئر عثمان بن عفان رضي الله عنه",
      description:
        "The historic Bir Rumah freshwater well and palm grove endowed by Uthman ibn Affan (RA) as an enduring charitable waqf for the people and pilgrims of Madinah.",
      imageUrl:
        "https://images.unsplash.com/photo-1508964942454-1a56651d54ac?w=800",
      sortOrder: 11,
    },
    {
      city: "madinah" as const,
      name: "Dates Market of Madinah (Souq at-Tumoor)",
      arabicName: "سوق تمور المدينة",
      description:
        "Madinah's central harvest souq south of the Haram, offering authentic graded Ajwa al-Aliyah, Safawi, Mabroom, and Amber dates directly from local orchards.",
      imageUrl:
        "https://images.unsplash.com/photo-1590076215667-875d4ef2d7de?w=800",
      sortOrder: 12,
    },
  ]

  for (const z of ziyaratData) {
    const existing = await db.query.ziyaratPlaces.findFirst({
      where: eq(schema.ziyaratPlaces.name, z.name),
    })
    if (!existing) {
      await db.insert(schema.ziyaratPlaces).values(z)
    } else {
      await db
        .update(schema.ziyaratPlaces)
        .set({
          city: z.city,
          arabicName: z.arabicName,
          description: z.description,
          imageUrl: z.imageUrl,
          sortOrder: z.sortOrder,
        })
        .where(eq(schema.ziyaratPlaces.id, existing.id))
    }
  }
  console.log("   ✅ 12 sacred ziyarat sites seeded with Arabic names.")

  // ==========================================
  // 10. GROUP PACKAGES & DEPARTURE BATCHES
  // ==========================================
  console.log("📦 Seeding group packages & departures...")
  const fairmont = await db.query.hotels.findFirst({
    where: eq(schema.hotels.name, "Fairmont Makkah Clock Royal Tower"),
  })
  const oberoi = await db.query.hotels.findFirst({
    where: eq(schema.hotels.name, "The Oberoi Madina"),
  })
  const hyatt = await db.query.hotels.findFirst({
    where: eq(schema.hotels.name, "Jabal Omar Hyatt Regency Makkah"),
  })
  const hilton = await db.query.hotels.findFirst({
    where: eq(schema.hotels.name, "Madinah Hilton Hotel"),
  })
  const movenpick = await db.query.hotels.findFirst({
    where: eq(
      schema.hotels.name,
      "Mövenpick Hotel & Residences Hajar Tower Makkah"
    ),
  })
  const crowne = await db.query.hotels.findFirst({
    where: eq(schema.hotels.name, "Crowne Plaza Madinah"),
  })
  const kiswah = await db.query.hotels.findFirst({
    where: eq(schema.hotels.name, "Al Kiswah Towers Hotel"),
  })
  const emaar = await db.query.hotels.findFirst({
    where: eq(schema.hotels.name, "Emaar Elite Hotel Madinah"),
  })

  const saudia = await db.query.airlines.findFirst({
    where: eq(schema.airlines.iataCode, "SV"),
  })
  const pia = await db.query.airlines.findFirst({
    where: eq(schema.airlines.iataCode, "PK"),
  })

  const isbCity = await db.query.departureCities.findFirst({
    where: eq(schema.departureCities.airportCode, "ISB"),
  })
  const lheCity = await db.query.departureCities.findFirst({
    where: eq(schema.departureCities.airportCode, "LHE"),
  })
  const khiCity = await db.query.departureCities.findFirst({
    where: eq(schema.departureCities.airportCode, "KHI"),
  })

  // Shared multi-hotel combinations from 21-Day Saudia Flyer (Resource 2)
  const sharedMultiHotelOptions = [
    {
      pkgCode: "PKG 1",
      label: "Package 1 — Nada Al Deafah & Markaz Al Eiman",
      makkahHotelName: "Nada Al Deafah",
      makkahDistance: "450m Walk",
      madinahHotelName: "Markaz Al Eiman",
      madinahDistance: "300m Walk (Masjid Bilal Side)",
      sharingPricePkr: 258299,
      quadPricePkr: 262099,
      triplePricePkr: 268399,
      doublePricePkr: 280999,
    },
    {
      pkgCode: "PKG 2",
      label: "Package 2 — Emaar Al Khalil & Worth Elite",
      makkahHotelName: "Emaar Al Khalil",
      makkahDistance: "650m Walk",
      madinahHotelName: "Worth Elite",
      madinahDistance: "250m Walk",
      sharingPricePkr: 264999,
      quadPricePkr: 269999,
      triplePricePkr: 276999,
      doublePricePkr: 289999,
    },
    {
      pkgCode: "PKG 3",
      label: "Package 3 — Voco Makkah & Crowne Plaza Madinah",
      makkahHotelName: "Voco Makkah (IHG)",
      makkahDistance: "Dedicated Luxury Shuttle",
      madinahHotelName: "Crowne Plaza Madinah",
      madinahDistance: "200m Southern Courtyard",
      sharingPricePkr: 289999,
      quadPricePkr: 299999,
      triplePricePkr: 314999,
      doublePricePkr: 334999,
    },
    {
      pkgCode: "PKG 4",
      label: "Package 4 — Swissôtel Al Maqam & Oberoi Madinah",
      makkahHotelName: "Swissôtel Al Maqam",
      makkahDistance: "Direct Courtyard Access",
      madinahHotelName: "The Oberoi Madina",
      madinahDistance: "Facing Green Dome",
      sharingPricePkr: 419999,
      quadPricePkr: 449999,
      triplePricePkr: 489999,
      doublePricePkr: 549999,
    },
  ]

  const giftedInclusions = [
    "Gifted Taif Ziyarat",
    "Gifted Umrah from Taif",
    "Gifted Makkah Ziyarat",
    "Gifted Madinah Ziyarat",
  ]

  // Package 1: Royal VIP
  const pkg1Slug = "royal-ramadan-15-day-luxury-umrah"
  let pkg1 = await db.query.groupPackages.findFirst({
    where: eq(schema.groupPackages.slug, pkg1Slug),
  })

  if (!pkg1) {
    const [created] = await db
      .insert(schema.groupPackages)
      .values({
        title: "Royal Ramadan 15-Day Luxury Umrah",
        slug: pkg1Slug,
        tier: "vip_5star",
        durationDays: 15,
        makkahNights: 8,
        madinahNights: 7,
        airlineId: saudia?.id,
        makkahHotelId: fairmont?.id,
        madinahHotelId: oberoi?.id,
        includesVisa: true,
        includesTransport: true,
        includesZiyarat: true,
        quadPricePkr: 485000,
        triplePricePkr: 545000,
        doublePricePkr: 635000,
        sharingPricePkr: 419999,
        infantPricePkr: 65000,
        giftedInclusions,
        multiHotelOptions: sharedMultiHotelOptions,
        highlights: [
          "Direct Haram Courtyard Clock Tower Accommodations",
          "Unobstructed Green Dome Oberoi Suite Stays",
          "Haramain High-Speed Train Business Class Tickets",
          "Private GMC Yukon Ziyarat Transport",
          "VIP Executive Haram Lounge Access",
        ],
        bannerUrl:
          "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?w=1200",
        coverImageUrl:
          "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?w=1200",
        isFeatured: true,
        sortOrder: 1,
      })
      .returning()
    pkg1 = created
  } else {
    await db
      .update(schema.groupPackages)
      .set({
        sharingPricePkr: 419999,
        infantPricePkr: 65000,
        giftedInclusions,
        multiHotelOptions: sharedMultiHotelOptions,
        coverImageUrl:
          pkg1.coverImageUrl ??
          pkg1.bannerUrl ??
          "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?w=1200",
        highlights: [
          "Direct Haram Courtyard Clock Tower Accommodations",
          "Unobstructed Green Dome Oberoi Suite Stays",
          "Haramain High-Speed Train Business Class Tickets",
          "Private GMC Yukon Ziyarat Transport",
          "VIP Executive Haram Lounge Access",
        ],
      })
      .where(eq(schema.groupPackages.id, pkg1.id))
  }

  // Package 2: Executive Gold
  const pkg2Slug = "executive-gold-14-day-umrah"
  let pkg2 = await db.query.groupPackages.findFirst({
    where: eq(schema.groupPackages.slug, pkg2Slug),
  })

  if (!pkg2) {
    const [created] = await db
      .insert(schema.groupPackages)
      .values({
        title: "Executive Gold 14-Day Umrah",
        slug: pkg2Slug,
        tier: "gold",
        durationDays: 14,
        makkahNights: 7,
        madinahNights: 7,
        airlineId: saudia?.id,
        makkahHotelId: hyatt?.id,
        madinahHotelId: hilton?.id,
        includesVisa: true,
        includesTransport: true,
        includesZiyarat: true,
        quadPricePkr: 385000,
        triplePricePkr: 425000,
        doublePricePkr: 485000,
        sharingPricePkr: 345000,
        infantPricePkr: 65000,
        giftedInclusions,
        multiHotelOptions: sharedMultiHotelOptions,
        highlights: [
          "100m Walking Distance to King Fahad Gate",
          "Five-Star Walking Proximity in Madinah Central",
          "Complete Airport & Intercity Transport Included",
          "Guided Ziyarat Tour with Certified Scholar",
        ],
        bannerUrl:
          "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200",
        coverImageUrl:
          "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200",
        isFeatured: true,
        sortOrder: 2,
      })
      .returning()
    pkg2 = created
  } else {
    await db
      .update(schema.groupPackages)
      .set({
        sharingPricePkr: 345000,
        infantPricePkr: 65000,
        giftedInclusions,
        multiHotelOptions: sharedMultiHotelOptions,
        coverImageUrl:
          pkg2.coverImageUrl ??
          pkg2.bannerUrl ??
          "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200",
      })
      .where(eq(schema.groupPackages.id, pkg2.id))
  }

  // Package 3: Classic Silver
  const pkg3Slug = "classic-silver-14-day-family-umrah"
  let pkg3 = await db.query.groupPackages.findFirst({
    where: eq(schema.groupPackages.slug, pkg3Slug),
  })

  if (!pkg3) {
    const [created] = await db
      .insert(schema.groupPackages)
      .values({
        title: "Classic Silver 14-Day Family Umrah",
        slug: pkg3Slug,
        tier: "silver",
        durationDays: 14,
        makkahNights: 7,
        madinahNights: 7,
        airlineId: pia?.id,
        makkahHotelId: movenpick?.id,
        madinahHotelId: crowne?.id,
        includesVisa: true,
        includesTransport: true,
        includesZiyarat: true,
        quadPricePkr: 310000,
        triplePricePkr: 345000,
        doublePricePkr: 395000,
        sharingPricePkr: 289999,
        infantPricePkr: 65000,
        giftedInclusions,
        multiHotelOptions: sharedMultiHotelOptions,
        highlights: [
          "Walking Proximity in Makkah & Madinah Courtyards",
          "Family Quad & Triple Friendly Rooms",
          "Airblue / PIA Direct Flights Preference",
          "Full Air Conditioned Group Coach Transport",
        ],
        bannerUrl:
          "https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=1200",
        coverImageUrl:
          "https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=1200",
        isFeatured: false,
        sortOrder: 3,
      })
      .returning()
    pkg3 = created
  } else {
    await db
      .update(schema.groupPackages)
      .set({
        sharingPricePkr: 289999,
        infantPricePkr: 65000,
        giftedInclusions,
        multiHotelOptions: sharedMultiHotelOptions,
        coverImageUrl:
          pkg3.coverImageUrl ??
          pkg3.bannerUrl ??
          "https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=1200",
      })
      .where(eq(schema.groupPackages.id, pkg3.id))
  }

  // Package 4: Economy Bronze
  const pkg4Slug = "economy-bronze-21-day-long-stay"
  let pkg4 = await db.query.groupPackages.findFirst({
    where: eq(schema.groupPackages.slug, pkg4Slug),
  })

  if (!pkg4) {
    const [created] = await db
      .insert(schema.groupPackages)
      .values({
        title: "Economy Bronze 21-Day Long Stay",
        slug: pkg4Slug,
        tier: "bronze",
        durationDays: 21,
        makkahNights: 11,
        madinahNights: 10,
        airlineId: pia?.id,
        makkahHotelId: kiswah?.id,
        madinahHotelId: emaar?.id,
        includesVisa: true,
        includesTransport: true,
        includesZiyarat: true,
        quadPricePkr: 262099,
        triplePricePkr: 268399,
        doublePricePkr: 280999,
        sharingPricePkr: 258299,
        infantPricePkr: 65000,
        giftedInclusions,
        multiHotelOptions: sharedMultiHotelOptions,
        highlights: [
          "21 Days Extended Spiritual Immersion",
          "24-Hour Shuttle Service Direct to Haram",
          "Includes 4 Gifted Ziyarat Excursions (Taif, Makkah, Madinah)",
          "Comprehensive Saudi Visa & Health Insurance",
        ],
        bannerUrl:
          "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200",
        coverImageUrl:
          "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200",
        isFeatured: false,
        sortOrder: 4,
      })
      .returning()
    pkg4 = created
  } else {
    await db
      .update(schema.groupPackages)
      .set({
        quadPricePkr: 262099,
        triplePricePkr: 268399,
        doublePricePkr: 280999,
        sharingPricePkr: 258299,
        infantPricePkr: 65000,
        giftedInclusions,
        multiHotelOptions: sharedMultiHotelOptions,
        coverImageUrl:
          pkg4.coverImageUrl ??
          pkg4.bannerUrl ??
          "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200",
      })
      .where(eq(schema.groupPackages.id, pkg4.id))
  }

  // Seed Rolling Future PKT Departures across Packages 1–4 covering LHE, KHI & ISB
  const rollingDepartures: Array<typeof schema.groupDepartures.$inferInsert> = []

  if (pkg1 && isbCity && lheCity && khiCity) {
    rollingDepartures.push(
      {
        packageId: pkg1.id,
        batchCode: "ART-RAM-ISB-01",
        departureCityId: isbCity.id,
        departureDate: addPktDaysIso(todayPktIso, 35),
        returnDate: addPktDaysIso(todayPktIso, 50),
        totalSeats: 30,
        bookedSeats: 24,
        status: "filling_fast",
        sharingPriceOverridePkr: 419999,
        outboundFlightNumber: "SV-739",
        returnFlightNumber: "SV-738",
        flightScheduleSummary: "ISB-JED 03:15–06:20 | JED-ISB 18:30–01:10",
        routingNote: "Direct Non-Stop (Saudi Airlines)",
        baggageAllowance: "23-KG Outbound / 46-KG Return",
      },
      {
        packageId: pkg1.id,
        batchCode: "ART-RAM-LHE-01",
        departureCityId: lheCity.id,
        departureDate: addPktDaysIso(todayPktIso, 45),
        returnDate: addPktDaysIso(todayPktIso, 60),
        totalSeats: 35,
        bookedSeats: 12,
        status: "open",
        sharingPriceOverridePkr: 419999,
        outboundFlightNumber: "SV-737",
        returnFlightNumber: "SV-734",
        flightScheduleSummary: "LHE-JED 04:00–07:20 | JED-LHE 16:00–22:45",
        routingNote: "Direct Non-Stop (Saudi Airlines)",
        baggageAllowance: "23-KG Outbound / 46-KG Return",
      },
      {
        packageId: pkg1.id,
        batchCode: "ART-RAM-KHI-01",
        departureCityId: khiCity.id,
        departureDate: addPktDaysIso(todayPktIso, 75),
        returnDate: addPktDaysIso(todayPktIso, 90),
        totalSeats: 30,
        bookedSeats: 10,
        status: "open",
        sharingPriceOverridePkr: 419999,
        outboundFlightNumber: "SV-705",
        returnFlightNumber: "SV-704",
        flightScheduleSummary: "KHI-JED 05:30–08:15 | JED-KHI 19:30–01:55",
        routingNote: "Direct Non-Stop (Saudi Airlines)",
        baggageAllowance: "23-KG Outbound / 46-KG Return",
      }
    )
  }

  if (pkg2 && khiCity && isbCity && lheCity) {
    rollingDepartures.push(
      {
        packageId: pkg2.id,
        batchCode: "ART-GLD-KHI-01",
        departureCityId: khiCity.id,
        departureDate: addPktDaysIso(todayPktIso, 38),
        returnDate: addPktDaysIso(todayPktIso, 52),
        totalSeats: 40,
        bookedSeats: 15,
        status: "open",
        sharingPriceOverridePkr: 345000,
        outboundFlightNumber: "SV-701",
        returnFlightNumber: "SV-700",
        flightScheduleSummary: "KHI-JED 06:00–08:45 | JED-KHI 20:00–02:30",
        routingNote: "Direct Non-Stop (Saudi Airlines)",
        baggageAllowance: "23-KG Outbound / 46-KG Return",
      },
      {
        packageId: pkg2.id,
        batchCode: "ART-GLD-LHE-01",
        departureCityId: lheCity.id,
        departureDate: addPktDaysIso(todayPktIso, 62),
        returnDate: addPktDaysIso(todayPktIso, 76),
        totalSeats: 35,
        bookedSeats: 14,
        status: "open",
        sharingPriceOverridePkr: 345000,
        outboundFlightNumber: "SV-735",
        returnFlightNumber: "SV-734",
        flightScheduleSummary: "LHE-JED 03:45–06:55 | JED-LHE 17:10–23:50",
        routingNote: "Direct Non-Stop (Saudi Airlines)",
        baggageAllowance: "23-KG Outbound / 46-KG Return",
      },
      {
        packageId: pkg2.id,
        batchCode: "ART-GLD-ISB-02",
        departureCityId: isbCity.id,
        departureDate: addPktDaysIso(todayPktIso, 95),
        returnDate: addPktDaysIso(todayPktIso, 109),
        totalSeats: 30,
        bookedSeats: 11,
        status: "open",
        sharingPriceOverridePkr: 345000,
        outboundFlightNumber: "SV-739",
        returnFlightNumber: "SV-738",
        flightScheduleSummary: "ISB-JED 03:15–06:20 | JED-ISB 18:30–01:10",
        routingNote: "Direct Non-Stop (Saudi Airlines)",
        baggageAllowance: "23-KG Outbound / 46-KG Return",
      }
    )
  }

  if (pkg3 && lheCity && isbCity && khiCity) {
    rollingDepartures.push(
      {
        packageId: pkg3.id,
        batchCode: "ART-SLV-LHE-01",
        departureCityId: lheCity.id,
        departureDate: addPktDaysIso(todayPktIso, 50),
        returnDate: addPktDaysIso(todayPktIso, 64),
        totalSeats: 40,
        bookedSeats: 16,
        status: "open",
        sharingPriceOverridePkr: 289999,
        outboundFlightNumber: "PK-759",
        returnFlightNumber: "PK-760",
        flightScheduleSummary: "LHE-JED 07:30–11:00 | MED-LHE 15:00–21:45",
        routingNote: "Direct Open-Jaw (PIA)",
        baggageAllowance: "30-KG Outbound / 40-KG + 5L Zamzam Return",
      },
      {
        packageId: pkg3.id,
        batchCode: "ART-SLV-ISB-01",
        departureCityId: isbCity.id,
        departureDate: addPktDaysIso(todayPktIso, 82),
        returnDate: addPktDaysIso(todayPktIso, 96),
        totalSeats: 35,
        bookedSeats: 12,
        status: "open",
        sharingPriceOverridePkr: 289999,
        outboundFlightNumber: "PK-741",
        returnFlightNumber: "PK-742",
        flightScheduleSummary: "ISB-JED 08:15–11:40 | MED-ISB 16:30–23:10",
        routingNote: "Direct Open-Jaw (PIA)",
        baggageAllowance: "30-KG Outbound / 40-KG + 5L Zamzam Return",
      },
      {
        packageId: pkg3.id,
        batchCode: "ART-SLV-KHI-01",
        departureCityId: khiCity.id,
        departureDate: addPktDaysIso(todayPktIso, 115),
        returnDate: addPktDaysIso(todayPktIso, 129),
        totalSeats: 40,
        bookedSeats: 9,
        status: "open",
        sharingPriceOverridePkr: 289999,
        outboundFlightNumber: "PK-731",
        returnFlightNumber: "PK-732",
        flightScheduleSummary: "KHI-JED 09:00–11:55 | JED-KHI 14:20–20:15",
        routingNote: "Direct Non-Stop (PIA)",
        baggageAllowance: "30-KG Outbound / 40-KG + 5L Zamzam Return",
      }
    )
  }

  if (pkg4 && lheCity && khiCity && isbCity) {
    rollingDepartures.push(
      {
        packageId: pkg4.id,
        batchCode: "ART-BRZ-LHE-21",
        departureCityId: lheCity.id,
        departureDate: addPktDaysIso(todayPktIso, 32),
        returnDate: addPktDaysIso(todayPktIso, 53),
        totalSeats: 45,
        bookedSeats: 18,
        status: "open",
        sharingPriceOverridePkr: 258299,
        quadPriceOverridePkr: 262099,
        triplePriceOverridePkr: 268399,
        doublePriceOverridePkr: 280999,
        outboundFlightNumber: "SV-739",
        returnFlightNumber: "SV-738",
        flightScheduleSummary: "LHE-JED 02:40–05:45 | JED-LHE 17:15–23:55",
        routingNote: "Direct Non-Stop (Saudi Airlines 21-Day Schedule)",
        baggageAllowance: "23-KG Outbound / 46-KG Return",
      },
      {
        packageId: pkg4.id,
        batchCode: "ART-BRZ-KHI-21",
        departureCityId: khiCity.id,
        departureDate: addPktDaysIso(todayPktIso, 68),
        returnDate: addPktDaysIso(todayPktIso, 89),
        totalSeats: 45,
        bookedSeats: 14,
        status: "open",
        sharingPriceOverridePkr: 258299,
        quadPriceOverridePkr: 262099,
        triplePriceOverridePkr: 268399,
        doublePriceOverridePkr: 280999,
        outboundFlightNumber: "PK-731",
        returnFlightNumber: "PK-732",
        flightScheduleSummary: "KHI-JED 09:00–11:55 | JED-KHI 14:20–20:15",
        routingNote: "Direct Non-Stop (PIA 21-Day Long Stay)",
        baggageAllowance: "30-KG Outbound / 40-KG Return",
      },
      {
        packageId: pkg4.id,
        batchCode: "ART-BRZ-ISB-21",
        departureCityId: isbCity.id,
        departureDate: addPktDaysIso(todayPktIso, 140),
        returnDate: addPktDaysIso(todayPktIso, 161),
        totalSeats: 45,
        bookedSeats: 10,
        status: "open",
        sharingPriceOverridePkr: 258299,
        quadPriceOverridePkr: 262099,
        triplePriceOverridePkr: 268399,
        doublePriceOverridePkr: 280999,
        outboundFlightNumber: "PK-741",
        returnFlightNumber: "PK-742",
        flightScheduleSummary: "ISB-JED 08:15–11:40 | JED-ISB 18:10–00:50",
        routingNote: "Direct Non-Stop (PIA 21-Day Long Stay)",
        baggageAllowance: "30-KG Outbound / 40-KG Return",
      }
    )
  }

  for (const dep of rollingDepartures) {
    await db
      .insert(schema.groupDepartures)
      .values(dep)
      .onConflictDoUpdate({
        target: schema.groupDepartures.batchCode,
        set: {
          packageId: dep.packageId,
          departureCityId: dep.departureCityId,
          departureDate: dep.departureDate,
          returnDate: dep.returnDate,
          totalSeats: dep.totalSeats,
          bookedSeats: dep.bookedSeats,
          status: dep.status,
          sharingPriceOverridePkr: dep.sharingPriceOverridePkr ?? null,
          quadPriceOverridePkr: dep.quadPriceOverridePkr ?? null,
          triplePriceOverridePkr: dep.triplePriceOverridePkr ?? null,
          doublePriceOverridePkr: dep.doublePriceOverridePkr ?? null,
          outboundFlightNumber: dep.outboundFlightNumber ?? null,
          returnFlightNumber: dep.returnFlightNumber ?? null,
          flightScheduleSummary: dep.flightScheduleSummary ?? null,
          routingNote: dep.routingNote ?? null,
          baggageAllowance: dep.baggageAllowance ?? null,
          updatedAt: new Date(),
        },
      })
  }
  console.log("   ✅ 4 group packages and 12 rolling PKT departure batches seeded across LHE, KHI & ISB.")

  // ==========================================
  // 11. PUBLIC CMS (HERO, TESTIMONIALS, FAQS)
  // ==========================================
  console.log("🌟 Seeding public CMS content...")

  // Hero Slides
  const heroSlidesData = [
    {
      badge: "Al Ramlah Elite Pilgrimage",
      title: "Where Purpose Meets Excellence",
      subtitle:
        "Bespoke Umrah itineraries with five-star courtyard accommodations, high-speed rail transit, and personalized scholar-led ziyarat.",
      imageUrl:
        "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?w=1600",
      primaryCtaLabel: "Plan Custom Journey",
      primaryCtaUrl: "#custom-journey",
      secondaryCtaLabel: "Explore Group Packages",
      secondaryCtaUrl: "#group-packages",
      sortOrder: 1,
    },
    {
      badge: "The Prophet's City",
      title: "Peace and Tranquility Facing the Green Dome",
      subtitle:
        "Select premier hotels located mere meters from the courtyards of Masjid an-Nabawi in the blessed city of Madinah.",
      imageUrl:
        "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1600",
      primaryCtaLabel: "View Madinah Hotels",
      primaryCtaUrl: "#custom-journey",
      secondaryCtaLabel: "Browse Packages",
      secondaryCtaUrl: "#group-packages",
      sortOrder: 2,
    },
    {
      badge: "Hajj 2027 Package Guide",
      title: "Guaranteed Guidance for the Lifetime Obligation",
      subtitle:
        "Private consultations, pre-registration assistance, and verified executive arrangements for Pakistan & overseas diaspora pilgrims.",
      imageUrl:
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1600",
      primaryCtaLabel: "Request Hajj Consultation",
      primaryCtaUrl: "#hajj-inquiry",
      secondaryCtaLabel: "WhatsApp Hajj 2027 Team",
      secondaryCtaUrl: "https://wa.me/923274029701",
      sortOrder: 3,
    },
  ]

  for (const s of heroSlidesData) {
    const existing = await db.query.heroSlides.findFirst({
      where: eq(schema.heroSlides.sortOrder, s.sortOrder),
    })
    if (!existing) {
      await db.insert(schema.heroSlides).values(s)
    } else {
      await db
        .update(schema.heroSlides)
        .set({
          badge: s.badge,
          title: s.title,
          subtitle: s.subtitle,
          imageUrl: s.imageUrl,
          primaryCtaUrl: s.primaryCtaUrl,
          primaryCtaLabel: s.primaryCtaLabel,
          secondaryCtaUrl: s.secondaryCtaUrl,
          secondaryCtaLabel: s.secondaryCtaLabel,
        })
        .where(eq(schema.heroSlides.id, existing.id))
    }
  }



  // FAQs (14 Dynamic-Safe Pilgrimage Q&As across all 6 categories)
  const faqsData = [
    {
      category: "visa" as const,
      question:
        "What is the difference between short-term and long-term Umrah visas?",
      answer:
        "Visas for Kingdom of Saudi Arabia stays of 30 days or fewer are categorized as short-term, while stays from 31 up to 90 days are categorized as long-term. Both tiers include mandatory Saudi healthcare and emergency medical insurance, and our Journey Planner automatically calculates the applicable visa tier from your KSA arrival and departure dates using live published PKR rates.",
      sortOrder: 1,
    },
    {
      category: "transport" as const,
      question:
        "Which airport should I select for an itinerary that begins in Makkah?",
      answer:
        "Makkah does not have a civilian airport. All itineraries starting with Makkah land at King Abdulaziz International Airport in Jeddah (JED). From Jeddah Airport, Al Ramlah provides direct ground transfer via private vehicle (approx. 75 minutes) or tickets for the Haramain High-Speed Train.",
      sortOrder: 2,
    },
    {
      category: "hotels" as const,
      question:
        "What is the difference between walking distance and shuttle hotels?",
      answer:
        "Walking hotels are situated between 0 and 750 meters from the outer courtyards of the Haramain and require no transport. Shuttle hotels are situated beyond 1,000 meters and provide continuous, 24/7 dedicated air-conditioned bus transfers to designated terminal stops near the Haram courtyards.",
      sortOrder: 3,
    },
    {
      category: "general" as const,
      question:
        "How do children and infants affect our hotel room and vehicle bookings?",
      answer:
        "Adults (12+ yrs) and children (2–11 yrs) count toward hotel beds and vehicle seats. Infants under 2 years of age require a valid passport, Saudi visa, and infant airline ticket, but occupy zero hotel beds and zero vehicle seats. When booking private rooms or vehicles, our capacity calculations count adults and children, saving you unnecessary room charges.",
      sortOrder: 4,
    },
    {
      category: "packages" as const,
      question: "Can we customize an existing group package departure date?",
      answer:
        "Group packages operate on fixed group departure batches to secure bulk wholesale airline and hotel rates. If you require custom travel dates, our 5-pillar Custom Journey Planner allows you to configure your exact dates and select identical hotels with private transfers.",
      sortOrder: 5,
    },
    {
      category: "visa" as const,
      question:
        "What documents and Saudi Visa Bio steps are required for Pakistani passport holders?",
      answer:
        "Applicants require a machine-readable passport valid for at least 6 months from travel, a CNIC or B-Form copy, a white-background digital photograph, and mobile fingerprint enrollment through the official Saudi Visa Bio smartphone app. Children under 12 and senior citizens over 80 are exempt from app biometrics under current Saudi consular rules.",
      sortOrder: 6,
    },
    {
      category: "visa" as const,
      question:
        "Can overseas Pakistanis (UK, USA, Canada, UAE) book Umrah packages and visas with Al Ramlah Travels?",
      answer:
        "Yes. Overseas diaspora families holding NICOP/POC cards or foreign passports can coordinate land-only Haramain hotel suites, private GMC Yukon or Hyundai Staria transfers, and visa processing so overseas relatives and Pakistan-departing family members check into the exact same Makkah and Madinah hotels together.",
      sortOrder: 7,
    },
    {
      category: "hotels" as const,
      question:
        "How do Quad, Triple, Double, and Sharing room allocations work in Makkah and Madinah?",
      answer:
        "Double rooms accommodate 2 beds, Triple rooms accommodate 3 beds, and Quad rooms accommodate 4 beds for private family occupancy. Sharing occupancy allocates individual beds in gender-segregated shared rooms for solo pilgrims seeking lower per-person package rates.",
      sortOrder: 8,
    },
    {
      category: "transport" as const,
      question:
        "Should our family choose the Haramain High-Speed Train or a private SUV/van between Makkah and Madinah?",
      answer:
        "The Haramain High-Speed Train connects Makkah and Madinah in roughly 2 hours 20 minutes with station-to-hotel transfers and strict per-passenger baggage dimensions. A private GMC Yukon XL, Hyundai Staria, or Toyota HiAce provides door-to-door hotel lobby pickup, flexible Miqat (Bir Ali) stops, and generous luggage capacity for families and elderly pilgrims.",
      sortOrder: 9,
    },
    {
      category: "packages" as const,
      question:
        "Why does Visa-Only show an immediate fixed PKR total while hotel and flight custom itineraries show Live Rate?",
      answer:
        "Standalone Umrah visa processing follows published regulatory PKR tiers, allowing immediate fixed pricing. Airline seats, Haramain hotel allotments, and seasonal KSA transport fluctuate daily by date and occupancy, so custom multi-service itineraries are verified by our Lahore quoting desk before issuing a binding itemized PKR proposal.",
      sortOrder: 10,
    },
    {
      category: "general" as const,
      question:
        "How are Nusuk Rawdah (Riyazul Jannah) permits arranged for Madinah stays?",
      answer:
        "Once your Umrah visa number is issued, our operations team assists every pilgrim in registering on the official Saudi Nusuk app to reserve timed men's and ladies' Rawdah ash-Sharifah prayer slots corresponding to your confirmed Madinah hotel dates.",
      sortOrder: 11,
    },
    {
      category: "hajj" as const,
      question:
        "How does Hajj 2027 pre-registration work and what do Maktab A+, A, B, and C mean?",
      answer:
        "Hajj 2027 pre-registration records your family's preferred Maktab camp zone, room occupancy, and shifting vs non-shifting hotel structure ahead of official Saudi Ministry of Hajj & Umrah and Pakistan MORA quota announcements. Maktab A+ and A offer closer Jamarat camp proximity and gypsum suite upgrades, while Maktab B and C provide structured value-focused Mina allocations with Aziziyah transit stays.",
      sortOrder: 12,
    },
    {
      category: "general" as const,
      question:
        "What wheelchair and senior-citizen assistance is available during Tawaf, Sa'i, and Ziyarat?",
      answer:
        "We prioritize zero-step courtyard hotels (such as Clock Tower and Northern/Ladies Gate Madinah properties), low-step private SUVs/vans, airline wheelchair requests at Lahore, Karachi, and Islamabad airports, and electric scooter or push-wheelchair guidance inside Masjid al-Haram.",
      sortOrder: 13,
    },
    {
      category: "general" as const,
      question:
        "Can I bring back 5-liter Zamzam water bottles on return flights to Pakistan?",
      answer:
        "Holders of valid Umrah visas departing via Jeddah (JED) or Madinah (MED) on Saudia, PIA, Airblue, and SereneAir are generally permitted one sealed 5-liter official Zamzam container per pilgrim from the airport Zamzam counter, subject to the operating carrier's conditions of carriage.",
      sortOrder: 14,
    },
  ]

  // Clean up legacy infant FAQ if present
  await db
    .delete(schema.faqs)
    .where(
      eq(
        schema.faqs.question,
        "How do infants affect our hotel room and vehicle bookings?"
      )
    )

  for (const f of faqsData) {
    const existing = await db.query.faqs.findFirst({
      where: eq(schema.faqs.question, f.question),
    })
    if (!existing) {
      await db.insert(schema.faqs).values(f)
    } else {
      await db.update(schema.faqs).set(f).where(eq(schema.faqs.id, existing.id))
    }
  }

  console.log("   ✅ Hero slides and FAQs seeded (0 fake testimonials).")

  // ==========================================
  // 12. HAJJ 2027 INDICATIVE PACKAGES (OD-09e)
  // ==========================================
  console.log("🕋 Seeding Hajj 2027 indicative packages...")
  const hajj2027Disclaimer =
    "Indicative 2027 package structure — final Maktab tariff & quota subject to Saudi Ministry of Hajj & Umrah and Pakistan MORA announcement."

  const hajjPackagesData: Array<typeof schema.hajjPackages.$inferInsert> = [
    {
      slug: "hajj-2027-maktab-a-plus-courtyard-vip",
      title: "Hajj 2027 — Maktab A+ Royal Courtyard Executive (16 Days)",
      seasonYear: 2027,
      maktabTier: "A+",
      durationDays: 16,
      makkahHotelName: "Fairmont Makkah Clock Royal Tower / Swissôtel Al Maqam",
      makkahDistanceLabel: "0–50m Direct Haram Courtyard Access",
      madinahHotelName: "The Oberoi Madina / Dar Al Taqwa",
      madinahDistanceLabel: "30–50m Facing Masjid an-Nabawi Courtyard",
      aziziyahStayNotes:
        "Non-shifting courtyard stay with private VIP Maktab A+ Mina tent near Jamarat & Mashair train pass.",
      indicativeSharingPkr: 3450000,
      indicativeQuadPkr: 3650000,
      indicativeTriplePkr: 3950000,
      indicativeDoublePkr: 4450000,
      isIndicative: true,
      regulatoryDisclaimer: hajj2027Disclaimer,
      highlights: [
        "Maktab A+ Gypsum Air-Conditioned Suites Near Jamarat",
        "Non-Shifting 5-Star Haramain Courtyard Hotels",
        "Haramain High-Speed Rail & Mashair Metro Access",
        "Dedicated Resident Scholar & Medical Support",
      ],
      isFeatured: true,
      isActive: true,
      sortOrder: 1,
    },
    {
      slug: "hajj-2027-maktab-a-executive-shifting",
      title: "Hajj 2027 — Maktab A Executive Gold Shifting (21 Days)",
      seasonYear: 2027,
      maktabTier: "A",
      durationDays: 21,
      makkahHotelName: "Jabal Omar Hyatt Regency / Mövenpick Hajar Tower",
      makkahDistanceLabel: "80–100m Walk to Haram Courtyard",
      madinahHotelName: "Madinah Hilton / Crowne Plaza Madinah",
      madinahDistanceLabel: "100–200m Southern Courtyard",
      aziziyahStayNotes:
        "Dedicated executive building in Aziziyah North during Manasik days (4–13 Dhul Hijjah) with 24/7 catering.",
      indicativeSharingPkr: 2450000,
      indicativeQuadPkr: 2590000,
      indicativeTriplePkr: 2790000,
      indicativeDoublePkr: 3150000,
      isIndicative: true,
      regulatoryDisclaimer: hajj2027Disclaimer,
      highlights: [
        "Verified Maktab A Camp Zone with Sofa-Cum-Beds",
        "5-Star Makkah & Madinah Markaziyah Stays",
        "3 Buffet Pakistani & Continental Meals Daily",
        "Pre-Departure Manasik Workshop in Lahore HQ",
      ],
      isFeatured: true,
      isActive: true,
      sortOrder: 2,
    },
    {
      slug: "hajj-2027-maktab-b-classic-long-stay",
      title: "Hajj 2027 — Maktab B Classic Guided Pilgrimage (30 Days)",
      seasonYear: 2027,
      maktabTier: "B",
      durationDays: 30,
      makkahHotelName: "Voco Makkah (IHG) / Emaar Grand Makkah",
      makkahDistanceLabel: "750m Walk or 24/7 Dedicated Shuttle",
      madinahHotelName: "Emaar Elite Madinah / Leader Al Muna Kareem",
      madinahDistanceLabel: "150–450m Markaziyah Walk",
      aziziyahStayNotes:
        "Furnished Aziziyah transit residence during peak Manasik days with group bus transfers.",
      indicativeSharingPkr: 1790000,
      indicativeQuadPkr: 1890000,
      indicativeTriplePkr: 2020000,
      indicativeDoublePkr: 2250000,
      isIndicative: true,
      regulatoryDisclaimer: hajj2027Disclaimer,
      highlights: [
        "Official Maktab B Camp Allocation & Mashair Transport",
        "Extended Spiritual Stay in Makkah & Madinah",
        "Scholar-Guided Group Manasik & Ziyarat",
        "Overseas Diaspora & Pakistan Passport Support",
      ],
      isFeatured: false,
      isActive: true,
      sortOrder: 3,
    },
    {
      slug: "hajj-2027-maktab-c-economy-aziziya",
      title: "Hajj 2027 — Maktab C Economy Aziziya Long-Stay (38 Days)",
      seasonYear: 2027,
      maktabTier: "C",
      durationDays: 38,
      makkahHotelName: "Al Kiswah Towers / Nada Al Deafah + Aziziyah Building",
      makkahDistanceLabel: "24/7 Haram Shuttle & Dedicated Aziziyah Residence",
      madinahHotelName: "Markaz Al Eiman / Worth Elite Madinah",
      madinahDistanceLabel: "250–300m Walk (Masjid Bilal Sector)",
      aziziyahStayNotes:
        "Dedicated air-conditioned Aziziyah apartment residence with full Pakistani half-board catering and group Mashair bus transfers.",
      indicativeSharingPkr: 1490000,
      indicativeQuadPkr: 1580000,
      indicativeTriplePkr: 1690000,
      indicativeDoublePkr: 1890000,
      isIndicative: true,
      regulatoryDisclaimer: hajj2027Disclaimer,
      highlights: [
        "Budget-Conscious Official Maktab C Camp Allocation",
        "Extended 38-Day Spiritual Residence in Haramain & Aziziyah",
        "Urdu & English Scholar Manasik Sessions Before Departure",
        "Transparent Pre-Registration Queue Without Binding Deposit",
      ],
      isFeatured: false,
      isActive: true,
      sortOrder: 4,
    },
  ]

  for (const hp of hajjPackagesData) {
    await db
      .insert(schema.hajjPackages)
      .values(hp)
      .onConflictDoUpdate({
        target: schema.hajjPackages.slug,
        set: {
          title: hp.title,
          seasonYear: hp.seasonYear,
          maktabTier: hp.maktabTier,
          durationDays: hp.durationDays,
          makkahHotelName: hp.makkahHotelName,
          makkahDistanceLabel: hp.makkahDistanceLabel,
          madinahHotelName: hp.madinahHotelName,
          madinahDistanceLabel: hp.madinahDistanceLabel,
          aziziyahStayNotes: hp.aziziyahStayNotes,
          indicativeSharingPkr: hp.indicativeSharingPkr,
          indicativeQuadPkr: hp.indicativeQuadPkr,
          indicativeTriplePkr: hp.indicativeTriplePkr,
          indicativeDoublePkr: hp.indicativeDoublePkr,
          isIndicative: true,
          regulatoryDisclaimer: hajj2027Disclaimer,
          highlights: hp.highlights,
          isFeatured: hp.isFeatured,
          sortOrder: hp.sortOrder,
          updatedAt: new Date(),
        },
      })
  }
  console.log("   ✅ 3 indicative Hajj 2027 packages seeded.")

  console.log(
    "✨ Seed completed successfully! Core foundation catalog data populated."
  )

  if (options?.closePool !== false) {
    await closeDatabasePool()
  }
}

const isSeedEntrypoint =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isSeedEntrypoint) {
  runSeed({ closePool: true })
    .then(() => {
      process.exit(0)
    })
    .catch((error: unknown) => {
      console.error("❌ Seed execution failed:", error)
      process.exit(1)
    })
}
