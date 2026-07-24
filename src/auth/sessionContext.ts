import { createContext } from 'react'
import type { Account, TokenResponse, User } from '../api/generated/types.gen'

// The context object and its types, kept apart from the SessionProvider component so that the
// provider file exports only a component (a requirement for React Fast Refresh). useSession
// reads this; SessionProvider supplies it.

// The state the redirect guard reads. It is deliberately derived from the SERVER, not from
// whether a token happens to be sitting in sessionStorage: a token can be expired, revoked, or
// typed in by hand, and any of those would otherwise look like a valid session to the router.
// `getMe` answering 200 is the only thing this app accepts as proof of a session.
export type SessionState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: User; accounts: Account[] }

export type SessionContextValue = {
  state: SessionState
  /** Store the tokens from a login or register response and load the session behind them. */
  establish: (tokens: TokenResponse) => Promise<void>
  /** Re-read accounts. Called by /setup, which changes the answer to the guard's second step. */
  refreshAccounts: () => Promise<void>
  /** Revoke the Session server-side, then drop the local tokens. */
  signOut: () => Promise<void>
}

export const SessionContext = createContext<SessionContextValue | null>(null)
