import { CANONICAL_ORIGIN } from "@/lib/seo/metadata"
import { ORGANIZATION_JSONLD_ID, type FaqJsonLdItem } from "@/lib/seo/json-ld"
import type {
  PublicVehicleDto,
  PublicZiyaratDto,
} from "@/lib/seo/public-queries"

export type ZiyaratSpokeCity = "makkah" | "madinah"

export function isValidZiyaratSpokeCity(
  raw: string | null | undefined
): raw is ZiyaratSpokeCity {
  return raw === "makkah" || raw === "madinah"
}

export const ZIYARAT_HUB_METADATA_SPEC = {
  path: "/ziyarat",
  title: "Makkah & Madinah Ziyarat Guide & Tours | Al Ramlah Travels",
  description:
    "Discover sacred Makkah, Madinah, Badr & Taif Ziyarat landmarks with historical context, private Sedan/GMC/Coaster fleet capacities, and guided itineraries.",
  h1: "Complete Haramain Ziyarat Guide — Makkah, Madinah, Badr & Taif",
} as const

const STATIC_REFERENCE_DATE = new Date("2026-11-15T00:00:00.000Z")

export const FALLBACK_PUBLIC_ZIYARAT_PLACES: PublicZiyaratDto[] = [
  {
    id: "fallback-ziyarat-hira",
    city: "makkah",
    name: "Jabal al-Nour & Cave of Hira",
    arabicName: "جبل النور وغار حراء",
    description:
      "The Mountain of Light northeast of Masjid al-Haram where the first Quranic revelation of Surah Al-Alaq descended upon Prophet Muhammad (PBUH).",
    imageUrl: null,
    sortOrder: 1,
    updatedAt: STATIC_REFERENCE_DATE,
  },
  {
    id: "fallback-ziyarat-thawr",
    city: "makkah",
    name: "Jabal Thawr & Cave of Thawr",
    arabicName: "جبل ثور وغار ثور",
    description:
      "The rugged southern mountain sanctuary where the Prophet (PBUH) and Abu Bakr As-Siddiq (RA) sheltered for three nights during the Hijrah.",
    imageUrl: null,
    sortOrder: 2,
    updatedAt: STATIC_REFERENCE_DATE,
  },
  {
    id: "fallback-ziyarat-mashair",
    city: "makkah",
    name: "Sacred Sites of Hajj: Mina, Muzdalifah & Arafat",
    arabicName: "المشاعر المقدسة: منى ومزدلفة وعرفات",
    description:
      "Panoramic scholar-led circuit through the Mashair plains viewing Mina, Muzdalifah, Masjid Namirah, and Jabal al-Rahmah at Arafat.",
    imageUrl: null,
    sortOrder: 3,
    updatedAt: STATIC_REFERENCE_DATE,
  },
  {
    id: "fallback-ziyarat-mualla",
    city: "makkah",
    name: "Jannat al-Mu'alla Cemetery",
    arabicName: "مقبرة المعلاة",
    description:
      "Historic burial ground north of Masjid al-Haram holding the resting place of Umm al-Mu'minin Sayyidah Khadijah al-Kubra (RA).",
    imageUrl: null,
    sortOrder: 4,
    updatedAt: STATIC_REFERENCE_DATE,
  },
  {
    id: "fallback-ziyarat-jinn",
    city: "makkah",
    name: "Masjid al-Jinn & Masjid ash-Shajarah",
    arabicName: "مسجد الجن ومسجد الشجرة",
    description:
      "Historic mosques along the northern Haram corridor commemorating the pledge of the Jinn upon hearing the Holy Quran.",
    imageUrl: null,
    sortOrder: 5,
    updatedAt: STATIC_REFERENCE_DATE,
  },
  {
    id: "fallback-ziyarat-quba",
    city: "madinah",
    name: "Masjid Quba",
    arabicName: "مسجد قباء",
    description:
      "The first mosque founded upon piety in Islam; departing one's Madinah hotel in wudu and praying two rak'ahs nafl here carries the reward of an Umrah.",
    imageUrl: null,
    sortOrder: 6,
    updatedAt: STATIC_REFERENCE_DATE,
  },
  {
    id: "fallback-ziyarat-uhud",
    city: "madinah",
    name: "Mount Uhud & Martyrs Cemetery",
    arabicName: "جبل أحد ومقبرة الشهداء",
    description:
      "Beloved northern ridge of Madinah visiting Jabal al-Rumat (Archers' Hill) and greeting Sayyid ash-Shuhada Hamza ibn Abdul-Muttalib (RA).",
    imageUrl: null,
    sortOrder: 7,
    updatedAt: STATIC_REFERENCE_DATE,
  },
  {
    id: "fallback-ziyarat-qiblatain",
    city: "madinah",
    name: "Masjid al-Qiblatayn",
    arabicName: "مسجد القبلتين",
    description:
      "Mosque of the Two Qiblahs in northwestern Madinah where revelation commanded shifting the prayer direction toward the Holy Kaaba.",
    imageUrl: null,
    sortOrder: 8,
    updatedAt: STATIC_REFERENCE_DATE,
  },
  {
    id: "fallback-ziyarat-khandaq",
    city: "madinah",
    name: "The Seven Mosques & Battle of the Trench (Khandaq)",
    arabicName: "المساجد السبعة وموقع غزوة الخندق",
    description:
      "Historic pavilion mosques along the Sela' foothills marking the defensive trench dug by the Prophet (PBUH) and Sahabah during Ahzab.",
    imageUrl: null,
    sortOrder: 9,
    updatedAt: STATIC_REFERENCE_DATE,
  },
  {
    id: "fallback-ziyarat-baqi",
    city: "madinah",
    name: "Jannat al-Baqi Cemetery",
    arabicName: "مقبرة بقيع الغرقد",
    description:
      "Adjacent east of Masjid an-Nabawi, resting place of Ahl al-Bayt, Mothers of the Believers, Uthman ibn Affan (RA), and ten thousand Sahabah.",
    imageUrl: null,
    sortOrder: 10,
    updatedAt: STATIC_REFERENCE_DATE,
  },
  {
    id: "fallback-ziyarat-uthman",
    city: "madinah",
    name: "Bir Uthman (Well of Uthman RA)",
    arabicName: "بئر عثمان بن عفان رضي الله عنه",
    description:
      "Historic Bir Rumah freshwater well and date grove endowed by Uthman ibn Affan (RA) as a perpetual waqf in Madinah.",
    imageUrl: null,
    sortOrder: 11,
    updatedAt: STATIC_REFERENCE_DATE,
  },
  {
    id: "fallback-ziyarat-dates",
    city: "madinah",
    name: "Dates Market of Madinah (Souq at-Tumoor)",
    arabicName: "سوق تمور المدينة",
    description:
      "Central harvest market south of the Haram offering graded Ajwa al-Aliyah, Safawi, Mabroom, and Amber dates directly from Madinah orchards.",
    imageUrl: null,
    sortOrder: 12,
    updatedAt: STATIC_REFERENCE_DATE,
  },
]

