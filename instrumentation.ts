import type { Instrumentation } from "next"
import { parseEnv } from "@/lib/env"
import { logger } from "@/lib/logger"

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    parseEnv(process.env)
    logger.info("Al Ramlah Travels server runtime initialized", {
      nodeEnv: process.env.NODE_ENV ?? "development",
      runtime: process.env.NEXT_RUNTIME,
    })
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  const digest =
    err && typeof err === "object" && "digest" in err
      ? String((err as { digest?: unknown }).digest)
      : undefined

  logger.error("Unhandled Next.js request error", {
    digest,
    method: request.method,
    path: request.path,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
    error: err,
  })
}
