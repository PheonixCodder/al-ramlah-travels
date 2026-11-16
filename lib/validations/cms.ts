import { z } from "zod"
import { parsePhoneE164 } from "../phone"
import { strictAttributionSchema } from "../seo/utm"
import {
  safeOptionalAssetUrlSchema,
  safeOptionalCtaUrlSchema,
  safeRequiredAssetUrlSchema,
  safeRequiredCtaUrlSchema,
} from "./url-guards"

export const heroSlideSchema = z.object({
  id: z.string().uuid().optional(),
  badge: z.string().trim().max(80).optional(),
  title: z.string().trim().min(1, "Title is required").max(200),
  subtitle: z.string().trim().min(1, "Subtitle is required").max(600),
  imageUrl: safeRequiredAssetUrlSchema("Hero slide image URL"),
  primaryCtaLabel: z.string().trim().min(1).max(80).default("Plan Custom Umrah"),
  primaryCtaUrl: safeRequiredCtaUrlSchema("#custom-builder"),
  secondaryCtaLabel: z.string().trim().max(80).optional(),
  secondaryCtaUrl: safeOptionalCtaUrlSchema(),
  ctaHref: safeOptionalCtaUrlSchema(),
  ctaUrl: safeOptionalCtaUrlSchema(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(-1000).max(10_000).default(0),
})

export const testimonialSchema = z.object({
  id: z.string().uuid().optional(),
  pilgrimName: z.string().trim().min(1, "Pilgrim name is required").max(120),
  city: z.string().trim().min(1, "City is required").max(100),
  quote: z.string().trim().min(1, "Review text is required").max(2000),
  packageOrJourneyType: z
    .string()
    .trim()
    .min(1, "Journey type is required")
    .max(120),
  rating: z.number().int().min(1).max(5).default(5),
  avatarUrl: safeOptionalAssetUrlSchema("Avatar URL"),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(-1000).max(10_000).default(0),
})

export const faqSchema = z.object({
  id: z.string().uuid().optional(),
  category: z
    .enum(["general", "visa", "hotels", "transport", "packages", "hajj"])
    .default("general"),
  question: z.string().trim().min(1, "Question is required").max(500),
  answer: z.string().trim().min(1, "Answer is required").max(5000),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(-1000).max(10_000).default(0),
})

export const contactMessageSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  email: z
    .string()
    .trim()
    .max(254)
    .email("Invalid email")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .min(7, "Valid phone number required")
    .max(32)
    .refine(
      (v) => {
        const p = parsePhoneE164(v)
        return p.valid && p.nationalDigits.length >= 9
      },
      "Enter a valid Pakistani or international E.164 phone number"
    ),
  whatsapp: z
    .string()
    .trim()
    .max(32)
    .refine(
      (v) => {
        if (!v) return true
        const p = parsePhoneE164(v)
        return p.valid && p.nationalDigits.length >= 9
      },
      "Enter a valid WhatsApp number"
    )
    .optional(),
  subject: z.string().trim().min(3, "Subject is required").max(200),
  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters")
    .max(5000, "Message cannot exceed 5000 characters"),
  honeypot: z.string().max(0, "Automated submission rejected").optional(),
  attribution: strictAttributionSchema.optional(),
})

export type HeroSlideInput = z.infer<typeof heroSlideSchema>
export type TestimonialInput = z.infer<typeof testimonialSchema>
export type FaqInput = z.infer<typeof faqSchema>
export type ContactMessageInput = z.infer<typeof contactMessageSchema>
