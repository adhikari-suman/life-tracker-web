import type { Money } from '../api/generated/types.gen'

// Every amount in this app is a decimal STRING, from the keystroke that produced it to the JSON
// body that carries it away, and back. It is never parsed into a JavaScript number on the way.
//
// The reason is not fussiness. A JSON number is an IEEE 754 double, and a double cannot hold
// most decimal fractions: 0.1 + 0.2 is 0.30000000000000004, and 9007199254740993.99 does not
// survive the round trip at all. An amount that passes through a double is already wrong before
// anything is done with it, and it is wrong quietly — the corruption shows up as a penny that
// does not balance, months later, with nothing to point at.
//
// This module is the only place amount strings are inspected or built. Everything else passes
// them through untouched.

/** `Money.amount` in the spec: "Decimal, up to 4 fractional digits". */
const MAX_FRACTION_DIGITS = 4

/**
 * What the wire permits. Balances may be negative ("-5.00"), which is why the sign is optional
 * here — and deliberately NOT permitted by the input sanitizer below, since posting amounts are
 * non-negative.
 *
 * Note what this rejects that a stringified double produces: "1e-7", "NaN", "Infinity",
 * "0.30000000000000004". If a float ever leaks into an amount, this is the tripwire.
 */
const WIRE_AMOUNT = /^-?\d+(\.\d{1,4})?$/

/** ISO 4217, as the spec constrains `Money.currency`. */
const CURRENCY_CODE = /^[A-Z]{3}$/

/** A complete, submittable amount typed by a user. Non-negative — postings always are. */
const COMPLETE_INPUT_AMOUNT = /^\d+(\.\d{1,4})?$/

/**
 * Decide what a comma means before anything else touches the string.
 *
 * A comma is a decimal separator in most of Europe and a thousands separator in most of the
 * English-speaking world, and getting it backwards is a factor-of-100 error — the single worst
 * thing this file could do. The rules below resolve every case that is actually decidable:
 *
 *   "1,200.00"   dot present, so the comma groups thousands   -> "1200.00"
 *   "1,200,000"  several commas, so they group thousands      -> "1200000"
 *   "12,34"      one comma, no dot: a decimal comma keypad    -> "12.34"
 *
 * The remaining case, "1,200" with a single comma and no dot, is genuinely ambiguous — it is
 * 1200 to a British reader and 1.2 to a German one, and nothing in the string says which. It is
 * read as a decimal separator, because that is the rule that is right for the dominant input
 * path: a phone keypad under `inputMode="decimal"` offers one separator key and no thousands
 * key, so a comma that arrives by typing is always a decimal point. The ambiguous form can only
 * arrive by pasting. When it does, the sanitized result is shown back in a large mono face —
 * which is exactly the misplaced decimal the typography was chosen to make visible.
 */
function normalizeSeparators(raw: string): string {
  const commas = raw.match(/,/g)?.length ?? 0
  if (commas === 0) return raw
  if (raw.includes('.') || commas > 1) return raw.replace(/,/g, '')
  return raw.replace(',', '.')
}

/**
 * Clean a keystroke's worth of input while keeping it a string.
 *
 * Runs on every change, so it must tolerate half-finished input: "12." is what "12.5" looks
 * like one keystroke earlier and must survive. Completeness is `isCompleteAmount`'s job, at
 * submit time, not this function's.
 */
export function sanitizeAmountInput(raw: string): string {
  // Anything that is not a digit or a dot is dropped. That covers a pasted currency symbol, the
  // spaces in "1 200,00", a minus sign (postings are never negative), and the "e" of scientific
  // notation — which is how a stringified double would try to get in.
  const kept = normalizeSeparators(raw).replace(/[^\d.]/g, '')

  const firstDot = kept.indexOf('.')
  if (firstDot === -1) return kept

  const whole = kept.slice(0, firstDot)
  const fraction = kept
    .slice(firstDot + 1)
    // Later dots are dropped rather than treated as separators: "1.2.3" is a typo, and "1.23"
    // is the reading that keeps every digit the user actually typed.
    .replace(/\./g, '')
    .slice(0, MAX_FRACTION_DIGITS)

  // A leading dot is how ".50" gets typed. Filling in the zero makes it a valid amount instead
  // of one the submit button would silently refuse.
  return `${whole === '' ? '0' : whole}.${fraction}`
}

/** Whether a sanitized input value is a complete amount and may be submitted. */
export function isCompleteAmount(value: string): boolean {
  return COMPLETE_INPUT_AMOUNT.test(value)
}

/** Whether a string conforms to `Money.amount` as the spec defines it. Signs allowed. */
export function isWireAmount(value: string): boolean {
  return WIRE_AMOUNT.test(value)
}

/** A negative amount, determined from the string. No conversion, and no comparison to zero. */
export function isNegativeAmount(value: string): boolean {
  return value.startsWith('-')
}

/**
 * The only way this app builds a `Money`. Validates rather than trusts, and throws rather than
 * returning something malformed, because every caller is handing this to the wire: a bad amount
 * that gets through here is a bad amount in the ledger, and the ledger is append-only.
 *
 * The validation is what catches a float that got in by some route this module cannot see —
 * a stringified double fails `WIRE_AMOUNT` on its extra digits or its exponent.
 */
export function toMoney(amount: string, currency: string): Money {
  if (!isWireAmount(amount)) {
    throw new Error(
      `Not a valid amount: ${JSON.stringify(amount)}. Amounts are decimal strings with up to ` +
        `${MAX_FRACTION_DIGITS} fractional digits and are never derived from a number.`,
    )
  }
  if (!CURRENCY_CODE.test(currency)) {
    throw new Error(`Not an ISO 4217 currency code: ${JSON.stringify(currency)}.`)
  }
  return { amount, currency }
}
