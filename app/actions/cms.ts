"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db, withTransaction } from "@/db"
import { contactMessages, faqs, heroSlides, testimonials } from "@/db/schema"
import { recordAuditLog } from "@/lib/audit-log"
import { requireAdmin, requireSuperAdmin } from "@/lib/auth-guard"
import { enforceRateLimit, extractClientIp } from "@/lib/rate-limit"
import {
  contactMessageSchema,
  faqSchema,
  heroSlideSchema,
  testimonialSchema,
} from "@/lib/validations/cms"

const uuidIdSchema = z.string().uuid("Invalid record ID format.")

const DANGEROUS_URI_SCHEME_REGEX = /^\s*(javascript|data|vbscript|file):/i

function isSafeCmsUrl(raw: string | null | undefined): boolean {
  if (!raw) return true
  const trimmed = raw.trim()
  if (!trimmed) return true
  if (DANGEROUS_URI_SCHEME_REGEX.test(trimmed)) {
    return false
  }
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("tel:") ||
    trimmed.startsWith("mailto:")
  ) {
    return true
  }
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

function formatZodIssues(error: z.ZodError): {
  error: string
  fieldErrors: Record<string, string[]>
} {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_root"
    if (!fieldErrors[key]) {
      fieldErrors[key] = []
    }
    fieldErrors[key]!.push(issue.message)
  }
  const firstIssue = error.issues[0]
  const prefix =
    firstIssue && firstIssue.path.length > 0
      ? `${firstIssue.path.join(".")}: `
      : ""
  return {
    error: firstIssue ? `${prefix}${firstIssue.message}` : "Validation failed.",
    fieldErrors,
  }
}

function safeRevalidateCmsPaths(extraPaths: string[] = []): void {
  const uniquePaths = Array.from(
    new Set(["/", "/admin/catalog", "/admin/settings", ...extraPaths])
  )
  for (const targetPath of uniquePaths) {
    try {
      revalidatePath(targetPath)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ""
      if (!msg.includes("static generation store missing")) {
        throw err
      }
    }
  }
}

async function resolveRequestClientIp(): Promise<string> {
  try {
    const reqHeaders = await headers()
    return extractClientIp(new Headers(Array.from(reqHeaders.entries())))
  } catch {
    return "127.0.0.1"
  }
}

// ==========================================
// HERO SLIDES ACTIONS (`super_admin`)
// ==========================================

const hardenedHeroSlideSchema = heroSlideSchema.safeExtend({
  imageUrl: z
    .string()
    .trim()
    .min(1, "Hero image URL is required.")
    .refine(isSafeCmsUrl, {
      message: "Image URL must use http://, https://, or a relative path.",
    }),
  primaryCtaUrl: z
    .string()
    .trim()
    .min(1, "Primary CTA link is required.")
    .refine(isSafeCmsUrl, {
      message: "Primary CTA URL cannot use an unsafe URI scheme.",
    }),
  secondaryCtaUrl: z
    .string()
    .trim()
    .refine(isSafeCmsUrl, {
      message: "Secondary CTA URL cannot use an unsafe URI scheme.",
    })
    .optional(),
})

export async function upsertHeroSlide(rawInput: unknown) {
  const adminSession = await requireSuperAdmin()
  const parsed = hardenedHeroSlideSchema.safeParse(rawInput)
  if (!parsed.success) {
    const formatted = formatZodIssues(parsed.error)
    return { success: false as const, ...formatted }
  }
  const validated = parsed.data
  const clientIp = await resolveRequestClientIp()

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

    if (!updated) {
      return { success: false as const, error: "Hero slide not found." }
    }

    await recordAuditLog({
      actorId: adminSession.user.id,
      actorRole: adminSession.user.role,
      action: "cms.hero_slide.updated",
      entityType: "hero_slide",
      entityId: updated.id,
      after: { title: updated.title, isActive: updated.isActive },
      ipAddress: clientIp,
    })

    safeRevalidateCmsPaths(["/admin/content"])
    return { success: true as const, data: updated }
  }

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

  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "cms.hero_slide.created",
    entityType: "hero_slide",
    entityId: inserted.id,
    after: { title: inserted.title, isActive: inserted.isActive },
    ipAddress: clientIp,
  })

  safeRevalidateCmsPaths(["/admin/content"])
  return { success: true as const, data: inserted }
}

