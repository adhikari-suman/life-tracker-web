# Information Architecture: life-tracker-web (Reports)

This document extends the IA written for Fast Transaction Entry rather than replacing it. Nine
routes existed; this adds a tenth. One documented principle is amended, deliberately and with its
reasoning recorded — see **Navigation Model**.

## The structural thesis

The entry IA's thesis was that the app does one thing, so the home route *is* the entry surface
and the navigation has two items. Reports makes that half true. The app now does **two** things —
it records, and it reviews — and the second was always planned: the entry brief called Reports
"the other half of the product" and deprioritised it rather than rejecting it.

So the shape is: one place you write, one place you read, and one place you configure the accounts
both depend on. Three destinations for two jobs, which is the honest count.

## Site Map

```
Unauthenticated
- Sign in                     /login
- Create account              /register
- Forgot password             /forgot-password
- Set new password            /reset-password          ?token=
- Verify email                /verify-email            ?token=

Authenticated — no accounts yet (forced)
- Set up your accounts        /setup

Authenticated — normal
- Ledger (entry + recent)     /                        ?account=<uuid>
- Transaction detail          /transactions/:id
- Accounts                    /accounts
- Reports                     /reports                 ?from= &to= &currency=
```

Ten routes. `/reports` is a leaf: nothing nests beneath it, and nothing on it navigates anywhere.

**Still deliberately absent** (each a top-level destination when it lands): sharing, session
management, label tree management.

## Navigation Model

- **Primary navigation**: **three** items — **Ledger**, **Accounts**, **Reports**.

  This amends a principle stated in both the entry IA and in `AppShell.tsx:10`: *"Two destinations,
  and that is the whole of the navigation. A third would imply the app does three things, and it
  does not — everything else is support for recording a transaction."*

  That was true when recording was all the app could do. It is not true now. The comment must be
  rewritten as part of this feature, not left contradicting the code beneath it — a stale
  principle is worse than no principle, because the next person will take it as binding and route
  around it. The replacement claim: **the app records and it reviews; accounts are what make both
  work.** The rule that survives is the one that mattered — no fourth item without the same
  argument being made again.

- **Order**: Ledger, Accounts, Reports. Not frequency order — Reports will outrank Accounts in
  visits — but *lifecycle* order: you set up accounts, you record, you review. Reports sits last
  because it is the terminus of the loop, and because appending is less disruptive to the muscle
  memory of anyone already using the two-item bar.

- **Secondary navigation**: none. `/reports` is one level deep with no sub-pages, no tabs, and no
  breadcrumb. The range control and currency scope are *filters*, not navigation, even though
  both write to the URL.

- **Utility navigation**: unchanged — the Profile menu at the far end of the top bar (email,
  theme, sign out). Still called Profile, never Account, because *account* belongs to the Ledger.

- **Mobile navigation**: unchanged in mechanism — no hamburger, no bottom tab bar. Three items
  still fit a top bar at 375px in IBM Plex Sans at `--font-size-sm`. If they ever do not, the
  answer is to shorten the labels, not to introduce a drawer: a drawer would put the app's second
  primary job behind a gesture.

## Content Hierarchy

### Reports `/reports` — the review surface

1. **Net worth, per currency, "as of today"** — first because it is the only figure that needs no
   parameters and answers the largest question. It is also the fastest response, so the page fills
   in reading order rather than jumping. Rendered as a strip, visually distinct from the panels
   below, because it sits *outside* the range control's scope and the layout has to say so before
   a label can.

2. **The range control, and the currency scope beside it** — a boundary line. Everything above is
   "now"; everything below is "in this range". The control's position *is* the explanation of what
   it governs, which is why it is not in the page header.

3. **Spent** — the question people actually arrive with, and the one the whole double-entry
   apparatus exists to answer correctly. Total first, then the label breakdown beneath it.

4. **Earned** — same shape, same rendering. Second because it is the less-asked question, not
   because it matters less.

