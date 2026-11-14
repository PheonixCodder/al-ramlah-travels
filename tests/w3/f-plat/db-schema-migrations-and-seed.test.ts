import assert from "node:assert/strict"
import crypto from "node:crypto"
import { after, describe, it } from "node:test"
import { eq, getTableName, is, sql } from "drizzle-orm"
import { PgTable } from "drizzle-orm/pg-core"
import { closeDatabasePool, db, withTransaction } from "../../../db"
import * as schema from "../../../db/schema"
import {
  normalizeWhatsappMessageType,
  scrubWhatsappRawPayload,
} from "../../../db/schema/whatsapp-crm"
import {
  parseMultiHotelOptionsJsonb,
  parsePrivateRoomAllocationJsonb,
} from "../../../db/schema/jsonb-parsers"
import { recordAuditLog } from "../../../lib/audit-log"
import { createLogger } from "../../../lib/logger"
import {
  enforceRateLimit,
  extractClientIp,
  hashIp,
} from "../../../lib/rate-limit"
import { runSeed } from "../../../db/seed"
import {
  assertSafeScriptTarget,
  UnsafeScriptTargetError,
} from "../../../scripts/_guard"

async function expectPgError(
  fn: () => Promise<unknown>,
  pattern: RegExp
): Promise<void> {
  await assert.rejects(fn, (err: unknown) => {
    const topMsg = err instanceof Error ? err.message : String(err)
    const cause =
      err && typeof err === "object" && "cause" in err
        ? (err as { cause?: unknown }).cause
        : undefined
    const causeMsg =
      cause instanceof Error ? cause.message : cause ? String(cause) : ""
    const combined = `${topMsg}\n${causeMsg}`
    assert.match(combined, pattern)
    return true
  })
}

