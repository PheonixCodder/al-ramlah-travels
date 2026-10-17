"use server"

import { db } from "@/db"
import * as schema from "@/db/schema"
import {
  calculateVisaTierAndCost,
  type VisaRateTiers,
} from "@/lib/domain/visa-calc"
import {
  customJourneyApplicationSchema,
  groupBookingSchema,
  hajjInquirySchema,
  statusLookupSchema,
  type CustomJourneyApplicationInput,
  type GroupBookingInput,
  type HajjInquiryInput,
  type StatusLookupInput,
} from "@/lib/validations/application"
import { and, desc, eq, ilike } from "drizzle-orm"

// ==========================================
// REFERENCE NUMBER GENERATOR
// ==========================================

const REF_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // Ambiguity-free charset (no 0/O, 1/I)

function generateRandomRefSuffix(length: number = 4): string {
  let result = ""
  for (let i = 0; i < length; i++) {
    result += REF_CHARS.charAt(Math.floor(Math.random() * REF_CHARS.length))
  }
  return result
}

export async function generateApplicationReference(): Promise<string> {
  const year = new Date().getFullYear()
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `ART-${year}-${generateRandomRefSuffix(4)}`
    const existing = await db.query.applications.findFirst({
      where: eq(schema.applications.referenceNumber, candidate),
      columns: { id: true },
    })
    if (!existing) {
      return candidate
    }
  }
  // Fallback to 6 characters if 4 collided
  return `ART-${year}-${generateRandomRefSuffix(6)}`
}

function cleanPhoneNumber(phone: string): string {
  return phone.replace(/\D/g, "")
}

function formatWhatsAppUrl(agencyPhone: string, message: string): string {
  const cleanPhone = cleanPhoneNumber(agencyPhone)
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
}

// ==========================================
// 1. SUBMIT CUSTOM JOURNEY APPLICATION
// ==========================================

export interface CustomApplicationResult {
  success: boolean
  referenceNumber?: string
  applicationId?: string
  calculatedVisaTotalPkr?: number
  calculatedVisaTier?: "short_term" | "long_term"
  totalKsaDays?: number
  isVisaOnly?: boolean
  whatsappUrl?: string
  error?: string
}

