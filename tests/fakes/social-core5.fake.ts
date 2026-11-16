export interface SocialCore5RecordedRequest {
  method: string
  url: string
  hostname: string
  pathname: string
  authorization: string | null
  bodyText: string
}

export interface IgContainerState {
  id: string
  caption: string
  pollsRemainingBeforeFinished: number
  status: "IN_PROGRESS" | "FINISHED" | "PUBLISHED"
}

export interface SocialCore5FakeOptions {
  /** Number of `IN_PROGRESS` responses before a container transitions to `FINISHED` (default `1`) */
  igPollsBeforeFinished?: number
  /** Simulate Meta transient `-2` / `2207051` publish timeout and recover via `/media` */
  simulateIgTransientPublishTimeout?: boolean
}

export interface SocialCore5Fake {
  requests: SocialCore5RecordedRequest[]
  igContainers: Map<string, IgContainerState>
  publishedPosts: Array<{
    provider: "instagram" | "facebook" | "tiktok" | "youtube" | "gmb"
    externalPostId: string
  }>
  fetchHandler: typeof fetch
  reset: () => void
}

function extractAuthHeader(headers: HeadersInit | undefined): string | null {
  if (!headers) return null
  if (headers instanceof Headers) return headers.get("authorization")
  if (Array.isArray(headers)) {
    const pair = headers.find(([k]) => k.toLowerCase() === "authorization")
    return pair ? pair[1] : null
  }
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === "authorization" && typeof v === "string") {
      return v
    }
  }
  return null
}

/**
 * Stateful contract fake covering all Core 5 social providers (`T-035`, `T-036`, `T-039`):
 * 1. **Instagram**: Container starts `IN_PROGRESS` -> transitions to `FINISHED` when polled -> `/media_publish`
 *    rejects unpolled containers (`HTTP 400`, subcode `2207027`) and succeeds once `FINISHED`.
 * 2. **Facebook**: Distinguishes User OAuth token (`fb_user_tok_*`) from Page Access Token (`fb_page_tok_*` via `/me/accounts`)
 *    and rejects publishing when a User token clobbers a Page token.
 * 3. **TikTok**: `creator_info/query` + `publish/content/init` / `publish/video/init` + `publish/status/fetch` + `video/query`.
 * 4. **YouTube**: Resumable upload session (`Location` header) + binary `PUT` + `videos?part=statistics` + `commentThreads`.
 * 5. **Google Business Profile (GBP v1)**: Serves `mybusinessaccountmanagement.googleapis.com/v1`,
 *    `mybusinessbusinessinformation.googleapis.com/v1`, and `businessprofileperformance.googleapis.com/v1`,
 *    while returning **HTTP `404`** on sunset `mybusiness.googleapis.com/v4/*`!
 */
