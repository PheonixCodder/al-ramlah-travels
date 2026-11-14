import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import { DeleteObjectsCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import * as r2Module from "../../../lib/storage/r2"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = path.resolve(__dirname, "../../..")

interface CapturedS3Call {
  command: unknown
  options: { abortSignal?: AbortSignal } | undefined
}

function withEnvOverrides<T>(
  overrides: Record<string, string | undefined>,
  fn: () => Promise<T>
): Promise<T> {
  const saved: Record<string, string | undefined> = {}
  for (const key of Object.keys(overrides)) {
    saved[key] = process.env[key]
    const nextVal = overrides[key]
    if (nextVal === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = nextVal
    }
  }
  return fn().finally(() => {
    for (const [key, prevVal] of Object.entries(saved)) {
      if (prevVal === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = prevVal
      }
    }
  })
}

describe("F-INFRA T-052: S3Client Bounded Timeouts, Immutable Versioned Keys & deleteR2Objects Lifecycle", () => {
  it("T-052: replaces hand-rolled SigV4 fetch with official S3Client + NodeHttpHandler timeouts and avoids copying Buffer bytes", async () => {
    const r2Source = fs.readFileSync(
      path.join(WEB_ROOT, "lib/storage/r2.ts"),
      "utf8"
    )
    assert.ok(
      !r2Source.includes("AWS4-HMAC-SHA256"),
      "Hand-rolled AWS4-HMAC-SHA256 uploader must be replaced by @aws-sdk/client-s3"
    )
    assert.ok(
      r2Source.includes("DeleteObjectsCommand") &&
        r2Source.includes("GetObjectCommand") &&
        r2Source.includes("PutObjectCommand"),
      "lib/storage/r2.ts must use PutObjectCommand, GetObjectCommand, and DeleteObjectsCommand"
    )

    const r2Extended = r2Module as typeof r2Module & {
      buildVersionedStorageKey: (
        folder: string,
        filename: string,
        versionTag?: string
      ) => string
      deleteR2Objects: (keys: readonly string[]) => Promise<{
        deleted: string[]
        errors: Array<{ key: string; message: string }>
        provider: "cloudflare_r2" | "local_r2_fallback"
      }>
      R2_LIFECYCLE_RULES: {
        abortIncompleteMultipartUploadDays: number
        passportRetentionDaysAfterReturn: number
        unbookedLeadMediaRetentionDays: number
        financialReceiptRetentionDays: number
      }
      setR2S3ClientOverrideForTests: (
        client: {
          send: (
            command: unknown,
            options?: { abortSignal?: AbortSignal }
          ) => Promise<unknown>
        } | null
      ) => void
    }

    // Verify OD-06 & T-052 lifecycle constants
    assert.equal(r2Extended.R2_LIFECYCLE_RULES.abortIncompleteMultipartUploadDays, 1)
    assert.equal(r2Extended.R2_LIFECYCLE_RULES.passportRetentionDaysAfterReturn, 60)
    assert.equal(r2Extended.R2_LIFECYCLE_RULES.unbookedLeadMediaRetentionDays, 730)
    assert.equal(r2Extended.R2_LIFECYCLE_RULES.financialReceiptRetentionDays, 2190)

    // Verify distinct immutable versioned keys
    const keyA = r2Extended.buildVersionedStorageKey("posters/spotlights", "art-spot.png")
    const keyB = r2Extended.buildVersionedStorageKey("posters/spotlights", "art-spot.png")
    assert.notEqual(keyA, keyB, "Versioned keys must never collide across successive renders")
    assert.match(keyA, /^posters\/spotlights\/\d+-[0-9a-f]{16}-art-spot\.png$/)

    // Verify PutObjectCommand + DeleteObjectsCommand pass original Buffer reference and AbortSignal timeout
    const capturedCalls: CapturedS3Call[] = []
    r2Extended.setR2S3ClientOverrideForTests({
      send: async (command, options) => {
        capturedCalls.push({ command, options })
        if (command instanceof DeleteObjectsCommand) {
          const objects = command.input.Delete?.Objects ?? []
          return {
            Deleted: objects.map((obj) => ({ Key: obj.Key })),
            Errors: [],
          }
        }
        return {}
      },
    })

    try {
      await withEnvOverrides(
        {
          NODE_ENV: "production",
          R2_ACCOUNT_ID: "acc_prod_test",
          R2_ACCESS_KEY_ID: "key_prod_test",
          R2_SECRET_ACCESS_KEY: "secret_prod_test",
          R2_BUCKET_NAME: "al-ramlah-assets",
          R2_PUBLIC_URL: "https://cdn.alramlahtravels.com",
        },
        async () => {
          const payload = Buffer.from("immutable-poster-binary-bytes", "utf8")
          const uploadRes = await r2Module.uploadAssetToR2(
            keyA,
            payload,
            "image/png"
          )

          assert.equal(uploadRes.provider, "cloudflare_r2")
          assert.equal(uploadRes.url, `https://cdn.alramlahtravels.com/${keyA}`)
          assert.equal(capturedCalls.length, 1)

          const putCmd = capturedCalls[0]!.command
          assert.ok(putCmd instanceof PutObjectCommand)
          assert.equal(
            putCmd.input.Body,
            payload,
            "PutObjectCommand must pass Buffer directly without copying via new Uint8Array(buffer)"
          )
          assert.match(putCmd.input.CacheControl ?? "", /immutable/)
          assert.ok(
            capturedCalls[0]!.options?.abortSignal instanceof AbortSignal,
            "S3 send must attach bounded AbortSignal.timeout"
          )

          // Batch delete deduplicates & normalizes both URLs and keys
          const delRes = await r2Extended.deleteR2Objects([
            keyA,
            `https://cdn.alramlahtravels.com/${keyB}`,
            `/api/media/passports/scan-01.pdf`,
            keyA, // duplicate should be deduplicated
          ])

          assert.equal(delRes.provider, "cloudflare_r2")
          assert.equal(delRes.deleted.length, 3)
          assert.equal(delRes.errors.length, 0)

          const deleteCmd = capturedCalls[1]!.command
          assert.ok(deleteCmd instanceof DeleteObjectsCommand)
          assert.equal(deleteCmd.input.Delete?.Objects?.length, 3)
          assert.ok(
            capturedCalls[1]!.options?.abortSignal instanceof AbortSignal,
            "DeleteObjectsCommand must attach bounded AbortSignal.timeout"
          )
        }
      )
    } finally {
      r2Extended.setR2S3ClientOverrideForTests(null)
    }
  })
})
