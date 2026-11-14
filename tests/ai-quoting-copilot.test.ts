import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  applicationQuoteCopilotResultSchema,
  buildDeterministicApplicationQuoteCopilotDraft,
  buildDeterministicWaCopilotDraft,
  calculateQuoteWorksheetHints,
  computeItemizedQuoteHints,
  copilotQuoteWorksheetSchema,
  createQuotingCopilotTools,
  DEFAULT_AGENCY_COMMISSION_PER_PAX_PKR,
  DEFAULT_FLIGHT_RATE_PER_PAX_PKR,
  DEFAULT_SAR_TO_PKR_RATE,
  extractPostCodesFromText,
  generateApplicationQuoteCopilotDraft,
  generateWaConversationCopilotDraft,
  InvalidCopilotTargetError,
  normalizeCopilotQuoteWorksheet,
  waCopilotDraftResultSchema,
  type AvailableGroupBatchItem,
  type MatchedFlyerPackageItem,
} from "../lib/ai/quoting-copilot"
import {
  quotingCopilotPayloadSchema,
  quotingCopilotTask,
} from "../trigger/quoting-copilot.task"
import type {
  RateHintApplicationInput,
  RateHintCatalogInput,
} from "../lib/domain/quote-hints"

// ==========================================
// FIXTURES
// ==========================================

const SAMPLE_CATALOG: RateHintCatalogInput = {
  hotels: [
    {
      id: "hotel-makkah-1",
      name: "Swissotel Al Maqam Makkah",
      city: "makkah",
      sharingPriceSar: 250,
      quadPriceSar: 300,
      triplePriceSar: 380,
      doublePriceSar: 480,
      roomPriceSar: 950,
      breakfastPriceSarPerPax: 45,
      halfBoardPriceSarPerPax: undefined,
      fullBoardPriceSarPerPax: 120,
    } as NonNullable<RateHintCatalogInput["hotels"]>[number],
    {
      id: "hotel-madinah-1",
      name: "Pullman Zamzam Madina",
      city: "madinah",
      sharingPriceSar: 200,
      quadPriceSar: 240,
      triplePriceSar: 310,
      doublePriceSar: 400,
      roomPriceSar: 780,
      breakfastPriceSarPerPax: 40,
      fullBoardPriceSarPerPax: 110,
    },
  ],
  vehicles: [
    {
      id: "veh-gmc-1",
      name: "GMC Yukon XL",
      category: "suv",
      defaultRateSar: 550,
      ziyaratRateSar: 400,
      seatCapacity: 6,
    },
  ],
  transportSectors: [
    {
      id: "sec-jed-mak",
      code: "JED-MAK",
      sharedBusRateSarPerPax: 45,
      isSharedBusEligible: true,
      terminalParkingFeeSar: 50,
    },
    {
      id: "sec-mak-med",
      code: "MAK-MED",
      sharedBusRateSarPerPax: 65,
      isSharedBusEligible: true,
      terminalParkingFeeSar: 0,
    },
  ],
  transportRates: [
    {
      sectorId: "sec-jed-mak",
      vehicleId: "veh-gmc-1",
      rateSar: 500,
      ratePkrOverride: null,
    },
    {
      sectorId: "sec-mak-med",
      vehicleId: "veh-gmc-1",
      rateSar: 850,
      ratePkrOverride: null,
    },
  ],
  visaRates: [
    {
      tier: "short_term",
      priceSar: 550,
      withoutMasarPriceSar: 500,
      withMasar10DaysSar: 540,
      withMasar15DaysSar: 560,
      withMasar21DaysSar: 590,
      withMasar28DaysSar: 620,
      pricePkr: 42000,
    },
    {
      tier: "long_term",
      priceSar: 700,
      withoutMasarPriceSar: 650,
      withMasar10DaysSar: 680,
      withMasar15DaysSar: 700,
      withMasar21DaysSar: 730,
      withMasar28DaysSar: 760,
      pricePkr: 52500,
    },
  ],
}

