import { Resend } from "resend"
import { z } from "zod"
import { getCompanyInfo, type CompanyInfo } from "@/lib/company-info"
import { isAuditLocalE2eMode } from "../env"
import { logger } from "../logger"
import { escapeAttr, escapeHtml, sanitizeSafeUrl } from "./html-escape"

export interface EmailAttachment {
  filename: string
  content: Buffer | string
  contentType?: string
}

export interface TransactionalEmailPayload {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
  attachments?: EmailAttachment[]
}

export interface TransactionalEmailResult {
  delivered: boolean
  dryRun: boolean
  providerMessageId: string | null
}

export type MailTransport = (
  payload: TransactionalEmailPayload & { from: string }
) => Promise<TransactionalEmailResult>

const emailAddressSchema = z.email()

const payloadSchema = z.object({
  to: z.union([emailAddressSchema, z.array(emailAddressSchema).min(1)]),
  subject: z.string().trim().min(1).max(240),
  html: z.string().min(1),
  text: z.string().optional(),
  replyTo: emailAddressSchema.optional(),
})

let customTransport: MailTransport | null = null
const testOutbox: Array<
  TransactionalEmailPayload & { from: string; sentAt: string }
> = []

export function setMailTransportForTests(transport: MailTransport | null): void {
  customTransport = transport
}

export function getSentMailOutboxForTests(): ReadonlyArray<
  TransactionalEmailPayload & { from: string; sentAt: string }
> {
  return testOutbox
}

export function clearSentMailOutboxForTests(): void {
  testOutbox.length = 0
}

function resolveSenderFrom(): string {
  const configured = process.env.EMAIL_FROM?.trim()
  if (configured && configured.length > 0) {
    return configured
  }
  return "Al Ramlah Travels <noreply@alramlahtravels.com>"
}

export async function sendTransactionalEmail(
  rawPayload: TransactionalEmailPayload
): Promise<TransactionalEmailResult> {
  const validated = payloadSchema.parse(rawPayload)
  const payload: TransactionalEmailPayload = {
    ...validated,
    attachments: rawPayload.attachments,
  }
  const from = resolveSenderFrom()

  if (customTransport) {
    return customTransport({ ...payload, from })
  }

  const resendApiKey = process.env.RESEND_API_KEY?.trim()
  const isPlaceholderKey =
    !resendApiKey ||
    resendApiKey.startsWith("re_audit_") ||
    resendApiKey.startsWith("re_test_placeholder") ||
    resendApiKey === "re_your_api_key_here"

  if (isPlaceholderKey || process.env.NODE_ENV === "test") {
    if (process.env.NODE_ENV === "production" && !isAuditLocalE2eMode()) {
      throw new Error(
        "RESEND_API_KEY must be configured with a live Resend API key in production."
      )
    }

    if (testOutbox.length >= 100) {
      testOutbox.shift()
    }
    testOutbox.push({
      ...payload,
      from,
      sentAt: new Date().toISOString(),
    })

    logger.info("Transactional email captured in dry-run transport", {
      to: payload.to,
      subject: payload.subject,
      attachmentCount: payload.attachments?.length ?? 0,
    })

    return {
      delivered: true,
      dryRun: true,
      providerMessageId: `dryrun_${Date.now()}`,
    }
  }

  const resend = new Resend(resendApiKey)
  const response = await resend.emails.send({
    from,
    to: Array.isArray(payload.to) ? payload.to : [payload.to],
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    replyTo: payload.replyTo,
    attachments: payload.attachments?.map((att) => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType,
    })),
  })

  if (response.error) {
    logger.error("Resend transactional email failed", {
      to: payload.to,
      subject: payload.subject,
      providerError: response.error.message,
    })
    throw new Error(`Email delivery failed: ${response.error.message}`)
  }

  logger.info("Transactional email dispatched via Resend", {
    to: payload.to,
    subject: payload.subject,
    providerMessageId: response.data?.id ?? null,
  })

  return {
    delivered: true,
    dryRun: false,
    providerMessageId: response.data?.id ?? null,
  }
}

