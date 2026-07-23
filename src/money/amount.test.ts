import { describe, expect, it } from 'vitest'
import { isCompleteAmount, isWireAmount, sanitizeAmountInput, toMoney } from './amount'

/**
 * Amounts chosen because a double mangles every one of them. If any of these comes back changed,
 * something in the path turned it into a number.
 */
const HOSTILE_AMOUNTS = [
  '1200.00', // the task's canonical case: trailing zeros are significant and a double drops them
  '0.1', // not representable in binary floating point
  '0.2',
  '0.3',
  '12.3456', // the spec's maximum of 4 fractional digits
  '0.0001', // smallest amount the spec allows
  '9007199254740993.99', // past Number.MAX_SAFE_INTEGER — integer digits are lost outright
  '-5.00', // a negative balance, which the spec permits
  '0.00',
]

describe('the money-string round trip', () => {
  it.each(HOSTILE_AMOUNTS)('carries %s to the wire unchanged', (amount) => {
    expect(toMoney(amount, 'USD').amount).toBe(amount)
  })

  it('proves these amounts are the ones a double would destroy', () => {
    // The only deliberate numeric conversions in the codebase, and they exist in order to fail.
    // If these assertions ever stop holding, the amounts above have stopped being hostile and
    // the round-trip test has quietly stopped proving anything.
    //
    // oxlint-disable-next-line no-restricted-globals
    const throughADouble = (value: string) => String(Number(value))

    // Trailing zeros do not survive, and in money the trailing zeros are the pennies. "1200.00"
    // and "1200" are the same quantity but not the same figure — one has been rounded to the
    // pound and the other has not, and a ledger that cannot tell them apart cannot show its
    // working.
    expect(throughADouble('1200.00')).toBe('1200')
    expect(throughADouble('0.00')).toBe('0')
    expect(throughADouble('-5.00')).toBe('-5')

    // Past Number.MAX_SAFE_INTEGER the integer part itself is rewritten — note the final digit.
    expect(throughADouble('9007199254740993.99')).toBe('9007199254740994')

    // "0.1" is different, and worth being precise about: it DOES survive String(Number(...)),
    // because JavaScript prints the shortest string that reads back as the same double. It is
    // in the list above anyway, because the double it became is not 0.1 and the damage appears
    // the moment anything is done with it.
    expect(throughADouble('0.1')).toBe('0.1')
    // oxlint-disable-next-line no-restricted-globals
    expect(Number('0.1') + Number('0.2')).not.toBe(0.3)
  })
})

describe('sanitizeAmountInput', () => {
  it.each([
    ['', ''],
    ['12', '12'],
    ['12.34', '12.34'],
    ['1200.00', '1200.00'],
  ])('leaves a well-formed amount alone: %s', (input, expected) => {
    expect(sanitizeAmountInput(input)).toBe(expected)
  })

  it.each([
    // Half-typed input has to survive, or the field fights the user mid-keystroke.
    ['12.', '12.'],
    ['0', '0'],
    // A leading dot is how ".50" gets typed on a keypad.
    ['.5', '0.5'],
    ['.', '0.'],
  ])('tolerates in-progress input: %s -> %s', (input, expected) => {
    expect(sanitizeAmountInput(input)).toBe(expected)
  })

  it.each([
    ['abc', ''],
    ['12abc34', '1234'],
    ['£12.34', '12.34'],
    ['12 34', '1234'],
    // A minus sign is dropped: postings are non-negative in the spec.
    ['-5.00', '5.00'],
    // Scientific notation is how a stringified double would try to get in.
    ['1e10', '110'],
    ['NaN', ''],
  ])('strips what is not part of a decimal: %s -> %s', (input, expected) => {
    expect(sanitizeAmountInput(input)).toBe(expected)
  })

  it.each([
    // The spec allows at most 4 fractional digits.
    ['12.345678', '12.3456'],
    ['0.00001', '0.0000'],
  ])('clamps to four fractional digits: %s -> %s', (input, expected) => {
    expect(sanitizeAmountInput(input)).toBe(expected)
  })

  it.each([
    // A second dot is a typo; keeping the digits is the reading that loses nothing.
    ['1.2.3', '1.23'],
    ['1..2', '1.2'],
  ])('keeps only the first decimal point: %s -> %s', (input, expected) => {
    expect(sanitizeAmountInput(input)).toBe(expected)
  })

  describe('the comma, which is a decimal point in half the world and a separator in the other', () => {
    it('reads a lone comma as a decimal point, because a phone keypad has no thousands key', () => {
      expect(sanitizeAmountInput('12,34')).toBe('12.34')
    })

    it('reads a comma as a thousands separator when a decimal point is also present', () => {
      expect(sanitizeAmountInput('1,200.00')).toBe('1200.00')
    })

    it('reads repeated commas as thousands separators', () => {
      expect(sanitizeAmountInput('1,200,000')).toBe('1200000')
    })

    it('resolves the genuinely ambiguous "1,200" as a decimal, and shows its working', () => {
      // Undecidable from the string alone: 1200 to a British reader, 1.2 to a German one. It is
      // read as a decimal because that is right for everything typed on a decimal keypad, and
      // the ambiguous form can only arrive by pasting. Documented here so that changing the
      // rule is a decision someone makes on purpose rather than a test they quietly update.
      expect(sanitizeAmountInput('1,200')).toBe('1.200')
    })
  })
})

describe('isCompleteAmount', () => {
  it.each(['0', '12', '12.3', '12.3456', '1200.00'])('accepts %s', (value) => {
    expect(isCompleteAmount(value)).toBe(true)
  })

  it.each([
    ['', 'empty'],
    ['12.', 'still being typed'],
    ['.', 'no digits at all'],
    ['12.34567', 'too many fractional digits'],
    ['-5.00', 'negative, and postings are not'],
  ])('rejects %s (%s)', (value) => {
    expect(isCompleteAmount(value)).toBe(false)
  })
})

describe('isWireAmount', () => {
  it('accepts a negative balance, which a posting amount may not be', () => {
    expect(isWireAmount('-5.00')).toBe(true)
    expect(isCompleteAmount('-5.00')).toBe(false)
  })

  it.each(['NaN', 'Infinity', '1e-7', '0.30000000000000004', '', '.5', '5.'])(
    'rejects %s — every one of these is what a double looks like on the way out',
    (value) => {
      expect(isWireAmount(value)).toBe(false)
    },
  )
})

describe('toMoney', () => {
  it('builds a Money from a valid pair', () => {
    expect(toMoney('12.34', 'USD')).toEqual({ amount: '12.34', currency: 'USD' })
  })

  it('refuses an amount that has been through a float', () => {
    expect(() => toMoney('0.30000000000000004', 'USD')).toThrow(/not a valid amount/i)
    expect(() => toMoney('1e-7', 'USD')).toThrow(/not a valid amount/i)
  })

  it('refuses something that is not an ISO 4217 code', () => {
    expect(() => toMoney('12.34', 'dollars')).toThrow(/iso 4217/i)
    expect(() => toMoney('12.34', 'usd')).toThrow(/iso 4217/i)
  })
})
