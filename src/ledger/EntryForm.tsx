import { useEffect, useMemo, useRef, useState } from 'react'
import type { Account, Label, RecordTransactionRequest } from '../api/generated/types.gen'
import { AmountInput } from '../money/AmountInput'
import { isCompleteAmount, toMoney } from '../money/amount'
import { intentSpec, type Intent } from './intents'
import { IntentSelector } from './IntentSelector'
import { AccountPicker } from './AccountPicker'
import { LabelPicker } from './LabelPicker'
import { DateField } from './DateField'
import { emptyDraft, type EntryDraft } from './entryDraft'
import styles from './EntryForm.module.css'

// The entry itself. Intent first, then amount, then the two accounts, then optionally a label —
// the order the IA fixes. Choosing the intent pre-filters both pickers by kind, which is what
// removes the double-entry thinking. The whole form is completable from the keyboard.
//
// Everything monetary is a string end to end; toMoney is the only place a Money is built, and it
// validates, so a malformed figure never reaches the queue.
//
// EntryDraft and its builders live in ./entryDraft so this file exports only a component.

type EntryFormProps = {
  accounts: readonly Account[]
  labels: readonly Label[]
  onCreateLabel: (name: string) => Promise<Label | null>
  /** Hand a validated request to the commit queue. */
  onSubmit: (request: RecordTransactionRequest) => void
  /** Pre-fill, e.g. when reversing a transaction. Changing it re-seeds the form. */
  initialDraft?: EntryDraft
}

export function EntryForm({ accounts, labels, onCreateLabel, onSubmit, initialDraft }: EntryFormProps) {
  const [draft, setDraft] = useState<EntryDraft>(initialDraft ?? emptyDraft)
  const [error, setError] = useState<string | null>(null)
  const amountRef = useRef<HTMLInputElement>(null)

  // Re-seed when a new pre-filled draft arrives (reversal lands one). Keyed on identity so a
  // fresh object replaces the form; the empty default never triggers this.
  useEffect(() => {
    if (initialDraft !== undefined) {
      setDraft(initialDraft)
      amountRef.current?.focus()
    }
  }, [initialDraft])

  const spec = intentSpec(draft.intent)
  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const fromAccount = accountsById.get(draft.fromId)
  const toAccount = accountsById.get(draft.toId)

  // Cross-currency exactly when both accounts are chosen and their currencies differ. The second
  // amount field is the real figure that arrived, in the destination's currency — never a rate
  // multiplied out (ADR-0002).
  const crossCurrency = fromAccount !== undefined && toAccount !== undefined && fromAccount.currency !== toAccount.currency

  // The amount field's currency follows the source account once chosen; before that it is blank
  // rather than a guess, so the adornment never claims a currency the entry is not in.
  const amountCurrency = fromAccount?.currency ?? ''

  function changeIntent(intent: Intent) {
    // The pickers are filtered by the new intent's kinds, so the previously chosen accounts may
    // no longer be valid. Clear both, the second amount, and the label if the new intent has no
    // leg for one. Keep the amount — the figure did not change, only what it is between.
    setDraft((d) => ({
      ...d,
      intent,
      fromId: '',
      toId: '',
      toAmount: '',
      labelId: intentSpec(intent).canLabel ? d.labelId : null,
    }))
    setError(null)
  }

  function handleSubmit() {
    // Client-side validation is presence and shape only; the server owns the domain rules and
    // answers with a Problem the queue surfaces. This just avoids queuing an entry that cannot
    // possibly succeed.
    if (!isCompleteAmount(draft.amount)) {
      setError('Enter an amount.')
      amountRef.current?.focus()
      return
    }
    if (draft.fromId === '' || draft.toId === '') {
      setError('Choose both accounts.')
      return
    }
    if (draft.fromId === draft.toId) {
      setError('The two accounts must be different.')
      return
    }
    if (crossCurrency && !isCompleteAmount(draft.toAmount)) {
      setError(`Enter the amount that arrived, in ${toAccount?.currency}.`)
      return
    }

    // toMoney validates against the wire grammar and throws on anything malformed — which cannot
    // happen here because isCompleteAmount already passed, but it is the single gate that builds
    // a Money, so it stays the gate.
    const request: RecordTransactionRequest = {
      date: draft.date,
      from: draft.fromId,
      to: draft.toId,
      amount: toMoney(draft.amount, fromAccount!.currency),
      ...(crossCurrency ? { toAmount: toMoney(draft.toAmount, toAccount!.currency) } : {}),
      ...(spec.canLabel && draft.labelId !== null ? { labelId: draft.labelId } : {}),
    }

    onSubmit(request)

    // Reset for the next entry, keeping the intent — a catch-up session is usually many of the
    // same kind. Focus returns to the amount so the next one begins with typing.
    setDraft((d) => ({ ...emptyDraft(), intent: d.intent }))
    setError(null)
    amountRef.current?.focus()
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault()
        handleSubmit()
      }}
      noValidate
    >
      <IntentSelector value={draft.intent} onChange={changeIntent} />

      <AmountInput
        ref={amountRef}
        variant="hero"
        label="Amount"
        currency={amountCurrency || '—'}
        value={draft.amount}
        onValueChange={(amount) => setDraft((d) => ({ ...d, amount }))}
        autoFocus
      />

      <div className={styles.accounts}>
        <AccountPicker
          label={spec.fromLabel}
          kinds={spec.fromKinds}
          accounts={accounts}
          value={draft.fromId}
          onChange={(fromId) => setDraft((d) => ({ ...d, fromId, toAmount: '' }))}
          excludeId={draft.toId || undefined}
        />
        <AccountPicker
          label={spec.toLabel}
          kinds={spec.toKinds}
          accounts={accounts}
          value={draft.toId}
          onChange={(toId) => setDraft((d) => ({ ...d, toId, toAmount: '' }))}
          excludeId={draft.fromId || undefined}
        />
      </div>

      {crossCurrency && (
        <AmountInput
          label={`Amount that arrived`}
          currency={toAccount!.currency}
          value={draft.toAmount}
          onValueChange={(toAmount) => setDraft((d) => ({ ...d, toAmount }))}
        />
      )}

      {/* Rendered only when the intent has a single Income/Expense leg. Not disabled — absent, so
          Moved and Paid off never present a field that would be refused (LABEL_NOT_APPLICABLE). */}
      {spec.canLabel && (
        <LabelPicker
          labels={labels}
          value={draft.labelId}
          onChange={(labelId) => setDraft((d) => ({ ...d, labelId }))}
          onCreate={onCreateLabel}
        />
      )}

      <DateField value={draft.date} onChange={(date) => setDraft((d) => ({ ...d, date }))} />

      {error !== null && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <button type="submit" className={styles.submit}>
        Record {spec.label.toLowerCase()}
      </button>
    </form>
  )
}