export async function submitCustomApplication(
  rawInput: unknown
): Promise<CustomApplicationResult> {
  try {
    const parseResult = customJourneyApplicationSchema.safeParse(rawInput)
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || "Invalid application data."
      return { success: false, error: firstError }
    }

    const data: CustomJourneyApplicationInput = parseResult.data

    const totalPassportCount =
      data.passengers.adults + data.passengers.children + data.passengers.infants
    const bedAndSeatCount = data.passengers.adults + data.passengers.children

    // 1. Calculate Visa Tier & Cost if visa is included
    let totalKsaDays: number | null = null
    let calculatedVisaTier: "short_term" | "long_term" | null = null
    let lockedVisaRatePerPersonPkr: number | null = null
    let calculatedVisaTotalPkr: number | null = null

    if (data.includeVisa && data.ksaArrivalDate && data.ksaDepartureDate) {
      const dbVisaRates = await db.query.visaRates.findMany()
      const shortTerm =
        dbVisaRates.find((r) => r.tier === "short_term")?.pricePkr ?? 42500
      const longTerm =
        dbVisaRates.find((r) => r.tier === "long_term")?.pricePkr ?? 65000

      const rates: VisaRateTiers = {
        shortTermPricePkr: shortTerm,
        longTermPricePkr: longTerm,
      }

      const visaCalc = calculateVisaTierAndCost(
        data.ksaArrivalDate,
        data.ksaDepartureDate,
        totalPassportCount,
        rates
      )

      totalKsaDays = visaCalc.totalKsaDays
      calculatedVisaTier = visaCalc.tier
      lockedVisaRatePerPersonPkr = visaCalc.pricePerPassportPkr
      calculatedVisaTotalPkr = visaCalc.totalVisaCostPkr
    }

    // 2. Enforce Airport Rules
    let entryAirport = "JED"
    let exitAirport = "MED"

    if (data.citySequence) {
      if (
        data.citySequence === "makkah_madinah" ||
        data.citySequence === "makkah_madinah_makkah" ||
        data.citySequence === "makkah_only"
      ) {
        entryAirport = "JED" // Invariant: Makkah has no airport, must fly to JED
        exitAirport =
          data.citySequence === "makkah_only" ||
          data.citySequence === "makkah_madinah_makkah"
            ? "JED"
            : "MED"
      } else if (data.citySequence === "madinah_makkah") {
        entryAirport = "MED"
        exitAirport = "JED"
      } else if (data.citySequence === "madinah_only") {
        entryAirport = "MED"
        exitAirport = "MED"
      }
    }

    const isVisaOnly =
      data.presetMode === "visa_only" ||
      (data.includeVisa &&
        !data.includeFlights &&
        !data.includeHotels &&
        !data.includeTransport &&
        !data.includeZiyarat)

    const referenceNumber = await generateApplicationReference()

    // 3. Database Persistence inside transaction
    const newApp = await db.transaction(async (tx) => {
      const [app] = await tx
        .insert(schema.applications)
        .values({
          referenceNumber,
          source: "custom_builder",
          status: "pending_quote",
          presetMode: data.presetMode,
          customerName: data.contact.customerName,
          customerPhone: data.contact.customerPhone,
          customerWhatsapp: data.contact.customerWhatsapp,
          customerCity: data.contact.customerCity,
          customerEmail: data.contact.customerEmail || null,
          specialRequests: data.contact.specialRequests || null,
          adults: data.passengers.adults,
          children: data.passengers.children,
          infants: data.passengers.infants,
          totalPassportCount,
          bedAndSeatCount,
          includeVisa: data.includeVisa,
          includeFlights: data.includeFlights,
          includeHotels: data.includeHotels,
          includeTransport: data.includeTransport,
          includeZiyarat: data.includeZiyarat,
          ksaArrivalDate: data.ksaArrivalDate || null,
          ksaDepartureDate: data.ksaDepartureDate || null,
          totalKsaDays,
          calculatedVisaTier,
          lockedVisaRatePerPersonPkr,
          calculatedVisaTotalPkr,
          citySequence: data.citySequence || null,
          entryAirport,
          exitAirport,
          departureCityId: data.departureCityId || null,
          flightRouteType: data.flightRouteType || null,
          cabinClass: data.cabinClass || null,
          preferredAirlineId: data.preferredAirlineId || null,
          ziyaratScope: data.ziyaratScope || null,
          ziyaratVehicleId: data.ziyaratVehicleId || null,
          selectedZiyaratPlaceIds: data.selectedZiyaratPlaceIds || [],
        })
        .returning()

      if (!app) {
        throw new Error("Failed to insert application record.")
      }

      // Insert Hotel Stays if enabled
      if (data.includeHotels && data.hotelStays && data.hotelStays.length > 0) {
        const arrivalDateBase = data.ksaArrivalDate ?? new Date().toISOString().split("T")[0]!
        let runningDate = new Date(arrivalDateBase)

        const staysToInsert = data.hotelStays.map((stay) => {
          const checkIn = new Date(runningDate)
          const checkOut = new Date(runningDate)
          checkOut.setDate(checkOut.getDate() + stay.nights)
          runningDate = checkOut

          return {
            applicationId: app.id,
            stayOrder: stay.stayOrder,
            city: stay.city,
            hotelId: stay.hotelId,
            checkInDate: checkIn.toISOString().split("T")[0]!,
            checkOutDate: checkOut.toISOString().split("T")[0]!,
            nights: stay.nights,
            roomCategory: stay.roomCategory,
            sharedRoomType: stay.sharedRoomType || null,
            privateRoomAllocation: stay.privateRoomAllocation || {
              double: 0,
              triple: 0,
              quad: 0,
            },
            mealPlan: stay.mealPlan,
          }
        })

        await tx.insert(schema.applicationHotelStays).values(staysToInsert)
      }

      // Insert Transport Segments if enabled
      if (
        data.includeTransport &&
        data.transportSegments &&
        data.transportSegments.length > 0
      ) {
        const segmentsToInsert = data.transportSegments.map((segment) => ({
          applicationId: app.id,
          segmentOrder: segment.segmentOrder,
          sectorId: segment.sectorId,
          serviceType: segment.serviceType,
          vehicleId: segment.vehicleId,
          vehicleQuantity: 1,
          scheduledDate: segment.scheduledDate || data.ksaArrivalDate || null,
          pickupTime: segment.pickupTime || null,
        }))

        await tx
          .insert(schema.applicationTransportSegments)
          .values(segmentsToInsert)
      }

      // Create Initial Quote Record
      await tx.insert(schema.applicationQuotes).values({
        applicationId: app.id,
        version: 1,
        visaTotalPkr: calculatedVisaTotalPkr || 0,
        flightsTotalPkr: 0,
        makkahHotelTotalPkr: 0,
        madinahHotelTotalPkr: 0,
        transportTotalPkr: 0,
        ziyaratTotalPkr: 0,
        discountPkr: 0,
        grandTotalPkr: isVisaOnly ? calculatedVisaTotalPkr || 0 : 0,
        paymentStatus: "unpaid",
      })

      return app
    })

    // Fetch agency WhatsApp number for handoff link
    const settings = await db.query.agencySettings.findFirst({
      where: eq(schema.agencySettings.id, "default"),
    })
    const agencyWhatsapp = settings?.primaryWhatsapp ?? "+923008456789"

    const whatsappMessage = `As-salamu alaykum Al Ramlah Travels,\n\nI have submitted a Custom Journey inquiry on your portal.\n*Reference Code:* ${referenceNumber}\n*Lead Pilgrim:* ${data.contact.customerName}\n*City:* ${data.contact.customerCity}\n*Travellers:* ${data.passengers.adults} Adults, ${data.passengers.children} Children, ${data.passengers.infants} Infants\n*Selected Services:* ${[
      data.includeVisa ? "Visa" : null,
      data.includeFlights ? "Flights" : null,
      data.includeHotels ? "Hotels" : null,
      data.includeTransport ? "Transport" : null,
      data.includeZiyarat ? "Ziyarat" : null,
    ]
      .filter(Boolean)
      .join(", ")}\n\nPlease review our itinerary and share the official quotation. JazakAllah Khair!`

    const whatsappUrl = formatWhatsAppUrl(agencyWhatsapp, whatsappMessage)

    return {
      success: true,
      referenceNumber: newApp.referenceNumber,
      applicationId: newApp.id,
      calculatedVisaTotalPkr: calculatedVisaTotalPkr ?? undefined,
      calculatedVisaTier: calculatedVisaTier ?? undefined,
      totalKsaDays: totalKsaDays ?? undefined,
      isVisaOnly,
      whatsappUrl,
    }
  } catch (err: unknown) {
    console.error("submitCustomApplication error:", err)
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to submit application. Please try again.",
    }
  }
}

