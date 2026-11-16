import type { FaqJsonLdItem } from "@/lib/seo/json-ld"
import type { UmrahGatewayCitySlug } from "@/lib/seo/slugs"

export interface CityAirlineSectorRow {
  carrier: string
  flightCodes: string
  ksaGateway: string
  routingAndDuration: string
  baggageAndIhramNote: string
}

export interface CityLogisticsPillar {
  badge: string
  heading: string
  body: string
}

export interface UmrahCityGatewayRichProfile {
  slug: UmrahGatewayCitySlug
  eyebrowLabel: string
  answerFirstLead: string
  conciergeSectionHeading: string
  conciergeSectionIntro: string
  conciergeSteps: ReadonlyArray<{
    stepCode: string
    title: string
    detail: string
  }>
  flightTableHeading: string
  flightTableCaption: string
  airlineSectors: ReadonlyArray<CityAirlineSectorRow>
  logisticsSectionHeading: string
  logisticsPillars: ReadonlyArray<CityLogisticsPillar>
  catchmentHeading: string
  catchmentNarrative: string
  builderPrimaryLabel: string
  builderVisaOnlyLabel: string
  whatsappPrefillMessage: string
  faqSectionHeading: string
  faqs: ReadonlyArray<FaqJsonLdItem>
}

/**
 * Substantively differentiated Tier-1 Pakistani departure gateway profiles (`SEO-016`, `GB-03`).
 * Engineered with authentic terminal, highway, airline sector, Miqat, and passport-intake details
 * achieving `>= 65%` pairwise 4-gram Jaccard uniqueness across `lahore`, `karachi`, and `islamabad`.
 */
export const UMRAH_CITY_GATEWAY_PROFILES: Record<
  UmrahGatewayCitySlug,
  UmrahCityGatewayRichProfile
