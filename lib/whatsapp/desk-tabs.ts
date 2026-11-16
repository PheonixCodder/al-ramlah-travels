export type DeskHubMainTab = "pipeline" | "inbox" | "web_messages"
export type DeskHubPipelineView = "kanban" | "table"
export type DeskHubInitialModal = "auto-replies" | "templates" | null

export interface ResolvedDeskRouteState {
  activeTab: DeskHubMainTab
  pipelineView: DeskHubPipelineView
  initialModal: DeskHubInitialModal
}

/**
 * Normalizes `?tab=inbox|kanban|pipeline|auto-replies|templates|web_messages|messages`
 * deep-links on `/admin/desk` (`T-068`).
 */
export function resolveDeskRouteState(
  tabParam?: string | null
): ResolvedDeskRouteState {
  const normalized = (tabParam || "").trim().toLowerCase()

  switch (normalized) {
    case "inbox":
    case "whatsapp":
      return {
        activeTab: "inbox",
        pipelineView: "kanban",
        initialModal: null,
      }
    case "auto-replies":
    case "autoreplies":
    case "bot":
      return {
        activeTab: "inbox",
        pipelineView: "kanban",
        initialModal: "auto-replies",
      }
    case "templates":
    case "meta-templates":
      return {
        activeTab: "inbox",
        pipelineView: "kanban",
        initialModal: "templates",
      }
    case "web_messages":
    case "messages":
      return {
        activeTab: "web_messages",
        pipelineView: "kanban",
        initialModal: null,
      }
    case "table":
      return {
        activeTab: "pipeline",
        pipelineView: "table",
        initialModal: null,
      }
    case "kanban":
    case "pipeline":
    default:
      return {
        activeTab: "pipeline",
        pipelineView: "kanban",
        initialModal: null,
      }
  }
}

export interface PollMergeableConversation {
  id: string
  intentCategory?: string | null
  coexistenceMode?: boolean | null
  botMuted?: boolean | null
  doNotContact?: boolean | null
  internalNotes?: unknown[] | null
  intakeFlowState?: Record<string, unknown> | null
  messages?: unknown[]
  account?: Record<string, unknown> | null
  application?: Record<string, unknown> | null
}

/**
 * Merges incoming polled conversation headers with existing rich client state (`T-068`),
 * preserving loaded `messages`, `coexistenceMode` (`account.isOnBizApp` / `accountRole`),
 * `botMuted` (`intentCategory === "PERSONAL_OR_OTHER"`), `doNotContact`, `internalNotes`,
 * and `intakeFlowState` when a lightweight poll omits relational sub-fields.
 */
export function mergePolledConversations<T extends PollMergeableConversation>(
  prev: T[],
  incoming: T[],
  activeMessagesOverride?: { conversationId: string; messages: NonNullable<T["messages"]> }
): T[] {
  const prevById = new Map<string, T>()
  for (const item of prev) {
    prevById.set(item.id, item)
  }

  return incoming.map((nextConv) => {
    const existing = prevById.get(nextConv.id)
    if (!existing) {
      if (
        activeMessagesOverride &&
        activeMessagesOverride.conversationId === nextConv.id
      ) {
        return {
          ...nextConv,
          messages: activeMessagesOverride.messages,
        }
      }
      return nextConv
    }

    const mergedAccount =
      nextConv.account && existing.account
        ? { ...existing.account, ...nextConv.account }
        : nextConv.account ?? existing.account ?? null

    const mergedMessages =
      activeMessagesOverride &&
      activeMessagesOverride.conversationId === nextConv.id
        ? activeMessagesOverride.messages
        : nextConv.messages && nextConv.messages.length > 0
          ? nextConv.messages
          : existing.messages

    const mergedIntentCategory =
      nextConv.intentCategory ?? existing.intentCategory ?? undefined

    const mergedCoexistenceMode =
      nextConv.coexistenceMode !== undefined
        ? nextConv.coexistenceMode
        : existing.coexistenceMode !== undefined
          ? existing.coexistenceMode
          : Boolean(
              (mergedAccount as { isOnBizApp?: boolean } | null)?.isOnBizApp ||
                (mergedAccount as { accountRole?: string } | null)
                  ?.accountRole === "COEXISTENCE_FOUNDER"
            )

    const mergedBotMuted =
      nextConv.botMuted !== undefined
        ? nextConv.botMuted
        : existing.botMuted !== undefined
          ? existing.botMuted
          : mergedIntentCategory === "PERSONAL_OR_OTHER" ||
            mergedIntentCategory === "DO_NOT_CONTACT" ||
            Boolean(nextConv.doNotContact ?? existing.doNotContact)

    return {
      ...existing,
      ...nextConv,
      account: mergedAccount,
      application: nextConv.application ?? existing.application ?? null,
      intentCategory: mergedIntentCategory,
      coexistenceMode: mergedCoexistenceMode,
      botMuted: mergedBotMuted,
      doNotContact: nextConv.doNotContact ?? existing.doNotContact ?? false,
      internalNotes: nextConv.internalNotes ?? existing.internalNotes ?? [],
      intakeFlowState:
        nextConv.intakeFlowState !== undefined
          ? nextConv.intakeFlowState
          : existing.intakeFlowState,
      messages: mergedMessages,
    }
  })
}

/**
 * Reverses a `DESC`-ordered message slice (`ORDER BY created_at DESC LIMIT 50`)
 * into chronological oldest-to-newest display order for the Desk thread view (`T-068`).
 */
export function orderLatestMessagesChronologically<
  T extends { createdAt: Date | string },
>(descMessages: T[]): T[] {
  return [...descMessages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
}

/**
 * Determines whether the Desk thread scroll viewport should snap to bottom (`T-088`).
 * Preserves operator scroll position when inspecting older history above the 120px threshold.
 */
export function shouldAutoScrollThreadOnUpdate(params: {
  conversationChanged: boolean
  forceScrollToBottom: boolean
  scrollHeight: number
  scrollTop: number
  clientHeight: number
  thresholdPx?: number
}): boolean {
  if (params.conversationChanged || params.forceScrollToBottom) {
    return true
  }
  const threshold = params.thresholdPx ?? 120
  const distanceFromBottom =
    params.scrollHeight - params.scrollTop - params.clientHeight
  return distanceFromBottom <= threshold
}

/**
 * Returns `true` only when the browser tab is visible (`T-068`, `OD-07`).
 */
export function isDocumentVisibilityActive(
  visibilityState?: string | null
): boolean {
  if (!visibilityState) return true
  return visibilityState !== "hidden"
}
