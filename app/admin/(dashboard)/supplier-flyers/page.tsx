import * as React from "react"
import { asc, desc } from "drizzle-orm"
import { db } from "@/db"
import * as schema from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import { SupplierFlyersClient } from "@/components/admin/marketing/supplier-flyers-client"

export default async function SupplierFlyersPage() {
  await requireAdmin()

  const [suppliers, flyers] = await Promise.all([
    db.query.suppliers.findMany({
      orderBy: [asc(schema.suppliers.name)],
    }),
    db.query.supplierFlyers.findMany({
      orderBy: [desc(schema.supplierFlyers.createdAt)],
      with: {
        supplier: true,
        packages: {
          orderBy: [asc(schema.supplierFlyerPackages.cardNumber)],
        },
      },
    }),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-gold">
          B2B Wholesale &amp; 4K Poster Studio
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Suppliers, Flyer Wrapping &amp; 4K Spotlight Studio
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-3xl">
          Ingest raw flyers from Ammaar, Upsky Travels, Zahoor Travels, or new suppliers, configure your PKR 20,000–25,000 commission mode, and render 4K All-Packages Sheets (Skill 2) + clutter-free Single-Package Spotlight Posters (Skill 3).
        </p>
      </div>

      <SupplierFlyersClient
        initialSuppliers={suppliers}
        initialFlyers={flyers}
      />
    </div>
  )
}
