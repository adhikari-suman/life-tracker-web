/**
 * Where to send someone who no longer belongs on an auth page — the path RequireSession stashed
 * when it bounced them, or the ledger if there is none.
 *
 * Only same-site absolute paths are honoured. The check is not theatre even though the value
 * comes from in-memory history state rather than the URL: `//evil.example` is a protocol-relative
 * URL that a browser resolves to another origin while still looking like a path, and an app that
 * navigates to whatever it is handed is one step from being an open redirect.
 *
 * Its own file, rather than an export from guards.tsx, so that guards.tsx exports only
 * components — otherwise it is not eligible for React Fast Refresh.
 */
export function safeReturnPath(from: unknown): string {
  if (typeof from !== 'string') return '/'
  if (!from.startsWith('/')) return '/'
  if (from.startsWith('//')) return '/'
  return from
}
