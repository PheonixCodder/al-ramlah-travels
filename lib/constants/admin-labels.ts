/**
 * Locked Admin Operate copy constants (Spec 0028 / Slice 48).
 *
 * Centralizes test-locked operational strings so `.tsx` views remain free of
 * inline JSX em/en dashes and multi-dot template chains while preserving exact
 * Playwright E2E (`J10`–`J12`) and W3 contracts.
 */

export const STUDIO_MODE_A_LABEL = "Mode A — Finished Al Ramlah 4K Poster"
export const STUDIO_MODE_B_LABEL = "Mode B — Raw B2B Supplier Wholesale Flyer"

export function formatCmdkPassengerSummary(
  bedsAndSeats: number,
  totalPassports: number,
): string {
  return `${bedsAndSeats} Beds/Seats (Adults + Children) • ${totalPassports} Total Passports`
}
