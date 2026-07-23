# Build Tasks: Fast Transaction Entry (life-tracker-web)

Generated from: `.design/fast-transaction-entry/DESIGN_BRIEF.md`
Also reads: `INFORMATION_ARCHITECTURE.md`, `DESIGN_TOKENS.css`
Date: 2026-07-23

**Codebase state:** `life-tracker-web` does not exist — not locally, not on GitHub. There are no
components to reuse, no tokens to extend, no conventions to follow. Every task below creates
new code. The repo must be scaffolded as part of Task 1 rather than as a task of its own, since
"set up the project" is not a vertical slice.

**Ordering rationale.** Risk first, then visual priority. Task 1 proves the generated-client
pipeline works before anything is built on top of it — if OpenAPI codegen cannot be made to
work, every subsequent task is invalid, and that must surface on day one rather than in week
three. Task 4 puts the amount field on screen early so the Rams direction can be judged before
detail work is invested.

**Non-negotiable across every task:** request and response types are **generated** from
`life-tracker-contracts/openapi.yaml`. Never hand-write a wire type. Never hand-edit the
generated client. If a field seems missing, stop and design it in the spec — do not invent it in
this repo.

---

## Foundation

- [ ] **Sign-in screen, end to end**: Scaffold Vite + React + TypeScript in `life-tracker-web/`,
      wire OpenAPI codegen against `../life-tracker-contracts/openapi.yaml` with the generated
      output git-ignored, import `DESIGN_TOKENS.css`, load IBM Plex Sans + Mono, and build
      `/login` calling the **generated** `login` operation against a running backend. Done when a
      real credential returns a real token and a wrong one renders the `Problem` body. _New. This
      is the riskiest task in the list and therefore first: it proves the contract pipeline, the
      token file, and the aesthetic in one slice._ Establishes the **Dieter Rams** direction —
      restrained neutrals, single burnt-orange accent, borders over shadows.

- [ ] **`MoneyText` and the money-string discipline**: A component that renders a
      `{ amount, currency }` pair verbatim in mono with tabular numerals, plus the input
      counterpart that keeps a decimal **string** in state from keystroke to request body. Add a
      test asserting `"1200.00"` survives a round trip unchanged, and a lint rule banning
      `parseFloat`/`Number()` on any wire value. Done when no code path can turn an amount into a
      JavaScript number. _New. Depends on: sign-in screen (for the generated types)._

- [ ] **App shell and the redirect guard**: `AppShell` (top bar, two nav destinations, account
      menu), `AuthLayout`, routing for all nine routes, and the three-step guard from the IA — no
      session → `/login`; session with zero accounts → `/setup`, unskippable; otherwise the
      requested route. Done when the guard is provably unbypassable by typing a URL. _New.
      Depends on: sign-in screen._

## Core UI

- [ ] **Amount field**: The largest element in the app — `--font-size-4xl`, mono, focused on
      mount, decimal keypad on mobile (`inputMode="decimal"`), currency adornment driven by the
      selected account. Done when it is usable one-handed on a 375px viewport and never holds a
      number in state. _New. Depends on: `MoneyText`. Build early — this is where the aesthetic
      direction gets judged._

- [ ] **Intent selector**: Segmented control for Spent / Earned / Moved / Paid off. Always
      visible, never a dropdown, options comparable at a glance. Selecting an intent is what
      filters the account pickers by kind. Done when choosing an intent visibly reconfigures the
      form beneath it. _New._

- [ ] **Account pickers**: Two pickers filtered by account kind according to the active intent,
      each showing the account's currency because that determines the cross-currency path. Done
      when it is structurally impossible to select a pairing the chosen intent does not permit.
      _New. Depends on: intent selector._

- [ ] **Label picker with inline creation**: Flat `listLabels` fetch cached client-side and
      filtered in memory (the spec states there is deliberately no search endpoint), rendering a
      ≤3-level tree with full paths for disambiguation. **Must include create-inline** via
      `createLabel` — label management is out of scope, so without it no label can ever exist.
      Renders **not at all** for Moved and Paid off. Done when switching to Moved removes the
      field entirely rather than disabling it. _New._

- [ ] **Cross-currency second amount**: A `toAmount` field that appears only when the two selected
      accounts differ in currency, labelled as the figure that *actually arrived*. The app never
      multiplies by a rate to produce an amount. Done when a same-currency pairing never shows it
      and a cross-currency one cannot be submitted without it. _New. Depends on: account pickers,
      amount field._

- [ ] **Transaction list**: Newest-first, virtualized, reading `listTransactions`. Reconstructs
      each row in the intent's language from its postings — never as debits and credits. Supports
      the `?account=` filter. Done when 5,000 transactions scroll without jank. _New. Depends on:
      `MoneyText`._

## Interactions & States

- [ ] **The undo commit queue**: The brief's central mechanism. On submit the row appears
      immediately and a countdown starts; the POST fires only when it elapses. Cancel removes the
      row having sent nothing. Covers: pending, committing, committed, failed-with-values-restored,
      and cancelled. Also handles navigation and tab-close while an entry is pending — the queue
      must not silently lose it. Done when a cancelled entry provably never reached the server.
      _New. The highest-risk interaction; do not defer it behind polish._

