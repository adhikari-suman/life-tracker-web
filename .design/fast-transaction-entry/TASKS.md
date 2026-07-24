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

- [x] **Sign-in screen, end to end**: Scaffold Vite + React + TypeScript in `life-tracker-web/`,
      wire OpenAPI codegen against `../life-tracker-contracts/openapi.yaml` with the generated
      output git-ignored, import `DESIGN_TOKENS.css`, load IBM Plex Sans + Mono, and build
      `/login` calling the **generated** `login` operation against a running backend. Done when a
      real credential returns a real token and a wrong one renders the `Problem` body. _New. This
      is the riskiest task in the list and therefore first: it proves the contract pipeline, the
      token file, and the aesthetic in one slice._ Establishes the **Dieter Rams** direction —
      restrained neutrals, single burnt-orange accent, borders over shadows.

      > **Done, and verified against a live backend.** Codegen runs against the sibling spec on
      > every `dev`/`build`/`typecheck`; the SDK's `login` is called with generated types
      > throughout; tokens and both IBM Plex faces load; typecheck, lint and build are clean.
      >
      > The acceptance test was run for real against `life-tracker-backend`'s compose stack
      > (`docker compose --profile full up -d --build`), with no stubs anywhere: a registered
      > credential returns HTTP 200 and stores a genuine three-part RS256 JWT whose `iss` is
      > `http://localhost:8080/v1`, and a wrong password returns the backend's real RFC 7807
      > body, which renders as "Email or password is incorrect." — designed copy switched on
      > `Problem.code`, never the server's `detail` prose. Nine browser checks, all passing,
      > including that the copy does not leak whether an email is registered and that focus
      > lands on the password field for the retry. The earlier stubbed runs covering 429 with
      > `Retry-After`, a proxy 502 with no `Problem` body, and empty-field validation still
      > stand.
      >
      > **The dev-server proxy turns out to be required, not a convenience.** The backend has no
      > CORS configuration at all, so a browser calling `http://localhost:8080/v1` directly from
      > the dev origin fails at preflight. `VITE_API_BASE_URL` must stay unset in development so
      > calls go to `/v1` same-origin and are proxied. The proxy passes `/v1` through unrewritten
      > because it is the backend's own `server.servlet.context-path` (ADR-0017), not a prefix a
      > gateway strips.
      >
      > Two things found by building it, both fixed: `runtimeConfigPath` is written into the
      > generated import verbatim, so it must be relative to the output directory, not the
      > config file; and giving the form controls the `disabled` attribute during submit threw
      > focus to `<body>` on every failed sign-in. The second is why the button uses
      > `aria-disabled` and a guard in the handler instead.

- [x] **`MoneyText` and the money-string discipline**: A component that renders a
      `{ amount, currency }` pair verbatim in mono with tabular numerals, plus the input
      counterpart that keeps a decimal **string** in state from keystroke to request body. Add a
      test asserting `"1200.00"` survives a round trip unchanged, and a lint rule banning
      `parseFloat`/`Number()` on any wire value. Done when no code path can turn an amount into a
      JavaScript number. _New. Depends on: sign-in screen (for the generated types)._

      > **Done.** Everything money-shaped lives in `src/money/`: `amount.ts` (the string logic),
      > `MoneyText`, `AmountInput`. Vitest added; 70 tests pass. The round-trip test covers nine
      > amounts a double destroys, not just `"1200.00"` — trailing zeros, 4-decimal amounts, and
      > one past `MAX_SAFE_INTEGER` — and a companion test asserts those amounts really are
      > destroyed by a float, so the suite cannot quietly stop proving anything. Mutation-checked:
      > rendering through a number fails 7 tests, sanitizing through a float fails 12.
      >
      > **The lint rule is weaker than this task assumed, and the gap is worth knowing.** oxlint
      > has no `no-restricted-syntax`, so `no-restricted-globals` on `parseFloat`/`parseInt`/
      > `Number` is the strongest available — it does catch `Number(x)`, `Number.parseFloat` and
      > `Number.parseInt`, but it CANNOT catch unary `+value` or `value * 1`. Lint alone
      > therefore cannot deliver "no code path can turn an amount into a number". Two further
      > layers close it: `toMoney()` is the only way this app builds a `Money` and validates the
      > string against the spec's grammar (rejecting `"1e-7"`, `"NaN"` and
      > `"0.30000000000000004"` — what a float looks like on the way out), and every numeric
      > conversion anywhere in the repo now needs a written justification, because the ban is
      > repo-wide. There is exactly one such disable today, for `Retry-After` in
      > `src/api/problem.ts`, which is a count of seconds rather than money.
      >
      > `AmountInput` is `type="text"` with `inputMode="decimal"`, deliberately: `type="number"`
      > exposes `valueAsNumber`, which is the hazard itself. It is at base size here; Task 4
      > scales it to `--amount-field-font-size`.

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

   _Corrected after running codegen in Task 1._ The omission is real — those codes appear in the
   spec's own response descriptions — but the consequence stated here was wrong. `Problem.code`
   carries **no `enum` at all**, just a prose list inside its `description`, so it generates as
   `code?: string`. There is no incomplete union and nothing fails to compile; the cost is that
   there is no compiler help either, and an unhandled code passes through silently. `Problem` is
   therefore normalized once, in `src/api/problem.ts`, which treats an unrecognised or absent
   code as an expected state rather than an edge case. Adding the `enum` to the spec would turn
   this into a checked switch and is still worth doing.
3. **`GET /transactions` has no pagination** — the whole history returns every call. Virtualizing
   the list is a client-side mitigation, not a fix.
4. **Refresh tokens in JS-reachable storage** — the spec's own pre-production note says browser
   refresh delivery must move to an httpOnly cookie before the web client faces real users, and is
   explicit: *do not ship web without it*. Not a blocker for building; a hard blocker for shipping.
5. **The backend returns a `Problem` field the spec does not declare.** _Found by running the live
   stack in Task 1._ Every error body carries `instance` — e.g.
   `{"detail":"Authentication failed.","instance":"/v1/auth/login","status":401,`
   `"title":"Unauthorized","code":"UNAUTHORIZED"}` — but `Problem` in `openapi.yaml` declares only
   `type`, `title`, `status`, `detail` and `code`, and sets `additionalProperties: false`.

   The backend is the one behaving correctly here: `instance` is a standard RFC 7807 member
   (§3.1), and the spec says `Problem` *is* an RFC 7807 problem detail. So **the spec is wrong,
   not the backend** — it should declare `instance` rather than forbid it. Harmless today
   because this client does not validate response bodies, and `instance` is simply invisible in
   the generated type. It stops being harmless the moment anything validates responses against
   the schema, or a consumer wants the field. Fix in the spec.

6. **The backend has no CORS configuration.** No `CorsConfigurationSource`, nothing in
   `SecurityConfig`. Not a defect — the web client proxies through the dev server and is
   same-origin, so nothing is needed for development, and a deployment would normally put both
   behind one origin. Recorded because it is a silent constraint: pointing `VITE_API_BASE_URL`
   straight at `http://localhost:8080/v1` looks reasonable and fails every request at preflight.
