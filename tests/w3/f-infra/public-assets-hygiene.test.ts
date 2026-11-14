import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = path.resolve(__dirname, "../../..")
const PUBLIC_DIR = path.join(WEB_ROOT, "public")
const UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads")

function listFilesRecursively(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) {
    return []
  }

  const results: string[] = []
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      results.push(...listFilesRecursively(fullPath))
    } else if (entry.isFile() && entry.name !== ".gitkeep") {
      results.push(fullPath)
    }
  }
  return results
}

describe("F-INFRA T-013: Public Assets Hygiene & Brand Logo Compression", () => {
  it("T-013: purges all PDFs, wholesale supplier sheets, and tracked r2-local/sample-posts files from public/uploads/", () => {
    const remainingFiles = listFilesRecursively(UPLOADS_DIR)
    const pdfFiles = remainingFiles.filter((filePath) =>
      filePath.toLowerCase().endsWith(".pdf")
    )

    assert.deepEqual(
      pdfFiles,
      [],
      `Expected zero .pdf files under public/uploads/, found: ${pdfFiles.join(", ")}`
    )
    assert.deepEqual(
      remainingFiles,
      [],
      `Expected zero sample or local R2 artifact files under public/uploads/, found: ${remainingFiles.join(", ")}`
    )
  })

  it("T-013: compresses public/logo-icon.png (< 40 KB) and public/logo.jpg (< 80 KB) while preserving crisp brand imagery", async () => {
    const logoIconPath = path.join(PUBLIC_DIR, "logo-icon.png")
    const logoJpgPath = path.join(PUBLIC_DIR, "logo.jpg")

    assert.ok(fs.existsSync(logoIconPath), "public/logo-icon.png must exist")
    assert.ok(fs.existsSync(logoJpgPath), "public/logo.jpg must exist")

    const iconStats = fs.statSync(logoIconPath)
    const jpgStats = fs.statSync(logoJpgPath)

    assert.ok(
      iconStats.size > 0 && iconStats.size < 40 * 1024,
      `Expected public/logo-icon.png < 40 KB (< 100 KB cap), got ${iconStats.size} bytes`
    )
    assert.ok(
      jpgStats.size > 0 && jpgStats.size < 80 * 1024,
      `Expected public/logo.jpg < 80 KB (< 100 KB cap), got ${jpgStats.size} bytes`
    )

    const iconMeta = await sharp(logoIconPath).metadata()
    const jpgMeta = await sharp(logoJpgPath).metadata()

    assert.equal(iconMeta.format, "png")
    assert.ok((iconMeta.width ?? 0) >= 256 && (iconMeta.height ?? 0) >= 256)
    assert.equal(iconMeta.width, iconMeta.height, "logo-icon.png must remain square")

    assert.equal(jpgMeta.format, "jpeg")
    assert.ok((jpgMeta.width ?? 0) >= 480 && (jpgMeta.height ?? 0) >= 400)

    // Verify 3x base64 embedding inside 3-page quotation HTML stays well under 200 KB
    const iconBase64Bytes = Buffer.byteLength(
      fs.readFileSync(logoIconPath).toString("base64"),
      "utf8"
    )
    assert.ok(
      iconBase64Bytes * 3 < 200 * 1024,
      `3x base64-embedded logo payload must be < 200 KB, got ${iconBase64Bytes * 3} bytes`
    )
  })
})
