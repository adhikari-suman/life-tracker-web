import type { Transaction } from '../api/generated/types.gen'

// The ledger list, flattened into day headings interleaved with rows.
//
// ADR-0018 made the server's order `date desc, time desc, created_at desc` — the order things
// HAPPENED rather than the order they were typed. Without a heading that change is invisible: a
// row shows a verb, accounts and an amount, and nothing temporal at all. Grouping by day is what
// makes it legible, and it groups by DATE alone because the date is the sole key everything else
// groups by too; the time orders a day and does nothing else, so it stays off the rows.
//
// The input is assumed already in the server's order. This does not sort — it only cuts the list
// where the date changes, so a run of the same date becomes one group.

export type DayItem =
  | { kind: 'day'; key: string; date: string }
  | { kind: 'row'; key: string; transaction: Transaction }

export function groupByDay(transactions: readonly Transaction[]): DayItem[] {
  const items: DayItem[] = []
  let currentDate: string | null = null
  for (const transaction of transactions) {
    if (transaction.date !== currentDate) {
      currentDate = transaction.date
      items.push({ kind: 'day', key: `day-${currentDate}`, date: currentDate })
    }
    items.push({ kind: 'row', key: transaction.id, transaction })
  }
  return items
}

/**
 * The heading for a day: "Today", "Yesterday", or "Tuesday 21 July".
 *
 * `date` and `today` are both YYYY-MM-DD wall-clock dates. Note the parse: the parts are pulled
 * apart and fed to the Date constructor as LOCAL values, never `new Date('2026-07-21')` — that
 * form is specified as UTC midnight, so anyone west of UTC would see every heading render as the
 * previous day. It is the same trap `clock.ts` avoids with toISOString(), just pointing the other
 * way, and a ledger that renders the 21st as "Monday 20 July" is lying about the one field
 * reporting groups by.
 */
export function dayHeading(date: string, today: string): string {
  if (date === today) return 'Today'

  /* oxlint-disable no-restricted-globals -- calendar date parts, not money. A year, a month and a
     day are counts and belong in a Date constructor; no amount passes through here. */
  const [year, month, day] = date.split('-').map(Number)
  const local = new Date(year, month - 1, day)

  const [ty, tm, td] = today.split('-').map(Number)
  /* oxlint-enable no-restricted-globals */
  const yesterday = new Date(ty, tm - 1, td - 1)
  if (
    local.getFullYear() === yesterday.getFullYear() &&
    local.getMonth() === yesterday.getMonth() &&
    local.getDate() === yesterday.getDate()
  ) {
    return 'Yesterday'
  }

  // The year is included only when it is not the current one — a ledger is mostly read within its
  // own year, and "Tuesday 21 July 2026" is noise until it is not.
  const withYear = local.getFullYear() !== ty
  return local.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(withYear ? { year: 'numeric' } : {}),
  })
}
