import type { Account, AccountKind } from '../api/generated/types.gen'

// The minimum set of accounts a Book needs before a transaction can balance. Accounts stay
// coarse on purpose — they exist to make transactions balance, not to categorize; that is
// labels' job (CONTEXT.md). One of each kind the four intents reach for, plus an equity account
// so opening balances have somewhere to come from.

export type PlannedAccount = {
  key: string
  kind: AccountKind
  defaultName: string
  help: string
}

export const SETUP_PLAN: readonly PlannedAccount[] = [
  { key: 'asset', kind: 'ASSET', defaultName: 'Current account', help: 'The account you spend from — a bank account or cash.' },
  { key: 'expense', kind: 'EXPENSE', defaultName: 'Everyday spending', help: 'Where money goes. Kept broad — a label says what each purchase was for.' },
  { key: 'income', kind: 'INCOME', defaultName: 'Income', help: 'Where money comes from — pay, and anything else you receive.' },
  { key: 'equity', kind: 'EQUITY', defaultName: 'Opening balances', help: 'The starting balance of your accounts, before you began tracking.' },
]

/**
 * Find an already-created account matching a planned one, so a resumed setup skips it rather than
 * making a duplicate. There is no delete endpoint, so a duplicate is permanent — this match is
 * the whole reason the flow is resumable rather than restartable. Compared on kind, currency, and
 * name (case-insensitively, as the backend compares names).
 */
export function findExisting(
  plan: PlannedAccount,
  name: string,
  currency: string,
  accounts: readonly Account[],
): Account | undefined {
  return accounts.find(
    (a) => a.kind === plan.kind && a.currency === currency && a.name.trim().toLowerCase() === name.trim().toLowerCase(),
  )
}
