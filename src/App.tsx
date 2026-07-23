import { useState } from 'react'
import { LoginPage } from './routes/LoginPage'
import { clearSession, getAccessToken } from './auth/session'
import styles from './App.module.css'

/**
 * There is no router yet — Task 3 brings react-router, the nine routes from the IA, and the
 * three-step redirect guard (no session → /login; session with zero accounts → /setup;
 * otherwise the requested route). Until then this is the smallest thing that makes Task 1's
 * slice observable end to end: sign in, and see that a real token came back.
 */
export default function App() {
  const [signedIn, setSignedIn] = useState(() => getAccessToken() !== null)

  if (!signedIn) {
    return <LoginPage onSignedIn={() => setSignedIn(true)} />
  }

  return (
    <main className={styles.placeholder}>
      <div>
        <h1 className={styles.heading}>Signed in</h1>
        <p className={styles.note}>
          The ledger lands in the tasks after this one. This screen exists only to show that the
          sign-in slice completed and a session is held.
        </p>
        <button
          className={styles.signOut}
          type="button"
          onClick={() => {
            // Local only. Revoking the Session server-side is the `logout` operation, and it
            // belongs with the app shell's account menu in Task 3 rather than here.
            clearSession()
            setSignedIn(false)
          }}
        >
          Sign out
        </button>
      </div>
    </main>
  )
}
