import crypto from "node:crypto"
import { env } from "@/lib/env"

/**
 * WhatsApp token authenticated encryption using AES-256-GCM.
 *
 * Current Format:
 *   `<iv-hex>:<ciphertext-hex>:<authTag-hex>` (3 parts)
 *
 * Legacy Format (decrypt-only backwards compatibility):
 *   `<iv-hex>:<ciphertext-hex>` (2 parts, AES-256-CBC)
 */

export const GCM_IV_LENGTH = 12
export const CBC_IV_LENGTH = 16
export const AUTH_TAG_LENGTH = 16

/**
 * Derives a 32-byte key for AES-256.
 * - In production: strictly enforces `ENCRYPTION_KEY`.
 * - In non-production: falls back to `SHA-256(BETTER_AUTH_SECRET)` for developer convenience.
 */
export function getDerivedEncryptionKey(): Buffer {
  const rawKey = process.env.ENCRYPTION_KEY || env.ENCRYPTION_KEY
  if (rawKey && rawKey.trim().length > 0) {
    const trimmed = rawKey.trim()
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      return Buffer.from(trimmed, "hex")
    }
    return crypto.createHash("sha256").update(trimmed, "utf8").digest()
  }

  const isProd =
    process.env.NODE_ENV === "production" || env.NODE_ENV === "production"
  if (isProd) {
    throw new Error(
      "ENCRYPTION_KEY is strictly required in production environment for Meta token security."
    )
  }

  const fallbackSecret =
    process.env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET
  if (!fallbackSecret) {
    throw new Error(
      "Cannot derive encryption key: neither ENCRYPTION_KEY nor BETTER_AUTH_SECRET is configured."
    )
  }

  return crypto.createHash("sha256").update(fallbackSecret, "utf8").digest()
}

/**
 * Encrypts a sensitive string (such as a Meta WABA access token) using AES-256-GCM.
 * Produces `<iv-hex>:<ciphertext-hex>:<authTag-hex>`.
 */
export function encrypt(text: string): string {
  if (!text) return ""
  const iv = crypto.randomBytes(GCM_IV_LENGTH)
  const key = getDerivedEncryptionKey()
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")
  const authTag = cipher.getAuthTag()
  return `${iv.toString("hex")}:${encrypted}:${authTag.toString("hex")}`
}

/**
 * Decrypts a token ciphertext produced by `encrypt` (or legacy CBC).
 * Throws an Error if tampered or invalid.
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return ""
  const parts = encryptedText.split(":")

  if (parts.length === 3) {
    // AES-256-GCM
    const [ivHex, ctHex, tagHex] = parts
    const iv = Buffer.from(ivHex, "hex")
    if (iv.length !== GCM_IV_LENGTH) {
      throw new Error(`Encrypted token has invalid GCM IV length (${iv.length} bytes)`)
    }
    const authTag = Buffer.from(tagHex, "hex")
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error(
        `Encrypted token has invalid GCM auth tag length (${authTag.length} bytes)`
      )
    }

    const key = getDerivedEncryptionKey()
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv)
    decipher.setAuthTag(authTag)
    let decrypted = decipher.update(ctHex, "hex", "utf8")
    decrypted += decipher.final("utf8")
    return decrypted
  }

  if (parts.length === 2) {
    // Legacy AES-256-CBC
    const [ivHex, ctHex] = parts
    const iv = Buffer.from(ivHex, "hex")
    if (iv.length !== CBC_IV_LENGTH) {
      throw new Error(`Encrypted token has invalid CBC IV length (${iv.length} bytes)`)
    }
    const key = getDerivedEncryptionKey()
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv)
    let decrypted = decipher.update(ctHex, "hex", "utf8")
    decrypted += decipher.final("utf8")
    return decrypted
  }

  throw new Error(
    `Encrypted token has unrecognised format (expected 2 or 3 parts separated by colons, got ${parts.length})`
  )
}

/**
 * Checks if ciphertext is stored in the legacy 2-part format.
 */
export function isLegacyFormat(encryptedText: string): boolean {
  if (!encryptedText) return false
  return encryptedText.split(":").length === 2
}
