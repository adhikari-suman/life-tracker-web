import { useMemo, useState } from 'react'
import type { AccountKind } from '../api/generated/types.gen'
import { createAccount } from '../api/generated/sdk.gen'
import { toAppProblem, type AppProblem } from '../api/problem'
import { useSession } from '../auth/useSession'
import { MoneyText } from '../money/MoneyText'
import { ProblemBanner } from '../components/ProblemBanner'
import { TextField } from '../components/TextField'
import { groupAccounts } from '../ledger/groupAccounts'
import styles from './AccountsPage.module.css'

// Balances, grouped by kind and totalled PER CURRENCY, never across (ADR-0002) — there is no
// single net figure on this page, and that absence is correct. Currency is shown on every
// account because it decides whether an entry becomes cross-currency, so it must be visible
// before a pairing is committed to. Plus an inline "Add account", since onboarding only seeds a
// minimum and more are needed over time.

const KINDS: { kind: AccountKind; label: string }[] = [
  { kind: 'ASSET', label: 'Asset' },
  { kind: 'LIABILITY', label: 'Liability' },
  { kind: 'INCOME', label: 'Income' },
  { kind: 'EXPENSE', label: 'Expense' },
  { kind: 'EQUITY', label: 'Equity' },
]

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR']

// Stable empty array, so `accounts` keeps one identity when unauthenticated and the memo below
// does not recompute every render.
const NO_ACCOUNTS: never[] = []

export function AccountsPage() {
  const { state, refreshAccounts } = useSession()
  const accounts = state.status === 'authenticated' ? state.accounts : NO_ACCOUNTS
  const groups = useMemo(() => groupAccounts(accounts), [accounts])

  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<AccountKind>('ASSET')
  const [currency, setCurrency] = useState('USD')
  const [submitting, setSubmitting] = useState(false)
  const [problem, setProblem] = useState<AppProblem | null>(null)

  async function submit() {
    if (submitting || name.trim() === '') return
    setSubmitting(true)
    setProblem(null)
    const { data, error, response } = await createAccount({ body: { name: name.trim(), kind, currency } })
    setSubmitting(false)
    if (data === undefined) {
      setProblem(toAppProblem(error, response))
      return
    }
    await refreshAccounts()
    setName('')
    setAdding(false)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Accounts</h1>
        {!adding && (
          <button type="button" className={styles.addButton} onClick={() => setAdding(true)}>
            Add account
          </button>
        )}
      </header>

      {adding && (
        <form
          className={styles.addForm}
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <ProblemBanner problem={problem} />
          <TextField
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
            required
          />
          <div className={styles.addRow}>
            <label className={styles.selectField}>
              <span className={styles.selectLabel}>Kind</span>
              <select value={kind} onChange={(event) => setKind(event.target.value as AccountKind)}>
                {KINDS.map((k) => (
                  <option key={k.kind} value={k.kind}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.selectField}>
              <span className={styles.selectLabel}>Currency</span>
              <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {/* A currency is fixed for the life of an account (every posting to it is in that
              currency), so this is a decision, not a preference — say so. */}
          <p className={styles.hint}>An account’s currency cannot be changed later.</p>
          <div className={styles.addActions}>
            <button type="submit" className={styles.save} aria-disabled={submitting}>
              {submitting ? 'Adding…' : 'Add account'}
            </button>
            <button type="button" className={styles.cancel} onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {groups.map((group) => (
        <section key={group.kind} className={styles.group}>
          <div className={styles.groupHead}>
            <h2 className={styles.groupTitle}>{group.label}</h2>
            <div className={styles.totals}>
              {group.totals.map((total) => (
                <MoneyText key={total.currency} money={total} className={styles.total} />
              ))}
            </div>
          </div>
          <ul className={styles.accounts}>
            {group.accounts.map((account) => (
              <li key={account.id} className={styles.account}>
                <span className={styles.accountName}>{account.name}</span>
                <MoneyText money={account.balance} showCurrency className={styles.accountBalance} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
