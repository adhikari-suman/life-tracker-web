# life-tracker-web

The React SPA. Vite + React + TypeScript.

## Running it

Node comes from `.nvmrc`:

```sh
nvm use
npm install
npm run dev
```

`dev` regenerates the API client before starting, so a spec change in the sibling repo shows up
as a type error rather than as a runtime surprise. The dev server proxies `/v1` to
`http://localhost:8080`; set `VITE_BACKEND_ORIGIN` if the backend is elsewhere. See
`.env.example` — both variables are optional.

| Script | What |
|---|---|
| `npm run dev` | Regenerate the client, then start Vite. |
| `npm run build` | Regenerate, typecheck, bundle. |
| `npm run typecheck` | Regenerate, then `tsc -b --force`. |
| `npm run codegen` | Regenerate the client only. |
| `npm run test` | Vitest, once. |
| `npm run test:watch` | Vitest, watching. |
| `npm run lint` | oxlint. |

## The generated API client — read this before adding an endpoint call

`src/api/generated/` is produced from `../life-tracker-contracts/openapi.yaml` and is
**git-ignored**. It is not a cache you may edit; it is overwritten on every `dev`, `build` and
`typecheck`.

- Never hand-write a request or response type. Import it from the generated types.
- Never hand-edit the generated client.
- Need a field that isn't in the spec? Stop and add it to the spec. A guess compiles, which is
  precisely what makes it dangerous.

Methods are named for the spec's `operationId` — `login`, `recordTransaction`, `listLabels` —
so renaming one in the spec is a breaking change here.

## Money is a string, and stays one

`{ "amount": "12.34", "currency": "USD" }`. A JSON number is an IEEE 754 double, which cannot
represent most decimal fractions and silently drops the trailing zeros that are the pennies —
`"1200.00"` comes back from a double as `"1200"`. Amounts are decimal strings from the input
element to the request body and back, and are never parsed into a number, summed client-side, or
formatted through anything that round-trips a float.

Everything that touches an amount lives in **`src/money/`**:

- `amount.ts` — sanitizing typed input, validating against the spec's grammar, and `toMoney()`,
  which is the only way this app builds a `Money`.
- `MoneyText` — the sole authority for putting a figure on screen. Renders the string verbatim.
  `Intl.NumberFormat` is not used anywhere, because it takes a number.
- `AmountInput` — `type="text"` with `inputMode="decimal"`. Never `type="number"`, which exposes
  `valueAsNumber`.

Three layers keep it honest, because no one of them is sufficient:

1. **Lint.** `no-restricted-globals` bans `parseFloat`, `parseInt` and `Number` repo-wide, which
   covers `Number(x)`, `Number.parseFloat` and `Number.parseInt`. It does **not** catch unary
   `+value` — oxlint has no `no-restricted-syntax`. Every legitimate numeric conversion needs an
   inline disable saying what it is converting; there is one, for `Retry-After`.
2. **Validation.** `toMoney()` rejects anything that is not a decimal string of up to 4
   fractional digits — which is exactly what a stringified double fails.
3. **Tests.** `amount.test.ts` round-trips amounts chosen because a double destroys them, and
   asserts that a double really does destroy them.

## Layout

```
src/
├── api/          runtimeConfig (base URL + auth header), problem normalization, generated/
├── auth/         token storage
├── components/   shared UI
├── routes/       one file per route
└── styles/       tokens.css — the design system, imported once in main.tsx
```

`src/styles/tokens.css` is the output of the design process in `.design/fast-transaction-entry/`
and carries the reasoning behind every value in its comments. Read the header before changing a
colour: three of the decisions there are load-bearing rather than aesthetic.

## Design artifacts

`.design/fast-transaction-entry/` holds the brief, information architecture and build task list
this app is being built from. `TASKS.md` is the running checklist.

## Known pre-production blocker

The spec's own note on `/auth/login` is explicit that the refresh token must move to an httpOnly,
Secure, SameSite cookie before the web client faces real users — *"do not ship web without it"*.
Today it lives in `sessionStorage` (`src/auth/session.ts`), which is where that change lands.
