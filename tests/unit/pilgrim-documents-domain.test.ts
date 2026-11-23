// covers: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6
import crypto from "node:crypto"
import { GetObjectCommand } from "@aws-sdk/client-s3"
import { NextRequest } from "next/server"
import { afterEach, describe, expect, it } from "vitest"
import robots from "@/app/robots"
import {
  buildPilgrimDocumentStorageKey,
  computePassportValidityCutoffDate,
  decryptDocumentPortalPath,
  DOC_PORTAL_SESSION_MAX_AGE_SECONDS,
  evaluateDocumentPortalUnlockGate,
  evaluatePassportExpiryValidity,
  getDocumentPortalCookieConfig,
  getPilgrimDocumentSlotLabel,
  getTravellerDisplayTitle,
  hashDocumentPortalToken,
  isValidPilgrimDocumentStorageKeyForSlot,
  MAX_PILGRIM_DOCUMENT_BYTES,
  mintDocumentPortalTokenMaterial,
  planTravellerSlotReconciliation,
  PORTAL_TOKEN_PATTERN,
  resolveAnchorReturnDateIso,
  shouldResetPassportExpiryOverride,
  signDocumentPortalSessionCookie,
  verifyDocumentPortalSessionCookie,
  verifyDocumentPortalTokenHashConstantTime,
  verifyPilgrimPortalPhoneConstantTime,
  type ExistingTravellerSlotSnapshot,
} from "@/lib/domain/pilgrim-documents"
import {
  createPilgrimDocumentPresignedPutUrl,
  readR2ObjectHeaderBytes,
  setR2S3ClientOverrideForTests,
  type R2S3ClientLike,
} from "@/lib/storage/r2"
import { sniffAllowedBinaryMagicBytes } from "@/lib/storage/upload-security"
import {
  saveTravellerDetailsSchema,
  updateTravellerCountsSchema,
  validatePilgrimDocumentMimeAndSize,
} from "@/lib/validations/pilgrim-documents"
import { proxy } from "@/proxy"

const processEnv = process.env as Record<string, string | undefined>

