import * as React from "react"
import { db } from "@/db"
import { heroSlides, testimonials, faqs } from "@/db/schema"
import { asc } from "drizzle-orm"
import { requireAdmin } from "@/lib/auth-guard"
import { ContentClient } from "@/components/admin/catalog/content-client"

export const metadata = {
  title: "Website Content CMS | Al Ramlah Travels Admin",
}

export default async function AdminContentPage() {
  await requireAdmin()

  const [allSlides, allReviews, allFaqs] = await Promise.all([
    db
      .select()
      .from(heroSlides)
      .orderBy(asc(heroSlides.sortOrder), asc(heroSlides.createdAt)),
    db
      .select()
      .from(testimonials)
      .orderBy(asc(testimonials.sortOrder), asc(testimonials.createdAt)),
    db
      .select()
      .from(faqs)
      .orderBy(asc(faqs.sortOrder), asc(faqs.createdAt)),
  ])

  return (
    <ContentClient
      initialSlides={allSlides}
      initialTestimonials={allReviews}
      initialFaqs={allFaqs}
    />
  )
}
