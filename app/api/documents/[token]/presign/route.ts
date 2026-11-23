import { NextResponse, type NextRequest } from "next/server"
import { and, desc, eq, sql } from "drizzle-orm"

import { db } from "@/db"
import * as schema from "@/db/schema"
import {
  buildPilgrimDocumentStorageKey,
  evaluateDocumentPortalUnlockGate,
  getDocumentPortalCookieConfig,
  hashDocumentPortalToken,
  PORTAL_TOKEN_PATTERN,
  verifyDocumentPortalSessionCookie,
  verifyDocumentPortalTokenHashConstantTime,
} from "@/lib/domain/pilgrim-documents"
import { enforceRateLimit, extractClientIp } from "@/lib/rate-limit"
import { createPilgrimDocumentPresignedPutUrl } from "@/lib/storage/r2"
import {
  pilgrimPresignSchema,
  validatePilgrimDocumentMimeAndSize,
} from "@/lib/validations/pilgrim-documents"

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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
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

  const clientIp = extractClientIp(request.headers)
  const tokenHash = hashDocumentPortalToken(rawToken)

  const [ipRl, tokenRl] = await Promise.all([
    enforceRateLimit("doc-portal-presign:ip", clientIp, {
      max: 30,
      windowSec: 900,
    }),
    enforceRateLimit("doc-portal-presign:token", tokenHash, {
      max: 30,
      windowSec: 900,
    }),
  ])

  if (!ipRl.allowed || !tokenRl.allowed) {
    const retryAfterSec = Math.max(
      ipRl.retryAfterSec || 0,
      tokenRl.retryAfterSec || 0,
      1
    )
    return NextResponse.json(
      {
        success: false,
        code: "RATE_LIMITED",
        error: `Too many upload requests. Please wait ${retryAfterSec} seconds and try again.`,
      },
      {
        status: 429,
        headers: {
          ...PRIVATE_DOC_HEADERS,
          "Retry-After": String(retryAfterSec),
        },
      }
    )
  }

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
        error: "Phone verification session required before uploading files.",
      },
      { status: 401, headers: PRIVATE_DOC_HEADERS }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      {
        success: false,
        code: "VALIDATION_ERROR",
        error: "Invalid JSON request body.",
      },
      { status: 400, headers: PRIVATE_DOC_HEADERS }
    )
  }

  const parsed = pilgrimPresignSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        code: "VALIDATION_ERROR",
        error:
          parsed.error.issues[0]?.message ||
          "Invalid upload file metadata.",
      },
      { status: 422, headers: PRIVATE_DOC_HEADERS }
    )
  }

  const { travellerId, docType, filename, contentType, sizeBytes } = parsed.data
  const mimeCheck = validatePilgrimDocumentMimeAndSize({
    docType,
    contentType,
    filename,
    sizeBytes,
  })
  if (!mimeCheck.ok) {
    return NextResponse.json(
      {
        success: false,
        code: mimeCheck.code,
        error: mimeCheck.error,
      },
      { status: 422, headers: PRIVATE_DOC_HEADERS }
    )
  }

  const [traveller] = await db
    .select({
      id: schema.applicationTravellers.id,
      piiPurgedAt: schema.applicationTravellers.piiPurgedAt,
    })
    .from(schema.applicationTravellers)
    .where(
      and(
        eq(schema.applicationTravellers.id, travellerId),
        eq(schema.applicationTravellers.applicationId, app.id)
      )
    )
    .limit(1)

  if (!traveller) {
    return NextResponse.json(
      {
        success: false,
        code: "NOT_FOUND",
        error: "Traveller slot was not found on this booking.",
      },
      { status: 404, headers: PRIVATE_DOC_HEADERS }
    )
  }

  const [existingDoc] = await db
    .select({
      id: schema.applicationDocuments.id,
      status: schema.applicationDocuments.status,
      piiPurgedAt: schema.applicationDocuments.piiPurgedAt,
    })
    .from(schema.applicationDocuments)
    .where(
      and(
        eq(schema.applicationDocuments.applicationId, app.id),
        eq(schema.applicationDocuments.travellerId, travellerId),
        eq(schema.applicationDocuments.docType, docType)
      )
    )
    .limit(1)

  if (
    traveller.piiPurgedAt !== null ||
    (existingDoc &&
      (existingDoc.status === "purged" || existingDoc.piiPurgedAt !== null))
  ) {
    return NextResponse.json(
      {
        success: false,
        code: "SLOT_PURGED_LOCKED",
        error:
          "This document slot has been purged under our 60-day post-return retention policy and can no longer accept uploads.",
      },
      { status: 409, headers: PRIVATE_DOC_HEADERS }
    )
  }

  if (existingDoc && existingDoc.status === "approved") {
    return NextResponse.json(
      {
        success: false,
        code: "SLOT_LOCKED_APPROVED",
        error:
          "This document slot has already been approved by staff and is locked.",
      },
      { status: 409, headers: PRIVATE_DOC_HEADERS }
    )
  }

  try {
    const storageKey = buildPilgrimDocumentStorageKey({
      applicationId: app.id,
      travellerId,
      docType,
      extension: mimeCheck.extension,
    })

    const presigned = await createPilgrimDocumentPresignedPutUrl({
      storageKey,
      contentType: mimeCheck.canonicalMime,
      sizeBytes,
      token: rawToken,
      expiresInSeconds: 300,
    })

    return NextResponse.json(
      {
        success: true,
        uploadUrl: presigned.uploadUrl,
        key: presigned.key,
        mode: presigned.mode,
        expiresInSeconds: presigned.expiresInSeconds,
      },
      { status: 200, headers: PRIVATE_DOC_HEADERS }
    )
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to prepare upload URL."
    return NextResponse.json(
      {
        success: false,
        code: "INTERNAL_ERROR",
        error: message,
      },
      { status: 500, headers: PRIVATE_DOC_HEADERS }
    )
  }
}
