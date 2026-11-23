import type { Metadata } from "next"
import { forbidden, notFound } from "next/navigation"
import { resolvePublicDocumentPortalByToken } from "@/app/actions/pilgrim-documents"
import { PilgrimDocumentPortal } from "@/components/public/pilgrim-document-portal"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: {
    absolute: "Pilgrim Travel Document Checklist | Al Ramlah Travels",
  },
  description:
    "Securely upload passport scans, national ID cards, and visa photographs for your approved Umrah journey.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
    nosnippet: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      noarchive: true,
      nosnippet: true,
    },
  },
  referrer: "no-referrer",
}

interface PublicDocumentsPageProps {
  params: Promise<{ token: string }>
}

export default async function PublicDocumentsPage({
  params,
}: PublicDocumentsPageProps) {
  const { token } = await params
  const cleanToken = typeof token === "string" ? token.trim() : ""
  const resolution = await resolvePublicDocumentPortalByToken(cleanToken)

  if (resolution.state === "not_found") {
    notFound()
  }

  if (resolution.state === "locked") {
    forbidden()
  }

  return <PilgrimDocumentPortal token={cleanToken} resolution={resolution} />
}
