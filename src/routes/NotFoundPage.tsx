import { Link } from 'react-router'
import styles from './authForm.module.css'

// Was the last resident of placeholders.tsx, which existed so that every route in the IA resolved
// to something while its page was still unbuilt — a guard can only be proved unbypassable if there
// is something on the other side of it to reach. That file said it would shrink and eventually go
// as each page was built. It has now gone; this was never a placeholder anyway.
//
// Sits outside every guard. An unknown address is not a permission problem, and answering one with
// a redirect to /login would tell an anonymous visitor that the address exists.

export function NotFoundPage() {
  return (
    <section className={styles.outcome}>
      <h2 className={styles.heading}>Not found</h2>
      <p className={styles.note}>
        There is nothing at this address.{' '}
        <Link to="/" className={styles.link}>
          Go to the ledger
        </Link>
        .
      </p>
    </section>
  )
}
