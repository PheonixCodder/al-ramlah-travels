import crypto from "node:crypto"
import { env } from "@/lib/env"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

/**
 * Derives a 32-byte cryptographic key for AES-256-GCM token encryption.
 * In production, strictly requires ENCRYPTION_KEY (64 hex characters or 32 bytes).
 * In development / test, falls back safely to SHA-256(BETTER_AUTH_SECRET).
 */
function getEncryptionKey(): Buffer {
  const customKey = env.ENCRYPTION_KEY?.trim()
  if (customKey) {
    if (customKey.length === 64 && /^[0-9a-fA-F]+$/.test(customKey)) {
      return Buffer.from(customKey, "hex")
    }
    if (Buffer.byteLength(customKey, "utf8") === 32) {
      return Buffer.from(customKey, "utf8")
    }
    return crypto.createHash("sha256").update(customKey).digest()
  }

  if (env.NODE_ENV === "production") {
    throw new Error(
      "Missing ENCRYPTION_KEY: Production requires a dedicated 32-byte hex encryption key in environment variables."
    )
  }

  const fallbackSource =
    env.BETTER_AUTH_SECRET || "al-ramlah-travels-dev-encryption-key-fallback"
  return crypto.createHash("sha256").update(fallbackSource).digest()
}

/**
 * Encrypts a sensitive string (such as an OAuth access or refresh token) using AES-256-GCM.
 * Output format: `${ivHex}:${authTagHex}:${ciphertextHex}`
 */
export function encryptToken(plaintext: string): string {
  if (!plaintext) {
    return ""
  }
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })

  let encrypted = cipher.update(plaintext, "utf8", "hex")
  encrypted += cipher.final("hex")
  const authTag = cipher.getAuthTag()

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`
}

/**
 * Decrypts a token payload encrypted with AES-256-GCM.
 * Expects format: `${ivHex}:${authTagHex}:${ciphertextHex}`
 */
export function decryptToken(payload: string): string {
  if (!payload) {
    return ""
  }
  const parts = payload.split(":")
  if (parts.length !== 3) {
    throw new Error(
      "Invalid encrypted token format. Expected iv:authTag:ciphertext"
    )
  }

  const [ivHex, authTagHex, encryptedHex] = parts
  const key = getEncryptionKey()
  const iv = Buffer.from(ivHex, "hex")
  const authTag = Buffer.from(authTagHex, "hex")

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes`)
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(
      `Invalid auth tag length: expected ${AUTH_TAG_LENGTH} bytes`
    )
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })
  decipher.setAuthTag(authTag)

  try {
    let decrypted = decipher.update(encryptedHex, "hex", "utf8")
    decrypted += decipher.final("utf8")
    return decrypted
  } catch {
    throw new Error(
      "Decryption failed: Token authentication tag mismatch or corrupted ciphertext."
    )
  }
}
