import type { FaqJsonLdItem } from "@/lib/seo/json-ld"
import type { PublicHajjPackageDto } from "@/lib/seo/public-queries"

export const HAJJ_2027_METADATA_SPEC = {
  path: "/hajj-2027",
  title: "Hajj 2027 Packages Pakistan & Maktab | Al Ramlah Travels",
  description:
    "Pre-register indicative interest for Hajj 2027 from Pakistan & diaspora: compare Maktab A+, A, B & C tiers, Aziziya vs shifting stays & MoRA readiness.",
  h1: "Hajj 2027 Pre-Registration & Maktab Tier Guide from Pakistan",
} as const

export const HAJJ_2027_REGULATORY_DISCLAIMER =
  "Indicative 2027 Pre-Registration Notice: All Hajj 2027 (1448 AH) Maktab structures, camp descriptions, hotel pairings, and PKR figures published on this page are non-binding indicative estimates based on recent Maktab benchmarks. Final quota allocation, visa issuance, Mina camp coordinates, and confirmed PKR tariffs remain strictly subject to official Saudi Ministry of Hajj & Umrah (Nusuk) and Government of Pakistan Ministry of Religious Affairs (MoRA) 2027 announcements. Zero online deposit or binding seat checkout is collected during pre-registration."

const STATIC_REFERENCE_DATE = new Date("2026-11-15T00:00:00.000Z")

export const FALLBACK_INDICATIVE_HAJJ_PACKAGES: PublicHajjPackageDto[] = [
  {
    id: "hajj-fallback-a-plus",
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
      "Non-shifting courtyard stay with private VIP Maktab A+ Mina gypsum suite near Jamarat & Mashair train pass.",
    indicativeSharingPkr: 3450000,
    indicativeQuadPkr: 3650000,
    indicativeTriplePkr: 3950000,
    indicativeDoublePkr: 4450000,
    isIndicative: true,
    regulatoryDisclaimer: HAJJ_2027_REGULATORY_DISCLAIMER,
    highlights: [
      "Maktab A+ Gypsum Air-Conditioned Suites Near Jamarat",
      "Non-Shifting 5-Star Haramain Courtyard Hotels",
      "Haramain High-Speed Rail & Mashair Metro Access",
      "Dedicated Resident Scholar & Medical Support",
    ],
    isFeatured: true,
    sortOrder: 1,
    updatedAt: STATIC_REFERENCE_DATE,
  },
  {
    id: "hajj-fallback-a",
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
    regulatoryDisclaimer: HAJJ_2027_REGULATORY_DISCLAIMER,
    highlights: [
      "Verified Maktab A Camp Zone with Sofa-Cum-Beds",
      "5-Star Makkah & Madinah Markaziyah Stays",
      "3 Buffet Pakistani & Continental Meals Daily",
      "Pre-Departure Manasik Workshop in Lahore HQ",
    ],
    isFeatured: true,
    sortOrder: 2,
    updatedAt: STATIC_REFERENCE_DATE,
  },
  {
    id: "hajj-fallback-b",
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
    regulatoryDisclaimer: HAJJ_2027_REGULATORY_DISCLAIMER,
    highlights: [
      "Official Maktab B Camp Allocation & Mashair Transport",
      "Extended Spiritual Stay in Makkah & Madinah",
      "Scholar-Guided Group Manasik & Ziyarat",
      "Overseas Diaspora & Pakistan Passport Support",
    ],
    isFeatured: false,
    sortOrder: 3,
    updatedAt: STATIC_REFERENCE_DATE,
  },
  {
    id: "hajj-fallback-c",
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
      "Dedicated air-conditioned Aziziyah apartment residence with full Pakistani catering and group Mashair bus transfers.",
    indicativeSharingPkr: 1490000,
    indicativeQuadPkr: 1580000,
    indicativeTriplePkr: 1690000,
    indicativeDoublePkr: 1890000,
    isIndicative: true,
    regulatoryDisclaimer: HAJJ_2027_REGULATORY_DISCLAIMER,
    highlights: [
      "Budget-Conscious Official Maktab C Camp Allocation",
      "Extended 38-Day Spiritual Residence in Haramain & Aziziyah",
      "Urdu & English Scholar Manasik Sessions Before Departure",
      "Transparent Pre-Registration Queue Without Binding Deposit",
    ],
    isFeatured: false,
    sortOrder: 4,
    updatedAt: STATIC_REFERENCE_DATE,
  },
]

export interface MaktabZoneComparisonRow {
  zone: "Maktab A+" | "Maktab A" | "Maktab B" | "Maktab C"
  minaCampStandard: string
  jamaratProximity: string
  stayArchitecture: string
  mashairTransit: string
  idealPilgrimProfile: string
}

