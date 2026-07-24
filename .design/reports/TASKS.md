# Build Tasks: Reports (life-tracker-web)

Generated from: `.design/reports/DESIGN_BRIEF.md`
Also reads: `.design/reports/INFORMATION_ARCHITECTURE.md`, `src/styles/tokens.css`
Date: 2026-07-24

New components live in **`src/reports/`**, matching the existing by-feature layout
(`src/ledger/`, `src/money/`, `src/auth/`). The page itself is `src/routes/ReportsPage.tsx`,
matching the existing route convention. Tests are colocated as `*.test.ts` / `*.test.tsx`.

**Ordering rationale.** The two genuinely risky pieces — the money display retrofit and the label
tree reconciliation — are both *pure logic*, so they come first and are proved by tests before any
UI depends on them. Only then does the surface get built, most-prominent element first, so the
aesthetic can be validated before detail work.

Every request and response type is **generated** from `life-tracker-contracts/openapi.yaml` into
`src/api/generated`. No task below hand-writes one. No task below needs a spec change.

## Foundation

- [x] **Money display normalisation**: Add `formatForDisplay(amount, currency)` to
  `src/money/amount.ts` — trim the wire string to the currency's minor-unit count and insert
  grouping separators, using **string operations only** (no `Number`, no `toFixed`, no `Intl`).
  Wire it into `MoneyText` so every figure in the app changes at once. Done when `"12.3400"`
  renders `12.34`, `"12480.0000"` renders `12,480.00`, `"-5.00"` renders `-5.00`, and a
  zero-decimal currency (JPY) renders no decimal point at all. _Modifies: `MoneyText`,
  `amount.ts`. **Highest-risk task and it lands first**: it changes every figure on `/accounts`,
  `/`, and `/transactions/:id`, all of which have already passed a design review. Re-check those
  three screens as part of this task, not later. Extend `amount.test.ts` and `MoneyText.test.tsx`;
  the existing tests proving a double would corrupt these values must still pass unchanged._

- [x] **Money arithmetic for reports**: Add `subtractAmounts(a, b)` — the exact same-currency
  sibling of the existing `addAmounts`, correct for negative results — and `barWidth(part, whole)`
  returning a 0–1 ratio. `barWidth` carries **the codebase's only lint-disable** for the `Number`
  ban, with a comment stating the value is a layout ratio and never money. Done when
  `subtractAmounts` is exact on the cases a float corrupts (`"0.1"`/`"0.2"`, four-decimal values)
  and `barWidth` returns 0 for a zero whole rather than dividing by it. _Modifies: `amount.ts`.
  Tests in `amount.test.ts`._

- [x] **Label tree and reconciliation**: New `src/reports/labelTree.ts` — build a tree from the
  flat `LabelAmount[]` using `parentLabelId`, filtered to one currency, with the Uncategorized row
  (null `labelId`) held separately as a sibling of the roots rather than inside the tree. Done
  when a test asserts the load-bearing invariant: **`Σ rolledUp(roots) + Uncategorized.own` equals
  the panel's `totals` figure for that currency, exactly, as strings.** Also handle: a label whose
  parent is absent from the response, and a three-level chain. _New. Pure function, no UI —
  follows the `groupAccounts` / `setupPlan` precedent. `labelTree.test.ts`._

- [x] **The `/reports` route and the third nav item**: Add the route inside `RequireSession` and
  `RequireAccounts` in `App.tsx`, add the third `NavLink` to `AppShell`, and **rewrite the
  doctrine comment at `AppShell.tsx:10`** — it currently asserts that a third item would be wrong,
  which this task makes false. Replacement claim: the app records and it reviews; accounts are
  what make both work. Page renders its headings and nothing else. Aesthetic is **Dieter Rams
  (Functionalist)**, inherited unchanged — warm neutrals, borders over shadows, one accent
  reserved for the primary action and focus. Done when Reports is reachable from the top bar at
  every breakpoint, the guard chain still sends a session-less visitor to `/login`, and no stale
  comment contradicts the code. _Modifies: `App.tsx`, `AppShell.tsx`. New: `ReportsPage.tsx`._

## Core UI

- [x] **Net worth strip**: Fetch `getNetWorth` and render every currency side by side, above the
  range control, labelled "as of today". Uses `--net-worth-font-size` (`2xl`) — **not** `4xl`,
  which the token file reserves for the entry amount field. Done when a two-currency Book shows
  both figures, a negative net worth renders with its sign and `--color-money-negative` as
  reinforcement only, and the strip is visually distinct from the panels below so its exemption
  from the range control reads structurally. _New: `NetWorthStrip`. Reuses: `MoneyText`. **Built
  early on purpose** — it is the most prominent element, so the aesthetic can be judged here
  before detail work._

- [x] **Range picker with URL sync**: Four presets — This month (default), Last month, This year,
  All time — as a native `<select>`. Writes resolved absolute dates to `?from=&to=`; This month
  writes nothing, so bare `/reports` is the default. Reads the URL on mount so a bookmarked range
  restores. Done when the back button steps through ranges, a pasted `?from=&to=` renders that
  range, and focus stays on the control across a reload. _New: `RangePicker`._

