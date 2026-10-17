"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { heroSlides, testimonials, faqs, contactMessages } from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import {
  heroSlideSchema,
  testimonialSchema,
  faqSchema,
  contactMessageSchema,
} from "@/lib/validations/cms"
import { z } from "zod"

// ==========================================
// HERO SLIDES ACTIONS
// ==========================================

export async function upsertHeroSlide(rawInput: unknown) {
  await requireAdmin()
  const validated = heroSlideSchema.parse(rawInput)

  if (validated.id) {
    const [updated] = await db
      .update(heroSlides)
      .set({
        badge: validated.badge || null,
        title: validated.title,
        subtitle: validated.subtitle,
        imageUrl: validated.imageUrl,
        primaryCtaLabel: validated.primaryCtaLabel,
        primaryCtaUrl: validated.primaryCtaUrl,
        secondaryCtaLabel: validated.secondaryCtaLabel || null,
        secondaryCtaUrl: validated.secondaryCtaUrl || null,
        isActive: validated.isActive,
        sortOrder: validated.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(heroSlides.id, validated.id))
      .returning()

    revalidatePath("/admin/content")
    revalidatePath("/")
    return { success: true, data: updated }
  } else {
    const [inserted] = await db
      .insert(heroSlides)
      .values({
        badge: validated.badge || null,
        title: validated.title,
        subtitle: validated.subtitle,
        imageUrl: validated.imageUrl,
        primaryCtaLabel: validated.primaryCtaLabel,
        primaryCtaUrl: validated.primaryCtaUrl,
        secondaryCtaLabel: validated.secondaryCtaLabel || null,
        secondaryCtaUrl: validated.secondaryCtaUrl || null,
        isActive: validated.isActive,
        sortOrder: validated.sortOrder,
      })
      .returning()

    revalidatePath("/admin/content")
    revalidatePath("/")
    return { success: true, data: inserted }
  }
}

export async function toggleHeroSlideActive(id: string, isActive: boolean) {
  await requireAdmin()
  await db
    .update(heroSlides)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(heroSlides.id, id))

  revalidatePath("/admin/content")
  revalidatePath("/")
  return { success: true }
}

export async function deleteHeroSlide(id: string) {
  await requireAdmin()
  await db.delete(heroSlides).where(eq(heroSlides.id, id))
  revalidatePath("/admin/content")
  revalidatePath("/")
  return { success: true }
}

// ==========================================
// TESTIMONIALS ACTIONS
// ==========================================

export async function upsertTestimonial(rawInput: unknown) {
  await requireAdmin()
  const validated = testimonialSchema.parse(rawInput)

  if (validated.id) {
    const [updated] = await db
      .update(testimonials)
      .set({
        pilgrimName: validated.pilgrimName,
        city: validated.city,
        quote: validated.quote,
        packageOrJourneyType: validated.packageOrJourneyType,
        rating: validated.rating,
        avatarUrl: validated.avatarUrl || null,
        isFeatured: validated.isFeatured,
        isActive: validated.isActive,
        sortOrder: validated.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(testimonials.id, validated.id))
      .returning()

    revalidatePath("/admin/content")
    revalidatePath("/")
    return { success: true, data: updated }
  } else {
    const [inserted] = await db
      .insert(testimonials)
      .values({
        pilgrimName: validated.pilgrimName,
        city: validated.city,
        quote: validated.quote,
        packageOrJourneyType: validated.packageOrJourneyType,
        rating: validated.rating,
        avatarUrl: validated.avatarUrl || null,
        isFeatured: validated.isFeatured,
        isActive: validated.isActive,
        sortOrder: validated.sortOrder,
      })
      .returning()

    revalidatePath("/admin/content")
    revalidatePath("/")
    return { success: true, data: inserted }
  }
}

export async function toggleTestimonialActive(id: string, isActive: boolean) {
  await requireAdmin()
  await db
    .update(testimonials)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(testimonials.id, id))

  revalidatePath("/admin/content")
  revalidatePath("/")
  return { success: true }
}

export async function deleteTestimonial(id: string) {
  await requireAdmin()
  await db.delete(testimonials).where(eq(testimonials.id, id))
  revalidatePath("/admin/content")
  revalidatePath("/")
  return { success: true }
}

// ==========================================
// FAQS ACTIONS
// ==========================================

export async function upsertFaq(rawInput: unknown) {
  await requireAdmin()
  const validated = faqSchema.parse(rawInput)

  if (validated.id) {
    const [updated] = await db
      .update(faqs)
      .set({
        category: validated.category,
        question: validated.question,
        answer: validated.answer,
        isActive: validated.isActive,
        sortOrder: validated.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(faqs.id, validated.id))
      .returning()

    revalidatePath("/admin/content")
    revalidatePath("/")
    return { success: true, data: updated }
  } else {
    const [inserted] = await db
      .insert(faqs)
      .values({
        category: validated.category,
        question: validated.question,
        answer: validated.answer,
        isActive: validated.isActive,
        sortOrder: validated.sortOrder,
      })
      .returning()

    revalidatePath("/admin/content")
    revalidatePath("/")
    return { success: true, data: inserted }
  }
}

export async function toggleFaqActive(id: string, isActive: boolean) {
  await requireAdmin()
  await db
    .update(faqs)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(faqs.id, id))

  revalidatePath("/admin/content")
  revalidatePath("/")
  return { success: true }
}

export async function deleteFaq(id: string) {
  await requireAdmin()
  await db.delete(faqs).where(eq(faqs.id, id))
  revalidatePath("/admin/content")
  revalidatePath("/")
  return { success: true }
}

// ==========================================
// CONTACT MESSAGES INBOX ACTIONS
// ==========================================

const updateMessageStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["unread", "read", "replied", "archived"]),
  adminNotes: z.string().optional(),
})

export async function updateContactMessageStatus(rawInput: unknown) {
  await requireAdmin()
  const validated = updateMessageStatusSchema.parse(rawInput)

  const [updated] = await db
    .update(contactMessages)
    .set({
      status: validated.status,
      ...(validated.adminNotes !== undefined
        ? { adminNotes: validated.adminNotes || null }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(contactMessages.id, validated.id))
    .returning()

  revalidatePath("/admin/messages")
  return { success: true, data: updated }
}

export async function deleteContactMessage(id: string) {
  await requireAdmin()
  await db.delete(contactMessages).where(eq(contactMessages.id, id))
  revalidatePath("/admin/messages")
  return { success: true }
}

// ==========================================
// PUBLIC CONTACT SUBMISSION
// ==========================================

export async function submitContactMessage(rawInput: unknown) {
  const validated = contactMessageSchema.parse(rawInput)

  const [inserted] = await db
    .insert(contactMessages)
    .values({
      name: validated.name,
      email: validated.email || null,
      phone: validated.phone,
      whatsapp: validated.whatsapp || null,
      subject: validated.subject,
      message: validated.message,
      status: "unread",
    })
    .returning()

  revalidatePath("/admin/messages")

  return { success: true, id: inserted.id }
}
