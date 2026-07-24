import type { Account, RecordTransactionRequest } from '../api/generated/types.gen'
import type { Intent } from './intents'
import { todayISO } from './todayISO'

// The entry form's state, and the pure helpers that build it. Kept apart from EntryForm so that
// file exports only a component (a React Fast Refresh requirement) — and because these two
// functions are worth testing on their own.

export type EntryDraft = {
  intent: Intent
  amount: string
  fromId: string
  toId: string
  toAmount: string
  labelId: string | null
  /** Calendar date, YYYY-MM-DD. Defaults to today; correct almost always, so kept quiet. */
  date: string
}

export function emptyDraft(): EntryDraft {
  return { intent: 'SPENT', amount: '', fromId: '', toId: '', toAmount: '', labelId: null, date: todayISO() }
}

/**
 * Rebuild a draft from a request whose commit failed, so the entered values are restored to the
 * form rather than lost. The intent is inferred from the two accounts' kinds — the same
 * classification the recording table encodes, run backwards.
 */
export function draftFromRequest(
  request: RecordTransactionRequest,
  accountsById: ReadonlyMap<string, Account>,
): EntryDraft {
  const fromKind = accountsById.get(request.from)?.kind
  const toKind = accountsById.get(request.to)?.kind
  const intent: Intent =
    toKind === 'EXPENSE'
      ? 'SPENT'
      : fromKind === 'INCOME'
        ? 'EARNED'
        : toKind === 'LIABILITY'
          ? 'PAID_OFF'
          : 'MOVED'
  return {
    intent,
    amount: request.amount.amount,
    fromId: request.from,
    toId: request.to,
    toAmount: request.toAmount?.amount ?? '',
    labelId: request.labelId ?? null,
    date: request.date,
  }
}
