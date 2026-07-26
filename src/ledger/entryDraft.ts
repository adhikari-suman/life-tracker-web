import type { Account, RecordTransactionRequest } from '../api/generated/types.gen'
import type { Intent } from './intents'
import { nowHHmm, todayISO } from './clock'

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
  /**
   * Wall-clock time, HH:mm (ADR-0018). Always present because the wire requires it, but only
   * SHOWN once the date is moved off today — while you are recording as it happens the device
   * clock is a good answer and asking would be friction; the moment you backdate it stops being
   * one, and that is exactly when the field appears.
   */
  time: string
  /**
   * Whether the time came from the user rather than the clock. The time you typed sticks; the
   * time we guessed refreshes — see `requestTime`. Without this a form left open at 09:00 would
   * stamp 09:00 on an entry made at 14:00, and since ordering is `date desc, time desc` that
   * sorts it to the head of a day it did not belong at the head of.
   */
  timeTouched: boolean
}

export function emptyDraft(): EntryDraft {
  return {
    intent: 'SPENT',
    amount: '',
    fromId: '',
    toId: '',
    toAmount: '',
    labelId: null,
    date: todayISO(),
    time: nowHHmm(),
    timeTouched: false,
  }
}

/**
 * The time to send. A typed time is sent as typed; a guessed one is re-read at submit so it is
 * the clock reading of when the entry was actually made, not of when the form happened to open.
 */
export function requestTime(draft: EntryDraft): string {
  return draft.timeTouched ? draft.time : nowHHmm()
}

/**
 * Rebuild a draft from a request whose commit failed, so the entered values are restored to the
 * form rather than lost. The intent is inferred from the two accounts' kinds — the same
 * classification the recording table encodes, run backwards.
 *
 * The time comes back marked as touched: it was already resolved when the request was built, and
 * a resubmit should send what failed rather than silently re-reading the clock. The commit failing
 * is the system's problem, not a second act of recording.
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
    time: request.time,
    timeTouched: true,
  }
}