export async function sendPasswordResetEmail(params: {
  to: string
  recipientName?: string | null
  resetUrl: string
  expiresInMinutes?: number
}): Promise<TransactionalEmailResult> {
  const expiresMinutes = params.expiresInMinutes ?? 30
  const greetingName = escapeHtml(
    params.recipientName?.trim() || "Authorized Team Member"
  )
  const safeHref = escapeAttr(params.resetUrl)
  const safeDisplayUrl = escapeHtml(params.resetUrl)

  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:24px;background-color:#FAF7F0;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#14281D;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E4DCCB;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="background:#0A3622;padding:20px 28px;border-bottom:3px solid #C5A059;">
          <p style="margin:0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#ECD9B0;">Al Ramlah Travels · Executive Admin Portal</p>
          <h1 style="margin:6px 0 0;font-size:20px;color:#FFFFFF;font-weight:700;">Password Reset Request</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:28px;">
          <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Assalamu Alaikum ${greetingName},</p>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#3E4E44;">
            We received a request to reset the password for your Al Ramlah Travels staff account. Use the secure button below within <strong>${expiresMinutes} minutes</strong>:
          </p>
          <p style="margin:0 0 24px;">
            <a href="${safeHref}" style="display:inline-block;background:#0A3622;color:#FFFFFF;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:600;border:1px solid #C5A059;">
              Reset Admin Password
            </a>
          </p>
          <p style="margin:0 0 8px;font-size:12px;color:#526158;">If the button does not open, copy this link into your browser:</p>
          <p style="margin:0 0 20px;font-size:12px;word-break:break-all;color:#0A3622;">${safeDisplayUrl}</p>
          <hr style="border:none;border-top:1px solid #E4DCCB;margin:20px 0;" />
          <p style="margin:0;font-size:12px;color:#526158;">
            If you did not initiate this request, ignore this email. Your existing credentials remain protected and all active sessions are revoked upon password reset.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`

  const text = [
    `Assalamu Alaikum ${params.recipientName?.trim() || "Authorized Team Member"},`,
    "",
    `Reset your Al Ramlah Travels admin password within ${expiresMinutes} minutes:`,
    params.resetUrl,
    "",
    "If you did not request this reset, you can safely ignore this message.",
  ].join("\n")

  return sendTransactionalEmail({
    to: params.to,
    subject: "Reset your Al Ramlah Travels Admin Password",
    html,
    text,
  })
}

export async function sendQuotationEmail(params: {
  to: string
  customerName: string
  referenceNumber: string
  grandTotalPkr: number
  pdfBuffer?: Buffer
  pdfFilename?: string
  portalUrl?: string
}): Promise<TransactionalEmailResult> {
  const safeName = escapeHtml(params.customerName.trim() || "Respected Pilgrim")
  const safeRef = escapeHtml(params.referenceNumber)
  const formattedTotal = `PKR ${Math.round(params.grandTotalPkr).toLocaleString("en-PK")}`
  const safePortalHref = params.portalUrl ? escapeAttr(params.portalUrl) : null

  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:24px;background-color:#FAF7F0;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#14281D;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid #E4DCCB;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="background:#0A3622;padding:22px 28px;border-bottom:3px solid #C5A059;">
          <p style="margin:0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#ECD9B0;">Al Ramlah Travels · Lahore HQ</p>
          <h1 style="margin:6px 0 0;font-size:20px;color:#FFFFFF;font-weight:700;">Bespoke Haramain Quotation (${safeRef})</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:28px;">
          <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Assalamu Alaikum ${safeName},</p>
          <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#3E4E44;">
            Your itemized pilgrimage quotation for dossier <strong>${safeRef}</strong> is ready. Confirmed total: <strong>${escapeHtml(formattedTotal)}</strong>.
          </p>
          ${
            safePortalHref
              ? `<p style="margin:0 0 22px;"><a href="${safePortalHref}" style="display:inline-block;background:#0A3622;color:#FFFFFF;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:600;border:1px solid #C5A059;">Review &amp; Approve Quotation</a></p>`
              : ""
          }
          <p style="margin:0;font-size:12px;color:#526158;">
            Office No. 38, Street 1, Sector C, Askari 10, Airport Road, Lahore Cantt · WhatsApp: +92 327 4029701
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`

  const attachments: EmailAttachment[] | undefined = params.pdfBuffer
    ? [
        {
          filename:
            params.pdfFilename || `Al-Ramlah-Quotation-${params.referenceNumber}.pdf`,
          content: params.pdfBuffer,
          contentType: "application/pdf",
        },
      ]
    : undefined

  return sendTransactionalEmail({
    to: params.to,
    subject: `Your Al Ramlah Travels Quotation (${params.referenceNumber})`,
    html,
    text: `Assalamu Alaikum ${params.customerName}, your quotation (${params.referenceNumber}) for ${formattedTotal} is ready.${params.portalUrl ? ` View online: ${params.portalUrl}` : ""}`,
    attachments,
  })
}

export interface PilgrimDocumentPortalEmailInput {
  to: string
  customerName: string
  referenceNumber: string
  portalUrl: string
  event: "portal_unlocked" | "reupload_requested" | "all_verified"
  travellerLabel?: string
  documentLabel?: string
  rejectionReason?: string
  companyInfo?: CompanyInfo
}

/**
 * Dispatches privacy-hardened transactional emails for the Pilgrim Document Upload Portal (`AC-8`).
 * Strictly omits passport numbers, CNIC/B-Form numbers, and private R2 object keys/URLs.
 */
