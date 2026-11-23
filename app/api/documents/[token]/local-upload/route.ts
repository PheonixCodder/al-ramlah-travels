import { NextResponse, type NextRequest } from "next/server"
import { and, desc, eq, sql } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import * as schema from "@/db/schema"
import type { PilgrimDocumentType } from "@/db/schema/applications"
import {
  evaluateDocumentPortalUnlockGate,
  getDocumentPortalCookieConfig,
  hashDocumentPortalToken,
  isValidPilgrimDocumentStorageKeyForSlot,
  MAX_PILGRIM_DOCUMENT_BYTES,
  PILGRIM_DOCUMENT_TYPES,
  PORTAL_TOKEN_PATTERN,
  verifyDocumentPortalSessionCookie,
  verifyDocumentPortalTokenHashConstantTime,
} from "@/lib/domain/pilgrim-documents"
import { isAuditLocalE2eMode } from "@/lib/env"
import { writeLocalFallbackObject } from "@/lib/storage/r2"

const PRIVATE_DOC_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
  "X-Content-Type-Options": "nosniff",
}

function readCookieFromRequest(
  req: NextRequest,
  cookieName: string
): string | undefined {
  const fromStore = req.cookies?.get(cookieName)?.value
  if (fromStore) {
    return fromStore
  }
  const rawCookieHeader = req.headers.get("cookie")
  if (!rawCookieHeader) {
    return undefined
  }
  for (const part of rawCookieHeader.split(";")) {
    const eqIdx = part.indexOf("=")
    if (eqIdx <= 0) continue
    const name = part.slice(0, eqIdx).trim()
    if (name === cookieName) {
      try {
        return decodeURIComponent(part.slice(eqIdx + 1).trim())
      } catch {
        return part.slice(eqIdx + 1).trim()
      }
    }
  }
  return undefined
}

