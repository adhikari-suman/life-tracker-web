import { Link } from 'react-router'
import styles from './placeholders.module.css'

// Every route in the information architecture exists and resolves as of Task 3, because a guard
// can only be proved unbypassable if there is something on the other side of it to reach. The
// pages themselves belong to later tasks.
//
// They live in one file rather than eight near-identical ones. Each moves out to its own file
// when the task named on it is built — at which point this file shrinks and eventually goes.

function Placeholder({ title, task, children }: { title: string; task: string; children?: React.ReactNode }) {
  return (
    <section className={styles.placeholder}>
      <h2 className={styles.heading}>{title}</h2>
      {children}
      <p className={styles.task}>Not built yet — {task}.</p>
    </section>
  )
}

/* -------------------------------------------------------------------------- authenticated -- */

export function LedgerPage() {
  return (
    <Placeholder
      title="Ledger"
      task="the entry form is the intent selector, amount field and account pickers; the list is the transaction list task"
    />
  )
}

export function AccountsPage() {
  return (
    <Placeholder
      title="Accounts"
      task="balances grouped by kind, totalled per currency and never across them"
    />
  )
}

export function TransactionDetailPage() {
  return (
    <Placeholder
      title="Transaction"
      task="the transaction detail, relabel and reverse task"
    />
  )
}

export function SetupPage() {
  return (
    <Placeholder
      title="Set up your accounts"
      task="the first-run onboarding task, which must be resumable rather than restartable"
    >
      <p className={styles.note}>
        Recording anything needs at least one account to spend from and one to spend on. This is
        the only screen in the app you cannot navigate away from, because every other one would
        be a form that cannot succeed.
      </p>
    </Placeholder>
  )
}

/* ------------------------------------------------------------------------ unauthenticated -- */

export function RegisterPage() {
  return (
    <Placeholder title="Create an account" task="registration is not in this build's task list">
      <p className={styles.note}>
        <Link to="/login" className={styles.link}>
          Back to sign in
        </Link>
      </p>
    </Placeholder>
  )
}

export function ForgotPasswordPage() {
  return (
    <Placeholder title="Forgot your password?" task="password reset is assumed minimal in the brief">
      <p className={styles.note}>
        <Link to="/login" className={styles.link}>
          Back to sign in
        </Link>
      </p>
    </Placeholder>
  )
}

export function ResetPasswordPage() {
  return <Placeholder title="Set a new password" task="password reset is assumed minimal in the brief" />
}

export function VerifyEmailPage() {
  return <Placeholder title="Verify your email" task="email verification is assumed minimal in the brief" />
}

/* ---------------------------------------------------------------------------------- 404 --- */

export function NotFoundPage() {
  return (
    <section className={styles.placeholder}>
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