// ==========================================
// 2. SUBMIT GROUP BOOKING APPLICATION
// ==========================================

export interface GroupBookingResult {
  success: boolean
  referenceNumber?: string
  whatsappUrl?: string
  error?: string
}

export async function submitGroupBookingApplication(
  rawInput: unknown
): Promise<GroupBookingResult> {
  try {
    const parseResult = groupBookingSchema.safeParse(rawInput)
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.issues[0]?.message || "Invalid group booking data.",
      }
    }

    const data: GroupBookingInput = parseResult.data

    const totalPassportCount =
      data.passengers.adults + data.passengers.children + data.passengers.infants
    const bedAndSeatCount = data.passengers.adults + data.passengers.children

    // Check departure availability
    const departure = await db.query.groupDepartures.findFirst({
      where: eq(schema.groupDepartures.id, data.groupDepartureId),
    })

    if (!departure) {
      return { success: false, error: "Selected departure batch not found." }
    }

    const availableSeats = departure.totalSeats - departure.bookedSeats
    if (availableSeats < bedAndSeatCount) {
      return {
        success: false,
        error: `Only ${availableSeats} seat(s) remaining on this batch. You requested ${bedAndSeatCount}.`,
      }
    }

    const pkg = await db.query.groupPackages.findFirst({
      where: eq(schema.groupPackages.id, data.groupPackageId),
    })

    if (!pkg) {
      return { success: false, error: "Selected group package not found." }
    }

    // Rate calculation based on room type
    let ratePerPersonPkr = pkg.quadPricePkr
    if (data.selectedRoomType === "triple") {
      ratePerPersonPkr = pkg.triplePricePkr
    } else if (data.selectedRoomType === "double") {
      ratePerPersonPkr = pkg.doublePricePkr
    }

    const packageTotalPkr = ratePerPersonPkr * bedAndSeatCount
    const referenceNumber = await generateApplicationReference()

    await db.transaction(async (tx) => {
      const [app] = await tx
        .insert(schema.applications)
        .values({
          referenceNumber,
          source: "group_booking",
          status: "pending_quote",
          presetMode: "group_package",
          groupPackageId: pkg.id,
          groupDepartureId: departure.id,
          selectedRoomType: data.selectedRoomType,
          customerName: data.contact.customerName,
          customerPhone: data.contact.customerPhone,
          customerWhatsapp: data.contact.customerWhatsapp,
          customerCity: data.contact.customerCity,
          customerEmail: data.contact.customerEmail || null,
          specialRequests: data.contact.specialRequests || null,
          adults: data.passengers.adults,
          children: data.passengers.children,
          infants: data.passengers.infants,
          totalPassportCount,
          bedAndSeatCount,
          includeVisa: true,
          includeFlights: true,
          includeHotels: true,
          includeTransport: true,
          includeZiyarat: true,
          ksaArrivalDate: departure.departureDate,
          ksaDepartureDate: departure.returnDate,
        })
        .returning()

      if (!app) {
        throw new Error("Failed to insert group application.")
      }

      await tx.insert(schema.applicationQuotes).values({
        applicationId: app.id,
        version: 1,
        grandTotalPkr: packageTotalPkr,
        quoteNotesCustomer: `${pkg.title} (${departure.batchCode}) - ${data.selectedRoomType.toUpperCase()} Room Sharing for ${bedAndSeatCount} passenger(s).`,
        paymentStatus: "unpaid",
      })
    })

    const settings = await db.query.agencySettings.findFirst({
      where: eq(schema.agencySettings.id, "default"),
    })
    const agencyWhatsapp = settings?.primaryWhatsapp ?? "+923008456789"

    const message = `As-salamu alaykum Al Ramlah Travels,\n\nI have requested a seat reservation for Group Package: *${pkg.title}* (${departure.batchCode}).\n*Reference Code:* ${referenceNumber}\n*Passenger:* ${data.contact.customerName} (${bedAndSeatCount} seats, ${data.selectedRoomType.toUpperCase()} Room)\n*Total Estimated:* PKR ${packageTotalPkr.toLocaleString()}\n\nPlease verify seat allotment and share payment instructions.`

    const whatsappUrl = formatWhatsAppUrl(agencyWhatsapp, message)

    return {
      success: true,
      referenceNumber,
      whatsappUrl,
    }
  } catch (err: unknown) {
    console.error("submitGroupBookingApplication error:", err)
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to submit group booking. Please try again.",
    }
  }
}