describe("F-PLAT: Transactional DB, Schema Constraints, Audit/RateLimit & Seed Idempotency (T-005..T-007, T-009, T-041, T-042, T-079, T-080, T-094)", () => {
  after(async () => {
    await closeDatabasePool()
  })

  it("T-006 & T-079: verifies all 48 Drizzle tables exist in Postgres with zero duplicate single-column indexes", async () => {
    const schemaTableNames = new Set<string>()
    for (const val of Object.values(schema)) {
      if (val && is(val, PgTable)) {
        schemaTableNames.add(getTableName(val))
      }
    }
    assert.ok(
      schemaTableNames.size >= 48,
      `Expected >=48 Drizzle tables, found ${schemaTableNames.size}`
    )

    const dbTablesRes = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `)
    const dbTableSet = new Set(
      (dbTablesRes.rows as Array<{ table_name: string }>).map(
        (r) => r.table_name
      )
    )

    for (const expectedTable of schemaTableNames) {
      assert.ok(
        dbTableSet.has(expectedTable),
        `Table "${expectedTable}" missing from migrated PostgreSQL schema`
      )
    }

    // Check for duplicate single-column non-partial indexes on the same (table, column)
    const dupIdxRes = await db.execute(sql`
      SELECT
        t.relname AS table_name,
        a.attname AS column_name,
        array_agg(i.relname ORDER BY i.relname) AS index_names,
        count(*)::int AS idx_count
      FROM pg_index ix
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ix.indkey[0]
      WHERE n.nspname = 'public'
        AND ix.indnatts = 1
        AND ix.indpred IS NULL
      GROUP BY t.relname, a.attname
      HAVING count(*) > 1
    `)
    assert.equal(
      dupIdxRes.rows.length,
      0,
      `Found duplicate single-column indexes: ${JSON.stringify(dupIdxRes.rows)}`
    )
  })

  it("T-005: enforces atomic multi-statement rollback and SELECT ... FOR UPDATE inside withTransaction()", async () => {
    const refNumber = `ART-TX-${crypto.randomBytes(4).toString("hex").toUpperCase()}`

    await assert.rejects(
      async () => {
        await withTransaction(async (tx) => {
          const [created] = await tx
            .insert(schema.applications)
            .values({
              referenceNumber: refNumber,
              source: "custom_builder",
              presetMode: "visa_only",
              customerName: "Rollback Pilgrim",
              customerPhone: "+923001112233",
              customerWhatsapp: "+923001112233",
              customerCity: "Lahore",
              adults: 2,
              children: 0,
              infants: 0,
              totalPassportCount: 2,
              bedAndSeatCount: 2,
              includeVisa: true,
              includeFlights: false,
              includeHotels: false,
              includeTransport: false,
              includeZiyarat: false,
              ksaArrivalDate: "2026-12-01",
              ksaDepartureDate: "2026-12-15",
            })
            .returning({ id: schema.applications.id })

          // Acquire row-level FOR UPDATE lock inside the transaction
          const locked = await tx.execute(
            sql`SELECT id FROM applications WHERE id = ${created!.id} FOR UPDATE`
          )
          assert.equal(locked.rows.length, 1)

          throw new Error("Simulated mid-transaction failure")
        })
      },
      /Simulated mid-transaction failure/
    )

    const persisted = await db.query.applications.findFirst({
      where: eq(schema.applications.referenceNumber, refNumber),
    })
    assert.equal(
      persisted,
      undefined,
      "Transaction failure must roll back inserted application row completely"
    )
  })

  it("T-007, T-080 & T-094: runs runSeed() twice idempotently, preserves 90-day long_term PKR 68,000 visa rate, preserves deactivated staff, and guards scripts against .neon.tech", async () => {
    await runSeed({ closePool: false })

    // Deactivate staff account before second seed run to prove seed never re-activates revoked staff
    await db
      .update(schema.user)
      .set({ isActive: false })
      .where(eq(schema.user.email, "staff@alramlahtravels.com"))

    // Run seed a second time back-to-back
    await runSeed({ closePool: false })

    const visaRows = await db.query.visaRates.findMany()
    const shortRate = visaRows.find((r) => r.tier === "short_term")
    const longRate = visaRows.find((r) => r.tier === "long_term")

    assert.ok(shortRate)
    assert.ok(longRate)
    assert.equal(shortRate.maxDays, 30)
    assert.equal(shortRate.pricePkr, 42500)
    assert.equal(shortRate.priceSar, 470)
    assert.equal(longRate.maxDays, 90)
    assert.equal(longRate.pricePkr, 68000)
    assert.equal(longRate.priceSar, 750)

    const staffAfterSecondSeed = await db.query.user.findFirst({
      where: eq(schema.user.email, "staff@alramlahtravels.com"),
    })
    assert.equal(
      staffAfterSecondSeed?.isActive,
      false,
      "Second seed run must not re-activate a deactivated staff account"
    )

    // Restore staff isActive=true for clean local state
    await db
      .update(schema.user)
      .set({ isActive: true })
      .where(eq(schema.user.email, "staff@alramlahtravels.com"))

    // Verify OD-10 agency settings singleton + fractional sarToPkrRate + regulatory columns
    const settings = await db.query.agencySettings.findFirst({
      where: eq(schema.agencySettings.id, "default"),
    })
    assert.ok(settings)
    assert.equal(settings.primaryWhatsapp, "03274029701")
    assert.equal(settings.secondaryPhone, "03190462638")
    assert.equal(settings.ibanVerified, false)
    assert.ok(settings.officeAddress.includes("Askari 10"))

    // Singleton CHECK constraint must reject non-'default' row IDs
    await expectPgError(
      () =>
        db.insert(schema.agencySettings).values({
          id: "secondary_rogue_row",
          agencyName: "Rogue",
        }),
      /chk_agency_settings_singleton/
    )

    // Verify fractional SAR->PKR numeric(10,4) round-trip as JS number
    await db
      .update(schema.agencySettings)
      .set({ sarToPkrRate: 74.65 })
      .where(eq(schema.agencySettings.id, "default"))
    const updatedSettings = await db.query.agencySettings.findFirst({
      where: eq(schema.agencySettings.id, "default"),
    })
    assert.equal(typeof updatedSettings?.sarToPkrRate, "number")
    assert.equal(updatedSettings?.sarToPkrRate, 74.65)
    await db
      .update(schema.agencySettings)
      .set({ sarToPkrRate: 75 })
      .where(eq(schema.agencySettings.id, "default"))

    // Verify Hajj 2027 indicative packages seeded & 0 fake testimonials
    const hajjRows = await db.query.hajjPackages.findMany()
    assert.ok(hajjRows.length >= 3)
    assert.ok(hajjRows.every((h) => h.isIndicative === true))

    const testimonialRows = await db.query.testimonials.findMany()
    assert.equal(testimonialRows.length, 0)

    // Destructive script guard must refuse .neon.tech without --confirm-env=<exact-host>
    assert.throws(
      () =>
        assertSafeScriptTarget(
          "postgresql://user:pass@ep-cool-resonance.ap-southeast-1.aws.neon.tech/neondb",
          ["node", "scripts/purge-all-demo-data.ts"]
        ),
      UnsafeScriptTargetError
    )
    const confirmed = assertSafeScriptTarget(
      "postgresql://user:pass@ep-cool-resonance.ap-southeast-1.aws.neon.tech/neondb",
      [
        "node",
        "scripts/purge-all-demo-data.ts",
        "--confirm-env=ep-cool-resonance.ap-southeast-1.aws.neon.tech",
      ]
    )
    assert.equal(
      confirmed.hostname,
      "ep-cool-resonance.ap-southeast-1.aws.neon.tech"
    )
  })

  it("T-041 & T-042: enforces BIGINT >2.14B PKR totals, application_payments ledger, UNIQUE(application_id, version), CHECK constraints, and RESTRICT FKs", async () => {
    const refNumber = `ART-LEDGER-${crypto.randomBytes(4).toString("hex").toUpperCase()}`

    // CHECK constraint: adults >= 1 must reject 0 adults
    await expectPgError(
      () =>
        db.insert(schema.applications).values({
          referenceNumber: `${refNumber}-BAD`,
          source: "custom_builder",
          presetMode: "visa_only",
          customerName: "Zero Adult Test",
          customerPhone: "+923274029701",
          customerWhatsapp: "+923274029701",
          customerCity: "Lahore",
          adults: 0,
          children: 0,
          infants: 0,
          totalPassportCount: 0,
          bedAndSeatCount: 0,
        }),
      /chk_applications_traveller_invariants/
    )

    const [appRow] = await db
      .insert(schema.applications)
      .values({
        referenceNumber: refNumber,
        source: "custom_builder",
        presetMode: "complete_umrah",
        customerName: "Corporate Hajj Delegation",
        customerPhone: "+923274029701",
        customerWhatsapp: "+923274029701",
        customerCity: "Lahore",
        adults: 25,
        children: 0,
        infants: 0,
        totalPassportCount: 25,
        bedAndSeatCount: 25,
        ksaArrivalDate: "2027-05-10",
        ksaDepartureDate: "2027-05-30",
      })
      .returning({ id: schema.applications.id })

    try {
      // BIGINT test: PKR 3,200,000,000 exceeds INT4 max (2,147,483,647) without 22003 overflow!
      const [quoteRow] = await db
        .insert(schema.applicationQuotes)
        .values({
          applicationId: appRow!.id,
          version: 1,
          visaTotalPkr: 200_000_000,
          flightsTotalPkr: 1_000_000_000,
          makkahHotelTotalPkr: 1_200_000_000,
          madinahHotelTotalPkr: 800_000_000,
          grandTotalPkr: 3_200_000_000,
          depositRequiredPkr: 800_000_000,
        })
        .returning({ id: schema.applicationQuotes.id, grandTotalPkr: schema.applicationQuotes.grandTotalPkr })

      assert.equal(quoteRow!.grandTotalPkr, 3_200_000_000)

      // UNIQUE(application_id, version) must reject duplicate quote version 1
      await expectPgError(
        () =>
          db.insert(schema.applicationQuotes).values({
            applicationId: appRow!.id,
            version: 1,
            grandTotalPkr: 500_000,
          }),
        /idx_quote_app_version|duplicate key/
      )

      // application_payments CHECK constraint must reject amount_pkr <= 0
      await expectPgError(
        () =>
          db.insert(schema.applicationPayments).values({
            applicationId: appRow!.id,
            quoteId: quoteRow!.id,
            amountPkr: 0,
            paymentMethod: "bank_transfer",
          }),
        /chk_application_payments_positive_amount/
      )

      const [paymentRow] = await db
        .insert(schema.applicationPayments)
        .values({
          applicationId: appRow!.id,
          quoteId: quoteRow!.id,
          amountPkr: 800_000_000,
          paymentMethod: "bank_transfer",
          bankReference: "MEEZAN-TXN-998877",
        })
        .returning({ id: schema.applicationPayments.id })
      assert.ok(paymentRow?.id)

      // RESTRICT FK: deleting an application with recorded payments must fail (no silent cascade of ledger!)
      await expectPgError(
        () =>
          db
            .delete(schema.applications)
            .where(eq(schema.applications.id, appRow!.id)),
        /violates foreign key constraint/
      )

      // RESTRICT FK: deleting a group_package that has group_departures must fail
      const pkgWithDeps = await db.query.groupPackages.findFirst({
        with: { departures: true },
      })
      if (pkgWithDeps && pkgWithDeps.departures.length > 0) {
        await expectPgError(
          () =>
            db
              .delete(schema.groupPackages)
              .where(eq(schema.groupPackages.id, pkgWithDeps.id)),
          /violates foreign key constraint/
        )
      }
    } finally {
      await db
        .delete(schema.applicationPayments)
        .where(eq(schema.applicationPayments.applicationId, appRow!.id))
      await db
        .delete(schema.applications)
        .where(eq(schema.applications.id, appRow!.id))
    }
  })

  it("T-009, T-079 & T-080: enforces immutable audit_logs trigger, Postgres enforceRateLimit, PII logger redaction, and JSONB/WhatsApp scrubbers", async () => {
    // 1. Structured logger redaction
    const lines: string[] = []
    const testLogger = createLogger({ module: "test" }, (line) => lines.push(line))
    testLogger.info(
      "Inbound JID 923274029701@s.whatsapp.net pairing code: ABCD-1234 Bearer eyJhbGciOiJIUzI1NiJ9",
      {
        customerPhone: "+923274029701",
        accessToken: "EAABsbCS1iHgBO1234567890abcdef",
        params: ["secret-sql-param-pilgrim-passport"],
      }
    )
    const logged = lines[0]!
    assert.ok(!logged.includes("923274029701@s.whatsapp.net"))
    assert.ok(!logged.includes("ABCD-1234"))
    assert.ok(!logged.includes("eyJhbGciOiJIUzI1NiJ9"))
    assert.ok(!logged.includes("EAABsbCS1iHgBO1234567890abcdef"))
    assert.ok(!logged.includes("secret-sql-param-pilgrim-passport"))
    assert.ok(logged.includes("[REDACTED_JID]"))
    assert.ok(logged.includes("[REDACTED_SQL_PARAMS]"))

    // 2. Trusted IP extraction (prefers CF-Connecting-IP / X-Real-IP / rightmost X-Forwarded-For hop)
    assert.equal(
      extractClientIp({
        "x-forwarded-for": "1.1.1.1, 203.0.113.99",
      }),
      "203.0.113.99"
    )
    assert.equal(
      extractClientIp({
        "cf-connecting-ip": "198.51.100.42",
        "x-forwarded-for": "1.1.1.1",
      }),
      "198.51.100.42"
    )
    assert.equal(hashIp("198.51.100.42").length, 32)

    // 3. Postgres rate_limit_buckets enforcement
    const ns = `test_ns_${crypto.randomBytes(4).toString("hex")}`
    const r1 = await enforceRateLimit(ns, "198.51.100.42", {
      max: 2,
      windowSec: 60,
    })
    const r2 = await enforceRateLimit(ns, "198.51.100.42", {
      max: 2,
      windowSec: 60,
    })
    const r3 = await enforceRateLimit(ns, "198.51.100.42", {
      max: 2,
      windowSec: 60,
    })
    assert.equal(r1.allowed, true)
    assert.equal(r2.allowed, true)
    assert.equal(r3.allowed, false)
    assert.ok(r3.retryAfterSec >= 1)

    // 4. Immutable audit_logs insert + UPDATE/DELETE rejection by trg_audit_logs_immutable
    const auditId = await recordAuditLog({
      actorId: null,
      actorRole: "super_admin",
      action: "test.immutable_audit_verification",
      entityType: "agency_settings",
      entityId: "default",
      before: { apiToken: "secret_before_123", sarToPkrRate: 75 },
      after: { apiToken: "secret_after_456", sarToPkrRate: 76 },
      ipAddress: "198.51.100.42",
    })
    assert.ok(auditId)

    await expectPgError(
      () =>
        db
          .update(schema.auditLogs)
          .set({ action: "tampered.action" })
          .where(eq(schema.auditLogs.id, auditId)),
      /append-only and immutable/
    )

    await expectPgError(
      () =>
        db.delete(schema.auditLogs).where(eq(schema.auditLogs.id, auditId)),
      /append-only and immutable/
    )

    // 5. JSONB parsers & WhatsApp message type / raw payload scrubber
    assert.deepEqual(parsePrivateRoomAllocationJsonb(null), {
      double: 0,
      triple: 0,
      quad: 0,
    })
    assert.deepEqual(parseMultiHotelOptionsJsonb("corrupted"), [])
    assert.equal(normalizeWhatsappMessageType("IMAGE"), "image")
    assert.equal(normalizeWhatsappMessageType("unknown_type"), "text")
    assert.deepEqual(
      scrubWhatsappRawPayload({
        id: "wamid.123",
        type: "text",
        timestamp: "1700000000",
        contacts: [{ wa_id: "923001234567", profile: { name: "Secret Name" } }],
        text: { body: "Passport number AB1234567" },
      }),
      {
        id: "wamid.123",
        type: "text",
        timestamp: "1700000000",
        redacted: true,
      }
    )
  })
})
