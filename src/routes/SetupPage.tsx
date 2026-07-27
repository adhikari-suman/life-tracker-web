import { useState } from 'react'
import { useNavigate } from 'react-router'
import type { Account } from '../api/generated/types.gen'
import { createAccount, listAccounts, listTransactions, recordTransaction } from '../api/generated/sdk.gen'
import { toAppProblem, type AppProblem } from '../api/problem'
import { useSession } from '../auth/useSession'
import { isCompleteAmount, toMoney } from '../money/amount'
import { AmountInput } from '../money/AmountInput'
import { ProblemBanner } from '../components/ProblemBanner'
import { TextField } from '../components/TextField'
import { SETUP_PLAN, findExisting } from '../ledger/setupPlan'
import { nowHHmm, todayISO } from '../ledger/clock'
import styles from './SetupPage.module.css'

// First run, on an empty Book. Fast entry is impossible without accounts, so this cannot be the
// entry screen and cannot be skipped. It creates a minimum viable set through N sequential
// createAccount calls — there is no bulk endpoint — and is RESUMABLE, not restartable: there is
// no rollback and no delete, so a partial failure leaves real accounts behind, and re-running
// the whole thing would duplicate them permanently. On retry it reads what already exists and
// makes only what is missing.

type StepStatus = 'idle' | 'creating' | 'done' | 'error'

// A small set of common currencies for the picker; the account's currency is fixed once created.
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR']

export function SetupPage() {
  const { refreshAccounts } = useSession()
  const navigate = useNavigate()

  const [currency, setCurrency] = useState('USD')
  const [names, setNames] = useState<Record<string, string>>(
    Object.fromEntries(SETUP_PLAN.map((p) => [p.key, p.defaultName])),
  )
  const [openingBalance, setOpeningBalance] = useState('')

  const [status, setStatus] = useState<Record<string, StepStatus>>(
    Object.fromEntries(SETUP_PLAN.map((p) => [p.key, 'idle'])),
  )
  const [running, setRunning] = useState(false)
  const [problem, setProblem] = useState<AppProblem | null>(null)

  function setStep(key: string, s: StepStatus) {
    setStatus((current) => ({ ...current, [key]: s }))
  }

  async function run() {
    if (running) return
    setRunning(true)
    setProblem(null)

    // Read the current server state first, so a resumed run sees what a previous, partly-failed
    // run already created and does not remake it.
    const existingResult = await listAccounts()
    let accounts: Account[] = existingResult.data ?? []
    const created: Record<string, Account> = {}

    for (const plan of SETUP_PLAN) {
      const name = names[plan.key].trim()
      const already = findExisting(plan, name, currency, accounts)
      if (already !== undefined) {
        created[plan.key] = already
        setStep(plan.key, 'done')
        continue
      }

      setStep(plan.key, 'creating')
      const { data, error, response } = await createAccount({ body: { name, kind: plan.kind, currency } })
      if (data === undefined) {
        setStep(plan.key, 'error')
        setProblem(toAppProblem(error, response))
        setRunning(false)
        return // Stop here; retry resumes from this step, skipping the ones already done.
      }
      created[plan.key] = data
      accounts = [...accounts, data]
      setStep(plan.key, 'done')
    }

    // Optional opening balance: a movement from the equity account into the asset (ADR-0004).
    // Guarded against duplication on a resumed run — if a transaction already touches both the
    // equity and asset accounts, one was recorded before and is not repeated.
    if (isCompleteAmount(openingBalance) && openingBalance !== '0' && openingBalance !== '0.00') {
      const equity = created.equity
      const asset = created.asset
      if (equity !== undefined && asset !== undefined) {
        const existingTxns = (await listTransactions({ query: { accountId: asset.id } })).data ?? []
        const alreadyOpened = existingTxns.some((t) =>
          t.postings.some((p) => p.accountId === equity.id),
        )
        if (!alreadyOpened) {
          const { error, response, data } = await recordTransaction({
            body: {
              date: todayISO(),
              // An opening balance occurs "the day it enters the ledger" (CONTEXT.md) — which is
              // now. The money never moved, so there is no earlier wall clock to be faithful to
              // and no reason to invent a sentinel: this reading is the true one.
              time: nowHHmm(),
              from: equity.id,
              to: asset.id,
              amount: toMoney(openingBalance, currency),
            },
          })
          if (data === undefined) {
            // The accounts exist and the Book is usable; the opening balance simply did not take.
            // Report it but do not block entry — it can be recorded later.
            setProblem(toAppProblem(error, response))
            setRunning(false)
            await refreshAccounts()
            return
          }
        }
      }
    }

    await refreshAccounts()
    void navigate('/', { replace: true })
  }

  return (
    <main className={styles.screen}>
      <div className={styles.panel}>
        <header className={styles.header}>
          <p className={styles.wordmark}>Life Tracker</p>
          <h1 className={styles.title}>Set up your accounts</h1>
          <p className={styles.lead}>
            Recording money needs at least one account to spend from and somewhere for it to go.
            These stay broad on purpose — a label says what each entry was for. You can add more
            any time.
          </p>
        </header>

        <div className={styles.currencyRow}>
          <label className={styles.currencyLabel} htmlFor="setup-currency">
            Main currency
          </label>
          <select
            id="setup-currency"
            className={styles.currencySelect}
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            disabled={running}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <ol className={styles.list}>
          {SETUP_PLAN.map((plan) => (
            <li key={plan.key} className={styles.item}>
              <div className={styles.itemHead}>
                <TextField
                  label={plan.kind.charAt(0) + plan.kind.slice(1).toLowerCase()}
                  value={names[plan.key]}
                  onChange={(event) => setNames((n) => ({ ...n, [plan.key]: event.target.value }))}
                  disabled={running}
                />
                <span className={`${styles.badge} ${styles[`badge_${status[plan.key]}`]}`} aria-live="polite">
                  {status[plan.key] === 'done'
                    ? 'Created'
                    : status[plan.key] === 'creating'
                      ? 'Creating…'
                      : status[plan.key] === 'error'
                        ? 'Failed'
                        : ''}
                </span>
              </div>
              <p className={styles.help}>{plan.help}</p>
            </li>
          ))}
        </ol>

        <div className={styles.opening}>
          <AmountInput
            label={`Opening balance for ${names.asset || 'your account'} — optional`}
            currency={currency}
            value={openingBalance}
            onValueChange={setOpeningBalance}
          />
          <p className={styles.help}>What is in that account today. Leave blank to start from zero.</p>
        </div>

        <ProblemBanner problem={problem} />

        <button type="button" className={styles.submit} onClick={() => void run()} aria-disabled={running}>
          {running ? 'Setting up…' : problem !== null ? 'Retry' : 'Create my accounts'}
        </button>
      </div>
    </main>
  )
}