export async function toggleHeroSlideActive(id: string, isActive: boolean) {
  const adminSession = await requireSuperAdmin()
  const parsedId = uuidIdSchema.safeParse(id)
  const parsedActive = z.boolean().safeParse(isActive)
  if (!parsedId.success || !parsedActive.success) {
    return { success: false as const, error: "Invalid hero slide ID or active flag." }
  }

  const [updated] = await db
    .update(heroSlides)
    .set({ isActive: parsedActive.data, updatedAt: new Date() })
    .where(eq(heroSlides.id, parsedId.data))
    .returning({ id: heroSlides.id, isActive: heroSlides.isActive })

  if (!updated) {
    return { success: false as const, error: "Hero slide not found." }
  }

  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "cms.hero_slide.toggled_active",
    entityType: "hero_slide",
    entityId: updated.id,
    after: { isActive: updated.isActive },
    ipAddress: await resolveRequestClientIp(),
  })

  safeRevalidateCmsPaths(["/admin/content"])
  return { success: true as const }
}

export async function deleteHeroSlide(id: string) {
  const adminSession = await requireSuperAdmin()
  const parsedId = uuidIdSchema.safeParse(id)
  if (!parsedId.success) {
    return { success: false as const, error: "Invalid hero slide ID." }
  }

  const [deleted] = await db
    .delete(heroSlides)
    .where(eq(heroSlides.id, parsedId.data))
    .returning({ id: heroSlides.id, title: heroSlides.title })

  if (!deleted) {
    return { success: false as const, error: "Hero slide not found." }
  }

  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "cms.hero_slide.deleted",
    entityType: "hero_slide",
    entityId: deleted.id,
    before: { title: deleted.title },
    ipAddress: await resolveRequestClientIp(),
  })

  safeRevalidateCmsPaths(["/admin/content"])
  return { success: true as const }
}

// ==========================================
// TESTIMONIALS ACTIONS (`super_admin`)
// ==========================================

const hardenedTestimonialSchema = testimonialSchema.safeExtend({
  avatarUrl: z
    .string()
    .trim()
    .refine(isSafeCmsUrl, {
      message: "Avatar URL must use http://, https://, or a relative path.",
    })
    .optional(),
})

export async function upsertTestimonial(rawInput: unknown) {
  const adminSession = await requireSuperAdmin()
  const parsed = hardenedTestimonialSchema.safeParse(rawInput)
  if (!parsed.success) {
    const formatted = formatZodIssues(parsed.error)
    return { success: false as const, ...formatted }
  }
  const validated = parsed.data
  const clientIp = await resolveRequestClientIp()

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

    if (!updated) {
      return { success: false as const, error: "Testimonial not found." }
    }

    await recordAuditLog({
      actorId: adminSession.user.id,
      actorRole: adminSession.user.role,
      action: "cms.testimonial.updated",
      entityType: "testimonial",
      entityId: updated.id,
      after: { pilgrimName: updated.pilgrimName, rating: updated.rating },
      ipAddress: clientIp,
    })

    safeRevalidateCmsPaths(["/admin/content"])
    return { success: true as const, data: updated }
  }

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

  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "cms.testimonial.created",
    entityType: "testimonial",
    entityId: inserted.id,
    after: { pilgrimName: inserted.pilgrimName, rating: inserted.rating },
    ipAddress: clientIp,
  })

  safeRevalidateCmsPaths(["/admin/content"])
  return { success: true as const, data: inserted }
}

export async function toggleTestimonialActive(id: string, isActive: boolean) {
  const adminSession = await requireSuperAdmin()
  const parsedId = uuidIdSchema.safeParse(id)
  const parsedActive = z.boolean().safeParse(isActive)
  if (!parsedId.success || !parsedActive.success) {
    return { success: false as const, error: "Invalid testimonial ID or active flag." }
  }

  const [updated] = await db
    .update(testimonials)
    .set({ isActive: parsedActive.data, updatedAt: new Date() })
    .where(eq(testimonials.id, parsedId.data))
    .returning({ id: testimonials.id, isActive: testimonials.isActive })

  if (!updated) {
    return { success: false as const, error: "Testimonial not found." }
  }

  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "cms.testimonial.toggled_active",
    entityType: "testimonial",
    entityId: updated.id,
    after: { isActive: updated.isActive },
    ipAddress: await resolveRequestClientIp(),
  })

  safeRevalidateCmsPaths(["/admin/content"])
  return { success: true as const }
}