// ==========================================
// 3. SUBMIT HAJJ INQUIRY APPLICATION
// ==========================================

export interface HajjInquiryResult {
  success: boolean
  referenceNumber?: string
  whatsappUrl?: string
  error?: string
}

export async function submitHajjInquiryApplication(
  rawInput: unknown
): Promise<HajjInquiryResult> {
  try {
    const parseResult = hajjInquirySchema.safeParse(rawInput)
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.issues[0]?.message || "Invalid Hajj consultation data.",
      }
    }

    const data: HajjInquiryInput = parseResult.data
    const totalPassportCount =
      data.passengers.adults + data.passengers.children + data.passengers.infants
    const bedAndSeatCount = data.passengers.adults + data.passengers.children

    const referenceNumber = await generateApplicationReference()

    await db.transaction(async (tx) => {
      const [app] = await tx
        .insert(schema.applications)
        .values({
          referenceNumber,
          source: "hajj_inquiry",
          status: "pending_quote",
          presetMode: "hajj_consultation",
          hajjConsultationType: data.hajjConsultationType,
          customerName: data.contact.customerName,
          customerPhone: data.contact.customerPhone,
          customerWhatsapp: data.contact.customerWhatsapp,
          customerCity: data.contact.customerCity,
          customerEmail: data.contact.customerEmail || null,
          specialRequests: data.notes || null,
          adults: data.passengers.adults,
          children: data.passengers.children,
          infants: data.passengers.infants,
          totalPassportCount,
          bedAndSeatCount,
          includeVisa: true,
          includeFlights: true,
          includeHotels: true,
          includeTransport: true,
          includeZiyarat: true,
        })
        .returning()

      if (!app) {
        throw new Error("Failed to insert Hajj application.")
      }

      await tx.insert(schema.applicationQuotes).values({
        applicationId: app.id,
        version: 1,
        grandTotalPkr: 0,
        quoteNotesCustomer: `Hajj Consultation Request: ${data.hajjConsultationType}`,
        paymentStatus: "unpaid",
      })
    })

    const settings = await db.query.agencySettings.findFirst({
      where: eq(schema.agencySettings.id, "default"),
    })
    const agencyWhatsapp = settings?.primaryWhatsapp ?? "+923008456789"

    const message = `As-salamu alaykum Al Ramlah Travels,\n\nI have requested a Hajj VIP Consultation.\n*Reference Code:* ${referenceNumber}\n*Lead Pilgrim:* ${data.contact.customerName}\n*Consultation Type:* ${data.hajjConsultationType}\n*Family Count:* ${totalPassportCount} Pilgrim(s)\n\nPlease connect me with a senior Hajj advisor.`

    const whatsappUrl = formatWhatsAppUrl(agencyWhatsapp, message)

    return {
      success: true,
      referenceNumber,
      whatsappUrl,
    }
  } catch (err: unknown) {
    console.error("submitHajjInquiryApplication error:", err)
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to submit Hajj inquiry. Please try again.",
    }
  }
}

