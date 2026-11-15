import {
  decryptVaultSecret,
  encryptVaultSecret,
  isVaultCiphertext,
} from "@/lib/security/vault"

const LEGACY_IV_BYTES = 12
const LEGACY_AUTH_TAG_BYTES = 16

/**
 * Encrypts a sensitive OAuth token or pending candidate credential via the
 * versioned AES-256-GCM HKDF vault (`lib/security/vault.ts`, `T-069`).
 * Output format: `v2:<kid>:<ivHex>:<tagHex>:<ciphertextHex>`
 */
export function encryptToken(plaintext: string): string {
  if (!plaintext) {
    return ""
  }
  return encryptVaultSecret(plaintext, { legacyFormat: "iv-tag-ct" })
}

/**
 * Decrypts a social credential encrypted with either the v2 HKDF AES-256-GCM vault
 * (`v2:<kid>:<iv>:<tag>:<ct>`) or legacy 3-part AES-256-GCM (`iv:tag:ciphertext`).
 */
export function decryptToken(payload: string): string {
  if (!payload) {
    return ""
  }

  if (payload.startsWith("v2:")) {
    if (!isVaultCiphertext(payload)) {
      throw new Error(
        "Invalid encrypted token format. Malformed v2 vault envelope."
      )
    }
    try {
      return decryptVaultSecret(payload, { legacyFormat: "iv-tag-ct" })
    } catch {
      throw new Error(
        "Decryption failed: Token authentication tag mismatch or corrupted ciphertext."
      )
    }
  }

  const parts = payload.split(":")
  if (parts.length !== 3) {
    throw new Error(
      "Invalid encrypted token format. Expected v2 vault envelope or iv:authTag:ciphertext"
    )
  }

  const [ivHex, authTagHex, encryptedHex] = parts as [string, string, string]
  if (!/^[0-9a-fA-F]+$/.test(ivHex)) {
    throw new Error(`Invalid IV length: expected ${LEGACY_IV_BYTES} bytes`)
  }
  if (!/^[0-9a-fA-F]+$/.test(authTagHex)) {
    throw new Error(
      `Invalid auth tag length: expected ${LEGACY_AUTH_TAG_BYTES} bytes`
    )
  }
  if (encryptedHex.length > 0 && !/^[0-9a-fA-F]+$/.test(encryptedHex)) {
    throw new Error(
      "Decryption failed: Token authentication tag mismatch or corrupted ciphertext."
    )
  }

  const iv = Buffer.from(ivHex, "hex")
  const authTag = Buffer.from(authTagHex, "hex")

  if (iv.length !== LEGACY_IV_BYTES) {
    throw new Error(`Invalid IV length: expected ${LEGACY_IV_BYTES} bytes`)
  }
  if (authTag.length !== LEGACY_AUTH_TAG_BYTES) {
    throw new Error(
      `Invalid auth tag length: expected ${LEGACY_AUTH_TAG_BYTES} bytes`
    )
  }

  try {
    return decryptVaultSecret(payload, { legacyFormat: "iv-tag-ct" })
  } catch {
    throw new Error(
      "Decryption failed: Token authentication tag mismatch or corrupted ciphertext."
    )
  }
}
