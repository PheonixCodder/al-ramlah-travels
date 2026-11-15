import {
  DEFAULT_COMPANY_INFO,
  type ResolvedCompanyInfo,
} from "@/lib/company-info"

export async function getCachedCompanyInfo(): Promise<ResolvedCompanyInfo> {
  return DEFAULT_COMPANY_INFO
}