// ==========================================
// 4. PUBLIC APPLICATION STATUS LOOKUP
// ==========================================

export interface StatusLookupResult {
  success: boolean
  error?: string
  application?: {
    id: string
    referenceNumber: string
    source: string
    status: "pending_quote" | "quoted" | "approved" | "rejected" | "cancelled"
    presetMode: string
    customerName: string
    customerCity: string
    createdAt: string
    ksaArrivalDate?: string | null
    ksaDepartureDate?: string | null
    totalKsaDays?: number | null
    citySequence?: string | null
    adults: number
    children: number
    infants: number
    totalPassportCount: number
    bedAndSeatCount: number
    pillars: {
      visa: boolean
      flights: boolean
      hotels: boolean
      transport: boolean
      ziyarat: boolean
    }
    hotelStays: Array<{
      stayOrder: number
      city: string
      hotelName: string
      starRating: number
      distanceLabel: string
      checkInDate: string
      checkOutDate: string
      nights: number
      roomCategory: string
      sharedRoomType?: string | null
      mealPlan: string
    }>
    transportSegments: Array<{
      segmentOrder: number
      sectorLabel: string
      serviceType: string
      vehicleName: string
      vehicleQuantity: number
      pickupTime?: string | null
    }>
    groupPackageTitle?: string | null
    groupBatchCode?: string | null
  }
  quote?: {
    visaTotalPkr: number
    flightsTotalPkr: number
    makkahHotelTotalPkr: number
    madinahHotelTotalPkr: number
    transportTotalPkr: number
    ziyaratTotalPkr: number
    discountPkr: number
    grandTotalPkr: number
    paymentStatus: string
    amountPaidPkr: number
    quoteNotesCustomer?: string | null
    validUntil?: string | null
    approvedAt?: string | null
  } | null
  agencyWhatsapp?: string
}

