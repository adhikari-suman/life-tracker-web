import type { Account, AccountKind, Money } from '../api/generated/types.gen'
import { addAmounts } from '../money/amount'

// Grouping for the Accounts page: by kind, and within a kind a total PER CURRENCY, never across
// currencies (ADR-0002). There is deliberately no single net figure — adding dollars to euros
// produces a number that means nothing, and the absence of it here is correct, not an omission.

const KIND_ORDER: readonly AccountKind[] = ['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY']

const KIND_LABEL: Record<AccountKind, string> = {
  ASSET: 'Assets',
  LIABILITY: 'Liabilities',
  INCOME: 'Income',
  EXPENSE: 'Expenses',
  EQUITY: 'Equity',
}

export type AccountGroup = {
  kind: AccountKind
  label: string
  accounts: Account[]
  /** One total per currency present in the group. A group spanning USD and EUR has two. */
  totals: Money[]
}

export function groupAccounts(accounts: readonly Account[]): AccountGroup[] {
  const groups: AccountGroup[] = []

  for (const kind of KIND_ORDER) {
    const inKind = accounts.filter((a) => a.kind === kind)
    if (inKind.length === 0) continue

    // Sum balances per currency by adding the decimal STRINGS — never by converting to numbers.
    // Even a single account is run through addAmounts, so every total shares the same
    // four-decimal shape rather than echoing whatever precision each balance happened to have.
    const byCurrency = new Map<string, string>()
    for (const account of inKind) {
      const running = byCurrency.get(account.balance.currency) ?? '0'
      byCurrency.set(account.balance.currency, addAmounts(running, account.balance.amount))
    }

    groups.push({
      kind,
      label: KIND_LABEL[kind],
      accounts: inKind,
      totals: [...byCurrency].map(([currency, amount]) => ({ amount, currency })),
    })
  }

  return groups
}
