import type { FaqJsonLdItem } from "@/lib/seo/json-ld"
import type { PublicHotelDto } from "@/lib/seo/public-queries"

export type HotelSpokeCity = "makkah" | "madinah"

export function isValidHotelSpokeCity(
  raw: string | null | undefined
): raw is HotelSpokeCity {
  return raw === "makkah" || raw === "madinah"
}

export interface HotelCityPageConfig {
  city: HotelSpokeCity
  cityLabel: "Makkah" | "Madinah"
  arabicCity: string
  arabicMosque: string
  breadcrumbLabel: string
  path: `/hotels/${HotelSpokeCity}`
  title: string
  description: string
  h1: string
  eyebrowBadge: string
  answerFirstSummary: string
  primaryBuilderHref: string
  primaryBuilderLabel: string
  siblingHref: `/hotels/${HotelSpokeCity}`
  siblingLabel: string
  ziyaratSpokeHref: `/ziyarat/${HotelSpokeCity}`
  ziyaratSpokeLabel: string
  tableSectionEyebrow: string
  tableSectionHeading: string
  tableSectionIntro: string
  zoneSectionEyebrow: string
  zoneSectionHeading: string
  zoneSectionIntro: string
  zones: ReadonlyArray<{
    zoneName: string
    distanceBand: string
    haramGateFocus: string
    elderlyAccessibility: string
    pilgrimRecommendation: string
  }>
  operationalCallouts: ReadonlyArray<{
    badge: string
    heading: string
    body: string
  }>
  faqs: ReadonlyArray<FaqJsonLdItem>
  faqHeading: string
}

const STATIC_REFERENCE_DATE = new Date("2026-11-15T00:00:00.000Z")

export const FALLBACK_PUBLIC_HOTELS_BY_CITY: Record<
  HotelSpokeCity,
  PublicHotelDto[]
