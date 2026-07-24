import { client } from './generated/client.gen'
import { refresh } from './generated/sdk.gen'
import { clearSession, getRefreshToken, storeSession } from '../auth/session'

// Transparent token refresh. Access tokens are short-lived (~15 min), so one will expire in the
// middle of a session — and the brief is explicit that this must not lose the user's typed
// values. A response interceptor catches the 401, rotates the refresh token once, and re-issues
// the original request with the new access token, so the call the user made simply succeeds a
// moment later instead of failing.
//
// Two things this gets right that a naive version does not:
//
//  - SINGLE-FLIGHT. A page can fire several requests at once, and if each tried to refresh, the
//    first rotation would invalidate the token the others hold — and the spec treats a replayed
//    refresh token as theft and revokes the whole Session. So concurrent 401s all await ONE
//    refresh, and then retry.
//
//  - BODY-SAFE RETRY. The original Request's body is already consumed by the first fetch, so it
//    cannot be cloned. The client hands the interceptor `opts.serializedBody` — the serialized
//    body before it was sent — which is re-usable, so a POST (recording a transaction) retries
//    correctly rather than silently dropping its body.

/** Dispatched when refresh fails for good; the session is over. SessionProvider listens. */
export const SESSION_EXPIRED_EVENT = 'lt:session-expired'

// The single in-flight refresh, shared by every request that 401s while it runs.
let refreshInFlight: Promise<string | null> | null = null

function isAuthEndpoint(url: string): boolean {
  // A 401 from these is a real credential/token failure, not an expired access token — retrying
  // would loop. /auth/refresh especially must never trigger another refresh.
  return url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/refresh')
}

async function runRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (refreshToken === null) return null

  const { data } = await refresh({ body: { refreshToken } })
  if (data === undefined) {
    // Expired, unknown, or replayed (Session revoked). The session is over.
    clearSession()
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
    return null
  }
  storeSession(data)
  return data.accessToken
}

export function installAuthRefresh(): void {
  client.interceptors.response.use(async (response, request, opts) => {
    if (response.status !== 401 || isAuthEndpoint(request.url)) return response
    if (getRefreshToken() === null) return response

    // Join the in-flight refresh, or start it. Cleared when it settles so the next expiry can
    // start a fresh one.
    refreshInFlight ??= runRefresh().finally(() => {
      refreshInFlight = null
    })
    const newAccessToken = await refreshInFlight

    if (newAccessToken === null) return response // refresh failed; surface the original 401

    // Re-issue the original request with the new token. serializedBody is the already-serialized
    // body (a string or undefined), reusable where the consumed Request body is not.
    const headers = new Headers(request.headers)
    headers.set('Authorization', `Bearer ${newAccessToken}`)

    // The serialized body lives on opts; typed loosely because the client's option shape is not
    // exported. This is request plumbing, not application code.
    const serializedBody = (opts as { serializedBody?: BodyInit }).serializedBody

    return fetch(request.url, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : serializedBody,
      redirect: 'follow',
    })
  })
}
