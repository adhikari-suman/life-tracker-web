import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Account, User } from '../api/generated/types.gen'
import App from '../App'
import { SessionProvider } from '../auth/SessionProvider'
import { clearSession, getAccessToken } from '../auth/session'

// The task's acceptance criterion is "provably unbypassable by typing a URL". This file is the
// proof: every route in the information architecture, entered directly, from each of the three
// session states the guard distinguishes.
//
// It drives the real App and the real SessionProvider. Only the generated SDK is mocked, because
// the point is to prove the route tree and the guard chain, not the network.

vi.mock('../api/generated/sdk.gen', () => ({
  getMe: vi.fn(),
  listAccounts: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}))

const { getMe, listAccounts, login, logout } = await import('../api/generated/sdk.gen')

const USER: User = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'designer@example.com',
  emailVerified: true,
  createdAt: '2026-07-23T00:00:00Z',
}

const ACCOUNT: Account = {
  id: '00000000-0000-4000-8000-000000000002',
  name: 'Current account',
  kind: 'ASSET',
  currency: 'USD',
  balance: { amount: '1200.00', currency: 'USD' },
}

/** Reports where the router actually ended up, which is what every assertion here is about. */
function LocationProbe() {
  const location = useLocation()
  return <span data-testid="pathname">{location.pathname}</span>
}

type Scenario = 'anonymous' | 'stale-token' | 'no-accounts' | 'ready'

function setUpSession(scenario: Scenario) {
  clearSession()

  if (scenario === 'anonymous') return

  // A token in storage is all the client has before it asks. Whether it means anything is what
  // getMe decides — which is the entire reason the guard is not written against this value.
  sessionStorage.setItem('lt.accessToken', 'a-token')
  sessionStorage.setItem('lt.refreshToken', 'a-refresh-token')

  if (scenario === 'stale-token') {
    vi.mocked(getMe).mockResolvedValue({
      error: { title: 'Unauthorized', status: 401, code: 'UNAUTHORIZED' },
      response: new Response(null, { status: 401 }),
    } as never)
    return
  }

  vi.mocked(getMe).mockResolvedValue({
    data: USER,
    response: new Response(null, { status: 200 }),
  } as never)
  vi.mocked(listAccounts).mockResolvedValue({
    data: scenario === 'ready' ? [ACCOUNT] : [],
    response: new Response(null, { status: 200 }),
  } as never)
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SessionProvider>
        <LocationProbe />
        <App />
      </SessionProvider>
    </MemoryRouter>,
  )
}

/**
 * Assert where the router settles after entering `path` directly.
 *
 * A redirect chain can be more than one hop — /login -> / -> /setup for a signed-in user with no
 * accounts — and each hop is its own render tick, so a single read after the loading state
 * clears can sample the pathname mid-transition. This waits for the pathname to REACH `expected`
 * (which covers both a redirect and a route that was already correct), then flushes one more
 * tick and asserts it has not drifted — which is what catches a route that renders briefly
 * before a late guard bounces it away.
 */
async function settle(expected: string): Promise<void> {
  // Exact equality, not toHaveTextContent — that is a substring match, and "/" is a substring
  // of every path, so it would pass against literally anywhere.
  const pathname = () => screen.getByTestId('pathname').textContent
  await waitFor(() => expect(pathname()).toBe(expected))
  // Flush any pending Navigate effect, then confirm the route did not drift — which is what
  // catches a page that renders briefly before a late guard bounces it away.
  await act(async () => {
    await Promise.resolve()
  })
  expect(pathname()).toBe(expected)
}

async function expectSettledAt(path: string, expected: string): Promise<void> {
  renderAt(path)
  await settle(expected)
}

beforeEach(() => {
  vi.mocked(logout).mockResolvedValue({ response: new Response(null, { status: 204 }) } as never)
})

afterEach(() => {
  clearSession()
  sessionStorage.clear()
  vi.clearAllMocks()
})

describe('step 1 — no session goes to /login, whatever was typed', () => {
  beforeEach(() => setUpSession('anonymous'))

  it.each(['/', '/accounts', '/transactions/00000000-0000-4000-8000-000000000003', '/setup'])(
    'sends %s to /login',
    async (path) => {
      await expectSettledAt(path, '/login')
    },
  )

  it('never asks the server, because there is no token to ask about', async () => {
    renderAt('/')
    await settle('/login')
    expect(getMe).not.toHaveBeenCalled()
  })

  it('leaves /login alone', async () => {
    await expectSettledAt('/login', '/login')
  })
})

