import "dotenv/config"
import { eq, or } from "drizzle-orm"
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
    } catch (err: any) {
      console.log("   ℹ️ Admin account creation note:", err?.message || err)
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
    } catch (err: any) {
      console.log("   ℹ️ Staff account creation note:", err?.message || err)
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
      tagline: "Sacred Journeys Crafted with Dignity & Comfort",
      primaryWhatsapp: "+92 300 8456789",
      secondaryPhone: "+92 51 2345678",
      supportEmail: "contact@alramlahtravels.com",
      officeAddress:
        "Suite 402, Al-Hafeez Heights, Main Boulevard, Gulberg III, Lahore, Pakistan",
      mapsEmbedUrl:
        "https://maps.google.com/?q=Al-Hafeez+Heights+Gulberg+III+Lahore",
      facebookUrl: "https://facebook.com/alramlahtravels",
      instagramUrl: "https://instagram.com/alramlahtravels",
      youtubeUrl: "https://youtube.com/@alramlahtravels",
      tiktokUrl: "https://tiktok.com/@alramlahtravels",
      workingHours: "Monday to Saturday, 9:00 AM to 8:00 PM PKT",
      slaOverdueHours: 24,
      sarToPkrRate: 75,
      updatedByUserId: adminUserId,
    })
    .onConflictDoUpdate({
      target: schema.agencySettings.id,
      set: {
        primaryWhatsapp: "+92 300 8456789",
        supportEmail: "contact@alramlahtravels.com",
        officeAddress:
          "Suite 402, Al-Hafeez Heights, Main Boulevard, Gulberg III, Lahore, Pakistan",
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
  // 11. SAMPLE APPLICATIONS & QUOTES (RICH DATA)
  // ==========================================
  console.log(
    "📋 Seeding sample inquiries, hotel stays, segments & live quotes..."
  )

  const yukon = await db.query.vehicles.findFirst({
    where: or(
      eq(schema.vehicles.name, "GMC Yukon XL"),
      eq(schema.vehicles.name, "GMC Yukon")
    ),
  })
  const hiace = await db.query.vehicles.findFirst({
    where: eq(schema.vehicles.name, "Toyota HiAce"),
  })
  const jedMakSector = await db.query.transportSectors.findFirst({
    where: eq(schema.transportSectors.code, "JED_MAK"),
  })
  const makMedSector = await db.query.transportSectors.findFirst({
    where: eq(schema.transportSectors.code, "MAK_MED"),
  })
  const medAirSector = await db.query.transportSectors.findFirst({
    where: eq(schema.transportSectors.code, "MED_AIR"),
  })

  // Application 1: Custom Journey, Pending Quote
  const app1Ref = "ART-2026-8812"
  let app1 = await db.query.applications.findFirst({
    where: eq(schema.applications.referenceNumber, app1Ref),
  })

  if (!app1) {
    const [createdApp1] = await db
      .insert(schema.applications)
      .values({
        referenceNumber: app1Ref,
        source: "custom_builder",
        status: "pending_quote",
        presetMode: "complete_umrah",
        customerName: "Kamran Akram",
        customerPhone: "+923214567890",
        customerWhatsapp: "+923214567890",
        customerCity: "Lahore",
        customerEmail: "kamran.akram@gmail.com",
        specialRequests:
          "Traveling with elderly mother; ground floor or close to elevator preferred.",
        adults: 2,
        infants: 1,
        totalPassportCount: 3,
        bedAndSeatCount: 2, // 2 adults (infants occupy 0 beds / 0 seats)
        includeVisa: true,
        includeFlights: true,
        includeHotels: true,
        includeTransport: true,
        includeZiyarat: true,
        ksaArrivalDate: "2026-11-12",
        ksaDepartureDate: "2026-11-26",
        totalKsaDays: 15,
        calculatedVisaTier: "short_term",
        lockedVisaRatePerPersonPkr: 42500,
        calculatedVisaTotalPkr: 170000, // 4 passports * 42,500
        citySequence: "makkah_madinah",
        entryAirport: "JED", // Locked: Makkah first
        exitAirport: "MED",
        departureCityId: lheCity?.id,
        flightRouteType: "direct",
        cabinClass: "economy",
        preferredAirlineId: saudia?.id,
        ziyaratScope: "both",
        ziyaratVehicleId: yukon?.id,
        assignedStaffUserId: staffUserId,
      })
      .returning()

    app1 = createdApp1

    // Stays for App 1
    if (hyatt && oberoi) {
      await db.insert(schema.applicationHotelStays).values([
        {
          applicationId: app1.id,
          stayOrder: 1,
          city: "makkah",
          hotelId: hyatt.id,
          checkInDate: "2026-11-12",
          checkOutDate: "2026-11-20",
          nights: 8,
          roomCategory: "private",
          privateRoomAllocation: { double: 0, triple: 1, quad: 0 },
        },
        {
          applicationId: app1.id,
          stayOrder: 2,
          city: "madinah",
          hotelId: oberoi.id,
          checkInDate: "2026-11-20",
          checkOutDate: "2026-11-26",
          nights: 6,
          roomCategory: "private",
          privateRoomAllocation: { double: 0, triple: 1, quad: 0 },
        },
      ])
    }

    // Transport for App 1
    if (jedMakSector && makMedSector && medAirSector && yukon) {
      await db.insert(schema.applicationTransportSegments).values([
        {
          applicationId: app1.id,
          segmentOrder: 1,
          sectorId: jedMakSector.id,
          serviceType: "private",
          vehicleId: yukon.id,
          vehicleQuantity: 1,
          scheduledDate: "2026-11-12",
          pickupTime: "18:30",
          notes: "Airport meet and assist at terminal 1",
        },
        {
          applicationId: app1.id,
          segmentOrder: 2,
          sectorId: makMedSector.id,
          serviceType: "private",
          vehicleId: yukon.id,
          vehicleQuantity: 1,
          scheduledDate: "2026-11-20",
          pickupTime: "10:00",
        },
        {
          applicationId: app1.id,
          segmentOrder: 3,
          sectorId: medAirSector.id,
          serviceType: "private",
          vehicleId: yukon.id,
          vehicleQuantity: 1,
          scheduledDate: "2026-11-26",
          pickupTime: "15:00",
        },
      ])
    }
  }

  // Application 2: Custom Journey, Quoted & Partially Paid
  const app2Ref = "ART-2026-4521"
  let app2 = await db.query.applications.findFirst({
    where: eq(schema.applications.referenceNumber, app2Ref),
  })

  if (!app2) {
    const [createdApp2] = await db
      .insert(schema.applications)
      .values({
        referenceNumber: app2Ref,
        source: "custom_builder",
        status: "quoted",
        presetMode: "complete_umrah",
        customerName: "Dr. Ayesha Siddiqua",
        customerPhone: "+923005556677",
        customerWhatsapp: "+923005556677",
        customerCity: "Islamabad",
        customerEmail: "ayesha.siddiqua@shifa.com.pk",
        specialRequests: "High floor Haram view rooms if possible.",
        adults: 4,
        infants: 0,
        totalPassportCount: 4,
        bedAndSeatCount: 4,
        includeVisa: true,
        includeFlights: true,
        includeHotels: true,
        includeTransport: true,
        includeZiyarat: true,
        ksaArrivalDate: "2026-12-05",
        ksaDepartureDate: "2026-12-15",
        totalKsaDays: 11,
        calculatedVisaTier: "short_term",
        lockedVisaRatePerPersonPkr: 42500,
        calculatedVisaTotalPkr: 170000,
        citySequence: "makkah_madinah",
        entryAirport: "JED",
        exitAirport: "MED",
        departureCityId: isbCity?.id,
        flightRouteType: "direct",
        cabinClass: "economy",
        preferredAirlineId: saudia?.id,
        ziyaratScope: "both",
        ziyaratVehicleId: hiace?.id,
        assignedStaffUserId: staffUserId,
        quoteSentAt: new Date(),
      })
      .returning()

    app2 = createdApp2

    // Quote for App 2
    await db.insert(schema.applicationQuotes).values({
      applicationId: app2.id,
      version: 1,
      visaTotalPkr: 170000,
      flightsTotalPkr: 480000,
      makkahHotelTotalPkr: 450000,
      madinahHotelTotalPkr: 320000,
      transportTotalPkr: 120000,
      ziyaratTotalPkr: 50000,
      discountPkr: 20000,
      grandTotalPkr: 1570000,
      quoteNotesCustomer:
        "Package includes 4x Saudia direct return tickets, 5 nights Swissôtel Makkah + 5 nights Madinah Hilton with luxury amenities, private HiAce transport, and complete visa processing.",
      internalNotesAdmin:
        "Wholesale flight cost PKR 420,000. Margin PKR 60,000 on tickets.",
      paymentStatus: "partially_paid",
      amountPaidPkr: 500000,
      quotedByUserId: staffUserId,
      quotedAt: new Date(),
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
  }

  // Application 3: Group Booking, Approved & Paid in Full
  const app3Ref = "ART-2026-1930"
  let app3 = await db.query.applications.findFirst({
    where: eq(schema.applications.referenceNumber, app3Ref),
  })

  const pkg1Departure = await db.query.groupDepartures.findFirst({
    where: eq(schema.groupDepartures.batchCode, "ART-RAM-ISB-01"),
  })

  if (!app3 && pkg1 && pkg1Departure) {
    const [createdApp3] = await db
      .insert(schema.applications)
      .values({
        referenceNumber: app3Ref,
        source: "group_booking",
        status: "approved",
        presetMode: "group_package",
        customerName: "Zahid Mehmood",
        customerPhone: "+923331122334",
        customerWhatsapp: "+923331122334",
        customerCity: "Rawalpindi",
        customerEmail: "zahid.mehmood@gmail.com",
        adults: 2,
        infants: 0,
        totalPassportCount: 2,
        bedAndSeatCount: 2,
        includeVisa: true,
        includeFlights: true,
        includeHotels: true,
        includeTransport: true,
        includeZiyarat: true,
        groupPackageId: pkg1.id,
        groupDepartureId: pkg1Departure.id,
        selectedRoomType: "double",
        assignedStaffUserId: adminUserId,
        decisionAt: new Date(),
      })
      .returning()

    app3 = createdApp3

    await db.insert(schema.applicationQuotes).values({
      applicationId: app3.id,
      version: 1,
      visaTotalPkr: 85000,
      flightsTotalPkr: 280000,
      makkahHotelTotalPkr: 460000,
      madinahHotelTotalPkr: 380000,
      transportTotalPkr: 65000,
      ziyaratTotalPkr: 0,
      discountPkr: 0,
      grandTotalPkr: 1270000, // 2 x 635,000 double price
      quoteNotesCustomer:
        "Royal Ramadan 15-Day Package confirmed for 2 persons in Double Room sharing.",
      paymentStatus: "paid_in_full",
      amountPaidPkr: 1270000,
      quotedByUserId: adminUserId,
      quotedAt: new Date(),
      approvedAt: new Date(),
    })
  }
  console.log(
    "   ✅ Rich sample applications, stays, transport segments, and quotes seeded."
  )

  // ==========================================
  // 12. PUBLIC CMS (HERO, TESTIMONIALS, FAQS)
  // ==========================================
  console.log("🌟 Seeding public CMS content...")

  // Hero Slides
  const heroSlidesData = [
    {
      badge: "Al Ramlah Elite Pilgrimage",
      title: "Sacred Journeys Crafted with Dignity & Comfort",
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
      badge: "VIP Hajj Consultation 1448H",
      title: "Guaranteed Guidance for the Lifetime Obligation",
      subtitle:
        "Private consultations, pre-registration assistance, and verified executive arrangements for Pakistan & overseas diaspora pilgrims.",
      imageUrl:
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1600",
      primaryCtaLabel: "Request Hajj Consultation",
      primaryCtaUrl: "#hajj-inquiry",
      secondaryCtaLabel: "WhatsApp Consultant",
      secondaryCtaUrl: "https://wa.me/923008456789",
      sortOrder: 3,
    },
  ]

  for (const s of heroSlidesData) {
    const existing = await db.query.heroSlides.findFirst({
      where: eq(schema.heroSlides.title, s.title),
    })
    if (!existing) {
      await db.insert(schema.heroSlides).values(s)
    } else {
      await db
        .update(schema.heroSlides)
        .set({
          primaryCtaUrl: s.primaryCtaUrl,
          secondaryCtaUrl: s.secondaryCtaUrl,
          primaryCtaLabel: s.primaryCtaLabel,
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
      question: "How do infants affect our hotel room and vehicle bookings?",
      answer:
        "Infants under 2 years of age require a valid passport, Saudi visa, and infant airline ticket. However, they occupy zero hotel beds and zero vehicle seats. When booking private rooms or vehicles, our capacity calculations count adults only, saving you unnecessary room charges.",
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

  for (const f of faqsData) {
    const existing = await db.query.faqs.findFirst({
      where: eq(schema.faqs.question, f.question),
    })
    if (!existing) {
      await db.insert(schema.faqs).values(f)
    }
  }

  // Contact Messages
  const contactMessagesData = [
    {
      name: "Chaudhry Nadeem Afzal",
      email: "nadeem.afzal@textiles.pk",
      phone: "+923018899001",
      whatsapp: "+923018899001",
      subject: "Group of 18 Persons - Ramadan Last 10 Days Inquiry",
      message:
        "Assalam-o-Alaikum, We are an extended family of 18 intending to perform Umrah during the last 10 days of Ramadan. We require 4 quad rooms in Swissôtel or Fairmont, plus 1 double room. Please have a senior consultant call me.",
      status: "unread" as const,
    },
  ]

  for (const m of contactMessagesData) {
    const existing = await db.query.contactMessages.findFirst({
      where: eq(schema.contactMessages.phone, m.phone),
    })
    if (!existing) {
      await db.insert(schema.contactMessages).values(m)
    }
  }
  console.log(
    "   ✅ Hero slides, testimonials, FAQs, and contact messages seeded."
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
