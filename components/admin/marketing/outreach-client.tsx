"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  UserCheck,
  Lock,
  Unlock,
  Send,
  Plus,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  upsertOutreachContact,
  sendPersonalOutreachAction,
  markContactInboundReplyAction,
} from "@/app/actions/marketing-ops"
import { computeOutreachCooldownState } from "@/lib/domain/marketing-ops"

export interface OutreachContactRow {
  id: string
  fullName: string
  whatsappNumber: string
  secondaryPhone?: string | null
  city: string
  areaCommunity?: string | null
  sourceGroupOrChannel?: string | null
  assignedWhatsappLine: string
  interestStatus: string
  lastOutreachAt?: Date | null
  cooldownUntil?: Date | null
  lastInboundReplyAt?: Date | null
  totalOutreachCount: number
  packagesSharedHistory: string[]
  tags: string[]
  notes?: string | null
}

export interface OutreachAssetRow {
  id: string
  postCode: string
  title: string
  imageUrl: string
  flyerId?: string | null
  captionWhatsapp?: string | null
}

export interface OutreachLogRow {
  id: string
  senderWhatsappLine: string
  messageText: string
  sentAt: Date
  contact: { fullName: string; whatsappNumber: string }
  postAsset?: { postCode: string; title: string } | null
}

export function OutreachClient({
  initialContacts,
  postAssets,
  recentLogs,
}: {
  initialContacts: OutreachContactRow[]
  postAssets: OutreachAssetRow[]
  recentLogs: OutreachLogRow[]
}) {
  const router = useRouter()
  const [selectedPostAssetId, setSelectedPostAssetId] = React.useState(
    postAssets[0]?.id || ""
  )
  const [senderLine, setSenderLine] = React.useState("03274029701")
  const [queueFilter, setQueueFilter] = React.useState<
    "eligible" | "locked" | "all"
  >("eligible")
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<{
    type: "success" | "error"
    text: string
    waUrl?: string
  } | null>(null)

  // Add Contact State
  const [showAddContact, setShowAddContact] = React.useState(false)
  const [fullName, setFullName] = React.useState("")
  const [whatsappNumber, setWhatsappNumber] = React.useState("")
  const [areaCommunity, setAreaCommunity] = React.useState("Askari 10")
  const [sourceGroup, setSourceGroup] = React.useState(
    "Askari 10 Sector B Residents"
  )

  const selectedAsset = React.useMemo(
    () => postAssets.find((a) => a.id === selectedPostAssetId),
    [postAssets, selectedPostAssetId]
  )

  const contactsWithCooldown = React.useMemo(() => {
    const now = new Date()
    return initialContacts.map((c) => ({
      ...c,
      cooldown: computeOutreachCooldownState(
        c.lastOutreachAt,
        c.lastInboundReplyAt,
        now
      ),
    }))
  }, [initialContacts])

  const eligibleCount = contactsWithCooldown.filter(
    (c) => c.cooldown.isEligibleToday
  ).length
  const lockedCount = contactsWithCooldown.filter(
    (c) => !c.cooldown.isEligibleToday
  ).length

  const filteredContacts = contactsWithCooldown.filter((c) => {
    if (queueFilter === "eligible") return c.cooldown.isEligibleToday
    if (queueFilter === "locked") return !c.cooldown.isEligibleToday
    return true
  })

  const buildPersonalizedMessage = (contactName: string) => {
    const firstName = contactName.split(" ")[0] || contactName
    if (selectedAsset) {
      return `As-salamu alaykum ${firstName} Bhai,\n\nSharing our latest *Al Ramlah Travels* Umrah Spotlight (*${selectedAsset.title}*, Ref: *${selectedAsset.postCode}*).\n\nLet me know if you or your family in Askari/DHA are planning Umrah this season. We are happy to share customized dates or our full package sheet!\n\nJazakAllah Khair,\n*Al Ramlah Travels* (${senderLine})`
    }
    return `As-salamu alaykum ${firstName} Bhai,\n\nHope you and the family are doing well. Sharing our latest Umrah packages from Al Ramlah Travels. Let me know if you need any flight or hotel rates for Makkah & Madinah!\n\nJazakAllah Khair,\n*Al Ramlah Travels* (${senderLine})`
  }

  const handleSendOutreach = async (
    contact: OutreachContactRow,
    forceOverride = false
  ) => {
    setBusyId(contact.id)
    setNotice(null)
    try {
      const msg = buildPersonalizedMessage(contact.fullName)
      const res = await sendPersonalOutreachAction({
        contactId: contact.id,
        postAssetId: selectedAsset?.id || null,
        flyerId: selectedAsset?.flyerId || null,
        senderWhatsappLine: senderLine,
        messageText: msg,
        forceOverrideCooldown: forceOverride,
      })

      if (res.success) {
        setNotice({
          type: "success",
          text: `Outreach logged for ${contact.fullName}! Contact is now locked for 14 days (until ${new Date(
            res.cooldownUntil!
          ).toLocaleDateString("en-PK")}).`,
          waUrl: res.whatsappClickUrl,
        })
        router.refresh()
      } else {
        setNotice({
          type: "error",
          text: res.error || "Blocked by 14-day cooldown",
        })
      }
    } finally {
      setBusyId(null)
    }
  }

  const handleMarkInboundReply = async (contactId: string, name: string) => {
    setBusyId(`reply-${contactId}`)
    try {
      const res = await markContactInboundReplyAction(contactId)
      if (res.success) {
        setNotice({
          type: "success",
          text: `${name} marked as "Active Inbound Reply" with the 14-day cooldown unlocked so you can reply freely!`,
        })
        router.refresh()
      }
    } finally {
      setBusyId(null)
    }
  }

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || !whatsappNumber.trim()) return
    setBusyId("add_contact")
    try {
      const res = await upsertOutreachContact({
        fullName,
        whatsappNumber,
        city: "Lahore",
        areaCommunity,
        sourceGroupOrChannel: sourceGroup,
        assignedWhatsappLine: senderLine,
        tags: [areaCommunity],
      })
      if (res.success) {
        setFullName("")
        setWhatsappNumber("")
        setShowAddContact(false)
        router.refresh()
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top KPI & Package Selector Bar */}
      <Card className="border-gold-border bg-card shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-12">
            <div className="md:col-span-6">
              <Label className="text-xs font-bold text-primary">
                1. Package / Spotlight Poster to Share in Today&apos;s 1-on-1
                Outreach
              </Label>
              <select
                value={selectedPostAssetId}
                onChange={(e) => setSelectedPostAssetId(e.target.value)}
                className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {postAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    [{a.postCode}] {a.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <Label className="text-xs font-semibold">
                2. Outbound WhatsApp Line
              </Label>
              <select
                value={senderLine}
                onChange={(e) => setSenderLine(e.target.value)}
                className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <option value="03274029701">Line 1: 03274029701</option>
                <option value="03190462638">Line 2: 03190462638</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 md:col-span-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddContact(!showAddContact)}
                className="h-9 w-full cursor-pointer gap-1.5 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Plus className="size-3.5 text-gold-text" aria-hidden="true" />
                <span>Add Prospective Pilgrim</span>
              </Button>
            </div>
          </div>

          {showAddContact && (
            <form
              onSubmit={handleAddContact}
              className="grid grid-cols-1 items-end gap-3 rounded-xl bg-accent/25 p-3 sm:grid-cols-5"
            >
              <div>
                <Label className="text-[11px]">Full Name *</Label>
                <Input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Col. Salman Rashid"
                  className="mt-1 h-8 bg-background text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px]">WhatsApp Number *</Label>
                <Input
                  required
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="0321 4567890"
                  className="mt-1 h-8 bg-background font-mono text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px]">Area / Society</Label>
                <Input
                  value={areaCommunity}
                  onChange={(e) => setAreaCommunity(e.target.value)}
                  className="mt-1 h-8 bg-background text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px]">Source WhatsApp Group</Label>
                <Input
                  value={sourceGroup}
                  onChange={(e) => setSourceGroup(e.target.value)}
                  className="mt-1 h-8 bg-background text-xs"
                />
              </div>
              <div>
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 w-full cursor-pointer text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Save Contact
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {notice && (
        <div
          className={`flex flex-col justify-between gap-3 rounded-xl border p-4 text-xs font-medium sm:flex-row sm:items-center ${
            notice.type === "error"
              ? "border-status-danger-border bg-status-danger-bg text-status-danger"
              : "border-status-success-border bg-status-success-bg text-status-success"
          }`}
        >
          <span>{notice.text}</span>
          <div className="flex items-center gap-2">
            {notice.waUrl && (
              <a
                href={notice.waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-gold hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <MessageSquare className="size-3.5" aria-hidden="true" />
                <span>Open WhatsApp Chat</span>
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            )}
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="cursor-pointer text-[11px] underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Queue Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={queueFilter === "eligible" ? "default" : "outline"}
          onClick={() => setQueueFilter("eligible")}
          className="cursor-pointer gap-2 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Unlock className="size-3.5 text-gold" aria-hidden="true" />
          <span>Today&apos;s Eligible Outreach Queue ({eligibleCount})</span>
        </Button>

        <Button
          type="button"
          variant={queueFilter === "locked" ? "default" : "outline"}
          onClick={() => setQueueFilter("locked")}
          className="cursor-pointer gap-2 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Lock className="size-3.5 text-status-warning" aria-hidden="true" />
          <span>14-Day Cooldown Locked ({lockedCount})</span>
        </Button>

        <Button
          type="button"
          variant={queueFilter === "all" ? "default" : "outline"}
          onClick={() => setQueueFilter("all")}
          className="cursor-pointer gap-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <UserCheck className="size-3.5" aria-hidden="true" />
          <span>All Contacts ({initialContacts.length})</span>
        </Button>
      </div>

      {/* Contacts Queue Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-8">
          {filteredContacts.map((contact) => {
            const alreadySharedSelected =
              selectedAsset &&
              contact.packagesSharedHistory?.includes(selectedAsset.postCode)

            return (
              <Card
                key={contact.id}
                className={`border transition-colors motion-reduce:transition-none ${
                  contact.cooldown.isEligibleToday
                    ? "border-border bg-card"
                    : "border-status-warning-border bg-status-warning-bg/35"
                }`}
              >
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-sm font-bold text-foreground">
                        {contact.fullName}
                      </h3>
                      <span className="font-mono text-xs font-semibold text-status-success">
                        {contact.whatsappNumber}
                      </span>
                      <Badge variant="outline" className="text-[11px]">
                        {contact.areaCommunity || contact.city}
                      </Badge>
                      {contact.sourceGroupOrChannel && (
                        <span className="text-[11px] text-muted-foreground">
                          Source: {contact.sourceGroupOrChannel}
                        </span>
                      )}
                    </div>

                    {/* Cooldown Status Pill */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {contact.cooldown.isEligibleToday ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-status-success-border bg-status-success-bg px-2.5 py-0.5 text-[11px] font-bold text-status-success">
                          <CheckCircle2
                            className="size-3 text-status-success"
                            aria-hidden="true"
                          />
                          <span>
                            {contact.cooldown.isActiveReplyExemption
                              ? "Unlocked (Customer Replied: Active Conversation)"
                              : "Eligible for Today's Outreach"}
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-status-warning-border bg-status-warning-bg px-2.5 py-0.5 text-[11px] font-bold text-status-warning">
                          <Lock
                            className="size-3 text-status-warning"
                            aria-hidden="true"
                          />
                          <span>
                            14-Day Cooldown Lock:{" "}
                            {contact.cooldown.daysRemaining} Day(s) Left
                            (Unlocks{" "}
                            {contact.cooldown.cooldownUntil?.toLocaleDateString(
                              "en-PK"
                            )}
                            )
                          </span>
                        </span>
                      )}

                      {alreadySharedSelected && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-status-warning-bg px-2 py-0.5 text-[11px] font-bold text-status-warning">
                          <AlertTriangle
                            className="size-3 text-status-warning"
                            aria-hidden="true"
                          />
                          <span>
                            Already received [{selectedAsset?.postCode}]
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Packages Previously Shared Memory */}
                    <div className="flex flex-wrap items-center gap-1 pt-0.5">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Previously Shared (
                        {contact.packagesSharedHistory?.length || 0}
                        ):
                      </span>
                      {(contact.packagesSharedHistory || []).length === 0 ? (
                        <span className="text-[11px] text-muted-foreground italic">
                          None yet
                        </span>
                      ) : (
                        contact.packagesSharedHistory.map((code) => (
                          <span
                            key={code}
                            className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-bold text-primary"
                          >
                            {code}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Outreach Actions */}
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {contact.cooldown.isEligibleToday ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busyId === contact.id}
                        onClick={() => handleSendOutreach(contact, false)}
                        className="cursor-pointer gap-1.5 bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        {busyId === contact.id ? (
                          <Loader2
                            className="size-3.5 animate-spin text-gold motion-reduce:animate-none"
                            aria-hidden="true"
                          />
                        ) : (
                          <Send
                            className="size-3.5 text-gold"
                            aria-hidden="true"
                          />
                        )}
                        <span>Send Package &amp; Lock 14 Days</span>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busyId === `reply-${contact.id}`}
                        onClick={() =>
                          handleMarkInboundReply(contact.id, contact.fullName)
                        }
                        className="h-8 cursor-pointer border-status-success-border bg-status-success-bg text-[11px] font-semibold text-status-success hover:bg-status-success-bg/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        <Unlock
                          className="size-3 text-status-success"
                          aria-hidden="true"
                        />
                        <span>Customer Replied (Unlock)</span>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Right Column: Recent 1-on-1 Outreach Audit Feed */}
        <div className="lg:col-span-4">
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="flex items-center gap-2 font-display text-sm font-bold">
                <Clock className="size-4 text-gold-text" aria-hidden="true" />
                <span>Recent 1-on-1 Outreach Log</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Every personal package share automatically starts a 14-day
                cooldown timer.
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-[540px] space-y-2.5 overflow-y-auto p-3">
              {recentLogs.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  No outreach logs recorded yet.
                </p>
              ) : (
                recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="space-y-1 rounded-lg bg-secondary/50 p-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-foreground">
                        {log.contact?.fullName}
                      </strong>
                      {log.postAsset && (
                        <span className="rounded bg-primary px-1.5 py-0.5 font-mono text-[10px] font-bold text-gold">
                          {log.postAsset.postCode}
                        </span>
                      )}
                    </div>
                    <p className="line-clamp-2 text-[11px] text-muted-foreground">
                      {log.messageText}
                    </p>
                    <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground tabular-nums">
                      <span>Line: {log.senderWhatsappLine}</span>
                      <span>
                        {new Date(log.sentAt).toLocaleDateString("en-PK", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