export async function sendPilgrimDocumentPortalEmail(
  params: PilgrimDocumentPortalEmailInput
): Promise<TransactionalEmailResult> {
  const company = params.companyInfo ?? getCompanyInfo()
  const rawName = params.customerName.trim() || "Respected Pilgrim"
  const safeName = escapeHtml(rawName)
  const safeRef = escapeHtml(params.referenceNumber.trim())
  const safePortalHref =
    sanitizeSafeUrl(params.portalUrl, { allowRelative: true }) ??
    escapeAttr(params.portalUrl)
  const safeDisplayUrl = escapeHtml(params.portalUrl)
  const safeAgencyName = escapeHtml(company.agencyName)
  const safeAddress = escapeHtml(company.officeAddress)
  const safeHotline = escapeHtml(company.hotlineDisplay)
  const safeSupportEmail = escapeHtml(company.supportEmail)

  const cleanTravellerLabel =
    params.travellerLabel?.trim() || "Traveller Slot"
  const cleanDocumentLabel =
    params.documentLabel?.trim() || "Travel Document"
  const cleanReason =
    params.rejectionReason?.trim() ||
    "Please upload a clearer, uncropped scan matching the official guidelines."

  let subject: string
  let headline: string
  let introHtml: string
  let detailBlockHtml = ""
  let ctaLabel: string
  let textLines: string[]

  if (params.event === "reupload_requested") {
    subject = `Action Required: Re-upload Travel Document (${params.referenceNumber})`
    headline = "Clearer Document Scan Requested"
    introHtml = `Our Haramain desk reviewed dossier <strong>${safeRef}</strong> and requires a replacement scan for <strong>${escapeHtml(cleanTravellerLabel)}</strong> (${escapeHtml(cleanDocumentLabel)}).`
    detailBlockHtml = `<div style="margin:0 0 20px;padding:14px 16px;background:#FEF3C7;border:1px solid #D97706;border-radius:8px;color:#92400E;font-size:13px;line-height:1.5;">
      <strong>Desk Review Note:</strong> ${escapeHtml(cleanReason)}
    </div>`
    ctaLabel = "Upload Replacement Scan"
    textLines = [
      `Assalamu Alaikum ${rawName},`,
      "",
      `Our Haramain desk reviewed dossier ${params.referenceNumber} and requires a replacement scan for ${cleanTravellerLabel} (${cleanDocumentLabel}).`,
      `Reason: ${cleanReason}`,
      "",
      `Open your secure document checklist: ${params.portalUrl}`,
    ]
  } else if (params.event === "all_verified") {
    subject = `All Travel Documents Verified (${params.referenceNumber})`
    headline = "All Travel Documents Verified"
    introHtml = `Alhamdulillah, every required passport bio page, national ID, and visa photograph for dossier <strong>${safeRef}</strong> has been verified by our desk and queued for visa processing.`
    ctaLabel = "View Verified Checklist"
    textLines = [
      `Assalamu Alaikum ${rawName},`,
      "",
      `Alhamdulillah, all required travel documents for dossier ${params.referenceNumber} have been verified by our desk and queued for visa processing.`,
      "",
      `View your verified checklist: ${params.portalUrl}`,
    ]
  } else {
    subject = `Upload Your Umrah Travel Documents (${params.referenceNumber})`
    headline = "Travel Document Checklist Unlocked"
    introHtml = `Your booking <strong>${safeRef}</strong> is approved and your deposit has been verified. Please enter each traveller's passport expiry details and upload clear scans via your private document portal below.`
    ctaLabel = "Open Document Checklist"
    textLines = [
      `Assalamu Alaikum ${rawName},`,
      "",
      `Your booking ${params.referenceNumber} is approved and your deposit has been verified.`,
      `Open your private travel document checklist: ${params.portalUrl}`,
    ]
  }

  textLines.push(
    "",
    "Verify your booking phone number when prompted to protect your family's privacy.",
    `${company.agencyName} · ${company.officeAddress} · ${company.hotlineDisplay} · ${company.supportEmail}`
  )

  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:24px;background-color:#FAF7F0;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#14281D;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid #E4DCCB;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="background:#0A3622;padding:22px 28px;border-bottom:3px solid #C5A059;">
          <p style="margin:0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#ECD9B0;">${safeAgencyName} · Haramain Concierge</p>
          <h1 style="margin:6px 0 0;font-size:20px;color:#FFFFFF;font-weight:700;">${escapeHtml(headline)} (${safeRef})</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:28px;">
          <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Assalamu Alaikum ${safeName},</p>
          <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#3E4E44;">${introHtml}</p>
          ${detailBlockHtml}
          <p style="margin:0 0 22px;">
            <a href="${safePortalHref}" style="display:inline-block;background:#0A3622;color:#FFFFFF;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:600;border:1px solid #C5A059;">
              ${escapeHtml(ctaLabel)}
            </a>
          </p>
          <p style="margin:0 0 6px;font-size:12px;color:#526158;">If the button does not open, copy this private link into your browser (you will be asked to confirm your booking phone number once):</p>
          <p style="margin:0 0 20px;font-size:12px;word-break:break-all;color:#0A3622;">${safeDisplayUrl}</p>
          <hr style="border:none;border-top:1px solid #E4DCCB;margin:20px 0;" />
          <p style="margin:0;font-size:12px;color:#526158;line-height:1.5;">
            ${safeAgencyName} · ${safeAddress}<br />
            Official Desk: ${safeHotline} · ${safeSupportEmail}
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`

  return sendTransactionalEmail({
    to: params.to,
    subject,
    html,
    text: textLines.join("\n"),
    replyTo: company.supportEmail,
  })
}