export async function deleteTestimonial(id: string) {
  const adminSession = await requireSuperAdmin()
  const parsedId = uuidIdSchema.safeParse(id)
  if (!parsedId.success) {
    return { success: false as const, error: "Invalid testimonial ID." }
  }

  const [deleted] = await db
    .delete(testimonials)
    .where(eq(testimonials.id, parsedId.data))
    .returning({ id: testimonials.id, pilgrimName: testimonials.pilgrimName })

  if (!deleted) {
    return { success: false as const, error: "Testimonial not found." }
  }

  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "cms.testimonial.deleted",
    entityType: "testimonial",
    entityId: deleted.id,
    before: { pilgrimName: deleted.pilgrimName },
    ipAddress: await resolveRequestClientIp(),
  })

  safeRevalidateCmsPaths(["/admin/content"])
  return { success: true as const }
}

// ==========================================
// FAQS ACTIONS (`super_admin`)
// ==========================================

export async function upsertFaq(rawInput: unknown) {
  const adminSession = await requireSuperAdmin()
  const parsed = faqSchema.safeParse(rawInput)
  if (!parsed.success) {
    const formatted = formatZodIssues(parsed.error)
    return { success: false as const, ...formatted }
  }
  const validated = parsed.data
  const clientIp = await resolveRequestClientIp()

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

    if (!updated) {
      return { success: false as const, error: "FAQ entry not found." }
    }

    await recordAuditLog({
      actorId: adminSession.user.id,
      actorRole: adminSession.user.role,
      action: "cms.faq.updated",
      entityType: "faq",
      entityId: updated.id,
      after: { category: updated.category, question: updated.question },
      ipAddress: clientIp,
    })

    safeRevalidateCmsPaths(["/admin/content"])
    return { success: true as const, data: updated }
  }

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

  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "cms.faq.created",
    entityType: "faq",
    entityId: inserted.id,
    after: { category: inserted.category, question: inserted.question },
    ipAddress: clientIp,
  })

  safeRevalidateCmsPaths(["/admin/content"])
  return { success: true as const, data: inserted }
}

export async function toggleFaqActive(id: string, isActive: boolean) {
  const adminSession = await requireSuperAdmin()
  const parsedId = uuidIdSchema.safeParse(id)
  const parsedActive = z.boolean().safeParse(isActive)
  if (!parsedId.success || !parsedActive.success) {
    return { success: false as const, error: "Invalid FAQ ID or active flag." }
  }

  const [updated] = await db
    .update(faqs)
    .set({ isActive: parsedActive.data, updatedAt: new Date() })
    .where(eq(faqs.id, parsedId.data))
    .returning({ id: faqs.id, isActive: faqs.isActive })

  if (!updated) {
    return { success: false as const, error: "FAQ entry not found." }
  }

  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "cms.faq.toggled_active",
    entityType: "faq",
    entityId: updated.id,
    after: { isActive: updated.isActive },
    ipAddress: await resolveRequestClientIp(),
  })

  safeRevalidateCmsPaths(["/admin/content"])
  return { success: true as const }
}

export async function deleteFaq(id: string) {
  const adminSession = await requireSuperAdmin()
  const parsedId = uuidIdSchema.safeParse(id)
  if (!parsedId.success) {
    return { success: false as const, error: "Invalid FAQ ID." }
  }

  const [deleted] = await db
    .delete(faqs)
    .where(eq(faqs.id, parsedId.data))
    .returning({ id: faqs.id, question: faqs.question })

  if (!deleted) {
    return { success: false as const, error: "FAQ entry not found." }
  }

  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "cms.faq.deleted",
    entityType: "faq",
    entityId: deleted.id,
    before: { question: deleted.question },
    ipAddress: await resolveRequestClientIp(),
  })

  safeRevalidateCmsPaths(["/admin/content"])
  return { success: true as const }
}

// ==========================================
// CMS SORT ORDER REORDERING (`T-091`)
// ==========================================

const reorderCmsEntitiesSchema = z.object({
  entityType: z.enum(["hero_slides", "testimonials", "faqs"]),
  orderedIds: z.array(z.string().uuid()).min(1).max(200),
})