const SAMPLE_FLYER_PACKAGE: MatchedFlyerPackageItem = {
  id: "pkg-flyer-001",
  postCode: "ART-SV-15D-01",
  cardNumber: "01",
  title: "15 Days Premium Haramain Umrah Saver",
  supplierName: "Zahoor Travels",
  supplierSlug: "zahoor-travels",
  airlineName: "Saudia",
  airlineIataCode: "SV",
  departureCityCode: "LHE",
  durationDays: 15,
  outboundFlightNo: "SV-739",
  outboundDateLabel: "15 Nov 2026",
  outboundRoute: "LHE-JED",
  returnFlightNo: "SV-738",
  returnDateLabel: "29 Nov 2026",
  returnRoute: "MED-LHE",
  departureDate: "2026-11-15",
  returnDate: "2026-11-29",
  makkahHotelName: "Swissotel Al Maqam Makkah",
  makkahDistanceLabel: "0m Clock Tower",
  makkahNights: "08 Nights",
  madinahHotelName: "Pullman Zamzam Madina",
  madinahDistanceLabel: "150m Markaaz",
  madinahNights: "06 Nights",
  mealPlanLabel: "Breakfast Included",
  sharingPricePkr: 268000,
  quadPricePkr: 282000,
  triplePricePkr: 305000,
  doublePricePkr: 345000,
  retailSharingPkr: 268000,
  retailQuadPkr: 282000,
  retailTriplePkr: 305000,
  retailDoublePkr: 345000,
  netSharingPkr: 243000,
  netQuadPkr: 257000,
  netTriplePkr: 280000,
  netDoublePkr: 320000,
  commissionPkr: 25000,
  pdfUrl: "https://cdn.alramlahtravels.com/flyers/art-sv-15d-01.pdf",
  socialPosterUrl: "https://cdn.alramlahtravels.com/flyers/art-sv-15d-01.jpg",
}

const SAMPLE_GROUP_BATCH: AvailableGroupBatchItem = {
  departureId: "dep-batch-001",
  packageId: "gpkg-001",
  batchCode: "BATCH-NOV-15",
  packageTitle: "14 Days Signature Umrah Group",
  packageSlug: "14-days-signature-umrah-group",
  tier: "star_4",
  durationDays: 14,
  makkahNights: 7,
  madinahNights: 7,
  makkahHotelName: "Emaar Grand Makkah",
  madinahHotelName: "Saja Al Madinah",
  airlineName: "Saudia",
  airlineIataCode: "SV",
  departureCityCode: "LHE",
  departureCityName: "Lahore",
  departureDate: "2026-11-20",
  returnDate: "2026-12-03",
  totalSeats: 40,
  bookedSeats: 28,
  availableSeats: 12,
  seatsAvailable: 12,
  status: "filling_fast",
  sharingPricePkr: 258000,
  quadPricePkr: 272000,
  triplePricePkr: 294000,
  doublePricePkr: 330000,
  infantPricePkr: 65000,
}

// ==========================================
// TEST SUITE
// ==========================================