5. **Kept** — `Earned − Spent`, below both. Last because it is derived: it must read as a
   consequence of the two figures above it, never as a headline that could be checked independently.

6. **Nothing else.** No footer, no links out, no "see all". The page ends.

## User Flows

### The monthly check — the dominant flow

1. User taps **Reports** in the top bar.
2. Three requests fire in parallel; each panel shows a skeleton until its own response lands.
3. User sees net worth as of today, and this month's spending and income.
4. User reads the total and the top two or three label rows.
5. User leaves. **This flow ends without a click.** Most visits are this flow, and the design
   target is that it requires no interaction at all.

### Looking into a label

1. From the monthly check, user sees a root label whose figure surprises them.
2. User activates its disclosure triangle.
   - If the label **has children** → children appear indented, showing their `own` figures; the
     parent continues to show `rolledUp`.
   - If the label **has no children** → there is no triangle to activate. A leaf is not
     expandable, and must not present an affordance that does nothing.
3. User reads the child rows.
4. **The flow stops here.** There is no step 5. `GET /transactions` filters by `accountId` only,
   so the transactions behind a label cannot be listed — rows are inert, with no hover state and
   no cursor change, so the dead end is visible before it is discovered. Recorded as a backend gap
   in the brief.

### Changing the period

1. User opens the range control and picks a preset.
2. The URL updates to resolved dates (`?from=&to=`), or clears them if the choice is This month.
3. Spending and income re-request; **net worth does not move**, and its "as of today" label is
   what makes that stillness read as correct.
4. Focus stays on the range control. A reload must never steal focus from the thing that caused it.
5. Back button returns to the previous range, because the range is in the URL.

### A multi-currency Book

1. User arrives; the net worth strip shows every currency side by side.
2. A currency scope control appears beside the range control — **only** because the Book holds
   more than one. Single-currency Books never see it and never learn it exists.
3. Spending and income show the first currency by default.
4. User switches currency → the two panels re-scope **client-side**; no request is made, because
   the response already contains every currency. The URL gains `?currency=`.
5. The net worth strip does not change. What you are worth is not a per-currency question, even
   though its answer has to be given per currency.

### An empty range

1. User selects a range in which nothing was recorded.
2. Each panel shows its heading, a zero total, and one quiet line stating that nothing was
   recorded in this range.
3. **Distinct from an empty Book**, which shows the same zeros but points at the ledger. The
   difference matters: one is "you have not recorded anything yet", the other is "you recorded
   nothing *then*", and only the first is an instruction.

## Naming Conventions

The UI inherits its vocabulary from `life-tracker-backend/CONTEXT.md` and, where a word already
appears on the entry surface, from there. The closing of that loop is deliberate: **the words a
user picks when recording are the words they meet when reviewing.**

| Concept | Label in UI | Notes |
|---|---|---|
| The surface | **Reports** | Matches the OpenAPI tag and the brief. Not "Insights" (implies interpretation, which Principle 1 forbids), not "Analytics" (a BI word), not "Summary". |
| Assets − Liabilities | **Net worth** | The exact phrase `CONTEXT.md` uses. Not "Balance", not "Total". |
| Expense activity in range | **Spent** | The same word the entry surface's intent selector uses. Not "Expenses" — that names the account kind, not the human act. |
| Income activity in range | **Earned** | Likewise, the intent word. Not "Income" for the same reason. |
| Earned − Spent | **Kept** | Plain and non-evaluative. Not "Saved" (implies virtue — Principle 1), not "Net" (accounting jargon the entry surface spent effort avoiding), not "Surplus". |
| Postings with no label | **Uncategorized** | A defined term in `CONTEXT.md` with that exact spelling. Never "Other", "Misc", or "Unlabelled" — those are labels a user might create; this is the absence of one. |
| A label's own figure | *(no visible word)* | Shown by position — a child row under its parent. Never captioned "own" or "direct". |
| A label's subtree figure | *(no visible word)* | The figure on a collapsed parent. Never captioned "rolled up" or "total" — the indent carries it. |
| Point-in-time qualifier | **as of today** | On the net worth strip. Lowercase, quiet, never "Current" or "Live". |
| A user-defined tag | **label** | Never "category", "tag", or "type" — `CONTEXT.md` lists all three under _Avoid_. |
| A place a balance lives | **account** | Unchanged. Still never used for a user identity, which is Profile. |