> = {
  makkah: [
    {
      id: "fallback-makkah-fairmont",
      name: "Fairmont Makkah Clock Royal Tower",
      city: "makkah",
      starRating: 5,
      distanceMeters: 0,
      distanceLabel: "0m — Direct Abraj Al Bait Courtyard",
      accessType: "walking",
      imageUrl: null,
      galleryUrls: [],
      amenities: [
        "Haram View Options",
        "High-Speed Elevators",
        "Executive Dining",
      ],
      allowsSharedRooms: false,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"],
      offersDining: true,
      availableMealPlans: [
        "room_only",
        "breakfast",
        "half_board",
        "full_board",
      ],
      mealsAvailable: true,
      validFrom: null,
      validUntil: null,
      locationNotes:
        "Zero-step elevator descent into King Abdulaziz & Ajyad Gate plaza.",
      isFeatured: true,
      sortOrder: 1,
      updatedAt: STATIC_REFERENCE_DATE,
    },
    {
      id: "fallback-makkah-swissotel",
      name: "Swissôtel Al Maqam Makkah",
      city: "makkah",
      starRating: 5,
      distanceMeters: 50,
      distanceLabel: "50m — Direct Clock Tower Tunnel",
      accessType: "walking",
      imageUrl: null,
      galleryUrls: [],
      amenities: [
        "Direct Mall Tunnel",
        "Family Quad Suites",
        "Buffet Restaurant",
      ],
      allowsSharedRooms: false,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"],
      offersDining: true,
      availableMealPlans: [
        "room_only",
        "breakfast",
        "half_board",
        "full_board",
      ],
      mealsAvailable: true,
      validFrom: null,
      validUntil: null,
      locationNotes:
        "Dedicated private escalator access into Abraj Al Bait concourse.",
      isFeatured: true,
      sortOrder: 2,
      updatedAt: STATIC_REFERENCE_DATE,
    },
    {
      id: "fallback-makkah-hyatt",
      name: "Jabal Omar Hyatt Regency Makkah",
      city: "makkah",
      starRating: 5,
      distanceMeters: 100,
      distanceLabel: "100m — Steps from King Fahad Gate",
      accessType: "walking",
      imageUrl: null,
      galleryUrls: [],
      amenities: [
        "Jabal Omar Plaza",
        "Connected Prayer Hall",
        "Concierge Desk",
      ],
      allowsSharedRooms: false,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"],
      offersDining: true,
      availableMealPlans: [
        "room_only",
        "breakfast",
        "half_board",
        "full_board",
      ],
      mealsAvailable: true,
      validFrom: null,
      validUntil: null,
      locationNotes:
        "Flat marble walkway facing King Fahad Gate 79 on the western piazza.",
      isFeatured: true,
      sortOrder: 3,
      updatedAt: STATIC_REFERENCE_DATE,
    },
    {
      id: "fallback-makkah-voco",
      name: "Voco Makkah an IHG Hotel",
      city: "makkah",
      starRating: 4,
      distanceMeters: 1200,
      distanceLabel: "1,200m — 24/7 Kudai Haram Shuttle",
      accessType: "shuttle",
      imageUrl: null,
      galleryUrls: [],
      amenities: [
        "24/7 Dedicated Shuttle",
        "Modern IHG Rooms",
        "South Asian Dining",
      ],
      allowsSharedRooms: true,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"],
      offersDining: true,
      availableMealPlans: [
        "room_only",
        "breakfast",
        "half_board",
        "full_board",
      ],
      mealsAvailable: true,
      validFrom: null,
      validUntil: null,
      locationNotes:
        "Continuous air-conditioned coach loop along Ibrahim Al Khalil / Kudai.",
      isFeatured: false,
      sortOrder: 4,
      updatedAt: STATIC_REFERENCE_DATE,
    },
    {
      id: "fallback-makkah-emaar-grand",
      name: "Emaar Grand Hotel Makkah",
      city: "makkah",
      starRating: 3,
      distanceMeters: 750,
      distanceLabel: "750m — Ibrahim Al Khalil Walking",
      accessType: "walking",
      imageUrl: null,
      galleryUrls: [],
      amenities: ["Flat Street Walk", "Quad Family Rooms", "24h Reception"],
      allowsSharedRooms: true,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"],
      offersDining: false,
      availableMealPlans: ["room_only"],
      mealsAvailable: false,
      validFrom: null,
      validUntil: null,
      locationNotes:
        "Straight level approach along Ibrahim Al Khalil Road surrounded by Pakistani restaurants.",
      isFeatured: false,
      sortOrder: 5,
      updatedAt: STATIC_REFERENCE_DATE,
    },
  ],
  madinah: [
    {
      id: "fallback-madinah-dar-al-taqwa",
      name: "Dar Al Taqwa Hotel Madinah",
      city: "madinah",
      starRating: 5,
      distanceMeters: 30,
      distanceLabel: "30m — Directly Opposite Ladies Gate 25",
      accessType: "walking",
      imageUrl: null,
      galleryUrls: [],
      amenities: [
        "Opposite Ladies Gate 25",
        "Tea Garden Lounge",
        "Haram View Suites",
      ],
      allowsSharedRooms: false,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"],
      offersDining: true,
      availableMealPlans: [
        "room_only",
        "breakfast",
        "half_board",
        "full_board",
      ],
      mealsAvailable: true,
      validFrom: null,
      validUntil: null,
      locationNotes:
        "Premier Northern Markaziyah address immediately facing King Fahd & Ladies Gate 25.",
      isFeatured: true,
      sortOrder: 1,
      updatedAt: STATIC_REFERENCE_DATE,
    },
    {
      id: "fallback-madinah-oberoi",
      name: "The Oberoi Madina",
      city: "madinah",
      starRating: 5,
      distanceMeters: 50,
      distanceLabel: "50m — Northern Courtyard Green Dome View",
      accessType: "walking",
      imageUrl: null,
      galleryUrls: [],
      amenities: ["Butler Concierge", "Ladies Gate Proximity", "Fine Dining"],
      allowsSharedRooms: false,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"],
      offersDining: true,
      availableMealPlans: [
        "room_only",
        "breakfast",
        "half_board",
        "full_board",
      ],
      mealsAvailable: true,
      validFrom: null,
      validUntil: null,
      locationNotes:
        "Front-row Northern Markaziyah sanctuary overlooking the Prophet's Mosque canopy.",
      isFeatured: true,
      sortOrder: 2,
      updatedAt: STATIC_REFERENCE_DATE,
    },
    {
      id: "fallback-madinah-hilton",
      name: "Madinah Hilton Hotel",
      city: "madinah",
      starRating: 5,
      distanceMeters: 100,
      distanceLabel: "100m — King Fahd Gate Pedestrian Avenue",
      accessType: "walking",
      imageUrl: null,
      galleryUrls: [],
      amenities: [
        "Pedestrian Shopping Spine",
        "Family Quad Rooms",
        "International Buffet",
      ],
      allowsSharedRooms: false,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"],
      offersDining: true,
      availableMealPlans: [
        "room_only",
        "breakfast",
        "half_board",
        "full_board",
      ],
      mealsAvailable: true,
      validFrom: null,
      validUntil: null,
      locationNotes:
        "Steps from the northern entrance along Madinah's central pedestrian avenue.",
      isFeatured: true,
      sortOrder: 3,
      updatedAt: STATIC_REFERENCE_DATE,
    },
    {
      id: "fallback-madinah-crowne-plaza",
      name: "Crowne Plaza Madinah",
      city: "madinah",
      starRating: 4,
      distanceMeters: 200,
      distanceLabel: "200m — Southern Qiblah Courtyard",
      accessType: "walking",
      imageUrl: null,
      galleryUrls: [],
      amenities: ["Near Bab Al-Salam", "IHG Standards", "Complimentary Wi-Fi"],
      allowsSharedRooms: false,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"],
      offersDining: true,
      availableMealPlans: ["room_only", "breakfast", "half_board"],
      mealsAvailable: true,
      validFrom: null,
      validUntil: null,
      locationNotes:
        "Southern Markaziyah location convenient to Bab Al-Salam, Rawdah entry, and Jannat al-Baqi.",
      isFeatured: false,
      sortOrder: 4,
      updatedAt: STATIC_REFERENCE_DATE,
    },
    {
      id: "fallback-madinah-emaar-elite",
      name: "Emaar Elite Madinah Hotel",
      city: "madinah",
      starRating: 3,
      distanceMeters: 450,
      distanceLabel: "450m — Western Markaziyah Flat Walk",
      accessType: "walking",
      imageUrl: null,
      galleryUrls: [],
      amenities: [
        "100% Flat Pedestrian Walk",
        "Value Family Quads",
        "Lobby Cafe",
      ],
      allowsSharedRooms: true,
      allowsPrivateRooms: true,
      availableRoomTypes: ["double", "triple", "quad"],
      offersDining: false,
      availableMealPlans: ["room_only"],
      mealsAvailable: false,
      validFrom: null,
      validUntil: null,
      locationNotes:
        "Level paved walk into Masjid an-Nabawi outer courtyards without needing a shuttle bus.",
      isFeatured: false,
      sortOrder: 5,
      updatedAt: STATIC_REFERENCE_DATE,
    },
  ],
}