- [ ] **First-run onboarding at `/setup`**: Guided creation of a minimum account set — one asset,
      one coarse expense, one income, one equity for opening balances. N sequential `createAccount`
      calls with visible progress. **Must be resumable, not restartable**: there is no bulk
      endpoint, no rollback and no delete, so a partial failure leaves real accounts behind and
      re-running the whole flow would duplicate them permanently. Done when killing the network
      halfway and retrying produces no duplicates. _New. Depends on: app shell._

- [ ] **Transaction detail, relabel, and reverse**: `/transactions/:id` showing what happened in
      the intent's language. Relabel in place via `setPostingLabel`/`clearPostingLabel`. "Reverse
      this" composes a mirror transaction with `from`/`to` swapped, dated today, and lands the
      user on `/` with it **pre-filled for review** rather than posting silently. Done when there
      is no edit affordance anywhere, because the API has none. _New. Depends on: transaction
      list, entry form._

- [ ] **`Problem` error handling**: A banner and inline field errors driven by RFC 7807, switching
      on `Problem.code` and never on `detail` prose. Covers at minimum `VALIDATION`,
      `ACCOUNT_NOT_FOUND`, `SAME_ACCOUNT`, `CONVERTED_AMOUNT_REQUIRED`, `LABEL_NOT_APPLICABLE`,
      `LABEL_ARCHIVED`, `TOO_MANY_ATTEMPTS` (with `Retry-After`), and `UNAUTHORIZED` triggering
      refresh-then-retry. **Note:** the spec's `Problem.code` enum omits 10 codes it references
      elsewhere, so the generated union will be incomplete — handle unknown codes gracefully and
      raise the spec fix upstream. _New._

- [ ] **Token refresh and session expiry**: Single-use rotation via `refresh`, queuing concurrent
      401s behind one refresh, and a replayed token revoking the session and returning to
      `/login`. Done when an access token expiring mid-entry does not lose the user's typed
      values. _New._

## Responsive & Polish

- [ ] **Responsive layout**: Single column below 640px with the amount field and keypad in the
      lower half. From **1024px** the entry form and transaction list sit side by side and entry
      becomes a persistent panel rather than a route — a behavioural change, not a reflow.
      Breakpoints: 375, 768, 1024, 1280. _Depends on: transaction list, entry form._

- [ ] **Accessibility pass**: Full keyboard path through entry including the label tree and the
      undo cancel; `role="status"` on the countdown; the undo window adjustable and disableable
      (WCAG 2.2.1); accessible names on amount fields including currency; focus to the new row on
      commit and back to the amount field on reset; `prefers-reduced-motion` honoured without
      collapsing `--duration-undo-window`. Verify no meaning is carried by colour alone — money
      direction must read from sign and wording. _Checks drawn from the brief's accessibility
      section._

- [ ] **Dark mode verification**: Confirm both `[data-theme="dark"]` and `prefers-color-scheme`
      paths, and that the manual toggle overrides the system preference in both directions.
      Token values are already contrast-verified; this task confirms they are actually applied.
      _Depends on: all UI tasks._

## Review

- [ ] **Design review**: Run `/design-review` against the brief.

---

## Deliberately not tasks

- **Reports** (net worth, spending, income) — endpoints exist and are tempting. Out of scope.
- **Sharing, viewer mode, session management UI** — real and spec'd; separate briefs.
- **Label tree management** (rename, reparent, archive, delete) — full CRUD exists; this build
  only picks and creates inline.
- **Editing or deleting a transaction** — no such endpoint exists. Reversal is the mechanism.
- **Splits, merchant, branch** — in the domain glossary but not in the spec. Must not be invented.

## Blockers to clear before or during the build

1. **`life-tracker-contracts/CLAUDE.md` is stale** — it says the Ledger is undesigned and must not
   be added, while `openapi.yaml` already carries it in full. Any agent starting in that repo will
   be actively misdirected. Fix before Task 1.
2. **`Problem.code` omits 10 referenced codes** — `LABEL_NOT_FOUND`, `LABEL_NAME_TAKEN`,
   `LABEL_DEPTH_EXCEEDED`, `LABEL_CYCLE`, `LABEL_IN_USE`, `LABEL_HAS_CHILDREN`, `LABEL_ARCHIVED`,
   `LABEL_NOT_APPLICABLE`, `POSTING_NOT_FOUND`, `MALFORMED_REQUEST`. Fix in the spec, never in the
   consumer.
3. **`GET /transactions` has no pagination** — the whole history returns every call. Virtualizing
   the list is a client-side mitigation, not a fix.
4. **Refresh tokens in JS-reachable storage** — the spec's own pre-production note says browser
   refresh delivery must move to an httpOnly cookie before the web client faces real users, and is
   explicit: *do not ship web without it*. Not a blocker for building; a hard blocker for shipping.
