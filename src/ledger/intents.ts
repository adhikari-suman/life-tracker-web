import type { AccountKind } from '../api/generated/types.gen'

// The four everyday things a person does with money, and the double-entry each one is. This is
// ADR-0012 expressed as data: the user picks an intent, and this table decides which account
// kinds each side offers, which way the money moves, and whether there is a category to attach.
// The words "debit" and "credit" appear in these comments and NOWHERE a user can see them.
//
// The wire model (RecordTransactionRequest) is: money leaves `from` (which is credited) and
// arrives in `to` (which is debited). Account kinds fix the normal side — ASSET and EXPENSE grow
// on debit; LIABILITY, INCOME and EQUITY grow on credit (CONTEXT.md) — so choosing the right two
// kinds per intent is the whole of what makes "Spent £12 on coffee" post correctly without the
// user ever meeting a debit.

export type Intent = 'SPENT' | 'EARNED' | 'MOVED' | 'PAID_OFF'

export type IntentSpec = {
  intent: Intent
  /** The segmented-control label. A design choice, not a domain term — flagged for user testing. */
  label: string
  /** Kinds offered for the `from` (credited) account. */
  fromKinds: readonly AccountKind[]
  /** Kinds offered for the `to` (debited) account. */
  toKinds: readonly AccountKind[]
  /** The `from` picker's user-facing label, in intent language. */
  fromLabel: string
  /** The `to` picker's user-facing label. */
  toLabel: string
  /**
   * Whether this movement has exactly one Income or Expense leg, and so can carry a label. Moved
   * (Asset→Asset) and Paid off (Asset→Liability) have none — the label field is not rendered for
   * them at all, mirroring LABEL_NOT_APPLICABLE. The server attaches the label to the I/E leg
   * itself; the client never says which posting (ADR-0014).
   */
  canLabel: boolean
}

// Kept deliberately narrow. Each intent offers only the kinds that keep the double-entry correct,
// which is what makes an internal transfer impossible to book as spending: "Spent" simply does
// not offer an asset on the destination side, so the mistake cannot be expressed.
//
//   SPENT     from an Asset or Liability (bank, or on a card)  ->  an Expense.   Label = the expense.
//   EARNED    from an Income source                            ->  an Asset.     Label = the income.
//   MOVED     from an Asset                                    ->  an Asset.     Internal transfer.
//   PAID_OFF  from an Asset                                    ->  a Liability.  Paying down a debt.
//
// EARNED's destination is Asset only, and PAID_OFF's source is Asset only, on purpose: income that
// lands straight on a credit card, or a card paid from another card, are real but rare, and the
// honest way to record them is two steps (earn into the bank, then pay the card) — which is also
// the correct mental model. Narrower pickers here mean fewer wrong pairings a user can reach.
export const INTENTS: readonly IntentSpec[] = [
  {
    intent: 'SPENT',
    label: 'Spent',
    fromKinds: ['ASSET', 'LIABILITY'],
    toKinds: ['EXPENSE'],
    fromLabel: 'Paid from',
    toLabel: 'Spent on',
    canLabel: true,
  },
  {
    intent: 'EARNED',
    label: 'Earned',
    fromKinds: ['INCOME'],
    toKinds: ['ASSET'],
    fromLabel: 'Received from',
    toLabel: 'Into',
    canLabel: true,
  },
  {
    intent: 'MOVED',
    label: 'Moved',
    fromKinds: ['ASSET'],
    toKinds: ['ASSET'],
    fromLabel: 'From',
    toLabel: 'To',
    canLabel: false,
  },
  {
    intent: 'PAID_OFF',
    label: 'Paid off',
    fromKinds: ['ASSET'],
    toKinds: ['LIABILITY'],
    fromLabel: 'Paid from',
    toLabel: 'Toward',
    canLabel: false,
  },
]

const BY_INTENT: Record<Intent, IntentSpec> = Object.fromEntries(
  INTENTS.map((spec) => [spec.intent, spec]),
) as Record<Intent, IntentSpec>

export function intentSpec(intent: Intent): IntentSpec {
  return BY_INTENT[intent]
}