export async function lookupApplicationStatus(
  rawInput: unknown
): Promise<StatusLookupResult> {
  try {
    const parseResult = statusLookupSchema.safeParse(rawInput)
    if (!parseResult.success) {
      return {
        success: false,
        error: "Please enter a valid Reference Number (e.g. ART-2026-XXXX) and Phone Number.",
      }
    }

    const { referenceNumber, customerPhone } = parseResult.data
    const normalizedInputDigits = cleanPhoneNumber(customerPhone)
    const inputSuffix = normalizedInputDigits.slice(-9) // Last 9 digits match regional phone formats

    const cleanRef = referenceNumber.trim().toUpperCase()

    // Query application
    const app = await db.query.applications.findFirst({
      where: ilike(schema.applications.referenceNumber, cleanRef),
      with: {
        hotelStays: {
          with: { hotel: true },
          orderBy: (stays, { asc }) => [asc(stays.stayOrder)],
        },
        transportSegments: {
          with: { sector: true, vehicle: true },
          orderBy: (segments, { asc }) => [asc(segments.segmentOrder)],
        },
        groupPackage: true,
        groupDeparture: true,
        quotes: {
          orderBy: (quotes, { desc }) => [desc(quotes.version)],
          limit: 1,
        },
      },
    })

    if (!app) {
      return {
        success: false,
        error: "No application found matching this reference code. Please verify the code.",
      }
    }

    // Verify phone identity
    const storedPhoneDigits = cleanPhoneNumber(app.customerPhone)
    const storedWhatsappDigits = cleanPhoneNumber(app.customerWhatsapp)

    const matchesPhone =
      storedPhoneDigits.endsWith(inputSuffix) ||
      storedWhatsappDigits.endsWith(inputSuffix) ||
      normalizedInputDigits.endsWith(storedPhoneDigits.slice(-9)) ||
      normalizedInputDigits.endsWith(storedWhatsappDigits.slice(-9))

    if (!matchesPhone) {
      return {
        success: false,
        error:
          "The phone number provided does not match the contact number registered with this reference code.",
      }
    }

    const settings = await db.query.agencySettings.findFirst({
      where: eq(schema.agencySettings.id, "default"),
    })
    const agencyWhatsapp = settings?.primaryWhatsapp ?? "+923008456789"

    const latestQuote = app.quotes && app.quotes.length > 0 ? app.quotes[0] : null
    const canExposeQuote =
      app.status === "quoted" ||
      app.status === "approved" ||
      app.presetMode === "visa_only"

    return {
      success: true,
      agencyWhatsapp,
      application: {
        id: app.id,
        referenceNumber: app.referenceNumber,
        source: app.source,
        status: app.status,
        presetMode: app.presetMode,
        customerName: app.customerName,
        customerCity: app.customerCity,
        createdAt: app.createdAt.toISOString(),
        ksaArrivalDate: app.ksaArrivalDate,
        ksaDepartureDate: app.ksaDepartureDate,
        totalKsaDays: app.totalKsaDays,
        citySequence: app.citySequence,
        adults: app.adults,
        children: app.children,
        infants: app.infants,
        totalPassportCount: app.totalPassportCount,
        bedAndSeatCount: app.bedAndSeatCount,
        pillars: {
          visa: app.includeVisa,
          flights: app.includeFlights,
          hotels: app.includeHotels,
          transport: app.includeTransport,
          ziyarat: app.includeZiyarat,
        },
        hotelStays: (app.hotelStays || []).map((stay) => ({
          stayOrder: stay.stayOrder,
          city: stay.city,
          hotelName: stay.hotel.name,
          starRating: stay.hotel.starRating,
          distanceLabel: stay.hotel.distanceLabel,
          checkInDate: stay.checkInDate,
          checkOutDate: stay.checkOutDate,
          nights: stay.nights,
          roomCategory: stay.roomCategory,
          sharedRoomType: stay.sharedRoomType,
          mealPlan: stay.mealPlan,
        })),
        transportSegments: (app.transportSegments || []).map((seg) => ({
          segmentOrder: seg.segmentOrder,
          sectorLabel: seg.sector.label,
          serviceType: seg.serviceType,
          vehicleName: seg.vehicle.name,
          vehicleQuantity: seg.vehicleQuantity,
          pickupTime: seg.pickupTime,
        })),
        groupPackageTitle: app.groupPackage?.title || null,
        groupBatchCode: app.groupDeparture?.batchCode || null,
      },
      quote:
        canExposeQuote && latestQuote
          ? {
              visaTotalPkr: latestQuote.visaTotalPkr,
              flightsTotalPkr: latestQuote.flightsTotalPkr,
              makkahHotelTotalPkr: latestQuote.makkahHotelTotalPkr,
              madinahHotelTotalPkr: latestQuote.madinahHotelTotalPkr,
              transportTotalPkr: latestQuote.transportTotalPkr,
              ziyaratTotalPkr: latestQuote.ziyaratTotalPkr,
              discountPkr: latestQuote.discountPkr,
              grandTotalPkr: latestQuote.grandTotalPkr,
              paymentStatus: latestQuote.paymentStatus,
              amountPaidPkr: latestQuote.amountPaidPkr,
              quoteNotesCustomer: latestQuote.quoteNotesCustomer,
              validUntil: latestQuote.validUntil?.toISOString() || null,
              approvedAt: latestQuote.approvedAt?.toISOString() || null,
            }
          : null,
    }
  } catch (err: unknown) {
    console.error("lookupApplicationStatus error:", err)
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while looking up your inquiry.",
    }
  }
}