export function createSocialCore5Fake(
  options: SocialCore5FakeOptions = {}
): SocialCore5Fake {
  const requests: SocialCore5RecordedRequest[] = []
  const igContainers = new Map<string, IgContainerState>()
  const igRecentPublished: Array<{
    id: string
    shortcode: string
    permalink: string
    caption: string
    timestamp: string
  }> = []
  const publishedPosts: SocialCore5Fake["publishedPosts"] = []
  let seq = 100

  const pollsRequired = options.igPollsBeforeFinished ?? 1

  const fetchHandler: typeof fetch = async (input, init) => {
    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    const parsed = new URL(urlStr)
    const method = (
      init?.method ??
      (input instanceof Request ? input.method : "GET")
    ).toUpperCase()
    const authHeader = extractAuthHeader(
      init?.headers ?? (input instanceof Request ? input.headers : undefined)
    )
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : ""

    let bodyText = ""
    if (typeof init?.body === "string") {
      bodyText = init.body
    } else if (init?.body instanceof URLSearchParams) {
      bodyText = init.body.toString()
    }

    requests.push({
      method,
      url: urlStr,
      hostname: parsed.hostname,
      pathname: parsed.pathname,
      authorization: authHeader,
      bodyText,
    })

    // -------------------------------------------------------------------------
    // 0. Safe R2 media binary stream helper (for FB Reels / YouTube / TikTok)
    // -------------------------------------------------------------------------
    if (
      method === "GET" &&
      (parsed.hostname.endsWith(".r2.dev") ||
        parsed.hostname.endsWith(".alramlahtravels.com"))
    ) {
      const fakeVideoBytes = new Uint8Array(64)
      fakeVideoBytes.set([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]) // MP4 ftyp header
      return new Response(fakeVideoBytes, {
        status: 200,
        headers: {
          "Content-Type": parsed.pathname.endsWith(".mp4")
            ? "video/mp4"
            : "image/jpeg",
          "Content-Length": String(fakeVideoBytes.byteLength),
        },
      })
    }

    // -------------------------------------------------------------------------
    // 1. Sunset Google My Business v4 API MUST return 404 (`T-035`)
    // -------------------------------------------------------------------------
    if (
      parsed.hostname === "mybusiness.googleapis.com" &&
      parsed.pathname.startsWith("/v4/")
    ) {
      return new Response(
        JSON.stringify({
          error: {
            code: 404,
            message:
              "Google My Business API v4 has been sunset and removed. Migrate to Business Profile APIs v1.",
            status: "NOT_FOUND",
          },
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      )
    }

    // -------------------------------------------------------------------------
    // 2. Google OAuth + GBP v1 + YouTube Data API v3
    // -------------------------------------------------------------------------
    if (parsed.hostname === "oauth2.googleapis.com" && parsed.pathname === "/token") {
      return new Response(
        JSON.stringify({
          access_token: `ya29.gbp_live_token_${++seq}`,
          refresh_token: "1//gbp_refresh_token_keep",
          expires_in: 3600,
          token_type: "Bearer",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }

    if (
      parsed.hostname === "mybusinessaccountmanagement.googleapis.com" &&
      parsed.pathname === "/v1/accounts"
    ) {
      return new Response(
        JSON.stringify({
          accounts: [
            {
              name: "accounts/7701",
              accountName: "Al Ramlah Travels Pvt Ltd",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }

    if (parsed.hostname === "mybusinessbusinessinformation.googleapis.com") {
      if (method === "GET" && parsed.pathname.endsWith("/locations")) {
        return new Response(
          JSON.stringify({
            locations: [
              {
                name: "locations/loc_askari10",
                title: "Al Ramlah Travels — Askari 10 Lahore Cantt",
                storefrontAddress: {
                  locality: "Lahore",
                  addressLines: ["Askari 10, Airport Road, Lahore Cantt"],
                },
                metadata: {
                  mapsUri: "https://maps.google.com/?cid=alramlah_askari10",
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      if (method === "POST" && parsed.pathname.endsWith("/localPosts")) {
        const postName = `locations/loc_askari10/localPosts/gbp_post_${++seq}`
        publishedPosts.push({ provider: "gmb", externalPostId: postName })
        return new Response(
          JSON.stringify({
            name: postName,
            state: "LIVE",
            searchUrl: "https://local.google.com/place?id=alramlah_askari10",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }
    }

    if (
      parsed.hostname === "businessprofileperformance.googleapis.com" &&
      parsed.pathname.includes(":fetchMultiDailyMetricsTimeSeries")
    ) {
      return new Response(
        JSON.stringify({
          multiDailyMetricTimeSeries: [
            {
              dailyMetricTimeSeries: [
                {
                  dailyMetric: "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
                  timeSeries: { datedValues: [{ value: "410" }, { value: "230" }] },
                },
                {
                  dailyMetric: "WEBSITE_CLICKS",
                  timeSeries: { datedValues: [{ value: "29" }] },
                },
                {
                  dailyMetric: "CALL_CLICKS",
                  timeSeries: { datedValues: [{ value: "10" }] },
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }

    // YouTube Data API v3
    if (parsed.hostname === "www.googleapis.com") {
      if (
        method === "POST" &&
        parsed.pathname === "/upload/youtube/v3/videos" &&
        parsed.searchParams.get("uploadType") === "resumable"
      ) {
        return new Response(null, {
          status: 200,
          headers: {
            Location:
              "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=yt_sess_1",
          },
        })
      }
      if (
        method === "PUT" &&
        parsed.pathname === "/upload/youtube/v3/videos" &&
        parsed.searchParams.get("upload_id") === "yt_sess_1"
      ) {
        const ytId = `yt_short_${++seq}`
        publishedPosts.push({ provider: "youtube", externalPostId: ytId })
        return new Response(JSON.stringify({ id: ytId }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      if (method === "GET" && parsed.pathname === "/youtube/v3/videos") {
        return new Response(
          JSON.stringify({
            items: [
              {
                statistics: {
                  viewCount: "5400",
                  likeCount: "310",
                  commentCount: "48",
                  favoriteCount: "22",
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }
      if (method === "POST" && parsed.pathname === "/youtube/v3/commentThreads") {
        return new Response(JSON.stringify({ id: `yt_comment_${++seq}` }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
    }

    // -------------------------------------------------------------------------
    // 3. Meta Graph API (Facebook Pages + Instagram Business)
    // -------------------------------------------------------------------------
    if (
      parsed.hostname === "graph.facebook.com" ||
      parsed.hostname === "rupload.facebook.com"
    ) {
      if (parsed.hostname === "rupload.facebook.com") {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }

      if (parsed.pathname.endsWith("/oauth/access_token")) {
        return new Response(
          JSON.stringify({
            access_token: `fb_user_tok_${++seq}`,
            token_type: "bearer",
            expires_in: 5184000,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      if (parsed.pathname.endsWith("/me/accounts")) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "page_lahore_hq",
                name: "Al Ramlah Travels Lahore",
                category: "Travel Agency",
                access_token: `fb_page_tok_distinct_${++seq}`,
                picture: {
                  data: { url: "https://graph.facebook.com/page_lahore_hq/picture" },
                },
                instagram_business_account: {
                  id: "ig_biz_lahore",
                  username: "alramlahtravels",
                  name: "Al Ramlah Travels",
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      // Guard: reject Facebook Page publish if caller passed a User token instead of Page token (`T-035`)
      if (
        method === "POST" &&
        parsed.pathname.includes("/page_") &&
        bearerToken.startsWith("fb_user_tok_")
      ) {
        return new Response(
          JSON.stringify({
            error: {
              message:
                " (#200) Requires a Facebook Page Access Token; received a User Access Token",
              type: "OAuthException",
              code: 200,
            },
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        )
      }

      // Instagram POST /{igUserId}/media (create container in IN_PROGRESS state)
      const igCreateMatch = /^\/v\d+\.\d+\/([^/]+)\/media$/.exec(parsed.pathname)
      if (igCreateMatch && method === "POST") {
        const form = new URLSearchParams(bodyText)
        const containerId = `ig_container_${++seq}`
        igContainers.set(containerId, {
          id: containerId,
          caption: form.get("caption") ?? "",
          pollsRemainingBeforeFinished: pollsRequired,
          status: pollsRequired <= 0 ? "FINISHED" : "IN_PROGRESS",
        })
        return new Response(JSON.stringify({ id: containerId }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }

      // Instagram GET /{igUserId}/media (timeout recovery list)
      if (igCreateMatch && method === "GET") {
        return new Response(JSON.stringify({ data: igRecentPublished }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }

      // Instagram GET /{containerId}?fields=status_code,status (polling)
      const igEntityMatch = /^\/v\d+\.\d+\/([^/]+)$/.exec(parsed.pathname)
      if (igEntityMatch && method === "GET") {
        const entityId = decodeURIComponent(igEntityMatch[1]!)
        const container = igContainers.get(entityId)
        if (container) {
          if (container.pollsRemainingBeforeFinished > 0) {
            container.pollsRemainingBeforeFinished -= 1
            return new Response(
              JSON.stringify({ id: container.id, status_code: "IN_PROGRESS" }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          }
          container.status = "FINISHED"
          return new Response(
            JSON.stringify({ id: container.id, status_code: "FINISHED" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }

        const fields = parsed.searchParams.get("fields") ?? ""
        if (fields.includes("permalink")) {
          return new Response(
            JSON.stringify({
              id: entityId,
              permalink: `https://www.instagram.com/p/${entityId}/`,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        if (fields.includes("like_count")) {
          return new Response(
            JSON.stringify({ like_count: 142, comments_count: 27 }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        if (fields.includes("insights")) {
          return new Response(
            JSON.stringify({
              shares: { count: 19 },
              likes: { summary: { total_count: 95 } },
              comments: { summary: { total_count: 14 } },
              insights: {
                data: [
                  { name: "post_impressions", values: [{ value: 2100 }] },
                  { name: "post_clicks", values: [{ value: 78 }] },
                ],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
      }

      // Instagram POST /{igUserId}/media_publish
      const igPublishMatch = /^\/v\d+\.\d+\/([^/]+)\/media_publish$/.exec(
        parsed.pathname
      )
      if (igPublishMatch && method === "POST") {
        const form = new URLSearchParams(bodyText)
        const creationId = form.get("creation_id") ?? ""
        const container = igContainers.get(creationId)
        if (!container || container.status !== "FINISHED") {
          return new Response(
            JSON.stringify({
              error: {
                message:
                  "Media ID is not available — container must reach FINISHED before media_publish",
                type: "OAuthException",
                code: 9007,
                error_subcode: 2207027,
              },
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          )
        }

        const publishedId = `ig_media_${++seq}`
        container.status = "PUBLISHED"
        publishedPosts.push({ provider: "instagram", externalPostId: publishedId })
        igRecentPublished.unshift({
          id: publishedId,
          shortcode: `C9_${publishedId}`,
          permalink: `https://www.instagram.com/p/C9_${publishedId}/`,
          caption: container.caption,
          timestamp: new Date().toISOString(),
        })

        if (options.simulateIgTransientPublishTimeout) {
          return new Response(
            JSON.stringify({
              error: {
                message: "Transient timeout while publishing container",
                code: -2,
                error_subcode: 2207051,
              },
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          )
        }

        return new Response(JSON.stringify({ id: publishedId }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }

      if (parsed.pathname.endsWith("/insights")) {
        return new Response(
          JSON.stringify({
            data: [
              { name: "impressions", values: [{ value: 3850 }] },
              { name: "shares", values: [{ value: 44 }] },
              { name: "saved", values: [{ value: 61 }] },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      if (parsed.pathname.endsWith("/video_reels") && method === "POST") {
        if (bodyText.includes("upload_phase=start")) {
          return new Response(
            JSON.stringify({
              video_id: "fb_reel_vid_1",
              upload_url:
                "https://rupload.facebook.com/video-upload/v21.0/fb_reel_vid_1",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        const postId = `fb_reel_post_${++seq}`
        publishedPosts.push({ provider: "facebook", externalPostId: postId })
        return new Response(
          JSON.stringify({ success: true, post_id: postId }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      if (parsed.pathname.endsWith("/feed") || parsed.pathname.endsWith("/photos")) {
        const postId = `fb_post_${++seq}`
        publishedPosts.push({ provider: "facebook", externalPostId: postId })
        return new Response(
          JSON.stringify({ id: postId, post_id: postId }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      if (parsed.pathname.endsWith("/comments") && method === "POST") {
        return new Response(JSON.stringify({ id: `meta_comment_${++seq}` }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
    }

    // -------------------------------------------------------------------------
    // 4. TikTok Content Posting API v2
    // -------------------------------------------------------------------------
    if (parsed.hostname === "open.tiktokapis.com") {
      if (parsed.pathname.includes("/v2/post/publish/creator_info/query/")) {
        return new Response(
          JSON.stringify({
            data: {
              privacy_level_options: ["PUBLIC_TO_EVERYONE", "SELF_ONLY"],
            },
            error: { code: "ok", message: "" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }
      if (
        parsed.pathname.includes("/v2/post/publish/content/init/") ||
        parsed.pathname.includes("/v2/post/publish/video/init/")
      ) {
        const pubId = `p_pub_url~v2_${++seq}`
        publishedPosts.push({ provider: "tiktok", externalPostId: pubId })
        return new Response(
          JSON.stringify({
            data: { publish_id: pubId },
            error: { code: "ok", message: "" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }
      if (parsed.pathname.includes("/v2/post/publish/status/fetch/")) {
        return new Response(
          JSON.stringify({
            data: {
              status: "PUBLISH_COMPLETE",
              publicaly_available_post_id: ["749000111222333444"],
            },
            error: { code: "ok", message: "" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }
      if (parsed.pathname.includes("/v2/video/query/")) {
        return new Response(
          JSON.stringify({
            data: {
              videos: [
                {
                  id: "749000111222333444",
                  view_count: 12900,
                  like_count: 870,
                  comment_count: 65,
                  share_count: 130,
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }
    }

    return new Response(
      JSON.stringify({ error: `Unhandled URL in SocialCore5Fake: ${urlStr}` }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    )
  }

  return {
    requests,
    igContainers,
    publishedPosts,
    fetchHandler,
    reset() {
      requests.length = 0
      igContainers.clear()
      igRecentPublished.length = 0
      publishedPosts.length = 0
    },
  }
}
