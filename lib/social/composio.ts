import { z } from "zod"
import { env } from "@/lib/env"
import type {
  SocialPostPayload,
  SocialProviderId,
  SocialPublishResult,
} from "./types"

const COMPOSIO_API_BASE_URL = "https://backend.composio.dev/api/v3"
export const COMPOSIO_ADMIN_USER_ID = "al-ramlah-admin"

// ==========================================
// 1. Zod Schemas for Composio REST Contracts
// ==========================================

const composioSessionSchema = z.object({
  session_id: z.string().min(1, "Missing session_id in Composio session response"),
})

const composioLinkSchema = z.object({
  redirect_url: z.string().url("Invalid redirect_url in Composio link response"),
  connected_account_id: z.string().optional(),
  link_token: z.string().optional(),
})

const composioConnectedAccountsSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        status: z.string(),
        toolkit: z
          .object({
            slug: z.string().optional(),
          })
          .optional(),
      })
    )
    .optional()
    .default([]),
})

const instagramUserInfoSchema = z.object({
  id: z.union([z.string(), z.number()]),
  username: z.string().optional(),
  name: z.string().optional(),
  profile_picture_url: z.string().optional(),
  account_type: z.string().optional(),
})

const instagramContainerResponseSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  creation_id: z.union([z.string(), z.number()]).optional(),
})

const instagramPublishResponseSchema = z.object({
  id: z.union([z.string(), z.number()]),
})

const facebookPageItemSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string(),
  access_token: z.string().optional(),
  category: z.string().optional(),
  link: z.string().optional(),
  picture: z
    .object({
      data: z
        .object({
          url: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
})

const facebookPagesResponseSchema = z.object({
  data: z.array(facebookPageItemSchema).optional().default([]),
})

const facebookPostResponseSchema = z.object({
  id: z.string().optional(),
  post_id: z.string().optional(),
})

// ==========================================
// 2. Types & Helpers
// ==========================================

export interface ComposioAccountProfile {
  externalAccountId: string
  displayName: string
  handle?: string
  avatarUrl?: string
  accessToken?: string
  connectedAccountId?: string
}

export interface ComposioAuthLinkResult {
  redirectUrl: string
  connectedAccountId?: string
  sessionId: string
}

function getComposioApiKey(): string {
  const apiKey = env.COMPOSIO_API_KEY?.trim()
  if (!apiKey) {
    throw new Error(
      "Missing COMPOSIO_API_KEY: Composio Managed OAuth requires a valid API key in environment variables."
    )
  }
  return apiKey
}

function getComposioHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-api-key": getComposioApiKey(),
  }
}

/**
 * Checks whether Composio Managed OAuth is supported for a given provider.
 * Currently supports zero-config Meta authorization for Instagram and Facebook Pages.
 */
export function isComposioManagedSupported(provider: SocialProviderId): boolean {
  return (
    (provider === "instagram" || provider === "facebook") &&
    Boolean(env.COMPOSIO_API_KEY?.trim())
  )
}

/**
 * Executes a tool via Composio v3 REST endpoint with strict Zod validation.
 */
export async function executeComposioTool<T>(
  toolSlug: string,
  args: Record<string, unknown>,
  connectedAccountId?: string
): Promise<T> {
  const url = `${COMPOSIO_API_BASE_URL}/tools/execute/${toolSlug}`
  const bodyPayload: Record<string, unknown> = {
    user_id: COMPOSIO_ADMIN_USER_ID,
    arguments: args,
  }

  if (connectedAccountId) {
    bodyPayload.connected_account_id = connectedAccountId
  }

  const res = await fetch(url, {
    method: "POST",
    headers: getComposioHeaders(),
    body: JSON.stringify(bodyPayload),
  })

  if (!res.ok) {
    const errorText = await res.text().catch(() => "")
    throw new Error(
      `Composio tool execution failed [${toolSlug}] (HTTP ${res.status}): ${errorText}`
    )
  }

  const json: unknown = await res.json()
  const rawRecord = json && typeof json === "object" ? (json as Record<string, unknown>) : {}

  if (rawRecord.successful === false) {
    const message =
      typeof rawRecord.error === "string"
        ? rawRecord.error
        : `Tool ${toolSlug} returned unsuccessful`
    throw new Error(`Composio tool error [${toolSlug}]: ${message}`)
  }

  // Composio responses typically nest payloads under data.response_data or data
  const dataNode = rawRecord.data
  let unwrapped: unknown = dataNode
  if (dataNode && typeof dataNode === "object") {
    const dataObj = dataNode as Record<string, unknown>
    if ("response_data" in dataObj) {
      unwrapped = dataObj.response_data
    }
  }

  return (unwrapped ?? json) as T
}

