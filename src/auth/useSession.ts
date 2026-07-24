import { useContext } from 'react'
import { SessionContext, type SessionContextValue } from './sessionContext'

/**
 * Read the session. Throws rather than returning null outside a provider: every consumer needs a
 * real answer, and a silent null would surface as a mysterious redirect to /login rather than as
 * the wiring mistake it actually is.
 */
export function useSession(): SessionContextValue {
  const value = useContext(SessionContext)
  if (value === null) {
    throw new Error('useSession must be used within a SessionProvider.')
  }
  return value
}