describe('a token that the server rejects is not a session', () => {
  beforeEach(() => setUpSession('stale-token'))

  it('sends the ledger to /login despite a token being in storage', async () => {
    await expectSettledAt('/', '/login')
  })

  it('discards the stale token, so the bounce does not repeat', async () => {
    renderAt('/')
    await settle('/login')
    expect(getAccessToken()).toBeNull()
  })
})

describe('step 2 — a session with zero accounts is confined to /setup', () => {
  beforeEach(() => setUpSession('no-accounts'))

  it.each(['/', '/accounts', '/transactions/00000000-0000-4000-8000-000000000003'])(
    'sends %s to /setup',
    async (path) => {
      await expectSettledAt(path, '/setup')
    },
  )

  it('leaves /setup alone', async () => {
    await expectSettledAt('/setup', '/setup')
  })

  it('renders /setup without the app shell, so there is nowhere to navigate away to', async () => {
    renderAt('/setup')
    await settle('/setup')
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull()
  })

  it('sends a signed-in user off /login and onward to /setup, not to the ledger', async () => {
    // Two hops: RedirectIfSignedIn -> "/", then RequireAccounts -> "/setup". Worth pinning,
    // because a guard chain that resolved only one hop per navigation would strand them on a
    // ledger with no accounts.
    await expectSettledAt('/login', '/setup')
  })
})

describe('step 3 — a session with accounts gets the route it asked for', () => {
  beforeEach(() => setUpSession('ready'))

  it.each(['/', '/accounts', '/transactions/00000000-0000-4000-8000-000000000003'])(
    'serves %s',
    async (path) => {
      await expectSettledAt(path, path)
    },
  )

  it('sends /setup to the ledger, because there is nothing left to set up', async () => {
    // Not merely tidy: /setup creates accounts through N sequential calls with no bulk endpoint,
    // no rollback and no delete, so re-entering it would duplicate them permanently.
    await expectSettledAt('/setup', '/')
  })

  it('sends /login to the ledger', async () => {
    await expectSettledAt('/login', '/')
  })

  it('renders the shell with exactly two destinations', async () => {
    renderAt('/')
    await settle('/')
    const nav = screen.getByRole('navigation', { name: 'Main' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((l) => l.textContent)).toEqual(['Ledger', 'Accounts'])
  })
})

describe('routes that stay reachable in either state', () => {
  it.each(['/forgot-password', '/reset-password', '/verify-email'])(
    'serves %s when anonymous',
    async (path) => {
      setUpSession('anonymous')
      await expectSettledAt(path, path)
    },
  )

  it.each(['/forgot-password', '/reset-password', '/verify-email'])(
    'serves %s when signed in — an emailed link is usually opened by someone already signed in',
    async (path) => {
      setUpSession('ready')
      await expectSettledAt(path, path)
    },
  )
})

describe('an unknown address is a 404, not a redirect', () => {
  it.each(['anonymous', 'ready'] as const)('stays put when %s', async (scenario) => {
    setUpSession(scenario)
    await expectSettledAt('/nonsense', '/nonsense')
    expect(screen.getByRole('heading', { name: 'Not found' })).toBeInTheDocument()
  })

  it('does not reveal whether a guarded address exists', async () => {
    // /accounts redirects an anonymous visitor to /login; /nonsense must not, or the difference
    // between the two answers becomes a way to enumerate the app's routes.
    setUpSession('anonymous')
    await expectSettledAt('/nonsense', '/nonsense')
  })
})

describe('the interrupted destination is returned to after signing in', () => {
  it('lands on /accounts, not on /', async () => {
    setUpSession('anonymous')
    renderAt('/accounts')
    await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent('/login'))

    // Signing in flips the scenario: the same mocks now answer as a real session.
    sessionStorage.setItem('lt.accessToken', 'a-token')
    vi.mocked(login).mockResolvedValue({
      data: {
        accessToken: 'a-token',
        tokenType: 'Bearer',
        expiresIn: 900,
        refreshToken: 'a-refresh-token',
      },
      response: new Response(null, { status: 200 }),
    } as never)
    vi.mocked(getMe).mockResolvedValue({
      data: USER,
      response: new Response(null, { status: 200 }),
    } as never)
    vi.mocked(listAccounts).mockResolvedValue({
      data: [ACCOUNT],
      response: new Response(null, { status: 200 }),
    } as never)

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Email'), USER.email)
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery-staple')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent('/accounts'))
  })
})
