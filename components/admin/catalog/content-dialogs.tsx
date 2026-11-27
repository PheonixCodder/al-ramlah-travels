"use client"

import * as React from "react"
import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  deleteUnreferencedHeroMediaAction,
  upsertFaq,
  upsertHeroSlide,
  upsertTestimonial,
} from "@/app/actions/cms"
import {
  Film,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react"

const MAX_HERO_MEDIA_BYTES = 25 * 1024 * 1024 // 25 MB (`26,214,400` bytes)
const POSTER_MIME_ALLOWLIST = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
])

function resolvePosterClientMime(file: File): string | null {
  const lowerType = file.type.trim().toLowerCase()
  if (POSTER_MIME_ALLOWLIST.has(lowerType)) {
    return lowerType === "image/jpg" ? "image/jpeg" : lowerType
  }
  const lowerName = file.name.trim().toLowerCase()
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
    return "image/jpeg"
  }
  if (lowerName.endsWith(".png")) {
    return "image/png"
  }
  if (lowerName.endsWith(".webp")) {
    return "image/webp"
  }
  return null
}

function resolveVideoClientMime(file: File): string | null {
  const lowerType = file.type.trim().toLowerCase()
  if (lowerType === "video/mp4") {
    return "video/mp4"
  }
  if (!lowerType && file.name.trim().toLowerCase().endsWith(".mp4")) {
    return "video/mp4"
  }
  return null
}

interface PresignApiSuccess {
  success: true
  uploadUrl: string
  publicUrl: string
  key: string
  contentType?: string
  mode: "r2_presigned" | "local_put"
}

function isRenderablePreviewUrl(raw: string): boolean {
  const trimmed = raw.trim()
  if (!trimmed) return false
  if (trimmed.startsWith("/")) {
    return !trimmed.startsWith("//") && !trimmed.startsWith("/\\")
  }
  return /^https:\/\/[a-z0-9.-]+/i.test(trimmed)
}

interface UploadLifecycleState {
  posterXhr: XMLHttpRequest | null
  videoXhr: XMLHttpRequest | null
  stagedPosterDraft: { key: string; url: string } | null
  stagedVideoDraft: { key: string; url: string } | null
  committed: boolean
}

// ==========================================
// HERO SLIDE DIALOG
// ==========================================

export interface HeroSlideData {
  id?: string
  badge?: string | null
  title: string
  subtitle: string
  imageUrl: string
  videoUrl?: string | null
  primaryCtaLabel: string
  primaryCtaUrl: string
  secondaryCtaLabel?: string | null
  secondaryCtaUrl?: string | null
  isActive: boolean
  sortOrder: number
}

