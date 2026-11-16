import type { Metadata } from "next"
import { AdminLoginClient } from "@/components/admin/auth/admin-login-client"

export const metadata: Metadata = {
  title: "Staff & Super Admin Sign In | Al Ramlah Travels Admin",
  description:
    "Secure staff and super admin authentication portal for Al Ramlah Travels Askari 10 Lahore Cantt pilgrimage operations, quoting desk, and CRM.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
}

export default function AdminLoginPage() {
  return <AdminLoginClient />
}
