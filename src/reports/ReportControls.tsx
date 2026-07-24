import { PRESETS, type DateRange, type RangeId } from './dateRange'
import styles from './ReportControls.module.css'

// The boundary line of the page. Everything above it is "now"; everything below is "in this
// range". Its position IS the explanation of what it governs, which is why it is not in the page
// header — a control in a header reads as governing the page, and this one does not govern the
// net worth figure above it.

type ReportControlsProps = {
  range: DateRange
  onRangeChange: (id: RangeId) => void
  /** Every currency present in the Book's reports. */
  currencies: string[]
  currency: string
  onCurrencyChange: (currency: string) => void
}

export function ReportControls({
  range,
  onRangeChange,
  currencies,
  currency,
  onCurrencyChange,
}: ReportControlsProps) {
  // Shown ONLY when there is a choice to make. A single-currency Book never sees this control and
  // never learns it exists — the commonest Book gets the simplest screen.
  const multiCurrency = currencies.length > 1

  return (
    <div className={styles.controls}>
      <label className={styles.field}>
        <span className={styles.label}>Period</span>
        <select
          className={styles.select}
          value={range.id}
          onChange={(event) => onRangeChange(event.target.value as RangeId)}
        >
          {PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
          {/* Only ever present when a URL carried dates matching no preset. Those dates are valid
              API input and honouring them is the entire point of putting absolute dates in the
              URL — discarding a bookmark would defeat it. This is a label for a state that
              arrived, not a date picker. */}
          {range.id === 'custom' ? <option value="custom">Custom range</option> : null}
        </select>
      </label>

      {multiCurrency ? (
        <fieldset className={styles.scope}>
          <legend className={styles.label}>Currency</legend>
          <div className={styles.segments}>
            {currencies.map((code) => (
              <label key={code} className={styles.segment}>
                <input
                  type="radio"
                  name="report-currency"
                  value={code}
                  checked={code === currency}
                  onChange={() => onCurrencyChange(code)}
                  className={styles.radio}
                />
                <span className={styles.segmentLabel}>{code}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
    </div>
  )
}
