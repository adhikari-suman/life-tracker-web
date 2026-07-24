// The four ranges the reports surface offers, and the conversion between a preset, the absolute
// dates the API takes, and the URL.
//
// Bounded ranges put ABSOLUTE dates in the URL, never the preset name. `?range=last-month` would
// be shorter but it is time-relative: the same link means June today and August in September, so
// it cannot be bookmarked or shared. `from` and `to` are literally the API's own parameters,
// which also satisfies the standing rule that every filter in the UI corresponds to a real server
// capability.
//
// All time is the one exception, and for the opposite reason: it has no dates to write, and the
// phrase means the same thing forever. `?range=all` is not time-relative, so it carries the same
// bookmark guarantee the absolute dates were chosen for.
//
// Note there is no `parseInt` or `Number` anywhere below. Dates are not money and the lint ban
// would permit a documented disable, but none is needed: every operation here is a string
// operation, and a lookup keyed by "07" is clearer than an array indexed by a parsed 7 anyway.

export type RangeId = 'this-month' | 'last-month' | 'this-year' | 'all-time' | 'custom'

export type DateRange = {
  id: RangeId
  /** Inclusive ISO date, or null for no lower bound. */
  from: string | null
  /** Inclusive ISO date, or null for no upper bound. */
  to: string | null
}

export const DEFAULT_RANGE_ID: RangeId = 'this-month'

export const PRESETS: { id: RangeId; label: string }[] = [
  { id: 'this-month', label: 'This month' },
  { id: 'last-month', label: 'Last month' },
  { id: 'this-year', label: 'This year' },
  { id: 'all-time', label: 'All time' },
]

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const MONTH_NAMES: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun',
  '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
}

/**
 * Local calendar parts, not UTC. A ledger's dates are the dates on the user's receipts, and
 * `toISOString()` would shift them across the date line for anyone west of Greenwich after
 * teatime — silently moving a transaction into the previous month.
 */
function isoDate(date: Date): string {
  const year = `${date.getFullYear()}`
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Resolve a preset against a given day. `today` is a parameter so this is testable. */
export function resolveRange(id: RangeId, today: Date = new Date()): DateRange {
  const year = today.getFullYear()
  const month = today.getMonth()

  switch (id) {
    case 'this-month':
      // Upper bound is today, not the end of the month: a range running into the future would
      // claim the month is over when it is the 3rd.
      return { id, from: isoDate(new Date(year, month, 1)), to: isoDate(today) }
    case 'last-month':
      return {
        id,
        from: isoDate(new Date(year, month - 1, 1)),
        // Day 0 of this month is the last day of the previous one — which is also how February
        // and leap years get handled without a table.
        to: isoDate(new Date(year, month, 0)),
      }
    case 'this-year':
      return { id, from: isoDate(new Date(year, 0, 1)), to: isoDate(today) }
    default:
      return { id: 'all-time', from: null, to: null }
  }
}

/**
 * Read the range out of the URL.
 *
 * A bookmark carrying dates that match no preset is honoured rather than discarded — they are
 * valid API input, and throwing them away would break the one thing absolute dates were chosen
 * for. It surfaces as `custom`, which the picker labels rather than hides.
 */
export function rangeFromParams(params: URLSearchParams, today: Date = new Date()): DateRange {
  if (params.get('range') === 'all') return resolveRange('all-time', today)

  const from = params.get('from')
  const to = params.get('to')

  // Half a range, or a malformed one, is not a range. Fall back rather than send the server
  // something it will reject.
  if (from === null || to === null || !ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    return resolveRange(DEFAULT_RANGE_ID, today)
  }

  const match = PRESETS.map((preset) => resolveRange(preset.id, today)).find(
    (candidate) => candidate.from === from && candidate.to === to,
  )
  return match ?? { id: 'custom', from, to }
}

/**
 * The query string for a range. The default writes nothing, so the commonest state has the
 * cleanest URL and a link to "now" needs no stripping.
 */
export function paramsForRange(range: DateRange): URLSearchParams {
  const params = new URLSearchParams()
  if (range.id === DEFAULT_RANGE_ID) return params
  if (range.id === 'all-time') {
    params.set('range', 'all')
    return params
  }
  if (range.from !== null && range.to !== null) {
    params.set('from', range.from)
    params.set('to', range.to)
  }
  return params
}

/** Leading zero off a day, as a string operation. "04" -> "4", "24" -> "24". */
function day(value: string): string {
  return value.startsWith('0') ? value.slice(1) : value
}

/** "1 – 24 Jul 2026", "1 – 30 Jun 2026", "All time". Written for reading, not for parsing. */
export function describeRange(range: DateRange): string {
  if (range.from === null || range.to === null) return 'All time'

  const [fromYear, fromMonth, fromDay] = range.from.split('-')
  const [toYear, toMonth, toDay] = range.to.split('-')

  if (fromYear === toYear && fromMonth === toMonth) {
    return `${day(fromDay)} – ${day(toDay)} ${MONTH_NAMES[toMonth]} ${toYear}`
  }
  if (fromYear === toYear) {
    return `${day(fromDay)} ${MONTH_NAMES[fromMonth]} – ${day(toDay)} ${MONTH_NAMES[toMonth]} ${toYear}`
  }
  return `${day(fromDay)} ${MONTH_NAMES[fromMonth]} ${fromYear} – ${day(toDay)} ${MONTH_NAMES[toMonth]} ${toYear}`
}