function HeroSlideFormBody({
  slide,
  onSuccess,
}: {
  slide?: HeroSlideData
  onSuccess: () => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [badge, setBadge] = useState(
    slide?.badge ?? "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ"
  )
  const [title, setTitle] = useState(
    slide?.title ?? "Sacred Journeys Crafted with Dignity & Comfort"
  )
  const [subtitle, setSubtitle] = useState(
    slide?.subtitle ??
      "Bespoke Umrah packages, verified Haramain luxury hotels, and private transfers for your family."
  )
  const [imageUrl, setImageUrl] = useState(slide?.imageUrl ?? "")
  const [videoUrl, setVideoUrl] = useState(slide?.videoUrl ?? "")
  const [primaryCtaLabel, setPrimaryCtaLabel] = useState(
    slide?.primaryCtaLabel ?? "Plan Custom Umrah"
  )
  const [primaryCtaUrl, setPrimaryCtaUrl] = useState(
    slide?.primaryCtaUrl ?? "#custom-builder"
  )
  const [secondaryCtaLabel, setSecondaryCtaLabel] = useState(
    slide?.secondaryCtaLabel ?? "Explore Group Packages"
  )
  const [secondaryCtaUrl, setSecondaryCtaUrl] = useState(
    slide?.secondaryCtaUrl ?? "#group-packages"
  )
  const [isActive, setIsActive] = useState(slide?.isActive ?? true)
  const [sortOrder, setSortOrder] = useState(slide?.sortOrder ?? 0)

  const [posterUploading, setPosterUploading] = useState(false)
  const [posterProgress, setPosterProgress] = useState(0)
  const [posterDragActive, setPosterDragActive] = useState(false)

  const [videoUploading, setVideoUploading] = useState(false)
  const [videoProgress, setVideoProgress] = useState(0)
  const [videoDragActive, setVideoDragActive] = useState(false)

  const posterInputRef = useRef<HTMLInputElement | null>(null)
  const videoInputRef = useRef<HTMLInputElement | null>(null)
  const lifecycleRef = useRef<UploadLifecycleState>({
    posterXhr: null,
    videoXhr: null,
    stagedPosterDraft: null,
    stagedVideoDraft: null,
    committed: false,
  })

  useEffect(() => {
    const lifecycle = lifecycleRef.current
    return () => {
      lifecycle.posterXhr?.abort()
      lifecycle.videoXhr?.abort()
      if (!lifecycle.committed) {
        if (lifecycle.stagedPosterDraft) {
          void deleteUnreferencedHeroMediaAction({
            keyOrUrl: lifecycle.stagedPosterDraft.key,
          }).catch(() => undefined)
        }
        if (lifecycle.stagedVideoDraft) {
          void deleteUnreferencedHeroMediaAction({
            keyOrUrl: lifecycle.stagedVideoDraft.key,
          }).catch(() => undefined)
        }
      }
    }
  }, [])

  function discardStagedDraft(slot: "poster" | "video") {
    const lifecycle = lifecycleRef.current
    const prev =
      slot === "poster"
        ? lifecycle.stagedPosterDraft
        : lifecycle.stagedVideoDraft
    if (!prev) return
    if (slot === "poster") {
      lifecycle.stagedPosterDraft = null
    } else {
      lifecycle.stagedVideoDraft = null
    }
    void deleteUnreferencedHeroMediaAction({ keyOrUrl: prev.key }).catch(
      () => undefined
    )
  }

  async function uploadHeroMediaFile(file: File, slot: "poster" | "video") {
    setError(null)

    if (file.size <= 0) {
      setError("Selected file is empty.")
      return
    }
    if (file.size > MAX_HERO_MEDIA_BYTES) {
      setError(
        slot === "video"
          ? "Hero slide video exceeds the 25 MB limit."
          : "Hero slide poster image exceeds the 25 MB limit."
      )
      return
    }

    const clientMime =
      slot === "video"
        ? resolveVideoClientMime(file)
        : resolvePosterClientMime(file)

    if (!clientMime) {
      setError(
        slot === "video"
          ? "Hero slide videos must be MP4 (up to 25 MB)."
          : "Hero slide poster images must be JPEG, PNG, or WebP (up to 25 MB)."
      )
      return
    }

    const setSlotUploading =
      slot === "video" ? setVideoUploading : setPosterUploading
    const setSlotProgress =
      slot === "video" ? setVideoProgress : setPosterProgress
    const lifecycle = lifecycleRef.current
    const folder =
      slot === "video" ? "cms/hero-slides/videos" : "cms/hero-slides/images"

    if (slot === "video") {
      lifecycle.videoXhr?.abort()
    } else {
      lifecycle.posterXhr?.abort()
    }
    setSlotUploading(true)
    setSlotProgress(0)

    try {
      const presignResponse = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: clientMime,
          folder,
          sizeBytes: file.size,
        }),
      })

      const presignJson = (await presignResponse.json()) as
        | PresignApiSuccess
        | { success: false; error?: string }

      if (!presignResponse.ok || !presignJson.success) {
        const message =
          ("error" in presignJson && presignJson.error) ||
          "Failed to initialize media upload."
        setError(message)
        return
      }

      const canonicalMime = presignJson.contentType || clientMime
      const uploadOutcome = await new Promise<
        | {
            ok: true
            publicUrl: string
            storageKey: string
          }
        | {
            ok: false
            aborted?: boolean
            error: string
          }
      >((resolve) => {
        const xhr = new XMLHttpRequest()
        if (slot === "video") {
          lifecycle.videoXhr = xhr
        } else {
          lifecycle.posterXhr = xhr
        }
        xhr.open("PUT", presignJson.uploadUrl, true)
        xhr.withCredentials = !/^https?:\/\//i.test(presignJson.uploadUrl)
        xhr.setRequestHeader("Content-Type", canonicalMime)

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable && evt.total > 0) {
            const pct = Math.min(
              100,
              Math.round((evt.loaded / evt.total) * 100)
            )
            setSlotProgress(pct)
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            let finalUrl = presignJson.publicUrl
            let finalKey = presignJson.key
            if (presignJson.mode === "local_put" && xhr.responseText) {
              try {
                const parsed = JSON.parse(xhr.responseText) as {
                  publicUrl?: string
                  storageKey?: string
                }
                if (parsed.publicUrl) finalUrl = parsed.publicUrl
                if (parsed.storageKey) finalKey = parsed.storageKey
              } catch {
                // Keep presigned local fallback defaults
              }
            }
            resolve({
              ok: true,
              publicUrl: finalUrl,
              storageKey: finalKey,
            })
            return
          }

          let serverMsg = `Upload failed (HTTP ${xhr.status}).`
          if (xhr.responseText) {
            try {
              const errJson = JSON.parse(xhr.responseText) as { error?: string }
              if (errJson.error) serverMsg = errJson.error
            } catch {
              // Keep HTTP status fallback
            }
          }
          resolve({ ok: false, error: serverMsg })
        }

        xhr.onerror = () => {
          resolve({
            ok: false,
            error: "Network error while uploading media file.",
          })
        }

        xhr.onabort = () => {
          resolve({ ok: false, aborted: true, error: "Upload cancelled." })
        }

        xhr.send(file)
      })

      if (slot === "video") {
        lifecycle.videoXhr = null
      } else {
        lifecycle.posterXhr = null
      }
      if (!uploadOutcome.ok) {
        if (!uploadOutcome.aborted) {
          setError(uploadOutcome.error)
        }
        return
      }

      discardStagedDraft(slot)
      if (slot === "video") {
        lifecycle.stagedVideoDraft = {
          key: uploadOutcome.storageKey,
          url: uploadOutcome.publicUrl,
        }
        setVideoUrl(uploadOutcome.publicUrl)
      } else {
        lifecycle.stagedPosterDraft = {
          key: uploadOutcome.storageKey,
          url: uploadOutcome.publicUrl,
        }
        setImageUrl(uploadOutcome.publicUrl)
      }
      setSlotProgress(100)
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to upload media file."
      )
    } finally {
      setSlotUploading(false)
    }
  }

  function handleRemoveVideo() {
    lifecycleRef.current.videoXhr?.abort()
    lifecycleRef.current.videoXhr = null
    setVideoUploading(false)
    setVideoProgress(0)
    discardStagedDraft("video")
    setVideoUrl("")
    if (videoInputRef.current) {
      videoInputRef.current.value = ""
    }
  }

  function handlePosterUrlChange(nextVal: string) {
    if (
      lifecycleRef.current.stagedPosterDraft &&
      nextVal.trim() !== lifecycleRef.current.stagedPosterDraft.url
    ) {
      discardStagedDraft("poster")
    }
    setImageUrl(nextVal)
  }

  function handleVideoUrlChange(nextVal: string) {
    if (
      lifecycleRef.current.stagedVideoDraft &&
      nextVal.trim() !== lifecycleRef.current.stagedVideoDraft.url
    ) {
      discardStagedDraft("video")
    }
    setVideoUrl(nextVal)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!imageUrl.trim()) {
      setError("A poster image is required for every hero slide.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await upsertHeroSlide({
        id: slide?.id,
        badge: badge || undefined,
        title,
        subtitle,
        imageUrl: imageUrl.trim(),
        videoUrl: videoUrl.trim() ? videoUrl.trim() : null,
        primaryCtaLabel,
        primaryCtaUrl,
        secondaryCtaLabel: secondaryCtaLabel || undefined,
        secondaryCtaUrl: secondaryCtaUrl || undefined,
        isActive,
        sortOrder,
      })
      if (res.success) {
        lifecycleRef.current.committed = true
        lifecycleRef.current.stagedPosterDraft = null
        lifecycleRef.current.stagedVideoDraft = null
        onSuccess()
        router.refresh()
      } else {
        setError(res.error || "Failed to save slide.")
      }
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
      else setError("Failed to save slide.")
    } finally {
      setLoading(false)
    }
  }

  const isBusy = loading || posterUploading || videoUploading

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {slide ? "Edit Hero Slide" : "Add Hero Slide"}
        </DialogTitle>
        <DialogDescription>
          Upload a required poster image and an optional silent MP4 background
          loop (up to 25 MB each), then set the slide copy and call to action
          links.
        </DialogDescription>
      </DialogHeader>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-status-danger-border bg-status-danger-bg p-2.5 text-xs text-status-danger"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
        <FieldGroup className="gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Poster Image Uploader */}
            <Field>
              <FieldLabel htmlFor="hs-img">Poster Image (Required)</FieldLabel>
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setPosterDragActive(true)
                }}
                onDragLeave={() => setPosterDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setPosterDragActive(false)
                  const dropped = e.dataTransfer.files?.[0]
                  if (dropped) {
                    void uploadHeroMediaFile(dropped, "poster")
                  }
                }}
                className={`flex flex-col gap-2.5 rounded-xl border border-dashed p-3 transition-colors motion-reduce:transition-none ${
                  posterDragActive
                    ? "border-primary bg-accent/40"
                    : "border-border bg-secondary/40"
                }`}
              >
                {isRenderablePreviewUrl(imageUrl) ? (
                  <div className="relative h-28 w-full overflow-hidden rounded-lg border border-border bg-muted">
                    <Image
                      src={imageUrl.trim()}
                      alt="Hero slide poster preview"
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-28 flex-col items-center justify-center gap-1 rounded-lg border border-border/60 bg-background px-3 text-center text-xs text-muted-foreground">
                    <ImagePlus className="size-5 text-primary" aria-hidden="true" />
                    <span className="font-medium text-foreground">
                      Drop JPG, PNG, or WebP
                    </span>
                    <span>First frame &amp; reduced motion fallback (max 25 MB)</span>
                  </div>
                )}

                <input
                  ref={posterInputRef}
                  id="hs-poster-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="Upload poster image file"
                  onChange={(e) => {
                    const selected = e.target.files?.[0]
                    if (selected) {
                      void uploadHeroMediaFile(selected, "poster")
                    }
                    e.target.value = ""
                  }}
                  className="sr-only"
                />

                <div className="flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={posterUploading}
                    onClick={() => posterInputRef.current?.click()}
                    className="w-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {posterUploading ? (
                      <Loader2
                        data-icon="inline-start"
                        className="animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    ) : (
                      <Upload data-icon="inline-start" aria-hidden="true" />
                    )}
                    <span>
                      {posterUploading
                        ? `Uploading ${posterProgress}%`
                        : imageUrl.trim()
                          ? "Replace Poster"
                          : "Upload Poster"}
                    </span>
                  </Button>
                </div>

                {posterUploading && (
                  <div role="status" className="flex flex-col gap-1">
                    <progress
                      value={posterProgress}
                      max={100}
                      aria-label="Poster image upload progress"
                      className="h-1.5 w-full overflow-hidden rounded-full accent-primary"
                    />
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      <span className="font-mono">{posterProgress}%</span>{" "}
                      uploaded
                    </span>
                  </div>
                )}

                <Input
                  id="hs-img"
                  value={imageUrl}
                  onChange={(e) => handlePosterUrlChange(e.target.value)}
                  placeholder="https://r2.alramlahtravels.com/... or upload above"
                  required
                />
              </div>
            </Field>

            {/* Optional Ambient Video Uploader */}
            <Field>
              <FieldLabel htmlFor="hs-video">
                Ambient Video (Optional MP4)
              </FieldLabel>
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setVideoDragActive(true)
                }}
                onDragLeave={() => setVideoDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setVideoDragActive(false)
                  const dropped = e.dataTransfer.files?.[0]
                  if (dropped) {
                    void uploadHeroMediaFile(dropped, "video")
                  }
                }}
                className={`flex flex-col gap-2.5 rounded-xl border border-dashed p-3 transition-colors motion-reduce:transition-none ${
                  videoDragActive
                    ? "border-primary bg-accent/40"
                    : "border-border bg-secondary/40"
                }`}
              >
                {videoUrl.trim() ? (
                  <div className="relative h-28 w-full overflow-hidden rounded-lg border border-border bg-sidebar">
                    <video
                      key={videoUrl.trim()}
                      src={videoUrl.trim()}
                      poster={imageUrl.trim() || undefined}
                      muted
                      playsInline
                      autoPlay
                      loop
                      preload="metadata"
                      aria-label="Hero slide ambient video preview"
                      className="size-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-28 flex-col items-center justify-center gap-1 rounded-lg border border-border/60 bg-background px-3 text-center text-xs text-muted-foreground">
                    <Film className="size-5 text-primary" aria-hidden="true" />
                    <span className="font-medium text-foreground">
                      Drop silent MP4 loop
                    </span>
                    <span>Plays muted over poster (8 to 20s, max 25 MB)</span>
                  </div>
                )}

                <input
                  ref={videoInputRef}
                  id="hs-video-file"
                  type="file"
                  accept="video/mp4"
                  aria-label="Upload ambient MP4 video file"
                  onChange={(e) => {
                    const selected = e.target.files?.[0]
                    if (selected) {
                      void uploadHeroMediaFile(selected, "video")
                    }
                    e.target.value = ""
                  }}
                  className="sr-only"
                />

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={videoUploading}
                    onClick={() => videoInputRef.current?.click()}
                    className="flex-1 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {videoUploading ? (
                      <Loader2
                        data-icon="inline-start"
                        className="animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    ) : (
                      <Upload data-icon="inline-start" aria-hidden="true" />
                    )}
                    <span>
                      {videoUploading
                        ? `Uploading ${videoProgress}%`
                        : videoUrl.trim()
                          ? "Replace MP4"
                          : "Upload MP4"}
                    </span>
                  </Button>
                  {videoUrl.trim() && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      data-testid="remove-hero-video-btn"
                      onClick={handleRemoveVideo}
                      className="shrink-0 cursor-pointer text-status-danger hover:bg-status-danger-bg hover:text-status-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      aria-label="Remove ambient video"
                    >
                      <Trash2 data-icon="inline-start" aria-hidden="true" />
                      <span>Remove Video</span>
                    </Button>
                  )}
                </div>

                {videoUploading && (
                  <div role="status" className="flex flex-col gap-1">
                    <progress
                      value={videoProgress}
                      max={100}
                      aria-label="Ambient video upload progress"
                      className="h-1.5 w-full overflow-hidden rounded-full accent-primary"
                    />
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      <span className="font-mono">{videoProgress}%</span>{" "}
                      uploaded
                    </span>
                  </div>
                )}

                <Input
                  id="hs-video"
                  value={videoUrl}
                  onChange={(e) => handleVideoUrlChange(e.target.value)}
                  placeholder="Optional MP4 URL (leave empty for photo slide)"
                />
              </div>
              <FieldDescription className="text-[11px]">
                Direct URLs must use configured Cloudflare R2,{" "}
                <code>alramlahtravels.com</code>, or relative{" "}
                <code>/uploads/...</code> paths to pass Content Security Policy.
              </FieldDescription>
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="hs-badge">Top Eyebrow / Arabic Badge</FieldLabel>
            <Input
              id="hs-badge"
              lang="ar"
              dir="rtl"
              value={badge}
              onChange={(e) => setBadge(e.target.value)}
              className="font-arabic text-sm text-gold-text"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="hs-title">Headline Title</FieldLabel>
            <Input
              id="hs-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="hs-sub">Subtitle Description</FieldLabel>
            <Textarea
              id="hs-sub"
              rows={2}
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              required
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="hs-p-label">Primary CTA Text</FieldLabel>
              <Input
                id="hs-p-label"
                value={primaryCtaLabel}
                onChange={(e) => setPrimaryCtaLabel(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="hs-p-url">Primary CTA URL</FieldLabel>
              <Input
                id="hs-p-url"
                value={primaryCtaUrl}
                onChange={(e) => setPrimaryCtaUrl(e.target.value)}
                required
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="hs-s-label">Secondary CTA Text</FieldLabel>
              <Input
                id="hs-s-label"
                value={secondaryCtaLabel}
                onChange={(e) => setSecondaryCtaLabel(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="hs-s-url">Secondary CTA URL</FieldLabel>
              <Input
                id="hs-s-url"
                value={secondaryCtaUrl}
                onChange={(e) => setSecondaryCtaUrl(e.target.value)}
              />
            </Field>
          </div>
        </FieldGroup>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            <span className="font-medium">Active in Slider</span>
          </label>
          <div className="flex items-center gap-1.5">
            <Label htmlFor="hs-sort" className="text-xs">
              Sort:
            </Label>
            <Input
              id="hs-sort"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="h-7 w-16 font-mono text-xs tabular-nums"
            />
          </div>
        </div>

        <DialogFooter className="pt-2">
          <DialogClose render={<Button variant="outline" type="button" />}>
            Cancel
          </DialogClose>
          <Button
            type="submit"
            disabled={isBusy}
            className="cursor-pointer gap-2 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {loading && (
              <Loader2
                data-icon="inline-start"
                className="animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            )}
            <span>{slide ? "Save Slide" : "Create Slide"}</span>
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function HeroSlideDialog({
  slide,
  trigger,
}: {
  slide?: HeroSlideData
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [formSession, setFormSession] = useState(0)

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setFormSession((prev) => prev + 1)
    }
    setOpen(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : (
            <Button className="cursor-pointer gap-2 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <Plus data-icon="inline-start" aria-hidden="true" />
              <span>Add Slide</span>
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <HeroSlideFormBody
          key={`${slide?.id ?? "new"}-${formSession}`}
          slide={slide}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

// ==========================================
// TESTIMONIAL DIALOG
// ==========================================

export interface TestimonialData {
  id?: string
  pilgrimName: string
  city: string
  quote: string
  packageOrJourneyType: string
  rating: number
  avatarUrl?: string | null
  isFeatured: boolean
  isActive: boolean
  sortOrder: number
}

function TestimonialFormBody({
  testimonial,
  onSuccess,
}: {
  testimonial?: TestimonialData
  onSuccess: () => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [pilgrimName, setPilgrimName] = useState(testimonial?.pilgrimName ?? "")
  const [city, setCity] = useState(testimonial?.city ?? "Lahore")
  const [quote, setQuote] = useState(testimonial?.quote ?? "")
  const [packageOrJourneyType, setPackageOrJourneyType] = useState(
    testimonial?.packageOrJourneyType ?? "Custom Family Umrah"
  )
  const [rating, setRating] = useState(testimonial?.rating ?? 5)
  const [avatarUrl, setAvatarUrl] = useState(testimonial?.avatarUrl ?? "")
  const [isFeatured, setIsFeatured] = useState(testimonial?.isFeatured ?? true)
  const [isActive, setIsActive] = useState(testimonial?.isActive ?? true)
  const [sortOrder, setSortOrder] = useState(testimonial?.sortOrder ?? 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await upsertTestimonial({
        id: testimonial?.id,
        pilgrimName,
        city,
        quote,
        packageOrJourneyType,
        rating,
        avatarUrl: avatarUrl || undefined,
        isFeatured,
        isActive,
        sortOrder,
      })
      if (res.success) {
        onSuccess()
        router.refresh()
      } else {
        setError(res.error || "Failed to save testimonial.")
      }
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
      else setError("Failed to save testimonial.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {testimonial ? "Edit Pilgrim Review" : "Add Pilgrim Review"}
        </DialogTitle>
        <DialogDescription>
          Share real pilgrim feedback from completed journeys.
        </DialogDescription>
      </DialogHeader>

      {error && (
        <div className="rounded-lg border border-status-danger-border bg-status-danger-bg p-2.5 text-xs text-status-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="t-name">Pilgrim Name</Label>
            <Input
              id="t-name"
              value={pilgrimName}
              onChange={(e) => setPilgrimName(e.target.value)}
              placeholder="e.g. Dr. Salman Tariq & Family"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="t-city">Origin City</Label>
            <Input
              id="t-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Islamabad"
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="t-pkg">Journey / Package Type</Label>
          <Input
            id="t-pkg"
            value={packageOrJourneyType}
            onChange={(e) => setPackageOrJourneyType(e.target.value)}
            placeholder="e.g. VIP 5-Star Executive Umrah"
            required
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="t-quote">Pilgrim Testimonial Quote</Label>
          <Textarea
            id="t-quote"
            rows={3}
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            placeholder="The clock tower hotel room was steps from the King Abdulaziz gate."
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="t-stars">Rating (1 to 5)</Label>
            <select
              id="t-stars"
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <option value={5}>5 Stars</option>
              <option value={4}>4 Stars</option>
              <option value={3}>3 Stars</option>
              <option value={2}>2 Stars</option>
              <option value={1}>1 Star</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="t-avatar">Avatar / Photo URL</Label>
            <Input
              id="t-avatar"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/pilgrim-avatar.jpg"
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
              <span>Active</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="rounded text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
              <span className="font-semibold text-status-success">
                Featured
              </span>
            </label>
          </div>
          <div className="flex items-center gap-1.5">
            <Label htmlFor="t-sort" className="text-xs">
              Sort:
            </Label>
            <Input
              id="t-sort"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="h-7 w-14 font-mono text-xs"
            />
          </div>
        </div>

        <DialogFooter className="pt-2">
          <DialogClose render={<Button variant="outline" type="button" />}>
            Cancel
          </DialogClose>
          <Button
            type="submit"
            disabled={loading}
            className="cursor-pointer gap-2 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {loading && (
              <Loader2
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            )}
            <span>{testimonial ? "Save Changes" : "Create Review"}</span>
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function TestimonialDialog({
  testimonial,
  trigger,
}: {
  testimonial?: TestimonialData
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [formSession, setFormSession] = useState(0)

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setFormSession((prev) => prev + 1)
    }
    setOpen(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : (
            <Button className="cursor-pointer gap-2 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <Plus className="size-4" aria-hidden="true" />
              <span>Add Testimonial</span>
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <TestimonialFormBody
          key={`${testimonial?.id ?? "new"}-${formSession}`}
          testimonial={testimonial}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

// ==========================================
// FAQ DIALOG
// ==========================================

export interface FaqData {
  id?: string
  category: "general" | "visa" | "hotels" | "transport" | "packages" | "hajj"
  question: string
  answer: string
  isActive: boolean
  sortOrder: number
}

function FaqFormBody({
  faq,
  onSuccess,
}: {
  faq?: FaqData
  onSuccess: () => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [category, setCategory] = useState<
    "general" | "visa" | "hotels" | "transport" | "packages" | "hajj"
  >(faq?.category ?? "general")
  const [question, setQuestion] = useState(faq?.question ?? "")
  const [answer, setAnswer] = useState(faq?.answer ?? "")
  const [isActive, setIsActive] = useState(faq?.isActive ?? true)
  const [sortOrder, setSortOrder] = useState(faq?.sortOrder ?? 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await upsertFaq({
        id: faq?.id,
        category,
        question,
        answer,
        isActive,
        sortOrder,
      })
      if (res.success) {
        onSuccess()
        router.refresh()
      } else {
        setError(res.error || "Failed to save FAQ.")
      }
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
      else setError("Failed to save FAQ.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{faq ? "Edit FAQ" : "Add FAQ Question"}</DialogTitle>
        <DialogDescription>
          Help prospective pilgrims understand visa rules, payments, and
          accommodation.
        </DialogDescription>
      </DialogHeader>

      {error && (
        <div className="rounded-lg border border-status-danger-border bg-status-danger-bg p-2.5 text-xs text-status-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 py-2">
        <div className="space-y-1">
          <Label htmlFor="f-cat">Category</Label>
          <select
            id="f-cat"
            value={category}
            onChange={(e) =>
              setCategory(
                e.target.value as
                  | "general"
                  | "visa"
                  | "hotels"
                  | "transport"
                  | "packages"
                  | "hajj"
              )
            }
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <option value="general">General Inquiries</option>
            <option value="visa">Saudi Visa &amp; Passports</option>
            <option value="hotels">Hotels &amp; Room Sharing</option>
            <option value="transport">Vehicles &amp; Bullet Train</option>
            <option value="packages">Group Packages</option>
            <option value="hajj">Hajj 2027 Pre-Registration</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="f-q">Question</Label>
          <Input
            id="f-q"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. How long does the Umrah visa take to issue?"
            required
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="f-a">Answer</Label>
          <Textarea
            id="f-a"
            rows={4}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Saudi electronic tourist/umrah visas are generally approved within 24 to 48 hours."
            required
          />
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            <span className="font-medium">Active on Landing Page</span>
          </label>
          <div className="flex items-center gap-1.5">
            <Label htmlFor="f-sort" className="text-xs">
              Sort:
            </Label>
            <Input
              id="f-sort"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="h-7 w-14 font-mono text-xs"
            />
          </div>
        </div>

        <DialogFooter className="pt-2">
          <DialogClose render={<Button variant="outline" type="button" />}>
            Cancel
          </DialogClose>
          <Button
            type="submit"
            disabled={loading}
            className="cursor-pointer gap-2 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {loading && (
              <Loader2
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            )}
            <span>{faq ? "Save Changes" : "Create FAQ"}</span>
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function FaqDialog({
  faq,
  trigger,
}: {
  faq?: FaqData
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [formSession, setFormSession] = useState(0)

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setFormSession((prev) => prev + 1)
    }
    setOpen(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : (
            <Button className="cursor-pointer gap-2 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <Plus className="size-4" aria-hidden="true" />
              <span>Add FAQ</span>
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <FaqFormBody
          key={`${faq?.id ?? "new"}-${formSession}`}
          faq={faq}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
