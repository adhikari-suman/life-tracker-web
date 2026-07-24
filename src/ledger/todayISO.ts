// The calendar date an entry defaults to. A transaction's date is a calendar date, not a
// timestamp — a precise instant is metadata (ADR-0003) — so this is a YYYY-MM-DD string in the
// user's own local zone. Computed from the local date parts, never from toISOString(), which
// would shift the date across midnight for anyone west of UTC.
export function todayISO(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
