import type { Account, Money, Posting, RecordTransactionRequest, Transaction } from '../api/generated/types.gen'
import type { Intent } from './intents'

// The inverse of the intent model: given a recorded transaction — which the wire hands back as
// balanced postings, the ledger truth — reconstruct what a person would say happened. The list
// and the detail view both read money back in the intent's language, never as debits and credits.
//
// A transaction in this build has exactly two postings (splits are out of scope). The CREDIT
// posting is the `from` account money left; the DEBIT posting is the `to` account it arrived in.
// The pair of account KINDS is what identifies the intent — the same table that drove recording,
// run backwards.

/** What a row or detail view needs, all in human terms. */
export type TransactionDescription = {
  /**
   * The recording intents, plus OPENING (Equity→Asset from onboarding), REFUND (money coming
   * back from an expense — the shape a reversed Spent takes, CONTEXT.md), and OTHER (anything the
   * table does not otherwise cover, such as a reversed Earned or transfer).
   */
  kind: Intent | 'OPENING' | 'REFUND' | 'OTHER'
  /** The word shown to the user: "Spent", "Earned", "Moved", "Paid off", "Opening balance". */
  verb: string
  fromAccount: Account | undefined
  toAccount: Account | undefined
  fromPosting: Posting
  toPosting: Posting
  /** The figure a person thinks of as "the amount", picked from the leg that carries the meaning. */
  headlineAmount: Money
  /** The posting that can hold a label — the single Income or Expense leg, or undefined if none. */
  labelPosting: Posting | undefined
  /** True when the two accounts differ in currency, so both figures are real and distinct. */
  crossCurrency: boolean
  exchangeRate: string | null
}

const VERB: Record<TransactionDescription['kind'], string> = {
  SPENT: 'Spent',
  EARNED: 'Earned',
  MOVED: 'Moved',
  PAID_OFF: 'Paid off',
  OPENING: 'Opening balance',
  REFUND: 'Refund',
  OTHER: 'Transaction',
}

function classify(
  fromKind: Account['kind'] | undefined,
  toKind: Account['kind'] | undefined,
): TransactionDescription['kind'] {
  if (toKind === 'EXPENSE') return 'SPENT'
  if (fromKind === 'INCOME') return 'EARNED'
  if (fromKind === 'EQUITY') return 'OPENING'
  // Money coming back OUT of an expense — a refund, and the shape a reversed Spent takes.
  if (fromKind === 'EXPENSE') return 'REFUND'
  if (fromKind === 'ASSET' && toKind === 'ASSET') return 'MOVED'
  if (fromKind === 'ASSET' && toKind === 'LIABILITY') return 'PAID_OFF'
  return 'OTHER'
}

export function describeTransaction(
  transaction: Transaction,
  accountsById: ReadonlyMap<string, Account>,
): TransactionDescription {
  // Find the two legs by direction. A well-formed two-posting transaction has exactly one of
  // each; if the shape is ever unexpected, fall back to postings[0]/[1] rather than throwing,
  // because a row that renders oddly beats a list that will not render at all.
  const credit = transaction.postings.find((p) => p.direction === 'CREDIT') ?? transaction.postings[0]
  const debit = transaction.postings.find((p) => p.direction === 'DEBIT') ?? transaction.postings[1]

  const fromAccount = accountsById.get(credit.accountId)
  const toAccount = accountsById.get(debit.accountId)
  const kind = classify(fromAccount?.kind, toAccount?.kind)

  // The headline is the leg that carries the meaning. For SPENT it is the expense (the debited
  // `to`); for an OPENING balance it is the amount that landed in the new account (also the
  // debited `to`). For everything else — the income you received, the sum you moved or paid —
  // it is the amount that left the source (the credited `from`).
  const headlineAmount = kind === 'SPENT' || kind === 'OPENING' ? debit.amount : credit.amount

  // The one leg that may hold a label is the Income or Expense account, whichever side it is on.
  // Read it off the account kind rather than off labelId, so an uncategorized expense (labelId
  // null) still reports the right posting as the one a label WOULD attach to.
  const labelPosting =
    toAccount?.kind === 'EXPENSE' || toAccount?.kind === 'INCOME'
      ? debit
      : fromAccount?.kind === 'EXPENSE' || fromAccount?.kind === 'INCOME'
        ? credit
        : undefined

  return {
    kind,
    verb: VERB[kind],
    fromAccount,
    toAccount,
    fromPosting: credit,
    toPosting: debit,
    headlineAmount,
    labelPosting,
    crossCurrency: credit.amount.currency !== debit.amount.currency,
    exchangeRate: transaction.exchangeRate ?? null,
  }
}

/** Convenience for building the lookup the function needs. */
export function accountsById(accounts: readonly Account[]): Map<string, Account> {
  return new Map(accounts.map((a) => [a.id, a]))
}

/**
 * Compose the mirror of a transaction: money flows the other way. `from` and `to` swap, each
 * posting's real amount is carried in its own currency (so a cross-currency reversal never
 * multiplies by a rate), and the date and time are NOW — the reversal is a new event in an
 * append-only ledger, not a rewrite of the original, which stays in history. Carrying the
 * original's clock reading would date a Friday reversal with Tuesday's time. The result is a
 * request for the caller to stage for review, never to post silently.
 */
export function reverseRequest(
  transaction: Transaction,
  date: string,
  time: string,
): RecordTransactionRequest {
  const credit = transaction.postings.find((p) => p.direction === 'CREDIT') ?? transaction.postings[0]
  const debit = transaction.postings.find((p) => p.direction === 'DEBIT') ?? transaction.postings[1]

  // Reverse: money now leaves what was the destination and arrives in what was the source.
  const crossCurrency = credit.amount.currency !== debit.amount.currency
  return {
    date,
    time,
    from: debit.accountId,
    to: credit.accountId,
    amount: debit.amount,
    ...(crossCurrency ? { toAmount: credit.amount } : {}),
  }
}
