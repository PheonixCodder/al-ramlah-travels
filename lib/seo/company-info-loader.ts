import { cache } from "react"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { agencySettings } from "@/db/schema"
import {
  DEFAULT_COMPANY_INFO,
  getCompanyInfo,
  type ResolvedCompanyInfo,
} from "@/lib/company-info"

export const getCachedCompanyInfo: () => Promise<ResolvedCompanyInfo> = cache(
  async (): Promise<ResolvedCompanyInfo> => {
    try {
      const [row] = await db
        .select()
        .from(agencySettings)
        .where(eq(agencySettings.id, "default"))
        .limit(1)
      return getCompanyInfo(row ?? null)
    } catch {
      return DEFAULT_COMPANY_INFO
    }
  }
)
