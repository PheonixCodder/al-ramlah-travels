import crypto from "node:crypto"
import {
  decryptVaultSecret,
  encryptVaultSecret,
  isVaultCiphertext,
} from "@/lib/security/vault"

/**
 * WhatsApp token authenticated encryption delegating to the shared
 * Versioned Authenticated Token Vault (`lib/security/vault.ts` — `T-067` / `T-008`).
 *
 * - Primary write format: `v2:<kid>:<ivHex>:<tagHex>:<ctHex>` (HKDF-SHA256 + AES-256-GCM)
 * - Keyring rotation: supports `ENCRYPTION_KEY` + `ENCRYPTION_KEY_PREVIOUS`
 * - Legacy migration: decrypts legacy 3-part AES-256-GCM tokens (`iv:ct:tag` & `iv:tag:ct`)
 *   while hard-rejecting unauthenticated 2-part AES-CBC ciphertexts.
 */

export const GCM_IV_LENGTH = 12
export const CBC_IV_LENGTH = 16
export const AUTH_TAG_LENGTH = 16

const MASKED_SECRET_PATTERNS: ReadonlyArray<RegExp> = [
  /^[•*·]{4,}/u,
  /[•]{3,}/u,
  /\*{4,}/,
  /^REDACTED$/i,
  /^UNCHANGED$/i,
  /^\[REDACTED\]$/i,
]

/**
 * Derives a 32-byte key for callers inspecting key availability.
 * Production strictly requires a 64-hex `ENCRYPTION_KEY`.
 */
export function getDerivedEncryptionKey(): Buffer {
  const isProd = process.env.NODE_ENV === "production"
  const rawKey = process.env.ENCRYPTION_KEY?.trim()

  if (rawKey) {
    if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
      return Buffer.from(rawKey, "hex")
    }
    if (isProd) {
      throw new Error(
        "ENCRYPTION_KEY must be a 64-character hexadecimal string (32 bytes) in production."
      )
    }
    return crypto.createHash("sha256").update(rawKey, "utf8").digest()
  }

  if (isProd) {
    throw new Error(
      "ENCRYPTION_KEY is strictly required in production environment for Meta token security."
    )
  }

  const fallbackSecret =
    process.env.BETTER_AUTH_SECRET?.trim() ||
    "al-ramlah-travels-non-prod-vault-fallback-secret"
  return crypto.createHash("sha256").update(fallbackSecret, "utf8").digest()
}

/**
 * Detects whether a token string submitted from an admin settings form is a UI mask,
 * placeholder, or an already-encrypted vault envelope that must NOT be re-encrypted.
 */
export function isMaskedOrEncryptedToken(
  value: string | null | undefined
): boolean {
  if (!value) return true
  const trimmed = value.trim()
  if (!trimmed) return true
  if (isVaultCiphertext(trimmed)) return true
  if (isLegacyThreePartGcmCiphertext(trimmed)) return true
  return MASKED_SECRET_PATTERNS.some((pattern) => pattern.test(trimmed))
}

function isLegacyThreePartGcmCiphertext(value: string): boolean {
  const parts = value.split(":")
  if (parts.length !== 3) return false
  const [p0, p1, p2] = parts
  if (!p0 || !p1 || !p2) return false
  return (
    /^[0-9a-fA-F]{24}$/.test(p0) &&
    /^[0-9a-fA-F]+$/.test(p1) &&
    /^[0-9a-fA-F]+$/.test(p2) &&
    (p1.length === 32 || p2.length === 32)
  )
}

/**
 * Produces a safe UI display mask for an access token without exposing secret material.
 */
export function maskAccessToken(token: string | null | undefined): string {
  if (!token) return ""
  const trimmed = token.trim()
  if (trimmed.length <= 8) return "••••••••"
  return `${trimmed.slice(0, 4)}••••••••${trimmed.slice(-4)}`
}

/**
 * Encrypts a sensitive string (such as a Meta WABA access token) using the shared v2 AES-256-GCM vault.
 */
export function encrypt(text: string): string {
  if (!text) return ""
  const trimmed = text.trim()
  if (!trimmed) return ""
  if (MASKED_SECRET_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    throw new Error(
      "Refusing to encrypt a masked or redacted placeholder token."
    )
  }
  return encryptVaultSecret(trimmed)
}

/**
 * Decrypts a token ciphertext using the shared v2 vault (with legacy 3-part GCM read support).
 * Throws an Error on authentication tag mismatch, unauthenticated 2-part CBC, or malformed input.
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return ""
  return decryptVaultSecret(encryptedText, { legacyFormat: "auto" })
}

/**
 * Checks if ciphertext is stored in a pre-v2 legacy format (2-part CBC or 3-part un-keyed GCM).
 */
export function isLegacyFormat(encryptedText: string): boolean {
  if (!encryptedText) return false
  if (isVaultCiphertext(encryptedText)) return false
  const partCount = encryptedText.split(":").length
  return partCount === 2 || partCount === 3
}