## Component Reuse Map

| Component | Used on | Behavior differences |
|---|---|---|
| `AppShell` | all authenticated routes | **Modified**: gains a third `NavLink`, and its doctrine comment is rewritten. No structural change. |
| `MoneyText` | everywhere a figure appears | **Modified**: gains display normalisation. Behaviour is identical across routes — that is the point of changing it centrally rather than only here. |
| `ProblemBanner` | all routes | On `/reports` it renders **per panel**, not per page. A failed spending request must not blank the net-worth figure. |
| `ActivityPanel` | `/reports`, twice | One component, two instances. Differs only in heading and endpoint; identical rendering, since the API returns the identical shape. |
| `PanelSkeleton` | `/reports` | New. Sized to the panel it replaces so nothing reflows on arrival. |
| `AuthLayout` | the five unauthenticated routes | Unchanged. |
| `EntryForm`, `AccountPicker`, `TransactionRow` | ledger routes | Unchanged and unused here. Reports shares no component with the entry surface except `MoneyText` and the chrome. |

## Content Growth Plan

**What grows:** the label tree, and the number of currencies.

- **Labels.** A root's children are bounded by the three-level depth cap (ADR-0015), and
  `CONTEXT.md` states a personal Book holds dozens of labels, not thousands. The breakdown renders
  every root plus Uncategorized with no pagination, and expands one level at a time on demand. If
  a Book ever holds enough roots to scroll unreasonably, the fix is to collapse below the top N
  with a "show all" — not to paginate, which would break the reconciliation that Principle 2
  depends on being visible.
- **Currencies.** The net worth strip wraps; the currency scope control becomes a `<select>` past
  three entries below 768px. Neither grows unbounded in practice — a Book holds the currencies its
  accounts hold.

**What does not grow:** the range presets are a fixed set of four. The page has no list that
accumulates.

**Not a growth problem here:** the unbounded `GET /transactions` payload flagged in the entry IA
does not affect this surface. Reports never fetches transactions — the three report endpoints
return aggregates computed server-side, which is precisely why they scale where the transaction
list does not.

## URL Strategy

- **Pattern**: `/reports`. One segment, no nesting, no dynamic segment. Consistent with the
  existing rule of at most two segments deep.
- **Dynamic segments**: none.
- **Query parameters**:
  - `?from=<ISO date>&to=<ISO date>` — the selected range, as **resolved absolute dates**, mirroring
    the API's own `from`/`to` parameters exactly. Both present or both absent; never one alone.
  - `?currency=<ISO 4217>` — the panel scope. Written only when the Book holds more than one
    currency.
  - **Absent means default**: bare `/reports` is this month, first currency. The commonest state
    has the cleanest URL, and nothing has to be stripped to produce a shareable link to "now".
- **Why resolved dates rather than a preset name.** `?range=last-month` would be shorter, but it
  is time-relative: the same URL means June today and August in September, so it cannot be
  bookmarked or shared. Absolute dates also satisfy the standing rule that **every filter in the
  UI corresponds to a real server capability** — `from` and `to` are literally the API's
  parameters, passed through.
- **No query params for UI state.** Which label rows are expanded is ephemeral and stays out of
  the URL, exactly as the intent selector and label picker do on the entry surface. A half-explored
  tree is not a location.
- **Redirect chain**: unchanged. `/reports` sits inside `RequireSession` and `RequireAccounts`, so
  the existing order holds — no session → `/login`; zero accounts → `/setup`; otherwise the
  requested route.