export async function reorderCmsEntities(rawInput: unknown) {
  const adminSession = await requireSuperAdmin()
  const parsed = reorderCmsEntitiesSchema.safeParse(rawInput)
  if (!parsed.success) {
    const formatted = formatZodIssues(parsed.error)
    return { success: false as const, ...formatted }
  }
  const { entityType, orderedIds } = parsed.data
  const now = new Date()

  await withTransaction(async (tx) => {
    for (let index = 0; index < orderedIds.length; index++) {
      const targetId = orderedIds[index]!
      if (entityType === "hero_slides") {
        await tx
          .update(heroSlides)
          .set({ sortOrder: index, updatedAt: now })
          .where(eq(heroSlides.id, targetId))
      } else if (entityType === "testimonials") {
        await tx
          .update(testimonials)
          .set({ sortOrder: index, updatedAt: now })
          .where(eq(testimonials.id, targetId))
      } else if (entityType === "faqs") {
        await tx
          .update(faqs)
          .set({ sortOrder: index, updatedAt: now })
          .where(eq(faqs.id, targetId))
      }
    }
  })

  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "cms.entities.reordered",
    entityType,
    after: { count: orderedIds.length },
    ipAddress: await resolveRequestClientIp(),
  })

  safeRevalidateCmsPaths(["/admin/content"])
  return { success: true as const }
}

// ==========================================
// CONTACT MESSAGES INBOX ACTIONS (`T-075`, `T-076`, `T-091`)
// ==========================================

const updateMessageStatusSchema = z.object({
  id: z.string().uuid("Invalid inquiry message ID."),
  status: z.enum(["unread", "read", "replied", "archived"]),
  adminNotes: z.string().trim().max(4000).optional(),
})

export async function updateContactMessageStatus(rawInput: unknown) {
  // Both `staff` and `super_admin` consultants may triage inbound inquiries (`OD-07`, `T-075`).
  const adminSession = await requireAdmin()
  const parsed = updateMessageStatusSchema.safeParse(rawInput)
  if (!parsed.success) {
    const formatted = formatZodIssues(parsed.error)
    return { success: false as const, ...formatted }
  }
  const validated = parsed.data

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

  if (!updated) {
    return { success: false as const, error: "Inquiry message not found." }
  }

  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "cms.contact_message.status_updated",
    entityType: "contact_message",
    entityId: updated.id,
    after: {
      status: updated.status,
      hasAdminNotes: Boolean(updated.adminNotes),
    },
    ipAddress: await resolveRequestClientIp(),
  })

  safeRevalidateCmsPaths(["/admin/messages"])
  return { success: true as const, data: updated }
}

export async function deleteContactMessage(id: string) {
  const adminSession = await requireSuperAdmin()
  const parsedId = uuidIdSchema.safeParse(id)
  if (!parsedId.success) {
    return { success: false as const, error: "Invalid inquiry message ID." }
  }

  const [deleted] = await db
    .delete(contactMessages)
    .where(eq(contactMessages.id, parsedId.data))
    .returning({ id: contactMessages.id, subject: contactMessages.subject })

  if (!deleted) {
    return { success: false as const, error: "Inquiry message not found." }
  }

  await recordAuditLog({
    actorId: adminSession.user.id,
    actorRole: adminSession.user.role,
    action: "cms.contact_message.deleted",
    entityType: "contact_message",
    entityId: deleted.id,
    before: { subject: deleted.subject },
    ipAddress: await resolveRequestClientIp(),
  })

  safeRevalidateCmsPaths(["/admin/messages"])
  return { success: true as const }
}

// ==========================================
// PUBLIC CONTACT SUBMISSION (`T-076`, `T-091`)
// ==========================================

const hardenedContactMessageSchema = contactMessageSchema.safeExtend({
  name: z.string().trim().min(2, "Name is required.").max(120),
  email: z
    .string()
    .trim()
    .email("Invalid email address.")
    .max(255)
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().min(7, "Valid phone number required.").max(32),
  whatsapp: z.string().trim().max(32).optional(),
  subject: z.string().trim().min(3, "Subject is required.").max(200),
  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters.")
    .max(4000),
})

export async function submitContactMessage(rawInput: unknown) {
  const clientIp = await resolveRequestClientIp()
  const rateLimit = await enforceRateLimit(
    "public:contact-message",
    clientIp,
    {
      max: 5,
      windowSec: 900,
    }
  )

  if (!rateLimit.allowed) {
    return {
      success: false as const,
      code: "RATE_LIMITED" as const,
      retryAfterSec: rateLimit.retryAfterSec,
      error: `Too many messages sent recently. Please wait ${rateLimit.retryAfterSec} seconds or reach us directly on WhatsApp.`,
    }
  }

  const parsed = hardenedContactMessageSchema.safeParse(rawInput)
  if (!parsed.success) {
    const formatted = formatZodIssues(parsed.error)
    return {
      success: false as const,
      code: "VALIDATION_ERROR" as const,
      ...formatted,
    }
  }
  const validated = parsed.data

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
    .returning({ id: contactMessages.id })

  safeRevalidateCmsPaths(["/admin/messages"])

  return { success: true as const, id: inserted.id }
}
