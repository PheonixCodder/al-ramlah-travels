import crypto from "node:crypto"

/**
 * Versioned Authenticated Token Vault (`v2:<kid>:<ivHex>:<tagHex>:<ctHex>`)
 * - Cipher: AES-256-GCM (96-bit random IV, 128-bit authentication tag)
 * - KDF: HKDF-SHA256 domain-separated subkeys (`al-ramlah-vault-v2`)
 * - Keyring Rotation: Primary `ENCRYPTION_KEY` + optional `ENCRYPTION_KEY_PREVIOUS`
 * - Legacy Migration: Decrypts legacy 3-part AES-256-GCM tokens (`iv:ct:tag` & `iv:tag:ct`),
 *   while hard-rejecting unauthenticated 2-part AES-CBC ciphertexts.
 */

const VAULT_PREFIX = "v2"
const GCM_ALGORITHM = "aes-256-gcm"
const GCM_IV_BYTES = 12
const GCM_TAG_BYTES = 16
const HKDF_SALT = Buffer.from("al-ramlah-vault-salt-v2", "utf8")
const HKDF_INFO = Buffer.from("al-ramlah-vault-aes-256-gcm-v2", "utf8")
const HKDF_KID_INFO = Buffer.from("al-ramlah-vault-key-id-v2", "utf8")
const HEX_64_REGEX = /^[0-9a-fA-F]{64}$/

interface VaultKeyEntry {
  kid: string
  v2Key: Buffer
  legacyRawKey: Buffer
}

function parseMasterKeyMaterial(rawSecret: string, isProduction: boolean): Buffer {
  const trimmed = rawSecret.trim()
  if (HEX_64_REGEX.test(trimmed)) {
    return Buffer.from(trimmed, "hex")
  }
  if (isProduction) {
    throw new Error(
      "Vault ENCRYPTION_KEY must be a 64-character hexadecimal string (32 bytes) in production."
    )
  }
  return crypto.createHash("sha256").update(trimmed, "utf8").digest()
}

function deriveVaultKeyEntry(masterMaterial: Buffer): VaultKeyEntry {
  const v2Key = Buffer.from(
    crypto.hkdfSync("sha256", masterMaterial, HKDF_SALT, HKDF_INFO, 32)
  )
  const kidBytes = Buffer.from(
    crypto.hkdfSync("sha256", masterMaterial, HKDF_SALT, HKDF_KID_INFO, 4)
  )
  return {
    kid: kidBytes.toString("hex"),
    v2Key,
    legacyRawKey: masterMaterial,
  }
}

function resolveKeyring(sourceEnv: NodeJS.ProcessEnv = process.env): VaultKeyEntry[] {
  const isProd = sourceEnv.NODE_ENV === "production"
  const primaryRaw = sourceEnv.ENCRYPTION_KEY?.trim()

  const entries: VaultKeyEntry[] = []

  if (primaryRaw) {
    entries.push(deriveVaultKeyEntry(parseMasterKeyMaterial(primaryRaw, isProd)))
  } else if (isProd) {
    throw new Error(
      "ENCRYPTION_KEY is strictly required in production for vault encryption/decryption."
    )
  } else {
    const devFallback =
      sourceEnv.BETTER_AUTH_SECRET?.trim() ||
      "al-ramlah-travels-non-prod-vault-fallback-secret"
    const devMaster = crypto.createHash("sha256").update(devFallback, "utf8").digest()
    entries.push(deriveVaultKeyEntry(devMaster))
  }

  const previousRaw = sourceEnv.ENCRYPTION_KEY_PREVIOUS?.trim()
  if (previousRaw) {
    entries.push(deriveVaultKeyEntry(parseMasterKeyMaterial(previousRaw, isProd)))
  }

  return entries
}

export interface VaultOptions {
  env?: NodeJS.ProcessEnv
  legacyFormat?: "auto" | "iv-ct-tag" | "iv-tag-ct"
}

export function isVaultCiphertext(value: string | null | undefined): boolean {
  if (!value) return false
  const parts = value.split(":")
  return (
    parts.length === 5 &&
    parts[0] === VAULT_PREFIX &&
    /^[0-9a-f]{8}$/i.test(parts[1] ?? "") &&
    /^[0-9a-f]{24}$/i.test(parts[2] ?? "") &&
    /^[0-9a-f]{32}$/i.test(parts[3] ?? "")
  )
}

