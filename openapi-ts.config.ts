import { defineConfig } from '@hey-api/openapi-ts'

// The wire contract lives in a sibling repo and is the ONLY source of truth for request and
// response types. Nothing under `output` is written by hand or edited by hand — it is
// regenerated on every `dev`, `build` and `typecheck`, and it is git-ignored so there is no
// stale copy to accidentally trust.
//
// `operationId` in the spec is the generated method name (see life-tracker-contracts/CLAUDE.md),
// so the SDK exposes `login`, `recordTransaction`, `listLabels` and friends directly.
export default defineConfig({
  input: '../life-tracker-contracts/openapi.yaml',
  output: {
    path: 'src/api/generated',
    format: 'prettier',
  },
  plugins: [
    {
      name: '@hey-api/client-fetch',
      // Written into the generated client's import statement verbatim, so it is relative to
      // `output.path` (src/api/generated) rather than to this config file.
      runtimeConfigPath: '../runtimeConfig.ts',
    },
    '@hey-api/sdk',
    '@hey-api/typescript',
  ],
})