describe("Pilgrim Documents Domain & Security Primitives (Spec 0029)", () => {
  const originalNodeEnv = processEnv.NODE_ENV
  const originalAuditE2e = processEnv.AUDIT_E2E_LOCAL
  const originalVercelEnv = processEnv.VERCEL_ENV
  const originalR2AccountId = processEnv.R2_ACCOUNT_ID
  const originalR2AccessKeyId = processEnv.R2_ACCESS_KEY_ID
  const originalR2SecretAccessKey = processEnv.R2_SECRET_ACCESS_KEY
  const originalR2BucketName = processEnv.R2_BUCKET_NAME
  const originalR2PublicUrl = processEnv.R2_PUBLIC_URL

  afterEach(() => {
    setR2S3ClientOverrideForTests(null)

    const restoreEnv = (key: string, original: string | undefined) => {
      if (original === undefined) {
        delete processEnv[key]
      } else {
        processEnv[key] = original
      }
    }

    restoreEnv("NODE_ENV", originalNodeEnv)
    restoreEnv("AUDIT_E2E_LOCAL", originalAuditE2e)
    restoreEnv("VERCEL_ENV", originalVercelEnv)
    restoreEnv("R2_ACCOUNT_ID", originalR2AccountId)
    restoreEnv("R2_ACCESS_KEY_ID", originalR2AccessKeyId)
    restoreEnv("R2_SECRET_ACCESS_KEY", originalR2SecretAccessKey)
    restoreEnv("R2_BUCKET_NAME", originalR2BucketName)
    restoreEnv("R2_PUBLIC_URL", originalR2PublicUrl)
  })

  describe("evaluateDocumentPortalUnlockGate (AC-1)", () => {
    it("locks hajj_inquiry dossiers with 403 even if status is approved and paid", () => {
      const res = evaluateDocumentPortalUnlockGate({
        status: "approved",
        source: "hajj_inquiry",
        latestQuotePaymentStatus: "paid_in_full",
        verifiedPaidSumPkr: 500_000,
      })
      expect(res).toEqual({
        unlocked: false,
        httpStatus: 403,
        reason: "hajj_inquiry",
      })
    })

    it("locks cancelled and rejected bookings immediately with 403 closed", () => {
      for (const status of ["cancelled", "rejected"] as const) {
        expect(
          evaluateDocumentPortalUnlockGate({
            status,
            source: "custom_builder",
            latestQuotePaymentStatus: "deposit_paid",
            verifiedPaidSumPkr: 100_000,
          })
        ).toEqual({
          unlocked: false,
          httpStatus: 403,
          reason: "closed",
        })
      }
    })

    it("locks pending_quote, quoted, and revision_requested bookings with 403 unapproved", () => {
      for (const status of [
        "pending_quote",
        "quoted",
        "revision_requested",
        null,
        undefined,
      ]) {
        expect(
          evaluateDocumentPortalUnlockGate({
            status,
            source: "group_booking",
            latestQuotePaymentStatus: "deposit_paid",
            verifiedPaidSumPkr: 150_000,
          })
        ).toEqual({
          unlocked: false,
          httpStatus: 403,
          reason: "unapproved",
        })
      }
    })

    it("locks approved bookings with 403 awaiting_deposit when payment status or verified paid sum is insufficient", () => {
      const unpaidCases: Array<{
        latestQuotePaymentStatus: string | null | undefined
        verifiedPaidSumPkr: number
      }> = [
        { latestQuotePaymentStatus: "unpaid", verifiedPaidSumPkr: 0 },
        { latestQuotePaymentStatus: "unpaid", verifiedPaidSumPkr: 50_000 },
        { latestQuotePaymentStatus: "partially_paid", verifiedPaidSumPkr: 25_000 },
        { latestQuotePaymentStatus: null, verifiedPaidSumPkr: 50_000 },
        { latestQuotePaymentStatus: "deposit_paid", verifiedPaidSumPkr: 0 },
        { latestQuotePaymentStatus: "paid_in_full", verifiedPaidSumPkr: -100 },
        { latestQuotePaymentStatus: "deposit_paid", verifiedPaidSumPkr: Number.NaN },
      ]

      for (const c of unpaidCases) {
        expect(
          evaluateDocumentPortalUnlockGate({
            status: "approved",
            source: "custom_builder",
            latestQuotePaymentStatus: c.latestQuotePaymentStatus,
            verifiedPaidSumPkr: c.verifiedPaidSumPkr,
          })
        ).toEqual({
          unlocked: false,
          httpStatus: 403,
          reason: "awaiting_deposit",
        })
      }
    })

    it("unlocks approved custom_builder and group_booking dossiers once deposit_paid or paid_in_full has positive verified PKR", () => {
      for (const paymentStatus of ["deposit_paid", "paid_in_full"] as const) {
        expect(
          evaluateDocumentPortalUnlockGate({
            status: "approved",
            source: "custom_builder",
            latestQuotePaymentStatus: paymentStatus,
            verifiedPaidSumPkr: 1,
          })
        ).toEqual({ unlocked: true })
      }
    })
  })

  describe("Capability token minting, constant-time hashing, and v2 vault round-trip (AC-1)", () => {
    it("mints a 256-bit base64url token, hashes deterministically, and round-trips through v2 vault", () => {
      const material = mintDocumentPortalTokenMaterial()
      expect(material.rawToken).toMatch(PORTAL_TOKEN_PATTERN)
      expect(material.tokenHash).toMatch(/^[0-9a-f]{64}$/)
      expect(material.tokenHash).toBe(hashDocumentPortalToken(material.rawToken))
      expect(material.tokenEncrypted.startsWith("v2:")).toBe(true)

      expect(
        verifyDocumentPortalTokenHashConstantTime(
          material.rawToken,
          material.tokenHash
        )
      ).toBe(true)
      expect(
        verifyDocumentPortalTokenHashConstantTime(
          `  ${material.rawToken}  `,
          material.tokenHash.toUpperCase()
        )
      ).toBe(true)

      expect(decryptDocumentPortalPath(material.tokenEncrypted)).toBe(
        `/documents/${material.rawToken}`
      )
    })

    it("rejects mismatched, malformed, or null tokens and hashes in constant time", () => {
      const material = mintDocumentPortalTokenMaterial()
      const other = mintDocumentPortalTokenMaterial()

      expect(
        verifyDocumentPortalTokenHashConstantTime(other.rawToken, material.tokenHash)
      ).toBe(false)
      expect(
        verifyDocumentPortalTokenHashConstantTime("short", material.tokenHash)
      ).toBe(false)
      expect(
        verifyDocumentPortalTokenHashConstantTime(material.rawToken, "not-hex")
      ).toBe(false)
      expect(verifyDocumentPortalTokenHashConstantTime(null, null)).toBe(false)
      expect(decryptDocumentPortalPath(null)).toBeNull()
      expect(decryptDocumentPortalPath("   ")).toBeNull()
    })

    it("throws an authentication error when v2 vault ciphertext is tampered", () => {
      const material = mintDocumentPortalTokenMaterial()
      const segments = material.tokenEncrypted.split(":")
      expect(segments.length).toBeGreaterThanOrEqual(4)
      const lastSeg = segments[segments.length - 1]!
      const flippedChar = lastSeg[0]?.toLowerCase() === "a" ? "b" : "a"
      segments[segments.length - 1] = `${flippedChar}${lastSeg.slice(1)}`
      const tampered = segments.join(":")

      expect(() => decryptDocumentPortalPath(tampered)).toThrow()
    })
  })

  describe("Phone session cookie signing, verification, and cookie config (AC-2)", () => {
    it("accepts a valid 24h signed cookie and rejects expired, tampered, cross-app, or rotated cookies", () => {
      const appId = crypto.randomUUID()
      const tokenHash = hashDocumentPortalToken(
        mintDocumentPortalTokenMaterial().rawToken
      )
      const baseNowMs = Date.UTC(2026, 10, 20, 10, 0, 0)

      const cookieValue = signDocumentPortalSessionCookie({
        applicationId: appId,
        tokenHash,
        nowMs: baseNowMs,
      })

      // Valid right away and 1 second before 24h expiry
      expect(
        verifyDocumentPortalSessionCookie(cookieValue, {
          applicationId: appId,
          tokenHash,
          nowMs: baseNowMs,
        })
      ).toBe(true)
      expect(
        verifyDocumentPortalSessionCookie(cookieValue, {
          applicationId: appId,
          tokenHash,
          nowMs:
            baseNowMs + (DOC_PORTAL_SESSION_MAX_AGE_SECONDS - 1) * 1000,
        })
      ).toBe(true)

      // Expired at exact 24h boundary and beyond
      expect(
        verifyDocumentPortalSessionCookie(cookieValue, {
          applicationId: appId,
          tokenHash,
          nowMs: baseNowMs + DOC_PORTAL_SESSION_MAX_AGE_SECONDS * 1000,
        })
      ).toBe(false)

      // Tampered HMAC signature
      const [payloadB64, sigHex] = cookieValue.split(".")
      const tamperedSigHex = `${sigHex!.startsWith("0") ? "1" : "0"}${sigHex!.slice(1)}`
      expect(
        verifyDocumentPortalSessionCookie(`${payloadB64}.${tamperedSigHex}`, {
          applicationId: appId,
          tokenHash,
          nowMs: baseNowMs,
        })
      ).toBe(false)

      // Tampered payload
      const tamperedPayload = Buffer.from(
        JSON.stringify({ appId, th: tokenHash, exp: 9_999_999_999 }),
        "utf8"
      ).toString("base64url")
      expect(
        verifyDocumentPortalSessionCookie(`${tamperedPayload}.${sigHex}`, {
          applicationId: appId,
          tokenHash,
          nowMs: baseNowMs,
        })
      ).toBe(false)

      // Mismatched applicationId
      expect(
        verifyDocumentPortalSessionCookie(cookieValue, {
          applicationId: crypto.randomUUID(),
          tokenHash,
          nowMs: baseNowMs,
        })
      ).toBe(false)

      // Immediate invalidation after tokenHash rotation
      const rotatedHash = hashDocumentPortalToken(
        mintDocumentPortalTokenMaterial().rawToken
      )
      expect(
        verifyDocumentPortalSessionCookie(cookieValue, {
          applicationId: appId,
          tokenHash: rotatedHash,
          nowMs: baseNowMs,
        })
      ).toBe(false)

      // Malformed / missing cookies
      expect(
        verifyDocumentPortalSessionCookie("", { applicationId: appId, tokenHash })
      ).toBe(false)
      expect(
        verifyDocumentPortalSessionCookie("malformed-no-dot", {
          applicationId: appId,
          tokenHash,
        })
      ).toBe(false)
    })

    it("switches cookie name and secure flag between strict production and AUDIT_E2E_LOCAL=1", () => {
      processEnv.NODE_ENV = "production"
      delete processEnv.AUDIT_E2E_LOCAL
      expect(getDocumentPortalCookieConfig()).toEqual({
        name: "__Host-art_doc_sess",
        secure: true,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 86_400,
      })

      processEnv.NODE_ENV = "production"
      processEnv.AUDIT_E2E_LOCAL = "1"
      expect(getDocumentPortalCookieConfig()).toEqual({
        name: "art_doc_sess",
        secure: false,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 86_400,
      })

      processEnv.NODE_ENV = "test"
      delete processEnv.AUDIT_E2E_LOCAL
      expect(getDocumentPortalCookieConfig()).toEqual({
        name: "art_doc_sess",
        secure: false,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 86_400,
      })
    })
  })

  describe("verifyPilgrimPortalPhoneConstantTime (AC-2)", () => {
    it("matches normalized local Pakistani 03XX and +92 formats across phone and WhatsApp", () => {
      expect(
        verifyPilgrimPortalPhoneConstantTime(
          "0300-1234567",
          "+92 300 1234567",
          "+923219998877"
        )
      ).toBe(true)
      expect(
        verifyPilgrimPortalPhoneConstantTime(
          "+92 321 9998877",
          "+923001234567",
          "0321-9998877"
        )
      ).toBe(true)
      expect(
        verifyPilgrimPortalPhoneConstantTime(
          "+44 7911 123456",
          "+447911123456",
          null
        )
      ).toBe(true)
    })

    it("rejects phones with fewer than 9 national digits, repeated digits, or mismatched numbers", () => {
      expect(
        verifyPilgrimPortalPhoneConstantTime(
          "12345678",
          "+923001234567",
          "+923001234567"
        )
      ).toBe(false)
      expect(
        verifyPilgrimPortalPhoneConstantTime(
          "0300-12345",
          "+923001234567",
          null
        )
      ).toBe(false)
      expect(
        verifyPilgrimPortalPhoneConstantTime(
          "0000000000",
          "0000000000",
          null
        )
      ).toBe(false)
      expect(
        verifyPilgrimPortalPhoneConstantTime(
          "0300-9999999",
          "+923001234567",
          "+923217654321"
        )
      ).toBe(false)
    })
  })

  describe("Saudi 6-month passport expiry anchor & override rules (AC-4)", () => {
    it("resolves anchor return date in priority order: ksaDepartureDate -> groupReturnDate -> ksaArrivalDate+(days-1) -> null", () => {
      expect(
        resolveAnchorReturnDateIso({
          ksaDepartureDate: "2027-01-25",
          groupReturnDate: "2027-01-30",
          ksaArrivalDate: "2027-01-10",
          totalKsaDays: 10,
        })
      ).toBe("2027-01-25")

      expect(
        resolveAnchorReturnDateIso({
          ksaDepartureDate: null,
          groupReturnDate: "2027-02-14",
          ksaArrivalDate: "2027-02-01",
          totalKsaDays: 10,
        })
      ).toBe("2027-02-14")

      expect(
        resolveAnchorReturnDateIso({
          ksaDepartureDate: null,
          groupReturnDate: null,
          ksaArrivalDate: "2027-03-01",
          totalKsaDays: 15,
        })
      ).toBe("2027-03-15")

      expect(
        resolveAnchorReturnDateIso({
          ksaDepartureDate: null,
          groupReturnDate: null,
          ksaArrivalDate: null,
          totalKsaDays: 15,
        })
      ).toBeNull()
    })

    it("adds 6 UTC calendar months with non-leap and leap-year month-end clamping", () => {
      expect(computePassportValidityCutoffDate("2026-08-31")).toBe("2027-02-28")
      expect(computePassportValidityCutoffDate("2027-08-31")).toBe("2028-02-29")
      expect(computePassportValidityCutoffDate("2026-10-31")).toBe("2027-04-30")
      expect(computePassportValidityCutoffDate("2027-01-15")).toBe("2027-07-15")
      expect(computePassportValidityCutoffDate(null)).toBeNull()
    })

    it("blocks expiry dates earlier than 6 months post-return unless staff override is active, and handles missing travel dates", () => {
      const rejected = evaluatePassportExpiryValidity({
        passportExpiryDate: "2027-02-27",
        anchorReturnDateIso: "2026-08-31",
        expiryOverrideByStaff: false,
      })
      expect(rejected).toMatchObject({
        valid: false,
        minimumRequiredExpiryDate: "2027-02-28",
        code: "PASSPORT_EXPIRY_TOO_SOON",
      })

      expect(
        evaluatePassportExpiryValidity({
          passportExpiryDate: "2027-02-28",
          anchorReturnDateIso: "2026-08-31",
          expiryOverrideByStaff: false,
        })
      ).toEqual({
        valid: true,
        minimumRequiredExpiryDate: "2027-02-28",
        overridden: false,
        advisoryNoTravelDates: false,
      })

      expect(
        evaluatePassportExpiryValidity({
          passportExpiryDate: "2026-11-01",
          anchorReturnDateIso: "2026-08-31",
          expiryOverrideByStaff: true,
        })
      ).toEqual({
        valid: true,
        minimumRequiredExpiryDate: "2027-02-28",
        overridden: true,
        advisoryNoTravelDates: false,
      })

      expect(
        evaluatePassportExpiryValidity({
          passportExpiryDate: "2026-11-01",
          anchorReturnDateIso: null,
          expiryOverrideByStaff: false,
        })
      ).toEqual({
        valid: true,
        minimumRequiredExpiryDate: null,
        overridden: false,
        advisoryNoTravelDates: true,
      })
    })

    it("resets staff override only when pilgrim moves passportExpiryDate earlier than previously saved", () => {
      expect(
        shouldResetPassportExpiryOverride("2027-04-01", "2027-03-31")
      ).toBe(true)
      expect(
        shouldResetPassportExpiryOverride("2027-04-01", "2027-04-01")
      ).toBe(false)
      expect(
        shouldResetPassportExpiryOverride("2027-04-01", "2028-01-01")
      ).toBe(false)
      expect(shouldResetPassportExpiryOverride(null, "2027-01-01")).toBe(false)
    })

    it("normalizes passport numbers and blank national IDs via saveTravellerDetailsSchema", () => {
      const parsed = saveTravellerDetailsSchema.parse({
        token: mintDocumentPortalTokenMaterial().rawToken,
        travellerId: crypto.randomUUID(),
        fullName: "  Amina Bibi  ",
        passportNumber: " pk-12 34ab ",
        passportExpiryDate: "2029-05-01",
        nationalIdNumber: "   ",
      })
      expect(parsed.fullName).toBe("Amina Bibi")
      expect(parsed.passportNumber).toBe("PK1234AB")
      expect(parsed.nationalIdNumber).toBeNull()
    })
  })

  describe("Traveller slot reconciliation & role-aware labels (AC-3)", () => {
    it("provisions ordered Adult -> Child -> Infant slots and appends non-destructively when counts increase", () => {
      const initialPlan = planTravellerSlotReconciliation([], {
        adults: 2,
        children: 1,
        infants: 1,
      })
      expect(initialPlan.totalTargetSlots).toBe(4)
      expect(initialPlan.slotsToInsert).toHaveLength(4)
      expect(initialPlan.slotsToInsert.map((s) => `${s.slotIndex}:${s.category}:${s.categoryOrdinal}`)).toEqual([
        "1:adult:1",
        "2:adult:2",
        "3:child:1",
        "4:infant:1",
      ])
      expect(initialPlan.slotsToInsert[0]?.docTypesToInsert).toEqual([
        "passport_bio_page",
        "national_id",
        "visa_photo",
      ])

      const existing: ExistingTravellerSlotSnapshot[] = [
        {
          id: "t-a1",
          slotIndex: 1,
          category: "adult",
          categoryOrdinal: 1,
          fullName: "Tariq Mahmood",
          passportNumber: "AA123456",
          documents: [
            { id: "d1", docType: "passport_bio_page", status: "approved", storageKey: "passports/a/t-a1/passport_bio_page-1.pdf" },
            { id: "d2", docType: "national_id", status: "uploaded", storageKey: "passports/a/t-a1/national_id-1.jpg" },
            { id: "d3", docType: "visa_photo", status: "missing", storageKey: null },
          ],
        },
        {
          id: "t-c1",
          slotIndex: 2,
          category: "child",
          categoryOrdinal: 1,
          fullName: "Bilal Tariq",
          passportNumber: null,
          documents: [
            { id: "d4", docType: "passport_bio_page", status: "missing", storageKey: null },
            { id: "d5", docType: "national_id", status: "missing", storageKey: null },
            { id: "d6", docType: "visa_photo", status: "missing", storageKey: null },
          ],
        },
      ]

      const growPlan = planTravellerSlotReconciliation(existing, {
        adults: 2,
        children: 1,
        infants: 1,
      })
      expect(growPlan.hasDestructiveRemovals).toBe(false)
      expect(growPlan.slotsToDelete).toEqual([])
      expect(growPlan.slotsToInsert.map((s) => `${s.slotIndex}:${s.category}:${s.categoryOrdinal}`)).toEqual([
        "2:adult:2",
        "4:infant:1",
      ])
      expect(growPlan.slotsToUpdate).toEqual([
        {
          travellerId: "t-c1",
          category: "child",
          categoryOrdinal: 1,
          fromSlotIndex: 2,
          toSlotIndex: 3,
        },
      ])
    })

    it("distinguishes empty slot removal from populated destructive slot reduction", () => {
      const emptyExtra: ExistingTravellerSlotSnapshot[] = [
        {
          id: "t-a1",
          slotIndex: 1,
          category: "adult",
          categoryOrdinal: 1,
          fullName: "Adult One",
          passportNumber: "AA111111",
          documents: [],
        },
        {
          id: "t-c1",
          slotIndex: 2,
          category: "child",
          categoryOrdinal: 1,
          fullName: null,
          passportNumber: null,
          documents: [
            { id: "d1", docType: "passport_bio_page", status: "missing", storageKey: null },
          ],
        },
      ]
      const safeShrink = planTravellerSlotReconciliation(emptyExtra, {
        adults: 1,
        children: 0,
        infants: 0,
      })
      expect(safeShrink.slotsToDelete).toHaveLength(1)
      expect(safeShrink.hasDestructiveRemovals).toBe(false)
      expect(safeShrink.storageKeysToDelete).toEqual([])

      const populatedExtra: ExistingTravellerSlotSnapshot[] = [
        emptyExtra[0]!,
        {
          id: "t-c1",
          slotIndex: 2,
          category: "child",
          categoryOrdinal: 1,
          fullName: null,
          passportNumber: null,
          documents: [
            {
              id: "d1",
              docType: "passport_bio_page",
              status: "uploaded",
              storageKey: "passports/app1/t-c1/passport_bio_page-12345678.jpg",
            },
          ],
        },
      ]
      const destructiveShrink = planTravellerSlotReconciliation(populatedExtra, {
        adults: 1,
        children: 0,
        infants: 0,
      })
      expect(destructiveShrink.hasDestructiveRemovals).toBe(true)
      expect(destructiveShrink.storageKeysToDelete).toEqual([
        "passports/app1/t-c1/passport_bio_page-12345678.jpg",
      ])
    })

    it("returns role-aware CNIC vs NADRA B-Form labels, traveller titles, and rejects infants > adults", () => {
      expect(getPilgrimDocumentSlotLabel("national_id", "adult")).toBe(
        "CNIC (Front & Back or Smart Card)"
      )
      expect(getPilgrimDocumentSlotLabel("national_id", "child")).toBe(
        "NADRA B-Form / Smart Card"
      )
      expect(getPilgrimDocumentSlotLabel("national_id", "infant")).toBe(
        "NADRA B-Form / Smart Card"
      )
      expect(getTravellerDisplayTitle("infant", 2, "  Zaid  ")).toBe(
        "Infant 2 — Zaid"
      )

      const invalidInfants = updateTravellerCountsSchema.safeParse({
        applicationId: crypto.randomUUID(),
        adults: 1,
        children: 0,
        infants: 2,
      })
      expect(invalidInfants.success).toBe(false)
    })
  })

  describe("Storage keys, MIME/size validation, magic-byte sniffing, and crawl/header guards (AC-2, AC-5)", () => {
    it("validates slot-scoped storage keys and blocks traversal or cross-slot substitution", () => {
      const appId = crypto.randomUUID()
      const travellerId = crypto.randomUUID()
      const validKey = buildPilgrimDocumentStorageKey({
        applicationId: appId,
        travellerId,
        docType: "passport_bio_page",
        extension: "jpeg",
      })
      expect(validKey).toMatch(
        new RegExp(`^passports/${appId}/${travellerId}/passport_bio_page-[A-Za-z0-9_-]+\\.jpg$`)
      )
      expect(
        isValidPilgrimDocumentStorageKeyForSlot(validKey, {
          applicationId: appId,
          travellerId,
          docType: "passport_bio_page",
        })
      ).toBe(true)
      expect(
        isValidPilgrimDocumentStorageKeyForSlot(validKey, {
          applicationId: appId,
          travellerId,
          docType: "national_id",
        })
      ).toBe(false)
      expect(
        isValidPilgrimDocumentStorageKeyForSlot(validKey, {
          applicationId: crypto.randomUUID(),
          travellerId,
          docType: "passport_bio_page",
        })
      ).toBe(false)
      expect(
        isValidPilgrimDocumentStorageKeyForSlot(
          `passports/${appId}/${travellerId}/../passport_bio_page-12345678.jpg`,
          { applicationId: appId, travellerId, docType: "passport_bio_page" }
        )
      ).toBe(false)
      expect(
        isValidPilgrimDocumentStorageKeyForSlot(
          `passports/${appId}/${travellerId}/passport_bio_page-12345678.svg`,
          { applicationId: appId, travellerId, docType: "passport_bio_page" }
        )
      ).toBe(false)
    })

    it("enforces 10 MB ceiling, blocks active-content extensions, rejects PDF on visa_photo, and sniffs binary magic bytes", () => {
      expect(
        validatePilgrimDocumentMimeAndSize({
          docType: "passport_bio_page",
          contentType: "image/jpg",
          filename: "bio.jpg",
          sizeBytes: MAX_PILGRIM_DOCUMENT_BYTES,
        })
      ).toEqual({
        ok: true,
        canonicalMime: "image/jpeg",
        extension: "jpg",
      })

      expect(
        validatePilgrimDocumentMimeAndSize({
          docType: "passport_bio_page",
          contentType: "image/jpeg",
          filename: "bio.jpg",
          sizeBytes: MAX_PILGRIM_DOCUMENT_BYTES + 1,
        })
      ).toMatchObject({ ok: false, code: "FILE_TOO_LARGE" })

      expect(
        validatePilgrimDocumentMimeAndSize({
          docType: "visa_photo",
          contentType: "application/pdf",
          filename: "photo.pdf",
          sizeBytes: 4096,
        })
      ).toMatchObject({ ok: false, code: "VISA_PHOTO_PDF_DISALLOWED" })

      for (const badName of ["xss.svg", "payload.html", "probe.js", "doc.xml"]) {
        expect(
          validatePilgrimDocumentMimeAndSize({
            docType: "national_id",
            contentType: "image/png",
            filename: badName,
            sizeBytes: 2048,
          })
        ).toMatchObject({ ok: false, code: "BLOCKED_EXTENSION" })
      }

      const pngBytes = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
      ])
      expect(sniffAllowedBinaryMagicBytes(pngBytes)).toEqual({
        mimeType: "image/png",
        extension: "png",
      })
      expect(
        sniffAllowedBinaryMagicBytes(Buffer.from("<script>alert(1)</script>"))
      ).toBeNull()
      expect(
        sniffAllowedBinaryMagicBytes(Buffer.from("<svg onload=alert(1)>"))
      ).toBeNull()
    })

    it("disallows /documents/ in robots.ts and enforces noindex + no-referrer headers on /documents/* in proxy.ts", () => {
      delete processEnv.VERCEL_ENV
      const robotsCfg = robots()
      const rules = Array.isArray(robotsCfg.rules)
        ? robotsCfg.rules
        : [robotsCfg.rules]
      expect(rules.length).toBeGreaterThanOrEqual(2)
      const wildcardRule = rules.find((r) => r.userAgent === "*")
      expect(wildcardRule?.disallow).toContain("/documents/")

      const docReq = new NextRequest(
        "http://localhost:3000/documents/validCapabilityToken1234567890123456"
      )
      const docRes = proxy(docReq)
      expect(docRes.headers.get("X-Robots-Tag")).toContain("noindex")
      expect(docRes.headers.get("X-Robots-Tag")).toContain("nofollow")
      expect(docRes.headers.get("Referrer-Policy")).toBe("no-referrer")

      const publicReq = new NextRequest("http://localhost:3000/")
      const publicRes = proxy(publicReq)
      expect(publicRes.headers.get("Referrer-Policy")).toBe(
        "strict-origin-when-cross-origin"
      )
      expect(publicRes.headers.get("X-Robots-Tag")).toBeNull()
    })
  })

  describe("R2 Range header inspection and presigned passport PUT URLs (AC-5)", () => {
    it("sends Range: bytes=0-511, parses ContentRange total size, slices AsyncIterable streams, and handles InvalidRange / NoSuchKey", async () => {
      processEnv.R2_ACCOUNT_ID = "test-account"
      processEnv.R2_ACCESS_KEY_ID = "test-access-key"
      processEnv.R2_SECRET_ACCESS_KEY = "test-secret-key"
      processEnv.R2_BUCKET_NAME = "test-bucket"

      const capturedCommands: Array<{
        Bucket?: string
        Key?: string
        Range?: string
      }> = []
      let destroyCalled = false

      const fakeClient: R2S3ClientLike = {
        async send(command) {
          if (!(command instanceof GetObjectCommand)) {
            throw new Error("Unexpected S3 command")
          }
          capturedCommands.push({
            Bucket: command.input.Bucket,
            Key: command.input.Key,
            Range: command.input.Range,
          })

          const key = command.input.Key ?? ""
          if (key.endsWith("missing.jpg")) {
            const err = new Error("The specified key does not exist.")
            Object.assign(err, {
              name: "NoSuchKey",
              $metadata: { httpStatusCode: 404 },
            })
            throw err
          }

          if (key.endsWith("empty.jpg")) {
            const err = new Error("The requested range is not satisfiable")
            Object.assign(err, {
              name: "InvalidRange",
              $metadata: { httpStatusCode: 416 },
            })
            throw err
          }

          if (key.endsWith("chunked.png")) {
            const streamBody = {
              async *[Symbol.asyncIterator]() {
                yield new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
                yield Buffer.alloc(300, 0xaa)
                yield Buffer.alloc(300, 0xbb)
                yield Buffer.alloc(100, 0xcc)
              },
              destroy() {
                destroyCalled = true
              },
            }
            return {
              Body: streamBody,
              ContentRange: "bytes 0-511/8192",
              ContentLength: 512,
              ContentType: "image/png",
            }
          }

          return {
            Body: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
            ContentRange: "bytes 0-21/4096",
            ContentLength: 22,
            ContentType: "image/jpeg",
          }
        },
      }

      setR2S3ClientOverrideForTests(fakeClient)

      // 1. Default 512B Range header + ContentRange total size parsing
      const jpgHeader = await readR2ObjectHeaderBytes(
        "passports/app-1/trav-1/passport_bio_page-abcd1234.jpg"
      )
      expect(capturedCommands[0]).toEqual({
        Bucket: "test-bucket",
        Key: "passports/app-1/trav-1/passport_bio_page-abcd1234.jpg",
        Range: "bytes=0-511",
      })
      expect(jpgHeader).not.toBeNull()
      expect(jpgHeader?.totalSizeBytes).toBe(4096)
      expect(jpgHeader?.contentType).toBe("image/jpeg")
      expect(jpgHeader?.headerBytes.subarray(0, 4)).toEqual(
        Buffer.from([0xff, 0xd8, 0xff, 0xe0])
      )

      // 2. AsyncIterable stream slicing stops cleanly at maxBytes and invokes destroy()
      const chunkedHeader = await readR2ObjectHeaderBytes(
        "passports/app-1/trav-1/visa_photo-chunked.png",
        512
      )
      expect(capturedCommands[1]?.Range).toBe("bytes=0-511")
      expect(destroyCalled).toBe(true)
      expect(chunkedHeader?.headerBytes.byteLength).toBe(512)
      expect(chunkedHeader?.totalSizeBytes).toBe(8192)
      expect(chunkedHeader?.contentType).toBe("image/png")

      // 3. InvalidRange (416) returns zero-length buffer & totalSizeBytes 0
      const invalidRangeRes = await readR2ObjectHeaderBytes(
        "passports/app-1/trav-1/passport_bio_page-empty.jpg"
      )
      expect(invalidRangeRes).toEqual({
        headerBytes: Buffer.alloc(0),
        totalSizeBytes: 0,
        contentType: null,
      })

      // 4. NoSuchKey (404) returns null
      const missingRes = await readR2ObjectHeaderBytes(
        "passports/app-1/trav-1/passport_bio_page-missing.jpg"
      )
      expect(missingRes).toBeNull()
    })

    it("mints r2_presigned private PutObject URLs with SigV4 content-length binding and signed media proxy path", async () => {
      processEnv.R2_ACCOUNT_ID = "audit-r2-acct"
      processEnv.R2_ACCESS_KEY_ID = "audit-r2-access"
      processEnv.R2_SECRET_ACCESS_KEY = "audit-r2-secret"
      processEnv.R2_BUCKET_NAME = "audit-r2-bucket"
      delete processEnv.R2_PUBLIC_URL

      setR2S3ClientOverrideForTests({
        async send() {
          throw new Error("Presign should sign locally without network send")
        },
      })

      const storageKey =
        "passports/app-1/trav-1/passport_bio_page-presign1234.jpg"
      const res = await createPilgrimDocumentPresignedPutUrl({
        storageKey,
        contentType: "image/jpeg",
        sizeBytes: 2048,
        token: "validCapabilityToken1234567890123456",
        expiresInSeconds: 300,
      })

      expect(res.mode).toBe("r2_presigned")
      expect(res.key).toBe(storageKey)
      expect(res.expiresInSeconds).toBe(300)
      expect(res.publicUrl.startsWith(`/api/media/${storageKey}?`)).toBe(true)
      const parsedPublic = new URL(res.publicUrl, "http://localhost:3000")
      expect(parsedPublic.searchParams.get("exp")).toMatch(/^\d+$/)
      expect(parsedPublic.searchParams.get("sig")).toMatch(/^[0-9a-f]{64}$/i)

      const parsed = new URL(res.uploadUrl)
      expect(parsed.protocol).toBe("https:")
      expect(parsed.hostname).toBe(
        "audit-r2-bucket.audit-r2-acct.r2.cloudflarestorage.com"
      )
      expect(parsed.pathname).toBe(`/${storageKey}`)
      expect(parsed.searchParams.get("X-Amz-Algorithm")).toBe(
        "AWS4-HMAC-SHA256"
      )
      expect(parsed.searchParams.get("X-Amz-Expires")).toBe("300")
      expect(parsed.searchParams.get("X-Amz-Signature")).toMatch(
        /^[0-9a-f]{64}$/i
      )
      const signedHeaders = (
        parsed.searchParams.get("X-Amz-SignedHeaders") ?? ""
      ).split(";")
      expect(signedHeaders).toContain("content-length")
      expect(signedHeaders).toContain("host")
      expect(parsed.searchParams.get("x-id")).toBe("PutObject")
    })
  })
})