/**
 * Fetches connected accounts for the Al Ramlah admin user.
 */
export async function getComposioConnectedAccounts(
  provider?: "instagram" | "facebook"
): Promise<Array<{ id: string; status: string; toolkitSlug?: string }>> {
  const url = `${COMPOSIO_API_BASE_URL}/connected_accounts?user_ids=${encodeURIComponent(
    COMPOSIO_ADMIN_USER_ID
  )}`

  const res = await fetch(url, {
    method: "GET",
    headers: getComposioHeaders(),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    throw new Error(
      `Failed to list Composio connected accounts (HTTP ${res.status}): ${errText}`
    )
  }

  const parsed = composioConnectedAccountsSchema.safeParse(await res.json())
  if (!parsed.success) {
    return []
  }

  const items = parsed.data.items.map((acc) => ({
    id: acc.id,
    status: acc.status,
    toolkitSlug: acc.toolkit?.slug?.toLowerCase(),
  }))

  if (!provider) {
    return items
  }

  const targetSlug = provider.toLowerCase()
  return items.filter(
    (acc) =>
      acc.toolkitSlug === targetSlug ||
      (targetSlug === "instagram" && acc.toolkitSlug?.includes("instagram")) ||
      (targetSlug === "facebook" && acc.toolkitSlug?.includes("facebook"))
  )
}

/**
 * Initiates a Composio Managed OAuth session & returns the hosted connection redirect URL.
 */
export async function createComposioAuthLink(
  provider: "instagram" | "facebook",
  callbackUrl: string
): Promise<ComposioAuthLinkResult> {
  // Step 1: Create tool router session
  const sessionUrl = `${COMPOSIO_API_BASE_URL}/tool_router/session`
  const sessionRes = await fetch(sessionUrl, {
    method: "POST",
    headers: getComposioHeaders(),
    body: JSON.stringify({
      user_id: COMPOSIO_ADMIN_USER_ID,
      toolkits: {
        enable: [provider],
      },
    }),
  })

  if (!sessionRes.ok) {
    const errText = await sessionRes.text().catch(() => "")
    throw new Error(
      `Failed to create Composio session for ${provider} (HTTP ${sessionRes.status}): ${errText}`
    )
  }

  const sessionData = composioSessionSchema.parse(await sessionRes.json())
  const sessionId = sessionData.session_id

  // Step 2: Request link redirect URL
  const linkUrl = `${COMPOSIO_API_BASE_URL}/tool_router/session/${encodeURIComponent(
    sessionId
  )}/link`

  const linkRes = await fetch(linkUrl, {
    method: "POST",
    headers: getComposioHeaders(),
    body: JSON.stringify({
      toolkit: provider,
      callback_url: callbackUrl,
    }),
  })

  if (!linkRes.ok) {
    const errText = await linkRes.text().catch(() => "")
    throw new Error(
      `Failed to create Composio auth link for ${provider} (HTTP ${linkRes.status}): ${errText}`
    )
  }

  const linkData = composioLinkSchema.parse(await linkRes.json())

  return {
    redirectUrl: linkData.redirect_url,
    connectedAccountId: linkData.connected_account_id,
    sessionId,
  }
}

/**
 * Resolves account details (ID, name, handle, avatar) from Composio's connected account.
 */
export async function resolveComposioAccountProfile(
  provider: "instagram" | "facebook",
  connectedAccountId?: string
): Promise<ComposioAccountProfile> {
  if (provider === "instagram") {
    const rawResult = await executeComposioTool<unknown>(
      "INSTAGRAM_GET_USER_INFO",
      { ig_user_id: "me" },
      connectedAccountId
    )

    const userInfo = instagramUserInfoSchema.parse(rawResult)
    const externalAccountId = String(userInfo.id)
    const handle = userInfo.username ? `@${userInfo.username.replace(/^@/, "")}` : undefined
    const displayName = userInfo.name || userInfo.username || "Al Ramlah Instagram"

    return {
      externalAccountId,
      displayName,
      handle,
      avatarUrl: userInfo.profile_picture_url,
      connectedAccountId,
    }
  }

  // Provider: Facebook
  const rawPagesResult = await executeComposioTool<unknown>(
    "FACEBOOK_LIST_MANAGED_PAGES",
    { fields: "id,name,access_token,category,link,picture" },
    connectedAccountId
  )

  const pagesData = facebookPagesResponseSchema.parse(rawPagesResult)
  if (!pagesData.data || pagesData.data.length === 0) {
    throw new Error(
      "No managed Facebook Pages found in the connected Facebook account. Please ensure your Facebook account has admin access to at least one Facebook Page."
    )
  }

  // Prefer page matching "Al Ramlah" if multiple pages exist
  const matchedPage =
    pagesData.data.find((p) =>
      p.name.toLowerCase().includes("al ramlah")
    ) || pagesData.data[0]

  return {
    externalAccountId: String(matchedPage.id),
    displayName: matchedPage.name,
    handle: matchedPage.name,
    avatarUrl: matchedPage.picture?.data?.url,
    accessToken: matchedPage.access_token,
    connectedAccountId,
  }
}

/**
 * Publishes a social post to Instagram or Facebook via Composio tool execution.
 */
export async function publishViaComposio(
  provider: "instagram" | "facebook",
  params: {
    externalAccountId: string
    connectedAccountId?: string
    handle?: string | null
    payload: SocialPostPayload
  }
): Promise<SocialPublishResult> {
  const { externalAccountId, connectedAccountId, handle, payload } = params

  if (provider === "instagram") {
    const firstMedia = payload.media[0]
    if (!firstMedia?.url) {
      throw new Error("Instagram requires at least one image or video media URL to publish.")
    }

    const isVideo =
      firstMedia.type === "video" || firstMedia.url.toLowerCase().endsWith(".mp4")

    // Step 1: Create IG User Media container
    const createArgs: Record<string, unknown> = {
      ig_user_id: externalAccountId,
      caption: payload.caption,
    }

    if (isVideo) {
      createArgs.video_url = firstMedia.url
      createArgs.media_type = "REELS"
      createArgs.share_to_feed = true
    } else {
      createArgs.image_url = firstMedia.url
    }

    const rawContainer = await executeComposioTool<unknown>(
      "INSTAGRAM_POST_IG_USER_MEDIA",
      createArgs,
      connectedAccountId
    )

    const containerData = instagramContainerResponseSchema.parse(rawContainer)
    const creationId = containerData.creation_id || containerData.id

    if (!creationId) {
      throw new Error(
        `Failed to obtain creation container ID for Instagram post (response: ${JSON.stringify(
          rawContainer
        )})`
      )
    }

    // Step 2: Publish the media container
    const rawPublish = await executeComposioTool<unknown>(
      "INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH",
      {
        ig_user_id: externalAccountId,
        creation_id: String(creationId),
        max_wait_seconds: 60,
      },
      connectedAccountId
    )

    const publishData = instagramPublishResponseSchema.parse(rawPublish)
    const publishedId = String(publishData.id)

    const cleanHandle = handle ? handle.replace(/^@/, "") : "alramlahtravels"
    const publishedUrl = `https://www.instagram.com/${cleanHandle}/`

    return {
      externalPostId: publishedId,
      publishedUrl,
      rawResponse: rawPublish,
    }
  }

  // Provider: Facebook Page
  const firstMedia = payload.media[0]
  if (firstMedia?.url && !firstMedia.url.toLowerCase().endsWith(".mp4")) {
    // Photo post
    const rawPhoto = await executeComposioTool<unknown>(
      "FACEBOOK_CREATE_PHOTO_POST",
      {
        page_id: externalAccountId,
        url: firstMedia.url,
        message: payload.caption,
        published: true,
      },
      connectedAccountId
    )

    const photoData = facebookPostResponseSchema.parse(rawPhoto)
    const postId = photoData.post_id || photoData.id || `fb_${Date.now()}`
    const publishedUrl = `https://www.facebook.com/${externalAccountId}`

    return {
      externalPostId: postId,
      publishedUrl,
      rawResponse: rawPhoto,
    }
  }

  // Standard or text post
  const rawPost = await executeComposioTool<unknown>(
    "FACEBOOK_CREATE_POST",
    {
      page_id: externalAccountId,
      message: payload.caption,
      published: true,
      ...(payload.callToActionUrl ? { link: payload.callToActionUrl } : {}),
    },
    connectedAccountId
  )

  const postData = facebookPostResponseSchema.parse(rawPost)
  const postId = postData.post_id || postData.id || `fb_${Date.now()}`
  const publishedUrl = `https://www.facebook.com/${externalAccountId}`

  return {
    externalPostId: postId,
    publishedUrl,
    rawResponse: rawPost,
  }
}