export const HOTEL_SPOKE_CONFIGS: Record<HotelSpokeCity, HotelCityPageConfig> =
  {
    makkah: {
      city: "makkah",
      cityLabel: "Makkah",
      arabicCity: "مكة المكرمة",
      arabicMosque: "المسجد الحرام",
      breadcrumbLabel: "Makkah Hotels",
      path: "/hotels/makkah",
      title: "Makkah Hotels Near Masjid al-Haram | Al Ramlah Travels",
      description:
        "Compare verified 3-star to 5-star Makkah Clock Tower, Ajyad & shuttle hotels with exact walking distances, Quad/Triple room splits, and custom Umrah plans.",
      h1: "Makkah Hotels — Clock Tower, Courtyard & Haram Shuttle Directory",
      eyebrowBadge: "Masjid al-Haram Courtyard & Shuttle Inventory",
      answerFirstSummary:
        "Makkah Umrah accommodations span four distinct zones around Masjid al-Haram: zero-step Abraj Al Bait Clock Tower suites (0–80m), Jabal Omar King Fahad Gate towers (80–150m), Ajyad and Ibrahim Al Khalil walking hotels (450–900m), and 24/7 Kudai or At-Taysir shuttle towers. All Makkah-first itineraries arrive via Jeddah (JED) with Live Rates confirmed upon submission.",
      primaryBuilderHref:
        "/?preset=complete_umrah&citySequence=makkah_madinah#journey-builder",
      primaryBuilderLabel: "Build Makkah-First Umrah Itinerary",
      siblingHref: "/hotels/madinah",
      siblingLabel: "Compare Madinah Markaziyah Hotels",
      ziyaratSpokeHref: "/ziyarat/makkah",
      ziyaratSpokeLabel: "Explore Makkah & Taif Ziyarat Sites",
      tableSectionEyebrow: "Verified Masjid al-Haram Property Roster",
      tableSectionHeading:
        "Makkah Hotel Comparison — Distance, Access Mode & Room Splits",
      tableSectionIntro:
        "Because Makkah's topography rises steeply around the Kaaba valley, choosing between zero-step Clock Tower escalators, level Ibrahim Al Khalil sidewalks, inclined Ajyad streets, or 24/7 air-conditioned shuttle terminals directly shapes Tawaf comfort for parents and children.",
      zoneSectionEyebrow: "Topography, Gates & Elevator Access",
      zoneSectionHeading:
        "Four Makkah Hotel Micro-Zones Around Masjid al-Haram",
      zoneSectionIntro:
        "Evaluate walking elevation, elevator banks during peak Jumu'ah and Maghrib prayers, and proximity to King Abdulaziz Gate, King Fahad Gate, and Ajyad Gate before selecting your Makkah tower.",
      zones: [
        {
          zoneName: "Abraj Al Bait / Clock Tower Complex",
          distanceBand: "0m – 80m",
          haramGateFocus: "King Abdulaziz Gate & Ajyad Gate Concourse",
          elderlyAccessibility:
            "Zero-step high-speed elevator and mall escalator descent directly onto the southern Haram marble piazza; top recommendation for wheelchair users.",
          pilgrimRecommendation:
            "VIP families, short 5–10 day executive trips, and senior parents performing frequent Tawaf.",
        },
        {
          zoneName: "Jabal Omar Western Piazza",
          distanceBand: "80m – 150m",
          haramGateFocus: "King Fahad Gate (Gate 79) & Umrah Gate",
          elderlyAccessibility:
            "Wide paved pedestrian promenades, integrated air-conditioned musallahs with live Haram audio, and minimal street incline.",
          pilgrimRecommendation:
            "Multi-room family groups desiring modern international 5-star suites away from Clock Tower mall crowds.",
        },
        {
          zoneName: "Ibrahim Al Khalil Rd & Lower Ajyad",
          distanceBand: "450m – 900m",
          haramGateFocus: "King Fahad Extension & Ajyad Courtyard",
          elderlyAccessibility:
            "Ibrahim Al Khalil Road offers a largely flat straight walk lined with Pakistani dining; upper Ajyad side streets involve moderate uphill return gradients.",
          pilgrimRecommendation:
            "14–21 day mid-tier family and group pilgrims balancing walkable five-prayer attendance with practical budgets.",
        },
        {
          zoneName: "Kudai, Misfalah & At-Taysir Shuttle Belt",
          distanceBand: "1,000m – 1,500m",
          haramGateFocus: "Dedicated Ajyad / Jarwal Bus Drop-Off Terminals",
          elderlyAccessibility:
            "24/7 continuous air-conditioned hotel coaches running every 10–15 minutes to designated tunnel terminals near the outer courtyards.",
          pilgrimRecommendation:
            "Long-stay 21–30 day pilgrims, Ramadan budget travelers, and large extended families.",
        },
      ],
      operationalCallouts: [
        {
          badge: "Jeddah (JED) Airport Rule",
          heading: "No Civilian Airport Inside Makkah — JED Transfer Lock",
          body: "Makkah al-Mukarramah has no commercial airport. Whenever your itinerary begins in Makkah, our planner automatically locks your entry port to King Abdulaziz International Airport in Jeddah (JED) with immediate 75-minute private ground transfer or Haramain High-Speed Train connection while dressed in Ihram.",
        },
        {
          badge: "Private Room Auto-Splitter",
          heading: "Quad (4), Triple (3) & Double (2) Bed Capacity Math",
          body: "Selecting any Makkah hotel below launches our Journey Builder with intelligent private room splitting across your Adults + Children bed count. Infants under 2 years require a Saudi visa and infant flight ticket, yet occupy 0 hotel beds.",
        },
        {
          badge: "Volatile Tariff Transparency",
          heading:
            "Why Makkah Hotels Display 'Live Rate — Confirmed Upon Submission'",
          body: "Makkah hotel allotments shift daily across Rajab, Sha'ban, Ramadan last ashra, and weekend occupancy surges. Rather than publishing stale estimates, our Lahore quoting desk locks live wholesale inventory and returns an itemized PKR proposal.",
        },
      ],
      faqHeading:
        "Frequently Asked Questions — Booking Makkah Hotels Near Haram",
      faqs: [
        {
          question:
            "Which Makkah hotel zone is flattest for elderly parents and wheelchair pilgrims?",
          answer:
            "Abraj Al Bait Clock Tower hotels (such as Fairmont, Swissôtel Al Maqam, and Mövenpick Hajar Tower) and Jabal Omar properties facing King Fahad Gate provide the easiest step-free elevator and wide plaza access. For 3-star walking budgets, Ibrahim Al Khalil Road is noticeably flatter than sloped upper Ajyad side lanes.",
        },
        {
          question:
            "Why do Makkah-first hotel bookings require landing at Jeddah (JED) Airport?",
          answer:
            "Makkah does not have a civilian airport. Pilgrims starting their stay in Makkah wear Ihram prior to crossing the airborne Miqat, land at Jeddah (JED), and transfer roughly 75 minutes by private sedan/SUV or Haramain High-Speed Rail directly to their Makkah hotel lobby before performing Umrah.",
        },
        {
          question:
            "How do 24/7 Haram shuttle hotels in Kudai and At-Taysir operate during prayer rushes?",
          answer:
            "Verified 4-star and value shuttle properties (such as Voco Makkah in Kudai or Al Kiswah Towers via the At-Taysir tunnel) run dedicated hotel-branded air-conditioned buses round the clock. During Ramadan and Jumu'ah, traffic cordons pause vehicles at official terminal drop-offs a short walk from the outer marble piazza.",
        },
        {
          question:
            "Can a family of 5 or 6 book connecting rooms or mixed Quad + Double rooms in Makkah?",
          answer:
            "Yes. Our Custom Journey Builder counts Adults + Children (infants under 2 years take 0 beds) and automatically proposes optimal Double, Triple, and Quad combinations—for example, one Triple plus one Double for 5 bed-occupying family members.",
        },
        {
          question:
            "Are Suhoor, Iftar, or full-board Pakistani meals available in Makkah hotels?",
          answer:
            "Five-star Clock Tower and Jabal Omar towers offer international breakfast, half-board, and Ramadan Suhoor/Iftar buffets, while properties along Ibrahim Al Khalil Road and Ajyad sit steps from authentic Pakistani restaurants.",
        },
        {
          question:
            "Why are Makkah nightly rates confirmed upon submission instead of instant checkout?",
          answer:
            "Haramain hotel tariffs fluctuate dynamically by Hijri date, Haram/Kaaba view category, and weekend demand. Submitting your exact dates allows our Askari 10 Lahore desk to secure live contracted room allotments in PKR with zero hidden markups.",
        },
      ],
    },
    madinah: {
      city: "madinah",
      cityLabel: "Madinah",
      arabicCity: "المدينة المنورة",
      arabicMosque: "المسجد النبوي",
      breadcrumbLabel: "Madinah Markaziyah Hotels",
      path: "/hotels/madinah",
      title: "Madinah Markaziyah Hotels Near Haram | Al Ramlah Travels",
      description:
        "Browse Northern & Southern Markaziyah Madinah hotels steps from Masjid an-Nabawi & Ladies Gate 25 with family room configurations and custom Umrah quotes.",
      h1: "Madinah Markaziyah Hotels Near Masjid an-Nabawi & Ladies Gate 25",
      eyebrowBadge: "Central Markaziyah & Ladies Gate 25 Directory",
      answerFirstSummary:
        "Madinah's Central Haram Area (Al-Markaziyah) surrounds Masjid an-Nabawi with flat, step-free marble pedestrian avenues where 3-star to 5-star hotels sit 30m to 450m from the mosque gates—requiring zero shuttle buses. Choose Northern Markaziyah directly opposite Ladies Gate 25 and Gate 329 for mothers and sisters, with Live Rates confirmed upon submission.",
      primaryBuilderHref:
        "/?preset=complete_umrah&citySequence=madinah_makkah#journey-builder",
      primaryBuilderLabel: "Build Madinah-First Umrah Itinerary",
      siblingHref: "/hotels/makkah",
      siblingLabel: "Compare Makkah Clock Tower & Shuttle Hotels",
      ziyaratSpokeHref: "/ziyarat/madinah",
      ziyaratSpokeLabel: "Explore Madinah & Badr Ziyarat Sites",
      tableSectionEyebrow: "Verified Masjid an-Nabawi Markaziyah Roster",
      tableSectionHeading:
        "Madinah Hotel Comparison — Ladies Gate Proximity, Courtyards & Dining",
      tableSectionIntro:
        "Unlike Makkah's hilly streets, Madinah's Markaziyah ring is completely level. The single most important decision for Pakistani and diaspora families in Madinah is choosing the right courtyard orientation—especially Northern Markaziyah near Ladies Gate 25 and Gate 329 so women avoid long perimeter walks.",
      zoneSectionEyebrow: "Markaziyah Compass & Gate Orientation",
      zoneSectionHeading:
        "Northern Ladies Gate vs Southern Qiblah Courtyards in Madinah",
      zoneSectionIntro:
        "Masjid an-Nabawi's men's, ladies', and Rawdah entrances sit on specific sides of the rectangular piazza. Match your family composition to the ideal Markaziyah quadrant below.",
      zones: [
        {
          zoneName: "Northern Markaziyah (Markaziyah Shamaliyah)",
          distanceBand: "30m – 150m",
          haramGateFocus:
            "Ladies Gate 25, Gate 29, Gate 329 & King Fahd Gate 21",
          elderlyAccessibility:
            "Immediate flat crossing into the primary women's prayer sections and shaded umbrella courtyard; eliminates 600m+ perimeter detours for elderly mothers.",
          pilgrimRecommendation:
            "Top choice for families traveling with mothers, wives, daughters, and sisters.",
        },
        {
          zoneName: "Central King Fahd Pedestrian Boulevard",
          distanceBand: "80m – 180m",
          haramGateFocus: "King Fahd Central Entrance & Northern Canopy",
          elderlyAccessibility:
            "Vibrant vehicle-free tiled avenue lined with pharmacies, wheelchair rentals, cafes, and date boutiques leading straight to the northern gates.",
          pilgrimRecommendation:
            "Couples and multi-generational households wanting doorstep dining and shopping convenience.",
        },
        {
          zoneName: "Southern Qiblah Courtyard (Markaziyah Janubiyah)",
          distanceBand: "150m – 250m",
          haramGateFocus:
            "Bab Al-Salam (Gate 1), Rawdah Entry & Jannat al-Baqi",
          elderlyAccessibility:
            "Level plaza closest to the historic Green Dome, men's Salam corridor, Rawdah permit assembly points, and Jannat al-Baqi cemetery.",
          pilgrimRecommendation:
            "Male pilgrims prioritizing Bab Al-Salam greetings and scheduled Nusuk Rawdah slots.",
        },
        {
          zoneName: "Western Markaziyah & Masjid Bilal Sector",
          distanceBand: "250m – 450m",
          haramGateFocus: "Bab Al-Hijrah, Bab Al-Rahmah & Western Piazza",
          elderlyAccessibility:
            "100% flat paved sidewalks into the western shaded umbrellas—genuine walking access without waiting for shuttle buses.",
          pilgrimRecommendation:
            "Value-conscious 3-star and economy stays with thriving Pakistani markets and Bilal Souq nearby.",
        },
      ],
      operationalCallouts: [
        {
          badge: "Direct MED Airport Arrival",
          heading: "Land at Madinah Airport (MED) Without Wearing Ihram",
          body: "Madinah-first itineraries land directly at Prince Mohammad bin Abdulaziz International Airport (MED), just 25–30 minutes from Markaziyah hotels. Pilgrims travel comfortably in regular clothes, rest in Madinah first, and later assume Ihram at Miqat Dhul Hulayfah (Abyar Ali) when departing for Makkah.",
        },
        {
          badge: "Nusuk Rawdah Permits",
          heading: "Riyad ul-Jannah (Rawdah ash-Sharifah) Slot Synchronization",
          body: "Entry to the blessed Rawdah requires an active appointment QR on the official Saudi Nusuk app, with separate timed windows for men and women. Our concierge aligns your Madinah hotel check-in dates so every pilgrim secures a verified Rawdah slot.",
        },
        {
          badge: "Live Markaziyah Contracting",
          heading: "Transparent Family Occupancy & 'Live Rate' Verification",
          body: "Northern Markaziyah rooms facing Ladies Gate 25 sell out rapidly around Thursday–Friday nights and school holidays. Submit your exact dates to receive a verified PKR quotation tailored to your Adults + Children bed count (infants < 2 years = 0 beds).",
        },
      ],
      faqHeading:
        "Frequently Asked Questions — Madinah Markaziyah & Ladies Gate Hotels",
      faqs: [
        {
          question:
            "Why do Pakistani families specifically request Madinah hotels near Ladies Gate 25 and Gate 329?",
          answer:
            "In Masjid an-Nabawi, dedicated women's prayer halls sit predominantly along the northern and eastern sections (centered around Gates 25, 29, and 329). Booking a Southern Courtyard hotel can force mothers and elderly sisters to walk 600 to 900 meters around the outer fence five times daily, whereas Northern Markaziyah properties like Dar Al Taqwa and The Oberoi sit 30–50 meters opposite women's entrances.",
        },
        {
          question:
            "Do budget 2-star and 3-star hotels in Madinah require shuttle buses like Makkah?",
          answer:
            "Rarely. Because Al-Markaziyah surrounds all four sides of Masjid an-Nabawi on flat ground, even our 2-star and 3-star value properties in the Western Markaziyah and Masjid Bilal sector sit within a level 250m to 450m walk of the outer umbrella courtyards.",
        },
        {
          question:
            "How do we obtain Nusuk permits for Riyad ul-Jannah (Rawdah) during our Madinah stay?",
          answer:
            "Once your Saudi Umrah visa is issued, our operations team guides each family member in registering on the official Nusuk smartphone app to book separate men's and women's Rawdah prayer appointments falling squarely within your confirmed Madinah hotel nights.",
        },
        {
          question:
            "Is it easier for seniors and children to fly into Madinah (MED) first instead of Jeddah?",
          answer:
            "Yes. Flying from Lahore (LHE), Karachi (KHI), or Islamabad (ISB) directly into Madinah (MED) lets families clear immigration calmly in normal clothing, reach their Markaziyah hotel in 25 minutes, recover from travel fatigue, and enter Ihram fresh at Bir Ali before traveling to Makkah.",
        },
        {
          question:
            "How are Triple and Quad rooms configured in Markaziyah Madinah hotels?",
          answer:
            "Standard Markaziyah rooms accommodate Double, Triple, or Quad occupancy using full twin beds or manufacturer rollaway beds depending on tower floorplans. Our planner counts Adults + Children for bed allocation while keeping infants under 2 years at zero bed cost.",
        },
        {
          question:
            "Why are Madinah hotel tariffs shown as 'Live Rate — Confirmed upon submission'?",
          answer:
            "Markaziyah room rates shift sharply between midweek nights, Thursday–Friday Jumu'ah weekends, and Rabi' al-Awwal or Ramadan peaks. Our Lahore desk verifies live contracted availability for your exact dates before issuing a binding PKR quote.",
        },
      ],
    },
  }

export function formatMealPlansSummary(
  mealPlans: ReadonlyArray<string>
): string {
  if (!mealPlans || mealPlans.length === 0) {
    return "Room Only"
  }
  const labels: Record<string, string> = {
    room_only: "Room Only",
    breakfast: "Breakfast",
    half_board: "Half Board",
    full_board: "Full Board",
  }
  return mealPlans.map((plan) => labels[plan] ?? plan).join(", ")
}

export function formatRoomTypesSummary(
  roomTypes: ReadonlyArray<string>,
  allowsShared: boolean
): string {
  const formatted = roomTypes.map(
    (rt) => rt.charAt(0).toUpperCase() + rt.slice(1)
  )
  if (allowsShared) {
    formatted.unshift("Sharing")
  }
  return formatted.length > 0 ? formatted.join(" / ") : "Double / Triple / Quad"
}
