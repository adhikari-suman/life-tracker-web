import type { CreateClientConfig } from './generated/client.gen'
import { getAccessToken } from '../auth/session'

// Runtime configuration for the generated fetch client. The generated code imports this, so it
// is the one place where a base URL and an Authorization header are attached — never at a call
// site, and never by hand-rolling a fetch alongside the SDK.
//
// The spec's `servers` entry is an explicit placeholder ("the real host lands with deployment"),
// so the base URL comes from the environment. In dev, VITE_API_BASE_URL is typically left unset
// and Vite proxies /v1 to a local backend (see vite.config.ts).
export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? '/v1',
  auth: () => getAccessToken() ?? undefined,
})
