import "dotenv/config"
import fs from "node:fs"
import path from "node:path"
import { eq, or, sql } from "drizzle-orm"
import { db } from "./index"
import * as schema from "./schema"
import { auth } from "../lib/auth"

async function seed() {
  console.log("🌱 Starting Al Ramlah Travels database seed...")

  // ==========================================
  // 1. ADMIN & STAFF ACCOUNTS (BETTER AUTH)
  // ==========================================
  console.log("👤 Seeding admin & staff accounts...")

  // Super Admin
  const existingAdmin = await db.query.user.findFirst({
    where: eq(schema.user.email, "admin@alramlahtravels.com"),
  })

  let adminUserId = existingAdmin?.id

  if (!existingAdmin) {
    try {
      const adminRes = await auth.api.signUpEmail({
        body: {
          email: "admin@alramlahtravels.com",
          password: "Admin@123456",
          name: "Muhammad Tariq (Super Admin)",
        },
      })
      if (adminRes?.user) {
        adminUserId = adminRes.user.id
        await db
          .update(schema.user)
          .set({ role: "super_admin", isActive: true })
          .where(eq(schema.user.id, adminUserId))
        console.log("   ✅ Created Super Admin: admin@alramlahtravels.com")
      }
    } catch (err: unknown) {
      console.log(
        "   ℹ️ Admin account creation note:",
        err instanceof Error ? err.message : err
      )
    }
  } else {
    await db
      .update(schema.user)
      .set({ role: "super_admin", isActive: true })
      .where(eq(schema.user.id, existingAdmin.id))
    console.log("   ✅ Super Admin exists and role verified.")
  }

  // Staff Account
  const existingStaff = await db.query.user.findFirst({
    where: eq(schema.user.email, "staff@alramlahtravels.com"),
  })

  let staffUserId = existingStaff?.id

  if (!existingStaff) {
    try {
      const staffRes = await auth.api.signUpEmail({
        body: {
          email: "staff@alramlahtravels.com",
          password: "Staff@123456",
          name: "Bilal Khan (Senior Quoting Agent)",
        },
      })
      if (staffRes?.user) {
        staffUserId = staffRes.user.id
        await db
          .update(schema.user)
          .set({ role: "staff", isActive: true })
          .where(eq(schema.user.id, staffUserId))
        console.log("   ✅ Created Staff: staff@alramlahtravels.com")
      }
    } catch (err: unknown) {
      console.log(
        "   ℹ️ Staff account creation note:",
        err instanceof Error ? err.message : err
      )
    }
  } else {
    await db
      .update(schema.user)
      .set({ role: "staff", isActive: true })
      .where(eq(schema.user.id, existingStaff.id))
    console.log("   ✅ Staff exists and role verified.")
  }

  // ==========================================
  // 2. AGENCY SETTINGS (SINGLETON)
  // ==========================================
  console.log("🏢 Seeding agency settings...")
  await db
    .insert(schema.agencySettings)
    .values({
      id: "default",
      agencyName: "Al Ramlah Travels",
      tagline: "Where Purpose Meets Excellence",
      primaryWhatsapp: "03274029701",
      secondaryPhone: "03190462638",
      supportEmail: "alramlahtravels@gmail.com",
      officeAddress:
        "House no 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt",
      mapsEmbedUrl:
        "https://maps.google.com/?q=Sector+C+Askari+10+Airport+Road+Lahore+Cantt",
      facebookUrl: "https://facebook.com/alramlahtravels",
      instagramUrl: "https://instagram.com/alramlahtravels",
      youtubeUrl: "https://youtube.com/@alramlahtravels",
      tiktokUrl: "https://tiktok.com/@alramlahtravels",
      workingHours: "Monday to Saturday: 9:00 AM to 8:00 PM PKT",
      slaOverdueHours: 24,
      sarToPkrRate: 75,
      updatedByUserId: adminUserId,
    })
    .onConflictDoUpdate({
      target: schema.agencySettings.id,
      set: {
        tagline: "Where Purpose Meets Excellence",
        primaryWhatsapp: "03274029701",
        secondaryPhone: "03190462638",
        supportEmail: "alramlahtravels@gmail.com",
        officeAddress:
          "House no 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt",
        mapsEmbedUrl:
          "https://maps.google.com/?q=Sector+C+Askari+10+Airport+Road+Lahore+Cantt",
        workingHours: "Monday to Saturday: 9:00 AM to 8:00 PM PKT",
        slaOverdueHours: 24,
        sarToPkrRate: 75,
      },
    })
  console.log("   ✅ Agency settings configured (SAR to PKR: 75).")

  // ==========================================
  // 3. DYNAMIC VISA RATES
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
        pricePkr: 42500,
        priceSar: 470,
        withoutMasarPriceSar: 470,
        withMasar10DaysSar: 500,
        withMasar15DaysSar: 515,
        withMasar21DaysSar: 530,
        withMasar28DaysSar: 545,
        maxDays: 30,
      },
    })
  console.log(
    "   ✅ Visa rates configured (Short: 470 SAR / PKR 42,500, Long: 750 SAR / PKR 68,000)."
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
      validFrom: "2026-09-01",
      validUntil: "2026-12-31",
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
      validFrom: "2026-09-01",
      validUntil: "2026-12-31",
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
      validFrom: "2026-09-01",
      validUntil: "2026-12-31",
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
      validFrom: "2026-09-01",
      validUntil: "2026-12-31",
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
      validFrom: "2026-09-01",
      validUntil: "2026-12-31",
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
      validFrom: "2026-09-01",
      validUntil: "2026-12-31",
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
      validFrom: "2026-09-01",
      validUntil: "2026-12-31",
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
        "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800",
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
      validFrom: "2026-09-01",
      validUntil: "2026-12-31",
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
        "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800",
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
      validFrom: "2026-09-01",
      validUntil: "2026-12-31",
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
        "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800",
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
      validFrom: "2026-09-01",
      validUntil: "2026-12-31",
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
        "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800",
      galleryUrls: [
        "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800",
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
      validFrom: "2026-09-01",
      validUntil: "2026-12-31",
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
      validFrom: "2026-09-01",
      validUntil: "2026-12-31",
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
      validFrom: "2026-09-01",
      validUntil: "2026-12-31",
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
      validFrom: "2026-09-01",
      validUntil: "2026-12-31",
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
      validFrom: "2026-09-01",
      validUntil: "2026-12-31",
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
        "https://images.unsplash.com/photo-1568495248636-6432b97bd949?w=800",
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
      validFrom: "2026-09-01",
      validUntil: "2026-12-31",
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
        "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800",
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
      validFrom: "2026-09-01",
      validUntil: "2026-12-31",
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
      validFrom: "2026-09-01",
      validUntil: "2026-12-31",
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
        "The Mountain of Light where the first divine revelation of the Holy Quran descended upon Prophet Muhammad (PBUH).",
      imageUrl:
        "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?w=800",
      sortOrder: 1,
    },
    {
      city: "makkah" as const,
      name: "Jabal Thawr & Cave of Thawr",
      arabicName: "جبل ثور وغار ثور",
      description:
        "The historical sanctuary where the Prophet (PBUH) and Abu Bakr As-Siddiq (RA) took refuge during the Hijrah to Madinah.",
      imageUrl:
        "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800",
      sortOrder: 2,
    },
    {
      city: "makkah" as const,
      name: "Sacred Sites of Hajj: Mina, Muzdalifah & Arafat",
      arabicName: "المشاعر المقدسة: منى ومزدلفة وعرفات",
      description:
        "The expansive ritual plains of Hajj, including the Jamarat tent city, Muzdalifah grounds, and Jabal al-Rahmah (Mount of Mercy).",
      imageUrl:
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800",
      sortOrder: 3,
    },
    {
      city: "makkah" as const,
      name: "Jannat al-Mu'alla Cemetery",
      arabicName: "مقبرة المعلاة",
      description:
        "The venerable burial ground holding the resting place of Sayyidah Khadijah (RA) and prominent early Sahabah.",
      imageUrl:
        "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800",
      sortOrder: 4,
    },
    {
      city: "makkah" as const,
      name: "Masjid al-Jinn & Masjid ash-Shajarah",
      arabicName: "مسجد الجن ومسجد الشجرة",
      description:
        "Historic mosques commemorating the acceptance of Islam by the Jinn and the miracle of the obedient tree.",
      imageUrl:
        "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800",
      sortOrder: 5,
    },

    // Madinah Sites
    {
      city: "madinah" as const,
      name: "Masjid Quba",
      arabicName: "مسجد قباء",
      description:
        "The first mosque constructed in Islamic history; performing two rak'ats here carries the spiritual reward of an Umrah.",
      imageUrl:
        "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800",
      sortOrder: 6,
    },
    {
      city: "madinah" as const,
      name: "Mount Uhud & Martyrs Cemetery",
      arabicName: "جبل أحد ومقبرة الشهداء",
      description:
        "The monumental mountain that loves the believers, overlooking the resting place of Sayyid ash-Shuhada Hamza (RA) and 70 martyrs.",
      imageUrl:
        "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800",
      sortOrder: 7,
    },
    {
      city: "madinah" as const,
      name: "Masjid al-Qiblatayn",
      arabicName: "مسجد القبلتين",
      description:
        "The historical sanctuary where the direction of prayer was divinely shifted from Jerusalem to the Holy Kaaba in Makkah.",
      imageUrl:
        "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800",
      sortOrder: 8,
    },
    {
      city: "madinah" as const,
      name: "The Seven Mosques & Battle of the Trench (Khandaq)",
      arabicName: "المساجد السبعة وموقع غزوة الخندق",
      description:
        "The fortification sites and defensive command posts of the Muslim army during the historic siege of Madinah.",
      imageUrl:
        "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800",
      sortOrder: 9,
    },
    {
      city: "madinah" as const,
      name: "Jannat al-Baqi Cemetery",
      arabicName: "مقبرة بقيع الغرقد",
      description:
        "Adjacent to the Prophet's Mosque, the sacred resting ground of thousands of noble Sahabah and the Prophet's pure family.",
      imageUrl:
        "https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800",
      sortOrder: 10,
    },
    {
      city: "madinah" as const,
      name: "Bir Uthman (Well of Uthman RA)",
      arabicName: "بئر عثمان بن عفان رضي الله عنه",
      description:
        "The historical sweet water well purchased by Uthman ibn Affan (RA) as a perpetual waqf for all Muslims.",
      imageUrl:
        "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800",
      sortOrder: 11,
    },
    {
      city: "madinah" as const,
      name: "Dates Market of Madinah (Souq at-Tumoor)",
      arabicName: "سوق تمور المدينة",
      description:
        "The bustling cultural marketplace for blessed Ajwa, Safawi, and Amber dates grown in the blessed orchards of Madinah.",
      imageUrl:
        "https://images.unsplash.com/photo-1568495248636-6432b97bd949?w=800",
      sortOrder: 12,
    },
  ]

  for (const z of ziyaratData) {
    const existing = await db.query.ziyaratPlaces.findFirst({
      where: eq(schema.ziyaratPlaces.name, z.name),
    })
    if (!existing) {
      await db.insert(schema.ziyaratPlaces).values(z)
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
      })
      .where(eq(schema.groupPackages.id, pkg4.id))
  }

  // Seed Departures for Package 1
  if (pkg1 && isbCity && lheCity) {
    await db
      .insert(schema.groupDepartures)
      .values([
        {
          packageId: pkg1.id,
          batchCode: "ART-RAM-ISB-01",
          departureCityId: isbCity.id,
          departureDate: "2026-11-10",
          returnDate: "2026-11-25",
          totalSeats: 30,
          bookedSeats: 26,
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
          departureDate: "2026-11-18",
          returnDate: "2026-12-03",
          totalSeats: 35,
          bookedSeats: 12,
          status: "open",
          sharingPriceOverridePkr: 419999,
          outboundFlightNumber: "SV-737",
          returnFlightNumber: "SV-734",
          flightScheduleSummary: "LHE-RUH-JED 04:00–09:30 | JED-LHE 16:00–22:45",
          routingNote: "Via Riyadh (Saudi Airlines)",
          baggageAllowance: "23-KG Outbound / 46-KG Return",
        },
      ])
      .onConflictDoNothing()
  }

  // Seed Departures for Package 2
  if (pkg2 && khiCity && isbCity) {
    await db
      .insert(schema.groupDepartures)
      .values([
        {
          packageId: pkg2.id,
          batchCode: "ART-GLD-KHI-01",
          departureCityId: khiCity.id,
          departureDate: "2026-11-15",
          returnDate: "2026-11-29",
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
          batchCode: "ART-GLD-ISB-02",
          departureCityId: isbCity.id,
          departureDate: "2026-12-01",
          returnDate: "2026-12-15",
          totalSeats: 30,
          bookedSeats: 30,
          status: "sold_out",
          sharingPriceOverridePkr: 345000,
          outboundFlightNumber: "SV-739",
          returnFlightNumber: "SV-738",
          flightScheduleSummary: "ISB-JED 03:15–06:20 | JED-ISB 18:30–01:10",
          routingNote: "Direct Non-Stop (Saudi Airlines)",
          baggageAllowance: "23-KG Outbound / 46-KG Return",
        },
      ])
      .onConflictDoNothing()
  }

  // Seed Departures for Package 4 (21-Day Long Stay with SV-739 / SV-738 Flyer schedule)
  if (pkg4 && lheCity) {
    await db
      .insert(schema.groupDepartures)
      .values([
        {
          packageId: pkg4.id,
          batchCode: "ART-BRZ-LHE-21",
          departureCityId: lheCity.id,
          departureDate: "2026-11-05",
          returnDate: "2026-11-26",
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
      ])
      .onConflictDoNothing()
  }
  console.log("   ✅ 4 group packages and scheduled departure batches seeded.")

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

  // Testimonials
  const testimonialsData = [
    {
      pilgrimName: "Dr. Farooq Malik",
      city: "Lahore",
      quote:
        "Al Ramlah Travels planned our family's 14-day Umrah with elderly parents. The Fairmont Clock Tower rooms and the GMC Yukon airport transfer made the entire journey effortless and spiritually uplifting.",
      packageOrJourneyType: "Custom Family Journey (5 Pax)",
      rating: 5,
      avatarUrl:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128",
      isFeatured: true,
      sortOrder: 1,
    },
    {
      pilgrimName: "Saima & Tariq Abbasi",
      city: "Islamabad",
      quote:
        "The live quotation on WhatsApp within an hour of submission was remarkably professional. Every hotel voucher, train seat, and visa was issued ahead of time with zero surprises.",
      packageOrJourneyType: "Royal Ramadan Executive Umrah",
      rating: 5,
      avatarUrl:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128",
      isFeatured: true,
      sortOrder: 2,
    },
    {
      pilgrimName: "Salman Siddiqui",
      city: "Karachi",
      quote:
        "Their visa team handled our family's 6 passports in record time. Transparent PKR pricing without hidden conversion fees. Will only travel through Al Ramlah in future.",
      packageOrJourneyType: "Visa & Ground Transport Package",
      rating: 5,
      avatarUrl:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=128",
      isFeatured: true,
      sortOrder: 3,
    },
  ]

  for (const t of testimonialsData) {
    const existing = await db.query.testimonials.findFirst({
      where: eq(schema.testimonials.pilgrimName, t.pilgrimName),
    })
    if (!existing) {
      await db.insert(schema.testimonials).values(t)
    }
  }

  // FAQs
  const faqsData = [
    {
      category: "visa" as const,
      question:
        "What is the difference between short-term and long-term Umrah visas?",
      answer:
        "Visas for stays of 30 days or fewer are categorized as short-term (regulatory rate PKR 42,500), while stays between 31 and 90 days are categorized as long-term (PKR 68,000). Both include mandatory Saudi healthcare and emergency insurance. Our system automatically computes the required tier based on your entry and departure dates.",
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

  console.log(
    "   ✅ Hero slides, testimonials, and FAQs seeded."
  )

  // ==========================================
  // 11. B2B SUPPLIERS, WRAPPED FLYERS, 30+ WA GROUPS & 14-DAY OUTREACH CRM
  // ==========================================
  console.log(
    "📦 Seeding B2B Suppliers (Ammaar, Upsky Travels, Zahoor Travels), Flyers, 30+ WhatsApp Groups & 14-Day Outreach CRM..."
  )

  const migrationSqlPath = path.join(
    process.cwd(),
    "drizzle",
    "0001_suppliers_marketing_and_meal_plans.sql"
  )
  if (fs.existsSync(migrationSqlPath)) {
    const rawSql = fs.readFileSync(migrationSqlPath, "utf8")
    const statements = rawSql
      .replace(/DO \$\$ BEGIN[\s\S]*?END \$\$;/g, (m) =>
        m.replace(/;/g, "__SEMI__")
      )
      .split(";")
      .map((s) => s.replace(/__SEMI__/g, ";").trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"))
    for (const stmt of statements) {
      await db.execute(sql.raw(stmt))
    }
  }

  const suppliersSeed = [
    {
      name: "Ammaar",
      slug: "ammaar",
      codePrefix: "AM",
      category: "group_packages" as const,
      defaultCommissionMode: "included_in_flyer" as const,
      defaultCommissionPkr: 22000,
      contactPerson: "Ammaar Group Desk",
      whatsappNumber: "03004001122",
      phone: "04235761122",
      notes: "21-Day Airblue & SereneAir Umrah Group Consolidator",
      isActive: true,
    },
    {
      name: "Upsky Travels",
      slug: "upsky-travels",
      codePrefix: "UP",
      category: "group_packages" as const,
      defaultCommissionMode: "included_in_flyer" as const,
      defaultCommissionPkr: 23000,
      contactPerson: "Upsky B2B Desk",
      whatsappNumber: "03214003344",
      phone: "04235883344",
      notes: "15-Day Direct Saudi Airlines (SV) Umrah Group Consolidator",
      isActive: true,
    },
    {
      name: "Zahoor Travels",
      slug: "zahoor-travels",
      codePrefix: "ZH",
      category: "custom_packages" as const,
      defaultCommissionMode: "net_plus_markup" as const,
      defaultCommissionPkr: 25000,
      contactPerson: "Zahoor VIP Quoting Desk",
      whatsappNumber: "03334005566",
      phone: "04235995566",
      notes: "Custom VIP 5-Star Mövenpick & Clock Tower Umrah Quotations",
      isActive: true,
    },
  ]

  const supplierMap = new Map<string, string>()
  for (const sup of suppliersSeed) {
    const existing = await db.query.suppliers.findFirst({
      where: eq(schema.suppliers.slug, sup.slug),
    })
    if (!existing) {
      const [inserted] = await db
        .insert(schema.suppliers)
        .values(sup)
        .returning()
      supplierMap.set(sup.slug, inserted.id)
    } else {
      await db
        .update(schema.suppliers)
        .set(sup)
        .where(eq(schema.suppliers.id, existing.id))
      supplierMap.set(sup.slug, existing.id)
    }
  }

  const ammaarId = supplierMap.get("ammaar")!
  const upskyId = supplierMap.get("upsky-travels")!
  const zahoorId = supplierMap.get("zahoor-travels")!

  // Clear and re-seed sample flyers to keep deterministic Post Codes clean
  await db.delete(schema.dailyPostDistributions)
  await db.delete(schema.outreachLogs)
  await db.delete(schema.postAssets)
  await db.delete(schema.supplierFlyerPackages)
  await db.delete(schema.supplierFlyers)

  // Flyer 1: Ammaar 21-Day Airblue Flyer
  const [ammaarFlyer] = await db
    .insert(schema.supplierFlyers)
    .values({
      supplierId: ammaarId,
      title: "Ammaar 21 Days Airblue Umrah Packages (PA 470/471)",
      rawFlyerImageUrl: "/uploads/sample-posts/ammaar-raw-17cards.jpg",
      airlineName: "Airblue",
      airlineIataCode: "PA",
      airlineLogoUrl: "https://images.kiwi.com/airlines/64/PA.png",
      durationDays: 21,
      daysTitle: "21 DAYS",
      routePill: "LHE - JED | JED - LHE",
      departureCityCode: "LHE",
      arrivalAirportCode: "JED",
      returnAirportCode: "JED",
      outboundBaggage: "20 Kg + 7 Kg",
      inboundBaggage: "30 Kg + 7 Kg + 5 Ltr Zamzam",
      giftedInclusions: ["Visa", "Insurance", "Hotel", "Return Ticket", "Transport"],
      commissionMode: "included_in_flyer",
      commissionPkr: 22000,
      receivedDate: "2026-11-01",
      multiSheetImageUrl: "/uploads/sample-posts/ammaar-wrapped-sheet.png",
      extractedCardsCount: 4,
      status: "wrapped",
    })
    .returning()

  const ammaarCards = [
    {
      cardNumber: "01",
      postCode: "ART-AM-21D-01",
      outboundFlightNo: "PA 470",
      outboundDateLabel: "03 NOV",
      outboundRoute: "LHE - JED",
      outboundDepTime: "06:35",
      outboundArrTime: "10:35",
      returnFlightNo: "PA 471",
      returnDateLabel: "24 NOV",
      returnRoute: "JED - LHE",
      returnDepTime: "11:35",
      returnArrTime: "18:20",
      makkahNights: "15N",
      makkahHotelName: "Fajr Al Badea 2",
      makkahDistanceLabel: "(Shuttle)",
      madinahNights: "05N",
      madinahHotelName: "Burj Al Mukhtara",
      madinahDistanceLabel: "(600M)",
      mealPlanLabel: "Room Only",
      sharing: 239899,
      quad: 245899,
      triple: 256899,
      double: 279899,
    },
    {
      cardNumber: "04",
      postCode: "ART-AM-21D-04",
      outboundFlightNo: "PA 470",
      outboundDateLabel: "10 NOV",
      outboundRoute: "LHE - JED",
      outboundDepTime: "06:35",
      outboundArrTime: "10:35",
      returnFlightNo: "PA 471",
      returnDateLabel: "01 DEC",
      returnRoute: "JED - LHE",
      returnDepTime: "11:35",
      returnArrTime: "18:20",
      makkahNights: "15N",
      makkahHotelName: "Dar Al Khalil Al Rushad",
      makkahDistanceLabel: "(600M)",
      madinahNights: "05N",
      madinahHotelName: "Emaar Taiba",
      madinahDistanceLabel: "(400M)",
      mealPlanLabel: "Room Only",
      sharing: 269899,
      quad: 279899,
      triple: 298899,
      double: 334899,
    },
    {
      cardNumber: "08",
      postCode: "ART-AM-21D-08",
      outboundFlightNo: "PA 470",
      outboundDateLabel: "19 NOV",
      outboundRoute: "LHE - JED",
      outboundDepTime: "06:35",
      outboundArrTime: "10:35",
      returnFlightNo: "PA 471",
      returnDateLabel: "10 DEC",
      returnRoute: "JED - LHE",
      returnDepTime: "11:35",
      returnArrTime: "18:20",
      makkahNights: "15N",
      makkahHotelName: "Voco Makkah IHG",
      makkahDistanceLabel: "(1300M VIP Shuttle)",
      madinahNights: "05N",
      madinahHotelName: "Pullman Zamzam Madinah",
      madinahDistanceLabel: "(150M)",
      mealPlanLabel: "Breakfast Included",
      sharing: 319899,
      quad: 335899,
      triple: 365899,
      double: 419899,
    },
    {
      cardNumber: "10",
      postCode: "ART-AM-21D-10",
      outboundFlightNo: "PA 470",
      outboundDateLabel: "24 NOV",
      outboundRoute: "LHE - JED",
      outboundDepTime: "06:35",
      outboundArrTime: "10:35",
      returnFlightNo: "PA 471",
      returnDateLabel: "15 DEC",
      returnRoute: "JED - LHE",
      returnDepTime: "11:35",
      returnArrTime: "18:20",
      makkahNights: "15N",
      makkahHotelName: "Swissotel Al Maqam",
      makkahDistanceLabel: "(0M Clock Tower)",
      madinahNights: "05N",
      madinahHotelName: "Anwar Al Madinah Movenpick",
      madinahDistanceLabel: "(0M Haram Courtyard)",
      mealPlanLabel: "Breakfast Included",
      sharing: 439899,
      quad: 465899,
      triple: 515899,
      double: 599899,
    },
  ]

  const insertedAmmaarPkgs = await db
    .insert(schema.supplierFlyerPackages)
    .values(
      ammaarCards.map((c) => ({
        flyerId: ammaarFlyer.id,
        supplierId: ammaarId,
        cardNumber: c.cardNumber,
        postCode: c.postCode,
        outboundFlightNo: c.outboundFlightNo,
        outboundDateLabel: c.outboundDateLabel,
        outboundRoute: c.outboundRoute,
        outboundDepTime: c.outboundDepTime,
        outboundArrTime: c.outboundArrTime,
        returnFlightNo: c.returnFlightNo,
        returnDateLabel: c.returnDateLabel,
        returnRoute: c.returnRoute,
        returnDepTime: c.returnDepTime,
        returnArrTime: c.returnArrTime,
        makkahNights: c.makkahNights,
        makkahHotelName: c.makkahHotelName,
        makkahDistanceLabel: c.makkahDistanceLabel,
        madinahNights: c.madinahNights,
        madinahHotelName: c.madinahHotelName,
        madinahDistanceLabel: c.madinahDistanceLabel,
        mealPlanLabel: c.mealPlanLabel,
        rawSharingPkr: c.sharing,
        rawQuadPkr: c.quad,
        rawTriplePkr: c.triple,
        rawDoublePkr: c.double,
        netSharingPkr: c.sharing - 22000,
        netQuadPkr: c.quad - 22000,
        netTriplePkr: c.triple - 22000,
        netDoublePkr: c.double - 22000,
        retailSharingPkr: c.sharing,
        retailQuadPkr: c.quad,
        retailTriplePkr: c.triple,
        retailDoublePkr: c.double,
        commissionPkr: 22000,
        spotlightPosterUrl:
          c.cardNumber === "04"
            ? "/uploads/sample-posts/ammaar-spotlight-04.png"
            : "/uploads/sample-posts/ammaar-wrapped-sheet.png",
      }))
    )
    .returning()

  // Flyer 2: Upsky Travels 15-Day Saudi Airlines Flyer
  const [upskyFlyer] = await db
    .insert(schema.supplierFlyers)
    .values({
      supplierId: upskyId,
      title: "Upsky Travels 15 Days Saudi Airlines Umrah Packages (SV 733/732)",
      rawFlyerImageUrl: "/uploads/sample-posts/upsky-raw-15d.jpeg",
      airlineName: "Saudi Airlines",
      airlineIataCode: "SV",
      airlineLogoUrl: "https://images.kiwi.com/airlines/64/SV.png",
      durationDays: 15,
      daysTitle: "15 DAYS",
      routePill: "LHE - JED | JED - LHE",
      departureCityCode: "LHE",
      arrivalAirportCode: "JED",
      returnAirportCode: "JED",
      outboundBaggage: "23 Kg × 2 + 7 Kg",
      inboundBaggage: "23 Kg × 2 + 7 Kg + 5 Ltr Zamzam",
      giftedInclusions: ["Visa", "Insurance", "Hotel", "Return Ticket", "Transport", "Ziyarat"],
      commissionMode: "included_in_flyer",
      commissionPkr: 23000,
      receivedDate: "2026-11-01",
      multiSheetImageUrl: "/uploads/sample-posts/upsky-wrapped-15d.jpeg",
      extractedCardsCount: 2,
      status: "wrapped",
    })
    .returning()

  const insertedUpskyPkgs = await db
    .insert(schema.supplierFlyerPackages)
    .values([
      {
        flyerId: upskyFlyer.id,
        supplierId: upskyId,
        cardNumber: "01",
        postCode: "ART-UP-15D-01",
        outboundFlightNo: "SV 733",
        outboundDateLabel: "15 NOV",
        outboundRoute: "LHE - JED",
        outboundDepTime: "11:15",
        outboundArrTime: "15:10",
        returnFlightNo: "SV 732",
        returnDateLabel: "29 NOV",
        returnRoute: "JED - LHE",
        returnDepTime: "02:30",
        returnArrTime: "09:15",
        makkahNights: "08N",
        makkahHotelName: "Emaar Al Khalil",
        makkahDistanceLabel: "(450M)",
        madinahNights: "06N",
        madinahHotelName: "Emaar Taiba",
        madinahDistanceLabel: "(400M)",
        mealPlanLabel: "Room Only",
        rawSharingPkr: 289899,
        rawQuadPkr: 299899,
        rawTriplePkr: 318899,
        rawDoublePkr: 352899,
        netSharingPkr: 266899,
        netQuadPkr: 276899,
        netTriplePkr: 295899,
        netDoublePkr: 329899,
        retailSharingPkr: 289899,
        retailQuadPkr: 299899,
        retailTriplePkr: 318899,
        retailDoublePkr: 352899,
        commissionPkr: 23000,
        spotlightPosterUrl: "/uploads/sample-posts/upsky-wrapped-15d.jpeg",
      },
      {
        flyerId: upskyFlyer.id,
        supplierId: upskyId,
        cardNumber: "02",
        postCode: "ART-UP-15D-02",
        outboundFlightNo: "SV 733",
        outboundDateLabel: "22 NOV",
        outboundRoute: "LHE - JED",
        outboundDepTime: "11:15",
        outboundArrTime: "15:10",
        returnFlightNo: "SV 732",
        returnDateLabel: "06 DEC",
        returnRoute: "JED - LHE",
        returnDepTime: "02:30",
        returnArrTime: "09:15",
        makkahNights: "08N",
        makkahHotelName: "Elaf Kinda Hotel",
        makkahDistanceLabel: "(50M Haram Yard)",
        madinahNights: "06N",
        madinahHotelName: "Taiba Front Hotel",
        madinahDistanceLabel: "(50M Haram Yard)",
        mealPlanLabel: "Breakfast Included",
        rawSharingPkr: 389899,
        rawQuadPkr: 412899,
        rawTriplePkr: 454899,
        rawDoublePkr: 524899,
        netSharingPkr: 366899,
        netQuadPkr: 389899,
        netTriplePkr: 431899,
        netDoublePkr: 501899,
        retailSharingPkr: 389899,
        retailQuadPkr: 412899,
        retailTriplePkr: 454899,
        retailDoublePkr: 524899,
        commissionPkr: 23000,
        spotlightPosterUrl: "/uploads/sample-posts/upsky-wrapped-15d.jpeg",
      },
    ])
    .returning()

  // Seed Post Assets (Multi-Package Sheets + Single-Package Spotlights)
  const [ammaarSheetAsset, ammaarSpotAsset, upskySheetAsset, upskySpotAsset] =
    await db
      .insert(schema.postAssets)
      .values([
        {
          postCode: "ART-AM-21D-ALL",
          kind: "multi_package_sheet",
          title: "Ammaar 21 Days Airblue — All-Packages Sheet",
          supplierId: ammaarId,
          flyerId: ammaarFlyer.id,
          imageUrl: "/uploads/sample-posts/ammaar-wrapped-sheet.png",
          captionWhatsapp:
            "*AL RAMLAH TRAVELS — 21 DAYS AIRBLUE UMRAH PACKAGES*\n✈️ Airline: Airblue (LHE-JED-LHE)\n💰 Starting From: PKR 239,899\n📌 Ref: ART-AM-21D-ALL\n📞 Call/WA: 03274029701 | 03190462638",
          searchableText:
            "ART-AM-21D-ALL Ammaar Airblue 21 Days Fajr Al Badea Dar Al Khalil Swissotel",
        },
        {
          postCode: "ART-AM-21D-04",
          kind: "single_package_spotlight",
          title: "21 Days Spotlight #04 — Dar Al Khalil (600m) + Emaar Taiba",
          supplierId: ammaarId,
          flyerId: ammaarFlyer.id,
          flyerPackageId: insertedAmmaarPkgs[1]!.id,
          imageUrl: "/uploads/sample-posts/ammaar-spotlight-04.png",
          captionWhatsapp:
            "*✨ AL RAMLAH TRAVELS — 21 DAYS UMRAH SPOTLIGHT ✨*\n🔖 Post Ref: ART-AM-21D-04\n✈️ Airblue PA 470 (10 NOV → 01 DEC)\n🕋 Makkah (15N): Dar Al Khalil Al Rushad (600M)\n🕌 Madinah (05N): Emaar Taiba (400M)\n💰 Sharing: PKR 269,899 | Quad: PKR 279,899\n📞 Call/WA: 03274029701 | 03190462638",
          searchableText:
            "ART-AM-21D-04 Dar Al Khalil Emaar Taiba 269899 279899 10 NOV",
        },
        {
          postCode: "ART-UP-15D-ALL",
          kind: "multi_package_sheet",
          title: "Upsky 15 Days Saudi Airlines — All-Packages Sheet",
          supplierId: upskyId,
          flyerId: upskyFlyer.id,
          imageUrl: "/uploads/sample-posts/upsky-wrapped-15d.jpeg",
          captionWhatsapp:
            "*AL RAMLAH TRAVELS — 15 DAYS DIRECT SAUDI AIRLINES UMRAH*\n✈️ Airline: Saudi Airlines SV 733/732\n💰 Starting From: PKR 289,899\n📌 Ref: ART-UP-15D-ALL\n📞 Call/WA: 03274029701 | 03190462638",
          searchableText:
            "ART-UP-15D-ALL Upsky Saudi Airlines 15 Days Emaar Al Khalil Elaf Kinda",
        },
        {
          postCode: "ART-UP-15D-01",
          kind: "single_package_spotlight",
          title: "15 Days Saudia Spotlight #01 — Emaar Al Khalil + Emaar Taiba",
          supplierId: upskyId,
          flyerId: upskyFlyer.id,
          flyerPackageId: insertedUpskyPkgs[0]!.id,
          imageUrl: "/uploads/sample-posts/upsky-wrapped-15d.jpeg",
          captionWhatsapp:
            "*✨ AL RAMLAH TRAVELS — 15 DAYS SAUDIA SPOTLIGHT ✨*\n🔖 Post Ref: ART-UP-15D-01\n✈️ Saudi Airlines SV 733 (15 NOV → 29 NOV)\n🕋 Makkah (08N): Emaar Al Khalil (450M)\n🕌 Madinah (06N): Emaar Taiba (400M)\n💰 Sharing: PKR 289,899 | Quad: PKR 299,899\n📞 Call/WA: 03274029701 | 03190462638",
          searchableText:
            "ART-UP-15D-01 Emaar Al Khalil Emaar Taiba 289899 15 NOV Saudia",
        },
      ])
      .returning()

  // Seed 36 Marketing Channels (30 WhatsApp Groups across Askari 10, DHA, Lahore, Other Cities + 2 Statuses + 4 Social)
  await db.delete(schema.marketingChannels)
  const channelsSeed = [
    // Askari 10 (10 Groups)
    ...[
      "Askari 10 Sector A Residents Forum",
      "Askari 10 Sector B Community",
      "Askari 10 Sector C Welfare Group",
      "Askari 10 Sector D & E Residents",
      "Askari 10 Sector F Executive Hub",
      "Askari 10 Ladies & Families Circle",
      "Askari 10 Masjid & Islamic Events",
      "Askari 10 Business & Trade Directory",
      "Askari 10 Villas & Apartments Group",
      "Askari 10 Youth & Families Network",
    ].map((name, i) => ({
      name,
      platform: "whatsapp_group" as const,
      areaTag: "Askari 10",
      senderWhatsappNumber: i % 2 === 0 ? "03274029701" : "03190462638",
      memberCount: 420 + i * 35,
      dailyTargetPosts: 1,
      isActive: true,
    })),
    // DHA Lahore (10 Groups)
    ...[
      "DHA Phase 1 & 2 Residents Hub",
      "DHA Phase 3 Block Y & Z Community",
      "DHA Phase 4 Families Forum",
      "DHA Phase 5 Executive Residents",
      "DHA Phase 6 Main Boulevard Community",
      "DHA Phase 7 & 8 Homeowners Circle",
      "DHA Rahbar & EME Sector Community",
      "DHA Lahore Business & Professionals",
      "DHA Lahore Islamic & Umrah Circle",
      "DHA Lahore Overseas Pakistanis",
    ].map((name, i) => ({
      name,
      platform: "whatsapp_group" as const,
      areaTag: "DHA",
      senderWhatsappNumber: i % 2 === 0 ? "03274029701" : "03190462638",
      memberCount: 510 + i * 40,
      dailyTargetPosts: 1,
      isActive: true,
    })),
    // Lahore Cantt / Bahria / Model Town / Gulberg (6 Groups)
    ...[
      "Lahore Cantt & Polo Club Families",
      "Bahria Town Lahore Executive Forum",
      "Model Town Blocks A-M Residents",
      "Gulberg & Cavalry Ground Community",
      "Wapda Town & Valencia Residents",
      "Lake City & Raiwind Golf Community",
    ].map((name, i) => ({
      name,
      platform: "whatsapp_group" as const,
      areaTag: "Lahore",
      senderWhatsappNumber: i % 2 === 0 ? "03274029701" : "03190462638",
      memberCount: 380 + i * 30,
      dailyTargetPosts: 1,
      isActive: true,
    })),
    // Other Cities (4 Groups)
    ...[
      "Islamabad F-6 / F-7 / DHA Pilgrims",
      "Gujranwala & Sialkot Business Chamber",
      "Faisalabad Textile & Business Families",
      "Multan & Bahawalpur Executive Circle",
    ].map((name, i) => ({
      name,
      platform: "whatsapp_group" as const,
      areaTag: "Other Cities",
      senderWhatsappNumber: i % 2 === 0 ? "03274029701" : "03190462638",
      memberCount: 340 + i * 25,
      dailyTargetPosts: 1,
      isActive: true,
    })),
    // 2 WhatsApp Statuses
    {
      name: "WhatsApp Status — Primary Line (03274029701)",
      platform: "whatsapp_status" as const,
      areaTag: "Status",
      senderWhatsappNumber: "03274029701",
      memberCount: 1850,
      dailyTargetPosts: 2,
      isActive: true,
    },
    {
      name: "WhatsApp Status — Secondary Line (03190462638)",
      platform: "whatsapp_status" as const,
      areaTag: "Status",
      senderWhatsappNumber: "03190462638",
      memberCount: 1420,
      dailyTargetPosts: 2,
      isActive: true,
    },
    // 4 Social Media Accounts
    {
      name: "Al Ramlah Travels Instagram (@alramlahtravels)",
      platform: "instagram" as const,
      areaTag: "Social",
      externalGroupIdOrHandle: "@alramlahtravels",
      memberCount: 4800,
      dailyTargetPosts: 1,
      isActive: true,
    },
    {
      name: "Al Ramlah Travels Facebook Page",
      platform: "facebook" as const,
      areaTag: "Social",
      externalGroupIdOrHandle: "fb.com/alramlahtravels",
      memberCount: 6200,
      dailyTargetPosts: 1,
      isActive: true,
    },
    {
      name: "Al Ramlah Travels TikTok (@alramlahtravels)",
      platform: "tiktok" as const,
      areaTag: "Social",
      externalGroupIdOrHandle: "@alramlahtravels",
      memberCount: 3100,
      dailyTargetPosts: 1,
      isActive: true,
    },
    {
      name: "Al Ramlah Travels YouTube Shorts",
      platform: "youtube" as const,
      areaTag: "Social",
      externalGroupIdOrHandle: "@alramlahtravels",
      memberCount: 1200,
      dailyTargetPosts: 1,
      isActive: true,
    },
  ]

  const insertedChannels = await db
    .insert(schema.marketingChannels)
    .values(channelsSeed)
    .returning()

  // Seed Sample Daily Post Distributions for Today
  const todayStr = new Date().toISOString().split("T")[0]!
  await db.insert(schema.dailyPostDistributions).values(
    insertedChannels.slice(0, 8).map((ch) => ({
      scheduledDate: todayStr,
      channelId: ch.id,
      postAssetId: ammaarSpotAsset.id,
      pairedFollowUpAssetId: ammaarSheetAsset.id,
      stage: "step_1_spotlight_hook" as const,
      status: "sent" as const,
      senderWhatsappLine: ch.senderWhatsappNumber || "03274029701",
      captionUsed: ammaarSpotAsset.captionWhatsapp,
      externalQueueJobId: `wacrm-seed-${ch.id.slice(0, 6)}`,
      postedAt: new Date(),
    }))
  )

  // Seed 14-Day Personal Outreach Contacts
  await db.delete(schema.outreachContacts)
  const nowTs = Date.now()
  const dayMs = 24 * 60 * 60 * 1000

  await db.insert(schema.outreachContacts).values([
    {
      fullName: "Brig. (R) Tariq Mahmood",
      whatsappNumber: "03004112233",
      city: "Lahore",
      areaCommunity: "Askari 10",
      sourceGroupOrChannel: "Askari 10 Sector B Community",
      assignedWhatsappLine: "03274029701",
      interestStatus: "interested",
      lastOutreachAt: new Date(nowTs - 16 * dayMs),
      cooldownUntil: new Date(nowTs - 2 * dayMs),
      totalOutreachCount: 2,
      packagesSharedHistory: ["ART-AM-21D-01"],
      tags: ["Askari 10", "Family of 4"],
    },
    {
      fullName: "Col. (R) Salman Rashid",
      whatsappNumber: "03214223344",
      city: "Lahore",
      areaCommunity: "Askari 10",
      sourceGroupOrChannel: "Askari 10 Sector F Executive Hub",
      assignedWhatsappLine: "03274029701",
      interestStatus: "prospect",
      lastOutreachAt: null,
      cooldownUntil: null,
      totalOutreachCount: 0,
      packagesSharedHistory: [],
      tags: ["Askari 10", "First Outreach"],
    },
    {
      fullName: "Dr. Kamran & Mrs. Ayesha Siddiqui",
      whatsappNumber: "03334334455",
      city: "Lahore",
      areaCommunity: "DHA Phase 5",
      sourceGroupOrChannel: "DHA Phase 5 Executive Residents",
      assignedWhatsappLine: "03190462638",
      interestStatus: "interested",
      lastOutreachAt: new Date(nowTs - 5 * dayMs),
      cooldownUntil: new Date(nowTs + 9 * dayMs), // Locked for 9 more days!
      totalOutreachCount: 1,
      packagesSharedHistory: ["ART-AM-21D-04"],
      tags: ["DHA", "14-Day Cooldown Active"],
    },
    {
      fullName: "Mian Usman Ghani",
      whatsappNumber: "03014445566",
      city: "Lahore",
      areaCommunity: "DHA Phase 6",
      sourceGroupOrChannel: "DHA Phase 6 Main Boulevard Community",
      assignedWhatsappLine: "03274029701",
      interestStatus: "active_conversation",
      lastOutreachAt: new Date(nowTs - 3 * dayMs),
      cooldownUntil: new Date(nowTs + 11 * dayMs),
      lastInboundReplyAt: new Date(nowTs - 1 * dayMs), // Replied after outreach -> Active Reply Exemption!
      totalOutreachCount: 1,
      packagesSharedHistory: ["ART-UP-15D-01"],
      tags: ["DHA", "Active Inbound Reply"],
    },
  ])

  // Seed Barrister Adil Rafi Cheema & Family Custom Quotation (Zahoor Travels — PKR 1,750,000)
  const existingAdilApp = await db.query.applications.findFirst({
    where: eq(schema.applications.referenceNumber, "ART-2026-ADIL"),
  })

  if (!existingAdilApp) {
    const [adilApp] = await db
      .insert(schema.applications)
      .values({
        referenceNumber: "ART-2026-ADIL",
        source: "custom_builder",
        status: "quoted",
        presetMode: "complete_umrah",
        supplierId: zahoorId,
        customerName: "Barrister Adil Rafi Cheema & Family",
        customerPhone: "03008445566",
        customerWhatsapp: "03008445566",
        customerCity: "Lahore",
        specialRequests:
          "5 Family Members (4 Adults, 1 Child). PIA Return Flights, 6 Nights Makkah Hajar Tower Mövenpick (with Daily Buffet Breakfast), 6 Nights Anwar Al Madinah Mövenpick, Private Hyundai Staria 7-Seater VIP Transfers.",
        adults: 4,
        children: 1,
        infants: 0,
        totalPassportCount: 5,
        bedAndSeatCount: 5,
        includeVisa: true,
        includeFlights: true,
        includeHotels: true,
        includeTransport: true,
        includeZiyarat: true,
        ksaArrivalDate: "2026-11-12",
        ksaDepartureDate: "2026-11-24",
        totalKsaDays: 13,
        citySequence: "makkah_madinah",
        entryAirport: "JED",
        exitAirport: "JED",
        quoteSentAt: new Date(),
      })
      .returning()

    await db.insert(schema.applicationQuotes).values({
      applicationId: adilApp.id,
      version: 1,
      visaTotalPkr: 212500,
      flightsTotalPkr: 625000,
      makkahHotelTotalPkr: 465000,
      madinahHotelTotalPkr: 335000,
      transportTotalPkr: 82500,
      ziyaratTotalPkr: 30000,
      discountPkr: 0,
      grandTotalPkr: 1750000,
      supplierId: zahoorId,
      supplierNetCostPkr: 1725000,
      commissionPkr: 25000,
      quotationPdfUrl: "/uploads/sample-posts/zahoor-adil-rafi-quotation.pdf",
      quotationPdfGeneratedAt: new Date(),
      quoteNotesCustomer:
        "All-Inclusive VIP Custom Umrah Quotation for Barrister Adil Rafi Cheema & Family (5 Travelers): PIA Return Flights, 6N Hajar Tower Mövenpick Makkah (Breakfast Included), 6N Anwar Al Madinah Mövenpick, Private Hyundai Staria 7-Seater.",
      internalNotesAdmin:
        "B2B Supplier: Zahoor Travels. Wholesale Net Cost: PKR 1,725,000 | Al Ramlah Commission: PKR 25,000.",
      paymentStatus: "partially_paid",
      amountPaidPkr: 500000,
      quotedAt: new Date(),
    })
  }

  console.log(
    "   ✅ B2B Suppliers, Wrapped Flyers, 36 Channels, 14-Day Outreach CRM & Barrister Adil Rafi Quote seeded."
  )

  console.log(
    "✨ Seed completed successfully! All tables populated with realistic data."
  )
  process.exit(0)
}

seed().catch((error) => {
  console.error("❌ Seed execution failed:", error)
  process.exit(1)
})
