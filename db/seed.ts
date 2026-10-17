import "dotenv/config"
import { eq } from "drizzle-orm"
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
      },
    })
  console.log("   ✅ Agency settings configured.")

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
        notes:
          "Valid for single or multiple entry within 30 days of arrival. Includes mandatory Saudi health insurance.",
        updatedByUserId: adminUserId,
      },
      {
        tier: "long_term",
        label: "Extended Tourist / Umrah Visa (Up to 90 Days)",
        maxDays: 90,
        pricePkr: 68000,
        notes:
          "Valid for comprehensive pilgrimage and tourism stays up to 90 days. Includes full medical insurance coverage.",
        updatedByUserId: adminUserId,
      },
    ])
    .onConflictDoUpdate({
      target: schema.visaRates.tier,
      set: {
        pricePkr: schema.visaRates.pricePkr,
        maxDays: schema.visaRates.maxDays,
      },
    })
  console.log(
    "   ✅ Visa rates configured (Short: PKR 42,500, Long: PKR 68,000)."
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
  // 6. HOTELS (MAKKAH & MADINAH 3★, 4★, 5★)
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
        "double" | "triple" | "quad"
      )[],
      offersDining: true,
      availableMealPlans: [
        "room_only",
        "breakfast",
        "half_board",
        "full_board",
      ] as ("room_only" | "breakfast" | "half_board" | "full_board")[],
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
        "Al Khairat Dining Hall",
        "Soundproof Rooms",
      ],
      allowsSharedRooms: true,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"] as (
        "double" | "triple" | "quad"
      )[],
      offersDining: true,
      availableMealPlans: [
        "room_only",
        "breakfast",
        "half_board",
        "full_board",
      ] as ("room_only" | "breakfast" | "half_board" | "full_board")[],
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
        "double" | "triple" | "quad"
      )[],
      offersDining: true,
      availableMealPlans: ["room_only", "breakfast", "half_board"] as (
        "room_only" | "breakfast" | "half_board"
      )[],
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
        "double" | "triple" | "quad"
      )[],
      offersDining: true,
      availableMealPlans: ["room_only", "breakfast", "half_board"] as (
        "room_only" | "breakfast" | "half_board"
      )[],
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
        "Spacious Dining Halls",
      ],
      allowsSharedRooms: true,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"] as (
        "double" | "triple" | "quad"
      )[],
      offersDining: true,
      availableMealPlans: ["room_only", "breakfast", "half_board"] as (
        "room_only" | "breakfast" | "half_board"
      )[],
      isFeatured: false,
      sortOrder: 5,
    },
    // Makkah 3-Star (offersDining: false)
    {
      name: "Al Kiswah Towers Hotel",
      city: "makkah" as const,
      starRating: 3,
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
        "double" | "triple" | "quad"
      )[],
      offersDining: false,
      availableMealPlans: ["room_only"] as "room_only"[],
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
        "double" | "triple" | "quad"
      )[],
      offersDining: false,
      availableMealPlans: ["room_only"] as "room_only"[],
      isFeatured: false,
      sortOrder: 7,
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
        "Luxury Chauffeur",
      ],
      allowsSharedRooms: true,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"] as (
        "double" | "triple" | "quad"
      )[],
      offersDining: true,
      availableMealPlans: [
        "room_only",
        "breakfast",
        "half_board",
        "full_board",
      ] as ("room_only" | "breakfast" | "half_board" | "full_board")[],
      isFeatured: true,
      sortOrder: 8,
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
        "Al Marwa Dining Hall",
        "Courtyard Views",
      ],
      allowsSharedRooms: true,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"] as (
        "double" | "triple" | "quad"
      )[],
      offersDining: true,
      availableMealPlans: ["room_only", "breakfast", "half_board"] as (
        "room_only" | "breakfast" | "half_board"
      )[],
      isFeatured: true,
      sortOrder: 9,
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
        "double" | "triple" | "quad"
      )[],
      offersDining: true,
      availableMealPlans: ["room_only", "breakfast", "half_board"] as (
        "room_only" | "breakfast" | "half_board"
      )[],
      isFeatured: true,
      sortOrder: 10,
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
        "double" | "triple" | "quad"
      )[],
      offersDining: true,
      availableMealPlans: ["room_only", "breakfast", "half_board"] as (
        "room_only" | "breakfast" | "half_board"
      )[],
      isFeatured: false,
      sortOrder: 11,
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
        "double" | "triple" | "quad"
      )[],
      offersDining: true,
      availableMealPlans: ["room_only", "breakfast", "half_board"] as (
        "room_only" | "breakfast" | "half_board"
      )[],
      isFeatured: false,
      sortOrder: 12,
    },
    // Madinah 3-Star (offersDining: false)
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
        "double" | "triple" | "quad"
      )[],
      offersDining: false,
      availableMealPlans: ["room_only"] as "room_only"[],
      isFeatured: false,
      sortOrder: 13,
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
          offersDining: h.offersDining,
        })
        .where(eq(schema.hotels.id, existing.id))
    }
  }
  console.log("   ✅ 13 named hotels seeded across 3★, 4★, 5★ tiers.")

  // ==========================================
  // 7. VEHICLES (8 ROAD MODELS + HARAMAIN TRAIN)
  // ==========================================
  console.log("🚐 Seeding vehicles fleet...")
  const vehiclesData = [
    // Private Sedans
    {
      name: "Ford Taurus",
      category: "sedan" as const,
      bookingMode: "private_only" as const,
      seatCapacity: 3,
      luggageCapacity: 2,
      allowsCustomPickupTime: true,
      imageUrl:
        "https://images.unsplash.com/photo-1550355291-bbee04a92027?w=800",
      description:
        "Comfortable executive sedan for solo pilgrims and couples. Includes chilled mineral water.",
      sortOrder: 1,
    },
    {
      name: "Hyundai Sonata",
      category: "sedan" as const,
      bookingMode: "private_only" as const,
      seatCapacity: 3,
      luggageCapacity: 2,
      allowsCustomPickupTime: true,
      imageUrl:
        "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800",
      description:
        "Modern private sedan with air conditioning, optimal for airport transfers and intimate travel.",
      sortOrder: 2,
    },
    // Private SUV
    {
      name: "GMC Yukon",
      category: "suv" as const,
      bookingMode: "private_only" as const,
      seatCapacity: 5,
      luggageCapacity: 4,
      allowsCustomPickupTime: true,
      imageUrl:
        "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800",
      description:
        "Luxury VIP large-body SUV with leather seating and exceptional comfort on highways.",
      sortOrder: 3,
    },
    // Private Vans
    {
      name: "Hyundai Staria",
      category: "van" as const,
      bookingMode: "private_only" as const,
      seatCapacity: 7,
      luggageCapacity: 6,
      allowsCustomPickupTime: true,
      imageUrl:
        "https://images.unsplash.com/photo-1559297434-fae8a1916a79?w=800",
      description:
        "Futuristic VIP 7-seater family van with captain chairs, climate control, and ample luggage space.",
      sortOrder: 4,
    },
    {
      name: "Hyundai Starex",
      category: "van" as const,
      bookingMode: "private_only" as const,
      seatCapacity: 7,
      luggageCapacity: 5,
      allowsCustomPickupTime: true,
      imageUrl:
        "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=800",
      description:
        "Reliable medium-size family van designed for intercity transfers between holy cities.",
      sortOrder: 5,
    },
    // Shared and Private Minibuses & Coaches
    {
      name: "Toyota HiAce",
      category: "minibus" as const,
      bookingMode: "shared_and_private" as const,
      seatCapacity: 11,
      luggageCapacity: 10,
      allowsCustomPickupTime: true,
      imageUrl:
        "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=800",
      description:
        "Spacious 11-seater minibus popular for extended family groups and custom travel parties.",
      sortOrder: 6,
    },
    {
      name: "Coaster (Toyota Coaster Minibus)",
      category: "minibus" as const,
      bookingMode: "shared_and_private" as const,
      seatCapacity: 21,
      luggageCapacity: 20,
      allowsCustomPickupTime: true,
      imageUrl:
        "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800",
      description:
        "21-seater mid-size coach ideal for medium groups, ziyarat tours, and group arrivals.",
      sortOrder: 7,
    },
    {
      name: "Bus Service (Full-size Coach Bus)",
      category: "bus" as const,
      bookingMode: "shared_and_private" as const,
      seatCapacity: 49,
      luggageCapacity: 50,
      allowsCustomPickupTime: false,
      imageUrl:
        "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800",
      description:
        "49-passenger luxury touring coach with undercarriage cargo, PA system, and air conditioning.",
      sortOrder: 8,
    },
    // Train (shared only)
    {
      name: "Haramain High-Speed Train",
      category: "train" as const,
      bookingMode: "shared_only" as const,
      seatCapacity: 1,
      luggageCapacity: 1,
      allowsCustomPickupTime: false,
      imageUrl:
        "https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=800",
      description:
        "300 km/h high-speed rail transit connecting Makkah, Jeddah Airport, and Madinah in comfort.",
      sortOrder: 9,
    },
  ]

  for (const v of vehiclesData) {
    const existing = await db.query.vehicles.findFirst({
      where: eq(schema.vehicles.name, v.name),
    })
    if (!existing) {
      await db.insert(schema.vehicles).values(v)
    }
  }
  console.log(
    "   ✅ 8 locked road vehicles + Haramain High-Speed Train seeded."
  )

  // ==========================================
  // 8. TRANSPORT SECTORS (7 LOCKED SECTORS)
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
      approxDistanceKm: 440,
      approxDurationMinutes: 270,
      sortOrder: 3,
    },
    {
      code: "MED_AIR",
      label: "Madinah Hotel to Madinah Airport (MED)",
      originCity: "Madinah",
      destinationCity: "Madinah",
      originType: "hotel" as const,
      destinationType: "airport" as const,
      supportsTrain: false,
      approxDistanceKm: 25,
      approxDurationMinutes: 30,
      sortOrder: 4,
    },
    {
      code: "AIR_MED",
      label: "Madinah Airport (MED) to Madinah Hotel",
      originCity: "Madinah",
      destinationCity: "Madinah",
      originType: "airport" as const,
      destinationType: "hotel" as const,
      supportsTrain: false,
      approxDistanceKm: 25,
      approxDurationMinutes: 30,
      sortOrder: 5,
    },
    {
      code: "MAK_JED",
      label: "Makkah Hotel to Jeddah Airport (JED)",
      originCity: "Makkah",
      destinationCity: "Jeddah",
      originType: "hotel" as const,
      destinationType: "airport" as const,
      supportsTrain: true,
      approxDistanceKm: 95,
      approxDurationMinutes: 75,
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
      approxDistanceKm: 410,
      approxDurationMinutes: 260,
      sortOrder: 7,
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
        },
      })
  }
  console.log("   ✅ 7 locked transport sectors seeded.")

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
        mealPlan: "breakfast",
        quadPricePkr: 485000,
        triplePricePkr: 545000,
        doublePricePkr: 635000,
        highlights: [
          "Direct Haram Courtyard Clock Tower Accommodations",
          "Unobstructed Green Dome Oberoi Suite Stays",
          "Haramain High-Speed Train Business Class Tickets",
          "Private GMC Yukon Ziyarat Chauffeur",
          "Daily Five-Star International Buffet Breakfast",
        ],
        bannerUrl:
          "https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?w=1200",
        isFeatured: true,
        sortOrder: 1,
      })
      .returning()
    pkg1 = created
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
        mealPlan: "breakfast",
        quadPricePkr: 385000,
        triplePricePkr: 425000,
        doublePricePkr: 485000,
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
        mealPlan: "breakfast",
        quadPricePkr: 310000,
        triplePricePkr: 345000,
        doublePricePkr: 395000,
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
        mealPlan: "room_only",
        quadPricePkr: 235000,
        triplePricePkr: 260000,
        doublePricePkr: 295000,
        highlights: [
          "21 Days Extended Spiritual Immersion",
          "24-Hour Shuttle Service Direct to Haram",
          "Ideal for Retired Pilgrims & Budget Long Stays",
          "Comprehensive Saudi Visa & Health Insurance",
        ],
        bannerUrl:
          "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200",
        isFeatured: false,
        sortOrder: 4,
      })
      .returning()
    pkg4 = created
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
    where: eq(schema.vehicles.name, "GMC Yukon"),
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
        children: 1,
        infants: 1,
        totalPassportCount: 4,
        bedAndSeatCount: 3, // 2 adults + 1 child
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
          mealPlan: "breakfast",
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
          mealPlan: "breakfast",
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
        children: 0,
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
        "Package includes 4x Saudia direct return tickets, 5 nights Swissôtel Makkah + 5 nights Madinah Hilton with daily breakfast, private HiAce transport, and complete visa processing.",
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
        children: 0,
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
      primaryCtaUrl: "/custom-journey",
      secondaryCtaLabel: "Explore Group Packages",
      secondaryCtaUrl: "/packages",
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
      primaryCtaUrl: "/custom-journey#step-hotels",
      secondaryCtaLabel: "Browse Packages",
      secondaryCtaUrl: "/packages",
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
      primaryCtaUrl: "/hajj-inquiry",
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
        "Infants under 2 years of age require a valid passport, Saudi visa, and infant airline ticket. However, they occupy zero hotel beds and zero vehicle seats. When booking private rooms or vehicles, our capacity calculations count adults and children only, saving you unnecessary room charges.",
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