export interface FleetBandRow {
  passengerBand: string
  vehicleClass: string
  representativeModels: string
  bookingModeNote: string
  luggageAndAccess: string
}

export const ZIYARAT_FLEET_CAPACITY_BANDS: readonly FleetBandRow[] = [
  {
    passengerBand: "1 – 3 Seats (Adults + Children)",
    vehicleClass: "Executive Sedan",
    representativeModels: "Toyota Camry / Hyundai Sonata (Late Model AC)",
    bookingModeNote: "Private Only · Door-to-door hotel lobby pickup",
    luggageAndAccess:
      "2–3 medium suitcases; agile curbside pull-up near Haramain courtyards (Infants < 2 yrs = 0 seats).",
  },
  {
    passengerBand: "4 – 6 Seats (Adults + Children)",
    vehicleClass: "Luxury Full-Size SUV / MPV",
    representativeModels: "GMC Yukon XL / Chevrolet Suburban / Hyundai Staria",
    bookingModeNote: "Private Only · Custom post-Fajr or post-Asr departure",
    luggageAndAccess:
      "5–6 suitcases; plush captain seating and wide doors ideal for elderly parents and strollers.",
  },
  {
    passengerBand: "7 – 12 Seats (Adults + Children)",
    vehicleClass: "High-Roof Family Van / Minibus",
    representativeModels: "Toyota HiAce High-Roof / Mercedes Sprinter Class",
    bookingModeNote: "Private Family Group · Flexible scholar stop durations",
    luggageAndAccess:
      "8–12 suitcases; tall cabin headroom for joint Pakistani & overseas diaspora households.",
  },
  {
    passengerBand: "13+ Seats (Adults + Children)",
    vehicleClass: "Toyota Coaster & Luxury Coach Bus",
    representativeModels: "Toyota Coaster (22-Seat) / Executive Coach (45-Seat)",
    bookingModeNote: "Private Group or Guided Batch Allocation",
    luggageAndAccess:
      "Underfloor luggage bays, PA microphone for Urdu/English scholar commentary, and Naqaba permits.",
  },
  {
    passengerBand: "Intercity Rail Only (Not Ziyarat)",
    vehicleClass: "Haramain High-Speed Train",
    representativeModels: "300 km/h Electric Rail (Makkah ↔ Madinah ↔ JED)",
    bookingModeNote:
      "shared_only per-seat rail ticket · Station-to-station intercity transfer ONLY",
    luggageAndAccess:
      "Strict single suitcase dimension cap; never operates local Ziyarat circuits or Badr/Taif detours.",
  },
] as const

