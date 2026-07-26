// Readings of the device clock, in the shapes the wire expects.
//
// A transaction's date and time are a WALL CLOCK, never an instant (ADR-0018) — 19:42 means 19:42
// where the person was standing. So both are composed from local date/time parts and neither ever
// goes near toISOString(), which would shift a late-evening entry across midnight for anyone west
// of UTC and silently move it into the previous month.
//
// The server cannot supply either: it runs in UTC and has no idea what the clock on your wall said.
// The client is the only party that knows, which is why `time` is required on the wire.

/** The calendar date an entry defaults to, YYYY-MM-DD, in the user's own local zone. */
export function todayISO(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** The wall-clock time an entry defaults to, HH:mm and zoneless — the reading on the local clock. */
export function nowHHmm(): string {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}
