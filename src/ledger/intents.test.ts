import { describe, expect, it } from 'vitest'
import type { Account, Transaction } from '../api/generated/types.gen'
import { INTENTS, intentSpec } from './intents'
import { accountsById, describeTransaction } from './describeTransaction'

// A minimal account of each kind, enough to classify a transaction by its legs.
const ACC: Record<string, Account> = {
  bank: { id: 'bank', name: 'Current account', kind: 'ASSET', currency: 'USD', balance: { amount: '0.00', currency: 'USD' } },
  savings: { id: 'savings', name: 'Savings', kind: 'ASSET', currency: 'USD', balance: { amount: '0.00', currency: 'USD' } },
  card: { id: 'card', name: 'Credit card', kind: 'LIABILITY', currency: 'USD', balance: { amount: '0.00', currency: 'USD' } },
  groceries: { id: 'groceries', name: 'Groceries', kind: 'EXPENSE', currency: 'USD', balance: { amount: '0.00', currency: 'USD' } },
  salary: { id: 'salary', name: 'Salary', kind: 'INCOME', currency: 'USD', balance: { amount: '0.00', currency: 'USD' } },
  opening: { id: 'opening', name: 'Opening balances', kind: 'EQUITY', currency: 'USD', balance: { amount: '0.00', currency: 'USD' } },
  eur: { id: 'eur', name: 'Euro account', kind: 'ASSET', currency: 'EUR', balance: { amount: '0.00', currency: 'EUR' } },
}

const byId = accountsById(Object.values(ACC))

/** Build a two-posting transaction: money leaves `from` (CREDIT), arrives in `to` (DEBIT). */
function txn(fromId: string, toId: string, amount: string, toAmount?: string): Transaction {
  const fromCur = ACC[fromId].currency
  const toCur = ACC[toId].currency
  return {
    id: 't1',
    date: '2026-07-24',
    exchangeRate: toAmount ? '0.9' : null,
    postings: [
      { id: 'p-from', accountId: fromId, direction: 'CREDIT', amount: { amount, currency: fromCur } },
      { id: 'p-to', accountId: toId, direction: 'DEBIT', amount: { amount: toAmount ?? amount, currency: toCur } },
    ],
  }
}

describe('the intent table maps cleanly to the double-entry model', () => {
  it('offers exactly the four everyday intents', () => {
    expect(INTENTS.map((i) => i.intent)).toEqual(['SPENT', 'EARNED', 'MOVED', 'PAID_OFF'])
  })

  it('only Spent and Earned can carry a label — the two with a single Income/Expense leg', () => {
    expect(intentSpec('SPENT').canLabel).toBe(true)
    expect(intentSpec('EARNED').canLabel).toBe(true)
    expect(intentSpec('MOVED').canLabel).toBe(false)
    expect(intentSpec('PAID_OFF').canLabel).toBe(false)
  })

  it('never offers an asset on the destination of Spent, so a transfer cannot be booked as spending', () => {
    // The core thing the ledger exists to get right (CONTEXT.md): a moved £200 is not spending.
    expect(intentSpec('SPENT').toKinds).toEqual(['EXPENSE'])
    expect(intentSpec('SPENT').toKinds).not.toContain('ASSET')
  })

  it('Moved is Asset to Asset and Paid off is Asset to Liability', () => {
    expect(intentSpec('MOVED').fromKinds).toEqual(['ASSET'])
    expect(intentSpec('MOVED').toKinds).toEqual(['ASSET'])
    expect(intentSpec('PAID_OFF').fromKinds).toEqual(['ASSET'])
    expect(intentSpec('PAID_OFF').toKinds).toEqual(['LIABILITY'])
  })
})

describe('describeTransaction reads postings back in the intent language', () => {
  it('Spent: an Asset→Expense movement, headline is the expense', () => {
    const d = describeTransaction(txn('bank', 'groceries', '12.00'), byId)
    expect(d.kind).toBe('SPENT')
    expect(d.verb).toBe('Spent')
    expect(d.headlineAmount.amount).toBe('12.00')
    expect(d.labelPosting?.accountId).toBe('groceries')
  })

  it('Spent on a card: Liability→Expense is still Spent', () => {
    expect(describeTransaction(txn('card', 'groceries', '12.00'), byId).kind).toBe('SPENT')
  })

  it('Earned: Income→Asset, headline is the income, label is the income leg', () => {
    const d = describeTransaction(txn('salary', 'bank', '2000.00'), byId)
    expect(d.kind).toBe('EARNED')
    expect(d.headlineAmount.amount).toBe('2000.00')
    expect(d.labelPosting?.accountId).toBe('salary')
  })

  it('Moved: Asset→Asset, no labelable leg', () => {
    const d = describeTransaction(txn('bank', 'savings', '200.00'), byId)
    expect(d.kind).toBe('MOVED')
    expect(d.labelPosting).toBeUndefined()
  })

  it('Paid off: Asset→Liability, no labelable leg', () => {
    const d = describeTransaction(txn('bank', 'card', '150.00'), byId)
    expect(d.kind).toBe('PAID_OFF')
    expect(d.labelPosting).toBeUndefined()
  })

  it('Opening balance: Equity→Asset reads as its own thing, headline is the amount that landed', () => {
    const d = describeTransaction(txn('opening', 'bank', '500.00'), byId)
    expect(d.kind).toBe('OPENING')
    expect(d.verb).toBe('Opening balance')
    expect(d.headlineAmount.amount).toBe('500.00')
  })

  it('flags a cross-currency movement and keeps each figure in its own currency', () => {
    // Moved USD 100 that arrived as EUR 90.
    const d = describeTransaction(txn('bank', 'eur', '100.00', '90.00'), byId)
    expect(d.crossCurrency).toBe(true)
    expect(d.fromPosting.amount).toEqual({ amount: '100.00', currency: 'USD' })
    expect(d.toPosting.amount).toEqual({ amount: '90.00', currency: 'EUR' })
    expect(d.exchangeRate).toBe('0.9')
  })

  it('does not crash on an account it cannot resolve', () => {
    const d = describeTransaction(txn('bank', 'groceries', '12.00'), new Map())
    expect(d.kind).toBe('OTHER')
    expect(d.fromAccount).toBeUndefined()
  })
})
