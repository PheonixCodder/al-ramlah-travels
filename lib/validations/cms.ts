import { z } from "zod"

export const heroSlideSchema = z.object({
  id: z.string().uuid().optional(),
  badge: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  subtitle: z.string().min(1, "Subtitle is required"),
  imageUrl: z.string().min(1, "Image URL is required"),
  primaryCtaLabel: z.string().min(1).default("Plan Custom Umrah"),
  primaryCtaUrl: z.string().min(1).default("#custom-builder"),
  secondaryCtaLabel: z.string().optional(),
  secondaryCtaUrl: z.string().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
})

export const testimonialSchema = z.object({
  id: z.string().uuid().optional(),
  pilgrimName: z.string().min(1, "Pilgrim name is required"),
  city: z.string().min(1, "City is required"),
  quote: z.string().min(1, "Review text is required"),
  packageOrJourneyType: z.string().min(1, "Journey type is required"),
  rating: z.number().int().min(1).max(5).default(5),
  avatarUrl: z.string().optional(),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
})

export const faqSchema = z.object({
  id: z.string().uuid().optional(),
  category: z
    .enum(["general", "visa", "hotels", "transport", "packages", "hajj"])
    .default("general"),
  question: z.string().min(1, "Question is required"),
  answer: z.string().min(1, "Answer is required"),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
})

export const contactMessageSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().trim().min(7, "Valid phone number required"),
  whatsapp: z.string().trim().optional(),
  subject: z.string().trim().min(3, "Subject is required"),
  message: z.string().trim().min(10, "Message must be at least 10 characters"),
})

export type HeroSlideInput = z.infer<typeof heroSlideSchema>
export type TestimonialInput = z.infer<typeof testimonialSchema>
export type FaqInput = z.infer<typeof faqSchema>
export type ContactMessageInput = z.infer<typeof contactMessageSchema>