export const MAKTAB_ZONE_COMPARISON_ROWS: readonly MaktabZoneComparisonRow[] = [
  {
    zone: "Maktab A+",
    minaCampStandard:
      "Upgraded gypsum-board air-conditioned suites, orthopedic sofa-beds, private ablution clusters, and 24-hour hot/cold refreshment stations.",
    jamaratProximity:
      "Closest VIP Mina camp zone (~250m–600m pedestrian approach to Jamarat ramps, subject to annual Kidana zoning).",
    stayArchitecture:
      "Non-Shifting 5-Star Haramain Courtyard hotels (0–50m Clock Tower / Markaziyah) maintained throughout 8–13 Dhul Hijjah.",
    mashairTransit:
      "Mashair Metro Train pass or VIP executive coach transfers between Mina, Arafat, and Muzdalifah.",
    idealPilgrimProfile:
      "Elderly parents, time-constrained executives (14–16 days), and families prioritizing minimal walking strain.",
  },
  {
    zone: "Maktab A",
    minaCampStandard:
      "Upgraded air-conditioned tents near Jamarat corridor with sofa-cum-beds, full-board Pakistani & continental buffet catering, and resident scholar.",
    jamaratProximity:
      "Inner Mina valley sector (~600m–1,100m walk or direct tunnel access toward Jamarat Bridge).",
    stayArchitecture:
      "Shifting Executive: 5-Star Makkah & Madinah Markaziyah hotels paired with a dedicated Aziziyah North building during peak Manasik days.",
    mashairTransit:
      "Mashair Metro Train or dedicated Maktab A taraddudiyah shuttle loop.",
    idealPilgrimProfile:
      "Families seeking 5-star Haramain courtyard proximity before/after Hajj with fast Jamarat access during 10–12 Dhul Hijjah.",
  },
  {
    zone: "Maktab B",
    minaCampStandard:
      "Official Maktab B fire-retardant air-conditioned tents with structured gender-segregated sleeping mats/beds and scheduled hot meals.",
    jamaratProximity:
      "Mid-valley Mina allocation (~1.2km–2.2km pedestrian walkways with shaded misting fans).",
    stayArchitecture:
      "Shifting Classic: Walkable or 24/7 shuttle Makkah & Madinah hotels combined with a furnished Aziziyah transit apartment near Mina.",
    mashairTransit:
      "Official Maktab B taraddudiyah loop buses across Mina, Arafat, and Muzdalifah.",
    idealPilgrimProfile:
      "Balanced 21–30 day pilgrims prioritizing extended Haramain worship and mid-tier PKR budgets.",
  },
  {
    zone: "Maktab C",
    minaCampStandard:
      "Standard Saudi Ministry air-conditioned camp tents (including Muaisim / outer Mina sectors) with group catering and scholar supervision.",
    jamaratProximity:
      "Outer Mina / Muaisim sector (~2.5km–3.8km shaded pedestrian tunnels or Mashair shuttle corridors).",
    stayArchitecture:
      "Aziziyah Long-Stay + Markaziyah Madinah: Extended 30–38 day spiritual stay centered in air-conditioned Aziziyah residences with Haram shuttle.",
    mashairTransit:
      "Scheduled Maktab C group coach transfers managed under Saudi Naqaba coordination.",
    idealPilgrimProfile:
      "Value-focused pilgrims and younger/physically active groups comfortable with longer walking distances.",
  },
] as const

export interface HajjPathwayRow {
  criterion: string
  pakistanGovernmentScheme: string
  pakistanPrivateHgo: string
  overseasDiasporaNusuk: string
}

export const HAJJ_PATHWAY_MATRIX_ROWS: readonly HajjPathwayRow[] = [
  {
    criterion: "Eligible Passports & Residency",
    pakistanGovernmentScheme:
      "Machine-readable Pakistani passport holders applying inside Pakistan (including Overseas Sponsorship quota when announced by MoRA).",
    pakistanPrivateHgo:
      "Pakistani passport holders & NICOP diaspora registering through MoRA-enrolled Hajj Group Organizers (HGOs / Munazzams).",
    overseasDiasporaNusuk:
      "Foreign passport holders & residents in the UK, USA, Canada, EU, and Australia booking via the Saudi Nusuk Hajj portal (GCC residents apply via Saudi Domestic/GCC permit rules).",
  },
  {
    criterion: "Quota & Seat Allocation Authority",
    pakistanGovernmentScheme:
      "Ministry of Religious Affairs (MoRA) computerized balloting (Qurrah) via designated Pakistani commercial banks.",
    pakistanPrivateHgo:
      "Enrolled HGO cluster quotas ratified annually by MoRA and Saudi Ministry of Hajj & Umrah.",
    overseasDiasporaNusuk:
      "Direct digital wallet & authorized service provider inventory on hajj.nusuk.sa.",
  },
  {
    criterion: "Maktab & Hotel Flexibility",
    pakistanGovernmentScheme:
      "Standardized Long (38–42 days) and Short (20–25 days) packages with fixed government camp zones.",
    pakistanPrivateHgo:
      "Full choice across Maktab A+, A, B, and C, Double/Triple/Quad occupancy, and Non-Shifting vs Aziziya Shifting itineraries.",
    overseasDiasporaNusuk:
      "Tiered A+, A, B, and C camp packages bundled with international flights from Western hubs.",
  },
  {
    criterion: "How Al Ramlah Travels Assists",
    pakistanGovernmentScheme:
      "Pre-ballot documentation guidance, Saudi Visa Bio support, and post-Hajj Umrah extensions.",
    pakistanPrivateHgo:
      "Priority Hajj 2027 pre-registration queue, Maktab selection advisory, Lahore Cantt Manasik workshops, and end-to-end group coordination.",
    overseasDiasporaNusuk:
      "Cross-border family synchronization — matching Makkah/Madinah hotel dates and Maktab tiers so UK/US/CA relatives meet Pakistani parents in the Haramain.",
  },
] as const