describe("Spec 0015 — Durable AI Quoting Copilot & WhatsApp Concierge Agent", () => {
  describe("AC-1 & AC-2: Schemas, Post Code Extraction, Arithmetic Integrity & Domain Tools", () => {
    it("extracts and normalizes unique ART-... and PKG-... post codes from free-form text", () => {
      const text =
        "Assalamu Alaikum! Please share details for art-sv-15d-01 and PKG-RAM-21D-02. Also confirm ART-SV-15D-01 quad rate."
      const codes = extractPostCodesFromText(text)
      assert.deepEqual(codes, ["ART-SV-15D-01", "PKG-RAM-21D-02"])
      assert.deepEqual(extractPostCodesFromText(null), [])
      assert.deepEqual(extractPostCodesFromText("No package code here"), [])
    })

    it("enforces the Arithmetic Integrity Invariant in normalizeCopilotQuoteWorksheet", () => {
      const normalized = normalizeCopilotQuoteWorksheet({
        visaTotalPkr: 168000,
        flightsTotalPkr: 540000,
        makkahHotelTotalPkr: 360000,
        madinahHotelTotalPkr: 252000,
        transportTotalPkr: 105000,
        ziyaratTotalPkr: 60000,
        discountPkr: 35000,
        // Intentionally wrong grandTotalPkr to verify post-processing normalization
        grandTotalPkr: 9999999,
        supplierNetCostPkr: 0,
        commissionPkr: 100000,
        sarToPkrRate: 75,
        quoteNotesCustomer: "Short",
        internalNotesAdmin: "Short",
        itemizedBullets: [],
      })

      const expectedGrandTotal =
        168000 + 540000 + 360000 + 252000 + 105000 + 60000 - 35000
      assert.equal(normalized.grandTotalPkr, expectedGrandTotal)
      assert.equal(normalized.grandTotalPkr, 1450000)
      assert.equal(
        normalized.supplierNetCostPkr,
        expectedGrandTotal - normalized.commissionPkr
      )
      assert.ok(normalized.quoteNotesCustomer.length >= 10)
      assert.ok(normalized.internalNotesAdmin.length >= 10)
      assert.ok(normalized.itemizedBullets.length >= 1)

      // Must pass strict Zod validation
      const parsed = copilotQuoteWorksheetSchema.parse(normalized)
      assert.equal(parsed.grandTotalPkr, expectedGrandTotal)
    })

    it("clamps grandTotalPkr to 0 when discountPkr exceeds the sum of components", () => {
      const normalized = normalizeCopilotQuoteWorksheet({
        visaTotalPkr: 40000,
        flightsTotalPkr: 0,
        makkahHotelTotalPkr: 0,
        madinahHotelTotalPkr: 0,
        transportTotalPkr: 0,
        ziyaratTotalPkr: 0,
        discountPkr: 100000,
        grandTotalPkr: 50000,
        supplierNetCostPkr: 0,
        commissionPkr: 25000,
        sarToPkrRate: 75,
        quoteNotesCustomer: "Valid customer note with sufficient length",
        internalNotesAdmin: "Valid internal admin note with sufficient length",
        itemizedBullets: ["Visa only package"],
      })

      assert.equal(normalized.grandTotalPkr, 0)
      assert.equal(normalized.supplierNetCostPkr, 0)
    })

    it("validates copilotQuoteWorksheetSchema, waCopilotDraftResultSchema, and applicationQuoteCopilotResultSchema", () => {
      const validWorksheet = normalizeCopilotQuoteWorksheet({
        visaTotalPkr: 84000,
        flightsTotalPkr: 270000,
        makkahHotelTotalPkr: 180000,
        madinahHotelTotalPkr: 120000,
        transportTotalPkr: 45000,
        ziyaratTotalPkr: 30000,
        discountPkr: 9000,
        grandTotalPkr: 0,
        supplierNetCostPkr: 670000,
        commissionPkr: 50000,
        sarToPkrRate: 75,
        quoteNotesCustomer:
          "Includes Saudi e-Visa, return flights, and Haramain hotels.",
        internalNotesAdmin:
          "Calculated at 75 PKR/SAR with 50,000 PKR agency commission.",
        itemizedBullets: ["Total for 2 adults: PKR 720,000"],
      })

      assert.equal(validWorksheet.grandTotalPkr, 720000)

      const validWaResult = waCopilotDraftResultSchema.parse({
        bilingualReplyDraft:
          "Assalamu Alaikum wa Rahmatullahi wa Barakatuh! Al Ramlah Travels mein khush aamdeed.",
        detectedIntentSummary: "2 Adults November Umrah inquiry",
        detectedPostCodes: ["ART-SV-15D-01"],
        recommendedPricingBullets: ["Quad: PKR 282,000 per person"],
        matchedPackageCode: "ART-SV-15D-01",
        suggestedQuoteWorksheet: validWorksheet,
        confidence: "high",
        requiresHumanApproval: true,
      })
      assert.equal(validWaResult.requiresHumanApproval, true)

      const validAppResult = applicationQuoteCopilotResultSchema.parse({
        executiveSummary:
          "Itemized 14-day quotation for 2 adults at 75 PKR/SAR.",
        bilingualCustomerMessageDraft:
          "Assalamu Alaikum! Aap ka 14 days Umrah quotation tayyar hai.",
        recommendedPricingBullets: ["Grand Total: PKR 720,000"],
        suggestedQuoteWorksheet: validWorksheet,
        confidence: "high",
        requiresHumanApproval: true,
      })
      assert.equal(validAppResult.requiresHumanApproval, true)

      // Rejects requiresHumanApproval !== true
      const invalidHitl = waCopilotDraftResultSchema.safeParse({
        ...validWaResult,
        requiresHumanApproval: false,
      })
      assert.equal(invalidHitl.success, false)
    })

    it("computes deterministic SAR and PKR itemized hints via calculateQuoteWorksheetHints and computeItemizedQuoteHints", async () => {
      const appInput: RateHintApplicationInput & { includeFlights?: boolean } =
        {
          includeVisa: true,
          includeFlights: true,
          includeHotels: true,
          includeTransport: true,
          includeZiyarat: true,
          totalKsaDays: 14,
          ksaArrivalDate: "2026-11-10",
          ksaDepartureDate: "2026-11-24",
          totalPassportCount: 4,
          bedAndSeatCount: 4,
          ziyaratScope: "both",
          ziyaratVehicleId: "veh-gmc-1",
          hotelStays: [
            {
              city: "makkah",
              hotelId: "hotel-makkah-1",
              nights: 7,
              roomCategory: "shared",
              sharedRoomType: "quad",
              mealPlan: "breakfast",
              includeBreakfast: true,
            },
            {
              city: "madinah",
              hotelId: "hotel-madinah-1",
              nights: 7,
              roomCategory: "shared",
              sharedRoomType: "quad",
              mealPlan: "room_only",
            },
          ],
          transportSegments: [
            {
              sectorId: "sec-jed-mak",
              vehicleId: "veh-gmc-1",
              serviceType: "private",
              vehicleQuantity: 1,
            },
            {
              sectorId: "sec-mak-med",
              vehicleId: "veh-gmc-1",
              serviceType: "private",
              vehicleQuantity: 1,
            },
          ],
        }

      const breakdown = await computeItemizedQuoteHints({
        applicationInput: appInput,
        catalogInput: SAMPLE_CATALOG,
        sarToPkrRate: 75,
        discountPkr: 20000,
      })

      const ws = breakdown.worksheet
      assert.equal(ws.sarToPkrRate, 75)
      assert.ok(ws.visaTotalPkr > 0, "Expected positive visaTotalPkr")
      assert.equal(
        ws.flightsTotalPkr,
        4 * DEFAULT_FLIGHT_RATE_PER_PAX_PKR,
        "Expected 4 seats * default flight rate"
      )
      assert.ok(
        ws.makkahHotelTotalPkr > 0,
        "Expected positive makkahHotelTotalPkr"
      )
      assert.ok(
        ws.madinahHotelTotalPkr > 0,
        "Expected positive madinahHotelTotalPkr"
      )
      assert.ok(ws.transportTotalPkr > 0, "Expected positive transportTotalPkr")
      assert.ok(ws.ziyaratTotalPkr > 0, "Expected positive ziyaratTotalPkr")
      assert.equal(ws.discountPkr, 20000)
      assert.equal(
        ws.commissionPkr,
        4 * DEFAULT_AGENCY_COMMISSION_PER_PAX_PKR
      )

      const expectedGrandTotal =
        ws.visaTotalPkr +
        ws.flightsTotalPkr +
        ws.makkahHotelTotalPkr +
        ws.madinahHotelTotalPkr +
        ws.transportTotalPkr +
        ws.ziyaratTotalPkr -
        ws.discountPkr

      assert.equal(ws.grandTotalPkr, expectedGrandTotal)
      assert.equal(breakdown.estimatedGrandTotalPkr, expectedGrandTotal)
    })

    it("registers all 3 read-only domain tools in createQuotingCopilotTools and validates InvalidCopilotTargetError", async () => {
      const tools = createQuotingCopilotTools()
      assert.ok(tools.lookupPackageByPostCode)
      assert.ok(tools.computeItemizedQuoteHints)
      assert.ok(tools.findAvailableGroupBatches)

      await assert.rejects(
        () => computeItemizedQuoteHints({}),
        (err: unknown) =>
          err instanceof InvalidCopilotTargetError &&
          err.code === "INVALID_COPILOT_TARGET"
      )

      await assert.rejects(
        () => generateWaConversationCopilotDraft(""),
        (err: unknown) => err instanceof InvalidCopilotTargetError
      )

      await assert.rejects(
        () => generateApplicationQuoteCopilotDraft(""),
        (err: unknown) => err instanceof InvalidCopilotTargetError
      )
    })
  })

  describe("AC-2 & AC-4: Deterministic WhatsApp Concierge Draft Generator (buildDeterministicWaCopilotDraft)", () => {
    it("produces a bilingual English + Roman Urdu hospitality greeting, matches ART-... package details, and enforces requiresHumanApproval: true", () => {
      const draft = buildDeterministicWaCopilotDraft({
        conversationId: "conv-101",
        contactName: "Haji Tariq Mahmood",
        contactPhone: "+923001234567",
        recentMessages: [
          {
            direction: "inbound",
            body: "Assalamu Alaikum, please send quad and double rate for ART-SV-15D-01 for 4 family members.",
          },
        ],
        matchedPackages: [SAMPLE_FLYER_PACKAGE],
        staffPromptHint: "Highlight 0m Clock Tower proximity in Makkah.",
      })

      assert.equal(draft.requiresHumanApproval, true)
      assert.equal(draft.confidence, "high")
      assert.equal(draft.matchedPackageCode, "ART-SV-15D-01")
      assert.deepEqual(draft.detectedPostCodes, ["ART-SV-15D-01"])

      // Bilingual English + Roman Urdu hospitality greeting & closing checks
      assert.match(
        draft.bilingualReplyDraft,
        /Assalamu Alaikum wa Rahmatullahi wa Barakatuh Haji Tariq Mahmood!/
      )
      assert.match(
        draft.bilingualReplyDraft,
        /Al Ramlah Travels mein khush aamdeed/
      )
      assert.match(draft.bilingualReplyDraft, /JazakAllah Khair/)

      // Matched package details & PKR tariffs
      assert.match(draft.bilingualReplyDraft, /ART-SV-15D-01/)
      assert.match(draft.bilingualReplyDraft, /Swissotel Al Maqam Makkah/)
      assert.match(draft.bilingualReplyDraft, /Pullman Zamzam Madina/)
      assert.match(draft.bilingualReplyDraft, /282,000/)
      assert.match(
        draft.bilingualReplyDraft,
        /Highlight 0m Clock Tower proximity in Makkah\./
      )
      assert.ok(draft.recommendedPricingBullets.length >= 3)
    })

    it("falls back to open group departure batch details when no flyer package is matched", () => {
      const draft = buildDeterministicWaCopilotDraft({
        contactName: "Zubair Ahmed",
        recentMessages: [
          {
            direction: "inbound",
            body: "November mein koi group departure available hai Lahore se?",
          },
        ],
        availableBatches: [SAMPLE_GROUP_BATCH],
      })

      assert.equal(draft.requiresHumanApproval, true)
      assert.equal(draft.confidence, "medium")
      assert.equal(draft.matchedBatchCode, "BATCH-NOV-15")
      assert.match(draft.bilingualReplyDraft, /Assalamu Alaikum/)
      assert.match(draft.bilingualReplyDraft, /BATCH-NOV-15/)
      assert.match(draft.bilingualReplyDraft, /12 seats open/)
    })
  })

  describe("AC-2 & AC-5: Deterministic Application Quote Copilot Generator (buildDeterministicApplicationQuoteCopilotDraft)", () => {
    it("produces an itemized SAR/PKR worksheet breakdown, executive summary, bilingual draft, and requiresHumanApproval: true", () => {
      const quoteBreakdown = calculateQuoteWorksheetHints(
        {
          includeVisa: true,
          includeFlights: true,
          includeHotels: true,
          includeTransport: true,
          includeZiyarat: true,
          totalKsaDays: 14,
          totalPassportCount: 2,
          bedAndSeatCount: 2,
          ziyaratScope: "both",
          ziyaratVehicleId: "veh-gmc-1",
          hotelStays: [
            {
              city: "makkah",
              hotelId: "hotel-makkah-1",
              nights: 7,
              roomCategory: "shared",
              sharedRoomType: "double",
              mealPlan: "breakfast",
              includeBreakfast: true,
            },
            {
              city: "madinah",
              hotelId: "hotel-madinah-1",
              nights: 7,
              roomCategory: "shared",
              sharedRoomType: "double",
              mealPlan: "breakfast",
              includeBreakfast: true,
            },
          ],
          transportSegments: [
            {
              sectorId: "sec-jed-mak",
              vehicleId: "veh-gmc-1",
              serviceType: "private",
              vehicleQuantity: 1,
            },
          ],
        },
        SAMPLE_CATALOG,
        {
          sarToPkrRate: DEFAULT_SAR_TO_PKR_RATE,
          discountPkr: 15000,
          referenceNumber: "ART-2026-0042",
          customerName: "Dr. Salman Qureshi",
          airlineName: "Saudia",
        }
      )

      const appDraft = buildDeterministicApplicationQuoteCopilotDraft({
        applicationId: "app-0042",
        referenceNumber: "ART-2026-0042",
        customerName: "Dr. Salman Qureshi",
        customerCity: "Lahore",
        source: "custom_umrah",
        adults: 2,
        children: 0,
        infants: 0,
        totalPassportCount: 2,
        bedAndSeatCount: 2,
        totalKsaDays: 14,
        sourcePostCode: "ART-SV-15D-01",
        quoteBreakdown,
        matchedPackages: [SAMPLE_FLYER_PACKAGE],
        staffPromptHint: "Include VIP Haramain concierge note",
      })

      assert.equal(appDraft.requiresHumanApproval, true)
      assert.equal(appDraft.confidence, "high")
      assert.equal(appDraft.matchedPackageCode, "ART-SV-15D-01")
      assert.match(appDraft.executiveSummary, /Dr\. Salman Qureshi/)
      assert.match(appDraft.executiveSummary, /ART-2026-0042/)
      assert.match(appDraft.executiveSummary, /75 PKR\/SAR/)
      assert.match(
        appDraft.executiveSummary,
        /Include VIP Haramain concierge note/
      )

      assert.match(
        appDraft.bilingualCustomerMessageDraft,
        /Assalamu Alaikum wa Rahmatullahi wa Barakatuh Dr\. Salman Qureshi!/
      )
      assert.match(appDraft.bilingualCustomerMessageDraft, /ART-2026-0042/)

      const ws = appDraft.suggestedQuoteWorksheet
      const expectedTotal = Math.max(
        0,
        ws.visaTotalPkr +
          ws.flightsTotalPkr +
          ws.makkahHotelTotalPkr +
          ws.madinahHotelTotalPkr +
          ws.transportTotalPkr +
          ws.ziyaratTotalPkr -
          ws.discountPkr
      )
      assert.equal(ws.grandTotalPkr, expectedTotal)
      assert.ok(ws.grandTotalPkr > 0)
      assert.ok(appDraft.recommendedPricingBullets.length >= 2)
    })
  })

  describe("AC-3: Trigger.dev Task & quotingCopilotPayloadSchema Validation", () => {
    it("validates wa_conversation and application_quote payloads and rejects missing target IDs", () => {
      const validWa = quotingCopilotPayloadSchema.safeParse({
        mode: "wa_conversation",
        conversationId: "conv-uuid-123",
        staffPromptHint: "Offer quad sharing",
        allowOfflineFallbackOnly: true,
      })
      assert.equal(validWa.success, true)

      const validApp = quotingCopilotPayloadSchema.safeParse({
        mode: "application_quote",
        applicationId: "app-uuid-456",
        allowOfflineFallbackOnly: true,
      })
      assert.equal(validApp.success, true)

      // Missing conversationId in wa_conversation mode must fail
      const missingConv = quotingCopilotPayloadSchema.safeParse({
        mode: "wa_conversation",
      })
      assert.equal(missingConv.success, false)
      if (!missingConv.success) {
        assert.ok(
          missingConv.error.issues.some((i) =>
            i.path.includes("conversationId")
          )
        )
      }

      // Missing applicationId in application_quote mode must fail
      const missingApp = quotingCopilotPayloadSchema.safeParse({
        mode: "application_quote",
        conversationId: "conv-uuid-123",
      })
      assert.equal(missingApp.success, false)
      if (!missingApp.success) {
        assert.ok(
          missingApp.error.issues.some((i) => i.path.includes("applicationId"))
        )
      }

      // Verify Trigger.dev schemaTask id registration
      assert.equal(quotingCopilotTask.id, "quoting-copilot")
    })
  })
})