- [x] **Activity panels, totals only**: One `ActivityPanel` component rendered twice — **Spent**
  and **Earned** — calling `getSpending` and `getIncome` with the selected range. Renders the
  heading, the range, and the per-currency total. Takes the display currency as a prop from the
  start so the later scope control has somewhere to plug in. Done when both panels show correct
  totals for every preset and the two are visibly one component, not two. _New: `ActivityPanel`._

- [x] **Label breakdown rows**: Render the tree from `labelTree.ts` beneath each panel total.
  Roots collapsed showing `rolledUp`; expanding reveals children showing `own`, indented by
  `--tree-indent`. **A leaf renders no disclosure triangle at all** — not a disabled one. Uses
  `aria-expanded` on each toggle and exposes the parent/child relation structurally, since indent
  alone is invisible to a screen reader. Rows are inert: no link, no hover state, no cursor
  change. Done when a three-level tree expands correctly and the visible figures still reconcile.
  _New: `LabelTreeRow`. Depends on: Label tree and reconciliation._

- [x] **Magnitude bars**: A single-tone bar on each row, width from `barWidth()`, using
  `--bar-fill` / `--bar-height` / `--bar-min-width`. **Never the accent** — token decision 3.
  `aria-hidden`, because the figure beside it is the accessible content. Done when a row worth
  0.3% of the total still shows a visible sliver rather than nothing, bars animate to width on
  load, and under `prefers-reduced-motion` they appear at final width immediately. _New:
  `MagnitudeBar`. Depends on: Money arithmetic._

- [x] **The Kept figure**: `Earned − Spent` via `subtractAmounts`, rendered below both panels,
  spanning them on desktop. Stated as a bare figure — no percentage, no framing, no adjective, per
  Principle 1. Done when a negative Kept renders with its sign and no colour-coding beyond the
  standing negative tint. _New: `KeptFigure`. Depends on: Money arithmetic._

## Interactions & States

- [x] **Loading skeletons**: A `PanelSkeleton` per panel, sized to what it replaces so nothing
  reflows on arrival, using `--skeleton-bg` — static, no shimmer. The three requests resolve
  independently, so the page fills top-down in reading order. Done when a throttled connection
  shows no layout shift and no flash of empty state. Covers: initial load, and reload on range
  change. _New: `PanelSkeleton`. Fixes the same gap the previous design review raised against the
  ledger list._

- [x] **Empty states**: Two distinct cases. An **empty range** shows the heading, a zero total,
  and one quiet line saying nothing was recorded in this range. An **empty Book** shows the same
  zeros but points at the ledger. The difference matters — one is "you recorded nothing *then*",
  the other is "you have not started", and only the second is an instruction. Done when both read
  correctly and neither is mistaken for an error. _New: `EmptyRange`._

- [x] **Per-panel error handling**: Render `ProblemBanner` **inside** the failing panel, not at
  page level. Done when a failed spending request leaves the net worth figure and the income panel
  fully intact and readable. Covers: 401 (handled by the existing refresh interceptor), 5xx,
  network failure. _Reuses: `ProblemBanner` unchanged._

- [x] **Currency scope control**: A segmented control beside the range picker, rendered **only**
  when the Book holds more than one currency — single-currency users never see it. Re-scopes the
  two panels **client-side** with no request, since the response already holds every currency.
  Writes `?currency=`. The net worth strip does not respond to it. Done when a single-currency
  Book shows no control at all and a two-currency Book switches instantly. _New: `CurrencyScope`._

## Responsive & Polish

- [x] **Responsive layout**: Mobile (375px) single column, strip wrapping one currency per line.
  Tablet (768px) single column **capped at `--max-width-content`** — this is the exact fault the
  previous design review raised against the entry form at this width and it must not repeat.
  Desktop (≥1024px) Spent and Earned side by side, strip spanning both, Kept beneath. The currency
  control becomes a `<select>` below 768px past three currencies. Breakpoints: 375 / 768 / 1024.
  _Modifies: all reports components._

- [x] **Accessibility pass**: Disclosure toggles reachable and operable in order with correct
  `aria-expanded`; bars `aria-hidden` with the figure always present; every figure carrying its
  currency in its accessible name via the existing `sr-only` mechanism; interactive edges on
  `--color-border-strong`, never `--color-border-primary` (1.32:1, fails); focus never stolen when
  a panel reloads; 44px minimum targets on every toggle. Verify in both themes. _Checks drawn from
  the brief's Accessibility Requirements._

## Review

- [x] **Design review**: Run `/design-review` against `.design/reports/DESIGN_BRIEF.md`. Capture
  `/reports` at 375 / 768 / 1280, in light and dark, plus the expanded-tree and empty-range states.
  **Also re-review `/accounts`, `/`, and `/transactions/:id`** — the money normalisation changed
  every figure on all three, and they last passed review under the old rendering.