export const HAJJ_READINESS_DOCUMENTS: ReadonlyArray<{
  title: string
  detail: string
}> = [
  {
    title: "Machine-Readable Passport (>= 8–12 Months Validity)",
    detail:
      "Ensure every pilgrim's passport remains valid through at least December 2027 with two blank adjacent visa pages.",
  },
  {
    title: "NADRA CNIC / NICOP / Smart Card & B-Form",
    detail:
      "Valid NADRA computerized identity card for adults, NICOP/POC for overseas Pakistanis, and FRC (Family Registration Certificate) for family room grouping.",
  },
  {
    title: "Saudi Visa Bio Smartphone Enrollment",
    detail:
      "Facial and 10-finger biometric capture via the official Saudi Visa Bio mobile app prior to Maktab visa stamping.",
  },
  {
    title: "Mandatory Vaccination & Fitness Certificates",
    detail:
      "Quadrivalent Meningococcal (ACWY-135), Pakistan Polio (IPV/OPV), seasonal Influenza, and medical fitness clearance as mandated by Saudi Health authorities.",
  },
  {
    title: "White-Background Biometric Photographs & Blood Group",
    detail:
      "Recent matte studio photographs (matte 4×3cm, 80% face coverage, non-white attire against pure white backdrop) and verified ABO/Rh blood group slip.",
  },
  {
    title: "Next-of-Kin (Nominee) & Emergency Contact Details",
    detail:
      "CNIC and active Pakistani mobile number of an immediate family nominee required on official Hajj enrollment dossiers.",
  },
] as const

export const HAJJ_2027_FAQS: readonly FaqJsonLdItem[] = [
  {
    question:
      "Is Hajj 2027 pre-registration with Al Ramlah Travels a confirmed seat or binding deposit?",
    answer:
      "No. Pre-registration on this page is strictly a non-binding indicative interest record ahead of official 1448 AH / 2027 Saudi Ministry of Hajj & Umrah and Pakistan MoRA quota announcements. No online payment or binding seat fee is collected until official Maktab quotas and regulated tariffs are formally published.",
  },
  {
    question:
      "What is the practical difference between Maktab A+, Maktab A, Maktab B, and Maktab C in Mina?",
    answer:
      "Maktab zones determine your Mina tent location relative to Jamarat Bridge, camp construction, and Mashair transport. Maktab A+ and A sit closest to Jamarat with gypsum or upgraded sofa-bed air-conditioned tents and faster access, whereas Maktab B and C are located further along Mina/Muaisim pedestrian corridors with lower indicative PKR package budgets.",
  },
  {
    question:
      "What does Shifting (Aziziyah) versus Non-Shifting mean in a Hajj package?",
    answer:
      "In a Non-Shifting package, you retain your 5-star Haram courtyard hotel room right through the peak Hajj days (8–13 Dhul Hijjah) for daytime rest after Tawaf al-Ifadah. In a Shifting package, you stay in Markaziyah Makkah and Madinah hotels outside peak dates and relocate to a dedicated air-conditioned Aziziyah building near Mina/Jamarat during the core Manasik window, significantly reducing package cost and traffic delays.",
  },
  {
    question:
      "How do UK, USA, Canada, and EU overseas Pakistanis coordinate Hajj 2027 with parents departing from Pakistan?",
    answer:
      "Pilgrims residing in Western countries holding foreign passports generally book through Saudi Arabia's official Nusuk Hajj platform, while Pakistani passport holders apply via Pakistan's MoRA/HGO quota. Our Lahore concierge advises dual-origin families on matching Maktab zones and overlapping Makkah/Madinah hotel dates so families can reunite in the Haramain.",
  },
  {
    question:
      "Are Qurbani (Hadi) vouchers and Haramain High-Speed Train tickets included in indicative Hajj estimates?",
    answer:
      "Core Hajj package estimates cover return airfare, Maktab camp services, Makkah/Madinah/Aziziyah accommodation, and standard intercity transport. Official Saudi Adahi/Hadi sacrifice coupons and optional Haramain High-Speed Rail upgrades between Madinah and Makkah are itemized transparently on your final quotation worksheet once 2027 tariffs open.",
  },
  {
    question:
      "When should Pakistani families renew passports and complete vaccinations for Hajj 2027?",
    answer:
      "Because Hajj 1448 AH falls around May 2027, families should renew any passport expiring before January 2028 by late 2026, prepare NADRA Family Registration Certificates (FRC), and complete Meningococcal ACWY-135 and Polio vaccinations once MoRA issues the official 2027 medical circular.",
  },
] as const