function extractSlotPartsFromStorageKey(
  rawKey: string,
  expectedApplicationId: string
): { travellerId: string; docType: PilgrimDocumentType } | null {
  if (!rawKey.startsWith(`passports/${expectedApplicationId}/`)) {
    return null
  }

  const segments = rawKey.split("/")
  if (segments.length !== 4) {
    return null
  }

  const travellerId = segments[2] ?? ""
  const filename = segments[3] ?? ""
  if (!z.string().uuid().safeParse(travellerId).success) {
    return null
  }

  const matchedDocType = PILGRIM_DOCUMENT_TYPES.find((dt) =>
    filename.startsWith(`${dt}-`)
  )
  if (!matchedDocType) {
    return null
  }

  if (
    !isValidPilgrimDocumentStorageKeyForSlot(rawKey, {
      applicationId: expectedApplicationId,
      travellerId,
      docType: matchedDocType,
    })
  ) {
    return null
  }

  return { travellerId, docType: matchedDocType }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production" && !isAuditLocalE2eMode()) {
    return NextResponse.json(
      { success: false, error: "Not Found" },
      { status: 404, headers: PRIVATE_DOC_HEADERS }
    )
  }

  const { token } = await context.params
  const rawToken = typeof token === "string" ? token.trim() : ""

  if (!PORTAL_TOKEN_PATTERN.test(rawToken)) {
    verifyDocumentPortalTokenHashConstantTime(rawToken, null)
    return NextResponse.json(
      {
        success: false,
        code: "NOT_FOUND",
        error: "Document portal link not found.",
      },
      { status: 404, headers: PRIVATE_DOC_HEADERS }
    )
  }

  const tokenHash = hashDocumentPortalToken(rawToken)
  const app = await db.query.applications.findFirst({
    where: eq(schema.applications.documentPortalTokenHash, tokenHash),
    columns: {
      id: true,
      status: true,
      source: true,
      documentPortalTokenHash: true,
    },
  })

  if (
    !app ||
    !verifyDocumentPortalTokenHashConstantTime(
      rawToken,
      app.documentPortalTokenHash
    )
  ) {
    return NextResponse.json(
      {
        success: false,
        code: "NOT_FOUND",
        error: "Document portal link not found.",
      },
      { status: 404, headers: PRIVATE_DOC_HEADERS }
    )
  }

  const [[latestQuote], [paidSumRow]] = await Promise.all([
    db
      .select({
        paymentStatus: sql<string>`${schema.applicationQuotes.paymentStatus}::text`,
      })
      .from(schema.applicationQuotes)
      .where(eq(schema.applicationQuotes.applicationId, app.id))
      .orderBy(desc(schema.applicationQuotes.version))
      .limit(1),
    db
      .select({
        verifiedTotal: sql<number>`COALESCE(SUM(${schema.applicationPayments.amountPkr}), 0)::bigint`,
      })
      .from(schema.applicationPayments)
      .where(
        and(
          eq(schema.applicationPayments.applicationId, app.id),
          sql`${schema.applicationPayments.verifiedAt} IS NOT NULL`
        )
      ),
  ])

  const unlock = evaluateDocumentPortalUnlockGate({
    status: app.status,
    source: app.source,
    latestQuotePaymentStatus: latestQuote?.paymentStatus ?? null,
    verifiedPaidSumPkr: Number(paidSumRow?.verifiedTotal ?? 0),
  })

  if (!unlock.unlocked) {
    return NextResponse.json(
      {
        success: false,
        code: "PORTAL_LOCKED",
        error:
          "Document upload portal is locked until your booking is approved and deposit is verified.",
      },
      { status: 403, headers: PRIVATE_DOC_HEADERS }
    )
  }

  const cookieCfg = getDocumentPortalCookieConfig()
  const sessionCookieVal = readCookieFromRequest(request, cookieCfg.name)
  const hasSession = verifyDocumentPortalSessionCookie(sessionCookieVal, {
    applicationId: app.id,
    tokenHash: app.documentPortalTokenHash!,
  })

  if (!hasSession) {
    return NextResponse.json(
      {
        success: false,
        code: "SESSION_REQUIRED",
        error: "Phone verification session required.",
      },
      { status: 401, headers: PRIVATE_DOC_HEADERS }
    )
  }

  const keyParam = request.nextUrl.searchParams.get("key")?.trim() ?? ""
  const slotParts = extractSlotPartsFromStorageKey(keyParam, app.id)
  if (!slotParts) {
    return NextResponse.json(
      {
        success: false,
        code: "INVALID_STORAGE_KEY_PREFIX",
        error:
          "Upload key must reside under this booking's passports/ slot prefix.",
      },
      { status: 403, headers: PRIVATE_DOC_HEADERS }
    )
  }

  const [traveller] = await db
    .select({ id: schema.applicationTravellers.id })
    .from(schema.applicationTravellers)
    .where(
      and(
        eq(schema.applicationTravellers.id, slotParts.travellerId),
        eq(schema.applicationTravellers.applicationId, app.id)
      )
    )
    .limit(1)

  if (!traveller) {
    return NextResponse.json(
      {
        success: false,
        code: "INVALID_STORAGE_KEY_PREFIX",
        error: "Upload key does not match a valid traveller on this booking.",
      },
      { status: 403, headers: PRIVATE_DOC_HEADERS }
    )
  }

  const declaredLenHeader = request.headers.get("content-length")
  if (declaredLenHeader) {
    const declaredBytes = Number.parseInt(declaredLenHeader, 10)
    if (
      Number.isFinite(declaredBytes) &&
      declaredBytes > MAX_PILGRIM_DOCUMENT_BYTES
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "FILE_TOO_LARGE",
          error: "Document file size cannot exceed 10 MB (10,485,760 bytes).",
        },
        { status: 413, headers: PRIVATE_DOC_HEADERS }
      )
    }
  }

  const arrayBuffer = await request.arrayBuffer()
  if (!arrayBuffer || arrayBuffer.byteLength <= 0) {
    return NextResponse.json(
      {
        success: false,
        code: "INVALID_FILE_SIZE",
        error: "Empty file payload.",
      },
      { status: 400, headers: PRIVATE_DOC_HEADERS }
    )
  }

  if (arrayBuffer.byteLength > MAX_PILGRIM_DOCUMENT_BYTES) {
    return NextResponse.json(
      {
        success: false,
        code: "FILE_TOO_LARGE",
        error: "Document file size cannot exceed 10 MB (10,485,760 bytes).",
      },
      { status: 413, headers: PRIVATE_DOC_HEADERS }
    )
  }

  // Intentionally write raw uploaded bytes without rejecting invalid magic bytes here so
  // `commitPilgrimDocumentUploadAction` enforces the exact same 512B inspection & R2 delete path
  // in local/audit environments as Cloudflare R2 presigned PUTs in production (`AC-5`).
  const stored = await writeLocalFallbackObject(
    keyParam,
    Buffer.from(arrayBuffer),
    request.headers.get("content-type") || "application/octet-stream"
  )

  return NextResponse.json(
    {
      success: true,
      key: stored.key,
      sizeBytes: stored.sizeBytes,
    },
    { status: 200, headers: PRIVATE_DOC_HEADERS }
  )
}