> = {
  lahore: {
    slug: "lahore",
    eyebrowLabel: "Lahore Cantt Headquarters · LHE Direct & 1-Stop Gateway",
    answerFirstLead:
      "Punjab families depart from Allama Iqbal International Airport (LHE) just ten minutes down Airport Road from Al Ramlah Travels at Office No. 38, Street 1, Sector C, Askari 10, Lahore Cantt. Choose direct Saudia or PIA batches with transparent PKR room rates, Saudi e-visas, and walk-in passport verification.",
    conciergeSectionHeading:
      "Walk-In Askari 10 Lahore Cantt Desk & Same-Day Passport Review",
    conciergeSectionIntro:
      "Unlike remote web portals, Lahore and Central Punjab pilgrims can visit our Askari 10 consultancy in person before locking group seats or submitting passports for Nusuk Masar hotel and MOFA e-visa issuance:",
    conciergeSteps: [
      {
        stepCode: "LHE-01",
        title: "In-Person Consultation Near Airport Road",
        detail:
          "Drop by Sector C, Askari 10 (Monday to Saturday, 9:00 AM to 8:00 PM PKT) to inspect exact Clock Tower, Ajyad, and Markaziyah walking distances, compare Sharing vs Quad/Triple/Double family room splits, and verify live airline seat blocks.",
      },
      {
        stepCode: "LHE-02",
        title: "Guided Saudi Visa Bio & Punjab Etimad Support",
        detail:
          "Our Lahore operations counter helps elderly parents complete the Saudi Visa Bio smartphone fingerprint and facial scan under proper lighting, resolving camera glare or machine-readable passport zone issues on the spot.",
      },
      {
        stepCode: "LHE-03",
        title: "Printed Pre-Departure Kit & Ihram Briefing",
        detail:
          "Collect colour-printed Saudi e-visas, confirmed airline PNR tickets, Makkah/Madinah hotel vouchers, colour-coded Askari 10 luggage tags, and a bilingual Urdu/English Tawaf and Sa'i pocket guide before heading to Allama Iqbal Terminal.",
      },
    ],
    flightTableHeading:
      "Allama Iqbal International Airport (LHE) Umrah Airline Sectors & Timings",
    flightTableCaption:
      "Typical commercial Umrah flight routings operating out of Lahore (LHE) International Departures; exact flight numbers and baggage allowances are confirmed per batch.",
    airlineSectors: [
      {
        carrier: "Saudia (SV)",
        flightCodes: "SV-735 / SV-739",
        ksaGateway: "Jeddah (JED) Terminal 1 & Madinah (MED)",
        routingAndDuration: "Non-stop wide-body (~4h 50m to JED; ~4h 45m to MED)",
        baggageAndIhramNote:
          "2×23 kg checked bags + complimentary 5L Zamzam bottle on return; onboard Miqat prayer announcement.",
      },
      {
        carrier: "Pakistan International Airlines (PK)",
        flightCodes: "PK-759 / PK-747",
        ksaGateway: "Jeddah (JED) Hajj/North & Madinah (MED)",
        routingAndDuration: "Direct non-stop (~5h 00m sector from LHE)",
        baggageAndIhramNote:
          "Generous Umrah checked allowance + dedicated LHE international Umrah check-in counters.",
      },
      {
        carrier: "Airblue (PA) & SereneAir (ER)",
        flightCodes: "PA-470 / ER-821",
        ksaGateway: "Jeddah (JED)",
        routingAndDuration: "Direct narrow-body & wide-body value departures (~5h 05m)",
        baggageAndIhramNote:
          "30 kg–46 kg tiered Umrah baggage; wear Ihram at Allama Iqbal Terminal prior to boarding.",
      },
      {
        carrier: "AirSial (PF) & Gulf 1-Stop (EK / QR)",
        flightCodes: "PF-716 / EK-623 / QR-621",
        ksaGateway: "Jeddah (JED) or Madinah (MED) via DXB / DOH",
        routingAndDuration: "Direct PF flights or 1-stop premium hub transfers (7h–9h total)",
        baggageAndIhramNote:
          "Ideal for custom flexible-date itineraries when fixed group seats sell out during peak Ashra.",
      },
    ],
    logisticsSectionHeading:
      "Lahore Terminal Check-In, Ring Road Access & Airborne Miqat Protocol",
    logisticsPillars: [
      {
        badge: "4-Hour LHE Reporting",
        heading: "Ring Road (L-20) Arrival & International Concourse Flow",
        body:
          "Families arriving from DHA Phases 1–8, Gulberg, Johar Town, Model Town, or Bahria Town Lahore via Lahore Ring Road (Airport Exit) should reach Allama Iqbal International Departures 4 hours before scheduled pushback to clear ANF baggage screening, FIA immigration, and group manifest check-in calmly.",
      },
      {
        badge: "Makkah-First JED Lock",
        heading: "Ihram Changing Rooms at LHE & Qarn al-Manazil / Yalamlam",
        body:
          "Because Makkah al-Mukarramah has no civilian airport, every Makkah-first Lahore group lands at Jeddah (JED) followed by a 75-minute coach or Haramain High-Speed Rail transfer. Male pilgrims enter Ihram garments inside LHE's ablution and prayer lounge before boarding and make Niyyah + Talbiyah when the captain announces the Miqat (~45 minutes before Jeddah).",
      },
      {
        badge: "Return Zamzam Bay",
        heading: "Dedicated LHE Zamzam Conveyor & Elderly Wheelchair Escort",
        body:
          "Pre-requested airline wheelchairs meet senior Lahore pilgrims from check-in counter to aircraft door. On return to LHE International Arrivals, sealed 5-liter Saudi Zamzam cartons are distributed at the designated Zamzam belt beside International Baggage Claim.",
      },
    ],
    catchmentHeading:
      "Serving Central Punjab: Gujranwala, Faisalabad, Sialkot, Kasur & Sheikhupura",
    catchmentNarrative:
      "Pilgrims traveling down the M-11 Lahore-Sialkot Motorway, GT Road (N-5) from Gujranwala and Wazirabad, or M-3/M-2 from Faisalabad, Sheikhupura, Okara, and Kasur routinely consolidate into our LHE fixed-departure batches. Out-of-district Punjab families can courier documents or send verified scans on WhatsApp and stop briefly at our Askari 10 office on departure day, just 3.5 km from the terminal apron.",
    builderPrimaryLabel: "Customize a Flexible Lahore (LHE) Umrah Itinerary",
    builderVisaOnlyLabel: "Check Fixed PKR Saudi Umrah Visa Rates",
    whatsappPrefillMessage:
      "Assalam-o-Alaikum Al Ramlah Travels (Askari 10 Lahore), please share upcoming Umrah group batches and PKR room rates departing from Lahore (LHE).",
    faqSectionHeading:
      "Frequently Asked Questions — Umrah Departures from Lahore (LHE)",
    faqs: [
      {
        question:
          "Can my family visit Al Ramlah Travels in Askari 10, Lahore Cantt to book in person?",
        answer:
          "Yes. Our headquarters is located at Office No. 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt, Pakistan — roughly ten minutes from Allama Iqbal International Airport (LHE). Walk-in consultations and original passport checks are available Monday to Saturday from 9:00 AM to 8:00 PM PKT.",
      },
      {
        question:
          "Do Lahore Makkah-first Umrah groups wear Ihram before boarding at Allama Iqbal Airport?",
        answer:
          "Yes. Makkah has no airport, so Makkah-first flights from LHE land at King Abdulaziz International Airport in Jeddah (JED), which lies inside the Miqat boundary. Pilgrims put on Ihram garments at home in Lahore or inside the LHE International Terminal prayer area before boarding, then recite Niyyah and Talbiyah mid-flight before crossing Miqat Qarn al-Manazil or Yalamlam.",
      },
      {
        question:
          "How long is a non-stop Umrah flight from Lahore (LHE) to Jeddah or Madinah?",
        answer:
          "Direct wide-body flights from Lahore (LHE) on Saudia (SV) or PIA (PK) take approximately 4 hours 45 minutes to 5 hours 05 minutes westbound to Jeddah (JED) or Prince Mohammad bin Abdulaziz Airport in Madinah (MED), whereas eastbound return flights to Lahore take roughly 4 hours 15 minutes.",
      },
      {
        question:
          "How are infants under 2 years priced on Lahore group Umrah packages?",
        answer:
          "Infants under 2 years pay a dedicated fixed infant PKR tariff covering their mandatory Saudi Umrah e-visa and airline lap-infant ticket, while occupying 0 hotel beds and 0 KSA transport seats. Only Adults and Children (2–11 years) count toward Sharing, Quad, Triple, or Double room bed allocations.",
      },
      {
        question:
          "What if my preferred Lahore group departure date is sold out?",
        answer:
          "Whenever a fixed LHE batch fills up, you can launch our Custom Umrah Builder pre-locked to Lahore (LHE) to request exact travel dates, private Clock Tower or Markaziyah rooms, and GMC Yukon transfers — volatile flight and hotel components are quoted at live PKR rates upon submission.",
      },
    ],
  },

  karachi: {
    slug: "karachi",
    eyebrowLabel: "Sindh & Southern Corridor · Pakistan's Shortest Flight to Haramain",
    answerFirstLead:
      "Departing from Jinnah International Airport (KHI) gives Karachi, Hyderabad, and Sindh pilgrims Pakistan's fastest flight time to Jeddah (~4 hours 10 minutes) and Madinah (~4 hours 15 minutes). Complete 100% of your Saudi Umrah e-visa, hotel rooming, and live PKR group seat booking digitally from Karachi.",
    conciergeSectionHeading:
      "100% Remote Karachi Passport Intake & Insured Courier Protocol",
    conciergeSectionIntro:
      "Karachi families never need to travel to Punjab for paperwork. Our dedicated digital concierge processes Sindh and Balochistan Umrah dossiers end-to-end via WhatsApp and encrypted cloud storage:",
    conciergeSteps: [
      {
        stepCode: "KHI-01",
        title: "Instant WhatsApp Bio-Page & Photo Verification",
        detail:
          "Share clear scans of machine-readable Pakistani passports (valid >= 6 months), CNIC/NADRA B-Forms, and white-background photos from Clifton, DHA Karachi, PECHS, Gulshan-e-Iqbal, Nazimabad, or Malir for immediate Nusuk Masar compliance screening.",
      },
      {
        stepCode: "KHI-02",
        title: "At-Home Saudi Visa Bio Smartphone Enrollment",
        detail:
          "Complete mandatory Saudi facial and ten-fingerprint biometrics from your Karachi residence using the official iOS/Android Saudi Visa Bio app with live telephone screen-by-screen guidance from our visa specialists.",
      },
      {
        stepCode: "KHI-03",
        title: "Digital E-Visa Pack & Optional TCS Insured Dispatch",
        detail:
          "Receive high-resolution PDFs of your Saudi Umrah e-Visa, confirmed KHI airline e-tickets, Haramain hotel reservation codes, and KSA transport contacts directly on WhatsApp, with tracked TCS/Leopards courier delivery whenever physical travel kits are requested.",
      },
    ],
    flightTableHeading:
      "Jinnah International Airport (KHI) Non-Stop & Gulf Carrier Matrix",
    flightTableCaption:
      "High-frequency coastal air routes linking Karachi (KHI) Satellite East & West concourses to Jeddah (JED) and Madinah (MED).",
    airlineSectors: [
      {
        carrier: "Saudia (SV)",
        flightCodes: "SV-701 / SV-705 / SV-709",
        ksaGateway: "Jeddah (JED) Terminal 1 & Madinah (MED)",
        routingAndDuration: "Daily non-stop coastal corridor (~4h 10m to JED; ~4h 15m to MED)",
        baggageAndIhramNote:
          "Shortest airborne sector from Pakistan; Terminal 1 Jeddah arrival with Haramain Train station inside the airport.",
      },
      {
        carrier: "PIA (PK) & Airblue (PA)",
        flightCodes: "PK-731 / PK-743 / PA-170",
        ksaGateway: "Jeddah (JED) & Madinah (MED)",
        routingAndDuration: "Direct non-stop departures (~4h 15m–4h 25m)",
        baggageAndIhramNote:
          "Direct family blocks popular with Hyderabad and Karachi Memon, Gujarati, and Urdu-speaking communities.",
      },
      {
        carrier: "Flynas (XY) & SereneAir (ER)",
        flightCodes: "XY-314 / ER-811",
        ksaGateway: "Jeddah (JED)",
        routingAndDuration: "Non-stop scheduled departures (~4h 20m)",
        baggageAndIhramNote:
          "Competitive Quad and Sharing occupancy fares; check baggage tier (20 kg vs 30 kg/46 kg) on batch sheet.",
      },
      {
        carrier: "Emirates (EK), Qatar (QR) & Gulf Air (GF)",
        flightCodes: "EK-601 / QR-611 / GF-753",
        ksaGateway: "Jeddah (JED) & Madinah (MED) via DXB / DOH / BAH",
        routingAndDuration: "Quick 95-minute Arabian Gulf hub connections (~6h 30m–7h 45m)",
        baggageAndIhramNote:
          "Multiple daily waves out of KHI ideal for executive Double-room custom itineraries and stopovers.",
      },
    ],
    logisticsSectionHeading:
      "Karachi Satellite Concourses, Shahrah-e-Faisal Buffer & Red Sea Miqat Timing",
    logisticsPillars: [
      {
        badge: "Rapid Miqat Alert",
        heading: "Why KHI → JED Pilgrims Must Wear Ihram Before Leaving Jinnah Terminal",
        body:
          "Because Karachi flights cross the Arabian Sea and enter Red Sea airspace rapidly, the aircraft reaches Miqat Yalamlam roughly 40 to 45 minutes prior to Jeddah touchdown. Changing mid-air in narrow lavatory queues is impractical — put on stitched-free Ihram towels in Jinnah International's Satellite Concourse prayer room before boarding.",
      },
      {
        badge: "Traffic & Reporting",
        heading: "Shahrah-e-Faisal & Malir Cantt Corridor Buffer",
        body:
          "Evening departures from KHI coincide with peak commuter congestion along Shahrah-e-Faisal, Karsaz, and Rashid Minhas Road. Aim to arrive at Jinnah International Terminal 3.5 to 4 hours ahead of departure so elderly pilgrims clear ASF gate checks and international immigration without rushing.",
      },
      {
        badge: "Overseas Convergence",
        heading: "Syncing UK, US & Gulf Relatives with Karachi Parents in Makkah",
        body:
          "Many diaspora children flying from London Heathrow, Manchester, Toronto, Houston, or Dubai meet Karachi-based parents at Jeddah Terminal 1. Our custom builder aligns KSA arrival timestamps so the entire family shares one private GMC Yukon XL or H1 van straight to Makkah.",
      },
    ],
    catchmentHeading:
      "Regional Hub for Hyderabad (M-9), Sukkur, Mirpurkhas & Quetta Pilgrims",
    catchmentNarrative:
      "Jinnah International Airport serves as the primary international Umrah gateway for families traveling down the M-9 Motorway from Hyderabad and Jamshoro, interior Sindh districts (Sukkur, Larkana, Nawabshah, Mirpurkhas), and domestic feeder flights from Quetta and Gwadar. Madinah-first KHI → MED batches are especially recommended for interior Sindh elders who prefer resting in Markaziyah before wearing Ihram at Masjid Dhul Hulayfah (Abyar Ali).",
    builderPrimaryLabel: "Design a Custom Karachi (KHI) Umrah Package",
    builderVisaOnlyLabel: "View Standalone PKR Umrah E-Visa Tariffs",
    whatsappPrefillMessage:
      "Assalam-o-Alaikum Al Ramlah Travels, I am inquiring from Karachi regarding KHI Umrah group departures and PKR room rates.",
    faqSectionHeading:
      "Frequently Asked Questions — Umrah Packages from Karachi (KHI)",
    faqs: [
      {
        question:
          "How do Karachi residents book and receive Umrah visas without visiting Lahore?",
        answer:
          "All Saudi Umrah e-visas are 100% electronic. Karachi pilgrims submit passport bio-page scans via WhatsApp, complete the Saudi Visa Bio app check from home, settle PKR invoices through verified banking channels, and receive printable e-visas, airline e-tickets, and Nusuk hotel vouchers digitally.",
      },
      {
        question:
          "What is the flight duration from Karachi (KHI) to Jeddah and Madinah?",
        answer:
          "Karachi enjoys the shortest Haramain flight time in Pakistan: non-stop flights from Jinnah International Airport (KHI) reach King Abdulaziz International Airport in Jeddah (JED) in roughly 4 hours 10 minutes and Madinah (MED) in roughly 4 hours 15 minutes.",
      },
      {
        question:
          "Why does custom Umrah from Karachi show 'Live Rate' while Visa-Only shows a fixed PKR total?",
        answer:
          "Airline seat inventory out of KHI and seasonal Makkah/Madinah hotel contracts fluctuate hourly. Therefore, standalone Visa-Only mode displays an immediate fixed PKR fee (auto-calculated from KSA Arrival and Departure dates as <=30 days short-term or >30 days long-term), whereas custom flight and hotel combinations confirm live PKR totals upon submission.",
      },
      {
        question:
          "Can Hyderabad or Quetta pilgrims join fixed-departure Karachi Umrah batches?",
        answer:
          "Yes. Families arriving via the M-9 Hyderabad-Karachi Motorway or domestic flights from Quetta meet our group manifest at Jinnah International Departures 4 hours before takeoff with pre-issued boarding credentials and KSA transport vouchers.",
      },
      {
        question:
          "Where do Makkah-first flights from Karachi land in Saudi Arabia?",
        answer:
          "Makkah has no airport, so every Makkah-first flight from KHI lands at Jeddah (JED), followed by an immediate ground coach, private SUV, or Haramain High-Speed Train transfer directly to your Makkah hotel.",
      },
    ],
  },

  islamabad: {
    slug: "islamabad",
    eyebrowLabel: "Twin Cities, Potohar, KP & Azad Kashmir Wide-Body Hub",
    answerFirstLead:
      "Pilgrims across Islamabad, Rawalpindi, Khyber Pakhtunkhwa, Hazara, and Azad Kashmir fly from the modern greenfield Islamabad International Airport (ISB) near Fateh Jang. Reserve wide-body Saudia or PIA Umrah group seats in PKR or configure multi-generational Madinah-first and Jeddah-entry itineraries.",
    conciergeSectionHeading:
      "Joint-Family Northern Coordination & Digital Dossier Processing",
    conciergeSectionIntro:
      "Northern Pakistani households frequently travel in multi-generational groups of 6 to 18 pilgrims requiring coordinated adjacent rooms and elder mobility support:",
    conciergeSteps: [
      {
        stepCode: "ISB-01",
        title: "Consolidated Multi-Household Rooming Allocation",
        detail:
          "Whether relatives live across Islamabad Sectors F/G/I, Rawalpindi Chaklala/Bahria Town, Peshawar, Abbottabad, or Mirpur AJK, our desk maps Adults and Children accurately across Quad, Triple, and Double rooms while keeping Infants (<2 yrs) at 0 beds and 0 coach seats.",
      },
      {
        stepCode: "ISB-02",
        title: "Remote Biometric & NICOP / Foreign Passport Handling",
        detail:
          "Many Rawalpindi, Chakwal, Jhelum, and Mirpur families travel alongside UK or European dual-national relatives. We verify Pakistani passports alongside NICOP-backed diaspora passports and guide each traveler through Saudi Visa Bio completion.",
      },
      {
        stepCode: "ISB-03",
        title: "Pre-Departure WhatsApp Briefing & KSA Ground Dispatch",
        detail:
          "Forty-eight hours prior to your ISB flight, lead pilgrims receive driver WhatsApp contacts, Jeddah Terminal 1 or Madinah airport meeting points, Nusuk Rawdah permit guidance, and 24/7 PKT/AST concierge escalation lines.",
      },
    ],
    flightTableHeading:
      "Islamabad International Airport (ISB) Wide-Body & Connecting Schedules",
    flightTableCaption:
      "Principal Umrah aviation options departing from the Fateh Jang greenfield passenger terminal (ISB) for Northern Pakistan.",
    airlineSectors: [
      {
        carrier: "Saudia (SV)",
        flightCodes: "SV-723 / SV-727",
        ksaGateway: "Jeddah (JED) Terminal 1 & Madinah (MED)",
        routingAndDuration: "Non-stop Boeing 777 wide-body (~5h 05m to JED; ~4h 55m to MED)",
        baggageAndIhramNote:
          "Level aerobridge boarding suited for wheelchair elders; dedicated onboard prayer zone on select wide-bodies.",
      },
      {
        carrier: "Pakistan International Airlines (PK)",
        flightCodes: "PK-741 / PK-713",
        ksaGateway: "Jeddah (JED) & Madinah (MED)",
        routingAndDuration: "Direct non-stop Northern gateway flights (~5h 10m)",
        baggageAndIhramNote:
          "High seat capacity for large Potohar, Hazara, and AJK clan groups traveling on one PNR.",
      },
      {
        carrier: "Airblue (PA) & AirSial (PF)",
        flightCodes: "PA-270 / PF-718",
        ksaGateway: "Jeddah (JED)",
        routingAndDuration: "Direct scheduled departures (~5h 15m)",
        baggageAndIhramNote:
          "Cost-effective Bronze and Silver group tiers; put on Ihram inside ISB Level 2 prayer lounge pre-boarding.",
      },
      {
        carrier: "Qatar Airways (QR) & Etihad (EY)",
        flightCodes: "QR-633 / EY-232",
        ksaGateway: "Jeddah (JED) & Madinah (MED) via DOH / AUH",
        routingAndDuration: "1-stop full-service Gulf connections (7h 30m–9h 00m)",
        baggageAndIhramNote:
          "Preferred when pairing specific 5-star Northern Markaziyah Madinah suites with flexible travel dates.",
      },
    ],
    logisticsSectionHeading:
      "Fateh Jang Highway Access, Winter Fog Buffers & MED vs JED Strategy",
    logisticsPillars: [
      {
        badge: "Nov–Feb Fog Advisory",
        heading: "M-1 & M-2 Motorway Fog Buffer for KP, Hazara & Potohar Travelers",
        body:
          "Between November and February, dense night and early-morning fog frequently triggers temporary closures on the M-1 (Peshawar–Islamabad) and M-2 (Chakwal/Kallar Kahar–Islamabad) Motorways near the Airport Link Interchange. Families driving from Peshawar, Mardan, Swabi, Abbottabad, or Jhelum should add a 3-hour GT Road (N-5) contingency buffer on top of the standard 4-hour ISB check-in window.",
      },
      {
        badge: "Madinah-First Option",
        heading: "Why ISB → MED Flights Simplify Travel for Elderly Grandparents",
        body:
          "Choosing a Madinah-first itinerary from Islamabad lands directly at Prince Mohammad bin Abdulaziz Airport (MED), just 25–30 minutes from Masjid an-Nabawi courtyards, with zero need to wear Ihram on the outbound aircraft. After resting in Madinah, pilgrims enter Ihram calmly at Miqat Dhul Hulayfah before boarding the Haramain High-Speed Train or private coach to Makkah.",
      },
      {
        badge: "Aerobridge Mobility",
        heading: "Greenfield Terminal Elevators, Prayer Halls & JED Transfer Lock",
        body:
          "Islamabad International Airport features spacious multi-bay drop-off lanes along Srinagar Highway Extension, wide elevators, and modern ablution/Ihram facilities. For Makkah-first ISB → JED arrivals, entry is locked to Jeddah Airport with pre-arranged Coaster, SUV, or rail transfer straight to Makkah.",
      },
    ],
    catchmentHeading:
      "Gateway for Rawalpindi, Peshawar, Abbottabad, Chakwal & Mirpur AJK",
    catchmentNarrative:
      "ISB consolidates Umrah departures across the entire northern arc: Rawalpindi Cantt, Taxila, Wah, Attock, Chakwal, Jhelum, Mirpur and Muzaffarabad in Azad Kashmir, Abbottabad and Mansehra via the Hazara Motorway (M-15), and Peshawar, Nowshera, Mardan, and Swat via the M-1. Group seat reservations remain soft holds until our quoting desk verifies passport validity and flight manifest availability.",
    builderPrimaryLabel: "Configure an Islamabad (ISB) Custom Umrah Plan",
    builderVisaOnlyLabel: "Calculate Short & Long-Stay PKR Visa Rates",
    whatsappPrefillMessage:
      "Assalam-o-Alaikum Al Ramlah Travels, please share Umrah group packages and PKR occupancy rates departing from Islamabad (ISB).",
    faqSectionHeading:
      "Frequently Asked Questions — Umrah Departures from Islamabad (ISB)",
    faqs: [
      {
        question:
          "How early should Peshawar, Abbottabad, or Mirpur AJK families leave for Islamabad Airport in winter?",
        answer:
          "Standard international check-in at Islamabad International Airport (ISB) opens 4 hours before departure. During the November–February winter fog season, M-1, M-2, and M-15 motorway sections can close unexpectedly overnight, so northern out-of-station families should plan an extra 3-hour road buffer or arrive in Rawalpindi/Islamabad the evening prior.",
      },
      {
        question:
          "Should senior pilgrims from Islamabad book Madinah-first (MED) or Jeddah-entry (JED) Umrah packages?",
        answer:
          "Both routes operate regularly from ISB. Madinah-first flights (ISB → MED) allow elders to fly in regular clothing and check into a Markaziyah hotel 25–30 minutes after landing, whereas Makkah-first itineraries must land at Jeddah (JED — as Makkah has no airport), requiring Ihram before boarding at ISB plus a 75-minute transfer to Makkah.",
      },
      {
        question:
          "How are private rooms split for large Rawalpindi & AJK joint families in the custom builder?",
        answer:
          "Hotel beds and KSA vehicle seats count Adults + Children (infants under 2 years take 0 beds and 0 seats). Our room allocator automatically splits larger family groups across Quad (4-bed), Triple (3-bed), and Double (2-bed) rooms according to each Makkah and Madinah hotel's permitted room types.",
      },
      {
        question:
          "Can UK Overseas Pakistanis from Mirpur or Rawalpindi join an Islamabad family Umrah group?",
        answer:
          "Yes. Relatives flying from London, Birmingham, or Manchester can either fly into ISB first to travel together on the group PNR or book a synchronized land/hotel package meeting the ISB family upon arrival in Jeddah or Madinah.",
      },
      {
        question:
          "What happens if a room tier on an Islamabad Umrah package says 'On Request'?",
        answer:
          "In accordance with our transparent PKR pricing rules, any occupancy tier without a published fixed tariff is marked 'On Request' rather than showing a placeholder zero price. Tap the WhatsApp Concierge button or launch the Custom Builder with ISB pre-selected to receive a verified live PKR quotation.",
      },
    ],
  },
}