export interface IntercityExcursionRow {
  sectorCode: string
  routeTitle: string
  distanceAndDuration: string
  miqatAndRitualRule: string
  highlights: string
}

export const INTERCITY_ZIYARAT_EXCURSIONS: readonly IntercityExcursionRow[] = [
  {
    sectorCode: "MAK_TAIF_MAK",
    routeTitle: "Makkah → Taif Highlands → Makkah Day Excursion",
    distanceAndDuration: "180 km round-trip · ~240 min driving + stops",
    miqatAndRitualRule:
      "Crosses outside the Haram boundary; pilgrims intending a fresh Umrah upon returning to Makkah enter Ihram at Miqat Qarn al-Manazil (As-Sail al-Kabir) or Al-Hada (Wadi Muharram).",
    highlights:
      "Masjid Abdullah ibn Abbas (RA), Masjid Addas, Al-Hada cable-car escarpment, rosewater distilleries, and cool mountain climate.",
  },
  {
    sectorCode: "MAK_BADR_MED",
    routeTitle: "Makkah → Battlefield of Badr → Madinah Transit Ziyarat",
    distanceAndDuration: "490 km intercity corridor · ~360 min with Badr stop",
    miqatAndRitualRule:
      "When traveling Madinah → Badr → Makkah in reverse, pilgrims MUST stop at Miqat Dhul Hulayfah (Abyar Ali) outside Madinah to assume Ihram before heading toward Badr.",
    highlights:
      "Masjid al-Arish (Prophetic command pavilion site), Enclosure of the 14 Shuhada of Badr, and Kathib al-Hannan sand dune.",
  },
] as const

export const ZIYARAT_HUB_FAQS: readonly FaqJsonLdItem[] = [
  {
    question:
      "How does Al Ramlah Travels size private Ziyarat vehicles for families with infants?",
    answer:
      "Vehicle capacity bands (1–3 Sedan, 4–6 GMC/SUV, 7–12 Van/Minibus, 13+ Coaster/Coach) count Adults plus Children aged 2–11 years. Infants under 2 years travel on an adult's lap and count as zero vehicle seats, ensuring a couple with two children and an infant still fits comfortably in a 4–6 seat SUV without forced bus upgrades.",
  },
  {
    question:
      "Can we take the Haramain High-Speed Train for Ziyarat or Badr excursions?",
    answer:
      "No. The Haramain High-Speed Train is strictly a shared_only station-to-station intercity rail link connecting Makkah, Jeddah Airport (JED), KAEC, and Madinah. Local Makkah and Madinah Ziyarat circuits as well as Badr and Taif heritage excursions require private road vehicles (Sedan, GMC Yukon, Staria, HiAce, or Coaster).",
  },
  {
    question:
      "Why do Ziyarat tours display 'Live Rate — Confirmed upon submission'?",
    answer:
      "Private Ziyarat vehicle tariffs vary by passenger band, Makkah vs Madinah municipal permit windows, and Ramadan or Hajj road cordons. Selecting your preferred Ziyarat cities in our Journey Builder sends your exact dates to our Lahore desk for a confirmed itemized PKR quote.",
  },
  {
    question:
      "What time of day is best for guided Ziyarat in Makkah and Madinah?",
    answer:
      "Immediately after Fajr prayer (around 6:30 AM – 10:30 AM AST) is ideal in both cities to avoid midday desert heat, capture clear morning visibility at Mount Uhud and Arafat, and return to your Haram hotel comfortably before Dhuhr adhān.",
  },
] as const

