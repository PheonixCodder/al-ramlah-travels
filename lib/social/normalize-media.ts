import sharp, { type Metadata } from "sharp"
import {
  fetchSafeSocialMediaBuffer,
  MAX_SOCIAL_IMAGE_BYTES,
} from "@/lib/social/safe-media"

const MAX_SHARP_INPUT_PIXELS = 67_108_864 // 8192 x 8192 decompression-bomb guard
const LUXURY_ALABASTER_BG = { r: 250, g: 247, b: 240 } // #FAF7F0 Warm Ivory

export interface ImageDimensions {
  width: number
  height: number
  orientation?: number
  format?: string
}

export interface NormalizeOptions {
  maxShorterSide?: number
  quality?: number
  padForInstagramFeed?: boolean
}

export interface NormalizedImageResult {
  buffer: Buffer
  width: number
  height: number
  format: "jpeg"
}

/**
 * Resolves an image Buffer from either an in-memory Buffer or a verified HTTPS R2 URL (`T-034`).
 * Local filesystem path reads are strictly forbidden to prevent path traversal.
 */
async function resolveImageBuffer(input: Buffer | string): Promise<Buffer> {
  if (Buffer.isBuffer(input)) {
    if (input.byteLength > MAX_SOCIAL_IMAGE_BYTES) {
      throw new Error(
        `Image buffer size (${input.byteLength} bytes) exceeds maximum allowed (${MAX_SOCIAL_IMAGE_BYTES} bytes)`
      )
    }
    return input
  }

  if (typeof input === "string") {
    const fetched = await fetchSafeSocialMediaBuffer(input, {
      maxBytes: MAX_SOCIAL_IMAGE_BYTES,
    })
    return fetched.buffer
  }

  throw new Error("Invalid image input: expected Buffer or safe HTTPS media URL")
}

function getOrientedDimensions(meta: Metadata): {
  width: number
  height: number
} {
  const rawW = meta.width ?? 1080
  const rawH = meta.height ?? 1080
  const orientation = meta.orientation ?? 1
  if (orientation >= 5 && orientation <= 8) {
    return { width: rawH, height: rawW }
  }
  return { width: rawW, height: rawH }
}

/**
 * Inspects the intrinsic post-EXIF-rotation dimensions and format of an image (`T-070`).
 */
export async function inspectImageDimensions(
  input: Buffer | string
): Promise<ImageDimensions> {
  const buffer = await resolveImageBuffer(input)
  const metadata = await sharp(buffer, {
    limitInputPixels: MAX_SHARP_INPUT_PIXELS,
  }).metadata()
  const oriented = getOrientedDimensions(metadata)

  return {
    width: oriented.width,
    height: oriented.height,
    orientation: metadata.orientation,
    format: metadata.format,
  }
}

/**
 * Normalizes oversized social media images (e.g. 4K 3240x4560 flyers or camera photos with EXIF rotation)
 * into crisp progressive JPEGs where the shorter dimension does not exceed `maxShorterSide` (default 1080px).
 * Applies `.rotate()` BEFORE resizing so EXIF-rotated portraits are never rendered sideways (`T-070`),
 * and optionally pads tall/wide assets into Instagram Feed's `0.8..1.91` aspect ratio window on `#FAF7F0`.
 */
export async function normalizeImageForSocialBuffer(
  input: Buffer | string,
  options: NormalizeOptions = {}
): Promise<NormalizedImageResult> {
  const maxShorterSide = options.maxShorterSide ?? 1080
  const quality = options.quality ?? 92

  const buffer = await resolveImageBuffer(input)
  const meta = await sharp(buffer, {
    limitInputPixels: MAX_SHARP_INPUT_PIXELS,
  }).metadata()
  const { width: origWidth, height: origHeight } = getOrientedDimensions(meta)

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

  // Always apply EXIF auto-orientation BEFORE resizing or stripping metadata
  let pipeline = sharp(buffer, {
    limitInputPixels: MAX_SHARP_INPUT_PIXELS,
  }).rotate()

  if (options.padForInstagramFeed) {
    const aspect = origWidth / Math.max(1, origHeight)
    if (aspect < 0.8) {
      // Portrait taller than 4:5 (e.g. 1080x1520 poster) -> fit inside 1080x1350 Warm Ivory canvas
      pipeline = pipeline.resize(1080, 1350, {
        fit: "contain",
        background: LUXURY_ALABASTER_BG,
      })
      targetWidth = 1080
      targetHeight = 1350
    } else if (aspect > 1.91) {
      pipeline = pipeline.resize(1080, 566, {
        fit: "contain",
        background: LUXURY_ALABASTER_BG,
      })
      targetWidth = 1080
      targetHeight = 566
    } else if (targetWidth !== origWidth || targetHeight !== origHeight) {
      pipeline = pipeline.resize(targetWidth, targetHeight, {
        fit: "inside",
        withoutEnlargement: true,
      })
    }
  } else if (targetWidth !== origWidth || targetHeight !== origHeight) {
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

  const finalMeta = await sharp(outputBuffer, {
    limitInputPixels: MAX_SHARP_INPUT_PIXELS,
  }).metadata()

  return {
    buffer: outputBuffer,
    width: finalMeta.width ?? targetWidth,
    height: finalMeta.height ?? targetHeight,
    format: "jpeg",
  }
}
