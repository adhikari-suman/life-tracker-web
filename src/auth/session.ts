import type { TokenResponse } from '../api/generated/types.gen'

// Token storage for the browser client.
//
// !! PRE-PRODUCTION HARDENING — see /auth/login in life-tracker-contracts/openapi.yaml.
// The spec itself is explicit: keeping the refresh token in JS-reachable storage on web is an
// XSS exposure, and browser refresh delivery must move to an httpOnly, Secure, SameSite cookie
// before this client faces real users. It says "do not ship web without it". That is a spec
// change, so it is not fixable here — this module is where it lands when it happens, and
// everything outside this file already goes through these four functions.
//
// sessionStorage rather than localStorage: a token dies with the tab, which is a smaller window
// than "until someone clears site data" and costs nothing, since a Session is per-device anyway.

const ACCESS_KEY = 'lt.accessToken'
const REFRESH_KEY = 'lt.refreshToken'

// Held in memory as well so the hot path never touches storage, and so a browser that denies
// sessionStorage (Safari private mode, some embedded webviews) still works for the tab's life.
let accessToken: string | null = null
let refreshToken: string | null = null

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, value)
  } catch {
    // Storage unavailable. The in-memory copy still serves this tab.
  }
}

export function getAccessToken(): string | null {
  return (accessToken ??= read(ACCESS_KEY))
}

export function getRefreshToken(): string | null {
  return (refreshToken ??= read(REFRESH_KEY))
}

/** Store the token pair from a login, register, or refresh response. */
export function storeSession(tokens: TokenResponse): void {
  accessToken = tokens.accessToken
  refreshToken = tokens.refreshToken
  write(ACCESS_KEY, accessToken)
  write(REFRESH_KEY, refreshToken)
}

/** Drop both tokens. Called on sign-out and on an unrecoverable 401. */
export function clearSession(): void {
  accessToken = null
  refreshToken = null
  write(ACCESS_KEY, null)
  write(REFRESH_KEY, null)
}
