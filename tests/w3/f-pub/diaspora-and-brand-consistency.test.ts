import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import React from "react"
import { after, describe, it } from "node:test"
import { renderToStaticMarkup } from "react-dom/server"
import { eq, inArray } from "drizzle-orm"
import { closeDatabasePool, db } from "../../../db"
import * as schema from "../../../db/schema"
import { submitHajjInquiryApplication } from "../../../app/actions/applications"
import { DEFAULT_COMPANY_INFO } from "../../../lib/company-info"
import { HajjInquirySection } from "../../../components/public/hajj-inquiry-section"
import { ContactSection } from "../../../components/public/contact-section"
import { PublicFooter } from "../../../components/layout/public-footer"

async function collectFilesRecursively(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const out: string[] = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await collectFilesRecursively(full)))
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

describe("F-PUB T-084 (OD-10): DB Hajj 2027 Catalog Hydration, International Diaspora Support, Social/Map Wiring & Brand SSoT", () => {
  const createdAppIds: string[] = []
  const createdHajjPkgIds: string[] = []

  after(async () => {
    if (createdAppIds.length > 0) {
      await db
        .delete(schema.applicationQuotes)
        .where(inArray(schema.applicationQuotes.applicationId, createdAppIds))
      await db
        .delete(schema.applications)
        .where(inArray(schema.applications.id, createdAppIds))
    }
    if (createdHajjPkgIds.length > 0) {
      await db
        .delete(schema.hajjPackages)
        .where(inArray(schema.hajjPackages.id, createdHajjPkgIds))
    }
    await closeDatabasePool()
  })

  it("hydrates HajjInquirySection from DB hajjPackages rows and persists international diaspora inquiries without overflowing specialRequests", async () => {
    const uid = crypto.randomBytes(4).toString("hex")
    const slug = `fpub-hajj-2027-vip-${uid}`

    const [dbHajj] = await db
      .insert(schema.hajjPackages)
      .values({
        slug,
        title: `Royal Maktab A Shifting (${uid})`,
        seasonYear: 2027,
        maktabTier: "A",
        durationDays: 18,
        makkahHotelName: "Makkah Clock Royal Tower",
        makkahDistanceLabel: "0m Haram Courtyard",
        madinahHotelName: "The Oberoi Madinah",
        madinahDistanceLabel: "Front Row Masjid an-Nabawi",
        indicativeSharingPkr: 3450000,
        isActive: true,
        sortOrder: 1,
      })
      .returning()
    assert.ok(dbHajj)
    createdHajjPkgIds.push(dbHajj.id)

    // Render HajjInquirySection with DB catalog row -> must display DB title + Indicative 2027 label
    const hajjHtml = renderToStaticMarkup(
      React.createElement(HajjInquirySection, {
        agencyWhatsapp: "03274029701",
        hajjPackages: [dbHajj],
      })
    )
    assert.ok(hajjHtml.includes(dbHajj.title))
    assert.match(hajjHtml, /INDICATIVE HAJJ 2027/i)

    // Submit diaspora inquiry (Canada +1-416-555-0198) with long notes near 1,000-char limit
    const longNotes = "Pilgrim wheelchair assistance requested. ".repeat(22).trim()
    const res = await submitHajjInquiryApplication({
      clientSubmissionId: `fpub-t084-diaspora-${crypto.randomUUID()}`,
      hajjConsultationType: dbHajj.title,
      hajjPackageSlug: slug,
      maktabTier: "A",
      roomType: "double",
      includeQurbani: true,
      includeTrainTicket: true,
      passengers: { adults: 2, children: 1, infants: 0 },
      contact: {
        customerName: "Imran Siddiqui",
        customerPhone: "+1 (416) 555-0198",
        customerCity: "Toronto",
        customerCountry: "Canada",
      },
      notes: longNotes,
      _testIp: "198.51.100.161",
    })

    assert.equal(res.success, true, res.error)
    assert.ok(res.applicationId)
    createdAppIds.push(res.applicationId)

    const saved = await db.query.applications.findFirst({
      where: eq(schema.applications.id, res.applicationId),
    })
    assert.ok(saved)
    assert.equal(saved.customerPhone, "+14165550198")
    assert.equal(saved.customerCity, "Toronto, Canada")
    assert.ok((saved.specialRequests ?? "").length <= 1500)
    assert.equal(saved.hajjInquiryJson?.hajjPackageId, dbHajj.id)
    assert.equal(saved.hajjInquiryJson?.customerCountry, "Canada")
  })

  it("renders configured social URLs in PublicFooter, mapsEmbedUrl in ContactSection, and eliminates all Rawalpindi/DHA Phase 5 drift across F-PUB", async () => {
    const footerHtml = renderToStaticMarkup(
      React.createElement(PublicFooter, {
        facebookUrl: "https://facebook.com/alramlahtravels",
        instagramUrl: "https://instagram.com/alramlahtravels",
        youtubeUrl: "https://youtube.com/@alramlahtravels",
        tiktokUrl: "https://tiktok.com/@alramlahtravels",
      })
    )
    assert.ok(footerHtml.includes("https://facebook.com/alramlahtravels"))
    assert.ok(footerHtml.includes("https://instagram.com/alramlahtravels"))
    assert.ok(footerHtml.includes("https://youtube.com/@alramlahtravels"))
    assert.ok(footerHtml.includes("https://tiktok.com/@alramlahtravels"))

    const contactHtml = renderToStaticMarkup(
      React.createElement(ContactSection, {
        settings: {
          ...DEFAULT_COMPANY_INFO,
          mapsEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!askari10",
        },
      })
    )
    assert.ok(
      contactHtml.includes("https://www.google.com/maps/embed?pb=!1m18!askari10")
    )

    // Scan all F-PUB owned source files for forbidden geographic/phone drift (OD-10)
    const fpubDirs = [
      path.join(process.cwd(), "app/(public)"),
      path.join(process.cwd(), "components/public"),
      path.join(process.cwd(), "components/planner"),
    ]
    const fpubFiles = [
      path.join(process.cwd(), "app/actions/applications.ts"),
      path.join(process.cwd(), "components/layout/public-header.tsx"),
      path.join(process.cwd(), "components/layout/public-footer.tsx"),
      path.join(process.cwd(), "components/layout/whatsapp-fab.tsx"),
    ]
    for (const dir of fpubDirs) {
      fpubFiles.push(...(await collectFilesRecursively(dir)))
    }

    const forbiddenTokens = [
      "Rawalpindi",
      "DHA Phase 5",
      "Sector F",
      "8451122",
      "03214629700",
    ]
    for (const filePath of fpubFiles) {
      const src = await fs.readFile(filePath, "utf8")
      for (const bad of forbiddenTokens) {
        assert.ok(
          !src.includes(bad),
          `Found forbidden OD-10 drift token "${bad}" in ${path.relative(process.cwd(), filePath)}`
        )
      }
    }
  })
})