export function encryptVaultSecret(
  plaintext: string,
  options: VaultOptions = {}
): string {
  if (!plaintext) return ""
  if (isVaultCiphertext(plaintext)) {
    return plaintext
  }

  const keyring = resolveKeyring(options.env)
  const primary = keyring[0]!
  const iv = crypto.randomBytes(GCM_IV_BYTES)
  const cipher = crypto.createCipheriv(GCM_ALGORITHM, primary.v2Key, iv, {
    authTagLength: GCM_TAG_BYTES,
  })

  const ctBuf = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `${VAULT_PREFIX}:${primary.kid}:${iv.toString("hex")}:${authTag.toString("hex")}:${ctBuf.toString("hex")}`
}

function tryGcmDecrypt(
  key: Buffer,
  ivHex: string,
  tagHex: string,
  ctHex: string
): string {
  if (!/^[0-9a-fA-F]+$/.test(ivHex) || !/^[0-9a-fA-F]+$/.test(tagHex)) {
    throw new Error("Invalid hex encoding in vault IV or authentication tag")
  }
  if (ctHex.length > 0 && !/^[0-9a-fA-F]+$/.test(ctHex)) {
    throw new Error("Invalid hex encoding in vault ciphertext")
  }

  const iv = Buffer.from(ivHex, "hex")
  const tag = Buffer.from(tagHex, "hex")
  const ct = ctHex.length > 0 ? Buffer.from(ctHex, "hex") : Buffer.alloc(0)

  if (iv.length !== GCM_IV_BYTES) {
    throw new Error(`Invalid GCM IV length (${iv.length} bytes)`)
  }
  if (tag.length !== GCM_TAG_BYTES) {
    throw new Error(`Invalid GCM auth tag length (${tag.length} bytes)`)
  }

  const decipher = crypto.createDecipheriv(GCM_ALGORITHM, key, iv, {
    authTagLength: GCM_TAG_BYTES,
  })
  decipher.setAuthTag(tag)

  const decrypted = Buffer.concat([decipher.update(ct), decipher.final()])
  return decrypted.toString("utf8")
}

export function decryptVaultSecret(
  ciphertext: string,
  options: VaultOptions = {}
): string {
  if (!ciphertext) return ""

  const parts = ciphertext.split(":")
  const keyring = resolveKeyring(options.env)

  // Version 2 envelope: v2:<kid>:<ivHex>:<tagHex>:<ctHex>
  if (parts[0] === VAULT_PREFIX) {
    if (parts.length !== 5) {
      throw new Error("Malformed v2 vault envelope")
    }
    const [, kid, ivHex, tagHex, ctHex] = parts as [
      string,
      string,
      string,
      string,
      string,
    ]

    // Prioritize matching key ID first, then remaining keyring entries
    const orderedKeys = [
      ...keyring.filter((k) => k.kid === kid),
      ...keyring.filter((k) => k.kid !== kid),
    ]

    for (const entry of orderedKeys) {
      try {
        return tryGcmDecrypt(entry.v2Key, ivHex, tagHex, ctHex)
      } catch {
        // Try next rotated key in keyring
      }
    }

    throw new Error(
      "Vault decryption failed: authentication tag mismatch or unknown encryption key."
    )
  }

  // Explicitly block legacy unauthenticated 2-part AES-CBC ciphertexts (T-008)
  if (parts.length === 2) {
    throw new Error(
      "Rejected legacy unauthenticated AES-CBC ciphertext; re-authenticate credential using AES-256-GCM v2 vault."
    )
  }

  // Legacy 3-part AES-256-GCM migration support (wacrm `iv:ct:tag` & social `iv:tag:ct`)
  if (parts.length === 3) {
    const [p0, p1, p2] = parts as [string, string, string]
    const mode = options.legacyFormat ?? "auto"

    for (const entry of keyring) {
      if (mode === "iv-ct-tag" || mode === "auto") {
        try {
          return tryGcmDecrypt(entry.legacyRawKey, p0, p2, p1)
        } catch {
          // Continue if auto
        }
      }
      if (mode === "iv-tag-ct" || mode === "auto") {
        try {
          return tryGcmDecrypt(entry.legacyRawKey, p0, p1, p2)
        } catch {
          // Continue to next key
        }
      }
    }

    throw new Error(
      "Legacy GCM token decryption failed: authentication tag mismatch or corrupted ciphertext."
    )
  }

  throw new Error("Unrecognized vault ciphertext format")
}

export const encrypt = encryptVaultSecret
export const decrypt = decryptVaultSecret
