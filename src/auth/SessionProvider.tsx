import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { TokenResponse } from '../api/generated/types.gen'
import { getMe, listAccounts, logout } from '../api/generated/sdk.gen'
import { SESSION_EXPIRED_EVENT } from '../api/authRefresh'
import { clearSession, getAccessToken, storeSession } from './session'
import { SessionContext, type SessionState } from './sessionContext'

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' })

  const load = useCallback(async (): Promise<void> => {
    if (getAccessToken() === null) {
      // Nothing to ask about. Skipping the request keeps the sign-in screen instant for the
      // common case of arriving with no session at all.
      setState({ status: 'anonymous' })
      return
    }

    const me = await getMe()
    if (me.data === undefined) {
      // Any failure here is treated as "no session", including a network failure. That is the
      // safe direction: it sends the user to /login rather than into a shell whose every
      // request will fail. A stale token is also discarded, so this does not loop.
      clearSession()
      setState({ status: 'anonymous' })
      return
    }

    const accounts = await listAccounts()
    setState({
      status: 'authenticated',
      user: me.data,
      // An accounts fetch that fails is treated as zero accounts, which routes to /setup. That
      // is the conservative reading: /setup is resumable by design and shows what already
      // exists, so arriving there wrongly is recoverable, where wrongly entering the ledger
      // means an entry form with no accounts to choose from.
      accounts: accounts.data ?? [],
    })
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // When a refresh fails for good — an expired or replayed refresh token — the interceptor has
  // already cleared the tokens and fires this. Drop to anonymous so the guard sends the user to
  // /login on the next render, preserving where they were.
  useEffect(() => {
    function onExpired() {
      setState({ status: 'anonymous' })
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  }, [])

  const establish = useCallback(
    async (tokens: TokenResponse) => {
      storeSession(tokens)
      setState({ status: 'loading' })
      await load()
    },
    [load],
  )

  const refreshAccounts = useCallback(async () => {
    const accounts = await listAccounts()
    setState((current) =>
      current.status === 'authenticated'
        ? { ...current, accounts: accounts.data ?? current.accounts }
        : current,
    )
  }, [])

  const refreshUser = useCallback(async () => {
    const me = await getMe()
    setState((current) =>
      current.status === 'authenticated' && me.data !== undefined
        ? { ...current, user: me.data }
        : current,
    )
  }, [])

  const signOut = useCallback(async () => {
    // Server first, so the Session is actually revoked rather than merely forgotten here. The
    // result is not checked: if it fails the local tokens must still go, and a client that
    // refused to sign out because the network was down would be worse than useless.
    await logout()
    clearSession()
    setState({ status: 'anonymous' })
  }, [])

  const value = useMemo(
    () => ({ state, establish, refreshAccounts, refreshUser, signOut }),
    [state, establish, refreshAccounts, refreshUser, signOut],
  )

  return <SessionContext value={value}>{children}</SessionContext>
}
