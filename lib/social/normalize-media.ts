import fs from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

export interface ImageDimensions {
  width: number
  height: number
  format?: string
}

export interface NormalizeOptions {
  maxShorterSide?: number
  quality?: number
}

export interface NormalizedImageResult {
  buffer: Buffer
  width: number
  height: number
  format: "jpeg"
}

/**
 * Resolves a Buffer from either an existing Buffer, a public file path, or a remote URL.
 */
async function resolveImageBuffer(input: Buffer | string): Promise<Buffer> {
  if (Buffer.isBuffer(input)) {
    return input
  }

  if (typeof input === "string") {
    if (input.startsWith("http://") || input.startsWith("https://")) {
      const res = await fetch(input)
      if (!res.ok) {
        throw new Error(
          `Failed to fetch image from URL: ${input} (status ${res.status})`
        )
      }
      const arrayBuffer = await res.arrayBuffer()
      return Buffer.from(arrayBuffer)
    }

    // Relative public file path (e.g. /uploads/r2-local/...)
    const cleanPath = input.startsWith("/") ? input.slice(1) : input
    const localFilePath = path.join(process.cwd(), "public", cleanPath)
    return await fs.readFile(localFilePath)
  }

  throw new Error("Invalid image input: expected Buffer or URL/filepath string")
}

/**
 * Inspects the intrinsic dimensions and format of an image.
 */
export async function inspectImageDimensions(
  input: Buffer | string
): Promise<ImageDimensions> {
  const buffer = await resolveImageBuffer(input)
  const metadata = await sharp(buffer).metadata()

  return {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    format: metadata.format,
  }
}

/**
 * Normalizes oversized social media images (e.g. 4K 3240x4560 flyers or posters)
 * into crisp progressive JPEGs where the shorter dimension does not exceed 1080px.
 * Preserves exact aspect ratio and ensures full compliance with TikTok and Instagram upload limits.
 */
export async function normalizeImageForSocialBuffer(
  input: Buffer | string,
  options: NormalizeOptions = {}
): Promise<NormalizedImageResult> {
  const maxShorterSide = options.maxShorterSide ?? 1080
  const quality = options.quality ?? 92

  const buffer = await resolveImageBuffer(input)
  const meta = await sharp(buffer).metadata()
  const origWidth = meta.width ?? 1080
  const origHeight = meta.height ?? 1080

  let targetWidth = origWidth
  let targetHeight = origHeight

  const currentShorterSide = Math.min(origWidth, origHeight)

  if (currentShorterSide > maxShorterSide) {
    if (origWidth <= origHeight) {
      targetWidth = maxShorterSide
      targetHeight = Math.round((origHeight / origWidth) * maxShorterSide)
    } else {
      targetHeight = maxShorterSide
      targetWidth = Math.round((origWidth / origHeight) * maxShorterSide)
    }
  }

  let pipeline = sharp(buffer)

  if (targetWidth !== origWidth || targetHeight !== origHeight) {
    pipeline = pipeline.resize(targetWidth, targetHeight, {
      fit: "inside",
      withoutEnlargement: true,
    })
  }

  const outputBuffer = await pipeline
    .jpeg({
      quality,
      progressive: true,
      mozjpeg: true,
    })
    .toBuffer()

  const finalMeta = await sharp(outputBuffer).metadata()

  return {
    buffer: outputBuffer,
    width: finalMeta.width ?? targetWidth,
    height: finalMeta.height ?? targetHeight,
    format: "jpeg",
  }
}