export function buildZiyaratCollectionPageJsonLd(
  placeCount: number
): Record<string, unknown> {
  const canonicalUrl = `${CANONICAL_ORIGIN}/ziyarat`
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${canonicalUrl}#collection`,
    name: ZIYARAT_HUB_METADATA_SPEC.h1,
    description: ZIYARAT_HUB_METADATA_SPEC.description,
    url: canonicalUrl,
    inLanguage: "en-PK",
    isPartOf: {
      "@id": `${CANONICAL_ORIGIN}/#website`,
    },
    about: {
      "@id": ORGANIZATION_JSONLD_ID,
    },
    significantLink: [
      `${CANONICAL_ORIGIN}/ziyarat/makkah`,
      `${CANONICAL_ORIGIN}/ziyarat/madinah`,
    ],
    numberOfItems: placeCount,
  }
}

export interface ZiyaratCityEditorialRow {
  landmarkName: string
  arabicTitle: string
  zoneAndDistance: string
  seerahSignificance: string
  pilgrimEtiquetteAndAccess: string
}

export interface ZiyaratCitySpokeConfig {
  city: ZiyaratSpokeCity
  cityLabel: "Makkah" | "Madinah"
  arabicCity: string
  breadcrumbLabel: string
  path: `/ziyarat/${ZiyaratSpokeCity}`
  title: string
  description: string
  h1: string
  eyebrowBadge: string
  answerFirstSummary: string
  builderCtaHref: string
  builderCtaLabel: string
  siblingHref: `/ziyarat/${ZiyaratSpokeCity}`
  siblingLabel: string
  hotelSpokeHref: `/hotels/${ZiyaratSpokeCity}`
  hotelSpokeLabel: string
  editorialHeading: string
  editorialIntro: string
  editorialRows: ReadonlyArray<ZiyaratCityEditorialRow>
  specialRuleBanner: {
    badge: string
    heading: string
    paragraphs: ReadonlyArray<string>
  }
  faqs: ReadonlyArray<FaqJsonLdItem>
  faqHeading: string
}

export const ZIYARAT_CITY_SPOKE_CONFIGS: Record<
  ZiyaratSpokeCity,
  ZiyaratCitySpokeConfig
> = {
  makkah: {
    city: "makkah",
    cityLabel: "Makkah",
    arabicCity: "مكة المكرمة والطائف",
    breadcrumbLabel: "Makkah & Taif Ziyarat",
    path: "/ziyarat/makkah",
    title: "Sacred Makkah Ziyarat Places & Guide | Al Ramlah Travels",
    description:
      "Explore Makkah Ziyarat landmarks including Jabal al-Noor, Ghar-e-Thawr, Mina, Arafat & Masjid Aisha with pilgrim visiting tips and private transport options.",
    h1: "Sacred Ziyarat Landmarks in Makkah al-Mukarramah & Taif",
    eyebrowBadge: "Wahy Mountains, Mashair Plains & Miqat Rules",
    answerFirstSummary:
      "Makkah Ziyarat traces the birthplace of revelation and the rituals of Ibrahim (AS) across Jabal al-Nour (Cave of Hira), Jabal Thawr (Ghar-e-Thawr), the Mashair valleys of Mina, Muzdalifah, and Arafat, Jannat al-Mu'alla, Masjid Aisha, and mountain day-trips to Taif via Qarn al-Manazil Miqat—arranged in private air-conditioned vehicles.",
    builderCtaHref: "/?ziyaratCity=makkah_only#journey-builder",
    builderCtaLabel: "Add Makkah Ziyarat to Custom Plan",
    siblingHref: "/ziyarat/madinah",
    siblingLabel: "Explore Madinah & Badr Ziyarat Guide",
    hotelSpokeHref: "/hotels/makkah",
    hotelSpokeLabel: "View Makkah Clock Tower & Shuttle Hotels",
    editorialHeading:
      "Makkah, Mashair & Masjid Aisha Visiting Logistics & Climb Guidance",
    editorialIntro:
      "Makkah's sacred sites span steep granite peaks and vast Hajj valleys outside Masjid al-Haram. Review realistic walking gradients, senior-friendly base viewing points, and Ihram boundary rules before scheduling your morning vehicle.",
    editorialRows: [
      {
        landmarkName: "Jabal al-Nour & Cave of Hira (Ghar-e-Hira)",
        arabicTitle: "جبل النور وغار حراء",
        zoneAndDistance: "~5 km northeast of Masjid al-Haram",
        seerahSignificance:
          "Site where Angel Jibreel (AS) delivered the opening verses of Surah Al-Alaq ('Iqra').",
        pilgrimEtiquetteAndAccess:
          "Standard Ziyarat vehicles stop at the Hira Cultural District base. Climbing ~1,200 steep rock steps takes 60–90 minutes and is NOT required by Sunnah; elderly parents should view from the base.",
      },
      {
        landmarkName: "Jabal Thawr (Ghar-e-Thawr)",
        arabicTitle: "جبل ثور وغار ثور",
        zoneAndDistance: "~4 km south of Masjid al-Haram",
        seerahSignificance:
          "Three-night Hijrah refuge of Prophet Muhammad (PBUH) and Abu Bakr As-Siddiq (RA) immortalized in Surah At-Tawbah (9:40).",
        pilgrimEtiquetteAndAccess:
          "Panoramic base reflection and scholar narration; full summit ascent takes ~2 hours of strenuous trekking and requires pre-dawn hydration.",
      },
      {
        landmarkName: "Mina, Muzdalifah & Plain of Arafat (Jabal al-Rahmah)",
        arabicTitle: "منى ومزدلفة وجبل الرحمة بعرفات",
        zoneAndDistance: "8 km – 20 km east along Mashair corridor",
        seerahSignificance:
          "The tent city of Mina, Jamarat Bridge, Muzdalifah sanctuary, Masjid Namirah, and Mount of Mercy where the Farewell Sermon was delivered.",
        pilgrimEtiquetteAndAccess:
          "Outside Dhul Hijjah Hajj cordons, private SUVs and vans drive smoothly through Mina/Muzdalifah with flat walking access around Jabal al-Rahmah.",
      },
      {
        landmarkName: "Jannat al-Mu'alla & Northern Haram Mosques",
        arabicTitle: "مقبرة المعلاة ومسجد الجن",
        zoneAndDistance: "~1.2 km north of Marwah exit",
        seerahSignificance:
          "Resting place of Sayyidah Khadijah al-Kubra (RA) alongside Masjid al-Jinn and Masjid ash-Shajarah.",
        pilgrimEtiquetteAndAccess:
          "Greet the dwellers of the graves peacefully from the outer pedestrian walkway following authentic Sunnah du'a without innovations.",
      },
      {
        landmarkName: "Masjid Aisha (At-Tan'eem) & Ji'ranah",
        arabicTitle: "مسجد عائشة بالتنعيم ومسجد الجعرانة",
        zoneAndDistance: "7.5 km north (Tan'eem) / 24 km northeast (Ji'ranah)",
        seerahSignificance:
          "Nearest Hill (outside Haram boundary) points where pilgrims already inside Makkah enter Ihram for an additional Umrah.",
        pilgrimEtiquetteAndAccess:
          "Spacious ablution and Ihram changing complexes; confirm scholarly guidance on performing multiple Umrahs during one trip.",
      },
      {
        landmarkName: "Taif Mountain Excursion & Qarn al-Manazil Miqat",
        arabicTitle: "الطائف وميقات قرن المنازل",
        zoneAndDistance: "90 km east via Al-Hada escarpment (180 km return)",
        seerahSignificance:
          "Masjid Abdullah ibn Abbas (RA) and historic sites recalling the Prophet's (PBUH) steadfastness and du'a in Taif.",
        pilgrimEtiquetteAndAccess:
          "Crossing into Taif exits the Makkah Haram zone: if re-entering Makkah to perform Umrah, assume Ihram at Miqat Qarn al-Manazil (As-Sail al-Kabir) or Wadi Muharram.",
      },
    ],
    specialRuleBanner: {
      badge: "Miqat & Haram Boundary Fiqh Note",
      heading:
        "Masjid Aisha (At-Tan'eem) vs Qarn al-Manazil When Returning From Taif",
      paragraphs: [
        "Pilgrims already staying inside Makkah who wish to perform an additional Umrah travel just outside the sacred Haram boundary to Masjid Aisha (At-Tan'eem) or Masjid Ji'ranah to make Niyyah and enter Ihram.",
        "However, if your family takes a full-day Ziyarat excursion east to Taif, you cross beyond the outer Miqat line. On the return highway down to Makkah, anyone intending Umrah must enter Ihram at Miqat Qarn al-Manazil (As-Sail al-Kabir) or Al-Hada (Wadi Muharram) rather than passing the Miqat without Ihram.",
      ],
    },
    faqHeading:
      "Frequently Asked Questions — Makkah, Mashair & Taif Ziyarat",
    faqs: [
      {
        question:
          "Does a standard Makkah Ziyarat tour include climbing up to Cave of Hira or Ghar-e-Thawr?",
        answer:
          "Standard 3-to-4-hour morning Makkah Ziyarat tours bring your family to the lower viewing plazas of Jabal al-Nour and Jabal Thawr with full historical commentary, as climbing 1,200+ steep stone steps takes nearly two hours and is unsafe for elderly pilgrims or midday heat. Dedicated pre-dawn trekking drop-offs can be arranged separately for fit adults.",
      },
      {
        question:
          "Can Umrah pilgrims visit Mina, Muzdalifah, and Mount Arafat outside the Hajj season?",
        answer:
          "Yes. Throughout the Umrah months outside the annual Dhul Hijjah Hajj security lockdown, private sedans, GMC Yukons, and family vans drive through the Mina tent valley and Muzdalifah and stop at the Plain of Arafat near Jabal al-Rahmah and Masjid Namirah.",
      },
      {
        question:
          "Do we need Ihram to go on a morning Makkah Ziyarat tour?",
        answer:
          "No. Visiting Jabal al-Nour, Jabal Thawr, Jannat al-Mu'alla, Mina, and Arafat is performed in modest everyday clothing after completing your initial Umrah. You only put on Ihram if stopping at Masjid Aisha (At-Tan'eem), Ji'ranah, or returning from Taif via Miqat Qarn al-Manazil with the intention of performing another Umrah.",
      },
      {
        question:
          "How long does a private Makkah to Taif day trip take?",
        answer:
          "A private Makkah–Taif–Makkah excursion (sector MAK_TAIF_MAK, approx. 180 km round-trip) typically spans 6 to 8 hours including the scenic Al-Hada mountain highway, Masjid Abdullah ibn Abbas (RA), fruit/rosewater stops, lunch, and stopping at Miqat on the return descent.",
      },
    ],
  },
  madinah: {
    city: "madinah",
    cityLabel: "Madinah",
    arabicCity: "المدينة المنورة وبدر",
    breadcrumbLabel: "Madinah & Badr Ziyarat",
    path: "/ziyarat/madinah",
    title: "Sacred Madinah Ziyarat Places & Guide | Al Ramlah Travels",
    description:
      "Visit Masjid Quba, Mount Uhud, Masjid Qiblatain, Seven Mosques & Jannat al-Baqi in Madinah with authentic historical notes and private family Ziyarat vans.",
    h1: "Sacred Ziyarat Landmarks in Madinah al-Munawwarah & Badr",
    eyebrowBadge: "Masjid Quba Sunnah Virtue, Uhud Shuhada & Badr",
    answerFirstSummary:
      "Madinah Ziyarat connects pilgrims to the living Sunnah of the Prophet's City across Masjid Quba (where praying two rak'ahs after performing wudu at your hotel carries the reward of an Umrah), Mount Uhud and the Martyrs' Enclosure, Masjid al-Qiblatain, the Seven Mosques at Khandaq, Jannat al-Baqi, and optional Badr excursions.",
    builderCtaHref: "/?ziyaratCity=madinah_only#journey-builder",
    builderCtaLabel: "Add Madinah Ziyarat to Custom Plan",
    siblingHref: "/ziyarat/makkah",
    siblingLabel: "Explore Makkah & Taif Ziyarat Guide",
    hotelSpokeHref: "/hotels/madinah",
    hotelSpokeLabel: "View Madinah Markaziyah & Ladies Gate Hotels",
    editorialHeading:
      "Madinah & Badr Landmarks — Authentic Sunnah Virtues & Wheelchair Access",
    editorialIntro:
      "Unlike Makkah's rugged mountain terrain, nearly every major Ziyarat landmark in Madinah al-Munawwarah features flat paved courtyards, ramps, and shade canopies—making Madinah Ziyarat deeply rewarding for elderly parents, children, and wheelchair users.",
    editorialRows: [
      {
        landmarkName: "Masjid Quba",
        arabicTitle: "مسجد قباء",
        zoneAndDistance: "~3.5 km south of Masjid an-Nabawi (Quba Pedestrian Trail)",
        seerahSignificance:
          "First mosque built in Islamic history upon the Prophet's (PBUH) arrival in Madinah (Surah At-Tawbah 9:108).",
        pilgrimEtiquetteAndAccess:
          "Authentic Hadith virtue (Sunan Ibn Majah / Tirmidhi): perform fresh Wudu inside your Madinah hotel room before departing, then pray two rak'ahs nafl in Masjid Quba for the reward of an Umrah. Fully wheelchair-accessible.",
      },
      {
        landmarkName: "Mount Uhud, Jabal al-Rumat & Shuhada Enclosure",
        arabicTitle: "جبل أحد وجبل الرماة ومقبرة الشهداء",
        zoneAndDistance: "~5 km north of Central Markaziyah",
        seerahSignificance:
          "Site of the Battle of Uhud (3 AH), Archers' Mound, and resting enclosure of Sayyiduna Hamza ibn Abdul-Muttalib (RA), Mus'ab ibn Umayr (RA), and seventy martyrs.",
        pilgrimEtiquetteAndAccess:
          "Level paved plaza facing the martyrs' wall for offering Salam and Sunnah du'a; avoid climbing loose rocks on Jabal al-Rumat during crowded morning peaks.",
      },
      {
        landmarkName: "Masjid al-Qiblatayn (Mosque of the Two Qiblahs)",
        arabicTitle: "مسجد القبلتين",
        zoneAndDistance: "~5 km northwest along Wadi Aqiq ridge",
        seerahSignificance:
          "Historic congregational site commemorating the revelation of Surah Al-Baqarah (2:144) turning Qiblah from Bayt al-Maqdis to the Holy Kaaba.",
        pilgrimEtiquetteAndAccess:
          "Recently expanded plazas, clean ablution blocks, and elevator/ramp access into both men's and women's prayer halls.",
      },
      {
        landmarkName: "The Seven Mosques (Sab'ah Masajid / Khandaq)",
        arabicTitle: "المساجد السبعة وموقع الخندق",
        zoneAndDistance: "~2.5 km northwest at the foot of Mount Sela'",
        seerahSignificance:
          "Marks the defensive trench line of the Battle of Al-Ahzab (5 AH), anchored by the large modern Masjid al-Fath complex.",
        pilgrimEtiquetteAndAccess:
          "Flat courtyard promenade viewing historic stone pavilions (Masjid Salman al-Farsi RA) with shaded seating for seniors.",
      },
      {
        landmarkName: "Jannat al-Baqi (Baqi al-Gharqad)",
        arabicTitle: "مقبرة بقيع الغرقد",
        zoneAndDistance: "0m — Immediately east of Masjid an-Nabawi Courtyard",
        seerahSignificance:
          "Blessed cemetery of Madinah holding Ahl al-Bayt, Mothers of the Believers, Uthman ibn Affan (RA), and ~10,000 Companions.",
        pilgrimEtiquetteAndAccess:
          "Visited on foot directly from the Haram piazza (no vehicle required); gates typically open for male visitors after Fajr and Asr prayers.",
      },
      {
        landmarkName: "Battlefield of Badr & Shuhada of Badr (Excursion)",
        arabicTitle: "غزوة بدر ومقبرة شهداء بدر",
        zoneAndDistance: "150 km southwest of Madinah (or en route MAK ↔ MED)",
        seerahSignificance:
          "Site of Yawm al-Furqan (17 Ramadan, 2 AH), Masjid al-Arish, and the memorial roster of the 14 Martyrs of Badr.",
        pilgrimEtiquetteAndAccess:
          "Booked either as a half-day private excursion from Madinah or integrated seamlessly into a private Makkah → Badr → Madinah road transfer (490 km).",
      },
    ],
    specialRuleBanner: {
      badge: "Authentic Sunnah Practice in Madinah",
      heading:
        "Make Wudu at Your Markaziyah Hotel Before Departing for Masjid Quba",
      paragraphs: [
        "The Prophet Muhammad (PBUH) taught: 'Whoever purifies himself in his house, then comes to the Mosque of Quba and prays a prayer therein, will have a reward like that of an Umrah' (Sunan Ibn Majah, Sahih). Always perform Wudu in your hotel room before stepping into your Ziyarat car so your family earns the complete Prophetic reward.",
        "On Saturdays especially, following the Prophetic habit of visiting Quba, early post-Fajr departure helps families pray peacefully before mid-morning tour buses arrive.",
      ],
    },
    faqHeading:
      "Frequently Asked Questions — Madinah, Masjid Quba & Badr Ziyarat",
    faqs: [
      {
        question:
          "What is the authentic Sunnah method for visiting Masjid Quba during Madinah Ziyarat?",
        answer:
          "Perform complete Wudu inside your Madinah hotel room before leaving, travel to Masjid Quba (by private car or along the 3.5 km Quba Pedestrian Avenue), and offer at least two rak'ahs of Tahiyyat al-Masjid / Nafl prayer. Authentic Hadith confirms this carries the reward equivalent to an Umrah.",
      },
      {
        question:
          "Are Masjid Quba, Mount Uhud, and Masjid al-Qiblatain accessible for wheelchairs?",
        answer:
          "Yes. All major Madinah Ziyarat stops—Masjid Quba, the Shuhada plaza at Mount Uhud, Masjid al-Qiblatain, the Khandaq courtyard, and Souq at-Tumoor—have wide level pavements and ramps. Private GMC Yukon XL and Hyundai Staria vans accommodate folded wheelchairs in the rear cargo bay.",
      },
      {
        question:
          "When does Jannat al-Baqi open and do we need a Ziyarat vehicle to reach it?",
        answer:
          "Jannat al-Baqi sits directly adjoining the southeastern courtyard of Masjid an-Nabawi opposite Bab Al-Salam and the Green Dome, so you walk there directly after Fajr or Asr congregational prayers without needing transport. In accordance with Saudi cemetery regulations, interior entry gates are open during scheduled post-prayer windows for men.",
      },
      {
        question:
          "Should we visit Badr as a day trip from Madinah or on the road between Makkah and Madinah?",
        answer:
          "Both options work smoothly. Many families save 150 km of backtracking by selecting our intercity Makkah → Badr → Madinah private transfer (490 km total). Remember: if traveling in the opposite direction (Madinah → Badr → Makkah) for Umrah, you must stop first at Miqat Abyar Ali outside Madinah to enter Ihram.",
      },
    ],
  },
}

export function describeLiveVehiclesSummary(
  vehicles: ReadonlyArray<PublicVehicleDto>
): PublicVehicleDto[] {
  return [...vehicles].sort((a, b) => a.sortOrder - b.sortOrder)
}
